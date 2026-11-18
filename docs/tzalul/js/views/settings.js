// Settings: profile, quit date, baseline, appearance, reminder, lock code, backup, delete.
import { html, icon, toast, confirmDialog, sheet, download } from "../ui.js";
import * as store from "../store.js";
import { head, seg, field, fdNum, fdStr, localDT } from "./parts.js";
import { dayKey } from "../i18n.js";

function render(ctx) {
  const s = ctx.state, p = s.profile, b = p.baseline, st = s.settings;
  const locked = store.isEncrypted();
  return html`
    ${head("הגדרות", { back: "more" })}

    <form data-form="profile" class="card form">
      <h2>פרופיל</h2>
      ${field("שם", html`<input name="name" maxlength="40" value="${p.name}" autocomplete="off">`)}
      <div class="field"><span class="field-label">לשון פנייה</span>${seg("gender", [{ k: "m", label: "זכר" }, { k: "f", label: "נקבה" }, { k: "n", label: "ניטרלי" }], p.gender)}</div>
      <div class="field"><span class="field-label">מטבע</span>${seg("currency", ["₪", "$", "€", "£"].map(c => ({ k: c, label: c })), p.currency)}</div>
      <button class="btn primary" type="submit">שמירה</button>
    </form>

    <form data-form="quit" class="card form">
      <h2>יום ההפסקה</h2>
      ${field(p.mode === "taper" ? "יעד הגעה לאפס" : "תחילת הרצף הנוכחי", html`<input type="datetime-local" name="quitAt" value="${localDT(p.quitAt)}" required>`, "שינוי כאן מעדכן את הספירה. כדי לתעד מעידה עדיף להשתמש ב\"השתמשתי — מה עכשיו?\" במסך הבית.")}
      <div class="field"><span class="field-label">שיטה</span>${seg("mode", [{ k: "quit", label: "הפסקה" }, { k: "taper", label: "הפחתה הדרגתית" }], p.mode)}</div>
      <button class="btn primary" type="submit">עדכון</button>
    </form>

    <form data-form="baseline" class="card form">
      <h2>השימוש לפני ההפסקה</h2>
      <p class="small muted">משמש לחישוב החיסכון ולתוכנית ההפחתה.</p>
      <div class="grid2">
        ${field("פעמים ביום", html`<input type="number" name="sessionsPerDay" min="0" max="50" step="0.5" inputmode="decimal" value="${b.sessionsPerDay}">`)}
        ${field("גרם ביום", html`<input type="number" name="gramsPerDay" min="0" max="50" step="0.1" inputmode="decimal" value="${b.gramsPerDay}">`)}
        ${field(`הוצאה בשבוע (${p.currency})`, html`<input type="number" name="costPerWeek" min="0" max="100000" step="10" inputmode="numeric" value="${b.costPerWeek}">`)}
        ${field("דקות לכל פעם", html`<input type="number" name="minutesPerSession" min="1" max="240" step="1" inputmode="numeric" value="${b.minutesPerSession}">`)}
      </div>
      <button class="btn primary" type="submit">שמירה</button>
    </form>

    <section class="card form">
      <h2>תצוגה</h2>
      <div class="field"><span class="field-label">ערכת צבעים</span>${seg("theme", [{ k: "auto", label: "אוטומטי" }, { k: "light", label: "בהיר" }, { k: "dark", label: "כהה" }], st.theme)}</div>
      <label class="switch"><input type="checkbox" name="showMoney" ${st.showMoney ? "checked" : ""}><span>להציג חיסכון כספי</span></label>
      <label class="switch"><input type="checkbox" name="haptics" ${st.haptics ? "checked" : ""}><span>רטט קל בלחיצות ובתרגילים</span></label>
    </section>

    <section class="card form">
      <h2>תזכורת יומית</h2>
      ${field("שעת הצ׳ק־אין", html`<input type="time" name="checkinTime" value="${st.checkinTime}">`, "מהשעה הזו כרטיס הצ׳ק־אין במסך הבית יודגש.")}
      <button class="btn ghost" data-act="ics">${icon("calendar", 18)} להוסיף תזכורת יומית ליומן של הטלפון</button>
      <p class="hint">יוצר אירוע חוזר עם כותרת דיסקרטית ("רגע לעצמי"). עובד באייפון, באנדרואיד ובמחשב.</p>
    </section>

    <section class="card form">
      <h2>${icon("lock", 18)} פרטיות ונעילה</h2>
      ${locked ? html`
        <p class="small">${icon("check", 14)} המידע מוצפן במכשיר (AES-256) ונפתח רק עם הקוד שלך.</p>
        <div class="field"><span class="field-label">נעילה אוטומטית ברקע אחרי</span>${seg("autoLockMin", [{ k: 0, label: "מיד" }, { k: 1, label: "דקה" }, { k: 5, label: "5 דק׳" }, { k: 15, label: "15 דק׳" }, { k: 60, label: "שעה" }], st.autoLockMin)}</div>
        <div class="row-btns"><button class="btn ghost" data-act="changeCode">החלפת קוד</button><button class="btn ghost" data-act="disableLock">ביטול הנעילה</button></div>`
      : html`
        <p class="small muted">אפשר להגן על האפליקציה בקוד. המידע יוצפן במכשיר, ומי שלוקח את הטלפון לא יוכל לקרוא אותו.</p>
        <button class="btn primary" data-act="enableLock">${icon("lock", 18)} הגדרת קוד נעילה</button>`}
    </section>

    <section class="card form">
      <h2>גיבוי</h2>
      <p class="small muted">המידע נשמר רק בדפדפן הזה. כדאי לגבות מדי פעם — במיוחד לפני החלפת טלפון.</p>
      <div class="row-btns">
        <button class="btn ghost" data-act="export">${icon("download", 18)} שמירת גיבוי</button>
        <button class="btn ghost" data-act="importPick">${icon("upload", 18)} שחזור מגיבוי</button>
        <input type="file" accept="application/json,.json" data-import hidden aria-hidden="true" tabindex="-1">
      </div>
      <p class="hint">קובץ הגיבוי אינו מוצפן. כדאי לשמור אותו במקום בטוח.</p>
    </section>

    <section class="card form danger-zone">
      <h2>מחיקת כל המידע</h2>
      <p class="small muted">מוחק את כל הנתונים מהמכשיר הזה. אי אפשר לשחזר בלי גיבוי.</p>
      <button class="btn danger" data-act="wipe">${icon("trash", 18)} מחיקה</button>
    </section>`;
}

function codeSheet(title) {
  return sheet(html`
    <form class="form" autocomplete="off">
      <h2 class="sheet-title">${title}</h2>
      <p class="small muted">לפחות 4 תווים. <b>אין דרך לשחזר קוד שנשכח</b> — רק למחוק הכל ולהתחיל מחדש (או לשחזר מגיבוי).</p>
      ${field("קוד", html`<input type="password" name="a" minlength="4" maxlength="64" required autocomplete="new-password" autofocus>`)}
      ${field("שוב, לאימות", html`<input type="password" name="b" minlength="4" maxlength="64" required autocomplete="new-password">`)}
      <p class="form-err" role="alert" hidden></p>
      <div class="row-btns"><button class="btn primary" type="submit">שמירה</button><button class="btn ghost" type="button" data-act="close">ביטול</button></div>
    </form>`, {
    label: title,
    onSubmit(fd, form) {
      const a = String(fd.get("a")), b = String(fd.get("b"));
      const err = form.querySelector(".form-err");
      const fail = m => { err.textContent = m; err.hidden = false; return false; };
      if (a.length < 4) return fail("הקוד קצר מדי");
      if (a !== b) return fail("הקודים לא תואמים");
      return a;
    },
  });
}

function ics(time) {
  const [h, m] = time.split(":");
  const d = dayKey().replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tzalul//HE", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:tzalul-checkin-${d}@local`, `DTSTAMP:${stamp}`, `DTSTART:${d}T${h}${m}00`, "DURATION:PT5M", "RRULE:FREQ=DAILY",
    "SUMMARY:רגע לעצמי", "DESCRIPTION:דקה אחת של צ׳ק־אין באפליקציה",
    "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:PT0M", "DESCRIPTION:רגע לעצמי", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}

export default {
  title: "הגדרות",
  render,
  forms: {
    profile(fd, f, ctx) {
      ctx.update(s => {
        s.profile.name = fdStr(fd, "name").slice(0, 40);
        s.profile.gender = ["m", "f", "n"].includes(fd.get("gender")) ? fd.get("gender") : "n";
        s.profile.currency = ["₪", "$", "€", "£"].includes(fd.get("currency")) ? fd.get("currency") : "₪";
      });
      toast("נשמר");
    },
    async quit(fd, f, ctx) {
      const d = new Date(String(fd.get("quitAt")));
      if (!Number.isFinite(d.getTime())) return toast("תאריך לא תקין");
      const mode = fd.get("mode") === "taper" ? "taper" : "quit";
      if (mode === "taper" && d <= new Date()) return toast("בהפחתה הדרגתית היעד צריך להיות בעתיד");
      if (!(await confirmDialog("לעדכן את יום ההפסקה?", "הספירה תחושב מחדש לפי התאריך החדש.", { ok: "עדכון" }))) return;
      ctx.update(s => {
        s.profile.quitAt = d.toISOString();
        if (mode === "taper" && s.profile.mode !== "taper") s.profile.taperStart = new Date().toISOString();
        s.profile.mode = mode;
      });
      toast("עודכן");
    },
    baseline(fd, f, ctx) {
      const c = (k, max, def) => Math.min(max, Math.max(0, fdNum(fd, k, def)));
      ctx.update(s => {
        Object.assign(s.profile.baseline, {
          sessionsPerDay: c("sessionsPerDay", 50, 0), gramsPerDay: c("gramsPerDay", 50, 0),
          costPerWeek: c("costPerWeek", 100000, 0), minutesPerSession: Math.max(1, c("minutesPerSession", 240, 10)),
        });
      });
      toast("נשמר");
    },
  },
  onChange(el, ctx) {
    const n = el.name;
    if (n === "theme") ctx.update(s => { s.settings.theme = el.value; }, { render: false });
    else if (n === "showMoney" || n === "haptics") ctx.update(s => { s.settings[n] = el.checked; }, { render: false });
    else if (n === "checkinTime" && /^\d\d:\d\d$/.test(el.value)) ctx.update(s => { s.settings.checkinTime = el.value; }, { render: false });
    else if (n === "autoLockMin") ctx.update(s => { s.settings.autoLockMin = Number(el.value); }, { render: false });
    if (el.matches("[data-import]")) importFile(el, ctx);
  },
  actions: {
    importPick(el) { el.closest("section").querySelector("[data-import]").click(); },
    ics(el, ctx) { download("tzalul-reminder.ics", ics(ctx.state.settings.checkinTime), "text/calendar"); },
    async enableLock(el, ctx) {
      const code = await codeSheet("הגדרת קוד נעילה");
      if (!code) return;
      await store.enableLock(ctx.state, code);
      toast("הנעילה הופעלה. המידע מוצפן.");
      ctx.rerender();
    },
    async changeCode(el, ctx) {
      const code = await codeSheet("קוד חדש");
      if (!code) return;
      await store.enableLock(ctx.state, code);
      toast("הקוד הוחלף");
    },
    async disableLock(el, ctx) {
      if (!(await confirmDialog("לבטל את הנעילה?", "המידע יישמר במכשיר בלי הצפנה.", { ok: "ביטול נעילה", danger: true }))) return;
      await store.disableLock(ctx.state);
      toast("הנעילה בוטלה");
      ctx.rerender();
    },
    export(el, ctx) {
      download(`tzalul-backup-${dayKey()}.json`, store.exportJSON(ctx.state));
      toast("קובץ הגיבוי נשמר");
    },
    async wipe(el, ctx) {
      if (!(await confirmDialog("למחוק את כל המידע?", "כל הרצפים, היומן, הצ׳ק־אינים והתוכנית יימחקו מהמכשיר.", { ok: "כן, למחוק", danger: true }))) return;
      if (!(await confirmDialog("בטוח?", "זו הפעולה האחרונה. אין דרך חזרה.", { ok: "מחיקה סופית", danger: true }))) return;
      store.wipe();
      location.hash = "";
      location.reload();
    },
  },
};

async function importFile(input, ctx) {
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (file.size > 15e6) return toast("הקובץ גדול מדי");
  try {
    const st = store.importJSON(await file.text());
    const ok = await confirmDialog("לשחזר מהגיבוי?", "המידע הנוכחי במכשיר יוחלף במידע מהקובץ.", { ok: "שחזור" });
    if (!ok) return;
    ctx.replace(st);
    toast("השחזור הושלם");
    ctx.go("home");
  } catch (e) {
    toast(e instanceof SyntaxError ? "הקובץ פגום" : e.message || "השחזור נכשל");
  }
}
