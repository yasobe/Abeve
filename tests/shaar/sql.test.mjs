// State-machine tests for supabase/shaar.sql against a real Postgres.
// Usage: PGURL=postgres://postgres@localhost:54329/shaar_test node tests/shaar/sql.test.mjs
// (needs `npm i pg` in tests/shaar; the script recreates the schema in that database)
import pg from "pg";
import fs from "node:fs";
import assert from "node:assert/strict";

const sqlFile = new URL("../../supabase/shaar.sql", import.meta.url);
const db = new pg.Client({ connectionString: process.env.PGURL });
await db.connect();
await db.query(`drop schema public cascade; create schema public;`);
for (const r of ["anon", "authenticated", "service_role"])
  await db.query(`do $$ begin if not exists (select 1 from pg_roles where rolname='${r}') then create role ${r} nologin ${r === "service_role" ? "bypassrls" : ""}; end if; end $$`);
await db.query("grant usage on schema public to public, anon, authenticated, service_role");
const ddl = fs.readFileSync(sqlFile, "utf8");
await db.query(ddl);
await db.query(ddl); // idempotent

let clock = new Date("2026-11-26T08:00:00Z");
const tick = (sec) => (clock = new Date(clock.getTime() + sec * 1000));
async function api(action, args = {}) {
  await db.query("set role service_role");
  await db.query("select set_config('shaar.now', $1, false)", [clock.toISOString()]);
  try {
    const { rows } = await db.query("select public.shaar_api($1, $2::jsonb) as r", [action, JSON.stringify(args)]);
    return rows[0].r;
  } finally { await db.query("reset role"); }
}
async function err(action, args) {
  try { await api(action, args); } catch (e) { return e.message; }
  throw new Error(`expected ${action} to fail`);
}
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log("ok -", name); };
const passFlow = async (app, minutes = 5, decision = "pass") => {
  const t = await api("attempt_new", { app, intent: "לענות להודעה של דנה", decision, message: "סבבה", max_minutes: minutes, wait_seconds: 0, model: "test" });
  return api("pass", { attempt_id: t.id, minutes });
};

await test("permissions: anon/authenticated blocked", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.query(`set role ${role}`);
    await assert.rejects(db.query("select * from shaar_attempts"), /permission denied/);
    await assert.rejects(db.query("select shaar_api('state')"), /permission denied/);
    await db.query("reset role");
  }
});

await test("first open goes to the gate", async () => {
  assert.equal((await api("open", { app: "instagram" })).r, "gate");
  assert.match(await err("open", { app: "Insta gram!" }), /shaar:bad_app/);
});

await test("contract kept: timer on first open, ok inside, cooldown after", async () => {
  const p = await passFlow("instagram", 5);
  assert.equal(p.minutes, 5);
  tick(20);
  const o = await api("open", { app: "instagram" });
  assert.deepEqual([o.r, o.minutes], ["timer", 5]);
  tick(60); assert.equal((await api("open", { app: "instagram" })).r, "ok");
  tick(60); assert.equal((await api("close", { app: "instagram" })).r, "ok");
  tick(60); assert.equal((await api("open", { app: "instagram" })).r, "ok");
  tick(60); assert.equal((await api("close", { app: "instagram" })).r, "ok");
  assert.equal((await api("open", { app: "youtube" })).r, "gate"); // contract is per app
  tick(90); // 30s after the end: over, closed in time, still inside the grace minute
  const s = await api("state", { app: "instagram" });
  assert.equal(s.lock, null); // still inside the grace minute
  tick(40);
  const s2 = await api("state", { app: "instagram" });
  assert.equal(s2.last_pass.status, "kept");
  assert.equal(s2.lock.kind, "cooldown");
  assert.equal((await api("open", { app: "instagram" })).r, "lock");
  assert.equal(s2.streak, 0);
});

await test("gate refuses a pass while locked", async () => {
  const t = await api("attempt_new", { app: "tiktok", intent: "סתם", decision: "pass", max_minutes: 5 });
  assert.match(await err("pass", { attempt_id: t.id, minutes: 5 }), /shaar:locked/);
  tick(11 * 60);
  assert.equal((await api("state")).lock, null);
});

await test("wait must elapse before the contract", async () => {
  const t = await api("attempt_new", { app: "tiktok", intent: "משעמם לי", decision: "wait", wait_seconds: 90, max_minutes: 3 });
  assert.match(await err("pass", { attempt_id: t.id, minutes: 3 }), /shaar:wait/);
  const st = await api("state", { app: "tiktok" });
  assert.equal(st.pending.id, t.id);
  tick(91);
  const p = await api("pass", { attempt_id: t.id, minutes: 10 });
  assert.equal(p.minutes, 3); // clamped to what the gatekeeper allowed
  assert.match(await err("pass", { attempt_id: t.id, minutes: 3 }), /shaar:stale/);
});

await test("unused pass expires after the start window", async () => {
  tick(181);
  assert.equal((await api("open", { app: "tiktok" })).r, "gate");
});

await test("one question, then a decision", async () => {
  const t = await api("attempt_new", { app: "youtube", intent: "לראות משהו", decision: "ask", question: "מה בדיוק?", max_minutes: 10 });
  assert.equal(t.question, "מה בדיוק?");
  assert.match(await err("pass", { attempt_id: t.id, minutes: 5 }), /shaar:need_answer/);
  const t2 = await api("attempt_answer", { id: t.id, answer: "מתכון לשקשוקה", decision: "pass", message: "בתיאבון", max_minutes: 8 });
  assert.equal(t2.final_decision, "pass");
  assert.match(await err("attempt_answer", { id: t.id, answer: "שוב", decision: "pass" }), /shaar:bad_state/);
  const p = await api("pass", { attempt_id: t.id, minutes: 8 });
  assert.equal(p.minutes, 8);
});

await test("overrun: broken contract and a longer penalty lock, growing with the streak", async () => {
  assert.equal((await api("open", { app: "youtube" })).minutes, 8);
  tick(12 * 60); // 4 minutes over
  assert.equal((await api("close", { app: "youtube" })).r, "broken");
  let s = await api("state");
  assert.equal(s.lock.kind, "penalty");
  assert.equal(s.lock.meta.overrun_min, 4);
  assert.equal(s.lock.meta.lock_min, 18); // (10 + 4*2) * 1
  assert.equal(s.streak, 1);
  assert.equal(s.lock_pass.status, "broken");
  assert.equal((await api("open", { app: "instagram" })).r, "lock");
  tick(18 * 60 + 1);
  await passFlow("instagram", 5);
  await api("open", { app: "instagram" });
  tick(9 * 60);
  await api("close", { app: "instagram" });
  s = await api("state");
  assert.equal(s.streak, 2);
  assert.equal(s.lock.meta.lock_min, 27); // (10 + 4*2) * 1.5
});

await test("effort: a reported step releases the lock early", async () => {
  const c = await api("task_ctx", { title: "להגיש דוח הוצאות" });
  assert.ok(c.lock);
  const st = await api("step_new", { task_id: c.task.id, step: "לפתוח את התיקייה ולשים 3 קבלות בטבלה", minutes: 5, done_when: "3 שורות בטבלה", model: "test" });
  tick(30);
  assert.match(await err("step_report", { id: st.id, report: "עשיתי", accepted: true }), /shaar:too_soon/);
  tick(100);
  const g = await api("step_get", { id: st.id });
  assert.equal(g.locked, true);
  assert.ok(g.elapsed_sec >= g.min_sec);
  const r = await api("step_report", { id: st.id, report: "הכנסתי 3 קבלות", accepted: true, feedback: "יפה" });
  assert.deepEqual([r.accepted, r.result], [true, "released"]);
  assert.equal((await api("state")).lock, null);
  assert.equal((await api("open", { app: "instagram" })).r, "gate");
});

await test("effort without a lock banks a credit; a credit releases a manual lock", async () => {
  const s0 = await api("state");
  const taskId = s0.tasks[0].id;
  assert.equal(s0.tasks[0].steps, 1);
  const ctx = await api("task_ctx", { task_id: taskId });
  assert.equal(ctx.history.length, 1);
  const st = await api("step_new", { task_id: taskId, step: "עוד 3 קבלות", minutes: 2 });
  tick(121);
  const rej = await api("step_report", { id: st.id, report: "לא", accepted: false, feedback: "צריך פרט אחד" });
  assert.equal(rej.result, "none");
  const r = await api("step_report", { id: st.id, report: "עוד 3 קבלות בטבלה", accepted: true });
  assert.deepEqual([r.result, r.credits], ["credit", 1]);
  await api("lock", { minutes: 60 });
  assert.equal((await api("open", { app: "tiktok" })).r, "lock");
  assert.equal((await api("use_credit")).credits, 0);
  assert.equal((await api("open", { app: "tiktok" })).r, "gate");
  assert.match(await err("use_credit"), /shaar:not_locked/);
  assert.match(await err("lock", { minutes: 0 }), /shaar:bad_minutes/);
});

await test("cooldown of one app does not cancel another app's valid contract; manual lock does", async () => {
  await passFlow("instagram", 2);
  await api("open", { app: "instagram" });
  await passFlow("youtube", 10);
  tick(2 * 60 + 61 + 5); // instagram over (closed earlier? no close -> stays active until open/close)
  await api("close", { app: "instagram" });  // closed 66s late -> broken (grace is 60s)
  let s = await api("state");
  assert.equal(s.lock.kind, "penalty");
  // youtube pass was granted >3 min ago -> unused, so gate is locked
  assert.equal((await api("open", { app: "youtube" })).r, "lock");
  tick(60 * 60);
  // fresh scenario with a cooldown
  await api("settings", { cooldown_min: 10 });
  await passFlow("instagram", 1);
  await api("open", { app: "instagram" });
  tick(30); await api("close", { app: "instagram" });
  await passFlow("youtube", 10);
  tick(40); // instagram contract over; a (second) close inside the grace minute settles it as kept
  assert.equal((await api("close", { app: "instagram" })).r, "kept");
  tick(60);
  s = await api("state");
  assert.equal(s.lock.kind, "cooldown");
  assert.equal((await api("open", { app: "youtube" })).r, "timer");
  assert.equal((await api("open", { app: "tiktok" })).r, "lock");
  await api("lock", { minutes: 30 });
  assert.equal((await api("open", { app: "youtube" })).r, "lock");
});

await test("no close event: reopening after time is up counts as unknown", async () => {
  tick(31 * 60 + 11 * 60);
  await passFlow("tiktok", 3);
  await api("open", { app: "tiktok" });
  tick(5 * 60);
  const o = await api("open", { app: "tiktok" });
  assert.equal(o.r, "lock");
  assert.equal((await api("state")).last_pass.status, "unknown");
});

await test("resist, stats, settings whitelist, export", async () => {
  tick(11 * 60);
  const t = await api("attempt_new", { app: "instagram", intent: "בורח מהעבודה", decision: "wait", wait_seconds: 60 });
  const r = await api("resist", { attempt_id: t.id });
  assert.equal(r.ok, true);
  assert.ok(r.stats.resisted >= 1);
  const before = (await api("state")).stats.resisted;
  const r2 = await api("resist", { app: "tiktok" });
  assert.equal(r2.stats.resisted, before + 1);
  const set = await api("settings", { form: "f", cooldown_min: 999, rules: "אין יוטיוב לפני 20:00", evil: 1, tz: "Mars/Base" });
  assert.equal(set.form, "f");
  assert.equal(set.cooldown_min, 120);
  assert.equal(set.tz, "Asia/Jerusalem");
  assert.equal(set.evil, undefined);
  const x = await api("export", { days: 7 });
  assert.ok(x.events.length > 10 && x.attempts.length > 5 && x.passes.length > 5 && x.locks.length > 3);
  const s = await api("state", { app: "instagram" });
  assert.ok(s.stats.visits > 0 && s.stats.kept >= 1 && s.stats.broken >= 2);
  assert.ok(s.recent.length > 0);
  assert.match(await err("nope"), /shaar:bad_action/);
});

console.log(`\n${n} tests passed`);
await db.end();
