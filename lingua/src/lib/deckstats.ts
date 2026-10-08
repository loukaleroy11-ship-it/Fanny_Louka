import { db } from "./db";

export interface DeckStats {
  total: number;
  newCards: number;
  due: number;
  mastered: number;
  learned: number;
}

/** Per-deck counters in a single SQL round-trip. */
export async function deckStats(userId: string, dueBefore: Date, deckId?: string): Promise<Map<string, DeckStats>> {
  const rows = await db.$queryRaw<
    { id: string; total: bigint; new_cards: bigint; due: bigint; mastered: bigint; learned: bigint }[]
  >`
    SELECT d.id,
           COUNT(f.id) AS total,
           COUNT(f.id) FILTER (WHERE f.state = 0) AS new_cards,
           COUNT(f.id) FILTER (WHERE f.state <> 0 AND f.due <= ${dueBefore} AND NOT f.suspended) AS due,
           COUNT(f.id) FILTER (WHERE f.state = 2 AND f.stability >= 21) AS mastered,
           COUNT(f.id) FILTER (WHERE f.reps > 0) AS learned
    FROM "Deck" d
    LEFT JOIN "DeckCard" dc ON dc."deckId" = d.id
    LEFT JOIN "Flashcard" f ON f.id = dc."flashcardId"
    WHERE d."userId" = ${userId}
    GROUP BY d.id`;
  const m = new Map<string, DeckStats>();
  for (const r of rows) {
    if (deckId && r.id !== deckId) continue;
    m.set(r.id, { total: Number(r.total), newCards: Number(r.new_cards), due: Number(r.due), mastered: Number(r.mastered), learned: Number(r.learned) });
  }
  return m;
}
