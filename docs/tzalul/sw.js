// Offline-first service worker. Bump VERSION on every release so installed apps update.
// tests/tzalul/sw.test.mjs checks that every shipped file is listed in ASSETS.
const VERSION = "tzalul-v1.0.0";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./fonts/rubik-hebrew-wght-normal.woff2",
  "./fonts/rubik-latin-wght-normal.woff2",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./js/main.js",
  "./js/store.js",
  "./js/crypto.js",
  "./js/calc.js",
  "./js/content.js",
  "./js/i18n.js",
  "./js/ui.js",
  "./js/views/parts.js",
  "./js/views/onboarding.js",
  "./js/views/home.js",
  "./js/views/progress.js",
  "./js/views/sos.js",
  "./js/views/tools.js",
  "./js/views/craving.js",
  "./js/views/checkin.js",
  "./js/views/slip.js",
  "./js/views/journal.js",
  "./js/views/more.js",
  "./js/views/plan.js",
  "./js/views/learn.js",
  "./js/views/timeline.js",
  "./js/views/settings.js",
  "./js/views/about.js",
  "./js/views/lock.js",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS.map(a => new Request(a, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("tzalul-") && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  if (req.mode === "navigate") {
    // app shell: cached index first (works offline), refreshed in the background
    e.respondWith(caches.match("./index.html").then(hit => {
      const net = fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put("./index.html", copy)); } return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(r => {
    if (r.ok && r.type === "basic") { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return r;
  })));
});
