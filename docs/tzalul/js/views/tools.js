// Guided exercises: breathing, urge surfing, 5-4-3-2-1 grounding, play the tape forward, distractions.
import { html, icon, toast, haptic } from "../ui.js";
import { g, gx, minutes as minTxt } from "../i18n.js";
import { BREATHING, BREATH_LABEL, SURF_PROMPTS, GROUNDING, TAPE, DISTRACTIONS } from "../content.js";
import { head, seg, range } from "./parts.js";
import { uid } from "../store.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const logUse = (ctx, tool) => ctx.update(s => { s.toolUses.push({ tool, ts: new Date().toISOString() }); }, { render: false });

// ---------------------------------------------------------------------------------------------
let breathKey = "box";
function breathe() {
  const p = BREATHING.find(b => b.k === breathKey);
  return html`
    ${head("נשימה", { back: "sos", sub: "נשיפה ארוכה מרגיעה את מערכת העצבים. אפשר לעצור בכל רגע." })}
    <div class="seg2">${seg("pattern", BREATHING.map(b => ({ k: b.k, label: b.title })), breathKey, { label: "סוג נשימה" })}</div>
    <p class="small muted center">${p.desc}</p>
    <div class="breath" data-state="idle">
      <div class="breath-circle" aria-hidden="true"><div class="breath-core"></div></div>
      <p class="breath-label" aria-live="assertive">מוכנים?</p>
      <p class="breath-count num" aria-hidden="true"></p>
    </div>
    <p class="center small muted" data-cycles></p>
    <div class="row-btns center">
      <button class="btn primary" data-act="breathToggle">${icon("wind", 18)} להתחיל</button>
    </div>`;
}

function breathMount(root, ctx) {
  let timer = null, cycles = 0, running = false, phaseEnd = 0, countT = null;
  const box = root.querySelector(".breath"), circle = root.querySelector(".breath-circle"), label = root.querySelector(".breath-label"),
    count = root.querySelector(".breath-count"), btn = root.querySelector('[data-act="breathToggle"]'), cyc = root.querySelector("[data-cycles]");
  const pattern = () => BREATHING.find(b => b.k === breathKey);
  function phase(i) {
    const steps = pattern().steps;
    if (i >= steps.length) { i = 0; cycles++; cyc.textContent = `${cycles} ${cycles === 1 ? "מחזור" : "מחזורים"}`; }
    const [kind, sec] = steps[i];
    const prev = steps[(i + steps.length - 1) % steps.length][0];
    if (kind === "hold") box.style.setProperty("--held", prev === "out" ? ".55" : prev === "in2" ? "1.06" : "1");
    label.textContent = BREATH_LABEL[kind];
    box.dataset.state = kind;
    circle.style.transitionDuration = reduced() ? "0s" : `${sec}s`;
    haptic(kind === "hold" ? 0 : 15);
    phaseEnd = Date.now() + sec * 1000;
    const upd = () => { count.textContent = Math.max(1, Math.ceil((phaseEnd - Date.now()) / 1000)); };
    upd(); clearInterval(countT); countT = setInterval(upd, 200);
    timer = setTimeout(() => phase(i + 1), sec * 1000);
  }
  function stop() {
    running = false; clearTimeout(timer); clearInterval(countT);
    box.dataset.state = "idle"; label.textContent = cycles ? "יפה מאוד." : "מוכנים?"; count.textContent = "";
    btn.innerHTML = `${icon("wind", 18)} להתחיל`;
    if (cycles >= 1) logUse(ctx, "breathe");
  }
  btn.addEventListener("click", () => {
    if (running) return stop();
    running = true; cycles = 0; cyc.textContent = "";
    btn.textContent = "לעצור";
    phase(0);
  });
  const onChange = e => { if (e.target.name === "pattern") { breathKey = e.target.value; if (running) stop(); ctx.rerender(); } };
  root.addEventListener("change", onChange);
  return () => { clearTimeout(timer); clearInterval(countT); root.removeEventListener("change", onChange); };
}

// ---------------------------------------------------------------------------------------------
const surf = { phase: "setup", minutes: 10, before: 6 };
function surfView() {
  if (surf.phase === "setup") return html`
    ${head("גלישה על הדחף", { back: "sos", sub: "לא נלחמים בגל, לא נכנעים לו — מתבוננים בו עד שהוא עובר." })}
    <form data-form="surfStart" class="card form">
      ${range("before", { min: 1, max: 10, value: surf.before, label: "כמה חזק החשק עכשיו?", unit: "מתוך 10" })}
      <div class="field"><span class="field-label">כמה זמן?</span>
        ${seg("minutes", [5, 10, 15, 20].map(m => ({ k: m, label: `${m} דק׳` })), surf.minutes, { label: "משך" })}</div>
      <button class="btn primary wide" type="submit">${icon("wave", 18)} להתחיל לגלוש</button>
    </form>`;
  if (surf.phase === "run") return html`
    ${head("גלישה על הדחף", { sub: "הטלפון יכול להישאר ביד. רק לקרוא ולנשום." })}
    <div class="surf">
      <svg class="surf-wave" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 70 Q 50 40 100 70 T 200 70 T 300 70 T 400 70 V120 H0Z"/>
        <path class="w2" d="M0 80 Q 50 55 100 80 T 200 80 T 300 80 T 400 80 V120 H0Z"/>
      </svg>
      <p class="surf-time num" aria-live="off" data-surf-time></p>
      <p class="surf-prompt" aria-live="polite" data-surf-prompt>${gx(SURF_PROMPTS[0])}</p>
      <div class="bar thin"><span data-surf-bar></span></div>
    </div>
    <div class="row-btns center"><button class="btn ghost" data-act="surfEnd">סיימתי מוקדם</button></div>`;
  return html`
    ${head("עברת את הגל", { back: "sos" })}
    <form data-form="surfSave" class="card form">
      <div class="burst center" aria-hidden="true">${icon("shield", 40)}</div>
      <p class="lead center">${g("נשארת", "נשארת", "נשארת")} עם החשק ${g("ולא נתת לו לנהל אותך", "ולא נתת לו לנהל אותך")}. זה בדיוק השריר שבונים.</p>
      ${range("after", { min: 0, max: 10, value: Math.max(0, surf.before - 3), label: "כמה חזק החשק עכשיו?", unit: "מתוך 10" })}
      <p class="small muted">התחלת ב־<span class="num">${surf.before}</span>/10.</p>
      <button class="btn primary wide" type="submit">לשמור ביומן החשקים</button>
      <button class="btn ghost wide" type="button" data-act="surfAgain">עוד סבב</button>
    </form>`;
}
function surfMount(root, ctx) {
  if (surf.phase !== "run") return;
  const total = surf.minutes * 60e3;
  const startAt = surf.startedAt || (surf.startedAt = Date.now());
  const el = k => root.querySelector(`[data-surf-${k}]`);
  let lastPrompt = 0;
  const tick = () => {
    const left = Math.max(0, total - (Date.now() - startAt));
    const s = Math.ceil(left / 1000);
    el("time").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    el("bar").style.width = `${(100 * (1 - left / total)).toFixed(1)}%`;
    const pi = Math.min(SURF_PROMPTS.length - 1, Math.floor((1 - left / total) * SURF_PROMPTS.length));
    if (pi !== lastPrompt) { lastPrompt = pi; el("prompt").textContent = gx(SURF_PROMPTS[pi]); haptic(12); }
    if (left <= 0) { surf.phase = "done"; surf.startedAt = 0; haptic([30, 60, 30]); ctx.rerender(); }
  };
  tick();
  const t = setInterval(tick, 500);
  return () => clearInterval(t);
}

// ---------------------------------------------------------------------------------------------
let groundStep = 0;
function ground() {
  if (groundStep >= GROUNDING.length) return html`
    ${head("קרקוע", { back: "sos" })}
    <div class="card center">
      <div class="burst" aria-hidden="true">${icon("eye", 40)}</div>
      <p class="lead">${g("חזרת", "חזרת", "חזרת")} לכאן ועכשיו.</p>
      <p class="muted">איך החשק עכשיו? אם הוא עדיין חזק — אפשר לעבור לנשימה או לגלישה.</p>
      <div class="row-btns center"><a class="btn primary" href="#/tools/breathe">לנשימה</a><button class="btn ghost" data-act="groundAgain">שוב מההתחלה</button></div>
    </div>`;
  const st = GROUNDING[groundStep];
  return html`
    ${head("קרקוע 5־4־3־2־1", { back: "sos", sub: "להחזיר את הקשב מהחשק אל החושים." })}
    <div class="card ground">
      <p class="ground-n num" aria-hidden="true">${st.n}</p>
      <h2>${st.n} ${gx(st.sense)}</h2>
      <p class="muted">${gx(st.hint)}</p>
      <div class="ground-dots" role="group" aria-label="סימון">
        ${Array.from({ length: st.n }, (_, i) => html`<button class="gdot" data-act="gdot" aria-pressed="false" aria-label="${i + 1}">${i + 1}</button>`)}
      </div>
      <button class="btn primary wide" data-act="groundNext">${groundStep === GROUNDING.length - 1 ? "סיום" : "הבא"}</button>
    </div>
    <div class="steps-dots" aria-hidden="true">${GROUNDING.map((_, i) => html`<span class="${i <= groundStep ? "on" : ""}"></span>`)}</div>`;
}

// ---------------------------------------------------------------------------------------------
let tapeAnswers = [];
function tape(ctx) {
  const s = ctx.state;
  return html`
    ${head("להריץ את הסרט קדימה", { back: "sos", sub: "החשק מראה רק את 5 הדקות הראשונות. בואו נראה את כל הסרט." })}
    <form data-form="tape" class="card form">
      ${TAPE.map((q, i) => html`<label class="field"><span class="field-label">${q}</span><textarea name="a${i}" rows="2" maxlength="500">${tapeAnswers[i] || ""}</textarea></label>`)}
      ${s.profile.reasons.length ? html`<div class="soft-box"><p class="eyebrow">${icon("heart", 14)} ולזכור</p><ul class="reasons">${s.profile.reasons.slice(0, 4).map(r => html`<li>${r}</li>`)}</ul></div>` : ""}
      <button class="btn primary wide" type="submit">לשמור ביומן</button>
    </form>`;
}

// ---------------------------------------------------------------------------------------------
function distract() {
  const list = [...DISTRACTIONS].sort(() => Math.random() - 0.5);
  return html`
    ${head("הסחה", { back: "sos", sub: "לבחור דבר אחד ולעשות אותו עכשיו. הגוף זז — החשק נחלש." })}
    <ul class="pick-list">${list.map(x => html`<li><button class="pick" data-act="pickDistract">${icon("spark", 18)}<span>${x}</span></button></li>`)}</ul>`;
}

// ---------------------------------------------------------------------------------------------
const TOOLS = { breathe, surf: surfView, ground, tape, distract };
const TITLES = { breathe: "נשימה", surf: "גלישה על הדחף", ground: "קרקוע", tape: "הסרט קדימה", distract: "הסחה" };

export default {
  title: (ctx, [t]) => TITLES[t] || "תרגילים",
  render(ctx, [t]) {
    const fn = TOOLS[t];
    if (!fn) return html`${head("תרגילים", { back: "sos" })}<p><a href="#/sos">חזרה</a></p>`;
    return fn(ctx);
  },
  mount(root, ctx, [t]) {
    if (t === "breathe") return breathMount(root, ctx);
    if (t === "surf") return surfMount(root, ctx);
  },
  forms: {
    surfStart(fd, f, ctx) {
      surf.before = Number(fd.get("before")) || 5;
      surf.minutes = Number(fd.get("minutes")) || 10;
      surf.phase = "run"; surf.startedAt = Date.now();
      ctx.rerender();
    },
    surfSave(fd, f, ctx) {
      const after = Number(fd.get("after"));
      ctx.update(s => {
        s.cravings.push({ id: uid(), ts: new Date().toISOString(), intensity: surf.before, trigger: null, coping: ["surf"], outcome: "resisted", note: `גלישה של ${surf.minutes} דקות. העוצמה ירדה מ־${surf.before} ל־${after}.` });
        s.toolUses.push({ tool: "surf", ts: new Date().toISOString() });
      }, { render: false });
      surf.phase = "setup";
      toast("נשמר. כל הכבוד.");
      ctx.go(`craving/edit/${ctx.state.cravings[ctx.state.cravings.length - 1].id}`);
    },
    tape(fd, f, ctx) {
      tapeAnswers = TAPE.map((_, i) => String(fd.get(`a${i}`) || "").trim());
      const text = TAPE.map((q, i) => (tapeAnswers[i] ? `${q}\n${tapeAnswers[i]}` : "")).filter(Boolean).join("\n\n");
      ctx.update(s => {
        s.toolUses.push({ tool: "tape", ts: new Date().toISOString() });
        if (text) s.journal.push({ id: uid(), ts: new Date().toISOString(), prompt: "להריץ את הסרט קדימה", text, mood: null });
      }, { render: false });
      tapeAnswers = [];
      toast(text ? "נשמר ביומן" : "יפה. החשק עובר.");
      ctx.go("sos");
    },
  },
  actions: {
    surfEnd(el, ctx) { surf.phase = "done"; surf.startedAt = 0; ctx.rerender(); },
    surfAgain(el, ctx) { surf.phase = "setup"; ctx.rerender(); },
    gdot(el) { const on = el.getAttribute("aria-pressed") !== "true"; el.setAttribute("aria-pressed", String(on)); },
    groundNext(el, ctx) {
      groundStep++;
      if (groundStep === GROUNDING.length) logUse(ctx, "ground");
      ctx.rerender();
    },
    groundAgain(el, ctx) { groundStep = 0; ctx.rerender(); },
    pickDistract(el, ctx) {
      logUse(ctx, "distract");
      toast(`קדימה. ${minTxt(10)} — ואז בודקים איך החשק.`);
      el.classList.add("picked");
    },
  },
  onRouteLeave() { groundStep = 0; },
};
