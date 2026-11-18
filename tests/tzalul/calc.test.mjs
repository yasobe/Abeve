import test from "node:test";
import assert from "node:assert/strict";
import { mod } from "./setup.mjs";
const C = await mod("js/calc.js");
const { dayKey } = await mod("js/i18n.js");
const { defaults } = await mod("js/store.js");

const D = 864e5, H = 3600e3;
const NOW = new Date("2026-06-15T12:00:00").getTime();
function state(over = {}) {
  const s = defaults();
  s.profile.quitAt = new Date(NOW - 10 * D).toISOString();
  s.profile.baseline = { sessionsPerDay: 4, gramsPerDay: 1, costPerWeek: 350, minutesPerSession: 15, years: 2, methods: [] };
  return Object.assign(s, over);
}

test("streak counts from quit date and is 0 before it", () => {
  const s = state();
  assert.equal(C.streakMs(s.profile, NOW), 10 * D);
  s.profile.quitAt = new Date(NOW + D).toISOString();
  assert.equal(C.streakMs(s.profile, NOW), 0);
  assert.equal(C.isBeforeQuit(s.profile, NOW), true);
});

test("total and best streak include previous attempts", () => {
  const s = state({ attempts: [{ start: new Date(NOW - 40 * D).toISOString(), end: new Date(NOW - 20 * D).toISOString() }] });
  assert.equal(C.totalCleanMs(s, NOW), 30 * D);
  assert.equal(C.bestStreakMs(s, NOW), 20 * D);
});

test("savings are proportional to clean time", () => {
  const s = state();
  const v = C.savings(s.profile, 7 * D);
  assert.equal(Math.round(v.money), 350);
  assert.equal(Math.round(v.sessions), 28);
  assert.equal(Math.round(v.grams), 7);
  assert.equal(v.hours, 7); // 28 sessions × 15 min
  assert.equal(Math.round(C.totalSavings(s, NOW).money), 500);
});

test("milestone info finds previous and next milestone", () => {
  const m = C.milestoneInfo(30 * H);
  assert.equal(m.prev.h, 24);
  assert.equal(m.next.h, 48);
  assert.ok(Math.abs(m.progress - 0.25) < 1e-9);
  assert.equal(m.remainingMs, 18 * H);
  const far = C.milestoneInfo(1200 * D);
  assert.ok(far.next.h > 1200 * 24);
  assert.equal(C.milestoneInfo(0).prev, null);
});

test("taper plan steps down from baseline to zero on quit day", () => {
  const p = state().profile;
  p.taperStart = new Date("2026-06-01T10:00:00").toISOString();
  p.quitAt = new Date("2026-06-11T00:00:00").toISOString();
  const plan = C.taperPlan(p);
  assert.equal(plan.length, 11);
  assert.equal(plan[0].target, 4);
  assert.equal(plan.at(-1).target, 0);
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i].target <= plan[i - 1].target, "never increases");
  assert.equal(C.taperTarget(p, "2026-07-01"), 0);
  assert.equal(C.taperTarget(p, "2026-05-01"), 4);
});

test("daySeries, trend and check-in streak", () => {
  const now = new Date(NOW);
  const k = i => dayKey(new Date(NOW - i * D));
  const checkins = [];
  for (let i = 13; i >= 0; i--) checkins.push({ date: k(i), mood: i >= 7 ? 2 : 4, sleep: 3, craving: 5 });
  const s = C.daySeries(checkins, 14, now);
  assert.equal(s.length, 14);
  assert.equal(s.at(-1).key, k(0));
  const t = C.trend(checkins, "mood", now);
  assert.equal(t.prev, 2);
  assert.equal(t.cur, 4);
  assert.equal(t.delta, 2);
  assert.equal(C.checkinStreak(checkins, now), 14);
  assert.equal(C.checkinStreak(checkins.slice(0, -1), now), 13, "streak may end yesterday");
  assert.equal(C.checkinStreak(checkins.slice(0, -2), now), 0);
});

test("craving stats: peak hour, triggers, coping success", () => {
  const at = h => new Date(2026, 5, 10, h, 0).toISOString();
  const cr = [
    { ts: at(21), trigger: "evening", coping: ["walk"], outcome: "resisted" },
    { ts: at(21), trigger: "evening", coping: ["walk", "tea"], outcome: "resisted" },
    { ts: at(9), trigger: "stress", coping: ["tea"], outcome: "used" },
  ];
  const s = C.cravingStats(cr);
  assert.equal(s.total, 3);
  assert.equal(s.resisted, 2);
  assert.equal(s.peakHour, 21);
  assert.deepEqual(s.topTriggers[0], ["evening", 2]);
  assert.equal(s.bestCoping[0].k, "walk");
  assert.equal(s.bestCoping[0].rate, 1);
  assert.equal(C.cravingStats([]).rate, null);
});

test("achievements unlock by time, cravings and money", () => {
  const s = state({ cravings: [{ ts: new Date(NOW).toISOString(), outcome: "resisted" }] });
  const a = Object.fromEntries(C.achievements(s, NOW).map(x => [x.id, x]));
  assert.equal(a.w1.unlocked, true);
  assert.equal(a.w2.unlocked, false);
  assert.ok(a.w2.progress > 0.7 && a.w2.progress < 0.72);
  assert.equal(a.urge1.unlocked, true);
  assert.equal(a.save100.unlocked, true);
  s.profile.baseline.costPerWeek = 0;
  assert.ok(!C.achievements(s, NOW).some(x => x.id === "save100"), "no money badges without a cost");
});

test("timeline progress", () => {
  const items = C.timelineProgress([{ h: 24 }, { h: 72 }], 48 * H);
  assert.equal(items[0].done, true);
  assert.equal(items[1].done, false);
  assert.ok(Math.abs(items[1].progress - 2 / 3) < 1e-9);
});
