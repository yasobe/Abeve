// Tests for the rules version of the Edge Function (no Claude, no API key):
// pure decision tests, then the full HTTP flow against a real Postgres.
// Usage: PGURL=postgres://postgres@localhost:5432/shaar_rules node tests/shaar/rules.test.mjs
import assert from "node:assert/strict";
import { start } from "./server.mjs";
import {
  decideGate, coachStep, judgeReport, parseRules, describeRules, classify, FOLLOW_UP, localMinutes,
} from "../../supabase/functions/shaar-rules/index.ts";

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

// A state like the one shaar_api('state') returns, at a fixed local time in Israel.
const at = (hhmm) => {
  const d = new Date("2026-11-26T12:00:00+02:00");
  const [h, m] = hhmm.split(":").map(Number);
  d.setTime(d.getTime() + ((h - 12) * 60 + m) * 60000);
  return d.toISOString();
};
const st = (o = {}) => ({
  now: at(o.time || "12:00"),
  settings: { form: "m", tz: "Asia/Jerusalem", max_minutes_cap: 30, rules: "", ...(o.settings || {}) },
  stats: { attempts: 0, minutes: 0, ...(o.stats || {}) },
  last_pass: o.last_pass || null,
  recent: [],
});

// ------------------------------------------------------------------ pure rules
await test("local time follows the settings time zone", async () => {
  assert.equal(localMinutes(new Date(at("21:15")), "Asia/Jerusalem"), 21 * 60 + 15);
});

await test("lists: purpose, not a purpose, unclear", async () => {
  const r = parseRules("");
  assert.equal(classify("לענות לאמא על ההודעה", r).kind, "purpose");
  assert.equal(classify("לענות לאמא על ההודעה", r).minutes, 3);
  assert.equal(classify("לראות את ההרצאה על פרק 3", r).minutes, 15);
  assert.equal(classify("סתם, משעמם לי", r).kind, "vague");
  assert.equal(classify("רק להציץ רגע", r).kind, "vague");
  assert.equal(classify("לבדוק משהו", r).kind, "unclear");
  // "not a purpose" beats a purpose word in the same answer
  assert.equal(classify("לחפש משהו כי משעמם", r).kind, "vague");
  // Latin words only as whole words
  assert.equal(classify("dmitri", r).kind, "unclear");
});

await test("gate: clear purpose passes for the purpose's minutes, capped", async () => {
  const d = decideGate(st(), "instagram", "לענות לדני על ההודעה ששלח");
  assert.deepEqual([d.decision, d.max_minutes, d.wait_seconds, d.ai_ok, d.model], ["pass", 3, 0, false, "rules-v1"]);
  const lecture = decideGate(st({ settings: { max_minutes_cap: 10 } }), "youtube", "הרצאה של המרצה על פרק 3");
  assert.deepEqual([lecture.decision, lecture.max_minutes], ["pass", 10]);
});

await test("gate: vague answer waits; waits grow when busy and at night", async () => {
  const a = decideGate(st(), "tiktok", "סתם");
  assert.deepEqual([a.decision, a.wait_seconds, a.max_minutes], ["wait", 60, 3]);
  const busy = decideGate(st({ stats: { attempts: 7 } }), "tiktok", "סתם");
  assert.equal(busy.wait_seconds, 60 + 15 * 4);
  const night = decideGate(st({ time: "23:30" }), "tiktok", "סתם");
  assert.equal(night.wait_seconds, 90);
  assert.match(night.message, /לילה/);
});

await test("gate: unclear first answer gets the one fixed question, feminine form too", async () => {
  const d = decideGate(st(), "youtube", "לראות משהו");
  assert.deepEqual([d.decision, d.question], ["ask", FOLLOW_UP.m]);
  assert.equal(decideGate(st({ settings: { form: "f" } }), "youtube", "לראות משהו").question, FOLLOW_UP.f);
  // at night or after many visits there is no question, only a wait
  assert.equal(decideGate(st({ time: "01:00" }), "youtube", "לראות משהו").decision, "wait");
  assert.equal(decideGate(st({ stats: { attempts: 6 } }), "youtube", "לראות משהו").decision, "wait");
});

await test("gate: the answer round only passes or waits", async () => {
  const qa = (answer) => decideGate(st(), "youtube", "לראות משהו", { question: FOLLOW_UP.m, answer });
  const video = qa("את הסרטון של דני על הטיול לאילת");
  assert.deepEqual([video.decision, video.max_minutes], ["pass", 15]); // a purpose word: its minutes
  const plan = qa("להסתכל על התמונות מהחתונה של רונית ואז לצאת");
  assert.deepEqual([plan.decision, plan.max_minutes], ["pass", 5]);    // a concrete sentence: 5 min
  assert.equal(qa("לחפש את המתכון").decision, "pass");
  assert.equal(qa("לא יודע").decision, "wait");
  assert.equal(qa("משהו").decision, "wait");
});

await test("gate: broken contract in the last hour and the daily minutes limit", async () => {
  const broke = decideGate(st({ last_pass: { status: "broken", settled_at: at("11:40") } }), "instagram", "לענות לדני");
  assert.deepEqual([broke.decision, broke.wait_seconds], ["wait", 180]);
  assert.match(broke.message, /לפני 20 דק׳/);
  const old = decideGate(st({ last_pass: { status: "broken", settled_at: at("10:00") } }), "instagram", "לענות לדני");
  assert.equal(old.decision, "pass");
  const daily = decideGate(st({ stats: { minutes: 90 } }), "instagram", "לענות לדני");
  assert.deepEqual([daily.decision, daily.wait_seconds], ["wait", 300]);
});

await test("my rules: app hours, blocked app, per-app max, extra lists, night, limits", async () => {
  const rules = [
    "יוטיוב רק אחרי 20:00", "טיקטוק: חסום", "אינסטגרם: 4 דקות", "מותר: לוח זמנים", "אסור: חדשות",
    "לילה: 22:00-07:00", "דקות ביום: 30", "כניסות ביום: 3", "משהו שאי אפשר להבין",
  ].join("\n");
  const r = parseRules(rules);
  assert.deepEqual(r.apps.youtube.window, [20 * 60, 24 * 60]);
  assert.equal(r.apps.tiktok.blocked, true);
  assert.equal(r.apps.instagram.max, 4);
  assert.deepEqual([r.allow, r.deny, r.night, r.dailyMinutes, r.busyAttempts], [["לוח זמנים"], ["חדשות"], [1320, 420], 30, 3]);
  assert.deepEqual(r.unknown, ["משהו שאי אפשר להבין"]);
  const lines = describeRules(r);
  assert.ok(lines.includes("יוטיוב: רק מ-20:00 עד 24:00"));
  assert.ok(lines.includes('לא הבנתי: "משהו שאי אפשר להבין"'));

  const S = (o = {}) => st({ ...o, settings: { rules, ...(o.settings || {}) } });
  const early = decideGate(S({ time: "18:00" }), "youtube", "הרצאה על פרק 3");
  assert.deepEqual([early.decision, early.wait_seconds], ["wait", 300]);
  assert.match(early.message, /מ-20:00 עד 24:00/);
  assert.equal(decideGate(S({ time: "20:30" }), "youtube", "הרצאה על פרק 3").decision, "pass");
  assert.equal(decideGate(S(), "tiktok", "לשלוח הודעה לדני").decision, "wait");
  assert.equal(decideGate(S(), "instagram", "לחפש את הכתובת של האירוע").max_minutes, 4);
  assert.equal(decideGate(S(), "instagram", "לראות את לוח זמנים של ההופעה").decision, "pass");
  assert.equal(decideGate(S(), "instagram", "לחפש חדשות").decision, "wait");
  assert.equal(decideGate(S({ time: "22:30" }), "instagram", "לראות משהו").decision, "wait");
  assert.equal(decideGate(S({ stats: { minutes: 30 } }), "instagram", "לענות לדני").decision, "wait");
  // the old free-text example and a range in Hebrew
  assert.deepEqual(parseRules("יוטיוב רק לפני 9:00").apps.youtube.window, [0, 540]);
  assert.deepEqual(parseRules("נטפליקס רק בין 20:00 ל-23:00").apps.netflix.window, [1200, 1380]);
  assert.deepEqual(parseRules("youtube: 6-8").apps.youtube.window, [360, 480]);
  assert.equal(parseRules("לילה: בלי").night, null);
});

await test("effort: fixed steps move forward, the check needs a concrete detail", async () => {
  const s1 = coachStep({ task: { title: "דוח הוצאות" }, settings: { form: "f" }, history: [] });
  assert.equal(s1.minutes, 2);
  assert.match(s1.step, /^כתבי/);
  const s2 = coachStep({ task: { title: "דוח הוצאות" }, settings: {}, history: [{ step: "x", report: "לפתוח את הקובץ ולמלא את ינואר", accepted: true }] });
  assert.equal(s2.minutes, 5);
  assert.match(s2.step, /לפתוח את הקובץ ולמלא את ינואר/);
  const s3 = coachStep({ task: { title: "דוח" }, settings: {}, history: [{ accepted: true, report: "a b c" }, { accepted: true, report: "מילאתי את ינואר ופברואר" }] });
  assert.equal(s3.minutes, 10);
  const retry = coachStep({ task: { title: "דוח" }, settings: {}, history: [{ accepted: false, report: "עשיתי" }] });
  assert.equal(retry.minutes, 2);

  const gs = { settings: {}, step: "לכתוב שורה אחת" };
  assert.equal(judgeReport(gs, "עשיתי").accepted, false);
  assert.equal(judgeReport(gs, "לא הספקתי היום בכלל").accepted, false);
  assert.equal(judgeReport(gs, "לכתוב שורה אחת").accepted, false);
  assert.equal(judgeReport(gs, "פתחתי את הקובץ ומילאתי את ינואר").accepted, true);
});

// ------------------------------------------------------------------ over HTTP, with Postgres
const S = await start({ pgUrl: process.env.PGURL, rpcPort: 54420, fnPort: 54421, webPort: 54422, engine: "rules" });
const ORIGIN = "http://localhost:54422";
const sget = async (p, k = S.token) => (await fetch(`${S.fnUrl}/s/${p}?k=${encodeURIComponent(k)}`)).text();
async function api(action, body = {}, k = S.token) {
  const r = await fetch(`${S.fnUrl}/api/${action}`, {
    method: "POST", headers: { "content-type": "text/plain;charset=UTF-8", origin: ORIGIN }, body: JSON.stringify({ k, ...body }),
  });
  return { status: r.status, body: await r.json() };
}
try {
  await test("http: setup check says rules, no Anthropic key needed", async () => {
    const out = await sget("check");
    assert.match(out, /✓ טוקן/);
    assert.match(out, /✓ מסד נתונים/);
    assert.match(out, /כללים קבועים, בלי AI/);
    assert.ok(!/Anthropic/.test(out));
    assert.ok(!out.includes(S.token));
  });

  await test("http: state and settings carry the engine and what my rules mean", async () => {
    const st = (await api("state", { app: "instagram" })).body;
    assert.equal(st.settings.engine, "rules");
    assert.ok(Array.isArray(st.settings.rules_summary));
    const s = (await api("settings", { rules: "טיקטוק: חסום" })).body;
    assert.equal(s.rules, "טיקטוק: חסום");
    assert.ok(s.rules_summary.includes("טיקטוק: חסום (המתנה ארוכה בכל כניסה)"));
    await api("settings", { rules: "" });
  });

  await test("http: purpose → pass → contract (timer minutes, then ok); nothing recorded as AI", async () => {
    assert.ok((await sget("open/instagram")).includes("a=gate"));
    const g = await api("gate", { app: "instagram", intent: "לענות לאמא על ההודעה ששלחה" });
    assert.equal(g.status, 200);
    assert.deepEqual([g.body.attempt.decision, g.body.attempt.max_minutes, g.body.attempt.ai_ok, g.body.attempt.model],
                     ["pass", 3, false, "rules-v1"]);
    const p = await api("pass", { attempt_id: g.body.attempt.id, minutes: 10 });
    assert.equal(p.body.pass.minutes, 3); // capped by the gate's minutes, as before
    assert.equal(await sget("open/instagram"), "3");
    assert.equal(await sget("open/instagram"), "ok");
    assert.equal(await sget("close/instagram"), "ok");
    assert.equal(S.claudeLog.length, 0);
  });

  await test("http: vague → wait that resumes; ask → one answer", async () => {
    S.clock.offsetSec += 30 * 60; // past the cooldown of the previous contract
    const w = await api("gate", { app: "tiktok", intent: "סתם משעמם לי" });
    assert.equal(w.body.attempt.decision, "wait");
    assert.ok(w.body.attempt.wait_seconds >= 60);
    assert.equal((await api("gate", { app: "tiktok", intent: "לענות להודעה" })).body.resumed, true);
    assert.equal((await api("pass", { attempt_id: w.body.attempt.id, minutes: 3 })).body.error, "wait");
    S.clock.offsetSec += w.body.attempt.wait_seconds + 1;
    assert.equal((await api("resist", { attempt_id: w.body.attempt.id })).status, 200);

    const a = await api("gate", { app: "youtube", intent: "לראות משהו" });
    assert.deepEqual([a.body.attempt.decision, a.body.attempt.question], ["ask", FOLLOW_UP.m]);
    const r = await api("answer", { attempt_id: a.body.attempt.id, answer: "את הסרטון של דני על הטיול לאילת" });
    assert.equal(r.body.attempt.final_decision, "pass");
    assert.equal((await api("answer", { attempt_id: a.body.attempt.id, answer: "שוב" })).status, 409);
  });

  await test("http: lock → fixed effort step → concrete report releases the lock", async () => {
    assert.ok((await api("lock", { minutes: 45 })).body.lock);
    assert.ok((await sget("open/reddit")).includes("a=lock"));
    const st = await api("step", { title: "לכתוב את דוח הרבעון" });
    assert.equal(st.body.step.minutes, 2);
    assert.match(st.body.step.step, /דוח הרבעון/);
    assert.equal((await api("report", { step_id: st.body.step.id, report: "כתבתי" })).body.error, "too_soon");
    S.clock.offsetSec += 125;
    const bad = await api("report", { step_id: st.body.step.id, report: "עשיתי" });
    assert.equal(bad.body.accepted, false);
    const good = await api("report", { step_id: st.body.step.id, report: "הפעולה הבאה: לפתוח את הגיליון ולמלא את נתוני אוקטובר" });
    assert.deepEqual([good.body.accepted, good.body.result], [true, "released"]);
    assert.equal((await api("state")).body.lock, null);
    const next = await api("step", { task_id: st.body.step.task_id });
    assert.equal(next.body.step.minutes, 5);
    assert.match(next.body.step.step, /נתוני אוקטובר/);
  });

  await test("http: penalty for an overrun is unchanged (10 + 2×minutes over)", async () => {
    S.clock.offsetSec += 60 * 60;
    const g = await api("gate", { app: "instagram", intent: "לשלוח לדני את הכתובת" });
    assert.equal(g.body.attempt.decision, "pass");
    await api("pass", { attempt_id: g.body.attempt.id, minutes: 3 });
    assert.equal(await sget("open/instagram"), "3");
    S.clock.offsetSec += (3 + 4) * 60; // closed 4 minutes late
    await sget("close/instagram");
    const lock = (await api("state")).body.lock;
    assert.equal(lock.kind, "penalty");
    assert.equal(lock.meta.lock_min, 10 + 2 * 4);
    // and right after it, the gate waits because a contract was just broken
    S.clock.offsetSec += 19 * 60;
    const after = await api("gate", { app: "instagram", intent: "לענות לדני" });
    assert.equal(after.body.attempt.decision, "wait");
  });

  console.log(`\n${n} tests passed`);
} finally {
  await S.stop();
}
