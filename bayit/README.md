# בית בידיים (Bayit) — home maintenance & DIY

A Hebrew, right-to-left web app for home maintenance and DIY repairs. It is plain HTML, CSS and JavaScript, with no build step and no dependencies. It runs on phones and desktops, in light and dark mode.

## Run it

```bash
python3 -m http.server 8080 -d bayit   # then open http://localhost:8080/
```

Opening `bayit/index.html` straight from disk also works. All data stays in the browser's `localStorage` (key `bayit.v1`). Use **Settings → Export** to back it up.

## Features

| Screen | What it does |
|---|---|
| **לוח בקרה** (Dashboard) | An emergency card (where the main water valve, electrical panel and gas valve are, your tradespeople's numbers, Israeli emergency numbers, and step-by-step guides for a flood, gas smell, electrical fire and power cut). Greeting with today's status, KPI tiles (overdue tasks, this week, low stock, tools/batteries due), the next tasks with one-tap completion, a 14-day load timeline, seasonal recommendations for Israel, quick diagnosis links and battery health at a glance. |
| **תרשימים** (Diagrams) | 6 hand-drawn SVG systems with 56 clickable parts: sink plumbing, toilet tank, electric/solar water heater, home electrical panel, drywall framing, and the main water system (meter, main valve, filter, pressure reducer, manifold). Each part opens a popover (a bottom sheet on phones) with what the part does, common faults, a pro tip and difficulty. Popovers can jump to the matching diagnosis or add a recurring reminder. Also: labels toggle, guided tour, arrow-key navigation, deep links (`#/diagrams/sink/trap`). |
| **אבחון תקלות** (Troubleshooting) | 16 decision trees leading to 96 solutions: faucet, toilet, clogged drain, electricity/RCD, water heater (no hot water, leaks, safety valve, rusty or smelly water, noise), damp/mould, doors, A/C, low water pressure, sewer smell, wall holes/cracks/peeling paint, roller shutters and sliding windows, washing machine, fridge, dishwasher, and smoke detectors. Recently viewed diagnoses appear at the top. A solution has a DIY / careful / call-a-pro rating, time, difficulty, safety warnings, a step checklist that is saved, tools matched against your tool list, and materials matched against your inventory, with one-click "add missing to shopping list". You can also add it as a task, copy a summary to send to a professional, or jump to the part in the diagram. The answer path lives in the URL, so the browser Back button steps back through the questions. Number keys pick answers. |
| **תחזוקה** (Maintenance) | **Tasks:** recurring schedules (weekly through every 3 years) that roll forward on completion, with filters, categories, priority and undo. **Inventory:** quantity steppers, minimum thresholds, search and filters, and a shopping list you can copy, share or mark as restocked. **Tools:** service intervals with progress bars and a "serviced" action. **18V batteries:** one-tap charge-cycle logging, a cycle-use ring against the rated cycles, estimated remaining capacity (cycle wear plus calendar ageing), a weekly charge chart, long-storage and end-of-life warnings, and Li-ion care tips. |

**Search** (the magnifier, or `/`) covers problems, solutions, diagram parts, your tasks, inventory and tools, and understands everyday synonyms (נזילה / דליפה / טפטוף…).

**Backup:** Settings exports to a file, or copies the backup as text and restores it by pasting. Copy and paste also works where file downloads are blocked, e.g. inside an embedded page.

## Single-file build

`python3 bayit/bundle.py OUT.html` inlines all CSS and JS into one file (used for the phone link).

## Code map

```
bayit/
  index.html             app shell (rail on desktop, tab bar on mobile)
  css/styles.css         design tokens (light/dark), components, diagram scene styles
  js/core.js             helpers: dates (he-IL), recurrence, store + sanitizer, icons, toasts, modals, form builder, battery model
  js/seed.js             demo data (dates relative to today)
  js/diagrams-data.js    SVG scenes + part content
  js/trees-data.js       decision trees + solutions
  js/view-*.js           one file per screen
  js/extras.js           global search, emergency card
  js/app.js              hash router, navigation, theme, settings/backup
```

Rules worth keeping:
- Escape every dynamic value with `HB.esc()`.
- Any new stored field must be added to `HB.clean()`. That function sanitizes everything loaded from storage or imported from a backup file.
- Diagram hotspots use viewBox coordinates. `lp` sets which side the label goes on (`e`/`w`/`n`/`s`).
