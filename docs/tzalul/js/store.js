// State: defaults, strict sanitizing (load, import), persistence, optional encryption.
// Everything stays on this device. Nothing is sent anywhere.
import { deriveKey, encryptJSON, decryptJSON, randomBytes, b64, unb64, ITERATIONS } from "./crypto.js";
import { TRIGGERS, COPING, SYMPTOMS, PREP_CHECKLIST } from "./content.js";

export const KEY = "tzalul_v1";
export const THEME_KEY = "tzalul_theme";
export const SCHEMA = 1;

const LIMITS = { checkins: 3000, cravings: 5000, journal: 2000, slips: 1000, attempts: 500, taper: 800, tools: 500 };
const TRIG = new Set(TRIGGERS.map(x => x.k)), COP = new Set(COPING.map(x => x.k));
const SYM = new Set(SYMPTOMS.map(x => x.k)), PREP = new Set(PREP_CHECKLIST.map(x => x.k));

// ---- primitive cleaners ---------------------------------------------------------
const str = (x, max = 200) => (typeof x === "string" ? x : x == null ? "" : String(x))
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, max);
const num = (x, min, max, def = 0) => { const n = Number(x); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
const int = (x, min, max, def = 0) => Math.round(num(x, min, max, def));
const bool = x => x === true;
const oneOf = (x, list, def) => (list.includes(x) ? x : def);
const iso = (x, def = null) => {
  if (x == null || x === "") return def;
  const d = new Date(x);
  const tm = d.getTime();
  // 2000-01-01 .. 2100-01-01
  return Number.isFinite(tm) && tm > 946684800000 && tm < 4102444800000 ? d.toISOString() : def;
};
const dayK = x => (typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);
const id = x => (typeof x === "string" && /^[a-z0-9]{4,32}$/i.test(x) ? x : uid());
const arr = (x, max, fn) => (Array.isArray(x) ? x.slice(-max).map(fn).filter(Boolean) : []);
const keys = (x, set, max = 30) => [...new Set(arr(x, max, v => (set.has(v) ? v : null)))];
const time = x => (typeof x === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(x) ? x : null);

export function uid() {
  return b64(randomBytes(9)).replace(/[^a-z0-9]/gi, "").slice(0, 12).padEnd(6, "x");
}

export function defaults() {
  const now = new Date().toISOString();
  return {
    v: SCHEMA,
    onboarded: false,
    profile: {
      name: "", gender: "n", mode: "quit", quitAt: now, taperStart: null, createdAt: now, currency: "₪",
      baseline: { sessionsPerDay: 3, gramsPerDay: 1, costPerWeek: 250, minutesPerSession: 10, years: 3, methods: [] },
      reasons: [], why: "",
    },
    settings: { theme: "auto", checkinTime: "21:00", autoLockMin: 5, haptics: true, showMoney: true },
    attempts: [], checkins: [], cravings: [], journal: [], slips: [], taperLog: [], toolUses: [],
    plan: { triggers: [], contacts: [], rewards: [], prep: [], ifThen: [], warning: "" },
    seen: { achievements: [] },
  };
}

/** Rebuild a valid state from untrusted input. Unknown fields are dropped. */
export function sanitize(raw) {
  const d = defaults();
  if (!raw || typeof raw !== "object") return d;
  const p = raw.profile || {}, b = p.baseline || {}, s = raw.settings || {}, pl = raw.plan || {};
  const out = {
    v: SCHEMA,
    onboarded: bool(raw.onboarded),
    profile: {
      name: str(p.name, 40).trim(),
      gender: oneOf(p.gender, ["m", "f", "n"], "n"),
      mode: oneOf(p.mode, ["quit", "taper"], "quit"),
      quitAt: iso(p.quitAt, d.profile.quitAt),
      taperStart: iso(p.taperStart, null),
      createdAt: iso(p.createdAt, d.profile.createdAt),
      currency: oneOf(p.currency, ["₪", "$", "€", "£"], "₪"),
      baseline: {
        sessionsPerDay: num(b.sessionsPerDay, 0, 50, d.profile.baseline.sessionsPerDay),
        gramsPerDay: num(b.gramsPerDay, 0, 50, d.profile.baseline.gramsPerDay),
        costPerWeek: num(b.costPerWeek, 0, 100000, d.profile.baseline.costPerWeek),
        minutesPerSession: num(b.minutesPerSession, 1, 240, 10),
        years: num(b.years, 0, 80, 0),
        methods: arr(b.methods, 10, v => (["joint", "bong", "vape", "pipe", "edible", "oil", "other"].includes(v) ? v : null)),
      },
      reasons: arr(p.reasons, 20, v => str(v, 120).trim() || null),
      why: str(p.why, 600),
    },
    settings: {
      theme: oneOf(s.theme, ["auto", "light", "dark"], "auto"),
      checkinTime: time(s.checkinTime) || "21:00",
      autoLockMin: oneOf(s.autoLockMin, [0, 1, 5, 15, 60], 5),
      haptics: s.haptics !== false,
      showMoney: s.showMoney !== false,
    },
    attempts: arr(raw.attempts, LIMITS.attempts, a => {
      const start = iso(a?.start), end = iso(a?.end);
      return start && end && end > start ? { start, end } : null;
    }),
    checkins: dedupeBy(arr(raw.checkins, LIMITS.checkins, c => {
      const date = dayK(c?.date);
      if (!date) return null;
      return {
        id: id(c.id), date, ts: iso(c.ts, new Date().toISOString()),
        mood: int(c.mood, 1, 5, 3), sleep: int(c.sleep, 1, 5, 3), craving: int(c.craving, 0, 10, 0),
        energy: int(c.energy, 1, 5, 3),
        symptoms: keys(c.symptoms, SYM), used: bool(c.used), win: str(c.win, 200), note: str(c.note, 2000),
      };
    }), c => c.date),
    cravings: arr(raw.cravings, LIMITS.cravings, c => {
      const ts = iso(c?.ts);
      if (!ts) return null;
      return {
        id: id(c.id), ts, intensity: int(c.intensity, 1, 10, 5),
        trigger: TRIG.has(c.trigger) ? c.trigger : null, coping: keys(c.coping, COP),
        outcome: oneOf(c.outcome, ["resisted", "used"], "resisted"), note: str(c.note, 1000),
      };
    }),
    journal: arr(raw.journal, LIMITS.journal, j => {
      const ts = iso(j?.ts), text = str(j?.text, 10000);
      if (!ts || !text.trim()) return null;
      return { id: id(j.id), ts, prompt: str(j.prompt, 200), text, mood: j.mood == null ? null : int(j.mood, 1, 5, 3) };
    }),
    slips: arr(raw.slips, LIMITS.slips, x => {
      const ts = iso(x?.ts);
      if (!ts) return null;
      return { id: id(x.id), ts, trigger: TRIG.has(x.trigger) ? x.trigger : null, note: str(x.note, 2000), reset: bool(x.reset), learn: str(x.learn, 1000) };
    }),
    taperLog: dedupeBy(arr(raw.taperLog, LIMITS.taper, x => {
      const date = dayK(x?.date);
      return date ? { date, count: int(x.count, 0, 50, 0) } : null;
    }), x => x.date),
    toolUses: arr(raw.toolUses, LIMITS.tools, x => {
      const ts = iso(x?.ts);
      const tool = oneOf(x?.tool, ["breathe", "surf", "ground", "tape", "reasons", "distract"], null);
      return ts && tool ? { tool, ts } : null;
    }),
    plan: {
      triggers: arr(pl.triggers, 30, x => (TRIG.has(x?.k) ? { k: x.k, plan: str(x.plan, 400) } : null)),
      contacts: arr(pl.contacts, 10, x => {
        const name = str(x?.name, 40).trim(), phone = str(x?.phone, 200).replace(/[^\d+*#-]/g, "").slice(0, 20);
        return name || phone ? { id: id(x.id), name, phone } : null;
      }),
      rewards: arr(pl.rewards, 20, x => {
        const title = str(x?.title, 80).trim();
        return title ? { id: id(x.id), title, price: num(x.price, 0, 1e7, 0), done: bool(x.done) } : null;
      }),
      prep: keys(pl.prep, PREP),
      ifThen: arr(pl.ifThen, 30, x => {
        const a = str(x?.if, 200).trim(), b = str(x?.then, 200).trim();
        return a && b ? { id: id(x.id), if: a, then: b } : null;
      }),
      warning: str(pl.warning, 1000),
    },
    seen: { achievements: arr(raw.seen?.achievements, 100, v => (typeof v === "string" && /^[a-z0-9]{1,20}$/.test(v) ? v : null)) },
  };
  if (out.profile.mode === "taper" && !out.profile.taperStart) out.profile.taperStart = out.profile.createdAt;
  return out;
}

function dedupeBy(list, key) {
  const m = new Map();
  for (const x of list) m.set(key(x), x); // last wins
  return [...m.values()];
}

// ---- persistence --------------------------------------------------------------------
let cryptoKey = null, cryptoSalt = null, lockOn = false, saveChain = Promise.resolve();
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

/** Returns { state } or { locked: true } (call unlock()) or { state, fresh: true }. */
export function load() {
  const raw = ls.get(KEY);
  if (!raw) return { state: defaults(), fresh: true };
  let box;
  try { box = JSON.parse(raw); } catch { return { state: defaults(), fresh: true, corrupt: true }; }
  if (box && box.enc) return { locked: true };
  return { state: sanitize(box && box.plain) };
}

export function isEncrypted() { return lockOn; }

export async function unlock(code) {
  const box = JSON.parse(ls.get(KEY) || "{}");
  if (!box.enc) throw new Error("not locked");
  const salt = unb64(box.enc.salt);
  const key = await deriveKey(code, salt, box.enc.iter || ITERATIONS);
  const data = await decryptJSON(key, box.enc); // throws on a wrong code
  cryptoKey = key; cryptoSalt = salt; lockOn = true;
  return sanitize(data);
}

export function save(state) {
  // locked (key forgotten) → never fall back to writing plaintext
  if (lockOn && !cryptoKey) return saveChain;
  const snap = JSON.parse(JSON.stringify(state));
  saveChain = saveChain.then(async () => {
    if (cryptoKey) {
      const e = await encryptJSON(cryptoKey, snap);
      ls.set(KEY, JSON.stringify({ v: SCHEMA, enc: { ...e, salt: b64(cryptoSalt), iter: ITERATIONS } }));
    } else {
      ls.set(KEY, JSON.stringify({ v: SCHEMA, plain: snap }));
    }
  }).catch(err => console.error("save failed", err));
  return saveChain;
}

export async function enableLock(state, code) {
  cryptoSalt = randomBytes(16);
  cryptoKey = await deriveKey(code, cryptoSalt);
  lockOn = true;
  await save(state);
}
export async function disableLock(state) {
  cryptoKey = null; cryptoSalt = null; lockOn = false;
  await save(state);
}
/** Forget the key in memory (auto-lock). Data on disk stays encrypted. */
export function forgetKey() { cryptoKey = null; cryptoSalt = null; }

export function wipe() {
  cryptoKey = null; cryptoSalt = null; lockOn = false;
  ls.del(KEY); ls.del(THEME_KEY);
}

export const prefs = {
  theme() { return oneOf(ls.get(THEME_KEY), ["auto", "light", "dark"], "auto"); },
  setTheme(t) { ls.set(THEME_KEY, t); },
};

// ---- backup ----------------------------------------------------------------------------
export function exportJSON(state) {
  return JSON.stringify({ app: "tzalul", schema: SCHEMA, exportedAt: new Date().toISOString(), state }, null, 2);
}
export function importJSON(text) {
  if (typeof text !== "string" || text.length > 15e6) throw new Error("קובץ גדול מדי");
  const obj = JSON.parse(text);
  if (!obj || obj.app !== "tzalul" || !obj.state) throw new Error("זה לא קובץ גיבוי של צלול");
  const st = sanitize(obj.state);
  st.onboarded = true;
  return st;
}
