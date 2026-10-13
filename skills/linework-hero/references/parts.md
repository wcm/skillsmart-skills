# The API

Everything a figure may use. World space is x and y on the ground and z up; at the default camera +x runs
down-right, +y runs down-left, and the corner with the largest x and y is nearest the viewer. Units are free:
the engine fits the frame to whatever you draw.

## The figure

```js
{ // a block, so several figures can share one page
  linework({
    name: "catalog",                  // lowercase, one word or hyphenated
    means: "One sentence, at most 140 characters.",
    hint: "move over the drawers",    // what to do, in a few words
    look: "riso",                     // the default look (references/looks.md)
    camera: "iso",                    // iso trueiso low high turned
    inputs: ["pointer", "click"],     // pointer, click, scroll
    range: [0, 0.35, 0.7],            // the slider's number at intensity 0, 0.5, 1; draw and answer get it as value
    rangeLabel: "spread",
    tour: (s) => [s.at(x, y, z), s.at(…), s.at(…), null],   // 3 to 6 stops, then null to leave
    zoom: 1,                          // optional: scale after the fit
    draw(s, value) {                  // build the scene once
      …
      return (input, value) => "rest";   // the answer: set targets, light one thing, return the read-out
    },
  });
}
```

## The scene, `s`

| Call | What it does |
| --- | --- |
| `s.group(props, { pick, order, area })` | a new thing with the numbers that move it, e.g. `s.group({ e: 0 }, { pick: "B3" })` |
| `s.box(spec, opt)` … | one part in its own group; returns the group, so more parts can be chained on |
| `s.accent(g \| [g, …] \| null)` | the one highlight; it replaces the last |
| `s.extent([[x, y, z], …])` | world points of the most extreme pose, so the frame fits them |
| `s.loop((dt, now) => {})` | ambient motion: runs every frame while the figure is on screen, never under reduced motion |
| `s.occluder(g, { pass })` | marks a group as something that hides what moves behind or into it |
| `s.orderFor([x0, y0, z0, x1, y1, z1])` | for a small moving box: `{ order, hidden }`, its paint order among the occluders it overlaps on screen, and whether it is inside one. Set `g.order = order` and hide it when `hidden` |
| `s.at(x, y, z)` | the screen point of a world point, `[sx, sy]` in the 400 × 320 viewBox (for `tour`) |
| `s.ground(p, z)` | the world `[x, y]` under screen point `p`, on the plane at height `z`; it never moves, so hit tests on it are safe |
| `s.V.P(x, y, z)` | the projection itself, unrounded |

Options: `pick` makes the group answer `input.hit`, tested against its rest pose (or `area`, a list of world
points, when the rest pose is the wrong shape). `order` sets paint order; without it a group is painted by where
its first part stands, `x·sin + y·cos + 10·z`, so things on top of other things come after them. Give `order` to
every group in a structure that needs it (drawers in a cabinet: `200 + row * 10 + col`).

## A group, `g`

| Call | What it does |
| --- | --- |
| `g.box(spec, opt)`, `g.cyl`, `g.ball`, `g.line`, `g.cable`, `g.dot`, `g.patch`, `g.arc`, `g.shape`, `g.label` | add a part; parts are drawn in the order they are added, so add back to front |
| `g.to({ k: v }, { delay, ease, k, c })` | move numbers: a spring by default (where: it follows the pointer); `ease: true` for a choice (700ms on the lift curve); `delay` in ms staggers it; the same target twice does nothing |
| `g.set({ k: v })` | jump now |
| `g.kick(k, velocity)` | push a spring, for a swing that settles (cables) |
| `g.v` | the current numbers |
| `g.pick`, `g.order` | as given; `order` can change |
| `s.group({}, { lead: g })` | a follower: draws from `g`'s numbers, with its own paint order (the far half of one thing) |

A spec is an object, or a function of the group's numbers: `g.box((v) => ({ x, y: FRONT + v.e, … }))`. Return
`{ hide: true }` (or a size near zero) to hide a part.

`opt`: `cls` (a class, or a function of `v`), `nolit: true` (stays dim when the group is lit), `tube: true`
(a line drawn as a hollow tube, like `cable`).

## Parts

| Kind | Spec | Draws |
| --- | --- | --- |
| `box` | `x, y, z, w, d, h`, `r` corner radius (3), `b` crease inset (1.2), `taper` (top inset), `tray` (open top: the whole rim) | silhouette, top face, shaded side, one crease |
| `cyl` | standing: `cx, cy, z, h`; lying: `axis: "y"` with `cx, cz, y, len` or `axis: "x"` with `cy, cz, x, len`; `R`, `R1` (other end, for a taper), `b`, `rim` (whole inner ring), `hole` (a ring on the cap), `ridges` (count of lines along the visible side), `n` | the same, round |
| `ball` | `cx, cy, cz, R`, `eq` (equator line) | a circle with a shaded crescent |
| `line` | `pts: [[x, y, z], …]`, `closed` | a polyline; `cls`: `edge`, `lo`, `dash` |
| `cable` | `a, b` (ends), `lift` (arc height, negative sags), `sway` (sideways) | a hollow tube |
| `dot` | `plane` ("z", "y", "x"), `at`, `cu, cv`, `r`; or `x, y, z, r` on the ground | a filled dot; `cls`: `on`, `off` |
| `patch` | `plane, at, u0, u1, v0, v1, r` | a rounded plate on a face; `cls`: `edge`, `lo`, `nf` (no fill), `hole` (filled dark: an opening) |
| `arc` | `plane, at, cu, cv, R, a0, a1` (degrees; 0 to 360 closes it) | an arc or ring on a face |
| `shape` | `plane, at, pts: [[u, v], …]`, `closed` | a filled outline on a face (a leaf, a hexagon) |
| `label` | `at: [x, y, z]`, `text`, `sub`, `dx`, `dy` (view units; default `0, -26`), `align` | a dotted leader and an HTML label at its end; lit with its group; overlapping labels are pushed apart along their leaders |

Planes: `"z"` is the ground plane at height `at` (u = x, v = y); `"y"` is a face looking toward +y at `y = at`
(u = x, v = z); `"x"` a face looking toward +x at `x = at` (u = y, v = z).

## Input

`answer(input, value)` runs on every pointer move, leave, click, scroll and slider change.

| Field | Meaning |
| --- | --- |
| `input.at` | the pointer in viewBox units, or `null` when it has left |
| `input.hit`, `input.group` | the `pick` (and group) whose rest area is under the pointer, nearest first |
| `input.ground` | the pointer on the ground plane, `z = 0` |
| `input.u`, `input.v` | the pointer across and down the stage, 0 to 1 |
| `input.clicked` | the `pick` that was clicked (or `true`), on that call only |
| `input.scroll` | 0 to 1 through the page's scroll track, or `null` when there is none (a gallery card). Set what it drives with `g.set`, so the drawing sits where the page is; a spring would make every scroll replay a catch-up |
| `input.ghost` | the tour's unseen pointer, not a hand |
| `input.step`, `input.focus` | whatever the page last sent with `handle.send("step", n)` / `send("focus", id)` |
| `input.action` | what the page sent with `handle.act(name)`, on that call only |

## Helpers

`LW.falloff(u)`: 1 under the pointer, .31 at 42% of the radius, .09 at the edge and beyond. `LW.clamp`, `LW.lerp`.

## The handle

`LW.mount(host, fig, { look, camera, value, scroll, clear, fill, crop, onread, onpick })` returns a handle (`clear:
true` drops the stage's own background and lets labels run past its edge, for a drawing that sits on the page;
`fill: true` or `[x, y]` scales the drawing to fill whatever box the host is, `crop` names that box in viewBox units:
`references/systems.md`, The page): `send(key, value)`, `act(name)`, `setLook(look)`, `set(value)`, `crop(box)`,
`hold([x, y])`, `release()`, `play()`, `stop()`, `settle(ms)`, `report()`, `destroy()`, and `readout`, `look`,
`value`, `playing`. `onpick(id)` hears hovers, `onread(text)` the read-out.

## The bench page

`node <skill>/scripts/build.mjs <name>.js` writes `linework-<name>.html`, one file that opens from disk. Its address takes
`?look=`, `?camera=`, `?intensity=0..1`, `?at=x,y` or `?at=auto` (hold the pointer on the tour's first stop),
`?play=1`, `?w=240` (a thumbnail), `?bare=1` (the plate alone). In the console, `linework.figure` is the handle:
`settle()` runs the animation to its end, `report()` gives the read-out and the drawing's box.
