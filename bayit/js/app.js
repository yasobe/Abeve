/* Shell: router, navigation, theme, settings & backup. */
(() => {
  'use strict';
  const HB = window.HB;
  const { $, $$, esc, icon } = HB;

  const NAV = [
    { r: '', view: 'home', label: 'לוח בקרה', icon: 'home', key: '1' },
    { r: 'diagrams', view: 'diagrams', label: 'תרשימים', icon: 'layers', key: '2' },
    { r: 'diagnose', view: 'diagnose', label: 'אבחון תקלות', short: 'אבחון', icon: 'compass', key: '3' },
    { r: 'maintain', view: 'maintain', label: 'תחזוקה', icon: 'wrench', key: '4' },
  ];

  const overdueCount = () => HB.store.state.tasks.filter((t) => HB.taskState(t) === 'overdue').length;

  function renderNav(active) {
    const od = overdueCount();
    const dot = (n, cls) => (n.view === 'maintain' && od ? `<span class="${cls}" aria-label="${od} באיחור">${od}</span>` : '');
    $('#railNav').innerHTML = NAV.map((n) => `<a class="rail-link" href="#/${n.r}"${n.view === active ? ' aria-current="page"' : ''}>${icon(n.icon)}<span>${n.label}</span>${dot(n, 'dot')}<span class="kbd">${n.key}</span></a>`).join('');
    $('#tabbar').innerHTML = NAV.map((n) => `<a class="tab" href="#/${n.r}"${n.view === active ? ' aria-current="page"' : ''}>${icon(n.icon)}<span>${n.short || n.label}</span>${dot(n, 'dot')}</a>`).join('');
  }

  /* ---------- router ---------- */
  const parse = () => {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch (e) { return p; } });
    const view = HB.views[parts[0]] ? parts[0] : 'home';
    return { view, args: HB.views[parts[0]] ? parts.slice(1) : [] };
  };
  let current = null;

  function route() {
    const { view, args } = parse();
    const el = $('#view');
    const same = current && current.view === view;
    if (current && current.cleanup) current.cleanup();
    current = { view, args };
    const res = HB.views[view].render(el, args, { same });
    current.cleanup = typeof res === 'function' ? res : null;
    renderNav(view);
    const nav = NAV.find((n) => n.view === view);
    document.title = `${nav ? nav.label : ''} · בית בידיים`;
    if (!same) {
      window.scrollTo(0, 0);
      el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
      // Drop the entrance class once done: a lingering transform animation would make the view
      // the containing block for position:fixed children (e.g. the diagram bottom sheet).
      clearTimeout(route.t); route.t = setTimeout(() => el.classList.remove('enter'), 700);
    }
  }

  /** Re-render the current view after a data change, preserving focus by data-fk. */
  HB.refresh = () => {
    if (!current) return;
    const v = HB.views[current.view];
    renderNav(current.view);
    if (!v.live) return;
    const fk = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk : null;
    const y = window.scrollY;
    if (current.cleanup) current.cleanup();
    const el = $('#view');
    el.classList.remove('enter');
    const res = v.render(el, current.args, { same: true, refresh: true });
    current.cleanup = typeof res === 'function' ? res : null;
    window.scrollTo(0, y);
    if (fk) { const t = el.querySelector(`[data-fk="${CSS.escape(fk)}"]`); if (t) t.focus({ preventScroll: true }); }
  };
  HB.go = (path) => { const h = `#/${path}`; if (location.hash === h) route(); else location.hash = h; };
  HB.on('change', () => HB.refresh());

  /* ---------- theme ---------- */
  const THEMES = { system: ['auto', 'ערכת נושא: לפי המערכת'], light: ['sun', 'ערכת נושא: בהירה'], dark: ['moon', 'ערכת נושא: כהה'] };
  function applyTheme() {
    const t = HB.store.state.settings.theme;
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    $$('[data-act="theme"]').forEach((b) => {
      const [ic, label] = THEMES[t];
      b.innerHTML = b.classList.contains('icon') ? icon(ic) : `${icon(ic)}<span>${label}</span>`;
      b.setAttribute('aria-label', label); b.title = label;
    });
    $$('[data-act="search"]').forEach((b) => {
      b.innerHTML = b.classList.contains('icon') ? icon('search') : `${icon('search')}<span>חיפוש</span><span class="kbd">/</span>`;
      b.setAttribute('aria-label', 'חיפוש'); b.title = 'חיפוש (/)';
    });
    $$('[data-act="settings"]').forEach((b) => {
      b.innerHTML = b.classList.contains('icon') ? icon('sliders') : `${icon('sliders')}<span>הגדרות וגיבוי</span>`;
      b.setAttribute('aria-label', 'הגדרות וגיבוי'); b.title = 'הגדרות וגיבוי';
    });
  }
  HB.cycleTheme = () => {
    const order = ['system', 'light', 'dark'];
    const s = HB.store.state.settings;
    s.theme = order[(order.indexOf(s.theme) + 1) % 3];
    HB.store.save(true); applyTheme();
    HB.toast(THEMES[s.theme][1], { icon: THEMES[s.theme][0] });
  };

  /* ---------- settings & backup ---------- */
  function openSettings() {
    const s = HB.store.state;
    const t = s.settings.theme;
    const m = HB.openModal({
      title: 'הגדרות וגיבוי', icon: 'sliders',
      body: `
        <div class="field"><label>ערכת נושא</label>
          <div class="seg" role="group" aria-label="ערכת נושא">
            ${Object.entries({ system: 'לפי המערכת', light: 'בהירה', dark: 'כהה' }).map(([k, l]) => `<button type="button" data-theme-set="${k}" aria-pressed="${k === t}">${icon(THEMES[k][0], 'sm')}${l}</button>`).join('')}
          </div>
        </div>
        <h3 class="section-title" style="margin-top:22px">הנתונים שלך</h3>
        <p class="tiny" style="margin:-4px 2px 12px">כל המידע נשמר רק בדפדפן הזה. מומלץ לייצא גיבוי מדי פעם.</p>
        <div class="data-list">
          <div class="data-item"><span class="tool-ic">${icon('download')}</span><div><b>ייצוא גיבוי</b><small>${s.tasks.length} משימות · ${s.inventory.length} פריטי מלאי · ${s.tools.length} כלים · ${s.batteries.length} סוללות</small></div><button class="btn sm outline" data-x="copy">${icon('copy', 'sm')}העתקה</button><button class="btn sm outline" data-x="export">קובץ</button></div>
          <div class="data-item"><span class="tool-ic">${icon('upload')}</span><div><b>שחזור מגיבוי</b><small>מקובץ גיבוי, או מטקסט גיבוי שהעתקת</small></div><button class="btn sm outline" data-x="paste">${icon('paste', 'sm')}הדבקה</button><button class="btn sm outline" data-x="import">קובץ</button><input type="file" accept="application/json,.json" hidden data-file></div>
          <div class="data-item"><span class="tool-ic">${icon('refresh')}</span><div><b>טעינת נתוני הדגמה</b><small>מחליף את הנתונים הנוכחיים בדוגמה</small></div><button class="btn sm outline" data-x="demo">טעינה</button></div>
          <div class="data-item"><span class="tool-ic" style="color:var(--red)">${icon('trash')}</span><div><b>מחיקת כל הנתונים</b><small>מתחילים מדף נקי</small></div><button class="btn sm danger-ghost" data-x="wipe">מחיקה</button></div>
        </div>
        <p class="tiny" style="margin-top:18px">קיצורי מקלדת: / חיפוש · 1–4 מעבר בין מסכים · Esc סגירה · חיצים בין חלקים בתרשים · מספרים לבחירת תשובה באבחון.</p>`,
    });
    const b = m.body;
    b.querySelectorAll('[data-theme-set]').forEach((btn) => btn.addEventListener('click', () => {
      s.settings.theme = btn.dataset.themeSet; HB.store.save(true); applyTheme();
      b.querySelectorAll('[data-theme-set]').forEach((x) => x.setAttribute('aria-pressed', x === btn));
    }));
    const file = b.querySelector('[data-file]');
    b.addEventListener('click', async (e) => {
      const x = e.target.closest('[data-x]'); if (!x) return;
      const act = x.dataset.x;
      if (act === 'export') {
        HB.download(`bayit-backup-${HB.todayIso()}.json`, JSON.stringify(HB.store.state, null, 2));
        HB.toast('אם הקובץ לא ירד, השתמש ב"העתקה" ושמור את הטקסט בפתקים', { icon: 'download' });
      } else if (act === 'copy') {
        const ok = await HB.copy(JSON.stringify(HB.store.state));
        HB.toast(ok ? 'הגיבוי הועתק. הדבק אותו בפתקים או שלח לעצמך במייל' : 'ההעתקה נכשלה', { icon: 'copy', tone: ok ? '' : 'danger' });
      } else if (act === 'paste') {
        HB.closeModal();
        setTimeout(() => {
          const pm = HB.openModal({
            title: 'שחזור מטקסט', icon: 'paste',
            body: '<p class="muted" style="margin-bottom:10px">הדבק כאן את טקסט הגיבוי שהעתקת. הנתונים הנוכחיים יוחלפו.</p><textarea id="pasteBackup" rows="8" dir="ltr" style="font-family:ui-monospace,monospace;font-size:12px" placeholder="{&quot;v&quot;:1, ...}"></textarea>',
            footer: '<span class="spacer"></span><button type="button" class="btn soft" data-close>ביטול</button><button type="button" class="btn primary" data-restore>שחזור</button>',
          });
          pm.el.querySelector('[data-restore]').addEventListener('click', () => {
            try {
              const data = JSON.parse(pm.el.querySelector('#pasteBackup').value.trim());
              if (!data || data.v !== 1) throw new Error('bad');
              HB.store.state = HB.clean(data); HB.store.save(); applyTheme(); HB.closeModal();
              HB.toast('הגיבוי שוחזר בהצלחה');
            } catch (err) { HB.toast('הטקסט אינו גיבוי תקין. העתק אותו שוב במלואו', { tone: 'danger' }); }
          });
        }, 180);
      } else if (act === 'import') file.click();
      else if (act === 'demo') {
        if (!(await HB.confirm('הנתונים הנוכחיים יוחלפו בנתוני הדגמה.', { title: 'טעינת הדגמה', ok: 'טעינה' }))) return;
        const theme = HB.store.state.settings.theme;
        HB.store.state = HB.clean(HB.seed()); HB.store.state.settings.theme = theme; HB.store.save();
        HB.toast('נתוני ההדגמה נטענו');
      } else if (act === 'wipe') {
        if (!(await HB.confirm('כל המשימות, המלאי, הכלים והסוללות יימחקו. לא ניתן לבטל.', { title: 'מחיקת כל הנתונים', ok: 'מחיקה', danger: true }))) return;
        const theme = HB.store.state.settings.theme;
        HB.store.state = HB.clean({ v: 1, settings: { theme } }); HB.store.save();
        HB.toast('הנתונים נמחקו', { icon: 'trash' });
      }
    });
    file.addEventListener('change', () => {
      const f = file.files[0]; if (!f) return;
      if (f.size > 5e6) { HB.toast('הקובץ גדול מדי', { tone: 'danger' }); return; }
      const r = new FileReader();
      r.onload = () => {
        try {
          const data = JSON.parse(r.result);
          if (!data || data.v !== 1) throw new Error('bad');
          HB.store.state = HB.clean(data); HB.store.save(); applyTheme(); HB.closeModal();
          HB.toast('הגיבוי שוחזר בהצלחה');
        } catch (err) { HB.toast('הקובץ אינו גיבוי תקין', { tone: 'danger' }); }
      };
      r.readAsText(f);
    });
  }
  HB.openSettings = openSettings;

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    HB.store.load();
    HB.store.save(true);
    applyTheme();
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'theme') HB.cycleTheme();
      if (a.dataset.act === 'settings') openSettings();
      if (a.dataset.act === 'search') HB.openSearch();
    });
    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || $('#modal').open) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      if (e.key === '/') { e.preventDefault(); HB.openSearch(); return; }
      if (current && current.view === 'diagnose' && HB.views.diagnose.captureKeys) return;
      const n = NAV.find((x) => x.key === e.key);
      if (n) { e.preventDefault(); HB.go(n.r); }
    });
    const top = $('.topbar');
    window.addEventListener('scroll', () => top.classList.toggle('scrolled', window.scrollY > 4), { passive: true });
    window.addEventListener('storage', (e) => { if (e.key === 'bayit.v1') { HB.store.load(); applyTheme(); HB.refresh(); } });
    window.addEventListener('hashchange', route);
    route();
  });
})();
