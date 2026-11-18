// Privacy, disclaimer, credits.
import { html, icon } from "../ui.js";
import { head } from "./parts.js";
import { SOURCES } from "../content.js";

export const VERSION = "1.0.0";

export default {
  title: "פרטיות ואודות",
  render() {
    return html`
      ${head("פרטיות ואודות", { back: "more" })}
      <section class="card prose">
        <h2>${icon("lock", 18)} הפרטיות שלך</h2>
        <ul>
          <li><b>הכל נשמר רק במכשיר הזה.</b> אין חשבון, אין שרת, אין סנכרון לענן.</li>
          <li><b>אין מעקב.</b> בלי אנליטיקס, בלי פרסומות, בלי עוגיות, בלי בקשות לשירותים חיצוניים — גם הגופנים נטענים מהאפליקציה עצמה.</li>
          <li><b>הצפנה אופציונלית.</b> עם קוד נעילה, כל המידע מוצפן ב־AES-256 עם מפתח שנגזר מהקוד שלך (PBKDF2, 310,000 סבבים).</li>
          <li><b>דיסקרטיות.</b> שם האפליקציה, הסמל והתזכורות לא מזכירים קנאביס.</li>
          <li><b>שליטה מלאה.</b> אפשר לגבות לקובץ, לשחזר, ולמחוק הכל בלחיצה.</li>
        </ul>
        <p class="small muted">שימו לב: מחיקת נתוני הדפדפן או \"ניקוי היסטוריה\" מוחקת גם את המידע של האפליקציה. כדאי לגבות.</p>
      </section>
      <section class="card prose">
        <h2>${icon("info", 18)} חשוב לדעת</h2>
        <p>צלול היא כלי לעזרה עצמית, מבוסס על עקרונות מקובלים בטיפול בהתמכרויות (CBT, מיינדפולנס, מניעת מעידה, ראיון מוטיבציוני). היא <b>אינה תחליף לייעוץ, אבחון או טיפול רפואי או נפשי</b>.</p>
        <p>אם יש מחשבות על פגיעה עצמית — ער״ן <a href="tel:1201">1201</a> (24/7). במצב חירום — מד״א <a href="tel:101">101</a>.</p>
      </section>
      <section class="card prose small">
        <h2>מקורות</h2>
        <ul>${SOURCES.map(s => html`<li>${s}</li>`)}</ul>
        <h2>קרדיטים</h2>
        <p>גופן Rubik — The Rubik Project Authors, ברישיון SIL Open Font License 1.1.</p>
        <p class="muted">גרסה ${VERSION}</p>
      </section>`;
  },
};
