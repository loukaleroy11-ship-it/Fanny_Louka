"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Dices, MessageCircle } from "lucide-react";
import { Badge, Button, Card, ErrorState, PageHeader, Skeleton, Toggle } from "@/components/ui";
import { useToast, useUser } from "@/components/providers";
import { api, useApi } from "@/lib/client";

interface Resp {
  ai: { mock: boolean };
  scenarios: { id: string; label: string; emoji: string; setup: string }[];
  conversations: { id: string; scenario: string; level: string; startedAt: string; endedAt: string | null; durationSec: number; wordsSpoken: number }[];
}
const B1_PLUS = ["B1", "B2", "C1", "C2"];

export function ConversationHome() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { user, update } = useUser();
  const { data, error, loading, reload } = useApi<Resp>("/api/conversation", { ttl: 5000 });
  const [starting, setStarting] = useState("");
  const auto = useRef(false);
  const canEnglishOnly = B1_PLUS.includes(user.level);

  async function start(scenario: string) {
    setStarting(scenario);
    try {
      const r = await api<{ conversation: { id: string } }>("/api/conversation", { method: "POST", json: { scenario } });
      router.push(`/conversation/${r.conversation.id}`);
    } catch (e) { toast(e instanceof Error ? e.message : "Erreur", "error"); setStarting(""); }
  }
  useEffect(() => {
    const s = params.get("scenario");
    if (s && !auto.current) { auto.current = true; void start(s); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <PageHeader title="AI Conversation" subtitle="Parlez anglais avec votre professeur. Il vous fait parler, corrige discrètement et s'adapte à votre niveau." />
      {data?.ai.mock && (
        <Card className="!border-warn/40 !bg-warn-soft text-sm">
          <b className="text-warn">Mode démo — aucune clé IA configurée.</b> <span className="text-text">Le professeur pose des questions préparées et détecte une trentaine d&apos;erreurs classiques par règles simples. Ajoutez <code>ANTHROPIC_API_KEY</code> côté serveur pour la vraie conversation (voir le README).</span>
        </Card>
      )}
      <Card className="!p-4">
        <Toggle checked={user.englishOnly && canEnglishOnly} onChange={(v) => update({ englishOnly: v })} label="English Only" description={canEnglishOnly ? "Le professeur ne parle qu'anglais : corrections et explications comprises. Cliquez sur un mot pour l'expliquer." : "Disponible à partir du niveau B1."} />
        {!canEnglishOnly && <p className="text-xs text-muted">Votre niveau actuel : {user.level}.</p>}
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Choisissez un scénario</h2>
          <Button variant="secondary" size="sm" loading={starting === "surprise"} onClick={() => start("surprise")}><Dices className="size-4" /> Surprise me</Button></div>
        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {data?.scenarios.map((s) => (
              <li key={s.id}>
                <button onClick={() => start(s.id)} disabled={!!starting} aria-label={`Scénario ${s.label}`} className="group h-full w-full rounded-2xl border border-border bg-surface p-4 text-left shadow-card transition hover:border-brand active:scale-[0.99] disabled:opacity-60">
                  <div className="text-3xl transition group-hover:scale-110" aria-hidden>{s.emoji}</div>
                  <div className="mt-2 font-semibold">{s.label}</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted">{starting === s.id ? "Démarrage…" : s.setup}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data && data.conversations.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Conversations récentes</h2>
          <ul className="space-y-2">
            {data.conversations.slice(0, 6).map((c) => {
              const sc = data.scenarios.find((s) => s.id === c.scenario);
              return (
                <li key={c.id}><Link href={`/conversation/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 hover:border-brand">
                  <span className="text-2xl" aria-hidden>{sc?.emoji ?? <MessageCircle />}</span>
                  <span className="min-w-0 flex-1"><span className="block font-medium">{sc?.label ?? c.scenario}</span><span className="block text-xs text-muted">{new Date(c.startedAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</span></span>
                  {c.endedAt ? <Badge tone="good">{Math.round(c.durationSec / 60)} min · {c.wordsSpoken} mots</Badge> : <Badge tone="warn">En cours</Badge>}
                </Link></li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
