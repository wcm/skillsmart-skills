/*
 * Fractal: a Koch snowflake that grows detail without end, then an endless dive into one of its
 * corners. A triangle sprouts a bump on every edge, level after level (each bump rising out of
 * the flat), the camera glides to the top corner and zooms, and because the curve there is the
 * same at three times the size, the dive goes on for ever: the picture is the same every 3×, only
 * the ZOOM readout keeps counting.
 *
 *   grow     when the levels grow: [from, to], fractions of the scene; depth: the level reached
 *   glide    when the camera glides to the corner (then the dive takes the rest)
 *   per      beats for each 3× of the dive (a shorter one dives faster)
 *   fill     the snowflake's fill: a role, or [role, role] for a gradient down the frame
 *   stroke   its edge (a role, or null)
 */
(() => {
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const S0 = 6; /* the dive runs from 6× to 18× about the corner, then round again: the same picture */
Reel.scene("fractal", {
  label: "FRACTAL",
  bg: "cool",
  beats: 6,
  params: {
    grow: [0.04, 0.42],
    depth: 6,
    glide: [0.42, 0.58],
    per: 1.6,
    size: 0.44, /* the triangle's circumradius, a fraction of the stage's smaller side */
    fill: ["accent", "sun"],
    stroke: "paper",
    readout: ["KOCH / LEVEL {level}", "D = log 4 / log 3 ≈ 1.262", "ZOOM ×{zoom}"], /* top-left (case kept): {level} {zoom} */
  },
  prepare(s, g) {
    const st = g.stage, R0 = st.min * s.size, O = [st.cx, st.cy + R0 * 0.12];
    const V = [0, 1, 2].map((k) => [O[0] + R0 * Math.cos(-Math.PI / 2 + (k * TAU) / 3), O[1] + R0 * Math.sin(-Math.PI / 2 + (k * TAU) / 3)]);
    /* which way a bump points: away from the centre */
    const P1 = lerp2(V[0], V[1], 1 / 3), P2 = lerp2(V[0], V[1], 2 / 3), a1 = apex(P1, P2, 1), sign = Math.hypot(a1[0] - O[0], a1[1] - O[1]) > Math.hypot((P1[0] + P2[0]) / 2 - O[0], (P1[1] + P2[1]) / 2 - O[1]) ? 1 : -1;
    /* the snowflake for the glide and the dive: fine everywhere, finest round the top corner */
    const near = (A, B, j) => j < s.depth || (j < 9 && Math.min(dist(A, V[0]), dist(B, V[0])) < 190 + dist(A, B));
    const pts = [];
    for (let e = 0; e < 3; e++) adaptive(V[e], V[(e + 1) % 3], 0, sign, near, pts);
    const fine = new Path2D(); pts.forEach(([x, y], i) => (i ? fine.lineTo(x, y) : fine.moveTo(x, y))); fine.closePath();
    return { O, V, sign, fine, n: pts.length, anchor: [st.cx, st.cy], anchorR: 0 };
  },
  draw(g, s, t) {
    const _ = s._, ctx = g.ctx, st = g.stage, p = clamp(t.b / s.beats), [g0, g1] = s.grow, [l0, l1] = s.glide;
    const C = [st.cx, st.cy];
    let path, sc = 1, P = _.O, level;
    if (p < l0) {
      /* growing: level L, the last level's bumps rising out of the flat */
      level = s.depth * g.ease.inOutSine(clamp((p - g0) / (g1 - g0)));
      const k = Math.floor(level), h = level - k, levels = Array.from({ length: Math.min(s.depth, k + 1) }, (_x, j) => (j < k ? 1 : h));
      const pts = [];
      for (let e = 0; e < 3; e++) uniform(_.V[e], _.V[(e + 1) % 3], levels, 0, _.sign, pts);
      path = new Path2D(); pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y))); path.closePath();
    } else {
      level = s.depth;
      if (p < l1) {
        /* the glide: towards the corner, zooming to the dive's first scale */
        const e = g.ease.inOutCubic((p - l0) / (l1 - l0));
        sc = S0 ** e; P = lerp2(_.O, _.V[0], e);
      } else {
        /* the dive: ×3 every per beats, for ever; the picture repeats each time */
        const dives = ((p - l1) * s.beats) / s.per;
        sc = S0 * 3 ** (dives - Math.floor(dives)); P = _.V[0];
        level = s.depth + Math.floor(dives * 1);
      }
      path = _.fine;
    }
    /* screen = C + sc · (world - P): the snowflake's centre on the frame's, then the corner */
    const M = new DOMMatrix().translate(C[0], C[1]).scale(sc).translate(-P[0], -P[1]);
    const shown = new Path2D(); shown.addPath(path, M);
    const fills = [].concat(s.fill), fill = fills.length > 1 ? (() => { const gr = ctx.createLinearGradient(0, g.box.y, 0, g.box.b); fills.forEach((f, i) => gr.addColorStop(i / (fills.length - 1), g.col(f))); return gr; })() : g.col(fills[0]);
    ctx.save(); ctx.fillStyle = fill; ctx.fill(shown, "nonzero");
    if (s.stroke) { ctx.strokeStyle = g.rgba(g.col(s.stroke), 0.9); ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke(shown); }
    ctx.restore();
    /* the readout: the level and the true zoom (it keeps counting through the repeats) */
    const pq = clamp(t.bq / s.beats), zq = pq < l0 ? 1 : pq < l1 ? S0 ** g.ease.inOutCubic((pq - l0) / (l1 - l0)) : S0 * 3 ** (((pq - l1) * s.beats) / s.per);
    const vars = { level: Math.min(99, Math.floor(level)), zoom: zq < 1000 ? zq.toFixed(zq < 10 ? 2 : 0) : zq.toExponential(1).replace("e+", "e") };
    const ink = g.on(s.bg), fade = g.smoothstep(0.02, 0.12, p);
    [].concat(s.readout || []).forEach((str, i) => { if (str) g.text(String(str).replace(/\{(\w+)\}/g, (m, q) => (q in vars ? vars[q] : m)), g.box.x + 27.5, g.box.y + 63.5 + i * 23.7 * g.grow(16), { kind: "mono", size: 16, weight: i ? 400 : 600, track: 1.9, color: ink, alpha: fade * (i ? 0.53 : 0.82) }); });
    _.anchor = C;
  },
});

const lerp2 = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
const dist = (A, B) => Math.hypot(A[0] - B[0], A[1] - B[1]);
/* the tip of the bump on the middle third P1–P2 (sign: which side) */
function apex(P1, P2, sign) {
  const dx = P2[0] - P1[0], dy = P2[1] - P1[1], c = 0.5, sn = (Math.sqrt(3) / 2) * sign;
  return [P1[0] + dx * c - dy * sn, P1[1] + dx * sn + dy * c];
}
/* a Koch edge A→B with bump heights per level (1 full, 0 flat), its points (B left for the next edge) */
function uniform(A, B, levels, j, sign, out) {
  if (j >= levels.length) { out.push(A); return; }
  const P1 = lerp2(A, B, 1 / 3), P2 = lerp2(A, B, 2 / 3), M = lerp2(A, B, 0.5), T = apex(P1, P2, sign), h = levels[j], Q = [M[0] + (T[0] - M[0]) * h, M[1] + (T[1] - M[1]) * h];
  uniform(A, P1, levels, j + 1, sign, out); uniform(P1, Q, levels, j + 1, sign, out); uniform(Q, P2, levels, j + 1, sign, out); uniform(P2, B, levels, j + 1, sign, out);
}
/* a full Koch edge, subdivided only where more() says so */
function adaptive(A, B, j, sign, more, out) {
  if (!more(A, B, j)) { out.push(A); return; }
  const P1 = lerp2(A, B, 1 / 3), P2 = lerp2(A, B, 2 / 3), T = apex(P1, P2, sign);
  adaptive(A, P1, j + 1, sign, more, out); adaptive(P1, T, j + 1, sign, more, out); adaptive(T, P2, j + 1, sign, more, out); adaptive(P2, B, j + 1, sign, more, out);
}
})();
