// "כלים" – coping tools, self-work exercises, self-assessment, learning and support.

import { html, raw, uid, fmtDate, ago } from "../util.js";
import { icon, toast, confirmBox } from "../ui.js";
import { GROUNDING, HALT, ARTICLES, RESOURCES, REASONS, AUDIT, AUDIT_ZONES } from "../content.js";
import { auditScore, auditZone } from "../calc.js";
import { breathWidget, runBreath } from "./breath.js";
import { listEditor, pageHead, telHref, celebrate, G } from "./common.js";

/* ---------- list helpers shared by reasons & plan ---------- */

function getList(state, name) {
  if (name === "reasons") return state.profile.reasons;
  if (name.startsWith("plan.")) return state.plan[name.slice(5)];
  return null;
}

const listActions = {
  "list-del"(el, app) {
    const name = el.dataset.list, i = Number(el.dataset.i);
    app.store.update(s => { getList(s, name)?.splice(i, 1); });
    app.render({ keepScroll: true });
  },
  "chip-add"(el, app) {
    const name = el.dataset.list, v = el.dataset.v;
    app.store.update(s => { const l = getList(s, name); if (l && !l.includes(v)) l.push(v); });
    app.render({ keepScroll: true });
  },
};
const listForms = {
  "list-add"(d, form, app) {
    const name = form.dataset.list, v = d.text.trim();
    if (!v) return;
    app.store.update(s => { const l = getList(s, name); if (l && !l.includes(v)) l.push(v); });
    app.render({ keepScroll: true });
    document.querySelector(`form[data-list="${CSS.escape(name)}"] input`)?.focus();
  },
};

/* ---------- Hub ---------- */

const tile = (href, ic, t, d, cls = "") => html`<a class="tile ${cls}" href="${href}"><span class="tile-ic">${icon(ic)}</span><span class="tile-t">${t}</span><span class="tile-d">${d}</span></a>`;

export const hub = {
  title: "כלים",
  render() {
    return html`<section>
      ${pageHead("כלים", "לרגעים קשים, לעבודה עצמית, ולהבנה של מה שקורה.")}
      <h2 class="sec-t">ברגע של דחף</h2>
      <div class="tiles">
        ${tile("#/sos", "wave", "יש לי דחף", "טיימר גלישה, נשימה והסחת דעת", "accent")}
        ${tile("#/tools/breathing", "lungs", "נשימה מודרכת", "קופסה, 4-7-8, קוהרנטית")}
        ${tile("#/tools/grounding", "eye", "קרקוע 5-4-3-2-1", "לחזור לכאן ועכשיו")}
        ${tile("#/tools/halt", "hand", "HALT", "רעב? כעס? בדידות? עייפות?")}
      </div>
      <h2 class="sec-t">עבודה עצמית</h2>
      <div class="tiles">
        ${tile("#/tools/plan", "shield", "תוכנית מניעת מעידה", "מצבי סיכון, סימני אזהרה ומה עושים")}
        ${tile("#/tools/thoughts", "brain", "יומן מחשבות", "לבדוק מחשבות שמובילות לשתייה")}
        ${tile("#/tools/gratitude", "sun", "הכרת תודה", "שלושה דברים טובים")}
        ${tile("#/tools/letter", "mail", "מכתב לעצמי", "לקרוא ברגע קשה")}
        ${tile("#/tools/reasons", "heart", "הסיבות שלי", "למה זה חשוב לי")}
        ${tile("#/tools/audit", "list", "שאלון הערכה עצמית", "AUDIT של ארגון הבריאות העולמי")}
      </div>
      <h2 class="sec-t">ללמוד</h2>
      <ul class="articles">${ARTICLES.map(a => html`<li><a href="#/learn/${a.id}"><span class="art-i" aria-hidden="true">${a.i}</span><span class="art-t">${a.t}</span><span class="tag ${a.id === "safety" ? "warn" : ""}">${a.tag}</span></a></li>`)}</ul>
      <h2 class="sec-t">עזרה ותמיכה</h2>
      <div class="tiles">${tile("#/tools/help", "phone", "קווי תמיכה ואנשי קשר", "ער״ן, AA, רופא, ואנשים שלך")}</div>
    </section>`;
  },
};

/* ---------- Breathing ---------- */

export const breathing = {
  title: "נשימה מודרכת",
  back: "tools",
  render() {
    return html`<section>${pageHead("נשימה מודרכת", "נשימה איטית מרגיעה את מערכת העצבים ומחלישה דחף. כמה דקות מספיקות.")}
      <div class="card">${breathWidget("box")}</div></section>`;
  },
  mount(root) { return runBreath(root); },
};

/* ---------- Grounding ---------- */

export const grounding = {
  title: "קרקוע",
  back: "tools",
  render() {
    return html`<section>${pageHead("קרקוע 5-4-3-2-1", "כשהראש רץ והדחף חזק – החושים מחזירים לכאן ועכשיו. סמנו כל שלב כשסיימתם.")}
      <ol class="ground">${GROUNDING.map((x, i) => html`<li class="card"><label class="ground-row">
        <input type="checkbox" class="ground-cb" data-i="${i}">
        <span class="ground-n" aria-hidden="true">${x.n}</span>
        <span><b>${x.n} ${x.t}</b><span class="muted small block">${x.h}</span></span></label></li>`)}</ol>
      <p class="done-msg" id="ground-done" hidden>${icon("check")} יפה מאוד. שימו לב איך הגוף מרגיש עכשיו.</p></section>`;
  },
  onChange(t) {
    if (!t.classList.contains("ground-cb")) return;
    const all = [...document.querySelectorAll(".ground-cb")];
    document.getElementById("ground-done").hidden = !all.every(c => c.checked);
  },
};

/* ---------- HALT ---------- */

export const halt = {
  title: "HALT",
  back: "tools",
  render() {
    return html`<section>${pageHead("HALT – מה באמת חסר לי?", "הרבה פעמים הדחף לשתות הוא צורך אחר בתחפושת. עברו על ארבע השאלות.")}
      <div class="halt">${HALT.map(h => html`<details class="card halt-c">
        <summary><span class="halt-k" aria-hidden="true">${h.k}</span><span><b>${h.t}</b><span class="muted small block">${h.q}</span></span></summary>
        <p>${h.a}</p></details>`)}</div></section>`;
  },
};

/* ---------- Relapse prevention plan ---------- */

const PLAN_SECTIONS = [
  ["risks", "מצבים בסיכון גבוה", "מקומות, אנשים, שעות ורגשות שמגבירים דחף", "הוספת מצב…"],
  ["signs", "סימני אזהרה מוקדמים", "מחשבות או התנהגויות שמופיעות לפני מעידה", "הוספת סימן…"],
  ["strategies", "מה אני עושה במקום", "פעולות ברורות שאפשר לעשות ברגע אמת", "הוספת פעולה…"],
  ["people", "אנשים שאפשר לפנות אליהם", "מי יודע על התהליך ויכול לעזור", "הוספת אדם…"],
  ["rewards", "תגמולים לעצמי", "איך אחגוג הצלחות", "הוספת תגמול…"],
];

export const plan = {
  title: "תוכנית מניעת מעידה",
  back: "tools",
  render(app) {
    return html`<section>${pageHead("תוכנית מניעת מעידה", "תוכנית כתובה מראש עובדת הרבה יותר טוב מהחלטה ברגע של לחץ.")}
      ${PLAN_SECTIONS.map(([k, t, d, ph]) => html`<article class="card plan-s"><h2 class="card-t">${t}</h2><p class="muted small">${d}</p>
        ${listEditor(`plan.${k}`, app.state.plan[k], ph)}</article>`)}
      <p class="muted small center">${icon("info")} כדאי לשתף את התוכנית עם אדם קרוב או עם המטפל.</p>
    </section>`;
  },
  actions: listActions,
  forms: listForms,
};

/* ---------- Reasons ---------- */

export const reasons = {
  title: "הסיבות שלי",
  back: "tools",
  render(app) {
    const mine = app.state.profile.reasons;
    const sugg = REASONS.filter(r => !mine.includes(r));
    return html`<section>${pageHead("הסיבות שלי", "ברגע של דחף קל לשכוח למה התחלנו. כאן זה כתוב.")}
      <article class="card">${listEditor("reasons", mine, "סיבה משלי…")}</article>
      ${sugg.length ? html`<h2 class="sec-t">רעיונות</h2><div class="chips">${sugg.map(r => html`<button class="chip add" data-act="chip-add" data-list="reasons" data-v="${r}">${icon("plus")}${r}</button>`)}</div>` : ""}
    </section>`;
  },
  actions: listActions,
  forms: listForms,
};

/* ---------- Thought record (CBT) ---------- */

const TRAPS = [
  ["״רק אחד לא יזיק״", "מה קרה בפעמים הקודמות שאמרתי את זה?"],
  ["״מגיע לי אחרי יום כזה״", "מה עוד יכול להרגיש כמו פרס?"],
  ["״אני לא אצליח להירגע בלי״", "מתי כן נרגעתי בלי אלכוהול?"],
  ["״כבר מעדתי, אז מה זה משנה״", "מעידה אחת לא מוחקת את ההתקדמות. מה הצעד הבא?"],
  ["״כולם שותים, אני אהיה מוזר״", "כמה אנשים באמת שמים לב מה יש בכוס שלי?"],
];

export const thoughts = {
  title: "יומן מחשבות",
  back: "tools",
  render(app) {
    const list = [...app.state.thoughts].sort((a, b) => b.at.localeCompare(a.at));
    return html`<section>${pageHead("יומן מחשבות", "מחשבות הן לא עובדות. כאן בודקים אותן לאט, כמו בטיפול CBT.")}
      <details class="card traps"><summary><b>מלכודות חשיבה נפוצות</b></summary>
        <ul>${TRAPS.map(([t, q]) => html`<li><b>${t}</b><span class="muted small block">${q}</span></li>`)}</ul></details>
      <form class="card stack" data-form="thought">
        <div class="field"><label class="lbl" for="th-sit">מה קרה? (המצב)</label><input id="th-sit" name="situation" maxlength="300" required></div>
        <div class="field"><label class="lbl" for="th-th">מה חשבתי?</label><input id="th-th" name="thought" maxlength="300" required placeholder="למשל: רק כוס אחת להירגע"></div>
        <div class="grid2">
          <div class="field"><label class="lbl" for="th-em">מה הרגשתי?</label><input id="th-em" name="emotion" maxlength="80" placeholder="לחץ, עצב…"></div>
          <div class="field"><label class="lbl" for="th-b">עוצמה (0–10)</label><input id="th-b" name="before" type="number" min="0" max="10" value="7" inputmode="numeric"></div>
        </div>
        <div class="field"><label class="lbl" for="th-f">מה תומך במחשבה?</label><textarea id="th-f" name="evidenceFor" rows="2" maxlength="300"></textarea></div>
        <div class="field"><label class="lbl" for="th-a">מה סותר אותה?</label><textarea id="th-a" name="evidenceAgainst" rows="2" maxlength="300"></textarea></div>
        <div class="field"><label class="lbl" for="th-alt">מחשבה מאוזנת יותר</label><textarea id="th-alt" name="alternative" rows="2" maxlength="300" placeholder="למשל: אני לחוץ, ואני יודע שהליכה עוזרת לי יותר"></textarea></div>
        <div class="field"><label class="lbl" for="th-af">עוצמת הרגש עכשיו (0–10)</label><input id="th-af" name="after" type="number" min="0" max="10" value="5" inputmode="numeric"></div>
        <button class="btn primary block" type="submit">שמירה</button>
      </form>
      ${list.length ? html`<h2 class="sec-t">רשומות קודמות</h2>${list.map(t => html`<article class="card th-item">
        <header class="row-between"><span class="muted small">${fmtDate(t.at, "full")}</span>
          <button class="icon-btn sm" data-act="del-thought" data-id="${t.id}" aria-label="מחיקה">${icon("trash")}</button></header>
        <p><b>${t.thought}</b></p>
        ${t.situation ? html`<p class="muted small">${t.situation}</p>` : ""}
        ${t.alternative ? html`<p class="alt">→ ${t.alternative}</p>` : ""}
        <p class="small">${t.emotion || "רגש"}: ${t.before} ← ${t.after}</p>
      </article>`)}` : ""}
    </section>`;
  },
  forms: {
    thought(d, form, app) {
      app.store.update(s => { s.thoughts.push({ id: uid(), at: new Date().toISOString(), ...d, before: Number(d.before), after: Number(d.after) }); });
      celebrate("נשמר. עצירה ובדיקה של מחשבה היא מיומנות – והיא משתפרת עם תרגול.");
      app.render();
    },
  },
  actions: {
    async "del-thought"(el, app) {
      if (!(await confirmBox({ title: "למחוק?", text: "הרשומה תימחק לצמיתות.", ok: "מחיקה", danger: true }))) return;
      app.store.update(s => { s.thoughts = s.thoughts.filter(x => x.id !== el.dataset.id); });
      app.render({ keepScroll: true });
    },
  },
};

/* ---------- Gratitude ---------- */

export const gratitude = {
  title: "הכרת תודה",
  back: "tools",
  render(app) {
    const list = [...app.state.gratitude].sort((a, b) => b.at.localeCompare(a.at));
    return html`<section>${pageHead("הכרת תודה", "שלושה דברים טובים, קטנים ככל שיהיו. תרגול קבוע משפר מצב רוח ושינה.")}
      <form class="card stack" data-form="grat">
        ${[1, 2, 3].map(i => html`<div class="field"><label class="lbl" for="gr-${i}">${i}.</label><input id="gr-${i}" name="g${i}" maxlength="300" ${i === 1 ? raw("required") : ""}></div>`)}
        <button class="btn primary block" type="submit">שמירה</button>
      </form>
      ${list.map(x => html`<article class="card grat-item"><header class="row-between"><span class="muted small">${fmtDate(x.at, "full")}</span>
        <button class="icon-btn sm" data-act="del-grat" data-id="${x.id}" aria-label="מחיקה">${icon("trash")}</button></header>
        <ul>${x.items.map(t => html`<li>${t}</li>`)}</ul></article>`)}
    </section>`;
  },
  forms: {
    grat(d, form, app) {
      const items = [d.g1, d.g2, d.g3].map(x => (x || "").trim()).filter(Boolean);
      if (!items.length) return;
      app.store.update(s => { s.gratitude.push({ id: uid(), at: new Date().toISOString(), items }); });
      celebrate("נשמר 🙏");
      app.render();
    },
  },
  actions: {
    "del-grat"(el, app) {
      app.store.update(s => { s.gratitude = s.gratitude.filter(x => x.id !== el.dataset.id); });
      app.render({ keepScroll: true });
    },
  },
};

/* ---------- Letter to self ---------- */

export const letter = {
  title: "מכתב לעצמי",
  back: "tools",
  render(app) {
    const l = app.state.letter;
    return html`<section>${pageHead("מכתב לעצמי", "כתבו עכשיו, כשהראש צלול, לעצמכם של הרגע הקשה. המכתב יופיע גם במסך הדחף.")}
      <form class="card stack" data-form="letter">
        <label class="sr" for="letter-t">המכתב</label>
        <textarea id="letter-t" name="text" rows="12" maxlength="5000" placeholder="${G(app, "אני יודע שעכשיו קשה לך…", "אני יודעת שעכשיו קשה לך…", "אני יודע/ת שעכשיו קשה לך…")}">${l.text}</textarea>
        <div class="row-between"><span class="muted small">${l.at ? `עודכן ${ago(l.at)}` : ""}</span>
        <button class="btn primary" type="submit">שמירה</button></div>
      </form>
      <details class="card"><summary><b>רעיונות למה לכתוב</b></summary><ul>
        <li>איך הרגשתי בבוקר אחרי הערב הכי גרוע</li><li>מה אני מפסיד/ה כשאני שותה</li>
        <li>מה כבר השתפר מאז שהפסקתי</li><li>מה הייתי רוצה שיגידו לי ברגע קשה</li></ul></details>
    </section>`;
  },
  forms: {
    letter(d, form, app) {
      app.store.update(s => { s.letter = { text: d.text, at: new Date().toISOString() }; });
      celebrate("המכתב נשמר");
      app.render({ keepScroll: true });
    },
  },
};

/* ---------- AUDIT self-assessment ---------- */

let auditResult = null;

export const audit = {
  title: "שאלון הערכה עצמית",
  back: "tools",
  render(app) {
    const hist = [...app.state.audits].sort((a, b) => b.at.localeCompare(a.at));
    if (auditResult) {
      const z = auditZone(auditResult.score);
      return html`<section>${pageHead("התוצאה שלך")}
        <article class="card audit-res tone-${z.tone}">
          <p class="audit-score"><b>${auditResult.score}</b><span>/40</span></p>
          <h2 class="card-t"><span class="status-dot ${z.tone}" aria-hidden="true"></span>${z.t}</h2>
          <p>${z.d}</p>
          <p class="muted small">${icon("info")} זהו כלי סינון לשימוש עצמי, לא אבחנה. כדאי לשתף את התוצאה עם רופא.</p>
        </article>
        <div class="zones">${AUDIT_ZONES.map((x, i) => html`<div class="zone ${x === z ? "on" : ""}"><span class="status-dot ${x.tone}" aria-hidden="true"></span><b>${i === 0 ? 0 : AUDIT_ZONES[i - 1].max + 1}–${x.max}</b> ${x.t}</div>`)}</div>
        ${z.tone === "critical" || z.tone === "serious" ? html`<a class="btn primary block" href="#/learn/safety">בטיחות בגמילה – חשוב לקרוא</a>` : ""}
        <button class="btn ghost block" data-act="audit-again">חזרה</button>
      </section>`;
    }
    return html`<section>${pageHead("שאלון AUDIT", "10 שאלות של ארגון הבריאות העולמי להערכת דפוסי שתייה בשנה האחרונה. כ-3 דקות. אפשר לחזור עליו כל חודש ולראות שינוי.")}
      ${hist.length ? html`<article class="card"><h2 class="card-t">תוצאות קודמות</h2><ul class="audit-hist">${hist.slice(0, 6).map(h => html`<li><span>${fmtDate(h.at, "full")}</span><span class="status-dot ${auditZone(h.score).tone}" aria-hidden="true"></span><b>${h.score}</b> <span class="muted small">${auditZone(h.score).t}</span></li>`)}</ul></article>` : ""}
      <form class="stack" data-form="audit">
        ${AUDIT.map((q, i) => html`<fieldset class="card audit-q"><legend><span class="q-n">${i + 1}</span>${q.q}</legend>
          <div class="opts">${q.o.map(([t, v]) => html`<label class="opt"><input type="radio" name="q${i}" value="${v}" required><span>${t}</span></label>`)}</div></fieldset>`)}
        <p class="muted small">״משקה״ = בירה 330 מ״ל, כוס יין 150 מ״ל, או כוסית משקה חריף 40 מ״ל.</p>
        <button class="btn primary block" type="submit">לחישוב התוצאה</button>
      </form>
    </section>`;
  },
  forms: {
    audit(d, form, app) {
      const answers = AUDIT.map((_, i) => Number(d[`q${i}`]));
      const score = auditScore(answers);
      if (score == null) return toast("נא לענות על כל השאלות");
      app.store.update(s => { s.audits.push({ id: uid(), at: new Date().toISOString(), answers, score }); });
      auditResult = { score };
      app.render();
    },
  },
  actions: { "audit-again"(el, app) { auditResult = null; app.render(); } },
  mount() { return () => { if (!location.hash.startsWith("#/tools/audit")) auditResult = null; }; },
};

/* ---------- Help & contacts ---------- */

export const help = {
  title: "עזרה ותמיכה",
  back: "tools",
  render(app) {
    const cs = app.state.contacts;
    return html`<section>${pageHead("עזרה ותמיכה", "לא חייבים לעשות את זה לבד. פנייה לעזרה היא צעד של כוח.")}
      <article class="card">
        <h2 class="card-t">${icon("heart")} האנשים שלי</h2>
        <p class="muted small">אנשים שאפשר להתקשר אליהם ברגע קשה. הראשון ברשימה יופיע במסך הדחף.</p>
        ${cs.length ? html`<ul class="contacts">${cs.map((c, i) => html`<li>
          <a class="contact" href="${telHref(c.phone)}">${icon("phone")}<span><b>${c.name || c.phone}</b>${c.name ? html`<span class="muted small block" dir="ltr">${c.phone}</span>` : ""}</span></a>
          ${i > 0 ? html`<button class="icon-btn sm" data-act="c-top" data-id="${c.id}" aria-label="העברה לראש הרשימה">${icon("star")}</button>` : ""}
          <button class="icon-btn sm" data-act="c-del" data-id="${c.id}" aria-label="הסרת ${c.name}">${icon("trash")}</button></li>`)}</ul>` : ""}
        <form class="contact-form" data-form="contact">
          <input name="name" maxlength="40" placeholder="שם" aria-label="שם" required>
          <input name="phone" type="tel" maxlength="30" placeholder="טלפון" aria-label="טלפון" dir="ltr" required inputmode="tel">
          <button class="btn sm" type="submit">${icon("plus")} הוספה</button>
        </form>
      </article>
      <h2 class="sec-t">קווי סיוע</h2>
      <ul class="resources">${RESOURCES.map(r => html`<li class="card res ${r.urgent ? "urgent" : ""}">
        <h3>${r.t}</h3><p class="muted small">${r.d}</p>
        <div class="res-act">${r.tel ? html`<a class="btn sm ${r.urgent ? "danger" : "primary"}" href="tel:${r.tel}">${icon("phone")} <span dir="ltr">${r.tel}</span></a>` : ""}
        ${r.url ? html`<a class="btn sm ghost" href="${r.url}" target="_blank" rel="noopener noreferrer">${icon("link")} לאתר</a>` : ""}</div></li>`)}</ul>
      <p class="muted small center">המספרים נבדקו בנובמבר 2026 ועשויים להשתנות. במצב חירום – 101.</p>
    </section>`;
  },
  forms: {
    contact(d, form, app) {
      const phone = d.phone.replace(/[^0-9+*#\-\s()]/g, "").trim();
      if (!phone) return toast("מספר טלפון לא תקין");
      app.store.update(s => { s.contacts.push({ id: uid(), name: d.name.trim(), phone }); });
      toast("נוסף");
      app.render({ keepScroll: true });
    },
  },
  actions: {
    async "c-del"(el, app) {
      if (!(await confirmBox({ title: "להסיר איש קשר?", text: "", ok: "הסרה", danger: true }))) return;
      app.store.update(s => { s.contacts = s.contacts.filter(c => c.id !== el.dataset.id); });
      app.render({ keepScroll: true });
    },
    "c-top"(el, app) {
      app.store.update(s => {
        const i = s.contacts.findIndex(c => c.id === el.dataset.id);
        if (i > 0) s.contacts.unshift(...s.contacts.splice(i, 1));
      });
      app.render({ keepScroll: true });
    },
  },
};

/* ---------- Article ---------- */

function block([k, v]) {
  if (k === "p") return html`<p>${v}</p>`;
  if (k === "h") return html`<h2>${v}</h2>`;
  if (k === "ul") return html`<ul>${v.map(x => html`<li>${x}</li>`)}</ul>`;
  return "";
}

export const article = {
  title: app => ARTICLES.find(a => a.id === app.params[0])?.t || "מאמר",
  back: "tools",
  render(app) {
    const a = ARTICLES.find(x => x.id === app.params[0]);
    if (!a) return html`<section>${pageHead("לא נמצא")}<a class="btn" href="#/tools">חזרה לכלים</a></section>`;
    const i = ARTICLES.indexOf(a), next = ARTICLES[(i + 1) % ARTICLES.length];
    return html`<article class="reading">
      <p class="art-big" aria-hidden="true">${a.i}</p>
      <h1>${a.t}</h1>
      ${a.body.map(block)}
      <p class="muted small">${icon("info")} המידע כללי ואינו תחליף לייעוץ רפואי.</p>
      <a class="next-art card" href="#/learn/${next.id}"><span class="muted small">המאמר הבא</span><b>${next.i} ${next.t}</b></a>
    </article>`;
  },
};

