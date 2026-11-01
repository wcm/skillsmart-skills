# The page and the engine

`site/<id>/main.js` starts the engine; `site/engine/` is shared by every page.

```js
import { bindTheme, daySwitch, shots, start, startState } from "../engine/ui.js";
const jn = await start(document.getElementById("jn"), {
  sets: { room: shots() },                     // or several: { linen: …, voile: shots({ day: "day-voile", dark: "dark-voile", night: "night-voile" }) }
  weights: ["img/weights0.png"],               // the measured shares: lights 0–2, then weights1.png for 3–5
  widths: [1600, 2400, 3200],
  lights: [{ id: "neon", kind: "neon", warmth: 0 }, { id: "rest", kind: "warm", warmth: 0 }],
  focus: [0.6, 0.4],                           // the point kept on screen when the picture is cropped
  sunFrom: [0, 0.35],                          // where the window is: the light drains toward it
  gold: 0.45,                                  // how golden the hour gets on the way
  dayExpo: 0.25,                               // how strong a lamp reads against daylight
  bloom: 0.25, vignette: 0.18, grain: 0.028, zoom: 1.02,
}, { fallback: () => { /* no WebGL2: show the night picture over the day one */ } });
```

`lights` order must match `solos` in the scene file. Kinds: `warm` (an incandescent warm-up), `neon` (a strike),
`candle` (a living flicker), `led`, `fade`.

## Calls

| Call | What |
|---|---|
| `jn.night({ sun, beat, stagger, order, ambient, ambientDelay })` | the whole evening: the sun in `sun` s, a beat, each light `stagger` s apart. With lights far apart in time, set `ambientDelay` to `stagger` so the room's glow doesn't leave a dark ring round a light still off |
| `jn.day({ sun, lightsOff })` | back: lights off, then the morning; all in one go |
| `jn.toggle()` | whichever is next |
| `jn.set({ sun, ambient, lights: { id: level } })` | direct control, for scroll |
| `jn.light(id, on)` | one light, on its kind's curve |
| `jn.use(set, { duration })` | wipe to another set |
| `jn.toScreen(u, v)` | a point of the picture → CSS px, for hotspots |
| `jn.on("change" \| "mode" \| "resize" \| "ready", fn)` | every frame something moved, day or night, a new size, first shown |

From `ui.js`: `bindTheme(jn, { flipAt, span })` writes `--sun`, `--lit`, `--night`, `--flip` on `<html>` every frame (use
them with `color-mix()` so words follow the room); `daySwitch(button, jn, { onToggle })` makes a switch; `pinBox(jn, el,
[x0, y0, x1, y1])` keeps a click area on an object; `plainSwitch` is the no-WebGL fallback; `startState(jn)` handles
`?night` and `?t=`.

## Rules for the page

- `<img>` of the day photo under the canvas, so the page shows something before the engine loads and without WebGL.
- Words flip at their own moment: the side by the window stays light longest, so give each block its own flip.
- Night words arrive after the first light has caught, never before.
- On phones, give the title its own band of page above or below the photo rather than laying it over faces and lamps.
- Respect `prefers-reduced-motion`: `fade` kinds and shorter times (see `noble-gas`).
- Every control has a keyboard path and a label. Sound never autoplays.
