// שער service worker: the gate must paint instantly, even on a weak connection.
// App shell is served from cache first and refreshed in the background. API calls are never cached.
// Bump VERSION on every release.
const VERSION = "shaar-v1.1.1";
const FILES = ["./", "./index.html", "./app.css", "./app.js", "./manifest.webmanifest",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith("shaar-") && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function refresh(req, key) {
  return fetch(req).then((r) => {
    if (r && r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(key || req, copy)).catch(() => {}); }
    return r;
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL("./", self.location).pathname)) return;
  if (req.mode === "navigate") {
    // every view is index.html with a different ?a=; answer from cache, update quietly
    const key = new URL("./index.html", self.location).href;
    e.respondWith(caches.match(key).then((hit) => {
      const net = refresh(new Request(key, { cache: "no-cache" }), key);
      return hit || net.catch(() => new Response("אין חיבור", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }));
    }));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => {
    const net = refresh(req);
    if (hit) { net.catch(() => {}); return hit; }
    return net;
  }));
});
