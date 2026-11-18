// SOS hub: what to do in the moment of a craving.
import { html, icon } from "../ui.js";
import { g, gx } from "../i18n.js";
import { DISTRACTIONS, TRIGGERS } from "../content.js";
import { emptyState } from "./parts.js";

let distractIdx = Math.floor(Math.random() * DISTRACTIONS.length);
const trigLabel = k => TRIGGERS.find(t => t.k === k)?.label || k;

function render(ctx) {
  const s = ctx.state;
  const reasons = s.profile.reasons;
  return html`
    <header class="sos-head">
      <p class="eyebrow">עזרה עכשיו</p>
      <h1>${g("עצור", "עצרי", "עצרו")} רגע. ${g("אתה", "את", "את/ה")} בסדר.</h1>
      <p class="lead">חשק הוא גל: הוא עולה, מגיע לשיא ויורד — בדרך כלל תוך 15–30 דקות. לא צריך להחליט כלום עכשיו.</p>
    </header>

    <a class="card sos-main" href="#/tools/surf">
      <span class="sos-wave" aria-hidden="true">${icon("wave", 34)}</span>
      <span><b>לגלוש על הדחף</b><small>טיימר מודרך של כמה דקות — עד שהגל עובר</small></span>
      ${icon("fwd", 20, "chev")}
    </a>

    <div class="tool-grid">
      <a class="tool" href="#/tools/breathe">${icon("wind", 26)}<b>נשימה</b><small>להאט את הגוף</small></a>
      <a class="tool" href="#/tools/ground">${icon("eye", 26)}<b>קרקוע</b><small>5־4־3־2־1 חושים</small></a>
      <a class="tool" href="#/tools/tape">${icon("map", 26)}<b>הסרט קדימה</b><small>מה יקרה אחר כך?</small></a>
      <a class="tool" href="#/tools/distract">${icon("spark", 26)}<b>הסחה</b><small>משהו לעשות עכשיו</small></a>
    </div>

    <section class="card">
      <div class="row"><h2>רעיון ל־10 הדקות הקרובות</h2><button class="icon-btn" data-act="shuffle" aria-label="רעיון אחר">${icon("spark", 20)}</button></div>
      <p class="big-idea" aria-live="polite">${DISTRACTIONS[distractIdx]}</p>
    </section>

    <section class="card reason">
      <p class="eyebrow">${icon("heart", 16)} למה ${g("התחלת", "התחלת", "התחלת")}</p>
      ${reasons.length ? html`<ul class="reasons">${reasons.map(r => html`<li>${r}</li>`)}</ul>` : html`<p class="muted">עוד לא נשמרו סיבות. <a href="#/plan">להוסיף עכשיו</a></p>`}
      ${s.profile.why ? html`<blockquote>${s.profile.why}</blockquote>` : ""}
    </section>

    ${s.plan.ifThen.length || s.plan.triggers.some(t => t.plan) ? html`<section class="card">
      <h2>התוכנית שלך</h2>
      <ul class="ifthen">
        ${s.plan.triggers.filter(t => t.plan).map(t => html`<li><span class="tag">${trigLabel(t.k)}</span> ${t.plan}</li>`)}
        ${s.plan.ifThen.map(x => html`<li><b>אם</b> ${x.if} <b>אז</b> ${x.then}</li>`)}
      </ul>
    </section>` : ""}

    <section class="card">
      <h2>לדבר עם מישהו</h2>
      ${s.plan.contacts.length ? html`<div class="contacts">${s.plan.contacts.map(c => html`
        <a class="contact" href="tel:${c.phone}">${icon("phone", 20)}<span><b>${c.name || c.phone}</b><small class="num">${c.phone}</small></span></a>`)}</div>`
      : emptyState("people", "אין עדיין אנשי קשר לתמיכה", "אדם אחד שאפשר להתקשר אליו ברגע קשה משנה הרבה.", html`<a class="btn ghost" href="#/plan">להוסיף איש קשר</a>`)}
    </section>

    <a class="btn primary wide" href="#/craving">${icon("pen", 18)} לתעד את החשק</a>

    <aside class="crisis">
      ${icon("alert", 20)}
      <p>אם עולות מחשבות על פגיעה עצמית — ${g("אתה לא לבד", "את לא לבד", "לא לבד")}. ער״ן זמינים 24/7: <a href="tel:1201"><b>1201</b></a>. במצב חירום: <a href="tel:101">מד״א 101</a>.</p>
    </aside>`;
}

export default {
  title: "עזרה עכשיו",
  render,
  actions: {
    shuffle(el, ctx) {
      distractIdx = (distractIdx + 1 + Math.floor(Math.random() * (DISTRACTIONS.length - 1))) % DISTRACTIONS.length;
      const p = el.closest(".card").querySelector(".big-idea");
      p.textContent = gx(DISTRACTIONS[distractIdx]);
      ctx.update(s => { s.toolUses.push({ tool: "distract", ts: new Date().toISOString() }); }, { render: false });
    },
  },
};
