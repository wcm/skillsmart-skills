/*
 * Lattice ripple. A top-down 3D floor of dots (32 × 50 = 1600) on the ground, an accent emitter
 * dot at the centre of the box, a beat-locked ripple and an orbit camera that tips the flat map
 * into a receding perspective floor. Everything is a closed-form function of the beat: each
 * pulse is a decaying radial wave h(r, age), the camera a pair of eased angles. The choreography
 * is written in the original's seconds (1 beat = 0.5405 s) and scales with the tempo.
 *   b 0.00       cut in on the emitter, big (r 87) and soft: the dot the scene before hands on.
 *                It springs 87 → 52 → 71 and fires pulse 1: a fast, decelerating ring of raised
 *                dots coloured by height (accent crest, a weaker sun crest behind it, small dim
 *                dots in the troughs), a faint ring on the floor at the front, 3 '+' marks.
 *   b 0.06–0.28  the panel (title + GRID / PITCH·YAW / WAVE, all live) and the axis gizmo fade in.
 *   b 0.08–1.79  the camera pitches 0 → 50° (in-out cubic) and yaws +25° (drift + ease):
 *                the floor recedes, the emitter rises 140 px with the look-at point.
 *   b 0.45–0.76  the emitter shrinks away (ease-in); its crosshair stays.
 *   b 1, 2, …    a pulse on every further beat: the emitter pops (r 39) and a new ring rolls
 *                across the tilted floor toward the camera. Wave amplitude and speed decay, and
 *                the colours with them: a later front reads sun, its trailing crests white.
 *   end          no cut: a cloud scene after it starts from exactly this floor and camera, and
 *                morphs the same points (its readouts take over on the beat).
 * The shared maths (floor, waves, camera, dot renderer, panel, gizmo) is Reel.lattice, used by
 * the cloud scene too.
 */
(() => {
const K = 0.5405; /* the original's seconds per beat */
const DEG = Math.PI / 180, TAU = Math.PI * 2;
/* world: S units between points, camera D units from the emitter, F px per unit at the emitter */
/* the wave: wavelength LAM, height HGT; the front R0 + R1(1 - e^(-KR·age)) px, FW px per unit (raised crests read 7% further out); P its shape (2 a circle, higher squarer) */
const S = 36, D = 1400, F = 1.075, LAM = 390, HGT = 110, R0 = 90, R1 = 1895, KR = 1.9, FW = F * 1.07, P = 2;
/* the emitter's radius (design px) over the first beat, in the original's seconds */
const EMIT = [[0, 87], [0.033, 52], [0.067, 58], [0.133, 71], [0.233, 60], [0.3, 43], [0.333, 31], [0.367, 16], [0.4, 0]];
const AL = 16; /* alpha steps of the dot styles */

/* monotone cubic through [t, v] keys (Fritsch–Carlson), clamped at both ends */
function monotone(keys) {
  const n = keys.length, x = keys.map((k) => k[0]), y = keys.map((k) => k[1]), m = new Array(n).fill(0), d = [];
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (x[i + 1] - x[i - 1])) / ((2 * x[i + 1] - x[i] - x[i - 1]) / d[i - 1] + (x[i + 1] + x[i] - 2 * x[i - 1]) / d[i]);
  m[0] = n > 1 ? d[0] : 0; m[n - 1] = n > 1 ? d[n - 2] : 0;
  return (t) => {
    if (t <= x[0]) return y[0];
    if (t >= x[n - 1]) return y[n - 1];
    let i = 0;
    while (t > x[i + 1]) i++;
    const h = x[i + 1] - x[i], s = (t - x[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * y[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * y[i + 1] + (s3 - s2) * h * m[i + 1];
  };
}
const fill = (str, vars) => String(str).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const deg = (v, int) => { const r = Math.round(v * 10) / 10; return (((r % 360) + 360) % 360).toFixed(1).padStart(int + 2, "0"); };

const kit = (Reel.lattice = {
  K, S, D, F, DEG, fill, deg, monotone,
  /* a floor: cols × rows points around the emitter, with everything the draw needs preallocated */
  floor(g, o) {
    const cols = Math.max(2, Math.round(o.cols)), rows = Math.max(2, Math.round(o.rows)), N = cols * rows;
    const x = new Float32Array(N), z = new Float32Array(N), r = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const i = k % cols, j = Math.floor(k / cols);
      x[k] = (i - (cols - 1) / 2) * S; z[k] = ((rows - 1) / 2 - j) * S; r[k] = (Math.abs(x[k]) ** P + Math.abs(z[k]) ** P) ** (1 / P); /* the front is a rounded square (an Lp circle) */
    }
    const B = Math.max(0.5, o.beats), tauEnd = B * K - 0.011;
    const pulses = [];
    for (let p = 0; p < Math.ceil(B - 1e-6); p++) pulses.push(p ? p * K + 0.01 : 0);
    const emit = [...EMIT];
    for (let p = 1; p < pulses.length; p++) emit.push([p * K - 0.024, 0], [p * K - 0.008, 39], [p * K + 0.05, 0]);
    const u = g.box.w / 987; /* design px per original px */
    return {
      cols, rows, N, x, z, r, B, tauEnd, pulses, emitR: monotone(emit), u, F: F * u,
      tilt: o.tilt ?? 50, yaw0: o.yaw ?? -5.3, turn: o.turn ?? 15, drift: o.drift ?? 10.1,
      cx: g.box.cx, cy: g.box.cy, lift: 140 * u,
      h: new Float32Array(N), c: new Float32Array(N), hRef: 1, X: new Float32Array(N), Y: new Float32Array(N), Z: new Float32Array(N), R: new Float32Array(N), St: new Uint16Array(N), idx: new Uint32Array(N),
    };
  },
  /* wave amplitude and speed readouts, tau seconds after the first pulse */
  amp: (tau) => 0.98 * Math.exp(-1.09 * Math.max(0, tau)),
  speed: (tau) => 3227 * Math.exp(-1.9 * Math.max(0, tau)),
  /* the camera of the lattice phase: pitch and yaw in degrees, the look-at point on screen */
  camAt(L, tau) {
    const x = Math.min(1, Math.max(0, (tau - 0.033) / Math.max(0.05, L.tauEnd - 0.137))), e = x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
    const pitch = L.tilt * e, yaw = L.yaw0 + L.drift * tau + L.turn * e;
    return { pitch, yaw, ppx: L.cx, ppy: L.cy - L.lift * Math.min(1, pitch / 30) };
  },
  /* the camera basis for projection */
  view(L, c) {
    const el = (90 - c.pitch) * DEG, a = c.yaw * DEG;
    return { se: Math.sin(el), ce: Math.cos(el), cy: Math.cos(a), sy: Math.sin(a), ppx: c.ppx, ppy: c.ppy, F: L.F * D };
  },
  /* world (Y up, floor in XZ, +Z far) → screen; returns the depth, writes x/y into L.X/L.Y[k] */
  project(L, v, k, x, y, z) {
    const xr = x * v.cy - z * v.sy, zr = x * v.sy + z * v.cy, up = y * v.ce + zr * v.se, depth = D - y * v.se + zr * v.ce, s = v.F / Math.max(1, depth);
    L.X[k] = v.ppx + xr * s; L.Y[k] = v.ppy - up * s;
    return depth;
  },
  /*
   * The floor at tau (seconds after pulse 1): heights of every pulse into L.h (an older pulse
   * calms as it ages), and the latest pulse alone into L.c (it picks the colours), scaled by the
   * decaying wave amplitude: the first front is accent, a later one only sun. A pulse's profile
   * behind its front: crest, trough, a weaker second crest; the trailing crests fade with age.
   */
  heights(L, tau) {
    const h = L.h, c = L.c, q = LAM / 4, live = L.pulses.filter((tp) => tau >= tp);
    h.fill(0); c.fill(0);
    live.forEach((tp, n) => {
      const age = tau - tp, Rw = kit.radius(tp, age), last = n === live.length - 1;
      const A = kit.amp(tp) * (last ? 1 : Math.exp(-0.6 * age)), env = kit.amp(tau) / kit.amp(0), tail = (0.9 + 2.5 * Math.max(0, age - 0.12)) / LAM;
      for (let k = 0; k < L.N; k++) {
        const d = Rw - L.r[k];
        if (d < -q) continue;
        let w = Math.cos((TAU * d) / LAM);
        if (d < 0) { const t = 1 + d / q; w *= t * t * (3 - 2 * t); }
        h[k] += A * w * Math.exp((-0.9 * d) / LAM);
        if (last) c[k] = w * env * Math.exp(-tail * Math.max(0, d));
      }
    });
    return live.length;
  },
  /* a floor point's size factor and style from its colour value (crest, mid, base, dim trough) */
  look(L, k, out) {
    const z = L.c[k], low = L.h[k] < -0.2 * L.hRef;
    if (z > 0.45) { out[0] = 1.7; out[1] = 1; out[2] = 1; }
    else if (z > 0.27) { out[0] = 1.35; out[1] = 2; out[2] = 1; }
    else if (low || z < -0.2) { out[0] = 0.65; out[1] = 0; out[2] = 0.6; }
    else { out[0] = 1; out[1] = 0; out[2] = 1; }
    return out;
  },
  /* a pulse's front (world units), age seconds after it fires: fast, decelerating; a weaker pulse starts as fast but stops sooner */
  radius: (tp, age) => { const s = kit.amp(tp) / kit.amp(0); return (R0 + R1 * s * (1 - Math.exp((-KR * age) / s))) / FW; },
  /* the front of the latest pulse (world units) and its age */
  front(L, tau) {
    let tp = null;
    for (const p of L.pulses) if (tau >= p) tp = p;
    return tp == null ? null : { R: kit.radius(tp, tau - tp), age: tau - tp };
  },
  /* fill styles: one per colour × AL alpha steps; style id = colour * AL + (alpha step) */
  styles(g, cols) {
    const out = [];
    for (const c of cols) for (let a = 0; a < AL; a++) out.push(g.rgba(c, (a + 1) / AL));
    return out;
  },
  style: (c, alpha) => c * AL + Math.max(0, Math.min(AL - 1, Math.round(alpha * AL) - 1)),
  /* the first n points in L.X/Y/R/St drawn far to near (L.Z = depth), batched by style */
  dots(ctx, L, n, styles) {
    const idx = L.idx, Z = L.Z, X = L.X, Y = L.Y, R = L.R, St = L.St;
    let m = 0;
    for (let k = 0; k < n; k++) if (R[k] > 0.05 && Z[k] > 1) idx[m++] = k;
    const order = idx.subarray(0, m).sort((a, b) => Z[b] - Z[a]);
    let cur = -1;
    ctx.beginPath();
    for (let q = 0; q < m; q++) {
      const k = order[q];
      if (St[k] !== cur) { if (cur >= 0) { ctx.fillStyle = styles[cur]; ctx.fill(); ctx.beginPath(); } cur = St[k]; }
      ctx.moveTo(X[k] + R[k], Y[k]); ctx.arc(X[k], Y[k], R[k], 0, TAU);
    }
    if (cur >= 0) { ctx.fillStyle = styles[cur]; ctx.fill(); }
  },
  /* the top-left readout: a title and live lines, in mono (case kept) */
  panel(g, ink, lines, alpha) {
    if (alpha <= 0.002) return;
    const x = g.box.x + 27.5, y = g.box.y + 63.5;
    lines.forEach((str, i) => { if (str) g.text(str, x, y + i * 23.7 * g.grow(16), { kind: "mono", size: 16, weight: i ? 400 : 600, track: 1.9, color: ink, alpha: alpha * (i ? 0.53 : 0.82) }); });
  },
  /* the axis gizmo, bottom right: world axes through the camera, X in the accent */
  gizmo(g, v, ink, acc, alpha, names) {
    if (alpha <= 0.002) return;
    const ctx = g.ctx, ox = g.box.r - 92.5, oy = g.box.b - 91, len = 34;
    const axis = (x, y, z) => { const xr = x * v.cy - z * v.sy, zr = x * v.sy + z * v.cy; return [xr, -(y * v.ce + zr * v.se)]; };
    const ax = [[axis(1, 0, 0), acc, 0.8, names[0]], [axis(0, 1, 0), ink, 0.85, names[1]], [axis(0, 0, 1), ink, 0.85, names[2]]];
    ctx.save(); ctx.globalAlpha *= alpha; ctx.lineCap = "round";
    for (const [[dx, dy], col, a, name] of ax) {
      const l = Math.hypot(dx, dy);
      if (l < 0.08) continue;
      g.line(ox, oy, ox + dx * len, oy + dy * len, col, 1.8, a);
      const k = Math.min(1, (l - 0.08) / 0.25);
      g.text(name, ox + dx * len + (dx / l) * 9, oy + dy * len + (dy / l) * 9 + 3.5, { kind: "mono", size: 10, weight: 500, color: col, alpha: a * k, align: "center" });
    }
    g.circle(ox, oy, 2.5, ink);
    ctx.restore();
  },
  /* dot colours: the ground's ink lifted toward white on a dark ground (the original's cool white) */
  base: (g, bg) => { const ink = g.on(bg); return g.luma(g.col(bg)) < 0.4 ? g.mix(ink, "#ffffff", 0.5) : ink; },

  /*
   * The whole lattice phase at beat b (used by the lattice scene, and by a cloud with no lattice
   * before it). P: { top, lines, crest, mid, dot, axes, marks }, L from floor(), C from setup().
   */
  draw(g, P, L, C, b, bq) {
    const ctx = g.ctx, tau = b * K - 0.011, tq = bq * K - 0.011, u = L.u;
    const cam = kit.camAt(L, tau), v = kit.view(L, cam);
    kit.heights(L, tau);
    L.hRef = kit.amp(tau);
    /* the floor: colour and size from the latest pulse, troughs small and dim, the far rows fade */
    const lk = [0, 0, 0];
    for (let k = 0; k < L.N; k++) {
      const depth = kit.project(L, v, k, L.x[k], HGT * L.h[k], L.z[k]);
      L.Z[k] = depth;
      kit.look(L, k, lk);
      L.R[k] = ((4.6 * u * D) / Math.max(1, depth)) * lk[0];
      L.St[k] = kit.style(lk[1], lk[2] * g.clamp(1.6 - (0.6 * depth) / D, 0.45, 1));
    }
    kit.dots(ctx, L, L.N, C.styles);
    const fade = g.clamp((tau - 0.02) / 0.12);
    /* registration marks on the floor */
    if (P.marks) {
      ctx.save(); ctx.strokeStyle = g.rgba(C.ink, 0.35 * fade); ctx.lineWidth = 1.5; ctx.beginPath();
      for (const [mi, mj] of [[4.5, 1.5], [6.5, -0.5], [-7.5, 4.5]]) {
        const pr = kit.proj1(L, v, mi * S, 0, mj * S);
        if (!pr) continue;
        ctx.moveTo(pr[0] - 6, pr[1]); ctx.lineTo(pr[0] + 6, pr[1]); ctx.moveTo(pr[0], pr[1] - 6); ctx.lineTo(pr[0], pr[1] + 6);
      }
      ctx.stroke(); ctx.restore();
    }
    /* the faint ring on the floor at the latest front */
    const fr = kit.front(L, tau);
    if (fr) {
      const a = 0.3 * g.clamp(fr.age / 0.04) * (1 - g.smoothstep(0.38, 0.5, fr.age));
      if (a > 0.004) {
        ctx.save(); ctx.strokeStyle = g.rgba(C.ink, a); ctx.lineWidth = 1.5; ctx.beginPath();
        let pen = false;
        for (let q = 0; q <= 128; q++) {
          const th = (q / 128) * TAU, c = Math.cos(th), sn = Math.sin(th), rr = (fr.R + 20) / (Math.abs(c) ** P + Math.abs(sn) ** P) ** (1 / P), pr = kit.proj1(L, v, c * rr, 0, sn * rr);
          if (!pr) { pen = false; continue; }
          pen ? ctx.lineTo(pr[0], pr[1]) : ctx.moveTo(pr[0], pr[1]); pen = true;
        }
        ctx.stroke(); ctx.restore();
      }
    }
    /* the emitter: a disc (soft while it is big) and a crosshair that stays */
    const er = L.emitR(tau) * u, ex = cam.ppx, ey = cam.ppy;
    if (er > 0.3) {
      if (er > 60 * u) {
        const soft = g.clamp((er - 60 * u) / (27 * u)) * 7 * u, gr = ctx.createRadialGradient(ex, ey, Math.max(0, er - soft), ex, ey, er + soft);
        gr.addColorStop(0, C.dot); gr.addColorStop(1, g.rgba(C.dot, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(ex, ey, er + soft, 0, TAU); ctx.fill();
      } else g.circle(ex, ey, er, C.dot);
    }
    ctx.save(); ctx.strokeStyle = g.rgba(C.cross, 0.7); ctx.lineWidth = 1.5; ctx.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(ex + dx * 6 * u, ey + dy * 6 * u); ctx.lineTo(ex + dx * 16 * u, ey + dy * 16 * u); }
    ctx.stroke(); ctx.restore();
    /* gizmo and panel: the numbers from the frame's own beat, so every blur sample reads the same */
    kit.gizmo(g, v, C.ink, C.acc, fade, P.axes);
    const cq = kit.camAt(L, tq);
    const vars = { cols: L.cols, rows: L.rows, n: L.N, pitch: deg(cq.pitch, 2), yaw: deg(cq.yaw, 3), a: kit.amp(tq).toFixed(2), v: String(Math.round(kit.speed(tq))).padStart(4, "0") };
    kit.panel(g, C.ink, [P.top, ...[].concat(P.lines).map((x) => fill(x, vars))], fade);
    return { cam, v };
  },
  /* one point → [x, y] or null when behind the camera */
  proj1(L, v, x, y, z) {
    const xr = x * v.cy - z * v.sy, zr = x * v.sy + z * v.cy, up = y * v.ce + zr * v.se, depth = D - y * v.se + zr * v.ce;
    if (depth < 20) return null;
    const s = v.F / depth;
    return [v.ppx + xr * s, v.ppy - up * s];
  },
  /* colours of a lattice: base dot, crest, mid crest; the emitter and its crosshair */
  setup(g, P, bg) {
    const ink = g.on(bg), base = kit.base(g, bg), acc = g.col(P.dot || "accent");
    return { ink, base, acc: g.c.accent, dot: acc, cross: g.mix(acc, base, 0.55), styles: kit.styles(g, [base, g.col(P.crest || "accent"), g.col(P.mid || "sun")]) };
  },
});

Reel.scene("lattice", {
  label: "PATTERN SYSTEMS",
  bg: "cool",
  beats: 2,
  shutter: 1, /* a full-frame shutter, as the cloud after it: the ripple's fast dots streak */
  params: {
    top: "PATTERN / LATTICE", /* the panel title, two-part '<DOMAIN> / <STRUCTURE>' (case kept) */
    lines: ["GRID {cols}×{rows}   N={n}", "PITCH {pitch}°  YAW {yaw}°", "WAVE  A={a}  v={v}"], /* the live panel lines (case kept): {cols} {rows} {n} {pitch} {yaw} {a} amplitude {v} speed */
    dots: [32, 50], /* columns × rows of dots (N is their product); a cloud after it morphs these same points */
    crest: "accent", /* the wave's first crest (palette role) */
    mid: "sun", /* its second, weaker crest */
    dot: "accent", /* the emitter dot */
    tilt: 50, /* the camera pitch it tips to, degrees from straight down */
    yaw: -5.3, /* the starting yaw, degrees (the floor sits a few degrees off square) */
    turn: 15, /* extra yaw over the tilt, degrees */
    drift: 10.1, /* steady yaw drift, degrees per second */
    marks: true, /* the three faint '+' registration marks on the floor */
    axes: ["X", "Y", "Z"], /* the gizmo's axis letters */
  },
  prepare(s, g) {
    const [cols, rows] = [].concat(s.dots);
    const L = kit.floor(g, { cols, rows: rows ?? cols, beats: s.beats, tilt: s.tilt, yaw: s.yaw, turn: s.turn, drift: s.drift });
    const C = kit.setup(g, s, s.bg);
    const end = kit.camAt(L, L.tauEnd);
    return { L, C, anchor: [end.ppx, end.ppy] };
  },
  draw(g, s, t) {
    kit.draw(g, s, s._.L, s._.C, t.b, t.bq);
  },
});
})();
