# צלול (Tzalul)

A Hebrew, right-to-left web app that helps people stop or cut down drinking. It works offline, keeps all data on the device, and can be installed on iPhone, Android and desktop.

> "צלול" means *clear*, as in clear water or a clear head.

## What it does

| Screen | What it offers |
|---|---|
| **היום** (Today) | Live alcohol-free counter with a ring showing progress to the next milestone, money/drinks/calories saved, total alcohol-free days, a one-tap daily check-in (mood, craving, drank?), a daily intention, a line of encouragement, the user's reasons, a savings goal, and an evening reminder banner |
| **יש לי דחף** (SOS) | Urge-surfing timer with rotating tips, guided breathing, the user's reasons, a "play the tape forward" exercise, HALT, distraction ideas, a one-tap call to a support person, and logging the craving at the end. A drink can be logged without judgement |
| **יומן** (Journal) | One timeline of check-ins, cravings, drinks, journal entries and gratitude, with filters and search |
| **התקדמות** (Progress) | Current streak, longest streak, alcohol-free days, savings, a 16-week calendar, 30-day mood chart, cravings per week, triggers, what helps, time of day, 21 milestones, a health timeline and a savings goal |
| **כלים** (Tools) | Breathing (box, 4-7-8, coherent), 5-4-3-2-1 grounding, HALT, a relapse-prevention plan, a CBT thought record, gratitude, a letter to self, reasons, the WHO **AUDIT** self-assessment with history, 8 short articles (withdrawal safety, cravings, after a lapse, social pressure, sleep, alternatives, HALT, treatment options), and Israeli support lines plus personal contacts |
| **הגדרות** (Settings) | Profile and drinking baseline, start date, theme, reminder (with a calendar `.ics` export), PIN lock, backup/restore, erase everything |

### Recovery design decisions

- **A lapse is not a failure.** Logging a drink restarts the *current* streak but never erases the total alcohol-free days or earlier milestones. The wording is supportive, and the form asks what to do differently next time.
- **Safety first.** Onboarding asks two questions about withdrawal. Anyone at risk is warned that stopping suddenly can be dangerous and is taken to the withdrawal-safety article. Emergency numbers (101 מד״א, 1201 ער״ן) are always one tap away on the SOS screen.
- **Two goals.** Users choose to quit or to cut down. Savings are measured against their own baseline, so both goals work.
- **Gendered Hebrew.** Users choose masculine, feminine or plural address, and key messages follow that choice.
- **Discreet.** The name and icon are neutral, and the calendar reminder is titled only "צ׳ק-אין יומי".
- **Health claims are cautious** ("may", "many people report") and carry a disclaimer. Support numbers were checked in November 2026 and are listed in `js/content.js` (`RESOURCES`).

## Privacy and security

- **No server, no account, no analytics, no third-party requests.** The font (Rubik, SIL OFL) is served from the app itself. The CSP in `index.html` blocks every outside connection (`connect-src 'self'`).
- **Optional PIN lock with real encryption:** PBKDF2-SHA256 (600,000 iterations) derives an AES-256-GCM key. When the lock is on, nothing readable is stored. The key is non-extractable and is dropped from memory when the app locks (immediately or after 1, 5 or 15 minutes in the background). Wrong PINs trigger a growing delay after 5 attempts. A forgotten PIN cannot be recovered; the only option is to erase and restore from a backup.
- **Every value written into HTML is escaped** by the `html` tagged template (`js/util.js`).
- **Every load, import and save passes through `clean()`** (`js/store.js`): a strict schema with type checks, length limits, allowed values, valid dates and safe ids. A hostile backup file cannot inject markup or bad data (covered by tests).
- Saves are skipped when nothing has changed, and a tab reloads when another tab changes the data, so an old tab can never overwrite newer data.

## Tech

Plain ES modules, HTML and CSS. **No build step and no runtime dependencies.** It is static files only, so it can be hosted anywhere.

```
tzalul/
  index.html            app shell, CSP, PWA meta
  sw.js                 service worker (offline, update prompt) – bump VERSION on release
  manifest.webmanifest
  css/app.css           design tokens (light/dark), RTL logical properties, responsive layout
  js/main.js            bootstrap, hash router, event delegation, live counters, auto-lock, SW
  js/store.js           state schema, clean() sanitizer, persistence, PIN vault, backup
  js/crypto.js          PBKDF2 + AES-GCM
  js/calc.js            pure calculations (streaks, savings, milestones, analytics, AUDIT)
  js/content.js         all Hebrew content (milestones, health timeline, articles, resources…)
  js/charts.js          dependency-free SVG/HTML charts with tooltips and table views
  js/ui.js              icons, sheets/dialogs, toasts, form helpers
  js/util.js            safe HTML templating, dates, Hebrew plurals and formatting
  js/views/*.js         one module per screen
  fonts/ icons/
  tests/unit.test.mjs   22 unit tests (node:test)
  tests/e2e.cjs         18-stage browser test (Playwright): phone, desktop, dark, offline
```

Each view module exports `{ title, back?, render(app), mount?(root, app), actions, forms, onInput?, onChange? }`. Clicks on `[data-act]` and submits of `form[data-form]` are dispatched to the current view.

## Run locally

```bash
cd tzalul
python3 -m http.server 8790        # or: npm start
# open http://localhost:8790/
```

## Tests

```bash
cd tzalul
npm test                           # unit tests (Node 20+)
python3 -m http.server 8790 &      # then, with Playwright installed:
npm run e2e                        # or: node tests/e2e.cjs <screenshot-dir>
```

The browser test covers onboarding (including the withdrawal-risk path), check-in, intention, SOS with breathing and craving log, journal XSS escaping, lapse logic, progress charts, every route on a phone screen with no horizontal overflow, AUDIT scoring, plan editing, PIN lock (data encrypted at rest, wrong PIN, reload), backup export, wipe, import of a hostile backup, the desktop layout in dark mode with keyboard shortcuts, and offline mode. It fails on any console error.

## Deploy

Any static host works (GitHub Pages, Netlify, Cloudflare Pages, S3). Serve the `tzalul/` folder over HTTPS, which service workers and Web Crypto require.

- **GitHub Pages:** this repo's Pages site already serves the Tick app from `docs/` on another branch. To publish צלול, either give it its own repository or Pages site, or copy the folder to `docs/tzalul/` on the live branch. If you use the subfolder, first scope Tick's service worker so it does not intercept `/tzalul/` requests.
- Add these HTTP headers if the host allows it (a `<meta>` CSP cannot set them): `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.

### Release checklist

1. Change the code and update `VERSION` in `js/content.js`.
2. Bump `VERSION` in `sw.js`. Otherwise installed apps keep the old files. Users get a "גרסה חדשה מוכנה – רענון" prompt.
3. If you add a file, add it to `FILES` in `sw.js`.
4. Run `npm test` and `npm run e2e`.

## Ideas for later

- Real push reminders. These need a push server; today the reminder uses an in-app banner plus a calendar `.ics` file.
- Optional end-to-end encrypted sync between devices.
- Arabic and Russian translations. All text is in `content.js` and the views; the layout is already RTL-aware.

## Disclaimer

צלול is a self-help tool. It does not provide medical advice, diagnosis or treatment. Anyone at risk of alcohol withdrawal should see a doctor before stopping. In an emergency in Israel, call 101.
