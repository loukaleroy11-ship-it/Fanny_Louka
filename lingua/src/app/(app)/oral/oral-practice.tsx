"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Ear, Mic, MicOff, RotateCcw, Snail, Volume2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Progress } from "@/components/ui";
import { Ring } from "@/components/charts";
import { useToast, useUser } from "@/components/providers";
import { ApiClientError, api, invalidate } from "@/lib/client";
import { getRecognitionCtor, speak, stopSpeaking, ttsSupported } from "@/lib/speech";

type Mode = "listen" | "repeat";
interface Item { id: string; sentence: string; translation: string; level: string; hint: string }
interface Result { score: number; pass: boolean; marks: { word: string; ok: boolean }[]; missed: string[]; extra: string[]; progress: { unlocked: { name: string; icon: string }[] } }

export function OralPractice() {
  const { user } = useUser();
  const toast = useToast();
  const [mode, setMode] = useState<Mode | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [heard, setHeard] = useState("");
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [showText, setShowText] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const rec = useRef<{ abort(): void } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const item = items[i];
  // Browser capabilities are only known on the client: start optimistic so server and client HTML match.
  const [caps, setCaps] = useState({ sr: true, tts: true });
  useEffect(() => setCaps({ sr: !!getRecognitionCtor(), tts: ttsSupported() }), []);
  const srOk = caps.sr;

  const play = useCallback((text: string, rate?: number) => {
    if (!ttsSupported()) { toast("La synthèse vocale n'est pas disponible sur ce navigateur.", "error"); return; }
    void speak(text, { accent: user.accent, gender: user.voiceGender, rate: rate ?? user.speechRate });
  }, [user.accent, user.voiceGender, user.speechRate, toast]);

  async function start(m: Mode) {
    setLoading(true);
    try {
      const r = await api<{ items: Item[] }>("/api/oral/items?n=8");
      if (!r.items.length) { toast("Aucune phrase disponible pour l'instant.", "info"); setLoading(false); return; }
      setMode(m); setItems(r.items); setI(0); setResults([]); setResult(null); setTyped(""); setHeard(""); setShowText(m === "repeat");
    } catch (e) { toast(e instanceof Error ? e.message : "Erreur", "error"); }
    setLoading(false);
  }

  // Play the model sentence automatically when a new item appears
  useEffect(() => {
    if (!mode || !item || result) return;
    const t = setTimeout(() => play(item.sentence), 350);
    if (mode === "listen") input.current?.focus();
    return () => { clearTimeout(t); stopSpeaking(); };
  }, [mode, i, item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function score(text: string, confidence?: number) {
    if (!item || !mode) return;
    setBusy(true);
    try {
      const r = await api<Result>("/api/oral/score", { method: "POST", json: { mode, target: item.sentence, heard: text, level: item.level, confidence, last: i === items.length - 1 } });
      setResult(r); setResults((x) => [...x, r]);
      r.progress.unlocked.forEach((u) => toast(`${u.icon} Badge débloqué : ${u.name}`, "reward"));
      invalidate("/api/");
    } catch (e) { toast(e instanceof ApiClientError ? e.message : "Erreur", "error"); }
    setBusy(false);
  }

  function speakNow() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return toast("La reconnaissance vocale n'est pas disponible ici (essayez Chrome, Edge ou Safari).", "error");
    stopSpeaking();
    const r = new Ctor();
    r.lang = user.accent === "UK" ? "en-GB" : "en-US";
    r.continuous = false; r.interimResults = true; r.maxAlternatives = 1;
    let finalText = ""; let conf: number | undefined;
    r.onresult = (e) => {
      let interim = "";
      for (let k = e.resultIndex; k < e.results.length; k++) { const x = e.results[k]; if (x.isFinal) { finalText += x[0].transcript; conf = x[0].confidence; } else interim += x[0].transcript; }
      setHeard((finalText + interim).trim());
    };
    r.onerror = (e) => { if (e.error !== "aborted") toast(({ "not-allowed": "Accès au micro refusé : autorisez-le dans votre navigateur.", "no-speech": "Je n'ai rien entendu, réessayez.", "audio-capture": "Aucun micro détecté." } as Record<string, string>)[e.error] ?? `Erreur micro (${e.error})`, "error"); };
    r.onend = () => { setListening(false); const t = finalText.trim(); if (t) void score(t, conf); };
    rec.current = r;
    setHeard(""); setResult(null);
    try { r.start(); setListening(true); } catch { toast("Impossible de démarrer le micro.", "error"); }
  }

  function next() { setResult(null); setTyped(""); setHeard(""); if (i + 1 < items.length) setI(i + 1); else setI(items.length); }
  useEffect(() => () => { rec.current?.abort(); stopSpeaking(); }, []);

  if (!mode)
    return (
      <div>
        <PageHeader title="Oral : comprendre et parler" subtitle="Entraînez votre oreille et votre bouche : phrases tirées de vos cartes et des leçons, à votre niveau." />
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="flex flex-col gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand"><Ear className="size-6" /></span>
            <h2 className="text-xl font-semibold">Écoute &amp; écris</h2>
            <p className="text-sm text-muted">Compréhension orale : écoutez une phrase (autant de fois que nécessaire, normale ou lente) et écrivez ce que vous entendez.</p>
            <Button className="mt-auto" size="lg" loading={loading} onClick={() => start("listen")}>Commencer</Button>
          </Card>
          <Card className="flex flex-col gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent"><Mic className="size-6" /></span>
            <h2 className="text-xl font-semibold">Écoute &amp; répète</h2>
            <p className="text-sm text-muted">Expression orale : écoutez le modèle, puis répétez à voix haute. Le micro transcrit et vous voyez mot par mot ce qui est passé.</p>
            <Button className="mt-auto" size="lg" variant="success" loading={loading} onClick={() => start("repeat")}>Commencer</Button>
          </Card>
        </div>
        <Card className="mt-4 text-sm text-muted"><b className="text-text">Bon à savoir :</b> la répétition est évaluée par la reconnaissance vocale de votre navigateur : elle vérifie qu&apos;on vous <i>comprend</i>, pas la qualité exacte de votre accent. Pour parler librement, utilisez <Link href="/conversation" className="inline-flex min-h-11 items-center text-brand underline">AI Conversation</Link>.</Card>
      </div>
    );

  if (i >= items.length) {
    const avg = results.length ? results.reduce((n, r) => n + r.score, 0) / results.length : 0;
    const missed = [...new Set(results.flatMap((r) => r.missed.map((w) => w.toLowerCase())))].slice(0, 12);
    return (
      <div className="mx-auto max-w-xl space-y-4 anim-up">
        <Card className="space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Session terminée</h1>
          <div className="flex justify-center"><Ring value={avg} size={140} stroke={12} color={avg >= 0.75 ? "var(--accent)" : "var(--warn)"}><div><div className="text-3xl font-semibold">{Math.round(avg * 100)}%</div><div className="text-xs text-muted">{results.filter((r) => r.pass).length}/{results.length} réussies</div></div></Ring></div>
          {missed.length > 0 && <div className="text-left"><p className="mb-2 text-sm font-medium">Mots à retravailler</p><div className="flex flex-wrap gap-2">{missed.map((w) => <Link key={w} href={`/search?q=${encodeURIComponent(w)}`}><Badge tone="warn" className="!py-1.5">{w}</Badge></Link>)}</div></div>}
        </Card>
        <div className="grid gap-2 sm:grid-cols-2"><Button size="lg" onClick={() => start(mode)}><RotateCcw className="size-4" /> Encore une série</Button><Button size="lg" variant="secondary" onClick={() => setMode(null)}>Changer d&apos;exercice</Button></div>
      </div>
    );
  }

  const repeat = mode === "repeat";
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-2"><div className="flex justify-between text-sm text-muted"><span>{repeat ? "Écoute & répète" : "Écoute & écris"}</span><span className="tabular-nums">{i + 1} / {items.length}</span></div><Progress value={i / items.length} label="Progression" /></div>
      <Card className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="lg" onClick={() => play(item.sentence)}><Volume2 className="size-5" /> Écouter</Button>
          <Button size="lg" variant="secondary" onClick={() => play(item.sentence, 0.65)}><Snail className="size-5" /> Lent</Button>
          <Badge tone="brand" className="ml-auto">{item.level}</Badge>
        </div>

        {repeat && (
          <div className="rounded-xl bg-surface-2 p-4 text-center">
            {showText ? <p className="text-xl font-medium leading-snug" lang="en">{result ? result.marks.map((m, k) => <span key={k} className={clsx("mr-1.5", m.ok ? "text-accent" : "text-danger underline decoration-wavy")}>{m.word}</span>) : item.sentence}</p> : <p className="text-muted">🎧 Texte masqué — répétez de mémoire</p>}
            {showText && <p className="mt-1 text-sm text-muted">{item.translation}</p>}
            <button className="mt-2 inline-flex min-h-11 items-center text-xs text-muted underline" onClick={() => setShowText(!showText)}>{showText ? "Masquer le texte" : "Afficher le texte"}</button>
          </div>
        )}

        {!repeat && !result && (
          <div className="space-y-3">
            <Input ref={input} value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === "Enter" && typed.trim() && void score(typed)} lang="en" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="Écrivez ce que vous entendez…" aria-label="Phrase entendue" />
            <Button size="lg" className="w-full" disabled={!typed.trim()} loading={busy} onClick={() => void score(typed)}>Vérifier</Button>
          </div>
        )}

        {repeat && !result && (
          <div className="flex flex-col items-center gap-2">
            <button onClick={listening ? () => rec.current?.abort() : speakNow} disabled={busy || !srOk} aria-pressed={listening} aria-label={listening ? "Arrêter" : "Speak"}
              className={clsx("inline-flex size-20 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 disabled:opacity-40", listening ? "mic-pulse bg-danger" : "bg-brand")}>
              {listening ? <MicOff className="size-8" /> : <Mic className="size-8" />}
            </button>
            <p className="min-h-5 text-sm text-muted" aria-live="polite">{listening ? <>Je vous écoute… <span className="text-text" lang="en">{heard}</span></> : srOk ? "Touchez le micro et répétez la phrase." : "Micro indisponible sur ce navigateur (utilisez Chrome, Edge ou Safari)."}</p>
          </div>
        )}

        {result && (
          <div role="status" className={clsx("anim-pop space-y-2 rounded-xl p-4 text-sm", result.pass ? "bg-accent-soft" : "bg-warn-soft")}>
            <p className={clsx("text-base font-semibold", result.pass ? "text-accent" : "text-warn")}>{result.pass ? "Bien joué !" : "Presque…"} {Math.round(result.score * 100)} %</p>
            {!repeat && <p lang="en" className="text-base">{result.marks.map((m, k) => <span key={k} className={clsx("mr-1.5", m.ok ? "text-accent" : "font-semibold text-danger")}>{m.word}</span>)}</p>}
            {!repeat && <p className="text-muted">{item.translation}</p>}
            {repeat && heard && <p className="text-muted">Entendu : <span className="text-text" lang="en">« {heard} »</span></p>}
            {result.missed.length > 0 && <p>À travailler : <b lang="en">{result.missed.join(", ")}</b></p>}
            <div className="flex flex-wrap gap-2 pt-1">
              {repeat && !result.pass && <Button variant="secondary" onClick={() => { setResult(null); setHeard(""); }}>Réessayer</Button>}
              <Button onClick={next} autoFocus>{i + 1 >= items.length ? "Terminer" : "Suivant"}</Button>
            </div>
          </div>
        )}
      </Card>
      {!caps.tts && <EmptyState icon="🔇" title="Voix indisponible">Ce navigateur ne propose pas de synthèse vocale : utilisez Chrome, Edge ou Safari.</EmptyState>}
    </div>
  );
}
