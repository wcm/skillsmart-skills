/*
 * Shape morph, dressed as a design tool (an After Effects / Figma shape editor on near-black).
 * Every quantity is a closed-form function of the beat: springs are evaluated, not integrated.
 *
 *   b -0.08     the accent dot of the scene before springs (3.8 Hz, ζ .52) into the first shape at the
 *               centre; on the cut it is already half grown and blurred, so the dot hand-off is one move.
 *   b 0.02–0.17 the editor fades in: LAYERS row (one cell per shape), dial with fixed ticks and an
 *               accent ROT arc, crosshair, rotated bounding box (W×H + 28 px) with 8 handles and a
 *               rotation stem, 8 bezier anchors with handle pairs on the outline, TRANSFORM readout
 *               (ROT / SHAPE / W × H / SCALE / FILL, live), keyframe track with an accent playhead
 *               that runs linearly across the whole scene. The shape drifts clockwise (spin deg/s).
 *   each next shape i (keyframe at i/n of the scene): 0.10 b before the playhead reaches it the
 *               outline morphs as r(θ) (240 samples) on a kicked spring that overshoots (the triangle
 *               goes concave), the rotation springs (5 Hz), the scale pops ~7%, the fill lerps in RGB
 *               (the hex follows); 0.06 b before, the layer highlight jumps; at the crossing the
 *               keyframe diamond and the layer icon fill. Two lagged copies (0.083 s / 0.05 s,
 *               offset down-left / right) in other palette colours sit behind as chromatic echoes.
 *   last shape  the rotation swings past its angle and eases onto it; the drift stops there.
 *   b 1.75–1.84 the UI fades out (linear). b 1.78–1.99 the outro: the shape spins up (720°, nearly
 *               all in the last frames, so the engine's motion blur turns it into a halo), its fill
 *               lerps to the accent, the echoes fade, and from b 1.9 it rounds into a circle and
 *               shrinks: a crisp accent dot (r≈31) at the centre on the last frame, for the next scene.
 *
 * Shapes are any shape specs. circle / triangle / square / hexagon / poly-N / star-N get the
 * original's exact profiles (rounded polygons, concave-flanked stars); anything else (an svg
 * path, text:K) is ray-cast into r(θ) by g.radial. Without turns, each shape settles at an
 * angle that suits its own symmetry (a letter ends upright, a 12-point star 3° off).
 */
(() => {
const N = 240, DEG = Math.PI / 180, TAU = Math.PI * 2;
/* timing, in beats, relative to the playhead crossing a keyframe (the original's) */
const PH = 0.011, KICK = 0.1, RKICK = 0.12, RLAST = 0.116, SEL = 0.06;
/* sizes, in units of the circle's radius (321 px at 100%) */
const TIP = 352 / 321, CORNER = 40 / 321, DOT = 31 / 321;
const LABELS = { layers: "LAYERS", items: "ITEMS", transform: "TRANSFORM", rot: "ROT", shape: "SHAPE", size: "W × H", scale: "SCALE", fill: "FILL", ease: "EASE" };

Reel.scene("morph", {
  label: "SHAPE",
  bg: "ink",
  beats: 2,
  params: {
    shapes: ["circle", "triangle", "star-12"], /* 2–4 shape specs, simplest first: circle, triangle, square, hexagon, poly-N, star-N, text:A, { d, view } */
    names: ["CIRCLE", "TRIANGLE", "STAR·12"], /* the layer names, shown in the LAYERS row and the SHAPE readout */
    fills: ["accent", "sun", "cool"], /* a fill per shape (palette roles); the hex readout shows the live RGB lerp */
    echoes: null, /* echo colours per shape, [left, right] pairs or roles; null = the other fills, the last shape's left one is `echo` */
    echo: "blush", /* the spare colour for the last shape's left echo */
    turns: null, /* angle (deg, clockwise) each shape springs to, on top of the drift; the last is exact. null = from each shape's symmetry (≈ 0, 101, 56.8 here) */
    spin: 38, /* the slow clockwise drift, degrees per second, until the last shape lands */
    labels: LABELS, /* panel words: { layers, items, transform, rot, shape, size, scale, fill, ease }; give only the ones to change */
    formula: "MORPH  r(θ)  N=240", /* footer, left (case kept) */
    ease: "spring(5Hz, ζ15)", /* footer, right, after labels.ease (case kept) */
  },
  prepare(s, g) {
    const box = g.box, n = Math.max(1, s.shapes.length), spb = g.R.spb;
    const tables = s.shapes.map((sh) => analytic(sh) || normalise(g.radial(sh, N)));
    if (!tables.length) tables.push(new Float32Array(N).fill(1));
    /* the layer icons: the same tables, a star softened into a seal as the original's are */
    const exact = s.shapes.map((sh) => !!analytic(sh));
    const icons = tables.map((tb, i) => (typeof s.shapes[i] === "string" && /^star/.test(s.shapes[i]) ? soften(tb, 0.45) : tb));
    const sin = new Float32Array(N), cos = new Float32Array(N);
    for (let j = 0; j < N; j++) { sin[j] = Math.sin((j / N) * TAU); cos[j] = Math.cos((j / N) * TAU); }
    const cross = (i) => (i * s.beats) / n - PH;
    /* the angle each shape settles at */
    let turns = s.turns && s.turns.length >= n ? s.turns.slice(0, n) : null;
    if (!turns) {
      turns = [0];
      for (let i = 1; i < n; i++) {
        const per = period(tables[i]);
        if (i === n - 1) { turns.push(nearest(56.8, -3.2, per)); continue; }
        /* a middle shape: its pose when the next one kicks (drift included) sits 5.9° off its symmetry, as the triangle does */
        const base = turns[i - 1] + (i % 2 ? 100 : -70), drift = s.spin * (cross(i + 1) - (i + 1 === n - 1 ? RLAST : RKICK)) * spb;
        turns.push(nearest(base + drift, 5.9, per) - drift);
      }
    }
    const pairs = Array.from({ length: n }, (_x, i) => echoPair(s, i, n));
    const R0 = Math.min(box.w * 0.3253, box.h * 0.2273);
    return {
      tables, icons, exact, sin, cos, turns, pairs, R0, cx: box.cx, cy: box.cy, labels: Object.assign({}, LABELS, s.labels),
      buf: [new Float32Array(N), new Float32Array(N), new Float32Array(N)],
      anchor: [box.cx, box.cy], anchorR: R0 * DOT,
    };
  },
  draw(g, s, t) {
    const { ctx } = g, _ = s._, b = t.b, B = s.beats, spb = t.spb, n = _.tables.length, L = _.labels;
    const ink = g.on(s.bg), ground = g.col(s.bg), acc = g.c.accent, box = g.box, cx = _.cx, cy = _.cy, R0 = _.R0;
    const cross = (i) => (i * B) / n - PH;
    const lastK = n > 1 ? cross(n - 1) - RLAST : Infinity;
    /* rotation before the last shape: drift plus a spring per middle shape */
    const rotPre = (bb) => {
      let r = _.turns[0] + s.spin * Math.min(bb, lastK) * spb;
      for (let i = 1; i < n - 1; i++) r += (_.turns[i] - _.turns[i - 1]) * kick((bb - cross(i) + RKICK) * spb, 5, 0.45);
      return r;
    };
    /* the whole state of the shape at beat bb: outline into out, scale, rotation (deg), fill; the outro at beat bq */
    const state = (bb, out, bq = bb) => {
      const m = [];
      for (let i = 1; i < n; i++) m.push(kick((bb - cross(i) + KICK) * spb, 3.9, 0.72, 40));
      let sc = kick(bb * spb + 0.0455, 3.8, 0.52);
      let pp = 1;
      for (let i = 1; i < n; i++) pp += 0.07 * pop((bb - cross(i) + KICK) * spb, 0.068);
      sc *= pp;
      let rot = rotPre(bb);
      if (bb > lastK) { const r0 = rotPre(lastK); rot = r0 + (_.turns[n - 1] - r0) * swing((bb - lastK) * spb); }
      /* the outro: spin up, shrink into the dot, round off, turn accent */
      const q = g.seg(bq, B - 0.22, B - 0.011), cb = g.smoothstep(0.55, 0.86, q);
      sc *= 1 - (1 - DOT) * cb;
      rot += 690 * q ** 6 + 30 * q;
      const T = _.tables;
      for (let j = 0; j < N; j++) {
        let r = T[0][j];
        for (let i = 1; i < n; i++) r += m[i - 1] * (T[i][j] - T[i - 1][j]);
        out[j] = r + (1 - r) * cb;
      }
      let fill = g.col(s.fills[0]);
      for (let i = 1; i < n; i++) fill = g.mix(fill, g.col(s.fills[i % s.fills.length]), g.clamp(m[i - 1] / 0.98));
      if (q > 0) fill = g.mix(fill, acc, g.ease.inQuad(g.seg(q, 0.15, 0.86)));
      return { rs: out, sc, rot, q, fill };
    };
    const S = state(b, _.buf[0]);
    const cur = Array.from({ length: n - 1 }, (_x, i) => b >= cross(i + 1) - SEL).filter(Boolean).length;
    const ph = g.clamp((b + PH) / B);
    const uiK = g.smoothstep(0.017, 0.167, b) * (1 - g.seg(b, B - 0.255, B - 0.165));

    /* the panel geometry (design px of the original: 74 → 1004 wide) */
    const lx = box.x + 27.5, rx = box.r - 29, pw = rx - lx, cw = pw / n;

    /* guides: crosshair, dotted circle, dial with fixed ticks, the ROT arc */
    const dialR = R0 * 1.4424, rotDeg = S.rot;
    if (uiK > 0) {
      ctx.save(); ctx.globalAlpha = uiK;
      g.line(box.x + 3.5, cy, box.r - 3.5, cy, ink, 1.5, 0.095);
      g.line(cx, cy - R0 * 1.473, cx, box.b - 205, ink, 1.5, 0.095);
      ctx.setLineDash([2, 6]); g.ring(cx, cy, R0 * 0.995, ink, 1.2, 0.13); g.ring(cx, cy, dialR, ink, 1.2, 0.13); ctx.setLineDash([]);
      ctx.strokeStyle = g.rgba(ink, 0.2); ctx.lineWidth = 1.5; ctx.beginPath();
      for (let k = 0; k < 72; k++) {
        const a = k * 5 * DEG, r1 = dialR - (k % 6 ? 7 : 16), r2 = dialR - 1;
        ctx.moveTo(cx + r1 * Math.sin(a), cy - r1 * Math.cos(a)); ctx.lineTo(cx + r2 * Math.sin(a), cy - r2 * Math.cos(a));
      }
      ctx.stroke();
      const sweep = Math.max(-359.9, Math.min(359.9, rotDeg)) * DEG, a0 = -Math.PI / 2;
      ctx.strokeStyle = acc; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(cx, cy, dialR, a0, a0 + sweep, sweep < 0); ctx.stroke();
      g.circle(cx + dialR * Math.cos(a0 + sweep), cy + dialR * Math.sin(a0 + sweep), 6, acc);
      ctx.restore();
    }

    /* echoes: the shape a moment ago, offset, in other colours, under it; they ride the outro's spin and shrink almost in step */
    const echoK = 0.92 * (1 - g.smoothstep(0.55, 0.8, S.q)), pair = _.pairs[Math.min(cur, n - 1)];
    if (echoK > 0.01) {
      [[0.083, -19, 18, pair[0], 1], [0.05, 22, 10, pair[1], 2]].forEach(([lag, dx, dy, col, k]) => {
        const E = state(b - lag / spb, _.buf[k], b - (lag * 0.3) / spb);
        if (E.sc <= 0.004) return;
        ctx.save(); ctx.globalAlpha = echoK; ctx.fillStyle = g.col(col); ctx.beginPath();
        g.radialPath(E.rs, cx + dx, cy + dy, R0 * E.sc, E.rot * DEG); ctx.fill(); ctx.restore();
      });
    }
    /* the shape */
    if (S.sc > 0.002) { ctx.save(); ctx.fillStyle = S.fill; ctx.beginPath(); g.radialPath(S.rs, cx, cy, R0 * S.sc, S.rot * DEG); ctx.fill(); ctx.restore(); }

    /* the size of the local outline, for the box and the readout */
    let W = 0, H = 0;
    for (let j = 0; j < N; j++) { const r = S.rs[j] * S.sc * R0; W = Math.max(W, Math.abs(r * _.sin[j])); H = Math.max(H, Math.abs(r * _.cos[j])); }
    W *= 2; H *= 2;

    if (uiK > 0) {
      ctx.save(); ctx.globalAlpha = uiK;
      /* the bounding box, rotated, with 8 handles and the rotation stem */
      const hw = W / 2 + 28, hh = H / 2 + 28;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rotDeg * DEG);
      ctx.strokeStyle = g.rgba(ink, 0.6); ctx.lineWidth = 1.8; ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
      ctx.strokeStyle = g.rgba(ink, 0.62); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(0, -hh - 6.5); ctx.lineTo(0, -hh - 53); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -hh - 62, 9, 0, TAU); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = g.rgba(ink, 0.82); ctx.fillStyle = ground;
      for (const [hx, hy] of [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]]) { ctx.fillRect(hx * hw - 6.5, hy * hh - 6.5, 13, 13); ctx.strokeRect(hx * hw - 6.5, hy * hh - 6.5, 13, 13); }
      ctx.restore();
      /* bezier anchors on the outline, with their handles along the tangent */
      if (S.sc > 0.2) {
        const R = R0 * S.sc, ra = rotDeg * DEG;
        const at = (j) => { j = (j + N) % N; const a = (j / N) * TAU + ra, r = S.rs[j] * R; return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; };
        const pts = [];
        for (let k = 0; k < 8; k++) {
          const j = 15 + 30 * k, [x, y] = at(j), [x1, y1] = at(j - 1), [x2, y2] = at(j + 1), d = Math.hypot(x2 - x1, y2 - y1) || 1;
          pts.push([x, y, ((x2 - x1) / d) * 50, ((y2 - y1) / d) * 50]);
        }
        ctx.strokeStyle = g.rgba(ink, 0.7); ctx.lineWidth = 1.2; ctx.beginPath();
        for (const [x, y, tx, ty] of pts) { ctx.moveTo(x - tx, y - ty); ctx.lineTo(x + tx, y + ty); }
        ctx.stroke();
        ctx.fillStyle = ink; ctx.beginPath();
        for (const [x, y, tx, ty] of pts) { ctx.moveTo(x - tx + 4, y - ty); ctx.arc(x - tx, y - ty, 4, 0, TAU); ctx.moveTo(x + tx + 4, y + ty); ctx.arc(x + tx, y + ty, 4, 0, TAU); }
        ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = ink; ctx.fillStyle = ground;
        for (const [x, y] of pts) { ctx.fillRect(x - 6, y - 6, 12, 12); ctx.strokeRect(x - 6, y - 6, 12, 12); }
      }
      /* the centre marker */
      g.ring(cx, cy, 6.5, ink, 1.5, 0.7); g.line(cx - 18, cy, cx + 18, cy, ink, 1.5, 0.7); g.line(cx, cy - 18, cx, cy + 18, ink, 1.5, 0.7);

      /* LAYERS: a cell per shape, the current one lit, icons fill once the playhead has passed their keyframe */
      const ly = box.y + 51.7, head = { size: 16, weight: 600, track: 3.4, color: ink, alpha: 0.45 };
      g.mono(L.layers, lx, ly, head);
      g.mono(`${String(n).padStart(2, "0")} ${L.items}`, rx - 1, ly, { size: 14, weight: 500, track: 2.4, color: ink, alpha: 0.27, align: "right" });
      g.line(lx, box.y + 62, rx, box.y + 62, ink, 1, 0.11);
      const rowY = box.y + 76.5;
      for (let i = 0; i < n; i++) {
        const x = lx + i * cw, on = i === cur;
        if (on) { ctx.fillStyle = g.rgba(ink, 0.066); ctx.fillRect(x, rowY, cw - 9, 61); ctx.fillStyle = acc; ctx.fillRect(x, rowY - 1, 3, 63); }
        icon(g, s.shapes[i], _.exact[i] && _.icons[i], x + 39, rowY + 30.5, 19, b >= cross(i) ? g.col(s.fills[i % s.fills.length]) : null, ink);
        const name = String(s.names[i] ?? "");
        g.mono(name, x + 74.5, rowY + 37, { size: 17, weight: 600, track: 1.1, color: ink, alpha: on ? 0.89 : 0.39, fit: Math.max(40, cw - 132) });
        g.mono(String(i + 1).padStart(2, "0"), x + cw - 24, rowY + 36, { size: 14, weight: 500, track: 1, color: ink, alpha: 0.26, align: "right" });
      }

      /* TRANSFORM readout */
      const ty = box.b - 216.3;
      g.mono(L.transform, lx, ty, head);
      g.line(lx, box.b - 205, rx, box.b - 205, ink, 1, 0.1);
      const deg = ((rotDeg % 360) + 360) % 360, hex = S.fill.toUpperCase();
      const cols = [[L.rot, deg.toFixed(1).padStart(5, "0") + "°"], [L.shape, String(s.names[Math.min(cur, n - 1)] ?? "")], [L.size, `${Math.round(W)}×${Math.round(H)}`], [L.scale, Math.round(S.sc * 100) + "%"], [L.fill, hex]];
      const step = pw / 5;
      cols.forEach(([k, v], i) => {
        const x = lx + i * step;
        g.mono(k, x, box.b - 177, { size: 14, weight: 500, track: 1.8, color: ink, alpha: 0.34 });
        if (i === 4) { ctx.fillStyle = S.fill; ctx.fillRect(x, box.b - 160, 20, 20); g.mono(v, x + 32, box.b - 140, { size: 20, weight: 500, track: 0.3, color: ink, alpha: 0.78 }); }
        else if (i === 0) g.mono(v, x, box.b - 140, { size: 27, weight: 600, track: 0, color: ink, alpha: 0.97 });
        else g.mono(v, x, box.b - 140, { size: 20, weight: 500, track: 0.3, color: ink, alpha: 0.78, fit: step - 8 });
      });

      /* the keyframe track: 16 steps, a diamond per shape under its cell, the playhead */
      const ky = box.b - 79, kx0 = lx - 0.5, kx1 = rx + 1, kw = kx1 - kx0;
      g.line(kx0, ky, kx1, ky, ink, 1.5, 0.125);
      ctx.strokeStyle = g.rgba(ink, 0.12); ctx.lineWidth = 1.2; ctx.beginPath();
      for (let k = 1; k <= 16; k++) { const x = kx0 + (k * kw) / 16, h = k % 4 ? 5 : 9; ctx.moveTo(x, ky - 0.75); ctx.lineTo(x, ky - h); }
      ctx.stroke();
      const px = kx0 + kw * ph;
      let last = 0;
      for (let i = 0; i < n; i++) if (px >= lx + i * cw) last = i;
      for (let i = 0; i < n; i++) {
        const x = lx + i * cw, seen = px >= x;
        ctx.save(); ctx.translate(x, ky); ctx.rotate(Math.PI / 4);
        if (seen) { const d = (i === last ? 22 : 17) / Math.SQRT2; ctx.fillStyle = g.col(s.fills[i % s.fills.length]); ctx.fillRect(-d / 2, -d / 2, d, d); }
        else { const d = 15 / Math.SQRT2; ctx.strokeStyle = g.rgba(ink, 0.51); ctx.lineWidth = 1.5; ctx.strokeRect(-d / 2, -d / 2, d, d); }
        ctx.restore();
      }
      const body = ctx.createLinearGradient(0, ky - 28, 0, ky + 12);
      body.addColorStop(0, g.rgba(acc, 0.42)); body.addColorStop(1, g.rgba(acc, 0.16));
      ctx.fillStyle = body; ctx.fillRect(px - 3.5, ky - 28, 7, 40);
      ctx.fillStyle = acc; ctx.beginPath(); ctx.moveTo(px - 8, ky - 34.5); ctx.lineTo(px + 8, ky - 34.5); ctx.lineTo(px + 3.5, ky - 28); ctx.lineTo(px - 3.5, ky - 28); ctx.closePath(); ctx.fill();

      /* footer */
      const foot = { kind: "mono", size: 14, weight: 500, track: 1.2, color: ink, alpha: 0.4 };
      g.text(s.formula, lx - 0.5, box.b - 41.6, foot);
      g.text(`${L.ease} ${s.ease}`, rx - 1, box.b - 41.6, Object.assign({}, foot, { align: "right" }));
      ctx.restore();
    }
  },
});

/* closed-form damped spring from 0 to 1, sec after the kick, with initial velocity v0 (per second): overshoots */
function kick(sec, hz, zeta, v0 = 0) {
  if (sec <= 0) return 0;
  const w = TAU * hz, wd = w * Math.sqrt(1 - zeta * zeta), e = Math.exp(-zeta * w * sec);
  return 1 + e * (-Math.cos(wd * sec) + ((v0 - zeta * w) / wd) * Math.sin(wd * sec));
}
/* a pop that rises and decays, 1 at tp seconds */
function pop(sec, tp) { return sec <= 0 ? 0 : (sec / tp) * Math.exp(1 - sec / tp); }
/* the last turn: swings past by `over` in d1 s (sine out), then eases onto 1 in d2 s and stays (no second overshoot) */
function swing(sec, over = 0.356, d1 = 0.107, d2 = 0.133) {
  if (sec <= 0) return 0;
  if (sec < d1) return (1 + over) * Math.sin((sec / d1) * Math.PI / 2);
  const u = Math.min(1, (sec - d1) / d2);
  return 1 + over - over * (0.6 * Math.sin((u * Math.PI) / 2) + 0.2 * (1 - Math.cos(u * Math.PI)));
}

/* r(θ) for the original's shapes, θ clockwise from up, in units of the circle's radius */
function analytic(spec) {
  if (typeof spec !== "string") return null;
  const [kind, arg] = spec.split(/[-:](.*)/s), out = new Float32Array(N);
  if (kind === "circle") return out.fill(1);
  const sides = kind === "triangle" ? 3 : kind === "square" ? 4 : kind === "hexagon" ? 6 : kind === "poly" ? Math.max(3, +arg || 5) : 0;
  if (sides) {
    /* a sharp polygon offset by a corner radius: the triangle has tips at 352 px and sides at 196 px */
    const half = Math.PI / sides, a = (TIP - CORNER) * Math.cos(half), h = a * Math.tan(half), o = CORNER;
    const ph = kind === "square" ? 0 : half; /* the first edge normal: a vertex up, or a flat top for the square */
    for (let j = 0; j < N; j++) {
      let f = ((((j / N) * TAU - ph) % (2 * half)) + 2 * half) % (2 * half);
      if (f > half) f -= 2 * half;
      const c = Math.cos(f), sn = Math.abs(Math.sin(f));
      let r = (a + o) / c;
      if (r * sn > h) { const ud = a * c + h * sn; r = ud + Math.sqrt(Math.max(0, ud * ud - (a * a + h * h) + o * o)); }
      out[j] = r;
    }
    return out;
  }
  if (kind === "star") {
    /* points at TIP, concave flanks: r = in + (out - in)(1 - u)^1.8, u the distance to the nearest point */
    const k = Math.max(3, +arg || 5), half = Math.PI / k, ph = k % 2 ? 0 : half, rin = TIP * (k >= 8 ? 246 / 352 : 0.5);
    for (let j = 0; j < N; j++) {
      let f = ((((j / N) * TAU - ph) % (2 * half)) + 2 * half) % (2 * half);
      const u = Math.min(f, 2 * half - f) / half;
      out[j] = rin + (TIP - rin) * (1 - u) ** 1.8;
    }
    return out;
  }
  return null;
}
/* a ray-cast table (g.radial) scaled so its larger half-extent sits just past the circle's, as the triangle's and the star's do */
function normalise(rs) {
  let ext = 0;
  for (let j = 0; j < N; j++) { const a = (j / N) * TAU; ext = Math.max(ext, Math.abs(rs[j] * Math.sin(a)), Math.abs(rs[j] * Math.cos(a))); }
  return Float32Array.from(rs, (r) => (ext > 0 ? (r / ext) * 1.04 : 1));
}
/* a table pulled toward its mean radius by k (a star becomes a seal) */
function soften(rs, k) {
  let mean = 0;
  for (const r of rs) mean += r / rs.length;
  return Float32Array.from(rs, (r) => mean + (r - mean) * k);
}
/* the rotational period of a table in degrees (Infinity for a circle) */
function period(rs) {
  let lo = Infinity, hi = 0;
  for (const r of rs) { lo = Math.min(lo, r); hi = Math.max(hi, r); }
  if (hi - lo < 0.01 * hi) return Infinity;
  for (const k of [12, 10, 8, 6, 5, 4, 3, 2]) {
    const d = N / k;
    let err = 0;
    for (let j = 0; j < N; j++) err = Math.max(err, Math.abs(rs[j] - rs[(j + d) % N]));
    if (err < 0.025 * hi) return 360 / k;
  }
  return 360;
}
/* the angle nearest to want that sits `off` degrees past the shape's symmetry */
function nearest(want, off, per) {
  if (!isFinite(per)) return want;
  return want + ((((off - want) % per) + per * 1.5) % per) - per / 2;
}
/* the [left, right] echo colours while shape i is current */
function echoPair(s, i, n) {
  const e = s.echoes;
  if (Array.isArray(e) && e.length) {
    const x = e[i % e.length];
    if (Array.isArray(x)) return [x[0], x[1] ?? x[0]];
    return [x, e[(i + 1) % e.length]];
  }
  const own = s.fills[i % s.fills.length], others = [];
  for (let k = 0; k < n; k++) { const f = s.fills[k % s.fills.length]; if (f !== own && !others.includes(f)) others.push(f); }
  if (!others.length) others.push(s.echo);
  const last = i === n - 1 && n > 1;
  return [last && s.echo !== own ? s.echo : others[0], others[others.length - 1]];
}
/* a layer icon: the shape filled in its colour once visited, else a thin outline; table for the exact shapes */
function icon(g, spec, table, x, y, r, fill, ink) {
  const ctx = g.ctx;
  ctx.save();
  ctx.fillStyle = fill || "transparent"; ctx.strokeStyle = g.rgba(ink, 0.35); ctx.lineWidth = 1.5; ctx.lineJoin = "round";
  if (table) { ctx.beginPath(); g.radialPath(table, x, y, r); fill ? ctx.fill() : ctx.stroke(); }
  else if (typeof spec === "string" && spec.startsWith("text:")) {
    ctx.font = g.font("display", r * 1.6); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.letterSpacing = "0px";
    fill ? ctx.fillText(spec.slice(5), x, y + r * 0.06) : ctx.strokeText(spec.slice(5), x, y + r * 0.06);
  } else if (spec && (spec.d || (typeof spec === "string" && /^[Mm]/.test(spec)))) {
    const d = spec.d || spec, [vx, vy, vw, vh] = spec.view || [0, 0, 100, 100], k = (2 * r) / Math.max(vw, vh);
    ctx.translate(x - (vx + vw / 2) * k, y - (vy + vh / 2) * k); ctx.scale(k, k); ctx.lineWidth = 1.5 / k;
    const p = new Path2D(d);
    fill ? ctx.fill(p, spec.rule || "nonzero") : ctx.stroke(p);
  } else {
    ctx.beginPath();
    if (fill) { if (g.shapePath(spec, ctx, x, y, r) !== "filled") ctx.fill(); }
    else { ctx.fillStyle = g.rgba(ink, 0.35); if (g.shapePath(spec, ctx, x, y, r) !== "filled") ctx.stroke(); }
  }
  ctx.restore();
}
})();
