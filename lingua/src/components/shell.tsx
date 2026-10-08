"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  Headphones, BarChart3, BookOpen, Brain, Flame, GraduationCap, Home, Languages, Layers, LayoutGrid, Library, LogOut, MessageCircle,
  Menu, Moon, Search, Settings, Sparkles, Sun, TriangleAlert, User as UserIcon, X, Zap, TrendingUp, Repeat,
} from "lucide-react";
import { useUser } from "./providers";
import { api } from "@/lib/client";

const NAV: { href: string; label: string; icon: typeof Home; group: "main" | "learn" | "more" }[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home, group: "main" },
  { href: "/review", label: "Réviser", icon: Repeat, group: "main" },
  { href: "/conversation", label: "AI Conversation", icon: MessageCircle, group: "main" },
  { href: "/oral", label: "Oral", icon: Headphones, group: "main" },
  { href: "/cards", label: "My Cards", icon: Layers, group: "main" },
  { href: "/decks", label: "Decks", icon: LayoutGrid, group: "learn" },
  { href: "/vocabulary", label: "Vocabulaire", icon: Library, group: "learn" },
  { href: "/verbs", label: "Most Common Verbs", icon: Zap, group: "learn" },
  { href: "/grammar", label: "English Grammar", icon: GraduationCap, group: "learn" },
  { href: "/cognates", label: "Words You Know", icon: Languages, group: "learn" },
  { href: "/mistakes", label: "My Mistakes", icon: TriangleAlert, group: "more" },
  { href: "/progress", label: "Progression", icon: TrendingUp, group: "more" },
  { href: "/stats", label: "Statistiques", icon: BarChart3, group: "more" },
  { href: "/settings", label: "Paramètres", icon: Settings, group: "more" },
];

const TABS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/review", label: "Réviser", icon: Repeat },
  { href: "/conversation", label: "Parler", icon: MessageCircle },
  { href: "/oral", label: "Oral", icon: Headphones },
];

const active = (path: string, href: string) => path === href || path.startsWith(href + "/");

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, update } = useUser();
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const chat = path.startsWith("/conversation/");

  const toggleTheme = () => {
    const dark = document.documentElement.classList.contains("dark");
    void update({ theme: dark ? "light" : "dark" });
  };
  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const link = (n: (typeof NAV)[number]) => (
    <Link key={n.href} href={n.href} onClick={() => setMenu(false)} aria-current={active(path, n.href) ? "page" : undefined}
      className={clsx("flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition", active(path, n.href) ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2 hover:text-text")}>
      <n.icon className="size-[18px]" aria-hidden /> {n.label}
    </Link>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-brand-ink">Aller au contenu</a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1 overflow-y-auto border-r border-border bg-surface px-3 py-5 lg:flex">
        <Link href="/dashboard" className="mb-4 flex items-center gap-2 px-3 text-lg font-semibold">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-brand-ink"><Sparkles className="size-5" /></span> Lingua
        </Link>
        {NAV.filter((n) => n.group === "main").map(link)}
        <p className="mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted">Apprendre</p>
        {NAV.filter((n) => n.group === "learn").map(link)}
        <p className="mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted">Suivi</p>
        {NAV.filter((n) => n.group === "more").map(link)}
        <div className="mt-auto space-y-1 pt-4">
          <Link href="/profile" className="flex h-12 items-center gap-3 rounded-xl px-3 hover:bg-surface-2">
            <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{user.name[0]?.toUpperCase()}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{user.name}</span><span className="block text-xs text-muted">Niveau {user.levelLabel}</span></span>
          </Link>
          <button onClick={logout} className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted hover:bg-surface-2"><LogOut className="size-[18px]" /> Déconnexion</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur lg:px-8">
          <button className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-surface-2 lg:hidden" aria-label="Menu" onClick={() => setMenu(true)}><Menu className="size-5" /></button>
          <form role="search" className="relative max-w-md flex-1" onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`); }}>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un mot (run, courir…)" aria-label="Recherche globale"
              className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-base placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30" />
          </form>
          <div className="ml-auto flex items-center gap-1.5">
            <Link href="/stats" title={`${user.streak} jours de suite`} className="inline-flex h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold hover:bg-surface-2">
              <Flame className={clsx("size-5", user.streak > 0 ? "text-orange-500" : "text-muted")} aria-hidden /><span className="tabular-nums">{user.streak}</span><span className="sr-only"> jours de série</span>
            </Link>
            <span className="hidden h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold sm:inline-flex" title={`Niveau joueur ${user.player.level}`}><Zap className="size-4 text-brand" aria-hidden /><span className="tabular-nums">{user.xp}</span> XP</span>
            <button onClick={toggleTheme} aria-label="Changer de thème" className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-surface-2">
              <Sun className="hidden size-5 dark:block" /><Moon className="size-5 dark:hidden" />
            </button>
          </div>
        </header>

        <main id="main" className={clsx("mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8", chat ? "pb-4" : "pb-28 lg:pb-10")}>{children}</main>

        {/* Mobile bottom tab bar (hidden inside a conversation, which has its own composer) */}
        {!chat && (
          <nav aria-label="Navigation principale" className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-surface/95 backdrop-blur lg:hidden">
            {TABS.map((t) => (
              <Link key={t.href} href={t.href} aria-current={active(path, t.href) ? "page" : undefined} className={clsx("flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active(path, t.href) ? "text-brand" : "text-muted")}>
                <t.icon className="size-5" aria-hidden />{t.label}
              </Link>
            ))}
            <button onClick={() => setMenu(true)} className="flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted"><LayoutGrid className="size-5" aria-hidden />Plus</button>
          </nav>
        )}
      </div>

      {/* Mobile drawer */}
      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenu(false)} />
          <div className="anim-up absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-border bg-surface p-4 safe-bottom">
            <div className="mb-2 flex items-center justify-between"><span className="font-semibold">Lingua</span><button aria-label="Fermer" onClick={() => setMenu(false)} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-surface-2"><X className="size-5" /></button></div>
            <div className="grid gap-1">
              {NAV.map(link)}
              <Link href="/profile" onClick={() => setMenu(false)} className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted hover:bg-surface-2"><UserIcon className="size-[18px]" /> Profil</Link>
              <button onClick={logout} className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted hover:bg-surface-2"><LogOut className="size-[18px]" /> Déconnexion</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { BookOpen, Brain };
