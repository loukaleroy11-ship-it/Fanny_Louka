/* Visual QA helper: logs in, visits pages at mobile + desktop sizes, saves screenshots to .screens/ and reports console errors. */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PAGES = (process.env.PAGES ?? "/dashboard,/review,/cards,/decks,/conversation,/verbs,/grammar,/grammar/past-simple,/cognates,/vocabulary,/mistakes,/stats,/progress,/profile,/settings,/search?q=run,/placement").split(",");

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const email = `shots${Date.now()}@example.com`;
  for (const [name, viewport] of [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1280, height: 800 }]] as const) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(`[console] ${m.text().slice(0, 200)}`));
    page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message.slice(0, 200)}`));
    page.on("response", (r) => r.status() >= 400 && !r.url().includes("favicon") && errors.push(`[http ${r.status()}] ${r.url()}`));
    const reg = await ctx.request.post(`${BASE}/api/auth/register`, { data: { name: "Shots", email: `${name}${email}`, password: "password123" } });
    if (!reg.ok()) throw new Error("register failed " + (await reg.text()));
    for (const p of PAGES) {
      await page.goto(BASE + p, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `.screens/${name}-${p.replace(/[^a-z0-9]+/gi, "_")}.png`, fullPage: false });
    }
    console.log(name, errors.length ? errors : "no errors");
    await ctx.close();
  }
  await browser.close();
}
main();
