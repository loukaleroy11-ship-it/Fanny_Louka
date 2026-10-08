import { normalizeAnswer } from "./normalize";

export interface WordMark { word: string; ok: boolean }

/**
 * Word-level comparison of what the learner typed (dictation) or said (speech recognition) with the target
 * sentence, via longest-common-subsequence. Returns a 0..1 score and the target words marked ok / missed.
 */
export function compareSentences(target: string, heard: string): { score: number; marks: WordMark[]; missed: string[]; extra: string[] } {
  const words = (s: string) => normalizeAnswer(s).split(" ").filter(Boolean);
  const t = words(target);
  const h = words(heard);
  const display = target.split(/\s+/).filter(Boolean);
  const n = t.length, m = h.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = t[i] === h[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ok = new Array<boolean>(n).fill(false);
  const used = new Array<boolean>(m).fill(false);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (t[i] === h[j]) { ok[i] = true; used[j] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  // `display` keeps the original casing/punctuation; normalisation can split "I'm" into two tokens, so map by index when counts match
  const aligned = display.length === t.length;
  const marks: WordMark[] = t.map((w, i) => ({ word: aligned ? display[i] : w, ok: ok[i] }));
  return {
    score: n ? ok.filter(Boolean).length / n : 0,
    marks,
    missed: marks.filter((x) => !x.ok).map((x) => x.word.replace(/[.,!?;:]/g, "")),
    extra: h.filter((_, j) => !used[j]),
  };
}

export const PASS_LISTEN = 0.85;
export const PASS_REPEAT = 0.75; // speech recognition itself makes mistakes: be more lenient
