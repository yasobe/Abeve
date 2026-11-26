// End-to-end tests for the Edge Function over HTTP, with a real Postgres and a fake Claude.
// Usage: PGURL=postgres://postgres@localhost:54329/shaar_fn node tests/shaar/function.test.mjs
import assert from "node:assert/strict";
import { start } from "./server.mjs";
import { decideGate, coachStep, judgeReport, gateContext } from "../../supabase/functions/shaar/index.ts";

const S = await start({ pgUrl: process.env.PGURL, rpcPort: 54410, fnPort: 54411, webPort: 54412 });
const ORIGIN = "http://localhost:54412";
const sget = async (p, k = S.token) => (await fetch(`${S.fnUrl}/s/${p}?k=${encodeURIComponent(k)}`)).text();
async function api(action, body = {}, k = S.token, origin = ORIGIN) {
  const r = await fetch(`${S.fnUrl}/api/${action}`, {
    method: "POST", headers: { "content-type": "text/plain;charset=UTF-8", origin }, body: JSON.stringify({ k, ...body }),
  });
  return { status: r.status, cors: r.headers.get("access-control-allow-origin"), body: await r.json() };
}
const lastClaude = () => S.claudeLog[S.claudeLog.length - 1];
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

try {
  await test("shortcut: bad token opens an explanation page, never an error", async () => {
    assert.equal(await sget("open/instagram", "wrong"), `${S.appUrl}?a=err&e=auth`);
    assert.equal(await sget("close/instagram", "wrong"), "ok");
    assert.equal(await sget("open/In%20sta"), `${S.appUrl}?a=err&e=app`);
    assert.equal(await sget("ping"), "ok");
  });

  await test("setup check: token, database and Claude key, no secrets in the output", async () => {
    assert.match(await sget("check", "wrong"), /^✗ טוקן/);
    const out = await sget("check");
    assert.match(out, /✓ טוקן/);
    assert.match(out, /✓ מסד נתונים/);
    assert.ok(!out.includes(S.token));
  });

  await test("shortcut: first open returns the gate URL with the token in the fragment", async () => {
    assert.equal(await sget("open/instagram"), `${S.appUrl}?a=gate&app=instagram#k=${S.token}`);
  });

  await test("api: auth, CORS only for the app's origin, unknown action", async () => {
    assert.equal((await api("state", {}, "nope")).status, 401);
    const ok = await api("state", { app: "instagram" });
    assert.equal(ok.status, 200);
    assert.equal(ok.cors, ORIGIN);
    assert.equal((await api("state", {}, S.token, "https://evil.example")).cors, null);
    assert.equal((await api("nope")).status, 404);
  });

  await test("gate → pass → contract: timer minutes on first open, then ok", async () => {
    const g = await api("gate", { app: "instagram", intent: "לענות לאמא על ההודעה ששלחה" });
    assert.equal(g.status, 200);
    assert.equal(g.body.attempt.decision, "pass");
    const req = lastClaude();
    assert.equal(req.model, "claude-haiku-5-5");
    assert.equal(req.output_config.effort, "low");
    assert.equal(req.output_config.format.type, "json_schema");
    assert.deepEqual(req.output_config.format.schema.properties.decision.enum, ["pass", "wait", "ask"]);
    assert.equal(req.thinking, undefined);
    assert.equal(req.temperature, undefined);
    assert.match(req.messages[0].content, /<intent>לענות לאמא/);
    const p = await api("pass", { attempt_id: g.body.attempt.id, minutes: 5 });
    assert.equal(p.body.pass.minutes, 5);
    assert.equal(await sget("open/instagram"), "5");
    assert.equal(await sget("open/instagram"), "ok");
    assert.equal(await sget("close/instagram"), "ok");
  });

  await test("wait: a second answer resumes the running wait; pass only after it ends", async () => {
    const g = await api("gate", { app: "tiktok", intent: "סתם משעמם לי" });
    assert.equal(g.body.attempt.decision, "wait");
    assert.equal(g.body.attempt.wait_seconds, 30);
    const again = await api("gate", { app: "tiktok", intent: "צריך לבדוק משהו דחוף מאוד" });
    assert.equal(again.body.resumed, true);
    assert.equal(again.body.attempt.id, g.body.attempt.id);
    const early = await api("pass", { attempt_id: g.body.attempt.id, minutes: 3 });
    assert.deepEqual([early.status, early.body.error], [409, "wait"]);
    S.clock.offsetSec += 31;
    const p = await api("pass", { attempt_id: g.body.attempt.id, minutes: 10 });
    assert.equal(p.body.pass.minutes, 3);
  });

  await test("ask: exactly one question, the answer round can only pass or wait", async () => {
    const g = await api("gate", { app: "youtube", intent: "לראות משהו" });
    assert.equal(g.body.attempt.decision, "ask");
    assert.equal(g.body.attempt.question, "מה בדיוק אתה רוצה לראות?");
    assert.equal((await api("gate", { app: "youtube", intent: "אחר" })).body.resumed, true);
    const a = await api("answer", { attempt_id: g.body.attempt.id, answer: "הרצאה של המרצה על פרק 3" });
    assert.equal(a.body.attempt.final_decision, "pass");
    assert.deepEqual(lastClaude().output_config.format.schema.properties.decision.enum, ["pass", "wait"]);
    assert.match(lastClaude().messages[0].content, /<answer>הרצאה/);
    assert.equal((await api("answer", { attempt_id: g.body.attempt.id, answer: "שוב" })).status, 409);
    assert.equal((await api("pass", { attempt_id: g.body.attempt.id, minutes: 7 })).body.pass.minutes, 7);
  });

  await test("lock: shortcut opens the lock page, the gate refuses", async () => {
    assert.ok((await api("lock", { minutes: 45 })).body.lock);
    assert.equal(await sget("open/reddit"), `${S.appUrl}?a=lock&app=reddit#k=${S.token}`);
    const g = await api("gate", { app: "reddit", intent: "לחפש מדריך" });
    assert.deepEqual([g.status, g.body.error], [409, "locked"]);
    assert.ok(g.body.lock.ends_at);
  });

  await test("effort: strong model writes the step, fast model judges, accepted report releases", async () => {
    const st = await api("step", { title: "לכתוב את דוח הרבעון" });
    assert.equal(st.status, 200);
    const req = lastClaude();
    assert.equal(req.model, "claude-opus-5-5");
    assert.deepEqual(req.betas, ["server-side-fallback-2026-07-01"]);
    assert.equal(req.fallbacks, "default");
    assert.equal(req.output_config.effort, "medium");
    assert.match(req.messages[0].content, /locked for \d+ more minutes/);
    assert.equal(st.body.step.minutes, 3);
    assert.ok(st.body.step.nudge);
    const soon = await api("report", { step_id: st.body.step.id, report: "עשיתי" });
    assert.deepEqual([soon.status, soon.body.error], [409, "too_soon"]);
    assert.ok(soon.body.wait_sec > 0);
    S.clock.offsetSec += 200;
    const bad = await api("report", { step_id: st.body.step.id, report: "עשיתי" });
    assert.equal(bad.body.accepted, false);
    assert.equal(lastClaude().model, "claude-haiku-5-5");
    const good = await api("report", { step_id: st.body.step.id, report: "כתבתי שלוש כותרות: מבוא, נתונים, סיכום" });
    assert.deepEqual([good.body.accepted, good.body.result], [true, "released"]);
    assert.equal((await api("state")).body.lock, null);
    assert.ok((await sget("open/reddit")).includes("a=gate"));
  });

  await test("state, settings, export", async () => {
    const s = await api("settings", { form: "f", rules: "יוטיוב רק אחרי 20:00", k2: 1 });
    assert.equal(s.body.form, "f");
    const st = (await api("state", { app: "instagram" })).body;
    assert.ok(st.stats.attempts >= 3);
    assert.equal(st.tasks.length, 1);
    const x = (await api("export", { days: 3 })).body;
    assert.ok(x.attempts.length >= 3 && x.steps.length === 1);
  });

  await test("Claude down or over the daily limit: rule-based fallbacks keep working", async () => {
    const broken = { env: { anthropicKey: "x", gateModel: "m", coachModel: "claude-opus-5-5" },
                     anthropic: async () => { throw new Error("network"); } };
    const st = { now: new Date().toISOString(), settings: { form: "m" }, stats: { attempts: 1 }, recent: [] };
    const a = await decideGate(broken, st, "instagram", "סתם");
    assert.deepEqual([a.decision, a.ai_ok, a.wait_seconds], ["wait", false, 60]);
    const b = await decideGate(broken, st, "instagram", "לשלוח לדני את הכתובת של האירוע");
    assert.deepEqual([b.decision, b.max_minutes], ["pass", 5]);
    let called = false;
    const capped = { env: { anthropicKey: "x" }, anthropic: async () => { called = true; } };
    await decideGate(capped, { ...st, settings: { ai_daily_limit: 10 }, stats: { ai_today: 10 } }, "x", "סתם");
    assert.equal(called, false);
    const c = await coachStep(broken, { task: { title: "מס הכנסה" }, settings: { form: "f" } });
    assert.match(c.step, /^פתחי/);
    const j = await judgeReport(broken, { settings: {} }, "שלחתי את הטופס לרואה החשבון היום");
    assert.equal(j.accepted, true);
  });

  await test("refusal and malformed output fall back instead of crashing", async () => {
    const mk = (msg) => ({ env: { anthropicKey: "x", gateModel: "m" },
      anthropic: async () => ({ messages: { create: async () => msg } }) });
    const st = { now: new Date().toISOString(), settings: {}, stats: {}, recent: [] };
    assert.equal((await decideGate(mk({ stop_reason: "refusal", content: [] }), st, "x", "סתם")).ai_ok, false);
    assert.equal((await decideGate(mk({ stop_reason: "end_turn", content: [{ type: "text", text: "{oops" }] }), st, "x", "סתם")).ai_ok, false);
    const thinkingFirst = { stop_reason: "end_turn", model: "m", content: [{ type: "thinking", thinking: "" },
      { type: "text", text: JSON.stringify({ decision: "pass", message: "ok", question: "", wait_seconds: 0, max_minutes: 99 }) }] };
    const d = await decideGate(mk(thinkingFirst), st, "x", "לקנות כרטיס לסרט של 20:00");
    assert.deepEqual([d.decision, d.max_minutes, d.ai_ok], ["pass", 30, true]);
  });

  await test("context sent to the gatekeeper", async () => {
    const st = (await api("state", { app: "instagram" })).body;
    const c = gateContext(st, "instagram", "בדיקה");
    assert.match(c, /App opened: אינסטגרם/);
    assert.match(c, /Personal rules: יוטיוב רק אחרי 20:00/);
    assert.match(c, /Earlier answers/);
  });

  console.log(`\n${n} tests passed`);
} finally {
  await S.stop();
}
