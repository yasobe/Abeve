// Journal: free writing with guided prompts, plus history of check-ins, cravings and slips.
import { html, icon, toast, confirmDialog } from "../ui.js";
import { gx, time, relDay, dayKey, dateLong } from "../i18n.js";
import { JOURNAL_PROMPTS, MOODS, SLEEP, TRIGGERS, COPING, SYMPTOMS } from "../content.js";
import { head, emptyState, scale, fdStr } from "./parts.js";
import { uid } from "../store.js";

const TABS = [
  { k: "", label: "רשומות" },
  { k: "checkins", label: "צ׳ק־אינים" },
  { k: "cravings", label: "חשקים" },
  { k: "slips", label: "מעידות" },
];
const L = (list, k) => list.find(x => x.k === k)?.label || "";
let promptIdx = Math.floor(Math.random() * JOURNAL_PROMPTS.length);
let query = "";

function groupByDay(items, tsOf) {
  const m = new Map();
  for (const it of items) {
    const k = dayKey(tsOf(it));
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  return [...m.entries()];
}

function tabs(active, s) {
  return html`<nav class="tabs" aria-label="סוג">${TABS.filter(t => t.k !== "slips" || s.slips.length).map(t => html`
    <a href="#/journal${t.k ? `/${t.k}` : ""}" class="${active === t.k ? "on" : ""}" ${active === t.k ? html`aria-current="page"` : ""}>${t.label}</a>`)}</nav>`;
}

function entries(s) {
  const q = query.trim();
  const list = [...s.journal].reverse().filter(j => !q || j.text.includes(q) || j.prompt.includes(q));
  return html`
    <a class="card cta" href="#/journal/new">${icon("pen")}<span class="cta-text"><b>רשומה חדשה</b><small>${gx(JOURNAL_PROMPTS[promptIdx])}</small></span>${icon("plus", 20, "chev")}</a>
    ${s.journal.length > 4 ? html`<label class="search">${icon("eye", 18)}<input type="search" data-search placeholder="חיפוש ביומן" value="${query}" aria-label="חיפוש ביומן"></label>` : ""}
    ${list.length ? groupByDay(list, j => j.ts).map(([k, items]) => html`
      <section class="day-group"><h2 class="day-h">${relDay(k)}</h2>
      ${items.map(j => html`<a class="card entry" href="#/journal/edit/${j.id}">
        ${j.prompt ? html`<p class="eyebrow">${j.prompt}</p>` : ""}
        <p class="clamp3">${j.text}</p>
        <p class="small muted">${time(j.ts)}${j.mood ? ` · ${MOODS[j.mood - 1]}` : ""}</p></a>`)}
      </section>`) : q ? html`<p class="muted center">לא נמצאו רשומות</p>` : emptyState("book", "היומן ריק", "כתיבה של כמה שורות ביום עוזרת להבין טריגרים ולראות כמה התקדמת.")}`;
}

function checkins(s) {
  const list = [...s.checkins].reverse();
  if (!list.length) return emptyState("check", "עוד אין צ׳ק־אינים", "צ׳ק־אין יומי לוקח דקה ובונה תמונה של ההתקדמות.", html`<a class="btn primary" href="#/checkin">צ׳ק־אין עכשיו</a>`);
  return list.map(c => html`<a class="card entry" href="#/checkin/${c.date}">
    <div class="row"><b>${relDay(c.date)}</b>${c.used ? html`<span class="badge warn">שימוש</span>` : ""}</div>
    <div class="pills"><span class="pill m${c.mood}">מצב רוח: ${MOODS[c.mood - 1]}</span><span class="pill">שינה: ${SLEEP[c.sleep - 1]}</span><span class="pill">חשק: <span class="num">${c.craving}</span>/10</span></div>
    ${c.symptoms.length ? html`<p class="small muted">${c.symptoms.map(k => L(SYMPTOMS, k)).join(" · ")}</p>` : ""}
    ${c.win ? html`<p class="small">${icon("star", 14)} ${c.win}</p>` : ""}
    ${c.note ? html`<p class="small clamp2">${c.note}</p>` : ""}
  </a>`);
}

function cravings(s) {
  const list = [...s.cravings].reverse();
  if (!list.length) return emptyState("wave", "עוד אין תיעוד חשקים", "תיעוד חשקים חושף מתי ולמה הם מגיעים — וזה המפתח לתוכנית טובה.", html`<a class="btn primary" href="#/craving">לתעד חשק</a>`);
  return groupByDay(list, c => c.ts).map(([k, items]) => html`
    <section class="day-group"><h2 class="day-h">${relDay(k)}</h2>
    ${items.map(c => html`<a class="card entry craving" href="#/craving/edit/${c.id}">
      <div class="row"><span class="num muted">${time(c.ts)}</span>
        <span class="badge ${c.outcome === "used" ? "warn" : "ok"}">${c.outcome === "used" ? "השתמשתי" : "עברתי את זה"}</span></div>
      <div class="intensity" aria-label="עוצמה ${c.intensity} מתוך 10"><span style="width:${c.intensity * 10}%"></span></div>
      <div class="pills">${c.trigger ? html`<span class="pill">${L(TRIGGERS, c.trigger)}</span>` : ""}${c.coping.map(k => html`<span class="pill soft">${L(COPING, k)}</span>`)}</div>
      ${c.note ? html`<p class="small clamp2">${c.note}</p>` : ""}
    </a>`)}</section>`);
}

function slips(s) {
  const list = [...s.slips].reverse();
  if (!list.length) return emptyState("sprout", "אין מעידות", "");
  return list.map(x => html`<div class="card entry">
    <div class="row"><b>${dateLong(x.ts)}</b><span class="small muted">${x.reset ? "ספירה חדשה" : "המשך רצף"}</span></div>
    ${x.trigger ? html`<div class="pills"><span class="pill">${L(TRIGGERS, x.trigger)}</span></div>` : ""}
    ${x.note ? html`<p class="small">${x.note}</p>` : ""}
    ${x.learn ? html`<p class="small"><b>בפעם הבאה:</b> ${x.learn}</p>` : ""}
  </div>`);
}

function editor(s, id) {
  const j = id ? s.journal.find(x => x.id === id) : null;
  const prompt = j ? j.prompt : gx(JOURNAL_PROMPTS[promptIdx]);
  return html`
    ${head(j ? "עריכת רשומה" : "רשומה חדשה", { back: true, sub: j ? dateLong(j.ts) : "" })}
    <form data-form="save" class="card form">
      <div class="prompt-box">
        <p class="eyebrow">שאלה מנחה</p>
        <p class="prompt-text" data-prompt>${prompt || "כתיבה חופשית"}</p>
        <input type="hidden" name="prompt" value="${prompt}">
        ${!j ? html`<div class="row-btns"><button class="btn small ghost" type="button" data-act="nextPrompt">${icon("spark", 16)} שאלה אחרת</button><button class="btn small ghost" type="button" data-act="freePrompt">כתיבה חופשית</button></div>` : ""}
      </div>
      <label class="field"><span class="sr-only">הטקסט</span><textarea name="text" rows="9" maxlength="10000" required placeholder="לכתוב בלי לערוך. אף אחד לא קורא את זה חוץ ממך." autofocus>${j?.text || ""}</textarea></label>
      ${scale("mood", MOODS, j?.mood || 0, { legend: "מצב רוח (לא חובה)" })}
      <button class="btn primary wide" type="submit">שמירה</button>
      ${j ? html`<button class="btn danger-ghost wide" type="button" data-act="del" data-id="${j.id}">${icon("trash", 18)} מחיקה</button>` : ""}
    </form>`;
}

export default {
  title: "יומן",
  render(ctx, [tab, id]) {
    const s = ctx.state;
    if (tab === "new") return editor(s, null);
    if (tab === "edit") return editor(s, id);
    const t = TABS.some(x => x.k === tab) ? tab || "" : "";
    const body = t === "checkins" ? checkins(s) : t === "cravings" ? cravings(s) : t === "slips" ? slips(s) : entries(s);
    return html`${head("יומן")}${tabs(t, s)}<div class="list">${body}</div>`;
  },
  mount(root, ctx, [tab]) {
    // the mood scale is optional in the journal
    root.querySelectorAll('form[data-form="save"] input[name="mood"]').forEach(i => i.removeAttribute("required"));
    if (tab === "new" || tab === "edit") return;
    const inp = root.querySelector("[data-search]");
    if (!inp) return;
    let t;
    const h = () => { clearTimeout(t); t = setTimeout(() => { query = inp.value; ctx.rerender(); const n = document.querySelector("[data-search]"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); };
    inp.addEventListener("input", h);
    return () => { clearTimeout(t); inp.removeEventListener("input", h); };
  },
  forms: {
    save(fd, form, ctx, [tab, id]) {
      const text = String(fd.get("text") || "");
      if (!text.trim()) return toast("אין מה לשמור עדיין");
      const mood = Number(fd.get("mood")) || null;
      ctx.update(s => {
        if (tab === "edit") {
          const j = s.journal.find(x => x.id === id);
          if (j) { j.text = text; j.mood = mood; }
        } else {
          s.journal.push({ id: uid(), ts: new Date().toISOString(), prompt: fdStr(fd, "prompt"), text, mood });
          promptIdx = (promptIdx + 1) % JOURNAL_PROMPTS.length;
        }
      }, { render: false });
      toast("נשמר");
      ctx.go("journal");
    },
  },
  actions: {
    nextPrompt(el, ctx) {
      promptIdx = (promptIdx + 1) % JOURNAL_PROMPTS.length;
      const p = gx(JOURNAL_PROMPTS[promptIdx]);
      const f = el.closest("form");
      f.querySelector("[data-prompt]").textContent = p;
      f.querySelector('[name="prompt"]').value = p;
    },
    freePrompt(el) {
      const f = el.closest("form");
      f.querySelector("[data-prompt]").textContent = "כתיבה חופשית";
      f.querySelector('[name="prompt"]').value = "";
    },
    async del(el, ctx) {
      if (!(await confirmDialog("למחוק את הרשומה?", "אי אפשר לשחזר אחרי מחיקה.", { ok: "מחיקה", danger: true }))) return;
      const id = el.dataset.id;
      ctx.update(s => { s.journal = s.journal.filter(j => j.id !== id); }, { render: false });
      ctx.go("journal");
    },
  },
};
