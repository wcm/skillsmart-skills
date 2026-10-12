# Engine API

Everything in `site/engine/` is fixed: don't edit it. A page is two files, `site/themes/<id>.js` and `<id>.css`,
listed in `site/themes/pages.json` (and the generated `index.js`). three.js 0.170 comes from jsDelivr through the
import map in `index.html`.

## The page module

```js
export const meta = { id: "halden", no: "01", name: "Halden", bg: "#020308", ink: "#f3f1ee", title: "Halden · …" };
export const html = { hero: `<header class="nav">…</header><section class="copy">…</section><footer class="foot">…</footer>` };

export function create(stage) {
  // build the scene; return the page:
  return {
    maxDpr: 1.5,                 // optional cap on the pixel ratio (heavy pieces use 1.25)
    resize(w, h, dpr) {},        // re-aim the camera at stage.slot, resize render targets and post passes
    update(dt, t) {},            // every frame: animate, read stage.p, render (GlassStage, then the main or post pass)
    down(e) {}, move(e) {}, up() {},   // pointer (the stage ignores presses on links, buttons and [data-ui])
    dispose() {},                // free geometry, materials, render targets
  };
}
```

`meta.bg` colours the veil while the page loads; `html.hero` uses the shell's classes (`.nav`, `.brand`, `.links`,
`.pill`, `.copy`, `.kicker`, `h1` with one `<em>`, `.lede`, `.cta`, `.btn`, `.hint`, `.foot`), styled in `base.css`
and themed per page.

## The stage (`engine/stage.js`)

| Member | What it does |
|---|---|
| `stage.renderer` | the WebGL renderer |
| `stage.slot` | where the object sits: `{ wide, x, y, size }` (fractions of the viewport): right of the copy on wide screens, below it on tall ones |
| `aim(camera, w, h, slot, radius)` | lens-shift a perspective camera so the world origin lands on the slot; returns the distance at which a subject of `radius` fills it |
| `stage.p` | the pointer: `x, y` (−1…1, y up), `sx, sy` (eased), `vx, vy` (velocity), `presence` (eases to 1 while it's over the page), `down` |
| `pointerRay(camera, stage.p)` | the pointer as a world ray |
| `stage.t`, `stage.motion` | page time; 0.35 when the visitor prefers reduced motion |
| `stage.advance(seconds)` | draw frames by hand (a hidden tab; the console as `__glass.advance`) |

The stage lowers resolution in steps (down to 60%) when frames run under ~30 fps for a few seconds.

## Glass (`engine/glass.js`)

```js
const gs = new GlassStage(renderer, { bgScale: 0.75, backScale: 0.75 });
gs.resize(w, h, dpr);
gs.render(scene, camera);       // before the main render: the backdrop (non-glass) and the glass's back faces
const env = bakeEnv(renderer, ENV_GLSL, { size: 256, uniforms });   // a studio function baked once into a cube map
const mat = glassMaterial(gs, env, {
  ior: 1.5, spread: 0.3,         // index of refraction and how far the wavelengths fan apart
  samples: 8,                    // wavelengths followed (more = smoother rainbow, slower)
  depth: 3, absorb: [0, 0, 0],   // how far a ray travels to the backdrop; tint by thickness (smoky glass)
  reflect: 1, through: 0.2, saturation: 1,
  tangents: false,               // true when a normal hook needs vVT (ribs along a tube)
  hooks: { head, normal, shade },// GLSL injected: declarations; bend N before refraction; tint the result
  uniforms: {},
});
mesh.layers.set(GLASS_LAYER);   // glass meshes on GLASS_LAYER, everything else on 0; the camera enables both
scene.add(backdrop(FRAG_GLSL, uniforms));   // a full-screen shader at the far plane (gets vUv; pass your own uniforms)
STRIP                           // GLSL: strip(d, center, axis, width, halfLen) — a line light for ENV
```

**The rule for vivid colour:** dispersion only shows where thin, very bright light meets darkness. Each studio pairs
a dark room with hot, thin strips (`STRIP`), and a pale page needs dense dark lines behind the glass (`cubes`). Glow
without edges gives a pale, milky result.

Every glass shader guards against NaN (bloom would smear one bad pixel into flickering black blocks); keep the guard
in any hook you write: `if (any(isnan(c))) c = vec3(0.0);`.

## Lens (`engine/lens.js`) and post (`engine/post.js`)

- `new Lens(renderer, { levels })` (`resize`, `render(scene, camera)`): a soft old lens over a sharp render (dual Kawase blur, defocus by distance from a
  focus point with wavelengths split by magnification, halation, filmic roll-off, vignette, grain). Used by `flower`.
- `makePost(renderer, scene, camera, { bloom, disperse, vignette, grain, samples })`: optional bloom, tone mapping and
  a finishing pass that disperses the frame slightly toward the edges. `post.resize(w, h, dpr)`, `post.render(t)`.

## Trackball (`engine/trackball.js`)

```js
const ball = new Trackball(group, { own: [0.15, 1, 0.08], spin: 0.11, home: null, settle: 0.8, sensitivity: 0.0065, friction: 1.1 });
ball.down(e); ball.move(e); const tapped = ball.up(); ball.update(dt); ball.turn(axis, angle); ball.dispose();
```

Drag tilts and rolls like a ball under the finger; a flick flings it with friction; left alone it spins slowly about
`own`, or settles back to `home` when one is given. `up()` returns true for a press that didn't move (a tap).

## Spectrum (`engine/glsl.js`)

`SPECTRUM` (GLSL `spectrum(s)`, Zucconi's six-bump fit, s in 0…1), `spectrumRGB(s)` in JS, `NOISE`, `QUAD_VERT`.
