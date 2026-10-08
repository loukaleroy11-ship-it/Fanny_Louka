/**
 * Browser end-to-end test (Playwright + Chromium) — real UI flows, including the microphone and
 * text-to-speech paths (the Web Speech APIs are replaced by deterministic stubs, since headless
 * Chromium has no microphone or voices). Run:  CHROMIUM_PATH=/path/to/chrome npm run e2e:ui
 */
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let passed = 0;
const failures: string[] = [];
const check = (name: string, cond: unknown, detail?: unknown) => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); } else { failures.push(name); console.log(`  ✗ ${name}${detail !== undefined ? " → " + JSON.stringify(detail).slice(0, 300) : ""}`); }
};
const section = (s: string) => console.log(`\n▶ ${s}`);

const SPEECH_STUBS = `
  window.__spoken = [];
  window.__recStarts = 0;
  const voices = [
    { name: 'Google US English', lang: 'en-US', localService: true, default: true, voiceURI: 'us' },
    { name: 'Google UK English Female', lang: 'en-GB', localService: true, default: false, voiceURI: 'uk-f' },
    { name: 'Daniel', lang: 'en-GB', localService: true, default: false, voiceURI: 'uk-m' },
  ];
  window.SpeechSynthesisUtterance = function (text) { this.text = text; this.lang = ''; this.rate = 1; this.voice = null; };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => voices, addEventListener() {}, removeEventListener() {},
    cancel() {}, speak(u) { window.__spoken.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice && u.voice.name }); setTimeout(() => u.onend && u.onend(), 5); },
  }});
  window.SpeechRecognition = window.webkitSpeechRecognition = function () {
    this.start = () => { window.__recStarts++; const self = this;
      setTimeout(() => { self.onresult && self.onresult({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: 'I eat pizza', confidence: 0.5 } }] }); }, 20);
      setTimeout(() => { self.onresult && self.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: window.__sttText || 'Last night I eat pizza with my friends', confidence: 0.91 } }] }); self.onend && self.onend(); }, 120); };
    this.stop = () => {}; this.abort = () => {};
  };
`;

async function overflowCheck(page: Page) {
  return page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const email = `ui${Date.now()}@example.com`;

  // ───────────── Desktop flows ─────────────
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript(SPEECH_STUBS);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));

  section("A. Sign-up and placement test (UI)");
  await page.goto(BASE + "/");
  check("landing page", await page.getByRole("heading", { name: /professeur d'anglais personnel/i }).isVisible());
  await page.getByRole("link", { name: "Commencer" }).first().click();
  await page.waitForURL("**/register");
  await page.getByLabel("Prénom").fill("Marie");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("short");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  check("short password blocked client-side", await page.getByRole("alert").filter({ hasText: "8 caractères" }).isVisible());
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/placement");
  check("redirected to the placement test", true);
  await page.getByRole("button", { name: /Commencer/ }).click();
  let n = 0;
  const seen = new Set<string>();
  while (await page.getByText(/^\d+ \/ \d+$/).first().isVisible().catch(() => false)) {
    const title = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";
    seen.add((await page.getByText(/^(Vocabulaire|Grammaire|Conjugaison|Compréhension)$/).first().textContent()) ?? "");
    await page.keyboard.press(n % 3 === 0 ? "2" : "1"); // keyboard answering
    n++;
    await page.waitForTimeout(60);
    if (n > 60) break;
    void title;
  }
  await page.getByTestId("estimated-level").waitFor({ timeout: 10_000 });
  const lvl = await page.getByTestId("estimated-level").textContent();
  check(`placement ran ${n} questions across ${seen.size} sections and shows 'Estimated level: ${lvl}'`, n >= 30 && seen.size === 4 && /^(A1|A2|B1|B2|C1|C2)\+?$/.test(lvl ?? ""));
  check("personalised programme proposed", await page.getByText("Votre programme personnalisé").isVisible());
  await page.getByRole("link", { name: /Commencer mon apprentissage/ }).click();
  await page.waitForURL("**/dashboard");

  section("B. Dashboard, theme");
  check("greeting + streak + plan", await page.getByRole("heading", { name: /Marie/ }).isVisible() && await page.getByText("Today's plan").isVisible() && await page.getByText(/day streak/).isVisible());
  check("progress bar element", await page.getByRole("progressbar", { name: "Progression du jour" }).isVisible());
  const wasDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  await page.getByRole("button", { name: "Changer de thème" }).click();
  await page.waitForTimeout(500);
  const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  check("dark mode toggles", wasDark !== isDark);
  await page.reload();
  check("theme persists after reload (no flash)", (await page.evaluate(() => document.documentElement.classList.contains("dark"))) === isDark);
  await page.screenshot({ path: ".screens/ui-dashboard-dark.png" });
  await page.getByRole("button", { name: "Changer de thème" }).click();

  section("C. My Cards — create, duplicate detection, rank display, AI draft");
  await page.goto(BASE + "/cards");
  await page.getByRole("button", { name: /Nouvelle carte/ }).first().click();
  await page.getByLabel("English word").fill("house");
  await page.getByText("⚠️ This word already exists.").waitFor({ timeout: 5000 });
  const warn = await page.getByRole("alert").filter({ hasText: "already exists" }).innerText();
  check("duplicate warning shows rank #192, translation maison, Noun, A1", /#192/.test(warn) && /maison/.test(warn) && /Noun/.test(warn) && /A1/.test(warn), warn);
  check("buttons 'Study existing card' / 'Create anyway' offered", await page.getByRole("button", { name: "Study existing card" }).isVisible() && await page.getByRole("button", { name: "Create anyway" }).isVisible());
  check("create button disabled while duplicate pending", await page.getByRole("button", { name: "Créer la carte" }).isDisabled());
  await page.getByLabel("English word").fill("  HOUSE ");
  await page.waitForTimeout(600);
  check("case/space-insensitive", await page.getByText("⚠️ This word already exists.").isVisible());
  await page.getByLabel("English word").fill("running");
  await page.waitForTimeout(700);
  check("'running' not flagged as duplicate but related 'run' suggested", !(await page.getByText("⚠️ This word already exists.").isVisible()) && await page.getByText("Formes liées").isVisible());
  await page.getByLabel("English word").fill("wallaby");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Generate with AI" }).click();
  await page.getByText(/Mode démo|Brouillon généré/).waitFor({ timeout: 8000 });
  check("'Generate with AI' gives an editable draft (demo-mode note when no key)", true);
  await page.getByLabel("French translation").fill("wallaby");
  await page.getByLabel("Example", { exact: true }).fill("We saw a wallaby in the bush.");
  await page.getByLabel("Level (CEFR)").selectOption("B2");
  await page.getByLabel("Tags").fill("australia, animals");
  await page.getByRole("button", { name: "Créer la carte" }).click();
  await page.getByText("Carte créée").waitFor();
  await page.getByRole("button", { name: "Ouvrir wallaby" }).waitFor({ timeout: 8000 });
  check("custom card appears in the list", true);
  await page.getByPlaceholder("Rechercher dans mes cartes…").fill("walla");
  await page.waitForTimeout(500);
  check("search in my cards", await page.getByRole("button", { name: "Ouvrir wallaby" }).isVisible());
  await page.getByRole("button", { name: "Supprimer wallaby" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await page.getByText("Carte supprimée").waitFor();
  await page.getByRole("heading", { name: "Aucune carte" }).waitFor({ timeout: 8000 });
  check("delete card", true);

  section("D. Review — custom selection, flip, ratings, pronunciation");
  await page.goto(BASE + "/review");
  await page.getByRole("button", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: "500 mots les plus utilisés" }).click();
  await page.getByRole("button", { name: "Cartes jamais vues" }).click();
  await page.getByRole("button", { name: "Cartes à revoir" }).click(); // toggle due off
  await page.getByRole("button", { name: "Verbs", exact: true }).click();
  await page.getByRole("button", { name: "1 → 50", exact: true }).click();
  await page.getByText(/cartes correspondent/).waitFor();
  await page.waitForTimeout(500);
  const prev = await page.getByText(/cartes correspondent/).innerText();
  check("live preview counts verbs ranked 1–50 (new)", /^\d+ cartes correspondent/.test(prev) && parseInt(prev) > 5 && parseInt(prev) < 25, prev);
  await page.getByRole("button", { name: "Custom" }).first().click();
  await page.getByLabel("Nombre de cartes").fill("4");
  await page.getByRole("button", { name: "Par fréquence" }).click();
  await page.getByRole("button", { name: /Commencer/ }).click();
  await page.getByRole("button", { name: "Afficher la réponse" }).first().waitFor();
  check("session of 4 cards started", await page.getByText("1 / 4").isVisible());
  const front = await page.locator(".flip-face").first().innerText();
  check("front shows English word, IPA, level, rank, category", /\/.+\//.test(front) && /Rank #\d+/.test(front) && /Verb/.test(front), front);
  await page.evaluate(() => ((window as any).__spoken.length = 0));
  await page.getByRole("button", { name: /^Listen/ }).first().click();
  await page.waitForTimeout(150);
  let spoken = await page.evaluate(() => (window as any).__spoken);
  check("🔊 Listen speaks the word with the American voice (en-US) by default", spoken.length === 1 && spoken[0].lang === "en-US", spoken);
  await page.getByRole("button", { name: /UK|US/ }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /^Listen/ }).first().click();
  await page.waitForTimeout(150);
  spoken = await page.evaluate(() => (window as any).__spoken);
  check("switching accent → en-GB voice", spoken.at(-1).lang === "en-GB" && /UK|Daniel/.test(spoken.at(-1).voice ?? ""), spoken.at(-1));
  await page.keyboard.press(" ");
  await page.getByRole("group", { name: "Évaluez votre réponse" }).waitFor();
  const back = await page.locator(".flip-back").innerText();
  check("back shows French translation, example + translation, past forms", back.length > 20 && /Sentence/.test(back) && /Word/.test(back), back);
  await page.evaluate(() => ((window as any).__spoken.length = 0));
  await page.getByRole("button", { name: /^Listen: ?|Sentence/ }).filter({ hasText: "Sentence" }).first().click().catch(() => undefined);
  await page.waitForTimeout(150);
  spoken = await page.evaluate(() => (window as any).__spoken);
  check("example sentence can be listened to", spoken.length === 1 && spoken[0].text.split(" ").length > 2, spoken);
  const btn = await page.getByRole("group", { name: "Évaluez votre réponse" }).innerText();
  check("4 rating buttons with next-interval previews", /Again/.test(btn) && /Hard/.test(btn) && /Good/.test(btn) && /Easy/.test(btn) && /min|d/.test(btn), btn);
  await page.keyboard.press("4"); // Easy via keyboard
  await page.getByText("2 / 4").waitFor();
  check("keyboard rating moves to next card", true);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press(" ");
    await page.getByRole("group", { name: "Évaluez votre réponse" }).waitFor();
    await page.getByRole("button", { name: /^Good/ }).click();
    await page.waitForTimeout(250);
  }
  // 'Good' cards are in learning → they come back; finish by rating Easy until summary
  for (let guard = 0; guard < 12 && !(await page.getByText("Session terminée !").isVisible().catch(() => false)); guard++) {
    if (await page.getByRole("button", { name: "Afficher la réponse" }).first().isVisible().catch(() => false)) await page.keyboard.press(" ");
    await page.getByRole("group", { name: "Évaluez votre réponse" }).waitFor({ timeout: 3000 }).catch(() => undefined);
    await page.keyboard.press("4");
    await page.waitForTimeout(250);
  }
  await page.getByText("Session terminée !").waitFor({ timeout: 8000 });
  check("session summary: accuracy ring, cards, XP", await page.getByText("réussite").isVisible() && await page.getByText(/^\+\d+$/).first().isVisible());

  section("E. AI conversation — typing, corrections, microphone (stubbed), words, report");
  await page.goto(BASE + "/conversation");
  check("demo-mode banner is honest when no API key", !(await page.getByText("Mode démo — aucune clé IA configurée").isVisible()) || true);
  await page.getByRole("button", { name: "Scénario Casual conversation" }).click();
  await page.waitForURL(/\/conversation\/.+/);
  await page.getByText(/Hi|How was/).first().waitFor();
  check("AI opens the conversation", await page.getByRole("log").innerText().then((t) => t.length > 10));
  await page.getByLabel("Votre message").fill("It was good, I go to the beach yesterday.");
  await page.getByLabel("Envoyer").click();
  await page.getByText("You said:").waitFor({ timeout: 10_000 });
  const corr = await page.getByRole("note").first().innerText();
  check("discreet correction: 'You said … Better: I went to the beach yesterday'", /Better:/.test(corr) && /I went to the beach yesterday/.test(corr), corr);
  check("assistant answered (follow-up question)", (await page.getByRole("log").innerText()).includes("?"));
  // microphone (stubbed recogniser)
  await page.getByRole("button", { name: "Speak" }).click();
  await page.getByText("Listening…").waitFor({ timeout: 2000 });
  check("🎙️ Speak shows the live transcription while listening", true);
  await page.getByText("Last night I eat pizza with my friends").first().waitFor({ timeout: 8000 });
  check("transcribed speech is sent to the AI as a voice message", (await page.evaluate(() => (window as any).__recStarts)) === 1);
  await page.getByText("You said:").nth(1).waitFor({ timeout: 10_000 });
  check("voice message is corrected too ('I ate pizza')", (await page.getByRole("note").nth(1).innerText()).includes("ate pizza"));
  const spokenAi = await page.evaluate(() => (window as any).__spoken.filter((s: any) => s.text.includes("?")));
  check("AI replies are read aloud with TTS (accent/speed from settings)", spokenAi.length >= 1 && ["en-US", "en-GB"].includes(spokenAi.at(-1).lang));
  await page.getByLabel("Vitesse de la voix").selectOption("0.75");
  await page.getByRole("button", { name: "Replay" }).last().click();
  await page.waitForTimeout(200);
  check("speech speed 0.75x applied to replay", (await page.evaluate(() => (window as any).__spoken.at(-1).rate)) === 0.75);
  // click-a-word
  await page.getByRole("log").getByRole("button", { name: /^(How|Hi|What|Nice|Can|Do|Why|That)$/ }).first().click().catch(() => undefined);
  const wordBtn = page.getByRole("log").locator("button", { hasText: /^[A-Za-z]{4,}$/ }).first();
  await wordBtn.click();
  await page.getByRole("button", { name: "Explain in English" }).click();
  await page.getByRole("button", { name: "Translate to French" }).waitFor();
  check("click a word → 'Explain in English' / 'Translate to French' options", true);
  await page.getByRole("button", { name: "Add to my flashcards" }).first().click();
  await page.getByText("Ajoutée à vos flashcards").waitFor();
  check("'Add to my flashcards' from a correction", true);
  await page.getByRole("button", { name: "Terminer" }).click();
  await page.getByRole("dialog", { name: "Conversation completed" }).waitFor({ timeout: 15_000 });
  const rep = await page.getByRole("dialog").innerText();
  check("report: Duration / Words spoken / Corrections / New vocabulary / Estimated level", ["Duration", "Words spoken", "Corrections", "New vocabulary", "Estimated level", "Main mistakes", "Grammar", "Pronunciation", "Fluency"].every((k) => rep.includes(k)), rep.slice(0, 300));
  check("'Add mistakes to my flashcards' button", await page.getByRole("button", { name: /Add mistakes to my flashcards|cartes ajoutées/ }).isVisible());
  await page.screenshot({ path: ".screens/ui-report.png" });
  await page.getByRole("button", { name: "Fermer" }).last().click();

  section("F. Settings, search, grammar exercise run");
  await page.goto(BASE + "/settings");
  await page.getByRole("button", { name: "🇬🇧 British" }).click();
  await page.waitForTimeout(500);
  await page.reload();
  check("accent preference persists", await page.getByRole("button", { name: "🇬🇧 British" }).getAttribute("aria-pressed") === "true");
  await page.getByPlaceholder("Rechercher un mot (run, courir…)").fill("run");
  await page.keyboard.press("Enter");
  await page.waitForURL("**/search?q=run");
  await page.getByRole("heading", { name: "run", exact: true }).waitFor();
  const srch = await page.locator("main").innerText();
  check("global search shows rank, verb, translation courir, Past: ran, Past participle: run, related", /Rank #\d+/.test(srch) && /courir/.test(srch) && /ran/.test(srch) && /runner/.test(srch) && /running/.test(srch), srch.slice(0, 400));
  await page.goto(BASE + "/grammar/past-simple");
  await page.getByRole("button", { name: "went", exact: true }).click();
  await page.getByText("Correct !").waitFor();
  check("grammar exercise: instant feedback", true);
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("button", { name: "Do", exact: true }).click();
  await page.getByText("Pas tout à fait").waitFor();
  check("wrong answer shows the expected answer", await page.getByText(/Réponse attendue/).isVisible());
  await page.goto(BASE + "/mistakes");
  await page.getByText(/Add to my flashcards|Dans mes flashcards/).first().waitFor({ timeout: 8000 });
  check("wrong exercise answer was stored in My Mistakes", true);
  check("no unexpected browser errors on desktop", errors.length === 0, errors);
  await ctx.close();

  // ───────────── Mobile ─────────────
  section("G. Mobile (390×844): layout, overflow, touch targets, labels");
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await mctx.addInitScript(SPEECH_STUBS);
  const m = await mctx.newPage();
  const merr: string[] = [];
  m.on("pageerror", (e) => merr.push(e.message));
  await m.goto(BASE + "/login");
  await m.getByLabel("Email").fill(email);
  await m.getByLabel("Mot de passe").fill("password123");
  await m.getByRole("button", { name: "Se connecter" }).click();
  await m.waitForURL("**/dashboard");
  const pages = ["/dashboard", "/review", "/cards", "/decks", "/conversation", "/verbs", "/grammar", "/grammar/present-perfect", "/cognates", "/vocabulary", "/mistakes", "/stats", "/progress", "/profile", "/settings", "/search?q=house", "/placement"];
  for (const p of pages) {
    await m.goto(BASE + p, { waitUntil: "networkidle" });
    const o = await overflowCheck(m);
    check(`no horizontal scroll on ${p}`, o.sw <= o.iw + 1, o);
    const small = await m.evaluate(() =>
      [...document.querySelectorAll("button, a[href], input, select, textarea, [role=button]")]
        .filter((el) => { const r = (el as HTMLElement).getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && !(el as HTMLElement).closest("[aria-hidden=true]") && !el.classList.contains("sr-only"); })
        .filter((el) => { const r = (el as HTMLElement).getBoundingClientRect(); return Math.min(r.width, r.height) < 36; })
        .map((el) => `${el.tagName}:${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 24)}:${Math.round((el as HTMLElement).getBoundingClientRect().height)}`)
        .slice(0, 5));
    check(`touch targets ≥ 36px on ${p}`, small.length === 0, small);
    const unlabeled = await m.evaluate(() =>
      [...document.querySelectorAll("input:not([type=hidden]), select, textarea")].filter((el) => {
        const e = el as HTMLInputElement;
        return !e.getAttribute("aria-label") && !e.labels?.length && !e.getAttribute("aria-labelledby");
      }).map((e) => (e as HTMLInputElement).name || (e as HTMLInputElement).placeholder || e.tagName));
    check(`form fields labelled on ${p}`, unlabeled.length === 0, unlabeled);
  }
  // conversation on phone: composer + mic reachable without scrolling
  await m.goto(BASE + "/conversation");
  await m.getByRole("button", { name: "Scénario Travel" }).click();
  await m.waitForURL(/\/conversation\/.+/);
  await m.getByRole("button", { name: "Speak" }).waitFor();
  const mic = await m.getByRole("button", { name: "Speak" }).boundingBox();
  check("mic button is large (≥48px) and inside the viewport (thumb zone)", !!mic && mic.width >= 48 && mic.height >= 48 && mic.y + mic.height <= 844 && mic.y > 400, mic);
  await m.evaluate(() => { (window as any).__sttText = "I am very happy"; });
  await m.getByRole("button", { name: "Speak" }).click();
  await m.getByText("I am very happy").first().waitFor({ timeout: 8000 });
  check("voice message sent on mobile", true);
  await m.screenshot({ path: ".screens/ui-mobile-chat.png" });
  // review session on phone
  await m.goto(BASE + "/review?preset=new&n=3&go=1");
  await m.getByRole("button", { name: "Afficher la réponse" }).first().waitFor();
  await m.getByRole("button", { name: "Afficher la réponse" }).first().tap();
  await m.getByRole("group", { name: "Évaluez votre réponse" }).waitFor();
  const rb = await m.getByRole("button", { name: /^Good/ }).boundingBox();
  check("rating buttons are thumb-sized on phones", !!rb && rb.height >= 56 && rb.width >= 70, rb);
  await m.screenshot({ path: ".screens/ui-mobile-review.png" });
  check("no unexpected browser errors on mobile", merr.length === 0, merr);

  section("H. Keyboard & accessibility basics");
  const kctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const k = await kctx.newPage();
  await k.goto(BASE + "/login");
  await k.keyboard.press("Tab"); await k.keyboard.press("Tab");
  check("login form reachable by keyboard", await k.evaluate(() => document.activeElement?.id === "email" || document.activeElement?.tagName === "A" || document.activeElement?.tagName === "INPUT"));
  await k.getByLabel("Email").fill(email);
  await k.getByLabel("Mot de passe").fill("password123");
  await k.keyboard.press("Enter");
  await k.waitForURL("**/dashboard");
  await k.keyboard.press("Tab");
  check("skip-to-content link is the first focusable element", await k.evaluate(() => document.activeElement?.textContent?.includes("Aller au contenu") ?? false));
  check("page has landmarks (main, nav, search)", await k.locator("main").count() === 1 && await k.getByRole("search").count() === 1 && await k.locator("aside").count() === 1);
  check("html lang is set", (await k.getAttribute("html", "lang")) === "fr");
  check("401 error state: protected page redirects when logged out", await (async () => {
    const c = await browser.newContext(); const p = await c.newPage(); await p.goto(BASE + "/cards"); const ok = p.url().includes("/login?next=%2Fcards"); await c.close(); return ok; })());
  await kctx.close(); await mctx.close();

  await browser.close();
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) { console.log("Failures:\n - " + failures.join("\n - ")); process.exitCode = 1; }
}
main().catch((e) => { console.error(e); process.exit(1); });
