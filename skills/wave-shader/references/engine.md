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
  import * as wave from "./engine/wave.js";
  import { haze } from "./engine/presets.js";
  mount(document.querySelector(".hero__gl"), wave, { ...haze, colors: ["#…", "#…", "#…", "#…", "#…"] });
</script>
```

The copy stays in HTML (readable, selectable, found by search); the canvas only paints behind it. `engine/page.css` is
the shell: nav, copy, buttons, the layouts, a short section under the hero and the footer. A page sets its colours and
fonts as CSS variables on `:root` and adds its own rules in its `<style>`.

## `mount(canvas, look, options)`

Returns the engine, or `null` without WebGL2 (then `html.no-gl` is set and the canvas shows `--fallback`, a CSS
background). The engine:

- sizes the canvas to its box at up to `maxDpr` (1.5) device pixels, and lowers the resolution by itself when frames
  run long;
- stops drawing while the canvas is off-screen;
- with `prefers-reduced-motion`, draws one still frame (at `stillAt` seconds) and redraws it on resize;
- tracks the pointer in the canvas's own 0…1 space (y up): position, an eased position, velocity, and `presence`,
  which eases to 1 while the pointer is over the page and back to 0 when it leaves; clicks go to the look's `down()`.

Every engine is in `window.__shaders`; `__shaders[0].redraw()` draws a frame, `__shaders[0].speed = 0` freezes time.

## The look's settings (`engine/presets.js`)

A page passes a preset, overriding what it needs. Fields, with the ranges that have worked:

| Field | What | Notes |
|---|---|---|
| `shape` | `"plane"`, `"sheet"` or `"ribbon"` | what the surface is |
| `shapeA`, `shapeB` | the shape's dimensions | below |
| `eye`, `target`, `fov` | the camera (world units, degrees) | `horizon` (fraction of the height) moves a level camera's horizon there |
| `amp`, `freq`, `warp`, `speed` | how tall, how close together, how irregular and how fast the waves are | `speed` 0.4–0.6 reads calm; 1 is busy |
| `colors` | five stops, low to high | mixed in OKLab, so in-between colours stay clean |
| `colorBy` | how the ramp is read: across, up the crests, along, and the offset | |
| `light` | `"lit"` (default) or `"glow"` | |
| `lit` | ambient, diffuse, sheen, highlight | e.g. Haze `[0.5, 0.62, 0.14, 0.25]` |
| `fog` | start, density, sky in grazing angles, sparkle | sparkle is the sun's glitter on a sea |
| `glowShape`, `glowBright`, `glowNear`, `wings`, `glowBlur`, `glowSharp`, `glowSoft` | for `glow`: lower-edge softness, fade upward, ray frequency and amount; brightness; keep it to the sides | Aurora's values are a good start |
| `sky` | `skyTop`, `skyMid`, `skyLow`, `horizon`, `sun`, `land` | the sky pass behind the surface |
| `sunDir`, `sunLean`, `stars`, `clouds`, `land` | a sun (and how far it leans with the cursor), stars, clouds, a treeline | |
| `fibre` | `[amount, density]`: fine silky strands along the surface | Ribbon `[0.22, 300]` |
| `focus` | `{ distance, range, edge, blur }`: shallow focus | what swings near or far goes soft; `edge` softens the inner edge |
| `press`, `pressRadius`, `ripple`, `lean` | the cursor's press, its reach, a click's ring, how far the view turns toward the cursor | keep them soft |
| `grain` | film grain, in sRGB steps | 0.02 on white, up to 0.08 on warm silk |
| `tall` | overrides for tall screens (phones) | a phone sees the middle of the frame: bring the subject in |

### Shapes

- **plane**: `shapeA` = near distance, far distance, width per unit of distance, extra width; `shapeB` = wave height
  far away (a multiplier), and the distances over which it changes. Seen from above it's silk; from a low camera, a sea.
- **sheet**: `shapeA` = half-width, height, the bottom's height, depth (negative is away); `shapeB` = how much the
  middle recedes behind the sides (it curves round you), and how much the lower edge wanders.
- **ribbon**: `shapeA` = half-length, half-width, a steady twist along it, a wave of extra twist rolling along it;
  `shapeB` = sway up and down, sway in depth, the tilt across the picture (radians), and a slow spin.

## Looks that worked

- **Silk (Haze)**: a plane from above, big soft folds (`amp` 1.35, `freq` 0.62, `warp` 1.25), warm ramp from
  terracotta to cream, high grain.
- **Aurora**: a sheet that glows, curving round the viewer, near at the sides; irregular everywhere: how high each
  stretch reaches, where its light starts, ray lengths and patch brightness all wander. A treeline and stars below.
- **Sea (Swell)**: the plane from a low, level camera with the horizon at about a third; a low sun with a glitter
  path, fog into the horizon, a sunset ramp.
- **Ribbon**: wide (`shapeA[1]` ≈ 3.4), a gentle twist (`shapeA[2]` 0.16, `shapeA[3]` 0.45), slow (`speed` 0.45),
  fibres and shallow focus, saturated stops on white; framed off to the side of a short headline.

## Adding a look

A new look is a new preset: start from the nearest one, change the shape and camera until the silhouette reads, then
the colours and light, then motion. Add a `tall` override once it works wide.
