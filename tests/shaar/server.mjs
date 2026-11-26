// Local stand-in for Supabase, for tests and for trying the web app on a laptop:
//   - a tiny PostgREST look-alike for POST /rest/v1/rpc/shaar_api (backed by a real Postgres),
//   - the Edge Function itself on Node's http server: supabase/functions/shaar/index.ts (AI version),
//     or with engine "rules" (SHAAR_ENGINE=rules) supabase/functions/shaar-rules/index.ts (no AI),
//   - a static server for docs/shaar,
//   - a fake Claude that answers deterministically (no API key, no cost).
// Usage: PGURL=postgres://... node tests/shaar/server.mjs   → http://localhost:8765/shaar/
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import * as aiFn from "../../supabase/functions/shaar/index.ts";
import * as rulesFn from "../../supabase/functions/shaar-rules/index.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

// ---------------------------------------------------------------- fake Claude
export function fakeAnthropic(log = []) {
  const reply = (body) => {
    log.push(body);
    const sys = body.system, user = body.messages[0].content;
    const intent = /<intent>([\s\S]*?)<\/intent>/.exec(user)?.[1] || "";
    let out;
    if (sys.includes("gatekeeper")) {
      if (user.includes("<answer>")) out = { decision: "pass", message: "ברור. תעשה את זה וצא.", question: "", wait_seconds: 0, max_minutes: 7 };
      else if (/סתם|משעמם/.test(intent)) out = { decision: "wait", message: "נשמע כמו שעמום. שתה מים בינתיים.", question: "", wait_seconds: 30, max_minutes: 3 };
      else if (/משהו|לראות/.test(intent)) out = { decision: "ask", message: "רגע לפני.", question: "מה בדיוק אתה רוצה לראות?", wait_seconds: 0, max_minutes: 10 };
      else out = { decision: "pass", message: "מטרה ברורה. בהצלחה.", question: "", wait_seconds: 0, max_minutes: 5 };
    } else if (sys.includes("coach")) {
      out = { step: "לפתוח את קובץ הדוח ולכתוב את שלוש הכותרות הראשונות", minutes: 3, done_when: "שלוש כותרות כתובות בקובץ", nudge: "הצעד הראשון הוא הכי קשה." };
    } else {
      const report = /<report>([\s\S]*?)<\/report>/.exec(user)?.[1] || "";
      out = report.length > 10
        ? { accepted: true, feedback: "יפה, כתבת את הכותרות. הבא: פסקה אחת מתחת לראשונה." }
        : { accepted: false, feedback: "חסר פרט: מה כתבת בפועל?" };
    }
    return { model: body.model, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(out) }] };
  };
  const client = { messages: { create: async (b) => reply(b) }, beta: { messages: { create: async (b) => reply(b) } } };
  return async () => client;
}

// ---------------------------------------------------------------- PostgREST look-alike
export function rpcShim(pool, clock) {
  return http.createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    if (req.method !== "POST" || req.url !== "/rest/v1/rpc/shaar_api") { res.writeHead(404).end(); return; }
    if (!req.headers.apikey) { res.writeHead(401).end('{"message":"no apikey"}'); return; }
    const { p_action, p_args } = JSON.parse(raw);
    const c = await pool.connect();
    try {
      await c.query("begin");
      if (clock.offsetSec) await c.query("select set_config('shaar.now', (now() + make_interval(secs => $1))::text, true)", [clock.offsetSec]);
      const { rows } = await c.query("select public.shaar_api($1, $2::jsonb) as r", [p_action, JSON.stringify(p_args || {})]);
      await c.query("commit");
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(rows[0].r));
    } catch (e) {
      await c.query("rollback").catch(() => {});
      res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ code: e.code, message: e.message }));
    } finally { c.release(); }
  });
}

// ---------------------------------------------------------------- Node http <-> fetch handler
export function serveFetch(handler) {
  return http.createServer(async (req, res) => {
    let raw = Buffer.alloc(0);
    for await (const c of req) raw = Buffer.concat([raw, c]);
    const r = await handler(new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : raw,
    }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
  });
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml" };
export function staticServer(dir, mount = "/shaar/") {
  return http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    if (!u.pathname.startsWith(mount)) { res.writeHead(302, { location: mount }).end(); return; }
    let p = path.join(dir, decodeURIComponent(u.pathname.slice(mount.length)) || "index.html");
    if (!p.startsWith(dir)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
    if (!fs.existsSync(p)) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream", "cache-control": "no-cache" });
    fs.createReadStream(p).pipe(res);
  });
}

export async function start({ pgUrl, rpcPort = 54400, fnPort = 54401, webPort = 8765, token = "test-token-0123456789abcdef", schema = true, engine = "ai" } = {}) {
  const pool = new pg.Pool({ connectionString: pgUrl, max: 4 });
  if (schema) {
    const c = await pool.connect();
    await c.query("drop schema if exists public cascade; create schema public;");
    for (const r of ["anon", "authenticated", "service_role"])
      await c.query(`do $$ begin if not exists (select 1 from pg_roles where rolname='${r}') then create role ${r} nologin; end if; end $$`);
    await c.query("grant usage on schema public to public, anon, authenticated, service_role");
    await c.query(fs.readFileSync(path.join(root, "supabase/shaar.sql"), "utf8"));
    c.release();
  }
  const clock = { offsetSec: 0 };
  const claudeLog = [];
  const appUrl = `http://localhost:${webPort}/shaar/`;
  const rpcUrl = `http://localhost:${rpcPort}`;
  const handler = engine === "rules"
    ? rulesFn.createHandler({ env: { token, appUrl, allowOrigins: [] }, rpc: rulesFn.makeRpc(rpcUrl, "service-role-test-key") })
    : aiFn.createHandler({
        env: { token, anthropicKey: "fake", gateModel: "claude-haiku-5-5", coachModel: "claude-opus-5-5", appUrl, allowOrigins: [] },
        rpc: aiFn.makeRpc(rpcUrl, "service-role-test-key"),
        anthropic: fakeAnthropic(claudeLog),
      });
  const servers = [rpcShim(pool, clock).listen(rpcPort), serveFetch(handler).listen(fnPort),
                   staticServer(path.join(root, "docs/shaar")).listen(webPort)];
  await new Promise((r) => setTimeout(r, 100));
  return {
    clock, claudeLog, token, appUrl, fnUrl: `http://localhost:${fnPort}/functions/v1/shaar`,
    async stop() { for (const s of servers) s.close(); await pool.end(); },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const s = await start({ pgUrl: process.env.PGURL, engine: process.env.SHAAR_ENGINE || "ai" });
  console.log(`web app:  ${s.appUrl}#k=${s.token}&api=${encodeURIComponent(s.fnUrl)}`);
  console.log(`shortcut: ${s.fnUrl}/s/open/instagram?k=${s.token}`);
}
