/* בית בידיים — core helpers: DOM, dates, store, icons, toasts, modals, forms. */
(() => {
  'use strict';
  const HB = (window.HB = { views: {} });

  /* ---------- DOM ---------- */
  HB.$ = (s, r = document) => r.querySelector(s);
  HB.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  HB.esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  HB.uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5);
  HB.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  HB.reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- events ---------- */
  const listeners = {};
  HB.on = (ev, fn) => (listeners[ev] = listeners[ev] || []).push(fn);
  HB.emit = (ev, d) => (listeners[ev] || []).forEach((f) => f(d));

  /* ---------- dates (ISO yyyy-mm-dd, local) ---------- */
  HB.today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  HB.iso = (d) => { const z = new Date(d); return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, '0')}-${String(z.getDate()).padStart(2, '0')}`; };
  HB.todayIso = () => HB.iso(HB.today());
  HB.parse = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  HB.addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  HB.addMonths = (d, n) => {
    const x = new Date(d); const day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n);
    x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return x;
  };
  HB.daysUntil = (s) => Math.round((HB.parse(s) - HB.today()) / 864e5);
  HB.validIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(HB.parse(s));

  const fmtShort = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' });
  const fmtLong = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtDay = new Intl.DateTimeFormat('he-IL', { weekday: 'short' });
  HB.fmtDate = (s) => { const d = HB.parse(s); return (d.getFullYear() === new Date().getFullYear() ? fmtShort : fmtLong).format(d); };
  HB.fmtWeekday = (d) => fmtDay.format(d);
  HB.fmtNum = (n, digits = 0) => new Intl.NumberFormat('he-IL', { maximumFractionDigits: digits }).format(n);

  HB.daysWord = (n) => (n === 1 ? 'יום' : n === 2 ? 'יומיים' : `${n} ימים`);
  const weeksWord = (n) => (n === 1 ? 'שבוע' : n === 2 ? 'שבועיים' : `${n} שבועות`);
  const monthsWord = (n) => (n === 1 ? 'חודש' : n === 2 ? 'חודשיים' : `${n} חודשים`);
  const yearsWord = (n) => (n === 1 ? 'שנה' : n === 2 ? 'שנתיים' : `${HB.fmtNum(n, 1)} שנים`);
  HB.span = (n) => (n < 14 ? HB.daysWord(n) : n < 60 ? weeksWord(Math.round(n / 7)) : n < 365 ? monthsWord(Math.round(n / 30)) : yearsWord(Math.round((n / 365) * 2) / 2));

  /** Relative phrase for a due date ("היום", "בעוד 3 ימים", "באיחור של יומיים"). */
  HB.rel = (s) => {
    const n = HB.daysUntil(s);
    if (n === 0) return 'היום';
    if (n === 1) return 'מחר';
    if (n === -1) return 'אתמול (באיחור)';
    if (n < 0) return `באיחור של ${HB.span(-n)}`;
    return `בעוד ${HB.span(n)}`;
  };
  /** Relative phrase for a past date ("לפני שבועיים"). */
  HB.ago = (s) => {
    const n = -HB.daysUntil(s);
    if (n <= 0) return 'היום';
    if (n === 1) return 'אתמול';
    return `לפני ${HB.span(n)}`;
  };
  HB.dueTone = (s) => { const n = HB.daysUntil(s); return n < 0 ? 'danger' : n <= 3 ? 'warn' : n <= 14 ? 'info' : 'muted'; };

  /* ---------- recurrence ---------- */
  HB.RECUR = [
    ['', 'חד־פעמי'], ['w1', 'כל שבוע'], ['w2', 'כל שבועיים'], ['m1', 'כל חודש'], ['m3', 'כל 3 חודשים'],
    ['m6', 'כל חצי שנה'], ['y1', 'כל שנה'], ['y2', 'כל שנתיים'], ['y3', 'כל 3 שנים'],
  ];
  HB.recurLabel = (code) => (HB.RECUR.find((r) => r[0] === code) || HB.RECUR[0])[1];
  HB.advance = (iso, code) => {
    if (!code) return iso;
    const d = HB.parse(iso); const n = +code.slice(1) || 1; const u = code[0];
    return HB.iso(u === 'w' ? HB.addDays(d, 7 * n) : u === 'm' ? HB.addMonths(d, n) : HB.addMonths(d, 12 * n));
  };

  /* ---------- store ---------- */
  const KEY = 'bayit.v1';
  HB.store = {
    state: null,
    load() {
      let s = null;
      try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
      this.state = HB.clean(s && s.v === 1 ? s : HB.seed());
      return this.state;
    },
    save(silent) {
      try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { /* private mode / quota */ }
      if (!silent) HB.emit('change');
    },
    /** Snapshot for undo. */
    snap() { return JSON.stringify(this.state); },
    restore(json) { this.state = JSON.parse(json); this.save(); },
  };

  /** Sanitize a loaded / imported state so bad data can't break the UI. */
  HB.clean = (s) => {
    const str = (v, max = 200) => String(v ?? '').slice(0, max);
    const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
    const date = (v, d) => (HB.validIso(v) ? v : d);
    const recur = (v) => (HB.RECUR.some((r) => r[0] === v) ? v : '');
    const arr = (v) => (Array.isArray(v) ? v : []);
    const t = HB.todayIso();
    return {
      v: 1,
      tasks: arr(s.tasks).slice(0, 500).map((x) => ({
        id: str(x.id, 40) || HB.uid(), title: str(x.title, 120) || 'משימה', cat: str(x.cat, 40),
        due: date(x.due, t), recur: recur(x.recur), prio: ['low', 'mid', 'high'].includes(x.prio) ? x.prio : 'mid',
        notes: str(x.notes, 1000), done: !!x.done, doneAt: x.doneAt ? date(x.doneAt, null) : null,
        history: arr(x.history).filter(HB.validIso).slice(-50),
      })),
      inventory: arr(s.inventory).slice(0, 500).map((x) => ({
        id: str(x.id, 40) || HB.uid(), name: str(x.name, 80) || 'פריט', cat: str(x.cat, 40), qty: Math.max(0, num(x.qty)),
        unit: str(x.unit, 20), min: Math.max(0, num(x.min)), loc: str(x.loc, 60),
      })),
      tools: arr(s.tools).slice(0, 200).map((x) => ({
        id: str(x.id, 40) || HB.uid(), name: str(x.name, 80) || 'כלי', kind: str(x.kind, 40), service: str(x.service, 120),
        every: recur(x.every) || 'y1', last: date(x.last, t), notes: str(x.notes, 500), v18: !!x.v18,
      })),
      batteries: arr(s.batteries).slice(0, 100).map((x) => ({
        id: str(x.id, 40) || HB.uid(), label: str(x.label, 60) || 'סוללה', brand: str(x.brand, 40),
        ah: HB.clamp(num(x.ah, 2), 0.5, 20), rated: HB.clamp(num(x.rated, 500), 50, 5000), cycles: Math.max(0, Math.round(num(x.cycles))),
        bought: date(x.bought, t), log: arr(x.log).filter(HB.validIso).slice(-400), notes: str(x.notes, 300),
      })),
      settings: { theme: ['light', 'dark', 'system'].includes(s.settings?.theme) ? s.settings.theme : 'system' },
      checks: typeof s.checks === 'object' && s.checks ? Object.fromEntries(Object.entries(s.checks).slice(0, 200).map(([k, v]) => [str(k, 80), arr(v).map(Number).filter(Number.isInteger).slice(0, 40)])) : {},
    };
  };

  /* ---------- icons (24×24 stroke) ---------- */
  const I = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
    compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    back: '<path d="m9 18 6-6-6-6"/>', // points right = "back" in RTL
    fwd: '<path d="m15 18-6-6 6-6"/>', // points left = "forward" in RTL
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
    edit: '<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
    battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2M6 11v2M10 11v2"/>',
    charge: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2M11 9l-2 3h3l-2 3"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
    auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5.5 12 3c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7z"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    door: '<path d="M4 21h16M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M14 12h.01"/>',
    wind: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2M17.5 8a2.5 2.5 0 1 1 2 4H2M9.8 4.4A2 2 0 1 1 11 8H2"/>',
    wall: '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v6M15 9v6M9 15v6"/>',
    toilet: '<path d="M7 3h8v6H7zM4 9h14a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6zM9 15l-1 6h8l-1-6"/>',
    drain: '<circle cx="12" cy="12" r="9"/><path d="M8 9h8M7 12h10M8 15h8"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L22 7H5.1"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    hammer: '<path d="m15 12-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9"/><path d="m17.64 15 4.36-4.36M20.91 11.7l-1.25-1.25a3.2 3.2 0 0 1-.93-2.25v-.86L16 4.6A5.56 5.56 0 0 0 12.07 3H9l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h2.47l2.26 1.91"/>',
    tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    sparkle: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    snow: '<path d="M2 12h20M12 2v20M20 16l-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4"/>',
    dots: '<circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  };
  HB.icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${I[name] || I.info}</svg>`;

  /* ---------- toasts ---------- */
  HB.toast = (msg, opts = {}) => {
    const box = HB.$('#toasts');
    const el = document.createElement('div');
    el.className = `toast ${opts.tone || ''}`;
    el.innerHTML = `${HB.icon(opts.icon || (opts.tone === 'danger' ? 'alert' : 'check'))}<span>${HB.esc(msg)}</span>${opts.action ? `<button type="button" class="toast-act">${HB.esc(opts.action.label)}</button>` : ''}`;
    let timer;
    const kill = () => { clearTimeout(timer); el.classList.add('out'); setTimeout(() => el.remove(), 250); };
    if (opts.action) el.querySelector('.toast-act').addEventListener('click', () => { opts.action.fn(); kill(); });
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    timer = setTimeout(kill, opts.action ? 6500 : 3800);
    return kill;
  };

  /* ---------- modal ---------- */
  const dlg = () => HB.$('#modal');
  let onModalClose = null;
  HB.openModal = ({ title, body, footer = '', size = '', onClose, icon }) => {
    const d = dlg();
    d.className = `modal ${size}`;
    d.innerHTML = `
      <div class="modal-card">
        <header class="modal-head">
          ${icon ? `<span class="modal-ic">${HB.icon(icon)}</span>` : ''}
          <h2>${HB.esc(title)}</h2>
          <button type="button" class="btn icon ghost" data-close aria-label="סגירה">${HB.icon('x')}</button>
        </header>
        <div class="modal-body"></div>
        ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
      </div>`;
    const b = d.querySelector('.modal-body');
    if (typeof body === 'string') b.innerHTML = body; else if (body) b.appendChild(body);
    onModalClose = onClose || null;
    if (!d.open) d.showModal();
    const first = d.querySelector('[autofocus], .modal-body input, .modal-body select, .modal-body textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return { el: d, body: b, close: HB.closeModal };
  };
  HB.closeModal = () => {
    const d = dlg();
    if (!d.open) return;
    d.classList.add('closing');
    setTimeout(() => { d.classList.remove('closing'); d.close(); }, HB.reducedMotion() ? 0 : 160);
  };
  document.addEventListener('DOMContentLoaded', () => {
    const d = dlg();
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) HB.closeModal(); });
    d.addEventListener('close', () => { const f = onModalClose; onModalClose = null; d.innerHTML = ''; if (f) f(); });
    d.addEventListener('cancel', (e) => { e.preventDefault(); HB.closeModal(); });
  });

  HB.confirm = (msg, { title = 'אישור', ok = 'אישור', danger = false } = {}) =>
    new Promise((resolve) => {
      let answered = false;
      const m = HB.openModal({
        title, size: 'sm', icon: danger ? 'alert' : 'info',
        body: `<p class="confirm-msg">${HB.esc(msg)}</p>`,
        footer: `<button type="button" class="btn soft" data-close>ביטול</button><button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-ok autofocus>${HB.esc(ok)}</button>`,
        onClose: () => resolve(answered),
      });
      m.el.querySelector('[data-ok]').addEventListener('click', () => { answered = true; HB.closeModal(); });
    });

  /**
   * Build a form in a modal from a field schema.
   * field: {name,label,type:text|number|date|select|textarea,options:[[v,l]],required,min,max,step,placeholder,half,hint,list}
   */
  HB.formModal = ({ title, icon, fields, values = {}, submit = 'שמירה', onSubmit, extraFooter = '' }) => {
    const f = document.createElement('form');
    f.className = 'form-grid';
    f.noValidate = true;
    f.innerHTML = fields.map((fd) => {
      const id = `f_${fd.name}`;
      const v = values[fd.name] ?? fd.value ?? '';
      const req = fd.required ? ' required' : '';
      let ctl;
      if (fd.type === 'select') {
        ctl = `<select id="${id}" name="${fd.name}"${req}>${fd.options.map(([ov, ol]) => `<option value="${HB.esc(ov)}"${String(ov) === String(v) ? ' selected' : ''}>${HB.esc(ol)}</option>`).join('')}</select>`;
      } else if (fd.type === 'textarea') {
        ctl = `<textarea id="${id}" name="${fd.name}" rows="3" placeholder="${HB.esc(fd.placeholder || '')}">${HB.esc(v)}</textarea>`;
      } else if (fd.type === 'checkbox') {
        ctl = `<label class="check-row"><input type="checkbox" id="${id}" name="${fd.name}"${v ? ' checked' : ''}><span>${HB.esc(fd.checkLabel || fd.label)}</span></label>`;
      } else {
        const attrs = ['min', 'max', 'step'].filter((a) => fd[a] !== undefined).map((a) => ` ${a}="${fd[a]}"`).join('');
        const list = fd.list ? ` list="${id}_l"` : '';
        ctl = `<input id="${id}" name="${fd.name}" type="${fd.type || 'text'}" value="${HB.esc(v)}" placeholder="${HB.esc(fd.placeholder || '')}"${attrs}${req}${list}${fd.type === 'number' ? ' inputmode="decimal"' : ''} autocomplete="off">`
          + (fd.list ? `<datalist id="${id}_l">${fd.list.map((o) => `<option value="${HB.esc(o)}">`).join('')}</datalist>` : '');
      }
      return `<div class="field${fd.half ? ' half' : ''}">${fd.type === 'checkbox' ? '' : `<label for="${id}">${HB.esc(fd.label)}${fd.required ? ' <i class="req">*</i>' : ''}</label>`}${ctl}${fd.hint ? `<small class="hint">${HB.esc(fd.hint)}</small>` : ''}<small class="err" hidden></small></div>`;
    }).join('') + '<button type="submit" hidden></button>';

    const m = HB.openModal({
      title, icon, body: f,
      footer: `${extraFooter}<span class="spacer"></span><button type="button" class="btn soft" data-close>ביטול</button><button type="button" class="btn primary" data-submit>${HB.esc(submit)}</button>`,
    });
    const go = () => {
      let ok = true;
      const out = {};
      fields.forEach((fd) => {
        const el = f.elements[fd.name];
        const wrap = el.closest('.field');
        const err = wrap.querySelector('.err');
        let val = fd.type === 'checkbox' ? el.checked : el.value.trim();
        let msg = '';
        if (fd.required && val === '') msg = 'שדה חובה';
        if (!msg && fd.type === 'number' && val !== '') {
          const n = Number(val);
          if (!Number.isFinite(n)) msg = 'מספר לא תקין';
          else if (fd.min !== undefined && n < fd.min) msg = `מינימום ${fd.min}`;
          else if (fd.max !== undefined && n > fd.max) msg = `מקסימום ${fd.max}`;
          val = n;
        }
        if (!msg && fd.type === 'date' && val !== '' && !HB.validIso(val)) msg = 'תאריך לא תקין';
        err.hidden = !msg; err.textContent = msg; wrap.classList.toggle('invalid', !!msg);
        if (msg) ok = false;
        out[fd.name] = val;
      });
      if (!ok) { const bad = f.querySelector('.invalid input, .invalid select'); if (bad) bad.focus(); return; }
      if (onSubmit(out, m) !== false) HB.closeModal();
    };
    f.addEventListener('submit', (e) => { e.preventDefault(); go(); });
    m.el.querySelector('[data-submit]').addEventListener('click', go);
    return m;
  };

  /* ---------- misc UI ---------- */
  /** Circular progress ring as SVG. value 0..1 */
  HB.ring = (value, { size = 64, stroke = 7, tone = 'accent', label = '', sub = '' } = {}) => {
    const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const v = HB.clamp(value, 0, 1);
    return `<div class="ring tone-${tone}" style="--s:${size}px">
      <svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track" stroke-width="${stroke}"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-val" stroke-width="${stroke}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
      </svg>
      <span class="ring-label">${label}${sub ? `<small>${sub}</small>` : ''}</span>
    </div>`;
  };

  HB.download = (name, text, type = 'application/json') => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  HB.copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (_) { ok = false; } ta.remove(); return ok;
    }
  };

  /* ---------- domain helpers shared by views ---------- */
  HB.taskState = (t) => {
    if (t.done) return 'done';
    const n = HB.daysUntil(t.due);
    return n < 0 ? 'overdue' : n <= 7 ? 'week' : 'later';
  };
  HB.toolNext = (tool) => HB.advance(tool.last, tool.every);
  HB.lowStock = (it) => it.qty <= it.min;

  /** Battery health model: cycle wear + calendar ageing of Li-ion cells. */
  HB.battery = (b) => {
    const ageY = Math.max(0, -HB.daysUntil(b.bought) / 365);
    const wear = b.cycles / b.rated;
    // Rated cycles ≈ cycles to 80% capacity; wear accelerates past the rating. Plus ~2%/year calendar ageing.
    const cyc = wear <= 1 ? wear * 20 : 20 + (wear - 1) * 45;
    const health = Math.round(HB.clamp(100 - cyc - ageY * 2, 5, 100));
    const last = b.log.length ? b.log[b.log.length - 1] : null;
    const idle = last ? -HB.daysUntil(last) : null;
    const tone = health >= 85 ? 'ok' : health >= 76 ? 'warn' : 'danger';
    const status = health >= 85 ? 'תקינה' : health >= 76 ? 'שחיקה מתונה' : 'מומלץ להחליף';
    const flags = [];
    if (wear >= 0.9) flags.push({ tone: 'danger', text: `${Math.round(wear * 100)}% ממחזורי החיים נוצלו` });
    else if (wear >= 0.75) flags.push({ tone: 'warn', text: 'מתקרבת לסוף מחזורי החיים' });
    if (idle !== null && idle >= 60) flags.push({ tone: 'info', text: `לא נטענה ${HB.span(idle)} — בדוק מתח אחסון` });
    return { health, wear, ageY, last, idle, tone, status, flags, effAh: Math.round(b.ah * (health / 100) * 10) / 10 };
  };
  HB.batteryNeedsAttention = (b) => HB.battery(b).flags.length > 0 || HB.battery(b).tone === 'danger';
})();
