/**
 * MOCK mode — used when no LLM key is configured. Everything here is deterministic and rule-based.
 * It is NOT an AI: the UI shows a "demo mode" badge whenever these functions produce a result.
 * The rules cover the classic errors of French speakers (past simple, 3rd-person -s, prepositions,
 * false friends of structure, articles…) so corrections, recurring-mistake tracking and flashcard
 * generation can be exercised end-to-end without an API key.
 */
import verbs from "../../../data/verbs.json";
import common from "../../../data/common500.base.json";
import type { MistakeCategory } from "@prisma/client";
import type { Correction } from "./schemas";
import { SCENARIOS, scenarioById } from "../../content/scenarios";

const COMMON = new Set((common as { word: string }[]).map((w) => w.word));

// ── verb tables ────────────────────────────────────────────────────────────
const PAST: Record<string, string> = {};
const PP: Record<string, string> = {};
for (const v of verbs as { base: string; past: string; participle: string }[]) {
  if (v.base === "be") continue;
  PAST[v.base] = v.past.split("/")[0];
  PP[v.base] = v.participle.split("/")[0];
}
const REGULAR_EXTRA = "walk play watch work visit talk cook call want like travel stay finish enjoy ask need try listen look love clean open study start help wait move live dance relax shop".split(" ");
function regularPast(b: string) {
  if (b === "study") return "studied";
  if (/[^aeiou]y$/.test(b)) return b.slice(0, -1) + "ied";
  if (b.endsWith("e")) return b + "d";
  return b + "ed";
}
for (const b of REGULAR_EXTRA) if (!PAST[b]) { PAST[b] = regularPast(b); PP[b] = PAST[b]; }
// Verbs whose past equals the base can't be detected as "wrong" — skip them.
for (const b of Object.keys(PAST)) if (PAST[b] === b) delete PAST[b];

function thirdPerson(b: string) {
  if (/(s|x|z|ch|sh|o)$/.test(b)) return b + "es";
  if (/[^aeiou]y$/.test(b)) return b.slice(0, -1) + "ies";
  if (b === "have") return "has";
  return b + "s";
}
const BASES = Object.keys(PAST);
const THIRD_TO_BASE: Record<string, string> = Object.fromEntries(BASES.map((b) => [thirdPerson(b), b]));
const INVERSE_PAST: Record<string, string> = Object.fromEntries(Object.entries(PAST).map(([b, p]) => [p, b]));

const PAST_MARK = /\b(yesterday|last (?:night|week|month|year|summer|winter|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\d+ (?:days?|weeks?|months?|years?|hours?) ago|(?:a|one|two|three|few) (?:days?|weeks?|months?|years?) ago|in (?:19|20)\d\d)\b/i;
const NOT_AFTER = "did|do|does|didn't|don't|doesn't|will|won't|would|can|can't|could|should|must|to|let|let's|help|make|please|and then";

interface Rule {
  id: string;
  apply: (s: string) => string | null; // returns the corrected sentence if the rule fires
  fr: string;
  en: string;
  category: MistakeCategory;
  skill: Correction["skill"];
}

const sub = (s: string, re: RegExp, to: string | ((...a: string[]) => string)) => {
  const out = s.replace(re, to as never);
  return out !== s ? out : null;
};
const keepCase = (orig: string, repl: string) => (orig[0] === orig[0].toUpperCase() ? repl[0].toUpperCase() + repl.slice(1) : repl);

const RULES: Rule[] = [
  {
    id: "present-perfect-with-date",
    apply: (s) => {
      if (!PAST_MARK.test(s)) return null;
      const re = new RegExp(`\\b(?:have|has|'ve)\\s+(${Object.values(PP).join("|")})\\b`, "i");
      return sub(s, re, (_m: string, pp: string) => {
        const base = Object.keys(PP).find((b) => PP[b] === pp.toLowerCase())!;
        return PAST[base] ?? pp;
      });
    },
    fr: "Pas de present perfect avec une date précise (yesterday, last week…) : utilisez le past simple.",
    en: "Don't use the present perfect with a finished time (yesterday, last week…): use the past simple.",
    category: "GRAMMAR", skill: "present-perfect",
  },
  {
    id: "past-marker-irregular",
    apply: (s) => {
      if (!PAST_MARK.test(s) || /\b(?:have|has|had|'ve)\s+\w+(?:ed|en|ne|n)\b/i.test(s)) return null;
      const re = new RegExp(`(?<!\\b(?:${NOT_AFTER})\\s)\\b(I|you|we|they|he|she|it)\\s+(${BASES.join("|")}|${Object.keys(THIRD_TO_BASE).join("|")})\\b`, "i");
      return sub(s, re, (_m: string, subj: string, v: string) => `${subj} ${PAST[THIRD_TO_BASE[v.toLowerCase()] ?? v.toLowerCase()]}`);
    },
    fr: "Avec un repère de temps passé (yesterday, last…, ago), on utilise le past simple : verbe au passé.",
    en: "With a past time marker (yesterday, last…, ago) use the past simple: put the verb in the past.",
    category: "GRAMMAR", skill: "past-simple",
  },
  {
    id: "past-marker-be",
    apply: (s) => {
      if (!PAST_MARK.test(s) || /\b\w+ing\b/.test(s)) return null;
      return sub(s, /\b(I|he|she|it)\s+(am|is)\b/i, (_m: string, a: string) => `${a} was`) ??
        sub(s, /\b(you|we|they)\s+are\b/i, (_m: string, a: string) => `${a} were`);
    },
    fr: "Avec un repère de temps passé, « be » devient was / were.",
    en: "With a past time marker, \"be\" becomes was / were.",
    category: "GRAMMAR", skill: "past-simple",
  },
  {
    id: "did-plus-past",
    apply: (s) => sub(s, new RegExp(`\\b(did(?:n't| not)?)\\s+(?:\\w+\\s+)?(${Object.keys(INVERSE_PAST).join("|")})\\b`, "i"), (m: string, d: string, p: string) => m.replace(new RegExp(`\\b${p}\\b`, "i"), INVERSE_PAST[p.toLowerCase()])),
    fr: "Après did / didn't, le verbe reste à la forme de base (le passé est déjà dans « did »).",
    en: "After did / didn't the verb stays in its base form (did already marks the past).",
    category: "GRAMMAR", skill: "past-simple",
  },
  {
    id: "since-present",
    apply: (s) => sub(s, /\bI\s+(live|work|study|know)\b([^.?!]*?)\bsince\b/i, (_m: string, v: string, mid: string) => `I have ${v.toLowerCase() === "know" ? "known" : regularPast(v.toLowerCase())}${mid}since`),
    fr: "Une situation qui dure depuis un moment (since / for) se dit au present perfect, pas au présent.",
    en: "A situation that started in the past and continues now (since / for) takes the present perfect.",
    category: "GRAMMAR", skill: "present-perfect",
  },
  {
    id: "since-duration",
    apply: (s) => sub(s, /\bsince\s+((?:\d+|a|an|one|two|three|four|five|six|several|many)\s+(?:years?|months?|weeks?|days?|hours?|minutes?))\b/i, "for $1"),
    fr: "Avec une durée (3 ans, 2 heures) on emploie « for » ; « since » s'utilise avec un point de départ (since 2020).",
    en: "Use \"for\" with a duration (3 years); \"since\" goes with a starting point (since 2020).",
    category: "GRAMMAR", skill: "present-perfect",
  },
  {
    id: "third-person-s",
    apply: (s) => {
      const re = new RegExp(`(?<!\\b(?:${NOT_AFTER})\\s)\\b(he|she|it)\\s+(${BASES.join("|")})\\b`, "i");
      if (PAST_MARK.test(s)) return null;
      return sub(s, re, (_m: string, subj: string, v: string) => `${subj} ${thirdPerson(v.toLowerCase())}`);
    },
    fr: "À la 3ᵉ personne du singulier (he / she / it) on ajoute -s au verbe au présent simple.",
    en: "With he / she / it the present-simple verb takes -s.",
    category: "GRAMMAR", skill: "present-simple",
  },
  {
    id: "doesnt-agreement",
    apply: (s) =>
      sub(s, /\b(he|she|it)\s+don't\b/i, "$1 doesn't") ??
      sub(s, /\b(I|you|we|they)\s+doesn't\b/i, "$1 don't") ??
      sub(s, new RegExp(`\\b(doesn't|does not)\\s+(${Object.keys(THIRD_TO_BASE).join("|")})\\b`, "i"), (_m: string, d: string, v: string) => `${d} ${THIRD_TO_BASE[v.toLowerCase()]}`),
    fr: "Avec he / she / it l'auxiliaire est doesn't, et le verbe qui suit reste à la forme de base (sans -s).",
    en: "Use doesn't with he / she / it, and keep the following verb in its base form (no -s).",
    category: "GRAMMAR", skill: "present-simple",
  },
  { id: "am-agree", apply: (s) => sub(s, /\b(I(?: a|')m|I am) agree\b/i, (_m: string) => "I agree"), fr: "« Agree » est un verbe : on dit « I agree », pas « I am agree ».", en: "\"Agree\" is a verb: say \"I agree\", not \"I am agree\".", category: "GRAMMAR", skill: "present-simple" },
  { id: "more-better", apply: (s) => sub(s, /\bmore (better|easier|bigger|cheaper|faster|harder|older|smaller)\b/i, "$1"), fr: "Pas de « more » devant un comparatif déjà formé (better, easier…).", en: "Don't add \"more\" before a comparative that is already formed.", category: "GRAMMAR", skill: "comparatives" },
  { id: "modal-to", apply: (s) => sub(s, /\b(can|could|must|should|will|would|might)\s+to\b/i, "$1"), fr: "Après un modal (can, must, will…), le verbe suit directement, sans « to ».", en: "After a modal verb, the base verb follows directly — no \"to\".", category: "GRAMMAR", skill: "modal-verbs" },
  { id: "people-is", apply: (s) => sub(s, /\b(people|police|children)\s+is\b/i, "$1 are"), fr: "« People » est un pluriel : people are.", en: "\"People\" is plural: people are.", category: "GRAMMAR", skill: "plurals" },
  { id: "uncountable-s", apply: (s) => sub(s, /\b(information|advice|furniture|homework|luggage|news)s\b/i, "$1"), fr: "Ce mot est indénombrable en anglais : pas de -s (information, advice, homework…).", en: "This noun is uncountable in English: no plural -s.", category: "GRAMMAR", skill: "plurals" },
  { id: "irregular-plural", apply: (s) => sub(s, /\b(childs|peoples|mans|womans|foots|tooths)\b/i, (m: string) => ({ childs: "children", peoples: "people", mans: "men", womans: "women", foots: "feet", tooths: "teeth" } as Record<string, string>)[m.toLowerCase()]), fr: "Pluriel irrégulier : child → children, man → men, woman → women, foot → feet.", en: "Irregular plural: child → children, man → men, woman → women, foot → feet.", category: "GRAMMAR", skill: "plurals" },
  { id: "much-people", apply: (s) => sub(s, /\bmuch (people|friends|things|cars|books|students|questions)\b/i, "many $1"), fr: "Avec un nom dénombrable pluriel, on dit « many », pas « much ».", en: "Use \"many\" with plural countable nouns, not \"much\".", category: "GRAMMAR", skill: "plurals" },
  { id: "age", apply: (s) => sub(s, /\bI have (\d+) years?( old)?\b/i, "I am $1 years old"), fr: "En anglais l'âge se dit avec « be » : I am 20 years old.", en: "Age uses \"be\": I am 20 years old.", category: "GRAMMAR", skill: "vocabulary-choice" },
  { id: "article-job", apply: (s) => sub(s, /\b(I am|I'm|he is|she is|he's|she's)\s+(teacher|doctor|student|engineer|nurse|lawyer|manager|waiter|driver|dentist|chef|musician|artist|developer)\b/i, (_m: string, be: string, job: string) => `${be} ${/^[aeiou]/i.test(job) ? "an" : "a"} ${job}`), fr: "Devant un métier, l'anglais exige l'article : I am a teacher.", en: "A job needs an article: I am a teacher.", category: "GRAMMAR", skill: "articles" },
  { id: "depends-of", apply: (s) => sub(s, /\bdepends? of\b/i, (m: string) => m.replace(/of/i, "on")), fr: "On dit « depend on », pas « depend of ».", en: "It's \"depend on\", not \"depend of\".", category: "PREPOSITION", skill: "prepositions" },
  { id: "arrive-to", apply: (s) => sub(s, /\barriv(e|ed|es|ing) to\b/i, (m: string) => m.replace(/ to$/i, " in")), fr: "On dit « arrive in » (ville/pays) ou « arrive at » (lieu précis), pas « arrive to ».", en: "Use \"arrive in\" (city/country) or \"arrive at\" (place), not \"arrive to\".", category: "PREPOSITION", skill: "prepositions" },
  { id: "listen-the", apply: (s) => sub(s, /\blisten(ing|ed|s)? (the|a|my|your|his|her|music|radio)\b/i, (m: string) => m.replace(/(listen\w*) /i, "$1 to ")), fr: "« Listen » se construit avec « to » : listen to music.", en: "\"Listen\" takes \"to\": listen to music.", category: "PREPOSITION", skill: "prepositions" },
  { id: "explain-me", apply: (s) => sub(s, /\b(explain|say|describe|suggest)\s+(me|him|her|us|them)\b/i, (m: string, v: string, o: string) => (v.toLowerCase() === "say" ? `tell ${o}` : `${v} to ${o}`)), fr: "Avec explain / describe, la personne est introduite par « to » ; avec « say me » on dit « tell me ».", en: "Use \"explain to me\"; say \"tell me\" instead of \"say me\".", category: "GRAMMAR", skill: "prepositions" },
  { id: "discuss-about", apply: (s) => sub(s, /\bdiscuss(ed|es|ing)? about\b/i, (m: string) => m.replace(/ about/i, "")), fr: "« Discuss » est transitif direct : discuss the problem (sans « about »).", en: "\"Discuss\" takes a direct object: discuss the problem (no \"about\").", category: "PREPOSITION", skill: "prepositions" },
  { id: "married-with", apply: (s) => sub(s, /\bmarried with\b/i, "married to"), fr: "On dit « married to » quelqu'un.", en: "It's \"married to\" someone.", category: "PREPOSITION", skill: "prepositions" },
  { id: "interested-by", apply: (s) => sub(s, /\binterested (by|of|on)\b/i, "interested in"), fr: "On dit « interested in ».", en: "It's \"interested in\".", category: "PREPOSITION", skill: "prepositions" },
  { id: "good-in", apply: (s) => sub(s, /\b(good|bad|better|best) in (maths?|english|sports?|music|cooking|physics|languages?|football)\b/i, "$1 at $2"), fr: "On dit « good at » une matière ou une activité.", en: "It's \"good at\" a subject or activity.", category: "PREPOSITION", skill: "prepositions" },
  { id: "afraid-from", apply: (s) => sub(s, /\bafraid (from|about)\b/i, "afraid of"), fr: "On dit « afraid of ».", en: "It's \"afraid of\".", category: "PREPOSITION", skill: "prepositions" },
  { id: "wait-you", apply: (s) => sub(s, /\bwait(ing|ed|s)? (me|you|him|her|us|them|the bus|the train)\b/i, (m: string) => m.replace(/(wait\w*) /i, "$1 for ")), fr: "« Wait » se construit avec « for » : wait for you.", en: "\"Wait\" takes \"for\": wait for you.", category: "PREPOSITION", skill: "prepositions" },
  { id: "different-of", apply: (s) => sub(s, /\bdifferent (of|than)\b/i, "different from"), fr: "On dit « different from ».", en: "It's \"different from\".", category: "PREPOSITION", skill: "prepositions" },
  { id: "make-photo", apply: (s) => sub(s, /\bmak(e|es|ing|ed)\s+(a |some |many )?(photos?|pictures?|selfie)\b/i, (m: string) => m.replace(/mak(e|es|ing|ed)/i, (v) => ({ make: "take", makes: "takes", making: "taking", maked: "took" } as Record<string, string>)[v.toLowerCase()] ?? "take")), fr: "En anglais on « prend » une photo : take a photo.", en: "You \"take\" a photo, you don't \"make\" one.", category: "VOCABULARY", skill: "vocabulary-choice" },
  { id: "do-mistake", apply: (s) => sub(s, /\b(do|does|did|doing|done)\s+(a |many |some |no )?mistakes?\b/i, (m: string) => m.replace(/^(do|does|did|doing|done)/i, (v) => ({ do: "make", does: "makes", did: "made", doing: "making", done: "made" } as Record<string, string>)[v.toLowerCase()])), fr: "On « fait » une erreur : make a mistake.", en: "It's \"make a mistake\", not \"do a mistake\".", category: "VOCABULARY", skill: "vocabulary-choice" },
  { id: "said-me", apply: (s) => sub(s, /\b(said|says)\s+(me|him|her|us|them)\b/i, (_m: string, v: string, o: string) => `${v.toLowerCase() === "said" ? "told" : "tells"} ${o}`), fr: "« Say » ne prend pas de complément de personne : utilisez « tell » (told me).", en: "\"Say\" can't take a person directly: use \"tell\" (told me).", category: "VOCABULARY", skill: "vocabulary-choice" },
  { id: "dont-nothing", apply: (s) => sub(s, /\b(don't|doesn't|didn't|haven't|can't)\s+(\w+\s+)?nothing\b/i, (m: string) => m.replace(/nothing/i, "anything")), fr: "Une seule négation en anglais : « I don't have anything » (pas « nothing »).", en: "English allows one negative only: \"I don't have anything\".", category: "GRAMMAR", skill: "word-order" },
  { id: "where-i-can", apply: (s) => sub(s, /\b(Where|What|How|When|Why) (I|we|you|they) (can|could|should|must) /i, (_m: string, w: string, subj: string, m: string) => `${w} ${m} ${subj} `), fr: "Dans une question, le modal passe avant le sujet : Where can I…?", en: "In questions the modal comes before the subject: Where can I…?", category: "WORD_ORDER", skill: "word-order" },
  { id: "very-like", apply: (s) => sub(s, /\bI very (like|love|enjoy)\b/i, "I really $1"), fr: "« Very » ne se place pas devant un verbe : I really like… ou I like … very much.", en: "\"Very\" doesn't go before a verb: say \"I really like\".", category: "WORD_ORDER", skill: "word-order" },
  { id: "i-am-boring", apply: (s) => sub(s, /\bI(?: a|')m (boring|tiring|interesting|exciting)\b(?! (person|man|woman))/i, (_m: string, a: string) => `I am ${({ boring: "bored", tiring: "tired", interesting: "interested", exciting: "excited" } as Record<string, string>)[a.toLowerCase()]}`), fr: "-ed décrit ce qu'on ressent (bored), -ing ce qui provoque le sentiment (boring).", en: "-ed describes how you feel (bored); -ing describes what causes it (boring).", category: "VOCABULARY", skill: "vocabulary-choice" },
];

export interface MockCorrection extends Correction {
  ruleIds: string[];
}

const splitSentences = (t: string) => t.match(/[^.!?\n]+[.!?]*/g)?.map((x) => x.trim()).filter(Boolean) ?? [];

/** Applies every matching rule (up to 4 passes) and returns one correction per faulty sentence. */
export function mockCorrect(text: string, english = false): MockCorrection[] {
  const out: MockCorrection[] = [];
  for (const sentence of splitSentences(text)) {
    let cur = sentence;
    const fired: Rule[] = [];
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (const r of RULES) {
        if (fired.includes(r)) continue;
        const next = r.apply(cur);
        if (next && next !== cur) {
          cur = next;
          fired.push(r);
          changed = true;
        }
      }
      if (!changed) break;
    }
    if (fired.length && cur !== sentence) {
      out.push({
        original: sentence,
        corrected: cur,
        explanation: fired.slice(0, 2).map((r) => (english ? r.en : r.fr)).join(" "),
        category: fired[0].category,
        skill: fired[0].skill,
        ruleIds: fired.map((r) => r.id),
      });
    }
  }
  return out.slice(0, 3);
}

// ── conversation ───────────────────────────────────────────────────────────
const REACTIONS = {
  short: ["Nice!", "I see.", "Okay!", "Great!", "Oh, really?"],
  long: ["That sounds really interesting!", "Thanks for sharing that.", "Wow, that's a great answer!", "I understand, that makes sense."],
};
const GENERIC_Q = ["Can you tell me more about that?", "Why do you think so?", "And what about you? What do you usually do?", "How do you feel about it?"];
const ADVANCED_Q = ["What would you do differently if you could start again?", "Do you think most people would agree with you? Why?"];
const SIMPLE_Q = ["Do you like it?", "Can you tell me more?", "What is your favourite thing?"];

export function mockReply(opts: { scenarioId: string; turn: number; level: string; userText: string; name: string }): string {
  const sc = scenarioById(opts.scenarioId) ?? SCENARIOS[0];
  if (opts.turn === 0) return sc.opener.replace(/^Hi!?/, `Hi ${opts.name}!`).slice(0, 300);
  const words = opts.userText.trim().split(/\s+/).length;
  const pick = <T,>(a: T[], i: number) => a[i % a.length];
  const reaction = pick(words < 5 ? REACTIONS.short : REACTIONS.long, opts.turn);
  const pool = ["A1", "A2"].includes(opts.level)
    ? [...sc.questions.slice(0, 3), ...SIMPLE_Q]
    : ["C1", "C2", "B2"].includes(opts.level)
      ? [...sc.questions, ...ADVANCED_Q, ...GENERIC_Q]
      : [...sc.questions, ...GENERIC_Q];
  const q = words < 3 ? "Can you say a little more? Try a full sentence." : pick(pool, opts.turn - 1);
  return `${reaction} ${q}`;
}

// ── level heuristics (mock estimateLevel / analyzeConversation) ────────────
export function heuristicLevel(texts: string[], corrections = 0): { value: number; level: string; plus: boolean } {
  const all = texts.join(" ");
  const words = (all.toLowerCase().match(/[a-z']+/g) ?? []).filter((w) => w.length > 0);
  if (!words.length) return { value: 0.5, level: "A1", plus: false };
  const avgLen = words.length / Math.max(1, texts.length);
  const rare = words.filter((w) => !COMMON.has(w)).length / words.length;
  const variety = new Set(words).size / words.length;
  let v = avgLen < 4 ? 0.6 : avgLen < 7 ? 1.5 : avgLen < 11 ? 2.5 : avgLen < 16 ? 3.4 : 4.3;
  v += rare > 0.4 ? 0.3 : rare < 0.15 ? -0.3 : 0;
  v += variety > 0.8 && words.length > 40 ? 0.2 : 0;
  if (texts.length) v -= Math.min(0.8, (corrections / texts.length) * 0.8);
  v = Math.min(5, Math.max(0.2, v));
  const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
  return { value: v, level: levels[Math.floor(v)], plus: v - Math.floor(v) >= 0.5 };
}
