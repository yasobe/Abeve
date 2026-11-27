// Shaar (שער), rules version: the same Edge Function without Claude and without any API key.
// The gate asks one fixed question and decides with fixed lists and limits, here in this file.
//
// Deploy it under the SAME name as the AI version, "shaar" (it replaces it). Paste this whole file
// into the dashboard editor, or from a laptop:
//   cp supabase/functions/shaar-rules/index.ts supabase/functions/shaar/index.ts   (in a scratch copy)
//   supabase functions deploy shaar --no-verify-jwt
// Secrets: SHAAR_TOKEN only  [optional: SHAAR_APP_URL, SHAAR_ALLOW_ORIGINS]
//
// Same HTTP surface, same database function (shaar_api) and same web app as the AI version:
//   GET  /shaar/s/open/<app>?k=TOKEN   → "ok" | "<minutes>" | "https://…" (gate or lock page)
//   GET  /shaar/s/close/<app>?k=TOKEN  → "ok"
//   GET  /shaar/s/check?k=TOKEN        → setup check, plain Hebrew lines
//   POST /shaar/api/<action>           → JSON
// The time contract, the penalty locks and the cooldown live in supabase/shaar.sql and are unchanged.
//
// How the gate decides (first match wins; see decideGate):
//   1. my rules say this app is blocked now, or outside its hours        → wait 5 min, then 2–3 min
//   2. today's declared minutes reached the daily limit                   → wait 5 min, then 3 min
//   3. the answer hits the "not a purpose" list (סתם, משעמם, לגלול…)      → wait (longer when busy)
//   4. a contract was broken in the last hour                             → wait 2 min+, then short
//   5. the answer hits the purpose list (לענות, לחפש, הרצאה…)             → pass, minutes by kind
//   6. anything else                                                     → the one fixed follow-up
//      question; its answer passes if it is a purpose or a concrete sentence, otherwise wait.
//   Night hours and many visits today make waits longer and turn the follow-up question into a wait.

declare const Deno: any;

export const ENGINE = "rules";
const ENGINE_VERSION = "rules-v1";
const DEFAULT_APP_URL = "https://yasobe.github.io/Abeve/shaar/";

export const APP_NAMES: Record<string, string> = {
  instagram: "אינסטגרם", tiktok: "טיקטוק", youtube: "יוטיוב", facebook: "פייסבוק",
  x: "X", twitter: "X", reddit: "רדיט", threads: "Threads", snapchat: "סנאפצ׳ט",
  netflix: "נטפליקס", whatsapp: "וואטסאפ", telegram: "טלגרם",
};
const appName = (a: string) => APP_NAMES[a] || a;
// extra Hebrew spellings accepted in my rules
const APP_ALIASES: Record<string, string> = {
  "אינסטה": "instagram", "אינסטגרם": "instagram", "טיקטוק": "tiktok", "טיק טוק": "tiktok",
  "יוטיוב": "youtube", "יו טיוב": "youtube", "פייסבוק": "facebook", "טוויטר": "x", "איקס": "x",
  "רדיט": "reddit", "רדאיט": "reddit", "תרדס": "threads", "סנאפצ׳ט": "snapchat", "סנאפצ'ט": "snapchat",
  "סנפצ׳ט": "snapchat", "סנפצ'ט": "snapchat", "נטפליקס": "netflix", "וואטסאפ": "whatsapp", "ווטסאפ": "whatsapp",
  "טלגרם": "telegram",
};

// ------------------------------------------------------------------ the fixed lists
// Phrases are matched as substrings of the normalised answer (no niqqud, no punctuation, lower case).
export const NOT_A_PURPOSE = [
  "סתם", "משעמם", "שעמום", "משועמם", "משועממת", "רק לבדוק", "רק להציץ", "להציץ", "לגלול", "גלילה",
  "לא יודע", "לא יודעת", "אין לי מה לעשות", "כלום", "לברוח", "בורח", "בורחת", "להירגע", "להתפרק",
  "הרגל", "מתוך הרגל", "נמאס", "עייף", "עייפה", "להעביר את הזמן", "להעביר זמן", "מה חדש", "מה קורה שם",
  "לראות סטוריז", "רילס", "ריל ", "שורטס", "פיד", "לדחות", "דוחה משהו", "בלי סיבה", "אוטומטי",
  "bored", "idk", "nothing", "scroll", "just checking",
];
type Kind = { name: string; minutes: number; words: string[] };
export const PURPOSES: Kind[] = [
  { name: "הודעה", minutes: 3, words: [
    "לענות", "להגיב", "לשלוח", "הודעה", "להודיע", "לאשר", "לשאול את", "לשאול מה", "לברך", "לתאם",
    "דיירקט", "dm", "תגובה ל", "לכתוב ל", "reply", "message"] },
  { name: "חיפוש", minutes: 5, words: [
    "לחפש", "למצוא", "לבדוק את", "לבדוק מה", "לבדוק מתי", "לבדוק איפה", "כתובת", "שעות פתיחה", "מספר טלפון",
    "מתכון", "מדריך", "הוראות", "מחיר", "לקנות", "להזמין", "כרטיס", "מסלול", "לשמור את", "search", "find"] },
  { name: "פרסום", minutes: 5, words: [
    "לפרסם", "להעלות", "לשתף", "פוסט", "לערוך את", "תמונה של", "post", "upload"] },
  { name: "צפייה מסוימת", minutes: 15, words: [
    "הרצאה", "שיעור", "קורס", "פרק ", "הדרכה", "סרטון של", "הסרטון ש", "תרגיל", "אימון", "שיר של", "lecture", "tutorial"] },
  { name: "עבודה", minutes: 10, words: [
    "לקוח", "ללקוח", "לעבודה", "בעבודה", "פרויקט", "מבחן", "מטלה", "לימודים", "משימה", "work"] },
];
// The one fixed follow-up question, asked when the first answer is not on either list.
export const FOLLOW_UP = { m: "מה בדיוק תעשה שם, ואיך תדע שסיימת?", f: "מה בדיוק תעשי שם, ואיך תדעי שסיימת?" };

// Defaults for limits that my rules can change.
export const DEFAULT_LIMITS = {
  night: [23 * 60, 6 * 60] as [number, number],  // 23:00–06:00
  dailyMinutes: 90,    // declared contract minutes per day, all apps together
  busyAttempts: 6,     // from the 7th answered gate visit today, waits grow and the question becomes a wait
};

// ------------------------------------------------------------------ errors
export class ApiError extends Error {
  code: string; status: number; extra?: Record<string, unknown>;
  constructor(code: string, status = 400, message = code, extra?: Record<string, unknown>) {
    super(message); this.code = code; this.status = status; this.extra = extra;
  }
}
const ERROR_STATUS: Record<string, number> = {
  locked: 409, wait: 409, need_answer: 409, stale: 409, bad_state: 409, too_soon: 409,
  not_locked: 409, no_credit: 409, not_found: 404,
};

// ------------------------------------------------------------------ helpers
function safeEqual(a: string, b: string) {
  if (!a || !b) return false;
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}
const clean = (v: unknown, max: number) =>
  String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
function cleanApp(v: unknown) {
  const a = String(v ?? "").toLowerCase();
  if (!/^[a-z0-9_-]{1,32}$/.test(a)) throw new ApiError("bad_app");
  return a;
}
const int = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};
const id = (v: unknown) => int(v, 0, Number.MAX_SAFE_INTEGER, 0);
const minsAgo = (iso: string | null | undefined, now: Date) =>
  iso ? Math.round((now.getTime() - new Date(iso).getTime()) / 60000) : null;
const g = (form: string, m: string, f: string) => (form === "f" ? f : m);

/** Lower case, no niqqud, Hebrew geresh unified, punctuation → spaces, single spaces, padded. */
export function norm(s: unknown) {
  return " " + String(s ?? "").toLowerCase()
    .replace(/[֑-ׇ]/g, "")
    .replace(/[׳`’]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ").trim() + " ";
}
const words = (s: string) => norm(s).trim().split(" ").filter(Boolean);
// A phrase matches anywhere (Hebrew glues prefixes like ו/ה/ל/ב to words); a trailing space in the
// phrase means "word ends here"; Latin phrases must be whole words.
const pattern = (w: string) => {
  const n = norm(w).trim();
  if (!n) return "";
  if (/^[a-z0-9' ]+$/.test(n)) return ` ${n} `;
  return w.endsWith(" ") ? `${n} ` : n;
};
export const hits = (text: string, list: string[]) => list.filter((w) => { const p = pattern(w); return !!p && text.includes(p); });

/** Minutes since local midnight in the given time zone. */
export function localMinutes(now: Date, tz: string) {
  try {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const h = Number(p.find((x) => x.type === "hour")?.value), m = Number(p.find((x) => x.type === "minute")?.value);
    if (Number.isFinite(h) && Number.isFinite(m)) return h * 60 + m;
  } catch { /* fall through */ }
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}
const inWindow = (t: number, [a, b]: [number, number]) => (a <= b ? t >= a && t < b : t >= a || t < b);
// "מ-20:00 עד 23:30" reads right in RTL (a bare "20:00–23:30" gets flipped)
const span = ([a, b]: [number, number]) => `מ-${hhmm(a)} עד ${hhmm(b)}`;
const hhmm = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
/** "20", "20:00", "9:30" → minutes since midnight; "24:00" → 1440 (only useful as an end). */
const parseTime = (s: string): number | null => {
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(s.trim());
  if (!m) return null;
  const h = +m[1], mi = +(m[2] || 0);
  if (h > 24 || mi > 59 || (h === 24 && mi > 0)) return null;
  return h * 60 + mi;
};
const RANGE = /^(\d{1,2}(?::\d{2})?)\s*-\s*(\d{1,2}(?::\d{2})?)$/;
const parseRange = (s: string): [number, number] | null => {
  const w = RANGE.exec(s.trim());
  const a = w ? parseTime(w[1]) : null, b = w ? parseTime(w[2]) : null;
  return a !== null && b !== null && a !== b ? [a % 1440, b] : null;
};

// ------------------------------------------------------------------ my rules (the settings text box)
// One rule per line, "key: value". Lines it doesn't understand are listed back as not understood.
//   מותר: הרצאה, מתכון          more phrases that count as a purpose (pass, 5 min)
//   אסור: חדשות, כדורגל         more phrases that never count (wait)
//   יוטיוב: 20:00-23:30         this app only in these hours (also: "יוטיוב רק אחרי 20:00" / "רק לפני 9:00")
//   טיקטוק: חסום                 this app always waits the longest wait
//   אינסטגרם: 5 דקות            at most this long per entry for this app
//   לילה: 23:00-06:00           night hours (stricter); "לילה: בלי" turns it off
//   דקות ביום: 60               daily limit of declared minutes, all apps together
//   כניסות ביום: 6              after this many answered visits today, stricter
export type AppRule = { window?: [number, number]; blocked?: boolean; max?: number };
export type Rules = {
  allow: string[]; deny: string[]; apps: Record<string, AppRule>;
  night: [number, number] | null; dailyMinutes: number; busyAttempts: number; unknown: string[];
};

function appKey(s: string): string | null {
  const t = s.trim().toLowerCase();
  if (/^[a-z0-9_-]{1,32}$/.test(t)) return t;
  const n = norm(t).trim();
  for (const [alias, key] of Object.entries(APP_ALIASES)) if (norm(alias).trim() === n) return key;
  return null;
}
const list = (v: string) => v.split(/[,،;]/).map((x) => x.trim()).filter((x) => x.length >= 2).slice(0, 40);

export function parseRules(text: unknown): Rules {
  const r: Rules = { allow: [], deny: [], apps: {}, night: [...DEFAULT_LIMITS.night] as [number, number],
    dailyMinutes: DEFAULT_LIMITS.dailyMinutes, busyAttempts: DEFAULT_LIMITS.busyAttempts, unknown: [] };
  const app = (k: string) => (r.apps[k] ??= {});
  for (const raw of String(text ?? "").split(/\n|(?<=[.])\s+/)) {
    const line = raw.replace(/[.]+$/, "").replace(/[–—]/g, "-").trim();
    if (!line || line.startsWith("#")) continue;
    // "<app> רק אחרי HH:MM" / "<app> רק לפני HH:MM" / "<app> רק בין HH:MM ל-HH:MM"
    let m = /^(.+?)\s+רק\s+(אחרי|לפני|בין)\s+(\d{1,2}(?::\d{2})?)(?:\s*(?:ל-?|עד|-)\s*(\d{1,2}(?::\d{2})?))?$/.exec(line);
    if (m && appKey(m[1])) {
      const a = parseTime(m[3]), b = m[4] ? parseTime(m[4]) : null;
      if (a !== null && (m[2] !== "בין" || b !== null)) {
        app(appKey(m[1])!).window = m[2] === "אחרי" ? [a, 24 * 60] : m[2] === "לפני" ? [0, a] : [a, b!];
        continue;
      }
    }
    m = /^([^:]+):\s*(.*)$/.exec(line);
    if (!m) { r.unknown.push(line.slice(0, 80)); continue; }
    const key = m[1].trim(), val = m[2].trim(), nk = norm(key).trim();
    if (["מותר", "מותרות", "מילים מותרות", "מטרות", "allow"].includes(nk)) { r.allow.push(...list(val)); continue; }
    if (["אסור", "אסורות", "מילים אסורות", "לא מטרה", "deny"].includes(nk)) { r.deny.push(...list(val)); continue; }
    if (nk === "לילה" || nk === "night") {
      if (/^(בלי|לא|כבוי|off)$/.test(val)) { r.night = null; continue; }
      const w = parseRange(val);
      if (w) { r.night = w; continue; }
    }
    if (["דקות ביום", "מקסימום ביום", "זמן ביום"].includes(nk) && /^\d+/.test(val)) {
      r.dailyMinutes = int(parseInt(val), 1, 24 * 60, DEFAULT_LIMITS.dailyMinutes); continue;
    }
    if (["כניסות ביום", "ביקורים ביום"].includes(nk) && /^\d+/.test(val)) {
      r.busyAttempts = int(parseInt(val), 1, 100, DEFAULT_LIMITS.busyAttempts); continue;
    }
    const ak = appKey(key);
    if (ak) {
      if (/^(חסום|חסומה|אסור|לא|blocked?)$/.test(val)) { app(ak).blocked = true; continue; }
      const w = parseRange(val);
      if (w) { app(ak).window = w; continue; }
      const mx = /^(\d+)\s*(דק|דקות|דק׳|דק'|min)?/.exec(val);
      if (mx) { app(ak).max = int(mx[1], 1, 120, 5); continue; }
    }
    r.unknown.push(line.slice(0, 80));
  }
  return r;
}

/** What the gate understood from my rules, as short Hebrew lines (shown in the settings screen). */
export function describeRules(r: Rules): string[] {
  const out: string[] = [];
  for (const [k, a] of Object.entries(r.apps)) {
    if (a.blocked) out.push(`${appName(k)}: חסום (המתנה ארוכה בכל כניסה)`);
    if (a.window) out.push(`${appName(k)}: רק ${span(a.window)}`);
    if (a.max) out.push(`${appName(k)}: עד ${a.max} דק׳ בכל כניסה`);
  }
  if (r.allow.length) out.push(`נחשב מטרה: ${r.allow.join(", ")}`);
  if (r.deny.length) out.push(`לא נחשב מטרה: ${r.deny.join(", ")}`);
  out.push(r.night ? `לילה: ${span(r.night)}` : "לילה: כבוי");
  out.push(`עד ${r.dailyMinutes} דק׳ ביום · מחמיר אחרי ${r.busyAttempts} כניסות`);
  for (const u of r.unknown) out.push(`לא הבנתי: "${u}"`);
  return out;
}

// ------------------------------------------------------------------ the gate
type Qa = { question: string; answer: string; id?: number };
export type GateDecision = {
  decision: "pass" | "wait" | "ask"; message: string; question: string;
  wait_seconds: number; max_minutes: number; model: string; latency_ms: number; ai_ok: boolean; reason: string;
};

export function classify(text: string, rules: Rules) {
  const t = norm(text);
  const deny = hits(t, [...NOT_A_PURPOSE, ...rules.deny]);
  if (deny.length) return { kind: "vague" as const, minutes: 0, label: deny[0] };
  if (hits(t, rules.allow).length) return { kind: "purpose" as const, minutes: 5, label: "מותר" };
  for (const k of PURPOSES) if (hits(t, k.words).length) return { kind: "purpose" as const, minutes: k.minutes, label: k.name };
  return { kind: "unclear" as const, minutes: 0, label: "" };
}

export function decideGate(st: any, app: string, intent: string, qa?: Qa): GateDecision {
  const s = st.settings || {}, stats = st.stats || {}, form = s.form || "m";
  const now = new Date(st.now || Date.now());
  const rules = parseRules(s.rules);
  const ar = rules.apps[app] || {};
  const cap = Math.min(int(s.max_minutes_cap, 1, 120, 30), ar.max ?? 120);
  const t = localMinutes(now, s.tz || "Asia/Jerusalem");
  const night = !!rules.night && inWindow(t, rules.night);
  const attempts = int(stats.attempts, 0, 1e6, 0);
  const busy = attempts >= rules.busyAttempts;
  const lp = st.last_pass;
  const brokeAgo = lp && lp.status === "broken" ? minsAgo(lp.settled_at, now) : null;
  const brokeRecently = brokeAgo !== null && brokeAgo < 60;

  // a wait grows with how busy today is, at night, and after a broken contract
  const waitFor = (base: number) => {
    let w = base + 15 * Math.max(0, attempts - 3);
    if (night) w *= 1.5;
    if (brokeRecently) w += 120;
    return int(w, 30, 300, 60);
  };
  const out = (decision: GateDecision["decision"], message: string, reason: string, o: Partial<GateDecision> = {}): GateDecision => ({
    decision, message, question: "", wait_seconds: 0, max_minutes: Math.min(cap, 5),
    model: ENGINE_VERSION, latency_ms: 0, ai_ok: false, reason, ...o,
  });
  const wait = (message: string, reason: string, seconds: number, max = 3) =>
    out("wait", message, reason, { wait_seconds: seconds, max_minutes: Math.min(cap, max) });

  // 1. my rules about this app
  if (ar.blocked) return wait(`לפי הכללים שלך, ${appName(app)} חסום. אם עדיין צריך, אחרי ההמתנה ולרגע קצר.`, "app_blocked", 300, 2);
  if (ar.window && !inWindow(t, ar.window))
    return wait(`לפי הכללים שלך, ${appName(app)} רק ${span(ar.window)}. עכשיו ${hhmm(t)}.`, "app_hours", 300, 3);
  // 2. daily minutes
  const usedToday = int(stats.minutes, 0, 1e6, 0);
  if (usedToday >= rules.dailyMinutes)
    return wait(`כבר ${usedToday} דק׳ היום, מתוך ${rules.dailyMinutes}. רק אם זה באמת לא יכול לחכות למחר.`, "daily_minutes", 300, 3);

  const c = classify(qa ? qa.answer : intent, rules);
  // 3. not a purpose
  if (c.kind === "vague")
    return wait(night
      ? g(form, "נשמע כמו עייפות של לילה. כוס מים, ותחליט שוב כשהספירה נגמרת.", "נשמע כמו עייפות של לילה. כוס מים, ותחליטי שוב כשהספירה נגמרת.")
      : g(form, "זה לא נשמע כמו מטרה. קום לרגע, נשום, ואז תחליט.", "זה לא נשמע כמו מטרה. קומי לרגע, נשמי, ואז תחליטי."),
      "not_a_purpose", waitFor(60), 3);
  // 4. a broken contract in the last hour
  if (brokeRecently)
    return wait(`החוזה האחרון נשבר לפני ${Math.max(1, brokeAgo!)} דק׳. קודם הפסקה, ואז כניסה קצרה.`, "recent_broken", waitFor(60), 3);

  // 5. a purpose
  const minutes = Math.max(1, Math.min(cap, night ? Math.min(c.minutes || 5, 5) : c.minutes || 5));
  if (c.kind === "purpose")
    return out("pass", busy
      ? `מטרה ברורה (${c.label}). כבר ${attempts} כניסות היום, אז קצר ולעניין.`
      : `מטרה ברורה (${c.label}). ${g(form, "תעשה את זה ותצא.", "תעשי את זה ותצאי.")}`, "purpose", { max_minutes: busy ? Math.min(minutes, 3) : minutes });

  // 6. unclear: the first round asks the one fixed question; the answer round decides
  if (!qa) {
    if (night || busy)
      return wait(night ? "לא ברור מה צריך שם, ועכשיו לילה. רגע של שקט קודם." : `לא ברור מה צריך שם, וכבר ${attempts} כניסות היום.`,
        night ? "unclear_night" : "unclear_busy", waitFor(90), 3);
    return out("ask", "רגע לפני.", "unclear", { question: FOLLOW_UP[form === "f" ? "f" : "m"] });
  }
  const w = words(qa.answer);
  if (w.length >= 4 && norm(qa.answer).trim().length >= 18)
    return out("pass", "בסדר, יש תוכנית. קצר ולעניין.", "concrete_answer", { max_minutes: Math.min(cap, 5) });
  return wait(g(form, "עדיין לא ברור מה תעשה שם. דקה של המתנה, ואז תחליט.", "עדיין לא ברור מה תעשי שם. דקה של המתנה, ואז תחליטי."),
    "unclear_answer", waitFor(60), 3);
}

// ------------------------------------------------------------------ effort: fixed steps, fixed check
const NUDGES = ["רק להתחיל.", "קטן מספיק כדי להתחיל עכשיו.", "חמש דקות, לא יותר.", "הצעד הראשון הוא הכי קשה.", "בלי לסיים, רק לזוז."];

export function coachStep(ctx: any) {
  const s = ctx.settings || {}, form = s.form || "m";
  const title = clean(ctx.task?.title, 120) || "המשימה";
  const hist: any[] = ctx.history || [];
  const accepted = hist.filter((h) => h.accepted === true);
  const last = accepted[accepted.length - 1];
  const n = accepted.length;
  const base = { model: ENGINE_VERSION, ai_ok: false, nudge: NUDGES[(hist.length + title.length) % NUDGES.length] };
  if (n === 0)
    return { ...base, minutes: 2,
      step: `${g(form, "כתוב", "כתבי")} בשורה אחת מה הפעולה הפיזית הבאה ב"${title}" (מה, איפה, עם מה).`,
      done_when: "השורה כתובה: אפשר להדביק אותה בדיווח." };
  const prev = clean(last?.report, 90);
  if (n === 1)
    return { ...base, minutes: 5,
      step: `${g(form, "שים", "שימי")} טיימר ל-5 דקות ${g(form, "ותעשה", "ותעשי")}: ${prev ? `"${prev}"` : `את הפעולה הבאה ב"${title}"`}.`,
      done_when: "משפט אחד על מה שנעשה בפועל (מה נפתח, נכתב, נשלח)." };
  return { ...base, minutes: 10,
    step: `עוד 10 דקות על "${title}", בדיוק מהמקום שעצרת${prev ? ` ("${prev}")` : ""}. בלי להחליף מסך.`,
    done_when: "מה התקדם, בפרט אחד קונקרטי." };
}

export const NOT_DONE = ["לא עשיתי", "לא הספקתי", "לא הצלחתי", "עוד לא", "אחר כך", "מחר", "לא היה לי", "דילגתי", "not yet", "didnt", "didn't"];
const BARE_DONE = ["עשיתי", "סיימתי", "בוצע", "כן", "done", "ok", "אוקי", "עשיתי את זה", "סיימתי את זה", "עשיתי הכל", "הכל"];

export function judgeReport(gs: any, report: string) {
  const s = gs.settings || {}, form = s.form || "m";
  const t = norm(report), w = words(report);
  if (hits(t, NOT_DONE).length)
    return { accepted: false, ai_ok: false, feedback: `זה בסדר. ${g(form, "תעשה", "תעשי")} את הצעד, ואז ${g(form, "תדווח", "תדווחי")} מה נעשה.` };
  if (BARE_DONE.some((b) => norm(b) === t) || w.length < 3 || t.trim().length < 12)
    return { accepted: false, ai_ok: false, feedback: "צריך עוד פרט אחד: מה בדיוק נפתח, נכתב או נשלח?" };
  if (norm(gs.step) === t)
    return { accepted: false, ai_ok: false, feedback: "זה הצעד עצמו. מה נעשה בפועל?" };
  return { accepted: true, ai_ok: false, feedback: `נרשם: ${w.length} מילים של מאמץ אמיתי. הצעד הבא יהיה קצת יותר ארוך.` };
}

// ------------------------------------------------------------------ the handler
export type Deps = {
  env: { token: string; appUrl: string; allowOrigins: string[] };
  rpc: (action: string, args?: Record<string, unknown>) => Promise<any>;
};

export function createHandler(deps: Deps) {
  const appUrl = deps.env.appUrl || DEFAULT_APP_URL;
  const origins = new Set([new URL(appUrl).origin, ...deps.env.allowOrigins]);
  const tokenOk = (k: unknown) => deps.env.token.length >= 16 && safeEqual(String(k ?? ""), deps.env.token);

  const cors = (req: Request): Record<string, string> => {
    const o = req.headers.get("origin") || "";
    return origins.has(o)
      ? { "Access-Control-Allow-Origin": o, "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "content-type", "Access-Control-Max-Age": "600", Vary: "Origin" }
      : { Vary: "Origin" };
  };
  const text = (body: string, status = 200) =>
    new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  const json = (req: Request, body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  const page = (view: string, app: string, k: string) =>
    `${appUrl}?a=${view}&app=${encodeURIComponent(app)}#k=${encodeURIComponent(k)}`;
  // the web app reads these to show the rules wording (no "Claude" texts, the parsed rules)
  const withEngine = (settings: any) => ({ ...settings, engine: ENGINE, rules_summary: describeRules(parseRules(settings?.rules)) });

  async function shortcut(kind: string, appRaw: string, k: string) {
    // The Shortcut never gets an error status: a failed call must not stop the app from opening
    // and must never bounce between the app and the gate.
    if (!tokenOk(k)) return text(kind === "open" ? `${appUrl}?a=err&e=auth` : "ok");
    let app: string;
    try { app = cleanApp(appRaw); } catch { return text(kind === "open" ? `${appUrl}?a=err&e=app` : "ok"); }
    if (kind === "ping") return text("ok");
    try {
      const r = await deps.rpc(kind, { app });
      if (kind !== "open") return text("ok");
      if (r.r === "timer") return text(String(r.minutes));
      if (r.r === "gate" || r.r === "lock") return text(page(r.r, app, k));
      return text("ok");
    } catch (e) {
      console.error(`shortcut ${kind} failed:`, (e as Error)?.message || e);
      return text("ok"); // fail open
    }
  }

  // Setup check, opened by hand in Safari: /s/check?k=TOKEN. Plain Hebrew lines, never a secret.
  async function check(k: string) {
    if (!tokenOk(k)) return text("✗ טוקן: לא תואם לסוד SHAAR_TOKEN (או שהסוד חסר / קצר מ-16 תווים)");
    const lines = ["✓ טוקן: תקין"];
    try {
      const st = await deps.rpc("state", { app: "" });
      lines.push("✓ מסד נתונים: מחובר (shaar_api עונה)");
      lines.push("✓ שומר: כללים קבועים, בלי AI ובלי מפתח API");
      const rules = parseRules(st?.settings?.rules);
      for (const l of describeRules(rules)) lines.push(`  · ${l}`);
    } catch (e) {
      const msg = String((e as Error)?.message || e).slice(0, 200);
      lines.push(`✗ מסד נתונים: ${msg}`);
      lines.push("  → להריץ את supabase/shaar.sql ב-SQL Editor, ולוודא שהפונקציה נקראת shaar");
    }
    return text(lines.join("\n"));
  }

  async function api(action: string, b: any) {
    switch (action) {
      case "state": {
        const st = await deps.rpc("state", { app: b.app ? cleanApp(b.app) : "" });
        return { ...st, settings: withEngine(st.settings) };
      }

      case "gate": {
        const app = cleanApp(b.app), intent = clean(b.intent, 500);
        if (!intent) throw new ApiError("empty");
        const st = await deps.rpc("state", { app });
        if (st.lock) throw new ApiError("locked", 409, "locked", { lock: st.lock });
        // no fresh question while a wait is running or a question is unanswered: resume it instead
        const p = st.pending;
        if (p && ((p.decision === "ask" && !p.final_decision) ||
                  ((p.final_decision || p.decision) === "wait" && new Date(p.wait_until) > new Date(st.now)))) {
          return { attempt: p, resumed: true };
        }
        const { reason: _r, ...d } = decideGate(st, app, intent);
        const attempt = await deps.rpc("attempt_new", { app, intent, ...d });
        return { attempt };
      }

      case "answer": {
        const answer = clean(b.answer, 500);
        if (!answer) throw new ApiError("empty");
        const t = await deps.rpc("attempt_get", { id: id(b.attempt_id) });
        if (t.decision !== "ask" || t.final_decision || t.outcome) throw new ApiError("bad_state", 409);
        const st = await deps.rpc("state", { app: t.app });
        const { reason: _r, ...d } = decideGate(st, t.app, t.intent, { question: t.question, answer, id: t.id });
        // the answer round can only pass or wait
        if (d.decision === "ask") Object.assign(d, { decision: "wait", wait_seconds: 60, question: "" });
        const attempt = await deps.rpc("attempt_answer", { id: t.id, answer, ...d });
        return { attempt };
      }

      case "pass":
        return { pass: await deps.rpc("pass", { attempt_id: id(b.attempt_id), minutes: int(b.minutes, 1, 120, 5) }) };
      case "resist":
        return deps.rpc("resist", b.attempt_id ? { attempt_id: id(b.attempt_id) } : { app: cleanApp(b.app) });
      case "lock":
        return deps.rpc("lock", { minutes: int(b.minutes, 1, 720, 30) });
      case "use_credit":
        return deps.rpc("use_credit", {});

      case "step": {
        const title = clean(b.title, 200);
        const ctx = await deps.rpc("task_ctx", title ? { title } : { task_id: id(b.task_id) });
        const d = coachStep(ctx);
        const step = await deps.rpc("step_new", { task_id: ctx.task.id, ...d });
        return { step: { ...step, nudge: d.nudge }, lock: ctx.lock };
      }

      case "report": {
        const report = clean(b.report, 1000);
        if (!report) throw new ApiError("empty");
        const gs = await deps.rpc("step_get", { id: id(b.step_id) });
        if (gs.accepted) throw new ApiError("bad_state", 409);
        if (gs.elapsed_sec < gs.min_sec) throw new ApiError("too_soon", 409, "too_soon", { wait_sec: gs.min_sec - gs.elapsed_sec });
        const d = judgeReport(gs, report);
        const r = await deps.rpc("step_report", { id: gs.id, report, accepted: d.accepted, feedback: d.feedback });
        return { ...r, feedback: d.feedback };
      }

      case "task_close":
        return deps.rpc("task_close", { id: id(b.id), status: b.status === "dropped" ? "dropped" : "done" });
      case "settings": {
        const { k: _k, ...patch } = b;
        return withEngine(await deps.rpc("settings", patch));
      }
      case "export":
        return deps.rpc("export", { days: int(b.days, 1, 365, 7) });
      default:
        throw new ApiError("bad_action", 404);
    }
  }

  return async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const m = url.pathname.match(/\/(s|api)\/([a-z_]+)(?:\/([^/]*))?\/?$/);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
    if (!m) return text("shaar", 404);
    const [, area, action, arg] = m;

    if (area === "s") {
      if (req.method === "GET" && action === "check") return check(url.searchParams.get("k") || "");
      if (req.method !== "GET" || !["open", "close", "ping"].includes(action)) return text("not found", 404);
      let app = arg || (action === "ping" ? "ping" : "");
      try { app = decodeURIComponent(app); } catch { app = ""; }
      return shortcut(action, app, url.searchParams.get("k") || "");
    }

    if (action === "health" && req.method === "GET") return json(req, { ok: true, engine: ENGINE });
    if (req.method !== "POST") return json(req, { error: "method" }, 405);
    const raw = await req.text();
    if (raw.length > 16384) return json(req, { error: "too_large" }, 413);
    let body: any;
    try { body = JSON.parse(raw || "{}"); } catch { return json(req, { error: "bad_json" }, 400); }
    if (!body || typeof body !== "object") return json(req, { error: "bad_json" }, 400);
    if (!tokenOk(body.k)) return json(req, { error: "auth" }, 401);
    try {
      return json(req, await api(action, body));
    } catch (e) {
      if (e instanceof ApiError) return json(req, { error: e.code, ...(e.extra || {}) }, e.status);
      console.error(`api ${action} failed:`, (e as Error)?.message || e);
      return json(req, { error: "server" }, 500);
    }
  };
}

// ------------------------------------------------------------------ database (PostgREST RPC, service role)
export function makeRpc(baseUrl: string, key: string) {
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`; // legacy JWT keys
  return async (action: string, args: Record<string, unknown> = {}) => {
    const r = await fetch(`${baseUrl}/rest/v1/rpc/shaar_api`, {
      method: "POST", headers, body: JSON.stringify({ p_action: action, p_args: args }),
    });
    const body = await r.text();
    if (!r.ok) {
      let msg = body;
      try { msg = JSON.parse(body).message || body; } catch { /* keep text */ }
      const code = /^shaar:([a-z_]+)/.exec(msg)?.[1];
      if (code) throw new ApiError(code, ERROR_STATUS[code] ?? 400);
      throw new Error(`db ${r.status}: ${msg.slice(0, 300)}`);
    }
    return JSON.parse(body);
  };
}

function serviceKey(): string {
  const k = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (k) return k;
  try {
    const m = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    return m.default || (Object.values(m)[0] as string) || "";
  } catch { return ""; }
}

if (typeof Deno !== "undefined" && typeof Deno.serve === "function") {
  const env = (k: string) => (Deno.env.get(k) || "").trim();
  Deno.serve(createHandler({
    env: {
      token: env("SHAAR_TOKEN"),
      appUrl: env("SHAAR_APP_URL") || DEFAULT_APP_URL,
      allowOrigins: env("SHAAR_ALLOW_ORIGINS").split(",").map((s) => s.trim()).filter(Boolean),
    },
    rpc: makeRpc(env("SUPABASE_URL"), serviceKey()),
  }));
}
