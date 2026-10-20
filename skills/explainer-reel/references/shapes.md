# Shapes

`shapes.jpg` (next to this file) shows every drawing with its name; `node <skill>/scripts/shapes.mjs` redraws it.
All are monoline paths in a 200 × 200 box centred on 0, 0 (y down); `scale: 2` makes one 400 px.

## The library (`S.*`)

| Group | Shapes |
| --- | --- |
| people | `bust({ eyes: "open" \| "closed" })`, `profile`, `person`, `walker`, `hand`, `eye`, `eyeClosed` |
| body | `heart`, `brain`, `lungs`, `ear`, `nerves` (sits on the bust at the same scale) |
| sky | `moon`, `sun(rays, r)`, `star(points, r, inner)`, `sparkle`, `planet`, `orbit(rx, ry)`, `galaxyArms(arms, turns)`, `spiral(r, turns)` |
| things | `cup`, `gift`, `envelope`, `coin`, `money`, `door`, `phone`, `book`, `bulb`, `key`, `lock`, `bell`, `bubble`, `pin`, `trophy`, `flask`, `hourglass`, `clock`, `battery(level)`, `headphones`, `mic`, `speaker`, `chip`, `magnifier`, `target`, `wifi`, `play`, `cube`, `gear(teeth, r)` |
| nature | `leaf`, `sprout`, `tree`, `lotus`, `flame`, `drop`, `cloud`, `mountain`, `house`, `butterfly`, `bolt` |
| science | `atom`, `dna(turns)`, `infinity` |
| marks | `check`, `cross`, `plus`, `question`, `arrow` |
| numbers | `number("8")`, `number("30")`, `number("2:00")`, `number("90%")`, `number("$100")`, `number("1/5")`, `number("2 × 3")`, `digit(d)`: monoline digits that morph into anything. Characters: `0-9 : . , % + - $ / ×` and spaces (anything else warns and leaves a gap; put words in `add.text`) |
| primitives | `circle(r, cx, cy)`, `ellipse(rx, ry)`, `rect(w, h, radius)`, `polygon(n, r)`, `arc(r, from, to)`, `line(x1, y1, x2, y2)`, `poly([[x, y]…], closed)`, `wave(w, amp, cycles)`, `path("M… C…")` |
| helpers | `merge(a, b, …)`, `place(shape, { x, y, scale, rot })`, `fit(shape, size)`, `curveFn((t) => [x, y], n)` |

## Anchors

Points other things attach to, read on the frame with `el.at(name)`:

| Shape | Anchors |
| --- | --- |
| `bust` | `head`, `crown`, `eyes`, `mouth`, `throat`, `chest`, `heart`, `gut`, `left`, `right` |
| `profile` | `eye`, `brain`, `mouth`, `crown`, `throat`, `heart` |
| `person` | `head`, `heart`, `feet`, `hand` |
| `nerves` | `throat`, `heart`, `gut` |
| others | `ear: canal, cochlea` · `heart: center` · `brain: center, left, right` · `moon: center` · `cup: steam, rim` · `gift: lid, center` · `bulb: glow` · `headphones: left, right, band` · `pin: tip` · `door: gap` · `cube: top, front` |

## Drawing your own

Anything the library lacks is one `S.path("…")` away, in the same 200 × 200 box:

- Monoline: strokes, not outlines of strokes. Round things are arcs (`A`) or cubic curves (`C`).
- The fewest strokes that name it; open ends where a pen lifts. 2–8 subpaths (each `M` starts one).
- Draw it in the order it should draw on (with `mode: "seq"`), or let the parts draw together (the default).
- Give it anchors when labels will point at it: `S.path(d, { tip: [0, -80] })`.
- Close the silhouette (`Z`) when it will take a dot fill: `dots` fills only closed parts, so draw the outline
  as one closed path and the interior lines (fingers, folds, veins) as open ones. Most library shapes are open
  (`bust`, `profile`, `hand`, `lungs`); close your own version, or add a closed `S.path` behind them.
- Generate what repeats: branching (airways, veins, trees), folds, hatching and rows are a loop of `S.path`
  strings away; seed any randomness so every render is the same.
- Check it on a sheet: `node scripts/check.mjs reel.js --at 2` and look.

```js
const kettle = S.path("M-60 70 H60 L50 -20 H-50 Z M-30 -20 C-30 -50 30 -50 30 -20 M50 0 C80 -10 90 -40 70 -60 M-10 -48 V-60", { spout: [70, -60] });
add.line(kettle, { y: 760, scale: 1.6 });
```

Morphing works between any two shapes; it reads best between shapes with the same number of strokes and a
similar start (the engine aligns direction and start point for you).
