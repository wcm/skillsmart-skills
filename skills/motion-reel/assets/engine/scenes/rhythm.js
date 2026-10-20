/*
 * Rhythm. A burst of hard cuts on the half beat: six generative "instruments", each on its own
 * flat ground, all built around the centre of the HUD box so the eye never moves while everything
 * else changes. Every shot has the same grammar: a cut, a 4–6 frame kick (one period of its main
 * motion, exponential ease-out, streaked by the shutter) while its centre disc springs in from
 * about half size, overshoots 20–45 % and settles by frame 12; then a slow drift to the next cut.
 * Times below are the original's seconds after the cut (1 beat = 0.5405 s; they scale with tempo).
 *   target        RINGS on paper: full-frame ink annuli (λ 112, band 48) jump one wavelength outward
 *                 (τ 0.023 s) then drift 120 px/s; the accent dot springs 61 → 128 → 110; a thin
 *                 accent pulse ring runs 131 → 279 and fades by 0.21 s. Readout: its radius.
 *   sun           SUNBURST on sun: 24 tapered ink rays (long to r 1255, short to 785) off an ink
 *                 annulus (r 150–172) kick 14° clockwise (τ 0.03 s) then turn 54°/s; the accent disc
 *                 pops 82 → 149 → 133. Readout: ROT in degrees.
 *   dots          DOT FIELD on accent: a static 88 px grid of ink dots whose radii are a moiré wave
 *                 15.2 + 10.8·sin(|(1.16 i, 2.645 j)| − 33.7 t), travelling outward; the paper disc
 *                 springs 69 → 162 → 128.
 *   orbit         ORBIT on cool: the orbit system zooms 0.72 → 1 and unwinds 15° (τ 0.04 s); a paper
 *                 planet springs 96 → 228 → 184; a blush moon rides the outer orbit (a 640, b 230,
 *                 tilt 6.6°) clockwise at 15 rad/s, bottom to top; a white moon circles the inner
 *                 orbit (a 350, b 150, tilt 40°) the other way and passes behind the planet; a sun
 *                 moon streaks off along a huge dotted orbit.
 *   harmonograph  HARMONOGRAPH on blush: a damped 3.02 : 2 Lissajous (13 loops) is drawn outer → inner
 *                 by an accent pen (30 % → 83 % in 0.06 s, then creeping; a longer shot draws
 *                 slower, so the pen is seen at work), with a zoom settle, a crosshair through the
 *                 pen and a dashed frame on the HUD box. Readout: pen x / y.
 *   vinyl         33⅓ RPM on ink: a record (r 480) springs 1.12 → 0.92 → 1 while its spin brakes from
 *                 30°/frame to 33⅓ rpm; accent label with the record text on a circle and an
 *                 off-centre spindle; the tonearm swings 70° → 143° (0.13 s) and eases back to 117°.
 *                 It cuts on the label: the next scene can open on a disc at the centre.
 * HUD: the panel reads '<LABEL>  0k / 06' and the shot's title; six squares bottom left (the current
 * one filled) and a live readout bottom right, all in the HUD's ink for the shot's ground.
 * Shots are chosen and ordered per reel (shots: [...]); the cut uses the frame's own beat, so the
 * shutter never blends two shots.
 */
(() => {
const K = 0.5405; /* the original's seconds per beat: the choreography below is in its seconds */
const DEG = Math.PI / 180, TAU = Math.PI * 2;
const ALIAS = { rings: "target", sunburst: "sun", field: "dots", dotfield: "dots", planet: "orbit", lissajous: "harmonograph", record: "vinyl" };
const GROUND = { target: "paper", sun: "sun", dots: "accent", orbit: "cool", harmonograph: "blush", vinyl: "ink", grid: "paper", jitter: "ink", scatter: "accent", static: "ink",
  sierpinski: "accent", dragon: "deep", fern: "cool", mandelbrot: "deep" };
const TITLES = { target: "RINGS  λ={lambda}px", sun: "SUNBURST  n={n}", dots: "DOT FIELD  {cols}×{rows}", orbit: "ORBIT  a={a} b={b}", harmonograph: "HARMONOGRAPH  {ratio} : 2", vinyl: "33⅓ RPM  SIDE A",
  grid: "LATTICE  {n} SITES", jitter: "THERMAL  σ={sigma}", scatter: "GAS  {n} PARTICLES", static: "NOISE  {n} STATES",
  sierpinski: "SIERPINSKI  D=1.585", dragon: "DRAGON  {n} FOLDS", fern: "BARNSLEY FERN  {n} PTS", mandelbrot: "z → z² + c" };
const READOUTS = { target: "f = 1/8   r {r}", sun: "ROT {rot}°", dots: "r = 6 + 26·sin(kd - ωt)", orbit: "e = {e}   ω {w} rad/s", harmonograph: "x {x}   y {y}", vinyl: "ω {w} rad/s",
  grid: "σ = 0.00", jitter: "σ = {sigma}", scatter: "⟨r²⟩ ∝ t   {r}", static: "S = MAX",
  sierpinski: "ZOOM ×{z}", dragon: "ZOOM ×{z}", fern: "ZOOM ×{z}", mandelbrot: "ZOOM ×{z}" };
/* the centre discs: rest radius (design px; the record's is a scale), start fraction, ω (rad/s), ζ — fitted per frame */
const POP = { target: [109.5, 0.557, 33, 0.339], sun: [132.7, 0.618, 27.7, 0.319], dots: [136.5, 0.502, 29.9, 0.309], orbit: [194.2, 0.493, 28.8, 0.335], vinyl: [0.981, 1.157, 27.5, 0.304] };
/* the harmonograph, fitted to the original's last frame: centre offset, τ range, x and y as sums of damped sines [amp, freq, phase, decay] */
const HARM = { dx: -10.8, dy: -23.4, t0: 0, t1: 89.9, x: [[488.8, 1.5089, 2.2861, 0.0183], [-77.94, 1, 1.3283, 0.0115]], y: [[674.5, 1, 1.1173, 0.0167], [23.78, 1.5089, 0.655, 0.0251]] };
/* the tonearm angle (screen degrees) by original seconds after the cut */
const ARM = [[0, 70.4], [0.009, 77.3], [0.0257, 90], [0.0423, 105], [0.059, 119], [0.0757, 131], [0.0923, 138.8], [0.109, 142.8], [0.1257, 143.3], [0.1423, 141], [0.159, 137], [0.1757, 132], [0.1923, 127], [0.209, 123], [0.2257, 120], [0.2423, 118.5], [0.259, 117.5], [0.3, 116.5]];

const fill = (str, vars) => String(str).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const pad = (n, k) => String(Math.max(0, Math.round(n))).padStart(k, "0");
/* a damped spring from s0 to 1, u seconds after the cut */
const pop = ([R, s0, w, z], u) => { u = Math.max(0, u); return R * (1 - (1 - s0) * Math.exp(-z * w * u) * Math.cos(w * Math.sqrt(1 - z * z) * u)); };
const kick = (u, tau) => 1 - Math.exp(-Math.max(0, u) / tau);
/* monotone cubic through [t, v] keys (Fritsch–Carlson), held at both ends */
function monotone(keys) {
  const n = keys.length, x = keys.map((k) => k[0]), y = keys.map((k) => k[1]), m = new Array(n).fill(0), d = [];
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (x[i + 1] - x[i - 1])) / ((2 * x[i + 1] - x[i] - x[i - 1]) / d[i - 1] + (x[i + 1] + x[i] - 2 * x[i - 1]) / d[i]);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  return (t) => {
    if (t <= x[0]) return y[0];
    if (t >= x[n - 1]) return y[n - 1];
    let i = 0;
    while (t > x[i + 1]) i++;
    const h = x[i + 1] - x[i], s = (t - x[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * y[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * y[i + 1] + (s3 - s2) * h * m[i + 1];
  };
}
const armAt = monotone(ARM);

Reel.scene("rhythm", {
  label: "RHYTHM",
  bg: "ink",
  beats: 3,
  shutter: 1, /* a full-frame shutter: the kicks streak as in the original */
  shot: (s) => s.per, /* the length of one shot, in the scene's beats (check.mjs holds it to a second) */
  params: {
    shots: ["target", "sun", "dots", "orbit", "harmonograph", "vinyl"], /* one per cut, in order: target sun dots orbit harmonograph vinyl (aliases rings sunburst field planet lissajous record) */
    per: 0.5, /* beats per shot */
    record: "SIDE A · {bpm} BPM · {brand} · MOTION {edition} ·", /* the text round the record label (vinyl); {bpm} {brand} {edition} from the reel; a short one repeats */
    grounds: {}, /* palette role per shot, to change any of: target paper, sun sun, dots accent, orbit cool, harmonograph blush, vinyl ink */
    titles: {}, /* the panel's second line per shot (case kept), to change any of TITLES; {lambda} {n} {cols} {rows} {a} {b} {ratio} are live */
    readouts: {}, /* the bottom-right readout per shot (case kept), to change any of READOUTS; {r} {rot} {e} {w} {x} {y} are live */
  },
  prepare(s, g) {
    const shots = s.shots.map((x) => { const k = String(x).toLowerCase().replace(/[\s_-]/g, ""); const t = ALIAS[k] || k; if (!GROUND[t]) Reel.warn(`rhythm: unknown shot "${x}"; known: ${Object.keys(GROUND).join(", ")}`); return GROUND[t] ? t : "target"; });
    if (Math.abs(shots.length * s.per - s.beats) > 1e-6) Reel.warn(`rhythm: ${shots.length} shots × ${s.per} beat ≠ ${s.beats} beats`);
    const box = g.box, k = Math.min(box.w / 987, box.h / 1412), cx = box.cx, cy = box.cy;
    /* the harmonograph polyline, once */
    const N = 4000, hx = new Float32Array(N), hy = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const tau = HARM.t0 + ((HARM.t1 - HARM.t0) * i) / (N - 1);
      let x = HARM.dx, y = HARM.dy;
      for (const [A, f, p, d] of HARM.x) x += A * Math.exp(-d * tau) * Math.sin(f * tau + p);
      for (const [A, f, p, d] of HARM.y) y += A * Math.exp(-d * tau) * Math.sin(f * tau + p);
      hx[i] = cx + x * k; hy[i] = cy + y * k;
    }
    /* the record's ring text: the reel's words, repeated round the circle if short */
    const R = g.R || {};
    let rec = fill(s.record, { bpm: Math.round(R.bpm || 111), brand: R.brand || "", edition: R.edition || "" }).toUpperCase().replace(/\s+/g, " ").trim();
    if (!/·$/.test(rec)) rec += " ·";
    let ring = rec + " ";
    while ([...ring].length < 36) ring += rec + " ";
    return {
      shots, k, cx, cy, hx, hy, N, ring: [...ring],
      grounds: Object.assign({}, GROUND, s.grounds), titles: Object.assign({}, TITLES, s.titles), readouts: Object.assign({}, READOUTS, s.readouts),
      anchor: [cx, cy],
    };
  },
  draw(g, s, t) {
    const _ = s._, n = _.shots.length;
    const i = Math.max(0, Math.min(n - 1, Math.floor((t.bq + 1e-6) / s.per))), shot = _.shots[i];
    const u = Math.max(0, (t.b - i * s.per) * K), uq = Math.max(0, (t.bq - i * s.per) * K);
    const ground = _.grounds[shot], bg = g.col(ground), fg = g.on(ground);
    _.hudBg = ground;
    g.ctx.fillStyle = bg; g.ctx.fillRect(0, 0, g.W, g.H);
    const o = { cx: _.cx, cy: _.cy, k: _.k, bg, fg };
    const vars = SHOTS[shot](g, s, u, uq, o);
    panel(g, s, i, n, shot, bg, vars);
  },
});

/* ------------------------------------------------------------------ the six instruments */

const SHOTS = {
  target(g, s, u, uq, { cx, cy, k, fg }) {
    const ctx = g.ctx, lam = 112 * k, band = 48 * k, far = Math.hypot(Math.max(cx, g.W - cx), Math.max(cy, g.H - cy)) + lam;
    /* inner edges at φ + λn; the innermost (n ≤ 0) stays out until the kick has landed */
    const phi = (14 + 100 * kick(u, 0.026) + 90 * u) * k, nMin = u < 0.085 ? 1 : -Math.ceil(phi / lam);
    ctx.save(); ctx.fillStyle = fg; ctx.beginPath();
    for (let q = nMin, r = phi + nMin * lam; r < far; q++, r += lam) {
      const r0 = Math.max(0, r), r1 = r + band;
      if (r1 <= 0) continue;
      ctx.moveTo(cx + r1, cy); ctx.arc(cx, cy, r1, 0, TAU);
      if (r0 > 0) { ctx.moveTo(cx + r0, cy); ctx.arc(cx, cy, r0, 0, TAU, true); }
    }
    ctx.fill("evenodd"); ctx.restore();
    const pr = (279 - 148 * Math.exp(-u / 0.038)) * k, pa = 1 - u / 0.21;
    if (pa > 0) g.ring(cx, cy, pr, g.c.accent, 3 * k, pa);
    g.circle(cx, cy, pop(POP.target, u) * k, g.c.accent);
    return { lambda: 112, r: (177 + 96 * kick(uq, 0.065)).toFixed(1) };
  },
  sun(g, s, u, uq, { cx, cy, k, fg }) {
    const ctx = g.ctx, rot = (q) => 360 - 14.4 * Math.exp(-q / 0.03) + 54 * q, a0 = rot(u) * DEG, r0 = 150 * k;
    ctx.save(); ctx.fillStyle = fg; ctx.beginPath();
    for (let j = 0; j < 24; j++) {
      const a = a0 + j * 15 * DEG, long = j % 2 === 0, L = (long ? 1255 : 785) * k, w = (long ? 19 : 14.5) * k;
      const ux = Math.cos(a), uy = Math.sin(a);
      ctx.moveTo(cx + ux * r0 - uy * w, cy + uy * r0 + ux * w); ctx.lineTo(cx + ux * L, cy + uy * L); ctx.lineTo(cx + ux * r0 + uy * w, cy + uy * r0 - ux * w); ctx.closePath();
    }
    ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 172 * k, 0, TAU); ctx.arc(cx, cy, r0, 0, TAU, true); ctx.fill();
    ctx.restore();
    g.circle(cx, cy, pop(POP.sun, u) * k, g.c.accent);
    return { n: 24, rot: rot(uq).toFixed(1) };
  },
  dots(g, s, u, uq, { cx, cy, k, fg }) {
    const ctx = g.ctx, step = 88 * k, P = -0.16 - 33.7 * u, cols = Math.round(g.W / step) + 1, rows = Math.round(g.H / step) + 1;
    const i0 = Math.ceil((cx + 30 * k) / step), i1 = Math.ceil((g.W - cx + 30 * k) / step), j0 = Math.ceil((cy + 30 * k) / step), j1 = Math.ceil((g.H - cy + 30 * k) / step);
    ctx.save(); ctx.fillStyle = fg; ctx.beginPath();
    for (let j = -j0; j <= j1; j++) for (let i = -i0; i <= i1; i++) {
      const r = Math.min(27, 15.2 + 10.8 * Math.sin(Math.hypot(1.16 * i, 2.645 * j) + P)) * k;
      if (r < 0.4) continue;
      const x = cx + i * step, y = cy + j * step;
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fill(); ctx.restore();
    g.circle(cx, cy, pop(POP.dots, u) * k, g.c.paper);
    return { cols, rows };
  },
  orbit(g, s, u, uq, { cx, cy, k, fg }) {
    const ctx = g.ctx, line = g.mix(fg, "#ffffff", 0.45), OA = 640, OB = 230, IA = 350, IB = 150;
    const sc = 1 - 0.28 * Math.exp(-u / 0.04), tw = 15 * DEG * Math.exp(-u / 0.04);
    /* the big dotted orbit and its sun moon, outside the camera */
    const BA = 1100 * k, BB = 260 * k, bt = 30.6 * DEG;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(bt);
    ctx.strokeStyle = g.rgba(line, 0.32); ctx.lineWidth = 1.6 * k; ctx.lineCap = "round"; ctx.setLineDash([0, 15 * k]);
    ctx.beginPath(); ctx.ellipse(0, 0, BA, BB, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    const ty = 1.11 + 5.2 * Math.max(0, u - 0.045);
    g.circle(BA * Math.cos(ty), BB * Math.sin(ty), 9 * k, g.c.sun, ctx);
    ctx.restore();
    const cam = () => { ctx.translate(cx, cy); ctx.rotate(tw); ctx.scale(sc, sc); };
    const ell = (a, b, tilt, a0, a1) => { ctx.save(); ctx.rotate(tilt); ctx.beginPath(); ctx.ellipse(0, 0, b * k, a * k, 0, a0, a1); ctx.stroke(); ctx.restore(); };
    const at = (a, b, tilt, th) => { const x = b * k * Math.cos(th), y = a * k * Math.sin(th), c = Math.cos(tilt), sn = Math.sin(tilt); return [x * c - y * sn, x * sn + y * c]; };
    const moon = (x, y, r, col, glow) => {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r * (glow ? 2.2 : 1.15));
      if (glow) { gr.addColorStop(0, col); gr.addColorStop(0.4, col); gr.addColorStop(0.47, g.rgba(col, 0.35)); gr.addColorStop(1, g.rgba(col, 0)); }
      else { gr.addColorStop(0, col); gr.addColorStop(0.8, col); gr.addColorStop(1, g.rgba(col, 0)); }
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r * (glow ? 2.2 : 1.15), 0, TAU); ctx.fill();
    };
    const ti = 40 * DEG, wth = Math.PI / 2 + 0.66 - 19.8 * u, [wx, wy] = at(IA, IB, ti, wth), behind = Math.cos(wth) > 0;
    ctx.save(); cam();
    ctx.strokeStyle = g.rgba(line, 0.9); ctx.lineWidth = 2.6 * k;
    ell(OA, OB, 6.6 * DEG, 0, TAU);
    ell(IA, IB, ti, -Math.PI / 2, Math.PI / 2);
    if (behind) moon(wx, wy, 22 * k, line, true);
    ctx.restore();
    g.circle(cx, cy, pop(POP.orbit, u) * k, g.c.paper);
    ctx.save(); cam();
    ctx.strokeStyle = g.rgba(line, 0.9); ctx.lineWidth = 2.6 * k;
    ell(IA, IB, ti, Math.PI / 2, Math.PI * 1.5);
    if (!behind) moon(wx, wy, 22 * k, line, true);
    const [px, py] = at(OA, OB, 6.6 * DEG, Math.PI / 2 + 15 * (u - 0.067));
    moon(px, py, 38 * k, g.c.blush, false);
    ctx.restore();
    return { a: OA, b: OB, e: Math.sqrt(1 - (OB / OA) ** 2).toFixed(2), w: (15).toFixed(1) };
  },
  harmonograph(g, s, u, uq, { cx, cy, k, fg }) {
    const ctx = g.ctx, _ = s._, N = _.N, box = g.box;
    /* the pen's pace: the original's for a half-beat shot, as many times slower as the shot is longer */
    const tau = 0.045 * Math.max(1, s.per / 0.5), reveal = (q) => 1 - 0.7 * Math.exp(-q / tau), z = 1 + 0.035 * Math.exp(-u / 0.035);
    /* the HUD box, dashed */
    ctx.save(); ctx.strokeStyle = g.rgba(fg, 0.14); ctx.lineWidth = 1.2; ctx.setLineDash([5, 5]);
    ctx.strokeRect(box.x + 1.5, box.y + 0.5, box.w - 3, box.h - 1); ctx.restore();
    const head = (q) => { const f = reveal(q) * (N - 1), j = Math.min(N - 2, Math.floor(f)), r = f - j; return [j, _.hx[j] + (_.hx[j + 1] - _.hx[j]) * r, _.hy[j] + (_.hy[j + 1] - _.hy[j]) * r]; };
    const [j, x, y] = head(u), X = cx + (x - cx) * z, Y = cy + (y - cy) * z;
    /* the crosshair through the pen */
    g.line(0, Y, g.W, Y, fg, 1, 0.12); g.line(X, 0, X, g.H, fg, 1, 0.12);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(z, z); ctx.translate(-cx, -cy);
    ctx.strokeStyle = fg; ctx.lineWidth = 3 * k / z; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(_.hx[0], _.hy[0]);
    for (let q = 1; q <= j; q++) ctx.lineTo(_.hx[q], _.hy[q]);
    ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
    g.circle(X, Y, 19 * k, g.c.accent); g.ring(X, Y, 27 * k, fg, 1.5, 0.6);
    const [, qx, qy] = head(uq), zq = 1 + 0.035 * Math.exp(-uq / 0.035);
    return { ratio: (2 * HARM.x[0][1]).toFixed(2), x: pad(cx + (qx - cx) * zq, 4), y: pad(cy + (qy - cy) * zq, 4) };
  },
  vinyl(g, s, u, uq, { cx, cy, k, bg, fg }) {
    const ctx = g.ctx, _ = s._, S = pop(POP.vinyl, u), R = 480 * k * S, th = 3.49 * u + 0.96 * kick(u, 0.0335), acc = g.c.accent, onAcc = g.on("accent");
    /* the disc, its grooves, its rim and two fixed reflections */
    g.circle(cx, cy, R, g.mix(bg, fg, 0.055));
    ctx.save(); ctx.strokeStyle = g.rgba(fg, 0.035); ctx.lineWidth = 1; ctx.beginPath();
    for (let r = 170 * k * S; r < R - 6; r += 7.5 * k * S) { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, TAU); }
    ctx.stroke(); ctx.restore();
    g.ring(cx, cy, R - 1.5, fg, 2.5 * k, 0.08);
    const sh = ctx.createConicGradient(0, cx, cy), a = (d) => d / 360, w = 24, pk = g.rgba(fg, 0.15), no = g.rgba(fg, 0);
    sh.addColorStop(0, no); sh.addColorStop(a(150 - w), no); sh.addColorStop(a(150), pk); sh.addColorStop(a(150 + w), no); sh.addColorStop(a(330 - w), no); sh.addColorStop(a(330), pk); sh.addColorStop(a(330 + w), no); sh.addColorStop(1, no);
    ctx.save(); ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.arc(cx, cy, 165 * k * S, 0, TAU, true); ctx.fill("evenodd"); ctx.restore();
    /* the label: a dark band, the accent disc, a hairline, the ring text, the spindle; all turning */
    g.circle(cx, cy, 161 * k * S, bg);
    g.circle(cx, cy, 153 * k * S, acc);
    g.ring(cx, cy, 146 * k * S, onAcc, 1, 0.45);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(th);
    const L = _.ring, m = L.length, size = Math.min(17, (17 * 47) / m) * k * S;
    ctx.font = g.font("mono", size, 700); ctx.fillStyle = g.rgba(onAcc, 0.85); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.letterSpacing = "0px";
    for (let q = 0; q < m; q++) { if (L[q] === " ") continue; ctx.save(); ctx.rotate((q / m) * TAU); ctx.fillText(L[q], 0, -127 * k * S); ctx.restore(); }
    g.circle(0, 0, 12 * k * S, onAcc, ctx); g.circle(0, 0, 5.5 * k * S, acc, ctx); g.circle(-3 * k * S, 5 * k * S, 6.5 * k * S, g.c.paper, ctx);
    ctx.fillStyle = onAcc; ctx.save(); ctx.translate(-23 * k * S, 2 * k * S); ctx.rotate(Math.PI / 4); ctx.fillRect(-3.5 * k * S, -3.5 * k * S, 7 * k * S, 7 * k * S); ctx.restore();
    ctx.restore();
    /* the tonearm: pivot top right, the arm swinging in over the grooves */
    const px = cx + 399 * k, py = cy - 640 * k, an = armAt(u) * DEG, ex = px + Math.cos(an) * 530 * k, ey = py + Math.sin(an) * 530 * k, cream = g.mix(g.c.paper, fg, 0.5);
    g.line(px, py, ex, ey, cream, 6 * k);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(an - Math.PI / 2 + 20 * DEG); ctx.fillStyle = cream; ctx.fillRect(-11 * k, -6 * k, 22 * k, 30 * k); ctx.restore();
    g.circle(px, py, 37 * k, cream); g.circle(px, py, 12 * k, bg);
    return { w: (3.49 + 15.4 * Math.exp(-uq / 0.1)).toFixed(2) };
  },
};

/* ------------------------------------------------------------------ the readout panel */

/* the HUD's ink for this ground (the engine's rule), and the panel's alphas measured per theme */
/* ------------------------------------------------------------------ four more: order to noise */

/* a lattice of dots over the frame, each with its own random numbers, built once */
const sites = (g, cx, cy, k) => {
  const step = 58 * k, out = [], nx = Math.ceil(g.W / step / 2) + 1, ny = Math.ceil(g.H / step / 2) + 1;
  for (let j = -ny; j <= ny; j++) for (let i = -nx; i <= nx; i++) out.push([cx + i * step, cy + j * step, g.hash(i, j, 1), g.hash(i, j, 2), g.hash(i, j, 3)]);
  return out;
};
const disc = (g, cx, cy, u, R, col) => g.circle(cx, cy, pop([R, 0.5, 29, 0.32], u), col);
Object.assign(SHOTS, {
  /* order: a perfect lattice kicks in from 1.1× and settles; the accent disc springs in */
  grid(g, s, u, uq, { cx, cy, k, fg }) {
    const L = (s._.sites = s._.sites || sites(g, cx, cy, k)), sc = 1 + 0.1 * Math.exp(-u / 0.04), path = new Path2D(), r = 7 * k;
    for (const [x, y] of L) { const X = cx + (x - cx) * sc, Y = cy + (y - cy) * sc; path.moveTo(X + r, Y); path.arc(X, Y, r, 0, TAU); }
    g.ctx.fillStyle = fg; g.ctx.fill(path);
    disc(g, cx, cy, u, 118 * k, g.c.accent);
    return { n: L.length };
  },
  /* heat: the same lattice, every site shaking harder (noise), the disc trembling with it */
  jitter(g, s, u, uq, { cx, cy, k, fg }) {
    const L = (s._.sites = s._.sites || sites(g, cx, cy, k)), A = (10 + 46 * Math.min(1, u / 0.8)) * k, w = 14, path = new Path2D(), r = 7 * k, n3 = g.noise3;
    for (const [x, y, a] of L) { const X = x + A * n3(a * 40, u * w, 0.5), Y = y + A * n3(a * 40, u * w, 7.7); path.moveTo(X + r, Y); path.arc(X, Y, r, 0, TAU); }
    g.ctx.fillStyle = fg; g.ctx.fill(path);
    disc(g, cx + A * 0.5 * n3(1, u * w, 3), cy + A * 0.5 * n3(2, u * w, 3), u, 118 * k, g.c.accent);
    return { sigma: (A / (58 * k)).toFixed(2) };
  },
  /* gas: the sites gone anywhere, drifting apart in a random walk */
  scatter(g, s, u, uq, { cx, cy, k, fg }) {
    const L = (s._.sites = s._.sites || sites(g, cx, cy, k)), path = new Path2D(), n3 = g.noise3, spread = 1 + 0.6 * u;
    for (const [x, y, a, b, c] of L) {
      const X = cx + (a - 0.5) * g.W * 1.1 * spread + 90 * n3(a * 30, u * 3, 1), Y = cy + (b - 0.5) * g.H * 1.1 * spread + 90 * n3(b * 30, u * 3, 2), r = (3 + 10 * c) * k;
      path.moveTo(X + r, Y); path.arc(X, Y, r, 0, TAU);
    }
    g.ctx.fillStyle = fg; g.ctx.fill(path);
    disc(g, cx, cy, u, 96 * k, g.c.ink === fg ? g.c.paper : g.c.ink);
    return { n: L.length, r: (spread * 100).toFixed(0) };
  },
  /* noise: television static, a new picture every frame, torn by a bright rolling bar */
  static(g, s, u, uq, { cx, cy, k }) {
    const ctx = g.ctx, cell = 9, f = Math.floor(uq * 120), levels = [new Path2D(), new Path2D(), new Path2D()];
    for (let y = 0; y < g.H; y += cell) for (let x = 0; x < g.W; x += cell) { const h = g.hash(x, y, f); if (h > 0.45) levels[h > 0.85 ? 2 : h > 0.65 ? 1 : 0].rect(x, y, cell, cell); }
    ["#3a3a3a", "#8a8a8a", "#e8e8e8"].forEach((c2, q) => { ctx.fillStyle = c2; ctx.fill(levels[q]); });
    const by = ((u * 1.7) % 1) * (g.H + 300) - 150;
    ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(0, by, g.W, 90);
    if (Math.floor(uq * 30) % 3) disc(g, cx, cy, u, 70 * k, g.c.accent);
    return { n: "10²³" };
  },
});

/* ------------------------------------------------------------------ and four fractals, each a dive */

/* the dive of a shot: a kick in from 1.2× (as every shot), then a steady zoom by rate e-folds a second */
const dive = (u, rate) => (1 + 0.2 * Math.exp(-u / 0.05)) * Math.exp(rate * u);
Object.assign(SHOTS, {
  /* Sierpinski: ink triangles on the ground, zooming into the bottom-left corner (it is the same at 2×) */
  sierpinski(g, s, u, uq, { cx, cy, k, fg }) {
    const z = dive(u, 1.2), T = g.W * 1.5 * k, A = [cx - T / 2, cy + T * 0.43], B = [cx + T / 2, cy + T * 0.43], C = [cx, cy - T * 0.43];
    const at = [cx - T * 0.32, cy + T * 0.28], map = ([x, y]) => [at[0] + (x - at[0]) * z, at[1] + (y - at[1]) * z], path = new Path2D();
    const tri = (a, b, c, d) => {
      const [p, q, r] = [a, b, c].map(map), sz = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (Math.max(p[0], q[0], r[0]) < 0 || Math.min(p[0], q[0], r[0]) > g.W || Math.max(p[1], q[1], r[1]) < 0 || Math.min(p[1], q[1], r[1]) > g.H) return;
      if (d === 0 || sz < 6) { path.moveTo(...p); path.lineTo(...q); path.lineTo(...r); path.closePath(); return; }
      const ab = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], bc = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2], ca = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2];
      tri(a, ab, ca, d - 1); tri(ab, b, bc, d - 1); tri(ca, bc, c, d - 1);
    };
    tri(A, B, C, 9);
    g.ctx.fillStyle = fg; g.ctx.fill(path);
    return { z: z.toFixed(2) };
  },
  /* the Heighway dragon: folding out along its length, gold to accent, turning as the camera closes in */
  dragon(g, s, u, uq, { cx, cy, k }) {
    const D = (s._.dragon = s._.dragon || (() => {
      const n = 1 << 13, pts = [[0, 0]];
      let x = 0, y = 0, dir = 0;
      for (let i = 1; i <= n; i++) { x += [1, 0, -1, 0][dir]; y += [0, 1, 0, -1][dir]; pts.push([x, y]); dir = (dir + ((((i & -i) << 1) & i) ? 3 : 1)) % 4; }
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [a, b] of pts) { x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); }
      return { pts, c: [(x0 + x1) / 2, (y0 + y1) / 2], r: Math.max(x1 - x0, y1 - y0) / 2 };
    })());
    const z = dive(u, 0.9), sc = ((g.W * 0.85) / D.r) * z * k, rot = 0.6 * u, cs = Math.cos(rot), sn = Math.sin(rot), upTo = Math.floor(D.pts.length * Math.min(1, 0.35 + u * 1.3));
    const ctx = g.ctx, chunks = 14, per = Math.ceil(upTo / chunks);
    ctx.save(); ctx.lineWidth = Math.max(3, 3.4 * z); ctx.lineJoin = "round"; ctx.lineCap = "round";
    for (let c = 0; c < chunks; c++) {
      const a = c * per, b = Math.min(upTo, a + per + 1);
      if (b - a < 2) continue;
      ctx.beginPath();
      for (let i = a; i < b; i++) { const [x, y] = D.pts[i], dx = (x - D.c[0]) * sc, dy = (y - D.c[1]) * sc; const X = cx + dx * cs - dy * sn, Y = cy + dx * sn + dy * cs; i === a ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); }
      ctx.strokeStyle = g.mix(g.c.sun, g.c.accent, c / (chunks - 1)); ctx.stroke();
    }
    ctx.restore();
    return { n: 13, z: z.toFixed(2) };
  },
  /* the Barnsley fern: 40 000 points, closing in on a frond near its tip */
  fern(g, s, u, uq, { cx, cy, k }) {
    const F = (s._.fern = s._.fern || (() => {
      const r = g.rng(5), out = new Float32Array(80000);
      let x = 0, y = 0;
      for (let i = 0; i < 40000; i++) {
        const p = r(); let nx, ny;
        if (p < 0.01) { nx = 0; ny = 0.16 * y; } else if (p < 0.86) { nx = 0.85 * x + 0.04 * y; ny = -0.04 * x + 0.85 * y + 1.6; } else if (p < 0.93) { nx = 0.2 * x - 0.26 * y; ny = 0.23 * x + 0.22 * y + 1.6; } else { nx = -0.15 * x + 0.28 * y; ny = 0.26 * x + 0.24 * y + 0.44; }
        x = nx; y = ny; out[i * 2] = x; out[i * 2 + 1] = y;
      }
      return out;
    })());
    /* screen = centre + sc·z·(p − P): P slides from the fern's middle to a frond near the top as it closes in */
    const z = dive(u, 1.1), sc = (g.H / 11) * k, e = 1 - 1 / z, Px = 0.25 + (1.75 - 0.25) * e, Py = 5 + (8.1 - 5) * e, ctx = g.ctx, lo = new Path2D(), hi = new Path2D();
    for (let i = 0; i < 40000; i++) {
      const X = cx + (F[i * 2] - Px) * sc * z, Y = cy - (F[i * 2 + 1] - Py) * sc * z;
      if (X < -4 || X > g.W + 4 || Y < -4 || Y > g.H + 4) continue;
      (F[i * 2 + 1] > 6.5 ? hi : lo).rect(X - 1.2, Y - 1.2, 2.4, 2.4);
    }
    ctx.fillStyle = g.c.sun; ctx.fill(lo); ctx.fillStyle = g.c.accent; ctx.fill(hi);
    return { n: "40k", z: z.toFixed(2) };
  },
  /* the Mandelbrot set, computed every frame at a fifth of the frame and smoothed up, diving into the seahorse valley */
  mandelbrot(g, s, u, uq, { k }) {
    const M = (s._.mb = s._.mb || (() => { const w = 216, h = 384, cv = document.createElement("canvas"); cv.width = w; cv.height = h; const x = cv.getContext("2d", { willReadFrequently: true }); return { w, h, cv, x, img: x.createImageData(w, h) }; })());
    const z = dive(u, 2.1), span = 0.9 / z, X0 = -0.743643887037151, Y0 = 0.13182590420533, it = Math.min(420, Math.round(90 + 60 * Math.log(z + 1)));
    const pal = [g.c.deep, g.c.cool, g.c.accent, g.c.sun, g.c.paper].map((c2) => g.hex(c2)), d = M.img.data, aspect = M.h / M.w;
    for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) {
      const cr = X0 + ((i / M.w) - 0.5) * span, ci = Y0 + ((j / M.h) - 0.5) * span * aspect;
      let x = 0, y = 0, n = 0;
      while (n < it && x * x + y * y < 16) { const t2 = x * x - y * y + cr; y = 2 * x * y + ci; x = t2; n++; }
      const o = (j * M.w + i) * 4;
      if (n >= it) { d[o] = pal[0][0]; d[o + 1] = pal[0][1]; d[o + 2] = pal[0][2]; d[o + 3] = 255; continue; }
      const sm = n + 1 - Math.log2(Math.log2(x * x + y * y) / 2), q = (Math.sqrt(sm) * 0.55) % 4, a = Math.floor(q), f = q - a, A = pal[1 + (a % 4 === 3 ? 3 : a % 4)], B = pal[1 + ((a + 1) % 4 === 3 ? 3 : (a + 1) % 4)];
      d[o] = A[0] + (B[0] - A[0]) * f; d[o + 1] = A[1] + (B[1] - A[1]) * f; d[o + 2] = A[2] + (B[2] - A[2]) * f; d[o + 3] = 255;
    }
    M.x.putImageData(M.img, 0, 0);
    const ctx = g.ctx; ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(M.cv, 0, 0, g.W, g.H); ctx.restore();
    return { z: z < 1000 ? z.toFixed(1) : z.toExponential(1) };
  },
});

function panel(g, s, i, n, shot, bg, vars) {
  const _ = s._, box = g.box, dark = g.luma(bg) > 0.2, ink = dark ? g.c.ink : g.c.paper;
  const A = dark ? { l1: 0.56, l2: 0.31, ro: 0.53, on: 0.78, off: 0.42 } : { l1: 0.72, l2: 0.41, ro: 0.71, on: 0.85, off: 0.5 };
  const x0 = box.x + 27.5, x1 = box.r - 29.5, T = { kind: "mono", size: 15, track: 2, color: ink };
  g.text(`${s.label}  ${String(i + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`, x0, box.y + 64.5, Object.assign({}, T, { weight: 700, alpha: A.l1 }));
  g.text(fill(_.titles[shot], vars), x0, box.y + 88.5, Object.assign({}, T, { weight: 500, alpha: A.l2 }));
  g.text(fill(_.readouts[shot], vars), x1, box.b - 57, Object.assign({}, T, { weight: 500, alpha: A.ro, align: "right" }));
  const ctx = g.ctx, y = box.b - 69;
  ctx.save();
  for (let q = 0; q < n; q++) {
    const x = x0 + q * 22;
    if (q === i) { ctx.fillStyle = g.rgba(ink, A.on); ctx.fillRect(x, y, 14, 14); }
    else { ctx.strokeStyle = g.rgba(ink, A.off); ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.75, y + 0.75, 12.5, 12.5); }
  }
  ctx.restore();
}
})();
