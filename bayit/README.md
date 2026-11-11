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
| **לוח בקרה** (Dashboard) | Greeting with today's status, KPI tiles (overdue tasks, this week, low stock, tools/batteries due), the next tasks with one-tap completion, a 14-day load timeline, seasonal recommendations for Israel, quick diagnosis links and battery health at a glance. |
| **תרשימים** (Diagrams) | 5 hand-drawn SVG systems with 48 clickable parts: sink plumbing, toilet tank, electric/solar water heater, home electrical panel, and drywall framing. Each part opens a popover (a bottom sheet on phones) with what the part does, common faults, a pro tip and difficulty. Popovers can jump to the matching diagnosis or add a recurring reminder. Also: labels toggle, guided tour, arrow-key navigation, deep links (`#/diagrams/sink/trap`). |
| **אבחון תקלות** (Troubleshooting) | 8 decision trees (faucet, toilet, clogged drain, electricity/RCD, no hot water, damp/mould, doors, A/C) leading to about 45 solutions. A solution has a DIY / careful / call-a-pro rating, time, difficulty, safety warnings, a step checklist that is saved, tools matched against your tool list, and materials matched against your inventory, with one-click "add missing to shopping list". You can also add it as a task, copy a summary to send to a professional, or jump to the part in the diagram. The answer path lives in the URL, so the browser Back button steps back through the questions. Number keys pick answers. |
| **תחזוקה** (Maintenance) | **Tasks:** recurring schedules (weekly through every 3 years) that roll forward on completion, with filters, categories, priority and undo. **Inventory:** quantity steppers, minimum thresholds, search and filters, and a shopping list you can copy, share or mark as restocked. **Tools:** service intervals with progress bars and a "serviced" action. **18V batteries:** one-tap charge-cycle logging, a cycle-use ring against the rated cycles, estimated remaining capacity (cycle wear plus calendar ageing), a weekly charge chart, long-storage and end-of-life warnings, and Li-ion care tips. |

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
  js/app.js              hash router, navigation, theme, settings/backup
```

Rules worth keeping:
- Escape every dynamic value with `HB.esc()`.
- Any new stored field must be added to `HB.clean()`. That function sanitizes everything loaded from storage or imported from a backup file.
- Diagram hotspots use viewBox coordinates. `lp` sets which side the label goes on (`e`/`w`/`n`/`s`).
