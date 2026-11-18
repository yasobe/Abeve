import test from "node:test";
import assert from "node:assert/strict";
import { mod } from "./setup.mjs";
const I = await mod("js/i18n.js");

test("gendered forms", () => {
  I.setGender("m"); assert.equal(I.g("מוכן", "מוכנה"), "מוכן");
  I.setGender("f"); assert.equal(I.g("מוכן", "מוכנה"), "מוכנה");
  I.setGender("n"); assert.equal(I.g("מוכן", "מוכנה"), "מוכן/ה");
  assert.equal(I.g("אתה", "את", "את/ה"), "את/ה");
  I.setGender("x"); assert.equal(I.getGender(), "n");
  I.setGender("f"); assert.equal(I.gx("{שב|שבי} בנוחות, {אתה|את} בסדר"), "שבי בנוחות, את בסדר");
  I.setGender("n");
});

test("Hebrew plurals use dual forms", () => {
  assert.equal(I.days(1), "יום אחד");
  assert.equal(I.days(2), "יומיים");
  assert.equal(I.days(5), "5 ימים");
  assert.equal(I.hours(2), "שעתיים");
  assert.equal(I.weeks(2), "שבועיים");
});

test("duration", () => {
  assert.equal(I.duration(30e3), "פחות מדקה");
  assert.equal(I.duration(5 * 60e3), "5 דקות");
  assert.equal(I.duration(3 * 3600e3 + 60e3), "3 שעות ו־דקה אחת");
  assert.equal(I.duration(2 * 864e5 + 3600e3), "יומיים ו־שעה אחת");
  assert.equal(I.duration(-5), "פחות מדקה");
});

test("day keys are local dates", () => {
  assert.equal(I.dayKey(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
  assert.equal(I.dayKey(I.fromDayKey("2026-03-09")), "2026-03-09");
  assert.equal(I.relDay(I.dayKey()), "היום");
});
