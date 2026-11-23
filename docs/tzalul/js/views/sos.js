// "יש לי דחף" – calm, focused craving support with an urge-surfing timer.

import { html, dailyPick } from "../util.js";
import { icon, closeSheet } from "../ui.js";
import { SURF_TIPS, DISTRACTIONS, HALT } from "../content.js";
import { savings, streak } from "../calc.js";
import { fmtMoney, plural, U } from "../util.js";
import { breathWidget, runBreath } from "./breath.js";
import { openCraving, openDrink, telHref, G } from "./common.js";

const SURF_GOAL = 20 * 60; // seconds – most cravings fade well within this
let surfStart = null;

const mmss = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const elapsed = () => (surfStart ? Math.floor((Date.now() - surfStart) / 1000) : 0);

export default {
  title: "יש לי דחף",
  back: "today",
  render(app) {
    if (!surfStart || Date.now() - surfStart > 3600000) surfStart = Date.now();
    const st = app.state;
    const c = st.contacts[0];
    const s = streak(st);
    const sv = savings(st);
    return html`<section class="sos-page">
      <header class="sos-head">
        <h1>הדחף הזה יעבור.</h1>
        <p>${G(app, "אתה לא צריך לעשות שום דבר עם הדחף חוץ מלחכות לו. בוא נעבור אותו יחד.", "את לא צריכה לעשות שום דבר עם הדחף חוץ מלחכות לו. בואי נעבור אותו יחד.", "אין צורך לעשות שום דבר עם הדחף חוץ מלחכות לו. בואו נעבור אותו יחד.")}</p>
      </header>

      <div class="surf card">
        <div class="surf-wave" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="surf-time" role="timer" aria-label="זמן מתחילת הדחף"><span id="surf-t">${mmss(elapsed())}</span><small>גלישה על הגל</small></div>
        <div class="bar thin" aria-hidden="true"><span id="surf-bar" style="inline-size:0%"></span></div>
        <p class="surf-tip" id="surf-tip" aria-live="polite">${SURF_TIPS[0]}</p>
      </div>

      <div class="sos-tools">
        <details class="sos-d" name="sos">
          <summary>${icon("lungs")}<span>נשימה מודרכת</span></summary>
          <div class="sos-dc">${breathWidget("box")}</div>
        </details>
        ${st.profile.reasons.length ? html`<details class="sos-d" name="sos">
          <summary>${icon("heart")}<span>הסיבות שלי</span></summary>
          <div class="sos-dc"><ul class="reason-list big">${st.profile.reasons.map(r => html`<li>${r}</li>`)}</ul>
          <p class="muted">כבר ${plural(s.days, U.day)} בלי אלכוהול, ו-${fmtMoney(sv.money)} שנשארו אצלך.</p></div>
        </details>` : ""}
        <details class="sos-d" name="sos">
          <summary>${icon("play")}<span>להריץ את הסרט קדימה</span></summary>
          <div class="sos-dc"><ol class="tape">
            <li><b>המשקה הראשון:</b> מה אני באמת מצפה להרגיש?</li>
            <li><b>אחרי שעה:</b> האם אעצור באחד? מה קרה בפעמים הקודמות?</li>
            <li><b>הלילה:</b> איך אישן? מה אגיד או אעשה?</li>
            <li><b>מחר בבוקר:</b> איך ארגיש כשאתעורר? מה אחשוב על עצמי?</li>
            <li><b>ועכשיו הפוך:</b> איך ארגיש מחר בבוקר אם הדחף יעבור הלילה בלי שתייה?</li>
          </ol>
          ${st.letter.text ? html`<div class="letter-quote"><p class="lbl">מכתב שכתבת לעצמך:</p><p>${st.letter.text}</p></div>` : ""}</div>
        </details>
        <details class="sos-d" name="sos">
          <summary>${icon("hand")}<span>HALT – מה באמת חסר לי?</span></summary>
          <div class="sos-dc"><ul class="halt-mini">${HALT.map(h => html`<li><b>${h.t}</b> – ${h.a}</li>`)}</ul></div>
        </details>
        <div class="sos-d idea">
          <div class="sos-idea"><span class="lbl">${icon("sparkle")} רעיון ל-10 הדקות הקרובות</span>
            <p id="idea">${dailyPick(DISTRACTIONS, new Date(), Math.floor(Date.now() / 60000))}</p>
            <button class="btn sm ghost" data-act="idea">רעיון אחר</button></div>
        </div>
        ${c ? html`<a class="sos-call" href="${telHref(c.phone)}">${icon("phone")}<span>להתקשר ל${c.name || c.phone}</span></a>`
            : html`<a class="sos-call ghost" href="#/tools/help">${icon("phone")}<span>להוסיף אדם תומך שאפשר להתקשר אליו</span></a>`}
      </div>

      <div class="sos-end">
        <button class="btn primary block lg" data-act="passed">${icon("check")} הדחף עבר</button>
        <button class="btn ghost block" data-act="drank">שתיתי – לרשום בלי שיפוט</button>
      </div>

      <p class="sos-emerg">${icon("info")} במצוקה רגשית: <a href="tel:1201">ער״ן 1201</a> · מצב חירום רפואי: <a href="tel:101">מד״א 101</a></p>
    </section>`;
  },

  mount(root) {
    const stopBreath = runBreath(root);
    const t = root.querySelector("#surf-t"), bar = root.querySelector("#surf-bar"), tip = root.querySelector("#surf-tip");
    let lastTip = 0;
    const iv = setInterval(() => {
      const e = elapsed();
      t.textContent = mmss(e);
      bar.style.inlineSize = `${Math.min(100, (e / SURF_GOAL) * 100).toFixed(1)}%`;
      const ti = Math.floor(e / 25) % SURF_TIPS.length;
      if (ti !== lastTip) { lastTip = ti; tip.textContent = SURF_TIPS[ti]; }
    }, 1000);
    return () => { clearInterval(iv); stopBreath(); };
  },

  actions: {
    idea() {
      const el = document.getElementById("idea");
      let next;
      do next = DISTRACTIONS[Math.floor(Math.random() * DISTRACTIONS.length)]; while (next === el.textContent && DISTRACTIONS.length > 1);
      el.textContent = next;
    },
    passed(el, app) {
      openCraving(app, { durationSec: elapsed(), after: () => { surfStart = null; closeSheet(true); app.go("today"); } });
    },
    drank(el, app) { surfStart = null; openDrink(app); },
  },
};

