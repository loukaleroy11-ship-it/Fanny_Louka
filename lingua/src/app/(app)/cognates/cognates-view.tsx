"use client";
import { useState } from "react";
import { Badge, Card, Chip, ErrorState, Input, PageHeader, Skeleton } from "@/components/ui";
import { SpeakButton } from "@/components/speak";
import { useApi, useDebounced } from "@/lib/client";

interface Item { id: string; english: string; french: string; kind: "COGNATE" | "FALSE_FRIEND"; meaning: string; example: string | null; level: string }

export function CognatesView() {
  const [kind, setKind] = useState<"COGNATE" | "FALSE_FRIEND">("COGNATE");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useApi<{ items: Item[] }>(`/api/cognates?kind=${kind}${dq ? `&q=${encodeURIComponent(dq)}` : ""}`);
  return (
    <div>
      <PageHeader title={kind === "COGNATE" ? "Words You Already Know" : "False Friends"} subtitle={kind === "COGNATE" ? "Ces mots anglais ressemblent au français : vous en connaissez déjà plusieurs centaines !" : "Attention : ces mots ressemblent au français mais ne veulent pas dire la même chose."} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip active={kind === "COGNATE"} onClick={() => setKind("COGNATE")}>✅ Words You Already Know</Chip>
        <Chip active={kind === "FALSE_FRIEND"} onClick={() => setKind("FALSE_FRIEND")}>⚠️ False Friends</Chip>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer…" aria-label="Filtrer" className="max-w-52" />
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div> : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.items.map((c) => (
            <li key={c.id}>
              <Card className="h-full space-y-1.5 !p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-lg font-semibold"><span lang="en">{c.english}</span> <span className={c.kind === "FALSE_FRIEND" ? "text-danger" : "text-accent"}>{c.kind === "FALSE_FRIEND" ? "≠" : "→"}</span> {c.french}</div>
                  <SpeakButton text={c.english} compact label="Listen" />
                </div>
                {c.kind === "FALSE_FRIEND" ? <p className="text-sm"><Badge tone="bad">Faux ami</Badge> <span className="ml-1">{c.meaning}</span></p> : <Badge tone="good">{c.level}</Badge>}
                {c.example && <p className="text-sm italic text-muted" lang="en">{c.example}</p>}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
