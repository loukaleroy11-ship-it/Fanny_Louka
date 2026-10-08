/** Normalised key used for duplicate detection: lower-case, trimmed, single-spaced, no punctuation noise. */
export function normalizeWord(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\s\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CONTRACTIONS: [RegExp, string][] = [
  [/\bcan't\b/g, "cannot"],
  [/\bwon't\b/g, "will not"],
  [/\bshan't\b/g, "shall not"],
  [/\b(\w+)n't\b/g, "$1 not"],
  [/\bi'm\b/g, "i am"],
  [/\b(you|we|they)'re\b/g, "$1 are"],
  [/\b(i|you|we|they)'ve\b/g, "$1 have"],
  [/\b(i|you|he|she|it|we|they)'ll\b/g, "$1 will"],
  [/\b(i|you|he|she|it|we|they)'d\b/g, "$1 would"],
  [/\b(it|he|she|that|there|what|who|here|where)'s\b/g, "$1 is"],
  [/\blet's\b/g, "let us"],
];

/** Normalisation for exercise answers: case, punctuation, and common contractions are ignored. */
export function normalizeAnswer(input: string): string {
  let s = input.normalize("NFKC").toLowerCase().replace(/[’‘]/g, "'");
  for (const [re, rep] of CONTRACTIONS) s = s.replace(re, rep);
  return s
    .replace(/[^a-z0-9\sàâçéèêëîïôûùüÿœ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const answerMatches = (given: string, accepted: string[]) => {
  const g = normalizeAnswer(given);
  return accepted.some((a) => normalizeAnswer(a) === g);
};

/**
 * Candidate base forms of an English word ("running" → run, "houses" → house, "studies" → study).
 * Used only to *suggest* related entries — never to treat two words as identical.
 */
export function lemmaCandidates(word: string): string[] {
  const w = normalizeWord(word);
  if (!w || w.includes(" ")) return [];
  const out = new Set<string>();
  const add = (x: string) => x.length >= 2 && x !== w && out.add(x);
  if (w.endsWith("ies")) add(w.slice(0, -3) + "y");
  if (w.endsWith("es")) add(w.slice(0, -2));
  if (w.endsWith("s") && !w.endsWith("ss")) add(w.slice(0, -1));
  if (w.endsWith("ing")) {
    const stem = w.slice(0, -3);
    add(stem);
    add(stem + "e");
    if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) add(stem.slice(0, -1));
  }
  if (w.endsWith("ied")) add(w.slice(0, -3) + "y");
  if (w.endsWith("ed")) {
    const stem = w.slice(0, -2);
    add(stem);
    add(w.slice(0, -1));
    if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) add(stem.slice(0, -1));
  }
  if (w.endsWith("er") || w.endsWith("est")) add(w.replace(/(er|est)$/, ""));
  if (w.endsWith("ly")) add(w.slice(0, -2));
  return [...out];
}

export function countWords(text: string): number {
  return (text.match(/[A-Za-zÀ-ÿ']+/g) ?? []).length;
}
