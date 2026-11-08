# The engine

`site/engine/` holds five files:
- `nuee.js`: the engine.
- `stage.js`: what every page does with it.
- `hud.js`: trackers, a ruled frame and callouts.
- `looks.js`: the four looks as option sets.
- `match-worker.js`: pairs grains for a melt.

A page imports `stage` and passes its pictures and options. Everything below is optional unless marked.

## How it works

1. **Grains from a picture.** The cut-out is cropped to its outline and laid in a square (1024², 512² on a phone). Each pixel gets a weight from:
   - its brightness on dark (or its darkness on paper);
   - its edges, and the subject's outline;
   - a little floor everywhere on the subject;
   - how near it is (from the depth map).

   Grains are dealt by that weight along a Hilbert curve, so neighbouring grains sit near each other. Their homes are `x, y` in −1..1 (the picture fits a −1..1 square by its longer side) and `z` from the depth.
2. **A simulation.** Every grain has a position, a velocity and a colour, in float textures on the GPU. Each frame it is pulled toward its home by a spring and pushed by the pointer. In a change it lets go, is thrown, drifts, and is pulled into its home in the next picture. Because grains have momentum, a push settles back on its own, and a change can start again at any moment.
3. **Drawing.** Grains add up in a buffer:
   - On dark, they add light and the total is tone-mapped over the ground.
   - On paper, they add ink, and the paper shows through what's left (`paper × exp(−ink)`), so colours mix like ink.

   Breathing, the wind, the lights, the scan line and the streaks are worked out per frame while drawing.

## `stage({ … })` (stage.js)

| Field | What |
|---|---|
| `canvas` (required) | the `<canvas>` the dust draws in (full-screen, behind the page's text) |
| `pictures` (required) | `[{ src, depth, …picture options }]` in order: the cut-out (`img/<name>.webp`) and its depth map (`img/<name>-depth.png`) |
| `options` | engine options (below), usually `{ ...looks.dust, frame, … }` |
| `hold` | seconds each subject stays before the next (default 4.5); `1e9` to never change on a timer |
| `hudCanvas`, `hud` | a second full-screen canvas over the dust for trackers / ruler / callouts, and their options (below) |
| `onShow(i)` | called when picture `i` becomes the current one (update the words, the list) |
| `onFrame(engine, dt, api)` | called every frame before drawing (animate lights, progress bars) |

It shows the first picture as soon as it has loaded, loads the rest behind it, and plays through them. When everything has loaded it adds the class `loaded` to `<html>`. A melt page also works out every pairing of grains in the background (a fraction of a second each).

**`window.nuee`**, the page's handle (also returned by `stage`):

| | |
|---|---|
| `go(i, opts?)` | change to picture `i` (`opts` overrides change options for this change, e.g. `{ travel: "melt" }`) |
| `pick(i)` | the same, for a click: holds a little longer before the timer carries on |
| `next()`, `pause(true \| false)`, `current` | |
| `advance(sec)` | steps the page by hand at 60 fps, drawing once at the end (recording, checks, a background tab) |
| `filmstrip(times, cols, before)` | steps through a change and lays the frames out on a sheet over the page (`filmstrip(null)` clears it) |
| `sweep(path, dur, times)` | a scripted pointer along `path` (screen units, −1..1) over `dur` seconds, filmed at `times` |
| `engine` | the engine itself (below) |

URL switches: `?still` (no timer), `?pic=2` (start on the third picture), `?rec` (a fixed 1/60 s step per frame).

## Engine options

Defaults first. All of them can be changed at run time on `engine.o` (counts and picture options need a reload).

**Ground and colour**

| Option | Default | What |
|---|---|---|
| `ink` | `false` | `false`: light on dark (grains add light). `true`: ink on paper (grains add ink) |
| `background` | `#050506` | the ground, or the paper |
| `exposure` | `1` | how strongly the grains add up: lower is lighter on paper and darker on dark |
| `mono`, `tint` | `0`, `#fff` | 0 the picture's own colours, 1 all `tint` (on dark) |
| `inkColor` | `#111` | with `mono: 1` on paper, the one ink |
| `inkCap` | `99` | on paper, the darkest ink can pile up; `3.22` = exactly the ink's own colour (a one-colour print) |
| `saturation` | `1` | on dark |
| `transparent` | `false` | on dark: the page shows through where there is no light, so type can stand **behind** the dust (put it before the canvas) |
| `grain`, `vignette` | `0.012`, `0.6` | film grain and darkening at the corners |

**Grains**

| Option | Default | What |
|---|---|---|
| `count` | `0` | grains, a power of two; 0 picks 524,288 on a desktop and 131,072 on a phone |
| `size` | `1` | grain size (sizes and brightness adapt to the count and the picture's size on screen) |
| `disc` | `false` | hard round dots (print) instead of soft grains |
| `relief` | `0.8` | how deep the depth map pushes the picture (0 flat) |
| `levels` | `null` | `{ lo, hi, gamma }`: stretch each picture's own tones before dealing grains; `gamma` > 1 keeps mid-tones light (dark products keep their seams) |
| `flightDim` | `0.35` | grains in flight give less light, so a dense cloud doesn't burn to white |

**Changes**

| Option | Default | What |
|---|---|---|
| `travel` | `swarm` | `swarm`: any grain goes to any home, through a cloud. `melt`: each grain goes to a near home in the next picture, so one shape reshapes into the next (best between similar shapes; until a pair's pairing is ready, a change runs as a gentle swarm) |
| `spread` | `0.55` | seconds over which grains let go |
| `gather` | `1.3` | seconds a grain takes to reach its new home |
| `kick` | `2` | how hard grains are thrown when they let go (a melt uses a seventh of it) |
| `air` | `0.7` | how much moving air carries grains in flight |
| `drag` | `1.6` | air drag in flight |
| `blur` | `0.12` | how out of focus grains arrive (the next picture appears as a soft cloud of its colours first) |
| `ramp` | `0.6` | how early the pull home builds (1 early: the next picture shows sooner) |
| `track` | `0.35` | in a swarm, how much grains keep to a schedule (a melt always does) |
| `order` | `null` | `{ dir: [x, y, z], jitter }`: the front a change crosses the picture along (default near-first); `[0, 1, 0]` bottom up, `[1, 0, 0]` left to right; `jitter` 0..1 how much each grain ignores it |
| `spring` | `[14, 0.95, 34]` | stiffness at rest (how fast a push settles), damping ratio, stiffness while gathering |
| `matchIters` | `32` | passes when pairing grains for a melt |

**The hand** (`hand: { … }`)

| Field | Default | What |
|---|---|---|
| `reach` | `0.13` | the hand's width, as a share of the screen's height |
| `drag` | `9` | how strongly grains near the pointer's path are taken along with it |
| `spread` | `1.3` | how much the wake spreads sideways |
| `still` | `0.06` | how much a still pointer parts the grains under it |
| `depth` | `0.6` | how much grains scatter toward and away from you |
| `strength` | `1` | all of it (0 turns the hand off) |

**Air, light and camera**

| Option | Default | What |
|---|---|---|
| `wind` | `{ amount: 0 }` | `{ amount, angle, x, y }`: past an edge through (x, y), grains live short lives on a wind blowing at `angle` (radians, 0 = right): let go, thin out, form again |
| `breath` | `0.5` | the whole picture breathes, slowly |
| `lamps` | `[]` | up to four lights in the dust: `{ color, x, y, z, power, core }`; move them and set `power` every frame (`engine.lampState`, see `beatLamps` in looks.js) |
| `hot`, `hotPower` | `null`, `0.6` | the pointer as a light of this colour |
| `streaks` | `false` | grains in motion leave short streaks |
| `scan` | `false` | a plane sweeping through the depth makes the grains it passes bigger and brighter |
| `sway` | `1` | the camera's own slow drift |
| `parallax` | `1` | how much the camera turns toward the pointer |
| `frame` | centre | `(w, h) → { cx, cy, s }`: where the picture sits, its centre and half its height in CSS px. Keep the title's band clear |
| `fixedDt` | `0` | a fixed time step (set by `?rec`) |

**Picture options** (per entry in `pictures`)

| Field | Default | What |
|---|---|---|
| `relief` | the engine's | depth for this picture |
| `fill` | `1` | how much of its square the subject fills |
| `outline` | `0.3` | extra grains along the outline |
| `fade` | `0` | a share of the height over which a picture cut off at the bottom (a portrait) thins out |
| `levels` | the engine's | as above, for this picture |
| `move` | — | change options used when changing **to** this picture (`{ travel: "melt", gather: 2 }`) |

## The engine object (`nuee.engine`)

- `show(i, opts)`: change to form `i` directly (stage's `go` is the usual way).
- `project(x, y, z)`: where a point of the picture lands on screen, in CSS px, so you can pin HTML to a subject.
- `unproject(nx, ny)`: the reverse, on the picture's plane.
- `setPointer(x, y)` / `setPointer(null)`: a scripted pointer.
- `prepare(a, b)`: pair grains for a melt ahead of time.
- `on(fn)`: events (`"show", index`).
- `progress`: 0..1 through the current change.
- `time`, `forms[i].feats`: strong points of each picture, in picture space, for trackers.

## Trackers, ruler and callouts (hud.js)

`hud` options:

| Field | Default | What |
|---|---|---|
| `color`, `dim` | bone | line and text colours |
| `font` | 9.5 px mono | |
| `primary`, `secondary` | `8`, `14` | trackers with labels (brackets and coordinates), and small marks without |
| `links` | `true` | thin lines between the labelled trackers |
| `ruler` | `null` | `{ pad, wide?, tall? }`: a ruled frame round the picture with tick marks and corner crosses, eased to each picture's box (`wide: 1, tall: 1` for a square) |
| `callouts` | — | `(form) → [{ at: [x, y] (picture space) or a tracker index, text, sub, dx, dy }]`: labelled leader lines that draw in as the picture locks; `form.pic` is the picture's index, `1 / form.aspect` its half-height |
| `calloutFont` | `font` | |
| `readout` | `true` | the pointer's position in the picture's space |

Trackers lock on one by one once a picture has gathered. When it changes they lose their lock: they wander, read SEEK and fade. On a phone they show fewer, shorter labels.

## Performance

At 524,288 grains, a frame takes about 5 ms on an Apple M2 at 2048 × 1536 pixels, and about 11 ms mid-change. The canvas never fills more than about 3 million pixels. Phones get 131,072 grains. Set `count` lower for older laptops or very busy pages.
