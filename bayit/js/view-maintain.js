/* Maintenance dashboard: tasks, inventory, tools, 18V batteries. Also exports shared task helpers. */
(() => {
  'use strict';
  const HB = window.HB;
  const { esc, icon } = HB;
  const S = () => HB.store.state;
  const undoable = (msg, snap, opts = {}) => HB.toast(msg, { ...opts, action: { label: 'ביטול', fn: () => { HB.store.restore(snap); HB.toast('הפעולה בוטלה', { icon: 'history' }); } } });

  /* ======================================================================
     Shared task helpers (used by home, diagrams, diagnose)
     ====================================================================== */
  HB.taskRow = (t) => {
    const st = HB.taskState(t);
    const tone = t.done ? 'muted' : HB.dueTone(t.due);
    return `<li class="row${t.done ? ' is-done' : ''}">
      <button type="button" class="checkbtn${t.done ? ' done' : ''}" data-complete="${esc(t.id)}" data-fk="c-${esc(t.id)}" aria-label="${t.done ? 'החזרה למשימות פתוחות' : 'סימון כבוצע'}: ${esc(t.title)}">${icon('check')}</button>
      <button type="button" class="row-main" data-edit-task="${esc(t.id)}">
        <span class="row-title">${esc(t.title)}</span>
        <span class="row-meta">
          ${t.done ? `<span>${icon('check')}בוצע ${esc(HB.ago(t.doneAt || t.due))}</span>` : `<span class="due ${tone}">${icon(st === 'overdue' ? 'alert' : 'calendar')}${esc(HB.rel(t.due))}</span><span class="tiny">${esc(HB.fmtDate(t.due))}</span>`}
          ${t.recur ? `<span>${icon('refresh')}${esc(HB.recurLabel(t.recur))}</span>` : ''}
          ${t.cat ? `<span>${esc(t.cat)}</span>` : ''}
        </span>
      </button>
      <span class="prio ${t.prio}" title="עדיפות ${{ high: 'גבוהה', mid: 'בינונית', low: 'נמוכה' }[t.prio]}"></span>
    </li>`;
  };

  HB.completeTask = (id) => {
    const t = S().tasks.find((x) => x.id === id); if (!t) return;
    const snap = HB.store.snap();
    if (t.done) { t.done = false; t.doneAt = null; HB.store.save(); HB.toast('המשימה הוחזרה לרשימה', { icon: 'history' }); return; }
    const today = HB.todayIso();
    if (t.recur) {
      t.history.push(today);
      t.due = HB.advance(today, t.recur);
      HB.store.save();
      undoable(`בוצע! הפעם הבאה: ${HB.fmtDate(t.due)}`, snap);
    } else {
      t.done = true; t.doneAt = today;
      HB.store.save();
      undoable('כל הכבוד — המשימה הושלמה', snap);
    }
  };

  HB.bindTaskRows = (root) => {
    root.querySelectorAll('[data-complete]').forEach((b) => b.addEventListener('click', () => {
      b.classList.add('done', 'pop');
      setTimeout(() => HB.completeTask(b.dataset.complete), HB.reducedMotion() ? 0 : 260);
    }));
    root.querySelectorAll('[data-edit-task]').forEach((b) => b.addEventListener('click', () => HB.editTask(b.dataset.editTask)));
  };

  HB.addTaskFrom = ({ title, recur = '', cat = '', notes = '', prio = 'mid', due }) => {
    if (S().tasks.some((t) => !t.done && t.title === title)) { HB.toast('המשימה כבר ברשימה', { icon: 'info' }); return false; }
    const snap = HB.store.snap();
    const t = { id: HB.uid(), title, recur, cat, notes, prio, due: due || HB.iso(HB.addDays(HB.today(), recur ? 7 : 3)), done: false, doneAt: null, history: [] };
    S().tasks.push(t);
    HB.store.save();
    HB.toast(`נוספה משימה ל־${HB.fmtDate(t.due)}`, { icon: 'calendar', action: { label: 'ביטול', fn: () => HB.store.restore(snap) } });
    return true;
  };

  HB.editTask = (id) => {
    const t = id ? S().tasks.find((x) => x.id === id) : null;
    HB.formModal({
      title: t ? 'עריכת משימה' : 'משימה חדשה', icon: 'list', submit: t ? 'שמירה' : 'הוספה',
      values: t || { due: HB.iso(HB.addDays(HB.today(), 7)), prio: 'mid', recur: '' },
      fields: [
        { name: 'title', label: 'מה צריך לעשות?', required: true, placeholder: 'למשל: ניקוי פילטרים במזגן' },
        { name: 'due', label: t && t.recur ? 'מועד הבא' : 'תאריך יעד', type: 'date', required: true, half: true },
        { name: 'recur', label: 'חזרה', type: 'select', options: HB.RECUR, half: true },
        { name: 'cat', label: 'תחום', type: 'select', options: [['', 'ללא'], ...HB.CATS.map((c) => [c, c])], half: true },
        { name: 'prio', label: 'עדיפות', type: 'select', options: [['high', 'גבוהה'], ['mid', 'בינונית'], ['low', 'נמוכה']], half: true },
        { name: 'notes', label: 'הערות', type: 'textarea', placeholder: 'פרטים, מידות, מספר טלפון של איש מקצוע…' },
      ],
      extraFooter: t ? `<button type="button" class="btn danger-ghost" data-del>${icon('trash')}מחיקה</button>` : '',
      onSubmit: (v) => {
        if (t) Object.assign(t, v);
        else S().tasks.push({ id: HB.uid(), ...v, done: false, doneAt: null, history: [] });
        HB.store.save();
        HB.toast(t ? 'המשימה עודכנה' : 'המשימה נוספה');
      },
    });
    const del = HB.$('#modal [data-del]');
    if (del) del.addEventListener('click', () => {
      const snap = HB.store.snap();
      S().tasks = S().tasks.filter((x) => x.id !== id);
      HB.store.save(); HB.closeModal(); undoable('המשימה נמחקה', snap, { icon: 'trash' });
    });
  };

  /* ======================================================================
     Tabs
     ====================================================================== */
  const ui = (HB.maintainUI = { taskFilter: 'open', taskCat: '', invQ: '', invCat: '', invLow: false });

  const TABS = [
    { id: 'tasks', label: 'משימות', icon: 'list', count: () => S().tasks.filter((t) => !t.done).length, hot: () => S().tasks.some((t) => HB.taskState(t) === 'overdue') },
    { id: 'inventory', label: 'מלאי חומרים', icon: 'box', count: () => S().inventory.filter(HB.lowStock).length, hot: () => S().inventory.some(HB.lowStock) },
    { id: 'tools', label: 'כלים', icon: 'hammer', count: () => S().tools.filter((t) => HB.daysUntil(HB.toolNext(t)) < 0).length, hot: () => S().tools.some((t) => HB.daysUntil(HB.toolNext(t)) < 0) },
    { id: 'batteries', label: 'סוללות 18V', icon: 'battery', count: () => S().batteries.filter(HB.batteryNeedsAttention).length, hot: () => S().batteries.some(HB.batteryNeedsAttention) },
  ];

  /* ---------------- tasks ---------------- */
  function tasksTab() {
    const all = S().tasks.filter((t) => !ui.taskCat || t.cat === ui.taskCat);
    const open = all.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due));
    const done = all.filter((t) => t.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
    const groups = [
      ['overdue', 'באיחור', 'danger'], ['week', 'השבוע', ''], ['later', 'בהמשך', ''],
    ].map(([k, l, c]) => [k, l, c, open.filter((t) => HB.taskState(t) === k)]);
    const filters = [['open', 'פתוחות', open.length], ['overdue', 'באיחור', groups[0][3].length], ['week', 'השבוע', groups[1][3].length], ['done', 'הושלמו', done.length]];
    const cats = [...new Set(S().tasks.map((t) => t.cat).filter(Boolean))];

    let body;
    if (ui.taskFilter === 'done') body = done.length ? `<ul class="rows">${done.map(HB.taskRow).join('')}</ul>` : empty('check', 'עוד לא הושלמו משימות', 'משימות חד־פעמיות שתסמן יופיעו כאן.');
    else {
      const gs = groups.filter(([k]) => ui.taskFilter === 'open' || ui.taskFilter === k).filter((g) => g[3].length);
      body = gs.length ? gs.map(([, l, c, list]) => `<div class="group-title ${c}">${l}<span class="badge ${c || 'muted'}">${list.length}</span></div><ul class="rows">${list.map(HB.taskRow).join('')}</ul>`).join('')
        : empty('sparkle', ui.taskFilter === 'overdue' ? 'אין משימות באיחור' : 'אין משימות כאן', 'נהדר! אפשר להוסיף משימה חדשה או לבחור מההמלצות העונתיות בלוח הבקרה.');
    }
    return `
      <div class="toolbar">
        <div class="seg" role="tablist" aria-label="סינון משימות">${filters.map(([k, l, n]) => `<button type="button" role="tab" data-tf="${k}" aria-selected="${ui.taskFilter === k}">${l}<span class="count${k === 'overdue' && n ? ' hot' : ''}">${n}</span></button>`).join('')}</div>
        ${cats.length ? `<select aria-label="סינון לפי תחום" data-tcat><option value="">כל התחומים</option>${cats.map((c) => `<option${c === ui.taskCat ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>` : ''}
        <span class="spacer"></span>
        <button type="button" class="btn primary" data-new-task>${icon('plus')}משימה חדשה</button>
      </div>
      <section class="card">${body}</section>`;
  }

  /* ---------------- inventory ---------------- */
  const buyQty = (it) => Math.max(1, Math.ceil(Math.max(it.min, 1) * 2 - it.qty));
  function invTab() {
    const inv = S().inventory;
    const q = ui.invQ.trim();
    const list = inv.filter((i) => (!ui.invCat || i.cat === ui.invCat) && (!ui.invLow || HB.lowStock(i)) && (!q || HB.fuzzy(`${i.name} ${i.loc} ${i.cat}`, q) || i.name.includes(q)))
      .sort((a, b) => (HB.lowStock(b) - HB.lowStock(a)) || a.cat.localeCompare(b.cat, 'he') || a.name.localeCompare(b.name, 'he'));
    const low = inv.filter(HB.lowStock);
    const cats = [...new Set(inv.map((i) => i.cat).filter(Boolean))];
    const row = (i) => {
      const isLow = HB.lowStock(i); const out = i.qty <= 0;
      const pct = HB.clamp(i.qty / Math.max(1, i.min * 2), 0, 1) * 100;
      return `<li class="inv-row">
        <button type="button" class="row-main" data-edit-inv="${esc(i.id)}">
          <span class="row-title">${esc(i.name)} ${out ? '<span class="badge danger">אזל</span>' : isLow ? '<span class="badge warn">נמוך</span>' : ''}</span>
          <span class="row-meta">${i.loc ? `<span>${esc(i.loc)}</span>` : ''}${i.cat ? `<span>${esc(i.cat)}</span>` : ''}<span>מינימום ${HB.fmtNum(i.min)}</span></span>
        </button>
        <div class="meter ${out ? 'danger' : isLow ? 'warn' : 'ok'}" title="${HB.fmtNum(i.qty)} מתוך יעד ${HB.fmtNum(i.min * 2)}"><i style="width:${pct}%"></i></div>
        <div class="stepper" role="group" aria-label="כמות: ${esc(i.name)}">
          <button type="button" data-inc="${esc(i.id)}" data-d="1" data-fk="p-${esc(i.id)}" aria-label="הוספה">${icon('plus', 'sm')}</button>
          <output class="num">${HB.fmtNum(i.qty, 1)}<small>${esc(i.unit)}</small></output>
          <button type="button" data-inc="${esc(i.id)}" data-d="-1" data-fk="m-${esc(i.id)}" aria-label="הפחתה"${i.qty <= 0 ? ' disabled' : ''}>${icon('minus', 'sm')}</button>
        </div>
      </li>`;
    };
    return `
      <div class="toolbar">
        <label class="search"><span class="sr-only">חיפוש במלאי</span>${icon('search')}<input type="search" placeholder="חיפוש פריט או מיקום…" value="${esc(ui.invQ)}" data-invq data-fk="invq"></label>
        ${cats.length ? `<select aria-label="סינון לפי תחום" data-invcat><option value="">כל התחומים</option>${cats.map((c) => `<option${c === ui.invCat ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>` : ''}
        <button type="button" class="chip" aria-pressed="${ui.invLow}" data-invlow>${icon('alert', 'sm')}רק חסרים<span class="count">${low.length}</span></button>
        <span class="spacer"></span>
        <button type="button" class="btn outline" data-shoplist${low.length ? '' : ' disabled'}>${icon('cart')}רשימת קניות</button>
        <button type="button" class="btn primary" data-new-inv>${icon('plus')}פריט חדש</button>
      </div>
      <section class="card">${list.length ? `<ul class="rows">${list.map(row).join('')}</ul>` : empty('box', inv.length ? 'אין פריטים תואמים' : 'המלאי ריק', inv.length ? 'נסה חיפוש אחר או בטל סינון.' : 'הוסף חומרים שיש לך בבית — סיליקון, ברגים, טפלון — כדי שהאבחון ידע מה כבר במלאי.')}</section>`;
  }

  function editInv(id) {
    const it = id ? S().inventory.find((x) => x.id === id) : null;
    HB.formModal({
      title: it ? 'עריכת פריט' : 'פריט חדש במלאי', icon: 'box', submit: it ? 'שמירה' : 'הוספה',
      values: it || { qty: 1, min: 1, unit: 'יח׳' },
      fields: [
        { name: 'name', label: 'שם הפריט', required: true, placeholder: 'למשל: סיליקון סניטרי שקוף' },
        { name: 'qty', label: 'כמות במלאי', type: 'number', min: 0, step: 'any', required: true, half: true },
        { name: 'unit', label: 'יחידה', list: HB.UNITS, half: true },
        { name: 'min', label: 'מינימום להתראה', type: 'number', min: 0, step: 'any', required: true, half: true, hint: 'בכמות הזו ומטה — הפריט ייכנס לרשימת הקניות' },
        { name: 'cat', label: 'תחום', type: 'select', options: [['', 'ללא'], ...HB.CATS.map((c) => [c, c])], half: true },
        { name: 'loc', label: 'מיקום', placeholder: 'ארגז כלים, מחסן, מגירה…', list: [...new Set(S().inventory.map((i) => i.loc).filter(Boolean))] },
      ],
      extraFooter: it ? `<button type="button" class="btn danger-ghost" data-del>${icon('trash')}מחיקה</button>` : '',
      onSubmit: (v) => { if (it) Object.assign(it, v); else S().inventory.push({ id: HB.uid(), ...v }); HB.store.save(); HB.toast(it ? 'הפריט עודכן' : 'הפריט נוסף למלאי'); },
    });
    const del = HB.$('#modal [data-del]');
    if (del) del.addEventListener('click', () => { const snap = HB.store.snap(); S().inventory = S().inventory.filter((x) => x.id !== id); HB.store.save(); HB.closeModal(); undoable('הפריט נמחק', snap, { icon: 'trash' }); });
  }

  function shopList() {
    const low = S().inventory.filter(HB.lowStock);
    const lines = low.map((i) => `${i.name} — ${HB.fmtNum(buyQty(i))} ${i.unit}`.trim());
    const m = HB.openModal({
      title: 'רשימת קניות', icon: 'cart',
      body: `<p class="muted" style="margin-bottom:12px">פריטים שהגיעו למינימום. הכמות המוצעת משלימה לפעמיים המינימום.</p>
        <ul class="shop-list">${low.map((i) => `<li><span>${esc(i.name)}</span><b class="num">${HB.fmtNum(buyQty(i))} ${esc(i.unit)}</b></li>`).join('')}</ul>`,
      footer: `<button type="button" class="btn outline" data-restock>${icon('check')}קניתי הכול</button><span class="spacer"></span>${navigator.share ? `<button type="button" class="btn soft" data-share>${icon('share')}שיתוף</button>` : ''}<button type="button" class="btn primary" data-copy>${icon('copy')}העתקה</button>`,
    });
    const text = `רשימת קניות לבית:\n${lines.map((l) => `• ${l}`).join('\n')}`;
    m.el.querySelector('[data-copy]').addEventListener('click', async () => HB.toast((await HB.copy(text)) ? 'הרשימה הועתקה' : 'ההעתקה נכשלה', { icon: 'copy' }));
    const sh = m.el.querySelector('[data-share]');
    if (sh) sh.addEventListener('click', () => navigator.share({ title: 'רשימת קניות', text }).catch(() => {}));
    m.el.querySelector('[data-restock]').addEventListener('click', () => {
      const snap = HB.store.snap();
      low.forEach((i) => { i.qty += buyQty(i); });
      HB.store.save(); HB.closeModal(); undoable(`המלאי עודכן — ${low.length} פריטים`, snap, { icon: 'box' });
    });
  }

  /* ---------------- tools ---------------- */
  function toolsTab() {
    const tools = [...S().tools].sort((a, b) => HB.toolNext(a).localeCompare(HB.toolNext(b)));
    const card = (t) => {
      const next = HB.toolNext(t); const n = HB.daysUntil(next);
      const span = Math.max(1, HB.daysUntil(next) - HB.daysUntil(t.last));
      const used = HB.clamp(-HB.daysUntil(t.last) / span, 0, 1);
      const tone = n < 0 ? 'danger' : n <= 14 ? 'warn' : 'ok';
      return `<article class="card tool">
        <div class="tool-top">
          <span class="tool-ic">${icon(t.v18 ? 'zap' : t.kind === 'ציוד' ? 'tool' : 'hammer')}</span>
          <div style="flex:1;min-width:0"><h3>${esc(t.name)}</h3><p>${esc(t.kind)}${t.v18 ? ' · פלטפורמת 18V' : ''}</p></div>
          <span class="badge ${tone}">${n < 0 ? icon('alert') : ''}${n < 0 ? 'לטיפול' : n <= 14 ? 'בקרוב' : 'תקין'}</span>
        </div>
        <p class="tool-svc">${icon('wrench')}<span>${esc(t.service)} · ${esc(HB.recurLabel(t.every))}</span></p>
        <div class="meter ${tone}" role="img" aria-label="${Math.round(used * 100)}% מהזמן עד הטיפול הבא עבר"><i style="width:${used * 100}%"></i></div>
        <div class="tool-dates"><span>טיפול אחרון ${esc(HB.ago(t.last))}</span><span class="due ${tone === 'ok' ? '' : tone}">${esc(HB.rel(next))}</span></div>
        ${t.notes ? `<p class="tiny">${esc(t.notes)}</p>` : ''}
        <div class="tool-foot">
          <button type="button" class="btn sm ghost" data-edit-tool="${esc(t.id)}">${icon('edit', 'sm')}עריכה</button>
          <button type="button" class="btn sm ${n < 0 ? 'primary' : 'outline'}" data-serviced="${esc(t.id)}" data-fk="sv-${esc(t.id)}">${icon('check', 'sm')}בוצע טיפול</button>
        </div>
      </article>`;
    };
    return `
      <div class="toolbar"><p class="muted" style="flex:1">מעקב טיפול תקופתי — להבים, פילטרים, פחמים ובדיקות בטיחות.</p><button type="button" class="btn primary" data-new-tool>${icon('plus')}כלי חדש</button></div>
      ${tools.length ? `<div class="tool-grid">${tools.map(card).join('')}</div>` : `<section class="card">${empty('hammer', 'אין כלים ברשימה', 'הוסף את הכלים שלך כדי לקבל תזכורות טיפול.')}</section>`}`;
  }

  function editTool(id) {
    const t = id ? S().tools.find((x) => x.id === id) : null;
    HB.formModal({
      title: t ? 'עריכת כלי' : 'כלי חדש', icon: 'hammer', submit: t ? 'שמירה' : 'הוספה',
      values: t || { every: 'y1', last: HB.todayIso(), kind: 'כלי סוללה', v18: true },
      fields: [
        { name: 'name', label: 'שם הכלי', required: true, placeholder: 'למשל: מברגת אימפקט' },
        { name: 'kind', label: 'סוג', list: ['כלי סוללה', 'כלי חשמלי', 'כלי ידני', 'מטען', 'ציוד'], half: true },
        { name: 'v18', label: 'פלטפורמה', type: 'checkbox', checkLabel: 'עובד עם סוללות 18V', half: true },
        { name: 'service', label: 'מה כולל הטיפול', required: true, placeholder: 'ניקוי, השחזת להב, החלפת פילטר…' },
        { name: 'every', label: 'תדירות', type: 'select', options: HB.RECUR.filter((r) => r[0]), half: true },
        { name: 'last', label: 'טיפול אחרון', type: 'date', required: true, half: true },
        { name: 'notes', label: 'הערות', type: 'textarea', placeholder: 'מידת להב, מספר דגם, מקום קנייה…' },
      ],
      extraFooter: t ? `<button type="button" class="btn danger-ghost" data-del>${icon('trash')}מחיקה</button>` : '',
      onSubmit: (v) => { if (t) Object.assign(t, v); else S().tools.push({ id: HB.uid(), ...v }); HB.store.save(); HB.toast(t ? 'הכלי עודכן' : 'הכלי נוסף'); },
    });
    const del = HB.$('#modal [data-del]');
    if (del) del.addEventListener('click', () => { const snap = HB.store.snap(); S().tools = S().tools.filter((x) => x.id !== id); HB.store.save(); HB.closeModal(); undoable('הכלי נמחק', snap, { icon: 'trash' }); });
  }

  /* ---------------- batteries ---------------- */
  /** Weekly charge counts for the last `weeks` weeks (oldest first). */
  const weekly = (b, weeks = 12) => {
    const out = Array.from({ length: weeks }, () => 0);
    b.log.forEach((d) => { const ago = -HB.daysUntil(d); const w = Math.floor(ago / 7); if (w >= 0 && w < weeks) out[weeks - 1 - w]++; });
    return out;
  };
  const spark = (b) => {
    const data = weekly(b); const max = Math.max(2, ...data); const W = 240; const H = 40; const n = data.length;
    const bw = (W - (n - 1) * 3) / n;
    const bars = data.map((v, i) => {
      // RTL: newest week on the left end of reading flow → draw oldest at right
      const x = W - (i + 1) * bw - i * 3;
      const h = v ? Math.max(4, (v / max) * H) : 2;
      const weeksAgo = n - 1 - i;
      const lbl = `${weeksAgo === 0 ? 'השבוע' : weeksAgo === 1 ? 'שבוע שעבר' : `לפני ${weeksAgo} שבועות`}: ${v} טעינות`;
      return `<g data-tip="${esc(lbl)}" data-x="${(x + bw / 2) / W}"><rect class="hit" x="${x - 1.5}" y="0" width="${bw + 3}" height="${H}"/><rect class="b${v ? '' : ' zero'}" x="${x}" y="${H - h}" width="${bw}" height="${h}" rx="${Math.min(4, bw / 2)}"/></g>`;
    }).join('');
    const total = data.reduce((a, c) => a + c, 0);
    return `<div class="spark"><div class="spark-head"><span>טעינות ב־12 השבועות האחרונים</span><span class="num">${total} סה״כ</span></div>
      <svg viewBox="0 0 ${W} ${H + 1}" preserveAspectRatio="none" role="img" aria-label="טעינות שבועיות, סה״כ ${total} ב־12 שבועות">${bars}<line class="base" x1="0" y1="${H + 0.5}" x2="${W}" y2="${H + 0.5}"/></svg></div>`;
  };

  function batTab() {
    const bats = S().batteries;
    const xs = bats.map(HB.battery);
    const avg = bats.length ? Math.round(xs.reduce((a, x) => a + x.health, 0) / bats.length) : 0;
    const month = bats.reduce((a, b) => a + b.log.filter((d) => HB.daysUntil(d) > -30).length, 0);
    const totalAh = bats.reduce((a, b) => a + b.ah, 0);
    const card = (b, x) => `
      <article class="card bat" data-bat="${esc(b.id)}">
        <div class="bat-top">
          <h3>${icon('battery')}${esc(b.label)}<span class="bat-cap">${HB.fmtNum(b.ah, 1)}Ah</span></h3>
          <span class="badge ${x.tone}">${x.tone === 'danger' ? icon('alert') : x.tone === 'ok' ? icon('check') : ''}${esc(x.status)}</span>
        </div>
        <div class="bat-body">
          ${HB.ring(b.cycles / b.rated, { size: 92, stroke: 9, tone: x.wear >= 0.9 ? 'danger' : x.wear >= 0.75 ? 'warn' : 'accent', label: HB.fmtNum(b.cycles), sub: `מתוך ${HB.fmtNum(b.rated)}` })}
          <div class="bat-stats">
            <div><span>קיבולת שנותרה</span><b>${x.health}%</b></div>
            <div class="meter ${x.tone}" role="img" aria-label="בריאות ${x.health}%"><i style="width:${x.health}%"></i></div>
            <div><span>קיבולת בפועל</span><b><bdi dir="ltr">~${HB.fmtNum(x.effAh, 1)}Ah</bdi></b></div>
            <div><span>גיל</span><b>${x.ageY < 1 ? `${Math.max(1, Math.round(x.ageY * 12))} חודשים` : `${HB.fmtNum(x.ageY, 1)} שנים`}</b></div>
            <div><span>טעינה אחרונה</span><b>${x.last ? esc(HB.ago(x.last)) : '—'}</b></div>
          </div>
        </div>
        ${spark(b)}
        ${x.flags.length ? `<div class="flags">${x.flags.map((f) => `<div class="flag ${f.tone}">${icon(f.tone === 'info' ? 'clock' : 'alert')}${esc(f.text)}</div>`).join('')}</div>` : ''}
        ${b.notes ? `<p class="tiny">${esc(b.notes)}</p>` : ''}
        <div class="bat-actions">
          <button type="button" class="btn primary" data-charge="${esc(b.id)}" data-fk="ch-${esc(b.id)}">${icon('charge')}רישום טעינה</button>
          <button type="button" class="btn outline icon" data-edit-bat="${esc(b.id)}" aria-label="עריכת ${esc(b.label)}">${icon('edit')}</button>
        </div>
      </article>`;
    return `
      <div class="bat-summary">
        <div class="card stat"><b>${bats.length}</b><span>סוללות · ${HB.fmtNum(totalAh, 1)}Ah סה״כ</span></div>
        <div class="card stat"><b>${avg}%</b><span>קיבולת ממוצעת שנותרה</span></div>
        <div class="card stat"><b>${HB.fmtNum(bats.reduce((a, b) => a + b.cycles, 0))}</b><span>מחזורי טעינה מצטברים</span></div>
        <div class="card stat"><b>${month}</b><span>טעינות ב־30 הימים האחרונים</span></div>
      </div>
      <div class="toolbar"><p class="muted" style="flex:1">כל לחיצה על "רישום טעינה" מוסיפה מחזור. גם טעינה חלקית נספרת — הערכה שמרנית.</p><button type="button" class="btn primary" data-new-bat>${icon('plus')}סוללה חדשה</button></div>
      ${bats.length ? `<div class="bat-grid">${bats.map((b, i) => card(b, xs[i])).join('')}</div>` : `<section class="card">${empty('battery', 'אין סוללות ברשימה', 'הוסף את סוללות ה־18V שלך כדי לעקוב אחרי מחזורי טעינה ובריאות.')}</section>`}
      <section class="card tips">
        <h3>${icon('shield')}איך להאריך את חיי סוללות ה־Li-ion</h3>
        <ul>
          <li>${icon('check')}<span>לאחסון ארוך: טען ל־40–60% (2–3 נוריות) ובדוק כל חודשיים.</span></li>
          <li>${icon('check')}<span>אל תשאיר ברכב בקיץ — מעל 45°C התאים נשחקים מהר מאוד.</span></li>
          <li>${icon('check')}<span>תן לסוללה להתקרר 15 דק׳ אחרי עבודה כבדה לפני טעינה.</span></li>
          <li>${icon('check')}<span>עדיף לטעון לפני ריקון מלא; כלי שמאט — זה הזמן להחליף.</span></li>
          <li>${icon('check')}<span>סוללה נפוחה, חמה במנוחה או עם ריח — הפסק להשתמש ומסור למחזור.</span></li>
          <li>${icon('check')}<span>נקה מגעים בבד יבש; לכלוך גורם להתחממות ולטעינה חלקית.</span></li>
        </ul>
      </section>`;
  }

  function editBat(id) {
    const b = id ? S().batteries.find((x) => x.id === id) : null;
    HB.formModal({
      title: b ? 'עריכת סוללה' : 'סוללה חדשה', icon: 'battery', submit: b ? 'שמירה' : 'הוספה',
      values: b || { label: `סוללה ${String.fromCharCode(65 + S().batteries.length % 26)}`, ah: 4, rated: 500, cycles: 0, bought: HB.todayIso() },
      fields: [
        { name: 'label', label: 'כינוי', required: true, half: true },
        { name: 'brand', label: 'יצרן / דגם', half: true, placeholder: 'אופציונלי' },
        { name: 'ah', label: 'קיבולת (Ah)', type: 'number', min: 0.5, max: 20, step: 0.5, required: true, half: true },
        { name: 'rated', label: 'מחזורי חיים מדורגים', type: 'number', min: 50, max: 5000, step: 50, required: true, half: true, hint: 'רוב סוללות 18V: 300–1,000' },
        { name: 'cycles', label: 'מחזורים עד היום', type: 'number', min: 0, step: 1, required: true, half: true },
        { name: 'bought', label: 'תאריך רכישה', type: 'date', required: true, half: true },
        { name: 'notes', label: 'הערות', type: 'textarea', placeholder: 'לאיזה כלי היא משויכת, מספר סידורי…' },
      ],
      extraFooter: b ? `<button type="button" class="btn danger-ghost" data-del>${icon('trash')}מחיקה</button>` : '',
      onSubmit: (v) => {
        v.cycles = Math.round(v.cycles);
        if (b) Object.assign(b, v); else S().batteries.push({ id: HB.uid(), ...v, log: [] });
        HB.store.save(); HB.toast(b ? 'הסוללה עודכנה' : 'הסוללה נוספה');
      },
    });
    const del = HB.$('#modal [data-del]');
    if (del) del.addEventListener('click', () => { const snap = HB.store.snap(); S().batteries = S().batteries.filter((x) => x.id !== id); HB.store.save(); HB.closeModal(); undoable('הסוללה נמחקה', snap, { icon: 'trash' }); });
  }

  const empty = (ic, h, p) => `<div class="empty">${icon(ic)}<h3>${esc(h)}</h3><p>${esc(p)}</p></div>`;

  /* ======================================================================
     View
     ====================================================================== */
  HB.views.maintain = {
    live: true,
    render(el, args) {
      const tab = TABS.find((t) => t.id === args[0]) || TABS[0];
      const content = { tasks: tasksTab, inventory: invTab, tools: toolsTab, batteries: batTab }[tab.id]();
      el.innerHTML = `
        <header class="page-head"><div>
          <div class="eyebrow">${icon('wrench', 'sm')} לוח תחזוקה</div>
          <h1>תחזוקת הבית</h1>
          <p>משימות קבועות, מלאי חומרים, טיפול בכלים ומעקב מחזורי טעינה לסוללות 18V — במקום אחד.</p>
        </div></header>
        <div class="seg m-tabs" role="tablist" aria-label="אזורי תחזוקה">
          ${TABS.map((t) => { const n = t.count(); return `<button type="button" role="tab" data-tab="${t.id}" aria-selected="${t === tab}">${icon(t.icon, 'sm')}${t.label}${n ? `<span class="count${t.hot() ? ' hot' : ''}">${n}</span>` : ''}</button>`; }).join('')}
        </div>
        <div class="m-body" role="tabpanel">${content}</div>`;

      el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => HB.go(`maintain/${b.dataset.tab}`)));
      const on = (sel, ev, fn) => el.querySelectorAll(sel).forEach((x) => x.addEventListener(ev, fn));

      // tasks
      HB.bindTaskRows(el);
      on('[data-tf]', 'click', (e) => { ui.taskFilter = e.currentTarget.dataset.tf; HB.refresh(); });
      on('[data-tcat]', 'change', (e) => { ui.taskCat = e.target.value; HB.refresh(); });
      on('[data-new-task]', 'click', () => HB.editTask(null));

      // inventory
      on('[data-invq]', 'input', (e) => { ui.invQ = e.target.value; const pos = e.target.selectionStart; HB.refresh(); const i = el.querySelector('[data-invq]'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } });
      on('[data-invcat]', 'change', (e) => { ui.invCat = e.target.value; HB.refresh(); });
      on('[data-invlow]', 'click', () => { ui.invLow = !ui.invLow; HB.refresh(); });
      on('[data-inc]', 'click', (e) => {
        const b = e.currentTarget; const it = S().inventory.find((x) => x.id === b.dataset.inc); if (!it) return;
        const wasLow = HB.lowStock(it);
        it.qty = Math.max(0, Math.round((it.qty + +b.dataset.d) * 100) / 100);
        HB.store.save();
        if (!wasLow && HB.lowStock(it)) HB.toast(`${it.name} נכנס לרשימת הקניות`, { icon: 'cart' });
      });
      on('[data-edit-inv]', 'click', (e) => editInv(e.currentTarget.dataset.editInv));
      on('[data-new-inv]', 'click', () => editInv(null));
      on('[data-shoplist]', 'click', shopList);

      // tools
      on('[data-new-tool]', 'click', () => editTool(null));
      on('[data-edit-tool]', 'click', (e) => editTool(e.currentTarget.dataset.editTool));
      on('[data-serviced]', 'click', (e) => {
        const t = S().tools.find((x) => x.id === e.currentTarget.dataset.serviced); if (!t) return;
        const snap = HB.store.snap(); t.last = HB.todayIso(); HB.store.save();
        undoable(`${t.name}: הטיפול הבא ${HB.fmtDate(HB.toolNext(t))}`, snap, { icon: 'wrench' });
      });

      // batteries
      on('[data-new-bat]', 'click', () => editBat(null));
      on('[data-edit-bat]', 'click', (e) => editBat(e.currentTarget.dataset.editBat));
      on('[data-charge]', 'click', (e) => {
        const b = S().batteries.find((x) => x.id === e.currentTarget.dataset.charge); if (!b) return;
        const snap = HB.store.snap();
        b.cycles += 1; b.log.push(HB.todayIso()); if (b.log.length > 400) b.log.shift();
        HB.store.save();
        const card = el.querySelector(`[data-bat="${CSS.escape(b.id)}"]`); if (card) card.classList.add('charge-anim');
        const x = HB.battery(b);
        undoable(`${b.label}: מחזור ${HB.fmtNum(b.cycles)} נרשם${x.wear >= 0.9 ? ' · קרובה לסוף חייה' : ''}`, snap, { icon: 'charge' });
      });
      // sparkline tooltips
      el.querySelectorAll('.spark').forEach((sp) => {
        let tip = null;
        sp.addEventListener('pointerover', (e) => {
          const g = e.target.closest('g[data-tip]'); if (!g) return;
          if (!tip) { tip = document.createElement('div'); tip.className = 'spark-tip'; sp.appendChild(tip); }
          tip.textContent = g.dataset.tip;
          tip.style.right = `${(1 - +g.dataset.x) * 100}%`;
          tip.style.top = `${sp.querySelector('svg').offsetTop}px`;
        });
        sp.addEventListener('pointerleave', () => { if (tip) { tip.remove(); tip = null; } });
      });
    },
  };
})();
