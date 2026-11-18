// Personal relapse-prevention plan: reasons, triggers + coping plans, if-then plans, warning signs, contacts, rewards.
import { html, icon, toast } from "../ui.js";
import { g, money } from "../i18n.js";
import { TRIGGERS, REWARD_IDEAS } from "../content.js";
import { head, field, fdStr, fdNum } from "./parts.js";
import { uid } from "../store.js";
import { totalSavings } from "../calc.js";

const L = k => TRIGGERS.find(t => t.k === k)?.label || k;

function render(ctx) {
  const s = ctx.state, p = s.plan;
  const used = new Set(p.triggers.map(t => t.k));
  const saved = totalSavings(s).money;
  const cur = s.profile.currency;
  return html`
    ${head("התוכנית שלי", { back: "more", sub: "תוכנית שנכתבת ברגע רגוע עובדת ברגע הסוער." })}

    <section class="card" id="reasons">
      <h2>${icon("heart", 18)} הסיבות שלי</h2>
      ${s.profile.reasons.length ? html`<ul class="editable">${s.profile.reasons.map((r, i) => html`<li><span>${r}</span><button class="icon-btn sm" data-act="delReason" data-i="${i}" aria-label="מחיקת ${r}">${icon("x", 16)}</button></li>`)}</ul>` : html`<p class="muted small">עוד אין סיבות.</p>`}
      <form data-form="addReason" class="inline-form"><input name="r" maxlength="120" placeholder="סיבה חדשה" aria-label="סיבה חדשה" required><button class="btn primary" type="submit">הוספה</button></form>
      <form data-form="why" class="form">
        ${field("משפט לרגעים קשים", html`<textarea name="why" rows="2" maxlength="600" placeholder="כשיהיה קשה, אני רוצה לזכור ש...">${s.profile.why}</textarea>`)}
        <button class="btn ghost small" type="submit">שמירה</button>
      </form>
    </section>

    <section class="card" id="triggers">
      <h2>${icon("target", 18)} טריגרים ותוכנית התמודדות</h2>
      <p class="small muted">לכל טריגר — מה ${g("אעשה", "אעשה", "אעשה")} במקום. כמה שיותר מוחשי, יותר טוב.</p>
      <form data-form="trigPlans" class="form">
        ${p.triggers.map(t => html`<div class="trig-row">
          <div class="row"><span class="tag">${L(t.k)}</span><button class="icon-btn sm" type="button" data-act="delTrigger" data-k="${t.k}" aria-label="הסרת ${L(t.k)}">${icon("x", 16)}</button></div>
          <textarea name="plan_${t.k}" rows="2" maxlength="400" placeholder="למשל: לצאת להליכה עם אוזניות ולהתקשר לחבר" aria-label="תוכנית עבור ${L(t.k)}">${t.plan}</textarea></div>`)}
        ${p.triggers.length ? html`<button class="btn ghost small" type="submit">שמירת התוכניות</button>` : ""}
      </form>
      <form data-form="addTrigger" class="inline-form">
        <select name="k" aria-label="טריגר להוספה" required><option value="">הוספת טריגר...</option>${TRIGGERS.filter(t => !used.has(t.k)).map(t => html`<option value="${t.k}">${t.label}</option>`)}</select>
        <button class="btn primary" type="submit">הוספה</button>
      </form>
    </section>

    <section class="card" id="ifthen">
      <h2>${icon("map", 18)} תוכניות אם־אז</h2>
      <p class="small muted">מחקרים מראים שתוכנית בפורמט "אם X — אז Y" מעלה מאוד את הסיכוי לפעול לפיה.</p>
      ${p.ifThen.length ? html`<ul class="editable">${p.ifThen.map(x => html`<li><span><b>אם</b> ${x.if} <b>אז</b> ${x.then}</span><button class="icon-btn sm" data-act="delIfThen" data-id="${x.id}" aria-label="מחיקה">${icon("x", 16)}</button></li>`)}</ul>` : ""}
      <form data-form="addIfThen" class="form compact">
        <input name="if" maxlength="200" placeholder="אם... (חבר מציע לעשן)" aria-label="אם" required>
        <input name="then" maxlength="200" placeholder="אז... (אגיד: לא תודה, אני בהפסקה)" aria-label="אז" required>
        <button class="btn primary" type="submit">הוספה</button>
      </form>
    </section>

    <section class="card" id="warning">
      <h2>${icon("alert", 18)} סימני אזהרה שלי</h2>
      <form data-form="warning" class="form">
        <textarea name="warning" rows="3" maxlength="1000" aria-label="סימני אזהרה" placeholder="מה קורה אצלי לפני מעידה? (מפסיק לעשות ספורט, מבלה עם..., מתחיל לחשוב ש'מגיע לי')">${p.warning}</textarea>
        <button class="btn ghost small" type="submit">שמירה</button>
      </form>
    </section>

    <section class="card" id="contacts">
      <h2>${icon("people", 18)} אנשים שאפשר לפנות אליהם</h2>
      ${p.contacts.length ? html`<ul class="editable">${p.contacts.map(c => html`<li><a href="tel:${c.phone}" class="contact-inline">${icon("phone", 16)} <b>${c.name}</b> <span class="num muted">${c.phone}</span></a><button class="icon-btn sm" data-act="delContact" data-id="${c.id}" aria-label="מחיקת ${c.name}">${icon("x", 16)}</button></li>`)}</ul>` : ""}
      <form data-form="addContact" class="form compact">
        <input name="name" maxlength="40" placeholder="שם" aria-label="שם" autocomplete="off" required>
        <input name="phone" type="tel" maxlength="20" placeholder="טלפון" aria-label="טלפון" inputmode="tel" autocomplete="off" required dir="ltr">
        <button class="btn primary" type="submit">הוספה</button>
      </form>
    </section>

    <section class="card" id="rewards">
      <h2>${icon("gift", 18)} פרסים מהכסף שנחסך</h2>
      <p class="small muted">נחסך עד עכשיו: <b class="num">${money(saved, cur)}</b></p>
      ${p.rewards.length ? html`<ul class="rewards">${p.rewards.map(r => {
        const pct = r.price ? Math.min(100, (100 * saved) / r.price) : 0;
        return html`<li class="${r.done ? "done" : ""}">
          <div class="row"><b>${r.title}</b><span class="num small">${money(r.price, cur)}</span></div>
          <div class="bar"><span style="width:${pct.toFixed(1)}%"></span></div>
          <div class="row-btns">
            <button class="btn small ${r.done ? "ghost" : pct >= 100 ? "primary" : "ghost"}" data-act="toggleReward" data-id="${r.id}">${r.done ? "בוטל סימון" : pct >= 100 ? "קיבלתי את הפרס!" : "סימון כהושג"}</button>
            <button class="icon-btn sm" data-act="delReward" data-id="${r.id}" aria-label="מחיקה">${icon("trash", 16)}</button>
          </div></li>`;
      })}</ul>` : ""}
      <form data-form="addReward" class="form compact">
        <input name="title" maxlength="80" placeholder="${REWARD_IDEAS[Math.floor(Math.random() * REWARD_IDEAS.length)]}" aria-label="פרס" required>
        <input name="price" type="number" min="0" step="10" inputmode="numeric" placeholder="מחיר (${cur})" aria-label="מחיר" required>
        <button class="btn primary" type="submit">הוספה</button>
      </form>
    </section>`;
}

const saved = msg => toast(msg || "נשמר");

export default {
  title: "התוכנית שלי",
  render,
  // text areas save on blur too, so nothing typed is lost when another section re-renders
  onChange(el, ctx) {
    const v = String(el.value || "").trim();
    if (el.name?.startsWith("plan_")) {
      const k = el.name.slice(5);
      ctx.update(s => { const t = s.plan.triggers.find(x => x.k === k); if (t) t.plan = v.slice(0, 400); }, { render: false });
    } else if (el.name === "why") ctx.update(s => { s.profile.why = v.slice(0, 600); }, { render: false });
    else if (el.name === "warning") ctx.update(s => { s.plan.warning = v.slice(0, 1000); }, { render: false });
  },
  forms: {
    addReason(fd, f, ctx) { const r = fdStr(fd, "r"); if (!r) return; ctx.update(s => { if (!s.profile.reasons.includes(r)) s.profile.reasons.push(r.slice(0, 120)); }); saved("נוסף"); },
    why(fd, f, ctx) { ctx.update(s => { s.profile.why = fdStr(fd, "why").slice(0, 600); }); saved(); },
    addTrigger(fd, f, ctx) {
      const k = String(fd.get("k") || "");
      if (!TRIGGERS.some(t => t.k === k)) return;
      ctx.update(s => { if (!s.plan.triggers.some(t => t.k === k)) s.plan.triggers.push({ k, plan: "" }); });
      setTimeout(() => document.querySelector(`[name="plan_${k}"]`)?.focus(), 50);
    },
    trigPlans(fd, f, ctx) { ctx.update(s => { s.plan.triggers.forEach(t => { t.plan = fdStr(fd, `plan_${t.k}`).slice(0, 400); }); }); saved(); },
    addIfThen(fd, f, ctx) { ctx.update(s => { s.plan.ifThen.push({ id: uid(), if: fdStr(fd, "if").slice(0, 200), then: fdStr(fd, "then").slice(0, 200) }); }); saved("נוסף"); },
    warning(fd, f, ctx) { ctx.update(s => { s.plan.warning = fdStr(fd, "warning").slice(0, 1000); }); saved(); },
    addContact(fd, f, ctx) {
      const phone = fdStr(fd, "phone").replace(/[^\d+*#-]/g, "");
      if (!phone) return toast("מספר טלפון לא תקין");
      ctx.update(s => { s.plan.contacts.push({ id: uid(), name: fdStr(fd, "name").slice(0, 40), phone }); });
      saved("נוסף");
    },
    addReward(fd, f, ctx) { ctx.update(s => { s.plan.rewards.push({ id: uid(), title: fdStr(fd, "title").slice(0, 80), price: Math.max(0, fdNum(fd, "price", 0)), done: false }); }); saved("נוסף"); },
  },
  actions: {
    delReason(el, ctx) { const i = Number(el.dataset.i); ctx.update(s => { s.profile.reasons.splice(i, 1); }); },
    delTrigger(el, ctx) { ctx.update(s => { s.plan.triggers = s.plan.triggers.filter(t => t.k !== el.dataset.k); }); },
    delIfThen(el, ctx) { ctx.update(s => { s.plan.ifThen = s.plan.ifThen.filter(x => x.id !== el.dataset.id); }); },
    delContact(el, ctx) { ctx.update(s => { s.plan.contacts = s.plan.contacts.filter(x => x.id !== el.dataset.id); }); },
    delReward(el, ctx) { ctx.update(s => { s.plan.rewards = s.plan.rewards.filter(x => x.id !== el.dataset.id); }); },
    toggleReward(el, ctx) { ctx.update(s => { const r = s.plan.rewards.find(x => x.id === el.dataset.id); if (r) r.done = !r.done; }); },
  },
};
