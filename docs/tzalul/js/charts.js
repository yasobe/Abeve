// Small dependency-free SVG/HTML charts sized to their container.
// Thin marks, 2px lines, 4px rounded data-ends, 2px surface gaps,
// a hover/focus tooltip on every mark, and a table view for each chart.

import { html, raw, esc, fmtNum, fmtNum1 } from "./util.js";

const observers = new WeakMap();

/** Render `draw(width)` into el now and whenever el is resized. */
export function mountChart(el, draw) {
  const paint = () => {
    const w = Math.max(240, Math.floor(el.clientWidth));
    if (el._w === w) return;
    el._w = w;
    el.innerHTML = String(draw(w));
  };
  paint();
  if ("ResizeObserver" in window) {
    observers.get(el)?.disconnect();
    const ro = new ResizeObserver(() => paint());
    ro.observe(el);
    observers.set(el, ro);
  }
}

/* ---------- Shared tooltip ---------- */

export function setupTooltip() {
  const tip = document.getElementById("tip");
  let cur = null;
  const show = (t, x, y) => {
    tip.textContent = t.dataset.tip;
    tip.classList.add("show");
    const r = tip.getBoundingClientRect();
    let left = x - r.width / 2, top = y - r.height - 14;
    left = Math.max(8, Math.min(window.innerWidth - r.width - 8, left));
    if (top < 8) top = y + 18;
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  };
  const hide = () => { tip.classList.remove("show"); cur = null; };
  document.addEventListener("pointermove", e => {
    const t = e.target.closest?.("[data-tip]");
    if (!t) { if (cur) hide(); return; }
    cur = t;
    show(t, e.clientX, e.clientY);
  }, { passive: true });
  document.addEventListener("focusin", e => {
    const t = e.target.closest?.("[data-tip]");
    if (!t) return;
    const r = t.getBoundingClientRect();
    show(t, r.left + r.width / 2, r.top);
  });
  document.addEventListener("focusout", hide);
  document.addEventListener("scroll", hide, { passive: true, capture: true });
  document.addEventListener("pointerdown", e => { if (!e.target.closest?.("[data-tip]")) hide(); });
}

/* ---------- Line chart (single series, gaps for missing values) ---------- */

/**
 * points: [{label, v (number|null), tip}], yMin, yMax, yTicks: [{v, label}]
 */
export function lineChart({ points, yMin, yMax, yTicks, xLabels = [], height = 180, title }) {
  return w => {
    const padL = 8, padR = 34, padT = 14, padB = 26;
    const W = w, H = height, iw = W - padL - padR, ih = H - padT - padB;
    const n = points.length;
    const x = i => padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = v => padT + ih - ((v - yMin) / (yMax - yMin)) * ih;
    let grid = "";
    for (const t of yTicks) {
      grid += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t.v)}" y2="${y(t.v)}"/>`;
      grid += `<text class="axis-t" x="${W - padR + 6}" y="${y(t.v) + 4}" text-anchor="start">${esc(t.label)}</text>`;
    }
    // segments of consecutive non-null values
    const segs = [];
    let curSeg = [];
    points.forEach((p, i) => {
      if (p.v == null) { if (curSeg.length) segs.push(curSeg); curSeg = []; }
      else curSeg.push([x(i), y(p.v)]);
    });
    if (curSeg.length) segs.push(curSeg);
    let lines = "", areas = "";
    for (const s of segs) {
      const d = s.map((pt, i) => `${i ? "L" : "M"}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join("");
      lines += `<path class="line s1" d="${d}"/>`;
      if (s.length > 1) areas += `<path class="area s1" d="${d}L${s[s.length - 1][0].toFixed(1)},${padT + ih}L${s[0][0].toFixed(1)},${padT + ih}Z"/>`;
    }
    // isolated points and last point get a dot
    let dots = "";
    points.forEach((p, i) => {
      if (p.v == null) return;
      const lone = (i === 0 || points[i - 1].v == null) && (i === n - 1 || points[i + 1].v == null);
      const last = !points.slice(i + 1).some(q => q.v != null);
      if (lone || last) dots += `<circle class="dot s1" cx="${x(i)}" cy="${y(p.v)}" r="4"/>`;
    });
    // hit columns for tooltips
    const colW = n > 1 ? iw / (n - 1) : iw;
    let hits = "";
    points.forEach((p, i) => {
      hits += `<rect class="hit" x="${(x(i) - colW / 2).toFixed(1)}" y="${padT}" width="${colW.toFixed(1)}" height="${ih}" data-tip="${esc(p.tip)}"/>`;
    });
    let xl = "";
    for (const l of xLabels) xl += `<text class="axis-t" x="${x(l.i)}" y="${H - 6}" text-anchor="middle">${esc(l.label)}</text>`;
    return `<svg class="viz" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
      ${grid}<line class="base" x1="${padL}" x2="${W - padR}" y1="${padT + ih}" y2="${padT + ih}"/>
      ${areas}${lines}${dots}${xl}<g class="hits">${hits}</g></svg>`;
  };
}

/* ---------- Stacked column chart ---------- */

/**
 * bars: [{label, values: {key: n}, tip}], series: [{key, name, cls}]
 */
export function columnChart({ bars, series, height = 180, title, xEvery = 1 }) {
  return w => {
    const padL = 8, padR = 30, padT = 12, padB = 26;
    const W = w, H = height, iw = W - padL - padR, ih = H - padT - padB;
    const totals = bars.map(b => series.reduce((s, se) => s + (b.values[se.key] || 0), 0));
    const max = Math.max(1, ...totals);
    const step = max <= 4 ? 1 : max <= 10 ? 2 : Math.ceil(max / 4);
    const top = Math.ceil(max / step) * step;
    const y = v => padT + ih - (v / top) * ih;
    const band = iw / bars.length;
    const bw = Math.min(24, band * 0.6);
    let grid = "";
    for (let v = step; v <= top; v += step) {
      grid += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/>`;
      grid += `<text class="axis-t" x="${W - padR + 6}" y="${y(v) + 4}">${fmtNum(v)}</text>`;
    }
    let marks = "", labels = "";
    bars.forEach((b, i) => {
      const cx = padL + band * i + band / 2;
      let acc = 0;
      const segs = series.map(se => ({ se, v: b.values[se.key] || 0 })).filter(s => s.v > 0);
      segs.forEach((s, j) => {
        const y0 = y(acc), y1 = y(acc + s.v);
        acc += s.v;
        const isTop = j === segs.length - 1;
        const gap = j > 0 ? 2 : 0; // 2px surface gap between stacked segments
        const hgt = Math.max(1, y0 - y1 - gap);
        const x0 = cx - bw / 2;
        const yTop = y1, r = isTop ? Math.min(4, hgt, bw / 2) : 0;
        const yBot = yTop + hgt;
        const d = r
          ? `M${x0},${yBot}V${yTop + r}Q${x0},${yTop} ${x0 + r},${yTop}H${x0 + bw - r}Q${x0 + bw},${yTop} ${x0 + bw},${yTop + r}V${yBot}Z`
          : `M${x0},${yBot}V${yTop}H${x0 + bw}V${yBot}Z`;
        marks += `<path class="bar ${s.se.cls}" d="${d}"/>`;
      });
      marks += `<rect class="hit" x="${padL + band * i}" y="${padT}" width="${band}" height="${ih}" data-tip="${esc(b.tip)}"/>`;
      if ((bars.length - 1 - i) % xEvery === 0) labels += `<text class="axis-t" x="${cx}" y="${H - 6}" text-anchor="middle">${esc(b.label)}</text>`;
    });
    return `<svg class="viz" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
      ${grid}<line class="base" x1="${padL}" x2="${W - padR}" y1="${padT + ih}" y2="${padT + ih}"/>${marks}${labels}</svg>`;
  };
}

/* ---------- Horizontal bars (HTML, RTL-native) ---------- */

export function hBars(rows, { unit = "", max } = {}) {
  if (!rows.length) return html`<p class="empty">אין עדיין נתונים.</p>`;
  const m = max || Math.max(...rows.map(r => r.n), 1);
  return html`<ul class="hbars">${rows.map(r => html`
    <li data-tip="${r.t}: ${fmtNum(r.n)} ${unit}" tabindex="0">
      <span class="hb-label">${r.t}</span>
      <span class="hb-track"><span class="hb-fill" style="inline-size:${r.n ? Math.max(2, (r.n / m) * 100).toFixed(1) : 0}%"></span></span>
      <span class="hb-val">${fmtNum(r.n)}</span>
    </li>`)}</ul>`;
}

/* ---------- Calendar heat grid ---------- */

const STATUS_T = { sober: "ללא אלכוהול", drank: "שתייה", today: "היום", none: "לפני ההתחלה" };

/** days: output of calc.dayRange, oldest first. Columns = weeks (Sun..Sat rows). */
export function heatGrid(days, fmt) {
  const first = days[0].date.getDay();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  cells.push(...days);
  const cols = Math.ceil(cells.length / 7);
  const wd = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
  return html`<div class="heat" style="--cols:${cols}">
    <div class="heat-wd" aria-hidden="true">${wd.map(d => html`<span>${d}</span>`)}</div>
    <div class="heat-grid" role="img" aria-label="לוח ימים: ימים ללא אלכוהול וימי שתייה">${cells.map(c => c
      ? html`<span class="hc ${c.status}" data-tip="${fmt(c.date)} · ${STATUS_T[c.status]}${c.drinks ? ` (${fmtNum1(c.drinks)})` : ""}${c.cravings ? ` · דחפים: ${c.cravings}` : ""}"></span>`
      : html`<span class="hc pad"></span>`)}</div>
  </div>
  <div class="legend" aria-hidden="true">
    <span><i class="hc sober"></i>ללא אלכוהול</span>
    <span><i class="hc drank"></i>שתייה</span>
    <span><i class="hc today"></i>היום</span>
    <span><i class="hc none"></i>לפני ההתחלה</span>
  </div>`;
}

/** Ring progress (SVG), value 0..1. */
export function ring(value, { size = 220, stroke = 12, label = "" } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return raw(`<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(label)}">
    <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
    <circle class="ring-fg" ${v <= 0 ? 'stroke-opacity="0"' : ""} cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"
      stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - v)).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`);
}

/** Collapsible accessible table for a chart. */
export function dataTable(caption, head, rows) {
  return html`<details class="tbl"><summary>הצגה כטבלה</summary>
    <table><caption class="sr">${caption}</caption>
      <thead><tr>${head.map(h => html`<th scope="col">${h}</th>`)}</tr></thead>
      <tbody>${rows.map(r => html`<tr>${r.map(c => html`<td>${c}</td>`)}</tr>`)}</tbody>
    </table></details>`;
}
