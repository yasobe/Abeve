// Unit tests for pure logic. Run: node --test tzalul/tests/
import test from "node:test";
import assert from "node:assert/strict";

import { html, raw, esc, plural, U, humanSpan, dayKey, calDays, g, fmtNum } from "../js/util.js";
import {
  baselinePerDay, streak, longestStreak, soberDays, savings, milestones, auditScore, auditZone,
  withdrawalRisk, cravingWeeks, triggerCounts, checkinStreak, dayRange, goalEta,
} from "../js/calc.js";
import { clean, defaults, createStore, KEYS } from "../js/store.js";
import { seal, unseal, newVaultKey } from "../js/crypto.js";

const D = 864e5;
const NOW = new Date(2026, 10, 18, 20, 0, 0); // 18 Nov 2026, 20:00 local

function st(over = {}) {
  const s = defaults(NOW);
  s.profile.startAt = new Date(NOW - 10 * D).toISOString();
  s.profile.daysPerWeek = 7;
  s.profile.drinksPerDay = 2;
  s.profile.costPerDrink = 25;
  s.profile.kcalPerDrink = 150;
  s.settings.onboarded = true;
  return Object.assign(s, over);
}

/* ---------- util ---------- */

test("html escapes interpolations, keeps nested html and raw", () => {
  const bad = `<img src=x onerror="alert(1)">'`;
  const out = String(html`<p title="${bad}">${bad}${html`<b>${"&"}</b>`}${raw("<i>ok</i>")}</p>`);
  assert.ok(!out.includes("<img"));
  assert.ok(out.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;"));
  assert.ok(out.includes("<b>&amp;</b><i>ok</i>"));
  assert.equal(String(html`${[1, "<", null, false, undefined]}`), "1&lt;");
  assert.equal(esc("`"), "&#96;");
});

test("Hebrew plurals use the dual form", () => {
  assert.equal(plural(1, U.day), "יום אחד");
  assert.equal(plural(2, U.day), "יומיים");
  assert.equal(plural(5, U.day), "5 ימים");
  assert.equal(plural(2, U.hour), "שעתיים");
  assert.equal(plural(2, U.week), "שבועיים");
  assert.equal(plural(1200, U.day), `${fmtNum(1200)} ימים`);
});

test("humanSpan", () => {
  assert.equal(humanSpan(0.4), "פחות מיום");
  assert.equal(humanSpan(3), "3 ימים");
  assert.equal(humanSpan(14), "שבועיים");
  assert.equal(humanSpan(16), "שבועיים ו-יומיים");
  assert.equal(humanSpan(365), "שנה");
});

test("calendar day math is DST-safe", () => {
  // Israel DST ends late October; local day counting must still be whole days
  assert.equal(calDays(new Date(2026, 9, 20, 23, 0), new Date(2026, 9, 30, 1, 0)), 10);
  assert.equal(dayKey(new Date(2026, 0, 5)), "2026-01-05");
});

test("gendered text", () => {
  assert.equal(g("m", "בוא", "בואי", "בואו"), "בוא");
  assert.equal(g("f", "בוא", "בואי", "בואו"), "בואי");
  assert.equal(g("n", "בוא", "בואי", "בואו"), "בואו");
});

/* ---------- calc ---------- */

test("streak counts from the start when there are no drinks", () => {
  const s = streak(st(), NOW);
  assert.equal(s.days, 10);
  assert.equal(s.hours, 0);
});

test("a drink restarts the streak but keeps sober days and longest streak", () => {
  const s = st();
  s.drinks.push({ id: "a1b2c3d4", at: new Date(NOW - 3 * D).toISOString(), count: 3, triggers: [], note: "", learned: "" });
  assert.equal(streak(s, NOW).days, 3);
  assert.equal(Math.round(longestStreak(s, NOW)), 7);
  // 10 completed days since start, one of them had a drink
  assert.equal(soberDays(s, NOW), 9);
});

test("future drink entries do not affect the streak", () => {
  const s = st();
  s.drinks.push({ id: "f1f2f3f4", at: new Date(NOW.getTime() + D).toISOString(), count: 1, triggers: [], note: "", learned: "" });
  assert.equal(streak(s, NOW).days, 10);
});

test("savings compare against the baseline", () => {
  const s = st();
  assert.equal(baselinePerDay(s.profile), 2);
  let v = savings(s, NOW);
  assert.equal(Math.round(v.drinksAvoided), 20);
  assert.equal(Math.round(v.money), 500);
  assert.equal(Math.round(v.kcal), 3000);
  s.drinks.push({ id: "b1b2b3b4", at: new Date(NOW - D).toISOString(), count: 5, triggers: [], note: "", learned: "" });
  v = savings(s, NOW);
  assert.equal(Math.round(v.drinksAvoided), 15);
  // drinks before the journey start are ignored
  s.drinks.push({ id: "c1c2c3c4", at: new Date(NOW - 30 * D).toISOString(), count: 50, triggers: [], note: "", learned: "" });
  assert.equal(Math.round(savings(s, NOW).drinksAvoided), 15);
});

test("milestones: next target and progress", () => {
  const m = milestones(st(), NOW);
  assert.equal(m.next.d, 14);
  assert.ok(Math.abs(m.progress - 0) < 1e-9); // exactly at the 10-day milestone
  assert.equal(m.list.find(x => x.d === 7).reached, true);
  assert.equal(m.list.find(x => x.d === 14).reached, false);
});

test("AUDIT scoring and zones", () => {
  assert.equal(auditScore([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 0);
  assert.equal(auditScore([4, 4, 4, 4, 4, 4, 4, 4, 4, 4]), 40);
  assert.equal(auditScore([1, 1, 1, 1, 1, 1, 1, 1, 1, 0]), null, "Q9/Q10 only accept 0, 2, 4");
  assert.equal(auditScore([1, 2]), null);
  assert.equal(auditZone(7).tone, "good");
  assert.equal(auditZone(8).tone, "warning");
  assert.equal(auditZone(16).tone, "serious");
  assert.equal(auditZone(20).tone, "critical");
});

test("withdrawal risk screen", () => {
  assert.equal(withdrawalRisk({ daysPerWeek: 2, drinksPerDay: 3 }, {}), false);
  assert.equal(withdrawalRisk({ daysPerWeek: 2, drinksPerDay: 3 }, { symptoms: true }), true);
  assert.equal(withdrawalRisk({ daysPerWeek: 2, drinksPerDay: 3 }, { morning: true }), true);
  assert.equal(withdrawalRisk({ daysPerWeek: 7, drinksPerDay: 8 }, {}), true);
});

test("craving analytics", () => {
  const s = st();
  const c = (daysAgo, outcome, triggers) => ({ id: `c${daysAgo}xxxx${outcome}`, at: new Date(NOW - daysAgo * D).toISOString(), intensity: 6, triggers, coping: ["הליכה"], outcome, durationSec: 600, note: "" });
  s.cravings = [c(0, "passed", ["לחץ"]), c(1, "passed", ["לחץ", "שעמום"]), c(9, "drank", ["לחץ"])];
  const w = cravingWeeks(s, 4, NOW);
  assert.equal(w.length, 4);
  assert.equal(w.reduce((t, x) => t + x.passed + x.drank, 0), 3);
  assert.deepEqual(triggerCounts(s)[0], { t: "לחץ", n: 3 });
});

test("check-in streak and day range", () => {
  const s = st();
  for (let i = 0; i < 4; i++) s.checkins[dayKey(new Date(NOW - i * D))] = { done: true, mood: 4, craving: 1, drank: false, at: NOW.toISOString() };
  assert.equal(checkinStreak(s, NOW), 4);
  const r = dayRange(s, 14, NOW);
  assert.equal(r.length, 14);
  assert.equal(r[13].status, "today");
  assert.equal(r[0].status, "none"); // before the start
});

test("savings goal ETA", () => {
  const s = st({ savingsGoal: { name: "אופניים", price: 1000 } });
  const e = goalEta(s, NOW);
  assert.equal(Math.round(e.saved), 500);
  assert.equal(e.days, 10); // 50₪ a day
});

/* ---------- sanitizing ---------- */

test("clean() rejects hostile and malformed data", () => {
  const out = clean({
    profile: { name: "x".repeat(500), gender: "zz", goal: "drink", startAt: "not a date", costPerDrink: -5, drinksPerDay: "7", reasons: ["a", 5, "", "b"] },
    settings: { theme: "neon", reminder: "25:99", autoLockMin: 3, onboarded: "yes" },
    contacts: [{ id: "<script>", name: "אבא", phone: "javascript:alert(1) 050" }, "junk"],
    checkins: { "2026-13-45": { mood: 3 }, "2026-11-01": { mood: 9, craving: -4, drank: "true" }, __proto__: { mood: 1 } },
    drinks: [{ id: "d1d1d1d1", at: "2026-11-01T10:00:00Z", count: 999 }, { id: "d1d1d1d1", at: "2026-11-01T10:00:00Z", count: 1 }],
    journal: [{ text: "   " }, { text: "שלום", mood: 7 }],
    audits: [{ answers: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9] }],
    plan: { risks: ["a", { evil: 1 }] },
  }, NOW);
  assert.equal(out.profile.name.length, 40);
  assert.equal(out.profile.gender, "m");
  assert.equal(out.profile.goal, "quit");
  assert.ok(!isNaN(Date.parse(out.profile.startAt)));
  assert.equal(out.profile.costPerDrink, 0);
  assert.equal(out.profile.drinksPerDay, 7);
  assert.deepEqual(out.profile.reasons, ["a", "b"]);
  assert.equal(out.settings.theme, "auto");
  assert.equal(out.settings.reminder, "21:00");
  assert.equal(out.settings.autoLockMin, 1);
  assert.equal(out.settings.onboarded, false);
  assert.equal(out.contacts.length, 1);
  assert.match(out.contacts[0].id, /^[a-z0-9]+$/i);
  assert.ok(!/[a-z:]/i.test(out.contacts[0].phone));
  assert.deepEqual(Object.keys(out.checkins), ["2026-11-01"]);
  assert.equal(out.checkins["2026-11-01"].mood, 5);
  assert.equal(out.checkins["2026-11-01"].craving, 0);
  assert.equal(out.checkins["2026-11-01"].drank, false);
  assert.equal(out.drinks.length, 1, "duplicate ids dropped");
  assert.equal(out.drinks[0].count, 60);
  assert.equal(out.journal.length, 1);
  assert.equal(out.journal[0].mood, 5);
  assert.equal(out.audits.length, 0);
  assert.deepEqual(out.plan.risks, ["a"]);
  assert.ok(Array.isArray(out.plan.rewards));
});

test("clean() keeps a valid state unchanged", () => {
  const s = st();
  s.journal.push({ id: "j1j1j1j1", at: NOW.toISOString(), text: "טקסט", mood: 3 });
  assert.deepEqual(clean(JSON.parse(JSON.stringify(s)), NOW), s);
});

/* ---------- crypto + store ---------- */

function memStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    _m: m,
  };
}

test("AES-GCM vault: round trip, wrong PIN fails, tampering fails", async () => {
  const v = await newVaultKey("123456");
  const sealed = await seal(v.key, { salt: v.salt, iterations: v.iterations }, "סוד");
  assert.ok(!sealed.includes("סוד"));
  const r = await unseal(sealed, "123456");
  assert.equal(r.text, "סוד");
  await assert.rejects(unseal(sealed, "654321"));
  const o = JSON.parse(sealed);
  o.ct = o.ct.slice(0, -4) + (o.ct.endsWith("AAAA") ? "BBBB" : "AAAA");
  await assert.rejects(unseal(JSON.stringify(o), "123456"));
});

test("store: persist, lock, unlock, disable lock, wipe", async () => {
  const mem = memStorage();
  const s = createStore(mem);
  assert.equal(s.init(), "empty");
  s.update(x => { x.settings.onboarded = true; x.profile.name = "נועה"; }, { immediate: true });
  await s.flush();
  assert.equal(s.status, "ready");
  assert.match(mem.getItem(KEYS.plain), /נועה/);

  await s.enableLock("4321");
  assert.equal(mem.getItem(KEYS.plain), null);
  assert.ok(!mem.getItem(KEYS.vault).includes("נועה"));

  await s.lock();
  assert.equal(s.state, null);
  assert.equal(s.status, "locked");

  const s2 = createStore(mem);
  assert.equal(s2.init(), "locked");
  await assert.rejects(s2.unlock("0000"), e => e.message === "pin" && e.fails === 1);
  await s2.unlock("4321");
  assert.equal(s2.state.profile.name, "נועה");
  assert.equal(s2.guard().fails, 0);

  s2.update(x => { x.profile.name = "נועה ב"; });
  await s2.flush();
  const s3 = createStore(mem);
  s3.init();
  await s3.unlock("4321");
  assert.equal(s3.state.profile.name, "נועה ב", "changes are re-encrypted on save");

  await s3.disableLock();
  assert.equal(mem.getItem(KEYS.vault), null);
  assert.match(mem.getItem(KEYS.plain), /נועה ב/);

  await s3.wipe();
  assert.equal(mem._m.size, 0);
  assert.equal(s3.status, "empty");
});

test("store: PIN guessing triggers a growing delay", async () => {
  const mem = memStorage();
  const s = createStore(mem);
  s.init();
  s.update(x => { x.settings.onboarded = true; }, { immediate: true });
  await s.enableLock("1111");
  await s.lock();
  const t = createStore(mem);
  t.init();
  for (let i = 1; i <= 5; i++) await assert.rejects(t.unlock("2222"));
  assert.ok(t.guard().until > Date.now(), "locked out after 5 failures");
  await assert.rejects(t.unlock("1111"), e => e.message === "wait");
});

test("store: flush does not overwrite storage when nothing changed", async () => {
  const mem = memStorage();
  const a = createStore(mem);
  a.init();
  a.update(x => { x.settings.onboarded = true; x.profile.name = "A"; }, { immediate: true });
  await a.flush();
  const b = createStore(mem);
  b.init();
  b.update(x => { x.profile.name = "B"; }, { immediate: true });
  await b.flush();
  await a.flush(); // tab A has no unsaved changes and must not clobber B
  assert.match(mem.getItem(KEYS.plain), /"name":"B"/);
});

test("store: import validates format", () => {
  const s = createStore(memStorage());
  s.init();
  assert.throws(() => s.importData("{}"), /format/);
  assert.throws(() => s.importData("not json"));
  const ok = JSON.stringify({ app: "tzalul", data: { profile: { name: "דן" } } });
  s.importData(ok);
  assert.equal(s.state.profile.name, "דן");
  assert.equal(s.status, "ready");
});
