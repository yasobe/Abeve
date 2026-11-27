// שער (Shaar) — the gate, the time contract, the soft lock and the effort account.
// Plain JS, no build step. All state lives on the server (Supabase), so the gate page that
// iOS opens in Safari and the home-screen web app always agree.
"use strict";
(() => {
  const VERSION = "1.0.0";
  const DEFAULT_API = "https://azsopganhicwbdirfxon.supabase.co/functions/v1/shaar";

  // ---------------------------------------------------------------- apps
  const APPS = {
    instagram: { name: "אינסטגרם", open: "instagram://app" },
    tiktok: { name: "טיקטוק", open: "snssdk1233://" },
    youtube: { name: "יוטיוב", open: "youtube://" },
    facebook: { name: "פייסבוק", open: "fb://" },
    x: { name: "X", open: "twitter://" },
    twitter: { name: "X", open: "twitter://" },
    reddit: { name: "רדיט", open: "reddit://" },
    threads: { name: "Threads", open: "barcelona://" },
    snapchat: { name: "סנאפצ׳ט", open: "snapchat://" },
    netflix: { name: "נטפליקס", open: "nflx://" },
  };
  const appName = (a) => (APPS[a] && APPS[a].name) || a || "האפליקציה";
  const inApp = (a) => { const n = appName(a); return /^[֐-׿]/.test(n) ? "ב" + n : "ב-" + n; };

  // ---------------------------------------------------------------- storage
  const LS = { k: "shaar.k", api: "shaar.api", form: "shaar.form", state: "shaar.state" };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) { /* private mode */ } },
  };

  // ---------------------------------------------------------------- url
  const qs = new URLSearchParams(location.search);
  const frag = new URLSearchParams(location.hash.slice(1));
  if (frag.get("k")) store.set(LS.k, frag.get("k"));
  if (frag.get("api")) store.set(LS.api, frag.get("api"));
  if (location.hash) history.replaceState(null, "", location.pathname + location.search); // token out of the address bar

  let TOKEN = store.get(LS.k) || "";
  let API = store.get(LS.api) || DEFAULT_API;
  let FORM = store.get(LS.form) || "m";
  const G = (m, f) => (FORM === "f" ? f : m);
  // the rules version of the function (no AI) says so in its settings; texts and the rules box follow it
  const RULES = () => !!(state && state.settings && state.settings.engine === "rules");

  let state = null;
  try { state = JSON.parse(store.get(LS.state) || "null"); } catch (_) { state = null; }
  let skew = 0;
  const now = () => Date.now() + skew;

  // ---------------------------------------------------------------- helpers
  const $app = document.getElementById("app");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tz = () => (state && state.settings && state.settings.tz) || "Asia/Jerusalem";
  const hhmm = (t) => new Intl.DateTimeFormat("he-IL", { timeZone: tz(), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(t));
  const dayKey = (t) => new Intl.DateTimeFormat("en-CA", { timeZone: tz() }).format(new Date(t));
  const mmss = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
  };
  const minLabel = (m) => (m === 60 ? "שעה" : m === 120 ? "שעתיים" : m % 60 === 0 ? `${m / 60} שעות` : `${m} דק׳`);
  let timers = [];
  const every = (ms, fn) => { fn(); timers.push(setInterval(fn, ms)); };
  const clearTimers = () => { timers.forEach(clearInterval); timers = []; };

  const ICON = {
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  };

  function toast(msg, ms = 2600) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("on");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), ms);
  }

  // ---------------------------------------------------------------- server
  const ERR = {
    network: "אין חיבור לשרת כרגע.", timeout: "השרת לא ענה בזמן. לנסות שוב?", auth: "הטוקן לא תואם לשרת — בהגדרות.",
    locked: "יש נעילה פעילה.", wait: "ההמתנה עוד לא נגמרה.", stale: "הבקשה כבר לא בתוקף. מתחילים מחדש.",
    need_answer: "קודם לענות על השאלה.", too_soon: "עוד רגע — קודם לעשות את הצעד.", no_credit: "אין קרדיטים כרגע.",
    not_locked: "אין נעילה פעילה.", empty: "צריך לכתוב משהו.", bad_state: "המצב השתנה. מרעננים.", server: "שגיאה בשרת.",
    not_found: "לא נמצא.", bad_app: "שם אפליקציה לא תקין.",
  };
  const errText = (e) => ERR[e && e.code] || ERR.server;

  async function call(action, body = {}, ms = 20000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(`${API}/api/${action}`, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ k: TOKEN, ...body }), signal: ctl.signal, cache: "no-store",
      });
      let j = {};
      try { j = await r.json(); } catch (_) { j = {}; }
      if (!r.ok) throw Object.assign(new Error(j.error || `http ${r.status}`), { code: j.error || "server", data: j, status: r.status });
      return j;
    } catch (e) {
      if (e.name === "AbortError") e.code = "timeout";
      else if (!e.code) e.code = "network";
      throw e;
    } finally { clearTimeout(t); }
  }

  function useState(s) {
    state = s;
    skew = Date.parse(s.now) - Date.now();
    if (s.settings && s.settings.form && s.settings.form !== FORM) { FORM = s.settings.form; store.set(LS.form, FORM); }
    store.set(LS.state, JSON.stringify(s));
  }
  async function loadState(app) {
    const s = await call("state", { app: app || "" });
    useState(s);
    return s;
  }

  // ---------------------------------------------------------------- router
  let view = "home";
  const ui = {}; // per-view scratch state
  function go(v, params = {}) {
    view = v;
    const p = new URLSearchParams({ a: v, ...params });
    if (!params.app && ui.app && (v === "gate" || v === "lock")) p.set("app", ui.app);
    history.replaceState(null, "", `${location.pathname}?${p}`);
    render();
  }
  function render() {
    clearTimers();
    const v = VIEWS[view] || VIEWS.home;
    $app.innerHTML = v.html();
    if (v.mount) v.mount();
    const af = $app.querySelector("[data-autofocus]");
    if (af) setTimeout(() => af.focus({ preventScroll: true }), 30);
  }
  const top = (left, right = "") => `<header class="top">${left}${right}</header>`;
  const backBtn = (to = "home") => `<button class="iconbtn" data-act="nav" data-to="${to}" aria-label="חזרה">${ICON.back}</button>`;

  // ---------------------------------------------------------------- lock text
  function lockReason(l, lp) {
    if (!l) return "";
    const m = l.meta || {};
    if (l.kind === "penalty")
      return `חרגת ב-${m.overrun_min} דק׳ מחוזה של ${m.minutes} דק׳ ${inApp(m.app)}. לכן הנעילה הפעם ${m.lock_min} דק׳${m.streak > 1 ? ` (חריגה ${m.streak} ברצף)` : ""}.`;
    if (l.kind === "cooldown") return `הפסקה של ${m.lock_min} דק׳ אחרי ${m.minutes} דק׳ ${inApp(m.app)}.`;
    return `נעילה שבחרת לעצמך: ${minLabel(m.lock_min)}.`;
  }
  const lockKind = (l) => ({ penalty: "נעילה מוארכת", cooldown: "הפסקה", manual: "נעילה" }[l.kind] || "נעילה");

  // ================================================================ views
  const VIEWS = {};

  // ---------------------------------------------------------------- gate
  const CHIPS = [
    ["לענות להודעה", "לענות להודעה של "],
    ["לחפש משהו מסוים", "לחפש "],
    ["להעלות / לפרסם", "להעלות "],
    ["סתם, משעמם", "סתם, משעמם לי"],
    ["לברוח ממשהו", "לברוח קצת מ"],
  ];
  function gateMeta() {
    const s = state && state.stats;
    const visits = s ? Math.max(1, s.visits) : null;
    return `<span class="num">${hhmm(now())}</span>${visits ? ` · ${visits === 1 ? "ביקור ראשון היום" : `${visits} ביקורים היום`}` : ""}`;
  }
  const gateTop = () => top(`<span class="chip">${esc(appName(ui.app))}</span>`, `<span class="meta">${gateMeta()}</span>`);
  function minuteOptions(max) {
    const base = [2, 3, 5, 10, 15, 20, 30, 45, 60].filter((m) => m <= max);
    if (!base.includes(max)) base.push(max);
    return base.sort((a, b) => a - b).slice(-6);
  }

  VIEWS.gate = {
    html() {
      const g = ui.gate || (ui.gate = { stage: "intent" });
      const a = g.attempt;
      const verdict = (cls, tag, body) => `<div class="verdict ${cls} fade"><span class="tag">${tag}</span>${body}</div>`;
      switch (g.stage) {
        case "intent":
        case "thinking": {
          const busy = g.stage === "thinking";
          return `${gateTop()}
            <h1 class="q">${G("מה אתה מחפש עכשיו?", "מה את מחפשת עכשיו?")}</h1>
            <form data-form="intent">
              <textarea name="t" rows="3" maxlength="500" enterkeyhint="send" placeholder="במילים שלך, בכנות" ${busy ? "disabled" : "data-autofocus"}>${esc(g.draft || "")}</textarea>
              <div class="chips">${CHIPS.map(([l, v]) => `<button type="button" data-act="chip" data-v="${esc(v)}" ${busy ? "disabled" : ""}>${esc(l)}</button>`).join("")}</div>
              <button class="btn primary block" type="submit" ${busy ? "disabled" : ""}>${busy ? '<span class="dots">השומר חושב</span>' : "לשלוח לשומר"}</button>
            </form>
            <div class="spacer"></div>
            <button class="btn ghost" data-act="resist">ויתרתי — זה יכול לחכות</button>`;
        }
        case "ask":
        case "answering": {
          const busy = g.stage === "answering";
          return `${gateTop()}
            ${verdict("ask", "שאלה אחת", `${a.message ? `<p class="muted">${esc(a.message)}</p>` : ""}<p class="question">${esc(a.question)}</p>`)}
            <form data-form="answer">
              <textarea name="t" rows="2" maxlength="500" enterkeyhint="send" placeholder="תשובה קצרה" ${busy ? "disabled" : "data-autofocus"}>${esc(g.draft || "")}</textarea>
              <button class="btn primary block" type="submit" ${busy ? "disabled" : ""}>${busy ? '<span class="dots">השומר חושב</span>' : "לענות"}</button>
            </form>
            <div class="spacer"></div>
            <button class="btn ghost" data-act="resist">ויתרתי — זה יכול לחכות</button>`;
        }
        case "wait": {
          const msg = a.final_message || a.message;
          return `${gateTop()}
            ${verdict("wait", "רגע לפני", `<p class="lead">${esc(msg)}</p>`)}
            <div class="ring" id="ring"><div id="cd" class="num"></div></div>
            <button class="btn primary block" data-act="resist">ויתרתי — זה יכול לחכות</button>
            <button class="btn soft block" data-act="after-wait" id="still" disabled>עדיין רוצה להיכנס</button>`;
        }
        case "declare": {
          const msg = a.final_message || a.message;
          const max = a.max_minutes || 5;
          const opts = minuteOptions(max);
          if (!g.minutes || g.minutes > max) g.minutes = max;
          const waited = (a.final_decision || a.decision) === "wait";
          return `${gateTop()}
            ${waited ? verdict("wait", "חיכית. אם עדיין צריך —", `<p class="lead">רק לזמן קצר.</p>`) : verdict("pass", "אפשר להיכנס", `<p class="lead">${esc(msg)}</p>`)}
            <h2>לכמה זמן? (עד ${max} דק׳)</h2>
            <div class="mins">${opts.map((m) => `<button data-act="min" data-m="${m}" class="${m === g.minutes ? "on" : ""}" aria-pressed="${m === g.minutes}">${m}<small>דק׳</small></button>`).join("")}</div>
            <button class="btn primary block" data-act="declare" ${g.busy ? "disabled" : ""}>${g.busy ? '<span class="dots">רושם</span>' : `${G("מתחייב", "מתחייבת")} ל-${g.minutes} דק׳`}</button>
            <p class="fine">הזמן מתחיל כש${esc(appName(ui.app))} נפתח, ובסופו יצלצל טיימר. חריגה = הנעילה הבאה ארוכה יותר.</p>
            <div class="spacer"></div>
            <button class="btn ghost" data-act="resist">בעצם, ויתרתי</button>`;
        }
        case "go": {
          const info = APPS[ui.app];
          return `${gateTop()}
            <div class="stack center fade">
              <p class="eyebrow">החוזה</p>
              <div class="count">${g.pass.minutes}</div>
              <p class="lead">דקות ${esc(inApp(ui.app))}. הטיימר מתחיל כשהאפליקציה נפתחת.</p>
            </div>
            ${info ? `<a class="btn primary block" href="${esc(info.open)}">לפתוח את ${esc(info.name)}</a>` : ""}
            <p class="fine">לא נפתח? לפתוח את ${esc(appName(ui.app))} כרגיל מהמסך הבית — האישור שמור ל-3 דקות.</p>
            <p class="fine">לסגור עד דקה אחרי הטיימר = החוזה נשמר.</p>`;
        }
        case "resisted": {
          const s = (state && state.stats) || {};
          return `<div class="spacer"></div>
            <div class="stack center fade">
              <div class="count">✓</div>
              <h1 class="q">יופי.</h1>
              <p class="lead">דחף שלא מקבל תגמול נחלש קצת בכל פעם.</p>
              <p class="muted">${s.resisted || 1} דחפים נדחו היום${s.week_resisted ? ` · ${s.week_resisted} השבוע` : ""}</p>
            </div>
            <div class="spacer"></div>
            <p class="fine center">אפשר לסגור את הלשונית.</p>
            <button class="btn soft block" data-act="nav" data-to="home">למסך הראשי של שער</button>`;
        }
      }
      return "";
    },
    mount() {
      const g = ui.gate;
      if (g.stage === "wait") {
        const a = g.attempt;
        const until = Date.parse(a.wait_until), total = Math.max(1, (a.wait_seconds || 60) * 1000);
        const ring = document.getElementById("ring"), cd = document.getElementById("cd"), still = document.getElementById("still");
        every(250, () => {
          const left = until - now();
          cd.textContent = mmss(left);
          ring.style.setProperty("--p", String(Math.min(1, Math.max(0, 1 - left / total))));
          if (left <= 0 && still.disabled) { still.disabled = false; still.textContent = "עדיין רוצה להיכנס"; }
          else if (left > 0) still.textContent = `עדיין רוצה להיכנס (בעוד ${mmss(left)})`;
        });
      }
    },
  };

  function showAttempt(a) {
    const g = ui.gate;
    g.attempt = a; g.draft = ""; g.busy = false;
    const d = a.final_decision || a.decision;
    if (d === "ask" && !a.final_decision) g.stage = "ask";
    else if (d === "wait" && Date.parse(a.wait_until) > now()) g.stage = "wait";
    else g.stage = "declare";
    render();
  }

  // ---------------------------------------------------------------- lock
  VIEWS.lock = {
    html() {
      const l = state && state.lock;
      if (!l) {
        return `${top(`<span class="chip">${esc(appName(ui.app))}</span>`, `<button class="iconbtn" data-act="nav" data-to="home" aria-label="מסך ראשי">${ICON.home}</button>`)}
          <div class="spacer"></div>
          <div class="stack center fade"><div class="count">✓</div><h1 class="q">הנעילה הסתיימה.</h1>
          <p class="lead">${ui.app ? `פתיחה של ${esc(appName(ui.app))} תעבור עכשיו דרך השער.` : "כל כניסה תעבור שוב דרך השער."}</p></div>
          <div class="spacer"></div>
          <button class="btn soft block" data-act="nav" data-to="home">למסך הראשי</button>`;
      }
      const credits = state.credits || 0;
      return `${top(`<span class="chip">${ICON.lock} ${esc(lockKind(l))}</span>`, `<button class="iconbtn" data-act="nav" data-to="home" aria-label="מסך ראשי">${ICON.home}</button>`)}
        <div class="stack center">
          <div class="count" id="cd"></div>
          <p class="muted">עד <span class="num">${hhmm(l.ends_at)}</span></p>
        </div>
        <div class="verdict stop"><p>${esc(lockReason(l, state.lock_pass))}</p></div>
        <div class="card">
          <h3>רוצה לצאת מוקדם?</h3>
          <p class="muted">רק אחרי צעד קטן ואמיתי במשימה ש${G("אתה", "את")} דוחה. מאמץ קודם, תגמול אחר כך.</p>
          <button class="btn primary block" data-act="nav" data-to="effort">לעשות צעד ולהשתחרר</button>
          ${credits ? `<button class="btn soft block" data-act="credit">להשתמש בקרדיט מאמץ (${credits})</button>` : ""}
        </div>`;
    },
    mount() {
      const l = state && state.lock;
      if (!l) return;
      const cd = document.getElementById("cd"), end = Date.parse(l.ends_at);
      every(500, () => {
        const left = end - now();
        cd.textContent = mmss(left);
        if (left <= 0) { clearTimers(); refresh(); }
      });
    },
  };

  // ---------------------------------------------------------------- effort
  VIEWS.effort = {
    html() {
      const e = ui.effort || (ui.effort = { stage: "pick" });
      const locked = !!(state && state.lock);
      const head = top(backBtn(locked ? "lock" : "home"), `<span class="chip">חשבון המאמץ · ${state ? state.credits || 0 : 0} קרדיטים</span>`);
      switch (e.stage) {
        case "pick": {
          const tasks = (state && state.tasks) || [];
          return `${head}
            <h1 class="q">מה ${G("אתה", "את")} דוחה?</h1>
            <p class="muted">${RULES() ? "השומר ייתן צעד ראשון קטן וקבוע" : "Claude יפרק את זה לצעד ראשון קטן"}. אחרי ${G("שתעשה ותדווח", "שתעשי ותדווחי")} — ${locked ? "הנעילה תשתחרר" : `${G("תקבל", "תקבלי")} קרדיט מאמץ לשחרור עתידי`}.</p>
            ${tasks.length ? `<div class="stack">${tasks.map((t) => `<button class="taskbtn" data-act="task" data-id="${t.id}"><span>${esc(t.title)}</span><small>${t.steps ? `${t.steps} צעדים` : "חדשה"}</small></button>`).join("")}</div><hr>` : ""}
            <form data-form="task">
              <textarea name="t" rows="2" maxlength="200" placeholder="משימה חדשה, למשל: להגיש דוח הוצאות" ${tasks.length ? "" : "data-autofocus"}></textarea>
              <button class="btn primary block" type="submit">לקבל צעד ראשון</button>
            </form>`;
        }
        case "thinking":
          return `${head}<div class="spacer"></div>
            <div class="stack center"><p class="lead dots">מפרק את המשימה לצעד ראשון</p>
            <p class="fine">המודל החזק עובד על זה — כמה שניות.</p></div><div class="spacer"></div>`;
        case "step":
        case "judging": {
          const s = e.step, busy = e.stage === "judging";
          return `${head}
            <p class="eyebrow">${esc(s.title || "")}</p>
            <div class="card fade">
              <p class="lead"><b>${esc(s.step)}</b></p>
              <p class="fine">כ-${s.minutes} דק׳ · מספיק כש: ${esc(s.done_when)}</p>
              ${s.nudge ? `<p class="muted">${esc(s.nudge)}</p>` : ""}
            </div>
            ${e.feedback ? `<div class="verdict wait fade"><span class="tag">עוד לא</span><p>${esc(e.feedback)}</p></div>` : ""}
            <form data-form="report">
              <label class="lbl" for="rep-t">מה עשית בפועל?</label>
              <textarea id="rep-t" name="t" rows="3" maxlength="1000" placeholder="פרט אחד קונקרטי" ${busy ? "disabled" : ""}>${esc(e.draft || "")}</textarea>
              <button class="btn primary block" type="submit" id="rep" ${busy ? "disabled" : ""}>${busy ? '<span class="dots">בודק</span>' : "לדווח"}</button>
              <p class="fine" id="repwait"></p>
            </form>
            <div class="row">
              <button class="btn ghost" data-act="new-step">צעד אחר</button>
              <button class="btn ghost" data-act="task-done">המשימה הושלמה</button>
            </div>`;
        }
        case "result": {
          const r = e.result;
          return `${head}
            <div class="verdict pass fade"><span class="tag">${r.result === "released" ? "השתחררת מהנעילה" : r.result === "credit" ? "קרדיט מאמץ +1" : "נרשם"}</span>
              <p class="lead">${esc(r.feedback)}</p></div>
            <p class="muted">${r.result === "released" ? "פתיחה הבאה של אפליקציה מסיחה תעבור דרך השער." : `יש לך ${r.credits} קרדיטים. קרדיט משחרר נעילה אחת.`}</p>
            <div class="spacer"></div>
            <button class="btn primary block" data-act="next-step">עוד צעד באותה משימה</button>
            <button class="btn soft block" data-act="nav" data-to="home">סיום</button>`;
        }
      }
      return "";
    },
    mount() {
      const e = ui.effort;
      if (e.stage !== "step") return;
      const ta = document.getElementById("rep-t");
      ta.addEventListener("input", () => { e.draft = ta.value; });
      const btn = document.getElementById("rep"), note = document.getElementById("repwait");
      const ready = Date.parse(e.step.created_at) + Math.min(e.step.minutes * 60, 120) * 1000;
      every(500, () => {
        const left = ready - now();
        if (left > 0) { btn.disabled = true; note.textContent = `אפשר לדווח בעוד ${mmss(left)}. בינתיים — לעשות את הצעד.`; }
        else { btn.disabled = false; note.textContent = ""; }
      });
    },
  };

  // ---------------------------------------------------------------- home
  function badge(a) {
    if (a.outcome === "passed") return '<span class="badge pass">כניסה</span>';
    if (a.outcome === "resisted") return '<span class="badge pass">ויתור</span>';
    const d = a.final_decision || a.decision;
    if (d === "wait") return '<span class="badge wait">המתנה</span>';
    if (d === "ask") return '<span class="badge ask">שאלה</span>';
    return '<span class="badge stop">לא הושלם</span>';
  }
  VIEWS.home = {
    html() {
      if (!state) return `${top('<h1 class="q">שער</h1>')}<div class="boot"><p class="dots">טוען</p></div>`;
      const s = state.stats || {}, l = state.lock;
      const active = (state.passes || []).find((p) => p.status === "active");
      const today = dayKey(now());
      let status;
      if (l) {
        status = `<div class="card"><p class="eyebrow">${ICON.lock} ${esc(lockKind(l))}</p><div class="count small" id="cd"></div>
          <p class="muted">${esc(lockReason(l, state.lock_pass))}</p>
          <button class="btn primary block" data-act="nav" data-to="effort">צעד מאמץ לשחרור מוקדם</button>
          ${state.credits ? `<button class="btn soft block" data-act="credit">להשתמש בקרדיט (${state.credits})</button>` : ""}</div>`;
      } else if (active) {
        status = `<div class="card"><p class="eyebrow">חוזה פעיל ${esc(inApp(active.app))}</p><div class="count small" id="cdp"></div></div>`;
      } else {
        status = `<div class="card"><p class="eyebrow">פתוח</p><p class="lead">כל כניסה לאפליקציה מסיחה עוברת דרך השער.</p></div>`;
      }
      const tasks = state.tasks || [];
      const recent = state.recent || [];
      return `${top('<h1 class="q">שער</h1>', `<button class="iconbtn" data-act="nav" data-to="settings" aria-label="הגדרות">${ICON.gear}</button>`)}
        ${status}
        ${l ? "" : `<section class="card"><h2>נעילה עכשיו</h2>
          <div class="chips">${[30, 60, 120, 240].map((m) => `<button data-act="lock" data-m="${m}">${minLabel(m)}</button>`).join("")}</div>
          <p class="fine">בזמן נעילה, פתיחה של אפליקציה מסיחה מחזירה לכאן. שחרור מוקדם — רק דרך צעד מאמץ.</p></section>`}
        <section class="stack">
          <h2>היום</h2>
          <div class="tiles">
            <div class="tile"><b>${s.visits || 0}</b><span>דחפים</span></div>
            <div class="tile"><b>${s.resisted || 0}</b><span>ויתורים</span></div>
            <div class="tile"><b>${s.passed || 0}</b><span>כניסות</span></div>
            <div class="tile"><b>${s.minutes || 0}</b><span>דק׳ שהוצהרו</span></div>
            <div class="tile"><b>${s.kept || 0}/${(s.kept || 0) + (s.broken || 0)}</b><span>חוזים נשמרו</span></div>
            <div class="tile"><b>${s.steps || 0}</b><span>צעדי מאמץ</span></div>
          </div>
          <p class="fine">השבוע: ${s.week_resisted || 0} ויתורים מתוך ${s.week_attempts || 0} · חוזים ${s.week_kept || 0} נשמרו, ${s.week_broken || 0} חריגות${state.streak > 1 ? ` · ${state.streak} חריגות ברצף` : ""}.</p>
        </section>
        <section class="card">
          <div class="setting"><div><h2>חשבון המאמץ</h2><p class="fine">${state.credits || 0} קרדיטים${tasks.length ? ` · ${tasks.length} משימות פתוחות` : ""}</p></div>
          <button class="btn soft small" data-act="nav" data-to="effort">צעד חדש</button></div>
          ${tasks.slice(0, 3).map((t) => `<button class="taskbtn" data-act="task" data-id="${t.id}"><span>${esc(t.title)}</span><small>${t.steps} צעדים</small></button>`).join("")}
        </section>
        ${recent.length ? `<section class="card"><h2>אחרונים</h2><div class="list">${recent.slice(0, 8).map((a) => `
          <div class="item"><span class="when">${dayKey(a.at) === today ? hhmm(a.at) : "אתמול"}</span>
          <div class="what"><p><b>${esc(appName(a.app))}</b> · ${esc(a.intent)}</p>${a.answer ? `<p class="fine">${esc(a.question)} — ${esc(a.answer)}</p>` : ""}</div>${badge(a)}</div>`).join("")}</div></section>` : ""}`;
    },
    mount() {
      const l = state && state.lock;
      if (l) {
        const cd = document.getElementById("cd"), end = Date.parse(l.ends_at);
        every(500, () => { const left = end - now(); cd.textContent = mmss(left); if (left <= 0) { clearTimers(); refresh(); } });
      }
      const active = state && (state.passes || []).find((p) => p.status === "active");
      if (!l && active) {
        const cd = document.getElementById("cdp"), end = Date.parse(active.ends_at);
        every(500, () => { const left = end - now(); cd.textContent = mmss(left); if (left <= -61000) { clearTimers(); refresh(); } });
      }
    },
  };

  // ---------------------------------------------------------------- settings
  const seg = (key, opts, cur) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button data-act="set" data-key="${key}" data-v="${v}" class="${String(cur) === String(v) ? "on" : ""}">${l}</button>`).join("")}</div>`;
  VIEWS.settings = {
    html() {
      const st = (state && state.settings) || {};
      const masked = TOKEN ? `${TOKEN.slice(0, 4)}…${TOKEN.slice(-4)}` : "—";
      return `${top(backBtn("home"), '<span class="chip">הגדרות</span>')}
        <section class="card">
          <div class="setting"><div><h3>פנייה</h3><p class="fine">איך השומר והמסכים פונים אליך.</p></div>${seg("form", [["m", "זכר"], ["f", "נקבה"]], FORM)}</div>
        </section>
        <section class="card">
          <h2>חוזים ונעילה</h2>
          <div class="setting"><div><h3>הפסקה אחרי כל כניסה</h3><p class="fine">נעילה קצרה בסוף כל חוזה, כדי שלא לחזור מיד.</p></div>${seg("cooldown_min", [[0, "בלי"], [5, "5"], [10, "10"], [20, "20"], [30, "30"]], st.cooldown_min)}</div>
          <hr>
          <div class="setting"><div><h3>קנס על כל דקת חריגה</h3><p class="fine">כמה דקות נעילה מתווספות לכל דקה מעבר לחוזה (וגדל עם רצף חריגות).</p></div>${seg("penalty_factor", [[1, "פי 1"], [2, "פי 2"], [3, "פי 3"]], st.penalty_factor)}</div>
          <hr>
          <div class="setting"><div><h3>זמן מקסימלי לכניסה</h3><p class="fine">השומר לא ייתן יותר מזה.</p></div>${seg("max_minutes_cap", [[10, "10"], [15, "15"], [30, "30"], [60, "60"]], st.max_minutes_cap)}</div>
        </section>
        <section class="card">
          <h2>הכללים שלי</h2>
          <form data-form="rules">
            <textarea name="t" rows="${RULES() ? 6 : 4}" maxlength="1500" placeholder="${RULES() ? "כלל בכל שורה, למשל:\nיוטיוב רק אחרי 20:00\nטיקטוק: חסום\nאינסטגרם: 5 דקות\nמותר: הרצאה, מתכון\nאסור: חדשות\nדקות ביום: 60" : "למשל: יוטיוב רק אחרי 20:00. אחרי 23:00 — רק הודעות."}">${esc(st.rules || "")}</textarea>
            <button class="btn soft block" type="submit">שמירה</button>
          </form>
          ${RULES() ? `<p class="fine">כלל בכל שורה. אפשר: "יוטיוב רק אחרי 20:00", "טיקטוק: חסום", "אינסטגרם: 5 דקות", "מותר: …", "אסור: …", "לילה: 23:00-06:00", "דקות ביום: 90", "כניסות ביום: 6".</p>
          ${(st.rules_summary || []).length ? `<h3>מה השומר הבין</h3><ul class="fine">${st.rules_summary.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}`
          : '<p class="fine">השומר קורא אותם בכל החלטה.</p>'}
        </section>
        <section class="card">
          <h2>חיבור לקיצור באייפון</h2>
          <p class="fine">בקיצור "שער", בפעולת <bdi>Text</bdi>: להדביק את חלק 1, להוסיף את המשתנה <bdi>Shortcut Input</bdi>, ואז להדביק את חלק 2.</p>
          <code class="box">${esc(API)}/s/</code>
          <button class="btn soft small" data-act="copy" data-v="${esc(API)}/s/">להעתיק חלק 1</button>
          <code class="box">?k=${esc(TOKEN)}</code>
          <button class="btn soft small" data-act="copy" data-v="?k=${esc(TOKEN)}">להעתיק חלק 2</button>
          <button class="btn soft block" data-act="test">בדיקת חיבור</button>
        </section>
        <section class="card">
          <h2>חיבור לשרת</h2>
          <form data-form="conn">
            <div><label class="lbl" for="api">כתובת הפונקציה</label><input id="api" class="ltr" name="api" type="url" value="${esc(API)}" autocomplete="off"></div>
            <div><label class="lbl" for="tok">טוקן · כרגע <bdi class="num">${esc(masked)}</bdi></label><input id="tok" class="ltr" name="k" type="password" placeholder="להשאיר ריק כדי לא לשנות" autocomplete="off"></div>
            <button class="btn soft block" type="submit">שמירה</button>
          </form>
        </section>
        <section class="card">
          <h2>היסטוריה</h2>
          <p class="fine">כל ניסיון כניסה, תשובה, חוזה, נעילה וצעד נשמרים בשרת (לדוח שבועי בהמשך).</p>
          <button class="btn soft block" data-act="export">ייצוא 30 יום כקובץ JSON</button>
        </section>
        <p class="fine center">שער ${VERSION}</p>`;
    },
  };

  // ---------------------------------------------------------------- setup / errors
  VIEWS.setup = {
    html() {
      return `<div class="spacer"></div>
        <div class="stack center"><img src="icons/icon.svg" width="72" height="72" alt=""><h1 class="q">שער</h1>
        <p class="muted">רגע של מודעות לפני שנכנסים.</p></div>
        <form data-form="setup">
          <div><label class="lbl" for="k">הטוקן שלך</label><p class="fine">אותו ערך כמו הסוד <bdi>SHAAR_TOKEN</bdi> שב-<bdi>Supabase</bdi>.</p>
          <input id="k" class="ltr" name="k" type="password" autocomplete="off" required minlength="16" data-autofocus></div>
          <button class="btn primary block" type="submit">חיבור</button>
        </form>
        <details><summary>אין לי טוקן עדיין</summary>
          <div class="stack">
            <p class="fine">ליצור טוקן אקראי, לשמור אותו ב-Supabase כסוד בשם SHAAR_TOKEN, ולהשתמש באותו טוקן כאן ובקיצור.</p>
            <button class="btn soft" data-act="gen">ליצור טוקן</button>
            <code class="box" id="gen"></code>
          </div>
        </details>
        <div class="spacer"></div>`;
    },
  };
  VIEWS.err = {
    html() {
      const e = qs.get("e");
      const msg = e === "auth"
        ? "הטוקן שבקיצור לא תואם לסוד SHAAR_TOKEN בשרת. לבדוק את פעולת ה-Text בקיצור \"שער\" (החלק שאחרי ?k=)."
        : e === "app" ? "שם האפליקציה שנשלח מהאוטומציה לא תקין. להשתמש באותיות אנגליות קטנות בלבד, למשל open/instagram."
        : "משהו לא תקין בחיבור.";
      return `<div class="spacer"></div><div class="stack center"><h1 class="q">הקיצור לא מחובר</h1><p class="lead">${esc(msg)}</p></div>
        <div class="spacer"></div><button class="btn soft block" data-act="nav" data-to="settings">להגדרות</button>`;
    },
  };

  // ================================================================ actions
  async function refresh() {
    try { await loadState(ui.app); } catch (e) { if (e.code === "auth") return go("setup"); toast(errText(e)); }
    if (view === "gate" && state && state.lock) { go("lock"); return; }
    if (view === "gate") return; // never wipe what is being typed
    render();
  }

  const ACT = {
    nav(el) {
      const to = el.dataset.to;
      if (to === "effort") ui.effort = effortFromState();
      go(to);
      if (to === "home" || to === "settings") refresh();
    },
    chip(el) {
      const ta = $app.querySelector("textarea[name=t]");
      ta.value = el.dataset.v; ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    },
    async resist() {
      const g = ui.gate;
      try {
        const r = await call("resist", g && g.attempt ? { attempt_id: g.attempt.id } : { app: ui.app });
        if (r.stats && state) state.stats = r.stats;
      } catch (_) { /* still a win */ }
      ui.gate = { stage: "resisted" };
      render();
    },
    "after-wait"() { ui.gate.stage = "declare"; render(); },
    min(el) { ui.gate.minutes = +el.dataset.m; render(); },
    async declare() {
      const g = ui.gate;
      g.busy = true; render();
      try {
        const r = await call("pass", { attempt_id: g.attempt.id, minutes: g.minutes });
        g.pass = r.pass; g.stage = "go";
      } catch (e) {
        g.busy = false;
        if (e.code === "locked") { await refresh(); return go("lock"); }
        if (e.code === "stale") { ui.gate = { stage: "intent" }; }
        toast(errText(e));
      }
      render();
    },
    async lock(el) {
      const m = +el.dataset.m;
      if (!confirm(`לנעול את האפליקציות המסיחות ל-${minLabel(m)}?\nשחרור מוקדם רק דרך צעד מאמץ.`)) return;
      try { await call("lock", { minutes: m }); await loadState(); toast("ננעל."); } catch (e) { toast(errText(e)); }
      render();
    },
    async credit() {
      if (!confirm("להשתמש בקרדיט מאמץ ולשחרר את הנעילה עכשיו?")) return;
      try { await call("use_credit"); await loadState(ui.app); toast("שוחרר."); } catch (e) { toast(errText(e)); }
      render();
    },
    task(el) { startStep({ task_id: +el.dataset.id }); },
    "new-step"() { const s = ui.effort.step; startStep({ task_id: s.task_id }); },
    "next-step"() { const s = ui.effort.step; startStep({ task_id: s.task_id }); },
    async "task-done"() {
      const s = ui.effort.step;
      if (!confirm("לסמן את המשימה כהושלמה?")) return;
      try { await call("task_close", { id: s.task_id, status: "done" }); toast("כל הכבוד."); } catch (e) { toast(errText(e)); }
      await refresh().catch(() => {});
      ui.effort = { stage: "pick" }; render();
    },
    async set(el) {
      const key = el.dataset.key, v = el.dataset.v;
      if (key === "form") { FORM = v; store.set(LS.form, v); }
      try { const s = await call("settings", { [key]: key === "form" ? v : +v }); if (state) state.settings = s; } catch (e) { toast(errText(e)); }
      render();
    },
    async copy(el) {
      try { await navigator.clipboard.writeText(el.dataset.v); toast("הועתק."); } catch (_) { toast("לא הצלחתי להעתיק — לסמן ולהעתיק ידנית."); }
    },
    async test() {
      try { await loadState(); toast("מחובר ✓"); } catch (e) { toast(errText(e)); }
    },
    async export() {
      try {
        const data = await call("export", { days: 30 }, 30000);
        const file = new File([JSON.stringify(data, null, 1)], `shaar-${dayKey(now())}.json`, { type: "application/json" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file); a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      } catch (e) { if (e.name !== "AbortError") toast(errText(e)); }
    },
    gen() {
      const b = new Uint8Array(24); crypto.getRandomValues(b);
      const t = btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      document.getElementById("gen").textContent = t;
      document.getElementById("k").value = t;
      navigator.clipboard && navigator.clipboard.writeText(t).then(() => toast("נוצר והועתק.")).catch(() => {});
    },
  };

  function effortFromState() {
    const o = state && state.open_step;
    return o ? { stage: "step", step: o, feedback: o.accepted === false ? o.feedback : "" } : { stage: "pick" };
  }

  async function startStep(body) {
    ui.effort = { stage: "thinking" }; go("effort");
    try {
      const r = await call("step", body, 70000);
      ui.effort = { stage: "step", step: r.step };
    } catch (e) {
      toast(errText(e));
      ui.effort = { stage: "pick" };
    }
    render();
  }

  const FORMS = {
    async intent(f) {
      const g = ui.gate, t = f.t.value.trim();
      if (!t) { toast(ERR.empty); return; }
      g.draft = t; g.stage = "thinking"; render();
      try {
        const r = await call("gate", { app: ui.app, intent: t });
        showAttempt(r.attempt);
      } catch (e) {
        if (e.code === "locked") { if (e.data && e.data.lock && state) state.lock = e.data.lock; await refresh(); return go("lock"); }
        g.stage = "intent"; render(); toast(errText(e));
      }
    },
    async answer(f) {
      const g = ui.gate, t = f.t.value.trim();
      if (!t) { toast(ERR.empty); return; }
      g.draft = t; g.stage = "answering"; render();
      try {
        const r = await call("answer", { attempt_id: g.attempt.id, answer: t });
        showAttempt(r.attempt);
      } catch (e) { g.stage = "ask"; render(); toast(errText(e)); }
    },
    task(f) {
      const t = f.t.value.trim();
      if (!t) { toast(ERR.empty); return; }
      startStep({ title: t });
    },
    async report(f) {
      const e = ui.effort, t = f.t.value.trim();
      if (!t) { toast(ERR.empty); return; }
      e.draft = t; e.stage = "judging"; render();
      try {
        const r = await call("report", { step_id: e.step.id, report: t }, 30000);
        if (r.accepted) { e.result = r; e.stage = "result"; e.draft = ""; e.feedback = ""; await loadState(ui.app).catch(() => {}); }
        else { e.feedback = r.feedback; e.stage = "step"; }
      } catch (err) { e.stage = "step"; toast(errText(err)); }
      render();
    },
    async rules(f) {
      try { const s = await call("settings", { rules: f.t.value }); if (state) state.settings = s; toast("נשמר."); } catch (e) { toast(errText(e)); }
    },
    async conn(f) {
      const api = f.api.value.trim().replace(/\/+$/, ""), k = f.k.value.trim();
      if (api) { API = api; store.set(LS.api, api === DEFAULT_API ? null : api); }
      if (k) { TOKEN = k; store.set(LS.k, k); }
      try { await loadState(); toast("נשמר ומחובר ✓"); } catch (e) { toast(errText(e)); }
      render();
    },
    async setup(f) {
      const k = f.k.value.trim();
      if (k.length < 16) { toast("טוקן קצר מדי."); return; }
      TOKEN = k; store.set(LS.k, k);
      try {
        await loadState(ui.app);
      } catch (e) {
        if (e.code === "auth") { TOKEN = ""; store.set(LS.k, null); }
        toast(errText(e)); return;
      }
      const intended = qs.get("a");
      boot(intended && intended !== "setup" && intended !== "err" ? intended : "home");
    },
  };

  // ---------------------------------------------------------------- events
  $app.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-act]");
    if (!el || el.disabled) return;
    const fn = ACT[el.dataset.act];
    if (fn) { ev.preventDefault(); fn(el); }
  });
  $app.addEventListener("submit", (ev) => {
    const f = ev.target.closest("form[data-form]");
    if (!f) return;
    ev.preventDefault();
    const fn = FORMS[f.dataset.form];
    if (fn) fn(f);
  });
  $app.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing && ev.target.matches("textarea[enterkeyhint=send]")) {
      ev.preventDefault();
      ev.target.form.requestSubmit();
    }
  });
  $app.addEventListener("input", (ev) => {
    if (ev.target.matches("textarea[name=t]") && ui.gate && view === "gate") ui.gate.draft = ev.target.value;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && TOKEN && (view === "home" || view === "lock")) refresh();
  });

  // ---------------------------------------------------------------- boot
  function boot(v) {
    ui.app = (qs.get("app") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
    if (v === "err") { view = "err"; render(); return; }
    if (!TOKEN) { view = "setup"; render(); return; }
    view = VIEWS[v] ? v : "home";
    if (view === "gate") ui.gate = { stage: "intent" };
    if (view === "effort") ui.effort = { stage: "pick" };
    render(); // instant paint from cache; the server answer follows
    loadState(ui.app).then((s) => {
      if (view === "gate") {
        if (s.lock) return go("lock");
        const p = s.pending;
        if (p && ui.gate.stage === "intent" && !(ui.gate.draft || "").trim()) {
          // came back to an unfinished gate: continue it instead of starting over
          return showAttempt(p);
        }
        // keep what was typed meanwhile; only refresh the header and the question's grammar
        const meta = $app.querySelector(".top .meta");
        if (meta) meta.innerHTML = gateMeta();
        const q = $app.querySelector("h1.q");
        if (q) q.textContent = G("מה אתה מחפש עכשיו?", "מה את מחפשת עכשיו?");
        return;
      }
      if (view === "lock" && !s.lock) return render();
      if (view === "effort" && ui.effort.stage === "pick") ui.effort = effortFromState();
      render();
    }).catch((e) => {
      if (e.code === "auth") { view = "setup"; render(); toast(ERR.auth); return; }
      if (view !== "gate") toast(errText(e));
    });
  }

  boot(qs.get("a") || "home");

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
