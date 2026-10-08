"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import clsx from "clsx";
import { Button, Card, Input, Progress, Textarea } from "@/components/ui";
import { SpeakButton } from "@/components/speak";
import { useToast } from "@/components/providers";
import { api, invalidate } from "@/lib/client";

export type PublicExercise =
  | { id: string; type: "choose"; prompt: string; options: string[] }
  | { id: string; type: "complete" | "translate" | "correct" | "create"; prompt: string }
  | { id: string; type: "listen"; sentence: string };

const TITLE: Record<PublicExercise["type"], string> = {
  choose: "Choose the correct answer", complete: "Complete the sentence", translate: "Translate", correct: "Correct the mistake", create: "Create a sentence", listen: "Listen and type",
};

interface Feedback { correct: boolean; expected: string | null; explain: string; corrected?: string; mock?: boolean }

export function ExerciseRunner({ lessonSlug, exercises }: { lessonSlug: string; exercises: PublicExercise[] }) {
  const toast = useToast();
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState("");
  const [fb, setFb] = useState<Feedback | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const allRight = useRef(true);
  const ex = exercises[i];
  const input = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => { input.current?.focus(); }, [i]);

  async function check(value = answer) {
    if (busy || fb) return;
    setBusy(true);
    const last = i === exercises.length - 1;
    try {
      const r = await api<Feedback & { progress: { unlocked: { name: string; icon: string }[] } }>("/api/grammar/check", { method: "POST", json: { lessonSlug, exerciseId: ex.id, answer: value, perfect: last && allRight.current && true } });
      if (!r.correct) allRight.current = false;
      else setScore((s) => s + 1);
      setFb(r);
      r.progress.unlocked.forEach((u) => toast(`${u.icon} Badge débloqué : ${u.name}`, "reward"));
    } catch (e) { toast(e instanceof Error ? e.message : "Erreur", "error"); }
    setBusy(false);
  }
  function next() {
    setFb(null); setAnswer("");
    if (i + 1 >= exercises.length) { setDone(true); invalidate("/api/"); } else setI(i + 1);
  }
  function restart() { setI(0); setScore(0); setDone(false); setFb(null); setAnswer(""); allRight.current = true; }

  if (done)
    return (
      <Card className="space-y-4 text-center anim-up">
        <div className="text-5xl">{score === exercises.length ? "🏆" : score >= exercises.length * 0.6 ? "👏" : "💪"}</div>
        <h3 className="text-2xl font-semibold">{score} / {exercises.length}</h3>
        <p className="text-muted">{score === exercises.length ? "Parfait !" : "Vos erreurs sont enregistrées : retrouvez-les dans « My Mistakes » et en flashcards."}</p>
        <div className="flex flex-wrap justify-center gap-2"><Button onClick={restart}><RotateCcw className="size-4" /> Recommencer</Button><Link href="/grammar" className="inline-flex h-11 items-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-surface-2">Autres leçons</Link></div>
      </Card>
    );

  return (
    <Card className="space-y-4" key={ex.id}>
      <div className="space-y-2"><div className="flex justify-between text-sm text-muted"><span>{TITLE[ex.type]}</span><span className="tabular-nums">{i + 1} / {exercises.length}</span></div><Progress value={i / exercises.length} label="Progression des exercices" /></div>

      {ex.type === "listen" ? (
        <div className="flex items-center gap-3"><SpeakButton text={ex.sentence} label="Play" /><SpeakButton text={ex.sentence} label="Slow" rate={0.7} /><span className="text-sm text-muted">Écoutez, puis écrivez la phrase.</span></div>
      ) : <p className="text-lg font-medium" lang={ex.type === "translate" ? "fr" : "en"}>{ex.prompt}</p>}

      {ex.type === "choose" ? (
        <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Réponses">
          {ex.options.map((o) => (
            <button key={o} disabled={!!fb || busy} onClick={() => { setAnswer(o); void check(o); }}
              className={clsx("min-h-12 rounded-xl border px-4 text-left transition", fb ? (fb.expected === o ? "border-accent bg-accent-soft" : answer === o ? "border-danger bg-danger-soft" : "border-border opacity-60") : "border-border hover:border-brand hover:bg-brand-soft")}>{o}</button>
          ))}
        </div>
      ) : ex.type === "create" ? (
        <Textarea ref={input as React.Ref<HTMLTextAreaElement>} value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={!!fb} rows={3} lang="en" placeholder="Write your sentence…" aria-label="Votre phrase" />
      ) : (
        <Input ref={input as React.Ref<HTMLInputElement>} value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={!!fb} onKeyDown={(e) => e.key === "Enter" && answer.trim() && void check()} lang="en" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder={ex.type === "complete" ? "Type the missing words" : "Your answer"} aria-label="Votre réponse" />
      )}

      {fb && (
        <div role="status" className={clsx("anim-pop rounded-xl p-3 text-sm", fb.correct ? "bg-accent-soft text-accent" : "bg-danger-soft text-danger")}>
          <p className="flex items-center gap-2 font-semibold">{fb.correct ? <><CheckCircle2 className="size-5" /> Correct !</> : <><XCircle className="size-5" /> Pas tout à fait</>}</p>
          {!fb.correct && fb.expected && ex.type !== "create" && <p className="mt-1 text-text">Réponse attendue : <b lang="en">{fb.expected}</b></p>}
          {!fb.correct && ex.type === "create" && fb.corrected && <p className="mt-1 text-text">Suggestion : <b lang="en">{fb.corrected}</b></p>}
          {fb.explain && <p className="mt-1 text-text">{fb.explain}</p>}
          {!fb.correct && ex.type === "create" && fb.expected && !fb.corrected && <p className="mt-1 text-text">Exemple : <i lang="en">{fb.expected}</i></p>}
          {fb.mock && <p className="mt-1 text-xs text-muted">Vérification en mode démo (règles simples, pas d&apos;IA).</p>}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {!fb && ex.type !== "choose" && <Button onClick={() => void check()} loading={busy} disabled={!answer.trim()}>Vérifier</Button>}
        {fb && <Button onClick={next} autoFocus>{i + 1 >= exercises.length ? "Terminer" : "Suivant"}</Button>}
      </div>
    </Card>
  );
}
