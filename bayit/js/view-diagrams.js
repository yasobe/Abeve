/* Interactive diagrams view. */
(() => {
  'use strict';
  const HB = window.HB;
  const { esc, icon } = HB;

  HB.diffHtml = (d) => `<span class="diff d${d}"><i><b></b><b></b><b></b></i>${['', 'קל', 'בינוני', 'מורכב / מקצועי'][d] || ''}</span>`;

  const pref = { get() { try { return localStorage.getItem('bayit.labels'); } catch (e) { return null; } }, set(v) { try { localStorage.setItem('bayit.labels', v ? '1' : '0'); } catch (e) { /* ignore */ } } };
  // Labels are RTL text, so 'end' is the left edge: east labels anchor at end, west at start.
  const LBL = { e: [24, 5, 'end'], w: [-24, 5, 'start'], n: [0, -24, 'middle'], s: [0, 34, 'middle'] };

  HB.views.diagrams = {
    render(el, args) {
      const dg = HB.diagram(args[0]) || HB.DIAGRAMS[0];
      const parts = dg.parts;
      const vbW = +dg.viewBox.split(' ')[2];
      const stored = pref.get();
      let labels = stored === null ? window.innerWidth >= 900 : stored === '1';
      let active = null;

      const hotspots = parts.map((p, i) => {
        const [lx, ly, anchor] = LBL[p.lp] || LBL.e;
        return `<g class="hs" data-i="${i}" tabindex="0" role="button" aria-label="${i + 1}. ${esc(p.title)}" transform="translate(${p.x} ${p.y})">
          <g class="hs-k"><circle class="hs-hit" r="24"/><circle class="hs-pulse" r="13" style="animation-delay:${(i * 0.23).toFixed(2)}s"/><circle class="hs-dot" r="13"/>
          <text class="hs-n" y="4.6" text-anchor="middle">${i + 1}</text>
          <text class="hs-label" x="${lx}" y="${ly}" text-anchor="${anchor}">${esc(p.title)}</text></g></g>`;
      }).join('');

      el.innerHTML = `
        <header class="page-head"><div>
          <div class="eyebrow">${icon('layers', 'sm')} ${HB.DIAGRAMS.length} מערכות · ${HB.DIAGRAMS.reduce((a, d) => a + d.parts.length, 0)} חלקים</div>
          <h1>תרשימים אינטראקטיביים</h1>
          <p>לחץ על נקודה ממוספרת כדי לגלות מה החלק עושה, אילו תקלות נפוצות בו ואיך מטפלים בהן.</p>
        </div></header>
        <nav class="dg-picker" aria-label="בחירת תרשים">
          ${HB.DIAGRAMS.map((d) => `<a class="dg-pick" href="#/diagrams/${d.id}" aria-current="${d === dg}"><span class="th"><svg viewBox="${d.viewBox}" aria-hidden="true">${d.svg('pk' + d.id)}</svg></span><span><b>${esc(d.title)}</b><small>${d.parts.length} חלקים · ${esc(d.cat)}</small></span></a>`).join('')}
        </nav>
        <div class="dg-layout">
          <section class="card dg-card">
            <div class="dg-toolbar">
              <div class="dg-title"><h2>${esc(dg.title)}</h2><p>${esc(dg.sub)}</p></div>
              <span class="spacer"></span>
              <div class="legend">${dg.legend.map(([c, l]) => `<span><i class="lg-${c}"></i>${esc(l)}</span>`).join('')}</div>
              <button class="btn sm outline" type="button" data-labels aria-pressed="${labels}">${icon('eye', 'sm')}תוויות</button>
              <button class="btn sm primary" type="button" data-tour>${icon('sparkle', 'sm')}סיור מודרך</button>
            </div>
            <div class="dg-stage${labels ? ' labels' : ''}">
              <svg class="dg-svg" viewBox="${dg.viewBox}" role="group" aria-label="תרשים: ${esc(dg.title)}">${dg.svg('st')}<g class="hs-layer">${hotspots}</g></svg>
              <div class="dg-hint">${icon('target', 'sm')}לחץ על נקודה כדי ללמוד על החלק</div>
              <div class="dg-pop" hidden role="dialog" aria-labelledby="popT"></div>
            </div>
          </section>
          <aside class="card dg-side" aria-label="חלקי המערכת">
            <div class="card-head"><h3>${icon('list')}חלקי המערכת</h3><span class="tiny">${parts.length} חלקים</span></div>
            <ol class="parts">${parts.map((p, i) => `<li><button type="button" class="part-btn" data-i="${i}"><span class="n">${i + 1}</span><b>${esc(p.title)}</b>${HB.diffHtml(p.diff).replace(/<\/i>.*<\/span>$/, '</i></span>')}</button></li>`).join('')}</ol>
          </aside>
        </div>`;

      const stage = el.querySelector('.dg-stage');
      const svg = stage.querySelector('svg');
      const pop = stage.querySelector('.dg-pop');
      const hs = Array.from(stage.querySelectorAll('.hs'));
      const pbtns = Array.from(el.querySelectorAll('.part-btn'));

      /* keep hotspots finger-sized when the drawing is scaled down */
      const fit = () => { const w = svg.clientWidth || vbW; svg.style.setProperty('--k', HB.clamp((vbW / w) * 0.85, 1, 2).toFixed(3)); if (active !== null) place(); };
      const ro = new ResizeObserver(fit); ro.observe(svg);

      const place = () => {
        if (pop.hidden || window.innerWidth < 760) { pop.style.left = ''; pop.style.top = ''; return; }
        const sr = stage.getBoundingClientRect();
        const dr = hs[active].querySelector('.hs-dot').getBoundingClientRect();
        const cx = dr.left + dr.width / 2 - sr.left; const cy = dr.top + dr.height / 2 - sr.top;
        const pw = pop.offsetWidth; const ph = pop.offsetHeight; const gap = 28;
        let left = cx > sr.width / 2 ? cx - gap - pw : cx + gap;
        left = HB.clamp(left, 12, Math.max(12, sr.width - pw - 12));
        const top = HB.clamp(cy - ph / 2, 12, Math.max(12, sr.height - ph - 12));
        pop.style.left = `${left}px`; pop.style.top = `${top}px`;
      };

      const popHtml = (i) => {
        const p = parts[i];
        const taskExists = p.task && HB.store.state.tasks.some((t) => !t.done && t.title === p.task.title);
        return `
          <div class="pop-head"><span class="pop-n">${i + 1}</span><h3 id="popT">${esc(p.title)}</h3><button type="button" class="btn sm icon ghost" data-pclose aria-label="סגירה">${icon('x', 'sm')}</button></div>
          <div class="pop-body">
            <div>${HB.diffHtml(p.diff)}</div>
            <p>${esc(p.sum)}</p>
            <div class="pop-sec"><h4>${icon('alert', 'sm')}תקלות נפוצות</h4><ul>${p.issues.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
            <div class="tip">${icon('sparkle')}<span><b>טיפ מקצועי:</b> ${esc(p.tip)}</span></div>
          </div>
          ${p.tree || p.task ? `<div class="pop-actions">
            ${p.tree ? `<a class="btn sm primary" href="#/diagnose/${p.tree}">${icon('compass', 'sm')}אבחון תקלה</a>` : ''}
            ${p.task ? (taskExists ? `<span class="badge ok">${icon('check')}כבר במשימות</span>` : `<button type="button" class="btn sm outline" data-ptask>${icon('plus', 'sm')}${p.task.recur ? `תזכורת ${esc(HB.recurLabel(p.task.recur))}` : 'הוספה למשימות'}</button>`) : ''}
          </div>` : ''}
          <div class="pop-nav">
            <button type="button" class="btn sm ghost" data-prev ${i === 0 ? 'disabled' : ''}>${icon('back', 'sm')}הקודם</button>
            <span>${i + 1} מתוך ${parts.length}</span>
            <button type="button" class="btn sm ghost" data-next ${i === parts.length - 1 ? 'disabled' : ''}>הבא${icon('fwd', 'sm')}</button>
          </div>`;
      };

      const select = (i, { focusPop = false } = {}) => {
        active = i;
        stage.classList.toggle('has-active', i !== null);
        hs.forEach((h, k) => { h.classList.toggle('active', k === i); h.setAttribute('aria-pressed', k === i); });
        pbtns.forEach((b, k) => b.setAttribute('aria-current', k === i));
        try { history.replaceState(null, '', `#/diagrams/${dg.id}${i !== null ? `/${parts[i].id}` : ''}`); } catch (e) { /* file:// */ }
        if (i === null) { pop.hidden = true; return; }
        // bring the active hotspot to the top of the SVG stacking order
        hs[i].parentNode.appendChild(hs[i]);
        pop.innerHTML = popHtml(i);
        pop.hidden = false;
        pop.style.animation = 'none'; void pop.offsetWidth; pop.style.animation = '';
        place();
        if (focusPop) pop.querySelector('[data-next]:not([disabled]), [data-pclose]').focus({ preventScroll: true });
      };

      stage.addEventListener('click', (e) => {
        const h = e.target.closest('.hs');
        if (h) { select(+h.dataset.i); return; }
        if (e.target.closest('.dg-pop')) {
          if (e.target.closest('[data-pclose]')) { const was = active; select(null); if (hs[was]) hs[was].focus(); }
          else if (e.target.closest('[data-prev]')) select(Math.max(0, active - 1), { focusPop: true });
          else if (e.target.closest('[data-next]')) select(Math.min(parts.length - 1, active + 1), { focusPop: true });
          else if (e.target.closest('[data-ptask]')) { HB.addTaskFrom({ ...parts[active].task, prio: 'mid' }); select(active); }
          return;
        }
        select(null);
      });
      stage.addEventListener('keydown', (e) => {
        const h = e.target.closest('.hs');
        if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(+h.dataset.i, { focusPop: true }); }
      });
      pbtns.forEach((b) => b.addEventListener('click', () => {
        select(+b.dataset.i);
        if (window.innerWidth < 1100) stage.scrollIntoView({ behavior: HB.reducedMotion() ? 'auto' : 'smooth', block: 'center' });
      }));
      el.querySelector('[data-labels]').addEventListener('click', (e) => {
        labels = !labels; pref.set(labels);
        stage.classList.toggle('labels', labels); e.currentTarget.setAttribute('aria-pressed', labels);
      });
      el.querySelector('[data-tour]').addEventListener('click', () => select(active === null ? 0 : (active + 1) % parts.length, { focusPop: true }));

      const onKey = (e) => {
        if (HB.$('#modal').open || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
        if (e.key === 'Escape' && active !== null) { const was = active; select(null); if (hs[was]) hs[was].focus(); }
        if (active === null) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); select(Math.min(parts.length - 1, active + 1), { focusPop: true }); }
        if (e.key === 'ArrowRight') { e.preventDefault(); select(Math.max(0, active - 1), { focusPop: true }); }
      };
      const onResize = () => place();
      document.addEventListener('keydown', onKey);
      window.addEventListener('resize', onResize);

      fit();
      const start = args[1] ? parts.findIndex((p) => p.id === args[1]) : -1;
      if (start >= 0) requestAnimationFrame(() => { select(start); stage.scrollIntoView({ block: 'center' }); });

      return () => { ro.disconnect(); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); };
    },
  };
})();
