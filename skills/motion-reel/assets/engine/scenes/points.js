/*
 * Points: any 3D object as a cloud of points, and the moves you give it. The flexible point
 * cloud: where the original's cloud plays one routine (floor → sphere → torus → cube → burst),
 * this one plays your steps, in your order, on your objects.
 *
 *   steps: [
 *     { form: "crystal", move: "assemble", from: "dot", beats: 2 },   points fly out of the dot into a crystal
 *     { move: "tremble", amp: [0, 0.05], heat: [0, 0.4], beats: 2 },   it shakes harder as it heats up
 *     { form: "cube", beats: 1 },                                       snaps into an ice cube
 *     { move: "melt", beats: 2 },                                       slumps into a puddle on the floor
 *     { move: "boil", beats: 2, heat: 1 },                              boils off, filling the frame
 *   ]
 *
 * Step options: form (a form below; with no move it morphs into it), move, beats (scaled so the
 * steps fill the scene), ease, stagger (0..1 of the step: the points start one after another,
 * ordered by: "y" bottom first, "-y" top first, "radius" centre out, "random", "index"), swirl
 * (degrees the points turn round the vertical on the way), heat (the share of points in the
 * accent, a number or [from, to]), amp (tremble: [from, to] in form units), cam ({ yaw, pitch,
 * dist } reached by the step's end), turn (extra degrees of orbit over the step), from (assemble:
 * "dot", "gas" or a form).
 *
 * Moves: morph (to the step's form), assemble (into it, from "dot" / "gas" / a form), hold,
 * tremble, melt (slump onto the floor and spread), boil (rise and fill the frame), explode
 * (blast outward), implode (into the centre: the dot it hands on), wave (a ripple out from the
 * centre), scatter (to gas).
 *
 * Forms (about unit size, y up): sphere, cube (its faces), crystal (a cubic lattice), torus,
 * knot (a trefoil tube; "knot-p-q" for others), mobius, klein (the bottle), helix (a double
 * helix with rungs), shell (a seashell spiral), galaxy, cone, cylinder, ring, plane (a flat
 * grid), lattice (a floor of dots), gas (filling the frame), puddle (a pool on the floor), dot,
 * text:WORD (thick letters), any 2D shape spec (svg { d, view }, star-5 …: extruded), or
 * { lathe: [[r, y], …] } (a profile turned round the vertical: a vase, a bulb, a bottle).
 * Every form is laid out bottom to top and round, so the points of one land near the same
 * points of the next: morphs flow instead of scrambling.
 */
(() => {
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;

Reel.scene("points", {
  label: "3D POINTS",
  bg: "cool",
  beats: 4,
  shutter: 1, /* the morphs and blasts streak the whole frame long */
  params: {
    n: 2400, /* points */
    steps: [
      { form: "sphere", move: "assemble", from: "dot", beats: 1.2 },
      { form: "torus", beats: 0.9, swirl: 120 },
      { form: "knot", beats: 0.9, swirl: -90 },
      { move: "explode", beats: 1 },
    ], /* the moves, in order (see above) */
    color: "paper", /* the points' colour (role) */
    accent: "accent", /* the colour heat turns them */
    heat: 0.06, /* the share of points in the accent to begin with */
    dot: 3.2, /* a point's radius, px, at the centre's depth */
    yaw: -28, /* the camera: degrees round the vertical */
    pitch: 22, /* … and above the horizon */
    dist: 4.2, /* … and its distance, in form units */
    fov: 34,
    spin: 22, /* the steady orbit, degrees per second */
    size: 1, /* the form's size, 1 ≈ the stage */
    floor: false, /* a faint floor grid under the form (melts land on it) */
    glow: false, /* add the points' light together (on a dark ground they glow where they crowd) */
    panel: ["POINTS / {form}", "N={n}  {move}", "YAW {yaw}°  PITCH {pitch}°", "t={t}s"], /* the top-left readout (case kept): {form} {move} {n} {yaw} {pitch} {t} {heat} */
    names: null, /* the readout's name per step's form, e.g. ["CRYSTAL", "ICE", "WATER", "VAPOUR"]; default from the forms */
  },
  prepare(s, g) {
    const N = Math.max(8, Math.round(s.n)), st = g.stage;
    const steps = [].concat(s.steps || []).filter(Boolean).map((x) => Object.assign({}, x));
    if (!steps.length) steps.push({ form: "sphere", move: "hold" });
    /* the steps fill the scene */
    const tot = steps.reduce((a, x) => a + (x.beats ?? 1), 0) || 1;
    let at = 0;
    for (const x of steps) { x.len = ((x.beats ?? 1) / tot) * s.beats; x.at = at; at += x.len; x.move = x.move || (x.form ? "morph" : "hold"); }
    /* per point: random numbers it keeps */
    const r1 = new Float32Array(N), r2 = new Float32Array(N), r3 = new Float32Array(N);
    for (let i = 0; i < N; i++) { r1[i] = g.hash(i, 1); r2[i] = g.hash(i, 2); r3[i] = g.hash(i, 3); }
    const forms = new Map(), formOf = (f) => { const key = typeof f === "string" ? f : JSON.stringify(f); if (!forms.has(key)) forms.set(key, makeForm(g, f, N)); return forms.get(key); };
    const GAS = formOf("gas"), DOT = formOf("dot");
    /* where every step starts: the end of the one before */
    const P0 = [];
    let cur = steps[0].form && steps[0].move !== "assemble" ? formOf(steps[0].form) : DOT;
    let heat = typeof steps[0].heat === "number" ? steps[0].heat : Array.isArray(steps[0].heat) ? steps[0].heat[0] : s.heat;
    const cams = [];
    let cam = { yaw: s.yaw, pitch: s.pitch, dist: s.dist, turn: 0 };
    const ctx = { g, N, r1, r2, r3, GAS, DOT, formOf, s };
    steps.forEach((x, k) => {
      if (x.move === "assemble") cur = x.from ? (x.from === "gas" ? GAS : x.from === "dot" ? DOT : formOf(x.from)) : DOT;
      x.target = x.form ? formOf(x.form) : x.move === "scatter" ? GAS : null;
      x.order = order(x, cur, N, r1);
      x.h0 = Array.isArray(x.heat) ? x.heat[0] : heat; x.h1 = Array.isArray(x.heat) ? x.heat[1] : typeof x.heat === "number" ? x.heat : heat; heat = x.h1;
      x.c0 = Object.assign({}, cam); cam = { yaw: x.cam?.yaw ?? cam.yaw, pitch: x.cam?.pitch ?? cam.pitch, dist: x.cam?.dist ?? cam.dist, turn: cam.turn + (x.turn || 0) }; x.c1 = Object.assign({}, cam);
      P0.push(cur);
      const out = new Float32Array(N * 3);
      move(ctx, x, 1, cur, out, (x.at + x.len) * g.R.spb * s.slow);
      cur = out;
      cams.push(cam);
    });
    const names = steps.map((x, k) => String((s.names && s.names[k]) ?? (x.form ? formName(x.form) : null) ?? ""));
    for (let k = 1; k < names.length; k++) if (!names[k]) names[k] = names[k - 1];
    return { N, steps, P0, ctx, names, buf: new Float32Array(N * 3), anchor: [st.cx, st.cy], anchorR: 0 };
  },
  draw(g, s, t) {
    const _ = s._, ctx = g.ctx, st = g.stage, N = _.N, b = clamp(t.b, 0, s.beats - 1e-6), sec = t.sec;
    let k = 0;
    while (k < _.steps.length - 1 && b >= _.steps[k].at + _.steps[k].len) k++;
    const x = _.steps[k], u = clamp((b - x.at) / x.len), P = _.buf;
    move(_.ctx, x, u, _.P0[k], P, sec);
    /* the camera: the step's targets, eased over the step, and the steady orbit */
    const ce = g.ease.inOutCubic(u);
    const yaw = (lerp(x.c0.yaw, x.c1.yaw, ce) + lerp(x.c0.turn, x.c1.turn, ce) + s.spin * sec) * DEG, pitch = lerp(x.c0.pitch, x.c1.pitch, ce) * DEG, dist = lerp(x.c0.dist, x.c1.dist, ce);
    const cy_ = Math.cos(yaw), sy_ = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const unit = st.min * 0.42 * s.size, cx = st.cx, cyS = st.cy, heat = lerp(x.h0, x.h1, u);
    const base = g.col(s.color), acc = g.col(s.accent), dotR = s.dot;
    /* the floor */
    if (s.floor) {
      ctx.save(); ctx.strokeStyle = g.rgba(base, 0.13); ctx.lineWidth = 1; ctx.beginPath();
      const pr = (X, Y, Z) => { const Xr = X * cy_ + Z * sy_, Z1 = -X * sy_ + Z * cy_, Y2 = Y * cp + Z1 * sp, Z2 = -Y * sp + Z1 * cp, d = dist + Z2; return d > 0.15 ? [cx + (Xr * s.dist * unit) / d, cyS - (Y2 * s.dist * unit) / d] : null; };
      for (let i = -6; i <= 6; i++) for (const [a0, a1] of [[[i * 0.4, -1, -2.4], [i * 0.4, -1, 2.4]], [[-2.4, -1, i * 0.4], [2.4, -1, i * 0.4]]]) {
        const p0 = pr(...a0), p1 = pr(...a1); if (p0 && p1) { ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); }
      }
      ctx.stroke(); ctx.restore();
    }
    /* project, and bucket by depth and colour: far buckets first */
    const NB = 8, paths = Array.from({ length: NB * 2 }, () => new Path2D()), dmin = dist - 1.6, dmax = dist + 1.6;
    for (let i = 0; i < N; i++) {
      const X = P[i * 3], Y = P[i * 3 + 1], Z = P[i * 3 + 2];
      const Xr = X * cy_ + Z * sy_, Z1 = -X * sy_ + Z * cy_, Y2 = Y * cp + Z1 * sp, Z2 = -Y * sp + Z1 * cp, d = dist + Z2;
      if (d < 0.12) continue;
      const k2 = s.dist / d, sx = cx + Xr * unit * k2, sy = cyS - Y2 * unit * k2; /* from the scene's own distance: a camera that moves in sees it grow */
      if (sx < -60 || sx > g.W + 60 || sy < -60 || sy > g.H + 60) continue;
      const bkt = Math.min(NB - 1, Math.max(0, Math.floor(((d - dmin) / (dmax - dmin)) * NB))), hot = _.ctx.r3[i] < heat ? 1 : 0;
      const r = Math.min(40, dotR * k2 * (0.75 + 0.5 * _.ctx.r2[i]));
      const path = paths[(NB - 1 - bkt) * 2 + hot];
      path.moveTo(sx + r, sy); path.arc(sx, sy, r, 0, TAU);
    }
    ctx.save();
    if (s.glow) ctx.globalCompositeOperation = "lighter";
    for (let q = 0; q < NB; q++) {
      const near = q / (NB - 1), a = (0.28 + 0.72 * near ** 1.2) * (s.glow ? 0.75 : 1);
      ctx.fillStyle = g.rgba(base, a); ctx.fill(paths[q * 2]);
      ctx.fillStyle = g.rgba(acc, Math.min(1, a + 0.15)); ctx.fill(paths[q * 2 + 1]);
    }
    ctx.restore();
    /* the readout, from the frame's own beat so the blur samples agree */
    const ink = g.on(s.bg), kq = (() => { let j = 0; while (j < _.steps.length - 1 && t.bq >= _.steps[j].at + _.steps[j].len) j++; return j; })();
    const vars = { form: _.names[kq], move: _.steps[kq].move.toUpperCase(), n: N, yaw: ((((yaw / DEG) % 360) + 360) % 360).toFixed(1), pitch: (pitch / DEG).toFixed(1), t: (t.bq * t.spb).toFixed(2), heat: Math.round(heat * 100) };
    const lines = [].concat(s.panel || []).map((l) => String(l).replace(/\{(\w+)\}/g, (m, k3) => (k3 in vars ? vars[k3] : m)));
    const fade = g.smoothstep(0.02, 0.18, t.b) * (1 - g.smoothstep(s.beats - 0.25, s.beats - 0.05, t.b));
    if (fade > 0.002) lines.forEach((str, i) => { if (str) g.text(str, g.box.x + 27.5, g.box.y + 63.5 + i * 23.7 * g.grow(16), { kind: "mono", size: 16, weight: i ? 400 : 600, track: 1.9, color: ink, alpha: fade * (i ? 0.53 : 0.82) }); });
    _.anchor = [cx, cyS];
  },
});

/* the order the points start in, for a staggered step: 0 first … 1 last */
function order(x, A, N, r1) {
  const o = new Float32Array(N), by = x.by || (x.move === "melt" ? "-y" : x.move === "boil" ? "random" : x.move === "assemble" ? "radius" : "y");
  if (by === "random") { for (let i = 0; i < N; i++) o[i] = r1[i]; return o; }
  if (by === "index") { for (let i = 0; i < N; i++) o[i] = i / N; return o; }
  let lo = Infinity, hi = -Infinity;
  const v = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const X = A[i * 3], Y = A[i * 3 + 1], Z = A[i * 3 + 2];
    v[i] = by === "radius" ? Math.hypot(X, Y, Z) : by === "-y" ? -Y : Y;
    if (v[i] < lo) lo = v[i]; if (v[i] > hi) hi = v[i];
  }
  for (let i = 0; i < N; i++) o[i] = hi > lo ? (v[i] - lo) / (hi - lo) : r1[i];
  return o;
}

/* a step at u (0..1) from A into out; sec is the scene's own clock (tremble and wave run on it) */
function move(C, x, u, A, out, sec) {
  const { g, N, r1, r2, r3, GAS } = C, T = x.target, S = clamp(x.stagger ?? (x.move === "melt" ? 0.45 : x.move === "boil" ? 0.6 : x.move === "assemble" ? 0.3 : 0.18), 0, 0.95);
  const E = g.ease[x.ease || (x.move === "melt" ? "inQuad" : x.move === "boil" ? "inOutSine" : x.move === "explode" ? "inQuad" : x.move === "implode" ? "inExpo" : "outExpo")] || g.ease.outExpo;
  const p = (i) => clamp((u - S * x.order[i]) / (1 - S));
  const noise = g.noise3;
  switch (x.move) {
    case "morph": case "assemble": case "scatter": {
      const B = T || A, sw = (x.swirl || 0) * DEG;
      for (let i = 0; i < N; i++) {
        const e = E(p(i)), j = i * 3;
        let X = lerp(A[j], B[j], e), Y = lerp(A[j + 1], B[j + 1], e), Z = lerp(A[j + 2], B[j + 2], e);
        if (sw) { const a = sw * 4 * e * (1 - e), c = Math.cos(a), s2 = Math.sin(a); [X, Z] = [X * c + Z * s2, -X * s2 + Z * c]; }
        out[j] = X; out[j + 1] = Y; out[j + 2] = Z;
      }
      return;
    }
    case "tremble": {
      const [a0, a1] = [].concat(x.amp ?? [0, 0.06]).concat([0.06]), amp = lerp(a0, a1 ?? a0, u), w = x.speed ?? 9;
      for (let i = 0; i < N; i++) {
        const j = i * 3, q = i * 0.731;
        out[j] = A[j] + amp * noise(q, sec * w, 0.5); out[j + 1] = A[j + 1] + amp * noise(q, sec * w, 7.3); out[j + 2] = A[j + 2] + amp * noise(q, sec * w, 13.9);
      }
      return;
    }
    case "melt": {
      /* fall onto the floor (accelerating), then run out into a round pool, rippling as it settles:
         each point keeps its bearing and finds its own place in the pool */
      const floor = x.floor ?? -1, R = x.spread ?? 1.6;
      for (let i = 0; i < N; i++) {
        const j = i * 3, q = p(i), fall = E(clamp(q / 0.62)), sp = g.ease.outCubic(clamp((q - 0.3) / 0.7));
        const X = A[j], Z = A[j + 2], a = Math.atan2(Z, X), wob = 1 + 0.12 * Math.sin(a * 5 + 1.7) + 0.07 * Math.sin(a * 9 - 0.4);
        const rr = R * Math.sqrt(r2[i]) * wob, tx = rr * Math.cos(a), tz = rr * Math.sin(a);
        out[j] = lerp(X, tx, sp); out[j + 2] = lerp(Z, tz, sp);
        out[j + 1] = lerp(A[j + 1], floor + 0.035 * r3[i] + 0.025 * Math.sin(rr * 8 - sec * 7) * sp, fall);
      }
      return;
    }
    case "boil": {
      /* each point leaves in its own time: it rises, wanders and spreads to fill the frame */
      for (let i = 0; i < N; i++) {
        const j = i * 3, q = p(i), e = E(q), lift = Math.sin(Math.PI * q);
        out[j] = lerp(A[j], GAS[j], e) + 0.25 * lift * noise(i * 0.37, sec * 1.6, 2.1);
        out[j + 1] = lerp(A[j + 1], Math.abs(GAS[j + 1]) * 1.15 - 0.6, e) + 0.55 * lift + 0.2 * lift * noise(i * 0.37, sec * 1.6, 5.7);
        out[j + 2] = lerp(A[j + 2], GAS[j + 2], e) + 0.25 * lift * noise(i * 0.37, sec * 1.6, 9.3);
      }
      return;
    }
    case "explode": {
      for (let i = 0; i < N; i++) {
        const j = i * 3, e = E(p(i)), m = 1 + (x.power ?? 1) * (2.5 * e + 9 * e * e) * (0.3 + 1.4 * r1[i]);
        out[j] = A[j] * m; out[j + 1] = A[j + 1] * m; out[j + 2] = A[j + 2] * m;
      }
      return;
    }
    case "implode": {
      for (let i = 0; i < N; i++) { const j = i * 3, e = 1 - E(p(i)); out[j] = A[j] * e; out[j + 1] = A[j + 1] * e; out[j + 2] = A[j + 2] * e; }
      return;
    }
    case "wave": {
      const amp = (x.amp ?? 0.12) * Math.sin(Math.PI * u), fr = x.freq ?? 7;
      for (let i = 0; i < N; i++) {
        const j = i * 3, r = Math.hypot(A[j], A[j + 1], A[j + 2]) || 1e-6, k = 1 + (amp * Math.sin(r * fr - u * TAU * 2)) / r;
        out[j] = A[j] * k; out[j + 1] = A[j + 1] * k; out[j + 2] = A[j + 2] * k;
      }
      return;
    }
    default: out.set(A);
  }
}

function formName(f) {
  if (typeof f === "string") { if (f.startsWith("text:")) return f.slice(5).toUpperCase(); const m = f.match(/^[a-z]+/); return m ? m[0].toUpperCase() : "FORM"; }
  return f && f.lathe ? "LATHE" : "FORM";
}

/* ---------------------------------------------------------------- forms */

function makeForm(g, f, N) {
  const pts = new Float32Array(N * 3), set = (i, x, y, z) => { pts[i * 3] = x; pts[i * 3 + 1] = y; pts[i * 3 + 2] = z; };
  const H = (i, k) => g.hash(i, k), grid = (n) => { const a = Math.max(2, Math.round(Math.sqrt(N / n))); return [a, Math.ceil(N / a)]; };
  let world = false, sorted = false;
  const name = typeof f === "string" ? f : null;
  const [kind, ...args] = name ? name.split(/[-:]/) : [null];
  if (name === "sphere") for (let i = 0; i < N; i++) { const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), a = i * 2.399963; set(i, r * Math.cos(a), y, r * Math.sin(a)); }
  else if (name === "cube") {
    /* its six faces, a grid on each */
    const per = Math.ceil(N / 6), m = Math.ceil(Math.sqrt(per));
    for (let i = 0; i < N; i++) {
      const fc = Math.min(5, Math.floor(i / per)), l = i - fc * per, a = ((l % m) + 0.5) / m * 2 - 1, b = (Math.floor(l / m) + 0.5) / m * 2 - 1, ax = fc >> 1, sg = fc & 1 ? 1 : -1;
      const v = [0, 0, 0]; v[ax] = sg; v[(ax + 1) % 3] = a; v[(ax + 2) % 3] = b; set(i, v[0] * 0.78, v[1] * 0.78, v[2] * 0.78);
    }
  } else if (name === "crystal") {
    const m = Math.max(2, Math.round(Math.cbrt(N)));
    for (let i = 0; i < N; i++) { const l = i % (m * m * m), a = l % m, b = Math.floor(l / m) % m, c = Math.floor(l / (m * m)); set(i, ((a / (m - 1)) * 2 - 1) * 0.72, ((c / (m - 1)) * 2 - 1) * 0.72, ((b / (m - 1)) * 2 - 1) * 0.72); }
    sorted = true;
  } else if (name === "torus") {
    const [a, b] = grid(1.6);
    for (let i = 0; i < N; i++) { const u = ((i % b) / b) * TAU, v = (Math.floor(i / b) / a) * TAU, R = 0.72 + 0.28 * Math.cos(v); set(i, R * Math.cos(u), 0.28 * Math.sin(v), R * Math.sin(u)); }
  } else if (kind === "knot") {
    const P = +args[0] || 2, Q = +args[1] || 3, ring = 10, segs = Math.ceil(N / ring);
    const c = (s2) => { const r = Math.cos(Q * s2) + 2; return [r * Math.cos(P * s2), -Math.sin(Q * s2), r * Math.sin(P * s2)]; };
    for (let i = 0; i < N; i++) {
      const sg = Math.floor(i / ring), q = (sg / segs) * TAU, a = ((i % ring) / ring) * TAU, p0 = c(q), p1 = c(q + 0.01);
      const tg = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], tl = Math.hypot(...tg); tg[0] /= tl; tg[1] /= tl; tg[2] /= tl;
      let nx = -tg[2], nz = tg[0], ny = 0; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; nz /= nl;
      const bx = tg[1] * nz - tg[2] * ny, by = tg[2] * nx - tg[0] * nz, bz = tg[0] * ny - tg[1] * nx, w = 0.42;
      set(i, p0[0] + w * (Math.cos(a) * nx + Math.sin(a) * bx), p0[1] + w * (Math.cos(a) * ny + Math.sin(a) * by), p0[2] + w * (Math.cos(a) * nz + Math.sin(a) * bz));
    }
  } else if (name === "mobius") {
    const [a, b] = grid(4);
    for (let i = 0; i < N; i++) { const u = ((i % b) / b) * TAU, v = (Math.floor(i / b) / (a - 1) - 0.5) * 0.9, R = 1 + (v / 2) * Math.cos(u / 2); set(i, R * Math.cos(u), (v / 2) * Math.sin(u / 2) * 1.6, R * Math.sin(u)); }
  } else if (name === "klein") {
    const [a, b] = grid(1.2);
    for (let i = 0; i < N; i++) {
      const u = ((i % b) / b) * Math.PI, v = (Math.floor(i / b) / a) * TAU, cu = Math.cos(u), su = Math.sin(u), cv = Math.cos(v), sv = Math.sin(v);
      const x = -(2 / 15) * cu * (3 * cv - 30 * su + 90 * cu ** 4 * su - 60 * cu ** 6 * su + 5 * cu * cv * su);
      const y = -(1 / 15) * su * (3 * cv - 3 * cu ** 2 * cv - 48 * cu ** 4 * cv + 48 * cu ** 6 * cv - 60 * su + 5 * cu * cv * su - 5 * cu ** 3 * cv * su - 80 * cu ** 5 * cv * su + 80 * cu ** 7 * cv * su);
      const z = (2 / 15) * (3 + 5 * cu * su) * sv;
      set(i, x, -y, z);
    }
  } else if (name === "helix" || name === "dna") {
    const strand = Math.floor(N * 0.7), rung = N - strand;
    for (let i = 0; i < strand; i++) { const q = Math.floor(i / 2) / Math.max(1, strand / 2 - 1), a = q * TAU * 2.2 + (i % 2) * Math.PI; set(i, 0.45 * Math.cos(a), q * 2 - 1, 0.45 * Math.sin(a)); }
    const R = 24;
    for (let i = 0; i < rung; i++) { const rk = i % R, q = (rk + 0.5) / R, a = q * TAU * 2.2, w = (Math.floor(i / R) / Math.max(1, Math.ceil(rung / R) - 1)) * 2 - 1; set(strand + i, 0.45 * w * Math.cos(a), q * 2 - 1, 0.45 * w * Math.sin(a)); }
  } else if (name === "shell") {
    const [a, b] = grid(3);
    for (let i = 0; i < N; i++) {
      const u = ((i % b) / b) * TAU * 3.2, v = (Math.floor(i / b) / a) * TAU, gr = Math.exp(0.16 * u) * 0.14, R = gr * (1.4 + Math.cos(v));
      set(i, R * Math.cos(u), gr * 1.6 * Math.sin(v) - u * gr * 0.5, R * Math.sin(u));
    }
  } else if (name === "galaxy") {
    for (let i = 0; i < N; i++) { const arm = i % 3, r = Math.sqrt(H(i, 4)) * 1.1, a = (arm / 3) * TAU + r * 4.2 + (H(i, 5) - 0.5) * 0.7; set(i, r * Math.cos(a), (H(i, 6) - 0.5) * 0.12 * (1.2 - r), r * Math.sin(a)); }
  } else if (name === "cone" || name === "cylinder") {
    const [a, b] = grid(2);
    for (let i = 0; i < N; i++) { const u = ((i % b) / b) * TAU, v = Math.floor(i / b) / (a - 1), r = name === "cone" ? 0.85 * (1 - v) : 0.6; set(i, r * Math.cos(u), v * 2 - 1, r * Math.sin(u)); }
  } else if (name === "ring") {
    for (let i = 0; i < N; i++) { const a = (i / N) * TAU * 7, w = (H(i, 4) - 0.5) * 0.08; set(i, (1 + w) * Math.cos(a / 7), w * 0.4, (1 + w) * Math.sin(a / 7)); }
  } else if (name === "plane" || name === "lattice") {
    const m = Math.ceil(Math.sqrt(N));
    for (let i = 0; i < N; i++) set(i, ((i % m) / (m - 1)) * 2 - 1, name === "lattice" ? -1 : 0, (Math.floor(i / m) / (m - 1)) * 2 - 1);
    world = name === "lattice";
  } else if (name === "gas") {
    for (let i = 0; i < N; i++) set(i, (H(i, 7) * 2 - 1) * 1.9, (H(i, 8) * 2 - 1) * 2.9, (H(i, 9) * 2 - 1) * 1.9);
    world = true;
  } else if (name === "puddle") {
    for (let i = 0; i < N; i++) { const r = Math.sqrt(H(i, 7)) * (1.5 + 0.2 * Math.sin(H(i, 8) * TAU * 5)), a = H(i, 8) * TAU; set(i, r * Math.cos(a), -1 + 0.03 * H(i, 9), r * Math.sin(a)); }
    world = true;
  } else if (name === "dot") { world = true; }
  else if (f && f.lathe) {
    const prof = f.lathe, segs = [];
    let len = 0;
    for (let k = 0; k < prof.length - 1; k++) { const l = Math.hypot(prof[k + 1][0] - prof[k][0], prof[k + 1][1] - prof[k][1]); segs.push(l); len += l; }
    const rows = Math.max(2, Math.round(Math.sqrt(N / 3))), per = Math.ceil(N / rows);
    for (let i = 0; i < N; i++) {
      let d = ((Math.floor(i / per) + 0.5) / rows) * len, k = 0;
      while (k < segs.length - 1 && d > segs[k]) { d -= segs[k]; k++; }
      const q = segs[k] ? d / segs[k] : 0, r = lerp(prof[k][0], prof[k + 1][0], q), y = lerp(prof[k][1], prof[k + 1][1], q), a = ((i % per) / per) * TAU + Math.floor(i / per) * 0.37;
      set(i, r * Math.cos(a), y, r * Math.sin(a));
    }
  } else {
    /* a word or a 2D shape: its face front and back, its edge round the sides */
    const m = solid(g, f);
    const nF = Math.round(N * 0.34), nB = Math.round(N * 0.24), nE = N - nF - nB, depth = 0.22;
    const inside = sample(m, nF + nB, 21, false), edge = sample(m, nE, 23, true);
    for (let i = 0; i < nF + nB; i++) { const q = inside[i % Math.max(1, inside.length)] || [0, 0]; set(i, q[0], q[1], i < nF ? depth : -depth); }
    for (let i = 0; i < nE; i++) { const q = edge[i % Math.max(1, edge.length)] || [0, 0]; set(nF + nB + i, q[0], q[1], (H(i, 31) * 2 - 1) * depth); }
  }
  if (!world) normalise(pts, N);
  if (!sorted && !world) canonical(pts, N);
  return pts;
}

/* centred, scaled so the farthest point is at 1 */
function normalise(P, N) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < N; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  let r = 0;
  for (let i = 0; i < N; i++) r = Math.max(r, Math.hypot(P[i * 3] - cx, P[i * 3 + 1] - cy, P[i * 3 + 2] - cz));
  r = r || 1;
  for (let i = 0; i < N; i++) { P[i * 3] = (P[i * 3] - cx) / r; P[i * 3 + 1] = (P[i * 3 + 1] - cy) / r; P[i * 3 + 2] = (P[i * 3 + 2] - cz) / r; }
}

/* bottom to top in bands, round the vertical within each: a shared order for every form */
function canonical(P, N) {
  const idx = Array.from({ length: N }, (_, i) => i).sort((a, b) => P[a * 3 + 1] - P[b * 3 + 1]);
  const band = Math.max(1, Math.round(Math.sqrt(N))), out = new Float32Array(N * 3);
  let k = 0;
  for (let a = 0; a < N; a += band) {
    const part = idx.slice(a, a + band).sort((p, q) => Math.atan2(P[p * 3 + 2], P[p * 3]) - Math.atan2(P[q * 3 + 2], P[q * 3]));
    for (const i of part) { out[k * 3] = P[i * 3]; out[k * 3 + 1] = P[i * 3 + 1]; out[k * 3 + 2] = P[i * 3 + 2]; k++; }
  }
  P.set(out);
}

/* a word or a shape as an alpha mask, its aspect kept: { w, h, a, at(x, y) } in -1..1 of its long side */
function solid(g, f) {
  const text = typeof f === "string" && f.startsWith("text:") ? f.slice(5) : null;
  const cv = document.createElement("canvas"), x = cv.getContext("2d", { willReadFrequently: true });
  if (text) {
    const size = 220, font = g.font("display", size);
    x.font = font; const w = Math.ceil(x.measureText(text).width) + 40, h = Math.ceil(size * 1.05);
    cv.width = w; cv.height = h; x.font = font; x.fillStyle = "#fff"; x.textBaseline = "middle"; x.textAlign = "center"; x.fillText(text, w / 2, h / 2 + size * 0.04);
  } else {
    cv.width = cv.height = 256; x.fillStyle = "#fff"; x.beginPath(); if (g.shapePath(f, x, 128, 128, 118) !== "filled") x.fill();
  }
  const W = cv.width, Hh = cv.height, d = x.getImageData(0, 0, W, Hh).data, a = new Uint8Array(W * Hh);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
  const L = Math.max(W, Hh);
  return { W, H: Hh, a, at: (u, v) => { const px = Math.floor(W / 2 + (u * L) / 2), py = Math.floor(Hh / 2 - (v * L) / 2); return px < 0 || py < 0 || px >= W || py >= Hh ? 0 : a[py * W + px] / 255; }, L };
}
function sample(m, n, seed, edge) {
  const out = [], r = (() => { let s2 = seed >>> 0; return () => ((s2 = (s2 * 1664525 + 1013904223) >>> 0) / 4294967296); })(), e = 2.5 / m.L;
  let guard = 0;
  while (out.length < n && guard++ < n * 600) {
    const u = (r() * 2 - 1) * (m.W / m.L), v = (r() * 2 - 1) * (m.H / m.L);
    if (m.at(u, v) < 0.5) continue;
    if (edge && m.at(u + e, v) > 0.5 && m.at(u - e, v) > 0.5 && m.at(u, v + e) > 0.5 && m.at(u, v - e) > 0.5) continue;
    out.push([u, v]);
  }
  return out;
}
})();
