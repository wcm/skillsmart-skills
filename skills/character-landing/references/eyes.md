# Eye calibration

The hero shows the rest frame (`site/characters/<id>/hero.webp`, full resolution, same framing as `seq/0001.webp`). `site/js/eyes.js` paints the original eyes out and redraws them shifted toward the pointer. It needs each eye's position as fractions of the frame (0–1, origin top-left).

## Eye types

**Bead / dot eyes on skin** (plush mascots, simple toys, white dots on a dark body):
```json
{ "x": 0.427, "y": 0.343, "rx": 0.0146, "ry": 0.016, "shift": 0.5 }
```
`rx/ry` = radius of the dark (or light) dot. Add `"blink": true` at the top level.

**Iris inside an eye-white** (Pixar humans and creatures, most illustrated characters):
```json
{ "x": 0.4224, "y": 0.4009, "rx": 0.0448, "ry": 0.0478, "shift": 0.32,
  "socket": { "x": 0.4066, "y": 0.392, "rx": 0.0602, "ry": 0.0594 } }
```
`x/y/rx/ry` = the coloured iris; `socket` = ellipse of the visible eye-white. The iris is clipped to the socket, and its old spot is painted with the eye-white colour (sampled automatically; override with `"fill": "#hex"`).

**Narrow / lidded eyes** (glasses, almond eyes, lids cover part of the iris): use the iris form with tighter margins so paint doesn't spill onto lids: `"paint": 1.1, "maskPad": 1.02`, keep iris `ry` ≤ socket `ry`, and lower `shift` (~0.3).

**Drawn eyes where heavy lashes overlap the iris and touch the pupil**: can't be separated cleanly — leave `"eyes": []`.

`shift` is how far the eye travels (× its radius; a global ×1.35 multiplier is applied in eyes.js). Start at 0.5 for beads, 0.3–0.35 for irises; lower it if irises clip into corners or look cross-eyed.

## Finding the numbers

1. Automatic candidates (dark or bright compact blobs inside the figure):
   ```bash
   cd tools
   uv run --with numpy --with pillow --with scipy python3 eyes.py <id> --debug /tmp/eyes.png
   uv run --with numpy --with pillow --with scipy python3 eyes.py <id> --mode bright --thresh 185 --min 30 --max 400
   ```
   Works well for bead eyes. For irises it usually finds only the pupil.
2. Measure by eye: crop the face from `hero.webp` (1440 px) with sharp/PIL, upscale ×2–3, view it, and read off the iris and eye-white extents in crop pixels. Convert: `frac = (crop_px / scale + crop_offset) / 1440`. Measure on the hero, not a 720 frame — a 10 px error is enough to leave a ghost rim.

## Verifying (do this — eyes are where artifacts show)

The page only builds the rig when visible. Render it directly at the extremes and look at the crops:

```js
// in the browser console / javascript tool, on the running page
const { EyeRig } = await import('/js/eyes.js?v=' + Date.now());
const spec = await (await fetch('/characters/<id>/character.json?v=' + Date.now())).json();
const im = new Image(); im.src = '/characters/<id>/hero.webp'; await new Promise(r => im.onload = r);
const rig = new EyeRig(im, spec.eyes, { blink: spec.blink });
// draw rig.render({x:1,y:0}), {x:-1,y:0}, {x:0,y:1}, {x:0.7,y:-0.7} cropped around the face onto a fixed overlay canvas
```

Look for: a ring/crescent of the old iris left behind (radius or centre too small/off — re-measure), paint spilling outside the eye (socket too big, or use tighter `paint`/`maskPad`), irises cut off in the corners (lower `shift`). Remove the overlay afterwards.
