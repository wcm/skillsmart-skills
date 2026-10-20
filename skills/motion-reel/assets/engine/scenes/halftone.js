/*
 * Halftone, two screens. A 20 px screen of paper dots (screen A, 0°) and a second screen of accent
 * dots (screen B, ~15° and creeping) print a lit picture on the dark ground: dot radius is
 * 9.5·√intensity, so the screens never move, only the picture under them. A light orbits the
 * picture (a small sun dot on a 502 px circle, LIGHT readout) and the shading follows it: screen A
 * prints the lit side (Lambert, light 40° up), screen B a back-light 135° round from it (15° up).
 * Beat by beat (2 beats; times are in beats of the 2-beat original and stretch with the scene):
 *   0.00        the accent dot (r 25) alone on the ground, as the scene before left it.
 *   0.03–0.28   the picture blooms out of the dot (its scale out-cubic 0 → 1, its ink fading up)
 *               while the dot shrinks away (in-quad, gone by 0.27): a torus (R 330, tube 112), or
 *               the topic's silhouette (shape) inflated into a round-edged relief.
 *   0.15–0.30   the readouts fade in: SCREEN A/B with their angles (top left), the pitch (top
 *               right), the dot-size legend (bottom left), LIGHT, the formula and the stats
 *               (bottom right, DOTS live).
 *   0.33–0.44   the base screen fades in over the whole frame (r 1.2 paper speckle).
 *   0.42, 0.67  kick pulses (kicks): the picture swells 2.5% and its dots 15%, decaying.
 *   0.97–1.17   morph: a shockwave ring of big dots runs out from the centre past the frame edge
 *               (1250·(1 − e^(−Δ/0.1)) px) and behind it the picture is a 3-arm log spiral
 *               (k 5.2: arms wind ~200° clockwise from the core to the r 520 rim; screen A broad
 *               arms, screen B narrower ones hugging them), born spinning anticlockwise and
 *               slowing to ~32°/beat. The formula line flips to the spiral's. The light speeds up
 *               by 45° across 1.01–1.29.
 *   1.44        another kick.
 *   1.75–1.975  collapse: the spiral shrinks into the centre (in-cubic to 5%) spinning up
 *               clockwise (∝ Δ⁵, ~30°/frame at the end); the accent dot regrows to r 20
 *               (out-quad, 1.79–1.88) and the readouts fade (1.88–1.97).
 *   2.00        the dot alone: the cut into the next scene, which can burst out of it.
 * Colours: screen A, screen B (colors), the base speckle in screen A's colour, the light in sun.
 */
(() => {
const DEG = Math.PI / 180, TAU = Math.PI * 2;
const RA = 9.5, RB = 9; /* full dot radii of the two screens, px */
const LEGEND = [3, 6, 8.2, 9.8, 12, 14.2, 16.5, 21]; /* the legend's dot diameters, px */

/* the silhouette as a relief: inside, a round edge as wide as the shape is thick (a torus tube) */
function relief(g, spec) {
  const m = g.mask(spec, 256), N = m.size, a = m.a, D = new Float32Array(N * N), big = 1e9;
  for (let i = 0; i < N * N; i++) D[i] = a[i] >= 128 ? big : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? 0 : D[y * N + x]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x; if (D[i]) D[i] = Math.min(D[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414); }
  for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) { const i = y * N + x; if (D[i]) D[i] = Math.min(D[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414); }
  /* two box passes so the chamfer steps do not show in the shading */
  let A = D;
  for (let pass = 0; pass < 2; pass++) {
    const B = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let s = 0, n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; s += X < 0 || Y < 0 || X >= N || Y >= N ? 0 : A[Y * N + X]; n++; }
      B[y * N + x] = s / n;
    }
    A = B;
  }
  let W = 0;
  for (let i = 0; i < N * N; i++) if (a[i] >= 128) W = Math.max(W, A[i]);
  W = Math.max(2, W * 0.95);
  const nx = new Float32Array(N * N), ny = new Float32Array(N * N), nz = new Float32Array(N * N), cov = new Float32Array(N * N);
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = y * N + x;
    cov[i] = a[i] / 255;
    if (!cov[i]) continue;
    const gx = (A[i + 1] - A[i - 1]) / 2, gy = (A[i + N] - A[i - N]) / 2, gl = Math.hypot(gx, gy) || 1;
    const tt = Math.max(0, 1 - Math.min(1, D[i] / W));
    nx[i] = (-tt * gx) / gl; ny[i] = (-tt * gy) / gl; nz[i] = Math.sqrt(Math.max(0, 1 - tt * tt));
  }
  return { N, nx, ny, nz, cov };
}

Reel.scene("halftone", {
  label: "HALFTONE",
  continues: "dashboard", /* the cards fly apart and leave the dot on ink: a hand-off, not a cut */
  bg: "ink",
  beats: 2,
  params: {
    step: 20, /* the screen pitch, px (both screens) */
    arms: 3, /* spiral arms */
    k: 5.2, /* spiral winding: phase turns per e-fold of radius (5.2 ≈ 200° from core to rim) */
    phase: -6.4, /* the spiral's starting turn, degrees */
    shape: null, /* optional shape spec ({ d, view, rule }, text:X, star-5…): replaces the torus as the first picture, inflated into a relief and lit by the same light */
    readout: "PITCH 20PX · 2 SCREENS", /* top right */
    screens: ["SCREEN A", "SCREEN B"], /* the two screens' names, top left, each followed by its live angle */
    angle: 15, /* screen B's angle at the start, degrees; it creeps +2.9°/s */
    forms: ["f(r,θ) = TORUS · R 330 · r 112", "f(r,θ) = SPIRAL · ARMS {arms} · k {k}", "f(x,y) = SHAPE · RELIEF"], /* the formula line (as written): the torus, the spiral ({arms}, {k}), the first picture when there is a shape */
    light: "LIGHT", /* the live light-angle readout's label */
    stats: "{cols}×{rows} · LPI 52 · DOTS {dots}", /* the stats line: {cols}×{rows} the screen, {dots} the dots printed (live) */
    legend: ["0%", "100%"], /* the captions under the dot-size legend */
    kicks: [0.42, 0.67, 1.44], /* beat pulses, in beats of the 2-beat original: the picture swells 2.5%, its dots 15% */
    colors: ["paper", "accent"], /* screen A, screen B */
    decay: 0, /* 0..1: how much of the print comes loose and falls away like sand (lowest dots first) */
    decayFrom: 0.3, /* when the decay starts, a fraction of the scene */
  },
  prepare(s, g) {
    const st = g.stage, cx = st.cx, cy = st.cy, step = s.step;
    const cols = Math.floor(g.W / step), rows = Math.floor(g.H / step);
    /* screen A: fixed to the frame, x = step/2 + step·i */
    const n = cols * rows, ax = new Float32Array(n), ay = new Float32Array(n);
    for (let j = 0, k = 0; j < rows; j++) for (let i = 0; i < cols; i++, k++) { ax[k] = step / 2 + step * i - cx; ay[k] = step / 2 + step * j - cy; }
    /* screen B: offsets of a lattice turned about the centre, within the picture's reach */
    /* (far enough for the shockwave to leave the frame), nearest first */
    const bo = [], reach = Math.hypot(g.W, g.H) / 2 + 60, m = Math.ceil(reach / step);
    for (let j = -m; j < m; j++) for (let i = -m; i < m; i++) { const x = (i + 0.5) * step, y = (j + 0.5) * step; if (x * x + y * y < reach * reach) bo.push([x, y]); }
    bo.sort((p, q) => p[0] * p[0] + p[1] * p[1] - q[0] * q[0] - q[1] * q[1]);
    const fill = (str, o) => String(str).replace(/\{(\w+)\}/g, (_, k) => (k in o ? o[k] : `{${k}}`));
    const forms = [].concat(s.forms || []), def = Reel.defs.halftone.params.forms;
    return {
      cols, rows, n, ax, ay, bo: Float32Array.from(bo.flat()), fill,
      rel: s.shape ? relief(g, s.shape) : null,
      form0: s.shape ? forms[2] ?? def[2] : forms[0] ?? def[0],
      form1: fill(forms[1] ?? def[1], { arms: s.arms, k: s.k }),
      anchor: [cx, cy],
    };
  },
  draw(g, s, t) {
    const { ctx, smoothstep, seg, ease } = g, _ = s._, st = g.stage, cx = st.cx, cy = st.cy, B = s.beats;
    const u = (t.b * 2) / B; /* beats of the 2-beat original */
    const colA = g.col(s.colors[0] || "paper"), colB = g.col(s.colors[1] || "accent"), ui = g.on(s.bg);

    /* the clock */
    const Ld = 325.6 + 75.7 * u + 45 * smoothstep(1.01, 1.29, u), L = Ld * DEG;
    const thB = (s.angle + 1.57 * u) * DEG;
    let pulse = 0;
    for (const k of s.kicks || []) if (u >= k) pulse += Math.exp(-(u - k) / 0.0925);
    const bloom = u < 0.02 ? 0 : ease.outCubic(seg(u, 0.02, 0.34)), crush = 1 - 0.95 * ease.inCubic(seg(u, 1.74, 1.965));
    const S = Math.max(1e-3, bloom * crush * (1 + 0.025 * pulse));
    const gain = smoothstep(0.03, 0.26, u), gainB = smoothstep(0.1, 0.3, u), dotK = Math.sqrt(1 + 0.15 * pulse);
    const xm = u - 0.965, xs = u - 1, xc = u - 1.74;
    /* the spiral's turn (measured): born at ~7°/frame anticlockwise, slowing to 48°/beat; the collapse spins it back clockwise */
    const rot = s.phase - (48 * xs + 30.4 * (1 - Math.exp(-xs / 0.16))) + (xc > 0 ? 80000 * xc ** 5 : 0);
    const rotR = rot * DEG;
    /* screen B's arms (measured): born a third of a turn behind screen A's, they sweep through them (hidden
       where A is dense) and drift on clockwise, ending half a turn ahead */
    const cB = -0.56 + 0.62 * xs + 0.7 * (1 - Math.exp(-xs / 0.115)), hwB = 0.3;
    const Rw = xm > 0 ? 1250 * (1 - Math.exp(-xm / 0.1)) : -200;
    const shock = xm > 0 && u < 1.25 ? 0.85 * (1 - 0.35 * smoothstep(1.05, 1.2, u)) : 0;
    const baseK = smoothstep(0.33, 0.44, u), hudK = smoothstep(0.15, 0.3, u) * (1 - smoothstep(1.85, 1.94, u));

    /* the lights: A from L, 40° up; B a back-light 110° round, 15° up; both fall off away from their side */
    const lAx = Math.cos(L) * Math.cos(40 * DEG), lAy = Math.sin(L) * Math.cos(40 * DEG), lAz = Math.sin(40 * DEG);
    const LB = L + 110 * DEG, lBx = Math.cos(LB) * Math.cos(15 * DEG), lBy = Math.sin(LB) * Math.cos(15 * DEG), lBz = Math.sin(15 * DEG);
    const cLB = Math.cos(LB), sLB = Math.sin(LB);
    const fall = (c) => 0.2 + 0.8 * ((1 + c) / 2) ** 1.2;
    const rel = _.rel, RS = 480; /* the shape's mask spans ±RS px of picture space */
    const cosL = Math.cos(L), sinL = Math.sin(L), arms = s.arms, kw = s.k;

    /* the picture at a point (dx, dy) from the centre, screen px: [I_A, I_B] */
    const out = [0, 0];
    const picture = (dx, dy) => {
      const rs = Math.hypot(dx, dy), px = dx / S, py = dy / S, rho = rs / S;
      let ta = 0, tb = 0, sa = 0, sb = 0;
      const wS = Rw < 0 ? 0 : smoothstep(Rw + 30, Rw - 30, rs);
      if (wS < 1 && rho < 640) {
        let nx = 0, ny = 0, nz = 0, cov = 0;
        if (rel) {
          const N = rel.N, X = Math.floor(((px / RS + 1) / 2) * N), Y = Math.floor(((py / RS + 1) / 2) * N);
          if (X > 0 && Y > 0 && X < N - 1 && Y < N - 1) { const i = Y * N + X; cov = rel.cov[i]; nx = rel.nx[i]; ny = rel.ny[i]; nz = rel.nz[i]; }
        } else {
          /* screen A's torus R 330 r 112; screen B's prints a little fatter (R 345 r 130), as measured */
          const d = (rho - 330) / 112, e = (rho - 345) / 130, rr = rho || 1, c = px / rr, sn = py / rr;
          if (d > -1 && d < 1) { const dA = Math.max(0, d * c * lAx + d * sn * lAy + Math.sqrt(1 - d * d) * lAz); ta = dA ** 1.3 * smoothstep(1, 0.97, Math.abs(d)) * fall(c * cosL + sn * sinL); }
          if (e > -1 && e < 1) { const dB = Math.max(0, e * c * lBx + e * sn * lBy + Math.sqrt(1 - e * e) * lBz); tb = dB ** 1.2 * (1 - ta) * smoothstep(1, 0.97, Math.abs(e)) * fall(c * cLB + sn * sLB); }
        }
        if (cov > 0) {
          const dA = Math.max(0, nx * lAx + ny * lAy + nz * lAz), dB = Math.max(0, nx * lBx + ny * lBy + nz * lBz), rr = rho || 1;
          ta = dA ** 1.3 * cov * fall((px * cosL + py * sinL) / rr); tb = dB ** 1.2 * (1 - ta) * cov * fall((px * cLB + py * sLB) / rr);
        }
      }
      if (wS > 0 && rho > 50 && rho < 570) {
        const phi = Math.atan2(py, px), ph = arms * (phi - rotR) - kw * Math.log(rho / 100);
        const fr = ph / TAU - Math.floor(ph / TAU);
        const E = smoothstep(560, 470, rho) * smoothstep(55, 110, rho), lit = 0.97 + 0.03 * ((px * cosL + py * sinL) / rho);
        const dA = Math.min(fr, 1 - fr), dB0 = Math.abs(fr - cB + Math.round(cB - fr)), dB = Math.min(dB0, 1 - dB0);
        /* each arm's dot size falls off as a cosine across it (measured): A to nothing at ±0.38 of a turn, B at ±hwB */
        const bA = dA < 0.38 ? 1.06 * Math.cos((dA / 0.38) * 1.5708) ** 2 : 0, bB = dB < hwB ? 0.77 * Math.cos((dB / hwB) * 1.5708) ** 2 : 0;
        sa = E * bA * lit; sb = E * bB * lit * Math.max(0, 1 - sa);
      }
      out[0] = ta + (sa - ta) * wS; out[1] = tb + (sb - tb) * wS;
      if (shock > 0) { const w = shock * Math.exp(-(((rs - Rw) / 45) ** 2)); out[0] = Math.min(1, out[0] + w); out[1] = Math.min(1, out[1] + 0.7 * w * (1 - w)); }
      return out;
    };

    /* the base screen */
    if (baseK > 0) {
      ctx.save(); ctx.fillStyle = g.rgba(colA, 0.55 * baseK); ctx.beginPath();
      for (let k = 0; k < _.n; k++) { const x = cx + _.ax[k], y = cy + _.ay[k]; ctx.moveTo(x + 1.2, y); ctx.arc(x, y, 1.2, 0, TAU); }
      ctx.fill(); ctx.restore();
    }
    /* the crosshair at the centre */
    ctx.save(); ctx.strokeStyle = g.rgba(ui, 0.35); ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(cx - 18, cy + 0.5); ctx.lineTo(cx + 18, cy + 0.5); ctx.moveTo(cx + 0.5, cy - 18); ctx.lineTo(cx + 0.5, cy + 18); ctx.stroke(); ctx.restore();

    /* the decay: each dot lets go in its own time (the lower ones first) and falls, drifting */
    const clamp = g.clamp, dq = s.decay > 0 ? clamp(((t.rb ?? t.b) / B - s.decayFrom) / (1 - s.decayFrom)) : 0, dropAt = [0, 0]; /* on the screen's clock: a warp slows the picture, not the fall */
    const drop = (k, dx, dy) => {
      dropAt[0] = cx + dx; dropAt[1] = cy + dy;
      if (dq <= 0) return dropAt;
      const td = 0.92 * (0.5 * clamp(1 - (dy + 620) / 1240) + 0.5 * g.hash(k, 41)) / Math.max(0.05, s.decay), age = dq - td;
      if (age > 0) { dropAt[1] += 2600 * age * age; dropAt[0] += 90 * (g.hash(k, 43) - 0.5) * age; }
      return dropAt;
    };
    /* screen A, then screen B over it */
    let inked = 0;
    const reachA = shock > 0 ? 1e9 : 600 * S;
    if (S > 0.002 && gain > 0) {
      ctx.save(); ctx.fillStyle = colA; ctx.beginPath();
      for (let k = 0; k < _.n; k++) {
        const dx = _.ax[k], dy = _.ay[k];
        if (Math.abs(dx) > reachA || Math.abs(dy) > reachA) continue;
        const I = picture(dx, dy)[0] * gain;
        const r = Math.min(10.5, RA * Math.sqrt(I) * dotK);
        if (r < 0.6) continue;
        inked++;
        const [x, y] = drop(k, dx, dy);
        if (y > g.H + 20) continue;
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
      }
      ctx.fill();
      const c = Math.cos(thB), sn = Math.sin(thB), bo = _.bo, lim = Math.max(600 * S, shock > 0 ? Rw + 140 : 0), lim2 = lim * lim;
      ctx.fillStyle = colB; ctx.beginPath();
      for (let k = 0; k < bo.length; k += 2) {
        if (bo[k] * bo[k] + bo[k + 1] * bo[k + 1] > lim2) break;
        const dx = bo[k] * c - bo[k + 1] * sn, dy = bo[k] * sn + bo[k + 1] * c;
        if (cx + dx < -12 || cx + dx > g.W + 12 || cy + dy < -12 || cy + dy > g.H + 12) continue;
        const I = picture(dx, dy)[1] * gainB;
        const r = Math.min(10, RB * Math.sqrt(I) * dotK);
        if (r < 0.6) continue;
        inked++;
        const [x, y] = drop(k + 7919, dx, dy);
        if (y > g.H + 20) continue;
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
      }
      ctx.fill(); ctx.restore();
    }

    /* the accent dot: the seed it blooms from, and what it collapses back into */
    const dotR = u < 1 ? 25 * (1 - ease.inQuad(seg(u, 0.07, 0.27))) : 20 * ease.outQuad(seg(u, 1.79, 1.88));
    if (dotR > 0.2) g.circle(cx, cy, dotR, g.c.accent);

    /* the readouts */
    if (hudK <= 0) return;
    const pad = (x, n) => String(x).padStart(n, "0");
    const mono = (str, x, y, o) => g.text(str, x, y, Object.assign({ kind: "mono", size: 14, weight: 500, track: 1.9, color: ui }, o));
    ctx.save(); ctx.globalAlpha = hudK;
    /* the light on its orbit */
    g.circle(cx + 502 * cosL, cy + 502 * sinL, 4, g.c.sun);
    /* top left: the two screens and their angles */
    const ang = [0, ((thB / DEG) % 360 + 360) % 360];
    [colA, colB].forEach((col, i) => {
      const y = 292.5 + 29.8 * i;
      g.circle(92.3, y - 5.3, 5, col);
      mono(`${String(s.screens[i] ?? "").toUpperCase()}  ${ang[i].toFixed(1).padStart(4, " ")}°`, 110, y, { size: 15, track: 2.3, alpha: 0.78 });
    });
    /* top right */
    mono(String(s.readout).toUpperCase(), 1004, 292, { size: 15, track: 2, alpha: 0.4, align: "right" });
    /* bottom left: the dot-size legend */
    LEGEND.forEach((d, i) => g.circle(117.7 + 26.04 * i, 1484, (d / 2) * (i === LEGEND.length - 1 ? 1 : 0.97), i === LEGEND.length - 1 ? colB : colA));
    const lg = [].concat(s.legend || []);
    if (lg[0]) mono(lg[0], 86, 1515.7, { size: 12, track: 1, alpha: 0.4 });
    if (lg[1]) mono(lg[1], 302, 1515.7, { size: 12, track: 1, alpha: 0.4, align: "center" });
    /* bottom right: the light, the formula, the stats */
    const Lm = ((Ld % 360) + 360) % 360;
    mono(`${String(s.light).toUpperCase()} ${pad(Lm.toFixed(1), 5)}°`, 986, 1467, { alpha: 0.75, align: "right" });
    ctx.fillStyle = g.c.sun; ctx.fillRect(998, 1458.5, 8, 8);
    mono((t.bq * 2) / B < 1.0 ? _.form0 : _.form1, 1005, 1494, { alpha: 0.75, align: "right" });
    mono(_.fill(s.stats, { cols: _.cols, rows: _.rows, dots: _.n + inked }), 1005, 1521, { alpha: 0.4, align: "right" });
    ctx.restore();
  },
});
})();
