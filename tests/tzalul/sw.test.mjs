import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { APP } from "./setup.mjs";

const root = fileURLToPath(APP);
const files = [];
const walk = d => readdirSync(d).forEach(f => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(relative(root, p)); });
walk(root);

test("service worker precaches every shipped asset", () => {
  const sw = readFileSync(join(root, "sw.js"), "utf8");
  const listed = new Set([...sw.matchAll(/"\.\/([^"]*)"/g)].map(m => m[1]));
  for (const f of files) {
    if (f === "sw.js" || f.endsWith(".txt")) continue;
    assert.ok(listed.has(f), `${f} missing from sw.js ASSETS`);
  }
  for (const f of listed) if (f) assert.ok(files.includes(f), `sw.js lists missing file ${f}`);
});

test("no inline scripts or handlers; strict CSP present", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), "inline <script>");
  assert.ok(!/\son[a-z]+=/i.test(html), "inline event handler");
  assert.match(html, /script-src 'self'/);
  assert.ok(!/https?:\/\//.test(html.replace(/<meta name="description"[^>]*>/, "")), "no external URLs in the shell");
});

test("views never assign raw innerHTML from user data", () => {
  for (const f of files.filter(f => f.startsWith("js/views/"))) {
    const src = readFileSync(join(root, f), "utf8");
    assert.ok(!/innerHTML\s*=/.test(src.replace(/btn\.innerHTML = `\$\{icon\("wind", 18\)\} להתחיל`/, "")), `${f} sets innerHTML`);
  }
});
