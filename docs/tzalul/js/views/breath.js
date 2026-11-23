// Guided breathing widget, used on the breathing screen and inside SOS.

import { html } from "../util.js";
import { icon, vibrate } from "../ui.js";
import { BREATHING } from "../content.js";

export function breathWidget(pid = "box") {
  return html`<div class="breath" data-pattern="${pid}">
    <div class="breath-pick seg" role="radiogroup" aria-label="סוג נשימה">
      ${BREATHING.map(b => html`<label><input type="radio" name="bp" value="${b.id}" ${b.id === pid ? "checked" : ""}><span>${b.t}</span></label>`)}
    </div>
    <p class="muted small breath-desc">${BREATHING.find(b => b.id === pid).d}</p>
    <div class="breath-stage">
      <div class="breath-orb" aria-hidden="true"></div>
      <div class="breath-text" aria-live="polite"><span class="b-phase">מוכנים?</span><span class="b-count"></span></div>
    </div>
    <div class="breath-ctl">
      <button type="button" class="btn primary b-toggle">${icon("play")}<span>התחלה</span></button>
      <span class="muted small b-cycles" aria-live="off"></span>
    </div>
  </div>`;
}

/** Wire a rendered breathWidget. Returns a cleanup function. */
export function runBreath(root) {
  const box = root.querySelector(".breath");
  if (!box) return () => {};
  const orb = box.querySelector(".breath-orb");
  const phase = box.querySelector(".b-phase");
  const count = box.querySelector(".b-count");
  const cycles = box.querySelector(".b-cycles");
  const toggle = box.querySelector(".b-toggle");
  let pat = BREATHING.find(b => b.id === box.dataset.pattern) || BREATHING[0];
  let running = false, step = 0, stepStart = 0, raf = 0, n = 0, lastSec = -1;

  const setBtn = () => {
    toggle.innerHTML = running ? `${icon("pause")}<span>עצירה</span>` : `${icon("play")}<span>התחלה</span>`;
  };

  function enter(i) {
    step = i;
    stepStart = performance.now();
    const [label, secs, kind] = pat.steps[i];
    phase.textContent = label;
    orb.dataset.kind = kind;
    orb.style.transitionDuration = `${secs}s`;
    // in/out scale the orb; holds keep the current size
    if (kind === "in") orb.classList.add("big");
    if (kind === "out") orb.classList.remove("big");
    lastSec = -1;
    vibrate(8);
  }

  function frame(t) {
    if (!running) return;
    const [, secs] = pat.steps[step];
    const el = (t - stepStart) / 1000;
    const left = Math.max(0, Math.ceil(secs - el));
    if (left !== lastSec) { count.textContent = left || ""; lastSec = left; }
    if (el >= secs) {
      const next = (step + 1) % pat.steps.length;
      if (next === 0) { n++; cycles.textContent = `${n} מחזורים`; }
      enter(next);
    }
    raf = requestAnimationFrame(frame);
  }

  function start() { running = true; n = 0; cycles.textContent = ""; enter(0); setBtn(); raf = requestAnimationFrame(frame); }
  function stop() {
    running = false; cancelAnimationFrame(raf);
    orb.classList.remove("big"); orb.style.transitionDuration = "1.2s";
    phase.textContent = n ? "כל הכבוד" : "מוכנים?"; count.textContent = ""; setBtn();
  }

  toggle.addEventListener("click", () => (running ? stop() : start()));
  box.addEventListener("change", e => {
    if (e.target.name !== "bp") return;
    pat = BREATHING.find(b => b.id === e.target.value) || BREATHING[0];
    box.dataset.pattern = pat.id;
    box.querySelector(".breath-desc").textContent = pat.d;
    if (running) { stop(); start(); }
  });
  return () => { running = false; cancelAnimationFrame(raf); };
}
