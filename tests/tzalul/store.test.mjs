import test from "node:test";
import assert from "node:assert/strict";
import { mod } from "./setup.mjs";
const S = await mod("js/store.js");

test("sanitize drops unknown fields, clamps numbers and rejects bad enums", () => {
  const s = S.sanitize({
    onboarded: true, evil: "<script>", __proto__: { polluted: 1 },
    profile: { name: "x".repeat(500), gender: "z", mode: "hack", quitAt: "not a date", baseline: { sessionsPerDay: 9999, costPerWeek: -5, methods: ["joint", "rocket"] }, reasons: ["a", 5, "", "<img src=x onerror=alert(1)>"] },
    settings: { theme: "neon", checkinTime: "25:99", autoLockMin: 7 },
    checkins: [{ date: "2026-01-01", mood: 99, sleep: -1, symptoms: ["dreams", "fake"], note: "ok" }, { date: "bad" }, { date: "2026-01-01", mood: 2 }],
    cravings: [{ ts: "2026-01-01T10:00:00Z", trigger: "nope", coping: ["walk", "fly"], outcome: "maybe", intensity: 50 }],
    plan: { contacts: [{ name: "דנה", phone: "javascript:alert(1)//050-123" }], triggers: [{ k: "stress", plan: "walk" }, { k: "bad" }] },
  });
  assert.equal(s.evil, undefined);
  assert.equal({}.polluted, undefined);
  assert.equal(s.profile.name.length, 40);
  assert.equal(s.profile.gender, "n");
  assert.equal(s.profile.mode, "quit");
  assert.ok(!Number.isNaN(new Date(s.profile.quitAt).getTime()));
  assert.equal(s.profile.baseline.sessionsPerDay, 50);
  assert.equal(s.profile.baseline.costPerWeek, 0);
  assert.deepEqual(s.profile.baseline.methods, ["joint"]);
  assert.deepEqual(s.profile.reasons, ["a", "5", "<img src=x onerror=alert(1)>"], "text is kept as text; escaping happens at render");
  assert.equal(s.settings.theme, "auto");
  assert.equal(s.settings.checkinTime, "21:00");
  assert.equal(s.settings.autoLockMin, 5);
  assert.equal(s.checkins.length, 1, "invalid dropped, duplicates per day merged");
  assert.equal(s.checkins[0].mood, 2);
  assert.equal(s.cravings[0].trigger, null);
  assert.deepEqual(s.cravings[0].coping, ["walk"]);
  assert.equal(s.cravings[0].outcome, "resisted");
  assert.equal(s.cravings[0].intensity, 10);
  assert.equal(s.plan.contacts[0].phone, "1050-123");
  assert.ok(!/[a-z:]/i.test(s.plan.contacts[0].phone));
  assert.equal(s.plan.triggers.length, 1);
});

test("sanitize of garbage returns defaults", () => {
  for (const x of [null, 5, "str", [], { profile: 3 }]) {
    const s = S.sanitize(x);
    assert.equal(s.v, S.SCHEMA);
    assert.ok(Array.isArray(s.checkins));
  }
});

test("import validates the backup format", () => {
  assert.throws(() => S.importJSON("{"), SyntaxError);
  assert.throws(() => S.importJSON(JSON.stringify({ app: "other", state: {} })));
  const st = S.defaults();
  st.profile.name = "נועה";
  const back = S.importJSON(S.exportJSON(st));
  assert.equal(back.profile.name, "נועה");
  assert.equal(back.onboarded, true);
});

test("plain save/load round trip", async () => {
  localStorage.clear();
  assert.equal(S.load().fresh, true);
  const st = S.defaults();
  st.onboarded = true; st.profile.reasons = ["שינה"];
  await S.save(st);
  const r = S.load();
  assert.equal(r.locked, undefined);
  assert.deepEqual(r.state.profile.reasons, ["שינה"]);
});

test("encryption: nothing readable on disk, wrong code fails, right code opens", async () => {
  localStorage.clear();
  const st = S.defaults();
  st.onboarded = true; st.journal.push({ id: "abcdef", ts: new Date().toISOString(), prompt: "", text: "סוד אישי מאוד", mood: null });
  await S.enableLock(st, "1234");
  const raw = localStorage.getItem(S.KEY);
  assert.ok(!raw.includes("סוד"), "journal text must not be stored in clear");
  assert.ok(!raw.includes("journal"));
  assert.equal(S.load().locked, true);
  S.forgetKey();
  await assert.rejects(S.unlock("0000"));
  const open = await S.unlock("1234");
  assert.equal(open.journal[0].text, "סוד אישי מאוד");
  assert.equal(S.isEncrypted(), true);

  // after auto-lock the key is forgotten: saving must never fall back to plaintext
  S.forgetKey();
  await S.save(open);
  assert.equal(localStorage.getItem(S.KEY), raw);

  await S.unlock("1234");
  await S.disableLock(open);
  assert.ok(localStorage.getItem(S.KEY).includes("סוד"));
  assert.equal(S.load().locked, undefined);
  S.wipe();
  assert.equal(localStorage.getItem(S.KEY), null);
});

test("uid format survives sanitizing", () => {
  for (let i = 0; i < 50; i++) assert.match(S.uid(), /^[a-z0-9]{6,12}$/i);
});
