/*
 * Particles, in five phases, one continuous shot out of the halftone's dot (no cut: the dot it
 * collapsed into is the emitter). N = 2400 streaks (paper mostly, a sprinkle of cool, accent, sun
 * and blush), each drawn as its own path over the last few hundredths of a second. The physics
 * (burst → curl-noise advection → vortex) is integrated once in prepare at dt = 1/240 s and
 * stored; the rings and the dolly are analytic, so every frame is a lookup. Times are in the
 * original's seconds (3 beats at 111 BPM = 1.62 s) and stretch with the scene; b = beats of 3:
 *   b 0.00        the accent dot (r 18, glowing) flashes to r 42 and 2400 streaks burst out of it
 *                 in a tall ellipse (1 : 1.8), |v| = 3500·(1 + t/0.7)^−3 px/s; the dot shrinks
 *                 away by 0.33.  01 BURST
 *   b 0.31        02 ADVECT ∇×ψ: a 3-octave curl-noise field (scale 280 px) bends the streaks
 *                 into wavy streamlines and eddies that fill the frame.
 *   b 1.26        03 VORTEX: a spinning sink (ω 10 → 16 rad/s, anticlockwise, pull 0 → 9 /s)
 *                 sucks everything into a galaxy swirl round the dot (it springs back, r 16,
 *                 1.39–1.55), then into a ball r ≈ 150–200 by 1.85.
 *   b 1.85        04 RINGS ×3: the ball springs out (out-back, 0.12 s) into three rings (R 205,
 *                 345, 480) of three strands each, on one plane tilted 26° (near side up-left,
 *                 perspective f 900), every particle a short dash 35° off the strand; they turn at
 *                 their own ω (alternating). Leader-lined labels fade in (2.03–2.16).
 *   b 2.19        05 DOLLY: the camera pushes through the rings (z = 1739·u^2.5, scale
 *                 2000/(2000 − z)): dashes stretch into radial spokes and rush out of frame while
 *                 the dot swells to r ≈ 120 for the cut on the downbeat (labels gone by 2.59).
 * HUD extras: top left the field name, N and dt, the live sim clock; bottom row the phase and a
 * live readout (|v|, then ω, then z).
 */
(() => {
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const DUR = 1.6216; /* the original scene, seconds */
const SIM = 1.0, HZ = 120, KS = SIM * HZ; /* the stored stretch (burst → vortex) and its sample rate */
const T_ADV = 0.167, T_VOR = 0.683, T_RING = 1.0, T_DOL = 1.233; /* phase labels (sim seconds) */
const PLANE = { tilt: 26.4 * DEG, dir: 250 * DEG, f: 900 }; /* the rings' plane, fitted to the original's ellipses */
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const V = (tau) => 3500 * (1 + tau / 0.7) ** -3; /* the burst's speed, px/s */
const OMEGA = (tau) => 10 + 6 * ss(0.68, 0.9, tau); /* the vortex, rad/s */
const ZD = (tau) => 1739 * clamp((tau - 1.15) / 0.467) ** 2.5; /* the dolly, px */

Reel.scene("flow", {
  continues: ["halftone", "dashboard"], /* the dot the halftone collapsed into, or the one the cards leave on ink, bursts: one shot, not a cut */
  label: "PARTICLES",
  bg: "ink",
  beats: 3,
  params: {
    n: 2400, /* particles */
    colors: ["paper", "cool", "accent", "sun", "blush"], /* palette roles, picked per particle (by weights) */
    weights: [84, 6, 5, 3, 2], /* how often each colour is picked; omit (or a different length) for equal */
    readout: "FIELD / CURL NOISE", /* the panel title, top left (as written) */
    sub: "N={n}  dt=1/240", /* panel line 2 (as written): {n} the particles */
    clock: "t={t}s", /* panel line 3: {t} seconds into the scene, live */
    phases: ["BURST", "ADVECT  ∇×ψ", "VORTEX", "RINGS ×3", "DOLLY"], /* the five phase names, bottom left, numbered 01–05 (as written) */
    speed: "|v| {v} px/s", /* the bottom-right readout in BURST and ADVECT: {v} the burst speed */
    spin: "ω {w} rad/s", /* … in VORTEX: {w} the spin */
    push: "z {z}  f 1000", /* … in RINGS and DOLLY: {z} the camera's push */
    rings: [205, 345, 480], /* the three rings' radii, px (they label themselves R1 205 …); topic numbers fit here */
    spins: [0.9, -0.75, 0.55], /* each ring's turn, rad/s */
    ringLabel: "R{i} {r}  ω{w}", /* each ring's label: {i} its number, {r} radius, {w} signed spin */
  },
  prepare(s, g) {
    const st = g.stage, cx = st.cx, cy = st.cy, N = Math.max(1, Math.round(s.n)), W = g.W, H = g.H;
    /* the particles */
    const cols = [].concat(s.colors || ["paper"]).map((c) => g.col(c));
    const wts = Array.isArray(s.weights) && s.weights.length === cols.length ? s.weights : cols.map(() => 1), tot = wts.reduce((a, b) => a + b, 0);
    const ang = new Float32Array(N), spd = new Float32Array(N), ci = new Uint8Array(N), wd = new Float32Array(N), al = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      ang[i] = TAU * g.hash(i, 1); spd[i] = (0.22 + 1.12 * g.hash(i, 2)) * (1 + 0.35 * g.hash(i, 7) ** 6); wd[i] = 1.2 + 1.8 * Math.sqrt(g.hash(i, 4)); al[i] = 0.55 + 0.45 * g.hash(i, 5);
      let h = g.hash(i, 3) * tot, k = 0;
      while (k < cols.length - 1 && h >= wts[k]) h -= wts[k++];
      ci[i] = k;
    }
    /* the stroke batches: colour × width × alpha */
    /* (in three interleaved layers, so no colour always lies on top) */
    const groups = new Map();
    for (let i = 0; i < N; i++) {
      const wq = wd[i] < 1.8 ? 0 : wd[i] < 2.4 ? 1 : 2, aq = al[i] < 0.78 ? 0 : 1, ly = Math.floor(g.hash(i, 6) * 3), key = ly * 1000 + ci[i] * 6 + wq * 2 + aq;
      /* (a hairline once, twice or three times a fraction of a pixel apart, each group its own way: 1–2.5 px) */
      const th = TAU * g.hash(key, 8), offs = [[0, 0], [0.85 * Math.cos(th), 0.85 * Math.sin(th)], [0.85 * Math.cos(th + 1.9), 0.85 * Math.sin(th + 1.9)]].slice(0, wq + 1);
      if (!groups.has(key)) groups.set(key, { col: cols[ci[i]], w: [1.5, 2.1, 2.7][wq], a: [0.66, 0.9][aq], idx: [], key, offs });
      groups.get(key).idx.push(i);
    }
    /* the curl-noise field: ψ on a 12 px grid at four moments, its curl by differences, unit RMS */
    const GS = 12, M = 300, gx = Math.ceil((W + 2 * M) / GS) + 1, gy = Math.ceil((H + 2 * M) / GS) + 1, SL = [0, 0.25, 0.5, 0.75], nz = g.makeNoise(31);
    const field = SL.map((tau) => {
      const z = 0.35 * tau, psi = new Float32Array(gx * gy), vx = new Float32Array(gx * gy), vy = new Float32Array(gx * gy);
      for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
        const x = (i * GS - M) / 280, y = (j * GS - M) / 280;
        psi[j * gx + i] = nz(x, y, z) + 0.12 * nz(2 * x + 5.2, 2 * y + 1.3, z + 7.3) + 0.02 * nz(4 * x + 9.7, 4 * y + 3.1, z + 13.1);
      }
      let rms = 0;
      for (let j = 1; j < gy - 1; j++) for (let i = 1; i < gx - 1; i++) {
        const k = j * gx + i, a = (psi[k + gx] - psi[k - gx]) / (2 * GS), b = -(psi[k + 1] - psi[k - 1]) / (2 * GS);
        vx[k] = a; vy[k] = b; rms += a * a + b * b;
      }
      rms = Math.sqrt(rms / (gx * gy)) || 1;
      for (let k = 0; k < gx * gy; k++) { vx[k] /= rms; vy[k] /= rms; }
      return { vx, vy };
    });
    const curl = (x, y, tau, out) => {
      const fx = clamp((x + M) / GS, 0, gx - 1.001), fy = clamp((y + M) / GS, 0, gy - 1.001), i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, k = j * gx + i;
      const st2 = clamp(tau / 0.25, 0, SL.length - 1.001), si = Math.floor(st2), sw = st2 - si;
      let ox = 0, oy = 0;
      for (const [F, w] of [[field[si], 1 - sw], [field[si + 1], sw]]) {
        ox += w * ((F.vx[k] * (1 - u) + F.vx[k + 1] * u) * (1 - v) + (F.vx[k + gx] * (1 - u) + F.vx[k + gx + 1] * u) * v);
        oy += w * ((F.vy[k] * (1 - u) + F.vy[k + 1] * u) * (1 - v) + (F.vy[k + gx] * (1 - u) + F.vy[k + gx + 1] * u) * v);
      }
      out[0] = ox; out[1] = oy;
    };
    /* integrate: burst + curl advection + vortex, dt = 1/240, every other step stored */
    const P = new Float32Array(N * (KS + 1) * 2), dt = 1 / 240, cv = [0, 0];
    for (let i = 0; i < N; i++) {
      let x = cx, y = cy;
      const bx = 0.55 * Math.cos(ang[i]) * spd[i], by = Math.sin(ang[i]) * spd[i], o = i * (KS + 1) * 2;
      P[o] = x; P[o + 1] = y;
      for (let n = 0; n < KS * 2; n++) {
        const tau = (n + 0.5) * dt, kV = ss(0.72, 0.84, tau), vb = V(tau) * (1 - kV) * (1 - 0.45 * ss(0.22, 0.42, tau)), gC = 600 * ss(0.05, 0.3, tau) * (1 - ss(0.72, 0.8, tau));
        let vx = bx * vb, vy = by * vb;
        if (gC > 0) { curl(x, y, tau, cv); vx += gC * cv[0]; vy += gC * cv[1]; }
        if (kV > 0) {
          const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy) || 1;
          const vt = kV * OMEGA(tau) * r * Math.exp(-r / 300), vr = Math.min(12000, 11 * ss(0.7, 0.9, tau) * (r - 80));
          vx += (vt * dy - vr * dx) / r; vy += (-vt * dx - vr * dy) / r;
        }
        x += vx * dt; y += vy * dt;
        if (n & 1) { const q = o + ((n + 1) >> 1) * 2; P[q] = x; P[q + 1] = y; }
      }
    }
    /* the rings: nearest particles to the inner ring; along each ring in the order they lie, 3 strands */
    const R = [].concat(s.rings || [205, 345, 480]), K = R.length, sumR = R.reduce((a, b) => a + b, 0);
    const endX = (i) => P[i * (KS + 1) * 2 + KS * 2] - cx, endY = (i) => P[i * (KS + 1) * 2 + KS * 2 + 1] - cy;
    const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => Math.hypot(endX(a), endY(a)) - Math.hypot(endX(b), endY(b)));
    const ring = new Uint8Array(N), rr = new Float32Array(N), phi = new Float32Array(N), a0 = new Float32Array(N), r0 = new Float32Array(N);
    let at = 0;
    for (let k = 0; k < K; k++) {
      const nk = k === K - 1 ? N - at : Math.round((N * R[k]) / sumR), mine = order.slice(at, at + nk);
      at += nk;
      mine.sort((a, b) => Math.atan2(endY(a), endX(a)) - Math.atan2(endY(b), endX(b)));
      const per = Math.ceil(nk / 3);
      let sx = 0, sy = 0;
      mine.forEach((i, l) => { const f = (TAU * (Math.floor(l / 3) + 0.5)) / per, d = Math.atan2(endY(i), endX(i)) - f; sx += Math.cos(d); sy += Math.sin(d); });
      const off = Math.atan2(sy, sx);
      mine.forEach((i, l) => { ring[i] = k; rr[i] = R[k] + 14 * ((l % 3) - 1); phi[i] = (TAU * (Math.floor(l / 3) + 0.5)) / per + off; });
    }
    for (let i = 0; i < N; i++) { a0[i] = Math.atan2(endY(i), endX(i)); r0[i] = Math.hypot(endX(i), endY(i)); }
    const fill = (str, o) => String(str).replace(/\{(\w+)\}/g, (_, k) => (k in o ? o[k] : `{${k}}`));
    return { N, P, ci, wd, al, groups: [...groups.values()].sort((a, b) => a.key - b.key), ring, rr, phi, a0, r0, R, fill, anchor: [cx, cy] };
  },
  draw(g, s, t) {
    const { ctx } = g, _ = s._, st = g.stage, cx = st.cx, cy = st.cy, B = s.beats, N = _.N, P = _.P;
    const tau = (t.b * DUR) / B, tauq = (t.bq * DUR) / B, ui = g.on(s.bg);
    const spins = [].concat(s.spins || []);
    const ct = Math.cos(PLANE.tilt), st_ = Math.sin(PLANE.tilt), cd = Math.cos(PLANE.dir), sd = Math.sin(PLANE.dir), F = PLANE.f;
    /* a point of ring plane (radius r, angle a) on screen, before the dolly */
    const proj = (r, a, out) => {
      const x = r * Math.cos(a), y = r * Math.sin(a), u = x * cd + y * sd, v = -x * sd + y * cd, z = -u * st_, u2 = u * ct, k = F / (F + z);
      out[0] = cx + (u2 * cd - v * sd) * k; out[1] = cy + (u2 * sd + v * cd) * k;
    };
    const tmp = [0, 0], tmp2 = [0, 0];
    /* particle i at time T (sim seconds), into out; returns the dolly scale */
    const pos = (i, T, out) => {
      if (T <= SIM) {
        const f = clamp(T, 0, SIM) * HZ, k = Math.min(KS - 1, Math.floor(f)), w = f - k, o = (i * (KS + 1) + k) * 2;
        out[0] = P[o] + (P[o + 2] - P[o]) * w; out[1] = P[o + 1] + (P[o + 3] - P[o + 1]) * w;
        return 1;
      }
      const e = g.ease.spring(T - T_RING, 5.5, 0.65), k = _.ring[i];
      proj(_.rr[i], _.phi[i] + (spins[k] || 0) * (T - T_RING), tmp2);
      const tx = tmp2[0] - cx, ty = tmp2[1] - cy, rT = Math.hypot(tx, ty), aT = Math.atan2(ty, tx);
      let da = aT - _.a0[i]; da -= TAU * Math.round(da / TAU);
      const r = _.r0[i] + (rT - _.r0[i]) * e, a = _.a0[i] + da * e, m = (2000 / (2000 - ZD(T))) ** 1.15; /* the rings outrun the dot a little, as the original's */
      out[0] = cx + r * Math.cos(a) * m; out[1] = cy + r * Math.sin(a) * m;
      return m;
    };
    /* the streak's length in time: short in the burst, long in the swirl, a frame on the rings */
    /* (on the rings the exposure runs a frame ahead too, as the original's: the spokes lead the dot) */
    const Td = tau < SIM ? g.lerp(g.lerp(0.07, 0.1, ss(0.12, 0.4, tau)), 0.05, ss(0.8, 0.97, tau)) : g.lerp(0.045, 0.03, ss(1.06, 1.14, tau)), lead = tau < SIM ? 0 : 1 / 60;
    const m = 2000 / (2000 - ZD(tau)), ringK = clamp((tau - T_RING) / 0.12), spring = tau < T_RING + 0.14;
    const MS = tau < SIM ? 8 : spring ? 4 : 1; /* points per streak: curves need them, the rings' straight dashes do not */
    const dashH = 2.6 * ss(0, 0.6, ringK), near = 1 - ss(1450, 1560, ZD(tau)), c35 = Math.cos(35 * DEG), s35 = Math.sin(35 * DEG);
    /*
     * The streaks of the burst, the advection, the vortex and the spring-out are long and thin:
     * each is stroked as a one-pixel hairline three times, a fraction of a pixel apart (software
     * canvas strokes wider than a pixel cost ~8× more). The rings' short wide dashes and the
     * dolly's spokes are ordinary strokes.
     */
    const thin = tau < T_RING + 0.1, base = ctx.getTransform();
    ctx.save(); ctx.lineCap = thin || tau > T_DOL ? "butt" : "round"; ctx.lineJoin = thin ? "miter" : "round";
    const pt = [0, 0];
    for (const G of _.groups) {
      if (thin) { ctx.strokeStyle = g.rgba(G.col, G.a); ctx.lineWidth = 0.99 / base.a; }
      else { ctx.strokeStyle = g.rgba(G.col, Math.min(1, G.a + 0.15)); ctx.lineWidth = (G.w + ss(0, 1, ringK)) * m; }
      if (near < 1) ctx.globalAlpha = near;
      const path = new Path2D();
      for (const i of G.idx) {
        let hx = 0, hy = 0;
        if (dashH > 0) {
          /* the dash: 35° off the strand's tangent */
          const k = _.ring[i], a = _.phi[i] + (spins[k] || 0) * (tau - T_RING);
          proj(_.rr[i], a, tmp); proj(_.rr[i], a + 0.02, tmp2);
          const tx = tmp2[0] - tmp[0], ty = tmp2[1] - tmp[1], tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl;
          hx = (ux * c35 - uy * s35) * dashH; hy = (ux * s35 + uy * c35) * dashH;
        }
        for (let j = MS; j >= 0; j--) {
          pos(i, tau + lead - (Td * j) / MS, pt);
          const q = 1 - (2 * j) / MS, x = pt[0] + hx * q, y = pt[1] + hy * q; /* the dash spread along the streak */
          if (j === MS) path.moveTo(x, y); else path.lineTo(x, y);
        }
      }
      for (const [ox, oy] of thin ? G.offs : [[0, 0]]) { ctx.setTransform(base.a, base.b, base.c, base.d, base.e + ox * base.a, base.f + oy * base.a); ctx.stroke(path); }
    }
    ctx.restore();

    /* the dot: flash and shrink, gone through the advection, springs back in the vortex, swells with the dolly */
    let dotR = 0;
    if (tau < 0.0167) dotR = g.lerp(18, 42, tau / 0.0167);
    else if (tau < 0.2) dotR = 42 * (1 - clamp((tau - 0.0167) / 0.163)) ** 1.6;
    if (tau > 0.75) dotR = 16 * g.ease.spring(tau - 0.75, 6, 0.3) * m;
    if (dotR > 0.3) {
      /* a soft rim: the glow it carries in from the halftone, and the blur of its swelling at the end */
      const glow = tau < 0.06 ? 1 - tau / 0.06 : ss(2.5, 6, m), rim = tau < 0.06 ? 1.8 : 1.45;
      if (glow > 0) {
        const gr = ctx.createRadialGradient(cx, cy, dotR * 0.75, cx, cy, dotR * rim);
        gr.addColorStop(0, g.rgba(g.c.accent, 0.6 * glow)); gr.addColorStop(1, g.rgba(g.c.accent, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, dotR * rim, 0, TAU); ctx.fill();
      }
      g.circle(cx, cy, dotR, g.c.accent);
    }

    /* the readouts */
    const mono = (str, x, y, o) => g.text(str, x, y, Object.assign({ kind: "mono", size: 14, weight: 500, track: 2.6, color: ui }, o));
    const pad = (x, n) => String(x).padStart(n, "0");
    mono(s.readout, 74, 274.3, { alpha: 0.8 });
    mono(_.fill(s.sub, { n: N }), 74, 298.3, { alpha: 0.4 });
    mono(_.fill(s.clock, { t: (t.b * t.spb).toFixed(3) }), 74, 322, { alpha: 0.4 });
    const ph = tauq < T_ADV ? 0 : tauq < T_VOR ? 1 : tauq < T_RING ? 2 : tauq < T_DOL ? 3 : 4, names = [].concat(s.phases || []);
    mono(`${pad(ph + 1, 2)}  ${names[ph] ?? ""}`, 74, 1564, { track: 2.9, alpha: 0.75 });
    const live = ph < 2 ? _.fill(s.speed, { v: pad(Math.round(V(tau)), 4) }) : ph === 2 ? _.fill(s.spin, { w: OMEGA(tau).toFixed(2).padStart(5, "0") }) : _.fill(s.push, { z: pad(Math.round(ZD(tau)), 4) });
    mono(live, 1004, 1564, { track: 4.2, alpha: 0.75, align: "right" });
    /* the ring labels, leader-lined to their rings */
    const lk = ss(1.1, 1.17, tau) * (1 - ss(1.33, 1.4, tau));
    if (lk > 0) {
      ctx.save(); ctx.globalAlpha = lk;
      const lines = _.R.map((r, k) => _.fill(s.ringLabel, { i: k + 1, r, w: ((spins[k] || 0) < 0 ? "-" : "+") + Math.abs(spins[k] || 0).toFixed(2) }));
      const o = { size: 14, track: 2.7, alpha: 0.5 }, wmax = Math.max(...lines.map((l) => g.measure(l, Object.assign({ kind: "mono", weight: 500 }, o))));
      const lx = Math.min(757, 1004 - wmax), tx0 = lx - 52, tx1 = lx - 10;
      lines.forEach((l, k) => {
        const y = 354 + 28.2 * k, ty = y - 5;
        mono(l, lx, y, o);
        proj(_.R[k] * 0.9, (-33 - 5.5 * k) * DEG, tmp);
        const ax = cx + (tmp[0] - cx) * m, ay = cy + (tmp[1] - cy) * m;
        ctx.strokeStyle = g.rgba(ui, 0.35); ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(tx0, ty); ctx.lineTo(tx1, ty); ctx.moveTo(tx0 + 0.5, ty); ctx.lineTo(ax, ay); ctx.stroke();
        ctx.fillStyle = g.c.accent; ctx.fillRect(ax - 3, ay - 3, 6, 6);
      });
      ctx.restore();
    }
  },
});
})();
