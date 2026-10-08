"use client";
import clsx from "clsx";

/** Lightweight SVG charts (no chart library → tiny bundle, themed with CSS variables). */

export function BarChart({ data, height = 140, color = "var(--brand)", unit = "", format }: { data: { label: string; value: number }[]; height?: number; color?: string; unit?: string; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / data.length;
  const f = format ?? ((n: number) => `${Math.round(n * 10) / 10}${unit}`);
  return (
    <figure>
      <svg viewBox={`0 0 100 ${height / 4}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label={data.map((d) => `${d.label}: ${f(d.value)}`).join(", ")}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 4 - 3);
          return (
            <g key={i}>
              <title>{`${d.label}: ${f(d.value)}`}</title>
              <rect x={i * w + w * 0.18} y={height / 4 - h} width={w * 0.64} height={Math.max(d.value > 0 ? 0.8 : 0, h)} rx={0.8} fill={color} opacity={d.value > 0 ? 1 : 0.15} />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted" aria-hidden>
        <span>{data[0]?.label}</span>
        <span>{data[Math.floor(data.length / 2)]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </figure>
  );
}

export function LineChart({ data, height = 140, color = "var(--brand)", yMax, unit = "" }: { data: { label: string; value: number | null }[]; height?: number; color?: string; yMax?: number; unit?: string }) {
  const vals = data.map((d) => d.value ?? 0);
  const max = yMax ?? Math.max(1, ...vals);
  const H = height / 4;
  const pts = data.map((d, i) => (d.value === null ? null : [(i / Math.max(1, data.length - 1)) * 100, H - 2 - (d.value / max) * (H - 5)] as const));
  const line = pts.filter(Boolean) as (readonly [number, number])[];
  const path = line.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  const area = line.length ? `${path} L${line[line.length - 1][0]},${H} L${line[0][0]},${H} Z` : "";
  return (
    <figure>
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label={data.map((d) => `${d.label}: ${d.value ?? "n/a"}${unit}`).join(", ")}>
        {area && <path d={area} fill={color} opacity={0.12} />}
        {path && <path d={path} fill="none" stroke={color} strokeWidth={0.9} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted" aria-hidden>
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </figure>
  );
}

export function Ring({ value, size = 96, stroke = 10, children, color = "var(--brand)", label }: { value: number; size?: number; stroke?: number; children?: React.ReactNode; color?: string; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: "stroke-dashoffset .8s ease" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function HBar({ label, value, max, right, tone = "brand" }: { label: string; value: number; max: number; right?: React.ReactNode; tone?: "brand" | "good" | "warn" | "bad" }) {
  const pct = Math.max(2, Math.min(100, (value / Math.max(1, max)) * 100));
  const color = { brand: "bg-brand", good: "bg-accent", warn: "bg-warn", bad: "bg-danger" }[tone];
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm"><span className="font-medium">{label}</span><span className="text-muted tabular-nums">{right ?? value}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className={clsx("h-full rounded-full transition-[width] duration-700", color)} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
