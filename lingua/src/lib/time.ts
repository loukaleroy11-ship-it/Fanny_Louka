/** Day boundaries follow the learner's timezone. Dates are handled as 'YYYY-MM-DD' strings. */
export function localDate(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Prisma @db.Date value for a 'YYYY-MM-DD' string. */
export const dateOnly = (s: string) => new Date(`${s}T00:00:00.000Z`);

export function addDays(s: string, n: number): string {
  const d = dateOnly(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const diffDays = (a: string, b: string) => Math.round((dateOnly(a).getTime() - dateOnly(b).getTime()) / 86400000);

/** Start/end instants (UTC) of the learner's local day. */
export function dayBounds(day: string, tz: string): { start: Date; end: Date } {
  // Find the UTC instant at which the local date in `tz` flips to `day`: scan from UTC midnight ±14h.
  const base = dateOnly(day).getTime();
  let start = base - 14 * 3600_000;
  for (let t = base - 14 * 3600_000; t <= base + 14 * 3600_000; t += 15 * 60_000) {
    if (localDate(new Date(t), tz) === day) {
      start = t;
      break;
    }
  }
  return { start: new Date(start), end: new Date(start + 86400000) };
}
