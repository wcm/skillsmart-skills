# The engine and a game's files

Classic scripts on one namespace, `window.R`; no build step, no libraries, no modules. A page loads the engine, then
its game's scripts in order; the last one calls `R.app.run`.

## A project

```
<project>/
  <game>.html          the page (serve the folder: python3 -m http.server 8000 -d <project>)
  engine/              core.js · screen.js · audio.js · ui.js · app.js (shared by every game, don't fork per game)
  games/<game>/        sim.js · art.js · view.js · sfx.js · ui.js · main.js
  tools/               the runners: sim.mjs, screens.mjs, demo.mjs, sheet.mjs, thumbs.mjs (+ lib, paths, stub)
    games/<game>/      this game's sim.mjs (headless checks), screens.mjs (screenshot flow, thumb()), demo.mjs
                       (video directors), sheet.html (sprite sheet)
    out/               everything the tools write (git-ignored)
```

The tools find the games by the pages that load `games/<game>/main.js`. Several games can share a project and its
engine; each sets its own `R.store.ns`.

## The page

```html
<main id="app">
  <aside class="side left">…how to play…</aside>
  <div id="stage"><div id="screen"><canvas id="game" tabindex="0" aria-label="…"></canvas></div></div>
  <aside class="side right">…for creators, sources, the parody line…</aside>
</main>
<script src="engine/core.js"></script> <script src="engine/screen.js"></script> <script src="engine/audio.js"></script>
<script src="engine/ui.js"></script> <script src="engine/app.js"></script>
<script src="games/<game>/sim.js"></script> … art, view, sfx, ui … <script src="games/<game>/main.js"></script>
```

The ids `app`, `stage`, `screen` and `game` are what app.js looks for. The page's CSS (copy it from an example) centres
the canvas, sizes the side panels and hides them under 860 px.

## A game's files, in load order

| File | Holds | Rule |
|---|---|---|
| `sim.js` | the rules: a `World` (or `Round`) class, its constants (`R.HOP`, `R.KOMBAT`…), the autopilot or CPU | deterministic; no drawing; `R.DT = 1/120` |
| `art.js` | every sprite, drawn once | from photos for anything real |
| `view.js` | a subclass of `R.Screen`: the scene, the cast, effects for events (`onCrash`, `onLand`…) | draws `base` and `glow`; uses `R.fx` for randomness |
| `sfx.js` | sounds as functions on `R.audio`, and `A.seq.songs` | each checks `ok()` and plays at `now()` |
| `ui.js` | the logo and screens as functions on `R.ui`, ending with `ui.draw(ctx, g, t)` | buttons register as they draw |
| `main.js` | state `g`, the flow, events → effects, input, share card, `R.app.run({...})` | sets `R.store.ns` first |

## R.app (app.js)

`R.app.run(game)` takes:

| Hook | When |
|---|---|
| `view` | an `R.Screen` subclass made on `R.app.canvas` |
| `g` | the game's state, exposed to tests as `__fr.game` |
| `boot(data)` | build the first scene; `data` is what `snapshot()` returned before a hot reload |
| `tick(dt)` | every frame: simulate, draw, present |
| `press(id)` | a button was pressed (after the click sound) |
| `down(x, y, ts, id)` / `move(x, y, id)` / `up(id)` | a pointer not on a button, in logical pixels; `id` per finger |
| `keydown(ev)` / `keyup(ev)` | keys |
| `hidden()` | the page was hidden: pause |
| `snapshot()` | what to keep across a hot reload |
| `tap(ts)` | the main action, for tests |

Also: `app.say(msg)` (a toast), `app.card()` (a 1080×1920 canvas holding the last clean frame, shaded), `app.saveCanvas(c,
filename, toast)`, `app.save(blob, filename, toast)` (a download, or the claude.ai viewer's downloads capability),
`app.copy(text)` (clipboard), `app.press(id)` (as if a button were pressed). Frames run long for 1.5 s and the view goes
`lite` (lighter bloom, smaller backing store).

**The test clock**: `__fr.manual(true)` stops the frame loop; `__fr.tick(1 / 60, n)` steps n frames exactly;
`__fr.press(id)`, `__fr.tap(ts)`; `__fr.game` and `__fr.view`. Every tool drives the page through it.

## R core (core.js)

- `R.W` 216, `R.H` 384. `R.clamp`, `R.lerp`, `R.approach(v, target, rate, dt)`, `R.easeOut`, `R.easeInOut`, `R.easeBack`.
- `R.rng(seed)` → a generator `r()` in [0, 1) with `r.range(a, b)`, `r.int(a, b)`, `r.pick(list)`, `r.chance(p)`.
  `R.fx` is one for effects. `R.nextSeed()` takes a queued `R.seeds` entry first (tests and demo videos queue seeds),
  else a random one.
- `R.store.get(key, fallback)` / `set(key, value)`: JSON in localStorage under `R.store.ns`; never throws.
- `R.canvas(w, h)` → `{ c, x, w, h }` with smoothing off. `R.hex`, `R.rgb`, `R.mix`, `R.mixHex`.
- Drawing: `R.vgrad(x, y0, y1, stops, cx, cw)` (banded gradients), `R.disc`, `R.softGlow`, `R.poly(x, pts, col)`,
  `R.outlined(canvas, col)` (+1 px outline, padded by 1), `R.sprite(rows, pal)` → `{ c, g, w, h }`.
- Text: `R.text(ctx, str, x, y, o)` with `o` = `{ font: 'big'|'small', scale, color, gradient, outline, shadow, italic,
  align: 'center'|'right', valign: 'middle', alpha }`; `R.measure(str, o)`; `R.wrap(str, width, o)`; `R.textCanvas`.

## R.Screen (screen.js)

Make one subclass per game. It owns `base` (colour), `glow` (emission), `ui` (the UI layer) and the bloom pyramid.

- **Each frame**: `update(dt, world)` (yours: call `this.step(dt, drift)` for particles), `screen(dt)` (decays the
  effects), `drawWorld(...)` (yours: clear and draw `this.base.x` and `this.glow.x`), `present(uiDraw)` (composites
  zoom about `this.focus`, shake, chromatic split, glitch, bloom, the UI, flash, scanlines; call it from your
  `present(world, uiDraw)` after setting `focus`).
- **Effects**: `hit('shake'|'flash'|'aber'|'zoom'|'glitch', amount)`, `flashCol` ('255,255,255'), `kickY`.
- **Particles**: `puff(x, y, vx, vy, r0, grow, life, pal, glow)` with palettes `R.PAL.gas|dust|fire|smoke|rainbow`;
  `burst(x, y, n, cols, speed, life, gravity)`; `chunk(img, x, y, vx, vy, vr, life, bounce)` (debris bouncing on
  `this.floor`); `confetti(n)`; `add({ k: 'ring'|'streak'|'drop'|'jet', … }, front)`; `drawParts(b, gl, this.parts)` and
  `this.front` for those in front.
- **Helpers**: `reflect(b, gl, t, y)` (the scene mirrored below y), `clip(b, gl, x, fn)` (a wipe), `reset()`.
- **Share frames**: `wantSnap = true` keeps the next clean frame in `snap`, which `app.card()` uses.
- `reduced` (prefers-reduced-motion) and `lite` are read for you.

## R.audio (audio.js)

- `A.init()` (on the first press), `A.level` 0 music and sound, 1 sound only, 2 muted; `A.setLevel(lv)`.
- `A.prim`: `osc(type, f0, f1, t, dur, peak, dest, o)` with `o` = `{ attack, sweep, detune, filter, ff, ff1, q, send }`
  (send: into the delay); `noise(t, dur, peak, type, f0, f1, q, dest, o)`; `env`; `midi(n)`; `now()`; `ok()`.
- Shared sounds: `A.ui`, `A.deny`, `A.best`, `A.stamp(trombone)`, `A.engage`, `A.disengage`.
- The sequencer: `A.seq.songs = [{ chords: [[midi…] ×4], bpm, drums: 'four'|'half'|'drive', arp: 'square'|'triangle'|… }]`;
  `setSong(i)`, `setIntensity(0–3)` (pad and bass, + drums, + arp and hats, all out), `duck(on)` (a crash or a result),
  `slow(on)` (bullet time), `stutter()`.
- A sound that changes the music by itself (calls `A.seq.duck` inside) must be listed in the game's demo `duckers`; it's
  simpler to duck from main.

## R.ui (ui.js)

- Every frame: `ui.begin()` (forget last frame's buttons), draw, `ui.update(dt)`. `ui.button(ctx, id, x, y, w, h, label,
  { rim, fill, on, col, big, icon, iconCol })`; `ui.panel(ctx, x, y, w, h, rim, fill)`; `ui.hit(x, y)` (used by app.js).
- Words: `ui.pop(text, { x, y, life, scale, font, color, gradient, rainbow, outline, italic, vy, delay, shakeX, tag })`,
  `ui.showBanner({ kicker, title, sub })`, `ui.drawPops(ctx, t)`, `ui.drawBanner(ctx)`, `ui.scoreBump`.
- Logos: `ui.letterLine(ctx, str, y, o, (i) => ({ dy, sy, o }))`, `ui.pixels`, `ui.shine(ctx, t, y)`, `ui.sticker`,
  `ui.backdrop(ctx, y0, y1, alpha)` (a dark band behind text).
- Results: `ui.drawStamp(ctx, label, col, t, cx, cy)`, `ui.drawTyped(ctx, msg, t, y, o)`, `ui.drawMedal`, `ui.statLine(parts,
  width)`, `ui.drawToast(ctx, y)`.
- Screens: `ui.drawPause(ctx, sub, quitLabel)` (buttons `resume`, `quit`), `ui.drawCamcorder(ctx, t, { title, sub, score,
  skip, dot })`.
- `R.UIC` (colours), `R.GRAD` (type gradients), `R.icon(ctx, name, x, y, col)`: sound, music, mute, wheel, retry, play,
  pause, share, lock, left, right, up, cpu.

## The tools

- `node tools/sim.mjs [game] [args]`: runs `tools/games/<game>/sim.mjs` in its own Node process (no browser): it loads
  the game's scripts with a canvas stub (`load([...])` from `tools/stub.mjs`) and drives the sim directly.
- `node tools/screens.mjs <game> [args]`: opens the page in headless Chromium on the manual clock and runs the game's
  flow (`export default async function ({ g, shot, shareCard, args })`; `g.tick(n)`, `g.ev(fn)`, `g.until(test)`,
  `g.page` for real mouse and keys). Shots go to `tools/out/screens/<game>-<moment>.png`.
- `node tools/demo.mjs [game or video…]`: demo videos (see `video.md`).
- `node tools/sheet.mjs <game>`: the sprite sheet. `node tools/thumbs.mjs`: thumbnails for a front page from each game's
  `thumb(g)`.
- Browsers: Playwright's Chromium if installed (`npx playwright install chromium`), else Google Chrome or Edge.
