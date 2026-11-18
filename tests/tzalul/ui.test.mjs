import test from "node:test";
import assert from "node:assert/strict";
import { mod } from "./setup.mjs";
const U = await mod("js/ui.js");

test("html escapes interpolations but keeps nested templates", () => {
  const evil = `<img src=x onerror="alert(1)">'&`;
  const out = String(U.html`<p title="${evil}">${evil}${U.html`<b>${"<i>"}</b>`}</p>`);
  assert.ok(!out.includes("<img"));
  assert.ok(out.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&amp;"));
  assert.ok(out.includes("<b>&lt;i&gt;</b>"));
  assert.equal(String(U.html`${null}${false}${undefined}${0}`), "0");
  assert.equal(String(U.html`${["a", "<"]}`), "a&lt;");
});

test("charts render SVG with escaped labels", () => {
  const svg = String(U.lineChart([1, null, 3], { labels: ["<x>", "", "y"], min: 0, max: 5, title: "<t>" }));
  assert.ok(svg.startsWith("<svg"));
  assert.ok(!svg.includes("<x>") && !svg.includes("<t>"));
  assert.match(svg, /M[\d.]+ [\d.]+/);
  const empty = String(U.lineChart([null, null]));
  assert.ok(empty.includes("אין עדיין נתונים"));
  const bars = String(U.barChart([0, 2, 4], { highlight: 2 }));
  assert.equal((bars.match(/<rect/g) || []).length, 3);
  assert.ok(String(U.ring(0.5)).includes("stroke-dashoffset"));
});
