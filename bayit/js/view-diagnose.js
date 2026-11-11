/* Troubleshooting wizard view. Path lives in the URL (#/diagnose/<tree>/<0-2-1>) so Back works. */
(() => {
  'use strict';
  const HB = window.HB;
  const { esc, icon } = HB;

  const norm = (s) => String(s).replace(/[״"׳'().,\-־/½]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  HB.fuzzy = (a, b) => { const x = norm(a); const y = norm(b); return !!x && !!y && (x.includes(y) || y.includes(x)); };

  const LVL = {
    diy: ['check', 'אפשר לעשות לבד'],
    care: ['alert', 'אפשר לבד — בזהירות ובסבלנות'],
    pro: ['phone', 'מומלץ להזמין איש מקצוע'],
  };

  let filter = { q: '', cat: '' };

  function renderList(el) {
    const cats = [...new Set(HB.TREES.map((t) => t.cat))];
    const hay = (t) => norm([t.title, t.sub, t.cat, ...Object.values(t.nodes).flatMap((n) => [n.q, ...n.opts.map((o) => o[0])]), ...Object.values(t.sols).map((s) => s.t)].join(' '));
    const draw = () => {
      const q = norm(filter.q);
      const list = HB.TREES.filter((t) => (!filter.cat || t.cat === filter.cat) && (!q || hay(t).includes(q)));
      grid.innerHTML = list.length ? list.map((t) => `
        <a class="tree-card" href="#/diagnose/${t.id}">
          <span class="ti">${icon(t.icon, 'lg')}</span>
          <span class="go">${icon('fwd')}</span>
          <h3>${esc(t.title)}</h3><p>${esc(t.sub)}</p>
          <div class="meta"><span class="badge outline">${esc(t.cat)}</span><span class="badge muted">${icon('list')}עד ${HB.treeDepth(t)} שאלות</span><span class="badge muted">${Object.keys(t.sols).length} פתרונות</span></div>
        </a>`).join('') : `<div class="empty" style="grid-column:1/-1">${icon('search')}<h3>לא נמצאה תקלה מתאימה</h3><p>נסה מילה אחרת, למשל "טפטוף", "פחת" או "עובש".</p></div>`;
    };
    el.innerHTML = `
      <header class="page-head"><div>
        <div class="eyebrow">${icon('compass', 'sm')} אשף אבחון</div>
        <h1>מה התקלקל?</h1>
        <p>בחר את הבעיה, ענה על 2–3 שאלות קצרות, וקבל פתרון צעד־אחר־צעד — כולל כלים, חומרים ממלאי הבית, ואזהרות בטיחות.</p>
      </div></header>
      <div class="toolbar">
        <label class="search"><span class="sr-only">חיפוש תקלה</span>${icon('search')}<input type="search" placeholder="חיפוש: טפטוף, פחת, עובש, ריח…" value="${esc(filter.q)}" data-q></label>
      </div>
      <div class="chips scroll" role="group" aria-label="סינון לפי תחום" style="margin-bottom:16px">
        <button type="button" class="chip" aria-pressed="${!filter.cat}" data-cat="">הכול</button>
        ${cats.map((c) => `<button type="button" class="chip" aria-pressed="${filter.cat === c}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
      <div class="tree-grid"></div>`;
    const grid = el.querySelector('.tree-grid');
    el.querySelector('[data-q]').addEventListener('input', (e) => { filter.q = e.target.value; draw(); });
    el.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
      filter.cat = b.dataset.cat;
      el.querySelectorAll('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      draw();
    }));
    draw();
  }

  function needList(items, kind) {
    const s = HB.store.state;
    if (!items.length) return '<p class="tiny">לא נדרש.</p>';
    return `<ul class="need">${items.map((name) => {
      if (kind === 'tool') {
        const have = s.tools.find((t) => HB.fuzzy(t.name, name));
        return `<li>${icon('tool', 'sm')}<span>${esc(name)}</span>${have ? `<span class="badge ok">${icon('check')}יש לך</span>` : ''}</li>`;
      }
      const it = s.inventory.find((i) => HB.fuzzy(i.name, name));
      const badge = !it || it.qty <= 0 ? `<span class="badge danger">חסר</span>`
        : HB.lowStock(it) ? `<span class="badge warn">נמוך · ${HB.fmtNum(it.qty)}</span>`
          : `<span class="badge ok">במלאי · ${HB.fmtNum(it.qty)}</span>`;
      return `<li>${icon('box', 'sm')}<span>${esc(name)}</span>${badge}</li>`;
    }).join('')}</ul>`;
  }

  function renderWizard(el, tree, pathArg, view) {
    const raw = (pathArg || '').split('-').filter((x) => x !== '').map(Number);
    let nodeId = 'start'; let solId = null; const steps = [];
    for (const idx of raw) {
      const n = tree.nodes[nodeId]; const opt = n && n.opts[idx];
      if (!opt) break;
      steps.push({ idx, q: n.q, a: opt[0] });
      if (tree.nodes[opt[1]]) nodeId = opt[1]; else { solId = tree.sols[opt[1]] ? opt[1] : null; break; }
    }
    const path = steps.map((s) => s.idx);
    const href = (p) => `#/diagnose/${tree.id}${p.length ? `/${p.join('-')}` : ''}`;
    const remaining = solId ? 0 : HB.treeDepth(tree, nodeId);
    const pct = solId ? 100 : Math.max(6, (steps.length / (steps.length + remaining)) * 100);

    const head = `
      <div class="wz-top">
        <a class="btn sm ghost" href="#/diagnose">${icon('back', 'sm')}כל התקלות</a>
        <h1><span class="ti">${icon(tree.icon)}</span><span>${esc(tree.title)}</span></h1>
      </div>
      <div class="progress" role="progressbar" aria-label="התקדמות באבחון" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct}%"></i></div>
      ${steps.length ? `<div class="trail" aria-label="התשובות שלך">${steps.map((s, k) => `<button type="button" data-rewind="${k}" title="חזרה לשאלה: ${esc(s.q)}"><b>${k + 1}</b>${esc(s.a)}</button>`).join('')}</div>` : ''}`;

    if (!solId) {
      const n = tree.nodes[nodeId];
      view.captureKeys = true;
      el.innerHTML = `<div class="wz">${head}
        <section class="card q-card" aria-live="polite">
          <div class="q-step">שאלה ${steps.length + 1}${remaining > 1 ? ` · נותרו עוד ${remaining - 1} לכל היותר` : ' · אחרונה'}</div>
          <h2>${esc(n.q)}</h2>
          ${n.help ? `<p class="q-help">${icon('info', 'sm')}<span>${esc(n.help)}</span></p>` : ''}
          <div class="opts">${n.opts.map((o, i) => `<a class="opt" href="${href([...path, i])}" data-opt="${i}"><span class="k" aria-hidden="true">${i + 1}</span><span><b>${esc(o[0])}</b>${o[2] ? `<small>${esc(o[2])}</small>` : ''}</span>${icon('fwd')}</a>`).join('')}</div>
          <div class="q-foot">
            ${steps.length ? `<a class="btn ghost" href="${href(path.slice(0, -1))}">${icon('back')}שאלה קודמת</a>` : '<span></span>'}
            <span class="tiny">טיפ: אפשר ללחוץ על המספרים במקלדת</span>
          </div>
        </section></div>`;
      const onKey = (e) => {
        if (HB.$('#modal').open || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
        const i = +e.key - 1;
        if (Number.isInteger(i) && n.opts[i]) { e.preventDefault(); location.hash = href([...path, i]); }
        if (e.key === 'Backspace' && steps.length) { e.preventDefault(); location.hash = href(path.slice(0, -1)); }
      };
      document.addEventListener('keydown', onKey);
      bindTrail(el, href, path);
      return () => document.removeEventListener('keydown', onKey);
    }

    /* ---------- solution ---------- */
    const sol = tree.sols[solId];
    const key = `${tree.id}:${solId}`;
    const state = HB.store.state;
    const done = new Set(state.checks[key] || []);
    const [lic, ltext] = LVL[sol.lvl] || LVL.diy;
    const [dgId, partId] = sol.dg ? sol.dg.split(':') : [];
    const dgObj = dgId && HB.diagram(dgId);
    const part = dgObj && dgObj.parts.find((p) => p.id === partId);
    const missing = sol.mats.filter((m) => { const it = state.inventory.find((i) => HB.fuzzy(i.name, m)); return !it || it.qty <= 0; });
    const taskDef = sol.task || { title: sol.t, recur: '', cat: tree.cat };
    const taskExists = state.tasks.some((t) => !t.done && t.title === taskDef.title);

    el.innerHTML = `<div class="wz">${head}
      <article class="card sol">
        <div class="sol-band ${sol.lvl}">${icon(lic)}${ltext}</div>
        <div class="sol-head"><div class="q-step">האבחון שלנו</div><h2>${esc(sol.t)}</h2><p>${esc(sol.sum)}</p></div>
        <div class="sol-meta">
          <span class="badge muted">${icon('clock')}${esc(sol.time)}</span>
          <span class="badge muted">${HB.diffHtml(sol.diff)}</span>
          <span class="badge outline">${esc(tree.cat)}</span>
        </div>
        ${sol.safety ? `<div class="alert" role="note">${icon('shield')}<span><b>בטיחות:</b> ${esc(sol.safety)}</span></div>` : ''}
        <div class="sol-grid">
          <div>
            <h3>${icon('list', 'sm')}שלבי העבודה <span class="tiny" data-stepcount>${done.size}/${sol.steps.length} הושלמו</span></h3>
            <ol class="steps">${sol.steps.map((st, i) => `<li><label class="step${done.has(i) ? ' done' : ''}"><input type="checkbox" data-step="${i}"${done.has(i) ? ' checked' : ''}><span class="box"><span>${i + 1}</span>${icon('check')}</span><p>${esc(st)}</p></label></li>`).join('')}</ol>
          </div>
          <div>
            <h3>${icon('tool', 'sm')}כלים</h3>
            ${needList(sol.tools, 'tool')}
            <h3>${icon('box', 'sm')}חומרים <span class="tiny">מול המלאי שלך</span></h3>
            ${needList(sol.mats, 'mat')}
            ${missing.length ? `<button type="button" class="btn sm outline" data-shop>${icon('cart', 'sm')}הוספת ${missing.length} חסרים לרשימת הקניות</button>` : ''}
            ${part ? `<a class="tip" style="margin-top:14px" href="#/diagrams/${dgId}/${partId}">${icon('layers')}<span><b>ראה בתרשים:</b> ${esc(part.title)} ב${esc(dgObj.title)}</span></a>` : ''}
          </div>
        </div>
        <div class="sol-actions">
          ${taskExists ? `<span class="badge ok" style="height:40px;padding:0 14px">${icon('check')}נמצא במשימות</span>` : `<button type="button" class="btn primary" data-task>${icon('plus')}${taskDef.recur ? `הוספה כתזכורת ${esc(HB.recurLabel(taskDef.recur))}` : 'הוספה למשימות'}</button>`}
          <button type="button" class="btn outline" data-copy>${icon('copy')}העתקת סיכום</button>
          <span class="spacer"></span>
          <a class="btn ghost" href="${href(path.slice(0, -1))}">${icon('back')}לא מתאים? שאלה קודמת</a>
          <a class="btn ghost" href="#/diagnose/${tree.id}">${icon('refresh')}מההתחלה</a>
        </div>
      </article></div>`;

    bindTrail(el, href, path);
    const count = el.querySelector('[data-stepcount]');
    el.querySelectorAll('[data-step]').forEach((cb) => cb.addEventListener('change', () => {
      const i = +cb.dataset.step;
      if (cb.checked) done.add(i); else done.delete(i);
      cb.closest('.step').classList.toggle('done', cb.checked);
      state.checks[key] = [...done];
      HB.store.save(true);
      count.textContent = `${done.size}/${sol.steps.length} הושלמו`;
      if (done.size === sol.steps.length) HB.toast('כל השלבים הושלמו — עבודה יפה!', { icon: 'sparkle' });
    }));
    const t = el.querySelector('[data-task]');
    if (t) t.addEventListener('click', () => { HB.addTaskFrom({ ...taskDef, notes: `מתוך אבחון: ${tree.title}`, prio: sol.lvl === 'pro' ? 'high' : 'mid' }); renderWizard(el, tree, pathArg, view); });
    const sh = el.querySelector('[data-shop]');
    if (sh) sh.addEventListener('click', () => {
      missing.forEach((m) => {
        const it = state.inventory.find((i) => HB.fuzzy(i.name, m));
        if (it) it.min = Math.max(it.min, 1);
        else state.inventory.push({ id: HB.uid(), name: m, cat: tree.cat, qty: 0, unit: 'יח׳', min: 1, loc: '' });
      });
      HB.store.save(true);
      HB.toast(`${missing.length} פריטים נוספו לרשימת הקניות`, { icon: 'cart', action: { label: 'לרשימה', fn: () => HB.go('maintain/inventory') } });
      renderWizard(el, tree, pathArg, view);
    });
    el.querySelector('[data-copy]').addEventListener('click', async () => {
      const txt = [`אבחון: ${tree.title}`, ...steps.map((s) => `• ${s.q} — ${s.a}`), '', `תוצאה: ${sol.t}`, sol.sum, '', ...sol.steps.map((x, i) => `${i + 1}. ${x}`), sol.safety ? `\n⚠ ${sol.safety}` : ''].join('\n');
      HB.toast((await HB.copy(txt)) ? 'הסיכום הועתק — אפשר לשלוח לאיש מקצוע' : 'ההעתקה נכשלה', { icon: 'copy' });
    });
    return null;
  }

  function bindTrail(el, href, path) {
    el.querySelectorAll('[data-rewind]').forEach((b) => b.addEventListener('click', () => { location.hash = href(path.slice(0, +b.dataset.rewind)); }));
  }

  HB.views.diagnose = {
    captureKeys: false,
    render(el, args, opts) {
      this.captureKeys = false;
      if (opts && opts.same) window.scrollTo(0, 0);
      const tree = HB.tree(args[0]);
      if (!tree) { renderList(el); return null; }
      return renderWizard(el, tree, args[1], this);
    },
  };
})();
