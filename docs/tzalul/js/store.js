// State, sanitizing, persistence (plain or PIN-encrypted), backup.
// Everything stays on the device. There is no server.

import { uid, num, isDayKey, validISO, dayKey } from "./util.js";
import { newVaultKey, seal, unseal, parseVault } from "./crypto.js";
import { DEFAULT_PLAN, AUDIT } from "./content.js";

export const KEYS = { plain: "tzalul.v1", vault: "tzalul.vault", guard: "tzalul.guard" };
export const SCHEMA = 1;

const LIM = { short: 80, mid: 300, long: 5000, list: 2000, small: 40 };

/* ---------- Defaults ---------- */

export function defaults(now = new Date()) {
  return {
    v: SCHEMA,
    createdAt: now.toISOString(),
    profile: {
      name: "", gender: "m", goal: "quit", startAt: now.toISOString(),
      daysPerWeek: 4, drinksPerDay: 4, costPerDrink: 30, kcalPerDrink: 140, reasons: [],
    },
    settings: { theme: "auto", reminder: "21:00", autoLockMin: 1, onboarded: false, safetyAck: false },
    contacts: [],
    checkins: {},
    drinks: [],
    cravings: [],
    journal: [],
    thoughts: [],
    gratitude: [],
    plan: structuredClone(DEFAULT_PLAN),
    audits: [],
    letter: { text: "", at: null },
    savingsGoal: { name: "", price: 0 },
    seen: { milestone: 0 },
  };
}

/* ---------- Sanitizing (applied on load, import and before every save) ---------- */

const str = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, max) : "");
const strList = (v, max, n = 50) => (Array.isArray(v) ? v.map(x => str(x, max).trim()).filter(Boolean).slice(0, n) : []);
const id = v => (typeof v === "string" && /^[a-z0-9]{4,40}$/i.test(v) ? v : uid());
const iso = (v, fb) => validISO(v) || fb;
const pick = (v, opts, fb) => (opts.includes(v) ? v : fb);
const intIn = (v, lo, hi, fb) => { const n = num(v, lo, hi, fb); return n == null ? n : Math.round(n); };
const phone = v => str(v, 30).replace(/[^0-9+*#\-\s()]/g, "").trim();
const timeHM = (v, fb) => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fb);

function arr(v, fn, max = LIM.list) {
  if (!Array.isArray(v)) return [];
  const out = [];
  const seen = new Set();
  for (const x of v.slice(0, max)) {
    if (!x || typeof x !== "object") continue;
    const r = fn(x);
    if (r && !seen.has(r.id)) { seen.add(r.id); out.push(r); }
  }
  return out;
}

export function clean(input, now = new Date()) {
  const d = defaults(now);
  const s = input && typeof input === "object" ? input : {};
  const p = s.profile && typeof s.profile === "object" ? s.profile : {};
  const st = s.settings && typeof s.settings === "object" ? s.settings : {};
  const nowISO = now.toISOString();

  const out = {
    v: SCHEMA,
    createdAt: iso(s.createdAt, d.createdAt),
    profile: {
      name: str(p.name, LIM.small).trim(),
      gender: pick(p.gender, ["m", "f", "n"], "m"),
      goal: pick(p.goal, ["quit", "reduce"], "quit"),
      startAt: iso(p.startAt, nowISO),
      daysPerWeek: num(p.daysPerWeek, 0, 7, d.profile.daysPerWeek),
      drinksPerDay: num(p.drinksPerDay, 0, 60, d.profile.drinksPerDay),
      costPerDrink: num(p.costPerDrink, 0, 1000, d.profile.costPerDrink),
      kcalPerDrink: num(p.kcalPerDrink, 0, 1000, d.profile.kcalPerDrink),
      reasons: strList(p.reasons, LIM.short, 30),
    },
    settings: {
      theme: pick(st.theme, ["auto", "light", "dark"], "auto"),
      reminder: timeHM(st.reminder, "21:00"),
      autoLockMin: pick(Number(st.autoLockMin), [0, 1, 5, 15], 1),
      onboarded: st.onboarded === true,
      safetyAck: st.safetyAck === true,
    },
    contacts: arr(s.contacts, c => {
      const name = str(c.name, LIM.small).trim(), tel = phone(c.phone);
      return name || tel ? { id: id(c.id), name, phone: tel } : null;
    }, 20),
    checkins: {},
    drinks: arr(s.drinks, x => ({
      id: id(x.id), at: iso(x.at, nowISO), count: num(x.count, 0, 60, 1),
      note: str(x.note, LIM.long), triggers: strList(x.triggers, LIM.small, 20), learned: str(x.learned, LIM.long),
    })),
    cravings: arr(s.cravings, x => ({
      id: id(x.id), at: iso(x.at, nowISO), intensity: intIn(x.intensity, 1, 10, 5),
      triggers: strList(x.triggers, LIM.small, 20), coping: strList(x.coping, LIM.small, 20),
      outcome: pick(x.outcome, ["passed", "drank"], "passed"),
      durationSec: intIn(x.durationSec, 0, 86400, 0), note: str(x.note, LIM.long),
    })),
    journal: arr(s.journal, x => {
      const text = str(x.text, LIM.long);
      return text.trim() ? { id: id(x.id), at: iso(x.at, nowISO), text, mood: x.mood == null ? null : intIn(x.mood, 1, 5, null) } : null;
    }),
    thoughts: arr(s.thoughts, x => ({
      id: id(x.id), at: iso(x.at, nowISO),
      situation: str(x.situation, LIM.mid), thought: str(x.thought, LIM.mid), emotion: str(x.emotion, LIM.short),
      before: intIn(x.before, 0, 10, 5), evidenceFor: str(x.evidenceFor, LIM.mid), evidenceAgainst: str(x.evidenceAgainst, LIM.mid),
      alternative: str(x.alternative, LIM.mid), after: intIn(x.after, 0, 10, 5),
    })),
    gratitude: arr(s.gratitude, x => {
      const items = strList(x.items, LIM.mid, 5);
      return items.length ? { id: id(x.id), at: iso(x.at, nowISO), items } : null;
    }),
    plan: {},
    audits: arr(s.audits, x => {
      const a = Array.isArray(x.answers) ? x.answers.map(Number) : [];
      if (a.length !== AUDIT.length || a.some((v, i) => !AUDIT[i].o.some(o => o[1] === v))) return null;
      return { id: id(x.id), at: iso(x.at, nowISO), answers: a, score: a.reduce((t, v) => t + v, 0) };
    }, 100),
    letter: { text: str(s.letter?.text, LIM.long), at: validISO(s.letter?.at) },
    savingsGoal: { name: str(s.savingsGoal?.name, LIM.short).trim(), price: num(s.savingsGoal?.price, 0, 10000000, 0) },
    seen: { milestone: num(s.seen?.milestone, 0, 100000, 0) },
  };

  const ci = s.checkins && typeof s.checkins === "object" && !Array.isArray(s.checkins) ? s.checkins : {};
  for (const k of Object.keys(ci).slice(0, 5000)) {
    const x = ci[k];
    if (!isDayKey(k) || !x || typeof x !== "object") continue;
    out.checkins[k] = {
      at: iso(x.at, nowISO),
      mood: x.mood == null ? null : intIn(x.mood, 1, 5, null),
      craving: x.craving == null ? null : intIn(x.craving, 0, 10, null),
      drank: x.drank === true,
      intention: str(x.intention, LIM.mid),
      note: str(x.note, LIM.long),
      grateful: str(x.grateful, LIM.mid),
      done: x.done === true,
    };
  }

  const pl = s.plan && typeof s.plan === "object" ? s.plan : DEFAULT_PLAN;
  for (const k of Object.keys(DEFAULT_PLAN)) out.plan[k] = strList(pl[k], LIM.mid, 30);

  return out;
}

/* ---------- Store ---------- */

/** Minimal guard against PIN guessing: escalating delay after 5 failures. */
function lockoutMs(fails) {
  if (fails < 5) return 0;
  return Math.min(15 * 60000, 30000 * 2 ** (fails - 5));
}

export function createStore(storage = globalThis.localStorage) {
  let state = null;
  let vault = null; // {key, meta} when the PIN lock is on and unlocked
  let status = "empty"; // empty | locked | ready
  let pending = Promise.resolve();
  let timer = null;
  let dirty = false;
  const subs = new Set();

  const emit = () => subs.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
  const readGuard = () => { try { return JSON.parse(storage.getItem(KEYS.guard)) || { fails: 0, until: 0 }; } catch { return { fails: 0, until: 0 }; } };
  const writeGuard = g => storage.setItem(KEYS.guard, JSON.stringify(g));

  async function writeNow() {
    if (!state || !dirty) return;
    dirty = false;
    const text = JSON.stringify(state);
    if (vault) {
      const sealed = await seal(vault.key, vault.meta, text);
      storage.setItem(KEYS.vault, sealed);
      storage.removeItem(KEYS.plain);
    } else {
      storage.setItem(KEYS.plain, text);
      storage.removeItem(KEYS.vault);
    }
  }

  function persist(immediate = false) {
    dirty = true;
    clearTimeout(timer);
    const run = () => { pending = pending.then(writeNow).catch(e => { console.error("save failed", e); api.onError?.(e); }); return pending; };
    if (immediate) return run();
    timer = setTimeout(run, 250);
    return pending;
  }

  const api = {
    onError: null,
    get state() { return state; },
    get status() { return status; },
    get locked() { return !!storage.getItem(KEYS.vault); },
    hasLock() { return !!vault || !!storage.getItem(KEYS.vault); },

    init(now = new Date()) {
      if (storage.getItem(KEYS.vault)) { status = "locked"; return status; }
      const rawText = storage.getItem(KEYS.plain);
      if (rawText) {
        try { state = clean(JSON.parse(rawText), now); status = state.settings.onboarded ? "ready" : "empty"; }
        catch (e) { console.error("corrupt data", e); state = null; status = "empty"; }
      }
      if (!state) { state = defaults(now); status = "empty"; }
      return status;
    },

    guard() { return readGuard(); },

    async unlock(pin) {
      const g = readGuard();
      if (Date.now() < g.until) { const e = new Error("wait"); e.until = g.until; throw e; }
      try {
        const r = await unseal(storage.getItem(KEYS.vault), pin);
        state = clean(JSON.parse(r.text));
        vault = { key: r.key, meta: r.meta };
        status = state.settings.onboarded ? "ready" : "empty";
        writeGuard({ fails: 0, until: 0 });
        emit();
        return true;
      } catch (e) {
        if (e && e.message === "vault") throw e;
        const fails = g.fails + 1;
        const until = Date.now() + lockoutMs(fails);
        writeGuard({ fails, until });
        const err = new Error("pin");
        err.fails = fails; err.until = until;
        throw err;
      }
    },

    /** Drop decrypted data from memory. */
    lock() {
      if (!vault) return false;
      clearTimeout(timer);
      return pending.then(writeNow).then(() => { state = null; vault = null; status = "locked"; emit(); return true; });
    },

    async enableLock(pin) {
      const v = await newVaultKey(pin);
      vault = { key: v.key, meta: { salt: v.salt, iterations: v.iterations } };
      await persist(true);
      if (!storage.getItem(KEYS.vault) || storage.getItem(KEYS.plain)) throw new Error("encrypt failed");
    },

    async disableLock() {
      vault = null;
      await persist(true);
    },

    async verifyPin(pin) {
      const sealed = storage.getItem(KEYS.vault);
      if (!sealed) return true;
      try { await unseal(sealed, pin); return true; } catch { return false; }
    },

    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },

    /** Mutate state through fn(draft); re-sanitizes and saves. */
    update(fn, { immediate = false, silent = false } = {}) {
      if (!state) return;
      fn(state);
      state = clean(state);
      if (status === "empty" && state.settings.onboarded) status = "ready";
      persist(immediate);
      if (!silent) emit();
    },

    /** Write pending changes now (no-op when nothing changed). */
    flush() { clearTimeout(timer); return pending.then(writeNow); },
    get dirty() { return dirty; },

    exportData() {
      return JSON.stringify({ app: "tzalul", exportedAt: new Date().toISOString(), data: state }, null, 2);
    },

    /** Validate and replace all data with a backup file's contents. */
    importData(text) {
      if (typeof text !== "string" || text.length > 20 * 1024 * 1024) throw new Error("size");
      const o = JSON.parse(text);
      if (!o || o.app !== "tzalul" || !o.data || typeof o.data !== "object") throw new Error("format");
      const next = clean(o.data);
      next.settings.onboarded = true;
      state = next;
      status = "ready";
      persist(true);
      emit();
      return state;
    },

    async wipe() {
      clearTimeout(timer);
      await pending.catch(() => {});
      for (const k of Object.values(KEYS)) storage.removeItem(k);
      vault = null;
      dirty = false;
      state = defaults();
      status = "empty";
      emit();
    },
  };
  return api;
}

export { parseVault, dayKey };
