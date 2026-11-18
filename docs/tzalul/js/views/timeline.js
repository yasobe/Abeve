// Recovery timeline: what typically happens in the body/brain, with progress, and a symptom guide.
import { html, icon } from "../ui.js";
import { gx, duration } from "../i18n.js";
import { TIMELINE, SYMPTOMS, SOURCES } from "../content.js";
import { timelineProgress, streakMs, HOUR, isBeforeQuit } from "../calc.js";
import { head } from "./parts.js";

export default {
  title: "מה קורה בגוף",
  render(ctx) {
    const s = ctx.state;
    const ms = isBeforeQuit(s.profile) ? 0 : streakMs(s.profile);
    const items = timelineProgress(TIMELINE, ms);
    const curIdx = items.findIndex(i => !i.done);
    return html`
      ${head("מה קורה בגוף", { back: true, sub: "מה קורה בדרך כלל אחרי שמפסיקים. כל גוף שונה — הזמנים הם הערכה." })}
      <ol class="timeline">${items.map((it, i) => html`<li class="${it.done ? "done" : i === curIdx ? "current" : ""}">
        <span class="tl-dot" aria-hidden="true">${it.done ? icon("check", 14) : ""}</span>
        <div class="tl-body">
          <div class="row"><b>${it.title}</b>${it.done ? html`<span class="badge ok">הושג</span>` : i === curIdx ? html`<span class="small muted">עוד ${duration((it.h * HOUR) - ms)}</span>` : ""}</div>
          ${i === curIdx ? html`<div class="bar thin"><span style="width:${(it.progress * 100).toFixed(1)}%"></span></div>` : ""}
          <p class="small">${gx(it.body)}</p>
        </div></li>`)}</ol>

      <section class="card">
        <h2>תסמיני גמילה נפוצים — ומה עוזר</h2>
        <div class="accordion">${SYMPTOMS.map(x => html`<details><summary>${x.label}</summary><p class="small">${gx(x.tip)}</p></details>`)}</div>
      </section>

      <aside class="card soft small">
        <p>${icon("info", 14)} תסמינים חזקים, ממושכים או מדאיגים — כדאי לבדוק עם רופא/ה. מחשבות על פגיעה עצמית: ער״ן <a href="tel:1201">1201</a>.</p>
        <details><summary>מקורות</summary><ul>${SOURCES.map(x => html`<li>${x}</li>`)}</ul></details>
      </aside>`;
  },
};
