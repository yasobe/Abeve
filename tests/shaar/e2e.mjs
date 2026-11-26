// Browser walk-through of the web app against the local stand-in (real Postgres, fake Claude).
// Usage: PGURL=postgres://... SHOTS=/some/dir node tests/shaar/e2e.mjs
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import fs from "node:fs";
import { start } from "./server.mjs";

const { chromium, devices } = createRequire(import.meta.url)("playwright");
const SHOTS = process.env.SHOTS || "";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const S = await start({ pgUrl: process.env.PGURL, rpcPort: 54420, fnPort: 54421, webPort: 54422 });
const sget = async (p) => (await fetch(`${S.fnUrl}/s/${p}?k=${S.token}`)).text();
const browser = await chromium.launch();
let n = 0;
const step = (name) => { n++; console.log("ok -", name); };

async function run(scheme) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], colorScheme: scheme, locale: "he-IL", timezoneId: "Asia/Jerusalem" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("dialog", (d) => d.accept());
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${scheme}-${name}.png` }); };
  return { ctx, page, errors, shot };
}

try {
  // ------------------------------------------------------------ light: the whole flow
  const { ctx, page, errors, shot } = await run("light");

  // first run: no token yet -> setup screen
  await page.goto(`${S.appUrl}?a=home`);
  await page.getByText("חיבור", { exact: true }).waitFor();
  await shot("00-setup");
  await page.fill("#k", S.token);
  // point the app at the local function (normally the default Supabase URL)
  await page.evaluate((api) => localStorage.setItem("shaar.api", api), S.fnUrl);
  await page.reload();
  await page.fill("#k", S.token);
  await page.click("button[type=submit]");
  await page.getByText("כל כניסה לאפליקציה מסיחה עוברת דרך השער.").waitFor();
  step("setup stores the token and opens home");

  // the Shortcut fires: Instagram opened
  const gateUrl = await sget("open/instagram");
  assert.match(gateUrl, /\?a=gate&app=instagram#k=/);
  const t0 = Date.now();
  await page.goto(gateUrl);
  await page.getByText("מה אתה מחפש עכשיו?").waitFor();
  const paint = Date.now() - t0;
  assert.equal(new URL(page.url()).hash, "", "token removed from the address bar");
  await page.locator(".top .meta").getByText("ביקור ראשון היום").waitFor();
  await shot("01-gate");
  step(`gate paints in ${paint} ms (cold, local)`);

  await page.fill("textarea[name=t]", "לענות לאמא על ההודעה ששלחה בבוקר");
  await page.keyboard.press("Enter");
  await page.getByText("אפשר להיכנס").waitFor();
  await shot("02-pass");
  await page.click("[data-act=min][data-m='3']");
  await page.getByText("מתחייב ל-3 דק׳").click();
  await page.getByRole("link", { name: "לפתוח את אינסטגרם" }).waitFor();
  assert.equal(await page.getAttribute("a.btn.primary", "href"), "instagram://app");
  await shot("03-go");
  assert.equal(await sget("open/instagram"), "3");
  assert.equal(await sget("open/instagram"), "ok");
  assert.equal(await sget("close/instagram"), "ok");
  step("pass → 3-minute contract → Shortcut gets 3 (timer), then ok");

  // TikTok: boredom → wait
  await page.goto(await sget("open/tiktok"));
  await page.fill("textarea[name=t]", "סתם, משעמם לי");
  await page.click("button[type=submit]");
  await page.getByText("רגע לפני").waitFor();
  assert.ok(await page.locator("#still").isDisabled());
  await page.waitForTimeout(1200);
  await shot("04-wait");
  // reopening the app mid-wait resumes the same wait instead of a fresh question
  await page.goto(await sget("open/tiktok"));
  await page.getByText("רגע לפני").waitFor();
  step("wait shows a countdown and survives reopening the app");
  await page.getByText("ויתרתי — זה יכול לחכות").first().click();
  await page.getByText("יופי.").waitFor();
  await shot("05-resisted");
  step("giving up is logged as a resisted urge");

  // YouTube: ambiguous → one question → answer → pass
  await page.goto(await sget("open/youtube"));
  await page.fill("textarea[name=t]", "לראות משהו");
  await page.click("button[type=submit]");
  await page.getByText("מה בדיוק אתה רוצה לראות?").waitFor();
  await shot("06-ask");
  await page.fill("textarea[name=t]", "הרצאה על פרק 3 לקורס");
  await page.click("button[type=submit]");
  await page.getByText("לכמה זמן?").waitFor();
  step("one question, then the decision");

  // home + manual lock
  await page.goto(`${S.appUrl}?a=home`);
  await page.getByText("נעילה עכשיו").waitFor();
  await shot("07-home");
  await page.click("[data-act=lock][data-m='60']");
  await page.locator(".count.small").waitFor();
  assert.match(await sget("open/instagram"), /\?a=lock&app=instagram/);
  await page.goto(await sget("open/instagram"));
  await page.getByText("רוצה לצאת מוקדם?").waitFor();
  await page.waitForTimeout(600);
  await shot("08-lock");
  step("manual lock: the Shortcut sends the app to the lock screen");

  // effort: task → step (strong model) → report → release
  await page.getByText("לעשות צעד ולהשתחרר").click();
  await page.getByText("מה אתה דוחה?").waitFor();
  await page.fill("textarea[name=t]", "לכתוב את דוח הרבעון");
  await page.click("button[type=submit]");
  await page.getByText("לפתוח את קובץ הדוח").waitFor();
  await page.waitForTimeout(600);
  assert.ok(await page.locator("#rep").isDisabled());
  await shot("09-step");
  S.clock.offsetSec += 200; // pretend the step took a few minutes
  await page.reload();
  await page.getByText("לפתוח את קובץ הדוח").waitFor();
  await page.waitForFunction(() => !document.querySelector("#rep").disabled);
  await page.fill("textarea[name=t]", "עשיתי");
  await page.click("#rep");
  await page.getByText("עוד לא").waitFor();
  await page.fill("textarea[name=t]", "פתחתי את הקובץ וכתבתי שלוש כותרות: מבוא, נתונים, סיכום");
  await page.click("#rep");
  await page.getByText("השתחררת מהנעילה").waitFor();
  await shot("10-released");
  // the manual lock is gone; the Instagram contract (closed in time) now ends with its 10-minute cooldown
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem("shaar.state")).lock)), null);
  assert.match(await sget("open/instagram"), /\?a=lock/);
  step("effort step releases the lock early (then the contract's own cooldown starts)");
  S.clock.offsetSec += 11 * 60; // cooldown over

  await page.goto(`${S.appUrl}?a=settings`);
  await page.getByText("הכללים שלי").waitFor();
  await page.click("[data-act=set][data-key=form][data-v=f]");
  await page.waitForTimeout(300);
  await shot("11-settings");
  await page.goto(await sget("open/instagram"));
  await page.getByText("מה את מחפשת עכשיו?").waitFor();
  step("feminine form applies everywhere");

  // second visit is served by the service worker
  await page.goto(`${S.appUrl}?a=home`);
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller);
  const t1 = Date.now();
  await page.goto(await sget("open/tiktok"));
  await page.getByText("מה את מחפשת עכשיו?").waitFor();
  step(`gate paints in ${Date.now() - t1} ms from the service worker`);

  // bad token in the Shortcut
  await page.goto(`${S.appUrl}?a=err&e=auth`);
  await page.getByText("הקיצור לא מחובר").waitFor();
  assert.deepEqual(errors, []);
  step("no console errors");
  await ctx.close();

  // ------------------------------------------------------------ dark: a few screens
  const d = await run("dark");
  await d.ctx.addInitScript((api) => localStorage.setItem("shaar.api", api), S.fnUrl);
  await d.page.goto(await sget("open/reddit"));
  await d.page.getByText("מה את מחפשת עכשיו?").waitFor();
  await d.shot("01-gate");
  await d.page.goto(`${S.appUrl}?a=home`);
  await d.page.getByText("היום").first().waitFor();
  await d.page.waitForTimeout(300);
  await d.shot("07-home");
  assert.deepEqual(d.errors, []);
  step("dark mode renders");
  await d.ctx.close();

  console.log(`\n${n} steps passed`);
} finally {
  await browser.close();
  await S.stop();
}
