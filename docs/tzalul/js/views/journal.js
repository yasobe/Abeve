// "יומן" – one timeline for check-ins, cravings, drinks, journal and gratitude.

import { html, dayKey, parseDay, fmtDate, fmtTime, fmtNum1, calDays } from "../util.js";
import { icon, openSheet, closeSheet, confirmBox } from "../ui.js";
import { MOODS } from "../content.js";
import { openCheckin, openCraving, openDrink, openJournal, pageHead } from "./common.js";

const FILTERS = [
  ["all", "הכל"], ["journal", "יומן"], ["checkin", "צ׳ק-אין"], ["craving", "דחפים"], ["drink", "שתייה"],
];
let filter = "all";
let query = "";
let limit = 40; // day groups shown

const moodOf = v => MOODS.find(m => m.v === v);

function items(state) {
  const out = [];
  for (const [k, c] of Object.entries(state.checkins)) if (c.done || c.intention) out.push({ type: "checkin", at: c.done ? c.at : new Date(parseDay(k).setHours(8)).toISOString(), day: k, c });
  for (const c of state.cravings) out.push({ type: "craving", at: c.at, c });
  for (const d of state.drinks) out.push({ type: "drink", at: d.at, c: d });
  for (const j of state.journal) out.push({ type: "journal", at: j.at, c: j });
  for (const gr of state.gratitude) out.push({ type: "journal", sub: "grat", at: gr.at, c: gr });
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

function text(it) {
  const c = it.c;
  if (it.type === "checkin") return [c.note, c.intention, c.grateful].join(" ");
  if (it.type === "journal") return it.sub === "grat" ? c.items.join(" ") : c.text;
  return [c.note, c.learned, ...(c.triggers || []), ...(c.coping || [])].join(" ");
}

function item(it) {
  const c = it.c;
  if (it.type === "checkin") {
    const m = moodOf(c.mood);
    return html`<button class="tl-item ci" data-act="open-ci" data-day="${it.day}">
      <span class="tl-ic" aria-hidden="true">${m ? m.e : "📝"}</span>
      <span class="tl-b"><b>צ׳ק-אין${m ? ` · ${m.t}` : ""}</b>
        <span class="muted small block">${c.done ? `דחף ${c.craving ?? 0}/10 · ${c.drank ? "היה יום עם שתייה" : "יום ללא אלכוהול"}` : "רק כוונה"}</span>
        ${c.intention ? html`<span class="small block">${icon("target")} ${c.intention}</span>` : ""}
        ${c.grateful ? html`<span class="small block">🙏 ${c.grateful}</span>` : ""}
        ${c.note ? html`<span class="tl-note">${c.note}</span>` : ""}</span></button>`;
  }
  if (it.type === "craving") {
    return html`<button class="tl-item cr ${c.outcome}" data-act="open-cr" data-id="${c.id}">
      <span class="tl-ic">${icon("wave")}</span>
      <span class="tl-b"><b>דחף בעוצמה ${c.intensity}/10 · ${c.outcome === "drank" ? "הסתיים בשתייה" : "עבר"}</b>
        <span class="muted small block">${fmtTime(c.at)}${c.durationSec ? ` · ${Math.max(1, Math.round(c.durationSec / 60))} דק׳` : ""}${c.triggers.length ? ` · ${c.triggers.join(", ")}` : ""}</span>
        ${c.coping.length ? html`<span class="small block">עזר: ${c.coping.join(", ")}</span>` : ""}
        ${c.note ? html`<span class="tl-note">${c.note}</span>` : ""}</span></button>`;
  }
  if (it.type === "drink") {
    return html`<button class="tl-item dr" data-act="open-dr" data-id="${c.id}">
      <span class="tl-ic">${icon("glass")}</span>
      <span class="tl-b"><b>שתייה · ${fmtNum1(c.count)} ${c.count === 1 ? "משקה" : "משקאות"}</b>
        <span class="muted small block">${fmtTime(c.at)}${c.triggers.length ? ` · ${c.triggers.join(", ")}` : ""}</span>
        ${c.note ? html`<span class="tl-note">${c.note}</span>` : ""}
        ${c.learned ? html`<span class="small block">בפעם הבאה: ${c.learned}</span>` : ""}</span></button>`;
  }
  if (it.sub === "grat") {
    return html`<a class="tl-item jr" href="#/tools/gratitude"><span class="tl-ic" aria-hidden="true">🙏</span>
      <span class="tl-b"><b>הכרת תודה</b><span class="tl-note">${c.items.join(" · ")}</span></span></a>`;
  }
  const m = moodOf(c.mood);
  return html`<button class="tl-item jr" data-act="open-jr" data-id="${c.id}">
    <span class="tl-ic">${m ? html`<span aria-hidden="true">${m.e}</span>` : icon("edit")}</span>
    <span class="tl-b"><b>יומן</b> <span class="muted small">${fmtTime(c.at)}</span><span class="tl-note">${c.text}</span></span></button>`;
}

function dayLabel(k) {
  const d = calDays(parseDay(k), new Date());
  if (d === 0) return "היום";
  if (d === 1) return "אתמול";
  return fmtDate(parseDay(k), "long");
}

export default {
  title: "יומן",
  render(app) {
    let list = items(app.state);
    if (filter !== "all") list = list.filter(i => i.type === filter);
    const q = query.trim();
    if (q) list = list.filter(i => text(i).includes(q));
    const groups = new Map();
    for (const it of list) {
      const k = it.day || dayKey(it.at);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(it);
    }
    const keys = [...groups.keys()].sort().reverse();
    const shown = keys.slice(0, limit);
    return html`<section>
      ${pageHead("יומן", "כל מה שרשמת, במקום אחד ופרטי.")}
      <div class="j-add">
        <button class="btn primary" data-act="new-jr">${icon("edit")} כתיבה</button>
        <button class="btn" data-act="new-ci">${icon("check")} צ׳ק-אין</button>
        <button class="btn" data-act="new-cr">${icon("wave")} דחף</button>
        <button class="btn ghost" data-act="new-dr">${icon("glass")} שתייה</button>
      </div>
      <div class="j-filters">
        <div class="seg scroll" role="radiogroup" aria-label="סינון">
          ${FILTERS.map(([k, t]) => html`<label><input type="radio" name="jf" value="${k}" ${filter === k ? "checked" : ""}><span>${t}</span></label>`)}
        </div>
        <label class="search"><span class="sr">חיפוש ביומן</span>${icon("search")}<input type="search" id="jq" value="${query}" placeholder="חיפוש…" maxlength="60"></label>
      </div>
      ${shown.length ? html`<ol class="timeline">${shown.map(k => html`<li class="tl-day">
        <h2 class="tl-date">${dayLabel(k)}</h2>
        <ul>${groups.get(k).map(it => html`<li>${item(it)}</li>`)}</ul></li>`)}</ol>
        ${keys.length > limit ? html`<button class="btn ghost block" data-act="more">עוד</button>` : ""}`
      : html`<div class="empty-state"><p class="empty-ic" aria-hidden="true">📔</p>
          <p>${q ? "לא נמצאו רשומות." : "היומן עוד ריק. אפשר להתחיל בצ׳ק-אין קצר או בכמה מילים על היום."}</p></div>`}
    </section>`;
  },
  onChange(t, app) {
    if (t.name === "jf") { filter = t.value; limit = 40; app.render({ keepScroll: true }); }
  },
  onInput(t, app) {
    if (t.id === "jq") {
      query = t.value;
      clearTimeout(this._q);
      this._q = setTimeout(() => {
        app.render({ keepScroll: true });
        const el = document.getElementById("jq");
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      }, 250);
    }
  },
  actions: {
    "new-jr"(el, app) { openJournal(app); },
    "new-ci"(el, app) { openCheckin(app); },
    "new-cr"(el, app) { openCraving(app); },
    "new-dr"(el, app) { openDrink(app); },
    more(el, app) { limit += 40; app.render({ keepScroll: true }); },
    "open-ci"(el, app) { openCheckin(app, el.dataset.day); },
    "open-dr"(el, app) { const e = app.state.drinks.find(x => x.id === el.dataset.id); if (e) openDrink(app, { entry: e }); },
    "open-jr"(el, app) { const e = app.state.journal.find(x => x.id === el.dataset.id); if (e) openJournal(app, e); },
    "open-cr"(el, app) {
      const c = app.state.cravings.find(x => x.id === el.dataset.id);
      if (!c) return;
      openSheet({
        title: "דחף",
        content: html`<dl class="dl">
          <dt>מתי</dt><dd>${fmtDate(c.at, "long")}, ${fmtTime(c.at)}</dd>
          <dt>עוצמה</dt><dd>${c.intensity}/10</dd>
          <dt>תוצאה</dt><dd>${c.outcome === "drank" ? "הסתיים בשתייה" : "הדחף עבר"}</dd>
          ${c.triggers.length ? html`<dt>טריגרים</dt><dd>${c.triggers.join(", ")}</dd>` : ""}
          ${c.coping.length ? html`<dt>מה עזר</dt><dd>${c.coping.join(", ")}</dd>` : ""}
          ${c.note ? html`<dt>הערה</dt><dd>${c.note}</dd>` : ""}
        </dl>
        <button class="btn danger ghost block" data-sact="del">מחיקה</button>`,
        onAction: async act => {
          if (act !== "del") return;
          if (!(await confirmBox({ title: "למחוק את הרישום?", text: "אי אפשר לשחזר.", ok: "מחיקה", danger: true }))) return;
          app.store.update(s => { s.cravings = s.cravings.filter(x => x.id !== c.id); });
          closeSheet(true);
          app.render({ keepScroll: true });
        },
      });
    },
  },
};
