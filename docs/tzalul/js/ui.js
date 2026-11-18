// DOM helpers: auto-escaping html`` templates, icons, dialogs, toasts, small SVG charts.

class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = s => new Raw(String(s));

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };
export const esc = v => String(v).replace(/[&<>"'`]/g, c => ESC[c]);

function part(v) {
  if (v == null || v === false || v === true) return "";
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(part).join("");
  return esc(v);
}
/** Every interpolated value is escaped unless it is itself an html`` / raw() result. */
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
  return new Raw(out);
}

// ---- icons (24×24, stroke) ---------------------------------------------------------
const P = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V20h5v-6h4v6h5V9.5",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  lifebuoy: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6",
  book: "M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5v-15ZM4 19.5A1.5 1.5 0 0 0 5.5 21H20M8 7h8M8 11h6",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  sprout: "M12 21v-9M12 12C12 7 8 5 4 5c0 4 3 7 8 7ZM12 14c0-4 3-6 8-6 0 4-3 6-8 6Z",
  sun: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 1.5v2M12 20.5v2M3.5 12h-2M22.5 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5",
  mountain: "M2 20 9 7l4 7 2-3 7 9H2Z",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3Z",
  wave: "M2 12c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3M2 17c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z",
  tree: "M12 22v-6M12 2 5 12h4l-3 4h12l-3-4h4L12 2Z",
  medal: "M8 2h8l-2 6h-4L8 2ZM12 8a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0 3.5 1.1 2.2 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3L12 11.5Z",
  crown: "M3 18h18M4 15 3 6l5 4 4-6 4 6 5-4-1 9H4Z",
  shield: "M12 2.5 4 6v6c0 5 3.5 8.5 8 9.5 4.5-1 8-4.5 8-9.5V6l-8-3.5ZM8.5 12l2.5 2.5 4.5-5",
  check: "M4 12.5 9 17.5 20 6.5",
  pen: "M15.5 4.5l4 4L8 20H4v-4L15.5 4.5Z",
  spark: "M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3",
  coin: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM14.5 9c-.4-1-1.3-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2 0 2.8 5 1.5 5 4.3 0 1.2-1 2-2.5 2-1.3 0-2.2-.6-2.6-1.6M12 6v1.5M12 16.5V18",
  wind: "M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 2",
  walk: "M13 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM10 22l2-7 3 3v4M7 12l2-4 4-1 2 4 3 1M12 15l-1-6",
  drop: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z",
  phone: "M5 3h3.5l1.5 5-2.2 1.5a12 12 0 0 0 6.7 6.7L16 14l5 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  music: "M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  apple: "M12 7c-1-2-4-2.5-6-1s-2.5 5.5-1 9 3.5 5 5 4.5c1-.3 1.5-.5 2-.5s1 .2 2 .5c1.5.5 3.5-1 5-4.5s1-7.5-1-9-5-1-6 1ZM12 7c0-2 1-4 3-4.5",
  cup: "M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6V8ZM17 9h1.5a2.5 2.5 0 0 1 0 5H17M8 2v3M12 2v3",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  heart: "M12 20.5S3 15 3 8.8A4.8 4.8 0 0 1 12 6.5a4.8 4.8 0 0 1 9 2.3C21 15 12 20.5 12 20.5Z",
  door: "M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18M14 12h1",
  pulse: "M2 12h4l2.5-6 4 13 3-9 1.5 2H22",
  brain: "M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1ZM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1",
  people: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 14a6 6 0 0 1 4 7",
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6 6 18",
  fwd: "m15 6-6 6 6 6",
  back: "m9 6 6 6-6 6",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
  lock: "M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
  download: "M12 3v12M7 10l5 5 5-5M4 21h16",
  upload: "M12 21V9M7 14l5-5 5 5M4 3h16",
  calendar: "M4 5h16v16H4zM4 10h16M8 3v4M16 3v4",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 11v6M12 7.5v.5",
  alert: "M12 3 2 20h20L12 3ZM12 10v4M12 17v.5",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.5M3.5 12h.5M3.5 18h.5",
  gift: "M3 9h18v4H3zM5 13h14v8H5zM12 9v12M12 9C10 5 6.5 5 6.5 7S9 9 12 9Zm0 0c2-4 5.5-4 5.5-2S15 9 12 9Z",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
};
export function icon(name, size = 22, cls = "") {
  const d = P[name] || P.spark;
  return raw(`<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`);
}

// ---- feedback --------------------------------------------------------------------------
let hapticsOn = true;
export function setHaptics(on) { hapticsOn = !!on; }
export function haptic(ms = 10) {
  if (hapticsOn && navigator.vibrate) { try { navigator.vibrate(ms); } catch { /* ignore */ } }
}

let toastTimer;
export function toast(msg, kind = "") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = "toast"; }, 2800);
}

// ---- dialogs ------------------------------------------------------------------------------
/**
 * Bottom sheet (phone) / centered dialog (desktop) built on <dialog>.
 * `content` is an html`` result. `onAction(act, el, dialog)` gets [data-act] clicks;
 * returning true closes the dialog. Resolves with the close value.
 */
export function sheet(content, { onAction, onSubmit, label = "" } = {}) {
  return new Promise(resolve => {
    const d = document.createElement("dialog");
    d.className = "sheet";
    if (label) d.setAttribute("aria-label", label);
    d.innerHTML = `<div class="sheet-grip" aria-hidden="true"></div><div class="sheet-body">${part(content)}</div>`;
    document.body.appendChild(d);
    let value = null;
    const close = v => { value = v; d.close(); };
    d.addEventListener("click", async e => {
      if (e.target === d) return close(null); // backdrop
      const a = e.target.closest("[data-act]");
      if (!a || !d.contains(a)) return;
      if (a.dataset.act === "close") return close(null);
      if (onAction) {
        const r = await onAction(a.dataset.act, a, d);
        if (r !== undefined && r !== false) close(r);
      }
    });
    d.addEventListener("submit", async e => {
      e.preventDefault();
      if (!onSubmit) return;
      const r = await onSubmit(new FormData(e.target), e.target, d);
      if (r !== undefined && r !== false) close(r);
    });
    d.addEventListener("close", () => { d.remove(); resolve(value); });
    d.showModal();
    const f = d.querySelector("[autofocus]");
    if (f) f.focus();
  });
}

export function confirmDialog(title, body, { ok = "אישור", cancel = "ביטול", danger = false } = {}) {
  return sheet(html`
    <h2 class="sheet-title">${title}</h2>
    ${body ? html`<p class="muted">${body}</p>` : ""}
    <div class="row-btns">
      <button class="btn ${danger ? "danger" : "primary"}" data-act="ok">${ok}</button>
      <button class="btn ghost" data-act="close">${cancel}</button>
    </div>`, { onAction: act => (act === "ok" ? true : undefined), label: title }).then(v => v === true);
}

// ---- charts (inline SVG, theme via CSS vars) ----------------------------------------------
/** Ring progress 0..1. */
export function ring(p, size = 120, stroke = 10, cls = "") {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.min(1, Math.max(0, p)));
  return raw(`<svg class="ring ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>
    <circle class="ring-val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`);
}

/**
 * Line chart with gaps for nulls. values: number|null[], labels: string[] (sparse ok).
 * Drawn left→right in time even in RTL (time axes read LTR in Hebrew charts too).
 */
export function lineChart(values, { min = 0, max, labels = [], height = 140, cls = "", yTicks = [], fmt = v => v, title = "" } = {}) {
  const W = 320, H = height, padL = 26, padR = 8, padT = 10, padB = 22;
  const vals = values.map(v => (Number.isFinite(v) ? v : null));
  const hi = max ?? Math.max(1, ...vals.filter(v => v != null));
  const n = vals.length;
  const x = i => padL + (n <= 1 ? 0 : (i * (W - padL - padR)) / (n - 1));
  const y = v => padT + (1 - (v - min) / (hi - min || 1)) * (H - padT - padB);
  let d = "", pen = false;
  vals.forEach((v, i) => {
    if (v == null) { pen = false; return; }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
    pen = true;
  });
  const dots = vals.map((v, i) => (v == null ? "" : `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.6"><title>${esc(labels[i] || "")}: ${esc(fmt(v))}</title></circle>`)).join("");
  const grid = yTicks.map(t => `<line x1="${padL}" x2="${W - padR}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" class="grid"/><text x="${padL - 6}" y="${(y(t) + 3.5).toFixed(1)}" text-anchor="end" class="axis">${esc(fmt(t))}</text>`).join("");
  const xl = labels.map((l, i) => (l ? `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="axis">${esc(l)}</text>` : "")).join("");
  const has = vals.some(v => v != null);
  return raw(`<svg class="chart ${cls}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}" dir="ltr">${grid}${xl}
    ${has ? `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><g class="dots" fill="currentColor">${dots}</g>` : `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="axis">אין עדיין נתונים</text>`}</svg>`);
}

/** Vertical bars (e.g. cravings by hour). */
export function barChart(values, { labels = [], height = 120, cls = "", title = "", highlight = -1 } = {}) {
  const W = 320, H = height, padB = 18, padT = 6, gap = 2;
  const n = values.length, hi = Math.max(1, ...values);
  const bw = (W - gap * (n - 1)) / n;
  const bars = values.map((v, i) => {
    const h = ((H - padB - padT) * v) / hi;
    const x = i * (bw + gap);
    return `<rect x="${x.toFixed(1)}" y="${(H - padB - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(v ? 2 : 0, h).toFixed(1)}" rx="2" class="${i === highlight ? "hl" : ""}"><title>${esc(labels[i] || i)}: ${v}</title></rect>`;
  }).join("");
  const xl = labels.map((l, i) => (l ? `<text x="${(i * (bw + gap) + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle" class="axis">${esc(l)}</text>` : "")).join("");
  return raw(`<svg class="chart bars ${cls}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}" dir="ltr"><g fill="currentColor">${bars}</g>${xl}</svg>`);
}

export function download(name, text, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
