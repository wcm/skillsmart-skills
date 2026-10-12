# Engine API

Everything in `site/engine/` is fixed: don't edit it. A page is two files, `site/themes/<id>.js` and `<id>.css`,
listed in `site/themes/pages.json` (and the generated `index.js`). three.js 0.160 comes from jsDelivr through the
import map in `index.html`.

## The page module

```js
export const meta = {
  id: "velvet", no: "01", name: "Velvet",       // id = the file name and the URL hash
  native: "",                                    // an optional second word on the veil (e.g. 暖簾)
  veil: "#190807", ink: "#efe6d6",               // the loading veil's colours (match the page's ground and text)
  display: "'Bodoni Moda', serif", weight: 500,  // the veil's font
  sound: "night",                                // "rain" | "street" | "night" | "water" | null
  title: "Velvet · Maison X",                    // optional tab title (default: name)
};

export const html = {
  bg: `…`,    // behind the canvas: the scene picture, paper, gradients
  back: `…`,  // between the background and the canvas (rarely needed)
  hero: `…`,  // in front: nav, copy, call to action, facts, footer, hint
};

export async function create(stage, ctx) {
  // ctx: { hero, back, bg (the three DOM layers), audio, image (a dropped picture's URL, or undefined) }
  // load pictures (`ctx.image ?? "img/velvet-art.webp"`), build the scene, then return the page:
  return {
    scene,                 // a THREE.Scene the stage renders
    parallax: 0.012,       // optional: how far the camera leans toward the pointer
    layout(w, h) {},       // place the cloth with stage.frame(…); runs on resize
    step(h, t) {},         // physics, at a fixed 120 Hz: cloth.step(h)
    update(dt, t) {},      // once per frame: sync the geometry, animate lights, the DOM
    onMove(e) {}, onDown(e) {}, onUp(e) {},   // pointer events (on the window; the stage tracks stage.p)
    setImage(img) {},      // optional: re-weave a dropped picture into the cloth
    dispose() {},          // free textures and geometry: disposeScene(scene)
  };
}
```

Links and buttons in `html.hero` get `data-noop` until they go somewhere real. Any element the pointer should use
(not the cloth) needs to be `a`, `button`, `input` or carry `data-ui`.

## The stage (`engine/stage.js`)

| Member | What it does |
|---|---|
| `stage.renderer`, `stage.camera` | the WebGL renderer (transparent, shadows on) and a perspective camera |
| `stage.frame({ center, worldW, worldH, sx, sy, sh, sw, fov })` | puts world point `center` at screen point (`sx`, `sy`) (viewport fractions) so a `worldW × worldH` box fills `sh` of the height and `sw` of the width; returns pixels per metre |
| `stage.p` | the pointer: `{ x, y, active, down, touch }` in client pixels |
| `stage.rayFrom(x, y)`, `stage.onPlane(x, y, z)`, `stage.toScreen(v)` | pointer rays, where the pointer meets a plane, a world point on screen |
| `stage.advance(seconds)` | run physics forward and draw (settling before showing; a hidden tab; the console as `__cloth.advance`) |
| `STEP` | 1/120 s |

The stage lowers the pixel ratio a step if frames keep running long.

## Cloth (`engine/cloth.js`)

```js
const cloth = new Cloth({ patches: [{ cols, rows, width, height, x, y, z, u0, u1, v0, v1 }], density, substeps,
  stretch, shear, bend, damping, kN, kT, selfCollide, thickness, friction, contactSoft, grabSpeed, maxSpeed, jitter });
cloth.pin(i, x, y, z);         // fix particle i; cloth.movePin(i, x, y, z) glides it to a new spot
cloth.buildTethers(slack);     // after pinning: no particle further from its pin than in the flat cloth
cloth.grab(i, radius); cloth.drag(x, y, z); cloth.release();   // the pinch-grab (follows at grabSpeed)
cloth.nearest(x, y, z, candidates);  // the particle nearest a point (e.g. a raycast hit's triangle corners)
cloth.fillWind((x, y, z, out) => …); // the air or current velocity at each particle (drag pulls the cloth toward it)
cloth.translate(dx, dy, dz);   // move the whole cloth
cloth.spheres.push({ x, y, z, r, on: true, k: 1 });  // a sphere collider (a hand, a person walking through)
cloth.step(h);                 // from the page's step()
```

## Strands (`engine/strands.js`)

```js
const sim = new Strands({ count, beads, pitch, link, radius, x0, y0, substeps, damping, bend, maxSpeed, spans, linkIters });
sim.finger = { x, y, r, zPush, soft, maxPush };   // the soft finger that parts them (r = 0: no finger)
sim.air; sim.windFn = (strand, t, out) => …;      // the breeze strength; a per-strand breeze [x, z]
sim.zMax;                                        // the wall's face: no bead comes further forward
sim.moveAnchors(x0, y0, z0);                     // re-anchor the strands (a layout change)
sim.impacts, sim.hit                             // bead knocks since last read, and where (for sound)
```

## Banner (`engine/banner.js`)

`new Banner(settings)` wraps a `Cloth` held at one end in a current: `setRig({ o, dir, face })` places it, `place()`
lays it out, `touch(ray, h)` is the resting hand, `stir(x, y, z, vx, vy, vz, spin)` leaves a swirl, and `banner.cloth` is
the cloth. See `SILK` and `RIGS` in the `tide` example for every setting.

## Kit (`engine/kit.js`)

| Helper | Use |
|---|---|
| `loadImage(src)`, `fontsReady([...])` | await pictures, and fonts before baking text into a texture |
| `canvas(w, h)`, `drawCover`, `drawContain`, `softBlur` | baking a picture into a material |
| `texture(canvas, { srgb, repeat, anisotropy })` | a canvas → THREE texture |
| `weaveMaps`, `dropletNormals`, `bambooMap` | procedural maps (weave and openness, rain droplets, bamboo) |
| `bakeEnv(renderer, build, sigma)`, `glow`, `room` | image-based light from a small scene of glowing panels |
| `inject(material, key, { uniforms, vert, frag, … })` | add shader code to a three.js material |
| `clothGeometry(cloth)`, `syncGeometry(g)`, `splineSurface(cloth, sub)` | the mesh for a cloth, updated each frame; a smooth surface 3× finer |
| `smooth(cur, target, rate, dt)`, `rng(seed)`, `noise3` | easing, seeded random, value noise |
| `disposeScene(scene)` | free everything on `dispose()` |

## Sound (`engine/audio.js`)

Off until the visitor turns it on. `ctx.audio.rustle(amount)` (0–1, how fast the cloth moves, each frame),
`ctx.audio.clack(strength, pan)` (a bead knock), `ctx.audio.bubble(size)`. The bed comes from `meta.sound`.
