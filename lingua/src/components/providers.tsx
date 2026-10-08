"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, Info, TriangleAlert, X, Trophy } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/client";

export interface ClientUser {
  id: string; name: string; email: string; level: string; levelLabel: string; goal: string;
  dailyMinutes: number; dailyNewCards: number; dailyReviewCards: number; dailyConversations: number;
  accent: "US" | "UK"; voiceGender: "female" | "male"; speechRate: number; englishOnly: boolean; autoAddMistakes: boolean;
  theme: "system" | "light" | "dark"; desiredRetention: number; streak: number; xp: number; placementDone: boolean;
  player: { level: number; floor: number; next: number; progress: number };
}

interface UserCtx { user: ClientUser; refresh: () => Promise<void>; update: (patch: Partial<ClientUser>) => Promise<void> }
const UserContext = createContext<UserCtx | null>(null);
export const useUser = () => {
  const c = useContext(UserContext);
  if (!c) throw new Error("useUser outside provider");
  return c;
};

type ToastKind = "success" | "error" | "info" | "reward";
interface Toast { id: number; kind: ToastKind; text: string }
const ToastContext = createContext<{ toast: (text: string, kind?: ToastKind) => void } | null>(null);
export const useToast = () => {
  const c = useContext(ToastContext);
  if (!c) throw new Error("useToast outside provider");
  return c.toast;
};

export function applyTheme(theme: string) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  try { localStorage.setItem("lingua-theme", theme); } catch { /* storage unavailable */ }
}

export function Providers({ initialUser, children }: { initialUser: ClientUser; children: ReactNode }) {
  const [user, setUser] = useState(initialUser);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => { applyTheme(user.theme); }, [user.theme]);
  useEffect(() => {
    if (user.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyTheme("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [user.theme]);

  const toast = useCallback((text: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3800);
  }, []);

  const refresh = useCallback(async () => {
    const r = await api<{ user: ClientUser }>("/api/auth/me");
    setUser(r.user);
  }, []);

  const update = useCallback(async (patch: Partial<ClientUser>) => {
    setUser((u) => ({ ...u, ...patch })); // optimistic
    try {
      const r = await api<{ user: ClientUser }>("/api/profile", { method: "PATCH", json: patch });
      setUser((u) => ({ ...u, ...r.user }));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error");
      await refresh();
    }
  }, [refresh, toast]);

  const value = useMemo(() => ({ user, refresh, update }), [user, refresh, update]);
  const icon = { success: CheckCircle2, error: TriangleAlert, info: Info, reward: Trophy };

  return (
    <UserContext.Provider value={value}>
      <ToastContext.Provider value={{ toast }}>
        {children}
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
          {toasts.map((t) => {
            const Icon = icon[t.kind];
            return (
              <div key={t.id} role={t.kind === "error" ? "alert" : "status"} className={clsx("anim-pop pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-card",
                t.kind === "error" ? "border-danger/40 bg-danger-soft text-danger" : t.kind === "success" ? "border-accent/40 bg-accent-soft text-accent" : t.kind === "reward" ? "border-warn/40 bg-warn-soft text-warn" : "border-border bg-surface text-text")}>
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="flex-1">{t.text}</span>
                <button aria-label="Fermer" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}><X className="size-4" /></button>
              </div>
            );
          })}
        </div>
      </ToastContext.Provider>
    </UserContext.Provider>
  );
}
