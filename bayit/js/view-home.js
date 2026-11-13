/* Home: overview dashboard. */
(() => {
  'use strict';
  const HB = window.HB;
  const { esc, icon } = HB;

  const SEASONS = [
    { months: [9, 10], title: 'לקראת החורף', icon: 'leaf', items: [
      { title: 'ניקוי מרזבים ונקזי מרפסת לפני הגשמים', recur: 'y1', cat: 'חוץ ומרפסות' },
      { title: 'בדיקת איטום חלונות לפני החורף', recur: 'y1', cat: 'איטום' },
      { title: 'בדיקת מזגנים במצב חימום', recur: 'y1', cat: 'מיזוג' },
    ] },
    { months: [11, 0, 1], title: 'עונת החורף', icon: 'snow', items: [
      { title: 'בדיקת עובש בפינות ומאחורי ארונות', recur: 'm3', cat: 'איטום' },
      { title: 'בדיקת ממסר פחת אחרי סערה', recur: '', cat: 'חשמל' },
      { title: 'כיוון טיימר הדוד לימים קצרים', recur: '', cat: 'אינסטלציה' },
    ] },
    { months: [2, 3, 4], title: 'אביב — מתכוננים לקיץ', icon: 'sun', items: [
      { title: 'ניקוי פילטרים במזגנים', recur: 'm1', cat: 'מיזוג' },
      { title: 'ניקוי קולטי דוד השמש', recur: 'y1', cat: 'חוץ ומרפסות' },
      { title: 'בדיקת רשתות יתושים', recur: 'y1', cat: 'כללי' },
    ] },
    { months: [5, 6, 7, 8], title: 'קיץ', icon: 'sun', items: [
      { title: 'ניקוי פילטרים במזגנים', recur: 'm1', cat: 'מיזוג' },
      { title: 'אחסון סוללות 18V הרחק מחום (לא ברכב)', recur: '', cat: 'כללי' },
      { title: 'בדיקת מערכת ההשקיה והטפטפות', recur: 'm3', cat: 'חוץ ומרפסות' },
    ] },
  ];

  const greet = () => { const h = new Date().getHours(); return h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב'; };

  HB.views.home = {
    live: true,
    render(el) {
      const s = HB.store.state;
      const open = s.tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due));
      const overdue = open.filter((t) => HB.taskState(t) === 'overdue');
      const week = open.filter((t) => HB.taskState(t) === 'week');
      const low = s.inventory.filter(HB.lowStock);
      const batt = s.batteries.filter(HB.batteryNeedsAttention);
      const toolsDue = s.tools.filter((t) => HB.daysUntil(HB.toolNext(t)) < 0);

      const summary = overdue.length
        ? `יש <b>${overdue.length} משימות באיחור</b>${week.length ? ` ועוד ${week.length} השבוע` : ''}. בוא נסגור אותן.`
        : week.length ? `<b>${week.length} משימות</b> מחכות לך השבוע. הכול תחת שליטה.` : 'אין משימות דחופות. זמן מצוין לפרויקט חדש.';

      const dateStr = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
      const season = SEASONS.find((x) => x.months.includes(new Date().getMonth()));
      const hasTask = (title) => s.tasks.some((t) => !t.done && t.title === title);

      // 14-day timeline
      const tl = [];
      for (let i = 0; i < 14; i++) {
        const d = HB.addDays(HB.today(), i); const iso = HB.iso(d);
        const items = open.filter((t) => (i === 0 ? t.due <= iso : t.due === iso));
        tl.push(`<div class="tl-day${i === 0 ? ' today' : ''}" title="${esc(HB.fmtDate(iso))}: ${items.length ? esc(items.map((t) => t.title).join(', ')) : 'אין משימות'}">
          <span>${i === 0 ? 'היום' : 'אבגדהוש'[d.getDay()] + '׳'}</span>
          <div class="bar">${items.slice(0, 4).map((t) => `<i class="${t.due < HB.todayIso() ? 'overdue' : ''}"></i>`).join('')}</div>
          <b>${d.getDate()}</b></div>`);
      }

      const kpi = (tone, ic, v, l, sub, href, hot) => `<a class="kpi ${tone}${hot ? ' hot' : ''}" href="#/${href}"><span class="kpi-ic">${icon(ic)}</span><span class="kpi-v">${v}</span><span class="kpi-l">${l}</span><span class="kpi-s">${esc(sub)}</span></a>`;

      el.innerHTML = `
        <section class="hero">
          <div class="eyebrow">${icon('calendar', 'sm')} ${esc(dateStr)}</div>
          <h1>${greet()}, מה מתקנים היום?</h1>
          <p>${summary}</p>
          <div class="hero-actions">
            <a class="btn primary" href="#/diagnose">${icon('compass')}משהו התקלקל? אבחון</a>
            <a class="btn soft" href="#/diagrams">${icon('layers')}תרשימי מערכות</a>
            <button class="btn soft" type="button" data-new-task>${icon('plus')}משימה חדשה</button>
            <button class="btn soft hero-sos" type="button" data-sos>${icon('siren')}חירום</button>
          </div>
        </section>

        <section class="kpis" aria-label="סיכום">
          ${kpi('danger', 'alert', overdue.length, 'משימות באיחור', overdue[0] ? overdue[0].title : 'אין — כל הכבוד', 'maintain/tasks', overdue.length > 0)}
          ${kpi('info', 'calendar', week.length, 'ב־7 הימים הקרובים', week[0] ? week[0].title : 'שבוע פנוי', 'maintain/tasks')}
          ${kpi('warn', 'box', low.length, 'פריטים במלאי נמוך', low.length ? low.map((i) => i.name).slice(0, 2).join(', ') : 'המלאי מלא', 'maintain/inventory')}
          ${kpi('ok', 'battery', batt.length + toolsDue.length, 'כלים וסוללות לטיפול', batt.length ? `${batt.length} סוללות · ${toolsDue.length} כלים` : toolsDue.length ? `${toolsDue.length} כלים לטיפול` : 'הכול תקין', batt.length ? 'maintain/batteries' : 'maintain/tools')}
        </section>

        <div class="home-grid">
          <div class="col">
            <section class="card">
              <div class="card-head"><h2>${icon('list')}המשימות הבאות</h2><a class="link" href="#/maintain/tasks">לכל המשימות ${icon('fwd', 'sm')}</a></div>
              ${open.length ? `<ul class="rows">${open.slice(0, 6).map((t) => HB.taskRow(t)).join('')}</ul>` : `<div class="empty">${icon('check')}<h3>אין משימות פתוחות</h3><p>הוסף משימת תחזוקה או בחר מההמלצות העונתיות.</p></div>`}
            </section>
            <section class="card">
              <div class="card-head"><h2>${icon('calendar')}14 הימים הקרובים</h2><span class="tiny">${open.filter((t) => HB.daysUntil(t.due) < 14).length} משימות</span></div>
              <div class="timeline" role="img" aria-label="מספר משימות בכל יום בשבועיים הקרובים">${tl.join('')}</div>
            </section>
          </div>
          <div class="col">
            ${HB.emergencyCard()}
            ${season ? `<section class="card season">
              <h3>${icon(season.icon)}המלצות לעונה: ${esc(season.title)}</h3>
              <ul>${season.items.map((it, i) => `<li><span>${esc(it.title)}</span>${hasTask(it.title) ? `<span class="badge ok">${icon('check')}ברשימה</span>` : `<button class="btn sm outline" type="button" data-season="${i}">${icon('plus', 'sm')}הוספה</button>`}</li>`).join('')}</ul>
            </section>` : ''}
            <section class="card">
              <div class="card-head"><h2>${icon('compass')}אבחון מהיר</h2><a class="link" href="#/diagnose">הכול ${icon('fwd', 'sm')}</a></div>
              <div class="quick-trees">${['faucet', 'heater', 'electric', 'drain', 'toilet', 'damp', 'washer', 'shutter'].map(HB.tree).map((t) => `<a class="qt" href="#/diagnose/${t.id}">${icon(t.icon)}<span>${esc(t.title)}</span></a>`).join('')}</div>
            </section>
            <section class="card">
              <div class="card-head"><h2>${icon('battery')}סוללות 18V</h2><a class="link" href="#/maintain/batteries">פירוט ${icon('fwd', 'sm')}</a></div>
              ${s.batteries.length ? `<div class="bat-mini">${s.batteries.map((b) => { const x = HB.battery(b); return `<div class="bat-mini-row"><b>${esc(b.label)} <span class="tiny">${b.ah}Ah</span></b><div class="meter ${x.tone}" title="בריאות ${x.health}%"><i style="width:${x.health}%"></i></div><span class="tiny num">${x.health}% · ${b.cycles}/${b.rated}</span></div>`; }).join('')}</div>` : '<div class="empty"><p>עדיין לא הוספת סוללות.</p></div>'}
            </section>
            <section class="card">
              <div class="card-head"><h2>${icon('layers')}תרשימי מערכות</h2><a class="link" href="#/diagrams">פתיחה ${icon('fwd', 'sm')}</a></div>
              <div class="dg-mini-list">${HB.DIAGRAMS.map((d) => `<a class="dg-mini" href="#/diagrams/${d.id}"><div class="thumb"><svg viewBox="${d.viewBox}" aria-hidden="true">${d.svg('hm' + d.id)}</svg></div><span>${esc(d.title)}</span></a>`).join('')}</div>
            </section>
          </div>
        </div>`;

      el.querySelector('[data-new-task]').addEventListener('click', () => HB.editTask(null));
      el.querySelectorAll('[data-season]').forEach((b) => b.addEventListener('click', () => {
        const it = season.items[+b.dataset.season];
        HB.addTaskFrom({ ...it, prio: 'mid' });
      }));
      HB.bindTaskRows(el);
      HB.bindEmergency(el);
    },
  };
})();
