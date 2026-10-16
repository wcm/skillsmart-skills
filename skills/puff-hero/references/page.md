# The page

## The rules (each one came from a version that didn't work)

1. **One moving layer.** The puffy letters move; nothing else does. Backgrounds are drawn once. An extra animated
   layer (a light that followed the cursor across the letters, dents where you pressed) fought with the video.
2. **Text is HTML, never part of the generated image.** Brand, nav, headlines, small print, buttons: all code, so
   they stay sharp, editable, translatable and still while the letters move. The image holds only the puffy
   letters.
3. **The puffy letters are the hero, big and on top.** About 60–80% of the window's height, centred or nearly,
   over the background and any headline. A puffy word set small inside a sentence of normal type looked like a
   sticker; the version people liked was the poster: one giant tactile word.
4. **Pop and loud.** Saturated page colours, one display face with attitude, big contrasts in scale (a headline
   that bleeds off both edges next to small print). It should stop a scroll.
5. **Calm behind, loud in front.** The background belongs to the brand but is clearly quieter than the letters
   (`backgrounds.md`).

## Four worked compositions

| | Hug (fashion) | Pop (music) | Soft (food) | Cozy (homeware) |
|---|---|---|---|---|
| Letters | HUG / GER, satin vinyl, hot pink | POP / STAR, gloss bubblegum | SOFT / SERVE, matte rubber, four colours | HELLO / COZY / SEASON, faux fur |
| Page colour | warm off-white `#eeebe5` | lime `#b4ea4c` | light grey `#e5e4e1` | cornflower `#6f8fcb` |
| Background | rows of HUGGER in outline (`outlineRows`) | twisted lime checkerboard (`twistedGrid`) | soft-serve swirl + sprinkles | crayon clouds |
| Display face | Unbounded 900 (brand), 700 (rows) | Inter Tight 900, tracked −0.065em | Syne 800 | Instrument Serif italic |
| Supporting | Unbounded 500 caps, small | Archivo Narrow 700 caps (small print), Geist Mono (barcode) | Inter Tight 500 | Inter Tight 500 |
| Extras | label "FW26 / The Squeeze Collection", hot-pink pill button | headline "turn it up." bleeding off both edges behind the letters, a round black "NEW SINGLE" sticker at −12°, justified small print, a barcode | headline "Ice cream, but squishier.", flavour list with colour dots | label "The winter edit", white pill button |
| Letters placed | size .74, y .52 | size .6, y .6 (below the headline) | size .66, y .5 | size .76, maxW .56, y .5 |

## Type

Contrast is the point: the letters are round, soft and 3D, so the code type should be flat and sharp, very heavy
or very fine, never another bubbly face. Fashionable Google Fonts that worked: **Unbounded**, **Inter Tight** 900
(tight tracking), **Syne** 800, **Archivo** / **Archivo Narrow**, **Bricolage Grotesque**, **Instrument Serif**
(italic, for softer brands), **Geist Mono** for small technical lines. Load the families in `index.html`; set
`--display` and `--mono` in `style.css`.

## Colour and shadow

- `--bg` is the page colour and the still's backdrop (the same colour in words in `pages.json`).
- `--ink` is the copy colour; check contrast on the page colour.
- `--sh1` and `--sh2` are the letters' two drop shadows (a wide soft one and a tight one). Tint them from the page
  colour (a darker shade of it, or the letters' colour), never neutral grey, which looks dirty on bright pages.
  The shadows slide away from the cursor with the lean.

## Copy and layout

The template places a header (brand left, links right), a label bottom left and a button bottom right, all above
the letters (`z-index: 3`), at the edges so the letters have the middle. Add a headline behind the letters (Pop),
a sticker, small print or a list (Soft's flavours) when the brand needs it. Keep the copy off the letters; on phones
check that the label and button don't collide. Where a busy pattern runs under copy (outline rows), back the copy
with the page colour: add the class `backed` (a page-colour panel behind the text).

## The puffy layer (`puff.js`)

```js
const puff = mountPuff(document.querySelector(".puff"), {
  src: "img/<id>/puff",   // .webm, .mov and .webp from video.mjs
  size: .7,               // the letters' height as a share of the window…
  maxW: .64,              // …capped at this share of its width (phones, under 760 px: phoneMaxW .92)
  x: .5, y: .52,          // centre, as shares of the window
  move: [16, 12],         // lean: px toward the cursor
  turn: [10, 7],          // lean: degrees of turn
  swell: .03,             // scale while the cursor is on the letters
  pop: 2,                 // the pop's kick (2 ≈ 9% swell); 0 turns it off
  popOnLoad: .8,          // the pop as the page opens
});
puff.onSized((rect) => { /* draw the background; rect is the letters' box */ });
```

The hit test uses the first frame's alpha, so the loop plays when the cursor is on the letters, not on the empty
corners of their box. `prefers-reduced-motion` turns off the lean, the pop and the drift; the loop still plays on
hover or tap. The words are in a visually hidden `<h1>`, and the letters carry `role="img"` with an `aria-label`.

## Weight

A page is light: the first frame is 70–250 KB, the WebM about 1 MB, the MOV (Safari only) about 5 MB, and the
loop loads after the page appears. Fonts are the next biggest thing; load only the weights you use.
