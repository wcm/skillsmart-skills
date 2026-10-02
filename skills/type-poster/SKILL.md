---
name: type-poster
description: Design bold typographic event posters in the Swiss and brutalist traditions — huge stacked type, a single signal colour, strict grids — and export them as high-resolution PNG and print-ready A3 PDF. Use for gig, talk, exhibition, workshop, meetup or launch posters, flyers and "make a poster for…" requests, even when the user only gives event details.
---

# Type Poster

Makes typographic posters where the words *are* the image. Output: `poster.html` (editable), `out/*.png` (screen and social, 3× resolution) and `out/poster.pdf` (A3 print).

## What you need

- Event details: name, date, time, place, organiser, link. Ask for anything missing in one message.
- Node 18+ for export, and Chrome or Edge (or Playwright's Chromium).

## Steps

1. **Copy** `assets/template/poster.html` and `scripts/render.mjs` into a new folder in the user's project (e.g. `./poster-<event>/`).
2. **Choose one layout** and say why:
   - `layout-swiss` — three huge stacked words, a red rule, the date top-right. Default; works for almost anything.
   - `layout-brutal` — dark background, one giant rotated word bleeding off the edge. Music, nightlife, bold launches.
   - `layout-orbit` — words orbiting a solid disc. Talks, exhibitions, anything "around a theme".
   Delete the other two `<article>`s.
3. **Write the type.** Read `references/type-systems.md`. The title must fit: 1–3 short words per line for Swiss (≤ 9 characters each at 228 px), one word ≤ 7 characters for the brutal giant. If a word is longer, reduce `font-size` in steps of 12 px until it fits with the margin intact — never let type overflow unintentionally.
4. **Colour.** Set `--paper`, `--ink`, `--accent` (one signal colour only). Use brand colours if given.
5. **Export:**
   ```bash
   cd poster-<event>
   npm i --no-save playwright-core            # once; uses installed Chrome
   node render.mjs png poster.html --selector .poster --scale 3 --out out
   node render.mjs pdf poster.html --out out/poster.pdf --width 1123 --height 1587
   ```
   No Chrome? `npm i --no-save playwright && npx playwright install chromium`.
6. **Check the PNG yourself** (open/read the image): nothing clipped, nothing overlapping, footer readable, margins even. Fix and re-export before showing the user.
7. **Hand over:** show the PNG, say where the PDF is, and offer two variations (e.g. the other layouts or a colour swap).

## Rules

- Type only — no stock photos or illustrations unless the user supplies them.
- One accent colour. Black/white/paper plus one signal.
- Keep the footer information accurate: dates, times and URLs exactly as the user gave them.
