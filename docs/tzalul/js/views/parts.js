// Shared view fragments and form widgets.
import { html, icon } from "../ui.js";
import { gx } from "../i18n.js";

let n = 0;
const uidLocal = p => `${p}${++n}`;

/** Page header. back: route string or true for history back. */
export function head(title, { back, sub, action } = {}) {
  return html`<header class="page-head">
    ${back ? html`<button class="icon-btn" data-act="${back === true ? "back" : "go"}" ${back !== true ? html`data-to="${back}"` : ""} aria-label="חזרה">${icon("back", 22)}</button>` : ""}
    <div class="page-head-text"><h1>${title}</h1>${sub ? html`<p class="muted">${sub}</p>` : ""}</div>
    ${action || ""}
  </header>`;
}

/** Multi- (checkbox) or single- (radio) select chips. options: [{k,label}] */
export function chips(name, options, selected = [], { type = "checkbox", required = false } = {}) {
  const sel = new Set([].concat(selected));
  return html`<div class="chips" role="group">${options.map(o => html`
    <label class="chip"><input type="${type}" name="${name}" value="${o.k}" ${sel.has(o.k) ? "checked" : ""} ${required && type === "radio" ? "required" : ""}><span>${gx(o.label)}</span></label>`)}</div>`;
}

/** Segmented control (radio). */
export function seg(name, options, value, { label = "" } = {}) {
  return html`<div class="seg" role="radiogroup" ${label ? html`aria-label="${label}"` : ""}>${options.map(o => html`
    <label><input type="radio" name="${name}" value="${o.k}" ${String(o.k) === String(value) ? "checked" : ""}><span>${o.label}</span></label>`)}</div>`;
}

/** 1..5 scale with words, as big tappable radios. */
export function scale(name, words, value, { legend } = {}) {
  return html`<fieldset class="scale">
    ${legend ? html`<legend>${legend}</legend>` : ""}
    <div class="scale-row">${words.map((w, i) => html`
      <label class="scale-opt s${i + 1}"><input type="radio" name="${name}" value="${i + 1}" ${value === i + 1 ? "checked" : ""} required>
        <span class="scale-dot" aria-hidden="true">${i + 1}</span><span class="scale-word">${w}</span></label>`)}</div>
  </fieldset>`;
}

/** Range slider with a live value. */
export function range(name, { min = 0, max = 10, step = 1, value = 0, label, words, unit = "" } = {}) {
  const id = uidLocal("rv");
  const labels = words ? words.join("|") : "";
  return html`<label class="field">
    <span class="field-label">${label} <output id="${id}" class="range-val">${words ? words[value - min] : value}</output>${unit ? html`<span class="muted small"> ${unit}</span>` : ""}</span>
    <input type="range" name="${name}" min="${min}" max="${max}" step="${step}" value="${value}" data-show="${id}" ${labels ? html`data-labels="${labels}"` : ""}>
  </label>`;
}

export function field(label, input, hint) {
  return html`<label class="field"><span class="field-label">${label}</span>${input}${hint ? html`<span class="hint">${hint}</span>` : ""}</label>`;
}

export function emptyState(ic, title, body, cta) {
  return html`<div class="empty">${icon(ic, 34)}<p class="empty-title">${title}</p>${body ? html`<p class="muted small">${body}</p>` : ""}${cta || ""}</div>`;
}

/** Article body blocks: string | {h} | {ul:[]} | {ol:[]} */
export function blocks(list) {
  return list.map(b => {
    if (typeof b === "string") return html`<p>${gx(b)}</p>`;
    if (b.h) return html`<h3>${gx(b.h)}</h3>`;
    if (b.ul) return html`<ul>${b.ul.map(x => html`<li>${gx(x)}</li>`)}</ul>`;
    if (b.ol) return html`<ol>${b.ol.map(x => html`<li>${gx(x)}</li>`)}</ol>`;
    return "";
  });
}

export const fdAll = (fd, k) => fd.getAll(k).map(String);
export const fdNum = (fd, k, def = 0) => { const v = Number(fd.get(k)); return Number.isFinite(v) ? v : def; };
export const fdStr = (fd, k) => String(fd.get(k) ?? "").trim();

/** <input type="datetime-local"> value for a Date in local time. */
export function localDT(d) {
  const x = new Date(d);
  const p = v => String(v).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
}
