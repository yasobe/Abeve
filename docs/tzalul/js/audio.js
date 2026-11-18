// Narration player for the library. One shared <audio>, so starting one article stops any other.
// Every element with [data-player][data-id] is kept in sync (play state, progress, time).

const audio = typeof Audio === "function" ? new Audio() : null;
if (audio) audio.preload = "none";
let current = null;      // article id loaded into the element
let failed = new Set();  // ids whose file could not be loaded

export const audioSrc = id => `audio/${id}.mp3`;

const fmt = s => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

export function sync() {
  if (typeof document === "undefined") return;
  document.querySelectorAll("[data-player][data-id]").forEach(el => {
    const id = el.dataset.id;
    const mine = current === id;
    const playing = mine && audio && !audio.paused && !audio.ended && !failed.has(id);
    const dur = mine && Number.isFinite(audio.duration) ? audio.duration : 0;
    const pos = mine ? audio.currentTime : 0;
    el.classList.toggle("playing", playing);
    el.classList.toggle("started", mine && pos > 0);
    el.classList.toggle("loading", mine && playing && audio.readyState < 3);
    el.classList.toggle("failed", failed.has(id));
    const btn = el.querySelector("[data-act=audioToggle]");
    if (btn) btn.setAttribute("aria-label", playing ? "השהיה" : "השמעה");
    const bar = el.querySelector("[data-audio-bar]");
    if (bar) bar.style.width = `${dur ? (100 * pos) / dur : 0}%`;
    const seek = el.querySelector("[data-audio-seek]");
    if (seek && document.activeElement !== seek) {
      seek.value = dur ? String(Math.round((1000 * pos) / dur)) : "0";
      seek.setAttribute("aria-valuetext", `${fmt(pos)} מתוך ${fmt(dur)}`);
    }
    const tm = el.querySelector("[data-audio-time]");
    if (tm) tm.textContent = failed.has(id) ? "ההקלטה לא זמינה" : mine && (pos > 0 || playing) ? `${fmt(pos)} / ${fmt(dur)}` : tm.dataset.idle || "";
  });
}

if (audio) {
  for (const ev of ["play", "pause", "ended", "timeupdate", "loadedmetadata", "waiting", "playing", "seeked"]) audio.addEventListener(ev, sync);
  audio.addEventListener("ended", () => { audio.currentTime = 0; sync(); });
  audio.addEventListener("error", () => { if (current) failed.add(current); sync(); });
}

/** Play/pause the article `id`; any other article that is playing stops. */
export function toggle(id) {
  if (!audio) return;
  if (current === id && !audio.paused) { audio.pause(); return; }
  if (current !== id) {
    audio.pause();
    current = id;
    failed.delete(id);
    audio.src = audioSrc(id);
  }
  audio.play().catch(() => { if (audio.error) failed.add(id); sync(); });
  sync();
}

/** Seek within the current article: frac 0..1. Starts it if it is not the loaded one. */
export function seek(id, frac) {
  if (!audio) return;
  if (current !== id) { toggle(id); audio.addEventListener("loadedmetadata", () => { audio.currentTime = frac * audio.duration; }, { once: true }); return; }
  if (Number.isFinite(audio.duration)) audio.currentTime = Math.min(audio.duration, Math.max(0, frac * audio.duration));
}

export function stop() {
  if (!audio || !current) return;
  audio.pause();
  sync();
}

export const isPlaying = id => !!audio && current === id && !audio.paused;
