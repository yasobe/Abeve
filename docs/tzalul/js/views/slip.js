// Slip (lapse) flow: compassionate, practical, never erases progress.
import { html, icon, toast } from "../ui.js";
import { g, duration } from "../i18n.js";
import { TRIGGERS } from "../content.js";
import { head, chips, field, seg, fdStr, localDT } from "./parts.js";
import { uid } from "../store.js";
import { streakMs, totalCleanMs } from "../calc.js";

function render(ctx) {
  const s = ctx.state;
  const cur = streakMs(s.profile), total = totalCleanMs(s);
  return html`
    ${head("מעידה", { back: true })}
    <section class="card soft">
      <p class="lead">${g("נשום", "נשמי", "לנשום")}. מעידה היא לא כישלון ולא סוף הדרך.</p>
      <p class="muted">רוב האנשים שהפסיקו בהצלחה מעדו בדרך. מה שקובע הוא הצעד הבא — לא הצעד הזה. כל ${duration(total)} הצלולים שצברת נשמרים.</p>
    </section>
    <form data-form="save" class="card form">
      ${field("מתי?", html`<input type="datetime-local" name="ts" value="${localDT(new Date())}" max="${localDT(new Date())}" required>`)}
      <div class="field"><span class="field-label">מה קרה רגע לפני?</span>${chips("trigger", TRIGGERS, [], { type: "radio" })}</div>
      ${field("מה הרגשתי / חשבתי?", html`<textarea name="note" rows="3" maxlength="2000" placeholder="המחשבה שהובילה לזה הייתה..."></textarea>`)}
      ${field("מה אעשה אחרת בפעם הבאה?", html`<textarea name="learn" rows="2" maxlength="1000" placeholder="בפעם הבאה שזה יקרה, אני..."></textarea>`)}
      <div class="field"><span class="field-label">מה לעשות עם הספירה?</span>
        ${seg("reset", [{ k: "keep", label: "להמשיך את הרצף" }, { k: "reset", label: "להתחיל ספירה חדשה" }], "reset", { label: "ספירה" })}
        <span class="hint">אם זו מעידה חד־פעמית, יש מי שמעדיפים להמשיך. ${cur > 0 ? `הרצף הנוכחי: ${duration(cur)}.` : ""} שתי הדרכים לגיטימיות.</span>
      </div>
      <button class="btn primary wide" type="submit">לשמור ולהמשיך</button>
    </form>
    <a class="card cta" href="#/learn/slip">${icon("sprout")}<span class="cta-text"><b>מעידה היא לא כישלון</b><small>3 דקות קריאה: איך לא להפוך מעידה לחזרה</small></span>${icon("fwd", 20, "chev")}</a>`;
}

export default {
  title: "מעידה",
  render,
  forms: {
    save(fd, form, ctx) {
      const ts = new Date(String(fd.get("ts")));
      if (!Number.isFinite(ts.getTime())) return toast("זמן לא תקין");
      const reset = fd.get("reset") !== "keep";
      ctx.update(s => {
        s.slips.push({ id: uid(), ts: ts.toISOString(), trigger: String(fd.get("trigger") || "") || null, note: fdStr(fd, "note"), learn: fdStr(fd, "learn"), reset });
        if (reset) {
          const start = new Date(s.profile.quitAt);
          if (ts > start) s.attempts.push({ start: start.toISOString(), end: ts.toISOString() });
          s.profile.quitAt = ts > start ? ts.toISOString() : new Date().toISOString();
          if (s.profile.mode === "taper") s.profile.mode = "quit";
        }
      }, { render: false });
      toast(reset ? "ספירה חדשה התחילה. ממשיכים." : "נשמר. ממשיכים.");
      ctx.go("home");
    },
  },
};
