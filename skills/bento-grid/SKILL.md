---
name: bento-grid
description: Design a bento-box feature section — a grid of mixed-size tiles, each with a short headline, one line of copy and a tiny CSS/SVG visual, with smooth hover motion and a responsive mobile layout — as drop-in HTML/CSS or a component for the user's framework, plus a PNG for decks and social. Use for "features section", "bento grid", "Apple-style feature tiles", "showcase our features" or redesigning a dull feature list.
---

# Bento Feature Grid

Output: a self-contained section (`bento.html`) the user can paste into a page, converted to their framework if they have one, and optionally `out/bento.png`.

## Steps

1. **Gather features.** From the user's site/README/brief, pick 5–7 features. Rank them: the most important gets the biggest tile.
2. **Copy** `assets/template/bento.html` (and `scripts/render.mjs` if a PNG is wanted) into the project.
3. **Compose the grid** (6 columns, rows of 180 px). Each row of tiles must add up to 6 columns: e.g. `s-wide`(4)+`s-tall`(2), then three `s-third`(2), then `s-strip`(6). Use **one** `.accent` tile for the headline number or the key promise. Read `references/bento-rules.md`.
4. **Write copy.** Tile title ≤ 5 words; body ≤ 16 words. One stat (`{{STAT}}`) that's true — ask if unsure.
5. **Visuals.** Reuse the CSS micro-visuals (`viz-chart`, `viz-orbit`, `viz-stack`, `viz-big`) recoloured to the brand, or replace with the user's product screenshots (`<img>` with `object-fit: cover` inside `.viz`). Never use random stock imagery.
6. **Integrate.** If the project uses React/Vue/Svelte/Astro/Tailwind, convert the section to a component in that idiom, keeping the class names or mapping them to utilities. Otherwise paste the `<section>` and the CSS.
7. **Check** in a browser at 1280 px and 375 px. Tiles must not overflow; text must not sit on top of the visual.
8. **Optional PNG** for decks/social: `npm i --no-save playwright-core && node render.mjs png bento.html --selector .bento --scale 2 --out out`.
