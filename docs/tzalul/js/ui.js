// DOM helpers: icons, toasts, bottom sheets / dialogs, confirm.

import { html, raw } from "./util.js";

/* ---------- Icons (inline SVG, 24px, stroke = currentColor) ---------- */

const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
  journal: '<path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z"/><path d="M6 3v18"/><path d="M10 8h5M10 12h5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  tools: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.8-.6-.6-2.8z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  wave: '<path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M2 7c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>',
  lungs: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  back: '<path d="m9 18 6-6-6-6"/>',
  chevron: '<path d="m15 18-6-6 6-6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2.5 0 0 0-2.5-1.5c-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2A2.6 2.6 0 0 1 9.5 15M12 6v1.5M12 16.5V18"/>',
  glass: '<path d="M7 3h10l-1 9a4 4 0 0 1-8 0z"/><path d="M12 16v5M8 21h8"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-5 5-5 8-1-1-2-2-2-4-1.5 2-2 4-2 6 0 5 3 9 7 9z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  brain: '<path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 1 5 3 3 0 0 0 4 3h1V3z"/><path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-1 5 3 3 0 0 1-4 3h-1V3z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  play: '<path d="m7 4 13 8-13 8z"/>',
  pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
};

export function icon(name, cls = "") {
  return raw(`<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[name] || ""}</svg>`);
}

/* ---------- Toast ---------- */

let toastTimer;
export function toast(msg, { tone = "", action = null, ms = 3200 } = {}) {
  const el = document.getElementById("toast");
  el.className = `toast show ${tone}`;
  el.innerHTML = html`<span>${msg}</span>${action ? html`<button type="button" class="toast-btn">${action.label}</button>` : ""}`.toString();
  if (action) el.querySelector("button").onclick = () => { hideToast(); action.run(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? ms * 2 : ms);
}
export function hideToast() { document.getElementById("toast").classList.remove("show"); }

/* ---------- Sheet (modal dialog, bottom sheet on phones, centered on desktop) ---------- */

let sheetCtx = null;

/**
 * Open a sheet. `content` is SafeHTML; `onAction(act, el, form)` receives
 * clicks on [data-sact] and form submits (act = "submit").
 */
export function openSheet({ title, content, onAction, onOpen, wide = false, onClose }) {
  const dlg = document.getElementById("sheet");
  if (dlg.open) closeSheet(true);
  dlg.className = wide ? "sheet wide" : "sheet";
  dlg.innerHTML = html`
    <div class="sheet-inner">
      <header class="sheet-head">
        <h2 id="sheet-title">${title}</h2>
        <button type="button" class="icon-btn" data-sact="close" aria-label="סגירה">${icon("close")}</button>
      </header>
      <div class="sheet-body">${content}</div>
    </div>`.toString();
  dlg.setAttribute("aria-labelledby", "sheet-title");
  sheetCtx = { onAction, onClose, opener: document.activeElement };
  dlg.showModal();
  const first = dlg.querySelector("[autofocus]");
  if (first) first.focus();
  onOpen?.(dlg);
  return dlg;
}

export function closeSheet(silent = false) {
  const dlg = document.getElementById("sheet");
  if (!dlg.open) return;
  const ctx = sheetCtx;
  sheetCtx = null;
  dlg.close();
  dlg.innerHTML = "";
  if (!silent) ctx?.onClose?.();
  if (ctx?.opener && document.contains(ctx.opener)) ctx.opener.focus?.();
}

export function setupSheet() {
  const dlg = document.getElementById("sheet");
  dlg.addEventListener("click", e => {
    if (e.target === dlg) return closeSheet(); // backdrop
    const b = e.target.closest("[data-sact]");
    if (!b || !dlg.contains(b)) return;
    const act = b.dataset.sact;
    if (act === "close") return closeSheet();
    sheetCtx?.onAction?.(act, b, b.closest("form"));
  });
  dlg.addEventListener("submit", e => {
    e.preventDefault();
    sheetCtx?.onAction?.("submit", e.submitter || null, e.target);
  });
  dlg.addEventListener("cancel", e => { e.preventDefault(); closeSheet(); });
  dlg.addEventListener("input", e => {
    const t = e.target;
    if (t.type === "range" && t.dataset.out) {
      const o = dlg.querySelector(`#${CSS.escape(t.dataset.out)}`);
      if (o) o.textContent = t.value;
    }
  });
}

/** Promise-based confirm dialog. */
export function confirmBox({ title, text, ok = "אישור", cancel = "ביטול", danger = false }) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (done) return; done = true; closeSheet(true); resolve(v); };
    openSheet({
      title,
      content: html`<p class="muted">${text}</p>
        <div class="row-btns">
          <button type="button" class="btn ${danger ? "danger" : "primary"}" data-sact="ok" autofocus>${ok}</button>
          <button type="button" class="btn ghost" data-sact="cancel">${cancel}</button>
        </div>`,
      onAction: act => finish(act === "ok"),
      onClose: () => finish(false),
    });
  });
}

/* ---------- Misc ---------- */

export function vibrate(p = 12) { try { navigator.vibrate?.(p); } catch { /* unsupported */ } }

export function download(name, text, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Read a form into a plain object; multi-value checkboxes become arrays. */
export function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === "checkbox") {
      if (el.dataset.multi != null) { (o[el.name] ||= []); if (el.checked) o[el.name].push(el.value); }
      else o[el.name] = el.checked;
    } else if (el.type === "radio") { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value;
  }
  return o;
}

/** Chip group of checkboxes / radios. */
export function chips(name, options, selected = [], { multi = true } = {}) {
  const sel = new Set(selected);
  return html`<div class="chips" role="group">${options.map(o => html`
    <label class="chip"><input type="${multi ? "checkbox" : "radio"}" name="${name}" value="${o}" ${multi ? raw("data-multi") : ""} ${sel.has(o) ? raw("checked") : ""}><span>${o}</span></label>`)}</div>`;
}
