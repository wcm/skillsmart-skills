# The engine

## The page

```html
<section class="hero" data-layout="center">          <!-- the layout: see design.md -->
  <canvas class="hero__gl" aria-hidden="true"></canvas>
  <header class="nav">…</header>
  <div class="hero__copy">…eyebrow, h1.hero__title, p.hero__sub, .hero__cta…</div>
</section>
<script type="module">
  import { mount } from "./engine/core.js";
  import * as reeded from "./engine/looks/reeded.js";
  mount(document.querySelector(".hero__gl"), reeded, { copy: document.querySelector(".hero__copy"), backdrop: { … } });
</script>
```

The copy stays in HTML; the canvas only paints behind it. `engine/page.css` is the shell: nav, copy, buttons, the
layouts, a short section under the hero and the footer. A page sets its colours and fonts as CSS variables on `:root`.

## `mount(canvas, look, options)`

Returns the engine, or `null` without WebGL2 (then `html.no-gl` is set and the canvas shows `--fallback`). The engine
sizes the canvas (up to `maxDpr` device pixels, lowering it by itself when frames run long), stops drawing off-screen,
draws one still frame with `prefers-reduced-motion`, and tracks the pointer in the canvas's 0…1 space (y up) with an
eased position, velocity and `presence` (0…1, while the pointer is over the page). Every engine is in
`window.__shaders`; `__shaders[0].redraw()` draws a frame, `__shaders[0].speed = 0` freezes time. `engine.box(el)`
measures an element against the canvas, which is how a look finds the copy or a grid.

## Backdrops (`engine/backdrop.js`)

What the glass bends. Every look draws one into a texture first, and `blurChain` makes softer copies of it.

- **`field({ … })`**, a moving colour field: `base`, `base2` (the page's two pale colours), `blobs` (five colours that
  drift in pools and long bands), `cursor` (a colour that follows the pointer), `cursorMix` (how much of it, 0.85),
  `pull` (how far the colour leans toward the cursor, 0), `bloom` (a click's soft disc of colour, 0.75; `false` for
  none), `speed`; and a calm box (Reeded passes the copy's) where it settles to `base` (`calmAmount` 0.86,
  `calmSoft` 0.16).
- **`photo(src, { … })`**, a photo, cover-fit round `focus` ([x, y], 0…1), with a slow `drift` and `zoom`, a little
  `parallax` with the cursor, and optionally a `fade` into the page colour `page` on one side.
- **`orb({ … })`**, a soft ball of colour on a plain ground: `bg`, `bg2`, `colors` (a deep core, then two brighter
  colours toward its rim), `soft` (how much of its radius fades, 0.5), `speed`.

## The looks' options

**Reeded** (`looks/reeded.js`): `copy` (the element the glass is flattest over), `backdrop` (the field's options),
`flute` (width in CSS px; about 7% of the width), `thickness` (how hard each flute bends, 1.5), `flat` (how much
flute is left behind the copy, 0.14), `rampIn`, `rampOut` (where the flutes deepen, in canvas heights from the copy's
box), `dispersion` (0.08), `blur` (0.0–3, 1.4), `grain`.

**Steam** (`looks/steam.js`): `src` (the photo), `focus`, `regrow` (how fast the fog comes back, 0.2), `wipe` (the
wipe's radius, 0.055), `tint` (the fog's colour), `grain`. Wiping needs a press: a click wipes a spot, a drag wipes
the stroke, hover does nothing; while wiping, the page can't be text-selected.

**Liquid** (`looks/liquid.js`): `src`, `page` (the page colour the photo fades into), `split` (where the photo starts,
0.4), `focus`, `drops` (the big drops as [x, y, radius] fractions of the photo's part; the first follows the cursor),
`spacing` (one dew drop per this much area; smaller is more, 0.011), `bevel` (the rim's width, 0.07), `refract`
(0.75), `aberration` (0.18), `frost` (0.08), `grain`. Up to about a hundred drops: the canvas is cut into cells and
each pixel only tests the drops in its cell.

**Tiles** (`looks/tiles.js`): `grid` (the `.tiles` element: its box is the lattice's anchor and the ball's home;
CSS variables `--cols`, `--rows`, `--gap`, `--tile-r` set the blocks), `title` (blocks stop to the right of it on
wide screens), `clear` (the copy: blocks stop above it on tall ones), `backdrop` (the orb's options), `ball` (its
radius, as a fraction of the grid's shorter side, 0.6), `follow` (how quickly it follows the cursor, 3), `magnify`
(0.62), `refract` (how hard the rim bends, 0.45), `rim` (the rim's width, 0.55 of a block), `dispersion` (0.18),
`frost` (0–3, 1.6), `saturate` (1.3), `milk` (0.07), `grain`. The ball is kept where the blocks cover all of it.

All looks take `maxDpr`.
