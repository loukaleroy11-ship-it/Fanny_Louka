/**
 * Seeds the global lexicon: 500 most common words (with source ranks), top-100 verbs, starter decks,
 * cognates / false friends and grammar skills. Idempotent — safe to run repeatedly.
 * Optional: SEED_DEMO=true creates demo@lingua.app / demo12345 (never enable in production).
 */
import { PrismaClient, type Level, type PartOfSpeech } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { GRAMMAR_SKILLS } from "../src/content/grammar";
import { normalizeWord } from "../src/lib/normalize";
import { POS_LABEL } from "../src/lib/filters";

const prisma = new PrismaClient();
const DATA = join(process.cwd(), "data");
const SOURCE = "opensubtitles-2018-en";
const lines = (f: string) => readFileSync(join(DATA, f), "utf8").split("\n").filter(Boolean);

const POS: Record<string, PartOfSpeech> = {
  noun: "NOUN", verb: "VERB", adjective: "ADJECTIVE", adverb: "ADVERB", pronoun: "PRONOUN",
  preposition: "PREPOSITION", conjunction: "CONJUNCTION", determiner: "DETERMINER", auxiliary: "AUXILIARY",
  modal: "MODAL", phrasal_verb: "PHRASAL_VERB", expression: "EXPRESSION", interjection: "INTERJECTION",
};

// Hand-written word families for the "related words" panel of the global search.
const DERIVED: Record<string, string[]> = {
  run: ["runner", "running"], work: ["worker", "working", "workplace"], play: ["player", "playground"],
  teach: ["teacher", "teaching"], speak: ["speaker", "speech"], write: ["writer", "writing"],
  read: ["reader", "reading"], swim: ["swimmer", "swimming"], sing: ["singer", "song"],
  drive: ["driver", "driving"], help: ["helpful", "helpless"], love: ["lovely", "lover"],
  friend: ["friendly", "friendship"], happy: ["happiness", "unhappy"], care: ["careful", "careless"],
  use: ["useful", "useless", "user"], beauty: ["beautiful"], beautiful: ["beauty", "beautifully"],
  music: ["musician", "musical"], act: ["actor", "action", "active"], move: ["movement", "movie"],
  live: ["life", "alive", "living"], think: ["thought", "thinker"], know: ["knowledge", "known"],
  understand: ["understanding", "misunderstand"], believe: ["belief", "believable"], important: ["importance"],
  different: ["difference", "differently"], easy: ["easily", "easier"], hard: ["hardly", "harder"],
  year: ["yearly"], day: ["daily"], night: ["nightly", "midnight"], home: ["homework", "homeless"],
  house: ["housework", "household"], school: ["schoolboy", "schoolteacher"], buy: ["buyer"],
};

function forms(base: string, past: string, pp: string): string[] {
  const set = new Set<string>();
  for (const p of past.split("/")) set.add(p);
  for (const p of pp.split("/")) set.add(p);
  if (base === "be") ["am", "is", "are", "being"].forEach((x) => set.add(x));
  else {
    if (/(s|x|z|ch|sh|o)$/.test(base)) set.add(base + "es");
    else if (/[^aeiou]y$/.test(base)) set.add(base.slice(0, -1) + "ies");
    else set.add(base + "s");
    if (base.endsWith("e") && base.length > 2) set.add(base.slice(0, -1) + "ing");
    else if (/^(stop|sit|run|put|cut|hit|set|let|shut|get|win|swim|begin|forget)$/.test(base)) set.add(base + base.slice(-1) + "ing");
    else set.add(base + "ing");
  }
  set.delete(base);
  return [...set];
}

interface Row {
  word: string; pos: PartOfSpeech; level: Level; ipa: string; fr: string; ex: string; exFr: string;
  lemma?: string; tags: string[]; rank?: number; count?: number; past?: string; pp?: string; verbRank?: number; related?: string[];
}

async function main() {
  const rows = new Map<string, Row>(); // key: normalized|pos
  const key = (w: string, p: PartOfSpeech) => `${normalizeWord(w)}|${p}`;

  // 1. 500 most common words (rank from the frequency source)
  const base = JSON.parse(readFileSync(join(DATA, "common500.base.json"), "utf8")) as { rank: number; word: string; count: number }[];
  const enrich = lines("common500.enrich.txt").map((l) => l.split("|"));
  if (base.length !== 500 || enrich.length !== 500) throw new Error("common500 data must have exactly 500 entries");
  enrich.forEach((e, i) => {
    const [word, pos, level, ipa, fr, ex, exFr, lemma] = e;
    if (base[i].word !== word) throw new Error(`common500 order mismatch at ${i + 1}: ${base[i].word} vs ${word}`);
    const p = POS[pos];
    rows.set(key(word, p), { word, pos: p, level: level as Level, ipa, fr, ex, exFr, lemma, tags: ["deck:common500"], rank: base[i].rank, count: base[i].count });
  });

  // 2. lemma stubs, phrasal verbs, expressions, topic decks
  for (const l of lines("extra.txt")) {
    const [deck, word, pos, level, ipa, fr, ex, exFr] = l.split("|");
    const p = POS[pos];
    const k = key(word, p);
    const existing = rows.get(k);
    const tag = deck === "stub" ? [] : [`deck:${deck}`];
    if (existing) existing.tags.push(...tag);
    else rows.set(k, { word, pos: p, level: level as Level, ipa, fr, ex, exFr, tags: tag });
  }

  // 3. Most common verbs (forms, past, participle, rank in the source list)
  const verbs = JSON.parse(readFileSync(join(DATA, "verbs.json"), "utf8")) as {
    base: string; past: string; participle: string; fr: string; ipa: string; level: Level; example: string;
    exampleFr: string; irregular: boolean; rank: number; listRank: number | null; count: number;
  }[];
  for (const v of verbs) {
    let k = key(v.base, "VERB");
    const tags = ["deck:verbs", ...(v.irregular ? ["deck:irregular-verbs", "irregular"] : [])];
    // "do" is an auxiliary in the 500 list: attach the verb forms to that entry instead of duplicating it.
    if (!rows.has(k) && rows.has(key(v.base, "AUXILIARY"))) k = key(v.base, "AUXILIARY");
    const r = rows.get(k);
    const sameWordRanked = [...rows.values()].some((x) => x.word === v.base && x.rank);
    if (r) {
      r.past = v.past; r.pp = v.participle; r.verbRank = v.rank; r.tags.push(...tags); r.related = forms(v.base, v.past, v.participle);
    } else {
      rows.set(k, {
        word: v.base, pos: "VERB", level: v.level, ipa: v.ipa, fr: v.fr, ex: v.example, exFr: v.exampleFr,
        tags, past: v.past, pp: v.participle, verbRank: v.rank, related: forms(v.base, v.past, v.participle),
        rank: sameWordRanked ? undefined : (v.listRank ?? undefined),
      });
    }
  }
  for (const [k, d] of Object.entries(DERIVED)) {
    for (const r of rows.values()) if (normalizeWord(r.word) === k) r.related = [...new Set([...(r.related ?? []), ...d])];
  }

  // 4. Upsert global vocabulary
  const existing = await prisma.vocabulary.findMany({ where: { ownerId: null }, select: { id: true, normalized: true, pos: true } });
  const have = new Map(existing.map((e) => [`${e.normalized}|${e.pos}`, e.id]));
  const toCreate = [...rows.values()].filter((r) => !have.has(key(r.word, r.pos)));
  await prisma.vocabulary.createMany({
    data: toCreate.map((r) => ({
      word: r.word, normalized: normalizeWord(r.word), pos: r.pos, category: POS_LABEL[r.pos], level: r.level,
      translation: r.fr, ipa: r.ipa, example: r.ex, exampleTranslation: r.exFr, tags: [...new Set(r.tags)],
      pastSimple: r.past ?? null, pastParticiple: r.pp ?? null, verbRank: r.verbRank ?? null, related: r.related ?? [],
    })),
    skipDuplicates: true,
  });
  // refresh derived data on existing rows (idempotent re-seed)
  for (const r of rows.values()) {
    const id = have.get(key(r.word, r.pos));
    if (!id) continue;
    await prisma.vocabulary.update({
      where: { id },
      data: { tags: [...new Set(r.tags)], pastSimple: r.past ?? null, pastParticiple: r.pp ?? null, verbRank: r.verbRank ?? null, related: r.related ?? [], translation: r.fr, ipa: r.ipa, example: r.ex, exampleTranslation: r.exFr, level: r.level },
    });
  }

  const all = await prisma.vocabulary.findMany({ where: { ownerId: null }, select: { id: true, normalized: true, pos: true } });
  const idOf = new Map(all.map((e) => [`${e.normalized}|${e.pos}`, e.id]));

  // 5. Frequency table
  const freq = [...rows.values()].filter((r) => r.rank).map((r) => ({
    vocabularyId: idOf.get(key(r.word, r.pos))!, source: SOURCE, rank: r.rank!, count: r.count ?? 0,
  }));
  await prisma.vocabularyFrequency.createMany({ data: freq, skipDuplicates: true });

  // 6. Lemma links (first matching entry with the lemma's normalized form; verbs preferred for verb forms)
  const byNorm = new Map<string, string>();
  for (const e of all) {
    const prev = byNorm.get(e.normalized);
    if (!prev || e.pos === "VERB" || e.pos === "NOUN") byNorm.set(e.normalized, e.id);
  }
  for (const r of rows.values()) {
    if (!r.lemma) continue;
    const id = idOf.get(key(r.word, r.pos));
    const lemmaId = byNorm.get(normalizeWord(r.lemma));
    if (id && lemmaId && lemmaId !== id) await prisma.vocabulary.update({ where: { id }, data: { lemmaId } });
  }

  // 7. Cognates & false friends
  for (const l of lines("cognates.txt")) {
    const [kind, english, french, a, b] = l.split("|");
    if (kind === "C") {
      await prisma.cognate.upsert({
        where: { english_kind: { english, kind: "COGNATE" } },
        update: { french, level: a as Level, example: b },
        create: { english, french, kind: "COGNATE", meaning: french, level: a as Level, example: b },
      });
    } else {
      await prisma.cognate.upsert({
        where: { english_kind: { english, kind: "FALSE_FRIEND" } },
        update: { french, meaning: a, example: b },
        create: { english, french, kind: "FALSE_FRIEND", meaning: a, example: b, level: "B1" },
      });
    }
  }

  // 8. Grammar skills
  for (const s of GRAMMAR_SKILLS) {
    await prisma.grammarSkill.upsert({
      where: { slug: s.slug },
      update: { name: s.name, description: s.description, level: s.level, lessonSlug: s.lessonSlug ?? null },
      create: { slug: s.slug, name: s.name, description: s.description, level: s.level, lessonSlug: s.lessonSlug ?? null },
    });
  }

  if (process.env.SEED_DEMO === "true") {
    const passwordHash = await bcrypt.hash("demo12345", 10);
    await prisma.user.upsert({ where: { email: "demo@lingua.app" }, update: {}, create: { email: "demo@lingua.app", name: "Demo", passwordHash } });
    console.log("Demo user: demo@lingua.app / demo12345 (cards are created on first login via /api/auth/login)");
  }

  const n = await prisma.vocabulary.count({ where: { ownerId: null } });
  const f = await prisma.vocabularyFrequency.count({ where: { rank: { lte: 500 } } });
  console.log(`Seed done: ${n} global vocabulary entries, ${f} ranked in the top 500, ${verbs.length} verbs.`);
}

main().finally(() => prisma.$disconnect());
