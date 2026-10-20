/*
 * Cells: type set on a grid, one cell at a time, and every lit cell a particle. A word (or a few
 * lines) is rasterised onto a strict grid of squares, dots or crosses; then it plays your steps:
 * it builds in a scan, holds, shakes, scatters, falls into a heap, or rearranges into another
 * word cell by cell. Order to disorder in one picture.
 *
 *   steps: [
 *     { move: "build", by: "scan", beats: 1.5 },      cells switch on row by row, a scan line ahead
 *     { move: "hold", beats: 1 },
 *     { move: "jitter", amp: [0, 0.8], beats: 1 },    they shake harder (in cells)
 *     { word: "CHAOS", beats: 1 },                     the cells run to another word
 *     { move: "fall", beats: 1.5 },                    they drop and pile up at the bottom
 *   ]
 *
 * Step options: move (build, hold, jitter, scatter, fall, morph: to the step's word, wave), word
 * (a step with a word and no move morphs to it), beats, ease, stagger, by (build/morph/fall order:
 * "scan" row by row, "column", "random", "centre" out), amp (jitter: [from, to] in cells), heat
 * (the share of cells in the accent, a number or [from, to]), power (scatter).
 */
(() => {
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;

Reel.scene("cells", {
  label: "TYPE / CELLS",
  bg: "paper",
  beats: 4,
  params: {
    words: ["ORDER"], /* the lines of type, set on the grid */
    cell: 26, /* the grid's pitch, px */
    shape: "square", /* each lit cell: "square", "dot", "plus" or "cross" */
    fill: 0.82, /* how much of its cell a lit cell fills */
    color: null, /* the cells' colour (role); null = the ink that reads on the ground */
    accent: "accent", /* the colour heat turns them */
    heat: 0, /* the share of cells in the accent to begin with */
    marks: true, /* the faint dot at every unlit cell */
    weight: 900, /* the type's weight before it is rasterised */
    tall: 1, /* the type stretched up before it is rasterised (2 = twice as tall): poster-tall letters */
    steps: [
      { move: "build", by: "scan", beats: 1.6 },
      { move: "hold", beats: 1.2 },
      { move: "jitter", amp: [0, 0.7], heat: [0, 0.25], beats: 1.2 },
    ],
    panel: ["GRID {cols}×{rows}", "CELLS {on}", "ORDER {order}%"], /* top-left readout (case kept): {cols} {rows} {on} {order} {move} */
  },
  prepare(s, g) {
    const st = g.stage, c = s.cell, cols = Math.floor(st.w / c), rows = Math.floor(st.h / c);
    const ox = st.cx - (cols * c) / 2 + c / 2, oy = st.cy - (rows * c) / 2 + c / 2;
    const steps = [].concat(s.steps || []).map((x) => Object.assign({}, x));
    if (!steps.length) steps.push({ move: "hold" });
    const tot = steps.reduce((a, x) => a + (x.beats ?? 1), 0) || 1;
    let at = 0;
    for (const x of steps) { x.len = ((x.beats ?? 1) / tot) * s.beats; x.at = at; at += x.len; x.move = x.move || (x.word ? "morph" : "hold"); }
    /* the lit cells of each word state: the first from words, then every step's word */
    const raster = (lines) => litCells(g, [].concat(lines), cols, rows, s.weight, s.tall);
    const states = [raster(s.words)];
    steps.forEach((x) => { if (x.word) states.push(raster(x.word)); x.state = states.length - 1; });
    const n = Math.max(...states.map((q) => q.length));
    /* every particle's home in each state (row-major, so a morph keeps reading order); extras double up */
    const home = states.map((q) => { const h = new Float32Array(n * 2); for (let i = 0; i < n; i++) { const p = q[Math.floor((i * q.length) / n)] || [cols / 2, rows / 2]; h[i * 2] = p[0]; h[i * 2 + 1] = p[1]; } return h; });
    /* the heap a fall makes: per column, cells stacked from the stage bottom in the order they fall */
    const r1 = new Float32Array(n), r2 = new Float32Array(n);
    for (let i = 0; i < n; i++) { r1[i] = g.hash(i, 1); r2[i] = g.hash(i, 2); }
    /* where each step starts: the end of the one before (in cell coordinates) */
    const C = { g, n, r1, r2, cols, rows, home };
    const P0 = [];
    let cur = new Float32Array(home[0]), heat = s.heat, vis = steps[0].move === "build" ? 0 : 1;
    steps.forEach((x) => {
      x.h0 = Array.isArray(x.heat) ? x.heat[0] : heat; x.h1 = Array.isArray(x.heat) ? x.heat[1] : typeof x.heat === "number" ? x.heat : heat; heat = x.h1;
      x.order = order(x, cur, n, r1, cols, rows);
      if (x.move === "fall") x.heap = heap(cur, n, rows, x.order);
      x.v0 = vis; if (x.move === "build") vis = 1; x.v1 = vis;
      P0.push(cur);
      const out = new Float32Array(n * 2);
      step(C, x, 1, cur, out, (x.at + x.len) * g.R.spb * s.slow);
      cur = out;
    });
    return { c, cols, rows, ox, oy, n, steps, P0, C, buf: new Float32Array(n * 2), anchor: [st.cx, st.cy] };
  },
  draw(g, s, t) {
    const _ = s._, ctx = g.ctx, c = _.c, b = clamp(t.b, 0, s.beats - 1e-6);
    let k = 0;
    while (k < _.steps.length - 1 && b >= _.steps[k].at + _.steps[k].len) k++;
    const x = _.steps[k], u = clamp((b - x.at) / x.len), P = _.buf;
    step(_.C, x, u, _.P0[k], P, t.sec);
    const ink = g.col(s.color || g.on(s.bg)), acc = g.col(s.accent), heat = lerp(x.h0, x.h1, u);
    /* the unlit grid */
    if (s.marks) {
      ctx.save(); ctx.fillStyle = g.rgba(ink, 0.16); ctx.beginPath();
      for (let j = 0; j < _.rows; j++) for (let i = 0; i < _.cols; i++) { const X = _.ox + i * c, Y = _.oy + j * c; ctx.moveTo(X + 1.3, Y); ctx.arc(X, Y, 1.3, 0, TAU); }
      ctx.fill(); ctx.restore();
    }
    /* the scan line of a build, ahead of the cells it lights */
    if (x.move === "build" && u < 1) {
      const sy = _.oy + Math.min(1, u / 0.85) * _.rows * c - c / 2;
      g.line(g.box.x, sy, g.box.r, sy, acc, 2, 0.85 * (1 - u));
    }
    /* the cells: a pop as each lights, its own size and turn when it flies */
    const half = (c * s.fill) / 2, paths = [new Path2D(), new Path2D()], E = g.ease;
    for (let i = 0; i < _.n; i++) {
      let sc = 1;
      if (x.move === "build") { const q = clamp((u - 0.85 * x.order[i]) / 0.15); if (q <= 0) continue; sc = q < 1 ? E.outBack(q, 3) : 1; }
      else if (x.v0 === 0 && x.v1 === 0) continue;
      const X = _.ox + P[i * 2] * c, Y = _.oy + P[i * 2 + 1] * c;
      if (X < -c || X > g.W + c || Y < -c || Y > g.H + c) continue;
      const hot = _.C.r2[i] < heat ? 1 : 0, h = half * sc, path = paths[hot];
      if (s.shape === "dot") { path.moveTo(X + h, Y); path.arc(X, Y, h, 0, TAU); }
      else if (s.shape === "plus" || s.shape === "cross") {
        const w = h * 0.36, rot = s.shape === "cross" ? Math.PI / 4 : 0, cs = Math.cos(rot), sn = Math.sin(rot);
        for (const [a, bb] of [[h, w], [w, h]]) { const pts = [[-a, -bb], [a, -bb], [a, bb], [-a, bb]].map(([px, py]) => [X + px * cs - py * sn, Y + px * sn + py * cs]); path.moveTo(...pts[0]); for (const p of pts.slice(1)) path.lineTo(...p); path.closePath(); }
      } else path.rect(X - h, Y - h, 2 * h, 2 * h);
    }
    ctx.save(); ctx.fillStyle = ink; ctx.fill(paths[0]); ctx.fillStyle = acc; ctx.fill(paths[1]); ctx.restore();
    /* the readout: how much order is left (mean distance from home, in cells) */
    let dev = 0;
    const H0 = _.C.home[x.state ?? 0];
    for (let i = 0; i < _.n; i += 3) dev += Math.hypot(P[i * 2] - H0[i * 2], P[i * 2 + 1] - H0[i * 2 + 1]);
    dev /= Math.ceil(_.n / 3);
    const lit = x.move === "build" ? Math.round(_.n * clamp(u / 0.85)) : x.v1 ? _.n : 0;
    const vars = { cols: _.cols, rows: _.rows, on: lit, order: Math.max(0, Math.round(100 * Math.exp(-dev / 3))), move: x.move.toUpperCase() };
    const fade = g.smoothstep(0.02, 0.15, t.b);
    [].concat(s.panel || []).forEach((str, i) => { if (str) g.text(String(str).replace(/\{(\w+)\}/g, (m, q) => (q in vars ? vars[q] : m)), g.box.x + 27.5, g.box.y + 63.5 + i * 23.7 * g.grow(16), { kind: "mono", size: 16, weight: i ? 400 : 600, track: 1.9, color: g.on(s.bg), alpha: fade * (i ? 0.53 : 0.82) }); });
  },
});

/* the lit cells of some lines of type on a cols × rows grid: [[i, j], …] row by row */
function litCells(g, lines, cols, rows, weight, tall = 1) {
  const k = 4, W = cols * k, H = rows * k, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d", { willReadFrequently: true });
  const lh = Math.min(H / (lines.length * 1.05 * tall), (H * 0.42) / tall);
  x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
  lines.forEach((ln, li) => {
    let size = lh * 1.18;
    x.font = g.font("display", size, weight); x.letterSpacing = "0px";
    const w = x.measureText(ln).width; if (w > W * 0.9) { size *= (W * 0.9) / w; x.font = g.font("display", size, weight); }
    x.save(); x.translate(W / 2, H / 2 + (li - (lines.length - 1) / 2) * lh * 1.02 * tall); x.scale(1, tall);
    x.fillText(ln, 0, size * 0.04); x.restore();
  });
  const d = x.getImageData(0, 0, W, H).data, out = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = d[((j * k + k / 2) * W + i * k + k / 2) * 4 + 3]; if (a > 127) out.push([i, j]); }
  return out;
}

function order(x, P, n, r1, cols, rows) {
  const o = new Float32Array(n), by = x.by || (x.move === "fall" || x.move === "scatter" ? "random" : "scan");
  for (let i = 0; i < n; i++) {
    const X = P[i * 2], Y = P[i * 2 + 1];
    o[i] = by === "random" ? r1[i] : by === "column" ? (X + Y / rows) / cols : by === "centre" ? Math.min(1, Math.hypot(X - cols / 2, Y - rows / 2) / Math.hypot(cols / 2, rows / 2)) : (Y + X / cols) / rows;
  }
  return o;
}

/* where each cell comes to rest in a fall: stacked in its column from the bottom row, in the order it falls */
function heap(P, n, rows, ord) {
  const out = new Float32Array(n), byCol = new Map();
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => P[b * 2 + 1] - P[a * 2 + 1]);
  for (const i of idx) { const col = Math.round(P[i * 2]), h = byCol.get(col) || 0; out[i] = rows - 1 - h; byCol.set(col, h + 1); }
  return out;
}

function step(C, x, u, A, out, sec) {
  const { g, n, r1, r2 } = C, S = clamp(x.stagger ?? (x.move === "fall" ? 0.55 : x.move === "morph" ? 0.35 : 0.2), 0, 0.95);
  const E = g.ease[x.ease || (x.move === "fall" ? "inQuad" : x.move === "scatter" ? "inCubic" : "inOutCubic")] || g.ease.inOutCubic;
  const p = (i) => clamp((u - S * x.order[i]) / (1 - S));
  switch (x.move) {
    case "morph": {
      const H = C.home[x.state];
      for (let i = 0; i < n; i++) { const e = E(p(i)), arc = Math.sin(Math.PI * e) * (r1[i] - 0.5) * 6; out[i * 2] = lerp(A[i * 2], H[i * 2], e) + arc * 0.3; out[i * 2 + 1] = lerp(A[i * 2 + 1], H[i * 2 + 1], e) - Math.abs(arc); }
      return;
    }
    case "jitter": {
      const [a0, a1] = [].concat(x.amp ?? [0, 0.6]).concat([0.6]), amp = lerp(a0, a1 ?? a0, u), w = x.speed ?? 10;
      for (let i = 0; i < n; i++) { out[i * 2] = A[i * 2] + amp * g.noise3(i * 0.61, sec * w, 0.5); out[i * 2 + 1] = A[i * 2 + 1] + amp * g.noise3(i * 0.61, sec * w, 7.3); }
      return;
    }
    case "scatter": {
      const cx = C.cols / 2, cy = C.rows / 2, pw = x.power ?? 1;
      for (let i = 0; i < n; i++) {
        const e = E(p(i)), dx = A[i * 2] - cx, dy = A[i * 2 + 1] - cy, d = Math.hypot(dx, dy) || 1, sp = (14 + 40 * r2[i]) * pw;
        out[i * 2] = A[i * 2] + (dx / d) * sp * e + (r1[i] - 0.5) * 8 * e; out[i * 2 + 1] = A[i * 2 + 1] + (dy / d) * sp * e + 20 * e * e;
      }
      return;
    }
    case "fall": {
      for (let i = 0; i < n; i++) { const e = E(p(i)), rest = x.heap[i], y0 = A[i * 2 + 1]; out[i * 2] = A[i * 2]; out[i * 2 + 1] = Math.min(rest, lerp(y0, rest + 0.0001, e) + 0); }
      return;
    }
    case "wave": {
      for (let i = 0; i < n; i++) { out[i * 2] = A[i * 2]; out[i * 2 + 1] = A[i * 2 + 1] - 1.2 * Math.sin(Math.PI * u) * Math.sin(A[i * 2] * 0.35 - u * TAU * 1.5); }
      return;
    }
    default: out.set(A);
  }
}
})();
