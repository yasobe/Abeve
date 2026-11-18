// Pure calculations (no DOM, no storage) — unit-tested in tests/tzalul.
import { dayKey, fromDayKey } from "./i18n.js";

export const HOUR = 3600e3, DAY = 24 * HOUR;

const t = x => (x == null ? NaN : new Date(x).getTime());

/** Is the quit date still in the future (preparation / tapering phase)? */
export function isBeforeQuit(profile, now = Date.now()) {
  return t(profile.quitAt) > now;
}

/** Current streak in ms (0 before the quit date). */
export function streakMs(profile, now = Date.now()) {
  const s = t(profile.quitAt);
  return Number.isFinite(s) ? Math.max(0, now - s) : 0;
}

/** All finished attempts plus the current one. */
export function attemptsWithCurrent(state, now = Date.now()) {
  const list = (state.attempts || []).map(a => ({ start: t(a.start), end: t(a.end) }))
    .filter(a => Number.isFinite(a.start) && Number.isFinite(a.end) && a.end > a.start);
  const s = t(state.profile.quitAt);
  if (Number.isFinite(s) && s <= now) list.push({ start: s, end: now, current: true });
  return list;
}

export function totalCleanMs(state, now = Date.now()) {
  return attemptsWithCurrent(state, now).reduce((sum, a) => sum + (a.end - a.start), 0);
}
export function bestStreakMs(state, now = Date.now()) {
  return attemptsWithCurrent(state, now).reduce((m, a) => Math.max(m, a.end - a.start), 0);
}

/** Money / amount / sessions not used over a span of clean time. */
export function savings(profile, ms) {
  const b = profile.baseline || {};
  const d = ms / DAY;
  return {
    money: ((Number(b.costPerWeek) || 0) / 7) * d,
    grams: (Number(b.gramsPerDay) || 0) * d,
    sessions: (Number(b.sessionsPerDay) || 0) * d,
    // ~10 minutes per session is a conservative estimate of time spent using
    hours: ((Number(b.sessionsPerDay) || 0) * d * (Number(b.minutesPerSession) || 10)) / 60,
  };
}

/** Savings across every clean stretch, so a slip never erases what was saved. */
export function totalSavings(state, now = Date.now()) {
  return savings(state.profile, totalCleanMs(state, now));
}

// ---- milestones -----------------------------------------------------------
export const MILESTONES = [
  { h: 1, label: "שעה ראשונה" },
  { h: 12, label: "12 שעות" },
  { h: 24, label: "יום ראשון" },
  { h: 48, label: "יומיים" },
  { h: 72, label: "3 ימים" },
  { h: 24 * 5, label: "5 ימים" },
  { h: 24 * 7, label: "שבוע" },
  { h: 24 * 10, label: "10 ימים" },
  { h: 24 * 14, label: "שבועיים" },
  { h: 24 * 21, label: "3 שבועות" },
  { h: 24 * 30, label: "חודש" },
  { h: 24 * 45, label: "45 ימים" },
  { h: 24 * 60, label: "חודשיים" },
  { h: 24 * 90, label: "90 ימים" },
  { h: 24 * 120, label: "4 חודשים" },
  { h: 24 * 180, label: "חצי שנה" },
  { h: 24 * 270, label: "9 חודשים" },
  { h: 24 * 365, label: "שנה" },
  { h: 24 * 500, label: "500 ימים" },
  { h: 24 * 730, label: "שנתיים" },
  { h: 24 * 1000, label: "1,000 ימים" },
];

export function milestoneInfo(ms) {
  const h = ms / HOUR;
  let prev = null, next = null;
  for (const m of MILESTONES) {
    if (m.h <= h) prev = m;
    else { next = m; break; }
  }
  if (!next) {
    // beyond the table: every further year
    const y = Math.floor(h / (24 * 365)) + 1;
    next = { h: y * 24 * 365, label: `${y} שנים` };
  }
  const from = prev ? prev.h : 0;
  return { prev, next, progress: Math.min(1, Math.max(0, (h - from) / (next.h - from))), remainingMs: Math.max(0, (next.h - h) * HOUR) };
}

// ---- tapering ---------------------------------------------------------------
/**
 * Linear step-down plan from the baseline sessions/day to 0 on the quit date.
 * Returns the target number of sessions for a calendar day key.
 */
export function taperTarget(profile, key) {
  const base = Math.max(0, Number(profile.baseline?.sessionsPerDay) || 0);
  const start = fromDayKey(dayKey(profile.taperStart || profile.createdAt || Date.now())).getTime();
  const end = fromDayKey(dayKey(profile.quitAt)).getTime();
  const d = fromDayKey(key).getTime();
  if (!(end > start) || d >= end) return 0;
  if (d <= start) return base;
  const total = Math.round((end - start) / DAY);
  const i = Math.round((d - start) / DAY);
  // reduce in whole sessions; never below 0, reach 0 on quit day
  return Math.max(0, Math.ceil(base * (1 - i / total) - 1e-9));
}

export function taperPlan(profile) {
  const out = [];
  const start = fromDayKey(dayKey(profile.taperStart || profile.createdAt || Date.now()));
  const end = fromDayKey(dayKey(profile.quitAt));
  for (let d = new Date(start); d <= end && out.length < 400; d.setDate(d.getDate() + 1)) {
    const k = dayKey(d);
    out.push({ key: k, target: taperTarget(profile, k) });
  }
  return out;
}

// ---- check-ins and cravings ---------------------------------------------------
/** Series of the last `n` calendar days (oldest first) with the check-in for each. */
export function daySeries(checkins, n = 30, now = new Date()) {
  const by = new Map(checkins.map(c => [c.date, c]));
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i);
    const k = dayKey(d);
    out.push({ key: k, c: by.get(k) || null });
  }
  return out;
}

export function avg(list) {
  const v = list.filter(x => Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Compare the last 7 days with the 7 before them. */
export function trend(checkins, field, now = new Date()) {
  const s = daySeries(checkins, 14, now);
  const prev = avg(s.slice(0, 7).map(x => x.c?.[field]));
  const cur = avg(s.slice(7).map(x => x.c?.[field]));
  return { cur, prev, delta: cur != null && prev != null ? cur - prev : null };
}

export function cravingStats(cravings) {
  const byHour = Array(24).fill(0);
  const byTrigger = {}, coping = {};
  let resisted = 0;
  for (const c of cravings) {
    const h = new Date(c.ts).getHours();
    if (h >= 0 && h < 24) byHour[h]++;
    if (c.trigger) byTrigger[c.trigger] = (byTrigger[c.trigger] || 0) + 1;
    const ok = c.outcome !== "used";
    if (ok) resisted++;
    for (const k of c.coping || []) {
      coping[k] = coping[k] || { used: 0, ok: 0 };
      coping[k].used++;
      if (ok) coping[k].ok++;
    }
  }
  const topTriggers = Object.entries(byTrigger).sort((a, b) => b[1] - a[1]);
  const bestCoping = Object.entries(coping).map(([k, v]) => ({ k, ...v, rate: v.ok / v.used }))
    .sort((a, b) => b.ok - a.ok || b.rate - a.rate);
  const peakHour = cravings.length ? byHour.indexOf(Math.max(...byHour)) : null;
  return { total: cravings.length, resisted, rate: cravings.length ? resisted / cravings.length : null, byHour, topTriggers, bestCoping, peakHour };
}

/** Consecutive days (ending today or yesterday) with a check-in. */
export function checkinStreak(checkins, now = new Date()) {
  const set = new Set(checkins.map(c => c.date));
  const d = new Date(now); d.setHours(12, 0, 0, 0);
  if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---- achievements -------------------------------------------------------------
export function achievements(state, now = Date.now()) {
  const p = state.profile;
  const streak = streakMs(p, now), best = bestStreakMs(state, now);
  const sav = totalSavings(state, now);
  const resisted = (state.cravings || []).filter(c => c.outcome !== "used").length;
  const ck = (state.checkins || []).length, jr = (state.journal || []).length;
  const tools = new Set((state.toolUses || []).map(x => x.tool));
  const A = (id, icon, title, desc, cur, goal) => ({ id, icon, title, desc, unlocked: cur >= goal, progress: Math.min(1, goal ? cur / goal : 1) });
  const dH = Math.max(streak, best) / HOUR;
  const cost = Number(p.baseline?.costPerWeek) || 0;
  const list = [
    A("decide", "sprout", "ההחלטה", "בחרת להתחיל את הדרך", 1, 1),
    A("h24", "sun", "24 שעות", "יום שלם ראשון", dH, 24),
    A("d3", "mountain", "3 ימים", "עברת את שיא הגמילה", dH, 72),
    A("w1", "star", "שבוע", "שבעה ימים צלולים", dH, 24 * 7),
    A("w2", "wave", "שבועיים", "רוב התסמינים החריפים מאחור", dH, 24 * 14),
    A("m1", "moon", "חודש", "30 ימים — הרגל חדש נבנה", dH, 24 * 30),
    A("m3", "tree", "90 ימים", "שלושה חודשים של בחירה", dH, 24 * 90),
    A("m6", "medal", "חצי שנה", "180 ימים", dH, 24 * 180),
    A("y1", "crown", "שנה", "365 ימים צלולים", dH, 24 * 365),
    A("urge1", "shield", "גלישה ראשונה", "עמדת בחשק אחד", resisted, 1),
    A("urge10", "shield", "10 חשקים", "עמדת ב־10 חשקים", resisted, 10),
    A("urge50", "shield", "50 חשקים", "עמדת ב־50 חשקים", resisted, 50),
    A("ck7", "check", "שבוע של מעקב", "7 צ׳ק־אינים יומיים", ck, 7),
    A("ck30", "check", "חודש של מעקב", "30 צ׳ק־אינים יומיים", ck, 30),
    A("jr1", "pen", "מילים ראשונות", "רשומה ראשונה ביומן", jr, 1),
    A("jr10", "pen", "כותב/ת", "10 רשומות ביומן", jr, 10),
    A("tools3", "spark", "ארגז כלים", "ניסית 3 תרגילים שונים", tools.size, 3),
  ];
  if (cost > 0) {
    list.push(A("save100", "coin", "100 ₪ ראשונים", "חסכת 100 ₪", sav.money, 100));
    list.push(A("save1000", "coin", "1,000 ₪", "חסכת 1,000 ₪", sav.money, 1000));
    list.push(A("save5000", "coin", "5,000 ₪", "חסכת 5,000 ₪", sav.money, 5000));
  }
  return list;
}

// ---- recovery timeline progress -------------------------------------------------
export function timelineProgress(items, ms) {
  const h = ms / HOUR;
  return items.map(it => ({ ...it, progress: Math.min(1, Math.max(0, h / it.h)), done: h >= it.h }));
}

/** Days until a future date (ceil), or 0. */
export function daysUntil(when, now = Date.now()) {
  return Math.max(0, Math.ceil((t(when) - now) / DAY));
}
