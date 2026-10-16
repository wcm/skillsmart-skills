# Backgrounds

The background makes the page belong to a brand: a music label, an ice-cream counter, a homeware shop. It is drawn
in code (`site/backgrounds.js`), once, and redrawn only on resize (`puff.onSized` calls you after the letters are
measured, because some recipes centre on them). It never animates: the letters are the only thing that moves.

## Rules

- **Relevant and stylish.** It should say something about the brand or the word (sprinkles for soft serve, clouds
  for cozy, a funhouse grid for a pop single), drawn with a designer's restraint.
- **Calmer than the letters.** Tone on tone, or a few big shapes, or a fine line. A Fair Isle knit (snowflakes,
  zigzags, rows of hearts) was rejected as too distracting behind fur letters; a handful of crayon clouds replaced it.
  If the background is what you notice first, quiet it: fewer shapes, less contrast, closer to the page colour.
- **The page colour leads.** Draw in the page colour's family: lighter, darker or tinted versions of it, plus at
  most the letters' own colours in small doses (the sprinkles).
- **Keep the copy readable.** Recipes take `keepOut` boxes (`rects(".site", ".label", ".cta")`) and move or skip
  shapes there. Full-field patterns (rows, grids) can't; back the copy with `.backed` instead.

## Recipes

| Recipe | Looks like | Suits | Call |
|---|---|---|---|
| `outlineRows` | the word repeated in outline, rows filling the window, behind the letters | fashion, streetwear, a brand name | `outlineRows(el, { word, family: "Unbounded", color, bg })` on a `<div class="rows">` |
| `twistedGrid` | a checkerboard twisted in the middle like a funhouse mirror (a WebGL shader, drawn once) | music, pop, Y2K, gaming | `twistedGrid(canvas, { a, b, twist: 1.35, cells: 6.2 })`, two close tones of the page colour |
| `swirl` + `sprinkles` | a piped soft-serve spiral seen from above, tone on tone, and sprinkles that thin toward the letters | food, sweets, cafés, kids | `swirl(x, { center, color })`, then `sprinkles(x, { colors, center, clear: rect, keepOut })` |
| `crayonClouds` | a few crayon clouds on coloured paper: outlines gone over twice, scribbled in, waxy grain | cozy, home, sleep, kids, weather | `crayonClouds(x, { ink, tint, fill: .38, keepOut })` |

`prepare(canvas)` returns a 2D context in CSS pixels at the screen's density for the canvas recipes. `fitText(el,
1.1)` sizes a headline to 110% of the window's width (it bleeds off both edges); `barcode("0123 4567")` returns an
SVG barcode for poster small print.

## Writing a new recipe

Write it next to the others in `backgrounds.js`: a function taking a context and options, using `rng(seed)` for
anything random so it draws the same every time, reading `innerWidth`/`innerHeight`, and honouring `keepOut`. Then
call it from `main.js` inside `puff.onSized`. Ideas that fit the rules (not yet built): halftone dots fading toward
the letters, gingham for a picnic or bakery, terrazzo chips, wavy stripes, confetti for an event, a hand-drawn
doodle border, giant soft blurred blobs of the letters' colours. Check it at desktop and phone size with
`check.mjs` and look at the sheet: the letters should still be the first thing you see.
