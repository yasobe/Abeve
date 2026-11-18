// Lock screen. main.js wires lock.unlock(code) and lock.reset().
import { html, icon, confirmDialog } from "../ui.js";

let fails = 0, waitUntil = 0;

const view = {
  title: "נעול",
  render() {
    return html`<div class="lock">
      <div class="lock-mark" aria-hidden="true"><span class="brand-mark big"></span></div>
      <h1>צלול</h1>
      <p class="muted">הקלד/י את הקוד כדי להמשיך</p>
      <form data-form="unlock" class="form lock-form" autocomplete="off">
        <label class="sr-only" for="code">קוד</label>
        <input id="code" type="password" name="code" autocomplete="current-password" required minlength="4" maxlength="64" autofocus>
        <p class="form-err" role="alert" hidden></p>
        <button class="btn primary wide" type="submit">${icon("lock", 18)} פתיחה</button>
      </form>
      <button class="btn link small" data-act="forgot">שכחתי את הקוד</button>
    </div>`;
  },
  mount(root) { setTimeout(() => root.querySelector("#code")?.focus(), 50); },
  forms: {
    async unlock(fd, form) {
      const err = form.querySelector(".form-err"), btn = form.querySelector("button");
      const wait = waitUntil - Date.now();
      if (wait > 0) { err.textContent = `נא להמתין ${Math.ceil(wait / 1000)} שניות`; err.hidden = false; return; }
      btn.disabled = true;
      try {
        await view.unlock(String(fd.get("code")));
        fails = 0;
      } catch {
        fails++;
        // exponential back-off after the 3rd failure: 2, 4, 8 ... 60 seconds
        if (fails >= 3) waitUntil = Date.now() + Math.min(60, 2 ** (fails - 2)) * 1000;
        err.textContent = "הקוד שגוי";
        err.hidden = false;
        form.querySelector("input").value = "";
        form.querySelector("input").focus();
        btn.disabled = false;
      }
    },
  },
  actions: {
    async forgot() {
      const ok = await confirmDialog("שכחת את הקוד?",
        "המידע מוצפן בקוד שלך, ולכן אין דרך לשחזר אותו בלעדיו. אפשר למחוק את כל המידע ולהתחיל מחדש — ואז לשחזר מקובץ גיבוי אם יש.",
        { ok: "למחוק ולהתחיל מחדש", danger: true });
      if (ok) view.reset();
    },
  },
  unlock: async () => { throw new Error("not wired"); },
  reset: () => {},
};
export default view;
