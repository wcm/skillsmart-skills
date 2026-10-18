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
  import * as dye from "./engine/looks/dye.js";
  mount(document.querySelector(".hero__gl"), dye, { colors: ["#…", "#…", "#…", "#…", "#…"] });
</script>
```

The copy stays in HTML; the canvas only paints behind it. `engine/page.css` is the shell: nav, copy, buttons, the
layouts, a short section under the hero and the footer. A page sets its colours and fonts as CSS variables on `:root`.

## `mount(canvas, look, options)`

Returns the engine, or `null` without WebGL2 (then `html.no-gl` is set and the canvas shows `--fallback`). The engine
sizes the canvas (up to `maxDpr` device pixels, lowering it by itself when frames run long), stops drawing off-screen,
draws one still frame with `prefers-reduced-motion`, and tracks the pointer in the canvas's 0…1 space (y up) with an
eased position, velocity and `presence` (0…1, while the pointer is over the page). Every engine is in
`window.__shaders`; `__shaders[0].redraw()` draws a frame, `__shaders[0].speed = 0` freezes time.

## The solver (`engine/fluid.js`)

`new Fluid(engine, { sim, curl, velocityDissipation, iters })`: velocity on a grid with `sim` cells on the canvas's
shorter side; `curl` is vorticity confinement (how much small swirl is put back: keep it low, 2–4, for calm water);
`velocityDissipation` is how fast motion dies (0.9–1.2 is thick and calm); `iters` the pressure solve's passes.

| Call | What |
|---|---|
| `field(short)` | a field that rides on the flow, `short` texels on the shorter side (dye, ink, a displacement) |
| `splat(field, x, y, value, radius, paint?)` | add (or blend toward) a soft spot of `value` at x, y (canvas uv); `radius` is in height units, squared |
| `stir(pointer, dt, { force, radius, each })` | push the water along the path the pointer moved since the last frame (no dotted trail on a fast flick); `each(x, y, speed)` runs along it |
| `burst(x, y, { n, speed, radius, ring, twist })` | a ring of pushes outward (a splash; use sparingly) |
| `step(dt, forces?)` | one solver step; `forces(vel)` adds your own (Film's buoyancy, Chrome's sponge) |
| `advect(field, dt, fade, mac?)` | carry a field along the flow; `mac` keeps sharp edges sharp |
| `paint(field, program, uniforms)` | fill a field from a full-screen program |

## The looks' options

**Dye** (`looks/dye.js`): `colors` (five, the emitters cycle through them), `bg`, `bg2` (the water, top and bottom),
`drift` (emitter speed, 1), `flow` (colour poured, 0.55), `touch` (how hard the cursor draws, 0.2), `fade` (0.42),
`curl` (4), `calm` (velocity dissipation, 0.9), `exposure` (2.2), `bloom` (0.35), `softness` (0.45), `grain`,
`dyeRes`, `softRes`. The tone map works on brightness, so dense dye stays its colour instead of washing to white.

**Chrome** (`looks/chrome.js`): no solver; the folds are domain-warped noise worked out for every pixel, so the metal is
smooth everywhere. `tint` (the metal, `#e9eef7`), `warm` (the side strip), `scale` (fold size, 1.15), `relief` (fold
depth, 0.12), `speed` (1), and the cursor's lamp: `lamp` (colour), `lampStrength` (1), `lampHeight` (0.32), `glide`
(how quickly it follows, 4), `lean` (how far the studio tips with it, 0.3); `grain`.

**Marble** (`looks/marble.js`): no flow; drops and tine strokes are exact maps. `inks` (the colours dropped), `paper`,
`reach` (the stylus's width, 0.014), `rakeTime` (seconds between rake passes, 7), `crisp` (how hard edges are kept,
0.35), `grain`, `inkRes`.

**Film** (`looks/film.js`, transparent canvas: it screens over the page): `wire` (the wand's colour), `exposure` (3),
`buoyancy` (60), `draught` (2.5), `restore` (0.05), `drain` (0.03), `smooth` (0.12), `touch` (the breath, 0.12),
`curl` (2), `calm` (1), `filmRes`, `grain`.

All looks take `maxDpr`.
