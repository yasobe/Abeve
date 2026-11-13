/* Global search and the emergency card. */
(() => {
  'use strict';
  const HB = window.HB;
  const { esc, icon } = HB;

  const norm = (s) => String(s || '').replace(/[״"׳'().,\-־/½]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const SYN = [
    ['נזילה', 'נזילות', 'דליפה', 'דולף', 'דולפת', 'מטפטף', 'טפטוף', 'נוזל', 'רטוב'],
    ['סתימה', 'סתום', 'סתומה', 'נסתם', 'לא מתנקז', 'לא יורד'],
    ['דוד', 'בוילר', 'מים חמים', 'דוד שמש'],
    ['חשמל', 'פחת', 'קצר', 'מאמ״ת', 'מא״ז', 'מפסק'],
    ['ריח', 'סרחון', 'מסריח', 'צחנה'],
    ['עובש', 'רטיבות', 'לחות', 'כתם'],
    ['תריס', 'תריסים', 'רצועה', 'גלילה'],
    ['אסלה', 'שירותים', 'הדחה', 'ניאגרה'],
    ['מזגן', 'מיזוג', 'קירור'],
    ['גלאי', 'צפצוף', 'מצפצף'],
  ].map((g) => g.map(norm));
  /** Each query word becomes a set of alternatives (the word plus its synonyms). */
  const expand = (w) => { const g = SYN.find((x) => x.some((y) => y === w || (w.length > 2 && y.startsWith(w)))); return g ? [w, ...g] : [w]; };

  /* ======================================================================
     Search
     ====================================================================== */
  function buildIndex() {
    const s = HB.store.state;
    const items = [];
    HB.TREES.forEach((t) => {
      items.push({ group: 'תקלות', icon: t.icon, title: t.title, sub: t.sub, hay: `${t.title} ${t.sub} ${t.cat}`, href: `diagnose/${t.id}` });
      Object.entries(t.sols).forEach(([id, sol]) => {
        const path = HB.solPath(t, id);
        if (!path) return;
        items.push({ group: 'פתרונות', icon: 'check', title: sol.t, sub: t.title, hay: `${sol.t} ${sol.sum} ${sol.mats.join(' ')} ${sol.tools.join(' ')}`, href: `diagnose/${t.id}/${path.join('-')}` });
      });
    });
    HB.DIAGRAMS.forEach((d) => {
      items.push({ group: 'תרשימים', icon: d.icon, title: d.title, sub: d.sub, hay: `${d.title} ${d.sub}`, href: `diagrams/${d.id}` });
      d.parts.forEach((p) => items.push({ group: 'חלקים בתרשים', icon: 'target', title: p.title, sub: d.title, hay: `${p.title} ${p.sum} ${p.issues.join(' ')}`, href: `diagrams/${d.id}/${p.id}` }));
    });
    s.tasks.forEach((t) => items.push({ group: 'המשימות שלי', icon: t.done ? 'check' : 'calendar', title: t.title, sub: t.done ? 'הושלמה' : HB.rel(t.due), hay: `${t.title} ${t.cat} ${t.notes}`, run: () => { HB.go(`maintain/tasks`); setTimeout(() => HB.editTask(t.id), 60); } }));
    s.inventory.forEach((i) => items.push({ group: 'מלאי', icon: 'box', title: i.name, sub: `${HB.fmtNum(i.qty, 1)} ${i.unit}${i.loc ? ` · ${i.loc}` : ''}`, hay: `${i.name} ${i.loc} ${i.cat}`, run: () => { HB.maintainUI.invQ = i.name; HB.maintainUI.invCat = ''; HB.maintainUI.invLow = false; HB.go('maintain/inventory'); } }));
    s.tools.forEach((t) => items.push({ group: 'כלים', icon: 'hammer', title: t.name, sub: t.service, hay: `${t.name} ${t.kind} ${t.service}`, href: 'maintain/tools' }));
    s.batteries.forEach((b) => items.push({ group: 'כלים', icon: 'battery', title: b.label, sub: `${b.ah}Ah · ${b.cycles} מחזורים`, hay: `${b.label} ${b.brand} סוללה`, href: 'maintain/batteries' }));
    return items;
  }

  HB.openSearch = () => {
    const index = buildIndex();
    const m = HB.openModal({
      title: 'חיפוש', icon: 'search', size: 'lg',
      body: `<label class="search"><span class="sr-only">חיפוש</span>${icon('search')}<input type="search" id="gsq" placeholder="תקלה, חלק, משימה או פריט במלאי…" autocomplete="off" autofocus></label>
        <div class="gs-results" role="listbox" aria-label="תוצאות"></div>`,
    });
    const input = m.body.querySelector('#gsq');
    const out = m.body.querySelector('.gs-results');
    let hits = [];
    let cur = 0;
    const SUGGEST = ['נזילה מהדוד', 'פחת קופץ', 'ריח ביוב', 'תריס', 'סתימה', 'עובש', 'מכונת כביסה', 'לחץ מים'];

    const draw = () => {
      const q = norm(input.value);
      if (!q) {
        hits = [];
        out.innerHTML = `<p class="tiny" style="margin:14px 2px 8px">חיפושים נפוצים</p><div class="chips">${SUGGEST.map((x) => `<button type="button" class="chip" data-sug="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
        return;
      }
      const words = q.split(' ');
      const alts = words.map(expand);
      const scored = [];
      index.forEach((it) => {
        const t = norm(it.title); const h = `${t} ${norm(it.hay)}`;
        if (!alts.every((a) => a.some((w) => h.includes(w)))) return;
        const score = (t.startsWith(q) ? 0 : t.includes(q) ? 1 : alts.every((a) => a.some((w) => t.includes(w))) ? 2 : 3);
        scored.push([score, it]);
      });
      scored.sort((a, b) => a[0] - b[0]);
      hits = scored.slice(0, 40).map((x) => x[1]);
      cur = 0;
      if (!hits.length) { out.innerHTML = `<div class="empty">${icon('search')}<h3>לא נמצאו תוצאות</h3><p>נסה מילה אחרת או קצרה יותר.</p></div>`; return; }
      const groups = [...new Set(hits.map((h) => h.group))];
      let n = 0;
      out.innerHTML = groups.map((g) => `<div class="gs-group">${esc(g)}</div>${hits.filter((h) => h.group === g).map((h) => { const i = hits.indexOf(h); n++; return `<button type="button" class="gs-item" role="option" data-i="${i}" aria-selected="${i === 0}">${icon(h.icon)}<span><b>${esc(h.title)}</b><small>${esc(h.sub || '')}</small></span>${icon('fwd', 'sm')}</button>`; }).join('')}`).join('');
      // keep keyboard order equal to visual order
      const visual = Array.from(out.querySelectorAll('.gs-item')).map((b) => hits[+b.dataset.i]);
      hits = visual;
      out.querySelectorAll('.gs-item').forEach((b, i) => { b.dataset.i = i; b.setAttribute('aria-selected', i === 0); });
    };
    const pick = (i) => {
      const h = hits[i]; if (!h) return;
      HB.closeModal();
      setTimeout(() => { if (h.run) h.run(); else HB.go(h.href); }, 170);
    };
    const mark = () => out.querySelectorAll('.gs-item').forEach((b, i) => { b.setAttribute('aria-selected', i === cur); if (i === cur) b.scrollIntoView({ block: 'nearest' }); });

    input.addEventListener('input', draw);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); cur = Math.min(hits.length - 1, cur + 1); mark(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); cur = Math.max(0, cur - 1); mark(); }
      if (e.key === 'Enter') { e.preventDefault(); pick(cur); }
    });
    out.addEventListener('click', (e) => {
      const s = e.target.closest('[data-sug]');
      if (s) { input.value = s.dataset.sug; draw(); input.focus(); return; }
      const b = e.target.closest('.gs-item'); if (b) pick(+b.dataset.i);
    });
    draw();
  };

  /* ======================================================================
     Emergency card
     ====================================================================== */
  HB.EMERGENCY_NUMBERS = [['משטרה', '100'], ['מד״א', '101'], ['כבאות והצלה', '102'], ['חברת החשמל', '103'], ['פיקוד העורף', '104']];

  const GUIDES = [
    { id: 'flood', icon: 'droplet', title: 'הצפה או צינור שהתפוצץ', field: 'water', steps: [
      'סגור את ברז המים הראשי של הדירה.',
      'מים מגיעים לשקעים, למכשירים או ללוח? הורד את המפסק הראשי — רק אם אתה עומד על רצפה יבשה.',
      'הרם מכשירים, כבלים וחפצים יקרים מהרצפה.',
      'צלם את הנזק לפני הניקוי (לביטוח).',
      'הזמן אינסטלטור. בבניין משותף — עדכן את השכנים מלמטה.',
    ] },
    { id: 'gas', icon: 'flame', title: 'ריח גז', field: 'gas', steps: [
      'אל תדליק ואל תכבה מתגי חשמל, אל תדליק אש ואל תשתמש בטלפון בתוך הבית.',
      'סגור את ברז הגז הראשי.',
      'פתח חלונות ודלתות לרווחה.',
      'צא מהבית, ומבחוץ התקשר לכבאות (102) ולחברת הגז.',
    ] },
    { id: 'spark', icon: 'zap', title: 'ניצוצות, עשן או ריח שרוף מחשמל', field: 'power', steps: [
      'אל תיגע באביזר או בכבל.',
      'הורד את המפסק הראשי בלוח, אם אפשר להגיע אליו בבטחה.',
      'שריפה חשמלית לא מכבים במים. השתמש במטף אבקה או CO₂.',
      'יש אש או עשן — צא מהבית וחייג 102.',
    ] },
    { id: 'outage', icon: 'sun', title: 'הפסקת חשמל', field: 'power', steps: [
      'בדוק אם לשכנים יש חשמל.',
      'רק אצלך — בדוק בלוח את ממסר הפחת והמפסק הראשי (ראה אבחון "חשמל").',
      'כל האזור — דווח לחברת החשמל במספר 103.',
      'נתק מכשירים רגישים, והשאר את המקרר סגור.',
    ] },
  ];

  const homeVal = (k) => (HB.store.state.home[k] || '').trim();

  HB.emergencyCard = () => {
    const places = HB.HOME_FIELDS.filter((f) => f[3] === 'place');
    const filled = places.filter(([k]) => homeVal(k)).length;
    return `<section class="card sos">
      <div class="card-head"><h2>${icon('siren')}כרטיס חירום</h2><button type="button" class="link btn-link" data-home-edit>${filled ? 'עריכה' : 'מילוי'} ${icon('edit', 'sm')}</button></div>
      <div class="sos-body">
        ${filled ? `<ul class="sos-places">${places.filter(([k]) => homeVal(k)).map(([k, l]) => `<li>${icon('pin', 'sm')}<span><small>${esc(l)}</small>${esc(homeVal(k))}</span></li>`).join('')}</ul>`
          : `<p class="muted">בזמן הצפה אין זמן לחפש את הברז הראשי. רשום עכשיו איפה נמצאים ברז המים, לוח החשמל וברז הגז, ואת הטלפונים של אנשי המקצוע שלך.</p>`}
        <div class="sos-actions">
          <button type="button" class="btn danger" data-sos>${icon('alert')}מה עושים עכשיו?</button>
          ${filled ? '' : `<button type="button" class="btn outline" data-home-edit>${icon('pin')}הוספת מיקומים</button>`}
        </div>
      </div>
    </section>`;
  };

  HB.editHome = () => {
    HB.formModal({
      title: 'פרטי הבית לחירום', icon: 'pin', submit: 'שמירה',
      values: HB.store.state.home,
      fields: HB.HOME_FIELDS.map(([name, label, placeholder, kind]) => ({ name, label, placeholder, type: kind === 'note' ? 'textarea' : 'text', half: kind === 'contact' })),
      onSubmit: (v) => { Object.assign(HB.store.state.home, v); HB.store.save(); HB.toast('כרטיס החירום עודכן', { icon: 'siren' }); },
    });
  };

  HB.openEmergency = (focus) => {
    const contacts = HB.HOME_FIELDS.filter(([k, , , kind]) => kind === 'contact' && homeVal(k));
    const m = HB.openModal({
      title: 'מה עושים בחירום', icon: 'siren', size: 'lg',
      body: `
        <div class="sos-numbers">${HB.EMERGENCY_NUMBERS.map(([n, num]) => `<a class="sos-num" href="tel:${num}"><b class="num">${num}</b><span>${esc(n)}</span></a>`).join('')}</div>
        <div class="sos-guides">${GUIDES.map((g) => {
          const where = homeVal(g.field);
          const fl = HB.HOME_FIELDS.find((f) => f[0] === g.field);
          return `<details class="sos-guide" ${g.id === focus ? 'open' : ''}><summary>${icon(g.icon)}<b>${esc(g.title)}</b>${icon('fwd', 'sm')}</summary>
            ${where ? `<p class="sos-where">${icon('pin', 'sm')}<span>${esc(fl[1])}: <b>${esc(where)}</b></span></p>` : ''}
            <ol>${g.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details>`;
        }).join('')}</div>
        ${contacts.length ? `<h3 class="section-title">אנשי המקצוע שלי</h3><ul class="sos-contacts">${contacts.map(([k, l]) => `<li><small>${esc(l)}</small><span class="sel">${esc(homeVal(k))}</span></li>`).join('')}</ul>` : ''}
        ${homeVal('notes') ? `<h3 class="section-title">הערות</h3><p class="sel">${esc(homeVal('notes'))}</p>` : ''}`,
      footer: `<button type="button" class="btn outline" data-edit-home>${icon('edit')}עריכת פרטי הבית</button><span class="spacer"></span><button type="button" class="btn soft" data-close>סגירה</button>`,
    });
    m.el.querySelector('[data-edit-home]').addEventListener('click', () => { HB.closeModal(); setTimeout(HB.editHome, 180); });
  };

  HB.bindEmergency = (root) => {
    root.querySelectorAll('[data-sos]').forEach((b) => b.addEventListener('click', () => HB.openEmergency()));
    root.querySelectorAll('[data-home-edit]').forEach((b) => b.addEventListener('click', HB.editHome));
  };
})();
