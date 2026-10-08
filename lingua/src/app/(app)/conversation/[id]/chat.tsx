"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Check, Mic, MicOff, Plus, Square, Volume2 } from "lucide-react";
import clsx from "clsx";
import { Badge, Button, Card, ErrorState, Modal, Skeleton } from "@/components/ui";
import { useToast, useUser } from "@/components/providers";
import { ApiClientError, api, invalidate } from "@/lib/client";
import { getRecognitionCtor, speak, stopSpeaking, ttsSupported, type SRInstance } from "@/lib/speech";
import { SCENARIOS } from "@/content/scenarios";

interface Correction { original: string; corrected: string; explanation: string; category: string; skill: string | null }
interface Msg { id: string; role: "USER" | "ASSISTANT"; content: string; viaVoice?: boolean; correction?: Correction[] | null; mistakeIds?: string[]; newWords?: { word: string; meaning: string }[]; createdAt?: string }
interface Conv { id: string; scenario: string; englishOnly: boolean; mock: boolean; endedAt: string | null; report: Report | null; messages: Msg[] }
interface Report {
  durationSec: number; wordsSpoken: number; corrections: number; messages: number; estimatedLevel: string; levelPlus: boolean; summary: string; tips: string[]; mock: boolean; englishOnly: boolean;
  newVocabulary: { word: string; meaning: string }[];
  mainMistakes: { vocabulary: string[]; grammar: string[]; pronunciation: string[]; fluency: string[] };
}
const RATES = [0.75, 1, 1.25, 1.5];

export function ChatView({ id }: { id: string }) {
  const toast = useToast();
  const { user, update } = useUser();
  const [conv, setConv] = useState<Conv | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [voiceReplies, setVoiceReplies] = useState(true);
  const [autoSend, setAutoSend] = useState(true);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [word, setWord] = useState<{ msgId: string; word: string; sentence: string; mode?: "english" | "french"; text?: string; loading?: boolean } | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [ending, setEnding] = useState(false);
  const [mock, setMock] = useState(false);
  const rec = useRef<SRInstance | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const confidence = useRef<number | undefined>(undefined);
  const srSupported = useMemo(() => typeof window !== "undefined" && !!getRecognitionCtor(), []);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let live = true;
    api<{ conversation: Conv }>(`/api/conversation/${id}`)
      .then((r) => { if (!live) return; setConv(r.conversation); setMsgs(r.conversation.messages.map((m) => ({ ...m, correction: m.correction as Correction[] | null }))); setReport(r.conversation.report); setMock(r.conversation.mock); })
      .catch((e) => live && setError(e instanceof Error ? e.message : "Erreur"));
    return () => { live = false; stopSpeaking(); rec.current?.abort(); };
  }, [id]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length, sending, interim]);

  const say = useCallback((m: Msg) => {
    if (!ttsSupported()) return;
    setSpeakingId(m.id);
    // The teacher also adapts its speaking speed: at the default 1x, beginners hear slightly slower speech.
    const levelRate = user.speechRate === 1 ? ({ A1: 0.85, A2: 0.92 } as Record<string, number>)[user.level] ?? 1 : user.speechRate;
    void speak(m.content, { accent: user.accent, gender: user.voiceGender, rate: levelRate, onEnd: () => setSpeakingId((s) => (s === m.id ? null : s)) });
  }, [user.accent, user.voiceGender, user.speechRate, user.level]);

  // Read the opener aloud once (first load of a fresh conversation), if voice replies are on
  const opened = useRef(false);
  useEffect(() => {
    if (conv && !conv.endedAt && msgs.length === 1 && !opened.current && voiceReplies) { opened.current = true; say(msgs[0]); }
  }, [conv, msgs, voiceReplies, say]);

  const send = useCallback(async (content: string, viaVoice = false, conf?: number) => {
    const body = content.trim();
    if (!body || sending || !conv) return;
    stopSpeaking();
    setSending(true);
    setText("");
    const tempId = `tmp-${Date.now()}`;
    setMsgs((m) => [...m, { id: tempId, role: "USER", content: body, viaVoice }]);
    try {
      const r = await api<{ userMessage: Msg; assistantMessage: Msg; mistakes: { id: string }[]; newWords: { word: string; meaning: string }[]; mock: boolean; warning?: string; progress: { unlocked: { name: string; icon: string }[] } }>(
        `/api/conversation/${conv.id}/message`, { method: "POST", json: { content: body, viaVoice, sttConfidence: conf } });
      setMsgs((m) => [...m.filter((x) => x.id !== tempId), { ...r.userMessage, mistakeIds: r.mistakes.map((x) => x.id) }, { ...r.assistantMessage, newWords: r.newWords }]);
      setMock(r.mock);
      if (r.warning) toast(r.warning, "info");
      r.progress.unlocked.forEach((u) => toast(`${u.icon} Badge débloqué : ${u.name}`, "reward"));
      if (voiceReplies) say(r.assistantMessage);
    } catch (e) {
      setMsgs((m) => m.filter((x) => x.id !== tempId));
      setText(body);
      toast(e instanceof Error ? e.message : "Erreur d'envoi", "error");
    }
    setSending(false);
  }, [sending, conv, voiceReplies, say, toast]);

  function startListening() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return toast("La reconnaissance vocale n'est pas disponible sur ce navigateur (essayez Chrome, Edge ou Safari). Vous pouvez écrire votre réponse.", "error");
    stopSpeaking();
    const r = new Ctor();
    r.lang = user.accent === "UK" ? "en-GB" : "en-US";
    r.continuous = false; r.interimResults = true; r.maxAlternatives = 1;
    let finalText = "";
    confidence.current = undefined;
    r.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) { finalText += res[0].transcript; confidence.current = res[0].confidence; } else interimText += res[0].transcript;
      }
      setInterim((finalText + interimText).trim());
    };
    r.onerror = (e) => {
      const map: Record<string, string> = { "not-allowed": "Accès au micro refusé : autorisez-le dans votre navigateur.", "service-not-allowed": "Reconnaissance vocale non autorisée.", "no-speech": "Je n'ai rien entendu, réessayez.", "audio-capture": "Aucun micro détecté.", network: "Erreur réseau de la reconnaissance vocale." };
      if (e.error !== "aborted") toast(map[e.error] ?? `Erreur micro (${e.error})`, "error");
    };
    r.onend = () => {
      setListening(false); setInterim("");
      const t = finalText.trim();
      if (t) { if (autoSend) void send(t, true, confidence.current); else setText((x) => (x ? x + " " : "") + t); }
    };
    rec.current = r;
    try { r.start(); setListening(true); } catch { toast("Impossible de démarrer le micro.", "error"); }
  }
  const stopListening = () => rec.current?.stop();

  async function explain(mode: "english" | "french") {
    if (!word) return;
    setWord({ ...word, mode, loading: true, text: undefined });
    try { const r = await api<{ text: string; mock: boolean }>("/api/ai/explain-word", { method: "POST", json: { word: word.word, sentence: word.sentence, mode } }); setWord((w) => w && { ...w, loading: false, text: r.text }); }
    catch (e) { setWord((w) => w && { ...w, loading: false, text: e instanceof Error ? e.message : "Erreur" }); }
  }

  async function addMistake(mid: string) {
    try { await api(`/api/mistakes/${mid}/card`, { method: "POST" }); toast("Ajoutée à vos flashcards ✅", "success"); setMsgs((m) => m.map((x) => (x.mistakeIds?.includes(mid) ? { ...x, mistakeIds: x.mistakeIds.filter((i) => i !== mid), added: true } as Msg : x))); invalidate("/api/"); }
    catch (e) { toast(e instanceof Error ? e.message : "Erreur", "error"); }
  }

  async function end() {
    if (!conv) return;
    setEnding(true); stopSpeaking(); rec.current?.abort();
    try {
      const r = await api<{ report: Report | null; discarded?: boolean; levelChanged?: { from: string; to: string } }>(`/api/conversation/${conv.id}/end`, { method: "POST" });
      if (r.discarded || !r.report) { window.location.href = "/conversation"; return; }
      setReport(r.report); setConv({ ...conv, endedAt: new Date().toISOString() });
      if (r.levelChanged) toast(`Niveau estimé : ${r.levelChanged.from} → ${r.levelChanged.to} 🎉`, "reward");
      invalidate("/api/");
    } catch (e) { toast(e instanceof Error ? e.message : "Erreur", "error"); }
    setEnding(false);
  }

  if (error) return <ErrorState message={error} />;
  if (!conv) return <div className="space-y-3"><Skeleton className="h-12" /><Skeleton className="h-24 w-2/3" /><Skeleton className="ml-auto h-16 w-1/2" /></div>;
  const sc = SCENARIOS.find((s) => s.id === conv.scenario);
  const ended = !!conv.endedAt;

  const renderWords = (m: Msg) =>
    m.content.split(/([A-Za-z][A-Za-z'’-]*)/).map((part, i) =>
      /^[A-Za-z]/.test(part) ? (
        <button key={i} onClick={() => setWord({ msgId: m.id, word: part.replace(/['’]s$/, ""), sentence: m.content })} className="rounded px-px underline-offset-2 hover:bg-brand-soft hover:underline focus-visible:underline">{part}</button>
      ) : <span key={i}>{part}</span>,
    );

  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] max-w-3xl flex-col lg:h-[calc(100dvh-8rem)]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link href="/conversation" className="text-sm text-muted hover:text-text" aria-label="Retour aux scénarios">←</Link>
        <span className="text-xl" aria-hidden>{sc?.emoji}</span>
        <h1 className="font-semibold">{sc?.label ?? conv.scenario}</h1>
        <Badge tone="brand">{user.levelLabel}</Badge>
        {conv.englishOnly && <Badge tone="good">English Only</Badge>}
        {mock && <Badge tone="warn" className="cursor-help" >Demo mode</Badge>}
        {!ended && (
          <div className="ml-auto flex items-center gap-1.5">
            <label className="sr-only" htmlFor="rate">Vitesse de la voix</label>
            <select id="rate" value={user.speechRate} onChange={(e) => void update({ speechRate: Number(e.target.value) })} className="h-10 rounded-xl border border-border bg-surface px-2 text-sm">{RATES.map((r) => <option key={r} value={r}>{r}x</option>)}</select>
            <button onClick={() => void update({ accent: user.accent === "UK" ? "US" : "UK" })} className="h-10 rounded-xl border border-border bg-surface px-2.5 text-sm" aria-label="Changer d'accent">{user.accent === "UK" ? "🇬🇧" : "🇺🇸"}</button>
            <button onClick={() => { setVoiceReplies(!voiceReplies); if (voiceReplies) stopSpeaking(); }} aria-pressed={voiceReplies} aria-label="Réponses vocales" className={clsx("inline-flex size-10 items-center justify-center rounded-xl border", voiceReplies ? "border-brand bg-brand-soft text-brand" : "border-border bg-surface text-muted")}><Volume2 className="size-4" /></button>
            <Button size="sm" variant="secondary" onClick={end} loading={ending}>Terminer</Button>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-border bg-surface/60 p-3 sm:p-4" role="log" aria-live="polite" aria-label="Conversation">
        {msgs.map((m) => (
          <div key={m.id} className={clsx("flex flex-col gap-1.5", m.role === "USER" ? "items-end" : "items-start")}>
            <div className={clsx("anim-up max-w-[88%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed sm:max-w-[80%]", m.role === "USER" ? "rounded-br-md bg-brand text-brand-ink" : "rounded-bl-md border border-border bg-surface")} lang="en">
              {m.role === "ASSISTANT" ? renderWords(m) : m.content}
              {m.viaVoice && m.role === "USER" && <Mic className="ml-1.5 inline size-3 opacity-70" aria-label="Message vocal" />}
            </div>
            {m.role === "ASSISTANT" && (
              <div className="flex items-center gap-2 pl-1">
                <button onClick={() => (speakingId === m.id ? (stopSpeaking(), setSpeakingId(null)) : say(m))} aria-label={speakingId === m.id ? "Stop" : "Replay"} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-muted hover:bg-surface-2">{speakingId === m.id ? <Square className="size-3" /> : <Volume2 className="size-3.5" />} Replay</button>
                {m.newWords?.map((w) => <Badge key={w.word} tone="brand" className="!text-[11px]">{w.word} = {w.meaning}</Badge>)}
              </div>
            )}
            {m.role === "ASSISTANT" && word?.msgId === m.id && (
              <Card className="anim-pop max-w-[90%] space-y-2 !p-3 text-sm">
                <div className="flex items-center justify-between gap-3"><b lang="en">{word.word}</b><button onClick={() => setWord(null)} className="text-xs text-muted hover:text-text">Fermer</button></div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={word.mode === "english" ? "primary" : "secondary"} onClick={() => explain("english")}>Explain in English</Button>
                  {!conv.englishOnly && <Button size="sm" variant={word.mode === "french" ? "primary" : "secondary"} onClick={() => explain("french")}>Translate to French</Button>}
                  {conv.englishOnly && <Button size="sm" variant={word.mode === "french" ? "primary" : "ghost"} onClick={() => explain("french")}>Translate to French</Button>}
                </div>
                {word.loading && <p className="text-muted">…</p>}
                {word.text && <p className="whitespace-pre-line rounded-lg bg-surface-2 p-2.5">{word.text}</p>}
              </Card>
            )}
            {m.role === "USER" && m.correction && m.correction.length > 0 && m.correction.map((c, ci) => (
              <div key={ci} className="anim-up max-w-[88%] rounded-xl border border-warn/30 bg-warn-soft px-3 py-2 text-[13px] sm:max-w-[80%]" role="note">
                <p><span className="text-muted">You said:</span> <span className="line-through opacity-80" lang="en">{c.original}</span></p>
                <p><span className="text-muted">Better:</span> <b className="text-accent" lang="en">{c.corrected}</b></p>
                {c.explanation && <p className="mt-0.5 text-muted">{c.explanation}</p>}
                {m.mistakeIds?.[ci] && <button onClick={() => addMistake(m.mistakeIds![ci])} className="mt-1.5 inline-flex h-8 items-center gap-1 rounded-lg bg-surface px-2.5 text-xs font-medium text-brand hover:bg-surface-2"><Plus className="size-3" /> Add to my flashcards</button>}
                {!m.mistakeIds?.[ci] && user.autoAddMistakes && <span className="mt-1 inline-flex items-center gap-1 text-xs text-accent"><Check className="size-3" /> Ajoutée automatiquement</span>}
              </div>
            ))}
          </div>
        ))}
        {sending && (
          <div className="flex items-start" aria-label="Le professeur écrit"><div className="rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3"><span className="inline-flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 0.15}s` }} />)}</span></div></div>
        )}
        <div ref={bottom} />
      </div>

      {!ended ? (
        <div className="safe-bottom mt-3 space-y-2">
          {listening && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger" role="status"><span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-danger" />Listening… <span className="text-text" lang="en">{interim}</span></p>}
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
            <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(text); } }}
              rows={1} maxLength={1500} placeholder={conv.englishOnly ? "Type in English…" : "Écrivez en anglais… (ou utilisez le micro)"} aria-label="Votre message" lang="en" disabled={sending}
              className="max-h-32 min-h-12 flex-1 resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30" />
            {text.trim() ? (
              <Button type="submit" size="lg" className="!size-14 !rounded-full !p-0" aria-label="Envoyer" disabled={sending}><ArrowUp className="size-6" /></Button>
            ) : (
              <button type="button" onClick={listening ? stopListening : startListening} disabled={sending || (mounted && !srSupported)} aria-pressed={listening}
                aria-label={listening ? "Arrêter l'enregistrement" : "Speak"} title={mounted && !srSupported ? "Micro indisponible sur ce navigateur" : "Speak"}
                className={clsx("inline-flex size-14 shrink-0 items-center justify-center gap-0 rounded-full text-white shadow-lg transition active:scale-95 disabled:opacity-40", listening ? "mic-pulse bg-danger" : "bg-brand")}>
                {listening ? <MicOff className="size-6" /> : <Mic className="size-6" />}
              </button>
            )}
          </form>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{mounted && !srSupported ? "🎙️ Micro non pris en charge ici — utilisez le clavier." : "🎙️ Speak : touchez le micro et parlez en anglais."}</span>
            <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} className="size-4 accent-[var(--brand)]" /> Envoi auto après la voix</label>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-center text-sm text-muted">Cette conversation est terminée.</p>
      )}

      <Modal open={!!report && ended} onClose={() => setReport(null)} title="Conversation completed" wide>
        {report && <ReportView report={report} conversationId={conv.id} msgs={msgs} onClose={() => setReport(null)} />}
      </Modal>
      {ended && !report && <div className="mt-3 flex justify-center"><Button variant="secondary" onClick={() => setReport(conv.report)}>Voir le rapport</Button></div>}
    </div>
  );
}

function ReportView({ report, conversationId, msgs, onClose }: { report: Report; conversationId: string; msgs: Msg[]; onClose: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  const min = Math.max(1, Math.round(report.durationSec / 60));
  const userWords = report.wordsSpoken;
  const aiWords = msgs.filter((m) => m.role === "ASSISTANT").reduce((n, m) => n + (m.content.match(/[A-Za-z']+/g)?.length ?? 0), 0);
  const ratio = userWords + aiWords ? userWords / (userWords + aiWords) : 0;

  async function addAll() {
    setBusy(true);
    try { const r = await api<{ created: number }>("/api/mistakes/cards", { method: "POST", json: { conversationId } }); setAdded(r.created); invalidate("/api/"); toast(r.created ? `${r.created} cartes créées dans « My Mistakes »` : "Tout est déjà dans vos flashcards", "success"); }
    catch (e) { toast(e instanceof Error ? e.message : "Erreur", "error"); }
    setBusy(false);
  }
  const Section = ({ title, items }: { title: string; items: string[] }) => (
    <div><h4 className="text-sm font-semibold">{title}</h4>{items.length ? <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">{items.map((i) => <li key={i}>{i}</li>)}</ul> : <p className="mt-1 text-sm text-muted">—</p>}</div>
  );
  return (
    <div className="space-y-5">
      {report.mock && <p className="rounded-xl bg-warn-soft p-2.5 text-xs text-warn">Rapport généré en mode démo (statistiques simples, sans analyse IA).</p>}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[["Duration", `${min} min`], ["Words spoken", report.wordsSpoken], ["Corrections", report.corrections], ["New vocabulary", report.newVocabulary.length], ["Estimated level", `${report.estimatedLevel}${report.levelPlus ? "+" : ""}`]].map(([k, v]) => (
          <div key={String(k)} className="rounded-xl bg-surface-2 p-3 text-center"><dt className="text-xs text-muted">{k}</dt><dd className="text-xl font-semibold tabular-nums">{v}</dd></div>
        ))}
      </dl>
      <p className="text-sm text-muted">Vous avez produit <b className="text-text">{Math.round(ratio * 100)} %</b> des mots de la conversation{ratio >= 0.5 ? " 👏" : " — essayez de parler encore plus la prochaine fois."}</p>
      {report.summary && <p className="text-sm">{report.summary}</p>}
      <div><h3 className="mb-2 font-semibold">Main mistakes</h3>
        <div className="grid gap-4 sm:grid-cols-2"><Section title="Vocabulary" items={report.mainMistakes.vocabulary} /><Section title="Grammar" items={report.mainMistakes.grammar} /><Section title="Pronunciation" items={report.mainMistakes.pronunciation} /><Section title="Fluency" items={report.mainMistakes.fluency} /></div></div>
      {report.newVocabulary.length > 0 && <div><h3 className="mb-2 font-semibold">New vocabulary</h3><div className="flex flex-wrap gap-2">{report.newVocabulary.map((w) => <Link key={w.word} href={`/search?q=${encodeURIComponent(w.word)}`}><Badge tone="brand" className="!py-1.5">{w.word} — {w.meaning}</Badge></Link>)}</div></div>}
      {report.tips.length > 0 && <div><h3 className="mb-1 font-semibold">Conseils</h3><ul className="list-disc space-y-0.5 pl-5 text-sm text-muted">{report.tips.map((t) => <li key={t}>{t}</li>)}</ul></div>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={addAll} loading={busy} disabled={added !== null || report.corrections === 0}>{added !== null ? `✅ ${added} cartes ajoutées` : "Add mistakes to my flashcards"}</Button>
        <Link href="/conversation" className="inline-flex h-11 items-center rounded-xl bg-brand px-4 text-sm font-medium text-brand-ink hover:brightness-110">Nouvelle conversation</Link>
        <Button variant="ghost" onClick={onClose}>Fermer</Button>
      </div>
    </div>
  );
}

export { ApiClientError };
