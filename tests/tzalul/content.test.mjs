import test from "node:test";
import assert from "node:assert/strict";
import { mod } from "./setup.mjs";
const C = await mod("js/content.js");
const I = await mod("js/i18n.js");

const strings = [];
const walk = v => { if (typeof v === "string") strings.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
walk(C);

test("every gender marker resolves for all genders", () => {
  for (const gnd of ["m", "f", "n"]) {
    I.setGender(gnd);
    for (const s of strings) assert.ok(!/[{}|]/.test(I.gx(s)), `unresolved marker in: ${s}`);
  }
  I.setGender("n");
});

test("keys are unique", () => {
  for (const list of [C.TRIGGERS, C.COPING, C.SYMPTOMS, C.METHODS, C.PREP_CHECKLIST, C.BREATHING]) {
    const ks = list.map(x => x.k);
    assert.equal(new Set(ks).size, ks.length);
  }
  const ids = C.ARTICLES.map(a => a.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("timeline is ordered and crisis numbers are present", () => {
  for (let i = 1; i < C.TIMELINE.length; i++) assert.ok(C.TIMELINE[i].h > C.TIMELINE[i - 1].h);
  const tels = C.CRISIS.map(c => c.tel).filter(Boolean);
  for (const t of ["1201", "101", "100"]) assert.ok(tels.includes(t));
});
