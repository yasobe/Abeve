// Hebrew language helpers: gendered addressing, numbers, dates, durations.
// Hebrew verbs and adjectives change with the person addressed. The user picks
// m / f / n (neutral → slash forms such as "מוכן/ה") during onboarding.

let gender = "n";
export function setGender(x) { gender = x === "m" || x === "f" ? x : "n"; }
export function getGender() { return gender; }

/** Pick the right form: g("אתה", "את") or g("מוכן", "מוכנה", "מוכן/ה"). */
export function g(m, f, n) {
  if (gender === "m") return m;
  if (gender === "f") return f;
  if (n != null) return n;
  // "מוכן"/"מוכנה" → "מוכן/ה" (compare with final letters normalized)
  const base = m.replace(/[ךםןףץ]$/, c => FINAL[c]);
  return `${m}/${f.startsWith(base) && f.length > base.length ? f.slice(base.length) : f}`;
}
const FINAL = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };

const nf0 = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 });
export const num = (n, digits = 0) => (digits ? nf1 : nf0).format(Number.isFinite(n) ? n : 0);
export function money(n, cur = "₪") {
  const v = Number.isFinite(n) ? n : 0;
  return `${nf0.format(Math.round(v))} ${cur}`;
}

/** Hebrew plural with dual forms where natural (יומיים, שבועיים, שעתיים). */
export function plural(n, one, two, many, dual) {
  if (n === 1) return one;
  if (n === 2 && dual) return dual;
  return `${num(n)} ${many}`;
}
export const days = n => plural(n, "יום אחד", null, "ימים", "יומיים");
export const hours = n => plural(n, "שעה אחת", null, "שעות", "שעתיים");
export const minutes = n => plural(n, "דקה אחת", null, "דקות", "שתי דקות");
export const weeks = n => plural(n, "שבוע אחד", null, "שבועות", "שבועיים");
export const months = n => plural(n, "חודש אחד", null, "חודשים", "חודשיים");

/** Short human duration for a number of milliseconds: "3 ימים ו־4 שעות". */
export function duration(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d >= 1) return h ? `${days(d)} ו־${hours(h)}` : days(d);
  if (h >= 1) return mm ? `${hours(h)} ו־${minutes(mm)}` : hours(h);
  return mm ? minutes(mm) : "פחות מדקה";
}

const df = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" });
const dfShort = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short" });
const dfDay = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" });
const tf = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
export const dateLong = d => df.format(new Date(d));
export const dateShort = d => dfShort.format(new Date(d));
export const dateDay = d => dfDay.format(new Date(d));
export const time = d => tf.format(new Date(d));

/** Local calendar day key "YYYY-MM-DD" (not UTC). */
export function dayKey(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
export function fromDayKey(k) {
  const [y, m, d] = String(k).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function relDay(k) {
  const today = dayKey();
  if (k === today) return "היום";
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (k === dayKey(y)) return "אתמול";
  return dateDay(fromDayKey(k));
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return "לילה טוב";
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  if (h < 21) return "ערב טוב";
  return "לילה טוב";
}

/** Inline gender markers in content: "{מוכן|מוכנה}" → g("מוכן","מוכנה"). */
export function gx(s) {
  return String(s).replace(/\{([^|{}]*)\|([^|{}]*)\}/g, (_, m, f) => g(m, f));
}
