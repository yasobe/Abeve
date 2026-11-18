// "התקדמות" – numbers, charts, milestones, health timeline and savings goal.

import { html, fmtNum, fmtMoney, fmtDate, plural, U, humanSpan } from "../util.js";
import { icon } from "../ui.js";
import { mountChart, lineChart, columnChart, hBars, heatGrid, dataTable } from "../charts.js";
import {
  streak, longestStreak, soberDays, savings, milestones, healthTimeline, dayRange,
  cravingWeeks, triggerCounts, copingCounts, cravingHours, moodSeries, cravingSummary, goalEta,
} from "../calc.js";
import { MOODS } from "../content.js";
import { pageHead, celebrate } from "./common.js";

const moodName = v => MOODS.find(m => m.v === v)?.t ?? "—";

export default {
  title: "התקדמות",
  render(app) {
    const st = app.state, now = new Date();
    const s = streak(st, now), sv = savings(st, now), ms = milestones(st, now);
    const cs = cravingSummary(st);
    const days = dayRange(st, 16 * 7, now);
    const mood = moodSeries(st, 30, now);
    const weeks = cravingWeeks(st, 8, now);
    const trig = triggerCounts(st).slice(0, 6);
    const cope = copingCounts(st).slice(0, 6);
    const hours = cravingHours(st);
    const health = healthTimeline(st, now);
    const eta = goalEta(st, now);
    const hasMood = mood.some(m => m.mood != null);
    const hasCr = weeks.some(w => w.passed + w.drank > 0);

    return html`<section class="progress">
      ${pageHead("התקדמות", `התחלת ב-${fmtDate(st.profile.startAt, "full")}.`)}

      <div class="kpis">
        <div class="kpi main"><span class="kpi-l">רצף נוכחי</span><span class="kpi-v">${humanSpan(s.totalDays)}</span></div>
        <div class="kpi"><span class="kpi-l">הרצף הארוך</span><span class="kpi-v">${humanSpan(Math.max(longestStreak(st, now), s.totalDays))}</span></div>
        <div class="kpi"><span class="kpi-l">ימים ללא אלכוהול</span><span class="kpi-v">${fmtNum(soberDays(st, now))}</span></div>
        <div class="kpi"><span class="kpi-l">כסף שנחסך</span><span class="kpi-v">${fmtMoney(sv.money)}</span></div>
        <div class="kpi"><span class="kpi-l">משקאות שלא נשתו</span><span class="kpi-v">${fmtNum(sv.drinksAvoided)}</span></div>
        <div class="kpi"><span class="kpi-l">קלוריות שנחסכו</span><span class="kpi-v">${fmtNum(sv.kcal)}</span></div>
        <div class="kpi"><span class="kpi-l">דחפים שעברו</span><span class="kpi-v">${cs.total ? `${fmtNum(cs.passed)} מתוך ${fmtNum(cs.total)}` : "—"}</span></div>
        <div class="kpi"><span class="kpi-l">ימי צ׳ק-אין</span><span class="kpi-v">${fmtNum(Object.values(st.checkins).filter(c => c.done).length)}</span></div>
        <div class="kpi"><span class="kpi-l">עוצמת דחף ממוצעת</span><span class="kpi-v">${cs.total ? `${cs.avgIntensity.toFixed(1)}/10` : "—"}</span></div>
      </div>

      <div class="prog-grid">
        <article class="card">
          <h2 class="card-t">16 השבועות האחרונים</h2>
          ${heatGrid(days, d => fmtDate(d, "short"))}
        </article>

        <article class="card">
          <h2 class="card-t">מצב רוח – 30 יום</h2>
          <p class="muted small">מתוך הצ׳ק-אין היומי</p>
          ${hasMood ? html`<div class="chart" data-chart="mood"></div>
            ${dataTable("מצב רוח לפי יום", ["תאריך", "מצב רוח", "דחף"], mood.filter(m => m.mood != null).map(m => [fmtDate(m.date), moodName(m.mood), m.craving ?? "—"]))}`
            : html`<p class="empty">עוד אין צ׳ק-אין. אחרי כמה ימים יופיע כאן גרף.</p>`}
        </article>

        <article class="card">
          <h2 class="card-t">דחפים לפי שבוע</h2>
          ${hasCr ? html`<div class="legend"><span><i class="sw s1"></i>עבר</span><span><i class="sw s2"></i>הסתיים בשתייה</span></div>
            <div class="chart" data-chart="cravings"></div>
            ${dataTable("דחפים לפי שבוע", ["שבוע מ-", "עברו", "בשתייה", "עוצמה ממוצעת"], weeks.map(w => [fmtDate(w.from), w.passed, w.drank, w.avgIntensity ? w.avgIntensity.toFixed(1) : "—"]))}`
            : html`<p class="empty">כשתרשמו דחפים (במסך ״יש לי דחף״ או ביומן) תראו כאן איך הם משתנים.</p>`}
        </article>

        <article class="card">
          <h2 class="card-t">מה מעורר דחף</h2>
          ${hBars(trig, { unit: "פעמים" })}
          <h2 class="card-t mt">מה עוזר לי</h2>
          ${hBars(cope, { unit: "פעמים" })}
          <h2 class="card-t mt">מתי ביום</h2>
          ${cs.total ? hBars(hours, { unit: "דחפים" }) : html`<p class="empty">אין עדיין נתונים.</p>`}
        </article>
      </div>

      <h2 class="sec-t">אבני דרך</h2>
      <ul class="badges">${ms.list.map(m => html`<li class="badge ${m.reached ? "on" : m.ever ? "ever" : ""}" data-tip="${m.reached ? "הושג ברצף הנוכחי" : m.ever ? "הושג ברצף קודם" : `עוד ${plural(Math.ceil(m.d - s.totalDays), U.day)}`}" tabindex="0">
        <span class="badge-i" aria-hidden="true">${m.i}</span><span class="badge-t">${m.t}</span>
        <span class="sr">${m.reached ? "הושג" : m.ever ? "הושג בעבר" : "טרם הושג"}</span></li>`)}</ul>

      <h2 class="sec-t">מה קורה בגוף</h2>
      <ol class="health">${health.map(h => html`<li class="${h.reached ? "on" : ""}">
        <span class="h-dot" aria-hidden="true">${h.reached ? icon("check") : ""}</span>
        <div><b>${h.t}</b> <span class="muted small">· ${h.h < 48 ? plural(h.h, U.hour) : plural(Math.round(h.h / 24), U.day)}</span>
          <p class="small">${h.d}</p>
          ${!h.reached && h.progress > 0 ? html`<div class="bar thin" aria-hidden="true"><span style="inline-size:${(h.progress * 100).toFixed(1)}%"></span></div>` : ""}</div></li>`)}</ol>
      <p class="muted small">${icon("info")} מידע כללי מהספרות הרפואית. התהליך שונה מאדם לאדם ואינו תחליף לבדיקה רפואית.</p>

      <h2 class="sec-t" id="goal">מטרת חיסכון</h2>
      <article class="card">
        ${eta ? html`<p><b>${st.savingsGoal.name || "המטרה שלי"}</b> · ${fmtMoney(st.savingsGoal.price)}</p>
          <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(eta.progress * 100)}" aria-label="התקדמות החיסכון"><span style="inline-size:${(eta.progress * 100).toFixed(1)}%"></span></div>
          <p class="muted small">${eta.left > 0 ? `נשארו ${fmtMoney(eta.left)}${eta.days ? `, בערך ${plural(eta.days, U.day)}` : ""}` : "הגעת למטרה! 🎉 מגיע לך."}</p>` : ""}
        <form class="goal-form" data-form="goal">
          <div class="field"><label class="lbl" for="g-name">על מה חוסכים?</label><input id="g-name" name="name" maxlength="80" value="${st.savingsGoal.name}" placeholder="חופשה, אופניים, מתנה…"></div>
          <div class="field"><label class="lbl" for="g-price">מחיר (₪)</label><input id="g-price" name="price" type="number" min="0" max="10000000" inputmode="numeric" value="${st.savingsGoal.price || ""}"></div>
          <button class="btn primary" type="submit">שמירה</button>
        </form>
      </article>
    </section>`;
  },

  mount(root, app) {
    const st = app.state, now = new Date();
    const moodEl = root.querySelector('[data-chart="mood"]');
    if (moodEl) {
      const m = moodSeries(st, 30, now);
      mountChart(moodEl, lineChart({
        title: "גרף מצב רוח ב-30 הימים האחרונים",
        points: m.map(x => ({ v: x.mood, tip: `${fmtDate(x.date)} · ${x.mood != null ? moodName(x.mood) : "אין צ׳ק-אין"}` })),
        yMin: 1, yMax: 5,
        yTicks: [{ v: 1, label: "😞" }, { v: 3, label: "😐" }, { v: 5, label: "😄" }],
        xLabels: [{ i: 0, label: fmtDate(m[0].date) }, { i: 14, label: fmtDate(m[14].date) }, { i: 29, label: "היום" }],
      }));
    }
    const crEl = root.querySelector('[data-chart="cravings"]');
    if (crEl) {
      const w = cravingWeeks(st, 8, now);
      mountChart(crEl, columnChart({
        title: "דחפים לפי שבוע, 8 שבועות אחרונים",
        series: [{ key: "passed", name: "עבר", cls: "s1" }, { key: "drank", name: "בשתייה", cls: "s2" }],
        bars: w.map(x => ({ label: fmtDate(x.from), values: { passed: x.passed, drank: x.drank }, tip: `שבוע מ-${fmtDate(x.from)} · עברו ${x.passed} · בשתייה ${x.drank}` })),
        xEvery: 2,
      }));
    }
    if (app.params[0] === "goal") setTimeout(() => root.querySelector("#goal")?.scrollIntoView({ behavior: "smooth" }), 50);
  },

  forms: {
    goal(d, form, app) {
      app.store.update(s => { s.savingsGoal = { name: d.name.trim(), price: Number(d.price) || 0 }; });
      celebrate("המטרה נשמרה");
      app.render({ keepScroll: true });
    },
  },
};
