"use client";
import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button, Modal, PageHeader, Select, Chip } from "@/components/ui";
import { CardBrowser } from "@/components/card-browser";
import { useToast } from "@/components/providers";
import { api, invalidate, useApi } from "@/lib/client";

export function CardsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const [io, setIo] = useState(false);
  const [deckId, setDeckId] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const decks = useApi<{ decks: { id: string; name: string }[] }>(io ? "/api/decks" : null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 1_500_000) return toast("Fichier trop volumineux (max 1,5 Mo).", "error");
    setBusy(true);
    try {
      const csv = await f.text();
      const r = await api<{ created: number; linked: number; duplicates: number; errors: string[]; total: number }>("/api/cards/import", { method: "POST", json: { csv, deckId: deckId || undefined } });
      toast(`Import : ${r.created} créées, ${r.linked} liées au lexique, ${r.duplicates} doublons ignorés${r.errors.length ? `, ${r.errors.length} lignes invalides` : ""}.`, "success");
      invalidate("/api/"); setKey((k) => k + 1); setIo(false);
    } catch (err) { toast(err instanceof Error ? err.message : "Import impossible", "error"); }
    setBusy(false);
    e.target.value = "";
  }

  return (
    <div>
      <PageHeader title="My Cards" subtitle="Créez, modifiez, recherchez et triez vos flashcards." actions={<Button variant="secondary" onClick={() => setIo(true)}><Download className="size-4" /> Import / Export</Button>} />
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Portée">
        <Chip active={tab === "mine"} onClick={() => setTab("mine")}>Créées par moi</Chip>
        <Chip active={tab === "all"} onClick={() => setTab("all")}>Toutes mes cartes</Chip>
      </div>
      <CardBrowser key={`${tab}-${key}`} scope={tab === "mine" ? ["mine"] : []} defaultSort={tab === "mine" ? "newest" : "rank"} emptyHint={tab === "mine" ? "Vous n'avez encore créé aucune carte. Cliquez sur « Nouvelle carte » ou utilisez « Generate with AI »." : undefined} />
      <Modal open={io} onClose={() => setIo(false)} title="Import / Export">
        <div className="space-y-5">
          <section className="space-y-2">
            <h3 className="font-semibold">Exporter</h3>
            <p className="text-sm text-muted">Colonnes : English, French, Example, ExampleTranslation, Category, PartOfSpeech, Level, Rank, Tags.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => window.location.assign("/api/cards/export?format=csv&scope=mine")} className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 text-sm font-medium hover:bg-border"><Download className="size-4" /> Mes cartes (CSV)</button>
              <button type="button" onClick={() => window.location.assign("/api/cards/export?format=csv")} className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 text-sm font-medium hover:bg-border"><Download className="size-4" /> Toutes (CSV)</button>
              <button type="button" onClick={() => window.location.assign("/api/cards/export?format=anki-tsv")} className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 text-sm font-medium hover:bg-border"><Download className="size-4" /> Format texte Anki</button>
            </div>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold">Importer un CSV</h3>
            <Select aria-label="Deck de destination" value={deckId} onChange={(e) => setDeckId(e.target.value)}><option value="">My Words (par défaut)</option>{decks.data?.decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
            <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
            <Button onClick={() => file.current?.click()} loading={busy}><Upload className="size-4" /> Choisir un fichier CSV</Button>
            <p className="text-xs text-muted">Les mots déjà présents sont détectés et ignorés ; ceux du lexique partagé sont simplement ajoutés à vos cartes. 500 lignes maximum.</p>
          </section>
        </div>
      </Modal>
    </div>
  );
}
