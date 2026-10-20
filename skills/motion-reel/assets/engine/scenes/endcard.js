/*
 * End card. The accent dot is carried in at the centre of the frame and becomes a pen: it
 * flies to the first letter of the wordmark and writes it. Each glyph traces its own outline
 * (the real contours, traced from the font once in prepare), then fills from the baseline up,
 * while the pen zig-zags through the word just ahead. The pen lands as the full stop with a
 * ring; the role, a rule, a typed tagline and the spec line cascade in under it. It holds,
 * and for its last beat the dot (the engine's iris from s._.anchor) opens into the next scene.
 * For the last scene of a reel that is the first scene, so the reel loops through the dot.
 *
 * Beats from the scene start (the original's, at 111 BPM). With more or fewer beats before
 * the iris, the whole build stretches by k = visible beats / 3, so 5 beats build over 1.33×:
 *   0–0.185    the dot settles at the frame centre, r 37 → 31.5 (as the scene before handed it on)
 *   0.185      it launches: a 0.09-beat flight to the first glyph's left side (0.42 em up), shrinking
 *              to the pen nib (0.03 em), faint echoes of it one and two frames behind
 *   0.37–0.96  write-on: glyph i traces its outline in 0.124 beat (from its top-left shoulder,
 *              down its left side first), the starts quick then settling (C l a u d e at +0, .06,
 *              .15, .28, .37, .46). Its fill rises from the baseline 0.205 beat after its outline
 *              began, over 0.074 beat with a soft edge, and then it is plain type. The pen hops to
 *              each glyph's left edge as it starts and swings between 0.13 and 0.68 em above the
 *              baseline, n − 1 swings, the last one down
 *   0.96–1.07  the pen rises above the end of the word; 1.08–1.165 it drops into the full stop,
 *              sliding right ever faster and growing to r 0.073 em in its last frames
 *   1.165      landing: the ring pulses out (r 1.1 → 4.8 × the dot, 2 px, α .5, fading over the
 *              second half of 0.83 beat). The lockup pushes in 1.8 % over 0.925 beat about the
 *              word's centre on the baseline
 *   1.205      the role drops 18 px into place; at 1.29 the rule grows from the centre
 *   1.45       the tagline types on (65 chars a beat), re-centred as it grows, behind a block cursor
 *   1.665      the spec footer fades in with a 4 px settle; everything is still by 2.1
 *   hold       still; the dot stays put at s._.anchor through the iris beat
 *   A very long word (stagger floor 0.03 beat a glyph) pushes everything from the drop on later.
 *
 * Layout (measured, 1080×1920): the wordmark is 330 px Instrument Serif italic, fitted so its
 * advance spans ≤ 832. The span from its origin to the dot's right edge is centred on the box.
 * The baseline is placed so the block from the wordmark's ink top to its last line centres
 * 7.5 px below the box centre (904 for "Claude"). The dot sits on the baseline, 0.093 em right
 * of the ink. Below the baseline: role +144, rule +204.5 (815 wide, ink .5; only with a role
 * or tagline), tagline +281. The footer sits at the box bottom − 48.5 (1572.5).
 */
(() => {
/* the original's frame box (design px) the layout is measured in */
const BOX_W = 986.9, BOX_H = 1412.5;
/* timing in beats from the scene start, for 3 visible beats (scaled by k) */
const T = {
  rest: 0.185, launch: 0.185, fly: 0.09, write: 0.37, span: 0.586, st: 0.0925, dur: 0.124, fill: 0.205, fillD: 0.074,
  lift: 1.07, drop: 1.08, land: 1.165, push: 0.925, ring: 0.83, role: 1.205, roleY: 0.296, roleA: 0.185,
  rule: 1.29, ruleD: 0.3145, tag: 1.449, cps: 64.86, cursor: 0.05, foot: 1.665, footD: 0.154,
};
/* the two wordmark styles: size cap, weight, tracking (em), dot radius, gap after the ink and pen nib (em) */
const KIND = {
  serif: { kind: "serif", style: "italic", weight: 400, cap: 330, track: 0, dotR: 0.0733, gap: 0.093, pen: 0.03 },
  display: { kind: "display", style: "normal", weight: 900, cap: 300, track: -0.014, dotR: 0.085, gap: 0.07, pen: 0.034 },
};

/*
 * A glyph's outline as closed polylines (design px, relative to its origin on the baseline):
 * the glyph is drawn S× larger, traced at half coverage (marching squares, interpolated, ink on
 * the right), each loop started at its top-left shoulder and run down its left side first, a point
 * every ~1 px, longest loop first.
 */
function traceGlyph(g, ch, font, size, S = 2) {
  const c0 = g.ctx; c0.save(); c0.font = font; c0.letterSpacing = "0px"; const m = c0.measureText(ch); c0.restore();
  const pad = 6 + 0.12 * size;
  const L = Math.ceil(m.actualBoundingBoxLeft + pad), R = Math.ceil(m.actualBoundingBoxRight + pad);
  const A = Math.ceil(m.actualBoundingBoxAscent + pad), D = Math.ceil(m.actualBoundingBoxDescent + pad);
  const W = Math.max(4, Math.ceil((L + R) * S)), H = Math.max(4, Math.ceil((A + D) * S));
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d", { willReadFrequently: true });
  x.scale(S, S); x.font = font; x.letterSpacing = "0px"; x.textBaseline = "alphabetic"; x.fillStyle = "#fff"; x.fillText(ch, L, A);
  const data = x.getImageData(0, 0, W, H).data, v = new Float32Array(W * H);
  let i0 = W, i1 = -1, j0 = H, j1 = -1;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const a = data[(j * W + i) * 4 + 3] / 255; v[j * W + i] = a; if (a >= 0.5) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; } }
  if (i1 < 0) return { cs: [], len: 0, ink: null };
  const X = (px) => px / S - L, Y = (py) => py / S - A;
  /* edges: 2·(j·W + i) horizontal (i,j)–(i+1,j), +1 vertical (i,j)–(i,j+1); next[entry] = exit */
  const next = new Map(), at = (i, j) => v[j * W + i];
  const Hd = (i, j) => (j * W + i) * 2, Vd = (i, j) => (j * W + i) * 2 + 1;
  for (let j = Math.max(0, j0 - 1); j <= Math.min(H - 2, j1); j++) for (let i = Math.max(0, i0 - 1); i <= Math.min(W - 2, i1); i++) {
    const a = at(i, j) >= 0.5, b = at(i + 1, j) >= 0.5, c = at(i + 1, j + 1) >= 0.5, d = at(i, j + 1) >= 0.5;
    const idx = (a << 3) | (b << 2) | (c << 1) | d;
    if (idx === 0 || idx === 15) continue;
    const top = Hd(i, j), right = Vd(i + 1, j), bottom = Hd(i, j + 1), left = Vd(i, j);
    if (idx === 10 || idx === 5) {
      const mid = (at(i, j) + at(i + 1, j) + at(i + 1, j + 1) + at(i, j + 1)) / 4 >= 0.5;
      if (idx === 10) { if (mid) { next.set(top, right); next.set(bottom, left); } else { next.set(top, left); next.set(bottom, right); } }
      else { if (mid) { next.set(left, top); next.set(right, bottom); } else { next.set(right, top); next.set(left, bottom); } }
      continue;
    }
    let enter = -1, exit = -1;
    if (a !== b) { if (b) exit = top; else enter = top; }
    if (b !== c) { if (c) exit = right; else enter = right; }
    if (d !== c) { if (d) exit = bottom; else enter = bottom; }
    if (a !== d) { if (a) exit = left; else enter = left; }
    if (enter >= 0 && exit >= 0) next.set(enter, exit);
  }
  const point = (e) => {
    const k = e >> 1, i = k % W, j = (k - i) / W;
    if (e & 1) { const p = at(i, j), q = at(i, j + 1), t = (0.5 - p) / (q - p || 1); return [X(i + 0.5), Y(j + 0.5 + t)]; }
    const p = at(i, j), q = at(i + 1, j), t = (0.5 - p) / (q - p || 1); return [X(i + 0.5 + t), Y(j + 0.5)];
  };
  const seen = new Set(), cs = [];
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const raw = [];
    let e = start, guard = 0;
    while (e !== undefined && !seen.has(e) && guard++ < 1e6) { seen.add(e); raw.push(point(e)); e = next.get(e); }
    if (raw.length < 6) continue;
    /* start at the top-left shoulder (least x + y); note where the pen lands: the left side, 0.42 em up */
    let s0 = 0, lm = raw[0];
    const pen = (q) => q[0] + 0.5 * Math.abs(q[1] + 0.42 * size);
    for (let k = 1; k < raw.length; k++) { if (raw[k][0] + raw[k][1] < raw[s0][0] + raw[s0][1]) s0 = k; if (pen(raw[k]) < pen(lm)) lm = raw[k]; }
    const loop = raw.slice(s0).concat(raw.slice(0, s0)).reverse();
    loop.unshift(loop.pop());
    const pts = [loop[0]];
    for (const p of loop) { const q = pts[pts.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= 1) pts.push(p); }
    const n = pts.length, p = new Float32Array(n * 2), cum = new Float32Array(n + 1);
    for (let k = 0; k < n; k++) { p[k * 2] = pts[k][0]; p[k * 2 + 1] = pts[k][1]; if (k) cum[k] = cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); }
    cum[n] = cum[n - 1] + Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]);
    if (cum[n] > 4) cs.push({ p, cum, len: cum[n], n, lm });
  }
  cs.sort((u, w) => w.len - u.len);
  return { cs, len: cs.reduce((sum, c) => sum + c.len, 0), ink: [X(i0), Y(j0), X(i1 + 1), Y(j1 + 1)] };
}

/* the point at arc length d along a closed polyline (binary search) */
function pointAt(c, d, ox, oy) {
  const { p, cum, n } = c;
  let lo = 0, hi = n;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; }
  const k1 = hi % n, t = Math.min(1, Math.max(0, (d - cum[lo]) / (cum[hi] - cum[lo] || 1)));
  return [ox + p[lo * 2] + (p[k1 * 2] - p[lo * 2]) * t, oy + p[lo * 2 + 1] + (p[k1 * 2 + 1] - p[lo * 2 + 1]) * t];
}
/* the first d px of a closed polyline into the current path */
function tracePath(ctx, c, d, ox, oy) {
  const { p, cum, n } = c;
  ctx.moveTo(ox + p[0], oy + p[1]);
  for (let k = 1; k <= n; k++) {
    const kk = k % n;
    if (cum[k] > d) { const [x, y] = pointAt(c, d, ox, oy); ctx.lineTo(x, y); return; }
    ctx.lineTo(ox + p[kk * 2], oy + p[kk * 2 + 1]);
  }
  ctx.closePath();
}

Reel.scene("endcard", {
  label: (s) => String(s.wordmark || "END CARD").toUpperCase(), /* the HUD names the end card after the brand */
  bg: "paper",
  beats: 4,
  out: { type: "iris", beats: 1, ease: "inQuart" },
  shutter: 1, /* the original's 360° shutter: the pen smears, the typing doubles */
  continues: ["orbit"], /* the type-on-path rings hand the dot on through an iris: its last frame is this one's first */
  params: {
    wordmark: "Claude", /* the name, written on by the dot (non-ASCII is fine) */
    dot: true, /* the accent full stop the pen lands as (and the iris opens from); false: the pen fades out */
    role: "MOTION DESIGNER", /* tracked mono under the wordmark; "" for none */
    tagline: "EVERY FRAME, ON PURPOSE.", /* accent mono, typed on behind a block cursor; "" for none */
    spec: "auto", /* the footer; "auto" = made in code · size · fps · bpm; " · " gets the original's wide spacing; "" for none */
    kind: "serif", /* "serif" (Instrument Serif italic) or "display" (heavy sans) wordmark */
    grid: true, /* the 60 px dot grid of the paper (the engine draws it); false for a plain ground */
  },
  prepare(s, g) {
    const B = g.box, kx = B.w / BOX_W, ky = B.h / BOX_H, u = Math.min(kx, ky);
    const K = KIND[s.kind] || KIND.serif, word = String(s.wordmark ?? "");
    /* size: the advance fits 832 px (Claude: 330) */
    const o = { kind: K.kind, style: K.style, weight: K.weight, size: K.cap * u, track: 0 };
    const adv1 = g.measure(word || " ", Object.assign({}, o, { size: 100 })) / 100 || 1;
    o.size = Math.min(K.cap * u, (832 * kx) / adv1);
    if (o.size < 90 * u) Reel.warn(`endcard: "${word}" is long for a wordmark (${Math.round(o.size)}px)`);
    o.track = K.track * o.size;
    const fs = o.size, font = g.font(o.kind, fs, o.weight, o.style);
    /* each glyph: its kerned slot and its traced outline (relative to the word origin and baseline) */
    const glyphs = g.letters(word, o).map((l) => Object.assign({ ch: l.ch, x: l.x }, l.ch.trim() ? traceGlyph(g, l.ch, font, fs) : { cs: [], len: 0, ink: null }));
    const inked = glyphs.filter((q) => q.ink && q.cs.length);
    const ink = inked.length ? [Math.min(...inked.map((q) => q.x + q.ink[0])), Math.min(...inked.map((q) => q.ink[1])), Math.max(...inked.map((q) => q.x + q.ink[2])), Math.max(...inked.map((q) => q.ink[3]))] : [0, -0.7 * fs, 0, 0];
    const r = s.dot ? K.dotR * fs : 0, gap = K.gap * fs;
    /* origin to the dot's right edge centred on the box; the block (ink top → the last line under it)
       centred 7.5 px below the box centre */
    const below = s.tagline ? 281 * ky : s.role ? 144 * ky : ink[3];
    const x0 = B.cx - (ink[2] + gap + 2 * r) / 2, base = B.cy + 7.5 * ky - (below + ink[1]) / 2;
    for (const q of glyphs) { q.ox = x0 + q.x; q.oy = base; }
    const D = [x0 + ink[2] + gap + r, base - r];
    /* where the pen waits before it drops into the full stop: above the end of the word */
    const Lp = [x0 + ink[2] - 0.033 * fs, base - 0.685 * fs];
    const pivot = [x0 + (ink[0] + ink[2]) / 2, base + 2 * ky], push = 1.018;
    const anchor = [pivot[0] + (D[0] - pivot[0]) * push, pivot[1] + (D[1] - pivot[1]) * push];

    /* timing: the build stretches with the beats before the iris */
    const outB = s.out ? (s.out.beats ?? 0.5) : 0, k = g.clamp((s.beats - outB) / 3, 0.6, 1.6);
    /* each glyph's outline traces its contours one after another over its window; the windows overlap */
    for (const q of inked) { let at = 0; for (const c of q.cs) { c.at = at; at += c.len; } }
    const n = inked.length, dur = T.dur * g.clamp(n > 1 ? (T.span - T.dur) / (n - 1) / T.st : 1.5, 1, 1.5);
    const st = n > 1 ? g.clamp((T.span - dur) / (n - 1), 0.03, 0.16) : 0, lead = st * Math.max(0, n - 1);
    /* a very long word writes past the drop: everything after shifts with it */
    const late = Math.max(0, T.write + lead + dur + 0.1 - T.lift);
    /* the starts come quick and then settle (the original's cadence: C, l, a, u, d, e at +0, .062, .154, .278, .37, .463) */
    inked.forEach((q, i) => { q.t0 = (T.write + lead * (n > 1 ? (i / (n - 1)) ** 1.2 : 0)) * k; q.t1 = q.t0 + dur * k; q.f0 = q.t0 + T.fill * (dur / T.dur) * k; q.f1 = q.f0 + T.fillD * k; });
    const w0 = T.write * k, w1 = (T.write + lead + dur) * k;
    /* the pen does not ride the outline (that races round each glyph in 4 frames): it zig-zags through
       the word. Across, it hops to each glyph's left edge just as that glyph starts (in 0.035 beat)
       and creeps 30 % into it until the next hop; up and down it swings between 0.13 and 0.68 em above
       the baseline, n − 1 swings from the first glyph's middle to the end, the last one down. Then it
       rises to wait above the full stop. */
    const P0 = n ? [inked[0].ox + inked[0].cs[0].lm[0], inked[0].oy + inked[0].cs[0].lm[1]] : [x0, base - 0.4 * fs], landed = (T.launch + T.fly) * k;
    const PX = [[landed, P0[0]]], PY = [[landed, P0[1]]];
    const keyAt = (K, t, v) => { if (t > K[K.length - 1][0] + 1e-4) K.push([t, v]); };
    inked.forEach((q, i) => {
      const l = q.ox + q.ink[0], w = q.ink[2] - q.ink[0];
      if (i) keyAt(PX, q.t0 - 0.01 * k, l);
      const nx = inked[i + 1];
      keyAt(PX, nx ? nx.t0 - 0.045 * k : w1, nx ? l + 0.3 * w : x0 + ink[2] - 0.15 * fs);
    });
    const m = Math.max(2, n - 1), yA = n ? inked[0].t0 + 0.15 * dur * k : w0;
    for (let j = 0; j < m; j++) keyAt(PY, g.lerp(yA, w1, j / (m - 1)), base - ((m - 1 - j) % 2 ? 0.68 : 0.13) * fs);
    const tm = {
      k, rest: T.rest * k, launch: T.launch * k, fly: T.fly * k, w0, w1, lift: (T.lift + late) * k, drop: (T.drop + late) * k, land: (T.land + late) * k,
      push: T.push * k, ring: T.ring * k, role: (T.role + late) * k, roleY: T.roleY * k, roleA: T.roleA * k, rule: (T.rule + late) * k, ruleD: T.ruleD * k,
      tag: (T.tag + late) * k, cps: T.cps / k, cursor: T.cursor * k, foot: (T.foot + late) * k, footD: T.footD * k,
    };
    /* the lines under it: each fitted to the rule's width */
    const ruleW = 815 * kx, fitMono = (str, size, track, weight) => {
      const oo = { kind: "mono", size: size * u, track: track * u, weight };
      const w = g.measure(String(str).toUpperCase(), oo);
      if (w > ruleW) { const f = ruleW / w; oo.size *= f; oo.track *= f; }
      return oo;
    };
    return {
      fs, font, glyphs: inked, ink, r, D, L: Lp, base, pivot, push, tm, u, kx, ky,
      start: s.from || [B.cx, B.cy], rPen: K.pen * fs, P0, PX, PY,
      role: s.role ? fitMono(s.role, 34.5, 14.5, 500) : null, roleY: base + 144 * ky,
      rule: s.role || s.tagline ? { w: ruleW, y: base + 204.5 * ky } : null,
      tag: s.tagline ? fitMono(s.tagline, 30, 5.25, 400) : null, tagY: base + 281 * ky, tagStr: String(s.tagline || "").toUpperCase(),
      spec: s.spec === "auto" ? null : String(s.spec || "").replace(/\s*·\s*/g, "  ·  "), footY: B.b - 48.5 * ky,
      anchor, anchorR: r * push,
    };
  },
  draw(g, s, t) {
    const { ctx, ease, seg } = g, _ = s._, tm = _.tm, b = t.b;
    const ink = g.on(s.bg), acc = g.c.accent, cx = g.box.cx, rPen = _.rPen, r0 = 37 * _.u, r1 = 31.5 * _.u;
    /* how much of a glyph's outline is drawn at beat x */
    const reach = (q, x) => q.len * seg(x, q.t0, q.t1);
    /* a keyframed coordinate of the pen, eased between keys */
    const key = (K, x) => {
      if (x <= K[0][0]) return K[0][1];
      for (let i = 1; i < K.length; i++) if (x < K[i][0]) return g.lerp(K[i - 1][1], K[i][1], ease.inOutSine(seg(x, K[i - 1][0], K[i][0])));
      return K[K.length - 1][1];
    };
    /* the dot at beat x: [x, y, r] */
    const pen = (x) => {
      const [sx, sy] = _.start;
      if (x < tm.launch) return [sx, sy, g.lerp(r0, r1, ease.outCubic(seg(x, 0, tm.rest)))];
      if (x < tm.launch + tm.fly) { const p = ease.inOutQuad(seg(x, tm.launch, tm.launch + tm.fly)); return [g.lerp(sx, _.P0[0], p), g.lerp(sy, _.P0[1], p), g.lerp(r1, rPen, ease.outQuad(seg(x, tm.launch, tm.launch + tm.fly)))]; }
      if (x < tm.w1) return [key(_.PX, x), key(_.PY, x), rPen];
      const ex = key(_.PX, tm.w1), ey = key(_.PY, tm.w1);
      if (x < tm.drop) { const p = ease.inOutSine(seg(x, tm.w1, tm.lift)); return [g.lerp(ex, _.L[0], p), g.lerp(ey, _.L[1], p), rPen]; }
      /* the drop: it falls, sliding right ever faster into place, growing in its last frames */
      const p = seg(x, tm.drop, tm.land);
      if (!s.dot) return [_.L[0], _.L[1], rPen * (1 - ease.outCubic(p))];
      return [g.lerp(_.L[0], _.D[0], ease.inQuad(p)), g.lerp(_.L[1], _.D[1], p), g.lerp(rPen, _.r, ease.outCubic(seg(p, 0.6, 1)))];
    };

    /* the lockup pushes in about the word's centre on the baseline once the dot has landed */
    const S = 1 + (_.push - 1) * ease.inOutSine(seg(b, tm.land, tm.land + tm.push));
    ctx.save();
    ctx.translate(_.pivot[0], _.pivot[1]); ctx.scale(S, S); ctx.translate(-_.pivot[0], -_.pivot[1]);

    /* the wordmark: outlines behind the pen, fills rising from the baseline; finished glyphs are plain type */
    ctx.font = _.font; ctx.letterSpacing = "0px"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.lineWidth = 2 * _.u; ctx.strokeStyle = ink;
    for (const q of _.glyphs) {
      if (b < q.t0) continue;
      const pf = ease.outCubic(seg(b, q.f0, q.f1));
      if (pf >= 1) { ctx.fillStyle = ink; ctx.fillText(q.ch, q.ox, q.oy); continue; }
      if (pf > 0) {
        const top = q.oy + q.ink[1], bot = q.oy + q.ink[3], fe = 0.2 * (bot - top), edge = bot - pf * (bot - top + fe);
        const gr = ctx.createLinearGradient(0, edge, 0, edge + fe);
        gr.addColorStop(0, g.rgba(ink, 0)); gr.addColorStop(1, g.rgba(ink, 1));
        ctx.fillStyle = gr; ctx.fillText(q.ch, q.ox, q.oy);
      }
      const d = reach(q, b);
      ctx.beginPath();
      for (const c of q.cs) if (d > c.at) tracePath(ctx, c, Math.min(c.len, d - c.at), q.ox, q.oy);
      ctx.stroke();
    }

    /* the ring when the dot lands */
    const rk = seg(b, tm.land, tm.land + tm.ring);
    if (s.dot && rk > 0 && rk < 1) g.ring(_.D[0], _.D[1], _.r * g.lerp(1.116, 4.83, ease.outCubic(rk)), acc, 2 * _.u, 0.5 * (1 - g.smoothstep(0.5, 0.95, rk)));

    /* the dot, and faint echoes of it one and two frames back while it moves (each smeared by the shutter) */
    const [px, py, pr] = pen(b), fr = 1 / (t.spb * t.fps);
    if (b > tm.launch && b < tm.land + 2 * fr) {
      for (const [j, a] of [[2, 0.07], [1, 0.15]]) {
        const [ex, ey, er] = pen(Math.max(0, b - j * fr));
        if (Math.hypot(ex - px, ey - py) > pr * 0.5) { ctx.save(); ctx.globalAlpha = a; g.circle(ex, ey, er, acc); ctx.restore(); }
      }
    }
    if (pr > 0.05) g.circle(px, py, pr, acc);
    ctx.restore();

    /* the role drops in, the rule grows from the centre */
    if (_.role) {
      const a = ease.outQuad(seg(b, tm.role, tm.role + tm.roleA)), dy = -18 * _.ky * (1 - ease.outCubic(seg(b, tm.role, tm.role + tm.roleY)));
      if (a > 0) g.mono(s.role, cx, _.roleY + dy, Object.assign({}, _.role, { align: "center", color: ink, alpha: a }));
    }
    const rw = _.rule ? _.rule.w * ease.outCubic(seg(b, tm.rule, tm.rule + tm.ruleD)) : 0;
    if (rw > 0.5) { ctx.save(); ctx.lineCap = "butt"; g.line(cx - rw / 2, _.rule.y, cx + rw / 2, _.rule.y, ink, 1.5 * _.u, 0.5); ctx.restore(); }

    /* the tagline types on, re-centred as it grows, a block cursor after it */
    if (_.tag && b >= tm.tag) {
      const str = _.tagStr, n = Math.min(str.length, Math.floor((b - tm.tag) * tm.cps) + 1);
      const w = g.mono(str.slice(0, n), cx, _.tagY, Object.assign({}, _.tag, { align: "center", color: acc }));
      const q = _.tag.size / 30;
      if (b < tm.tag + (str.length - 1) / tm.cps + tm.cursor) { ctx.fillStyle = g.rgba(acc, 0.5); ctx.fillRect(cx + w / 2 + q, _.tagY - 24 * q, 22.5 * q, 27.5 * q); }
    }

    /* the spec line at the foot */
    const spec = _.spec ?? `MADE ENTIRELY IN CODE  ·  ${g.W}×${g.H}  ·  ${t.fps} FPS  ·  ${Math.round(t.bpm)} BPM`;
    const fa = ease.outQuad(seg(b, tm.foot, tm.foot + tm.footD));
    if (spec && fa > 0) {
      const fo = { size: 16 * _.u, weight: 500, track: 2.8 * _.u }, fw = g.measure(spec.toUpperCase(), Object.assign({ kind: "mono" }, fo)), maxW = g.box.w - 120 * _.kx;
      if (fw > maxW) { fo.size *= maxW / fw; fo.track *= maxW / fw; }
      g.mono(spec, cx, _.footY - 4 * _.ky * (1 - fa), Object.assign(fo, { align: "center", color: ink, alpha: 0.5 * fa }));
    }
  },
});
})();
