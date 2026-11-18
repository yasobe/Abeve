// Progress: streak stats, achievements, mood/sleep/craving trends, craving patterns and insights.
import { html, icon, lineChart, barChart } from "../ui.js";
import { g, num, money, duration, dateShort, days as daysTxt } from "../i18n.js";
import { streakMs, bestStreakMs, totalCleanMs, totalSavings, achievements, daySeries, trend, cravingStats, checkinStreak, avg, isBeforeQuit } from "../calc.js";
import { TRIGGERS, COPING, SYMPTOMS, MOODS } from "../content.js";
import { head, seg } from "./parts.js";

let period = 30;
const L = (list, k) => list.find(x => x.k === k)?.label || k;

function insights(s) {
  const out = [];
  const cs = cravingStats(s.cravings.filter(c => Date.now() - new Date(c.ts) < 60 * 864e5));
  if (cs.total >= 3 && cs.peakHour != null) {
    const h = cs.peakHour;
    out.push({ ic: "clock", t: `רוב החשקים מגיעים בסביבות ${String(h).padStart(2, "0")}:00. כדאי לתכנן מראש משהו לשעה הזו.` });
  }
  if (cs.topTriggers.length) out.push({ ic: "target", t: `הטריגר הנפוץ ביותר: ${L(TRIGGERS, cs.topTriggers[0][0])}. ${s.plan.triggers.some(t => t.k === cs.topTriggers[0][0] && t.plan) ? "יש לך כבר תוכנית עבורו." : "כדאי להוסיף לו תוכנית התמודדות."}`, link: "plan" });
  if (cs.bestCoping.length && cs.bestCoping[0].ok >= 2) out.push({ ic: "shield", t: `מה שהכי עובד לך: ${L(COPING, cs.bestCoping[0].k)} (${cs.bestCoping[0].ok} פעמים).` });
  const m = trend(s.checkins, "mood"), sl = trend(s.checkins, "sleep"), cr = trend(s.checkins, "craving");
  if (m.delta != null && Math.abs(m.delta) >= 0.4) out.push({ ic: m.delta > 0 ? "sun" : "moon", t: m.delta > 0 ? "מצב הרוח בשבוע האחרון טוב יותר מהשבוע שלפניו." : "מצב הרוח בשבוע האחרון נמוך יותר. זה קורה — שווה לשים לב לשינה, לתנועה ולאנשים." });
  if (sl.delta != null && sl.delta >= 0.4) out.push({ ic: "moon", t: "השינה משתפרת לעומת השבוע הקודם." });
  if (cr.delta != null && cr.delta <= -1) out.push({ ic: "wave", t: `עוצמת החשקים ירדה בממוצע ב־${num(-cr.delta, 1)} נקודות לעומת השבוע הקודם.` });
  if (!out.length) out.push({ ic: "info", t: "כמה ימים של צ׳ק־אין ותיעוד חשקים, וכאן יופיעו תובנות אישיות." });
  return out;
}

function render(ctx) {
  const s = ctx.state;
  const before = isBeforeQuit(s.profile);
  const cur = streakMs(s.profile), best = bestStreakMs(s), total = totalCleanMs(s), sav = totalSavings(s);
  const series = daySeries(s.checkins, period);
  const lbl = series.map((x, i) => (i === 0 || i === series.length - 1 || (period > 14 && i % Math.round(period / 4) === 0) ? dateShort(x.key) : ""));
  const cs = cravingStats(s.cravings.filter(c => Date.now() - new Date(c.ts) < period * 864e5));
  const achs = achievements(s);
  const unlocked = achs.filter(a => a.unlocked).length;
  const symCount = {};
  series.forEach(x => x.c?.symptoms.forEach(k => { symCount[k] = (symCount[k] || 0) + 1; }));
  const symTop = Object.entries(symCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const hourLabels = Array.from({ length: 24 }, (_, h) => (h % 6 === 0 ? `${h}:00` : ""));
  const maxTrig = cs.topTriggers[0]?.[1] || 1;
  const mAvg = avg(series.map(x => x.c?.mood));

  return html`
    ${head("התקדמות")}
    <section class="stats wide">
      <div class="stat">${icon("flag", 20)}<span class="stat-v">${before ? "—" : duration(cur)}</span><span class="stat-l">רצף נוכחי</span></div>
      <div class="stat">${icon("star", 20)}<span class="stat-v">${duration(best)}</span><span class="stat-l">הרצף הארוך</span></div>
      <div class="stat">${icon("sprout", 20)}<span class="stat-v">${duration(total)}</span><span class="stat-l">סך הכל צלול</span></div>
      ${s.settings.showMoney && s.profile.baseline.costPerWeek > 0 ? html`<div class="stat">${icon("coin", 20)}<span class="stat-v num">${money(sav.money, s.profile.currency)}</span><span class="stat-l">נחסך</span></div>`
      : html`<div class="stat">${icon("check", 20)}<span class="stat-v">${daysTxt(checkinStreak(s.checkins))}</span><span class="stat-l">רצף צ׳ק־אין</span></div>`}
    </section>

    <section class="card">
      <h2>תובנות</h2>
      <ul class="insights">${insights(s).map(i => html`<li>${icon(i.ic, 18)}<span>${i.t}${i.link ? html` <a href="#/${i.link}">לתוכנית</a>` : ""}</span></li>`)}</ul>
    </section>

    <a class="card cta" href="#/timeline">${icon("pulse")}<span class="cta-text"><b>מה קורה בגוף</b><small>ציר ההחלמה — שלב אחרי שלב</small></span>${icon("fwd", 20, "chev")}</a>

    <div class="row"><h2>מגמות</h2>${seg("period", [{ k: 14, label: "14 ימים" }, { k: 30, label: "30" }, { k: 90, label: "90" }], period, { label: "תקופה" })}</div>

    <section class="card">
      <div class="row"><h3>מצב רוח</h3>${mAvg != null ? html`<span class="small muted">ממוצע: ${MOODS[Math.round(mAvg) - 1]}</span>` : ""}</div>
      ${lineChart(series.map(x => x.c?.mood ?? null), { min: 1, max: 5, labels: lbl, yTicks: [1, 3, 5], cls: "accent", title: "מצב רוח יומי" })}
    </section>
    <section class="card">
      <h3>שינה</h3>
      ${lineChart(series.map(x => x.c?.sleep ?? null), { min: 1, max: 5, labels: lbl, yTicks: [1, 3, 5], cls: "calm", title: "איכות שינה" })}
    </section>
    <section class="card">
      <h3>עוצמת החשק היומית</h3>
      ${lineChart(series.map(x => x.c?.craving ?? null), { min: 0, max: 10, labels: lbl, yTicks: [0, 5, 10], cls: "warm", title: "עוצמת חשק" })}
    </section>

    <section class="card">
      <div class="row"><h3>מתי מגיעים החשקים</h3><span class="small muted">${cs.total} תיעודים</span></div>
      ${cs.total ? barChart(cs.byHour, { labels: hourLabels, highlight: cs.peakHour, cls: "warm", title: "חשקים לפי שעה" }) : html`<p class="muted small">עוד אין תיעוד חשקים בתקופה הזו. <a href="#/craving">לתעד חשק</a></p>`}
      ${cs.total ? html`<p class="small muted">${g("עמדת", "עמדת", "עמדת")} ב־<b class="num">${cs.resisted}</b> מתוך <span class="num">${cs.total}</span> (${Math.round((cs.rate || 0) * 100)}%).</p>` : ""}
    </section>

    ${cs.topTriggers.length ? html`<section class="card">
      <h3>טריגרים</h3>
      <ul class="hbars">${cs.topTriggers.slice(0, 6).map(([k, n]) => html`<li><span class="hb-l">${L(TRIGGERS, k)}</span><span class="hb"><span style="width:${(100 * n / maxTrig).toFixed(0)}%"></span></span><span class="num hb-n">${n}</span></li>`)}</ul>
    </section>` : ""}

    ${cs.bestCoping.length ? html`<section class="card">
      <h3>מה עוזר לך</h3>
      <ul class="hbars">${cs.bestCoping.slice(0, 6).map(c => html`<li><span class="hb-l">${L(COPING, c.k)}</span><span class="hb ok"><span style="width:${(100 * c.rate).toFixed(0)}%"></span></span><span class="num hb-n">${c.ok}/${c.used}</span></li>`)}</ul>
      <p class="small muted">כמה פעמים כל דרך התמודדות הובילה לעבור את החשק.</p>
    </section>` : ""}

    ${symTop.length ? html`<section class="card">
      <h3>תסמינים בתקופה</h3>
      <ul class="hbars">${symTop.map(([k, n]) => html`<li><span class="hb-l">${L(SYMPTOMS, k)}</span><span class="hb calm"><span style="width:${(100 * n / symTop[0][1]).toFixed(0)}%"></span></span><span class="num hb-n">${n}</span></li>`)}</ul>
      <p class="small muted">מספר הימים שבהם סימנת כל תסמין.</p>
    </section>` : ""}

    <section class="card">
      <div class="row"><h2>הישגים</h2><span class="small muted num">${unlocked}/${achs.length}</span></div>
      <ul class="badges">${achs.map(a => html`<li class="badge-item ${a.unlocked ? "on" : ""}" title="${a.desc}">
        <span class="badge-ic">${icon(a.icon, 24)}</span><b>${a.title}</b><small>${a.unlocked ? a.desc : `${Math.round(a.progress * 100)}%`}</small></li>`)}</ul>
    </section>

    ${s.attempts.length ? html`<section class="card">
      <h2>היסטוריית רצפים</h2>
      <ul class="history">${[...s.attempts].reverse().slice(0, 12).map(a => html`<li><span>${dateShort(a.start)} – ${dateShort(a.end)}</span><b>${duration(new Date(a.end) - new Date(a.start))}</b></li>`)}</ul>
      <p class="small muted">כל רצף לימד משהו. הסך הכל ממשיך לגדול.</p>
    </section>` : ""}`;
}

export default {
  title: "התקדמות",
  render,
  onChange(el, ctx) {
    if (el.name === "period") { period = Number(el.value) || 30; ctx.rerender(); }
  },
};
