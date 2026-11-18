// Daily check-in: mood, sleep, energy, craving peak, withdrawal symptoms, a win, a note.
import { html, icon, toast } from "../ui.js";
import { g, dayKey, relDay } from "../i18n.js";
import { MOODS, SLEEP, SYMPTOMS } from "../content.js";
import { head, scale, range, chips, field, fdAll, fdStr } from "./parts.js";
import { uid } from "../store.js";
import { isBeforeQuit } from "../calc.js";

const ENERGY = ["אין כוח", "נמוכה", "בינונית", "טובה", "מלאה"];

function render(ctx, [date]) {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date : dayKey();
  const c = ctx.state.checkins.find(x => x.date === key);
  const v = c || { mood: 0, sleep: 0, energy: 0, craving: 3, symptoms: [], used: false, win: "", note: "" };
  return html`
    ${head(`צ׳ק־אין · ${relDay(key)}`, { back: true, sub: "דקה אחת. אין תשובות נכונות." })}
    <form data-form="save" class="form checkin" novalidate>
      <input type="hidden" name="date" value="${key}">
      <section class="card">${scale("mood", MOODS, v.mood, { legend: "איך מצב הרוח?" })}</section>
      <section class="card">${scale("sleep", SLEEP, v.sleep, { legend: "איך הייתה השינה בלילה?" })}</section>
      <section class="card">${scale("energy", ENERGY, v.energy, { legend: "אנרגייה" })}</section>
      <section class="card">${range("craving", { min: 0, max: 10, value: v.craving, label: "החשק הכי חזק היום", unit: "מתוך 10" })}</section>
      <section class="card">
        <div class="field"><span class="field-label">תסמינים היום</span>${chips("symptoms", SYMPTOMS, v.symptoms)}</div>
        <p class="hint">${icon("info", 14)} אחרי השמירה יופיעו טיפים לתסמינים שסימנת.</p>
      </section>
      <section class="card">
        ${field(`הצלחה קטנה של היום`, html`<input name="win" maxlength="200" value="${v.win}" placeholder="${g("הלכתי", "הלכתי", "הלכתי")} לישון בלי... / יצאתי לריצה / אמרתי לא">`)}
        ${field("משהו נוסף?", html`<textarea name="note" rows="3" maxlength="2000">${v.note}</textarea>`)}
        ${!isBeforeQuit(ctx.state.profile) ? html`<label class="switch"><input type="checkbox" name="used" ${v.used ? "checked" : ""}><span>השתמשתי היום</span></label>` : ""}
      </section>
      <button class="btn primary wide sticky-btn" type="submit">שמירה</button>
    </form>`;
}

function tipsSheet(ctx, symptoms) {
  const list = SYMPTOMS.filter(s => symptoms.includes(s.k));
  return ctx.sheet(html`
    <h2 class="sheet-title">כמה דברים שעוזרים</h2>
    <ul class="tips">${list.map(s => html`<li><b>${s.label}</b><p>${s.tip}</p></li>`)}</ul>
    <p class="small muted">${icon("info", 14)} תסמינים חריגים, חזקים או מתמשכים — כדאי לבדוק עם רופא/ה.</p>
    <button class="btn primary wide" data-act="close">הבנתי</button>`, { label: "טיפים" });
}

export default {
  title: "צ׳ק־אין",
  render,
  forms: {
    async save(fd, form, ctx) {
      const date = String(fd.get("date"));
      const mood = Number(fd.get("mood")), sleep = Number(fd.get("sleep")), energy = Number(fd.get("energy"));
      if (!mood || !sleep) {
        toast("צריך לבחור מצב רוח ושינה");
        form.querySelector(!mood ? '[name="mood"]' : '[name="sleep"]')?.closest(".card")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const used = fd.get("used") === "on";
      const symptoms = fdAll(fd, "symptoms");
      let wasUsed = false;
      ctx.update(s => {
        const prev = s.checkins.find(c => c.date === date);
        wasUsed = !!prev?.used;
        const rec = { id: prev?.id || uid(), date, ts: new Date().toISOString(), mood, sleep, energy: energy || 3, craving: Number(fd.get("craving")) || 0, symptoms, used, win: fdStr(fd, "win"), note: fdStr(fd, "note") };
        s.checkins = s.checkins.filter(c => c.date !== date).concat(rec).sort((a, b) => a.date.localeCompare(b.date));
      }, { render: false });
      toast("הצ׳ק־אין נשמר");
      if (used && !wasUsed && date === dayKey()) return ctx.go("slip");
      if (symptoms.length) await tipsSheet(ctx, symptoms);
      ctx.go("home");
    },
  },
};
