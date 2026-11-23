// First-run setup: goal, start time, habits, a withdrawal safety screen, reasons, profile.

import { html, raw, toLocalInput, fmtMoney, fmtNum, uid } from "../util.js";
import { icon, chips, toast } from "../ui.js";
import { REASONS } from "../content.js";
import { withdrawalRisk, baselinePerDay } from "../calc.js";

let step = 0;
let draft = null;
const STEPS = 6;

function fresh() {
  return {
    goal: "quit", startMode: "now", startAt: toLocalInput(new Date()),
    daysPerWeek: 4, drinksPerDay: 4, costPerDrink: 30,
    symptoms: false, morning: false, reasons: [], custom: "",
    name: "", gender: "m", cName: "", cPhone: "",
  };
}

const dots = () => html`<div class="ob-dots" aria-hidden="true">${Array.from({ length: STEPS }, (_, i) => html`<i class="${i <= step ? "on" : ""}"></i>`)}</div>`;
const nav = (next = "המשך", { skip = false } = {}) => html`<div class="ob-nav">
  <button class="btn primary lg block" type="submit">${next}</button>
  ${step > 0 ? html`<button class="btn ghost" type="button" data-act="ob-back">חזרה</button>` : ""}
  ${skip ? html`<button class="btn ghost" type="submit" name="skip" value="1">דילוג</button>` : ""}
</div>`;
const ck = v => (v ? raw("checked") : "");

function body() {
  const d = draft;
  switch (step) {
    case 0: return html`
      <div class="ob-hero"><div class="ob-logo" aria-hidden="true"><img src="icons/icon.svg" alt="" width="88" height="88"></div>
        <h1>ברוכים הבאים לצלול</h1>
        <p class="lead">מלווה אישי להפסקה או להפחתה של שתיית אלכוהול – יום אחרי יום.</p></div>
      <ul class="ob-points">
        <li>${icon("lock")}<span><b>פרטי לגמרי.</b> הכל נשמר רק במכשיר שלך. אין הרשמה, אין שרת, אין מעקב.</span></li>
        <li>${icon("wave")}<span><b>עזרה ברגע של דחף.</b> טיימר גלישה, נשימה, והסיבות שלך – בלחיצה אחת.</span></li>
        <li>${icon("chart")}<span><b>רואים התקדמות.</b> ימים, כסף, בריאות, ותובנות על מה שעוזר לך.</span></li>
      </ul>
      ${nav("בואו נתחיל")}
      <p class="muted small center">צלול הוא כלי עזר ואינו תחליף לטיפול רפואי או נפשי.</p>`;
    case 1: return html`
      <h1>מה המטרה?</h1>
      <div class="ob-choices">
        <label class="choice"><input type="radio" name="goal" value="quit" ${ck(d.goal === "quit")}><span><b>הפסקה מלאה</b><small>חיים בלי אלכוהול – לתקופה או לתמיד</small></span></label>
        <label class="choice"><input type="radio" name="goal" value="reduce" ${ck(d.goal === "reduce")}><span><b>הפחתה</b><small>לשתות פחות ובשליטה. האפליקציה תספור ימים ללא אלכוהול ותעקוב אחרי הכמות</small></span></label>
      </div>
      <h2 class="ob-sub">ממתי סופרים?</h2>
      <div class="seg">
        <label><input type="radio" name="startMode" value="now" ${ck(d.startMode === "now")}><span>מעכשיו</span></label>
        <label><input type="radio" name="startMode" value="past" ${ck(d.startMode === "past")}><span>כבר התחלתי</span></label>
      </div>
      <div class="field" data-when="past" ${d.startMode === "past" ? "" : raw("hidden")}>
        <label class="lbl" for="ob-start">מתי היה המשקה האחרון?</label>
        <input id="ob-start" type="datetime-local" name="startAt" value="${d.startAt}" max="${toLocalInput(new Date())}">
      </div>
      ${nav()}`;
    case 2: return html`
      <h1>איך נראתה השתייה עד עכשיו?</h1>
      <p class="muted">ככה נחשב כמה כסף וקלוריות חסכת. הערכה גסה מספיקה.</p>
      <div class="field"><label class="lbl" for="ob-days">כמה ימים בשבוע שתית? <output id="o-days" class="range-out">${d.daysPerWeek}</output></label>
        <input id="ob-days" type="range" name="daysPerWeek" min="0" max="7" value="${d.daysPerWeek}" data-out="o-days"></div>
      <div class="field"><label class="lbl" for="ob-dpd">כמה משקאות ביום כזה? <output id="o-dpd" class="range-out">${d.drinksPerDay}</output></label>
        <input id="ob-dpd" type="range" name="drinksPerDay" min="1" max="20" value="${d.drinksPerDay}" data-out="o-dpd">
        <p class="hint">משקה = בירה 330 מ״ל, כוס יין 150 מ״ל, או צ׳ייסר 40 מ״ל.</p></div>
      <div class="field"><label class="lbl" for="ob-cost">מחיר ממוצע למשקה (₪)</label>
        <input id="ob-cost" type="number" name="costPerDrink" min="0" max="1000" step="1" inputmode="numeric" value="${d.costPerDrink}"></div>
      <p class="ob-calc" id="ob-calc"></p>
      ${nav()}`;
    case 3: return html`
      <h1>רגע של בטיחות</h1>
      <p class="muted">הפסקה פתאומית אחרי שתייה כבדה עלולה לגרום לתסמיני גמילה, ולפעמים הם מסוכנים. שתי שאלות קצרות:</p>
      <label class="check-row"><input type="checkbox" name="symptoms" ${ck(d.symptoms)}><span>כשהפסקתי לשתות בעבר, היו לי רעד, הזעה, חרדה חזקה או בחילה</span></label>
      <label class="check-row"><input type="checkbox" name="morning" ${ck(d.morning)}><span>קורה שאני שותה בבוקר כדי להרגיש בסדר</span></label>
      <div class="safety-warn" id="ob-warn" hidden>
        <h2>${icon("shield")} כדאי לדבר עם רופא לפני שמפסיקים</h2>
        <p>לפי התשובות, הפסקה בבת אחת עלולה להיות לא בטוחה. רופא המשפחה יכול לעזור לעבור גמילה בבטחה, לפעמים עם תרופות. זה לא אומר לוותר – זה אומר לעשות את זה נכון.</p>
        <p><b>פנו מיד למד״א 101</b> אם מופיעים פרכוסים, הזיות, בלבול קשה או חום גבוה.</p>
      </div>
      ${nav("הבנתי, המשך")}`;
    case 4: return html`
      <h1>למה זה חשוב לך?</h1>
      <p class="muted">הסיבות יופיעו כשיהיה קשה. אפשר לבחור כמה שרוצים.</p>
      ${chips("reasons", REASONS, d.reasons)}
      <div class="field"><label class="lbl" for="ob-custom">סיבה משלי</label><input id="ob-custom" name="custom" maxlength="80" value="${d.custom}"></div>
      ${nav("המשך", { skip: true })}`;
    case 5: return html`
      <h1>עוד קצת עליך</h1>
      <div class="field"><label class="lbl" for="ob-name">איך לקרוא לך? (לא חובה)</label><input id="ob-name" name="name" maxlength="40" value="${d.name}" autocomplete="nickname"></div>
      <fieldset class="field"><legend class="lbl">איך לפנות אליך?</legend>
        <div class="seg">
          <label><input type="radio" name="gender" value="m" ${ck(d.gender === "m")}><span>בלשון זכר</span></label>
          <label><input type="radio" name="gender" value="f" ${ck(d.gender === "f")}><span>בלשון נקבה</span></label>
          <label><input type="radio" name="gender" value="n" ${ck(d.gender === "n")}><span>בלשון רבים</span></label>
        </div></fieldset>
      <h2 class="ob-sub">אדם תומך (לא חובה)</h2>
      <p class="muted small">מישהו שאפשר להתקשר אליו ברגע קשה. יופיע בכפתור במסך הדחף.</p>
      <div class="grid2">
        <div class="field"><label class="lbl" for="ob-cn">שם</label><input id="ob-cn" name="cName" maxlength="40" value="${d.cName}"></div>
        <div class="field"><label class="lbl" for="ob-cp">טלפון</label><input id="ob-cp" name="cPhone" type="tel" maxlength="30" dir="ltr" inputmode="tel" value="${d.cPhone}"></div>
      </div>
      ${nav("סיום – מתחילים")}`;
  }
  return "";
}

function updateCalc(form) {
  const out = form.querySelector("#ob-calc");
  if (out) {
    const f = new FormData(form);
    const b = baselinePerDay({ daysPerWeek: +f.get("daysPerWeek"), drinksPerDay: +f.get("drinksPerDay") });
    const month = b * 30.44;
    out.innerHTML = html`בערך <b>${fmtNum(month)}</b> משקאות ו-<b>${fmtMoney(month * (+f.get("costPerDrink") || 0))}</b> בחודש.`.toString();
  }
  const warn = form.querySelector("#ob-warn");
  if (warn) {
    const f = new FormData(form);
    warn.hidden = !withdrawalRisk(draft, { symptoms: f.get("symptoms") === "on", morning: f.get("morning") === "on" });
  }
}

export default {
  title: "ברוכים הבאים",
  render() {
    if (!draft) draft = fresh();
    return html`<section class="onboard"><form class="ob-card" data-form="ob" novalidate>${dots()}${body()}</form></section>`;
  },
  mount(root) {
    const form = root.querySelector("form");
    updateCalc(form);
    form.querySelector("h1")?.focus?.();
  },
  onInput(t) { const f = t.closest("form"); if (f) updateCalc(f); },
  onChange(t) {
    const f = t.closest("form");
    if (t.name === "startMode") f.querySelector('[data-when="past"]').hidden = t.value !== "past";
    if (f) updateCalc(f);
  },
  actions: {
    "ob-back"(el, app) { step = Math.max(0, step - 1); app.render(); },
  },
  forms: {
    ob(d, form, app, submitter) {
      const skip = submitter?.name === "skip";
      switch (step) {
        case 1: {
          draft.goal = d.goal || "quit";
          draft.startMode = d.startMode;
          if (d.startMode === "past") {
            const t = new Date(d.startAt);
            if (isNaN(t) || t > new Date()) return toast("נא לבחור זמן בעבר");
            draft.startAt = d.startAt;
          }
          break;
        }
        case 2:
          draft.daysPerWeek = Number(d.daysPerWeek);
          draft.drinksPerDay = Number(d.drinksPerDay);
          draft.costPerDrink = Math.max(0, Number(d.costPerDrink) || 0);
          break;
        case 3:
          draft.symptoms = !!d.symptoms; draft.morning = !!d.morning;
          break;
        case 4:
          if (!skip) { draft.reasons = d.reasons || []; draft.custom = d.custom.trim(); }
          break;
        case 5:
          Object.assign(draft, { name: d.name.trim(), gender: d.gender || "m", cName: d.cName.trim(), cPhone: d.cPhone.trim() });
          finish(app);
          return;
      }
      step = Math.min(STEPS - 1, step + 1);
      app.render();
    },
  },
};

function finish(app) {
  const d = draft;
  const startAt = d.startMode === "past" ? new Date(d.startAt) : new Date();
  const reasons = [...d.reasons];
  if (d.custom) reasons.unshift(d.custom);
  app.store.update(s => {
    Object.assign(s.profile, {
      name: d.name, gender: d.gender, goal: d.goal, startAt: startAt.toISOString(),
      daysPerWeek: d.daysPerWeek, drinksPerDay: d.drinksPerDay, costPerDrink: d.costPerDrink, reasons,
    });
    if (d.cPhone) s.contacts = [{ id: uid(), name: d.cName, phone: d.cPhone }];
    s.settings.onboarded = true;
    s.settings.safetyAck = true;
  }, { immediate: true });
  const risky = withdrawalRisk(d, d);
  draft = null;
  step = 0;
  location.hash = risky ? "#/learn/safety" : "#/today";
  app.render();
}
