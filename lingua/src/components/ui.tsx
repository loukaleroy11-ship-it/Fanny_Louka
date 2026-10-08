"use client";
import clsx from "clsx";
import { Loader2, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { ButtonHTMLAttributes, ComponentProps, HTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-brand-ink hover:brightness-110 shadow-sm",
  secondary: "bg-surface-2 text-text hover:bg-border border border-border",
  ghost: "text-text hover:bg-surface-2",
  danger: "bg-danger text-white hover:brightness-110",
  success: "bg-accent text-white hover:brightness-110",
};
const SIZE: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex min-w-11 select-none items-center justify-center rounded-xl font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT[variant], SIZE[size], className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={clsx("rounded-2xl border border-border bg-surface p-5 shadow-card", className)}>
      {children}
    </div>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "brand" | "good" | "warn" | "bad"; className?: string }) {
  const t = { neutral: "bg-surface-2 text-muted", brand: "bg-brand-soft text-brand", good: "bg-accent-soft text-accent", warn: "bg-warn-soft text-warn", bad: "bg-danger-soft text-danger" }[tone];
  return <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", t, className)}>{children}</span>;
}

export function Progress({ value, label, className, tone = "brand" }: { value: number; label?: string; className?: string; tone?: "brand" | "good" | "warn" }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const color = tone === "good" ? "bg-accent" : tone === "warn" ? "bg-warn" : "bg-brand";
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label} className={clsx("h-2.5 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div className={clsx("h-full rounded-full transition-[width] duration-700 ease-out", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

const field = "w-full rounded-xl border border-border bg-surface px-3.5 text-base text-text placeholder:text-muted/70 transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-60";

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input {...rest} className={clsx(field, "h-11", className)} />;
}
export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea {...rest} className={clsx(field, "min-h-24 py-2.5", className)} />;
}
export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return <select {...rest} className={clsx(field, "h-11 pr-8", className)}>{children}</select>;
}

export function Chip({ active, onClick, children, className, title }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={!!active}
      onClick={onClick}
      className={clsx(
        "inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3.5 text-sm font-medium transition active:scale-[0.97]",
        active ? "border-brand bg-brand text-brand-ink" : "border-border bg-surface text-text hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("skeleton h-4", className)} />;
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      {icon && <div className="text-4xl" aria-hidden>{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <p className="max-w-md text-sm text-muted">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-danger/30 bg-danger-soft px-6 py-8 text-center">
      <p className="font-medium text-danger">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Réessayer</Button>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className={clsx("anim-pop max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 shadow-card outline-none sm:rounded-3xl", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-surface-2"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1 !p-4">
      <div className="flex items-center gap-2 text-sm text-muted">{icon}{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </Card>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted">{description}</div>}
      </label>
      <button id={id} role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="grid h-11 w-14 shrink-0 place-items-center">
        <span className={clsx("relative block h-7 w-12 rounded-full transition", checked ? "bg-brand" : "bg-border")}>
          <span className={clsx("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
        </span>
      </button>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
