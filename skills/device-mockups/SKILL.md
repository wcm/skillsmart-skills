---
name: device-mockups
description: Place the user's app or website screenshots into polished device frames — phone, laptop, browser window — arranged in styled scenes with gradient backgrounds, 3D tilt, soft shadows and captions, exported as PNGs for landing pages, App Store/Product Hunt galleries, decks and social posts. Use for "mockup", "put my screenshots in an iPhone/MacBook frame", "product shots", "app store images" or "make my screenshots look nice".
---

# Device Mockup Scenes

Output: `mockups.html` (editable) and `out/scene-*.png`.

## What you need

- Screenshots from the user (PNG/JPG). Ideal sizes: phone 1170×2532 or 390×844 ratio; desktop 2560×1600 or any 16:10. If they have a live site, you may capture it yourself with Playwright (`page.screenshot`) at 1280×800 and 390×844.
- Node 18+ and Chrome/Edge (or Playwright's Chromium).

## Steps

1. **Copy** `assets/template/mockups.html` and `scripts/render.mjs` into `./mockups/`, and copy the screenshots into `./mockups/shots/`.
2. **Choose scenes** (keep, duplicate or delete `<section>`s):
   - `scene-hero` — laptop + phone with a caption: landing pages, decks.
   - `scene-phones` — three fanned phones, square: social posts, app launches.
   - `scene-browser` — tilted browser window with caption: web products.
3. **Wire screenshots**: set each `img src` to `shots/<file>`. Unused slots become a neutral "Screenshot" placeholder — replace them all before export.
4. **Style**: set `--bg-a` / `--bg-b` to two brand-adjacent colours (a soft light-to-saturated pair works best), `--frame` for device colour (near-black or silver `#d4d4d8`). Write a short caption (≤ 6 words) and sub-line (≤ 14 words).
5. **Export**: `npm i --no-save playwright-core && node render.mjs png mockups.html --selector .scene --scale 2 --out out`
6. **Review the PNGs yourself**: devices not cropped awkwardly, caption not overlapping devices, screenshots aligned to top (no letterboxing). Adjust `left/top` inline styles and re-export.
7. **Hand over** the files with suggested uses (hero image, Product Hunt gallery, social post).

## Rules

- Never alter the content of the user's screenshots.
- Don't draw brand-specific devices with logos; frames stay generic.
