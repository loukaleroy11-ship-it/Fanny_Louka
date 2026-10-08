"use client";
/**
 * Browser speech helpers (Web Speech API).
 * - TTS: speechSynthesis, voices are matched on language (en-US / en-GB) and a name heuristic for gender.
 *   Voice availability depends on the OS/browser; the UI tells the learner when none is found.
 * - STT: SpeechRecognition. Chrome/Edge/Safari only; in Chrome the audio is processed by Google's servers.
 */
export type Accent = "US" | "UK";

const FEMALE = /female|samantha|karen|serena|moira|tessa|zira|aria|jenny|libby|sonia|susan|hazel|victoria|allison|ava|kate|fiona|catherine|google uk english female|google us english/i;
const MALE = /\bmale\b|daniel|alex|david|mark|guy|george|ryan|thomas|fred|oliver|arthur|rishi|google uk english male/i;

let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve([]);
  if (voicesPromise) return voicesPromise;
  voicesPromise = new Promise((resolve) => {
    const get = () => window.speechSynthesis.getVoices();
    const v = get();
    if (v.length) return resolve(v);
    const done = () => { window.speechSynthesis.removeEventListener("voiceschanged", done); resolve(get()); };
    window.speechSynthesis.addEventListener("voiceschanged", done);
    setTimeout(() => resolve(get()), 1500);
  });
  return voicesPromise;
}

export function pickVoice(voices: SpeechSynthesisVoice[], accent: Accent, gender: "female" | "male") {
  const lang = accent === "UK" ? "en-GB" : "en-US";
  const exact = voices.filter((v) => v.lang.replace("_", "-").toLowerCase() === lang.toLowerCase());
  const pool = exact.length ? exact : voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const rx = gender === "female" ? FEMALE : MALE;
  return pool.find((v) => rx.test(v.name)) ?? pool.find((v) => v.localService) ?? pool[0] ?? null;
}

export const ttsSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

export interface SpeakOpts {
  accent: Accent;
  rate?: number;
  gender?: "female" | "male";
  onEnd?: () => void;
  onStart?: () => void;
}

export async function speak(text: string, o: SpeakOpts): Promise<boolean> {
  if (!ttsSupported() || !text.trim()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const voices = await loadVoices();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = o.accent === "UK" ? "en-GB" : "en-US";
  const v = pickVoice(voices, o.accent, o.gender ?? "female");
  if (v) u.voice = v;
  u.rate = o.rate ?? 1;
  u.onend = () => o.onEnd?.();
  u.onerror = () => o.onEnd?.();
  u.onstart = () => o.onStart?.();
  synth.speak(u);
  return true;
}

export const stopSpeaking = () => ttsSupported() && window.speechSynthesis.cancel();

/* ── Speech recognition ─────────────────────────────────────────────── */
interface SRResult { isFinal: boolean; 0: { transcript: string; confidence: number } }
interface SREvent { resultIndex: number; results: ArrayLike<SRResult> }
interface SRInstance {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: SREvent) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
}
type SRCtor = new () => SRInstance;

export function getRecognitionCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type { SRInstance, SREvent };
