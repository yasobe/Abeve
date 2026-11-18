// Library: short evidence-informed articles + help resources.
import { html, icon } from "../ui.js";
import { ARTICLES, CRISIS, HELP } from "../content.js";
import { head, blocks } from "./parts.js";

function list() {
  return html`
    ${head("ספרייה", { back: "more", sub: "קריאה קצרה, ידע שעוזר. כל מאמר עד 4 דקות." })}
    <ul class="articles">${ARTICLES.map(a => html`<li><a class="card article-card" href="#/learn/${a.id}">
      <span class="art-ic">${icon(a.icon, 24)}</span>
      <span><b>${a.title}</b><small>${a.summary}</small><small class="muted">${a.minutes} דק׳ קריאה</small></span></a></li>`)}</ul>
    <a class="card cta" href="#/learn/resources">${icon("lifebuoy")}<span class="cta-text"><b>קווי סיוע ועזרה מקצועית</b><small>למי אפשר לפנות</small></span>${icon("fwd", 20, "chev")}</a>`;
}

function article(a) {
  const i = ARTICLES.indexOf(a), next = ARTICLES[(i + 1) % ARTICLES.length];
  return html`
    ${head(a.title, { back: "learn", sub: `${a.minutes} דק׳ קריאה` })}
    <article class="card prose">${blocks(a.body)}</article>
    <p class="small muted">${icon("info", 14)} מידע כללי בלבד, אינו תחליף לייעוץ רפואי או טיפול.</p>
    <a class="card cta" href="#/learn/${next.id}"><span class="cta-text"><small>המאמר הבא</small><b>${next.title}</b></span>${icon("fwd", 20, "chev")}</a>`;
}

function resources() {
  return html`
    ${head("קווי סיוע ועזרה", { back: "more" })}
    <section class="card crisis-card">
      <h2>${icon("alert", 18)} במצב דחוף</h2>
      <ul class="res">${CRISIS.map(c => html`<li>
        <span><b>${c.name}</b><small>${c.detail}</small></span>
        ${c.tel ? html`<a class="btn primary small" href="tel:${c.tel}">${icon("phone", 16)} ${c.tel}</a>` : html`<a class="btn ghost small" href="${c.url}" target="_blank" rel="noopener noreferrer">לאתר</a>`}
      </li>`)}</ul>
    </section>
    <section class="card">
      <h2>עזרה מקצועית ותמיכה</h2>
      <ul class="res">${HELP.map(c => html`<li><span><b>${c.name}</b><small>${c.detail}</small></span>
        ${c.url ? html`<a class="btn ghost small" href="${c.url}" target="_blank" rel="noopener noreferrer">לאתר</a>` : ""}</li>`)}</ul>
      <p class="small muted">טיפולים עם הוכחות יעילות להפרעת שימוש בקנאביס: CBT, ראיון מוטיבציוני (MI) וחיזוק חיובי. אין תרופה מאושרת ספציפית, אבל רופא/ה יכולים לעזור עם שינה, חרדה ומצב רוח.</p>
    </section>
    <a class="card cta" href="#/learn/help">${icon("book")}<span class="cta-text"><b>מתי לפנות לעזרה מקצועית</b><small>סימנים שכדאי לא להתמודד איתם לבד</small></span>${icon("fwd", 20, "chev")}</a>`;
}

export default {
  title: (ctx, [id]) => (id === "resources" ? "קווי סיוע" : ARTICLES.find(a => a.id === id)?.title || "ספרייה"),
  render(ctx, [id]) {
    if (id === "resources") return resources();
    const a = ARTICLES.find(x => x.id === id);
    return a ? article(a) : list();
  },
};
