// Shared helpers: safe HTML templating, dates, Hebrew formatting.
// Pure module (no DOM access) so it can be unit-tested in Node.

/* ---------- Safe HTML ---------- */

class SafeHTML {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };

/** Escape any value for use in HTML text or a quoted attribute. */
export function esc(v) {
  if (v == null || v === false) return "";
  return String(v).replace(/[&<>"'`]/g, c => ESC[c]);
}

/** Mark a trusted string (icons, already-built markup) as safe. */
export function raw(s) { return new SafeHTML(String(s ?? "")); }

function part(v) {
  if (v == null || v === false || v === true) return "";
  if (v instanceof SafeHTML) return v.s;
  if (Array.isArray(v)) return v.map(part).join("");
  return esc(v);
}

/**
 * Tagged template: every interpolation is escaped unless it is a SafeHTML
 * (another html`` result or raw()). Arrays are joined.
 */
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
  return new SafeHTML(out);
}

/* ---------- Ids & numbers ---------- */

export function uid() {
  const a = new Uint8Array(9);
  (globalThis.crypto || {}).getRandomValues?.(a);
  return Date.now().toString(36) + Array.from(a, b => (b % 36).toString(36)).join("");
}

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function num(v, lo, hi, fallback) {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return clamp(n, lo, hi);
}

/* ---------- Dates (local time) ---------- */

export const DAY = 86400000;
const pad = n => String(n).padStart(2, "0");

/** Local calendar key YYYY-MM-DD. */
export function dayKey(d = new Date()) {
  d = d instanceof Date ? d : new Date(d);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(key) {
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d) { d = new Date(d); d.setHours(0, 0, 0, 0); return d; }

export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

/** Whole calendar days between two dates (b - a), DST safe. */
export function calDays(a, b) {
  const A = startOfDay(a), B = startOfDay(b);
  return Math.round((B - A) / DAY);
}

export const isDayKey = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && dayKey(parseDay(s)) === s;

/** Value for <input type="datetime-local">. */
export function toLocalInput(d) {
  d = new Date(d);
  return `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function validISO(s) {
  if (typeof s !== "string" || s.length > 40) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/* ---------- Hebrew formatting ---------- */

const NF = new Intl.NumberFormat("he-IL");
const NF1 = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 });
export const fmtNum = n => NF.format(Math.round(n));
export const fmtNum1 = n => NF1.format(n);
export function fmtMoney(n, cur = "₪") { return `${fmtNum(n)} ${cur}`; }

const DF = {
  short: new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short" }),
  long: new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }),
  full: new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" }),
  time: new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" }),
  weekday: new Intl.DateTimeFormat("he-IL", { weekday: "short" }),
  month: new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }),
};
export const fmtDate = (d, k = "short") => DF[k].format(new Date(d));
export const fmtTime = d => DF.time.format(new Date(d));

/**
 * Hebrew count phrase with the dual form:
 * plural(1, U.day) -> "יום אחד", plural(2, U.day) -> "יומיים", plural(5, U.day) -> "5 ימים".
 */
export function plural(n, u) {
  n = Math.round(n);
  if (n === 1) return u.one;
  if (n === 2 && u.two) return u.two;
  return `${fmtNum(n)} ${u.many}`;
}
/** Unit word only, for big counters: unit(1, U.day) -> "יום", unit(5, U.day) -> "ימים". */
export function unit(n, u) { return Math.round(n) === 1 ? u.word : u.many; }

export const U = {
  day: { one: "יום אחד", two: "יומיים", many: "ימים", word: "יום" },
  hour: { one: "שעה", two: "שעתיים", many: "שעות", word: "שעה" },
  minute: { one: "דקה", two: "שתי דקות", many: "דקות", word: "דקה" },
  week: { one: "שבוע", two: "שבועיים", many: "שבועות", word: "שבוע" },
  month: { one: "חודש", two: "חודשיים", many: "חודשים", word: "חודש" },
  year: { one: "שנה", two: "שנתיים", many: "שנים", word: "שנה" },
  drink: { one: "משקה אחד", two: "שני משקאות", many: "משקאות", word: "משקה" },
  time: { one: "פעם אחת", two: "פעמיים", many: "פעמים", word: "פעם" },
};

/** "לפני 3 שעות" style relative phrase. */
export function ago(d, now = new Date()) {
  const ms = now - new Date(d);
  const m = Math.round(ms / 60000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${plural(m, U.minute)}`;
  const h = Math.round(m / 60);
  if (h < 24) return `לפני ${plural(h, U.hour)}`;
  const days = calDays(d, now);
  if (days === 1) return "אתמול";
  if (days < 7) return `לפני ${plural(days, U.day)}`;
  return fmtDate(d, "full");
}

/** Long human duration: "3 חודשים ו-4 ימים". */
export function humanSpan(days) {
  days = Math.floor(days);
  if (days < 1) return "פחות מיום";
  if (days < 14) return plural(days, U.day);
  if (days < 60) {
    const w = Math.floor(days / 7), r = days % 7;
    return r ? `${plural(w, U.week)} ו-${plural(r, U.day)}` : plural(w, U.week);
  }
  if (days < 365) {
    const mo = Math.floor(days / 30), r = days % 30;
    return r ? `${plural(mo, U.month)} ו-${plural(r, U.day)}` : plural(mo, U.month);
  }
  const y = Math.floor(days / 365), r = Math.floor((days - y * 365) / 30);
  return r ? `${plural(y, U.year)} ו-${plural(r, U.month)}` : plural(y, U.year);
}

/**
 * Gendered Hebrew: g(gender, masculine, feminine, plural/neutral).
 * gender 'm' | 'f' | 'n' (neutral -> plural form, the common inclusive choice).
 */
export function g(gender, m, f, n) {
  if (gender === "f") return f;
  if (gender === "n") return n ?? m;
  return m;
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h >= 5 && h < 12) return "בוקר טוב";
  if (h >= 12 && h < 17) return "צהריים טובים";
  if (h >= 17 && h < 22) return "ערב טוב";
  return "לילה טוב";
}

/** Deterministic pick by day (same "quote of the day" all day). */
export function dailyPick(list, d = new Date(), salt = 0) {
  const k = Math.floor(startOfDay(d).getTime() / DAY) + salt;
  return list[((k % list.length) + list.length) % list.length];
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
