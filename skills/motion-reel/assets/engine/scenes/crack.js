/*
 * Crack: a shape that fractures. It holds, turning a little, as the stress readout climbs; a
 * crack runs out from the point of impact, each new line flashing in the accent before it opens;
 * then the shape comes apart along its cracks and the pieces drift away from each other, turning,
 * as if weightless, faster and faster. Any shape: a square tile, a logo, a planet, a letter.
 *
 *   shape    any shape spec (square, circle, star-5, text:A, { d, view })
 *   at       the point of impact, in the shape's radius ([0.2, -0.3]: right of centre and up)
 *   pieces   how many pieces it breaks into (more near the impact)
 *   crack    when the crack runs: [from, to], fractions of the scene
 *   split    when the pieces come apart: [from, to]
 *   drift    how far they drift (1: off the frame by the end), spin how much they turn
 *   gap      the width of a crack, px
 */
(() => {
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
Reel.scene("crack", {
  label: "FRACTURE",
  bg: "ink",
  beats: 4,
  params: {
    shape: "square", /* the shape that breaks */
    size: 0.36, /* its radius, a fraction of the stage's smaller side */
    color: "paper", /* its colour */
    turn: 9, /* degrees it turns while whole */
    at: [0.22, -0.3], /* the impact, in its radius */
    pieces: 34,
    crack: [0.16, 0.46],
    split: [0.46, 1],
    drift: 1,
    spin: 1,
    gap: 5,
    seed: 3,
    title: "SAMPLE / {state}", /* the readout's first line (case kept): {state} INTACT, CRACKING, FRACTURED */
    lines: ["STRESS {mpa} MPa", "PIECES {n}", "GAP {gap} px"], /* the rest: {mpa} {n} {gap} live */
    states: ["INTACT", "CRACKING", "FRACTURED"],
    peak: 412, /* the stress the readout climbs to */
  },
  prepare(s, g) {
    const st = g.stage, R = st.min * s.size, cx = st.cx, cy = st.cy, r = g.rng(s.seed);
    const ix = cx + s.at[0] * R, iy = cy + s.at[1] * R, sites = [];
    for (let i = 0; i < s.pieces; i++) {
      if (i < s.pieces * 0.55) { const a = r() * TAU, d = R * 1.5 * r() ** 1.5; sites.push([ix + d * Math.cos(a), iy + d * Math.sin(a)]); }
      else sites.push([cx + (r() * 2 - 1) * R * 1.1, cy + (r() * 2 - 1) * R * 1.1]);
    }
    const box = [cx - R * 1.25, cy - R * 1.25, cx + R * 1.25, cy + R * 1.25];
    const cells = g.voronoi(sites, box).map((c) => {
      const d = Math.hypot(c.c[0] - ix, c.c[1] - iy) || 1;
      return Object.assign(c, { d, u: [(c.c[0] - ix) / d, (c.c[1] - iy) / d], r1: r(), r2: r(), r3: r() });
    });
    /* the crack network: every cell edge once, with how far it is from the impact */
    const edges = [], seen = new Set();
    for (const c of cells) for (let k = 0; k < c.poly.length; k++) {
      const a = c.poly[k], b = c.poly[(k + 1) % c.poly.length], key = [a, b].map((p) => p.map((v) => Math.round(v)).join(",")).sort().join("|");
      if (seen.has(key)) continue; seen.add(key);
      if ([a, b].every((p) => p[0] <= box[0] + 1 || p[0] >= box[2] - 1 || p[1] <= box[1] + 1 || p[1] >= box[3] - 1)) continue;
      const da = Math.hypot(a[0] - ix, a[1] - iy), db = Math.hypot(b[0] - ix, b[1] - iy);
      edges.push(da <= db ? { a, b, d0: da, d1: db } : { a: b, b: a, d0: db, d1: da });
    }
    const far = Math.max(...edges.map((e) => e.d1), 1);
    /* the whole shape, once, as a picture the pieces are cut from */
    const L = document.createElement("canvas"); L.width = Math.ceil(g.W * g.scale); L.height = Math.ceil(g.H * g.scale);
    const lx = L.getContext("2d"); lx.setTransform(g.scale, 0, 0, g.scale, 0, 0); lx.fillStyle = g.col(s.color); lx.beginPath();
    if (g.shapePath(s.shape, lx, cx, cy, R) !== "filled") lx.fill();
    return { R, cx, cy, ix, iy, cells, edges, far, pic: L, anchor: [cx, cy], anchorR: 0 };
  },
  draw(g, s, t) {
    const _ = s._, ctx = g.ctx, p = clamp(t.b / s.beats), [c0, c1] = s.crack, [s0, s1] = s.split;
    const whole = (s.turn * Math.PI) / 180 * g.ease.inOutSine(clamp(p / s1));
    const front = clamp((p - c0) / (c1 - c0)), split = clamp((p - s0) / (s1 - s0)), ground = g.col(s.bg), acc = g.c.accent;
    const fr = g.ease.outCubic(front) * _.far * 1.02;
    /* the pieces: together until the split, then apart, each its own way, faster and faster */
    const e = split ** 1.8, F = Math.hypot(g.W, g.H) * 0.62 * s.drift;
    ctx.save(); ctx.translate(_.cx, _.cy); ctx.rotate(whole); ctx.translate(-_.cx, -_.cy);
    if (split <= 0) ctx.drawImage(_.pic, 0, 0, g.W, g.H); /* whole: one picture, no seams */
    else for (const c of _.cells) {
      const away = (0.35 + 0.65 * c.r1) * (1.3 - Math.min(1, c.d / (_.R * 2)));
      const dx = c.u[0] * (s.gap * 0.6 + F * away * e) + (c.r2 - 0.5) * 40 * e, dy = c.u[1] * (s.gap * 0.6 + F * away * e) + (c.r3 - 0.5) * 40 * e;
      const rot = (c.r2 - 0.5) * 2.4 * s.spin * e;
      ctx.save(); ctx.translate(c.c[0] + dx, c.c[1] + dy); ctx.rotate(rot); ctx.translate(-c.c[0], -c.c[1]);
      ctx.beginPath(); c.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
      ctx.drawImage(_.pic, 0, 0, g.W, g.H);
      ctx.restore();
    }
    /* the cracks running out from the impact: lit in the accent as they form, then open; kept to
       the shape (drawn on a layer, then cut by the shape's own picture) */
    if (front > 0 && split < 1) {
      const L = g.layer("crack-lines"), c = L.ctx;
      c.lineCap = "round";
      for (const ed of _.edges) {
        if (ed.d0 > fr) continue;
        const q = clamp((fr - ed.d0) / Math.max(1, ed.d1 - ed.d0)), bx = ed.a[0] + (ed.b[0] - ed.a[0]) * q, by = ed.a[1] + (ed.b[1] - ed.a[1]) * q;
        const age = clamp((fr - ed.d1) / (_.far * 0.25));
        c.strokeStyle = g.mix(acc, ground, age); c.lineWidth = s.gap * (0.5 + 0.5 * age);
        c.beginPath(); c.moveTo(ed.a[0], ed.a[1]); c.lineTo(bx, by); c.stroke();
      }
      c.globalCompositeOperation = "destination-in"; c.drawImage(_.pic, 0, 0, g.W, g.H); c.globalCompositeOperation = "source-over";
      ctx.save(); ctx.globalAlpha = 1 - split; ctx.drawImage(L.canvas, 0, 0, g.W, g.H); ctx.restore();
    }
    ctx.restore();
    /* the impact: a ring and a flash as the crack starts */
    const hit = (p - c0) / 0.06;
    if (hit > 0 && hit < 1) { g.ring(_.ix, _.iy, 12 + 180 * hit, acc, 3, 1 - hit); g.circle(_.ix, _.iy, 10 * (1 - hit), acc); }
    /* the readout: stress climbs to the crack, then falls away */
    const pq = clamp(t.bq / s.beats), mpa = Math.round(s.peak * (pq < c0 ? (pq / c0) * 0.86 : pq < c1 ? 0.86 + 0.14 * ((pq - c0) / (c1 - c0)) : Math.max(0, 1 - (pq - c1) * 3)));
    const state = s.states[pq < c0 ? 0 : pq < s0 ? 1 : 2], ink = g.on(s.bg), fade = g.smoothstep(0.02, 0.12, p) * (1 - g.smoothstep(0.9, 0.99, p));
    const vars = { state, mpa: String(mpa).padStart(3, "0"), n: pq < s0 ? 1 : _.cells.length, gap: (s.gap * clamp((pq - c0) / (c1 - c0)) + 900 * clamp((pq - s0) / (s1 - s0)) ** 1.8).toFixed(1) };
    [s.title, ...s.lines].forEach((str, i) => { if (str) g.text(String(str).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)), g.box.x + 27.5, g.box.y + 63.5 + i * 23.7 * g.grow(16), { kind: "mono", size: 16, weight: i ? 400 : 600, track: 1.9, color: ink, alpha: fade * (i ? 0.53 : 0.82) }); });
  },
});
})();
