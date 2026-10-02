---
name: social-carousel
description: Turn one idea, article, tip list or brief into a polished swipeable carousel for Instagram or LinkedIn — a hook slide, numbered point slides with examples, and a call-to-action slide — exported as 1080×1350 PNGs in a consistent visual style. Use for "make a carousel", "turn this post/thread/article into slides for Instagram/LinkedIn", social tips, listicles and educational posts.
---

# Social Carousel

Output: `carousel.html` (editable) and `out/01.png … out/NN.png` at 1080×1350 (4:5).

## What you need

- The content: a topic, a draft post, an article, or bullet points. Ask what platform (Instagram or LinkedIn) and the account handle.
- Node 18+ and Chrome/Edge (or Playwright's Chromium) to export.

## Steps

1. **Copy** `assets/template/carousel.html` and `scripts/render.mjs` into a new folder (e.g. `./carousel-<topic>/`).
2. **Write the story** using `references/carousel-craft.md`:
   - Slide 1 hook: ≤ 8 words, a promise or a surprising claim. One `<em>` accent word.
   - 3–8 point slides: one idea each. Title ≤ 7 words, body ≤ 30 words, one concrete example in the card.
   - Last slide: a clear CTA (follow, save, comment a keyword, visit link).
3. **Fill the template.** Duplicate `.point` slides as needed, renumber `data-name`, and update the progress dots on every slide (one `<i>` per slide, `.on` on the current one). Set `--handle` to the user's handle in quotes, e.g. `"@studio.lou"`.
4. **Style.** Set the four colour tokens to the brand, or pick a palette from the reference. Keep `--accent` for numbers and highlights only.
5. **Export:**
   ```bash
   cd carousel-<topic>
   npm i --no-save playwright-core
   node render.mjs png carousel.html --selector .slide --scale 1 --out out
   ```
   (`--scale 1` gives exactly 1080×1350. Use `--scale 2` for a sharper master.)
6. **Review every PNG yourself**: no text overflow, nothing hidden behind the progress dots or handle, consistent margins. Fix and re-export.
7. **Hand over**: list the files in order and suggest a caption (≤ 150 words) with 3–5 relevant hashtags.

## Rules

- Never more than ~40 words on a slide.
- Every slide must make sense on its own (people land mid-carousel).
- Facts the user gave stay exact; don't invent statistics.
