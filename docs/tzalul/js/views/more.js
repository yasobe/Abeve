// "More" menu.
import { html, icon } from "../ui.js";
import { isEncrypted } from "../store.js";
import { head } from "./parts.js";

const ITEMS = [
  { to: "plan", ic: "map", t: "התוכנית שלי", d: "סיבות, טריגרים, אם־אז, אנשי קשר ופרסים" },
  { to: "timeline", ic: "pulse", t: "מה קורה בגוף", d: "ציר ההחלמה ותסמיני גמילה" },
  { to: "learn", ic: "book", t: "ספרייה", d: "מאמרים קצרים: שינה, חשקים, מעידות ועוד" },
  { to: "sos", ic: "wind", t: "תרגילים", d: "נשימה, גלישה על הדחף, קרקוע" },
  { to: "learn/resources", ic: "lifebuoy", t: "קווי סיוע ועזרה מקצועית", d: "ער״ן, קופות החולים, קבוצות תמיכה" },
  { to: "settings", ic: "settings", t: "הגדרות", d: "פרופיל, תזכורות, קוד נעילה, גיבוי" },
  { to: "about", ic: "info", t: "פרטיות ואודות", d: "איך המידע שלך נשמר" },
];

export default {
  title: "עוד",
  render() {
    return html`
      ${head("עוד")}
      <nav class="menu" aria-label="תפריט">${ITEMS.map(i => html`
        <a class="menu-item" href="#/${i.to}"><span class="menu-ic">${icon(i.ic)}</span><span><b>${i.t}</b><small>${i.d}</small></span>${icon("fwd", 18, "chev")}</a>`)}
      </nav>
      ${isEncrypted() ? html`<button class="btn ghost wide" data-act="lock">${icon("lock", 18)} לנעול עכשיו</button>` : ""}`;
  },
  actions: { lock(el, ctx) { ctx.lockNow(); } },
};
