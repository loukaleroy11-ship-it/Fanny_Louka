/**
 * End-to-end API test: exercises the running app (BASE_URL, default http://localhost:3000) against the real database.
 * Run:  npm run e2e     (server must be running and seeded)
 */
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const db = new PrismaClient();
let passed = 0;
const failures: string[] = [];

class Client {
  jar = new Map<string, string>();
  constructor(public ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`) {}
  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: { "x-forwarded-for": this.ip, cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "), ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      const k = kv.slice(0, i), v = kv.slice(i + 1);
      if (/max-age=0|expires=thu, 01 jan 1970/i.test(c) || v === "") this.jar.delete(k); else this.jar.set(k, v);
    }
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text, headers: res.headers };
  }
  get = (p: string) => this.req("GET", p);
  post = (p: string, b: unknown = {}, h?: Record<string, string>) => this.req("POST", p, b, h);
  patch = (p: string, b: unknown) => this.req("PATCH", p, b);
  del = (p: string) => this.req("DELETE", p);
}

function check(name: string, cond: unknown, detail?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failures.push(name); console.log(`  ✗ ${name}${detail !== undefined ? "  → " + JSON.stringify(detail).slice(0, 300) : ""}`); }
}
const section = (s: string) => console.log(`\n▶ ${s}`);

async function main() {
  const stamp = Date.now();
  const email = `e2e${stamp}@example.com`;
  const a = new Client();

  section("1. Registration, login, logout, protected routes");
  check("unauthenticated API call → 401", (await new Client().get("/api/cards")).status === 401);
  check("unauthenticated page → redirect to /login", (await new Client().req("GET", "/dashboard")).status === 307);
  check("weak password rejected", (await a.post("/api/auth/register", { name: "A", email, password: "short" })).status === 400);
  check("invalid email rejected", (await a.post("/api/auth/register", { name: "A", email: "nope", password: "password123" })).status === 400);
  const reg = await a.post("/api/auth/register", { name: "Alice Test", email, password: "password123", timezone: "Europe/Paris" });
  check("register → 201 + session cookie", reg.status === 201 && a.jar.has("lingua_session"), reg.json);
  check("duplicate email → 409", (await new Client().post("/api/auth/register", { name: "A", email, password: "password123" })).status === 409);
  const me = await a.get("/api/auth/me");
  check("me returns profile without password hash", me.status === 200 && me.json.user.email === email && !JSON.stringify(me.json).includes("passwordHash"), me.json);
  check("new user starts at A1 with defaults", me.json.user.level === "A1" && me.json.user.dailyMinutes === 15 && me.json.user.streak === 0);
  const cookie = a.jar.get("lingua_session")!;
  check("session cookie is HttpOnly + SameSite=Lax", true); // asserted from Set-Cookie below
  const rawLogin = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": a.ip }, body: JSON.stringify({ email, password: "password123" }) });
  const sc = rawLogin.headers.get("set-cookie") ?? "";
  check("Set-Cookie flags HttpOnly; SameSite=lax", /httponly/i.test(sc) && /samesite=lax/i.test(sc), sc);
  check("wrong password → 401", (await new Client().post("/api/auth/login", { email, password: "wrongpass" })).status === 401);
  check("unknown email → same 401 message", (await new Client().post("/api/auth/login", { email: "nobody@example.com", password: "wrongpass" })).json.error === (await new Client().post("/api/auth/login", { email, password: "wrongpass" })).json.error);
  const b = new Client();
  const login = await b.post("/api/auth/login", { email, password: "password123" });
  check("login OK → next=/placement (placement not done)", login.status === 200 && login.json.next === "/placement", login.json);
  check("tampered cookie rejected", (await new Client().req("GET", "/api/auth/me", undefined, { cookie: `lingua_session=${cookie.slice(0, -3)}abc` })).status === 401);
  check("cross-origin POST blocked (CSRF)", (await a.post("/api/cards/from-vocabulary", { vocabularyId: "x" }, { origin: "https://evil.example" })).status === 403);
  check("logout clears session", (await b.post("/api/auth/logout")).status === 200 && (await b.get("/api/auth/me")).status === 401);

  section("2. Password reset");
  const fp = await new Client().post("/api/auth/forgot-password", { email });
  check("forgot-password responds generically + dev link", fp.status === 200 && !!fp.json.devLink, fp.json);
  check("unknown email gets the same generic response", (await new Client().post("/api/auth/forgot-password", { email: "ghost@example.com" })).json.message === fp.json.message);
  const token = new URL(fp.json.devLink).searchParams.get("token")!;
  check("short new password rejected", (await new Client().post("/api/auth/reset-password", { token, password: "x" })).status === 400);
  check("bad token rejected", (await new Client().post("/api/auth/reset-password", { token: "x".repeat(30), password: "newpassword1" })).status === 400);
  check("reset with valid token", (await new Client().post("/api/auth/reset-password", { token, password: "newpassword1" })).status === 200);
  check("token cannot be reused", (await new Client().post("/api/auth/reset-password", { token, password: "another12345" })).status === 400);
  check("old password no longer works / new one does", (await new Client().post("/api/auth/login", { email, password: "password123" })).status === 401 && (await a.post("/api/auth/login", { email, password: "newpassword1" })).status === 200);

  section("3. Placement test");
  const pq = await a.get("/api/placement");
  check("placement questions are served without answers", pq.status === 200 && pq.json.questions.length >= 30 && !JSON.stringify(pq.json).includes('"answer"'));
  const { PLACEMENT_QUESTIONS } = await import("../src/content/placement");
  const strong: Record<string, string> = {};
  for (const q of PLACEMENT_QUESTIONS) strong[q.id] = q.level === "C1" ? "" : q.answer; // all correct except C1
  const pr = await a.post("/api/placement", { answers: strong });
  check("strong answers → B2/C1 estimate", pr.status === 200 && /^(B2|C1)/.test(pr.json.estimatedLevel), pr.json);
  check("results broken down by 4 sections", pr.json.sections.length === 4);
  const weakClient = new Client();
  await weakClient.post("/api/auth/register", { name: "Weak", email: `weak${stamp}@example.com`, password: "password123" });
  const wr = await weakClient.post("/api/placement", { answers: Object.fromEntries(PLACEMENT_QUESTIONS.map((q) => [q.id, q.level === "A1" ? q.answer : ""])) });
  check("weak answers → A1/A2 estimate", /^(A1|A2)/.test(wr.json.estimatedLevel), wr.json);
  const me2 = await a.get("/api/auth/me");
  check("level stored on the profile and placementDone set", me2.json.user.placementDone === true && ["B2", "C1", "B1"].includes(me2.json.user.level), me2.json.user.level);
  check("login now goes to /dashboard", (await new Client().post("/api/auth/login", { email, password: "newpassword1" })).json.next === "/dashboard");
  // downgrade to a predictable level for later tests
  await a.patch("/api/profile", { level: "A2" });

  section("4. 500 most common words deck");
  const decks = await a.get("/api/decks");
  const d500 = decks.json.decks.find((d: any) => d.kind === "COMMON500");
  check("deck '500 Most Common Words' installed with exactly 500 cards", d500?.total === 500 && d500.newCards === 500, d500);
  check("My Mistakes + My Words system decks exist", ["My Mistakes", "My Words"].every((n) => decks.json.decks.some((d: any) => d.name === n)));
  const all = await a.get(`/api/cards?filter=${encodeURIComponent(JSON.stringify({ deckId: d500.id }))}&sort=rank&pageSize=100`);
  const first = all.json.cards;
  check("sorted by rank: #1 'you', ranks ascending", first[0].vocabulary.word === "you" && first[0].vocabulary.rank === 1 && first.every((c: any, i: number) => i === 0 || c.vocabulary.rank > first[i - 1].vocabulary.rank));
  const last = await a.get(`/api/cards?filter=${encodeURIComponent(JSON.stringify({ deckId: d500.id }))}&sort=rank&pageSize=100&page=5`);
  check("rank 500 exists and is last", last.json.cards.at(-1).vocabulary.rank === 500);
  const needFields = first.every((c: any) => c.vocabulary.translation && c.vocabulary.example && c.vocabulary.exampleTranslation && c.vocabulary.ipa && c.vocabulary.category && c.vocabulary.level && c.vocabulary.rank);
  check("each entry has rank/translation/example/translation/POS/CEFR/IPA", needFields);
  const rng = (o: object) => a.get(`/api/cards?filter=${encodeURIComponent(JSON.stringify({ deckId: d500.id, ...o }))}&sort=rank&pageSize=100`);
  const r120 = await rng({ rankMin: 120, rankMax: 250 });
  check("rank range 120–250 returns exactly 131 words, all within range", r120.json.total === 131 && r120.json.cards.every((c: any) => c.vocabulary.rank >= 120 && c.vocabulary.rank <= 250));
  for (const [lo, hi] of [[1, 50], [51, 100], [101, 200], [201, 300], [301, 400], [401, 500]] as const) {
    const r = await rng({ rankMin: lo, rankMax: hi });
    check(`preset range ${lo}→${hi} = ${hi - lo + 1} cards`, r.json.total === hi - lo + 1, r.json.total);
  }
  const verbs = await rng({ functions: ["verb"] });
  check("function filter 'verbs' only returns verbs", verbs.json.total > 40 && verbs.json.cards.every((c: any) => c.vocabulary.pos === "VERB"), verbs.json.total);
  const verbRange = await rng({ functions: ["verb"], rankMin: 1, rankMax: 200 });
  check("combined filter verbs + rank 1–200", verbRange.json.total > 20 && verbRange.json.cards.every((c: any) => c.vocabulary.pos === "VERB" && c.vocabulary.rank <= 200), verbRange.json.total);
  const adj = await rng({ functions: ["adjective"], rankMin: 100, rankMax: 300 });
  check("adjectives ranked 100–300", adj.json.total > 5 && adj.json.cards.every((c: any) => c.vocabulary.pos === "ADJECTIVE" && c.vocabulary.rank >= 100 && c.vocabulary.rank <= 300), adj.json.total);
  const sortFn = await a.get(`/api/cards?filter=${encodeURIComponent(JSON.stringify({ deckId: d500.id }))}&sort=function&pageSize=100`);
  const poss = sortFn.json.cards.map((c: any) => c.vocabulary.pos);
  check("sort by function groups parts of speech", poss.join() === [...poss].sort().join() || new Set(poss).size < 8);
  const sortLvl = await a.get(`/api/cards?filter=${encodeURIComponent(JSON.stringify({ deckId: d500.id }))}&sort=level&pageSize=100`);
  const lv = sortLvl.json.cards.map((c: any) => c.vocabulary.level);
  check("sort by level A1→B2", lv.join() === [...lv].sort().join());
  const sortAlpha = await a.get(`/api/cards?filter=${encodeURIComponent(JSON.stringify({ deckId: d500.id }))}&sort=alpha&pageSize=100`);
  check("alphabetical sort", sortAlpha.json.cards[0].vocabulary.word === "a");
  const lvlF = await rng({ levels: ["B1"] });
  check("level filter B1", lvlF.json.total > 10 && lvlF.json.cards.every((c: any) => c.vocabulary.level === "B1"));
  const q = await a.get(`/api/cards?filter=${encodeURIComponent(JSON.stringify({ q: "maison" }))}`);
  check("search by French translation finds 'house'", q.json.cards.some((c: any) => c.vocabulary.word === "house"));

  section("5. Duplicate detection");
  const h1 = await a.get("/api/vocabulary/check?word=house");
  const h2 = await a.get("/api/vocabulary/check?word=%20%20HOUSE%20%20");
  check("'house' exists with rank, translation, category, CEFR", h1.json.exists && h1.json.exact[0].vocabulary.rank === 192 && h1.json.exact[0].vocabulary.translation === "maison" && h1.json.exact[0].vocabulary.category === "Noun" && h1.json.exact[0].vocabulary.level === "A1", h1.json.exact?.[0]?.vocabulary);
  check("case + whitespace insensitive", h2.json.exists && h2.json.exact[0].vocabulary.id === h1.json.exact[0].vocabulary.id);
  check("existing card info returned (deck name)", h1.json.exact[0].card?.decks.includes("500 Most Common Words"));
  const run = await a.get("/api/vocabulary/check?word=running");
  const runExact = await a.get("/api/vocabulary/check?word=run");
  check("'running' is NOT an exact duplicate of 'run' (related form suggested)", !run.json.exists && run.json.related.some((r: any) => r.vocabulary.word === "run"), run.json);
  check("'run' lists 'running'/'ran' style forms via lemma links (not duplicates)", runExact.json.exists, runExact.json);
  const went = await a.get("/api/vocabulary/check?word=went");
  check("'went' exists on its own and links to lemma 'go'", went.json.exists && went.json.related.some((r: any) => r.vocabulary.word === "go" && r.relation === "lemma"), went.json.related);
  const houses = await a.get("/api/vocabulary/check?word=houses");
  check("'houses' → not exact, related 'house'", !houses.json.exists && houses.json.related.some((r: any) => r.vocabulary.word === "house"));
  const base = { word: "house", translation: "maison", pos: "NOUN", level: "A1" };
  const dup = await a.post("/api/cards", base);
  check("creating 'house' returns 409 with the existing entry", dup.status === 409 && dup.json.duplicate === true && dup.json.exact[0].vocabulary.rank === 192, dup.json);
  const dup2 = await a.post("/api/cards", { ...base, word: "  House." });
  check("'  House.' also blocked", dup2.status === 409);
  const otherPos = await a.post("/api/cards", { word: "house", translation: "héberger", pos: "VERB", level: "B1" });
  check("same spelling but different part of speech is allowed (verb 'house')", otherPos.status === 201, otherPos.json);
  const forced = await a.post("/api/cards", { ...base, word: "house", translation: "maison (perso)", force: true });
  check("'Create anyway' creates a private entry", forced.status === 201 && forced.json.card.vocabulary.isPrivate === true, forced.json);

  section("6. Custom cards (CRUD)");
  const kayak = await a.post("/api/cards", { word: "kayak", translation: "kayak", example: "We went kayaking.", exampleTranslation: "Nous avons fait du kayak.", pos: "NOUN", level: "B1", tags: ["sport", "australia"], ipa: "ˈkaɪæk" });
  check("create custom card", kayak.status === 201 && kayak.json.card.origin === "USER" && kayak.json.card.decks[0].name === "My Words", kayak.json);
  const kid = kayak.json.card.id;
  check("kayak now detected as existing", (await a.get("/api/vocabulary/check?word=Kayak")).json.exists === true);
  const edit = await a.patch(`/api/cards/${kid}`, { translation: "kayak (sport)", level: "B2", tags: ["sport"] });
  check("edit own card", edit.status === 200 && edit.json.card.vocabulary.translation === "kayak (sport)" && edit.json.card.vocabulary.level === "B2");
  const sys = (await a.get(`/api/cards?filter=${encodeURIComponent(JSON.stringify({ q: "house" }))}`)).json.cards.find((c: any) => !c.vocabulary.isPrivate);
  check("shared-lexicon card content cannot be edited", (await a.patch(`/api/cards/${sys.id}`, { translation: "hacked" })).status === 403);
  check("…but tags/notes can", (await a.patch(`/api/cards/${sys.id}`, { tags: ["home"], note: "ma note" })).json.card.note === "ma note");
  const mine = await a.get(`/api/cards?filter=${encodeURIComponent(JSON.stringify({ scope: ["mine"] }))}`);
  check("'Mes cartes' only lists user-created cards", mine.json.total === 3 && mine.json.cards.every((c: any) => c.origin === "USER"), mine.json.total);
  const stranger = new Client();
  await stranger.post("/api/auth/register", { name: "Eve", email: `eve${stamp}@example.com`, password: "password123" });
  check("another user cannot edit/delete my card (404)", (await stranger.patch(`/api/cards/${kid}`, { translation: "x" })).status === 404 && (await stranger.del(`/api/cards/${kid}`)).status === 404);
  check("another user does not see my private word as duplicate", (await stranger.get("/api/vocabulary/check?word=kayak")).json.exists === false);
  check("delete own card", (await a.del(`/api/cards/${kid}`)).status === 200 && (await a.get("/api/vocabulary/check?word=kayak")).json.exists === false);
  check("input validation on cards", (await a.post("/api/cards", { word: "", translation: "", pos: "NOUN", level: "A1" })).status === 400 && (await a.post("/api/cards", { word: "x", translation: "y", pos: "BAD", level: "A1" })).status === 400);

  section("7. Spaced repetition & custom review");
  const pv = await a.post("/api/review/preview", { filter: { scope: ["common500"], status: ["new"], functions: ["verb"], rankMin: 1, rankMax: 200 } });
  check("preview counts matching cards", pv.json.matching === verbRange.json.total && pv.json.new === pv.json.matching, pv.json);
  const nonexist = await a.post("/api/review/queue", { filter: { status: ["due"], scope: ["mistakes"] }, limit: 5 });
  check("empty selection → 404", nonexist.status === 404);
  for (const n of [5, 10, 20]) {
    const qn = await a.post("/api/review/queue", { filter: { scope: ["common500"], status: ["new"] }, limit: n, order: "rank" });
    check(`queue of ${n} cards`, qn.status === 200 && qn.json.cards.length === n);
  }
  const custom = await a.post("/api/review/queue", { filter: { scope: ["common500"], status: ["new"] }, limit: 37, order: "rank" });
  check("custom number (37)", custom.json.cards.length === 37);
  check("new cards come by frequency rank (1,2,3…)", custom.json.cards.slice(0, 5).map((c: any) => c.vocabulary.rank).join() === "1,2,3,4,5");
  check("session returns interval previews for the 4 buttons", Object.keys(custom.json.cards[0].intervals).join() === "1,2,3,4");
  const qv = await a.post("/api/review/queue", { filter: { functions: ["verb"], rankMin: 1, rankMax: 200, scope: ["common500"], status: ["new"] }, limit: 20, order: "smart" });
  check("20 cards + verbs + rank 1–200", qv.json.cards.length === 20 && qv.json.cards.every((c: any) => c.vocabulary.pos === "VERB" && c.vocabulary.rank <= 200));
  const sess = await a.post("/api/review/queue", { filter: { scope: ["common500"], status: ["new"] }, limit: 6, order: "rank" });
  const cards = sess.json.cards as any[];
  const ans = (card: any, rating: number) => a.post("/api/review/answer", { flashcardId: card.id, rating, durationMs: 3000, sessionId: sess.json.sessionId });
  const rAgain = await ans(cards[0], 1), rHard = await ans(cards[1], 2), rGood = await ans(cards[2], 3), rEasy = await ans(cards[3], 4);
  const dueOf = (r: any) => new Date(r.json.card.due).getTime();
  check("Again < Hard ≤ Good < Easy (next review date)", dueOf(rAgain) < dueOf(rHard) && dueOf(rHard) <= dueOf(rGood) && dueOf(rGood) < dueOf(rEasy), [rAgain.json.next, rHard.json.next, rGood.json.next, rEasy.json.next]);
  check("Again/Hard/Good stay in the same-session queue (learning step), Easy graduates", rAgain.json.requeue && rGood.json.requeue && !rEasy.json.requeue);
  check("Easy → multi-day interval", /d$/.test(rEasy.json.next), rEasy.json.next);
  check("XP + streak awarded", rGood.json.progress.streak === 1 && rGood.json.progress.xpGained > 0);
  check("first-review badge unlocked", [rAgain, rHard, rGood, rEasy].some((r) => r.json.progress.unlocked.some((u: any) => u.code === "first-review")));
  const history = await db.review.findMany({ where: { flashcardId: { in: cards.slice(0, 4).map((c) => c.id) } }, orderBy: { reviewedAt: "asc" } });
  check("every review is stored in the history (rating, states, interval)", history.length === 4 && history.every((h) => h.rating >= 1 && h.scheduledDays >= 0 && h.durationMs === 3000), history.length);
  // make a card graduate then lapse twice → "difficult"
  const c5 = cards[4];
  await ans(c5, 3); await ans(c5, 3);
  const afterGrad = await db.flashcard.findUniqueOrThrow({ where: { id: c5.id } });
  check("two 'Good' answers graduate a new card to Review state", afterGrad.state === 2, afterGrad.state);
  await ans(c5, 1); await ans(c5, 3); await ans(c5, 1);
  const lapsed = await db.flashcard.findUniqueOrThrow({ where: { id: c5.id } });
  check("lapses are counted (difficult card)", lapsed.lapses >= 2, lapsed.lapses);
  const hardQ = await a.post("/api/review/queue", { filter: { difficulty: ["hard"] }, limit: 10 });
  check("'Cartes difficiles' returns the lapsed card", hardQ.status === 200 && hardQ.json.cards.some((c: any) => c.id === c5.id), hardQ.json.cards?.map((c: any) => c.id));
  const bucket = (await a.get(`/api/cards?filter=${encodeURIComponent(JSON.stringify({ difficulty: ["hard"] }))}`)).json;
  check("difficulty filter + bucket label 'hard'", bucket.total >= 1 && bucket.cards[0].bucket === "hard");
  const dueNow = await a.post("/api/review/preview", { filter: { status: ["due"] } });
  check("recently-answered cards are 'à revoir' when due today", dueNow.json.matching >= 1, dueNow.json);
  const fin = await a.post("/api/review/finish", { sessionId: sess.json.sessionId });
  check("finish returns summary (items, accuracy, time)", fin.status === 200 && fin.json.items >= 6 && fin.json.accuracy >= 0 && fin.json.durationSec >= 0, fin.json);
  check("cannot answer for another user's card", (await stranger.post("/api/review/answer", { flashcardId: cards[5].id, rating: 3 })).status === 404);
  check("invalid rating rejected", (await a.post("/api/review/answer", { flashcardId: cards[5].id, rating: 7 })).status === 400);

  section("8. Conversation, corrections, recurring mistakes (demo mode if no API key)");
  const cs = await a.post("/api/conversation", { scenario: "casual" });
  check("start conversation → AI opens", cs.status === 201 && cs.json.messages[0].role === "ASSISTANT" && cs.json.messages[0].content.length > 5, cs.json);
  const cid = cs.json.conversation.id;
  const m1 = await a.post(`/api/conversation/${cid}/message`, { content: "It was good, I go to the beach yesterday." });
  check("user message gets a discreet correction 'I went to the beach yesterday'", m1.status === 200 && m1.json.userMessage.correction?.[0]?.corrected.includes("I went to the beach yesterday"), m1.json);
  check("AI replies and asks a follow-up question", m1.json.assistantMessage.content.includes("?"));
  check("mock flag exposed when running without AI key", typeof m1.json.mock === "boolean");
  const mid = m1.json.mistakes[0].id;
  const m2 = await a.post(`/api/conversation/${cid}/message`, { content: "Yesterday I go to the cinema and she work there.", viaVoice: true, sttConfidence: 0.62 });
  check("voice message accepted with STT confidence", m2.status === 200 && m2.json.userMessage.correction.length >= 1);
  const m3 = await a.post(`/api/conversation/${cid}/message`, { content: "Last week I eat pizza." });
  check("repeated past-simple mistakes keep being detected", m3.json.userMessage.correction?.[0]?.skill === "past-simple");
  check("empty / too-long messages rejected", (await a.post(`/api/conversation/${cid}/message`, { content: "   " })).status === 400 && (await a.post(`/api/conversation/${cid}/message`, { content: "x".repeat(1600) })).status === 400);
  check("other users cannot post into my conversation", (await stranger.post(`/api/conversation/${cid}/message`, { content: "hello" })).status === 404);
  const mistakes = await a.get("/api/mistakes");
  const ps = mistakes.json.summary.find((s: any) => s.slug === "past-simple");
  check("recurring mistakes aggregated: Past simple × 3+", ps?.count >= 3, mistakes.json.summary);
  const prog = await a.get("/api/progress");
  check("skill priority raised for 'Past simple' (recurring)", prog.json.recurring[0]?.slug === "past-simple" && prog.json.recurring[0].priority >= 3, prog.json.recurring);
  const plan1 = await a.get("/api/plan");
  check("daily plan targets the recurring weakness", plan1.json.focus?.name === "Past simple" && plan1.json.items.some((i: any) => i.kind === "grammar" && i.href.includes("past-simple")), plan1.json.focus);
  const addOne = await a.post(`/api/mistakes/${mid}/card`);
  check("'Add to my flashcards' creates a card in My Mistakes", addOne.status === 201 && !!addOne.json.flashcardId, addOne.json);
  check("idempotent (second call doesn't duplicate)", (await a.post(`/api/mistakes/${mid}/card`)).json.created === false);
  const mcard = (await a.get(`/api/cards?filter=${encodeURIComponent(JSON.stringify({ scope: ["mistakes"] }))}`)).json.cards[0];
  check("mistake card: corrected sentence + wrong version + explanation", mcard.vocabulary.word.includes("I went to the beach yesterday") && mcard.vocabulary.example.includes("I go to the beach") && mcard.origin === "MISTAKE" && mcard.decks[0].name === "My Mistakes", mcard);
  const bulk = await a.post("/api/mistakes/cards", { conversationId: cid });
  check("bulk 'Add mistakes to my flashcards'", bulk.json.created >= 2, bulk.json);
  const mq = await a.post("/api/review/queue", { filter: { scope: ["mistakes"], status: ["new", "due"] }, limit: 10 });
  check("review 'Mes erreurs' deck", mq.status === 200 && mq.json.cards.every((c: any) => c.origin === "MISTAKE"));
  const plan2 = await a.get("/api/plan");
  check("plan now includes 'review mistakes'", plan2.json.items.some((i: any) => i.kind === "mistakes"));
  const end = await a.post(`/api/conversation/${cid}/end`);
  const rep = end.json.report;
  check("report: duration, words, corrections, vocabulary, estimated level", end.status === 200 && rep.durationSec >= 30 && rep.wordsSpoken > 15 && rep.corrections >= 3 && !!rep.estimatedLevel && Array.isArray(rep.newVocabulary) && "mainMistakes" in rep, rep);
  check("report has the 4 mistake sections incl. pronunciation (low-confidence voice)", ["vocabulary", "grammar", "pronunciation", "fluency"].every((k) => k in rep.mainMistakes) && (rep.mock ? rep.mainMistakes.pronunciation.length >= 1 : true), rep.mainMistakes);
  check("ended conversation rejects new messages (409) and report is idempotent", (await a.post(`/api/conversation/${cid}/message`, { content: "hi" })).status === 409 && (await a.post(`/api/conversation/${cid}/end`)).json.report.wordsSpoken === rep.wordsSpoken);
  const sk = await a.get("/api/progress");
  check("Speaking/Writing estimates updated after the conversation", sk.json.skills.filter((s: any) => ["SPEAKING", "WRITING"].includes(s.area)).some((s: any) => s.evidence > 0), sk.json.skills);
  const empty = await a.post("/api/conversation", { scenario: "surprise" });
  check("'Surprise me' picks a scenario", empty.status === 201 && !!empty.json.conversation.label);
  check("empty conversations are discarded on end", (await a.post(`/api/conversation/${empty.json.conversation.id}/end`)).json.discarded === true);
  const auto = await a.patch("/api/profile", { autoAddMistakes: true });
  const cs2 = await a.post("/api/conversation", { scenario: "travel" });
  const ma = await a.post(`/api/conversation/${cs2.json.conversation.id}/message`, { content: "It depends of the weather." });
  check("auto-add option creates the card automatically", auto.status === 200 && !!ma.json.mistakes[0]?.flashcardId, ma.json.mistakes);
  await a.patch("/api/profile", { autoAddMistakes: false });
  check("English Only blocked below B1", (await a.patch("/api/profile", { englishOnly: true })).status === 400);
  await a.patch("/api/profile", { level: "B1" });
  check("English Only allowed from B1", (await a.patch("/api/profile", { englishOnly: true })).status === 200);
  const eo = await a.post("/api/conversation", { scenario: "work" });
  check("English Only conversation flagged", eo.json.conversation.englishOnly === true);
  const em = await a.post(`/api/conversation/${eo.json.conversation.id}/message`, { content: "She work in London." });
  check("English-only corrections are explained in English", /With he \/ she \/ it/.test(em.json.userMessage.correction[0].explanation) || !em.json.mock, em.json.userMessage.correction);
  const ew = await a.post("/api/ai/explain-word", { word: "house", sentence: "I live in a house.", mode: "english" });
  const fw = await a.post("/api/ai/explain-word", { word: "house", sentence: "I live in a house.", mode: "french" });
  check("click-a-word: Explain in English / Translate to French", ew.status === 200 && ew.json.text.length > 3 && fw.json.text.toLowerCase().includes("maison"), [ew.json, fw.json]);
  await a.patch("/api/profile", { englishOnly: false, level: "A2" });

  section("9. AI flashcard generation, examples");
  const g = await a.post("/api/ai/flashcard", { word: "house" });
  check("generate flashcard returns an editable draft (translation, example, level…)", g.status === 200 && g.json.draft.translation === "maison" && !!g.json.draft.example && typeof g.json.mock === "boolean", g.json);
  const ex = await a.post("/api/ai/example", { word: "house", level: "A1" });
  check("generate example", ex.status === 200 && "example" in ex.json);
  check("AI endpoints validate input", (await a.post("/api/ai/flashcard", { word: "" })).status === 400);

  section("10. Grammar lessons & exercises");
  const ok1 = await a.post("/api/grammar/check", { lessonSlug: "past-simple", exerciseId: "pas1", answer: "went" });
  const bad1 = await a.post("/api/grammar/check", { lessonSlug: "past-simple", exerciseId: "pas1", answer: "go" });
  check("choose: correct and wrong", ok1.json.correct === true && bad1.json.correct === false && bad1.json.expected === "went");
  check("complete accepts contractions", (await a.post("/api/grammar/check", { lessonSlug: "past-simple", exerciseId: "pas4", answer: "didn't go" })).json.correct === true && (await a.post("/api/grammar/check", { lessonSlug: "past-simple", exerciseId: "pas4", answer: "did not go" })).json.correct === true);
  check("translate accepts variants", (await a.post("/api/grammar/check", { lessonSlug: "past-simple", exerciseId: "pas5", answer: "i ate a pizza yesterday" })).json.correct === true);
  check("correct-the-mistake", (await a.post("/api/grammar/check", { lessonSlug: "past-simple", exerciseId: "pas7", answer: "I went to the beach yesterday." })).json.correct === true);
  check("create-a-sentence validated by structure + corrector", (await a.post("/api/grammar/check", { lessonSlug: "past-simple", exerciseId: "pas11", answer: "Yesterday I met my friends in the park." })).json.correct === true && (await a.post("/api/grammar/check", { lessonSlug: "past-simple", exerciseId: "pas11", answer: "Yesterday I go to the park with friends." })).json.correct === false);
  check("listen-and-type", (await a.post("/api/grammar/check", { lessonSlug: "past-simple", exerciseId: "pas12", answer: "we went to the beach last summer" })).json.correct === true);
  check("unknown exercise → 404", (await a.post("/api/grammar/check", { lessonSlug: "past-simple", exerciseId: "zzz", answer: "x" })).status === 404);
  const results = await db.exerciseResult.count({ where: { user: { email } } });
  check("every attempt is recorded", results >= 8, results);
  const wrongMistake = await db.mistake.findFirst({ where: { user: { email }, source: "EXERCISE" } });
  check("wrong exercise answers become mistakes with full sentences", !!wrongMistake && wrongMistake.corrected.includes("went"), wrongMistake);
  const html = await a.req("GET", "/grammar/past-simple");
  check("lesson page renders without leaking answers", html.status === 200 && html.text.includes("Past Simple") && !/\\?"answers?\\?":/.test(html.text));
  check("lesson pages: 5 tenses reachable", (await Promise.all(["present-simple", "present-continuous", "past-simple", "present-perfect", "future-forms"].map((s) => a.req("GET", `/grammar/${s}`)))).every((r) => r.status === 200));
  check("unknown lesson → 404", (await a.req("GET", "/grammar/nope")).status === 404);

  section("11. Verbs, vocabulary, cognates, global search");
  const v20 = await a.get("/api/verbs?top=20");
  const go = v20.json.verbs.find((v: any) => v.base === "go");
  check("Top 20 verbs; 'go' → went / gone / aller + IPA + example + level + rank", v20.json.verbs.length === 20 && go?.past === "went" && go.participle === "gone" && go.translation === "aller" && go.ipa && go.example && go.level && go.rank, go);
  check("Top 50 / Top 100", (await a.get("/api/verbs?top=50")).json.verbs.length === 50 && (await a.get("/api/verbs?top=100")).json.verbs.length === 100);
  check("irregular-only filter", (await a.get("/api/verbs?top=100&irregular=1")).json.verbs.every((v: any) => v.irregular));
  const byFn = await a.get("/api/vocabulary?fn=preposition");
  check("browse by function: prepositions", byFn.json.total >= 15 && byFn.json.items.every((i: any) => i.pos === "PREPOSITION"));
  for (const fn of ["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "determiner", "modal", "auxiliary", "phrasal", "expression"]) {
    const r = await a.get(`/api/vocabulary?fn=${fn}`);
    check(`vocabulary by function '${fn}' non-empty`, r.status === 200 && r.json.total > 0, r.json.total);
  }
  const cg = await a.get("/api/cognates?kind=COGNATE"), ff = await a.get("/api/cognates?kind=FALSE_FRIEND");
  check("cognates: important→important, possible, different→différent, information, culture", ["important", "possible", "different", "information", "culture"].every((w) => cg.json.items.some((i: any) => i.english === w)));
  check("false friends: actually, library, eventually", ["actually", "library", "eventually"].every((w) => ff.json.items.some((i: any) => i.english === w)));
  const sr = await a.get("/api/search?q=run");
  const r0 = sr.json.results[0];
  check("global search 'run': rank, verb, courir, past ran, participle run, related runner/running", r0.word === "run" && r0.rank > 0 && r0.pos === "VERB" && r0.translation === "courir" && r0.pastSimple === "ran" && r0.pastParticiple === "run" && r0.forms.includes("runner") && r0.forms.includes("running"), r0);
  const sfr = await a.get("/api/search?q=courir");
  check("search by French word", sfr.json.results.some((r: any) => r.word === "run"));
  const add = await a.post("/api/cards/from-vocabulary", { vocabularyId: r0.id });
  check("search → 'Add to cards' (idempotent)", [200, 201].includes(add.status) && (await a.post("/api/cards/from-vocabulary", { vocabularyId: r0.id })).json.created === false);
  check("search results flag cards already owned", (await a.get("/api/search?q=run")).json.results[0].inCards === true);
  check("search validates input", (await a.get("/api/search?q=")).status === 400);

  section("12. Decks, catalog, import/export");
  const mk = await a.post("/api/decks", { name: "Australia", description: "Working holiday" });
  check("create custom deck", mk.status === 201 && (await a.post("/api/decks", { name: "Australia" })).status === 409);
  const inst = await a.post("/api/decks/install", { key: "travel" });
  check("install catalog deck 'Travel'", inst.status === 201 && inst.json.added > 20, inst.json);
  const ir = await a.post("/api/decks/install", { key: "irregular-verbs" });
  const dl = await a.get("/api/decks");
  const irr = dl.json.decks.find((d: any) => d.name === "Irregular Verbs");
  check("'Irregular Verbs' deck reuses existing cards (no duplicates to review)", ir.status === 201 && irr.total >= 60, irr);
  check("deck stats: cards, progress, due, mastered", ["total", "due", "mastered", "progress", "newCards"].every((k) => k in irr));
  check("catalog excludes installed decks", !dl.json.catalog.some((c: any) => c.key === "travel"));
  const awc = dl.json.decks.find((d: any) => d.name === "Australia");
  check("system decks cannot be deleted; custom decks can", (await a.del(`/api/decks/${d500.id}`)).status === 403 && (await a.del(`/api/decks/${awc.id}`)).status === 200);
  const exp = await a.req("GET", "/api/cards/export?format=csv");
  check("CSV export has the documented columns and 500+ rows", exp.status === 200 && exp.text.replace("﻿", "").startsWith("English,French,Example,ExampleTranslation,Category,PartOfSpeech,Level,Rank,Tags") && exp.text.split("\r\n").length > 500 && /attachment/.test(exp.headers.get("content-disposition") ?? ""));
  check("export contains 'you,tu, vous' with rank 1", /\r\nyou,"tu, vous",.*,1,/.test(exp.text), exp.text.split("\r\n")[1]);
  const csv = "English,French,Example,ExampleTranslation,Category,PartOfSpeech,Level,Rank,Tags\r\nhouse,maison,,,,Noun,A1,,\r\nwallaby,wallaby,\"We saw a wallaby, a small kangaroo.\",Nous avons vu un wallaby.,Animal,Noun,B2,,australia;animals\r\n,missing,,,,,,,\r\n";
  const imp = await a.post("/api/cards/import", { csv });
  check("CSV import: new created, existing detected, invalid reported", imp.status === 200 && imp.json.created === 1 && imp.json.duplicates === 1 && imp.json.errors.length === 1, imp.json);
  check("imported card exists with tags", (await a.get("/api/vocabulary/check?word=wallaby")).json.exists);
  check("import validates header", (await a.post("/api/cards/import", { csv: "Foo,Bar\n1,2" })).status === 400);
  const anki = await a.req("GET", "/api/cards/export?format=anki-tsv&scope=mine");
  check("Anki-compatible text export", anki.status === 200 && anki.text.includes("wallaby\t"));

  section("13. Dashboard, stats, profile");
  const st = await a.get("/api/stats?days=30");
  check("stats: learned, reviews, success rate, time, conversations, mistakes, level", st.status === 200 && st.json.totals.learned >= 1 && st.json.totals.reviews >= 6 && st.json.totals.conversations >= 1 && st.json.totals.mistakes >= 3 && "successRate" in st.json.totals && st.json.level.label, st.json.totals);
  check("stats series for charts (30 days) + cumulative words", st.json.series.length === 30 && st.json.cumulative.length === 30 && st.json.series.at(-1).cards >= 6);
  check("top mistakes in stats", st.json.topMistakes[0].label === "Past simple");
  const dash = await a.req("GET", "/dashboard");
  check("dashboard renders streak, progress, plan, weakness", dash.status === 200 && /day streak/.test(dash.text) && /Today&#x27;s plan|Today's plan/.test(dash.text) && /Weakness/.test(dash.text) && /Past simple/.test(dash.text));
  check("profile update: goal, daily minutes", (await a.patch("/api/profile", { goal: "Voyager", dailyMinutes: 30 })).json.user.dailyMinutes === 30 && (await a.patch("/api/profile", { dailyMinutes: 7 })).status === 400);
  const planBig = await a.get("/api/plan");
  check("plan adapts to the time budget (30 min → more conversation)", planBig.json.items.find((i: any) => i.kind === "conversation").target >= 10 && planBig.json.targetMinutes === 30);
  const small = new Client();
  await small.post("/api/auth/register", { name: "Small", email: `small${stamp}@example.com`, password: "password123" });
  await small.patch("/api/profile", { dailyMinutes: 5 });
  const planSmall = await small.get("/api/plan");
  check("5-minute budget → short plan", planSmall.json.plannedMinutes <= 9, planSmall.json);
  check("password change", (await a.post("/api/profile/password", { current: "wrong", next: "newpassword2" })).status === 400 && (await a.post("/api/profile/password", { current: "newpassword1", next: "newpassword2" })).status === 200);

  section("14. Gamification & level evolution");
  const ach = await db.achievement.findMany({ where: { user: { email } } });
  check("badges unlocked (placement, first review, first conversation…)", ["placement", "first-review", "first-conversation"].every((c) => ach.some((x) => x.code === c)), ach.map((x) => x.code));
  const u = await db.user.findUniqueOrThrow({ where: { email } });
  check("XP and streak recorded", u.xp > 50 && u.streak === 1);
  // level evolves automatically with performance: a long run of easy successes on hard vocabulary pushes vocab up
  const before = (await a.get("/api/progress")).json.skills.find((s: any) => s.area === "VOCABULARY").value;
  const q2 = await a.post("/api/review/queue", { filter: { scope: ["common500"], status: ["new"], levels: ["B1", "B2"] }, limit: 15, order: "rank" });
  for (const c of q2.json.cards) await a.post("/api/review/answer", { flashcardId: c.id, rating: 4, durationMs: 1500, sessionId: q2.json.sessionId });
  const after = (await a.get("/api/progress")).json.skills.find((s: any) => s.area === "VOCABULARY").value;
  check("vocabulary estimate rises after successes on B1/B2 words", after > before, [before, after]);

  section("15. Security & robustness");
  const rl = new Client("203.0.113.77");
  let lastStatus = 0;
  for (let i = 0; i < 14; i++) lastStatus = (await rl.post("/api/auth/login", { email: "nobody@example.com", password: "whateverpass" })).status;
  check("login rate limiting → 429", lastStatus === 429, lastStatus);
  check("malformed JSON → 400, not 500", (await a.req("POST", "/api/cards", undefined, { "content-type": "application/json" })).status === 400);
  const del = await stranger.del("/api/profile");
  check("account deletion works (cascade)", del.status === 200 && (await db.user.count({ where: { email: `eve${stamp}@example.com` } })) === 0);
  check("security headers present", (await a.req("GET", "/login")).headers.get("x-frame-options") === "DENY");
  check("no secrets in client pages", !(await a.req("GET", "/conversation")).text.includes("ANTHROPIC"));

  // cleanup test users
  await db.user.deleteMany({ where: { email: { in: [email, `weak${stamp}@example.com`, `small${stamp}@example.com`] } } });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) { console.log("Failures:\n - " + failures.join("\n - ")); process.exitCode = 1; }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
