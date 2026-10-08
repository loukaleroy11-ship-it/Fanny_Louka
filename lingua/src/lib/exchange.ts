import type { Level, PartOfSpeech } from "@prisma/client";
import { POS_LABEL } from "./filters";

/**
 * Import/export architecture.
 * `CardRecord` is the neutral exchange shape. Every format (CSV today; Anki .apkg / Mnemosyne later)
 * is a pair of functions `parse(text) → CardRecord[]` and `serialize(CardRecord[]) → text` registered
 * in `FORMATS`, so adding an Anki exporter does not touch the routes or the DB code.
 */
export interface CardRecord {
  english: string;
  french: string;
  example: string;
  exampleTranslation: string;
  category: string;
  partOfSpeech: string;
  level: string;
  rank: string;
  tags: string[];
}

export const CSV_HEADER = ["English", "French", "Example", "ExampleTranslation", "Category", "PartOfSpeech", "Level", "Rank", "Tags"] as const;

function csvEscape(v: string) {
  // Neutralise spreadsheet formula injection (=, +, -, @ at the start of a cell).
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(records: CardRecord[]): string {
  const rows = records.map((r) =>
    [r.english, r.french, r.example, r.exampleTranslation, r.category, r.partOfSpeech, r.level, r.rank, r.tags.join(";")].map(csvEscape).join(","),
  );
  return "﻿" + [CSV_HEADER.join(","), ...rows].join("\r\n") + "\r\n";
}

/** RFC 4180 parser (quoted fields, escaped quotes, CRLF/LF, optional BOM, auto-detects ; as delimiter). */
export function parseCsvRows(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delim = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"' && src[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

export function fromCsv(text: string): { records: CardRecord[]; errors: string[] } {
  const rows = parseCsvRows(text);
  const errors: string[] = [];
  if (!rows.length) return { records: [], errors: ["Empty file"] };
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[\s_-]/g, ""));
  const idx = (name: string) => header.indexOf(name.toLowerCase());
  const col = { english: idx("english"), french: idx("french") };
  if (col.english < 0 || col.french < 0) return { records: [], errors: ['Header must contain at least "English" and "French" columns'] };
  const get = (r: string[], n: string) => (idx(n) >= 0 ? (r[idx(n)] ?? "").trim() : "");
  const records: CardRecord[] = [];
  rows.slice(1).forEach((r, i) => {
    const english = get(r, "English");
    const french = get(r, "French");
    if (!english || !french) { errors.push(`Line ${i + 2}: English and French are required`); return; }
    records.push({
      english, french,
      example: get(r, "Example"), exampleTranslation: get(r, "ExampleTranslation"),
      category: get(r, "Category"), partOfSpeech: get(r, "PartOfSpeech"), level: get(r, "Level"), rank: get(r, "Rank"),
      tags: get(r, "Tags").split(/[;,|]/).map((t) => t.trim()).filter(Boolean).slice(0, 10),
    });
  });
  return { records, errors };
}

const POS_ALIASES: Record<string, PartOfSpeech> = {
  noun: "NOUN", n: "NOUN", verb: "VERB", v: "VERB", adjective: "ADJECTIVE", adj: "ADJECTIVE", adverb: "ADVERB", adv: "ADVERB",
  pronoun: "PRONOUN", preposition: "PREPOSITION", prep: "PREPOSITION", conjunction: "CONJUNCTION", conj: "CONJUNCTION",
  determiner: "DETERMINER", article: "DETERMINER", auxiliary: "AUXILIARY", "auxiliary verb": "AUXILIARY", modal: "MODAL",
  "modal verb": "MODAL", phrasal: "PHRASAL_VERB", "phrasal verb": "PHRASAL_VERB", expression: "EXPRESSION", phrase: "EXPRESSION",
  idiom: "EXPRESSION", interjection: "INTERJECTION",
};

export function parsePos(s: string): PartOfSpeech {
  const key = s.trim().toLowerCase();
  if (POS_ALIASES[key]) return POS_ALIASES[key];
  return key.includes(" ") ? "EXPRESSION" : "NOUN";
}

export function parseLevel(s: string): Level {
  const l = s.trim().toUpperCase();
  return (["A1", "A2", "B1", "B2", "C1", "C2"] as const).find((x) => x === l) ?? "B1";
}

export const posLabel = (p: PartOfSpeech) => POS_LABEL[p];

/** Anki can import this tab-separated text directly (Front, Back, Tags) — see README. */
export function toAnkiTsv(records: CardRecord[]): string {
  const clean = (s: string) => s.replace(/[\t\r\n]+/g, " ");
  return records
    .map((r) => {
      const back = [r.french, r.example && `<i>${r.example}</i>`, r.exampleTranslation].filter(Boolean).join("<br>");
      return [clean(r.english), clean(back), r.tags.concat(r.level ? [r.level] : []).join(" ")].join("\t");
    })
    .join("\n");
}

export const FORMATS = {
  csv: { mime: "text/csv; charset=utf-8", ext: "csv", serialize: toCsv },
  "anki-tsv": { mime: "text/tab-separated-values; charset=utf-8", ext: "txt", serialize: toAnkiTsv },
} as const;
