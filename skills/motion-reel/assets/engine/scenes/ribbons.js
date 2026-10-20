/*
 * Ribbons (LINE & FLOW). Fat striped "snakes" (an ink outline, a soft drop shadow and a stack of
 * nested stripes, so the round ends show concentric caps) slither at ~5000 px/s along long
 * Catmull-Rom paths across a flat field. Each head decelerates (v0 - a·t) and the tail replays
 * the same motion a fixed lag behind, so a snake is ~1400 px long at speed and shortens as it
 * slows. Ribbons stack in a set order and a ribbon's own crossings put the later stretch on top
 * (the knot); weave: true alternates over / under along each path instead. Ahead of every head
 * its path waits as a faint dashed guide with bezier keys (a diamond on a tangent handle, "K07",
 * every third key filled with the ribbon's outer colour). Impact bursts (a ring that blooms and
 * fades, a crown of ticks that drifts out and lingers) pop at a head at set moments. A black chip
 * bottom-left reads out the newest path (name, arc s, speed, heading) over a stats line, at the
 * frame's own time so the digits stay sharp under the motion blur. Times are seconds of the
 * original's 2 beats at 111 BPM, stretched to the scene (a longer scene is a slower one); the
 * shutter is a little longer than the engine's so heads smear ~50 px.
 *
 *   beat 0      hard cut mid-action: the tricolor already curls up-right, its body trailing off
 *               bottom-left; the pink head enters bottom-right. Chip PATH 01, LIVE 2
 *   0 - 0.55    the tricolor hooks over the top and loops back over itself into a knot (top
 *               right); pink runs left along the bottom and up the left side
 *   0.13        the blue pinstripe enters top-left (chip PATH 02, LIVE 3), runs under the knot's
 *               top arc and down through its loop; burst at its head at 0.38
 *   0.49        the orange candy spawns off bottom-left (chip PATH 04, LIVE 4)
 *   0.56        burst where the tricolor's head crosses itself
 *   0.6 - 1.4   pink sweeps across the middle over blue and the tricolor, and out the top; the
 *               tricolor leaves right; orange carves an S up the left over blue (bursts at its head
 *               0.89, 1.12, 1.38); blue swings down and along the bottom
 *   1.4 - 2     all decelerate (~3000 px/s); orange climbs out the top (burst 1.64); hard cut
 */
(() => {
const DUR = 1.081; /* the original's 2 beats at 111 BPM: the motion params are in these seconds */
const REF = { cx: 540, cy: 914.78, hw: 465.45, hh: 646.27 }; /* the stage of a 1080×1920 reel */
const STEP = 5; /* arc-length table resolution, px */
/* the original's paths, design px of a 1080×1920 reel (mapped through the stage) */
const PATHS = [
  [[-200, 1420], [0, 1300], [250, 1130], [500, 950], [700, 830], [885, 734], [983, 529], [985, 420], [870, 378], [800, 385], [695, 435], [662, 520], [663, 560], [690, 630], [767, 670], [940, 756], [1037, 907], [1058, 1037], [1150, 1120]],
  [[1250, 1620], [1080, 1580], [870, 1470], [745, 1480], [600, 1540], [421, 1534], [280, 1460], [205, 1350], [170, 1200], [184, 1058], [260, 940], [410, 875], [648, 810], [842, 691], [900, 580], [875, 486], [800, 380], [734, 324], [551, 216], [475, 86], [450, -150]],
  [[152, -235], [259, 86], [340, 220], [475, 324], [650, 330], [800, 370], [860, 450], [889, 560], [889, 690], [860, 800], [756, 907], [600, 960], [475, 1015], [380, 1100], [324, 1199], [320, 1320], [346, 1436], [420, 1520], [518, 1577], [691, 1685], [864, 1728], [1015, 1771], [1250, 1800]],
  [[-150, 2000], [100, 1940], [400, 1860], [700, 1740], [900, 1620], [950, 1523], [900, 1380], [745, 1274], [600, 1230], [432, 1177], [250, 1080], [162, 994], [150, 880], [238, 713], [380, 650], [551, 626], [756, 518], [850, 430], [896, 324], [880, 200], [842, 108], [820, -150]],
];

Reel.scene("ribbons", {
  label: "LINE & FLOW",
  bg: "sun",
  beats: 2,
  shutter: 0.6,
  params: {
    stripes: [ /* per ribbon, outer band to centre band: a role, or [role, thickness] (default 1); drawn in this order */
      [["accent", 15], ["paper", 19], ["cool", 32]],
      [["blush", 20], ["paper", 12], ["blush", 12], ["ink", 12]],
      ["cool", "paper", "cool", "paper", "cool"],
      ["paper", "accent", "paper", "accent"],
    ],
    paths: null, /* optional: per ribbon a list of [x, y] in -1..1 of the stage (beyond ±1 is off-frame), a Catmull-Rom runs through them */
    motion: [[-0.251, 5726, 5301, 0.34], [-0.036, 5471, 3856], [0.071, 5709, 4368], [0.263, 6417, 4205]], /* per ribbon [spawn s, head speed px/s, deceleration px/s², tail lag s (optional)], in seconds of the original's 2 beats */
    lag: 0.38, /* seconds the tail runs behind the head (the snake's length), unless motion gives one */
    order: [2, 0, 3, 1], /* stacking, bottom first (ribbon indices); a ribbon's own crossings put the later stretch on top */
    weave: false, /* true: crossings alternate over / under along each path instead of stacking by order */
    width: 118, /* ribbon width, outline included, px */
    outline: 7.5, /* ink outline each side, px */
    keys: [[645, 215], [244, 299], [323, 301], [372, 311]], /* per ribbon [arc of K01, spacing], px: the bezier keys along each path */
    key: "K", /* key label prefix (K01, K02 ...) */
    tags: ["PATH 03", "PATH 01", "PATH 02", "PATH 04"], /* the chip's name for each ribbon (cycled); the chip shows the newest one */
    readout: ["{tag}  s={s}", "v {v} px/s  θ {th}°"], /* the chip's two lines: {tag} name, {s} arc 0-1, {v} speed, {th} heading in degrees */
    stats: "STROKE ×{n}   LIVE {live}   WEAVE {x} X", /* the line under the chip: {n} ribbons, {live} spawned so far, {x} crossings */
    bursts: [[2, 0.205, 0], [0, 0.3], [3, 0.482], [3, 0.607], [3, 0.748], [3, 0.885]], /* impact bursts at a ribbon's head: [ribbon, s, ring 0/1 (default 1)]: a ring and a crown of ticks that lingers */
  },
  prepare(s, g) {
    const st = g.stage, W = s.width;
    const motion = s.motion && s.motion.length ? s.motion : [[0, 5000, 3000]];
    const ribbons = (s.stripes || []).map((stripes, i) => {
      const own = s.paths && s.paths[i];
      if (!stripes || !stripes.length) stripes = ["paper"];
      const uv = own || PATHS[i % PATHS.length].map(([x, y]) => [(x - REF.cx) / REF.hw, (y - REF.cy) / REF.hh]);
      const lut = arcTable(catmull(uv.map(([u, v]) => [st.cx + (u * st.w) / 2, st.cy + (v * st.h) / 2])));
      const [t0, v0, a, lag] = motion[i % motion.length];
      /* the stripes as nested stroke widths, outermost first */
      const bands = stripes.map((b) => (Array.isArray(b) ? { c: b[0], w: +b[1] || 1 } : { c: b, w: 1 }));
      const total = bands.reduce((sum, b, j) => sum + (j === bands.length - 1 ? b.w : 2 * b.w), 0), inner = W - 2 * s.outline;
      let used = 0;
      const nest = bands.map((b) => { const w = inner * (1 - used / total); used += 2 * b.w; return { c: b.c, w }; });
      /* keys: given spacing on the default paths, every 300 px on others */
      const [k1, gap] = (!own && s.keys && s.keys[i]) || [225, 300];
      const keys = [];
      for (let n = 1, a0 = k1; a0 < lut.L - 20; n++, a0 += gap) if (a0 > 0) keys.push({ n, s: a0 });
      return { i, lut, L: lut.L, t0, v0, a: Math.max(1e-6, a), lag: lag ?? s.lag, nest, keys, tag: s.tags && s.tags.length ? s.tags[i % s.tags.length] : "", col: nest[0].c };
    });
    /* crossings, static (the paths never move). Stacked: a ribbon's own crossings put the later
       stretch on top. Woven: over and under alternate along each path */
    const X = crossings(ribbons, W);
    const order = [...new Set([...(s.order || []).filter((i) => i >= 0 && i < ribbons.length), ...ribbons.map((r) => r.i)])];
    if (s.weave) {
      const occ = ribbons.map(() => []);
      X.forEach((c) => { occ[c.a].push({ c, side: "a", s: c.sa }); occ[c.b].push({ c, side: "b", s: c.sb }); });
      occ.forEach((list) => {
        list.sort((p, q) => p.s - q.s);
        let over = true;
        for (const o of list) {
          if (o.c.over) over = o.c.over === o.side;
          else o.c.over = over ? o.side : o.side === "a" ? "b" : "a";
          over = !over;
        }
      });
    } else X.forEach((c) => { if (c.a === c.b) c.over = c.sb > c.sa ? "b" : "a"; });
    /* bursts at the heads: where and when */
    const events = (ribbons.length ? s.bursts || [] : []).map(([i, t0, ring = 1], k) => {
      const r = ribbons[i % ribbons.length], [x, y] = sample(r.lut, Math.min(r.L, Math.max(0, headAt(r, t0))));
      return { t: t0, x, y, ring, seed: k + 1 };
    }).sort((p, q) => p.t - q.t);
    return { ribbons, X, events, order };
  },
  draw(g, s, t) {
    const { ctx } = g, _ = s._, W = s.width, ink = g.c.ink, sec = t.p * DUR, kv = DUR / Math.max(1e-6, t.beats * t.spb);
    const state = _.ribbons.map((r) => {
      const head = headAt(r, sec), tail = headAt(r, sec - r.lag);
      return { r, head, tail, a0: Math.max(0, tail), a1: Math.min(r.L, head) };
    });
    /* the path ahead: a faint dashed guide, fading out ~760 px ahead of the head */
    ctx.save(); ctx.lineCap = "round"; ctx.setLineDash([2.5, 5.5]); ctx.lineWidth = 2;
    for (const q of state) {
      const from = Math.max(0, q.head), to = Math.min(q.r.L, q.head + 760);
      if (to - from < 4) continue;
      ctx.lineDashOffset = -q.head;
      for (let k = 0; k < 3; k++) {
        const a0 = from + ((to - from) * k) / 3, a1 = from + ((to - from) * (k + 1)) / 3;
        ctx.strokeStyle = g.rgba(ink, 0.22 * (1 - k / 3)); ctx.stroke(polyline(q.r.lut, a0, a1));
      }
    }
    ctx.restore();
    /* the ribbons, bottom first, each with its own knots fixed; woven: every upper strand again on top */
    const near = (q, at, h) => at - h < q.a1 && at + h > q.a0;
    const fix = (c) => {
      const A = state[c.a], B = state[c.b];
      if (!c.over || !near(A, c.sa, c.h) || !near(B, c.sb, c.h)) return;
      const [top, so, bot, su] = c.over === "a" ? [A, c.sa, B, c.sb] : [B, c.sb, A, c.sa];
      const lo = Math.max(top.a0, so - c.h), hi = Math.min(top.a1, so + c.h);
      if (hi - lo <= 0.5) return;
      /* its shadow, only where it falls on the strand below (the ground already has one) */
      const u0 = Math.max(bot.a0, su - c.h - 40), u1 = Math.min(bot.a1, su + c.h + 40);
      if (u1 - u0 > 1) {
        ctx.save(); ctx.clip(band(bot.r.lut, u0, u1, W / 2)); ctx.lineJoin = "round"; ctx.lineCap = "butt";
        drop(ctx, polyline(top.r.lut, lo, hi), W, ink, g.rgba); ctx.restore();
      }
      ribbon(g, s, top.r, lo, hi, false, lo <= top.a0 + 0.01, hi >= top.a1 - 0.01);
    };
    for (const i of _.order) {
      const q = state[i];
      if (q.a1 - q.a0 <= 0.5) continue;
      ribbon(g, s, q.r, q.a0, q.a1, true, true, true);
      if (!s.weave) for (const c of _.X) if (c.a === i && c.b === i) fix(c);
    }
    if (s.weave) _.X.forEach(fix);
    /* bezier keys: a diamond on its tangent handle, from ~700 px ahead of the head (a path whose
       ribbon is still to come shows its first keys) until the head passes */
    for (const q of state) {
      const r = q.r;
      if (q.head > r.L + 60) continue;
      for (const k of r.keys) {
        const d = k.s - Math.max(-150, q.head), al = (1 - g.smoothstep(690, 780, d)) * g.smoothstep(-45, -5, d);
        if (al <= 0.01) continue;
        const [x, y, tx, ty] = sample(r.lut, k.s);
        if (x < g.box.x || x > g.box.r || y < g.box.y || y > g.box.b) continue;
        ctx.save(); ctx.globalAlpha *= al;
        ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - tx * 64, y - ty * 64); ctx.lineTo(x + tx * 64, y + ty * 64); ctx.stroke();
        for (const sg of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sg * tx * 64, y + sg * ty * 64, 5.5, 0, g.TAU); ctx.fillStyle = g.c.paper; ctx.fill(); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 12, y); ctx.lineTo(x, y + 12); ctx.lineTo(x - 12, y); ctx.closePath();
        ctx.fillStyle = k.n % 3 === 1 ? g.col(r.col) : g.c.paper; ctx.fill(); ctx.stroke();
        g.text(s.key + String(k.n).padStart(2, "0"), x + 14, y - 11, { kind: "mono", size: 11.5, weight: 600, track: 0.9, color: ink, alpha: 0.5 });
        ctx.restore();
      }
    }
    /* impact bursts: a ring that blooms and fades, a crown of ticks that drifts out and lingers */
    for (const e of _.events) {
      const dt = sec - e.t;
      if (dt < 0) break;
      const r = 60 + 130 * g.ease.outCubic(Math.min(1, dt / 0.15)), ra = 0.17 * e.ring * (1 - g.seg(dt, 0.08, 0.32)), ta = g.seg(dt, 0, 0.03) * (1 - g.seg(dt, 0.5, 0.65));
      if (ra > 0) g.ring(e.x, e.y, r, ink, 6, ra);
      if (ta <= 0) continue;
      const rnd = g.rng(e.seed * 7919 + 13), n = 11, drift = 40 * g.ease.outCubic(Math.min(1, dt / 0.6));
      ctx.save(); ctx.strokeStyle = ink; ctx.lineWidth = 3.5; ctx.lineCap = "butt"; ctx.globalAlpha *= ta; ctx.beginPath();
      for (let m = 0; m < n; m++) {
        const an = (g.TAU * (m + (rnd() - 0.5) * 0.7)) / n + e.seed, rr = r * (0.66 + rnd() * 0.2) + drift, len = 17 + rnd() * 8;
        if (rnd() < 0.12) continue;
        ctx.moveTo(e.x + Math.cos(an) * rr, e.y + Math.sin(an) * rr); ctx.lineTo(e.x + Math.cos(an) * (rr + len), e.y + Math.sin(an) * (rr + len));
      }
      ctx.stroke(); ctx.restore();
    }
    /* the chip: the newest live path, then the stats line, above the HUD's scene index. Read at the
       frame's own time (bq), so the digits stay sharp under the motion blur */
    const sq = (t.bq / t.beats) * DUR, live = _.ribbons.filter((r) => sq >= r.t0), r = live.reduce((m, x) => (!m || x.t0 >= m.t0 ? x : m), null);
    const bx = g.box.x + 29.5, by = g.box.b - 109;
    if (r) {
      const head = headAt(r, sq), v = Math.max(0, r.v0 - r.a * (sq - r.t0)) * kv, [, , tx, ty] = sample(r.lut, Math.min(r.L, Math.max(0, head)));
      const th = Math.round(((Math.atan2(ty, tx) * 180) / Math.PI + 360) % 360) % 360;
      const vals = { tag: r.tag, s: Math.min(1, Math.max(0, head / r.L)).toFixed(2), v: String(Math.round(v)).padStart(4, "0"), th: String(th).padStart(3, "0") };
      const lines = [].concat(s.readout || []).map((l) => fill(l, vals)), o = { kind: "mono", size: 12.6, weight: 600, track: 1.9 };
      const cw = Math.max(300, ...lines.map((l) => g.measure(l, o) + 32));
      ctx.fillStyle = ink; ctx.fillRect(bx, by, cw, 46);
      ctx.fillStyle = g.col(r.col); ctx.fillRect(bx, by, 5, 46);
      g.text(lines[0] || "", bx + 15.5, by + 19, Object.assign({ color: g.col(s.bg), alpha: 0.95 }, o));
      g.text(lines[1] || "", bx + 15.5, by + 37, Object.assign({ color: g.c.paper }, o));
    }
    g.mono(fill(s.stats, { n: _.ribbons.length, live: live.length, x: _.X.length }), bx, by + 73, { size: 14, weight: 500, track: 1.4, color: ink, alpha: 0.62 });
  },
});

/* the arc a snake's head has run, sec seconds into the scene (negative before it spawns) */
function headAt(r, sec) {
  const tau = sec - r.t0;
  if (tau <= 0) return r.v0 * tau;
  const stop = r.v0 / r.a;
  return tau >= stop ? (r.v0 * r.v0) / (2 * r.a) : r.v0 * tau - 0.5 * r.a * tau * tau;
}
const fill = (str, vals) => String(str).replace(/\{(\w+)\}/g, (m, k) => (k in vals ? vals[k] : m));

/* one stretch [a0, a1] of a ribbon: shadow, outline, stripes, all round-capped. capA/capB false: that
   end is cut square instead, by clipping away its cap, each layer a pixel further out than the one
   above it so the cut leaves no seam */
function ribbon(g, s, r, a0, a1, shadow, capA, capB) {
  const { ctx } = g, n = r.nest.length, path = polyline(r.lut, a0, a1);
  ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round";
  const layer = (j, w, col) => {
    const k = n - j, cut = !capA || !capB;
    if (cut) { ctx.save(); if (!capA) uncap(ctx, r.lut, a0 + k, -1, s.width); if (!capB) uncap(ctx, r.lut, a1 - k, 1, s.width); }
    ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke(path);
    if (cut) ctx.restore();
  };
  if (shadow) drop(ctx, path, s.width, g.c.ink, g.rgba);
  layer(0, s.width, g.c.ink);
  r.nest.forEach((b, j) => layer(j + 1, b.w, g.col(b.c)));
  ctx.restore();
}
/* the drop shadow of a stroked path: offset down-right, ~20% ink, a 4 px soft edge (two flat strokes,
   far cheaper than a blur) */
function drop(ctx, path, W, ink, rgba) {
  ctx.save(); ctx.translate(14, 12);
  ctx.lineWidth = W + 5; ctx.strokeStyle = rgba(ink, 0.09); ctx.stroke(path);
  ctx.lineWidth = W - 3; ctx.strokeStyle = rgba(ink, 0.12); ctx.stroke(path);
  ctx.restore();
}
/* clip away the round cap beyond arc d (dir -1: behind it, +1: ahead of it): a box just past the cut */
function uncap(ctx, T, d, dir, W) {
  const [x, y, tx, ty] = sample(T, d), h = W / 2 + 3, e = W / 2 + 6, B = 1e5, p = new Path2D();
  p.rect(-B, -B, 2 * B, 2 * B);
  p.moveTo(x - ty * h, y + tx * h); p.lineTo(x + ty * h, y - tx * h);
  p.lineTo(x + ty * h + dir * tx * e, y - tx * h + dir * ty * e); p.lineTo(x - ty * h + dir * tx * e, y + tx * h + dir * ty * e); p.closePath();
  ctx.clip(p, "evenodd");
}

/* centripetal Catmull-Rom through the points, 16 samples a span */
function catmull(P, k = 16) {
  const n = P.length, out = [];
  if (n < 2) return P.slice();
  const ext = [[2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]], ...P, [2 * P[n - 1][0] - P[n - 2][0], 2 * P[n - 1][1] - P[n - 2][1]]];
  const tj = (a, b) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
  for (let i = 0; i < n - 1; i++) {
    const [p0, p1, p2, p3] = [ext[i], ext[i + 1], ext[i + 2], ext[i + 3]];
    const t1 = tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
    for (let j = 0; j < k; j++) {
      const t = t1 + ((t2 - t1) * j) / k, q = [0, 0];
      for (let d = 0; d < 2; d++) {
        const A1 = ((t1 - t) * p0[d] + t * p1[d]) / t1, A2 = ((t2 - t) * p1[d] + (t - t1) * p2[d]) / (t2 - t1), A3 = ((t3 - t) * p2[d] + (t - t2) * p3[d]) / (t3 - t2);
        const B1 = ((t2 - t) * A1 + t * A2) / t2, B2 = ((t3 - t) * A2 + (t - t1) * A3) / (t3 - t1);
        q[d] = ((t2 - t) * B1 + (t - t1) * B2) / (t2 - t1);
      }
      out.push(q);
    }
  }
  out.push(P[n - 1]);
  return out;
}
/* resample a polyline every STEP px of arc: { x, y, L } */
function arcTable(P) {
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = cum[cum.length - 1], n = Math.max(2, Math.ceil(L / STEP) + 1), x = new Float32Array(n), y = new Float32Array(n);
  let j = 1;
  for (let i = 0; i < n; i++) {
    const d = Math.min(L, i * STEP);
    while (j < P.length - 1 && cum[j] < d) j++;
    const f = (d - cum[j - 1]) / Math.max(1e-6, cum[j] - cum[j - 1]);
    x[i] = P[j - 1][0] + (P[j][0] - P[j - 1][0]) * f; y[i] = P[j - 1][1] + (P[j][1] - P[j - 1][1]) * f;
  }
  return { x, y, L, n };
}
/* [x, y, tangent x, tangent y] at arc d */
function sample(T, d) {
  const u = Math.min(T.n - 1.001, Math.max(0, d / STEP)), i = Math.floor(u), f = u - i;
  const x = T.x[i] + (T.x[i + 1] - T.x[i]) * f, y = T.y[i] + (T.y[i + 1] - T.y[i]) * f;
  const i0 = Math.max(0, i - 1), i1 = Math.min(T.n - 1, i + 2), dx = T.x[i1] - T.x[i0], dy = T.y[i1] - T.y[i0], l = Math.hypot(dx, dy) || 1;
  return [x, y, dx / l, dy / l];
}
/* the stretch [a0, a1] as a Path2D */
function polyline(T, a0, a1) {
  const p = new Path2D(), [x0, y0] = sample(T, a0), [x1, y1] = sample(T, a1);
  p.moveTo(x0, y0);
  /* every other table point (10 px chords), the same ones for every stretch so redrawn pieces match */
  for (let i = 2 * Math.floor(a0 / STEP / 2) + 2; i * STEP < a1 && i < T.n; i += 2) p.lineTo(T.x[i], T.y[i]);
  p.lineTo(x1, y1);
  return p;
}
/* the outline of the stretch [a0, a1] widened to half-width w, as a closed Path2D (square ends) */
function band(T, a0, a1, w) {
  const L = [], R = [], n = Math.max(2, Math.ceil((a1 - a0) / 8));
  for (let k = 0; k <= n; k++) {
    const [x, y, tx, ty] = sample(T, a0 + ((a1 - a0) * k) / n);
    L.push([x - ty * w, y + tx * w]); R.push([x + ty * w, y - tx * w]);
  }
  const p = new Path2D();
  [...L, ...R.reverse()].forEach(([x, y], k) => (k ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
}
/* every crossing of every pair of paths (and of a path with itself): where, at which arcs, and how
   long a stretch of the upper strand must be redrawn to cover the lower one there */
function crossings(rs, W) {
  const out = [];
  for (let a = 0; a < rs.length; a++) for (let b = a; b < rs.length; b++) {
    const A = rs[a].lut, B = rs[b].lut;
    for (let i = 0; i < A.n - 1; i++) {
      const ax0 = A.x[i], ay0 = A.y[i], ax1 = A.x[i + 1], ay1 = A.y[i + 1];
      for (let j = a === b ? i + Math.ceil((3 * W) / STEP) : 0; j < B.n - 1; j++) {
        const bx0 = B.x[j], by0 = B.y[j], bx1 = B.x[j + 1], by1 = B.y[j + 1];
        if (Math.max(bx0, bx1) < Math.min(ax0, ax1) || Math.min(bx0, bx1) > Math.max(ax0, ax1) || Math.max(by0, by1) < Math.min(ay0, ay1) || Math.min(by0, by1) > Math.max(ay0, ay1)) continue;
        const rx = ax1 - ax0, ry = ay1 - ay0, sx = bx1 - bx0, sy = by1 - by0, den = rx * sy - ry * sx;
        if (Math.abs(den) < 1e-9) continue;
        const u = ((bx0 - ax0) * sy - (by0 - ay0) * sx) / den, v = ((bx0 - ax0) * ry - (by0 - ay0) * rx) / den;
        if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
        const sin = Math.abs(den) / (Math.hypot(rx, ry) * Math.hypot(sx, sy)), cos = Math.sqrt(Math.max(0, 1 - sin * sin));
        const sa = (i + u) * STEP, sb = (j + v) * STEP;
        out.push({ a, b, sa, sb, x: ax0 + rx * u, y: ay0 + ry * u, h: Math.min(320, ((W / 2) * (1 + cos)) / Math.max(0.2, sin) + 10) });
      }
    }
  }
  return out;
}
})();
