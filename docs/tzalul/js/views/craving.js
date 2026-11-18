// Log (or edit) a craving: when, how strong, trigger, what helped, outcome.
import { html, icon, toast, confirmDialog } from "../ui.js";
import { TRIGGERS, COPING } from "../content.js";
import { head, chips, seg, range, field, fdAll, fdStr, localDT } from "./parts.js";
import { uid } from "../store.js";

function find(ctx, params) {
  return params[0] === "edit" ? ctx.state.cravings.find(c => c.id === params[1]) : null;
}

function render(ctx, params) {
  const c = find(ctx, params);
  const v = c || { ts: new Date().toISOString(), intensity: 6, trigger: null, coping: [], outcome: "resisted", note: "" };
  return html`
    ${head(c ? "עריכת חשק" : "לתעד חשק", { back: true, sub: "כל תיעוד עוזר לזהות דפוסים — מתי, איפה ולמה." })}
    <form data-form="save" class="card form">
      ${field("מתי", html`<input type="datetime-local" name="ts" value="${localDT(v.ts)}" max="${localDT(new Date())}" required>`)}
      ${range("intensity", { min: 1, max: 10, value: v.intensity, label: "עוצמה", unit: "מתוך 10" })}
      <div class="field"><span class="field-label">מה הוביל לזה?</span>${chips("trigger", TRIGGERS, v.trigger ? [v.trigger] : [], { type: "radio" })}</div>
      <div class="field"><span class="field-label">מה עשית כדי להתמודד?</span>${chips("coping", COPING, v.coping)}</div>
      <div class="field"><span class="field-label">איך זה נגמר?</span>
        ${seg("outcome", [{ k: "resisted", label: "עברתי את זה" }, { k: "used", label: "השתמשתי" }], v.outcome, { label: "תוצאה" })}</div>
      ${field("הערה", html`<textarea name="note" rows="3" maxlength="1000" placeholder="איפה הייתי, עם מי, מה הרגשתי...">${v.note}</textarea>`)}
      <button class="btn primary wide" type="submit">שמירה</button>
      ${c ? html`<button class="btn danger-ghost wide" type="button" data-act="del">${icon("trash", 18)} מחיקה</button>` : ""}
    </form>`;
}

export default {
  title: "תיעוד חשק",
  render,
  forms: {
    save(fd, form, ctx, params) {
      const existing = find(ctx, params);
      const ts = new Date(String(fd.get("ts")));
      if (!Number.isFinite(ts.getTime())) return toast("זמן לא תקין");
      const rec = {
        id: existing?.id || uid(), ts: ts.toISOString(), intensity: Number(fd.get("intensity")) || 5,
        trigger: String(fd.get("trigger") || "") || null, coping: fdAll(fd, "coping"),
        outcome: fd.get("outcome") === "used" ? "used" : "resisted", note: fdStr(fd, "note"),
      };
      ctx.update(s => {
        const i = s.cravings.findIndex(c => c.id === rec.id);
        if (i >= 0) s.cravings[i] = rec; else s.cravings.push(rec);
        s.cravings.sort((a, b) => a.ts.localeCompare(b.ts));
      }, { render: false });
      if (rec.outcome === "used" && !existing) {
        toast("נשמר. בואו נעבור על זה יחד, בלי שיפוטיות.");
        return ctx.go("slip");
      }
      toast(rec.outcome === "resisted" ? "נשמר. עוד גל שעבר." : "נשמר");
      ctx.go("journal/cravings");
    },
  },
  actions: {
    async del(el, ctx, e, params) {
      if (!(await confirmDialog("למחוק את התיעוד?", "", { ok: "מחיקה", danger: true }))) return;
      ctx.update(s => { s.cravings = s.cravings.filter(c => c.id !== params[1]); }, { render: false });
      ctx.go("journal/cravings");
    },
  },
};
