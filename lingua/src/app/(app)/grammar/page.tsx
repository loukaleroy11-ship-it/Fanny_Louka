import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { GRAMMAR_LESSONS } from "@/content/grammar";
import { Badge, Card, PageHeader, Progress } from "@/components/ui";

export const metadata: Metadata = { title: "English Grammar" };

export default async function Page() {
  const user = await requireUser();
  const [results, skills] = await Promise.all([
    db.exerciseResult.findMany({ where: { userId: user.id, correct: true }, select: { lessonSlug: true, exerciseId: true }, distinct: ["lessonSlug", "exerciseId"] }),
    db.userSkill.findMany({ where: { userId: user.id }, include: { skill: true } }),
  ]);
  const weak = new Map(skills.map((s) => [s.skill.slug, s]));
  return (
    <div>
      <PageHeader title="English Grammar" subtitle="Les 5 temps qui couvrent l'essentiel de l'anglais quotidien : present simple, present continuous, past simple, present perfect et les formes du futur." />
      <ol className="grid gap-4 md:grid-cols-2">
        {GRAMMAR_LESSONS.map((l, i) => {
          const done = results.filter((r) => r.lessonSlug === l.slug).length;
          const w = weak.get(l.skillSlug);
          return (
            <li key={l.slug}>
              <Link href={`/grammar/${l.slug}`} className="block h-full">
                <Card className="flex h-full flex-col gap-3 transition hover:border-brand">
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="text-xs font-medium text-muted">Leçon {i + 1}</p><h2 className="text-xl font-semibold">{l.title}</h2><p className="text-sm text-muted">{l.titleFr}</p></div>
                    <Badge tone="brand">{l.level}</Badge>
                  </div>
                  <p className="line-clamp-3 text-sm text-muted">{l.summary}</p>
                  <div className="mt-auto space-y-2">
                    <Progress value={done / l.exercises.length} label={`Exercices réussis : ${l.title}`} tone="good" />
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span className="inline-flex items-center gap-1">{done === l.exercises.length && <CheckCircle2 className="size-3.5 text-accent" />}{done}/{l.exercises.length} exercices réussis</span>
                      {w && w.mistakes > 0 ? <Badge tone="warn">{w.mistakes} erreurs</Badge> : <ArrowRight className="size-4" />}
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          );
        })}
      </ol>
      <Card className="mt-6 text-sm text-muted"><b className="text-text">Pourquoi ces 5 temps ?</b> Ils couvrent la quasi-totalité des phrases du quotidien. Le present perfect et les formes du futur sont inclus car ce sont les plus confondus avec le français (passé composé, futur simple).</Card>
    </div>
  );
}
