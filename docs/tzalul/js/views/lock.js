// PIN lock screen. Data stays encrypted until the right PIN is entered.

import { html } from "../util.js";
import { icon, confirmBox, toast } from "../ui.js";

let busy = false;

function waitText(until) {
  const s = Math.ceil((until - Date.now()) / 1000);
  return s > 60 ? `נסו שוב בעוד ${Math.ceil(s / 60)} דקות` : `נסו שוב בעוד ${s} שניות`;
}

export default {
  title: "נעול",
  render(app) {
    const g = app.store.guard();
    const waiting = Date.now() < g.until;
    return html`<section class="lock">
      <div class="lock-card">
        <img src="icons/icon.svg" alt="" width="72" height="72" class="lock-logo">
        <h1>צלול</h1>
        <p class="muted">הנתונים מוצפנים. הזינו את הקוד כדי לפתוח.</p>
        <form data-form="unlock" class="lock-form" autocomplete="off">
          <label class="sr" for="pin">קוד</label>
          <input id="pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="12" autocomplete="current-password" required ${waiting ? "disabled" : "autofocus"} dir="ltr">
          <div class="keypad" aria-hidden="true">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => html`<button type="button" tabindex="-1" data-act="key" data-k="${n}">${n}</button>`)}
            <button type="button" tabindex="-1" data-act="key" data-k="del" aria-label="מחיקה">⌫</button>
            <button type="button" tabindex="-1" data-act="key" data-k="0">0</button>
            <button type="submit" tabindex="-1" class="ok" aria-label="פתיחה">${icon("check")}</button>
          </div>
          <p class="lock-msg" id="lock-msg" role="alert">${waiting ? waitText(g.until) : ""}</p>
          <button class="btn primary block" type="submit" ${waiting ? "disabled" : ""}>פתיחה</button>
        </form>
        <button class="link-btn" data-act="forgot">שכחתי את הקוד</button>
      </div>
    </section>`;
  },
  mount(root, app) {
    const g = app.store.guard();
    if (Date.now() < g.until) {
      const iv = setInterval(() => {
        if (Date.now() >= g.until) { clearInterval(iv); app.render(); return; }
        const m = document.getElementById("lock-msg");
        if (m) m.textContent = waitText(g.until);
      }, 1000);
      return () => clearInterval(iv);
    }
    return null;
  },
  actions: {
    key(el) {
      const inp = document.getElementById("pin");
      if (!inp || inp.disabled) return;
      if (el.dataset.k === "del") inp.value = inp.value.slice(0, -1);
      else if (inp.value.length < 12) inp.value += el.dataset.k;
    },
    async forgot(el, app) {
      const ok = await confirmBox({
        title: "שכחת את הקוד?",
        text: "הנתונים מוצפנים בקוד ואין דרך לשחזר אותם בלעדיו – גם לא לנו. אפשר למחוק הכל ולהתחיל מחדש (ואז לשחזר מגיבוי, אם שמרת).",
        ok: "מחיקת הכל והתחלה מחדש", danger: true,
      });
      if (ok) { await app.store.wipe(); toast("הנתונים נמחקו"); }
    },
  },
  forms: {
    async unlock(d, form, app) {
      if (busy) return;
      const msg = document.getElementById("lock-msg");
      if (!/^\d{4,12}$/.test(d.pin)) { msg.textContent = "הקוד צריך להיות 4–12 ספרות"; return; }
      busy = true;
      form.classList.add("busy");
      msg.textContent = "פותח…";
      try {
        await app.store.unlock(d.pin);
      } catch (e) {
        form.classList.remove("busy");
        const inp = document.getElementById("pin");
        if (inp) inp.value = "";
        if (e.message === "vault") msg.textContent = "קובץ הנתונים פגום.";
        else if (e.message === "wait" || Date.now() < (e.until || 0)) app.render();
        else { msg.textContent = `קוד שגוי${e.fails >= 3 ? ` (${e.fails} ניסיונות)` : ""}`; form.classList.add("shake"); setTimeout(() => form.classList.remove("shake"), 500); inp?.focus(); }
      } finally { busy = false; }
    },
  },
};
