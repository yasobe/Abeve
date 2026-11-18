// End-to-end smoke test in a real browser (Playwright + Chromium).
// Run: node tests/tzalul/e2e.cjs   (serves docs/ on a free port by itself)
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium, devices } = require("playwright");
const assert = require("assert/strict");

const ROOT = path.join(__dirname, "../../docs");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, path.normalize(p));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const URL0 = `http://localhost:${server.address().port}/tzalul/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "he-IL", acceptDownloads: true, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => m.type() === "error" && errors.push(m.text()));
  const step = async (name, fn) => { process.stdout.write(`• ${name} … `); await fn(); console.log("ok"); };
  const submit = () => page.click("form[data-form] button[type=submit] >> nth=0");

  try {
    await page.goto(URL0);
    await step("onboarding", async () => {
      await page.click("text=בואו נתחיל");
      await page.fill("input[name=name]", "יואב");
      await page.click(".seg >> text=זכר");
      await assert.equal(await page.textContent("#g-sample"), "אתה מוכן להתחיל?");
      await submit();
      await page.click("text=להפסיק עכשיו");
      await submit();
      await page.fill("input[name=costPerWeek]", "350");
      await submit();
      await page.click(".chip >> text=לחסוך כסף");
      await submit();
      await page.click("text=יוצאים לדרך");
      await page.waitForSelector(".hero-days");
      assert.equal((await page.textContent(".hero-days")).trim(), "0");
      await page.click("dialog.sheet >> text=תודה!"); // first achievement celebration
    });

    await step("daily check-in with symptom tips", async () => {
      await page.click("text=צ׳ק־אין יומי");
      await page.click(".scale-opt.s4 >> nth=0");
      await page.click(".scale-opt.s3 >> nth=1");
      await page.click(".chip >> text=קושי להירדם");
      await page.click("text=שמירה");
      await page.waitForSelector("dialog.sheet >> text=כמה דברים שעוזרים");
      await page.click("dialog.sheet >> text=הבנתי");
      await page.waitForSelector("text=הצ׳ק־אין של היום נשמר");
    });

    await step("log a craving", async () => {
      await page.goto(URL0 + "#/craving");
      await page.click(".chip >> text=ערב / אחרי העבודה");
      await page.click(".chip >> text=הליכה / יציאה החוצה");
      await page.click("text=שמירה");
      await page.waitForSelector(".entry.craving >> text=עברתי את זה");
    });

    await step("journal entry", async () => {
      await page.goto(URL0 + "#/journal/new");
      await page.fill("textarea[name=text]", "היום היה קשה בערב, אבל יצאתי להליכה.");
      await page.click("text=שמירה");
      await page.waitForSelector(".entry >> text=יצאתי להליכה");
    });

    await step("plan: reason, contact, if-then", async () => {
      await page.goto(URL0 + "#/plan");
      await page.fill("input[name=r]", "להיות בכושר");
      await page.click("form[data-form=addReason] button");
      await page.waitForSelector(".editable >> text=להיות בכושר");
      await page.fill("input[name=name]", "אחי");
      await page.fill("input[name=phone]", "052-0000000");
      await page.click("form[data-form=addContact] button");
      await page.fill("input[name=if]", "משעמם לי בערב");
      await page.fill("input[name=then]", "אצא לריצה");
      await page.click("form[data-form=addIfThen] button");
      await page.goto(URL0 + "#/sos");
      await page.waitForSelector("a.contact[href='tel:052-0000000']");
      await page.waitForSelector("text=אצא לריצה");
    });

    await step("XSS in user text is rendered as text", async () => {
      await page.goto(URL0 + "#/plan");
      await page.fill("input[name=r]", "<img src=x onerror=window.__pwned=1>");
      await page.click("form[data-form=addReason] button");
      await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => window.__pwned), undefined);
      assert.equal(await page.locator(".editable img").count(), 0);
    });

    await step("breathing exercise runs", async () => {
      await page.goto(URL0 + "#/tools/breathe");
      await page.click("[data-act=breathToggle]");
      await page.waitForFunction(() => document.querySelector(".breath").dataset.state === "in");
      assert.equal((await page.textContent(".breath-label")).trim(), "שאיפה");
      await page.click("[data-act=breathToggle]");
    });

    await step("slip resets the streak but keeps history", async () => {
      await page.goto(URL0 + "#/slip");
      await page.click(".chip >> text=לחץ");
      await page.click("text=לשמור ולהמשיך");
      await page.waitForSelector(".hero-days");
      const st = await page.evaluate(() => JSON.parse(localStorage.getItem("tzalul_v1")).plain);
      assert.equal(st.slips.length, 1);
      assert.equal(st.attempts.length, 1);
    });

    await step("backup export", async () => {
      await page.goto(URL0 + "#/settings");
      const [dl] = await Promise.all([page.waitForEvent("download"), page.click("text=שמירת גיבוי")]);
      const json = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
      assert.equal(json.app, "tzalul");
      assert.equal(json.state.profile.name, "יואב");
    });

    await step("lock code encrypts and unlocks", async () => {
      await page.click("text=הגדרת קוד נעילה");
      await page.fill("dialog input[name=a]", "2468");
      await page.fill("dialog input[name=b]", "2468");
      await page.click("dialog >> text=שמירה");
      await page.waitForSelector("text=המידע מוצפן במכשיר");
      const raw = await page.evaluate(() => localStorage.getItem("tzalul_v1"));
      assert.ok(raw.includes('"enc"') && !raw.includes("יצאתי להליכה"));
      await page.reload();
      await page.waitForSelector(".lock");
      assert.equal(await page.locator(".nav .tab").count(), 0);
      await page.fill("#code", "1111");
      await page.click("text=פתיחה");
      await page.waitForSelector("text=הקוד שגוי");
      await page.fill("#code", "2468");
      await page.click("text=פתיחה");
      await page.waitForSelector(".hero-days");
    });

    await step("desktop layout + dark mode render", async () => {
      await page.setViewportSize({ width: 1280, height: 860 });
      await page.emulateMedia({ colorScheme: "dark" });
      await page.goto(URL0 + "#/progress");
      await page.waitForSelector(".badges");
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      assert.equal(bg, "rgb(15, 23, 25)");
    });

    assert.deepEqual(errors, [], "console errors");
    console.log("\nE2E passed");
  } catch (e) {
    console.error("\nE2E FAILED:", e.message, errors);
    await page.screenshot({ path: path.join(__dirname, "e2e-failure.png") }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
})();
