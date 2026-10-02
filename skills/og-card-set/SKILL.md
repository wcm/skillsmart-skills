---
name: og-card-set
description: Generate a matching set of Open Graph / social link-preview images (1200×630) for every page of a website, blog or launch — consistent brand, three layouts (split, editorial, gradient) — plus the meta tags to wire them up. Use for "OG images", "link previews", "social share images", "Twitter/X cards", or when a site's links look bare when shared.
---

# OG Card Set

Output: `cards.html` + `cards.json` (editable), `out/<page>.png` at 1200×630, and the `<meta>` tags for each page.

## Steps

1. **Collect pages.** If the user has a site folder, list its pages (HTML files, routes or markdown posts) and read each page's title and description. Otherwise ask for the list. Ask for the brand name, domain and colours if not obvious.
2. **Copy** `assets/template/cards.html`, `assets/template/cards.json` and `scripts/render.mjs` into `./og-cards/`.
3. **Write `cards.json`.** One entry per page:
   - `name`: file-safe slug (`home`, `pricing`, `blog-why-grids-matter`).
   - `layout`: `split` for home and product pages, `editorial` for articles, `gradient` for pricing/announcements. Stay consistent within a type.
   - `eyebrow`: section name (≤ 3 words). `title`: ≤ 60 characters, the page's promise, not its file name. Editorial titles may use one `<em>` accent.
   - `glyph`: one character or emoji-free symbol for the split art (often the brand initial).
4. **Brand.** Set `--bg`, `--ink`, `--muted`, `--accent` and fonts in `cards.html`.
5. **Export:** `npm i --no-save playwright-core && node render.mjs png cards.html --selector .card --scale 1 --out out`
6. **Review the PNGs yourself.** Titles must not wrap past 3 lines; reduce wording rather than font size.
7. **Wire up** (if you have the site's code): add to each page's `<head>`:
   ```html
   <meta property="og:title" content="…"><meta property="og:description" content="…">
   <meta property="og:image" content="https://DOMAIN/og/<name>.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
   <meta name="twitter:card" content="summary_large_image">
   ```
   and copy `out/*.png` to the site's public `og/` folder. Otherwise give the user the tags to paste.
