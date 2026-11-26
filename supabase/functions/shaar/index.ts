// Shaar (שער) — Edge Function: the only thing that talks to the database and to Claude.
//
//   GET  /shaar/s/open/<app>?k=TOKEN   called by the iPhone Shortcut when a distracting app opens.
//        → "ok"            let the app stay open (a contract is running)
//        → "<minutes>"     the contract starts now: the Shortcut starts a Clock timer
//        → "https://…"     open this page (the gate, or the lock screen)
//   GET  /shaar/s/close/<app>?k=TOKEN  called when the app closes → always "ok"
//   POST /shaar/api/<action>           the web app; body is JSON (sent as text/plain to avoid a
//                                      CORS preflight) and carries the token as "k".
//
// The Anthropic key and the service-role key never leave this function.
// Deploy:  supabase functions deploy shaar --no-verify-jwt   (or paste into the dashboard editor)
// Secrets: SHAAR_TOKEN, ANTHROPIC_API_KEY  [optional: SHAAR_GATE_MODEL, SHAAR_COACH_MODEL, SHAAR_APP_URL]

declare const Deno: any;

const SDK = "npm:@anthropic-ai/sdk@1.8.0";
const DEFAULT_APP_URL = "https://yasobe.github.io/Abeve/shaar/";

export const APP_NAMES: Record<string, string> = {
  instagram: "אינסטגרם", tiktok: "טיקטוק", youtube: "יוטיוב", facebook: "פייסבוק",
  x: "X", twitter: "X", reddit: "רדיט", threads: "Threads", snapchat: "סנאפצ׳ט",
  netflix: "נטפליקס", whatsapp: "וואטסאפ", telegram: "טלגרם",
};
const appName = (a: string) => APP_NAMES[a] || a;

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
function localTime(now: Date, tz: string) {
  try {
    return new Intl.DateTimeFormat("he-IL", { timeZone: tz, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  } catch { return now.toISOString(); }
}
const formLine = (form: string) => form === "f"
  ? "Address the user in Hebrew feminine singular (את, שלך, תעשי)."
  : "Address the user in Hebrew masculine singular (אתה, שלך, תעשה).";
const g = (form: string, m: string, f: string) => (form === "f" ? f : m);

// ------------------------------------------------------------------ Claude
const GATE_SCHEMA = (decisions: string[]) => ({
  type: "object",
  properties: {
    decision: { type: "string", enum: decisions },
    message: { type: "string" },
    question: { type: "string" },
    wait_seconds: { type: "integer" },
    max_minutes: { type: "integer" },
  },
  required: ["decision", "message", "question", "wait_seconds", "max_minutes"],
  additionalProperties: false,
});
const STEP_SCHEMA = {
  type: "object",
  properties: {
    step: { type: "string" }, minutes: { type: "integer" },
    done_when: { type: "string" }, nudge: { type: "string" },
  },
  required: ["step", "minutes", "done_when", "nudge"],
  additionalProperties: false,
};
const JUDGE_SCHEMA = {
  type: "object",
  properties: { accepted: { type: "boolean" }, feedback: { type: "string" } },
  required: ["accepted", "feedback"],
  additionalProperties: false,
};

export function gateSystem(form: string, cap: number, answered: boolean) {
  return `You are the gatekeeper ("השומר") of a personal app that helps one person stop opening distracting apps (Instagram, TikTok, YouTube…) on impulse. Their iPhone sent them to you the moment they opened such an app. They answered the question "מה אני מחפש עכשיו?" and you decide what happens next. The goal is a moment of awareness and effort before reward — not punishment and not a lecture.

${answered ? `You already asked your one question and got the answer. Now choose only "pass" or "wait".` : `Choose exactly one decision:`}
- "pass": a concrete, specific purpose that really needs this app now (reply to a specific message, look up a specific thing, post or upload something, a time-bound need). Set max_minutes to what that purpose realistically needs, usually 2–10, never more than ${cap}.
- "wait": the answer is vague, boredom, habit, escape, avoiding a task or a feeling, "just checking", or they have been here many times recently. Set wait_seconds between 30 and 300 (longer when visits are frequent or a contract was just broken). In message, name in a few words what seems to be going on and offer one tiny thing to do while waiting (breathe, drink water, stand up, write the first line of what they are avoiding). They may still enter after waiting, so set max_minutes short (2–5).${answered ? "" : `
- "ask": only when the answer is ambiguous and ONE short question would show whether the purpose is real (what exactly? can it wait an hour?). Put it in question, at most 12 words. Never ask about something they already said.`}

Lean towards "wait" late at night, after many visits today, after a broken contract in the last hour, or for words like סתם, משעמם, רק לבדוק, בורח. Lean towards "pass" for a clear task with a clear end. If their personal rules apply, follow them.

Write natural, warm, direct Hebrew. ${formLine(form)} message: at most 18 words, no preaching, no emoji, don't quote their words back. Fields that don't apply: question "" and wait_seconds 0. Always set max_minutes.`;
}

export function gateContext(st: any, app: string, intent: string, qa?: { question: string; answer: string; id?: number }) {
  const s = st.settings || {}, stt = st.stats || {}, now = new Date(st.now || Date.now());
  const lp = st.last_pass;
  const recent = (st.recent || [])
    .filter((r: any) => r.id !== qa?.id && now.getTime() - new Date(r.at).getTime() < 24 * 3600e3)
    .slice(0, 5)
    .map((r: any) => `- ${minsAgo(r.at, now)} min ago, ${r.app}: "${clean(r.intent, 120)}" → ${r.final_decision || r.decision}${r.outcome ? `, ${r.outcome}` : ""}`);
  const lines = [
    `App opened: ${appName(app)} (${app})`,
    `Local time: ${localTime(now, s.tz || "Asia/Jerusalem")}`,
    `Today: ${stt.visits ?? 0} gate visits, ${stt.attempts ?? 0} answered, ${stt.passed ?? 0} entries (${stt.minutes ?? 0} min declared), ${stt.resisted ?? 0} resisted; contracts ${stt.kept ?? 0} kept, ${stt.broken ?? 0} broken.`,
    `Last 7 days: contracts ${stt.week_kept ?? 0} kept / ${stt.week_broken ?? 0} broken; ${stt.week_resisted ?? 0} urges resisted out of ${stt.week_attempts ?? 0}.`,
    `Last contract: ${lp ? `${lp.app}, ${lp.minutes} min, ${lp.status}${lp.overrun_sec ? ` (overran by ${Math.ceil(lp.overrun_sec / 60)} min)` : ""}, ended ${minsAgo(lp.settled_at, now)} min ago` : "none"}`,
    `Earlier answers (last 24h, newest first):`,
    ...(recent.length ? recent : ["- none"]),
    `Personal rules: ${clean(s.rules, 1500) || "(none)"}`,
    ``,
    `What they typed now:`,
    `<intent>${clean(intent, 500)}</intent>`,
  ];
  if (qa) lines.push(`Your question: <question>${clean(qa.question, 200)}</question>`, `Their answer: <answer>${clean(qa.answer, 500)}</answer>`);
  return lines.join("\n");
}

export function coachSystem(form: string, locked: boolean) {
  return `You are a coach inside a personal app built on one rule: effort comes before reward. The person ${locked ? "is locked out of distracting apps and wants an early release" : "wants to bank an effort credit (it can release a future lock early)"}. To earn it they take one small, real step on a task they keep postponing.

Give exactly ONE step that:
- takes 2–10 minutes and can start right now,
- starts with a concrete verb and names the exact object (which file, which person, which drawer, which page),
- produces something observable they can describe afterwards,
- is smaller than feels necessary — the point is starting, not finishing.
Never "think about", "plan", "research" or "decide" unless it produces something written (for example: write three bullet points about…).
If earlier steps on this task are listed, build on what they reported and move it forward; don't repeat an accepted step. If the task is huge or vague, the step is to make it concrete (write the very next physical action in one line).

Hebrew. ${formLine(form)} step: at most 25 words. done_when: one short sentence describing what they will be able to report. minutes: an integer from 2 to 10. nudge: at most 12 words, encouraging without being cheesy.`;
}

export function coachContext(ctx: any) {
  const now = new Date(ctx.now || Date.now());
  const hist = (ctx.history || []).map((h: any, i: number) =>
    `${i + 1}. step: "${clean(h.step, 200)}" — report: ${h.report ? `"${clean(h.report, 300)}"` : "(none)"} — ${h.accepted === true ? "accepted" : h.accepted === false ? "not accepted" : "not reported"}`);
  return [
    `Task: <task>${clean(ctx.task?.title, 200)}</task>`,
    `Situation: ${ctx.lock ? `locked for ${Math.max(1, Math.ceil((new Date(ctx.lock.ends_at).getTime() - now.getTime()) / 60000))} more minutes` : "not locked (banking a credit)"}; local time ${localTime(now, ctx.settings?.tz || "Asia/Jerusalem")}.`,
    `Earlier steps on this task (oldest first):`,
    ...(hist.length ? hist : ["none — this is the first step"]),
  ].join("\n");
}

export function judgeSystem(form: string) {
  return `You check one small step of effort in a personal anti-procrastination app. The person was given a step and now reports what they did. An accepted report releases their lock on distracting apps early (or banks a credit), so judge honestly but kindly:
- accepted = true when the report plausibly shows the step, or a meaningful real part of it, was done. Specific details are a good sign.
- accepted = false when the report is empty, a joke, unrelated, says it was not done, or is only "עשיתי"/"done" with no detail — then ask for one concrete detail.
feedback: Hebrew, ${formLine(form)} At most 25 words. Name what they actually did; if accepted you may hint at the next tiny step; if not, say exactly what is missing. No preaching.`;
}

export function judgeContext(g: any, report: string) {
  return [
    `Task: <task>${clean(g.title, 200)}</task>`,
    `Step given: <step>${clean(g.step, 400)}</step>`,
    `Done when: ${clean(g.done_when, 300)}`,
    `Planned minutes: ${g.minutes}; minutes between getting the step and reporting: ${Math.round((g.elapsed_sec || 0) / 60)}`,
    `Their report: <report>${clean(report, 1000)}</report>`,
  ].join("\n");
}

function firstJson(msg: any) {
  if (!msg || msg.stop_reason === "refusal") throw new Error("refusal");
  if (msg.stop_reason === "max_tokens") throw new Error("max_tokens");
  for (const b of msg.content || []) if (b.type === "text" && b.text.trim()) return JSON.parse(b.text);
  throw new Error("no text block");
}

type Anthropic = { messages: { create: Function }; beta: { messages: { create: Function } } };

async function askClaude(getClient: () => Promise<Anthropic>, p: {
  model: string; system: string; user: string; schema: any; effort: string; maxTokens: number;
  timeoutMs: number; retries: number; fallbacks?: boolean;
}) {
  const client = await getClient();
  const body: any = {
    model: p.model, max_tokens: p.maxTokens, system: p.system,
    messages: [{ role: "user", content: p.user }],
    output_config: { effort: p.effort, format: { type: "json_schema", schema: p.schema } },
  };
  const opts = { timeout: p.timeoutMs, maxRetries: p.retries };
  const t0 = Date.now();
  let msg;
  if (p.fallbacks) {
    // server-side refusal fallback for the strong model; retried plainly if the beta is rejected
    try {
      msg = await client.beta.messages.create({ ...body, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }, opts);
    } catch (e: any) {
      if (e?.status !== 400) throw e;
      msg = await client.messages.create(body, opts);
    }
  } else {
    msg = await client.messages.create(body, opts);
  }
  return { data: firstJson(msg), model: String(msg.model || p.model), latency_ms: Date.now() - t0 };
}

// ------------------------------------------------------------------ decisions (with offline fallbacks)
export async function decideGate(deps: Deps, st: any, app: string, intent: string, qa?: { question: string; answer: string; id?: number }) {
  const s = st.settings || {}, cap = int(s.max_minutes_cap, 1, 120, 30), form = s.form || "m";
  const allowed = qa ? ["pass", "wait"] : ["pass", "wait", "ask"];
  const aiOff = !deps.env.anthropicKey || (st.stats?.ai_today ?? 0) >= int(s.ai_daily_limit, 0, 10000, 150);
  if (!aiOff) {
    try {
      const r = await askClaude(deps.anthropic, {
        model: deps.env.gateModel, system: gateSystem(form, cap, !!qa), user: gateContext(st, app, intent, qa),
        schema: GATE_SCHEMA(allowed), effort: "low", maxTokens: 1024, timeoutMs: 8000, retries: 0,
      });
      const d = r.data;
      if (!allowed.includes(d.decision)) throw new Error("bad decision " + d.decision);
      return {
        decision: d.decision, message: clean(d.message, 400), question: d.decision === "ask" ? clean(d.question, 200) : "",
        wait_seconds: d.decision === "wait" ? int(d.wait_seconds, 30, 300, 60) : 0,
        max_minutes: int(d.max_minutes, 1, cap, 5), model: r.model, latency_ms: r.latency_ms, ai_ok: true,
      };
    } catch (e) {
      console.error("gate: claude failed:", (e as Error)?.message || e);
    }
  }
  // fallback: a clear, longer answer passes for a short contract; otherwise a breathing pause
  const text = qa ? qa.answer : intent;
  const clear = text.trim().length >= 15 && (st.stats?.attempts ?? 0) < 8;
  return {
    decision: clear ? "pass" : "wait",
    message: clear ? "השומר לא זמין כרגע. כנס לזמן קצר ועם מטרה." : "השומר לא זמין כרגע. דקה של נשימה, ואז נחליט.",
    question: "", wait_seconds: clear ? 0 : 60, max_minutes: clear ? 5 : 3,
    model: null, latency_ms: null, ai_ok: false,
  };
}

export async function coachStep(deps: Deps, ctx: any) {
  const s = ctx.settings || {}, form = s.form || "m";
  if (deps.env.anthropicKey && (ctx.stats?.ai_today ?? 0) < int(s.ai_daily_limit, 0, 10000, 150)) {
    try {
      const strong = /^claude-(opus-5|sonnet-5-5|fable-5)/.test(deps.env.coachModel);
      const r = await askClaude(deps.anthropic, {
        model: deps.env.coachModel, system: coachSystem(form, !!ctx.lock), user: coachContext(ctx),
        schema: STEP_SCHEMA, effort: "medium", maxTokens: 8000, timeoutMs: 45000, retries: 1, fallbacks: strong,
      });
      const d = r.data;
      return {
        step: clean(d.step, 400), minutes: int(d.minutes, 2, 10, 5), done_when: clean(d.done_when, 300),
        nudge: clean(d.nudge, 200), model: r.model, ai_ok: true,
      };
    } catch (e) {
      console.error("coach: claude failed:", (e as Error)?.message || e);
    }
  }
  return {
    step: `${g(form, "פתח", "פתחי")} את "${clean(ctx.task?.title, 120)}" ${g(form, "ועבוד", "ועבדי")} 5 דקות על החלק הכי קטן שאפשר.`,
    minutes: 5, done_when: "משפט אחד על מה שנעשה בפועל.", nudge: "רק להתחיל.", model: null, ai_ok: false,
  };
}

export async function judgeReport(deps: Deps, gs: any, report: string) {
  const s = gs.settings || {}, form = s.form || "m";
  if (deps.env.anthropicKey) {
    try {
      const r = await askClaude(deps.anthropic, {
        model: deps.env.gateModel, system: judgeSystem(form), user: judgeContext(gs, report),
        schema: JUDGE_SCHEMA, effort: "low", maxTokens: 1024, timeoutMs: 10000, retries: 1,
      });
      return { accepted: !!r.data.accepted, feedback: clean(r.data.feedback, 400), ai_ok: true };
    } catch (e) {
      console.error("judge: claude failed:", (e as Error)?.message || e);
    }
  }
  const ok = report.trim().length >= 20;
  return {
    accepted: ok,
    feedback: ok ? "נרשם. (Claude לא זמין, אז הדיווח התקבל כמו שהוא.)" : "צריך עוד פרט אחד: מה בדיוק נעשה?",
    ai_ok: false,
  };
}

// ------------------------------------------------------------------ the handler
export type Deps = {
  env: {
    token: string; anthropicKey: string; gateModel: string; coachModel: string;
    appUrl: string; allowOrigins: string[];
  };
  rpc: (action: string, args?: Record<string, unknown>) => Promise<any>;
  anthropic: () => Promise<Anthropic>;
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

  async function api(action: string, b: any) {
    switch (action) {
      case "state":
        return deps.rpc("state", { app: b.app ? cleanApp(b.app) : "" });

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
        const d = await decideGate(deps, st, app, intent);
        const attempt = await deps.rpc("attempt_new", { app, intent, ...d });
        return { attempt };
      }

      case "answer": {
        const answer = clean(b.answer, 500);
        if (!answer) throw new ApiError("empty");
        const t = await deps.rpc("attempt_get", { id: id(b.attempt_id) });
        if (t.decision !== "ask" || t.final_decision || t.outcome) throw new ApiError("bad_state", 409);
        const st = await deps.rpc("state", { app: t.app });
        const d = await decideGate(deps, st, t.app, t.intent, { question: t.question, answer, id: t.id });
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
        const d = await coachStep(deps, ctx);
        const step = await deps.rpc("step_new", { task_id: ctx.task.id, ...d });
        return { step: { ...step, nudge: d.nudge }, lock: ctx.lock };
      }

      case "report": {
        const report = clean(b.report, 1000);
        if (!report) throw new ApiError("empty");
        const gs = await deps.rpc("step_get", { id: id(b.step_id) });
        if (gs.accepted) throw new ApiError("bad_state", 409);
        if (gs.elapsed_sec < gs.min_sec) throw new ApiError("too_soon", 409, "too_soon", { wait_sec: gs.min_sec - gs.elapsed_sec });
        const d = await judgeReport(deps, gs, report);
        const r = await deps.rpc("step_report", { id: gs.id, report, accepted: d.accepted, feedback: d.feedback });
        return { ...r, feedback: d.feedback };
      }

      case "task_close":
        return deps.rpc("task_close", { id: id(b.id), status: b.status === "dropped" ? "dropped" : "done" });
      case "settings": {
        const { k: _k, ...patch } = b;
        return deps.rpc("settings", patch);
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
      if (req.method !== "GET" || !["open", "close", "ping"].includes(action)) return text("not found", 404);
      let app = arg || (action === "ping" ? "ping" : "");
      try { app = decodeURIComponent(app); } catch { app = ""; }
      return shortcut(action, app, url.searchParams.get("k") || "");
    }

    if (action === "health" && req.method === "GET") return json(req, { ok: true });
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
  let client: Promise<Anthropic> | null = null;
  Deno.serve(createHandler({
    env: {
      token: env("SHAAR_TOKEN"),
      anthropicKey: env("ANTHROPIC_API_KEY"),
      gateModel: env("SHAAR_GATE_MODEL") || "claude-haiku-5-5",
      coachModel: env("SHAAR_COACH_MODEL") || "claude-opus-5-5",
      appUrl: env("SHAAR_APP_URL") || DEFAULT_APP_URL,
      allowOrigins: env("SHAAR_ALLOW_ORIGINS").split(",").map((s) => s.trim()).filter(Boolean),
    },
    rpc: makeRpc(env("SUPABASE_URL"), serviceKey()),
    // loaded on first use, so the Shortcut's /s/open path never pays for the SDK import
    anthropic: () => (client ??= import(SDK).then((m) => new m.default({ apiKey: env("ANTHROPIC_API_KEY") }))),
  }));
}
