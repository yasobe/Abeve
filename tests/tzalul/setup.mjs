// Minimal browser globals for running the app's pure modules under Node.
if (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== "function") {
  const m = new Map();
  globalThis.localStorage = {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    clear: () => m.clear(),
  };
}
export const APP = new URL("../../docs/tzalul/", import.meta.url);
export const mod = p => import(new URL(p, APP).href);
