/*
 * Point cloud. The lattice's own points (32 × 50 = 1600, still rippling, same camera) swirl into
 * a spinning mesh, snap from mesh to mesh on the beat and half-beat, then blast out of an accent
 * dot. A design-tool bounding box (8 handles, a rotation knob) tracks the projected cloud, with a
 * MESH / <NAME> label and a live ROT readout under it; the top-left panel reads the morph live.
 * Written in the original's seconds (1 beat = 0.5405 s), scaled with the tempo and the scene length.
 *   b 0.00       no cut from a lattice scene before it: same points, waves and camera; only the
 *                HUD text changes. Without one it starts from that same floor (a 4+ beat cloud
 *                with no lattice before it plays the lattice itself first, titled by `top`).
 *   b 0.00–1.0   floor → form 1 (sphere): a vortex (the floor swirls ~100° about the vertical
 *                while it gathers, then inflates; out-expo, the far rows up to 0.1 s late), the
 *                floor's outer rings sweeping up over the top. Points take their own colours
 *                (≈5% sun, 5% blush) and depth shading (near dots big, far ones small and dim).
 *                The camera eases 50° → 30° pitch (in-out sine) and the look-at point drops back
 *                to the centre; yaw keeps drifting. The sphere spins 86°/s (ROT).
 *   b 0.37–0.50  the bounding box, handles, knob, label and ROT fade in.
 *   b 1.00       form 2 (torus), out-expo 0.3 s, a spin kick (+76° decaying).
 *   b 1.48       form 3 (cube edges), out-expo 0.17 s, another kick (+65°). More forms share
 *                1.00–1.48; a single form spins on.
 *   b 1.81       explode: box and labels go, an accent dot (r 12 → 16 → 3) and six shock rings
 *                at the centre for a frame, the points fly out radially (accelerating, the near
 *                ones growing into soft discs), panel and gizmo fade. Hard cut on the downbeat.
 * Forms: sphere, torus, cube, helix, or any shape spec (an svg { d, view, rule } silhouette,
 * text:X): its outline as points on the front and back of an 80-unit slab, posed to face the
 * camera. Every form is sampled in grid order, so neighbours stay neighbours through a morph.
 * A full-frame shutter (the engine's blur) streaks the morphs and the burst as the original's.
 */
(() => {
const DEG = Math.PI / 180, TAU = Math.PI * 2;
const SW = 100; /* the vortex swirl, degrees */
const KICKS = [[76.5, 15], [65, 18], [60, 18]]; /* spin kick per later form: degrees, decay rate per second */
Reel.scene("cloud", {
  continues: "lattice", /* after a lattice it is one continuous shot, not a cut */
  label: "POINT CLOUD",
  bg: "cool",
  beats: 2,
  shutter: 1, /* a full-frame shutter: the original's morphs and burst streak long */
  params: {
    forms: ["sphere", "torus", "cube"], /* the meshes it becomes, in order: sphere, torus, cube, helix, or any shape spec (an svg silhouette or text:X, extruded) */
    names: null, /* their labels, e.g. ["SPHERE", "TORUS", "BEAN"]; default from the forms (a shape spec is FORM) */
    notes: null, /* the line under each label after N=…, e.g. ["R=440", "R=335 r=105", "a=490"]; default from the mesh */
    n: 1600, /* points when no lattice comes before it (a grid near 32×50); after a lattice, its grid */
    title: "POINT CLOUD / MORPH", /* the panel title (case kept) */
    count: "N={n}   {name}", /* panel line 2 (case kept): {n} points, {name} the current form */
    cam: "PITCH {pitch}°  YAW {yaw}°", /* panel line 3, live */
    clock: "t={t}  EASE outExpo", /* panel line 4: {t} seconds into the scene */
    mesh: "MESH / {name}", /* the label under the box */
    meta: "N={n}  {note}", /* the line under it */
    rot: "ROT {rot}°", /* right of it: the live spin */
    explode: "EXPLODE", /* the form name the panel shows for the burst */
    tilt: 30, /* the camera pitch it eases to, degrees */
    dot: "accent", /* the burst's dot */
    accents: ["sun", "blush"], /* the colours of the ~10% accent points (palette roles) */
    axes: ["X", "Y", "Z"], /* the gizmo's axis letters */
    top: "PATTERN / LATTICE", /* the lattice panel title, only for a 4+ beat cloud with no lattice before it (it plays the lattice first) */
  },
  prepare(s, g) {
    const kit = Reel.lattice, R = g.R, ns = R.scenes.length;
    const prev = ns > 1 ? R.scenes[(s.i - 1 + ns) % ns] : null, after = !!prev && prev.type === "lattice";
    const lead = after ? 0 : s.beats >= 4 ? s.beats - 2 : 0;
    const LP = Object.assign({}, Reel.defs.lattice.params, after ? prev : { top: s.top, axes: s.axes });
    let [cols, rows] = [].concat(LP.dots);
    if (!after) { cols = Math.max(2, Math.round(Math.sqrt((s.n * 32) / 50))); rows = Math.max(2, Math.round(s.n / cols)); }
    rows = rows ?? cols;
    const latB = after ? prev.beats : lead || 2;
    const L = kit.floor(g, { cols, rows, beats: latB, tilt: LP.tilt, yaw: LP.yaw, turn: LP.turn, drift: LP.drift });
    const lead0 = lead ? kit.floor(g, { cols, rows, beats: lead, tilt: LP.tilt, yaw: LP.yaw, turn: LP.turn, drift: LP.drift }) : null;
    const C = kit.setup(g, LP, s.bg), N = L.N;
    const acc = [].concat(s.accents || []).map((c) => g.col(c));
    C.styles = kit.styles(g, [C.base, g.col(LP.crest || "accent"), g.col(LP.mid || "sun"), ...acc]);
    /* each point's own colour: ≈90% base, the rest split between the accents; when they appear */
    const own = new Uint8Array(N), seen = new Float32Array(N), delay = new Float32Array(N), burst = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const hsh = g.hash(k, 11), i = k % cols, j = Math.floor(k / cols);
      own[k] = acc.length && hsh < 0.1 ? 3 + Math.floor((hsh / 0.1) * acc.length) : 0;
      seen[k] = 0.1 * g.hash(k, 3);
      delay[k] = 0.1 * g.clamp(0.75 * (1 - j / (rows - 1)) + 0.25 * (1 - i / (cols - 1)));
      burst[k] = 0.3 + 1.4 * g.hash(k, 5);
    }
    /* the timeline (original seconds), stretched with the scene: form starts, durations, the burst */
    const Bm = s.beats - lead, q = Bm / 2, K = kit.K, forms = [].concat(s.forms || []).filter(Boolean);
    if (!forms.length) forms.push("sphere");
    const nF = forms.length, tE = Math.max(0.3, Bm * K - 0.105);
    const t0 = forms.map((_f, k) => (k === 0 ? 0 : nF === 2 ? 0.54 * q : (0.54 + ((k - 1) * 0.26) / (nF - 2)) * q));
    const dur = t0.map((t, k) => (k === 0 ? Math.min(0.5 * q, nF > 1 ? t0[1] : 9) : Math.min(0.3 * q, (k + 1 < nF ? t0[k + 1] : tE) - t)));
    const yawEnd = kit.camAt(L, L.tauEnd).yaw, spinEnd = spinAt(t0, q, tE + 1);
    /* the camera at a moment of the morph: a form that faces it is posed against it */
    const camAt = (x) => ({ yaw: yawEnd + L.drift * x, pitch: L.tilt + (s.tilt - L.tilt) * g.ease.inOutSine(g.clamp((x - 0.017 * q) / (0.6 * q))) });
    const built = forms.map((f, k) => form(g, f, cols, rows, k, camAt(k === 0 ? 0.4 * q : tE), k === 0 ? spinAt(t0, q, 0.4 * q) : spinEnd));
    const names = forms.map((f, k) => String((s.names && s.names[k]) ?? (typeof f === "string" && /^[a-z]+$/.test(f) ? f.toUpperCase() : "FORM")));
    const notes = built.map((b, k) => String((s.notes && s.notes[k]) ?? b.note));
    const dotR = kit.monotone([[0, 12], [0.017, 16], [0.033, 12], [0.05, 8.5], [0.067, 5], [0.1, 3]]);
    /*
     * Which slot of the forms each floor point takes: rings of the floor (inner first) go to bands
     * of form 1 (bottom first: the rim sweeps up and over), and within a band by angle about the
     * vertical, offset by the swirl, so the vortex is one coherent turn. Every form is laid out on
     * the same slots (grid order), so form-to-form morphs stay coherent too.
     */
    const perm = new Uint32Array(N), M0 = mul(built[0].orient, ry((spinAt(t0, q, 0.25 * q) - built[0].spin0) * DEG)), w = [0, 0, 0];
    const slots = Array.from({ length: N }, (_x, m) => { apply(M0, built[0].pts, m, w); return [m, w[1], Math.atan2(-w[2], w[0])]; }).sort((a, c) => a[1] - c[1]);
    const pts = Array.from({ length: N }, (_x, k) => [k, L.r[k], Math.atan2(-L.z[k], L.x[k]) + SW * DEG]).sort((a, c) => a[1] - c[1]);
    for (let a = 0; a < N; a += rows) {
      const ps = pts.slice(a, a + rows).sort((x, y) => wrap(x[2]) - wrap(y[2])), ss = slots.slice(a, a + rows).sort((x, y) => x[2] - y[2]);
      ps.forEach((pp, m) => { perm[pp[0]] = ss[Math.min(m, ss.length - 1)][0]; });
    }
    return {
      kit, L, lead0, LP, C, N, cols, rows, lead, q, t0, dur, tE, yawEnd, built, names, notes, own, seen, delay, burst, dotR, perm,
      off0: L.lift * Math.min(1, L.tilt / 30), anchor: [g.box.cx, g.box.cy], lk: [0, 0, 0],
      bx: new Float32Array(3),
    };
  },
  draw(g, s, t) {
    const _ = s._, kit = _.kit, L = _.L, C = _.C, ctx = g.ctx, K = kit.K, u = L.u, D = kit.D;
    if (_.lead && t.b < _.lead) { kit.draw(g, _.LP, _.lead0, C, t.b, t.bq); return; }
    const b = t.b - _.lead, bq = t.bq - _.lead, sec = b * K, sq = bq * K, q = _.q, nF = _.built.length;
    /* camera: pitch eases down, the look-at point drops back to the centre, yaw drifts on */
    const cam = (x) => {
      const e = g.ease.inOutSine(g.clamp((x - 0.017 * q) / (0.6 * q)));
      return { pitch: L.tilt + (s.tilt - L.tilt) * e, yaw: _.yawEnd + L.drift * x, ppx: L.cx, ppy: L.cy - _.off0 * (1 - e) };
    };
    const c = cam(sec), v = kit.view(L, c);
    /* the floor the points leave from, still rippling */
    kit.heights(L, L.tauEnd + sec);
    L.hRef = kit.amp(L.tauEnd + sec);
    /* the forms, posed now: spin about their own axis, then oriented */
    const rot = spinAt(_.t0, q, sec);
    const E = _.t0.map((t0, k) => (k === 0 ? 0 : g.ease.outExpo(g.clamp((sec - t0) / _.dur[k]))));
    const mats = _.built.map((f) => mul(f.orient, ry((rot - f.spin0) * DEG)));
    let cur = 0;
    for (let k = 1; k < nF; k++) if (E[k] > 0) cur = k;
    const tE = _.tE, te = sec - tE, lk = _.lk, p = _.bx;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let k = 0; k < _.N; k++) {
      /* from the floor to form 1, with the vortex; then form to form */
      const e0 = g.ease.outExpo(g.clamp((sec - _.delay[k] * q) / _.dur[0])), sl = _.perm[k];
      const fx = L.x[k], fy = 110 * L.h[k], fz = L.z[k];
      apply(mats[0], _.built[0].pts, sl, p);
      let tx = p[0], ty = p[1], tz = p[2];
      if (e0 < 1) {
        /* a vortex: radius and angle about the vertical interpolate (the angle turning about SW), height later */
        const r0 = Math.hypot(fx, fz), r1 = Math.hypot(tx, tz), a0 = Math.atan2(-fz, fx), a1 = Math.atan2(-tz, tx);
        let da = a1 - a0 - SW * DEG;
        da -= TAU * Math.round(da / TAU);
        const a = a0 + e0 * (da + SW * DEG), rr = r0 + (r1 - r0) * e0;
        tx = rr * Math.cos(a); tz = -rr * Math.sin(a); ty = fy + (ty - fy) * e0 ** 4; /* it swirls flat first, then inflates */
      }
      for (let f = 1; f <= cur; f++) {
        apply(mats[f], _.built[f].pts, sl, p);
        tx += (p[0] - tx) * E[f]; ty += (p[1] - ty) * E[f]; tz += (p[2] - tz) * E[f];
      }
      if (te > 0.008) { const x = te - 0.008, m = 1 + (4.5 * x + 150 * x * x) * _.burst[k]; tx *= m; ty *= m; tz *= m; }
      const depth = kit.project(L, v, k, tx, ty, tz);
      L.Z[k] = depth;
      /* look: the floor's (wave colours, perspective size) blending into the cloud's (own colour, depth shading) */
      kit.look(L, k, lk);
      const latR = ((4.6 * u * D) / Math.max(1, depth)) * lk[0], latA = lk[2] * g.clamp(1.6 - (0.6 * depth) / D, 0.45, 1);
      const front = g.clamp(0.5 - (depth - D) / 880);
      let cr = (2.4 + 3.6 * front) * u, ca = 0.5 + 0.5 * front;
      if (depth < D - 440) { const grow = ((D - 440) / Math.max(40, depth)) ** 1.5; cr *= grow; ca /= Math.sqrt(grow); }
      const w = e0;
      L.R[k] = depth > 30 ? latR + (cr - latR) * w : 0;
      const col = w < 0.35 ? lk[1] : _.own[k] && sec >= _.seen[k] ? _.own[k] : 0;
      L.St[k] = kit.style(col, latA + (ca - latA) * w);
      if (depth > 30 && te < 0) { const X = L.X[k], Y = L.Y[k]; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; }
    }
    kit.dots(ctx, L, _.N, C.styles);
    const ink = C.ink;

    /* the burst (from the frame it lands on): shock rings for a frame or so, the dot at the centre */
    const tq = sq - tE;
    if (tq >= 0) {
      const ra = 0.22 * (1 - tq / 0.03);
      if (ra > 0) { for (let n = 0; n < 6; n++) g.ring(c.ppx, c.ppy, (82 + 96 * n + 1500 * Math.max(0, te)) * u, ink, 3, ra); }
      const dr = _.dotR(Math.max(0, te)) * u;
      if (dr > 0.3) {
        const gr = ctx.createRadialGradient(c.ppx, c.ppy, dr * 0.6, c.ppx, c.ppy, dr * 1.25), dc = g.col(s.dot);
        gr.addColorStop(0, dc); gr.addColorStop(1, g.rgba(dc, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c.ppx, c.ppy, dr * 1.25, 0, TAU); ctx.fill();
      }
    }

    /* the bounding box with its handles, knob and labels (hidden from the frame the burst starts) */
    const boxA = g.smoothstep(0.2 * q, 0.27 * q, sec) * (sq < tE ? 1 : 0);
    const fi = Math.max(0, _.t0.reduce((a, t0, k) => (k > 0 && sq >= t0 + 0.012 * q ? k : a), 0));
    const nq = Math.round(_.N), rotQ = spinAt(_.t0, q, sq);
    if (boxA > 0.002 && x1 > x0) {
      const pad = 20 * u, bx0 = x0 - pad, bx1 = x1 + pad, by0 = y0 - pad, by1 = y1 + pad, mx = (bx0 + bx1) / 2, my = (by0 + by1) / 2;
      ctx.save(); ctx.globalAlpha *= boxA;
      ctx.strokeStyle = g.rgba(ink, 0.6); ctx.lineWidth = 1.2; ctx.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
      ctx.beginPath(); ctx.moveTo(mx, by0); ctx.lineTo(mx, by0 - 19 * u); ctx.stroke();
      ctx.beginPath(); ctx.arc(mx, by0 - 19 * u - 5.5, 5.5, 0, TAU); ctx.stroke();
      ctx.fillStyle = g.col(s.bg); ctx.strokeStyle = g.rgba(ink, 0.7);
      for (const [hx, hy] of [[bx0, by0], [mx, by0], [bx1, by0], [bx1, my], [bx1, by1], [mx, by1], [bx0, by1], [bx0, my]]) { ctx.fillRect(hx - 5, hy - 5, 10, 10); ctx.strokeRect(hx - 5, hy - 5, 10, 10); }
      const lx = Math.max(g.box.x + 27.5, bx0), ly = Math.min(by1, g.box.b - 110);
      const vars = { n: nq, name: _.names[fi], note: _.notes[fi], rot: kit.deg(rotQ, 3) };
      g.text(kit.fill(s.mesh, vars), lx, ly + 46.5, { kind: "mono", size: 18, weight: 600, track: 2.2, color: ink, alpha: 0.82 });
      g.text(kit.fill(s.meta, vars), lx, ly + 71.5, { kind: "mono", size: 16, weight: 400, track: 1.9, color: ink, alpha: 0.53 });
      g.text(kit.fill(s.rot, vars), g.box.r - 29.5, ly + 71.5, { kind: "mono", size: 16, weight: 400, track: 1.9, color: ink, alpha: 0.53, align: "right" });
      ctx.restore();
    }

    /* gizmo and panel: numbers from the frame's own beat, so every blur sample reads the same */
    const pa = g.clamp(1 - (sec - tE - 0.012) / 0.025);
    kit.gizmo(g, v, ink, C.acc, pa, _.LP.axes || s.axes);
    const cq = cam(sq), vars = { n: nq, name: sq >= tE ? s.explode : _.names[fi], pitch: kit.deg(cq.pitch, 2), yaw: kit.deg(cq.yaw, 3), t: (bq * t.spb).toFixed(3) };
    kit.panel(g, ink, [s.title, kit.fill(s.count, vars), kit.fill(s.cam, vars), kit.fill(s.clock, vars)], pa);
  },
});

const wrap = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
/* the spin (degrees): steady until the second form, then a decaying kick per later form */
function spinAt(t0, q, x) {
  if (t0.length < 2) return 86 * x;
  let r = 86 * Math.min(x, t0[1] - 0.005 * q);
  for (let k = 1; k < t0.length; k++) {
    const [deg, rate] = KICKS[Math.min(k - 1, KICKS.length - 1)], d = x - (t0[k] - 0.005 * q);
    if (d > 0) r += deg * (1 - Math.exp((-rate * d) / q));
  }
  return r;
}

/* 3×3 rotations (row-major) and helpers */
function rx(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }
function ry(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
function rz(a) { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; }
function mul(A, B) {
  const o = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
  return o;
}
function apply(M, P, k, out) {
  const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2];
  out[0] = M[0] * x + M[1] * y + M[2] * z; out[1] = M[3] * x + M[4] * y + M[5] * z; out[2] = M[6] * x + M[7] * y + M[8] * z;
}

/*
 * A form as N points in grid order (k = j·cols + i, so neighbours stay neighbours), world units
 * (Y up), with its orientation, the spin it is posed at, and its default note.
 */
function form(g, f, cols, rows, n, cam, spinRef) {
  const N = cols * rows, pts = new Float32Array(N * 3), set = (k, x, y, z) => { pts[k * 3] = x; pts[k * 3 + 1] = y; pts[k * 3 + 2] = z; };
  /* the pose that faces the camera (local +Y its up, -Z toward it): undo its yaw, lean back by its elevation */
  const face = mul(ry(cam.yaw * DEG), rx((90 - cam.pitch) * DEG));
  if (f === "sphere") {
    /* a golden-spiral sphere (even, no visible poles), cut into cols bands top to bottom and ordered by longitude within each */
    for (let i = 0; i < cols; i++) {
      const band = [];
      for (let j = 0; j < rows; j++) { const m = i * rows + j, y = 1 - (2 * (m + 0.5)) / N, a = (m * 2.399963) % TAU; band.push([y, a]); }
      band.sort((A, B) => A[1] - B[1]).forEach(([y, a], j) => { const r = Math.sqrt(1 - y * y); set(j * cols + i, 440 * r * Math.cos(a), 440 * y, 440 * r * Math.sin(a)); });
    }
    return { pts, orient: mul(face, rx(20 * DEG)), spin0: spinRef, note: "R=440" }; /* the pole just behind the top rim */
  }
  if (f === "torus") {
    for (let k = 0; k < N; k++) {
      const i = k % cols, j = Math.floor(k / cols), a = (TAU * j) / rows, b = (TAU * i) / cols, rr = 335 + 105 * Math.cos(b);
      set(k, rr * Math.cos(a), 105 * Math.sin(b), rr * Math.sin(a));
    }
    return { pts, orient: rx(22 * DEG), spin0: 0, note: "R=335 r=105" };
  }
  if (f === "cube") {
    const V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
    /* consecutive points share an edge (about 4 rows of the grid each), so a morph into it moves in bundles */
    const Ed = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4]], per = N / 12;
    for (let k = 0; k < N; k++) {
      const e = Math.min(11, Math.floor(k / per)), [a, b] = Ed[e], t = (k - e * per + 0.5) / per, jit = () => (g.hash(k, 21 + jit.n++) - 0.5) * 12;
      jit.n = 0;
      set(k, 245 * (V[a][0] + (V[b][0] - V[a][0]) * t) + jit(), 245 * (V[a][1] + (V[b][1] - V[a][1]) * t) + jit(), 245 * (V[a][2] + (V[b][2] - V[a][2]) * t) + jit());
    }
    return { pts, orient: mul(face, mul(rz(22 * DEG), mul(rx(-22 * DEG), ry(24 * DEG)))), spin0: spinRef, note: "a=490" };
  }
  if (f === "helix") {
    for (let k = 0; k < N; k++) {
      const s = Math.floor(k / 2) / Math.max(1, Math.floor(N / 2) - 1), a = s * TAU * 4 + (k % 2) * Math.PI;
      set(k, 260 * Math.cos(a), 900 * s - 450, 260 * Math.sin(a));
    }
    return { pts, orient: rx(12 * DEG), spin0: 0, note: "TURNS 4" };
  }
  /* any shape: its outline (60% of the points) at the front of a slab and again (40%) at the back, facing the camera at the end */
  const nA = Math.round(N * 0.6), S = 480, Z = 40;
  const front = g.points(f, nA, { seed: 9 + n, edge: true }), back = g.points(f, N - nA, { seed: 13 + n, edge: true });
  const byAngle = (A, B) => Math.atan2(A[1], A[0]) - Math.atan2(B[1], B[0]);
  front.sort(byAngle); back.sort(byAngle);
  let k = 0;
  for (let m = 0; m < nA; m++) { const q = front[m] || front[m % Math.max(1, front.length)] || [0, 0]; set(k++, q[0] * S, -q[1] * S, -Z); }
  for (let m = 0; k < N; m++) { const q = back[m] || front[m % Math.max(1, front.length)] || [0, 0]; set(k++, q[0] * S, -q[1] * S, Z); }
  return { pts, orient: face, spin0: spinRef, note: `EXTRUDE ${2 * Z}` };
}
})();
