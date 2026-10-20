# A scene or a transition of your own

When no scene shows what the idea needs, write one inside the reel file, before `Reel.make`. Never
edit `<skill>/assets/engine/`: a scene in the reel file travels with the reel.

```js
Reel.scene("steam", {
  label: "STEAM",            // the HUD name
  bg: "ink",                 // a palette role
  beats: 2,                  // a default length
  params: { wisps: 9 },      // every option, with its default
  prepare(s, g) {            // once, before the first frame: precompute, return s._
    return { anchor: [g.stage.cx, g.stage.cy] };
  },
  draw(g, s, t) {            // every frame: a pure function of t
    const { ctx } = g, k = g.span(t.b, 0, 1, "outCubic");
    for (let i = 0; i < s.wisps; i++) { /* … */ }
    g.circle(g.stage.cx, g.stage.cy, 14, "accent");
    g.mono("STEAM / CURL", g.box.x + 27.5, g.box.y + 63.5, { size: 20, weight: 600, color: g.on(s.bg) });
  },
});
Reel.make({ …, scenes: [ …, { type: "steam", beats: 2, wisps: 12 }, … ] });
```

## The rules

1. **A pure function of time.** `draw` gets the clock `t` and draws that moment from nothing: no
   state carried from the last frame, no timers, no `Math.random()` (use `g.rng(seed)` or
   `g.hash(i, j)`). The renderer draws frames in any order, and motion blur draws several moments
   inside each frame. Integrate a simulation once in `prepare` and look it up (`flow.js` does).
2. **Beats, not seconds.** `t.b` is beats since the scene began (warped, if the scene has a warp),
   `t.rb` the same on screen time, `t.p` its 0–1 progress, `t.beats` its length. `g.span(t.b, a, z,
   ease)` is the eased 0–1 progress from beat a to z. Use `t.bq` for hard changes (a word swap) so the
   motion blur never mixes the two sides.
3. **Roles, not colours.** `g.c.accent`, `g.col("cool")`, `g.on(bg)` (the ink that reads on a
   ground), `g.mix`, `g.rgba`.
4. **Inside the box.** `g.box` is the HUD frame and `g.stage` the area inside it for the subject
   (`cx`, `cy`, `w`, `h`, `min`). Lay out from them, not from fixed pixels, so every format works.
5. **The dot.** Set `s._.anchor` (and `s._.anchorR`) to the dot the scene ends on, so a zoom, iris or
   flood out of it opens from there.
6. **Words as params**, so the next reel can reuse the scene.

## A transition of your own

```js
Reel.transitions.drip = (ctx, k, o, X) => {   // k: 0 → 1 through it; o: its options
  const A = X.picA(), B = X.picB();            // the outgoing and incoming pictures, as layers
  ctx.drawImage(A, 0, 0, X.R.w, X.R.h);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, X.R.w, X.R.h * k); ctx.clip();
  ctx.drawImage(B, 0, 0, X.R.w, X.R.h); ctx.restore();
};
// … { type: "words", out: { type: "drip", beats: 0.6 } }
```

`X` also has `X.anchorA()` / `X.anchorB()` (each scene's dot: `[x, y, r]`), `X.fillGround(ctx,
scene)`, `X.a` / `X.b` (the scenes), `X.t` (the clock), `X.side` ("out" or "in").

## The toolkit (`g`)

| | |
| --- | --- |
| clock | `t.b`, `t.bq`, `t.rb`, `t.p`, `t.beats`, `t.sec`, `t.spb`, `t.fps`, `t.f`, `t.fi`, `t.F`, `t.bpm`, `t.next`, `t.prev` |
| maths | `g.clamp g.lerp g.seg g.span g.smoothstep g.fract g.mod g.TAU`, `g.ease.*` (`outCubic`, `inOutCubic`, `outBack`, `outExpo`, `outElastic`, …, `spring(sec, hz, zeta)`) |
| random | `g.rng(seed)` stream, `g.hash(a, b, …)` stateless, `g.noise3(x, y, z)` simplex |
| colour | `g.c.<role>`, `g.col(roleOrHex)`, `g.on(bg)`, `g.mix(a, b, t)`, `g.rgba(c, a)`, `g.luma(c)` |
| type | `g.text(str, x, y, { kind: display\|serif\|mono, size, weight, style, track, align, color, alpha, stroke, fit })`, `g.mono`, `g.measure`, `g.fit(str, opts, maxW)`, `g.letters(str, opts)`, `g.font(kind, size, weight, style)`; `g.minText` (20) and `g.grow(size)`, the factor a line set at `size` grows by under it (multiply its line spacing) |
| shapes | specs: `"circle" "square" "triangle" "hexagon" "star-12" "poly-5" "text:A"`, `{ d, view }`, `{ superformula: { m, n1, n2, n3 } }`; `g.shape`, `g.shapePath`, `g.mask`, `g.points(spec, n)`, `g.radial(spec)` (r(θ) for morphs), `g.radialPath` |
| pieces | `g.voronoi(sites, [x0, y0, x1, y1])` → cells `{ poly, c }` (shards, cracks, tiles) |
| drawing | `g.circle g.ring g.line g.rrect g.brackets g.dotGrid` |
| 3D | `g.camera({ yaw, pitch, dist, fov, cx, cy, unit })` → `project([x, y, z])` |
| layers | `g.layer(name)` an offscreen frame-sized canvas, `g.smear(draw, dx, dy, n, ctx, tag)` directional motion blur |
| the reel | `Reel.paintAt(frame, ctx)` draws another moment of the reel (the rewind uses it); `s._.hudFrame`, `s._.hudLabel`, `s._.hudVars` make the HUD read another moment, label or numbers |
| frame | `g.W g.H g.box g.stage g.ctx g.canvas` |

## Fonts of your own

Put the woff2 files (SIL Open Font License, or another licence that lets you embed them) in
`<skill>/assets/fonts/`, add a line per face to `fonts.json` (family, file, style, weight, unicode
range, `stretch` for a width axis), and name the family in the reel's `fonts`. They are embedded in
every page you build.

Check your scene like any other: `node <skill>/scripts/frames.mjs reel.js --scene steam --n 12`.
