# Troubleshooting

| What you see | Why | Fix |
|---|---|---|
| The cloth shimmers or shakes at rest | physics stepped with the frame time (a 120 Hz display dropping to 60 Hz changes the resting shape every frame) | step only in `step(h)`, which the stage calls at a fixed 120 Hz; never call `cloth.step(dt)` from `update` |
| It bounces like rubber when let go | long chains stretch and spring back | `cloth.buildTethers(1.0)` after pinning; more `damping`; more `kN` (air drag across the face) |
| Folds stick together or pass through each other | no self-collision, or a grab moving faster than collision can follow | `selfCollide: true`; keep `grabSpeed` around 2 m/s; `hashEvery: 1` for cloth that gets folded hard |
| The cloth is cut off or sits behind the copy | the frame doesn't fit this window | adjust `stage.frame({ … sx, sy, sh, sw })` in `layout(w, h)` for each case (phone, tall, wide) |
| Nothing moves in a background tab or a hidden preview | `requestAnimationFrame` pauses | `__cloth.advance(2)` in the console runs two seconds of physics and draws |
| Text baked into a texture uses a fallback font | the texture was baked before the font loaded | add the face to `fontsReady([...])` before baking, and keep its `@import` in the page's CSS |
| The picture on the cloth looks washed out or muddy | the bake expects darks on light (dye) or a centred subject (print) | regenerate the picture to suit the kind (`references/images.md`) rather than fighting it in the bake |
| A bead picture is unreadable | too much detail for one bead per pixel | a bolder, simpler picture with fewer colours; or more `COUNT` × `BEADS` (costs speed) |
| Frames drop on a laptop | grid too fine or too many substeps | fewer `COLS`/`ROWS` or `substeps`; the stage also lowers the pixel ratio on its own |
| "This page couldn't start" over the hero | an exception in `create` | the console has the error; most often a picture path that doesn't exist in `site/img/` |
| Blank page, CORS errors | opened as a file | serve it: `python3 -m http.server -d site` |
