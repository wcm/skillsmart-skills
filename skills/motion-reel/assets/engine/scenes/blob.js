/*
 * Liquid: metaballs inside a morphing superformula. On the accent ground ink metaballs (the field
 * Σ r²/d² ≥ 1, with a soft offset shadow) drift inside a paper outline that snaps between forms on
 * 16th notes, tracked by a selection box with handles and a live W / H / ROT label. They fuse into
 * one drop, spray droplets, shrink to the dot; the dot punches out into a ring and the camera zooms
 * through it into ink. Beat by beat (2 beats; the times are the original's beats and stretch with
 * the scene):
 *   0.00–0.08  match cut from the record's spindle: an ink disc (r 114) at the centre, a hairline and
 *              a soft paper ring expanding off it and fading; a faint crosshair through the centre.
 *   0.04–0.20  the disc swells and splits into the blobs while the outline fades in and morphs from
 *              the first form (a circle) to the second (0.075–0.145); the readout panel slides in.
 *   0.15–0.35  hold: the blobs drift, merge and split; from 0.24 the selection box tracks the outline
 *              (its label scrambles in). Each outline drifts clockwise (~8°/beat).
 *   0.35–0.41  snap morph to the third form (the 7-point star, or the topic's silhouette `shape`);
 *              the blobs jump to new seats. Box again from 0.51.
 *   0.60–0.66  snap morph to the soft liquid hull. Box again from 0.76.
 *   0.84–0.97  the blobs rush to the centre (in-out cubic) and fuse into one wide drop; outline and
 *              box swell into a double ring and fade (0.86–1.00); the readout says MERGED, BLOBS 01.
 *   0.98–1.24  burst: droplets fly out radially (~345 px, fast ease-out) while the drop settles from
 *              an ellipse into a wobbling rounded pentagon and slowly loses size.
 *   1.24–1.36  the drop shrinks to the dot (r 62), the droplets dry up.
 *   1.36–1.45  the dot holds; its label types on beside it (1.36–1.42).
 *   1.45–1.71  the dot punches out into a ring (spring): paper inner edge, a turning crown of ticks,
 *              faint hairlines; the ring grows a little.
 *   1.71–1.95  zoom-through: the ring flies at the camera (accelerating) while its ink centre swells
 *              and fills the hole; the readouts and the HUD sink under the ink; the HUD goes off.
 *   1.89–2.00  ink: hairline rings race outward; on the last frame one paper hairline (r 745).
 *              The next scene opens on this ink.
 * Other numbers of forms share the 0.075–0.66 window.
 */
(() => {
const K = 0.5405; /* the original's seconds per beat: the exponentials below are in its seconds */
const DEG = Math.PI / 180, TAU = Math.PI * 2, N = 360; /* samples of r(θ) */
const FORMS = [
  { m: 0, n1: 1, n2: 1, n3: 1, size: 0.75 },
  { m: 3, n1: 4.5, n2: 10, n3: 10, rot: 24.8, size: 1.177 },
  { m: 7, n1: 0.5, n2: 1.2, n3: 1.2, rot: -1.3 },
  { m: 7, n1: 0.6, n2: 1.4, n3: 1.4, rot: 17.6, size: 0.93, soft: true },
];
const fmt = (str, vars) => String(str).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

Reel.scene("blob", {
  label: "LIQUID",
  bg: "accent",
  beats: 2,
  params: {
    forms: FORMS, /* the outline's forms in order: superformula { m, n1, n2, n3 } (rot: degrees, size: × the base radius, soft: drawn as a liquid hull) or any shape spec, used as its r(θ) */
    names: ["CIRCLE", "TRIANGLE", "STAR / 7", "BLOB"], /* each form's name in the readout */
    shape: null, /* a topic silhouette (shape spec): its r(θ) replaces the third form (the star) */
    shapeName: "SILHOUETTE", /* the readout name of `shape` */
    blobs: 11, /* metaballs; their total area stays that of the merged drop */
    drops: 9, /* droplets sprayed by the burst */
    seed: 5, /* where the blobs sit in each form */
    dotR: 62, /* the dot the drop shrinks to, px */
    title: "f(θ) = superformula", /* readout title, top left, as written */
    formula: "m = {m}   n₁ {n1}   n₂ {n2}   n₃ {n3}", /* readout line 2 for a superformula form */
    silhouette: "r(θ) = silhouette   {k} rays", /* readout line 2 while a shape-spec form shows */
    state: "SHAPE / {name}   BLOBS {n}", /* readout line 3 */
    merged: "MERGED", /* the state name once the blobs fuse */
    box: "W {w}  H {h}  ROT {rot}°", /* the selection box label (live) */
    iso: "Σ r²/d² ≥ 1   ISO 1.000", /* bottom-right title */
    gridLine: "GRID {grid}   T {T}s", /* bottom-right line 2; {grid} the field resolution, {T} seconds since the scene start */
    dot: "DOT  r = {r}px  →  RING", /* the dot's label */
  },
  prepare(s, g) {
    const st = g.stage, u = st.w / 928, cx = st.cx, cy = st.cy, R0 = 430 * u;
    /* the forms as r(θ) tables (max 1), angle 0 = up, clockwise */
    const forms = [].concat(s.forms || FORMS).map((f) => (f && typeof f === "object" && "m" in f ? Object.assign({}, f) : { spec: f }));
    if (s.shape) forms[Math.min(2, forms.length - 1)] = { spec: s.shape, name: s.shapeName, rot: 0, size: 1.05 };
    const names = forms.map((f, i) => String(f.name || (s.names || [])[i] || (f.spec ? s.shapeName : "FORM " + (i + 1))).toUpperCase());
    const rnd = g.rng(s.seed * 7919 + 17);
    const tabs = forms.map((f) => {
      let t;
      if (f.spec) t = g.radial(f.spec, N);
      else if (f.soft) { const a = [0.085, 0.06, 0.03].map((x) => x * (0.8 + 0.4 * rnd())), p = [0, 0, 0].map(() => rnd() * TAU); t = Float32Array.from({ length: N }, (_x, i) => { const th = (i / N) * TAU; return 1 + a[0] * Math.cos(2 * th + p[0]) + a[1] * Math.cos(3 * th + p[1]) + a[2] * Math.cos(4 * th + p[2]); }); }
      else t = Float32Array.from({ length: N }, (_x, i) => { const r = g.superformula((i / N) * TAU, f.m, f.n1, f.n2, f.n3); return Number.isFinite(r) ? r : 0; });
      let mx = 0; for (const v of t) mx = Math.max(mx, v);
      return t.map((v) => v / (mx || 1));
    });
    /* morph k (form k-1 → k) starts at T[k]: the original's 0.075, 0.35, 0.60 for four forms */
    const L = forms.length, T = [0];
    for (let k = 1; k < L; k++) T.push(L === 4 ? [0, 0.075, 0.35, 0.6][k] : g.lerp(0.075, 0.6, L > 2 ? (k - 1) / (L - 2) : 0));
    /* the blobs: radii from big to small, scaled so the merged drop is r 161 */
    const n = Math.max(1, Math.round(s.blobs)), radii = Array.from({ length: n }, (_x, i) => g.lerp(78, 12, n > 1 ? i / (n - 1) : 0));
    const k2 = (161 * u) / Math.hypot(...radii);
    const balls = radii.map((r, i) => ({ r: r * k2, w: [3 + 3 * g.hash(i, 3), 3 + 3 * g.hash(i, 4)], p: [TAU * g.hash(i, 5), TAU * g.hash(i, 6)], a: (18 + 16 * g.hash(i, 7)) * u, side: (g.hash(i, 8) - 0.5) * 120 }));
    /* each form's seat for each blob, in polar (θ, ρ of the outline radius), inside the outline */
    /* best of a few random candidates: spread out, a little overlap allowed (they touch and merge) */
    const seats = forms.map((f, k) => {
      const r2 = g.rng(s.seed * 977 + k * 131), size = (f.size || 1) * R0, placed = [];
      return balls.map((b) => {
        let best = null;
        for (let c = 0; c < 14; c++) {
          const th = r2() * TAU, edge = size * tabs[k][Math.floor((th / TAU) * N) % N];
          const lim = Math.max(0, 1 - (b.r * 1.1 + 12 * u) / Math.max(1, edge)), rho = lim * Math.sqrt(r2());
          const x = Math.sin(th) * rho * edge, y = -Math.cos(th) * rho * edge;
          let score = 1e9;
          for (const q of placed) score = Math.min(score, Math.hypot(x - q.x, y - q.y) - 0.8 * (b.r + q.r));
          score += 0.25 * b.r * r2();
          if (!best || score > best.score) best = { th, rho, x, y, r: b.r, score };
        }
        placed.push(best);
        return best;
      });
    });
    /* the metaball field: half the frame's pixels, evaluated exactly only near the contour */
    const fw = Math.ceil((g.W * g.scale) / 2), fh = Math.ceil((g.H * g.scale) / 2), S = 3;
    const cv = document.createElement("canvas"); cv.width = fw; cv.height = fh;
    const fx = cv.getContext("2d"), img = fx.createImageData(fw, fh);
    const gw = Math.ceil(fw / S) + 2, gh = Math.ceil(fh / S) + 2;
    const sh = document.createElement("canvas"); sh.width = gw; sh.height = gh;
    const shx = sh.getContext("2d"), simg = shx.createImageData(gw, gh);
    const F = { fw, fh, S, pxd: 2 / g.scale, cv, fx, img, buf: new Uint32Array(img.data.buffer), Fc: new Float32Array(gw * gh), sh, shx, simg, sbuf: new Uint32Array(simg.data.buffer) };
    const drops = Array.from({ length: Math.max(0, Math.round(s.drops)) }, (_x, j) => {
      const m = Math.max(1, Math.round(s.drops)), base = -140 + (360 / m) * j;
      return { a: (base + (g.hash(j, 11) - 0.5) * 22) * DEG, d: (310 + 60 * g.hash(j, 12)) * u, r: (11 + 3 * g.hash(j, 13)) * u };
    });
    const ticks = Array.from({ length: 36 }, (_x, j) => ({ a: (j / 36) * TAU + (g.hash(j, 21) - 0.5) * 0.08, r0: 78 + 6 * g.hash(j, 22), len: 8 + 12 * g.hash(j, 23) }));
    return { hud0: s.hud, u, cx, cy, R0, forms, names, tabs, T, balls, seats, F, drops, ticks, grid: `${Math.round(g.W / 2)}×${Math.round(g.H / 2)}`, anchor: [cx, cy], anchorR: s.dotR * u };
  },
  draw(g, s, t) {
    const { ctx } = g, _ = s._, B = s.beats, u = (t.b * 2) / B, uq = (t.bq * 2) / B, U = _.u, cx = _.cx, cy = _.cy;
    const ink = g.c.ink, paper = g.c.paper, on = g.on(s.bg), sec = u * K;
    const nz = (u - 1.706) * 32.43, nzq = (uq - 1.706) * 32.43; /* zoom-through, in the original's frames */
    _.hudTheme = nzq > 5.4 ? "dark" : null; /* on the final ink the HUD is ink: it sinks under */
    s.hud = nzq > 6.5 ? "none" : _.hud0; /* then it is off for the tail, as in the original */
    const lastFrame = t.bq + 1 / (t.fps * t.spb) > B - 1e-6;
    if (nz > 7.7) return tail(g, _, nz, lastFrame);

    /* crosshair */
    ctx.save(); ctx.fillStyle = g.rgba(on, 0.18); ctx.fillRect(cx - 0.5, cy - 600 * U, 1, 1200 * U); ctx.fillRect(0, cy - 0.5, g.W, 1); ctx.restore();
    /* the opening rings off the disc */
    if (u < 0.1) { const r = (160 + 1800 * u) * U, a = 0.32 * (1 - u / 0.1); g.ring(cx, cy, r, paper, 1.2, a); g.ring(cx, cy, r + 26 * U, paper, 10 * U, a * 0.6); }

    /* the form: morph position fk in 0 … L-1 */
    const L = _.forms.length, T = _.T;
    let fk = 0;
    for (let k = 1; k < L; k++) fk += g.span(u, T[k], T[k] + (k === 1 ? 0.07 : 0.06), "inOutCubic");
    const i0 = Math.min(L - 1, Math.floor(fk)), i1 = Math.min(L - 1, i0 + 1), ff = fk - i0;
    const rotOf = (k) => (_.forms[k].rot || 0) + 8 * (u - (T[k] || 0));
    /* the size eases on after each snap (0.2 beat, out-cubic): the shape snaps, the scale settles */
    let size = _.forms[0].size || 1;
    for (let k = 1; k < L; k++) size += ((_.forms[k].size || 1) - (_.forms[k - 1].size || 1)) * g.span(u, T[k], T[k] + 0.2, "outCubic");
    size *= _.R0;
    const rot = g.lerp(rotOf(i0), rotOf(i1), ff) * DEG;
    const merge = g.span(u, 0.84, 0.97), mergeIn = g.ease.inOutCubic(merge);
    const fade = g.span(u, 0.86, 1.0), outlineK = g.span(u, 0.08, 0.11) * (1 - g.ease.outQuad(fade));

    /* readouts (under the liquid and the zoom) */
    const inK = g.span(u, 0.06, 0.2, "outCubic"), dx = 12 * U * (1 - inK), x = g.box.x + 27.5 + dx;
    if (inK > 0) {
      const F = _.forms, fa = F[i0], fb = F[i1], show = ff < 0.5 ? fa : fb, A2 = fa.spec ? fb : fa, B2 = fb.spec ? fa : fb;
      const num = (key) => g.lerp(+(A2[key] ?? 0), +(B2[key] ?? 0), fa.spec || fb.spec ? (fa.spec ? 1 : 0) : ff).toFixed(2);
      const line2 = show.spec ? fmt(s.silhouette, { k: N }) : fmt(s.formula, { m: num("m"), n1: num("n1"), n2: num("n2"), n3: num("n3") });
      const fused = u >= 0.94, name = fused ? s.merged : _.names[ff < 0.5 ? i0 : i1];
      ctx.save(); ctx.globalAlpha = inK;
      g.text(s.title, x, g.box.y + 82.5, { kind: "mono", size: 20 * U, weight: 500, track: 1.9, color: on, alpha: 0.82 });
      g.text(line2, x, g.box.y + 114.5, { kind: "mono", size: 14 * U, weight: 500, track: 2.3, color: on, alpha: 0.42 });
      g.text(fmt(s.state, { name, n: String(fused ? 1 : _.balls.length).padStart(2, "0") }), x, g.box.y + 140.5, { kind: "mono", size: 14 * U, weight: 500, track: 2.6, color: on, alpha: 0.42 });
      const rx = g.box.r - 29.5 + dx;
      g.text(s.iso, rx, g.box.b - 69, { kind: "mono", size: 20 * U, weight: 500, track: 2.0, color: on, alpha: 0.82, align: "right" });
      g.text(fmt(s.gridLine, { grid: _.grid, T: (t.b * t.spb).toFixed(3) }), rx, g.box.b - 43, { kind: "mono", size: 14 * U, weight: 500, track: 2.7, color: on, alpha: 0.42, align: "right" });
      ctx.restore();
    }

    /* the outline: lerped tables, drawn with a faint glow, plus its bounding box */
    const A = _.tabs[i0], C = _.tabs[i1], pts = [];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const grow = 1 + 0.14 * g.ease.outCubic(fade);
    for (let i = 0; i < N; i++) {
      const r = (A[i] + (C[i] - A[i]) * ff) * size * grow, a = (i / N) * TAU - Math.PI / 2 + rot, x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      pts.push(x, y); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (outlineK > 0.001) {
      const path = new Path2D();
      for (let i = 0; i < N; i++) i ? path.lineTo(pts[2 * i], pts[2 * i + 1]) : path.moveTo(pts[0], pts[1]);
      path.closePath();
      ctx.save(); ctx.lineJoin = "round";
      ctx.strokeStyle = g.rgba(paper, 0.12 * outlineK); ctx.lineWidth = 9 * U; ctx.stroke(path);
      ctx.strokeStyle = g.rgba(paper, 0.95 * outlineK); ctx.lineWidth = 3.2 * U; ctx.stroke(path);
      if (fade > 0) { ctx.translate(cx, cy); ctx.scale(1.07, 1.07); ctx.translate(-cx, -cy); ctx.strokeStyle = g.rgba(paper, 0.45 * outlineK); ctx.lineWidth = 2 * U; ctx.stroke(path); }
      ctx.restore();
    }
    /* the selection box: from 0.16 beat after each morph starts until the next */
    const k = Math.round(fk), boxOn = Math.abs(fk - k) < 1e-3 && k >= 1 ? g.span(u, T[k] + 0.16, T[k] + 0.19) * (k + 1 < L ? 1 - g.span(u, T[k + 1] - 0.005, T[k + 1]) : 1) * (1 - g.ease.outQuad(fade)) : 0;
    if (boxOn > 0) {
      const p = 18 * U, bx = x0 - p, by = y0 - p, bw = x1 - x0 + 2 * p, bh = y1 - y0 + 2 * p;
      ctx.save(); ctx.globalAlpha = boxOn;
      ctx.strokeStyle = g.rgba(on, 0.42); ctx.lineWidth = 1.2; ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = paper; ctx.strokeStyle = g.rgba(on, 0.75); ctx.lineWidth = 1;
      for (const [hx, hy] of [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5]]) { const qx = bx + hx * bw - 3.5 * U, qy = by + hy * bh - 3.5 * U; ctx.fillRect(qx, qy, 7 * U, 7 * U); ctx.strokeRect(qx, qy, 7 * U, 7 * U); }
      let label = fmt(s.box, { w: Math.round(x1 - x0), h: Math.round(y1 - y0), rot: ((((rot / DEG) % 360) + 540) % 360 - 180).toFixed(1) });
      const age = uq - (T[k] + 0.16);
      if (age < 0.065) label = [...label].map((ch, j) => (ch === " " || g.hash(j, Math.floor(uq * 32.43), k) > age / 0.065 ? (ch === " " ? " " : "▮▯#%/\\=+"[Math.floor(g.hash(j, uq * 9, 3) * 8)]) : ch)).join("");
      g.text(label, bx, by - 12 * U, { kind: "mono", size: 14 * U, weight: 500, track: 1.6, color: on, alpha: 0.7 });
      ctx.restore();
    }

    /* the liquid: metaballs until the drop fuses, then a wobbling drop with droplets */
    if (u < 1.0) {
      const split = g.span(u, 0.075, 0.2, "outCubic"), swell = g.lerp(114 / 161, 1, g.span(u, 0.04, 0.13, "outCubic"));
      const balls = _.balls.map((b, i) => {
        /* the seat in the current form (blending through a morph over 0.09 beat), plus a drift */
        let x = cx, y = cy;
        if (fk > 0) {
          const pos = (kk) => { const st = _.seats[kk][i], tb = _.tabs[kk], r = st.rho * (_.forms[kk].size || 1) * _.R0 * tb[Math.floor((st.th / TAU) * N) % N], a = st.th - Math.PI / 2 + rotOf(kk) * DEG; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
          let kk = 1; for (let q = 2; q < L; q++) if (u >= T[q]) kk = q;
          const m = kk > 1 ? g.span(u, T[kk], T[kk] + 0.09, "outCubic") : 1, P = pos(kk), Q = kk > 1 ? pos(kk - 1) : [cx, cy];
          const sp = kk > 1 ? m : split;
          x = g.lerp(Q[0], P[0], sp) + b.a * Math.sin(b.w[0] * u + b.p[0]) * split; y = g.lerp(Q[1], P[1], sp) + b.a * Math.sin(b.w[1] * u + b.p[1]) * split;
        }
        /* they arrive spread sideways: the fused drop starts as a wide ellipse */
        return [g.lerp(x, cx + b.side * U, mergeIn), g.lerp(y, cy, mergeIn), b.r * swell];
      });
      metaballs(g, _, balls, ink);
    } else if (u < 1.445) {
      const tb = (u - 0.975) * K, wob = g.span(u, 1.0, 1.03) * (1 - g.span(u, 1.24, 1.34)), sq = 0.13 * Math.exp(-(u - 1.0) / 0.035);
      const Rm = g.lerp(g.lerp(164, 146, g.span(u, 1.05, 1.24)), s.dotR, g.span(u, 1.24, 1.36, "inOutCubic")) * U;
      ctx.save(); shadow(g, ctx, ink); ctx.fillStyle = ink; ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const a = (i / 120) * TAU, r = Rm * (1 + sq * Math.cos(2 * a) + wob * (0.06 * Math.sin(5 * a + 9 * sec) + 0.04 * Math.sin(3 * a - 6 * sec)));
        ctx[i ? "lineTo" : "moveTo"](cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      ctx.fill();
      const dk = 1 - g.smoothstep(1.24, 1.36, u);
      if (dk > 0) for (const d of _.drops) {
        const dist = d.d * (1 - Math.exp(-tb / 0.018)) + 60 * U * tb;
        if (dist > 40 * U) { ctx.beginPath(); ctx.arc(cx + Math.cos(d.a) * dist, cy + Math.sin(d.a) * dist, d.r * dk, 0, TAU); ctx.fill(); }
      }
      ctx.restore();
      /* the dot's label types on */
      const ty = g.span(u, 1.36, 1.42);
      if (ty > 0) dotLabel(g, s, _, ty, 1);
    } else ring(g, s, t, _, u, nz);

    /* the zoom-through covers the readouts too */
    if (nz > 0) zoom(g, _, nz);
  },
});

/* the soft drop shadow of the liquid: ink at 35%, offset down-right */
function shadow(g, ctx, ink) { ctx.shadowColor = g.rgba(ink, 0.35); ctx.shadowBlur = 8 * g.scale; ctx.shadowOffsetX = 5 * g.scale; ctx.shadowOffsetY = 7 * g.scale; }

/*
 * The field Σ r²/d² on a grid of half the frame's pixels. A coarse pass (every 3rd pixel) finds the
 * cells that are surely in or out; only cells near the contour are evaluated per pixel, with an
 * antialiased edge from the signed distance (F - 1)/|∇F|. The coarse pass doubles as the shadow.
 */
function metaballs(g, _, balls, ink) {
  const F = _.F, { fw, fh, S, pxd, buf, Fc } = F, [ir, ig, ib] = g.hex(ink), col = ((ib << 16) | (ig << 8) | ir) >>> 0, full = (col | 0xff000000) >>> 0;
  let R2 = 0, bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
  for (const [x, y, r] of balls) { R2 += r * r; bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  const reach = Math.sqrt(R2) * 1.5 + 24;
  const gx0 = Math.max(0, Math.floor((bx0 - reach) / pxd / S)), gy0 = Math.max(0, Math.floor((by0 - reach) / pxd / S));
  const gx1 = Math.min(Math.ceil(fw / S), Math.ceil((bx1 + reach) / pxd / S)), gy1 = Math.min(Math.ceil(fh / S), Math.ceil((by1 + reach) / pxd / S));
  const nx = gx1 - gx0 + 1, ny = gy1 - gy0 + 1, n = balls.length;
  const BX = new Float64Array(n), BY = new Float64Array(n), BR = new Float64Array(n);
  balls.forEach(([x, y, r], i) => { BX[i] = x; BY[i] = y; BR[i] = r * r; });
  for (let j = 0; j < ny; j++) {
    const Y = ((gy0 + j) * S + 0.5) * pxd;
    for (let i = 0; i < nx; i++) {
      const X = ((gx0 + i) * S + 0.5) * pxd; let f = 0;
      for (let q = 0; q < n; q++) { const dx = X - BX[q], dy = Y - BY[q]; f += BR[q] / (dx * dx + dy * dy + 1e-6); }
      Fc[j * nx + i] = f;
    }
  }
  buf.fill(0);
  let ci0 = nx, ci1 = -1, cj0 = ny, cj1 = -1; /* the cells that can hold ink: only they are drawn */
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = Fc[j * nx + i], b = Fc[j * nx + i + 1], c = Fc[(j + 1) * nx + i], d = Fc[(j + 1) * nx + i + 1];
    const mx = Math.max(a, b, c, d); if (mx < 0.5) continue;
    if (i < ci0) ci0 = i; if (i > ci1) ci1 = i; if (j < cj0) cj0 = j; if (j > cj1) cj1 = j;
    const mn = Math.min(a, b, c, d), X0 = (gx0 + i) * S, Y0 = (gy0 + j) * S, X1 = Math.min(fw, X0 + S), Y1 = Math.min(fh, Y0 + S);
    if (mn > 1.6) { for (let y = Y0; y < Y1; y++) buf.fill(full, y * fw + X0, y * fw + X1); continue; }
    for (let y = Y0; y < Y1; y++) {
      const Y = (y + 0.5) * pxd;
      for (let x = X0; x < X1; x++) {
        const X = (x + 0.5) * pxd; let f = 0, gxx = 0, gyy = 0;
        for (let q = 0; q < n; q++) { const dx = X - BX[q], dy = Y - BY[q], i2 = 1 / (dx * dx + dy * dy + 1e-6), v = BR[q] * i2, w = 2 * v * i2; f += v; gxx -= w * dx; gyy -= w * dy; }
        const sd = (f - 1) / (Math.sqrt(gxx * gxx + gyy * gyy) + 1e-9), al = sd / pxd + 0.5;
        if (al > 0) buf[y * fw + x] = al >= 1 ? full : (col | (Math.round(al * 255) << 24)) >>> 0;
      }
    }
  }
  if (ci1 < 0) return;
  const px0 = (gx0 + ci0) * S, py0 = (gy0 + cj0) * S, px1 = Math.min(fw, (gx0 + ci1 + 1) * S), py1 = Math.min(fh, (gy0 + cj1 + 1) * S);
  F.fx.clearRect(px0, py0, px1 - px0, py1 - py0);
  F.fx.putImageData(F.img, 0, 0, px0, py0, px1 - px0, py1 - py0);
  /* the shadow from the coarse pass: a soft threshold, scaled up (blurs by itself), offset */
  const sb = F.sbuf; sb.fill(0);
  const gw = F.sh.width;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const f = Fc[j * nx + i]; if (f > 0.6) sb[j * gw + i] = (col | (Math.round(g.smoothstep(0.65, 1.35, f) * 255) << 24)) >>> 0; }
  F.shx.clearRect(0, 0, gw, F.sh.height); F.shx.putImageData(F.simg, 0, 0, 0, 0, nx, ny);
  const ctx = g.ctx, cell = S * pxd;
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "low";
  const si0 = Math.max(0, ci0 - 1), sj0 = Math.max(0, cj0 - 1), sw = Math.min(nx, ci1 + 3) - si0, shh = Math.min(ny, cj1 + 3) - sj0;
  ctx.globalAlpha = 0.35; ctx.drawImage(F.sh, si0, sj0, sw, shh, (gx0 + si0) * cell + 0.5 * pxd - 0.5 * cell + 5 * _.u, (gy0 + sj0) * cell + 0.5 * pxd - 0.5 * cell + 7 * _.u, sw * cell, shh * cell);
  ctx.globalAlpha = 1; ctx.drawImage(F.cv, px0, py0, px1 - px0, py1 - py0, px0 * pxd, py0 * pxd, (px1 - px0) * pxd, (py1 - py0) * pxd);
  ctx.restore();
}

/* the dot's label, typed on: k = share of characters shown */
function dotLabel(g, s, _, k, alpha) {
  const str = fmt(s.dot, { r: Math.round(s.dotR) }), n = Math.round(k * [...str].length);
  g.text([...str].slice(0, n).join(""), _.cx + 92 * _.u, _.cy - 93 * _.u, { kind: "mono", size: 16.5 * _.u, weight: 500, track: 2.0, color: g.on(s.bg), alpha: 0.85 * alpha });
}

/* the ring: the dot punches out (spring), grows; ticks turn around it */
function ring(g, s, t, _, u, nz) {
  const { ctx } = g, U = _.u, cx = _.cx, cy = _.cy, ink = g.c.ink, paper = g.c.paper;
  const ds = (u - 1.445) * K, sp = g.ease.spring(ds, 10, 0.42), Z = nz > 0 ? Math.exp((0.37 * nz * nz) / (nz + 0.6)) : 1;
  const zo = Z * (1 + 0.3 * g.smoothstep(3.5, 5, nz));
  const pop = (Math.exp(-ds / 0.035) - Math.exp(-ds / 0.012)) / 0.375;
  const hole = (37 * Math.max(0, sp) + 9 * g.span(u, 1.55, 1.706)) * U * Z;
  const outer = (g.lerp(58, 75, g.span(u, 1.52, 1.706)) + 16 * pop) * U * zo;
  const dot = hole * g.clamp((nz - 0.8) * 0.22, 0, 1);
  /* faint hairlines and the tick crown */
  const hl = g.span(u, 1.6, 1.68) * (1 - g.span(nz, 2, 4));
  if (hl > 0) for (let r = 90; r <= 140; r += 10) g.ring(cx, cy, r * U * zo, paper, 1, 0.12 * hl);
  const tk = 1 - g.span(nz, 0, 2.5);
  if (tk > 0) {
    const spin = (120 * DEG * ds), grow = (1 + 0.35 * (1 - Math.min(1, sp))) * zo;
    ctx.save(); ctx.strokeStyle = g.rgba(paper, 0.6 * tk); ctx.lineWidth = 2.4 * U; ctx.lineCap = "round"; ctx.beginPath();
    for (const q of _.ticks) { const a = q.a + spin, c = Math.cos(a), sn = Math.sin(a), r0 = q.r0 * U * grow, r1 = (q.r0 + q.len) * U * grow; ctx.moveTo(cx + c * r0, cy + sn * r0); ctx.lineTo(cx + c * r1, cy + sn * r1); }
    ctx.stroke(); ctx.restore();
  }
  ctx.save(); if (nz < 1.5) shadow(g, ctx, ink); ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(cx, cy, outer, 0, TAU); if (hole > 0.5) ctx.arc(cx, cy, hole, 0, TAU, true); ctx.fill(); ctx.restore();
  if (hole > 0.5) g.ring(cx, cy, hole, paper, 2 * U, 0.9 * (1 - g.span(nz, 1, 3)));
  if (dot > 0) g.circle(cx, cy, dot, ink);
  dotLabel(g, s, _, 1, 1 - g.span(nz, 0, 2));
}

/* the end of the zoom-through, over everything the scene drew: the last of the ground goes, hairlines race out */
function zoom(g, _, nz) {
  if (nz > 7.3) { const k = g.span(nz, 7.3, 7.7); g.ctx.save(); g.ctx.globalAlpha = k; g.ctx.fillStyle = g.c.ink; g.ctx.fillRect(0, 0, g.W, g.H); g.ctx.restore(); }
  if (nz > 5.6) hairlines(g, _, nz, g.span(nz, 5.6, 6.2));
}
function hairlines(g, _, nz, a) {
  const r0 = 360 * _.u * Math.pow(1.37, nz - 6);
  for (let j = 0; j < 7; j++) g.ring(_.cx, _.cy, r0 + j * 11 * _.u, g.mix(g.c.ink, g.c.paper, 0.16), 1, a);
}

/* the ink after the zoom: hairline rings race outward; the last frame keeps one paper hairline */
function tail(g, _, nz, lastFrame) {
  g.ctx.fillStyle = g.c.ink; g.ctx.fillRect(0, 0, g.W, g.H);
  if (lastFrame) g.ring(_.cx, _.cy, 745 * _.u, g.c.paper, 1.5, 0.75);
  else hairlines(g, _, nz, 1);
}
})();
