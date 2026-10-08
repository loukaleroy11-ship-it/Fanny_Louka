import type { MistakeCategory, MistakeSource, PartOfSpeech } from "@prisma/client";
import { db } from "./db";
import { createUserCard, ensureSystemDecks } from "./cards";
import { recordSkillResult } from "./skills";
import { normalizeWord } from "./normalize";

export interface MistakeInput {
  original: string;
  corrected: string;
  explanation: string;
  category: MistakeCategory;
  skillSlug?: string | null;
}

/** Stores mistakes, raises the priority of the related skills and (optionally) auto-creates flashcards. */
export async function recordMistakes(
  userId: string,
  items: MistakeInput[],
  source: MistakeSource,
  opts: { conversationId?: string; autoCard?: boolean } = {},
) {
  const created = [];
  for (const it of items) {
    if (normalizeWord(it.original) === normalizeWord(it.corrected)) continue;
    const skill = it.skillSlug ? await db.grammarSkill.findUnique({ where: { slug: it.skillSlug }, select: { id: true } }) : null;
    // Ignore exact repeats inside the same conversation (the user hitting the same message twice).
    if (opts.conversationId) {
      const dup = await db.mistake.findFirst({ where: { userId, conversationId: opts.conversationId, original: it.original, corrected: it.corrected } });
      if (dup) continue;
    }
    const m = await db.mistake.create({
      data: {
        userId, category: it.category, skillId: skill?.id ?? null, original: it.original.slice(0, 500),
        corrected: it.corrected.slice(0, 500), explanation: it.explanation.slice(0, 500), source,
        conversationId: opts.conversationId ?? null,
      },
    });
    await recordSkillResult(userId, it.skillSlug, false);
    created.push(m);
  }
  if (opts.autoCard) {
    for (const m of created) {
      const r = await createMistakeCard(userId, m.id);
      if (r) m.flashcardId = r.flashcardId;
    }
  }
  return created;
}

/** Turns a recorded mistake into a flashcard in the "My Mistakes" deck. Idempotent. */
export async function createMistakeCard(userId: string, mistakeId: string) {
  const m = await db.mistake.findFirst({ where: { id: mistakeId, userId }, include: { skill: true } });
  if (!m) return null;
  if (m.flashcardId) return { flashcardId: m.flashcardId, created: false };
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { level: true } });
  const { mistakes } = await ensureSystemDecks(userId);
  const pos: PartOfSpeech = "EXPRESSION";
  const { card } = await createUserCard(userId, {
    word: m.corrected,
    translation: m.explanation,
    example: `❌ ${m.original}`,
    exampleTranslation: `✅ ${m.corrected}`,
    pos,
    level: user.level,
    tags: ["mistake", m.skill?.slug ?? m.category.toLowerCase()],
    deckId: mistakes.id,
    origin: "MISTAKE",
  });
  await db.mistake.updateMany({ where: { userId, corrected: m.corrected }, data: { flashcardId: card.id } });
  return { flashcardId: card.id, created: true };
}

/** Aggregated recurring mistakes for the dashboard and the AI context. */
export async function mistakeSummary(userId: string, take = 6) {
  const groups = await db.mistake.groupBy({
    by: ["skillId", "category"],
    where: { userId },
    _count: { _all: true },
    orderBy: { _count: { skillId: "desc" } },
  });
  const skills = await db.grammarSkill.findMany({ where: { id: { in: groups.map((g) => g.skillId).filter(Boolean) as string[] } } });
  const byLabel = new Map<string, { label: string; slug: string | null; count: number; category: MistakeCategory }>();
  for (const g of groups) {
    const s = skills.find((x) => x.id === g.skillId);
    const label = s?.name ?? g.category[0] + g.category.slice(1).toLowerCase().replace("_", " ");
    const cur = byLabel.get(label);
    byLabel.set(label, { label, slug: s?.slug ?? null, count: (cur?.count ?? 0) + g._count._all, category: g.category });
  }
  return [...byLabel.values()].sort((a, b) => b.count - a.count).slice(0, take);
}
