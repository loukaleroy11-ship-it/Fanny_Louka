"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Sparkles, Info } from "lucide-react";
import { Badge, Button, Field, Input, Modal, Select, Textarea } from "./ui";
import { useToast } from "./providers";
import { SpeakButton } from "./speak";
import { ApiClientError, api, invalidate, useApi, useDebounced } from "@/lib/client";
import { POS_LABEL } from "@/lib/labels";
import type { CardDto, VocabDto } from "@/lib/serialize";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const POS = Object.keys(POS_LABEL) as (keyof typeof POS_LABEL)[];

interface Form {
  word: string; translation: string; example: string; exampleTranslation: string; definition: string;
  pos: string; level: string; ipa: string; tags: string; deckId: string;
  synonyms: string; antonyms: string; collocations: string;
}
const EMPTY: Form = { word: "", translation: "", example: "", exampleTranslation: "", definition: "", pos: "NOUN", level: "A2", ipa: "", tags: "", deckId: "", synonyms: "", antonyms: "", collocations: "" };

const csv = (s: string) => s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);

interface CheckResult {
  exists: boolean;
  exact: { vocabulary: VocabDto; card: { id: string; decks: string[]; state: number; reps: number } | null }[];
  related: { relation: string; vocabulary: VocabDto }[];
}

/** Card form with live duplicate detection ("⚠️ This word already exists.") and AI generation. */
export function CardEditor({ open, onClose, card, onSaved, defaultDeckId }: { open: boolean; onClose: () => void; card?: CardDto | null; onSaved: () => void; defaultDeckId?: string }) {
  const toast = useToast();
  const editing = !!card;
  const [f, setF] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aiNote, setAiNote] = useState("");
  const decks = useApi<{ decks: { id: string; name: string; kind: string }[] }>(open ? "/api/decks" : null);

  useEffect(() => {
    if (!open) return;
    setErrors({}); setAiNote("");
    if (card) {
      const v = card.vocabulary;
      setF({ word: v.word, translation: v.translation, example: v.example ?? "", exampleTranslation: v.exampleTranslation ?? "", definition: v.definition ?? "", pos: v.pos, level: v.level, ipa: v.ipa ?? "", tags: card.tags.join(", "), deckId: card.decks[0]?.id ?? "", synonyms: v.synonyms.join(", "), antonyms: v.antonyms.join(", "), collocations: v.collocations.join(", ") });
    } else setF({ ...EMPTY, deckId: defaultDeckId ?? "" });
  }, [open, card, defaultDeckId]);

  const word = useDebounced(f.word, 300);
  const [check, setCheck] = useState<CheckResult | null>(null);
  useEffect(() => {
    if (!open || editing || word.trim().length < 2) { setCheck(null); return; }
    let live = true;
    api<CheckResult>(`/api/vocabulary/check?word=${encodeURIComponent(word)}`).then((r) => live && setCheck(r)).catch(() => live && setCheck(null));
    return () => { live = false; };
  }, [word, open, editing]);

  const samePos = useMemo(() => check?.exact.filter((e) => e.vocabulary.pos === f.pos) ?? [], [check, f.pos]);
  const dup = check?.exact.find((e) => e.vocabulary.pos === f.pos) ?? null;
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function generate() {
    if (!f.word.trim()) return setErrors({ word: "Saisissez d'abord un mot anglais." });
    setGenerating(true); setAiNote("");
    try {
      const r = await api<{ draft: Record<string, unknown>; mock: boolean; warning?: string }>("/api/ai/flashcard", { method: "POST", json: { word: f.word } });
      const d = r.draft as Record<string, string | string[] | null>;
      setF((x) => ({
        ...x, word: (d.word as string) || x.word, translation: (d.translation as string) || x.translation, example: (d.example as string) || x.example,
        exampleTranslation: (d.exampleTranslation as string) || x.exampleTranslation, definition: (d.definition as string) || x.definition,
        pos: (d.pos as string) || x.pos, level: (d.level as string) || x.level, ipa: (d.ipa as string) || x.ipa,
        synonyms: (d.synonyms as string[]).join(", "), antonyms: (d.antonyms as string[]).join(", "), collocations: (d.collocations as string[]).join(", "),
      }));
      setAiNote(r.mock ? "Mode démo (aucune clé IA) : seuls les champs déjà connus du lexique local sont remplis. Complétez le reste à la main." : "Brouillon généré par l'IA — vérifiez et modifiez avant d'enregistrer.");
      if (r.warning) toast(r.warning, "info");
    } catch (e) { toast(e instanceof Error ? e.message : "Erreur IA", "error"); }
    setGenerating(false);
  }

  async function save(force = false) {
    const err: Record<string, string> = {};
    if (!f.word.trim()) err.word = "Mot requis";
    if (!f.translation.trim()) err.translation = "Traduction requise";
    setErrors(err);
    if (Object.keys(err).length) return;
    setSaving(true);
    const payload = {
      word: f.word, translation: f.translation, example: f.example, exampleTranslation: f.exampleTranslation, definition: f.definition,
      pos: f.pos, level: f.level, ipa: f.ipa, tags: csv(f.tags), synonyms: csv(f.synonyms), antonyms: csv(f.antonyms), collocations: csv(f.collocations),
      ...(f.deckId && !editing ? { deckId: f.deckId } : {}),
    };
    try {
      if (editing) {
        await api(`/api/cards/${card!.id}`, { method: "PATCH", json: card!.vocabulary.isPrivate ? { ...payload, deckIds: f.deckId ? [f.deckId] : undefined } : { tags: payload.tags, deckIds: f.deckId ? [f.deckId] : undefined } });
        toast("Carte modifiée", "success");
      } else {
        await api("/api/cards", { method: "POST", json: { ...payload, force } });
        toast("Carte créée ✅", "success");
      }
      invalidate("/api/");
      onSaved(); onClose();
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 409) toast("Ce mot existe déjà — voir l'avertissement.", "info");
      else toast(e instanceof Error ? e.message : "Erreur", "error");
    }
    setSaving(false);
  }

  async function studyExisting() {
    const hit = dup ?? samePos[0] ?? check?.exact[0];
    if (!hit) return;
    try {
      const r = await api<{ cardId: string }>("/api/cards/from-vocabulary", { method: "POST", json: { vocabularyId: hit.vocabulary.id } });
      const filter = encodeURIComponent(JSON.stringify({ ids: [r.cardId], status: [] }));
      window.location.href = `/review?f=${filter}&n=1&go=1`;
    } catch (e) { toast(e instanceof Error ? e.message : "Erreur", "error"); }
  }

  const readOnlyContent = editing && !card!.vocabulary.isPrivate;
  const warn = !editing && check?.exact.length ? (dup ?? check.exact[0]) : null;

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Modifier la carte" : "Nouvelle carte"} wide>
      <div className="space-y-4">
        {readOnlyContent && <p className="flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-sm text-muted"><Info className="mt-0.5 size-4 shrink-0" />Carte du lexique partagé : le contenu n&apos;est pas modifiable, mais vous pouvez changer ses tags et son deck.</p>}

        <Field label="English word" htmlFor="ce-word" error={errors.word}>
          <div className="flex gap-2">
            <Input id="ce-word" value={f.word} onChange={set("word")} placeholder="house" lang="en" autoComplete="off" autoFocus disabled={readOnlyContent} />
            {f.word && <SpeakButton text={f.word} compact label="Listen" />}
          </div>
        </Field>

        {warn && (
          <div role="alert" className="anim-pop space-y-3 rounded-2xl border border-warn/40 bg-warn-soft p-4">
            <p className="flex items-center gap-2 font-semibold text-warn"><AlertTriangle className="size-5" /> ⚠️ This word already exists.</p>
            <div className="rounded-xl bg-surface p-3 text-sm">
              <p className="text-lg font-semibold" lang="en">{warn.vocabulary.word}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                <dt className="text-muted">Frequency rank:</dt><dd className="font-medium">{warn.vocabulary.rank ? `#${warn.vocabulary.rank}` : "—"}</dd>
                <dt className="text-muted">Translation:</dt><dd className="font-medium">{warn.vocabulary.translation}</dd>
                <dt className="text-muted">Category:</dt><dd className="font-medium">{warn.vocabulary.category}</dd>
                <dt className="text-muted">CEFR:</dt><dd className="font-medium">{warn.vocabulary.level}</dd>
              </dl>
              {warn.card ? <p className="mt-2 text-xs text-muted">Déjà dans vos cartes ({warn.card.decks.join(", ")}).</p> : <p className="mt-2 text-xs text-muted">Présent dans le lexique mais pas encore dans vos cartes.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={studyExisting}>Study existing card</Button>
              {samePos.length === 0 && <Badge tone="neutral">Autre catégorie grammaticale : vous pouvez créer une nouvelle entrée</Badge>}
              <Button size="sm" variant="secondary" onClick={() => void save(true)} loading={saving}>Create anyway</Button>
            </div>
          </div>
        )}
        {!editing && check && check.related.length > 0 && (
          <p className="text-sm text-muted">Formes liées : {check.related.map((r) => <Badge key={r.vocabulary.id} tone="brand" className="mr-1">{r.vocabulary.word}{r.vocabulary.rank ? ` #${r.vocabulary.rank}` : ""}</Badge>)}<span className="text-xs">(ce sont des entrées distinctes, pas des doublons)</span></p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!readOnlyContent && <Button variant="secondary" size="sm" onClick={generate} loading={generating}><Sparkles className="size-4" /> Generate with AI</Button>}
          {aiNote && <p className="text-xs text-muted" role="status">{aiNote}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="French translation" htmlFor="ce-fr" error={errors.translation}><Input id="ce-fr" value={f.translation} onChange={set("translation")} placeholder="maison" disabled={readOnlyContent} /></Field>
          <Field label="Part of speech / Category" htmlFor="ce-pos">
            <Select id="ce-pos" value={f.pos} onChange={set("pos")} disabled={readOnlyContent}>{POS.map((p) => <option key={p} value={p}>{POS_LABEL[p]}</option>)}</Select>
          </Field>
          <Field label="Level (CEFR)" htmlFor="ce-level"><Select id="ce-level" value={f.level} onChange={set("level")} disabled={readOnlyContent}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</Select></Field>
          <Field label="IPA" htmlFor="ce-ipa" hint="Sans les barres obliques"><Input id="ce-ipa" value={f.ipa} onChange={set("ipa")} placeholder="haʊs" disabled={readOnlyContent} /></Field>
        </div>
        <Field label="Example" htmlFor="ce-ex"><Textarea id="ce-ex" value={f.example} onChange={set("example")} rows={2} placeholder="They have a big house." lang="en" disabled={readOnlyContent} /></Field>
        <Field label="Example translation" htmlFor="ce-ext"><Textarea id="ce-ext" value={f.exampleTranslation} onChange={set("exampleTranslation")} rows={2} disabled={readOnlyContent} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tags" htmlFor="ce-tags" hint="Séparés par des virgules"><Input id="ce-tags" value={f.tags} onChange={set("tags")} placeholder="travel, food" /></Field>
          <Field label="Deck" htmlFor="ce-deck">
            <Select id="ce-deck" value={f.deckId} onChange={set("deckId")}>
              <option value="">My Words (par défaut)</option>
              {decks.data?.decks.filter((d) => d.kind !== "MISTAKES" || editing).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
        </div>
        {!readOnlyContent && (
          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium">Définition, synonymes, antonymes, collocations</summary>
            <div className="mt-3 space-y-3">
              <Field label="Definition" htmlFor="ce-def"><Textarea id="ce-def" value={f.definition} onChange={set("definition")} rows={2} lang="en" /></Field>
              <Field label="Synonyms" htmlFor="ce-syn"><Input id="ce-syn" value={f.synonyms} onChange={set("synonyms")} /></Field>
              <Field label="Antonyms" htmlFor="ce-ant"><Input id="ce-ant" value={f.antonyms} onChange={set("antonyms")} /></Field>
              <Field label="Collocations" htmlFor="ce-col"><Input id="ce-col" value={f.collocations} onChange={set("collocations")} /></Field>
            </div>
          </details>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => void save(false)} loading={saving} disabled={!editing && !!dup}>{editing ? "Enregistrer" : "Créer la carte"}</Button>
        </div>
        {!editing && dup && <p className="text-right text-xs text-muted">Pour éviter les doublons, utilisez « Study existing card » ou « Create anyway ».</p>}
      </div>
    </Modal>
  );
}
