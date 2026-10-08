import { describe, expect, it } from "vitest";
import { fromCsv, parseCsvRows, parseLevel, parsePos, toAnkiTsv, toCsv, type CardRecord } from "@/lib/exchange";

const rec = (o: Partial<CardRecord> = {}): CardRecord => ({ english: "house", french: "maison", example: "A big house.", exampleTranslation: "Une grande maison.", category: "Noun", partOfSpeech: "Noun", level: "A1", rank: "192", tags: ["home"], ...o });

describe("CSV import/export", () => {
  it("exports the documented header", () => {
    expect(toCsv([]).replace("﻿", "").split("\r\n")[0]).toBe("English,French,Example,ExampleTranslation,Category,PartOfSpeech,Level,Rank,Tags");
  });
  it("round-trips including commas, quotes and newlines", () => {
    const r = rec({ example: 'He said, "hello"\nthen left', french: "a, b" });
    const back = fromCsv(toCsv([r]));
    expect(back.errors).toEqual([]);
    expect(back.records[0]).toEqual(r);
  });
  it("accepts ; delimiter and LF endings", () => {
    const { records } = fromCsv("English;French;Level\nhouse;maison;A1\ncar;voiture;A1\n");
    expect(records.map((r) => r.english)).toEqual(["house", "car"]);
  });
  it("reports invalid rows and missing columns", () => {
    expect(fromCsv("English,French\nhouse,\n,maison\nok,ok").errors).toHaveLength(2);
    expect(fromCsv("Foo,Bar\n1,2").errors[0]).toMatch(/English/);
  });
  it("neutralises spreadsheet formula injection", () => {
    expect(toCsv([rec({ english: "=HYPERLINK(1)" })])).toContain("'=HYPERLINK(1)");
  });
  it("maps POS and level leniently", () => {
    expect(parsePos("Phrasal verb")).toBe("PHRASAL_VERB");
    expect(parsePos("adj")).toBe("ADJECTIVE");
    expect(parsePos("look after")).toBe("EXPRESSION");
    expect(parseLevel("b2")).toBe("B2");
    expect(parseLevel("zz")).toBe("B1");
  });
  it("exports Anki-compatible tab-separated text", () => {
    const line = toAnkiTsv([rec()]);
    expect(line.split("\t")).toHaveLength(3);
    expect(line.startsWith("house\t")).toBe(true);
  });
  it("parseCsvRows skips blank lines", () => {
    expect(parseCsvRows("a,b\n\n\nc,d\n")).toEqual([["a", "b"], ["c", "d"]]);
  });
});
