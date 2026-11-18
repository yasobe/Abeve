// "היום" – the home dashboard.

import { html, raw, dayKey, fmtDate, fmtNum, fmtMoney, greeting, dailyPick, plural, U, addDays, startOfDay, humanSpan } from "../util.js";
import { icon, openSheet, closeSheet } from "../ui.js";
import { ring } from "../charts.js";
import { streak, savings, soberDays, milestones, goalEta, baselinePerDay, checkinStreak, longestStreak } from "../calc.js";
import { DAILY, MOODS, MILESTONES } from "../content.js";
import { openCheckin, openCraving, openJournal, openDrink, celebrate, G } from "./common.js";

function weekDrinks(state, now = new Date()) {
  const from = addDays(startOfDay(now), -6);
  return state.drinks.filter(d => new Date(d.at) >= from).reduce((s, d) => s + d.count, 0);
}

export default {
  title: "היום",
  render(app) {
    const st = app.state, p = st.profile, now = new Date();
    const s = streak(st, now);
    const sv = savings(st, now);
    const ms = milestones(st, now);
    const key = dayKey(now);
    const ci = st.checkins[key];
    const [hh, mm] = st.settings.reminder.split(":").map(Number);
    const late = !ci?.done && (now.getHours() > hh || (now.getHours() === hh && now.getMinutes() >= mm));
    const eta = goalEta(st, now);
    const mood = ci?.mood ? MOODS.find(m => m.v === ci.mood) : null;
    const reasons = p.reasons.slice(0, 3);
    const best = longestStreak(st, now);

    return html`
    <section class="today">
      <header class="page-head hello">
        <p class="muted">${fmtDate(now, "long")}</p>
        <h1>${greeting(now)}${p.name ? `, ${p.name}` : ""}</h1>
      </header>

      ${late ? html`<button class="banner" data-act="checkin">${icon("bell")}<span>עוד לא עשית${G(app, "", "", "ם")} צ׳ק-אין היום. דקה אחת, וזה נשמר.</span>${icon("chevron")}</button>` : ""}

      <div class="today-grid">
        <article class="card hero" aria-labelledby="hero-l">
          <div class="hero-ring">
            ${ring(ms.progress, { label: ms.next ? `התקדמות לאבן הדרך הבאה: ${Math.round(ms.progress * 100)}%` : "כל אבני הדרך הושגו" })}
            <div class="hero-center">
              <span class="hero-num" data-live="streak-days">${fmtNum(s.days)}</span>
              <span class="hero-unit" data-live="streak-unit">${s.days === 1 ? "יום" : "ימים"}</span>
              <span class="hero-hms" data-live="streak-hms" aria-hidden="true"></span>
            </div>
          </div>
          <h2 id="hero-l" class="hero-l">ללא אלכוהול</h2>
          <p class="muted small">מאז ${fmtDate(s.start, "full")}${best > s.totalDays + 0.01 ? html` · הרצף הארוך: ${humanSpan(best)}` : ""}</p>
          ${ms.next ? html`<p class="next-ms"><span aria-hidden="true">${ms.next.i}</span> עוד ${plural(Math.ceil(ms.remainingDays), U.day)} ל<b>${ms.next.t}</b></p>` : html`<p class="next-ms">🏆 השגת את כל אבני הדרך!</p>`}
        </article>

        <div class="stats4">
          <div class="stat"><span class="stat-ic money">${icon("coin")}</span><span class="stat-v" data-live="money">${fmtMoney(sv.money)}</span><span class="stat-l">נחסכו</span></div>
          <div class="stat"><span class="stat-ic glass">${icon("glass")}</span><span class="stat-v" data-live="drinks">${fmtNum(sv.drinksAvoided)}</span><span class="stat-l">משקאות שלא נשתו</span></div>
          <div class="stat"><span class="stat-ic days">${icon("sun")}</span><span class="stat-v">${fmtNum(soberDays(st, now))}</span><span class="stat-l">ימים נקיים בסה״כ</span></div>
          <div class="stat"><span class="stat-ic kcal">${icon("flame")}</span><span class="stat-v" data-live="kcal">${fmtNum(sv.kcal)}</span><span class="stat-l">קלוריות נחסכו</span></div>
        </div>

        <article class="card checkin-card">
          ${ci?.done ? html`
            <div class="ci-done">
              <span class="ci-mood" aria-hidden="true">${mood ? mood.e : "✅"}</span>
              <div><h2 class="card-t">הצ׳ק-אין של היום נשמר</h2>
                <p class="muted small">${mood ? `מצב רוח: ${mood.t} · ` : ""}דחף: ${ci.craving ?? 0}/10${checkinStreak(st, now) > 1 ? ` · ${plural(checkinStreak(st, now), U.day)} ברצף` : ""}</p></div>
              <button class="btn sm ghost" data-act="checkin">עדכון</button>
            </div>` : html`
            <h2 class="card-t">איך עובר עליך היום?</h2>
            <p class="muted small">צ׳ק-אין קצר כל ערב בונה תמונה של מה עוזר לך.</p>
            <div class="quick-moods">${MOODS.map(m => html`<button class="qm" data-act="checkin" data-mood="${m.v}" aria-label="${m.t}"><span aria-hidden="true">${m.e}</span></button>`)}</div>`}
          <form class="intent" data-form="intention">
            <label class="lbl" for="intent">${icon("target")} הכוונה שלי להיום</label>
            <div class="add-row"><input id="intent" name="intention" maxlength="300" value="${ci?.intention || ""}" placeholder="למשל: הערב – הליכה בים במקום בר">
              <button class="btn sm" type="submit">${ci?.intention ? "עדכון" : "שמירה"}</button></div>
          </form>
        </article>

        <article class="card quick">
          <h2 class="card-t">כלים מהירים</h2>
          <div class="quick-grid">
            <a class="qa sos" href="#/sos">${icon("wave")}<span>יש לי דחף</span></a>
            <a class="qa" href="#/tools/breathing">${icon("lungs")}<span>נשימה</span></a>
            <button class="qa" data-act="craving">${icon("hand")}<span>רישום דחף</span></button>
            <button class="qa" data-act="journal">${icon("edit")}<span>כתיבה ביומן</span></button>
          </div>
          <button class="link-btn" data-act="drink">רישום שתייה</button>
        </article>

        <article class="card daily">
          <span class="daily-mark" aria-hidden="true">“</span>
          <p class="daily-t">${dailyPick(DAILY, now)}</p>
        </article>

        ${reasons.length ? html`<article class="card reasons">
          <h2 class="card-t">${icon("heart")} למה התחלתי</h2>
          <ul class="reason-list">${reasons.map(r => html`<li>${r}</li>`)}</ul>
          <a class="link-btn" href="#/tools/reasons">כל הסיבות</a>
        </article>` : ""}

        ${p.goal === "reduce" ? html`<article class="card">
          <h2 class="card-t">${icon("glass")} השבוע</h2>
          <p class="big-line">${fmtNum(weekDrinks(st, now))} <small>משקאות ב-7 הימים האחרונים</small></p>
          <p class="muted small">לפני ההתחלה: בערך ${fmtNum(baselinePerDay(p) * 7)} משקאות בשבוע.</p>
        </article>` : ""}

        ${eta ? html`<article class="card goal">
          <h2 class="card-t">${icon("star")} חוסכים ל${st.savingsGoal.name || "מטרה"}</h2>
          <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(eta.progress * 100)}" aria-label="התקדמות החיסכון"><span style="inline-size:${(eta.progress * 100).toFixed(1)}%"></span></div>
          <p class="muted small">${fmtMoney(eta.saved)} מתוך ${fmtMoney(st.savingsGoal.price)}${eta.left > 0 && eta.days ? ` · עוד כ-${plural(eta.days, U.day)}` : eta.left <= 0 ? " · הגעת למטרה! 🎉" : ""}</p>
        </article>` : html`<a class="card goal ghost-card" href="#/progress/goal">${icon("star")}<span>להגדיר מטרת חיסכון – על מה ילך הכסף?</span></a>`}
      </div>
    </section>`;
  },

  mount(root, app) {
    // celebrate a newly reached milestone once
    const days = streak(app.state).totalDays;
    const reached = [...MILESTONES].reverse().find(m => m.d <= days);
    const seen = app.state.seen.milestone;
    if (reached && reached.d > seen) {
      app.store.update(s => { s.seen.milestone = reached.d; }, { silent: true });
      setTimeout(() => celebrateMilestone(app, reached), 400);
    } else if ((reached?.d || 0) < seen) {
      // the streak restarted: allow its milestones to be celebrated again
      app.store.update(s => { s.seen.milestone = reached?.d || 0; }, { silent: true });
    }
  },

  actions: {
    checkin(el, app) {
      openCheckin(app);
      const m = el.dataset.mood;
      if (m) { const r = document.querySelector(`#sheet input[name="mood"][value="${m}"]`); if (r) r.checked = true; }
    },
    craving(el, app) { openCraving(app); },
    journal(el, app) { openJournal(app); },
    drink(el, app) { openDrink(app); },
  },

  forms: {
    intention(d, form, app) {
      const key = dayKey();
      app.store.update(s => {
        s.checkins[key] = { ...(s.checkins[key] || { at: new Date().toISOString(), mood: null, craving: null, drank: false, note: "", grateful: "", done: false }), intention: d.intention };
      });
      celebrate(d.intention ? "הכוונה נשמרה. אפשר לחזור אליה במהלך היום." : "הכוונה נמחקה");
      app.render({ keepScroll: true });
    },
  },
};

function celebrateMilestone(app, m) {
  openSheet({
    title: "אבן דרך!",
    content: html`<div class="celebrate">
      <div class="confetti" aria-hidden="true">${raw(Array.from({ length: 18 }, (_, i) => `<i style="--i:${i}"></i>`).join(""))}</div>
      <div class="cel-icon" aria-hidden="true">${m.i}</div>
      <h3 class="cel-t">${m.t} ללא אלכוהול</h3>
      <p>${G(app, "עשית", "עשית", "עשיתם")} את זה, יום אחרי יום. זה הישג אמיתי – ${G(app, "תן", "תני", "תנו")} לעצמך רגע להרגיש אותו.</p>
      <p class="muted small">חסכת עד עכשיו ${fmtMoney(savings(app.state).money)}.</p>
      <button class="btn primary block" data-sact="ok">תודה!</button>
    </div>`,
    onAction: () => closeSheet(),
  });
}
