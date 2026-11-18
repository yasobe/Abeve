// Home: live streak, savings, today's check-in, quick actions, reasons, next body milestone.
import { html, icon, ring, lineChart, confirmDialog } from "../ui.js";
import { g, gx, num, money, days, duration, dayKey, dateLong, greeting, hours as hoursTxt } from "../i18n.js";
import { streakMs, isBeforeQuit, totalSavings, milestoneInfo, taperTarget, taperPlan, daysUntil, DAY, HOUR, totalCleanMs } from "../calc.js";
import { QUOTES, PREP_CHECKLIST, TIMELINE, MOODS, SLEEP } from "../content.js";

const pad = n => String(n).padStart(2, "0");
function clock(ms) {
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
function quoteOfDay() {
  const k = dayKey();
  let h = 0;
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return gx(QUOTES[h % QUOTES.length]);
}

function streakCard(s) {
  const ms = streakMs(s.profile);
  const d = Math.floor(ms / DAY);
  const mi = milestoneInfo(ms);
  return html`<section class="card hero" aria-labelledby="streak-h">
    <div class="hero-ring">${ring(mi.progress, 148, 11, "accent")}
      <div class="hero-ring-in"><span class="hero-days num" data-live="days">${num(d)}</span><span class="hero-unit">${d === 1 ? "יום" : "ימים"}</span></div>
    </div>
    <div class="hero-text">
      <p class="eyebrow" id="streak-h">הרצף הנוכחי</p>
      <p class="hero-dur" data-live="dur">${duration(ms)}</p>
      <p class="num hero-clock" data-live="clock" aria-hidden="true">${clock(ms)}</p>
      <p class="small muted">היעד הבא: <b>${mi.next.label}</b> · עוד <span data-live="next">${duration(mi.remainingMs)}</span></p>
    </div>
  </section>`;
}

function statsRow(s) {
  const sav = totalSavings(s);
  const cur = s.profile.currency;
  const items = [];
  if (s.settings.showMoney && s.profile.baseline.costPerWeek > 0) items.push({ ic: "coin", v: money(sav.money, cur), l: "נחסך", live: "money" });
  if (s.profile.baseline.sessionsPerDay > 0) items.push({ ic: "shield", v: num(sav.sessions), l: "פעמים שלא השתמשת", live: "sessions" });
  if (s.profile.baseline.gramsPerDay > 0) items.push({ ic: "sprout", v: `${num(sav.grams, 1)} ג׳`, l: "לא נצרכו", live: "grams" });
  items.push({ ic: "clock", v: hoursTxt(Math.floor(sav.hours)), l: "זמן שחזר אליך" });
  return html`<section class="stats" aria-label="סיכום">${items.slice(0, 4).map(i => html`
    <div class="stat">${icon(i.ic, 20)}<span class="stat-v num" ${i.live ? html`data-live="${i.live}"` : ""}>${i.v}</span><span class="stat-l">${i.l}</span></div>`)}</section>`;
}

function checkinCard(s) {
  const today = dayKey();
  const c = s.checkins.find(x => x.date === today);
  const [hh, mm] = s.settings.checkinTime.split(":").map(Number);
  const now = new Date();
  const due = now.getHours() * 60 + now.getMinutes() >= hh * 60 + mm;
  if (!c) return html`<a class="card cta ${due ? "due" : ""}" href="#/checkin">
      <span class="cta-ic">${icon("check")}</span>
      <span class="cta-text"><b>צ׳ק־אין יומי</b><small>${due ? "הגיע הזמן — דקה אחת על איך היה היום" : "איך מרגישים היום? מצב רוח, שינה, חשקים"}</small></span>
      ${icon("fwd", 20, "chev")}</a>`;
  return html`<a class="card cta done" href="#/checkin">
      <span class="cta-ic">${icon("check")}</span>
      <span class="cta-text"><b>הצ׳ק־אין של היום נשמר</b>
      <small>מצב רוח: ${MOODS[c.mood - 1]} · שינה: ${SLEEP[c.sleep - 1]} · חשק: ${c.craving}/10</small></span>
      ${icon("pen", 18, "chev")}</a>`;
}

function quick() {
  return html`<section class="quick" aria-label="פעולות מהירות">
    <a class="q sos" href="#/sos">${icon("lifebuoy")}<span>יש לי חשק</span></a>
    <a class="q" href="#/craving">${icon("wave")}<span>לתעד חשק</span></a>
    <a class="q" href="#/journal/new">${icon("pen")}<span>לכתוב</span></a>
    <a class="q" href="#/tools/breathe">${icon("wind")}<span>לנשום</span></a>
  </section>`;
}

function reasonsCard(s) {
  const r = s.profile.reasons;
  if (!r.length && !s.profile.why) return html`<a class="card cta" href="#/plan">${icon("heart")}<span class="cta-text"><b>להוסיף את הסיבות שלי</b><small>הן יעזרו ברגעים הקשים</small></span>${icon("fwd", 20, "chev")}</a>`;
  const pick = r.length ? r[Math.floor(Date.now() / DAY) % r.length] : "";
  return html`<section class="card reason">
    <p class="eyebrow">${icon("heart", 16)} הסיבה שלך להיום</p>
    ${pick ? html`<p class="reason-text">${pick}</p>` : ""}
    ${s.profile.why ? html`<blockquote>${s.profile.why}</blockquote>` : ""}
  </section>`;
}

function bodyCard(s) {
  const h = streakMs(s.profile) / HOUR;
  const next = TIMELINE.find(t => t.h > h) || TIMELINE[TIMELINE.length - 1];
  const done = TIMELINE.filter(t => t.h <= h).length;
  return html`<a class="card link-card" href="#/timeline">
    <div class="row"><p class="eyebrow">${icon("pulse", 16)} מה קורה בגוף</p><span class="small muted">${done}/${TIMELINE.length}</span></div>
    <p><b>הבא: ${next.title}</b></p>
    <p class="small muted clamp2">${gx(next.body)}</p>
  </a>`;
}

function rewardCard(s) {
  const r = s.plan.rewards.find(x => !x.done && x.price > 0);
  if (!r || !s.settings.showMoney) return "";
  const saved = totalSavings(s).money;
  const p = Math.min(1, saved / r.price);
  return html`<a class="card link-card" href="#/plan">
    <div class="row"><p class="eyebrow">${icon("gift", 16)} חוסכים בשביל</p><span class="small num">${Math.round(p * 100)}%</span></div>
    <p><b>${r.title}</b></p>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p * 100)}"><span style="width:${(p * 100).toFixed(1)}%"></span></div>
    <p class="small muted">${p >= 1 ? "הגעת ליעד! מגיע לך." : `${money(saved, s.profile.currency)} מתוך ${money(r.price, s.profile.currency)}`}</p>
  </a>`;
}

// ---- before the quit date -------------------------------------------------------------------
function prepView(s) {
  const p = s.profile;
  const left = new Date(p.quitAt).getTime() - Date.now();
  const done = new Set(s.plan.prep);
  return html`
    <section class="card hero prep">
      <div class="hero-text">
        <p class="eyebrow">יום ההפסקה</p>
        <p class="hero-dur">${dateLong(p.quitAt)}</p>
        <p class="muted">${left < DAY ? "מחר זה קורה" : `עוד ${days(daysUntil(p.quitAt))}`} · <span data-live="countdown">${duration(left)}</span></p>
      </div>
      <button class="btn primary" data-act="startNow">להתחיל כבר עכשיו</button>
    </section>
    <section class="card">
      <div class="row"><h2>הכנה ליום ההפסקה</h2><span class="small muted num">${done.size}/${PREP_CHECKLIST.length}</span></div>
      <p class="small muted">מי שמתכונן מראש מגדיל את הסיכוי להצליח.</p>
      <ul class="checklist">${PREP_CHECKLIST.map(i => html`<li><label><input type="checkbox" data-prep="${i.k}" ${done.has(i.k) ? "checked" : ""}><span>${i.label}</span></label></li>`)}</ul>
    </section>`;
}

function taperView(s) {
  const p = s.profile, today = dayKey();
  const target = taperTarget(p, today);
  const log = s.taperLog.find(x => x.date === today);
  const count = log ? log.count : 0;
  const plan = taperPlan(p);
  const logged = new Map(s.taperLog.map(x => [x.date, x.count]));
  const series = plan.map(x => x.target);
  const actual = plan.map(x => (x.key <= today && logged.has(x.key) ? logged.get(x.key) : null));
  const over = count > target;
  return html`
    <section class="card hero taper">
      <div class="hero-text">
        <p class="eyebrow">הפחתה הדרגתית · עוד ${days(daysUntil(p.quitAt))} עד אפס</p>
        <p class="hero-dur">היעד להיום: <span class="num">${target}</span> ${target === 1 ? "פעם" : "פעמים"}</p>
      </div>
      <div class="stepper" role="group" aria-label="כמה פעמים השתמשת היום">
        <button class="icon-btn" data-act="taperDec" aria-label="פחות">−</button>
        <span class="stepper-v num ${over ? "warn" : ""}" aria-live="polite">${count}</span>
        <button class="icon-btn" data-act="taperInc" aria-label="עוד אחת">+</button>
      </div>
      <p class="small ${over ? "warn" : "muted"}">${over ? "מעל היעד היום — זה קורה. מחר יעד חדש." : count === target ? "בדיוק ביעד." : "מתחת ליעד — יפה מאוד."}</p>
    </section>
    <section class="card">
      <h2>התוכנית</h2>
      <div class="legend"><span class="lg accent">יעד</span><span class="lg ink">בפועל</span></div>
      <div class="layered">${lineChart(series, { min: 0, cls: "accent", height: 130, yTicks: [0, Math.max(1, Math.ceil(p.baseline.sessionsPerDay))], title: "יעד יומי" })}
      ${lineChart(actual, { min: 0, max: Math.max(1, ...series), cls: "ink overlay", height: 130, title: "שימוש בפועל" })}</div>
      <p class="small muted">היעד יורד בהדרגה עד ${dateLong(p.quitAt)}. ביום הזה הספירה הצלולה מתחילה.</p>
    </section>`;
}

function render(ctx) {
  const s = ctx.state;
  const before = isBeforeQuit(s.profile);
  const name = s.profile.name;
  const total = totalCleanMs(s);
  const hadSlip = s.attempts.length > 0;
  return html`
    <header class="home-head">
      <div><p class="eyebrow">${greeting()}${name ? `, ${name}` : ""}</p><h1>${before ? (s.profile.mode === "taper" ? "בדרך לאפס" : "מתכוננים") : "היום שלך"}</h1></div>
      <a class="icon-btn" href="#/settings" aria-label="הגדרות">${icon("settings")}</a>
    </header>
    ${before ? (s.profile.mode === "taper" ? taperView(s) : prepView(s)) : streakCard(s)}
    ${!before ? statsRow(s) : ""}
    ${hadSlip && !before ? html`<p class="small muted center">סך הכל ${duration(total)} צלולים בכל הדרך — זה לא נמחק.</p>` : ""}
    ${quick()}
    ${checkinCard(s)}
    ${reasonsCard(s)}
    ${!before ? bodyCard(s) : ""}
    ${rewardCard(s)}
    <section class="card quote"><p>${quoteOfDay()}</p></section>
    ${!before ? html`<p class="center"><a class="btn link small" href="#/slip">השתמשתי — מה עכשיו?</a></p>` : ""}
  `;
}

export default {
  title: "בית",
  render,
  mount(root, ctx) {
    const s = ctx.state;
    const before = isBeforeQuit(s.profile);
    let lastDay = Math.floor(streakMs(s.profile) / DAY);
    const tick = () => {
      if (!ctx.state) return;
      const p = ctx.state.profile;
      if (isBeforeQuit(p) !== before) return ctx.rerender(); // quit time arrived
      const set = (k, v) => { const el = root.querySelector(`[data-live="${k}"]`); if (el && el.textContent !== v) el.textContent = v; };
      if (before) { set("countdown", duration(new Date(p.quitAt).getTime() - Date.now())); return; }
      const ms = streakMs(p);
      const d = Math.floor(ms / DAY);
      if (d !== lastDay) { lastDay = d; return ctx.rerender(); }
      set("clock", clock(ms));
      set("dur", duration(ms));
      set("next", duration(milestoneInfo(ms).remainingMs));
      const sav = totalSavings(ctx.state);
      set("money", money(sav.money, p.currency));
      set("sessions", num(sav.sessions));
      set("grams", `${num(sav.grams, 1)} ג׳`);
    };
    const t = setInterval(tick, 1000);
    const onPrep = e => {
      const k = e.target.dataset?.prep;
      if (!k) return;
      ctx.update(st => {
        const set = new Set(st.plan.prep);
        e.target.checked ? set.add(k) : set.delete(k);
        st.plan.prep = [...set];
      });
    };
    root.addEventListener("change", onPrep);
    return () => { clearInterval(t); root.removeEventListener("change", onPrep); };
  },
  actions: {
    async startNow(el, ctx) {
      const ok = await confirmDialog("להתחיל עכשיו?", "הספירה תתחיל מהרגע הזה.", { ok: "כן, מתחילים" });
      if (ok) ctx.update(s => { s.profile.quitAt = new Date().toISOString(); s.profile.mode = "quit"; });
    },
    taperInc(el, ctx) { stepTaper(ctx, 1); },
    taperDec(el, ctx) { stepTaper(ctx, -1); },
  },
};

function stepTaper(ctx, d) {
  const k = dayKey();
  ctx.update(s => {
    const x = s.taperLog.find(e => e.date === k);
    if (x) x.count = Math.max(0, Math.min(50, x.count + d));
    else s.taperLog.push({ date: k, count: Math.max(0, d) });
  });
}
