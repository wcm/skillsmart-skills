/*
 * Geometry: every drawing in Trame is a shape, a list of polylines sampled from SVG path data.
 * Polylines make the three things the style lives on cheap: drawing a line on (trim by length),
 * morphing one drawing into another (resample to the same count and lerp), and hand-drawn boil.
 *
 * A shape is { paths: [{ pts: [x0, y0, x1, y1, ...], closed }], anchors: { name: [x, y] } }.
 * Coordinates are local: shapes in the library sit in a 200 × 200 box centred on 0, 0.
 */

const STEP = 1.5; // sampling step in local units

/* ---------- SVG path data → polylines ---------- */


function tokens(d) {
  const out = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/g;
  let m;
  while ((m = re.exec(d))) out.push(m[1] || parseFloat(m[2]));
  return out;
}

function bez3(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}
function bez2(p0, p1, p2, t) {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

function arcPoints(x1, y1, rx, ry, phi, large, sweep, x2, y2, out) {
  // SVG spec F.6.5: endpoint to centre parameterisation
  if (rx === 0 || ry === 0) return out.push(x2, y2);
  rx = Math.abs(rx); ry = Math.abs(ry);
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) co = -co;
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(6, Math.ceil((Math.abs(dt) * Math.max(rx, ry)) / STEP));
  for (let i = 1; i <= n; i++) {
    const t = t1 + (dt * i) / n;
    const x = rx * Math.cos(t), y = ry * Math.sin(t);
    out.push(cp * x - sp * y + cx, sp * x + cp * y + cy);
  }
}

/** Parse SVG path data into polylines: [{ pts, closed }]. */
export function parsePath(d) {
  const tk = tokens(d);
  const paths = [];
  let cur = null, cmd = "", i = 0;
  let x = 0, y = 0, sx = 0, sy = 0, lcx = 0, lcy = 0, lqx = 0, lqy = 0, prev = "";
  const num = () => tk[i++];
  const start = (nx, ny) => {
    if (cur && cur.pts.length > 2) paths.push(cur);
    cur = { pts: [nx, ny], closed: false };
    sx = nx; sy = ny;
  };
  const line = (nx, ny) => {
    const dx = nx - x, dy = ny - y, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (STEP * 4)));
    for (let k = 1; k <= n; k++) cur.pts.push(x + (dx * k) / n, y + (dy * k) / n);
  };
  const curve = (f, approx) => {
    const n = Math.max(6, Math.ceil(approx / STEP));
    for (let k = 1; k <= n; k++) cur.pts.push(...f(k / n));
  };
  while (i < tk.length) {
    if (typeof tk[i] === "string") cmd = tk[i++];
    else if (!cmd) { i++; continue; }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === "Z") {
      if (cur) { if (Math.hypot(x - sx, y - sy) > 0.01) line(sx, sy); cur.closed = true; x = sx; y = sy; }
      prev = "Z";
      continue;
    }
    if (typeof tk[i] !== "number") { i++; continue; }
    if (C === "M") {
      const nx = num() + ox, ny = num() + oy;
      start(nx, ny); x = nx; y = ny;
      cmd = rel ? "l" : "L";
    } else if (C === "L") {
      const nx = num() + ox, ny = num() + oy;
      if (!cur) start(x, y);
      line(nx, ny); x = nx; y = ny;
    } else if (C === "H") {
      const nx = num() + ox;
      if (!cur) start(x, y);
      line(nx, y); x = nx;
    } else if (C === "V") {
      const ny = num() + oy;
      if (!cur) start(x, y);
      line(x, ny); y = ny;
    } else if (C === "C" || C === "S") {
      let x1, y1;
      if (C === "C") { x1 = num() + ox; y1 = num() + oy; }
      else if (prev === "C" || prev === "S") { x1 = 2 * x - lcx; y1 = 2 * y - lcy; }
      else { x1 = x; y1 = y; }
      const x2 = num() + ox, y2 = num() + oy, nx = num() + ox, ny = num() + oy;
      if (!cur) start(x, y);
      const x0 = x, y0 = y;
      const approx = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(nx - x2, ny - y2);
      curve((t) => [bez3(x0, x1, x2, nx, t), bez3(y0, y1, y2, ny, t)], approx);
      lcx = x2; lcy = y2; x = nx; y = ny;
    } else if (C === "Q" || C === "T") {
      let x1, y1;
      if (C === "Q") { x1 = num() + ox; y1 = num() + oy; }
      else if (prev === "Q" || prev === "T") { x1 = 2 * x - lqx; y1 = 2 * y - lqy; }
      else { x1 = x; y1 = y; }
      const nx = num() + ox, ny = num() + oy;
      if (!cur) start(x, y);
      const x0 = x, y0 = y;
      curve((t) => [bez2(x0, x1, nx, t), bez2(y0, y1, ny, t)], Math.hypot(x1 - x0, y1 - y0) + Math.hypot(nx - x1, ny - y1));
      lqx = x1; lqy = y1; x = nx; y = ny;
    } else if (C === "A") {
      const rx = num(), ry = num(), rot = (num() * Math.PI) / 180, large = num(), sweep = num();
      const nx = num() + ox, ny = num() + oy;
      if (!cur) start(x, y);
      arcPoints(x, y, rx, ry, rot, !!large, !!sweep, nx, ny, cur.pts);
      x = nx; y = ny;
    } else i++;
    prev = C;
  }
  if (cur && cur.pts.length > 2) paths.push(cur);
  return paths;
}

/* ---------- shapes ---------- */

/** Make a shape from path data, a list of path data, or polylines. */
export function shape(src, anchors = {}) {
  let paths;
  if (typeof src === "string") paths = parsePath(src);
  else if (Array.isArray(src)) paths = src.flatMap((s) => (typeof s === "string" ? parsePath(s) : s.paths ? s.paths : [s]));
  else if (src && src.paths) return src;
  else paths = [];
  return { paths, anchors };
}

/** A shape moved, scaled and turned (degrees). */
export function place(sh, { x = 0, y = 0, scale = 1, sx = scale, sy = scale, rot = 0 } = {}) {
  sh = shape(sh);
  const c = Math.cos((rot * Math.PI) / 180), s = Math.sin((rot * Math.PI) / 180);
  const tf = (px, py) => [x + (px * sx) * c - (py * sy) * s, y + (px * sx) * s + (py * sy) * c];
  const paths = sh.paths.map((p) => {
    const pts = new Array(p.pts.length);
    for (let i = 0; i < p.pts.length; i += 2) {
      const [a, b] = tf(p.pts[i], p.pts[i + 1]);
      pts[i] = a; pts[i + 1] = b;
    }
    return { pts, closed: p.closed };
  });
  const anchors = {};
  for (const k in sh.anchors) anchors[k] = tf(...sh.anchors[k]);
  return { paths, anchors };
}

/** Several shapes as one (anchors merged; later names win). */
export function merge(...shapes) {
  const out = { paths: [], anchors: {} };
  for (const s of shapes.flat()) {
    const sh = shape(s);
    out.paths.push(...sh.paths);
    Object.assign(out.anchors, sh.anchors);
  }
  return out;
}

/** Polyline from a function t ∈ [0, 1] → [x, y]. */
export function curveFn(f, n = 200, closed = false) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(...f(i / n));
  return { paths: [{ pts, closed }], anchors: {} };
}

export function bounds(sh) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of shape(sh).paths)
    for (let i = 0; i < p.pts.length; i += 2) {
      const x = p.pts[i], y = p.pts[i + 1];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/* ---------- lengths, trim, resample ---------- */

export function lengths(p) {
  if (p.cum) return p.cum;
  const n = p.pts.length / 2, cum = new Float64Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(p.pts[2 * i] - p.pts[2 * i - 2], p.pts[2 * i + 1] - p.pts[2 * i - 1]);
  p.cum = cum;
  return cum;
}
export const pathLength = (p) => { const c = lengths(p); return c[c.length - 1]; };

/** Point and tangent angle at distance d along a polyline. */
export function pointAt(p, d) {
  const cum = lengths(p), n = cum.length;
  if (n < 2) return [p.pts[0], p.pts[1], 0];
  d = Math.max(0, Math.min(cum[n - 1], d));
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < d) lo = m; else hi = m; }
  const seg = cum[hi] - cum[lo] || 1, k = (d - cum[lo]) / seg;
  const ax = p.pts[2 * lo], ay = p.pts[2 * lo + 1], bx = p.pts[2 * hi], by = p.pts[2 * hi + 1];
  return [ax + (bx - ax) * k, ay + (by - ay) * k, Math.atan2(by - ay, bx - ax)];
}

/** The part of a polyline between fractions a and b of its length, as a flat point list. */
export function slice(p, a, b) {
  const cum = lengths(p), L = cum[cum.length - 1];
  if (b <= a || L === 0) return [];
  if (a <= 0 && b >= 1) return p.pts;
  const da = a * L, db = b * L, out = [];
  const [sx, sy] = pointAt(p, da);
  out.push(sx, sy);
  for (let i = 0; i < cum.length; i++) if (cum[i] > da && cum[i] < db) out.push(p.pts[2 * i], p.pts[2 * i + 1]);
  const [ex, ey] = pointAt(p, db);
  out.push(ex, ey);
  return out;
}

/** Resample a polyline to n evenly spaced points. */
export function resample(p, n) {
  const L = pathLength(p), out = new Array(n * 2);
  const span = p.closed ? L * (1 - 1 / n) : L;
  for (let i = 0; i < n; i++) {
    const [x, y] = pointAt(p, n === 1 ? 0 : (span * i) / (n - 1));
    out[2 * i] = x; out[2 * i + 1] = y;
  }
  return out;
}

function centroid(pts) {
  let x = 0, y = 0;
  const n = pts.length / 2;
  for (let i = 0; i < pts.length; i += 2) { x += pts[i]; y += pts[i + 1]; }
  return [x / n, y / n];
}

function align(a, b, closed) {
  // best rotation (closed) and direction for b so it travels with a
  const n = a.length / 2;
  const score = (bb, off) => {
    let s = 0;
    for (let i = 0; i < n; i += Math.max(1, n >> 5)) {
      const j = (i + off) % n;
      s += (a[2 * i] - bb[2 * j]) ** 2 + (a[2 * i + 1] - bb[2 * j + 1]) ** 2;
    }
    return s;
  };
  const rev = [];
  for (let i = n - 1; i >= 0; i--) rev.push(b[2 * i], b[2 * i + 1]);
  let best = { s: Infinity, arr: b, off: 0 };
  for (const arr of [b, rev]) {
    const offs = closed ? Array.from({ length: 48 }, (_, k) => Math.round((k * n) / 48)) : [0];
    for (const off of offs) {
      const s = score(arr, off);
      if (s < best.s) best = { s, arr, off };
    }
  }
  if (!best.off) return best.arr;
  const out = new Array(b.length);
  for (let i = 0; i < n; i++) { const j = (i + best.off) % n; out[2 * i] = best.arr[2 * j]; out[2 * i + 1] = best.arr[2 * j + 1]; }
  return out;
}

/**
 * Prepare a morph from shape a to shape b: subpaths pair up in order, extra ones collapse
 * to (or grow from) their own centre. Returns pairs [{ a, b, closed }] with equal point counts.
 */
export function morphPairs(sa, sb) {
  sa = shape(sa); sb = shape(sb);
  const n = Math.max(sa.paths.length, sb.paths.length), pairs = [];
  for (let i = 0; i < n; i++) {
    const pa = sa.paths[i], pb = sb.paths[i];
    const L = Math.max(pa ? pathLength(pa) : 0, pb ? pathLength(pb) : 0);
    const count = Math.max(24, Math.min(900, Math.ceil(L / 2)));
    let A = pa ? resample(pa, count) : null, B = pb ? resample(pb, count) : null;
    if (!A) { const [cx, cy] = centroid(B); A = Array.from({ length: count * 2 }, (_, k) => (k % 2 ? cy : cx)); }
    if (!B) { const [cx, cy] = centroid(A); B = Array.from({ length: count * 2 }, (_, k) => (k % 2 ? cy : cx)); }
    else if (pa) B = align(A, B, pa.closed && pb.closed);
    pairs.push({ a: A, b: B, ca: pa ? pa.closed : pb.closed, cb: pb ? pb.closed : pa.closed, fadeA: !pb, fadeB: !pa });
  }
  return pairs;
}

export function morphAt(pairs, k) {
  return pairs.map((p) => {
    const pts = new Array(p.a.length);
    for (let i = 0; i < pts.length; i++) pts[i] = p.a[i] + (p.b[i] - p.a[i]) * k;
    return { pts, closed: k < 0.5 ? p.ca : p.cb, alpha: p.fadeA ? 1 - k : p.fadeB ? k : 1 };
  });
}

/* ---------- noise ---------- */

export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
export function noise1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}
export function noise2(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const h = (a, b) => hash(a * 57 + b * 113);
  return (h(i, j) * (1 - ux) + h(i + 1, j) * ux) * (1 - uy) + (h(i, j + 1) * (1 - ux) + h(i + 1, j + 1) * ux) * uy;
}
/** Seeded random generator (mulberry32). */
export function rng(seed = 1) {
  let a = Math.floor(seed * 2654435761) >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
