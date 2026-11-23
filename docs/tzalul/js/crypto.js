// Local encryption for the optional PIN lock.
// PBKDF2-SHA256 (600k iterations) -> AES-GCM 256. The key never leaves memory
// and is non-extractable. Without the PIN the stored data cannot be read.

const enc = new TextEncoder();
const dec = new TextDecoder();
export const ITERATIONS = 600000;

const b64 = buf => {
  const u = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export function randomBytes(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

export async function deriveKey(pin, salt, iterations = ITERATIONS) {
  const base = await crypto.subtle.importKey("raw", enc.encode(String(pin)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Create a new vault key from a PIN. Returns {key, salt(b64), iterations}. */
export async function newVaultKey(pin) {
  const salt = randomBytes(16);
  return { key: await deriveKey(pin, salt), salt: b64(salt), iterations: ITERATIONS };
}

export async function seal(key, meta, text) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
  return JSON.stringify({ v: 1, alg: "PBKDF2-SHA256/AES-GCM", salt: meta.salt, it: meta.iterations, iv: b64(iv), ct: b64(ct) });
}

export function parseVault(json) {
  const o = JSON.parse(json);
  if (!o || o.v !== 1 || typeof o.salt !== "string" || typeof o.iv !== "string" || typeof o.ct !== "string") throw new Error("vault");
  const it = Number(o.it);
  if (!Number.isInteger(it) || it < 100000 || it > 5000000) throw new Error("vault");
  return o;
}

/** Try a PIN. Resolves {key, meta, text} or rejects when the PIN is wrong. */
export async function unseal(json, pin) {
  const o = parseVault(json);
  const key = await deriveKey(pin, unb64(o.salt), o.it);
  const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(o.iv) }, key, unb64(o.ct));
  return { key, meta: { salt: o.salt, iterations: o.it }, text: dec.decode(buf) };
}
