"use client";
import clsx from "clsx";
import { Badge } from "./ui";
import { SpeakButton } from "./speak";
import type { CardDto } from "@/lib/serialize";

export const LEVEL_TONE: Record<string, "good" | "brand" | "warn" | "bad"> = { A1: "good", A2: "good", B1: "brand", B2: "brand", C1: "warn", C2: "bad" };

export function MetaBadges({ v }: { v: CardDto["vocabulary"] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <Badge tone="neutral">{v.category}</Badge>
      <Badge tone={LEVEL_TONE[v.level] ?? "brand"}>{v.level}</Badge>
      {v.rank && <Badge tone="brand">Rank #{v.rank}</Badge>}
    </div>
  );
}

/** Front/back faces of a study card. `reverse` shows the French first (recall English). */
export function CardFaces({ card, flipped, reverse, onFlip }: { card: CardDto; flipped: boolean; reverse?: boolean; onFlip: () => void }) {
  const v = card.vocabulary;
  const mistake = card.origin === "MISTAKE";
  const wrongSentence = v.example?.replace(/^❌\s*/, "") ?? "";

  const front = mistake ? (
    <div className="space-y-3 text-center">
      <Badge tone="warn">✏️ Corrigez la phrase</Badge>
      <p className="text-2xl font-semibold leading-snug sm:text-3xl">{wrongSentence}</p>
    </div>
  ) : reverse ? (
    <div className="space-y-3 text-center">
      <p className="text-3xl font-semibold sm:text-4xl">{v.translation}</p>
      <p className="text-sm text-muted">Comment dit-on cela en anglais ?</p>
      <MetaBadges v={v} />
    </div>
  ) : (
    <div className="space-y-3 text-center">
      <p className="break-words text-4xl font-semibold tracking-tight sm:text-5xl" lang="en">{v.word}</p>
      {v.ipa && <p className="text-lg text-muted" lang="en">/{v.ipa}/</p>}
      <MetaBadges v={v} />
      <div onClick={(e) => e.stopPropagation()} className="flex justify-center gap-2 pt-1"><SpeakButton text={v.word} label="Listen" /></div>
    </div>
  );

  const back = (
    <div className="w-full space-y-4 text-center">
      {mistake ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Correct</p>
          <p className="text-2xl font-semibold leading-snug text-accent sm:text-3xl" lang="en">✅ {v.word}</p>
          <p className="rounded-xl bg-surface-2 p-3 text-sm">{v.translation}</p>
        </>
      ) : (
        <>
          {reverse && <p className="text-4xl font-semibold" lang="en">{v.word}</p>}
          {!reverse && <p className="text-3xl font-semibold sm:text-4xl">{v.translation}</p>}
          {reverse && v.ipa && <p className="text-muted">/{v.ipa}/</p>}
          <MetaBadges v={v} />
          {v.pastSimple && <p className="text-sm"><span className="text-muted">Past:</span> <b>{v.pastSimple}</b> · <span className="text-muted">Participle:</span> <b>{v.pastParticiple}</b></p>}
          {v.example && (
            <div className="rounded-xl bg-surface-2 p-3 text-left">
              <p className="text-base" lang="en">{v.example}</p>
              {v.exampleTranslation && <p className="mt-1 text-sm text-muted">{v.exampleTranslation}</p>}
            </div>
          )}
          {card.note && <p className="text-sm italic text-muted">📝 {card.note}</p>}
        </>
      )}
      <div onClick={(e) => e.stopPropagation()} className="flex flex-wrap justify-center gap-2">
        <SpeakButton text={v.word} label="Word" />
        {!mistake && v.example && <SpeakButton text={v.example} label="Sentence" />}
      </div>
    </div>
  );

  return (
    <div className="flip">
      <div className={clsx("flip-inner", flipped && "is-flipped")}>
        <div role="button" tabIndex={0} aria-label="Afficher la réponse" onClick={onFlip} onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), onFlip())}
          className="flip-face flex min-h-[22rem] cursor-pointer flex-col items-center justify-center rounded-3xl border border-border bg-surface p-6 shadow-card sm:min-h-[26rem]" aria-hidden={flipped}>
          {front}
          <p className="mt-6 text-xs text-muted">Touchez la carte ou appuyez sur Espace</p>
        </div>
        <div className="flip-face flip-back flex min-h-[22rem] items-center justify-center rounded-3xl border border-brand/30 bg-surface p-6 shadow-card sm:min-h-[26rem]" aria-hidden={!flipped}>
          {back}
        </div>
      </div>
    </div>
  );
}
