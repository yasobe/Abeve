// First-run flow: welcome → addressing → plan → usage → reasons → ready.
import { html, icon, toast } from "../ui.js";
import { g, gx, setGender, money, dateLong, dayKey } from "../i18n.js";
import { METHODS, REASONS } from "../content.js";
import { chips, seg, field, fdAll, fdNum, fdStr, localDT } from "./parts.js";

const STEPS = 6;
let step = 0;
let draft = null;

function ensureDraft(ctx) {
  if (!draft) {
    const p = ctx.state.profile;
    draft = { name: p.name, gender: p.gender, start: "now", quitAt: null, taperEnd: null, baseline: { ...p.baseline }, reasons: [...p.reasons], why: p.why };
  }
}

function dots() {
  return html`<div class="ob-dots" aria-hidden="true">${Array.from({ length: STEPS }, (_, i) => html`<span class="${i === step ? "on" : i < step ? "done" : ""}"></span>`)}</div>`;
}
function nav(next = "המשך", { skip } = {}) {
  return html`<div class="ob-nav">
    <button class="btn primary wide" type="submit">${next}</button>
    ${step > 0 ? html`<button class="btn ghost" type="button" data-act="prev">חזרה</button>` : ""}
    ${skip ? html`<button class="btn link" type="button" data-act="skip">${skip}</button>` : ""}
  </div>`;
}

const PLAN_OPTS = [
  { k: "now", label: "להפסיק עכשיו", desc: "הספירה מתחילה מהרגע הזה", ic: "bolt" },
  { k: "past", label: "כבר הפסקתי", desc: "לבחור מתי היה השימוש האחרון", ic: "check" },
  { k: "date", label: "לקבוע יום הפסקה", desc: "זמן להתכונן — עם רשימת הכנה", ic: "calendar" },
  { k: "taper", label: "הפחתה הדרגתית", desc: "תוכנית ירידה יומית עד יום ההפסקה", ic: "chart" },
];

function render(ctx) {
  ensureDraft(ctx);
  setGender(draft.gender);
  const d = draft, b = d.baseline;
  const inDays = n => { const x = new Date(); x.setDate(x.getDate() + n); x.setHours(9, 0, 0, 0); return x; };
  let body;
  if (step === 0) body = html`
    <div class="ob-hero">
      <div class="ob-logo" aria-hidden="true"><span class="brand-mark big"></span></div>
      <h1>צלול</h1>
      <p class="lead">ליווי אישי להפסקת שימוש בקנאביס — יום אחרי יום.</p>
    </div>
    <ul class="ob-points">
      <li>${icon("lifebuoy")}<span><b>עזרה ברגע של חשק</b> — נשימות, גלישה על הדחף, קרקוע</span></li>
      <li>${icon("chart")}<span><b>מעקב אמיתי</b> — רצף, חיסכון, מצב רוח, שינה וטריגרים</span></li>
      <li>${icon("sprout")}<span><b>בלי שיפוטיות</b> — מעידה היא חלק מהדרך, לא סוף שלה</span></li>
      <li>${icon("lock")}<span><b>פרטי לגמרי</b> — הכל נשמר רק במכשיר הזה. בלי חשבון, בלי שרת.</span></li>
    </ul>
    ${nav("בואו נתחיל")}`;
  else if (step === 1) body = html`
    <h1>איך לפנות אליך?</h1>
    <p class="muted">בעברית זה משנה. אפשר לשנות בכל רגע בהגדרות.</p>
    ${field("שם (לא חובה)", html`<input name="name" maxlength="40" autocomplete="given-name" value="${d.name}" placeholder="איך קוראים לך?">`)}
    <div class="field"><span class="field-label">לשון פנייה</span>
      ${seg("gender", [{ k: "m", label: "זכר" }, { k: "f", label: "נקבה" }, { k: "n", label: "ניטרלי" }], d.gender, { label: "לשון פנייה" })}
      <span class="hint" id="g-sample">${g("אתה מוכן להתחיל?", "את מוכנה להתחיל?", "מוכנים להתחיל?")}</span>
    </div>
    ${nav()}`;
  else if (step === 2) body = html`
    <h1>מה התוכנית?</h1>
    <p class="muted">${g("בחר", "בחרי", "בחרו")} את הדרך שמתאימה לך. אין דרך אחת נכונה.</p>
    <div class="opt-cards" role="radiogroup">
      ${PLAN_OPTS.map(o => html`<label class="opt-card"><input type="radio" name="start" value="${o.k}" ${d.start === o.k ? "checked" : ""} required>
        <span class="opt-ic">${icon(o.ic)}</span><span><b>${o.label}</b><small>${o.desc}</small></span></label>`)}
    </div>
    <div class="ob-when" data-when="past" ${d.start !== "past" ? "hidden" : ""}>
      ${field("מתי היה השימוש האחרון?", html`<input type="datetime-local" name="pastAt" max="${localDT(new Date())}" value="${localDT(d.quitAt && d.start === "past" ? d.quitAt : inDays(-1))}">`)}
    </div>
    <div class="ob-when" data-when="date" ${d.start !== "date" ? "hidden" : ""}>
      ${field("יום ההפסקה", html`<input type="date" name="dateAt" min="${dayKey(inDays(1))}" value="${dayKey(d.start === "date" && d.quitAt ? d.quitAt : inDays(3))}">`, "מומלץ תוך שבוע או שבועיים — מספיק זמן להתכונן, לא מספיק לדחות.")}
    </div>
    <div class="ob-when" data-when="taper" ${d.start !== "taper" ? "hidden" : ""}>
      ${field("עד מתי להגיע לאפס?", html`<input type="date" name="taperAt" min="${dayKey(inDays(3))}" value="${dayKey(d.taperEnd || inDays(14))}">`, "הפחתה של 2–4 שבועות מתאימה לרוב האנשים.")}
    </div>
    ${nav()}`;
  else if (step === 3) body = html`
    <h1>מה היה השימוש עד עכשיו?</h1>
    <p class="muted">הערכה גסה מספיקה. זה רק כדי לחשב חיסכון ולבנות תוכנית.</p>
    <div class="grid2">
      ${field("פעמים ביום", html`<input type="number" name="sessionsPerDay" inputmode="decimal" min="0" max="50" step="0.5" value="${b.sessionsPerDay}" required>`)}
      ${field("גרם ביום", html`<input type="number" name="gramsPerDay" inputmode="decimal" min="0" max="50" step="0.1" value="${b.gramsPerDay}">`)}
      ${field("הוצאה בשבוע (₪)", html`<input type="number" name="costPerWeek" inputmode="numeric" min="0" max="100000" step="10" value="${b.costPerWeek}">`)}
      ${field("כמה שנים", html`<input type="number" name="years" inputmode="decimal" min="0" max="80" step="0.5" value="${b.years}">`)}
    </div>
    <div class="field"><span class="field-label">איך בעיקר?</span>${chips("methods", METHODS, b.methods)}</div>
    ${nav()}`;
  else if (step === 4) body = html`
    <h1>למה ${g("אתה", "את", "את/ה")} עושה את זה?</h1>
    <p class="muted">הסיבות שלך יופיעו ברגעים הקשים. ${g("בחר", "בחרי", "בחרו")} כמה ש${g("תרצה", "תרצי", "רוצים")}.</p>
    ${chips("reasons", REASONS.map(r => ({ k: gx(r), label: r })), d.reasons)}
    ${field("סיבה משלך", html`<input name="custom" maxlength="120" placeholder="למשל: להיות אבא נוכח בערבים">`)}
    ${field("משפט אחד לעצמך לרגעים קשים (לא חובה)", html`<textarea name="why" rows="3" maxlength="600" placeholder="כשיהיה קשה, אני רוצה לזכור ש...">${d.why}</textarea>`)}
    ${nav()}`;
  else body = summary(ctx);
  return html`<div class="ob">${dots()}<form data-form="step" class="ob-step" novalidate>${body}</form></div>`;
}

function summary() {
  const d = draft, b = d.baseline;
  const when = d.start === "now" ? "מעכשיו" : d.start === "past" ? `מאז ${dateLong(d.quitAt)}` : d.start === "date" ? `ב־${dateLong(d.quitAt)}` : `הפחתה הדרגתית עד ${dateLong(d.quitAt)}`;
  const month = (b.costPerWeek / 7) * 30;
  return html`
    <div class="ob-hero">
      <div class="burst" aria-hidden="true">${icon("sprout", 40)}</div>
      <h1>${d.name ? `${d.name}, ` : ""}${g("אתה מוכן", "את מוכנה", "הכל מוכן")}.</h1>
    </div>
    <div class="card soft">
      <dl class="kv">
        <div><dt>התוכנית</dt><dd>${when}</dd></div>
        ${month > 0 ? html`<div><dt>חיסכון צפוי בחודש</dt><dd class="num">${money(month)}</dd></div>` : ""}
        <div><dt>סיבות</dt><dd>${d.reasons.length || "—"}</dd></div>
      </dl>
    </div>
    <p class="muted small">${icon("lock", 16)} כל המידע נשמר רק במכשיר שלך. אפשר להגן עליו בקוד דרך ההגדרות, ולגבות לקובץ.</p>
    <p class="muted small">${icon("info", 16)} האפליקציה אינה תחליף לייעוץ או טיפול רפואי. במצב חירום: ער״ן 1201, מד״א 101.</p>
    ${nav("יוצאים לדרך")}`;
}

function read(fd, form) {
  const d = draft;
  if (step === 1) {
    d.name = fdStr(fd, "name").slice(0, 40);
    d.gender = String(fd.get("gender") || "n");
  } else if (step === 2) {
    d.start = String(fd.get("start") || "now");
    const now = new Date();
    if (d.start === "now") d.quitAt = now.toISOString();
    if (d.start === "past") {
      const v = new Date(String(fd.get("pastAt")));
      if (!Number.isFinite(v.getTime()) || v > now) { toast("צריך לבחור זמן בעבר"); return false; }
      d.quitAt = v.toISOString();
    }
    if (d.start === "date" || d.start === "taper") {
      const raw = String(fd.get(d.start === "date" ? "dateAt" : "taperAt"));
      const v = new Date(`${raw}T00:00`);
      if (!Number.isFinite(v.getTime()) || v <= now) { toast("צריך לבחור תאריך עתידי"); return false; }
      d.quitAt = v.toISOString();
      if (d.start === "taper") d.taperEnd = v.toISOString();
    }
  } else if (step === 3) {
    Object.assign(d.baseline, {
      sessionsPerDay: Math.min(50, Math.max(0, fdNum(fd, "sessionsPerDay", 1))),
      gramsPerDay: Math.min(50, Math.max(0, fdNum(fd, "gramsPerDay", 0))),
      costPerWeek: Math.min(100000, Math.max(0, fdNum(fd, "costPerWeek", 0))),
      years: Math.min(80, Math.max(0, fdNum(fd, "years", 0))),
      methods: fdAll(fd, "methods"),
    });
  } else if (step === 4) {
    const r = fdAll(fd, "reasons");
    const c = fdStr(fd, "custom");
    if (c) r.push(c);
    d.reasons = [...new Set(r)].slice(0, 20);
    d.why = fdStr(fd, "why").slice(0, 600);
  }
  return true;
}

function finish(ctx) {
  const d = draft;
  ctx.update(s => {
    const p = s.profile, now = new Date().toISOString();
    p.name = d.name; p.gender = d.gender;
    p.mode = d.start === "taper" ? "taper" : "quit";
    p.quitAt = d.quitAt || now;
    p.createdAt = now;
    p.taperStart = d.start === "taper" ? now : null;
    p.baseline = { ...p.baseline, ...d.baseline };
    p.reasons = d.reasons; p.why = d.why;
  }, { render: false });
  draft = null; step = 0;
  ctx.onboardDone();
}

export default {
  title: "ברוכים הבאים",
  render,
  mount(root) {
    const f = root.querySelector("form");
    // show the date field matching the chosen plan
    f?.addEventListener("change", e => {
      if (e.target.name === "start") root.querySelectorAll(".ob-when").forEach(el => { el.hidden = el.dataset.when !== e.target.value; });
      if (e.target.name === "gender") {
        setGender(e.target.value);
        const s = root.querySelector("#g-sample");
        if (s) s.textContent = g("אתה מוכן להתחיל?", "את מוכנה להתחיל?", "מוכנים להתחיל?");
      }
    });
  },
  forms: {
    step(fd, form, ctx) {
      if (step === 2 && !fd.get("start")) { toast("צריך לבחור תוכנית"); return; }
      if (!read(fd, form)) return;
      if (step >= STEPS - 1) return finish(ctx);
      step++;
      ctx.rerender();
      window.scrollTo(0, 0);
      document.querySelector("#main h1")?.focus?.();
    },
  },
  actions: {
    prev(el, ctx) { step = Math.max(0, step - 1); ctx.rerender(); },
  },
};
