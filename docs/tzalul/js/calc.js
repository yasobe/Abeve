// Pure progress calculations. Every function takes the state and "now"
// so it is deterministic and unit-testable.

import { DAY, dayKey, parseDay, addDays, startOfDay, calDays } from "./util.js";
import { MILESTONES, HEALTH, AUDIT, AUDIT_ZONES } from "./content.js";

/** Average drinks per calendar day before starting. */
export function baselinePerDay(p) {
  return (p.drinksPerDay * p.daysPerWeek) / 7;
}

/** Drink entries since the journey start, sorted by time. */
export function drinksSince(state) {
  const start = Date.parse(state.profile.startAt);
  return state.drinks
    .filter(d => Date.parse(d.at) >= start)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** Start of the current alcohol-free streak (journey start or last drink). */
export function streakStart(state, now = new Date()) {
  let s = Date.parse(state.profile.startAt);
  for (const d of state.drinks) {
    const t = Date.parse(d.at);
    if (t > s && t <= now.getTime()) s = t;
  }
  return new Date(s);
}

/** Current streak broken down for the live counter. */
export function streak(state, now = new Date()) {
  const start = streakStart(state, now);
  const ms = Math.max(0, now - start);
  return {
    start,
    ms,
    days: Math.floor(ms / DAY),
    hours: Math.floor((ms % DAY) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    seconds: Math.floor((ms % 60000) / 1000),
    totalDays: ms / DAY,
  };
}

/** Longest streak in days (fractional). */
export function longestStreak(state, now = new Date()) {
  const pts = [Date.parse(state.profile.startAt), ...drinksSince(state).map(d => Date.parse(d.at)), now.getTime()]
    .filter(t => t <= now.getTime());
  let best = 0;
  for (let i = 1; i < pts.length; i++) best = Math.max(best, pts[i] - pts[i - 1]);
  return best / DAY;
}

/** Set of local day keys on which drinking was logged. */
export function drinkDays(state) {
  const s = new Set();
  for (const d of state.drinks) s.add(dayKey(d.at));
  return s;
}

/**
 * Completed calendar days since the start with no drinks logged.
 * The start day counts once it is over; today counts tomorrow.
 */
export function soberDays(state, now = new Date()) {
  const start = new Date(state.profile.startAt);
  const total = calDays(start, now); // completed days from the start day up to yesterday
  if (total <= 0) return 0;
  const dd = drinkDays(state);
  let n = 0;
  for (let i = 0; i < total; i++) if (!dd.has(dayKey(addDays(start, i)))) n++;
  return n;
}

/** Drinks not drunk, money and calories saved, versus the baseline. */
export function savings(state, now = new Date()) {
  const p = state.profile;
  const elapsed = Math.max(0, (now - new Date(p.startAt)) / DAY);
  const expected = baselinePerDay(p) * elapsed;
  const actual = drinksSince(state).reduce((s, d) => s + d.count, 0);
  const avoided = Math.max(0, expected - actual);
  return {
    drinksAvoided: avoided,
    money: avoided * p.costPerDrink,
    kcal: avoided * p.kcalPerDrink,
    drinksActual: actual,
    expected,
    // time a typical drinking session would have taken: ~20 minutes per drink
    hours: (avoided * 20) / 60,
  };
}

/** Milestones with reached/next status for the current streak. */
export function milestones(state, now = new Date()) {
  const days = streak(state, now).totalDays;
  const best = Math.max(longestStreak(state, now), days);
  const next = MILESTONES.find(m => m.d > days) || null;
  const prevD = [...MILESTONES].reverse().find(m => m.d <= days)?.d || 0;
  return {
    list: MILESTONES.map(m => ({ ...m, reached: days >= m.d, ever: best >= m.d })),
    next,
    progress: next ? (days - prevD) / (next.d - prevD) : 1,
    remainingDays: next ? next.d - days : 0,
  };
}

/** Health timeline relative to the current streak. */
export function healthTimeline(state, now = new Date()) {
  const h = streak(state, now).ms / 3600000;
  let prev = 0;
  return HEALTH.map(x => {
    const r = { ...x, reached: h >= x.h, progress: Math.max(0, Math.min(1, (h - prev) / (x.h - prev))) };
    prev = x.h;
    return r;
  });
}

/* ---------- Analytics ---------- */

/** Last N days as {key, date, checkin, drank, cravings}. Oldest first. */
export function dayRange(state, n, now = new Date()) {
  const dd = new Map();
  for (const d of state.drinks) {
    const k = dayKey(d.at);
    dd.set(k, (dd.get(k) || 0) + d.count);
  }
  const cr = new Map();
  for (const c of state.cravings) {
    const k = dayKey(c.at);
    cr.set(k, (cr.get(k) || 0) + 1);
  }
  const startDay = startOfDay(new Date(state.profile.startAt));
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(startOfDay(now), -i);
    const key = dayKey(date);
    const tracked = date >= startDay;
    out.push({
      key, date, tracked,
      checkin: state.checkins[key] || null,
      drinks: dd.get(key) || 0,
      cravings: cr.get(key) || 0,
      status: !tracked ? "none" : dd.get(key) ? "drank" : key === dayKey(now) ? "today" : "sober",
    });
  }
  return out;
}

/** Cravings grouped by week (Sunday-based, Israeli week). Oldest first. */
export function cravingWeeks(state, weeks = 8, now = new Date()) {
  const today = startOfDay(now);
  const sun = addDays(today, -today.getDay());
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const from = addDays(sun, -7 * i), to = addDays(from, 7);
    const inWeek = state.cravings.filter(c => { const t = new Date(c.at); return t >= from && t < to; });
    out.push({
      from,
      passed: inWeek.filter(c => c.outcome !== "drank").length,
      drank: inWeek.filter(c => c.outcome === "drank").length,
      avgIntensity: inWeek.length ? inWeek.reduce((s, c) => s + c.intensity, 0) / inWeek.length : 0,
    });
  }
  return out;
}

/** Trigger frequency, most common first. */
export function triggerCounts(state) {
  const m = new Map();
  for (const c of state.cravings) for (const t of c.triggers) m.set(t, (m.get(t) || 0) + 1);
  for (const d of state.drinks) for (const t of d.triggers || []) m.set(t, (m.get(t) || 0) + 1);
  return [...m.entries()].map(([t, n]) => ({ t, n })).sort((a, b) => b.n - a.n);
}

/** What helped: coping strategies on cravings that passed. */
export function copingCounts(state) {
  const m = new Map();
  for (const c of state.cravings) if (c.outcome !== "drank") for (const t of c.coping) m.set(t, (m.get(t) || 0) + 1);
  return [...m.entries()].map(([t, n]) => ({ t, n })).sort((a, b) => b.n - a.n);
}

export const HOUR_BUCKETS = [
  { t: "בוקר", from: 5, to: 12 },
  { t: "צהריים", from: 12, to: 17 },
  { t: "ערב", from: 17, to: 21 },
  { t: "לילה", from: 21, to: 29 },
];

/** Cravings by part of day. */
export function cravingHours(state) {
  return HOUR_BUCKETS.map(b => ({
    t: b.t,
    n: state.cravings.filter(c => {
      let h = new Date(c.at).getHours();
      if (h < 5) h += 24;
      return h >= b.from && h < b.to;
    }).length,
  }));
}

/** Mood series from check-ins for the last N days (null where missing). */
export function moodSeries(state, n = 30, now = new Date()) {
  return dayRange(state, n, now).map(d => ({ date: d.date, key: d.key, mood: d.checkin?.mood ?? null, craving: d.checkin?.craving ?? null }));
}

/** Consecutive days (ending today or yesterday) with a check-in. */
export function checkinStreak(state, now = new Date()) {
  let d = startOfDay(now);
  if (!state.checkins[dayKey(d)]) d = addDays(d, -1);
  let n = 0;
  while (state.checkins[dayKey(d)]) { n++; d = addDays(d, -1); }
  return n;
}

/** Summary numbers for the craving log. */
export function cravingSummary(state) {
  const all = state.cravings;
  const passed = all.filter(c => c.outcome !== "drank").length;
  return {
    total: all.length,
    passed,
    rate: all.length ? passed / all.length : 0,
    avgIntensity: all.length ? all.reduce((s, c) => s + c.intensity, 0) / all.length : 0,
  };
}

/* ---------- AUDIT ---------- */

export function auditScore(answers) {
  if (!Array.isArray(answers) || answers.length !== AUDIT.length) return null;
  let s = 0;
  for (let i = 0; i < AUDIT.length; i++) {
    const a = answers[i];
    if (!AUDIT[i].o.some(o => o[1] === a)) return null;
    s += a;
  }
  return s;
}

export function auditZone(score) {
  return AUDIT_ZONES.find(z => score <= z.max) || AUDIT_ZONES[AUDIT_ZONES.length - 1];
}

/* ---------- Safety screen ---------- */

/** True when stopping abruptly may need medical supervision. */
export function withdrawalRisk(p, answers = {}) {
  return !!(answers.symptoms || answers.morning || (p.daysPerWeek >= 5 && p.drinksPerDay >= 6));
}

/** Days remaining to afford the savings goal at the baseline rate. */
export function goalEta(state, now = new Date()) {
  const goal = state.savingsGoal;
  if (!goal || !goal.price) return null;
  const saved = savings(state, now).money;
  const perDay = baselinePerDay(state.profile) * state.profile.costPerDrink;
  const left = Math.max(0, goal.price - saved);
  return { saved, left, progress: Math.min(1, saved / goal.price), days: perDay > 0 ? Math.ceil(left / perDay) : null };
}

export { parseDay };
