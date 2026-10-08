"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, Card, Chip, Field, Input, Modal, PageHeader, Toggle } from "@/components/ui";
import { SpeakButton } from "@/components/speak";
import { useToast, useUser } from "@/components/providers";
import { api } from "@/lib/client";

export function SettingsView() {
  const { user, update } = useUser();
  const toast = useToast();
  const [pw, setPw] = useState({ current: "", next: "" });
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const b1 = ["B1", "B2", "C1", "C2"].includes(user.level);

  async function changePw(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await api("/api/profile/password", { method: "POST", json: pw }); toast("Mot de passe modifié", "success"); setPw({ current: "", next: "" }); }
    catch (err) { toast(err instanceof Error ? err.message : "Erreur", "error"); }
    setBusy(false);
  }
  async function remove() {
    try { await api("/api/profile", { method: "DELETE" }); window.location.href = "/"; }
    catch (err) { toast(err instanceof Error ? err.message : "Erreur", "error"); }
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" />
      <Card className="space-y-4">
        <h2 className="font-semibold">Apparence</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Thème">{([["system", "Système"], ["light", "Clair"], ["dark", "Sombre"]] as const).map(([v, l]) => <Chip key={v} active={user.theme === v} onClick={() => void update({ theme: v })}>{l}</Chip>)}</div>
      </Card>
      <Card className="space-y-5">
        <h2 className="font-semibold">Prononciation et voix</h2>
        <div className="space-y-2"><h3 className="text-sm font-medium">Accent préféré</h3>
          <div className="flex flex-wrap items-center gap-2"><Chip active={user.accent === "US"} onClick={() => void update({ accent: "US" })}>🇺🇸 American</Chip><Chip active={user.accent === "UK"} onClick={() => void update({ accent: "UK" })}>🇬🇧 British</Chip><SpeakButton text="Hello! This is how I sound. The weather is lovely today." label="Test" /></div></div>
        <div className="space-y-2"><h3 className="text-sm font-medium">Voix</h3>
          <div className="flex gap-2"><Chip active={user.voiceGender === "female"} onClick={() => void update({ voiceGender: "female" })}>Féminine</Chip><Chip active={user.voiceGender === "male"} onClick={() => void update({ voiceGender: "male" })}>Masculine</Chip></div>
          <p className="text-xs text-muted">Les voix disponibles dépendent de votre appareil et de votre navigateur ; si aucune voix du genre choisi n&apos;existe, une voix de la langue sélectionnée est utilisée.</p></div>
        <div className="space-y-2"><h3 className="text-sm font-medium">Vitesse</h3>
          <div className="flex gap-2">{[0.75, 1, 1.25, 1.5].map((r) => <Chip key={r} active={user.speechRate === r} onClick={() => void update({ speechRate: r })}>{r}x</Chip>)}</div></div>
      </Card>
      <Card className="space-y-1">
        <h2 className="mb-2 font-semibold">Apprentissage</h2>
        <Toggle checked={user.englishOnly && b1} onChange={(v) => update({ englishOnly: v })} label="Mode English Only" description={b1 ? "Le professeur IA parle et corrige uniquement en anglais." : "Disponible à partir du niveau B1."} />
        <Toggle checked={user.autoAddMistakes} onChange={(v) => update({ autoAddMistakes: v })} label="Ajouter automatiquement mes erreurs aux flashcards" description="Chaque erreur détectée devient une carte du deck « My Mistakes »." />
        <div className="space-y-2 pt-3"><h3 className="text-sm font-medium">Rétention visée (FSRS)</h3>
          <div className="flex flex-wrap gap-2">{[0.85, 0.9, 0.95].map((r) => <Chip key={r} active={Math.abs(user.desiredRetention - r) < 0.001} onClick={() => void update({ desiredRetention: r })}>{Math.round(r * 100)} %</Chip>)}</div>
          <p className="text-xs text-muted">Plus la rétention visée est haute, plus les révisions sont rapprochées. 90 % est le compromis recommandé.</p></div>
      </Card>
      <Card className="space-y-3"><h2 className="font-semibold">Test de niveau</h2><p className="text-sm text-muted">Refaites le test pour recalibrer votre niveau et votre programme.</p><Link href="/placement" className="inline-flex h-11 items-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-surface-2">Refaire le test</Link></Card>
      <Card><h2 className="mb-3 font-semibold">Mot de passe</h2>
        <form onSubmit={changePw} className="grid gap-4 sm:grid-cols-2">
          <Field label="Mot de passe actuel" htmlFor="pw-c"><Input id="pw-c" type="password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
          <Field label="Nouveau mot de passe" htmlFor="pw-n" hint="8 caractères minimum"><Input id="pw-n" type="password" autoComplete="new-password" minLength={8} required value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Button type="submit" loading={busy}>Changer le mot de passe</Button></div>
        </form></Card>
      <Card className="space-y-3 !border-danger/30"><h2 className="font-semibold text-danger">Zone dangereuse</h2><p className="text-sm text-muted">Supprime définitivement votre compte, vos cartes et votre historique.</p><Button variant="danger" onClick={() => setDel(true)}>Supprimer mon compte</Button></Card>
      <Modal open={del} onClose={() => setDel(false)} title="Supprimer le compte ?"><p className="text-sm text-muted">Cette action est irréversible.</p><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setDel(false)}>Annuler</Button><Button variant="danger" onClick={remove}>Supprimer définitivement</Button></div></Modal>
    </div>
  );
}
