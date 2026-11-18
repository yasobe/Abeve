// Shared view pieces: live counter text and the sheets used from several screens
// (daily check-in, craving log, drink log, journal entry).

import { html, raw, uid, dayKey, parseDay, toLocalInput, fmtNum, fmtMoney, fmtDate, num, plural, U, g } from "../util.js";
import { openSheet, closeSheet, toast, chips, formData, vibrate, icon, confirmBox } from "../ui.js";
import { MOODS, TRIGGERS, COPING } from "../content.js";
import { savings, soberDays } from "../calc.js";

const pad = n => String(n).padStart(2, "0");

export function liveText(key, s, state) {
  switch (key) {
    case "streak-days": return fmtNum(s.days);
    case "streak-unit": return s.days === 1 ? "יום" : "ימים";
    case "streak-hms": return `${pad(s.hours)}:${pad(s.minutes)}:${pad(s.seconds)}`;
    case "money": return fmtMoney(savings(state).money);
    case "drinks": return fmtNum(savings(state).drinksAvoided);
    case "kcal": return fmtNum(savings(state).kcal);
    default: return null;
  }
}

export function celebrate(msg) { vibrate([10, 40, 10]); toast(msg, { tone: "good" }); }

export const G = (app, m, f, n) => g(app.state.profile.gender, m, f, n);

export function moodPicker(name, value) {
  return html`<fieldset class="moods"><legend class="lbl">מצב רוח</legend>
    ${MOODS.map(m => html`<label class="mood"><input type="radio" name="${name}" value="${m.v}" ${value === m.v ? raw("checked") : ""}>
      <span class="mood-e" aria-hidden="true">${m.e}</span><span class="mood-t">${m.t}</span></label>`)}
  </fieldset>`;
}

export function rangeField({ name, label, value, min = 0, max = 10, lo = "", hi = "" }) {
  const oid = `o-${name}-${uid().slice(-5)}`;
  return html`<div class="field">
    <label class="lbl" for="${oid}-in">${label} <output id="${oid}" class="range-out">${value}</output></label>
    <input id="${oid}-in" type="range" name="${name}" min="${min}" max="${max}" step="1" value="${value}" data-out="${oid}">
    <div class="range-ends"><span>${lo}</span><span>${hi}</span></div>
  </div>`;
}

/* ---------- Daily check-in ---------- */

export function openCheckin(app, key = dayKey()) {
  const st = app.state;
  const c = st.checkins[key] || {};
  const isToday = key === dayKey();
  openSheet({
    title: isToday ? "צ׳ק-אין יומי" : `צ׳ק-אין · ${fmtDate(parseDay(key), "long")}`,
    content: html`<form class="stack">
      ${moodPicker("mood", c.mood ?? null)}
      ${rangeField({ name: "craving", label: "עוצמת הדחף הכי חזק היום", value: c.craving ?? 0, lo: "בכלל לא", hi: "חזק מאוד" })}
      <fieldset class="field"><legend class="lbl">שתית${G(app, "", "", "ם")} אלכוהול ${isToday ? "היום" : "ביום הזה"}?</legend>
        <div class="seg">
          <label><input type="radio" name="drank" value="no" ${!c.drank ? raw("checked") : ""}><span>לא</span></label>
          <label><input type="radio" name="drank" value="yes" ${c.drank ? raw("checked") : ""}><span>כן</span></label>
        </div>
      </fieldset>
      <div class="field" data-when="drank-yes" ${c.drank ? "" : raw("hidden")}>
        <label class="lbl" for="ci-count">כמה משקאות בערך?</label>
        <input id="ci-count" name="count" type="number" inputmode="decimal" min="0.5" max="60" step="0.5" value="1">
        <p class="hint">זה בסדר. רישום כן הוא חלק מהדרך, והוא עוזר להבין מה קרה.</p>
      </div>
      <div class="field">
        <label class="lbl" for="ci-grat">דבר אחד טוב מהיום</label>
        <input id="ci-grat" name="grateful" maxlength="300" value="${c.grateful || ""}" placeholder="משהו קטן מספיק">
      </div>
      <div class="field">
        <label class="lbl" for="ci-note">הערה (לא חובה)</label>
        <textarea id="ci-note" name="note" rows="3" maxlength="5000" placeholder="מה עבר עליך היום?">${c.note || ""}</textarea>
      </div>
      <button class="btn primary block" type="submit">שמירה</button>
    </form>`,
    onOpen: dlg => {
      dlg.querySelector("form").addEventListener("change", e => {
        if (e.target.name === "drank") dlg.querySelector('[data-when="drank-yes"]').hidden = e.target.value !== "yes";
      });
    },
    onAction: (act, el, form) => {
      if (act !== "submit") return;
      const d = formData(form);
      const drankNow = d.drank === "yes";
      const hadDrank = !!c.drank;
      app.store.update(s => {
        s.checkins[key] = {
          ...(s.checkins[key] || {}),
          at: new Date().toISOString(),
          mood: d.mood ? Number(d.mood) : null,
          craving: Number(d.craving),
          drank: drankNow,
          grateful: d.grateful,
          note: d.note,
          done: true,
        };
        if (drankNow && !hadDrank) {
          const at = isToday ? new Date() : new Date(parseDay(key).setHours(21, 0, 0, 0));
          s.drinks.push({ id: uid(), at: at.toISOString(), count: num(d.count, 0.5, 60, 1), note: "נרשם מהצ׳ק-אין", triggers: [], learned: "" });
        }
      });
      closeSheet(true);
      if (drankNow && !hadDrank) toast(`תודה על הכנות. ${plural(soberDays(app.state), U.day)} ללא אלכוהול נשארים שלך.`);
      else celebrate(isToday ? "הצ׳ק-אין נשמר. כל הכבוד על עוד יום." : "נשמר");
      app.render({ keepScroll: true });
    },
  });
}

/* ---------- Craving log ---------- */

export function openCraving(app, { durationSec = 0, intensity = 5, after } = {}) {
  openSheet({
    title: "רישום דחף",
    content: html`<form class="stack">
      ${rangeField({ name: "intensity", label: "כמה חזק היה הדחף?", value: intensity, min: 1, max: 10, lo: "חלש", hi: "חזק מאוד" })}
      <div class="field"><span class="lbl">מה עורר אותו?</span>${chips("triggers", TRIGGERS)}</div>
      <div class="field"><span class="lbl">מה עזר?</span>${chips("coping", COPING)}</div>
      <fieldset class="field"><legend class="lbl">איך זה נגמר?</legend>
        <div class="seg">
          <label><input type="radio" name="outcome" value="passed" checked><span>הדחף עבר</span></label>
          <label><input type="radio" name="outcome" value="drank"><span>שתיתי</span></label>
        </div>
      </fieldset>
      <div class="field"><label class="lbl" for="cr-note">הערה</label>
        <textarea id="cr-note" name="note" rows="2" maxlength="5000" placeholder="איפה הייתי, מה הרגשתי"></textarea></div>
      <button class="btn primary block" type="submit">שמירה</button>
    </form>`,
    onAction: (act, el, form) => {
      if (act !== "submit") return;
      const d = formData(form);
      const rec = { id: uid(), at: new Date().toISOString(), intensity: Number(d.intensity), triggers: d.triggers || [], coping: d.coping || [], outcome: d.outcome, durationSec, note: d.note };
      app.store.update(s => { s.cravings.push(rec); });
      closeSheet(true);
      if (rec.outcome === "drank") openDrink(app, { triggers: rec.triggers });
      else { celebrate(G(app, "גלשת על הגל. זה בדיוק איך שזה עובד.", "גלשת על הגל. זה בדיוק איך שזה עובד.", "גלשתם על הגל. זה בדיוק איך שזה עובד.")); after?.(); }
      app.render({ keepScroll: true });
    },
  });
}

/* ---------- Drink / lapse log (compassionate) ---------- */

export function openDrink(app, { entry = null, triggers = [] } = {}) {
  const e = entry || { at: new Date().toISOString(), count: 1, note: "", triggers, learned: "" };
  openSheet({
    title: entry ? "עריכת רישום שתייה" : "רישום שתייה",
    content: html`<form class="stack">
      ${entry ? "" : html`<p class="soft-note">${icon("heart")} מעידה היא לא כישלון. היא מידע שעוזר לבנות תוכנית טובה יותר. הרצף יתחיל מחדש, אבל כל הימים שצברת נשארים.</p>`}
      <div class="grid2">
        <div class="field"><label class="lbl" for="dr-at">מתי</label>
          <input id="dr-at" type="datetime-local" name="at" required value="${toLocalInput(e.at)}" max="${toLocalInput(new Date())}"></div>
        <div class="field"><label class="lbl" for="dr-n">כמה משקאות</label>
          <input id="dr-n" type="number" name="count" inputmode="decimal" min="0.5" max="60" step="0.5" value="${e.count}" required></div>
      </div>
      <div class="field"><span class="lbl">מה הוביל לזה?</span>${chips("triggers", TRIGGERS, e.triggers)}</div>
      <div class="field"><label class="lbl" for="dr-note">מה קרה?</label>
        <textarea id="dr-note" name="note" rows="2" maxlength="5000">${e.note}</textarea></div>
      <div class="field"><label class="lbl" for="dr-learn">מה אעשה אחרת בפעם הבאה?</label>
        <textarea id="dr-learn" name="learned" rows="2" maxlength="5000" placeholder="למשל: אצא מהאירוע מוקדם יותר, אביא משקה משלי">${e.learned}</textarea></div>
      <button class="btn primary block" type="submit">שמירה</button>
      ${entry ? html`<button class="btn danger ghost block" type="button" data-sact="delete">מחיקת הרישום</button>` : ""}
    </form>`,
    onAction: async (act, el, form) => {
      if (act === "delete") {
        if (!(await confirmBox({ title: "למחוק את הרישום?", text: "הרצף יחושב מחדש בלי הרישום הזה.", ok: "מחיקה", danger: true }))) return;
        app.store.update(s => { s.drinks = s.drinks.filter(x => x.id !== entry.id); });
        app.render({ keepScroll: true });
        return;
      }
      if (act !== "submit") return;
      const d = formData(form);
      const at = new Date(d.at);
      if (isNaN(at)) return toast("תאריך לא תקין");
      if (at > new Date(Date.now() + 60000)) return toast("אי אפשר לרשום שתייה בעתיד");
      const rec = { id: entry?.id || uid(), at: at.toISOString(), count: num(d.count, 0.5, 60, 1), triggers: d.triggers || [], note: d.note, learned: d.learned };
      app.store.update(s => {
        if (entry) s.drinks = s.drinks.map(x => (x.id === entry.id ? rec : x));
        else s.drinks.push(rec);
        const k = dayKey(at);
        if (s.checkins[k]) s.checkins[k].drank = true;
      });
      closeSheet(true);
      if (!entry) toast(`נרשם. ${plural(soberDays(app.state), U.day)} ללא אלכוהול עדיין שלך. מתחילים מחדש – עכשיו.`, { ms: 5000 });
      app.render({ keepScroll: true });
    },
  });
}

/* ---------- Journal entry ---------- */

export function openJournal(app, entry = null) {
  openSheet({
    title: entry ? "עריכת רשומה" : "רשומה חדשה ביומן",
    content: html`<form class="stack">
      ${moodPicker("mood", entry?.mood ?? null)}
      <div class="field"><label class="lbl" for="jr-text">מה על הלב?</label>
        <textarea id="jr-text" name="text" rows="8" maxlength="5000" required autofocus placeholder="אפשר לכתוב הכל. זה נשאר רק אצלך.">${entry?.text || ""}</textarea></div>
      <button class="btn primary block" type="submit">שמירה</button>
      ${entry ? html`<button class="btn danger ghost block" type="button" data-sact="delete">מחיקה</button>` : ""}
    </form>`,
    onAction: async (act, el, form) => {
      if (act === "delete") {
        if (!(await confirmBox({ title: "למחוק את הרשומה?", text: "אי אפשר לשחזר אחרי מחיקה.", ok: "מחיקה", danger: true }))) return;
        app.store.update(s => { s.journal = s.journal.filter(x => x.id !== entry.id); });
        app.render({ keepScroll: true });
        return;
      }
      if (act !== "submit") return;
      const d = formData(form);
      if (!d.text.trim()) return;
      app.store.update(s => {
        const rec = { id: entry?.id || uid(), at: entry?.at || new Date().toISOString(), text: d.text, mood: d.mood ? Number(d.mood) : null };
        if (entry) s.journal = s.journal.map(x => (x.id === entry.id ? rec : x)); else s.journal.push(rec);
      });
      closeSheet(true);
      toast("נשמר ביומן");
      app.render({ keepScroll: true });
    },
  });
}

/** Editable list of short strings, used by reasons and the prevention plan. */
export function listEditor(name, items, placeholder) {
  return html`<ul class="edit-list" data-list="${name}">
    ${items.map((t, i) => html`<li><span>${t}</span><button type="button" class="icon-btn sm" data-act="list-del" data-list="${name}" data-i="${i}" aria-label="הסרה: ${t}">${icon("close")}</button></li>`)}
  </ul>
  <form class="add-row" data-form="list-add" data-list="${name}">
    <input name="text" maxlength="300" placeholder="${placeholder}" aria-label="${placeholder}" required>
    <button class="btn sm" type="submit" aria-label="הוספה">${icon("plus")}</button>
  </form>`;
}

export function pageHead(title, sub) {
  return html`<header class="page-head"><h1>${title}</h1>${sub ? html`<p class="muted">${sub}</p>` : ""}</header>`;
}

export function telHref(p) { return `tel:${String(p).replace(/[^0-9+*#]/g, "")}`; }
