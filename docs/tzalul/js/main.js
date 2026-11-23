// App bootstrap: store, router, event delegation, live counters, lock, PWA.

import { createStore } from "./store.js";
import { setupSheet, closeSheet, toast, formData } from "./ui.js";
import { setupTooltip } from "./charts.js";
import { streak } from "./calc.js";
import { liveText } from "./views/common.js";

import today from "./views/today.js";
import journal from "./views/journal.js";
import progress from "./views/progress.js";
import sos from "./views/sos.js";
import settings from "./views/settings.js";
import onboarding from "./views/onboarding.js";
import lock from "./views/lock.js";
import * as tools from "./views/tools.js";

const store = createStore();
window.__tzalul = store; // handy for debugging in devtools; holds no secrets beyond what the page shows

const ROUTES = {
  today, journal, progress, sos, settings, welcome: onboarding,
  tools: tools.hub,
  "tools/breathing": tools.breathing,
  "tools/grounding": tools.grounding,
  "tools/halt": tools.halt,
  "tools/plan": tools.plan,
  "tools/thoughts": tools.thoughts,
  "tools/gratitude": tools.gratitude,
  "tools/letter": tools.letter,
  "tools/reasons": tools.reasons,
  "tools/audit": tools.audit,
  "tools/help": tools.help,
  learn: tools.article,
};

const app = {
  store,
  view: null,
  params: [],
  cleanup: null,
  get state() { return store.state; },
  go(path) {
    const h = `#/${path}`;
    if (location.hash === h) this.render(); else location.hash = h;
  },
  render,
};

const $view = () => document.getElementById("view");

/* ---------- Routing ---------- */

function parseHash() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, "")) || "today";
  const parts = h.split("/").filter(Boolean);
  if (ROUTES[parts.slice(0, 2).join("/")]) return { key: parts.slice(0, 2).join("/"), params: parts.slice(2) };
  if (ROUTES[parts[0]]) return { key: parts[0], params: parts.slice(1) };
  return { key: "today", params: [] };
}

function render({ keepScroll = false } = {}) {
  const root = $view();
  const y = window.scrollY;
  app.cleanup?.();
  app.cleanup = null;

  let view, key = "", params = [];
  if (store.status === "locked") view = lock;
  else if (store.status === "empty") view = onboarding;
  else ({ key, params } = parseHash()), view = ROUTES[key];

  document.body.dataset.mode = view === lock ? "lock" : view === onboarding ? "welcome" : view === sos ? "sos" : "app";
  app.view = view;
  app.params = params;
  app.routeKey = key;

  root.innerHTML = String(view.render(app));
  const t = typeof view.title === "function" ? view.title(app) : view.title;
  document.title = t ? `${t} · צלול` : "צלול";
  document.getElementById("top-title").textContent = t || "צלול";
  document.getElementById("top-back").hidden = !view.back;
  if (view.back) document.getElementById("top-back").dataset.to = typeof view.back === "function" ? view.back(app) : view.back;

  const section = key.split("/")[0] || "today";
  for (const a of document.querySelectorAll("[data-nav]")) {
    const on = a.dataset.nav === (section === "learn" ? "tools" : section);
    a.classList.toggle("on", on);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }

  app.cleanup = view.mount?.(root, app) || null;
  tick();
  if (keepScroll) window.scrollTo(0, y);
  else {
    window.scrollTo(0, 0);
    // move focus to the page heading for screen readers on navigation
    const h1 = root.querySelector("h1");
    if (h1 && render.navigated) { h1.setAttribute("tabindex", "-1"); h1.focus({ preventScroll: true }); }
  }
  render.navigated = true;
}

window.addEventListener("hashchange", () => { closeSheet(true); render(); });

/* ---------- Event delegation ---------- */

document.addEventListener("click", e => {
  if (e.target.closest("#skip")) { $view().focus(); return; }
  const back = e.target.closest("#top-back");
  if (back) { history.length > 1 && back.dataset.to === "back" ? history.back() : app.go(back.dataset.to || "today"); return; }
  const el = e.target.closest("[data-act]");
  if (!el || el.closest("#sheet")) return;
  const fn = app.view?.actions?.[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, app, e); }
});

document.addEventListener("submit", e => {
  const form = e.target;
  if (form.closest("#sheet")) return;
  e.preventDefault();
  const fn = app.view?.forms?.[form.dataset.form];
  if (fn) fn(formData(form), form, app, e.submitter);
});

document.addEventListener("input", e => {
  const t = e.target;
  if (t.closest("#sheet")) return;
  if (t.type === "range" && t.dataset.out) {
    const o = document.getElementById(t.dataset.out);
    if (o) o.textContent = t.value;
  }
  app.view?.onInput?.(t, app, e);
});

document.addEventListener("change", e => {
  if (e.target.closest("#sheet")) return;
  app.view?.onChange?.(e.target, app, e);
});

/* ---------- Live counters ---------- */

function tick() {
  if (store.status !== "ready") return;
  const s = streak(store.state);
  for (const el of document.querySelectorAll("[data-live]")) {
    const v = liveText(el.dataset.live, s, store.state);
    if (v != null && el.textContent !== v) el.textContent = v;
  }
  app.view?.tick?.(app, s);
}
setInterval(tick, 1000);

/* ---------- Theme ---------- */

function applyTheme() {
  const t = store.state?.settings.theme || "auto";
  const root = document.documentElement;
  if (t === "auto") root.removeAttribute("data-theme"); else root.dataset.theme = t;
  const dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]').content = dark ? "#0f1413" : "#f6f5f1";
}
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);

/* ---------- State changes ---------- */

let lastStatus = null;
store.subscribe(() => {
  applyTheme();
  if (store.status !== lastStatus) { lastStatus = store.status; closeSheet(true); render(); }
});
store.onError = () => toast("השמירה נכשלה. ייתכן שאין מספיק מקום באחסון של הדפדפן.", { tone: "bad" });

/* ---------- Auto-lock when the app goes to the background ---------- */

let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    store.flush?.();
    if (store.hasLock() && store.state?.settings.autoLockMin === 0) store.lock();
  } else if (hiddenAt && store.hasLock() && store.status === "ready") {
    const min = store.state.settings.autoLockMin;
    if (Date.now() - hiddenAt >= min * 60000) store.lock();
    hiddenAt = 0;
  }
});
window.addEventListener("pagehide", () => store.flush?.());

// The app open in another tab changed the data: reload so this tab never overwrites newer data.
window.addEventListener("storage", e => {
  if (e.key && e.key.startsWith("tzalul.") && e.key !== "tzalul.guard" && !store.dirty) location.reload();
});

/* ---------- Keyboard shortcuts (desktop) ---------- */

document.addEventListener("keydown", e => {
  if (e.target.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (store.status !== "ready" || document.getElementById("sheet").open) return;
  const map = { "1": "today", "2": "journal", "3": "progress", "4": "tools", "!": "sos" };
  if (map[e.key]) { e.preventDefault(); app.go(map[e.key]); }
});

/* ---------- Service worker ---------- */

function setupSW() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  let userAccepted = false;
  navigator.serviceWorker.register("sw.js").then(reg => {
    const offer = w => toast("גרסה חדשה מוכנה", { action: { label: "רענון", run: () => { userAccepted = true; w.postMessage("skip"); } }, ms: 8000 });
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w?.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) offer(w); });
    });
  }).catch(() => {});
  // reload only when the user asked for the update (not when the first worker takes control)
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!userAccepted) return;
    userAccepted = false;
    store.flush().finally(() => location.reload());
  });
}

/* ---------- Start ---------- */

setupSheet();
setupTooltip();
store.init();
lastStatus = store.status;
applyTheme();
render();
setupSW();
document.documentElement.classList.add("ready");

