"use client";
import { Volume2, Square } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";
import { speak, stopSpeaking, ttsSupported } from "@/lib/speech";
import { useToast, useUser } from "./providers";

/** 🔊 Listen button. Uses the learner's accent / voice / speed preferences unless overridden. */
export function SpeakButton({ text, label = "Listen", compact, rate, className, accent }: { text: string; label?: string; compact?: boolean; rate?: number; className?: string; accent?: "US" | "UK" }) {
  const { user } = useUser();
  const toast = useToast();
  const [playing, setPlaying] = useState(false);

  async function play() {
    if (!ttsSupported()) return toast("La synthèse vocale n'est pas disponible sur ce navigateur.", "error");
    if (playing) { stopSpeaking(); setPlaying(false); return; }
    const ok = await speak(text, { accent: accent ?? user.accent, gender: user.voiceGender, rate: rate ?? user.speechRate, onStart: () => setPlaying(true), onEnd: () => setPlaying(false) });
    if (!ok) toast("Impossible de lire ce texte.", "error");
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); void play(); }}
      aria-label={`${label}: ${text}`}
      className={clsx("inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 text-sm font-medium transition hover:bg-border active:scale-95", compact ? "size-11" : "h-11 px-4", playing && "!border-brand text-brand", className)}
    >
      {playing ? <Square className="size-4" /> : <Volume2 className="size-4" />}
      {!compact && <span>{label}</span>}
    </button>
  );
}
