// "הגדרות" – profile, habits, appearance, reminder, PIN lock, backup, erase.

import { html, raw, toLocalInput, dayKey, uid } from "../util.js";
import { icon, toast, confirmBox, openSheet, closeSheet, download, formData } from "../ui.js";
import { VERSION } from "../content.js";
import { pageHead, celebrate } from "./common.js";

const ck = v => (v ? raw("checked") : "");
const sel = v => (v ? raw("selected") : "");

/** Daily repeating calendar event – a reminder that works even when the app is closed. */
export function buildICS(time, now = new Date()) {
  const [h, m] = time.split(":");
  const d = dayKey(now).replace(/-/g, "");
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tzalul//Daily check-in//HE", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${uid()}@tzalul`, `DTSTAMP:${stamp}`, `DTSTART:${d}T${h}${m}00`, "DURATION:PT5M",
    "RRULE:FREQ=DAILY", "SUMMARY:צ׳ק-אין יומי", "DESCRIPTION:דקה אחת לעצמך: איך עבר היום?",
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:צ׳ק-אין יומי", "TRIGGER:PT0M", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}

function pinSheet(app, { title, verify = false, onDone }) {
  openSheet({
    title,
    content: html`<form class="stack" autocomplete="off">
      ${verify ? html`<div class="field"><label class="lbl" for="p-old">הקוד הנוכחי</label><input id="p-old" name="old" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="12" required dir="ltr" autofocus></div>` : ""}
      <div class="field"><label class="lbl" for="p-new">קוד חדש (4–12 ספרות)</label><input id="p-new" name="pin" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="12" required dir="ltr" ${verify ? "" : raw("autofocus")}></div>
      <div class="field"><label class="lbl" for="p-new2">שוב, לאימות</label><input id="p-new2" name="pin2" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="12" required dir="ltr"></div>
      <p class="soft-note">${icon("info")} אין אפשרות לשחזר קוד שנשכח. מומלץ לשמור גיבוי.</p>
      <p class="lock-msg" role="alert" id="pin-msg"></p>
      <button class="btn primary block" type="submit">שמירה</button>
    </form>`,
    onAction: async (act, el, form) => {
      if (act !== "submit") return;
      const d = formData(form), msg = form.querySelector("#pin-msg");
      if (!/^\d{4,12}$/.test(d.pin)) { msg.textContent = "הקוד צריך להיות 4–12 ספרות"; return; }
      if (d.pin !== d.pin2) { msg.textContent = "הקודים לא תואמים"; return; }
      form.classList.add("busy"); msg.textContent = "מצפין…";
      if (verify && !(await app.store.verifyPin(d.old))) { form.classList.remove("busy"); msg.textContent = "הקוד הנוכחי שגוי"; return; }
      await app.store.enableLock(d.pin);
      closeSheet(true);
      onDone?.();
    },
  });
}

export default {
  title: "הגדרות",
  back: "today",
  render(app) {
    const st = app.state, p = st.profile, se = st.settings;
    const locked = app.store.hasLock();
    return html`<section class="settings">
      ${pageHead("הגדרות")}

      <form class="card stack" data-form="profile">
        <h2 class="card-t">${icon("heart")} פרופיל</h2>
        <div class="field"><label class="lbl" for="s-name">שם</label><input id="s-name" name="name" maxlength="40" value="${p.name}"></div>
        <fieldset class="field"><legend class="lbl">פנייה</legend><div class="seg">
          <label><input type="radio" name="gender" value="m" ${ck(p.gender === "m")}><span>זכר</span></label>
          <label><input type="radio" name="gender" value="f" ${ck(p.gender === "f")}><span>נקבה</span></label>
          <label><input type="radio" name="gender" value="n" ${ck(p.gender === "n")}><span>רבים</span></label></div></fieldset>
        <fieldset class="field"><legend class="lbl">מטרה</legend><div class="seg">
          <label><input type="radio" name="goal" value="quit" ${ck(p.goal === "quit")}><span>הפסקה</span></label>
          <label><input type="radio" name="goal" value="reduce" ${ck(p.goal === "reduce")}><span>הפחתה</span></label></div></fieldset>
        <h3 class="lbl-h">הרגלי השתייה לפני ההתחלה</h3>
        <div class="grid2">
          <div class="field"><label class="lbl" for="s-dw">ימים בשבוע</label><input id="s-dw" name="daysPerWeek" type="number" min="0" max="7" step="1" value="${p.daysPerWeek}" inputmode="numeric"></div>
          <div class="field"><label class="lbl" for="s-dd">משקאות ביום שתייה</label><input id="s-dd" name="drinksPerDay" type="number" min="0" max="60" step="0.5" value="${p.drinksPerDay}" inputmode="decimal"></div>
          <div class="field"><label class="lbl" for="s-c">מחיר למשקה (₪)</label><input id="s-c" name="costPerDrink" type="number" min="0" max="1000" step="1" value="${p.costPerDrink}" inputmode="numeric"></div>
          <div class="field"><label class="lbl" for="s-k">קלוריות למשקה</label><input id="s-k" name="kcalPerDrink" type="number" min="0" max="1000" step="10" value="${p.kcalPerDrink}" inputmode="numeric"></div>
        </div>
        <div class="field"><label class="lbl" for="s-start">תחילת הדרך</label>
          <input id="s-start" name="startAt" type="datetime-local" value="${toLocalInput(p.startAt)}" max="${toLocalInput(new Date())}" required>
          <p class="hint">שינוי התאריך מחשב מחדש את כל הנתונים. מעידות נרשמות ביומן, לא כאן.</p></div>
        <button class="btn primary" type="submit">שמירה</button>
      </form>

      <article class="card stack">
        <h2 class="card-t">${icon("sun")} מראה</h2>
        <div class="seg" role="radiogroup" aria-label="ערכת צבעים">
          <label><input type="radio" name="theme" value="auto" ${ck(se.theme === "auto")}><span>אוטומטי</span></label>
          <label><input type="radio" name="theme" value="light" ${ck(se.theme === "light")}><span>בהיר</span></label>
          <label><input type="radio" name="theme" value="dark" ${ck(se.theme === "dark")}><span>כהה</span></label>
        </div>
      </article>

      <form class="card stack" data-form="reminder">
        <h2 class="card-t">${icon("bell")} תזכורת יומית</h2>
        <p class="muted small">אם עוד לא עשית צ׳ק-אין עד השעה הזו, יופיע באנר במסך הבית. כדי לקבל התראה גם כשהאפליקציה סגורה, אפשר להוסיף אירוע חוזר ליומן של הטלפון (הכותרת דיסקרטית: ״צ׳ק-אין יומי״).</p>
        <div class="add-row"><label class="sr" for="s-rem">שעה</label><input id="s-rem" name="reminder" type="time" value="${se.reminder}" required>
          <button class="btn sm" type="submit">שמירה</button></div>
        <button class="btn ghost" type="button" data-act="ics">${icon("download")} הוספה ליומן (קובץ ‎.ics)</button>
      </form>

      <article class="card stack">
        <h2 class="card-t">${icon("lock")} פרטיות ונעילה</h2>
        <p class="muted small">כל הנתונים נשמרים רק בדפדפן במכשיר הזה. שום מידע לא נשלח לשום מקום.</p>
        ${locked ? html`
          <p class="ok-line">${icon("check")} נעילה בקוד פעילה. הנתונים מוצפנים (AES-256).</p>
          <div class="field"><label class="lbl" for="s-al">נעילה אוטומטית ביציאה מהאפליקציה</label>
            <select id="s-al" name="autoLockMin">
              <option value="0" ${sel(se.autoLockMin === 0)}>מיד</option>
              <option value="1" ${sel(se.autoLockMin === 1)}>אחרי דקה</option>
              <option value="5" ${sel(se.autoLockMin === 5)}>אחרי 5 דקות</option>
              <option value="15" ${sel(se.autoLockMin === 15)}>אחרי 15 דקות</option>
            </select></div>
          <div class="row-btns">
            <button class="btn" data-act="lock-now">${icon("lock")} נעילה עכשיו</button>
            <button class="btn ghost" data-act="pin-change">שינוי קוד</button>
            <button class="btn ghost danger" data-act="pin-off">ביטול נעילה</button>
          </div>` : html`
          <p class="small">אפשר להגן על האפליקציה בקוד. הנתונים יוצפנו, ואף אחד שמחזיק בטלפון לא יוכל לקרוא אותם בלי הקוד.</p>
          <button class="btn primary" data-act="pin-on">${icon("lock")} הפעלת נעילה בקוד</button>`}
      </article>

      <article class="card stack">
        <h2 class="card-t">${icon("download")} גיבוי ושחזור</h2>
        <p class="muted small">הנתונים קיימים רק במכשיר הזה. גיבוי מאפשר להעביר אותם לטלפון חדש. שימו לב: קובץ הגיבוי <b>אינו מוצפן</b> – שמרו אותו במקום בטוח.</p>
        <div class="row-btns">
          <button class="btn" data-act="export">${icon("download")} שמירת גיבוי</button>
          <label class="btn ghost file-btn">${icon("upload")} שחזור מגיבוי<input type="file" accept="application/json,.json" id="import-file" class="sr"></label>
        </div>
      </article>

      <article class="card stack danger-zone">
        <h2 class="card-t">${icon("trash")} מחיקת כל הנתונים</h2>
        <p class="muted small">מוחק את כל המידע מהמכשיר. אי אפשר לבטל.</p>
        <button class="btn danger" data-act="wipe">מחיקת הכל</button>
      </article>

      <article class="card about">
        <h2 class="card-t">${icon("info")} אודות</h2>
        <p><b>צלול</b> · גרסה ${VERSION}</p>
        <p class="small">כלי עזר אישי להפסקה ולהפחתה של שתיית אלכוהול. המידע באפליקציה כללי ואינו מהווה ייעוץ רפואי, אבחנה או טיפול. אם יש חשש לתסמיני גמילה – התייעצו עם רופא. במצב חירום חייגו 101.</p>
        <p class="small muted">פרטיות: ללא חשבון, ללא שרת, ללא עוגיות מעקב וללא אנליטיקה. הגופן Rubik מוגש מקומית ברישיון SIL OFL 1.1.</p>
        <p class="small muted">מקשי קיצור במחשב: 1 היום · 2 יומן · 3 התקדמות · 4 כלים · ! יש לי דחף</p>
      </article>
    </section>`;
  },

  forms: {
    async profile(d, form, app) {
      const start = new Date(d.startAt);
      if (isNaN(start) || start > new Date(Date.now() + 60000)) return toast("תאריך התחלה לא תקין");
      const changed = Math.abs(start - new Date(app.state.profile.startAt)) > 60000;
      if (changed && !(await confirmBox({ title: "לשנות את תאריך ההתחלה?", text: "הרצף, החיסכון והסטטיסטיקות יחושבו מחדש מהתאריך החדש.", ok: "שינוי" }))) return;
      app.store.update(s => {
        Object.assign(s.profile, {
          name: d.name.trim(), gender: d.gender, goal: d.goal,
          daysPerWeek: Number(d.daysPerWeek), drinksPerDay: Number(d.drinksPerDay),
          costPerDrink: Number(d.costPerDrink), kcalPerDrink: Number(d.kcalPerDrink),
        });
        if (changed) { s.profile.startAt = start.toISOString(); s.seen.milestone = 0; }
      });
      celebrate("נשמר");
      app.render({ keepScroll: true });
    },
    reminder(d, form, app) {
      app.store.update(s => { s.settings.reminder = d.reminder; });
      toast("שעת התזכורת נשמרה");
    },
  },

  onChange(t, app) {
    if (t.name === "theme") app.store.update(s => { s.settings.theme = t.value; });
    else if (t.name === "autoLockMin") { app.store.update(s => { s.settings.autoLockMin = Number(t.value); }); toast("נשמר"); }
    else if (t.id === "import-file" && t.files?.[0]) importFile(t, app);
  },

  actions: {
    ics(el, app) {
      download("tzalul-reminder.ics", buildICS(app.state.settings.reminder), "text/calendar");
      toast("פתחו את הקובץ כדי להוסיף את התזכורת ליומן");
    },
    "pin-on"(el, app) { pinSheet(app, { title: "הפעלת נעילה בקוד", onDone: () => { celebrate("הנעילה הופעלה והנתונים מוצפנים"); app.render({ keepScroll: true }); } }); },
    "pin-change"(el, app) { pinSheet(app, { title: "שינוי קוד", verify: true, onDone: () => { toast("הקוד עודכן"); app.render({ keepScroll: true }); } }); },
    async "pin-off"(el, app) {
      if (!(await confirmBox({ title: "לבטל את הנעילה?", text: "הנתונים יישמרו במכשיר ללא הצפנה.", ok: "ביטול הנעילה", danger: true }))) return;
      await app.store.disableLock();
      toast("הנעילה בוטלה");
      app.render({ keepScroll: true });
    },
    "lock-now"(el, app) { app.store.lock(); },
    export(el, app) {
      download(`tzalul-backup-${dayKey()}.json`, app.store.exportData());
      toast("הגיבוי נשמר בתיקיית ההורדות");
    },
    async wipe(el, app) {
      if (!(await confirmBox({ title: "למחוק את כל הנתונים?", text: "כל הימים, היומן, הדחפים וההגדרות יימחקו מהמכשיר. מומלץ לשמור גיבוי קודם.", ok: "מחיקה סופית", danger: true }))) return;
      await app.store.wipe();
      location.hash = "";
      toast("כל הנתונים נמחקו");
    },
  },
};

async function importFile(input, app) {
  const f = input.files[0];
  input.value = "";
  if (f.size > 20 * 1024 * 1024) return toast("הקובץ גדול מדי");
  const ok = await confirmBox({ title: "לשחזר מגיבוי?", text: "הנתונים הנוכחיים במכשיר יוחלפו בנתונים מהקובץ.", ok: "שחזור" });
  if (!ok) return;
  try {
    app.store.importData(await f.text());
    celebrate("השחזור הצליח");
    app.go("today");
  } catch {
    toast("הקובץ לא תקין או שאינו גיבוי של צלול", { tone: "bad" });
  }
}
