/*
 * Words, one a beat. A four-word manifesto cut hard on every beat (EVERY / SINGLE / FRAME /
 * on purpose.), each word its own typographic treatment on its own ground, with the mono
 * read-outs of the tool that would have made it. Timings are in beats from each word's start
 * (the original's frames at 111 BPM, 32.43 a beat); the layout is the original's, measured in
 * the 1080×1920 frame and scaled to the HUD box. The scene's shutter is 0.85 frame, as the
 * original's blur is: the slides, the slam and the sweep streak through the engine's samples.
 *
 *   stack       (sky) a type specimen. The letters stack one a row, stretched wide, and slide in
 *               from the right 0.7 frame apart on a fast exponential (settled by 0.3); guides,
 *               CAP, BASELINE and the row ids fade in (0.09), the accent caret after the last
 *               letter (0.22, then flashing every quarter beat), the font / size / TRACKING panel
 *               (0.25), the counter (0.31), the accent I-beams with their kerning deltas (0.37);
 *               then the tracking closes (0.40–0.83, in-out): the rows pull together about the
 *               stack's centre while TRACKING counts down to +00 and the deltas to their finals.
 *   repeat      (ink) the word as a wall of outlined rows, alternate rows drifting ±81 px a beat
 *               after a fast streaked start (settled by 0.3). The real one slams in at 1.6× on a
 *               damped spring (settled by 0.55), tilted −2.3°, streaked sideways until 0.12, with
 *               a warm accent glow; the selection box (8 handles, INSTANCE, live W/H, FILL) appears
 *               at 0.15; the fill turns accent → paper over 0.46–0.53 (FILL reads the real hex);
 *               a small pulse at 0.9.
 *   viewfinder  (a gradient turned from the cool: violet top right → cool → teal bottom left)
 *               white heavy caps with a fixed warm / cold fringe glitch in, cut into ~12 slices
 *               that jump sideways, some split, some in a fringe colour (0–0.22, a new pattern
 *               each frame); camera brackets slam in from outside to an undershoot (0.14–0.3) and
 *               settle by 0.74; the OSD (REC, AF-C, EV, ISO, the live frame) at 0.28; the thirds
 *               grid, crosshairs and tick scales fade up (0.31–0.77); the word pushes in 4.6%
 *               (0.2–1); the REC dot is lit for the third quarter of each beat.
 *   bands       (paper) an editorial italic serif, two lines (or one word, larger): an accent
 *               band sweeps in from the left on an exponential (0–0.2) and inverts the ink (paper
 *               on the band, ink off it); the letters rise in one by one along the slant, the
 *               second line a frame later (0–0.2); a redder and a blush stripe unfold out of the
 *               band's edge (0.15–0.43); a calligraphic swash draws under the last line
 *               (0.28–0.71); a ring goes out (0.37) and the accent full stop pops on a spring
 *               (0.43; it is s._.anchor); the specimen caption and the counter fade in (0.37–0.52).
 *
 *   grid        (paper) order: heavy caps on a drawn baseline grid, guides first, then the letters
 *               switching on one by one with no easing at all, each with a one-frame accent box.
 *   glitch      (ink) the word torn into slices that jump sideways a new way every two frames,
 *               with accent and cool copies split off it; it calms a little but never heals.
 *   pixel       (cool) the word losing resolution: its blocks grow in steps (6 → 64 px) while
 *               more and more of them drop out and fall away.
 *   dust        (paper) the word crumbling from left to right: a ragged front eats it and what
 *               it leaves blows away as specks of ink and accent. Lowercase words set in the serif.
 *   overflow    (deep) a number too big for the frame: it slams in oversized, keeps pushing in
 *               and pans across itself, in an accent-to-sun gradient. "10^100" sets the power
 *               raised; "∞" is drawn, not set.
 *
 * The word changes on the frame (t.bq), so the shutter never blends two words. Words of 3 to 9
 * letters fit every style; the serif lines are fitted and stacked by their real ink. Every
 * visible string is a param whose default is the original's; {i}/{n} in the counter are the
 * word's number and the word count, {k} the row, {hex} the real fill, {w} {h} {fps} {f} live
 * values. Colours are palette roles only: the gradient, fringes and the second stripe are
 * turned from cool and accent in HSL.
 */
(() => {
const STYLES = ["stack", "repeat", "viewfinder", "bands", "grid", "glitch", "pixel", "dust", "overflow"];
const GROUND = { stack: "sky", repeat: "ink", viewfinder: "cool", bands: "paper", grid: "paper", glitch: "ink", pixel: "cool", dust: "paper", overflow: "deep" };
const FPB = 32.43; /* the original's frames per beat: its frame-measured curves, kept in beats */
const BOX = { cx: 540, cy: 914.75, w: 987, h: 1412.5 }; /* the HUD box the layout was measured in */
/* the viewfinder brackets: [frame, scale, alpha] from the word's start */
const BRK = [[4.4, 1.3, 0], [5, 1.14, 0.4], [6, 0.97, 0.7], [7, 0.89, 1], [8, 0.905, 1], [10, 0.965, 1]];
/* the viewfinder gradient: hue (deg), saturation (×) and lightness (+%) about the cool, from the
   top-right corner (0) to the bottom-left (1), measured from the original's 11 stops */
const GRAD = [[8.6, 1.28, 15.8], [6.8, 1.17, 11.9], [4.5, 1.2, 10.3], [2.5, 1.12, 6.6], [1.2, 1.13, 4.7], [-2.6, 1.05, 3.3],
  [-12.5, 0.96, 1.1], [-23.7, 0.88, -1.4], [-35.4, 0.9, -4.9], [-47.7, 0.9, -6.9], [-61.8, 0.94, -10.4]];

Reel.scene("words", {
  label: "TYPOGRAPHY",
  bg: "sky",
  beats: 4,
  shutter: 0.85, /* the original's blur is about a whole frame: the slides, the slam, the sweep all streak */
  params: {
    words: ["EVERY", "SINGLE", "FRAME", "on purpose"], /* one per beat; caps words for the first three, the last reads best as one or two lowercase words */
    styles: null, /* a style per word; default stack, repeat, viewfinder, bands (then round again) */
    per: 1, /* beats per word */
    count: "WORD {i}/{n}", /* the word counter (stack and bands); "" for none */
    font: "MONTSERRAT BLACK", /* stack: the specimen's font name */
    sizes: "400  /  340 PT", /* stack: the weight / size line under it */
    cap: "CAP 0.72", /* stack: the label on the cap line */
    tracking: "TRACKING", /* stack: the tracking label */
    track: 40, /* stack: the tracking the counter starts from; it counts down to +00 */
    baseline: "BASELINE 0", /* stack: the label on the first baseline */
    row: "R{k}", /* stack: the row ids on the guides; {k} is the row, two digits */
    kerns: [-32, -18, -41, -26], /* stack: final kerning deltas at the I-beams, rows 2…; extra rows get seeded ones */
    instance: "INSTANCE 041 / 072", /* repeat: above the selection box */
    dims: "W {w}  H {h}", /* repeat: live size under the box */
    fill: "FILL {hex}", /* repeat: the fill read-out, in the fill colour; {hex} is the real one */
    rec: "REC  {w}×{h} · {fps}P", /* viewfinder: top left after the REC dot */
    af: "AF-C", /* viewfinder: top right, before the focus glyph */
    ev: "±0.0 EV", /* viewfinder: over the right tick scale */
    iso: "ISO 400  ƒ/2.8", /* viewfinder: bottom left */
    frame: "F{f} · 180°", /* viewfinder: bottom right; {f} is the live frame, four digits */
    face: "INSTRUMENT SERIF ITALIC", /* bands: the caption's first line */
    pts: "420 PT  /  301 PT", /* bands: the caption's second line */
    dot: true, /* bands: the accent full stop (and its ring) after the last word */
  },
  prepare(s, g) {
    if (s.beats !== s.words.length * s.per) Reel.warn(`words: ${s.words.length} words × ${s.per} beat = ${s.words.length * s.per} beats, but the scene has ${s.beats}`);
    const B = g.box, u = Math.min(B.w / BOX.w, B.h / BOX.h), D = { u, ox: B.cx - BOX.cx * u, oy: B.cy - BOX.cy * u };
    const styles = s.words.map((_w, i) => {
      const st = (s.styles && s.styles[i]) || STYLES[i % STYLES.length];
      if (!STYLES.includes(st)) Reel.warn(`words: unknown style "${st}" (${STYLES.join(", ")}); using stack`);
      return STYLES.includes(st) ? st : "stack";
    });
    const data = s.words.map((w, i) => ({ stack: prepStack, repeat: prepRepeat, viewfinder: prepView, bands: prepBands, grid: prepGrid, glitch: prepGlitch, pixel: prepPixel, dust: prepDust, overflow: prepOverflow }[styles[i]])(g, String(w), D, s));
    return { styles, data, D, grad: gradient(g) };
  },
  draw(g, s, t) {
    const _ = s._, nW = s.words.length, i = Math.max(0, Math.min(nW - 1, Math.floor((t.bq + 1e-6) / s.per)));
    if (!nW) return;
    const u = Math.max(0, t.b - i * s.per), uq = Math.max(0, t.bq - i * s.per), style = _.styles[i], D = _.D, ctx = g.ctx;
    _.hudBg = GROUND[style];
    _.anchor = null;
    ctx.save(); ctx.transform(D.u, 0, 0, D.u, D.ox, D.oy);
    const X = { g, s, t, u, uq, i, D, P: _.data[i], ctx, view: { x: -D.ox / D.u, y: -D.oy / D.u, w: g.W / D.u, h: g.H / D.u },
      snap: (x) => (Math.round((D.ox + x * D.u) * g.scale) / g.scale - D.ox) / D.u }; /* x on a whole device pixel */
    ({ stack, repeat, viewfinder, bands, grid, glitch, pixel, dust, overflow }[style])(X);
    ctx.restore();
  },
});

/* ---------------------------------------------------------------- helpers */

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const pad = (n, k = 2) => String(Math.abs(Math.round(n))).padStart(k, "0");
const signed = (n) => (Math.round(n) < 0 ? "-" : "+") + pad(n);
const fmt = (str, o) => String(str ?? "").replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));
const disp = (size) => ({ kind: "display", size, weight: 900 });
const serif = (size) => ({ kind: "serif", size, style: "italic" });
/* ink bounds of a string: left/right of the origin, ascent/descent, advance */
function ink(g, str, o) {
  const c = g.ctx; c.save(); c.font = g.font(o.kind, o.size, o.weight, o.style); c.letterSpacing = "0px";
  const m = c.measureText(str); c.restore();
  return { l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent, d: m.actualBoundingBoxDescent, w: m.width };
}
/* keyframes [[x, ...values]] → values at x (linear, held at the ends) */
function keys(K, x, j) {
  if (x <= K[0][0]) return K[0][j];
  for (let k = 1; k < K.length; k++) if (x <= K[k][0]) { const a = K[k - 1], b = K[k]; return a[j] + ((b[j] - a[j]) * (x - a[0])) / (b[0] - a[0]); }
  return K[K.length - 1][j];
}
/* an offscreen sprite at the render scale: draw(c) in design px inside rect [x, y, w, h], drawn back with put() */
function sprite(g, D, [x, y, w, h], draw) {
  const k = g.scale * D.u, cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.ceil(w * k)); cv.height = Math.max(1, Math.ceil(h * k));
  const c = cv.getContext("2d"); c.scale(k, k); c.translate(-x, -y); draw(c);
  return { cv, k, x, y, w: cv.width / k, h: cv.height / k, put(cc, dx = 0, dy = 0) { cc.drawImage(cv, x + dx, y + dy, this.w, this.h); } };
}
function ground(X, col) { const { ctx, view: v } = X; ctx.fillStyle = col; ctx.fillRect(v.x - 2, v.y - 2, v.w + 4, v.h + 4); }
/* the mono labels: capitals, but a lowercase ƒ stays one (ƒ/2.8) */
const mono = (X, str, x, y, o, cc = X.ctx) => X.g.text(String(str).replace(/[^ƒ]+/g, (m) => m.toUpperCase()), x, y, Object.assign({ kind: "mono", size: 16, weight: 500, track: 1.6 }, o), cc);

/* hsl of a palette colour and back: the viewfinder gradient is the cool, turned about its hue */
function toHsl(g, c) {
  const [r, gg, b] = g.hex(c).map((v) => v / 255), mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1)), h = mx === r ? ((gg - b) / d) % 6 : mx === gg ? (b - r) / d + 2 : (r - gg) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function fromHsl(g, h, s, l) {
  h = ((h % 360) + 360) % 360; s = clamp(s); l = clamp(l);
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, gg, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return g.toHex((r + m) * 255, (gg + m) * 255, (b + m) * 255);
}
function gradient(g) {
  const [h, s, l0] = toHsl(g, g.c.cool), l = clamp(l0, 0.3, 0.6); /* a very dark cool is lifted so the turn of hue shows */
  return {
    stops: GRAD.map(([dh, ks, dl]) => fromHsl(g, h + dh, s * ks, clamp(l + dl / 100, 0.04, 0.9))),
    /* the fixed chromatic fringe: a warm and a cold copy of the word, from the same hue */
    warm: fromHsl(g, h + 60, Math.min(1, s * 1.1), 0.71), cold: fromHsl(g, h - 52, Math.min(1, s * 1.15), 0.69),
    bar: fromHsl(g, h + 5, s, 0.88),
    /* the bands' second stripe: the accent a touch redder and darker */
    hot: ((a) => fromHsl(g, a[0] - 3, a[1] * 0.94, a[2] - 0.026))(toHsl(g, g.c.accent)),
  };
}

/* ---------------------------------------------------------------- stack: the type specimen */

function prepStack(g, word) {
  const L = [...word.toUpperCase()].filter((ch) => ch.trim()), n = Math.max(1, L.length);
  /* the original: 5 rows of cap 247 at a pitch of 274 between y 249 and 1593 */
  const cap = Math.min(300, 1344 / ((n - 1) / 0.9015 + 1)), size = cap / (ink(g, "H", disp(100)).a / 100);
  const m = L.map((ch) => ink(g, ch, disp(size))), nat = m.map((x) => x.l + x.r), avg = nat.reduce((a, b) => a + b, 0) / n;
  /* stretched wide, the wide letters a little less */
  let sx = nat.map((w) => 1.72 * clamp((avg / w) ** 0.35, 0.8, 1.15));
  const maxW = Math.max(...nat.map((w, k) => w * sx[k]));
  if (maxW > 860) sx = sx.map((v) => (v * 860) / maxW);
  return { L, n, cap, size, m, sx, w: nat.map((w, k) => w * sx[k]), maxW: Math.min(860, maxW) };
}
/* the letters slide in from the right: offset (px) by frame since the word's start, ×0.55 a frame */
const slide = (f) => 600 * 0.55 ** f;

function stack(X) {
  const { g, s, u, i, P, ctx } = X, c = g.c, ink0 = c.ink, acc = c.accent, n = P.n, cap = P.cap, kc = cap / 247, fr = u * FPB;
  ground(X, c.sky);
  /* pitch: opens a little during the entry, then the tracking closes it */
  const Pf = cap / 0.9015, Po = (Pf * 305.5) / 274, T = 1 - g.ease.inOutCubic(g.seg(u, 0.4, 0.83));
  const pitch = (Pf + (Po - Pf) * T) * (0.97 + 0.03 * g.ease.outCubic(g.seg(u, 0, 0.37)));
  const cy = 920, base = (k) => cy - ((n - 1) / 2) * pitch + k * pitch + cap / 2, gap = 15 * kc + (pitch - Pf) * 1.24;
  const x0 = X.view.x, x1 = X.view.x + X.view.w, cx = 545;
  const aG = g.span(u, 0.09, 0.16), aL = g.span(u, 0.25, 0.31), aW = g.span(u, 0.31, 0.43), aI = g.span(u, 0.37, 0.43);
  const guide = g.mix(c.sky, ink0, 0.3);
  if (aG > 0) {
    const top = base(0) - cap - 14 * kc;
    g.line(x0, top, x1, top, guide, 1, aG, ctx);
    for (let k = 0; k < n - 1; k++) {
      const y = base(k);
      g.line(x0, y, x1, y, guide, 1, aG, ctx); g.line(x0, y + gap, x1, y + gap, guide, 1, aG, ctx);
      ctx.save(); ctx.setLineDash([2, 5]); g.line(cx - 228, y + gap / 2, cx + 199, y + gap / 2, guide, 1, aG * 0.5, ctx); ctx.restore();
      mono(X, fmt(s.row, { k: pad(k + 2) }), 1044, y + gap / 2 + 6, { size: 14, color: ink0, alpha: 0.5 * aG, align: "right" });
    }
    const yb = base(n - 1);
    g.line(x0, yb, x1, yb, guide, 1, aG, ctx);
    mono(X, s.cap, 1044, top - 5, { size: 16, color: ink0, alpha: 0.5 * aG, align: "right" });
    mono(X, s.baseline, 34, base(0) - 8, { size: 14, color: ink0, alpha: 0.5 * aG });
  }
  if (aL > 0) {
    mono(X, s.font, 34, 366, { size: 16, color: ink0, alpha: 0.68 * aL });
    mono(X, s.sizes, 34, 393, { size: 16, color: ink0, alpha: 0.45 * aL });
    mono(X, s.tracking, 1044, 366, { size: 16, color: ink0, alpha: 0.68 * aL, align: "right" });
    mono(X, signed(s.track * T), 1044, 403, { size: 30, weight: 500, track: 1, color: ink0, alpha: 0.95 * aL, align: "right" });
  }
  if (aW > 0 && s.count) mono(X, fmt(s.count, { i: pad(i + 1), n: pad(s.words.length) }), 1044, base(n - 1) - 8, { size: 15, color: ink0, alpha: 0.5 * aW, align: "right" });
  /* the I-beams in the row gaps, with their kerning deltas */
  if (aI > 0) {
    const ix = cx + 0.46 * P.maxW, start = [20, 40, 32, 29];
    ctx.save(); ctx.strokeStyle = g.rgba(acc, aI); ctx.lineWidth = 2; ctx.beginPath();
    for (let k = 0; k < n - 1; k++) {
      const y = base(k), sw = 6;
      ctx.moveTo(ix, y); ctx.lineTo(ix, y + gap); ctx.moveTo(ix - sw, y + 1); ctx.lineTo(ix + sw, y + 1); ctx.moveTo(ix - sw, y + gap - 1); ctx.lineTo(ix + sw, y + gap - 1);
    }
    ctx.stroke(); ctx.restore();
    for (let k = 0; k < n - 1; k++) {
      const fin = s.kerns && s.kerns[k] != null ? s.kerns[k] : -Math.round(10 + 35 * g.hash(k, 3.1)), st = start[k] ?? Math.round(15 + 28 * g.hash(k, 7.7));
      mono(X, signed(fin + (st - fin) * T), ix + 18, base(k) + gap / 2 + 5.5, { size: 15, track: 1, color: acc, alpha: aI });
    }
  }
  /* the letters (their streak is the engine's shutter) */
  const wide = 0.97 + 0.03 * (1 - T);
  P.L.forEach((ch, k) => {
    const off = slide(fr - 0.7 * k), y = base(k), sx = P.sx[k] * wide, m = P.m[k];
    if (off > 1100) return;
    ctx.save(); ctx.translate(cx + off, y); ctx.scale(sx, 1); g.text(ch, -(m.r - m.l) / 2, 0, Object.assign({ color: ink0 }, disp(P.size)), ctx); ctx.restore();
  });
  /* the caret after the last letter: in at 0.22, then a flash every quarter beat */
  if (u > 0.22) {
    const a = u < 0.43 ? g.lerp(0.3, 1, g.seg(u, 0.22, 0.43)) : 0.7 + 0.3 * Math.exp(-g.fract((u - 0.18) * 4) / 0.08);
    const yb = base(n - 1), xb = cx + (P.w[n - 1] * wide) / 2 + 31 * kc;
    ctx.save(); ctx.fillStyle = g.rgba(acc, a); ctx.fillRect(xb, yb - cap - 10 * kc, 16 * kc, cap + 10 * kc); ctx.restore();
  }
}

/* ---------------------------------------------------------------- repeat: the selected instance */

function prepRepeat(g, word, D) {
  const W = word.toUpperCase(), SX = 0.92, m100 = ink(g, W, disp(100));
  const size = Math.min(244, 830 / (((m100.l + m100.r) / 100) * SX)), m = ink(g, W, disp(size));
  /* the pattern: one row of outlined repeats, drawn once at the render scale */
  const ps = 210, pm = ink(g, W, disp(ps)), unit = pm.w + 0.25 * ps;
  /* a row is a band exactly one pitch (174) tall, opaque on the ground, baseline 164 from its top, so the rows tile
     and are drawn as plain copies; a 6 px stroke with the fill cut out of it is a clean 3 px outline, without the
     variable font's overlapping contours */
  const cw = g.W / D.u + 2 * unit + 40, ch = 174, outline = g.mix(g.c.ink, g.c.paper, 0.42);
  const line = sprite(g, D, [0, 0, cw, ch], (x) => {
    for (let j = 0; j * unit < cw; j++) g.text(W, j * unit, 164, Object.assign({ color: outline, stroke: 6 }, disp(ps)), x);
    x.globalCompositeOperation = "destination-out";
    for (let j = 0; j * unit < cw; j++) g.text(W, j * unit, 164, Object.assign({ color: g.c.ink }, disp(ps)), x);
  });
  const strip = sprite(g, D, [0, 0, cw, ch], (x) => { x.fillStyle = g.c.ink; x.fillRect(0, 0, cw, ch); line.put(x); });
  /* the same row streaked sideways (8 copies over 64 and 24 px), for the fast start */
  const streaks = [64, 24].map((L) => sprite(g, D, [0, 0, cw, ch], (x) => {
    x.fillStyle = g.c.ink; x.fillRect(0, 0, cw, ch); x.globalAlpha = 1 / 8; x.globalCompositeOperation = "lighter";
    for (let j = 0; j < 8; j++) line.put(x, (j / 7 - 0.5) * L, 0);
  }));
  /* the instance's warm glow, blurred once */
  const gx = -(m.l + m.r) / 2 - 80, gy = -m.a / 2 - 80;
  const gr = [gx, gy, m.l + m.r + 160, m.a + 160], text = (col) => (x) => g.text(W, -(m.r - m.l) / 2, m.a / 2, Object.assign({ color: col }, disp(size)), x);
  const glow = sprite(g, D, gr, (x) => { x.filter = `blur(${14 * g.scale * D.u}px)`; text(g.rgba(g.c.accent, 0.55))(x); });
  /* glow and accent word together, for the blurred slam */
  const hot = sprite(g, D, gr, (x) => { glow.put(x); text(g.c.accent)(x); });
  const hotBlur = sprite(g, D, gr, (x) => { x.globalAlpha = 1 / 8; x.globalCompositeOperation = "lighter"; for (let j = 0; j < 8; j++) hot.put(x, (j / 7 - 0.5) * 60, 0); });
  return { W, SX, size, m, cap: m.a, hw: ((m.l + m.r) * SX) / 2 + 47, hh: m.a / 2 + 27, unit, strips: [...streaks, strip], glow, hot, hotBlur, adv: m.w * SX };
}

function repeat(X) {
  const { g, s, u, P, ctx, view: v } = X, c = g.c, acc = c.accent, fr = u * FPB;
  ground(X, c.ink);
  /* the wall: alternate rows drift ±81 px a beat, after a fast blurred start */
  const vel = 2.5 + 37.5 * Math.exp(-u / 0.08), dist = 2.5 * fr + 37.5 * 0.08 * FPB * (1 - Math.exp(-u / 0.08));
  const a = 0.45 + 0.55 * g.smoothstep(0, 0.25, u), S = P.strips[vel > 22 ? 0 : vel > 9 ? 1 : 2]; /* the streak that fits the speed */
  for (let r = 0, top = -19; top < v.y + v.h; r++, top += 174) {
    if (top + 174 < v.y) continue;
    const dir = r % 2 ? 1 : -1, off = 137 * r + 61 * (r % 3) + dir * dist, xs = X.snap(v.x - g.mod(off, P.unit) - 20);
    ctx.globalAlpha = a; S.put(ctx, xs, top);
  }
  ctx.globalAlpha = 1;
  /* the instance: a damped spring from 1.6×, a pulse at 0.9 */
  const sc = 1 + 0.6 * Math.exp(-u / 0.154) * Math.cos((Math.PI * u) / 0.216) + (u > 0.9 ? 0.035 * Math.exp(-(u - 0.9) / 0.04) : 0);
  const col = g.mix(acc, c.paper, g.smoothstep(0.46, 0.53, u)), hw = P.hw * sc, hh = P.hh * sc, cx = 543, cy = 910;
  const aB = g.span(u, 0.15, 0.2);
  const hero = (cc) => {
    cc.save(); cc.translate(cx, cy); cc.rotate((-2.3 * Math.PI) / 180);
    if (aB > 0) {
      cc.save(); cc.globalAlpha *= aB; cc.fillStyle = c.ink; cc.fillRect(-hw, -hh, 2 * hw, 2 * hh);
      cc.strokeStyle = acc; cc.lineWidth = 1.5; cc.strokeRect(-hw, -hh, 2 * hw, 2 * hh);
      for (const [hx, hy] of [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]]) { cc.fillRect(hx * hw - 5.5, hy * hh - 5.5, 11, 11); cc.strokeRect(hx * hw - 5.5, hy * hh - 5.5, 11, 11); }
      cc.restore();
      mono(X, s.instance, -hw + 2, -hh - 20, { color: c.paper, alpha: 0.9 * aB }, cc);
      mono(X, fmt(s.dims, { w: Math.round(P.adv * sc), h: Math.round(P.size * 0.88 * sc) }), -hw + 4, hh + 36, { color: c.paper, alpha: 0.55 * aB }, cc);
      mono(X, fmt(s.fill, { hex: col.toUpperCase() }), hw - 2, hh + 36, { color: col, alpha: aB, align: "right" }, cc);
    }
    cc.scale(sc * P.SX, sc);
    /* the slam is streaked sideways until 0.12 (a pre-streaked sprite fading out), then drawn sharp */
    const k = 1 - u / 0.12;
    if (k > 0) { if (k < 1) { cc.globalAlpha = 1 - k; P.hot.put(cc); } cc.globalAlpha = k; P.hotBlur.put(cc); cc.globalAlpha = 1; }
    else { P.glow.put(cc); g.text(P.W, -(P.m.r - P.m.l) / 2, P.cap / 2, Object.assign({ color: col }, disp(P.size)), cc); }
    cc.restore();
  };
  hero(ctx);
}

/* ---------------------------------------------------------------- viewfinder: the camera */

function prepView(g, str, D) {
  const W = str.toUpperCase(), m100 = ink(g, W, disp(100)), size = Math.min(208, 820 / ((m100.l + m100.r) / 100)), m = ink(g, W, disp(size));
  const G = gradient(g), x0 = -(m.r - m.l) / 2, rect = [-(m.l + m.r) / 2 - 24, -m.a * 0.62, m.l + m.r + 48, m.a * 1.24];
  const word = (col, dx = 0, a = 1) => (c) => g.text(W, x0 + dx, m.a / 2, Object.assign({ color: col, alpha: a }, disp(size)), c);
  const full = (c) => { word(G.warm, 3, 0.9)(c); word(G.cold, -3, 0.9)(c); word(g.c.paper)(c); };
  /* the word as sprites (fringed, warm, cold), for the glitch's slices */
  return { W, size, m, x0, full, sprites: [sprite(g, D, rect, full), sprite(g, D, rect, word(G.warm)), sprite(g, D, rect, word(G.cold))] };
}

function viewfinder(X) {
  const { g, s, t, u, uq, P, ctx, view: v } = X, c = g.c, G = X.s._.grad, paper = c.paper, fr = u * FPB;
  const gr = ctx.createLinearGradient(1080, 0, 0, 1920);
  G.stops.forEach((col, k) => gr.addColorStop(k / (G.stops.length - 1), col));
  ctx.fillStyle = gr; ctx.fillRect(v.x - 2, v.y - 2, v.w + 4, v.h + 4);

  /* the word: fringed, glitching in, then a slow push */
  const cx = 545, cy = 917, gl = (1 - clamp(u / 0.22)) ** 2, push = 0.956 + 0.044 * g.ease.outCubic(g.seg(u, 0.2, 1));
  ctx.save(); ctx.translate(cx, cy); ctx.scale(push * (1 + 0.12 * gl), push);
  if (gl > 0.002) {
    /* ~12 slices jump sideways, some split in two, some in a fringe colour; a new pattern every frame */
    const [Sw, Sm, Sc] = P.sprites, k = Sw.k, rnd = g.rng(1000 + Math.floor(uq * FPB)), y1 = Sw.y + Sw.h;
    const cut = (S, y, h, x0, x1, dx) => ctx.drawImage(S.cv, (x0 - S.x) * k, (y - S.y) * k, (x1 - x0) * k, h * k, x0 + dx, y, x1 - x0, h);
    for (let y = Sw.y, h = 0; y < y1 - 0.5; y += h) {
      h = Math.min(y1 - y, 10 + 6 * rnd());
      const dx = (rnd() * 2 - 1) * 70 * gl, pick = rnd(), split = rnd() < 0.3 ? Sw.x + Sw.w * (0.2 + 0.6 * rnd()) : 0, dx2 = (rnd() * 2 - 1) * 70 * gl;
      /* a fringe-coloured copy under some slices, offset; while the glitch is strong it replaces the white one */
      if (pick < 0.5) cut(pick < 0.25 ? Sm : Sc, y, h, Sw.x, Sw.x + Sw.w, dx + (pick < 0.25 ? 1 : -1) * (8 + 24 * gl));
      if (pick < 0.5 * gl - 0.05) continue;
      if (split) { cut(Sw, y, h, Sw.x, split, dx); cut(Sw, y, h, split, Sw.x + Sw.w, dx2); } else cut(Sw, y, h, Sw.x, Sw.x + Sw.w, dx);
    }
    ctx.restore();
    if (gl > 0.1) for (let j = 0; j < 3; j++) { ctx.fillStyle = G.bar; ctx.fillRect(cx - 420 + 760 * rnd(), 760 + 330 * rnd(), 60 + 170 * rnd(), 3); }
  } else { P.full(ctx); ctx.restore(); }

  /* brackets slam in from outside (1.3×) to an undershoot (0.89×), then settle */
  const bs = fr < 10 ? keys(BRK, fr, 1) : 0.965 + 0.035 * g.ease.outCubic(g.seg(fr, 10, 24)), ba = keys(BRK, fr, 2);
  if (ba > 0) {
    const hx = 463 * bs, hy = 614 * bs, arm = 104;
    ctx.save(); ctx.strokeStyle = g.rgba(paper, ba); ctx.lineWidth = 7; ctx.lineCap = "square"; ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const px = 540 + sx * hx, py = 914 + sy * hy; ctx.moveTo(px, py - sy * arm); ctx.lineTo(px, py); ctx.lineTo(px - sx * arm, py); }
    ctx.stroke(); ctx.restore();
  }
  /* thirds, crosshairs, tick scales */
  const aF = g.smoothstep(0.31, 0.77, u);
  if (aF > 0) {
    const vx = [77 + 926 / 3, 77 + (2 * 926) / 3], hy = [300 + 1228 / 3, 300 + (2 * 1228) / 3];
    for (const x of vx) g.line(x, 305, x, 1526, paper, 1, 0.16 * aF, ctx);
    for (const y of hy) g.line(82, y, 998, y, paper, 1, 0.16 * aF, ctx);
    ctx.save(); ctx.strokeStyle = g.rgba(paper, 0.6 * aF); ctx.lineWidth = 1.5; ctx.beginPath();
    for (const x of vx) for (const y of hy) { ctx.moveTo(x - 11, y); ctx.lineTo(x + 11, y); ctx.moveTo(x, y - 11); ctx.lineTo(x, y + 11); }
    ctx.stroke();
    ctx.strokeStyle = g.rgba(paper, 0.7 * aF); ctx.lineWidth = 2; ctx.beginPath();
    for (let k = 0; k < 13; k++) { const y = 677 + k * 39.58, l = k % 3 ? 10 : 21; ctx.moveTo(96, y); ctx.lineTo(96 + l, y); ctx.moveTo(986, y); ctx.lineTo(986 - l, y); }
    ctx.stroke();
    ctx.fillStyle = g.rgba(paper, 0.85 * aF); ctx.beginPath(); ctx.moveTo(931, 908); ctx.lineTo(942, 914); ctx.lineTo(931, 920); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  /* the OSD */
  const aO = g.smoothstep(0.28, 0.34, u);
  if (aO > 0) {
    const o = { size: 19, track: 1.5, weight: 500, color: paper, alpha: 0.88 * aO }, R = Object.assign({}, o, { align: "right" });
    if (g.fract(t.bq) >= 0.5 && g.fract(t.bq) < 0.75) g.circle(96, 265, 6, c.accent, ctx);
    mono(X, fmt(s.rec, { w: g.W, h: g.H, fps: t.fps }), 120, 272, o);
    mono(X, s.af, 977, 272, R);
    g.ring(991, 265, 6.5, paper, 1.5, 0.88 * aO, ctx); ctx.save(); ctx.globalAlpha = 0.88 * aO; g.circle(991, 265, 3, paper, ctx); ctx.restore();
    mono(X, s.ev, 984, 660, R);
    mono(X, s.iso, 81, 1577, o);
    const F = t.fi; /* the frame being made: the same for every motion-blur sample */
    mono(X, fmt(s.frame, { f: pad(F, 4) }), 998, 1577, R);
  }
}

/* ---------------------------------------------------------------- bands: the editorial italic */

function prepBands(g, word) {
  const parts = word.trim().split(/\s+/), A = parts.length > 1 ? parts[0] : "", B = parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
  const fitS = (str, max, w) => Math.min(max, (100 * w) / Math.max(1, ink(g, str, serif(100)).l + ink(g, str, serif(100)).r));
  /* the original: "on" at 690 px (631 wide) over "purpose" at 300 px (871 wide); a single word sits alone, larger */
  let sA = A ? fitS(A, 690, 880) : 0, sB = A ? Math.min(fitS(B, 300, 871), sA) : fitS(B, 460, 871);
  const lay = () => {
    const mA = A ? ink(g, A, serif(sA)) : null, mB = ink(g, B, serif(sB)), kB = sB / 300;
    const lead = A ? Math.max(285 * kB, mA.d + mB.a + 21 * kB) : 0;
    const ext = (A ? mA.a : mB.a) + lead + Math.max(mB.d, 105 * kB);
    return { mA, mB, kB, lead, ext };
  };
  let L = lay();
  if (L.ext > 1150) { const k = 1150 / L.ext; sA *= k; sB *= k; L = lay(); }
  const top = 922 - L.ext / 2, bA = A ? top + L.mA.a : 0, bB = A ? bA + L.lead : top + L.mB.a;
  const xA = A ? 51 + 0.068 * sA + L.mA.l : 0, xB = 51 + L.mB.l, kB = L.kB;
  const right = 51 + L.mB.l + L.mB.r, r = 21 * kB, dot = [right + 38 * kB + r, bB - r];
  const lines = [];
  if (A) lines.push({ str: A, x: xA, y: bA, o: serif(sA), lt: g.letters(A, serif(sA)) });
  lines.push({ str: B, x: xB, y: bB, o: serif(sB), lt: g.letters(B, serif(sB)) });
  /* the swash: a tapered crescent under the last line, measured on the original's */
  const x1 = dot[0] + 22, x0 = x1 - Math.max(0.787 * (x1 - 51), Math.min(x1 - 51, 520 * kB)), mx = (x) => x0 + ((x - 254) / 749) * (x1 - x0), my = (y) => bB + (y - 1192) * kB;
  const swash = new Path2D();
  swash.moveTo(mx(254), my(1291)); swash.quadraticCurveTo(mx(640), my(1311), mx(1003), my(1238));
  swash.quadraticCurveTo(mx(600), my(1350), mx(254), my(1293)); swash.closePath();
  return { lines, dot, r, kB, swash, sx0: x0, sx1: x1, glyphs: lines.reduce((a, l) => a + l.lt.length, 0) };
}

function bands(X) {
  const { g, s, i, u, P, ctx, view: v } = X, c = g.c, acc = c.accent, n = u * FPB + 1;
  ground(X, c.paper);
  /* the band: its edge leans right going up (x = x0 - 0.298 y) and sweeps in on an exponential */
  const lead = 1235 * 0.65 ** n, sep = g.ease.outCubic(g.seg(n, 5, 14)), E = (y, d) => 853 - 0.298 * y - lead + d;
  const yT = v.y - 10, yB = v.y + v.h + 10, xL = v.x - 2400;
  const band = (cc, d) => { cc.beginPath(); cc.moveTo(xL, yT); cc.lineTo(E(yT, d), yT); cc.lineTo(E(yB, d), yB); cc.lineTo(xL, yB); cc.closePath(); };
  for (const [col, d] of [[c.blush, 120 * sep], [X.s._.grad.hot, 49 * sep], [acc, 0]]) { ctx.fillStyle = col; band(ctx, d); ctx.fill(); }

  /* the words, glyph by glyph rising along the slant (the second line a little later); the swash draws left to right */
  const st = Math.min(0.6, 6 / Math.max(1, P.glyphs)), kB = P.kB;
  const sw = 1 - (1 - g.seg(n, 10, 24)) ** 2.5, swX = P.sx0 + (P.sx1 - P.sx0) * sw;
  const text = (cc, col) => {
    let gi = 0;
    P.lines.forEach((L, li) => L.lt.forEach((lt) => {
      const a = clamp((n - gi++ * st - 1.2 * li + 1.2) / 2.5);
      if (a <= 0) return;
      const e = 1 - g.ease.outCubic(a);
      g.text(lt.ch, L.x + lt.x + 30 * e * kB, L.y + 60 * e * kB, Object.assign({ color: col, alpha: a }, L.o), cc);
    }));
    if (sw > 0) { cc.save(); cc.beginPath(); cc.rect(P.sx0 - 20, 0, swX - P.sx0 + 20, 4000); cc.clip(); cc.fillStyle = col; cc.fill(P.swash); cc.restore(); }
  };
  text(ctx, c.ink);
  ctx.save(); band(ctx, 0); ctx.clip(); text(ctx, c.paper); ctx.restore();

  /* the full stop pops on a spring, a ring goes out from it */
  if (s.dot) {
    const dn = n - 15, rk = (n - 13) / 11, [dx, dy] = P.dot;
    if (rk > 0) g.ring(dx, dy, (18 + 72 * g.ease.outCubic(clamp(rk))) * kB, acc, 2, 1 - g.smoothstep(0.6, 1.15, rk), ctx);
    if (dn > 0) g.circle(dx, dy, P.r * g.ease.spring((dn / FPB) * 0.5405, 5.2, 0.26), acc, ctx);
    const D = X.D; X.s._.anchor = [D.ox + dx * D.u, D.oy + dy * D.u];
  }
  /* the specimen caption */
  const aC = g.span(u, 0.37, 0.52);
  if (aC > 0) {
    mono(X, s.face, 74, 281, { size: 15, track: 1.8, color: c.paper, alpha: 0.78 * aC });
    mono(X, s.pts, 74, 305, { size: 15, track: 1.8, color: c.paper, alpha: 0.55 * aC });
    if (s.count) mono(X, fmt(s.count, { i: pad(i + 1), n: pad(s.words.length) }), 1004, 1560, { size: 15, track: 1.8, color: c.ink, alpha: 0.5 * aC, align: "right" });
  }
}

/* ---------------------------------------------------------------- grid: order */

/* a word fitted to a width (capped in size), centred on the box: its font, ink and origin */
function fitWord(g, word, o, maxW, maxS) {
  const m = ink(g, word, Object.assign({}, o, { size: 100 })), size = Math.min(maxS, (100 * maxW) / Math.max(1, m.l + m.r));
  const O = Object.assign({}, o, { size }), M = ink(g, word, O);
  return { O, M, x: 540 - (M.r - M.l) / 2, y: 914 + (M.a - M.d) / 2 };
}
function prepGrid(g, word) {
  const F = fitWord(g, word, disp(100), 900, 560);
  return Object.assign(F, { lt: g.letters(word, F.O) });
}
function grid(X) {
  const { g, s, i, u, uq, P, ctx } = X, c = g.c, ink0 = c.ink, k = g.ease.outExpo(clamp(u / 0.2));
  ground(X, c.paper);
  const L = 52, Rr = 1028, base = P.y, cap = P.y - P.M.a;
  ctx.save(); ctx.strokeStyle = g.rgba(ink0, 0.38); ctx.lineWidth = 1.5; ctx.beginPath();
  for (const y of [base, cap, (base + cap) / 2]) { ctx.moveTo(L, y); ctx.lineTo(L + (Rr - L) * k, y); }
  ctx.stroke();
  ctx.strokeStyle = g.rgba(ink0, 0.16); ctx.beginPath();
  P.lt.forEach((lt, j) => { if (uq < 0.06 + 0.02 * j) return; const x = P.x + lt.x; ctx.moveTo(x, cap - 70); ctx.lineTo(x, base + 70); });
  ctx.stroke(); ctx.restore();
  /* the letters: hard on, one after another, each with a frame of accent box */
  const per = Math.min(0.07, 0.55 / Math.max(1, P.lt.length));
  P.lt.forEach((lt, j) => {
    const on = uq - (0.12 + per * j);
    if (on < 0) return;
    g.text(lt.ch, P.x + lt.x, base, Object.assign({ color: ink0 }, P.O), ctx);
    if (on < 2.2 / FPB) { ctx.save(); ctx.strokeStyle = c.accent; ctx.lineWidth = 4; ctx.strokeRect(P.x + lt.x - 4, cap - 8, lt.w + 8, base - cap + 16); ctx.restore(); }
  });
  ctx.fillStyle = c.accent; ctx.fillRect(L - 18, base - 7, 13, 13);
  const aL = g.span(u, 0.1, 0.3);
  if (aL > 0) {
    mono(X, "BASELINE 0", L, base + 36, { size: 15, color: ink0, alpha: 0.6 * aL });
    mono(X, `CAP ${Math.round(P.M.a)}`, L, cap - 18, { size: 15, color: ink0, alpha: 0.6 * aL });
    mono(X, `GRID ${P.lt.length} × 1 · ALIGNED 100%`, L, 1560, { size: 15, color: ink0, alpha: 0.5 * aL });
    if (s.count) mono(X, fmt(s.count, { i: pad(i + 1), n: pad(s.words.length) }), 1004, 1560, { size: 15, color: ink0, alpha: 0.5 * aL, align: "right" });
  }
}

/* ---------------------------------------------------------------- glitch: torn */

function prepGlitch(g, word, D) {
  const F = fitWord(g, word, disp(100), 940, 460), m = 60;
  const rect = [F.x - F.M.l - m, F.y - F.M.a - m, F.M.l + F.M.r + 2 * m, F.M.a + F.M.d + 2 * m];
  const sp = (col) => sprite(g, D, rect, (cc) => g.text(word, F.x, F.y, Object.assign({ color: col }, F.O), cc));
  return Object.assign(F, { rect, paper: sp(g.c.paper), acc: sp(g.c.accent), cool: sp(g.mix(g.c.cool, "#ffffff", 0.35)) });
}
function glitch(X) {
  const { g, s, i, u, t, P, ctx } = X, c = g.c, step = Math.floor(t.fi / 2), [, ry, , rh] = P.rect;
  ground(X, c.ink);
  const amp = 150 * Math.exp(-u * 2.4) + 28, split = 10 + 26 * Math.exp(-u * 3);
  const n = 15, hs = []; let sum = 0;
  for (let j = 0; j < n; j++) { const h = 0.25 + g.hash(j, step, 1); hs.push(h); sum += h; }
  const roll = g.hash(step, 9) < 0.18 ? (g.hash(step, 10) - 0.5) * 70 : 0;
  let y = ry;
  for (let j = 0; j < n; j++) {
    const h = (hs[j] / sum) * rh, big = g.hash(j, step, 3) < 0.38, dx = (g.hash(j, step, 2) - 0.5) * 2 * amp * (big ? 1 : 0.12);
    const sy = (y - P.paper.y) * P.paper.k, sh = h * P.paper.k;
    const cut = (sp, ox, op) => { ctx.save(); ctx.globalCompositeOperation = op; ctx.drawImage(sp.cv, 0, Math.max(0, sy), sp.cv.width, Math.max(1, sh), sp.x + dx + ox, y + roll, sp.w, h); ctx.restore(); };
    cut(P.cool, -split, "lighter"); cut(P.acc, split, "lighter"); cut(P.paper, 0, "source-over");
    y += h;
  }
  /* a few dead scanlines across the frame */
  for (let j = 0; j < 4; j++) if (g.hash(j, step, 7) < 0.5) { const yy = ry + rh * g.hash(j, step, 8); ctx.fillStyle = g.rgba(j % 2 ? c.accent : c.paper, 0.7); ctx.fillRect(X.view.x, yy, X.view.w, 2 + 3 * g.hash(j, step, 6)); }
  const aL = g.span(u, 0.05, 0.2);
  if (aL > 0) {
    mono(X, `ERR 0x${(Math.floor(g.hash(step, 4) * 0xffff) >>> 0).toString(16).toUpperCase().padStart(4, "0")}`, 74, 281, { size: 15, color: c.accent, alpha: aL });
    mono(X, `SIGNAL ${Math.max(0, Math.round(100 * Math.exp(-u * 0.9) - 9))}%  ·  CRC FAIL`, 74, 305, { size: 15, color: c.paper, alpha: 0.6 * aL });
    if (s.count) mono(X, fmt(s.count, { i: pad(i + 1), n: pad(s.words.length) }), 1004, 1560, { size: 15, color: c.paper, alpha: 0.5 * aL, align: "right" });
  }
}

/* ---------------------------------------------------------------- pixel: losing resolution */

function prepPixel(g, word) {
  const F = fitWord(g, word, disp(100), 940, 460), cell = 4;
  const x0 = Math.floor(F.x - F.M.l - 8), y0 = Math.floor(F.y - F.M.a - 8), w = Math.ceil(F.M.l + F.M.r + 16), h = Math.ceil(F.M.a + F.M.d + 16);
  const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell), cv = document.createElement("canvas"); cv.width = cols; cv.height = rows;
  const cc = cv.getContext("2d", { willReadFrequently: true }); cc.scale(1 / cell, 1 / cell); cc.translate(-x0, -y0);
  g.text(word, F.x, F.y, Object.assign({ color: "#ffffff" }, F.O), cc);
  const d = cc.getImageData(0, 0, cols, rows).data, a = new Float32Array(cols * rows);
  for (let k = 0; k < a.length; k++) a[k] = d[k * 4 + 3] / 255;
  return Object.assign(F, { mask: { x0, y0, cols, rows, cell, a } });
}
const PIX = [6, 8, 12, 16, 24, 32, 48, 64];
function pixel(X) {
  const { g, s, i, u, uq, P, ctx } = X, c = g.c, M = P.mask;
  ground(X, c.cool);
  const lvl = Math.min(PIX.length - 1, Math.floor(clamp(uq / 0.9) ** 1.25 * PIX.length)), p = PIX[lvl], q = p / M.cell;
  const drop = 0.72 * clamp((u - 0.2) / 0.8) ** 1.3;
  const nx = Math.ceil(M.cols / q), ny = Math.ceil(M.rows / q), live = new Path2D(), hot = new Path2D(), fall = new Path2D();
  for (let by = 0; by < ny; by++) for (let bx = 0; bx < nx; bx++) {
    let cov = 0, cnt = 0;
    for (let j = Math.floor(by * q); j < Math.min(M.rows, Math.floor((by + 1) * q)); j++) for (let k = Math.floor(bx * q); k < Math.min(M.cols, Math.floor((bx + 1) * q)); k++) { cov += M.a[j * M.cols + k]; cnt++; }
    if (!cnt || cov / cnt < 0.42) continue;
    const X0 = M.x0 + bx * p, Y0 = M.y0 + by * p, hd = g.hash(bx * 7 + 3, by * 13 + 1, 5);
    if (hd < drop) {
      /* dropped: it falls away from the moment it went */
      const td = 0.2 + (hd / 0.72) ** (1 / 1.3) * 0.8, age = Math.max(0, u - td), fy = 1400 * age * age;
      if (fy < 1300) fall.rect(X0 + 1, Y0 + fy + 1, p - 2, p - 2);
      continue;
    }
    const gap = p > 8 ? 2 : 1;
    (g.hash(bx, by, 9) < 0.07 ? hot : live).rect(X0, Y0, p - gap, p - gap);
  }
  ctx.fillStyle = g.rgba(c.paper, 0.32); ctx.fill(fall);
  ctx.fillStyle = c.paper; ctx.fill(live); ctx.fillStyle = c.accent; ctx.fill(hot);
  const aL = g.span(u, 0.05, 0.2);
  if (aL > 0) {
    mono(X, `RES ${p} PX`, 74, 281, { size: 15, color: c.paper, alpha: 0.8 * aL });
    mono(X, `LOSS ${Math.round(drop * 100)}%`, 74, 305, { size: 15, color: c.paper, alpha: 0.55 * aL });
    if (s.count) mono(X, fmt(s.count, { i: pad(i + 1), n: pad(s.words.length) }), 1004, 1560, { size: 15, color: c.paper, alpha: 0.5 * aL, align: "right" });
  }
}

/* ---------------------------------------------------------------- overflow: too big for the frame */

function prepOverflow(g, word) {
  const m = String(word).match(/^(.*?)\^(.+)$/), base = m ? m[1] : String(word), pow = m ? m[2] : "", inf = base.trim() === "∞";
  const S = 820, O = disp(S), P = disp(S * 0.42), wB = inf ? 1500 : ink(g, base, O).l + ink(g, base, O).r, wP = pow ? ink(g, pow, P).l + ink(g, pow, P).r + 60 : 0;
  const M = ink(g, inf ? "0" : base || "0", O);
  return { base, pow, inf, S, O, P, w: wB + wP, wB, a: M.a, y: 914 + M.a / 2 };
}
function overflow(X) {
  const { g, s, i, u, P, ctx, view: v } = X, c = g.c, per = s.per;
  /* a violet bloom behind it, unless the scene brings its own ground (then that one shows, and a
     zoom into the scene finds it running on past the frame) */
  if (!s.ground) { const gr = ctx.createRadialGradient(540, 914, 0, 540, 914, 1300); gr.addColorStop(0, c.cool); gr.addColorStop(1, c.deep); ctx.fillStyle = gr; ctx.fillRect(v.x - 2, v.y - 2, v.w + 4, v.h + 4); }
  /* slam in at 1.35×, spring back, then push in slowly; pan across what does not fit */
  const sec = u * X.t.spb, sc = (1 + 0.35 * (1 - g.ease.spring(sec, 3.2, 0.42))) * (1 + 0.14 * (u / per));
  const over = Math.max(0, P.w - 900), pan = over ? over / 2 - over * g.ease.inOutSine(clamp(u / per)) : 0;
  const fill = ctx.createLinearGradient(0, P.y - P.a, 0, P.y); fill.addColorStop(0, c.accent); fill.addColorStop(1, c.sun);
  ctx.save(); ctx.translate(540, 914); ctx.scale(sc, sc); ctx.translate(-540 + pan, -914);
  const x0 = 540 - P.w / 2;
  if (P.inf) {
    ctx.save(); ctx.strokeStyle = fill; ctx.lineWidth = 150; ctx.lineCap = "round"; ctx.beginPath();
    const W = P.wB / 2;
    for (let k = 0; k <= 240; k++) { const t = (k / 240) * Math.PI * 2, d = 1 + Math.sin(t) ** 2, x = 540 + (W * Math.cos(t)) / d, y = 914 + (W * Math.sin(t) * Math.cos(t)) / d; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath(); ctx.stroke(); ctx.restore();
  } else {
    g.text(P.base, x0, P.y, Object.assign({ color: fill }, P.O), ctx);
    if (P.pow) g.text(P.pow, x0 + P.wB + 40, P.y - P.a * 0.62, Object.assign({ color: c.paper }, P.P), ctx);
  }
  ctx.restore();
  const aL = g.span(u, 0.04, 0.2);
  if (aL > 0) {
    mono(X, `N = ${P.inf ? "→ ∞" : P.pow ? `${P.base}^${P.pow}` : P.base}`, 74, 281, { size: 15, color: c.paper, alpha: 0.8 * aL });
    mono(X, `DIGITS ${P.inf ? "∞" : P.pow ? String(+P.pow + 1) : String(P.base.replace(/\D/g, "").length)}`, 74, 305, { size: 15, color: c.paper, alpha: 0.5 * aL });
    if (s.count) mono(X, fmt(s.count, { i: pad(i + 1), n: pad(s.words.length) }), 1004, 1560, { size: 15, color: c.paper, alpha: 0.5 * aL, align: "right" });
  }
}

/* ---------------------------------------------------------------- dust: crumbling */

function prepDust(g, word) {
  const lower = word === word.toLowerCase(), F = fitWord(g, word, lower ? serif(100) : disp(100), 900, lower ? 400 : 440);
  const x0 = F.x - F.M.l, x1 = F.x + F.M.r, y0 = F.y - F.M.a, y1 = F.y + F.M.d, W = Math.ceil(x1 - x0 + 8), H = Math.ceil(y1 - y0 + 8), k = 0.5;
  const cv = document.createElement("canvas"); cv.width = Math.ceil(W * k); cv.height = Math.ceil(H * k);
  const cc = cv.getContext("2d", { willReadFrequently: true }); cc.scale(k, k); cc.translate(-x0 + 4, -y0 + 4);
  g.text(word, F.x, F.y, Object.assign({ color: "#ffffff" }, F.O), cc);
  const d = cc.getImageData(0, 0, cv.width, cv.height).data, pts = [], r = g.rng(17);
  for (let guard = 0; pts.length < 3600 && guard < 400000; guard++) {
    const px = Math.floor(r() * cv.width), py = Math.floor(r() * cv.height);
    if (d[(py * cv.width + px) * 4 + 3] > 128) pts.push([x0 - 4 + px / k, y0 - 4 + py / k, r(), r(), r()]);
  }
  return Object.assign(F, { pts, x0, x1, y0, y1 });
}
function dust(X) {
  const { g, s, i, u, P, ctx } = X, c = g.c;
  ground(X, c.paper);
  const span = P.x1 - P.x0 + 220, run = 0.9 * s.per, rag = (y) => 46 * g.noise3(y * 0.012, 3.1, i), front = (y) => P.x0 - 110 + (span * u) / run + rag(y);
  /* what is left of the word: right of the ragged front */
  ctx.save(); ctx.beginPath(); ctx.moveTo(4000, P.y0 - 60);
  for (let y = P.y0 - 60; y <= P.y1 + 60; y += 12) ctx.lineTo(front(y), y);
  ctx.lineTo(4000, P.y1 + 60); ctx.closePath(); ctx.clip();
  g.text(s.words[i], P.x, P.y, Object.assign({ color: c.ink }, P.O), ctx);
  ctx.restore();
  /* what it left behind, blowing away */
  const a = new Path2D(), b = new Path2D();
  for (const [hx, hy, r1, r2, r3] of P.pts) {
    const tr = ((hx - rag(hy) - P.x0 + 110) / span) * run, age = u - tr, life = 0.55 + 0.5 * r3;
    if (age <= 0 || age > life) continue;
    const x = hx + (260 + 420 * r1) * age + 60 * g.noise3(hx * 0.01, age * 3, 1), y = hy - (180 + 300 * r2) * age * (1 + age) + 50 * g.noise3(hy * 0.01, age * 3, 2);
    const rr = 3.4 * (1 - age / life) + 0.4;
    (r3 < 0.13 ? b : a).rect(x - rr, y - rr, 2 * rr, 2 * rr);
  }
  ctx.fillStyle = c.ink; ctx.fill(a); ctx.fillStyle = c.accent; ctx.fill(b);
  const aL = g.span(u, 0.1, 0.3);
  if (aL > 0) {
    mono(X, `INTACT ${Math.max(0, Math.round(100 * (1 - u / run)))}%`, 74, 281, { size: 15, color: c.ink, alpha: 0.7 * aL });
    mono(X, "DISPERSAL  ∂ρ/∂t > 0", 74, 305, { size: 15, color: c.ink, alpha: 0.5 * aL });
    if (s.count) mono(X, fmt(s.count, { i: pad(i + 1), n: pad(s.words.length) }), 1004, 1560, { size: 15, color: c.ink, alpha: 0.5 * aL, align: "right" });
  }
}
})();
