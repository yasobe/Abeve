// End-to-end test: walks the whole app in Chromium (phone + desktop, light + dark).
// Usage: python3 -m http.server 8790 -d tzalul &  then  node tzalul/tests/e2e.cjs [screenshotDir]
// Needs Playwright (require("playwright")).

const { chromium, devices } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.BASE || "http://localhost:8790/";
const SHOTS = process.argv[2] || "";
const ROUTES = ["today", "journal", "progress", "tools", "sos", "settings", "tools/breathing", "tools/grounding", "tools/halt",
  "tools/plan", "tools/thoughts", "tools/gratitude", "tools/letter", "tools/reasons", "tools/audit", "tools/help", "learn/safety", "learn/lapse"];

let step = 0;
const log = m => console.log(`  ${++step}. ${m}`);

async function shot(p, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  // the first capture in mobile emulation can stall in headless Chromium; retry once
  for (let i = 0; i < 3; i++) {
    try { await p.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true, timeout: 6000 }); return; } catch (e) { if (i === 2) throw e; }
  }
}

async function noOverflow(p, where) {
  const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(o <= 1, `horizontal overflow ${o}px on ${where}`);
}

async function go(p, route) {
  await p.evaluate(r => { location.hash = `#/${r}`; }, route);
  await p.waitForTimeout(250);
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const watch = p => {
    p.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    p.on("pageerror", e => errors.push(e.message));
  };

  /* ---------------- Phone ---------------- */
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "he-IL", timezoneId: "Asia/Jerusalem", acceptDownloads: true });
  const p = await ctx.newPage();
  watch(p);
  await p.goto(BASE);
  await p.waitForSelector(".onboard");
  assert.equal(await p.evaluate(() => document.documentElement.dir), "rtl");
  await shot(p, "01-welcome");
  log("welcome screen (RTL)");

  // onboarding
  await p.click("text=בואו נתחיל");
  await p.click("label:has-text('כבר התחלתי')");
  const start = await p.evaluate(() => { const d = new Date(Date.now() - 12 * 864e5 - 3600e3); const z = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; });
  await p.fill("#ob-start", start);
  await p.click("button[type=submit]");
  await p.fill("#ob-cost", "35");
  await shot(p, "02-habits");
  await p.click("button[type=submit]");
  await p.check("input[name=symptoms]");
  assert.ok(await p.isVisible("#ob-warn"), "safety warning should show");
  await shot(p, "03-safety");
  await p.click("button[type=submit]");
  await p.click(".chip:has-text('שינה טובה יותר')");
  await p.click(".chip:has-text('המשפחה שלי')");
  await p.fill("#ob-custom", "להיות נוכח עם הילדים");
  await p.click("button[type=submit] >> text=המשך");
  await p.fill("#ob-name", "דנה");
  await p.check("input[name=gender][value=f]");
  await p.fill("#ob-cn", "אמא");
  await p.fill("#ob-cp", "050-1234567");
  await p.click("button[type=submit]");
  await p.waitForTimeout(300);
  assert.match(p.url(), /#\/learn\/safety$/, "risky drinkers land on the safety article");
  log("onboarding → safety article for withdrawal risk");

  // today
  await go(p, "today");
  await p.waitForSelector(".hero-num");
  assert.equal((await p.textContent(".hero-num")).trim(), "12");
  assert.match(await p.textContent(".hello h1"), /דנה/);
  await p.waitForTimeout(600); // milestone celebration (10 days)
  if (await p.isVisible("#sheet[open]")) { await shot(p, "04-milestone"); await p.click("#sheet [data-sact=ok]"); }
  await shot(p, "05-today");
  await noOverflow(p, "today");
  log("today: 12-day streak, greeting with name");

  // check-in
  await p.click(".qm >> nth=3");
  await p.waitForSelector("#sheet[open]");
  assert.ok(await p.isChecked('#sheet input[name=mood][value="4"]'));
  await shot(p, "06-checkin");
  await p.click("#sheet button[type=submit]");
  await p.waitForSelector(".ci-done");
  log("daily check-in saved");

  // intention
  await p.fill("#intent", "הליכה בערב");
  await p.click("form[data-form=intention] button");
  await p.waitForTimeout(150);
  assert.equal(await p.inputValue("#intent"), "הליכה בערב");
  log("intention saved");

  // SOS
  await p.click(".tab-sos");
  await p.waitForSelector(".sos-page");
  await p.waitForTimeout(1200);
  assert.match(await p.textContent("#surf-t"), /00:0[1-9]/);
  await p.click("summary:has-text('נשימה מודרכת')");
  await p.click(".b-toggle");
  await p.waitForTimeout(500);
  assert.equal(await p.textContent(".b-phase"), "שאיפה");
  await shot(p, "07-sos");
  await noOverflow(p, "sos");
  await p.click("text=הדחף עבר");
  await p.waitForSelector("#sheet[open]");
  await p.click("#sheet .chip:has-text('לחץ')");
  await p.click("#sheet .chip:has-text('נשימות')");
  await p.click("#sheet button[type=submit]");
  await p.waitForTimeout(300);
  assert.match(p.url(), /#\/today$/);
  log("SOS: surf timer, breathing, craving logged as passed");

  // journal entry
  await go(p, "journal");
  await p.click("text=כתיבה");
  await p.fill("#jr-text", "יום טוב. <img src=x onerror=alert(1)> הרגשתי חזקה.");
  await p.click("#sheet button[type=submit]");
  await p.waitForTimeout(200);
  assert.equal(await p.locator(".timeline img").count(), 0, "user text must be escaped");
  assert.ok((await p.textContent(".timeline")).includes("<img src=x"), "escaped text visible");
  await shot(p, "08-journal");
  await noOverflow(p, "journal");
  log("journal entry saved and HTML escaped");

  // lapse
  await go(p, "today");
  const before = await p.evaluate(() => window.__tzalul.state.profile.startAt);
  await p.click("text=רישום שתייה");
  await p.waitForSelector("#sheet[open]");
  await p.fill("#dr-n", "2");
  await p.click("#sheet .chip:has-text('חברים ששותים')");
  await p.fill("#dr-learn", "להביא משקה משלי");
  await shot(p, "09-lapse");
  await p.click("#sheet button[type=submit]");
  await p.waitForTimeout(300);
  assert.equal((await p.textContent(".hero-num")).trim(), "0", "streak restarts");
  const sober = await p.evaluate(() => document.querySelectorAll(".stat-v")[2].textContent);
  assert.equal(sober.trim(), "12", "total sober days kept");
  assert.equal(await p.evaluate(() => window.__tzalul.state.profile.startAt), before);
  log("lapse: current streak resets, 12 sober days kept");

  // progress
  await go(p, "progress");
  await p.waitForSelector(".kpis");
  assert.ok(await p.locator('[data-chart="mood"] svg').count(), "mood chart");
  assert.ok(await p.locator('[data-chart="cravings"] svg').count(), "cravings chart");
  assert.ok((await p.locator(".heat-grid .hc.sober").count()) >= 11);
  assert.equal(await p.locator(".heat-grid .hc.drank").count(), 1);
  await p.fill("#g-name", "אופניים");
  await p.fill("#g-price", "2000");
  await p.click("form[data-form=goal] button");
  await p.waitForTimeout(200);
  await shot(p, "10-progress");
  await noOverflow(p, "progress");
  log("progress: KPIs, heat grid, charts, savings goal");

  // every route renders without overflow
  for (const r of ROUTES) {
    await go(p, r);
    const t = await p.textContent("#view");
    assert.ok(t.trim().length > 20, `route ${r} rendered`);
    await noOverflow(p, r);
  }
  await go(p, "tools");
  await shot(p, "11-tools");
  log(`all ${ROUTES.length} routes render with no horizontal overflow`);

  // AUDIT
  await go(p, "tools/audit");
  for (let i = 0; i < 10; i++) await p.locator("fieldset.audit-q").nth(i).locator("label.opt").nth(i < 8 ? 2 : 1).click();
  await p.click("text=לחישוב התוצאה");
  await p.waitForSelector(".audit-score");
  assert.equal((await p.textContent(".audit-score b")).trim(), "20");
  await shot(p, "12-audit");
  log("AUDIT scored (20 → possible dependence)");

  // plan list editing
  await go(p, "tools/plan");
  await p.fill('form[data-list="plan.risks"] input', "חתונות");
  await p.press('form[data-list="plan.risks"] input', "Enter");
  await p.waitForTimeout(150);
  assert.ok((await p.textContent('[data-list="plan.risks"]')).includes("חתונות"));
  log("relapse prevention plan edit");

  // PIN lock
  await go(p, "settings");
  await p.click("text=הפעלת נעילה בקוד");
  await p.fill("#p-new", "2580");
  await p.fill("#p-new2", "2580");
  await p.click("#sheet button[type=submit]");
  await p.waitForSelector(".ok-line", { timeout: 15000 });
  const ls = await p.evaluate(() => ({ plain: localStorage.getItem("tzalul.v1"), vault: localStorage.getItem("tzalul.vault") }));
  assert.equal(ls.plain, null, "no plaintext after enabling lock");
  assert.ok(ls.vault && !ls.vault.includes("דנה") && !ls.vault.includes("הרגשתי"), "vault is encrypted");
  await p.click("text=נעילה עכשיו");
  await p.waitForSelector(".lock");
  assert.equal(await p.evaluate(() => window.__tzalul.state), null, "decrypted state dropped from memory");
  await shot(p, "13-lock");
  await p.fill("#pin", "1111");
  await p.click(".lock-form button.btn");
  // locator waits instead of waitForFunction: the app's CSP blocks eval-based polling in some Playwright versions
  await p.locator("#lock-msg", { hasText: "שגוי" }).waitFor({ timeout: 15000 });
  for (const k of "2580") await p.click(`.keypad [data-k="${k}"]`);
  await p.click(".lock-form button.btn");
  await p.waitForSelector(".settings", { timeout: 15000 });
  log("PIN lock: encrypted at rest, wrong PIN rejected, right PIN unlocks");

  // reload while locked
  await p.reload();
  await p.waitForSelector(".lock");
  await p.fill("#pin", "2580");
  await p.press("#pin", "Enter");
  await p.waitForSelector("#view .hero-num, #view .settings", { timeout: 15000 });
  log("reload keeps data locked until PIN");

  // backup export → wipe → import
  await go(p, "settings");
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("text=שמירת גיבוי")]);
  const file = await dl.path();
  const backup = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(backup.app, "tzalul");
  assert.equal(backup.data.profile.name, "דנה");
  await p.click("text=מחיקת הכל");
  await p.click("#sheet [data-sact=ok]");
  await p.waitForSelector(".onboard");
  assert.equal(await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("tzalul")).length <= 1), true);
  log("backup exported, all data wiped");

  // import a malicious-but-valid backup: values must be sanitized
  backup.data.profile.name = "<script>alert(1)</script>".repeat(5);
  backup.data.profile.costPerDrink = 1e9;
  backup.data.contacts.push({ id: "../../x", name: "x", phone: "javascript:alert(1)" });
  backup.data.checkins["not-a-date"] = { mood: 99 };
  fs.writeFileSync(file, JSON.stringify(backup));
  // go to settings via a fresh onboarding-free path: import is offered in settings, so finish a minimal onboarding first
  await p.evaluate(() => { const s = window.__tzalul; s.update(st => { st.settings.onboarded = true; }); });
  await go(p, "settings");
  await p.setInputFiles("#import-file", file);
  await p.click("#sheet [data-sact=ok]");
  await p.waitForSelector(".hero-num");
  const st = await p.evaluate(() => window.__tzalul.state);
  assert.equal(st.profile.name.length, 40, "name truncated");
  assert.equal(st.profile.costPerDrink, 1000, "cost clamped");
  assert.ok(!st.checkins["not-a-date"], "bad checkin dropped");
  assert.ok(st.contacts.every(c => /^[0-9+*#\-\s()]*$/.test(c.phone) && /^[a-z0-9]+$/i.test(c.id)), "contact sanitized");
  assert.equal(st.journal.length, 1);
  log("backup import restores data and sanitizes hostile values");

  await ctx.close();

  /* ---------------- Desktop + dark ---------------- */
  const dctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "he-IL", colorScheme: "dark" });
  const d = await dctx.newPage();
  watch(d);
  await d.goto(BASE);
  await d.evaluate(json => localStorage.setItem("tzalul.v1", json), JSON.stringify(backup.data));
  await d.reload();
  await d.waitForSelector(".hero-num");
  assert.ok(await d.isVisible(".side"), "desktop side nav");
  assert.ok(!(await d.isVisible(".tabbar")), "no tab bar on desktop");
  const bg = await d.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(bg, "rgb(15, 20, 19)", "dark theme applied");
  await shot(d, "20-desktop-today-dark");
  await d.keyboard.press("3");
  await d.waitForSelector(".kpis");
  await shot(d, "21-desktop-progress-dark");
  await noOverflow(d, "desktop progress");
  await d.keyboard.type("!");
  await d.waitForSelector(".sos-page");
  await shot(d, "22-desktop-sos-dark");
  log("desktop layout, dark mode, keyboard shortcuts");

  // offline: service worker serves the app
  await d.goto(BASE);
  const ready = await d.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  assert.ok(ready);
  await dctx.setOffline(true);
  await d.reload();
  await d.waitForSelector(".hero-num", { timeout: 10000 });
  await dctx.setOffline(false);
  log("works offline via service worker");
  await dctx.close();

  await browser.close();
  const real = errors.filter(e => !/favicon/.test(e));
  assert.deepEqual(real, [], `console errors:\n${real.join("\n")}`);
  console.log(`\n✓ e2e passed (${step} checks)`);
})().catch(e => { console.error("\n✗ e2e failed:", e.message); process.exit(1); });
