// Optional at-rest encryption of the whole app state with a user code.
// PBKDF2-SHA256 (310k iterations) → AES-GCM-256. The GCM tag doubles as the
// "wrong code" check, so no verifier is stored.
const enc = new TextEncoder(), dec = new TextDecoder();
export const ITERATIONS = 310000;

export function b64(buf) {
  const u = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
export function unb64(s) {
  const bin = atob(String(s));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

export function randomBytes(n) { return crypto.getRandomValues(new Uint8Array(n)); }

export async function deriveKey(code, salt, iterations = ITERATIONS) {
  const base = await crypto.subtle.importKey("raw", enc.encode(String(code).normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptJSON(key, obj) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj)));
  return { iv: b64(iv), ct: b64(ct) };
}

/** Throws if the key is wrong or the data was tampered with. */
export async function decryptJSON(key, { iv, ct }) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ct));
  return JSON.parse(dec.decode(pt));
}
