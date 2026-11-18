// App shell: boot, lock screen, hash router, event delegation, auto-lock, celebrations.
import * as store from "./store.js";
import { setGender } from "./i18n.js";
import { html, icon, toast, sheet, setHaptics, haptic } from "./ui.js";
import { achievements } from "./calc.js";

import home from "./views/home.js";
import progress from "./views/progress.js";
import sos from "./views/sos.js";
import tools from "./views/tools.js";
import craving from "./views/craving.js";
import journal from "./views/journal.js";
import checkin from "./views/checkin.js";
import slip from "./views/slip.js";
import more from "./views/more.js";
import plan from "./views/plan.js";
import learn from "./views/learn.js";
import timeline from "./views/timeline.js";
import settings from "./views/settings.js";
import about from "./views/about.js";
import onboarding from "./views/onboarding.js";
import lock from "./views/lock.js";

const ROUTES = { home, progress, sos, tools, craving, journal, checkin, slip, more, plan, learn, timeline, settings, about };
const TAB_OF = { home: "home", checkin: "home", slip: "home", progress: "progress", timeline: "progress", sos: "sos", tools: "sos", craving: "sos", journal: "journal", more: "more", plan: "more", learn: "more", settings: "more", about: "more" };
const TABS = [
  { k: "home", label: "בית", icon: "home" },
  { k: "progress", label: "התקדמות", icon: "chart" },
  { k: "sos", label: "עזרה עכשיו", icon: "lifebuoy", sos: true },
  { k: "journal", label: "יומן", icon: "book" },
  { k: "more", label: "עוד", icon: "grid" },
];

// Hebrew is right-to-left. Set it from code too, so it holds even when the page is embedded in a host document.
document.documentElement.setAttribute("dir", "rtl");
document.documentElement.setAttribute("lang", "he");

const $main = document.getElementById("main");
const $nav = document.getElementById("nav");
const app = { state: null, locked: false, view: null, route: "", params: [], cleanup: null, hiddenAt: 0 };

// ---- context passed to views ------------------------------------------------------------
export const ctx = {
  get state() { return app.state; },
  /** Mutate state, persist, re-render the current view (unless render:false). */
  update(fn, { render = true } = {}) {
    fn(app.state);
    applyPrefs();
    store.save(app.state);
    if (render) rerender();
  },
  replace(newState) { app.state = newState; applyPrefs(); store.save(app.state); },
  go(route) {
    const h = `#/${route}`;
    if (location.hash === h) rerender(); else location.hash = h;
  },
  rerender: () => rerender(),
  toast, sheet,
  lockNow: () => lockNow(),
  onboardDone: () => { app.state.onboarded = true; store.save(app.state); ctx.go("home"); route(); },
};

function applyPrefs() {
  const s = app.state;
  if (!s) return;
  setGender(s.profile.gender);
  setHaptics(s.settings.haptics);
  applyTheme(s.settings.theme);
  store.prefs.setTheme(s.settings.theme);
}
function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else document.documentElement.removeAttribute("data-theme");
  const dark = t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0f1719" : "#f5f1ea");
}

// ---- routing --------------------------------------------------------------------------------
function parseHash() {
  const parts = decodeURIComponent(location.hash.replace(/^#\/?/, "")).split("/").filter(Boolean);
  return { name: parts[0] || "home", params: parts.slice(1) };
}

function route() {
  const { name, params } = parseHash();
  let view, key = name;
  if (app.locked) { view = lock; key = "lock"; }
  else if (!app.state.onboarded) { view = onboarding; key = "onboarding"; }
  else { view = ROUTES[name] || home; if (!ROUTES[name]) key = "home"; }
  const changed = key !== app.route || params.join("/") !== app.params.join("/");
  if (changed && app.view?.onRouteLeave) { try { app.view.onRouteLeave(); } catch { /* ignore */ } }
  app.view = view; app.route = key; app.params = params;
  render(changed);
}

function render(routeChanged) {
  if (app.cleanup) { try { app.cleanup(); } catch { /* ignore */ } app.cleanup = null; }
  const v = app.view;
  const bare = v === lock || v === onboarding;
  document.body.classList.toggle("bare", bare);
  renderNav(bare ? null : TAB_OF[app.route] || "home");
  const y = routeChanged ? 0 : window.scrollY;
  $main.innerHTML = String(v.render(ctx, app.params));
  const title = typeof v.title === "function" ? v.title(ctx, app.params) : v.title;
  document.title = title ? `${title} · צלול` : "צלול";
  if (v.mount) app.cleanup = v.mount($main, ctx, app.params) || null;
  if (routeChanged) {
    window.scrollTo(0, 0);
    const h = $main.querySelector("h1");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  } else {
    window.scrollTo(0, y);
  }
  if (!bare && app.route === "home") setTimeout(celebrate, 400);
}
function rerender() { if (app.view) render(false); }

function renderNav(active) {
  if (!active) { $nav.innerHTML = ""; return; }
  $nav.innerHTML = String(html`
    <div class="brand"><span class="brand-mark" aria-hidden="true"></span><span>צלול</span></div>
    <ul>${TABS.map(t => html`<li><a href="#/${t.k}" class="tab ${t.sos ? "tab-sos" : ""} ${active === t.k ? "on" : ""}" ${active === t.k ? html`aria-current="page"` : ""}>
      <span class="tab-ic">${icon(t.icon, t.sos ? 26 : 22)}</span><span class="tab-label">${t.label}</span></a></li>`)}</ul>`);
}

// ---- event delegation -------------------------------------------------------------------------
$main.addEventListener("click", e => {
  const a = e.target.closest("[data-act]");
  if (!a || !$main.contains(a)) return;
  const act = a.dataset.act;
  const fn = app.view?.actions?.[act];
  if (fn) { e.preventDefault(); haptic(); fn(a, ctx, e, app.params); return; }
  if (act === "go") { e.preventDefault(); ctx.go(a.dataset.to); }
  else if (act === "back") { e.preventDefault(); history.length > 1 ? history.back() : ctx.go("home"); }
});
$main.addEventListener("submit", e => {
  const f = e.target.closest("form[data-form]");
  if (!f) return;
  e.preventDefault();
  const fn = app.view?.forms?.[f.dataset.form];
  if (fn) fn(new FormData(f), f, ctx, app.params);
});
$main.addEventListener("input", e => {
  const el = e.target;
  if (el.matches("input[type=range][data-show]")) {
    const out = $main.querySelector(`#${CSS.escape(el.dataset.show)}`);
    if (out) out.textContent = el.dataset.labels ? el.dataset.labels.split("|")[el.value - (+el.min || 0)] || el.value : el.value;
  }
  app.view?.onInput?.(el, ctx);
});
$main.addEventListener("change", e => app.view?.onChange?.(e.target, ctx));

window.addEventListener("hashchange", route);

// ---- lock ------------------------------------------------------------------------------------------
export async function tryUnlock(code) {
  const st = await store.unlock(code); // throws on wrong code
  app.state = st; app.locked = false;
  applyPrefs();
  route();
}
lock.unlock = tryUnlock;
lock.reset = () => { store.wipe(); location.hash = ""; location.reload(); };

function lockNow() {
  if (!store.isEncrypted()) return;
  store.forgetKey();
  app.state = null; app.locked = true;
  document.querySelectorAll("dialog[open]").forEach(d => d.close());
  route();
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { app.hiddenAt = Date.now(); return; }
  if (!app.locked && app.state && store.isEncrypted() && app.hiddenAt) {
    const min = app.state.settings.autoLockMin;
    if (Date.now() - app.hiddenAt >= min * 60000) lockNow();
  }
  if (!app.locked && app.route === "home") rerender(); // refresh counters after a long background
});

// ---- celebrations ------------------------------------------------------------------------------------
function celebrate() {
  if (app.locked || !app.state?.onboarded || app.route !== "home" || document.querySelector("dialog[open]")) return;
  const seen = new Set(app.state.seen.achievements);
  const fresh = achievements(app.state).filter(a => a.unlocked && !seen.has(a.id));
  if (!fresh.length) return;
  const a = fresh[fresh.length - 1];
  ctx.update(s => { s.seen.achievements = [...seen, ...fresh.map(x => x.id)]; }, { render: false });
  haptic([20, 40, 20]);
  sheet(html`
    <div class="celebrate">
      <div class="burst" aria-hidden="true">${icon(a.icon, 44)}</div>
      <p class="eyebrow">הישג חדש</p>
      <h2 class="sheet-title">${a.title}</h2>
      <p class="muted">${a.desc}</p>
      ${fresh.length > 1 ? html`<p class="small muted">ועוד ${fresh.length - 1} הישגים נפתחו</p>` : ""}
      <button class="btn primary wide" data-act="close" autofocus>תודה!</button>
    </div>`, { label: a.title });
}

// ---- boot -------------------------------------------------------------------------------------------------
function boot() {
  applyTheme(store.prefs.theme());
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => applyTheme(app.state?.settings.theme || store.prefs.theme()));
  const r = store.load();
  if (r.locked) app.locked = true;
  else {
    app.state = r.state;
    applyPrefs();
    if (r.corrupt) toast("לא ניתן היה לקרוא את הנתונים השמורים");
  }
  route();
  document.body.classList.add("ready");
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => { /* offline support is optional */ });
  }
}
boot();

