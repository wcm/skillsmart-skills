/*
 * Phyllotaxis, as a lab instrument. Vogel's sunflower: seed n sits at radius c·√n and angle n·θ;
 * every k-th seed (one parastichy arm) is in the accent and seed size grows with radius. The flower
 * turns slowly anticlockwise (-15.5°/s) against a polar dial turning clockwise (+7°/s). Beat by
 * beat (2 beats; the choreography is written in the original's seconds, 1 beat = 0.5405 s, and
 * scales with the tempo):
 *   0.00        cut in on a white flash that decays to the ground in ~0.06 beat. The accent dot
 *               (r 26) sits at the centre, shrinks to the 4.5 px seed and fires a shockwave ring
 *               (an ease-out ring that creeps to the corners, plus a fainter, slower accent echo).
 *   0.00–0.62   the seeds spray out of the dot in order of n (the live count runs up to n) into a
 *               growing disc: they pile up at its edge (a dark rim of streaks), it overshoots the
 *               rim by 3.7% and settles; each seed's angle leaves 120° ahead and swings back, so
 *               the outer seeds streak along the spiral arms until ~0.65.
 *   0.12–0.41   the HUD fades in: title + model line, the dial (000–330), a crosshair, two dotted
 *               guide rings, the θ construction (two rays, arc, italic θ; it turns with the
 *               flower), bottom-left readouts (θ, n, Δθ, constant, state word, slider start … p/q)
 *               and the right column (accent bullet + metric, ratio, series).
 *   0.55–0.67   a callout (ring, elbow leader, underlined label) locks onto the hero seed.
 *   0.55–0.99   θ sweeps golden → the rational p/q target (in-out expo, landing on beat 1): the
 *               sunflower snaps into q straight spokes, the outer seeds streak (their angular
 *               speed is n·dθ/dt). A size ripple runs out from the centre as it locks.
 *   0.99–1.27   hold on the spokes (a longer scene holds longer; a shorter one is compressed).
 *   1.27–1.60   θ springs back past golden (out-back) and settles; a ripple as it crosses golden,
 *               another as it settles.
 *   1.64–1.79   the HUD fades out.
 *   1.74–1.94   the flower starts to turn (ease-in) while its radial law steepens from r ∝ √n to
 *               r ∝ n^4.5 (the inner seeds drain to the centre, the rim stays): it winds into a
 *               spinning spiral galaxy, then shrinks into the centre dot, which grows to r 21.
 *   1.94–2.00   a lone accent dot on the ground for the cut: the match cut into the next scene's
 *               circle (s._.anchor is the centre).
 */
(() => {
const K = 0.5405; /* the original's seconds per beat: the timings below are in its seconds */
const DEG = Math.PI / 180, TAU = Math.PI * 2;
const LV = 10; /* colour/alpha steps for seeds still in flight */
Reel.scene("phyllotaxis", {
  label: "GENERATIVE",
  bg: "paper",
  beats: 2,
  params: {
    title: "PHYLLOTAXIS", /* heavy sans, top left */
    sub: "VOGEL MODEL  ·  r = c√n   φ = n·θ", /* the mono model line under the title, as written (not upper-cased) */
    n: 900, /* seeds */
    mark: "circle", /* each seed's shape: any shape spec (circle, square, star-5, text:✳, { d, view }); non-circles turn along the spiral */
    every: 13, /* every k-th seed in the accent: one parastichy arm */
    angles: [137.5078, 137.6471, 137.5078], /* divergence angle in degrees: start (golden), the sweep target (p/q of a turn: q spokes), the angle it springs back to */
    hero: 377, /* the seed the callout locks onto */
    heroLabel: "n = {i}", /* the callout label; {i} is the hero's index */
    symbols: ["θ", "n"], /* the serif italic accent symbols of the angle and the count (row 1; the angle's also labels the arc) */
    delta: "Δθ", /* row 2: prefix of the live offset from the start angle */
    constant: "c = 15.80", /* row 2: the model constant */
    readout: "GOLDEN", /* row 2: state word at the start angle */
    sweeping: "SWEEP", /* row 2: state word while θ moves */
    locked: "RATIONAL {frac}", /* row 2: state word on the target; {frac} is its p/q */
    ticks: ["φ", "{frac}"], /* slider tick labels: start (serif italic), target (mono) */
    metric: "PARASTICHY", /* right column, row 1, after the accent bullet; followed by `every` */
    ratio: "φ = 1.6180339", /* right column, row 2 */
    series: "34 · 55 · 89 · 144 · 233 · 377 · 610", /* right column, row 3: a string, or an array joined with " · " */
  },
  prepare(s, g) {
    const box = g.box, R = Math.min(box.w * 0.4722, box.h * 0.33), u = R / 466;
    const N = Math.max(1, Math.round(s.n)), c = R / Math.sqrt(N);
    const A = [].concat(s.angles).map(Number), th0 = A[0], th1 = A.length > 1 ? A[1] : th0, th2 = A[A.length - 1];
    const frac = rational(th1), hero = Math.max(1, Math.min(N, Math.round(s.hero)));
    const bg = g.col(s.bg), ink = g.on(bg), acc = g.c.accent, grey = g.mix(bg, ink, 0.45);
    const sub = (str) => String(str).replace(/\{frac\}/g, frac).replace(/\{i\}/g, hero);
    /* seeds in flight blend from grey to their colour and fade in: LV + 1 steps */
    const ramp = (to) => Array.from({ length: LV + 1 }, (_x, j) => (j === LV ? to : g.mix(grey, to, g.smoothstep(0, 1, (j + 0.5) / LV))));
    const alphas = Array.from({ length: LV + 1 }, (_x, j) => (j === LV ? 1 : Math.min(1, (4 * (j + 0.5)) / LV)));
    const tone = (k) => g.mix(bg, ink, k);
    return {
      cx: box.cx, cy: box.cy, R, u, N, c, cs: c / 15.525, th0, th1, th2, hero, ink, acc,
      ramps: [ramp(ink), ramp(acc)], alphas,
      flashA: g.luma(bg) > 0.4 ? 0.62 : 0.25,
      tones: { cross: tone(0.06), dial: tone(0.177), dialText: tone(0.32), sub: tone(0.48), row2: tone(0.52), track: tone(0.16), tick: tone(0.32), phi: tone(0.84), rA: tone(0.92), rB: tone(0.5), rC: tone(0.43), guide: tone(0.12) },
      dialLabels: Array.from({ length: 12 }, (_x, k) => String(k * 30).padStart(3, "0")),
      words: { locked: sub(s.locked), ticks: [].concat(s.ticks).map(sub), hero: sub(s.heroLabel), series: Array.isArray(s.series) ? s.series.join(" · ") : String(s.series) },
      sprites: new Map(), /* memo: the mark pre-drawn per colour, for non-circle marks */
      anchor: [box.cx, box.cy], anchorR: 21 * u,
    };
  },
  draw(g, s, t) {
    const { ctx } = g, _ = s._, B = s.beats, u = _.u, cx = _.cx, cy = _.cy, ink = _.ink, acc = _.acc, T = _.tones, box = g.box;
    /* τ: seconds of the original; a longer scene holds the spokes longer, a shorter one is compressed */
    const tau = t.b * K * Math.max(1, 2 / B), late = Math.max(0, B - 2) * K;

    /* the divergence angle: sweep to the target on beat 1, hold, spring back past the start */
    const tR = 0.6855 + late;
    const th = tau < tR ? _.th0 + (_.th1 - _.th0) * g.ease.inOutExpo(g.seg(tau, 0.298, 0.5355)) : _.th1 + (_.th2 - _.th1) * g.ease.outBack(g.seg(tau, tR, tR + 0.179), 2.4);
    const D = _.th1 - _.th0, dth = th - _.th0, w = D ? dth / D : 0;
    /* the exit: the whole flower starts to turn (ease-in, 150°) while its radial law steepens from
       r ∝ √n towards r ∝ n^4.5 (inner seeds drain to the centre, the rim stays put), which winds the
       sunflower into a spiral galaxy; then everything shrinks into the dot */
    const q = g.seg(tau, 0.941 + late, 1.0563 + late), spin = 150 * DEG * q * q, gam = 0.5 + 4 * q ** 3.5;
    const shrink = 1 - g.seg(tau, 0.998 + late, 1.05 + late) ** 1.6, thin = (1 - 0.35 * q) * (0.4 + 0.6 * shrink); /* seeds thin out as it winds and shrinks */
    const hudIn = g.ease.outQuad(g.seg(tau, 0.065, 0.223)), hudOut = 1 - g.ease.outQuad(g.seg(tau, 0.886 + late, 0.965 + late)), hudK = hudIn * hudOut;

    /* the flash of the cut */
    const fl = Math.exp(-tau / 0.03) * _.flashA;
    if (fl > 0.004) { ctx.fillStyle = g.rgba("#ffffff", fl); ctx.fillRect(0, 0, g.W, g.H); }

    /* the shockwave: a thin ring easing out to the corners, and a fainter, slower accent echo */
    const ringR = (x) => 1020 * u * (1 - Math.exp(-13.5 * (x + 0.008)));
    const r1a = 0.55 * (1 - g.smoothstep(0.25, 0.45, tau));
    if (r1a > 0) g.ring(cx, cy, ringR(tau), ink, 2 * u, r1a);
    const t2 = tau - 0.035;
    if (t2 > 0 && t2 < 0.12) g.ring(cx, cy, 0.72 * ringR(t2), acc, 2.5 * u, 0.2 * (1 - t2 / 0.12));

    /* crosshair and the turning polar dial */
    if (hudK > 0) {
      ctx.save(); ctx.globalAlpha = hudK;
      g.line(0, cy, g.W, cy, T.cross, 1.5); g.line(cx, cy - 540 * u, cx, cy + 540 * u, T.cross, 1.5);
      const rot = 7 * tau * DEG, Rd = 490.5 * u;
      ctx.strokeStyle = T.dial; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, Rd, 0, TAU);
      for (let k = 0; k < 120; k++) {
        const a = k * 3 * DEG + rot, ca = Math.cos(a), sa = Math.sin(a);
        const [r0, r1] = k % 10 === 0 ? [486 * u, 502 * u] : k % 5 === 0 ? [Rd, 499 * u] : [Rd, 496 * u];
        ctx.moveTo(cx + r0 * ca, cy + r0 * sa); ctx.lineTo(cx + r1 * ca, cy + r1 * sa);
      }
      ctx.stroke();
      for (let k = 0; k < 12; k++) {
        const a = k * 30 * DEG + rot;
        g.text(_.dialLabels[k], cx + 513 * u * Math.cos(a), cy + 513 * u * Math.sin(a), { kind: "mono", size: 13, weight: 500, align: "center", base: "middle", color: T.dialText });
      }
      /* two faint dotted guide rings inside the flower */
      ctx.strokeStyle = T.guide; ctx.lineWidth = 1.2; ctx.setLineDash([1.5, 5.5]); ctx.beginPath();
      for (const gr of [120, 236]) { ctx.moveTo(cx + gr * u, cy); ctx.arc(cx, cy, gr * u, 0, TAU); }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }

    /* the seeds: born along n, they fly out of the centre on a spiral path, then sit at c·√n, n·θ */
    const N = _.N, c = _.c, cs = _.cs, every = Math.max(1, Math.round(s.every)), thr = th * DEG;
    const rho0 = (-2.8 - 15.5 * tau) * DEG, rho = rho0 + spin; /* the flower's phase: it turns slowly anticlockwise (-15.5°/s) against the dial */
    const PHI = 120 * DEG, born0 = -0.016, bornDur = 0.183, fly = 0.08, swirl = 0.28;
    /* the disc they fly into grows (ease-out) to the rim, overshoots 3.7% and settles: seeds pile up at its edge */
    const cap = _.R * (1 - (1 - g.seg(tau, -0.006, 0.264)) ** 1.3), ov = 1 + 0.037 * Math.sin(Math.PI * g.seg(tau, 0.2, 0.34));
    /* size ripples: one leaves the centre as θ locks onto the target, one as it springs back through the start, one as it settles */
    const pulses = [0.485, 0.743 + late, 0.893 + late].map((te) => tau - te).filter((d) => d > 0).map((d) => 1300 * d * u);
    const custom = s.mark !== "circle" && s.mark != null;
    const paths = custom ? null : [[], []];
    const list = custom ? [] : null;
    let hx = cx, hy = cy, heroOn = false;
    for (let i = 1; i <= N; i++) {
      const age = tau - born0 - bornDur * (i / N), p = g.clamp(age / fly), pa = g.clamp(age / swirl);
      if (p <= 0) continue;
      const flying = p < 1;
      const E = flying ? g.ease.outCubic(p) : 1, rn = Math.min(c * Math.sqrt(i) * E, cap) * ov;
      const r0 = q > 0 ? _.R * (i / N) ** gam * E : rn;
      const a = i * thr + rho + (pa < 1 ? (1 - pa) ** 3 * PHI : 0); /* leaves 120° ahead, swings back into place */
      let bump = 1;
      for (const f of pulses) { const z = (rn - f) / (50 * u); if (z > -3 && z < 3) bump += 0.5 * Math.exp(-z * z); }
      const r = r0 * shrink, rd = cs * (2.1 + (0.0155 * rn) / u) * bump * thin;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      if (i === _.hero) { hx = x; hy = y; heroOn = !flying; }
      if (rd < 0.05) continue;
      const lv = flying ? Math.floor(p * LV) : LV, col = i % every === 0 ? 1 : 0;
      if (custom) list.push(x, y, rd, a, col, lv);
      else { const P = paths[col][lv] || (paths[col][lv] = new Path2D()); P.moveTo(x + rd, y); P.arc(x, y, rd, 0, TAU); }
    }
    ctx.save();
    if (custom) {
      /* the mark, pre-drawn once per colour, turned along the spiral */
      const m = ctx.getTransform();
      for (let k = 0; k < list.length; k += 6) {
        const x = list[k], y = list[k + 1], rd = list[k + 2], a = list[k + 3], lv = list[k + 5], spr = sprite(g, _, s.mark, _.ramps[list[k + 4]][lv]);
        const ca = Math.cos(a + Math.PI / 2), sa = Math.sin(a + Math.PI / 2), size = (rd * 1.2) / 0.46;
        ctx.setTransform(m.a * ca + m.c * sa, m.b * ca + m.d * sa, -m.a * sa + m.c * ca, -m.b * sa + m.d * ca, m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f);
        ctx.globalAlpha = _.alphas[lv];
        ctx.drawImage(spr, -size / 2, -size / 2, size, size);
      }
      ctx.setTransform(m);
    } else {
      for (const col of [0, 1]) paths[col].forEach((P, lv) => { if (!P) return; ctx.globalAlpha = _.alphas[lv]; ctx.fillStyle = _.ramps[col][lv]; ctx.fill(P); });
    }
    ctx.restore();

    /* the centre dot: big at the cut, the 4.5 px seed, grows again as everything falls into it */
    const dotR = u * (4.5 + 23 * Math.exp(-tau / 0.034) + 16.5 * q * q);
    g.circle(cx, cy, dotR, acc);
    const halo = 0.55 * (1 - g.seg(tau, 0, 0.06));
    if (halo > 0) g.ring(cx, cy, dotR + 5 * u, acc, 1.2, halo);

    /* the θ construction: two rays the start angle apart, the arc, the italic symbol */
    const thK = g.smoothstep(0.106, 0.14, tau) * hudOut;
    if (thK > 0) {
      /* it turns with the flower (after swinging in from 8° anticlockwise) and spans the live θ */
      const col = g.mix(T.dialText, acc, g.smoothstep(0.115, 0.14, tau)), a1 = rho0 - (1 + 8 * (1 - g.ease.outQuad(g.seg(tau, 0.1, 0.28)))) * DEG, a2 = a1 + thr, am = (a1 + a2) / 2;
      ctx.save(); ctx.globalAlpha = thK; ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.lineTo(cx + 111 * u * Math.cos(a1), cy + 111 * u * Math.sin(a1));
      ctx.moveTo(cx, cy); ctx.lineTo(cx + 110 * u * Math.cos(a2), cy + 110 * u * Math.sin(a2));
      ctx.moveTo(cx + 63 * u * Math.cos(a1), cy + 63 * u * Math.sin(a1)); ctx.arc(cx, cy, 63 * u, a1, a2);
      ctx.stroke();
      g.text(s.symbols[0], cx + 85 * u * Math.cos(am), cy + 85 * u * Math.sin(am), { kind: "serif", style: "italic", size: 24, align: "center", base: "middle", color: col });
      ctx.restore();
    }

    /* the callout on the hero seed: ring, then the elbow leader, then the label on a ground-coloured box */
    const k1 = g.ease.outBack(g.seg(tau, 0.298, 0.33)), k2 = g.ease.outCubic(g.seg(tau, 0.312, 0.345)), k3 = g.seg(tau, 0.33, 0.36);
    if (heroOn && k1 > 0 && hudOut > 0) {
      ctx.save(); ctx.globalAlpha = hudOut;
      g.ring(hx, hy, 14 * u * k1, ink, 1.2);
      const lab = { kind: "mono", size: 16, weight: 500, track: 0.2, color: ink }, lw = g.measure(_.words.hero, lab);
      const ex = hx + 57 * u, ey = hy - 44 * u, ul = Math.max(68 * u, lw + 8);
      if (k3 > 0) {
        ctx.globalAlpha = hudOut * k3; ctx.fillStyle = g.col(s.bg); ctx.fillRect(ex + 0.5, ey - 22, ul, 21.25);
        g.text(_.words.hero, ex + 2, ey - 5, lab);
        ctx.globalAlpha = hudOut;
      }
      if (k2 > 0) {
        const pts = [[hx + 10 * u, hy - 8 * u], [ex, ey], [ex + ul, ey]], l1 = Math.hypot(ex - pts[0][0], ey - pts[0][1]), L = (l1 + ul) * k2;
        ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(...pts[0]);
        if (L <= l1) ctx.lineTo(pts[0][0] + ((ex - pts[0][0]) * L) / l1, pts[0][1] + ((ey - pts[0][1]) * L) / l1);
        else { ctx.lineTo(ex, ey); ctx.lineTo(ex + L - l1, ey); }
        ctx.stroke();
      }
      ctx.restore();
    }

    /* the readouts */
    if (hudK > 0) {
      ctx.save(); ctx.globalAlpha = hudK;
      const x0 = box.x, xr = box.r - 32.5, yb = box.b;
      g.text(s.title, x0 + 31.5, box.y + 93.7, { kind: "display", size: 40.5, weight: 900, track: 2, color: ink, fit: box.w * 0.62 });
      g.text(s.sub, x0 + 30, box.y + 123.5, { kind: "mono", size: 16, weight: 500, track: 1.4, color: T.sub, fit: box.w * 0.62 });
      /* row 1: θ = value, n = count */
      const sym = { kind: "serif", style: "italic", size: 34, color: acc }, val = { kind: "mono", size: 23, weight: 400, track: 0.2, color: ink };
      const count = Math.floor(N * g.clamp((tau - 0.0055) / 0.183));
      g.text(s.symbols[0], x0 + 30, yb - 131, sym);
      g.text(`= ${th.toFixed(3)}°`, x0 + 53.5, yb - 131, val);
      g.text(s.symbols[1], x0 + 240, yb - 131, sym);
      g.text(`= ${count}`, x0 + 263, yb - 131, val);
      /* row 2: offset, constant, state word */
      const r2 = { kind: "mono", size: 16, weight: 400, track: 2.4, color: T.row2 };
      const state = Math.abs(w) < 0.0575 ? s.readout : w > 0.989 ? _.words.locked : s.sweeping;
      g.text(`${s.delta} ${dth >= 0 ? "+" : "-"}${Math.abs(dth).toFixed(4)}°`, x0 + 29.3, yb - 101.5, r2);
      g.text(s.constant, x0 + 191.3, yb - 101.5, r2);
      g.text(state, x0 + 330.7, yb - 101.5, r2);
      /* row 3: the slider, start … target, with the marker riding Δθ */
      const sy = yb - 80.5, tx0 = x0 + 118.9, tx1 = x0 + 254;
      g.line(x0 + 29.5, sy, x0 + 329.5, sy, T.track, 1.5);
      g.line(tx0, sy - 7.5, tx0, sy + 7.5, T.tick, 1); g.line(tx1, sy - 7.5, tx1, sy + 7.5, T.tick, 1);
      ctx.fillStyle = acc; ctx.fillRect(tx0 + w * (tx1 - tx0) - 3.75, sy - 6.25, 7.5, 12);
      g.text(_.words.ticks[0], tx0 + 1.6, yb - 55, { kind: "serif", style: "italic", size: 21, align: "center", color: T.phi });
      g.text(_.words.ticks[1] ?? "", tx1 + 7, yb - 56, { kind: "mono", size: 14, weight: 400, track: 0.6, align: "center", color: T.row2 });
      /* the right column */
      const rA = { kind: "mono", size: 17, weight: 450, track: 1.4, align: "right", color: T.rA };
      const wA = g.text(`${s.metric}  ${every}`, xr, yb - 131, rA);
      g.circle(xr - wA - 34, yb - 137, 6.4, acc);
      g.text(s.ratio, xr, yb - 106.5, { kind: "mono", size: 16, weight: 400, track: 1.9, align: "right", color: T.rB });
      g.text(_.words.series, xr, yb - 85, { kind: "mono", size: 15, weight: 400, track: 1.4, align: "right", color: T.rC, fit: box.w * 0.62 });
      ctx.restore();
    }
  },
});
/* the mark drawn once in a colour, on a small canvas (a pure memo) */
function sprite(g, _, spec, color) {
  let c = _.sprites.get(color);
  if (c) return c;
  const S = Math.ceil(72 * Math.max(1, g.scale));
  c = document.createElement("canvas"); c.width = c.height = S;
  const x = c.getContext("2d"); x.fillStyle = color; x.beginPath();
  if (g.shapePath(spec, x, S / 2, S / 2, S * 0.46) !== "filled") x.fill();
  _.sprites.set(color, c);
  return c;
}
/* the nearest small fraction of a turn, for the readouts */
function rational(alpha) {
  const x = alpha / 360;
  let best = [0, 1, 1];
  for (let q = 2; q <= 60; q++) { const p = Math.round(x * q), e = Math.abs(x - p / q); if (e < best[2] - 1e-12) best = [p, q, e]; }
  return `${best[0]}/${best[1]}`;
}
})();
