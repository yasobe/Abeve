# צלול (Tzalul) — developer guide

A Hebrew, right-to-left Progressive Web App that helps people stop using cannabis and stay stopped.
Private by design: **all data stays on the device** — no account, no server, no analytics, no third-party requests.

---

## 1. Features

| Area | What it does |
|---|---|
| **Onboarding** | Name, form of address (male / female / neutral Hebrew), plan (quit now / already quit / set a quit date / gradual taper), usage baseline, personal reasons. |
| **Home** | Live streak counter with milestone ring, money / sessions / grams / time regained, daily check-in card, quick actions, “reason of the day”, next body milestone, savings-goal progress, daily quote. Before the quit date: countdown and a preparation checklist; in taper mode: daily target with a +/− logger and a plan-vs-actual chart. |
| **SOS — “עזרה עכשיו”** | Guided urge surfing (timer with rotating prompts), breathing (box, 4-7-8, physiological sigh, even), 5-4-3-2-1 grounding, “play the tape forward”, distraction ideas, personal reasons and if-then plans, one-tap call to support contacts, crisis lines (ער״ן 1201, מד״א 101). |
| **Logging** | Craving log (time, intensity, trigger, coping used, outcome); daily check-in (mood, sleep, energy, peak craving, withdrawal symptoms with tips, daily win, note); slip flow that is non-judgmental, asks what happened and what to do next time, and lets the user keep or restart the streak (total clean time is never erased). |
| **Journal** | Free writing with rotating CBT-style prompts, search, plus history tabs for check-ins, cravings and slips. |
| **Progress** | Current / best / total streaks, savings, personal insights (peak craving hour, top trigger, best coping strategy, mood / sleep / craving trends), 14/30/90-day charts, cravings by hour, triggers, what helps, symptom frequency, 20 achievements, streak history. |
| **My plan** | Reasons and a “sentence for hard moments”, triggers with coping plans, if-then plans, warning signs, support contacts, rewards bought with saved money. |
| **Body timeline** | What typically happens after quitting (24h → 1 year), with progress, a symptom guide and sources. |
| **Library** | 8 short evidence-informed articles (withdrawal, urge surfing, sleep, slips, permission-giving thoughts, boredom and anxiety, social situations, when to get help) and a help-resources page. |
| **Settings** | Profile, quit date / mode, baseline, theme (auto/light/dark), haptics, show-money toggle, daily reminder (`.ics` calendar event with a discreet title), **PIN/passphrase lock with AES-256 encryption**, auto-lock, backup export / import, delete everything. |
| **Celebrations** | A sheet appears when a new achievement unlocks. |

Health statements are cautious (“אצל רוב האנשים”, “בדרך כלל”) and sourced (DSM-5; Budney 2003; Hirvonen 2012; Schuster 2018; Bahji 2020). The app states clearly that it is not a substitute for medical care.

---

## 2. Tech stack and layout

No build step and no runtime dependencies: vanilla JavaScript ES modules, hand-written CSS, inline SVG icons and charts.
Rubik (OFL) is self-hosted, so the app makes **zero external requests**.

```
docs/tzalul/
  index.html             shell + strict CSP (script-src 'self', no external hosts)
  manifest.webmanifest   installable PWA (RTL, shortcuts to SOS and check-in)
  sw.js                  offline-first service worker — bump VERSION on every release
  css/app.css            design tokens (light + dark), components, phone + desktop (≥960px side menu)
  fonts/                 Rubik variable woff2 (Hebrew + Latin subsets) + OFL licence
  icons/                 icon.svg + PNGs (192, 512, maskable, apple-touch)
  js/
    main.js              boot, hash router, event delegation, lock / auto-lock, celebrations
    store.js             state defaults, strict sanitize(), save/load, encryption on/off, backup
    crypto.js            PBKDF2-SHA256 (310k) → AES-GCM-256
    calc.js              pure logic: streaks, savings, milestones, taper plan, stats, achievements
    content.js           all Hebrew content (articles, timeline, triggers, prompts…)
    i18n.js              gendered Hebrew (g, gx), plurals with dual forms, dates, durations
    ui.js                auto-escaping html`` templates, icons, <dialog> sheets, toast, SVG charts
    views/*.js           one module per screen: { title, render(ctx, params), mount?, actions?, forms?, onChange? }
tests/tzalul/
  *.test.mjs             unit tests (node:test) — calc, i18n, store/encryption, ui escaping, content, sw/CSP
  e2e.cjs                Playwright end-to-end run of the main flows (serves docs/ itself)
.github/workflows/tzalul-tests.yml   runs both on every change
```

### Routing
Hash routes: `#/home`, `#/progress`, `#/sos`, `#/tools/{breathe|surf|ground|tape|distract}`, `#/craving[/edit/:id]`,
`#/checkin[/:date]`, `#/slip`, `#/journal[/checkins|cravings|slips|new|edit/:id]`, `#/more`, `#/plan`, `#/timeline`,
`#/learn[/:id|/resources]`, `#/settings`, `#/about`.

### How a view works
`render()` returns an `html\`\`` template (every interpolated value is escaped unless it is itself a template).
Clicks on `[data-act]` call `view.actions[act](el, ctx)`; submits of `form[data-form]` call `view.forms[name](formData, form, ctx)`.
State changes go through `ctx.update(fn)`, which saves and re-renders.

---

## 3. Running and testing

```bash
python3 -m http.server 8765 -d docs        # open http://localhost:8765/tzalul/
node --test tests/tzalul/*.test.mjs        # unit tests
node tests/tzalul/e2e.cjs                  # end-to-end (needs the `playwright` package + Chromium)
```

### Release checklist
1. Bump `VERSION` in `docs/tzalul/sw.js` (otherwise installed apps keep the old files).
2. If you add a file, add it to `ASSETS` in `sw.js` (a unit test fails otherwise).
3. Run the unit and e2e tests; check phone and desktop, light and dark.

---

## 4. Rules that keep the app safe and private

1. **Never build HTML by string concatenation** — use `html\`\`` from `ui.js`; never assign user data to `innerHTML`.
2. **Every new stored field must be added to `sanitize()`** in `store.js`, or it is dropped on load / import. Sanitizing is what neutralises malicious backup files.
3. **No external hosts.** The CSP in `index.html` allows only `'self'`. Do not add analytics, CDNs or remote fonts.
4. **When the lock is on, nothing is written in plain text** — `save()` refuses to write after the key has been forgotten (auto-lock).
5. Keep health content cautious and sourced; keep the crisis lines (ער״ן 1201, מד״א 101) reachable from SOS.

### Data model (localStorage key `tzalul_v1`)
`{ v, plain: state }` or, with a lock, `{ v, enc: { salt, iter, iv, ct } }`.
State: `profile` (name, gender, mode, quitAt, taperStart, baseline, reasons, why), `settings`, `attempts` (finished streaks),
`checkins`, `cravings`, `journal`, `slips`, `taperLog`, `toolUses`, `plan` (triggers, ifThen, warning, contacts, rewards, prep), `seen`.

### Known limits / ideas
- Without a server, reminders are a recurring calendar event (`.ics`) rather than push notifications.
- A forgotten lock code cannot be recovered (by design) — users should keep a backup.
- Ideas: encrypted backup files, optional end-to-end-encrypted sync, Arabic/English localisation, widget for the streak.
