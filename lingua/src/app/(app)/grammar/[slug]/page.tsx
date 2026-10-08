import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, AlertCircle, Lightbulb } from "lucide-react";
import { lessonBySlug } from "@/content/grammar";
import { Badge, Card } from "@/components/ui";
import { SpeakButton } from "@/components/speak";
import { ExerciseRunner, type PublicExercise } from "./exercises";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const l = lessonBySlug((await params).slug);
  return { title: l?.title ?? "Grammar" };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const lesson = lessonBySlug((await params).slug);
  if (!lesson) notFound();
  // Answers are checked server-side: never ship them to the browser.
  const exercises: PublicExercise[] = lesson.exercises.map((e) => {
    switch (e.type) {
      case "choose": return { id: e.id, type: e.type, prompt: e.prompt, options: e.options };
      case "listen": return { id: e.id, type: e.type, sentence: e.sentence };
      default: return { id: e.id, type: e.type, prompt: e.prompt };
    }
  });
  const h = "mb-3 text-lg font-semibold";
  return (
    <article className="space-y-6">
      <Link href="/grammar" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" /> English Grammar</Link>
      <header>
        <div className="flex flex-wrap items-center gap-2"><Badge tone="brand">{lesson.level}</Badge><span className="text-sm text-muted">{lesson.titleFr}</span></div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{lesson.title}</h1>
        <p className="mt-2 max-w-3xl text-muted">{lesson.summary}</p>
      </header>

      <Card><h2 className={h}>Quand l&apos;utiliser ?</h2>
        <ul className="space-y-3">{lesson.whenToUse.map((w) => (
          <li key={w.text} className="rounded-xl bg-surface-2 p-3"><p className="text-sm font-medium">{w.text}</p><div className="mt-1 flex items-center justify-between gap-2"><div><p lang="en">{w.example}</p><p className="text-sm text-muted">{w.translation}</p></div><SpeakButton text={w.example} compact label="Listen" /></div></li>
        ))}</ul></Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><h2 className={h}>Structure</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="font-semibold text-accent">＋ Affirmative</dt><dd className="mt-0.5 font-mono text-[13px]">{lesson.structure.affirmative}</dd></div>
            <div><dt className="font-semibold text-danger">－ Négation</dt><dd className="mt-0.5 font-mono text-[13px]">{lesson.structure.negative}</dd></div>
            <div><dt className="font-semibold text-brand">？ Question</dt><dd className="mt-0.5 font-mono text-[13px]">{lesson.structure.question}</dd></div>
            {lesson.structure.shortAnswers && <div><dt className="font-semibold">Réponses courtes</dt><dd className="mt-0.5">{lesson.structure.shortAnswers}</dd></div>}
            <div><dt className="font-semibold">Auxiliaire</dt><dd className="mt-0.5">{lesson.auxiliary}</dd></div>
          </dl></Card>
        <Card><h2 className={h}>Les formes</h2>
          <dl className="space-y-2 text-sm">{lesson.forms.map((f) => <div key={f.label} className="flex justify-between gap-3 border-b border-border pb-2 last:border-0"><dt className="text-muted">{f.label}</dt><dd className="text-right font-medium" lang="en">{f.en}</dd></div>)}</dl>
          <p className="mt-4 text-xs text-muted">Mots-signaux : {lesson.signalWords.map((s) => <Badge key={s} className="mr-1">{s}</Badge>)}</p></Card>
      </div>

      <Card><h2 className={h}>Exemples</h2>
        <ul className="space-y-2">{lesson.examples.map((e) => (
          <li key={e.en} className="flex items-center justify-between gap-3"><div><p lang="en" className="font-medium">{e.en}</p><p className="text-sm text-muted">{e.fr}</p></div><SpeakButton text={e.en} compact label="Listen" /></li>
        ))}</ul></Card>

      <Card><h2 className={`${h} flex items-center gap-2`}><AlertCircle className="size-5 text-danger" /> Erreurs fréquentes</h2>
        <ul className="space-y-3">{lesson.commonErrors.map((e) => (
          <li key={e.wrong} className="rounded-xl border border-border p-3 text-sm"><p className="text-danger line-through" lang="en">{e.wrong}</p><p className="font-medium text-accent" lang="en">✓ {e.right}</p><p className="mt-1 text-muted">{e.why}</p></li>
        ))}</ul></Card>

      <Card className="!bg-brand-soft"><h2 className={`${h} flex items-center gap-2`}><Lightbulb className="size-5 text-brand" /> À retenir</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm">{lesson.tips.map((t) => <li key={t}>{t}</li>)}</ul></Card>

      <section aria-labelledby="ex-title" className="space-y-3">
        <h2 id="ex-title" className="text-2xl font-semibold">Exercices</h2>
        <ExerciseRunner lessonSlug={lesson.slug} exercises={exercises} />
      </section>
    </article>
  );
}
