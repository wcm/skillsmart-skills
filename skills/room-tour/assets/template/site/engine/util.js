// Small shared helpers for the tour engine. No dependencies.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
/** where x sits between a and b, 0–1 */
export const seg = (x, a, b) => (b === a ? (x >= b ? 1 : 0) : clamp((x - a) / (b - a)));
export const pad2 = (n) => String(n).padStart(2, "0");

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** tour.json copy: `*word*` is italic */
export const rich = (s) => esc(s).replace(/\*(.+?)\*/g, "<em>$1</em>");
/** the text without the italics marks (aria labels, comparisons) */
export const plain = (s) => String(s ?? "").replace(/\*(.+?)\*/g, "$1");

export function el(tag, cls, html, attrs) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) e.setAttribute(k, v === true ? "" : v);
  return e;
}
const NS = "http://www.w3.org/2000/svg";
export function svg(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  if (parent) parent.append(e);
  return e;
}

/** a value that may differ per device: `{ desktop, phone }` or one value for both */
export function dev(v, phone) {
  if (v && typeof v === "object" && !Array.isArray(v) && ("desktop" in v || "phone" in v)) return phone ? v.phone ?? v.desktop : v.desktop ?? v.phone;
  return v;
}

/** a length from tour.json: 56, "56px", "6vw", "4svh" → px */
export function len(v, vw = innerWidth, vh = innerHeight) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const m = /^(-?[\d.]+)\s*(px|vw|vh|svh|dvh|lvh|%)?$/.exec(String(v).trim());
  if (!m) return 0;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case "vw": return (n * vw) / 100;
    case "vh": case "svh": case "dvh": case "lvh": return (n * vh) / 100;
    default: return n;
  }
}

/** cubic-bezier(x1, y1, x2, y2) as a function of t (Newton steps, then bisection) */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = X(t) - x, d = dX(t);
      if (Math.abs(e) < 1e-6) return Y(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) { const v = X(t); if (Math.abs(v - x) < 1e-6) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return Y(t);
  };
}

/** the design-system.md's three easings (5.3) */
export const ease = {
  linear: (t) => clamp(t),
  out: bezier(0.16, 1, 0.3, 1),
  in: bezier(0.7, 0, 0.84, 0),
  inout: bezier(0.65, 0, 0.35, 1),
};

/** colours for token cross-fades: "#rgb", "#rrggbb", "#rrggbbaa", "rgb()/rgba()" → [r, g, b, a] or null */
export function parseColour(s) {
  s = String(s ?? "").trim();
  let m = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    if (p.length >= 3) return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  return null;
}
export const mixColour = (a, b, t) => `rgba(${Math.round(lerp(a[0], b[0], t))}, ${Math.round(lerp(a[1], b[1], t))}, ${Math.round(lerp(a[2], b[2], t))}, ${+lerp(a[3], b[3], t).toFixed(3)})`;

/** `{n}` → 0001 (the occluder masks and frames are numbered from 1, four digits) */
export const numbered = (pattern, n, pad = 4) => pattern.replace("{n}", String(n).padStart(pad, "0"));
/** img/occ/{n}.webp → img/occ-phone/{n}.webp (the phone set sits in a sibling folder) */
export function phoneDir(pattern) {
  const i = pattern.lastIndexOf("/");
  return i < 0 ? pattern : pattern.slice(0, i) + "-phone" + pattern.slice(i);
}

export function loadImage(src) {
  return new Promise((ok) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => ok(im);
    im.onerror = () => { console.warn(`[tour] couldn't load ${src}`); ok(null); };
    im.src = src;
  });
}

export const warn = (...a) => console.warn("[tour]", ...a);

/**
 * a hairline that fills 0–1 as a whole-pixel width (never a scaleX: a scaled edge is anti-aliased differently depending
 * on what was painted before, which breaks ?record's same-pixels rule). `total` is the full width in px.
 */
export function fillPx(e, f, total) {
  const w = `${Math.round(clamp(f) * Math.max(0, total))}px`;
  if (e._w !== w) { e._w = w; e.style.width = w; }
}
/** a px offset snapped to device pixels (ticks and markers stay crisp and repeatable) */
export const snap = (x, dpr = devicePixelRatio || 1) => Math.round(x * dpr) / dpr;

// ——— geometry for the picture layers (tags, art quads, wall labels, the lift) ———

/**
 * the projective map (homography) that takes the unit square to a quad: corners TL, TR, BR, BL as
 * [x0, y0, x1, y1, x2, y2, x3, y3]; returns the row-major 3×3 [a, b, c, d, e, f, g, h, 1] with
 * x = (a u + b v + c) / (g u + h v + 1), y = (d u + e v + f) / (g u + h v + 1)
 */
export function squareToQuad(q) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = q;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) return [x1 - x0, x3 - x0, x0, y1 - y0, y3 - y0, y0, 0, 0, 1];
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1 || 1e-12;
  const g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}
/** the inverse of a row-major 3×3 */
export function inv3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C || 1e-12;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
/** a row-major 3×3 applied to a point */
export function apply3(m, [x, y]) {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}
/** a polygon's area ([[x, y], …], shoelace) */
export function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; a += x0 * y1 - x1 * y0; }
  return Math.abs(a) / 2;
}
/** a polygon clipped to a rect { x, y, w, h } (Sutherland–Hodgman) */
export function clipToRect(pts, r) {
  const edges = [[(p) => p[0] >= r.x, (a, b) => [r.x, a[1] + ((b[1] - a[1]) * (r.x - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= r.x + r.w, (a, b) => [r.x + r.w, a[1] + ((b[1] - a[1]) * (r.x + r.w - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= r.y, (a, b) => [a[0] + ((b[0] - a[0]) * (r.y - a[1])) / (b[1] - a[1]), r.y]],
    [(p) => p[1] <= r.y + r.h, (a, b) => [a[0] + ((b[0] - a[0]) * (r.y + r.h - a[1])) / (b[1] - a[1]), r.y + r.h]]];
  let out = pts;
  for (const [inside, cross] of edges) {
    const src = out;
    out = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[i], b = src[(i + 1) % src.length], ia = inside(a), ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) out.push(cross(a, b));
    }
    if (!out.length) break;
  }
  return out;
}
/** is a point inside a convex-or-not quad given as [[x, y] × 4] (through its homography) */
export function inQuad(pt, quad) {
  const m = inv3(squareToQuad(quad.flat()));
  const [u, v] = apply3(m, pt);
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}
/** a small seeded random (hand-drawn marks stay the same from frame to frame and run to run) */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
/**
 * a hand-drawn closed loop around (cx, cy): uneven radius, a slight lean, ends that overshoot each other a little, as
 * an SVG path (design-system.md 4.14: any drawn mark looks drawn by hand, never a geometric circle)
 */
export function handLoop(cx, cy, r, seed = 7, { wobble = 0.09, overshoot = 0.5, lean = 0.12 } = {}) {
  const rand = rng(seed);
  const p1 = rand() * 6.28, p2 = rand() * 6.28, a0 = -1.9 + rand() * 0.6;
  const sweep = Math.PI * 2 + overshoot;
  const n = 28, pts = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n, a = a0 + sweep * k;
    // the radius drifts (wider at the start, a touch tighter where the pen closes the loop)
    const rr = r * (1 + wobble * Math.sin(2 * a + p1) * 0.6 + wobble * 0.5 * Math.sin(3 * a + p2) - 0.07 * k);
    const x = Math.cos(a) * rr * (1 + lean), y = Math.sin(a) * rr * (1 - lean * 0.4);
    // a slight rotation of the ellipse
    const c = Math.cos(0.35), s = Math.sin(0.35);
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    d += ` Q${x1.toFixed(2)} ${y1.toFixed(2)} ${((x1 + x2) / 2).toFixed(2)} ${((y1 + y2) / 2).toFixed(2)}`;
  }
  const l = pts[pts.length - 1];
  return `${d} L${l[0].toFixed(2)} ${l[1].toFixed(2)}`;
}
/** frame fractions of a point in clip pixels */
export const frac = ([x, y], size) => [x / size[0], y / size[1]];
