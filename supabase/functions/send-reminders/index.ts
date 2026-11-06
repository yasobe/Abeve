// Tick: sends reminder push notifications. Runs every minute from pg_cron.
// Also lets a signed-in user send a test notification to their own devices.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

function serviceKey(): string {
  const k = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (k) return k;
  try { const m = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); return m.default || Object.values(m)[0] as string; } catch { return ""; }
}
const sb = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), { auth: { persistSession: false } });
// VAPID keys and the cron secret live in Supabase Vault, read through a service-role-only function
let cfg: Record<string, string> | null = null;
async function config() {
  if (cfg) return cfg;
  const { data, error } = await sb.rpc("tick_push_config");
  if (error || !data) throw new Error("config: " + (error?.message || "missing"));
  cfg = data as Record<string, string>;
  webpush.setVapidDetails("https://yasobe.github.io/Abeve/", cfg.tick_vapid_public, cfg.tick_vapid_private);
  return cfg;
}

const CORS = {
  "Access-Control-Allow-Origin": "https://yasobe.github.io",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ---------- calendar helpers (same rules as the app) ----------
type Parts = { y: number; mo: number; d: number; wd: number; min: number; key: string };
function partsIn(tz: string, t = new Date()): Parts {
  const o: Record<string, string> = {};
  new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(t).forEach((p) => (o[p.type] = p.value));
  const y = +o.year, mo = +o.month, d = +o.day;
  return { y, mo, d, wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(o.weekday), min: (+o.hour % 24) * 60 + +o.minute, key: `${o.year}-${o.month}-${o.day}` };
}
const keyOf = (dt: Date) => dt.toISOString().slice(0, 10);
const D = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return D(y, mo - 1, da);
}
function nthWd(y: number, m: number, wd: number, n: number) { const d = D(y, m, 1); d.setUTCDate(1 + ((wd - d.getUTCDay() + 7) % 7) + (n - 1) * 7); return d; }
function lastWd(y: number, m: number, wd: number) { const d = D(y, m + 1, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - wd + 7) % 7)); return d; }
function observed(y: number, m: number, d: number) { const x = D(y, m, d); if (x.getUTCDay() === 6) x.setUTCDate(d - 1); else if (x.getUTCDay() === 0) x.setUTCDate(d + 1); return x; }
function holidays(y: number): Map<string, string> {
  const H = new Map<string, string>();
  if (D(y, 0, 1).getUTCDay() !== 6) H.set(keyOf(observed(y, 0, 1)), "closed");
  H.set(keyOf(nthWd(y, 0, 1, 3)), "holiday"); H.set(keyOf(nthWd(y, 1, 1, 3)), "holiday");
  const gf = easter(y); gf.setUTCDate(gf.getUTCDate() - 2); H.set(keyOf(gf), "closed");
  H.set(keyOf(lastWd(y, 4, 1)), "holiday"); H.set(keyOf(observed(y, 5, 19)), "holiday");
  const j4 = observed(y, 6, 4); H.set(keyOf(j4), "holiday");
  const j3 = D(y, 6, 3); if (j3.getUTCDay() >= 1 && j3.getUTCDay() <= 5 && keyOf(j3) !== keyOf(j4)) H.set(keyOf(j3), "early");
  H.set(keyOf(nthWd(y, 8, 1, 1)), "holiday");
  const tg = nthWd(y, 10, 4, 4); H.set(keyOf(tg), "holiday"); const bf = new Date(tg); bf.setUTCDate(tg.getUTCDate() + 1); H.set(keyOf(bf), "early");
  const xm = observed(y, 11, 25); H.set(keyOf(xm), "closed");
  const xe = D(y, 11, 24); if (xe.getUTCDay() >= 1 && xe.getUTCDay() <= 5 && keyOf(xe) !== keyOf(xm)) H.set(keyOf(xe), "early");
  return H;
}

type Rem = { id: string; time?: string; anchor?: string; off?: number; days?: number[]; label?: string; on?: boolean };
// Returns the reminder's target (day key + minute of day in the zone it is defined in) if it is due at `t`.
function dueKey(r: Rem, tz: string, t: Date): string | null {
  if (!r || !r.on || !Array.isArray(r.days) || !r.days.length) return null;
  if (!r.anchor) {
    const p = partsIn(tz, t);
    if (!r.days.includes(p.wd) || !/^\d{2}:\d{2}$/.test(r.time || "")) return null;
    const [h, m] = r.time!.split(":").map(Number);
    return h * 60 + m === p.min ? `${p.key}T${r.time}` : null;
  }
  const ny = partsIn("America/New_York", t);
  if (!r.days.includes(ny.wd)) return null;
  const hol = holidays(ny.y).get(ny.key);
  if (hol && hol !== "early") return null;
  const base = r.anchor === "open" ? 570 : hol === "early" ? 780 : 960;
  const target = Math.min(1439, Math.max(0, base + Math.round(+(r.off || 0))));
  return target === ny.min ? `${ny.key}N${target}` : null;
}

async function send(sub: { endpoint: string; p256dh: string; auth: string }, payload: Record<string, string>) {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 900, urgency: "high" });
    return true;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) await sb.from("push_subs").delete().eq("endpoint", sub.endpoint);
    console.error("push failed", code, (e as Error).message);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let conf: Record<string, string>;
  try { conf = await config(); } catch (e) { console.error(e); return json({ error: "server not configured" }, 500); }

  // 1) test notification for the signed-in user's own devices
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!req.headers.get("x-cron-secret")) {
    const { data, error } = await sb.auth.getUser(bearer);
    if (error || !data.user) return json({ error: "unauthorized" }, 401);
    const { data: subs } = await sb.from("push_subs").select("endpoint,p256dh,auth").eq("user_id", data.user.id);
    let ok = 0;
    for (const s of subs || []) if (await send(s, { title: "טיק", body: "התראות פעילות. כך תיראה תזכורת.", tag: "tick-test" })) ok++;
    return json({ sent: ok, devices: (subs || []).length });
  }

  // 2) the every-minute run from pg_cron
  if (req.headers.get("x-cron-secret") !== conf.tick_cron_secret) return json({ error: "forbidden" }, 403);
  const now = new Date(), prev = new Date(now.getTime() - 60000);
  const { data: subs, error: e1 } = await sb.from("push_subs").select("endpoint,p256dh,auth,tz,user_id");
  if (e1) return json({ error: e1.message }, 500);
  const users = [...new Set((subs || []).map((s) => s.user_id))];
  if (!users.length) return json({ users: 0, sent: 0 });
  const { data: profs, error: e2 } = await sb.from("profiles").select("user_id,data").in("user_id", users);
  if (e2) return json({ error: e2.message }, 500);
  let sent = 0;
  for (const p of profs || []) {
    const rems: Rem[] = Array.isArray(p.data?.reminders) ? p.data.reminders.slice(0, 30) : [];
    const mine = (subs || []).filter((s) => s.user_id === p.user_id);
    const tz = mine[0]?.tz || "Asia/Jerusalem";
    for (const r of rems) {
      // look at this minute and the previous one, so a late cron run never skips a reminder
      const k = dueKey(r, tz, now) || dueKey(r, tz, prev);
      if (!k) continue;
      const { data: ins } = await sb.from("push_log").upsert({ user_id: p.user_id, rid: String(r.id).slice(0, 40), day: k }, { onConflict: "user_id,rid,day", ignoreDuplicates: true }).select("rid");
      if (!ins || !ins.length) continue; // already sent
      const body = String(r.label || "תזכורת").slice(0, 160);
      for (const s of mine) if (await send(s, { title: "טיק", body, tag: `tick-${r.id}` })) sent++;
    }
  }
  if (now.getUTCMinutes() === 0) await sb.from("push_log").delete().lt("sent_at", new Date(now.getTime() - 3 * 864e5).toISOString());
  return json({ users: users.length, sent });
});
