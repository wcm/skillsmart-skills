/*
 * The shape library: monoline drawings in a 200 × 200 box centred on 0, 0 (y down), drawn the way
 * the style draws them: one weight, open ends where a pen would lift, the fewest strokes that still
 * name the thing. Anchors name the points other things attach to (a label on the throat, a glow on
 * the heart). Anything missing is one path away: S.path("M… C…") takes any SVG path data in the same box.
 */
import { shape, place, merge, curveFn, bounds } from "./geom.js";

const P = (d, anchors) => () => shape(d, anchors);
const circleD = (cx, cy, r) => `M${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy} Z`;

/* ---------- primitives ---------- */

export const circle = (r = 100, cx = 0, cy = 0) => shape(circleD(cx, cy, r));
export const ellipse = (rx = 100, ry = 60, cx = 0, cy = 0) => shape(`M${cx + rx} ${cy} A${rx} ${ry} 0 1 1 ${cx - rx} ${cy} A${rx} ${ry} 0 1 1 ${cx + rx} ${cy} Z`);
export const line = (x1 = -100, y1 = 0, x2 = 100, y2 = 0) => shape(`M${x1} ${y1} L${x2} ${y2}`);
export const poly = (pts, closed = false) => shape(`M${pts.map((p) => p.join(" ")).join(" L")}${closed ? " Z" : ""}`);
export function rect(w = 200, h = 200, r = 0) {
  const x = -w / 2, y = -h / 2;
  if (!r) return shape(`M${x} ${y} H${x + w} V${y + h} H${x} Z`);
  return shape(`M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`);
}
/** Arc of a circle, angles in degrees, 0 = up, clockwise. */
export function arc(r = 100, from = 0, to = 90) {
  return curveFn((t) => {
    const a = ((from + (to - from) * t - 90) * Math.PI) / 180;
    return [Math.cos(a) * r, Math.sin(a) * r];
  }, Math.max(12, Math.ceil(Math.abs(to - from) * r / 120)));
}
export function polygon(n = 6, r = 100, rot = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = ((rot + (360 * i) / n - 90) * Math.PI) / 180;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return poly(pts, true);
}
export function star(points = 5, r = 100, inner = 0.45) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const a = ((180 * i) / points - 90) * (Math.PI / 180), rr = i % 2 ? r * inner : r;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return poly(pts, true);
}
export const sparkle = (r = 100) => shape(`M0 ${-r} Q0 0 ${r} 0 Q0 0 0 ${r} Q0 0 ${-r} 0 Q0 0 0 ${-r} Z`);
export const path = (d, anchors) => shape(d, anchors);
export const wave = (w = 200, amp = 20, cycles = 3) => curveFn((t) => [-w / 2 + w * t, -Math.sin(t * cycles * Math.PI * 2) * amp], 160);
/** Archimedean spiral from the centre out, `turns` turns. */
export const spiral = (r = 100, turns = 3.5) => curveFn((t) => {
  const a = t * turns * Math.PI * 2;
  return [Math.cos(a) * r * t, Math.sin(a) * r * t];
}, Math.ceil(turns * 90));

/* ---------- digits: monoline, Poppins-like proportions, 100 wide × 176 tall ----------
 * number() draws 0-9 : . , % + - $ / × (or x) and spaces; anything else warns and leaves a gap. */

const DIGITS = {
  0: "M0 -88 C30 -88 48 -50 48 0 C48 50 30 88 0 88 C-30 88 -48 50 -48 0 C-48 -50 -30 -88 0 -88 Z",
  1: "M-24 -60 L12 -88 L12 88",
  2: "M-44 -44 C-44 -72 -22 -88 2 -88 C28 -88 46 -70 46 -46 C46 -16 22 4 -46 88 L48 88",
  3: "M-42 -70 C-30 -84 -14 -88 2 -88 C28 -88 44 -72 44 -48 C44 -22 24 -6 -6 -6 C30 -6 48 14 48 40 C48 70 26 88 0 88 C-20 88 -38 80 -48 64",
  4: "M28 88 L28 -88 L-50 42 L54 42",
  5: "M40 -88 L-32 -88 L-42 -6 C-28 -16 -12 -20 4 -20 C32 -20 50 2 50 32 C50 64 28 88 0 88 C-22 88 -40 78 -50 60",
  6: "M34 -82 C24 -86 14 -88 2 -88 C-30 -88 -48 -50 -48 4 C-48 60 -26 88 2 88 C30 88 48 66 48 38 C48 10 30 -10 2 -10 C-24 -10 -44 8 -48 30",
  7: "M-46 -88 L48 -88 L-10 88",
  8: "M0 88 A46 46 0 0 1 0 -4 A42 42 0 0 0 0 -88 A42 42 0 0 0 0 -4 A46 46 0 0 1 0 88",
};
export function digit(n) {
  n = String(n);
  if (n === "9") return place(shape(DIGITS[6]), { rot: 180 });
  if (n === ":") return merge(circle(5, 0, -40), circle(5, 0, 40));
  if (n === ".") return circle(5, 0, 84);
  if (n === "%") return merge(circle(18, -28, -60), circle(18, 28, 60), line(40, -88, -40, 88));
  if (n === "+") return merge(line(-40, 0, 40, 0), line(0, -40, 0, 40));
  if (n === "-") return line(-36, 0, 36, 0);
  if (n === "$") return shape("M40 -52 C30 -66 16 -72 0 -72 C-24 -72 -40 -58 -40 -38 C-40 -14 -16 -8 0 -2 C20 4 44 12 44 38 C44 60 24 72 0 72 C-20 72 -36 64 -46 48 M0 -96 L0 96");
  if (n === "/") return line(30, -88, -30, 88);
  if (n === ",") return shape("M4 74 C6 86 2 96 -8 104");
  if (n === "×" || n === "x") return merge(line(-30, -10, 30, 50), line(30, -10, -30, 50));
  if (n === " ") return shape("");
  if (DIGITS[n]) return shape(DIGITS[n]);
  console.warn(`trame: number() can't draw "${n}" (it draws 0-9 : . , % + - $ / × and spaces); left a gap`);
  return shape("");
}
/** A number (or time like "2:00", "90%", "$1") as one monoline shape, centred. */
export function number(str, gap = 34) {
  str = String(str);
  const w = (c) => (c === ":" || c === "." || c === "," ? 24 : c === "1" || c === "/" ? 70 : c === " " ? 50 : 100);
  let total = 0;
  for (const c of str) total += w(c) + gap;
  total -= gap;
  let x = -total / 2;
  const parts = [];
  for (const c of str) {
    parts.push(place(digit(c), { x: x + w(c) / 2 + (c === "1" ? -6 : 0) }));
    x += w(c) + gap;
  }
  return place(merge(parts), { scale: 200 / Math.max(200, total) });
}

/* ---------- figures ---------- */

/** The keyhole bust: head, long neck, sloping shoulders, open at the bottom. One stroke. */
export function bust({ eyes = null } = {}) {
  const body = shape(
    "M-80 100 C-80 46 -72 26 -46 16 C-26 9 -16 2 -14 -18 L-14 -31 A34 34 0 1 1 14 -31 L14 -18 C16 2 26 9 46 16 C72 26 80 46 80 100",
    { head: [0, -62], crown: [0, -96], eyes: [0, -66], mouth: [0, -48], throat: [0, -20], heart: [-12, 38], chest: [0, 34], gut: [0, 72], left: [-80, 60], right: [80, 60] },
  );
  if (eyes === "closed") return merge(body, eyesClosed(-13, -64), eyesClosed(13, -64));
  if (eyes === "open") return merge(body, eyeSmall(-13, -64), eyeSmall(13, -64));
  return body;
}
const eyesClosed = (x, y) => shape(`M${x - 7} ${y - 1} Q${x} ${y + 5} ${x + 7} ${y - 1}`);
const eyeSmall = (x, y) => shape(`M${x - 6} ${y} Q${x} ${y - 4.5} ${x + 6} ${y} Q${x} ${y + 4.5} ${x - 6} ${y} Z ${circleD(x, y + 0.5, 1.2)}`);

/** Head in profile, facing right, with neck and a little of the shoulder. */
export const profile = P(
  "M-60 100 C-58 70 -40 58 -26 50 L-24 30 C-48 18 -62 -6 -62 -36 C-62 -74 -32 -98 4 -98 C38 -98 58 -76 60 -48 C61 -38 62 -32 70 -18 C72 -14 68 -12 63 -11 C65 -6 64 -2 60 0 C62 4 60 9 54 10 C52 22 42 26 26 24 L24 42 C40 52 58 64 62 100",
  { eye: [38, -40], brain: [-6, -54], mouth: [58, 2], crown: [-6, -98], throat: [24, 38], heart: [10, 80] },
);
/** A person standing, arms down. */
export const person = P(
  `${circleD(0, -78, 14)} M0 -62 L0 20 M0 20 L-16 96 M0 20 L16 96 M0 -46 L-24 6 M0 -46 L24 6`,
  { head: [0, -78], heart: [0, -34], feet: [0, 96], hand: [24, 6] },
);
/** A person mid-stride. */
export const walker = P(
  `${circleD(4, -78, 14)} M2 -62 L-2 18 M-2 18 L-24 94 M-2 18 L22 58 L18 96 M0 -46 L-26 -2 M0 -46 L22 0`,
  { head: [4, -78], feet: [0, 96] },
);
export const eye = P(`M-90 0 Q0 -70 90 0 Q0 70 -90 0 Z ${circleD(0, 0, 30)} ${circleD(0, 0, 11)}`, { pupil: [0, 0] });
export const eyeClosed = P("M-90 -6 Q0 50 90 -6 M-60 20 L-72 40 M-24 32 L-28 54 M24 32 L28 54 M60 20 L72 40");
export const hand = P(
  "M-34 96 C-34 70 -36 50 -44 34 C-54 14 -70 0 -66 -10 C-62 -20 -48 -14 -36 2 L-30 10 L-32 -58 C-32 -72 -14 -72 -14 -58 L-12 -10 M-14 -58 L-14 -76 C-14 -90 4 -90 4 -76 L6 -12 M4 -76 L4 -70 C4 -84 22 -84 22 -70 L24 -8 M22 -64 C22 -76 40 -76 40 -62 L40 18 C40 46 30 70 30 96",
  { palm: [4, 20], index: [-23, -66] },
);
export const ear = P(
  "M-30 -60 C-30 -92 2 -100 22 -96 C52 -90 64 -60 58 -30 C54 -6 36 4 30 24 C24 44 26 62 12 78 C0 92 -24 92 -32 74 M-10 -54 C-6 -70 20 -74 34 -60 C46 -46 42 -24 30 -14 C20 -6 6 -10 4 6 C2 18 14 26 8 40 C4 50 -8 48 -12 38",
  { canal: [6, 6], cochlea: [14, -36] },
);
export const heart = P("M0 86 C-30 60 -92 22 -92 -26 C-92 -62 -64 -84 -38 -84 C-18 -84 -6 -72 0 -58 C6 -72 18 -84 38 -84 C64 -84 92 -62 92 -26 C92 22 30 60 0 86 Z", { center: [0, -6] });
export const brain = P(
  "M-6 -78 C-30 -92 -66 -82 -76 -54 C-98 -44 -100 -10 -84 6 C-94 30 -76 58 -48 58 C-38 76 -12 80 0 66 L0 -78 C10 -92 46 -88 60 -64 C88 -60 98 -28 86 -6 C98 18 82 50 54 54 C44 74 14 78 0 66 M-40 -50 C-28 -40 -36 -22 -54 -20 M-30 4 C-14 6 -10 26 -26 34 M40 -46 C28 -34 36 -18 54 -18 M32 8 C16 12 14 30 28 36",
  { center: [0, -6], left: [-50, -10], right: [50, -10] },
);
export const lungs = P(
  "M0 -90 L0 -30 M0 -30 C-10 -20 -20 -14 -30 -14 M0 -30 C10 -20 20 -14 30 -14 M-18 -40 C-50 -60 -88 -20 -88 30 C-88 70 -60 86 -32 76 C-18 70 -16 50 -16 30 L-16 -30 M18 -40 C50 -60 88 -20 88 30 C88 70 60 86 32 76 C18 70 16 50 16 30 L16 -30",
);
/** Vagus nerve and branches, drawn to sit on the bust at the same scale. */
export const nerves = P(
  "M-4 -54 C-4 -30 -2 -12 0 0 L0 96 M0 6 C-14 14 -24 22 -34 36 M0 6 C14 14 24 22 34 36 M0 34 C-12 42 -22 50 -26 64 M0 34 C12 42 22 50 26 64 M0 66 C-8 74 -14 84 -16 96 M0 66 C8 74 14 84 16 96",
  { throat: [-2, -20], heart: [0, 6], gut: [0, 66] },
);

/* ---------- sky ---------- */

export const moon = P("M28 -80 C-24 -82 -70 -44 -70 4 C-70 52 -30 86 18 86 C44 86 64 74 78 56 C24 64 -20 30 -20 -18 C-20 -44 0 -68 28 -80 Z", { center: [-20, 4] });
export function sun(rays = 12, r = 42) {
  const parts = [circle(r)];
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    parts.push(line(c * (r + 18), s * (r + 18), c * (r + 40 + (i % 2) * 14), s * (r + 40 + (i % 2) * 14)));
  }
  return merge(parts);
}
export const planet = () => merge(circle(52), ellipse(98, 22), shape("M-98 0 A98 22 0 0 0 98 0"));
export const orbit = (rx = 100, ry = 40) => ellipse(rx, ry);
/** Spiral galaxy arms as lines (the particle version is add.galaxy). */
export function galaxyArms(arms = 2, turns = 1.1) {
  const parts = [];
  for (let k = 0; k < arms; k++)
    parts.push(curveFn((t) => {
      const a = (k / arms) * Math.PI * 2 + t * turns * Math.PI * 2, r = 8 + 92 * t;
      return [Math.cos(a) * r, Math.sin(a) * r * 0.82];
    }, 120));
  return merge(parts);
}

/* ---------- things ---------- */

export const cup = P(
  "M-62 -10 L-56 50 C-54 66 -40 74 -26 74 L22 74 C36 74 50 66 52 50 L58 -10 Z M58 6 C82 2 92 20 84 36 C78 48 62 50 52 44 M-92 82 C-60 96 60 96 92 82 M-28 -30 C-38 -44 -18 -54 -28 -70 M0 -30 C-10 -46 10 -56 0 -76 M28 -30 C18 -44 38 -54 28 -70",
  { steam: [0, -50], rim: [0, -10] },
);
export const gift = P(
  "M-70 -20 H70 V80 H-70 Z M-80 -46 H80 V-20 H-80 Z M0 -46 V80 M0 -46 C-10 -70 -44 -84 -48 -64 C-50 -50 -24 -46 0 -46 C24 -46 50 -50 48 -64 C44 -84 10 -70 0 -46",
  { lid: [0, -46], center: [0, 20] },
);
export const envelope = P("M-90 -56 H90 V60 H-90 Z M-90 -56 L0 14 L90 -56 M-90 60 L-26 -6 M90 60 L26 -6", { flap: [0, 14] });
export const coin = P(`${circleD(0, 0, 80)} ${circleD(0, 0, 62)} M22 -26 C14 -36 4 -38 -4 -38 C-18 -38 -26 -30 -26 -20 C-26 -6 -10 -4 0 0 C12 4 26 8 26 22 C26 34 14 40 0 40 C-12 40 -22 34 -28 26 M0 -52 L0 52`);
export const door = P("M-56 96 V-90 H56 V96 M-56 -90 L10 -70 V96 L-56 96 M-6 6 L-6 14 M-110 96 H110", { gap: [32, 0] });
export const phone = P(`M-46 -96 H46 C56 -96 62 -90 62 -80 V80 C62 90 56 96 46 96 H-46 C-56 96 -62 90 -62 80 V-80 C-62 -90 -56 -96 -46 -96 Z M-16 -84 H16 M-14 84 H14`, { screen: [0, 0] });
export const book = P("M0 -60 C-26 -78 -64 -80 -92 -70 V70 C-64 60 -26 62 0 80 C26 62 64 60 92 70 V-70 C64 -80 26 -78 0 -60 V80 M-70 -40 C-50 -46 -30 -44 -16 -38 M-70 -12 C-50 -18 -30 -16 -16 -10 M16 -38 C30 -44 50 -46 70 -40 M16 -10 C30 -16 50 -18 70 -12");
export const bulb = P("M-24 54 C-24 30 -56 10 -56 -28 C-56 -62 -30 -86 0 -86 C30 -86 56 -62 56 -28 C56 10 24 30 24 54 Z M-22 70 H22 M-16 86 H16 M-10 54 L-10 -6 L0 6 L10 -6 L10 54", { glow: [0, -30] });
export const key = P(`${circleD(-56, 0, 30)} M-26 0 H92 M60 0 V26 M80 0 V20`);
export const lock = P("M-60 -10 H60 V86 H-60 Z M-40 -10 V-40 C-40 -70 -22 -86 0 -86 C22 -86 40 -70 40 -40 V-10 M0 26 V52", { keyhole: [0, 30] });
export const leaf = P("M-80 80 C-80 -10 -30 -80 84 -84 C80 30 10 80 -80 80 Z M-80 80 C-30 30 20 -20 60 -60 M-30 30 L-34 -6 M-4 4 L-4 -34 M20 -20 L22 -50 M-30 30 L4 34 M-4 4 L30 6 M20 -20 L48 -18");
export const sprout = P("M0 96 V-10 M0 20 C-40 20 -70 0 -76 -40 C-36 -40 -6 -20 0 20 M0 -10 C30 -10 62 -32 66 -76 C26 -76 0 -50 0 -10 M-60 96 H60", { tip: [0, -10] });
export const lotus = P("M0 60 C-24 30 -24 -30 0 -74 C24 -30 24 30 0 60 M0 60 C-30 50 -66 20 -76 -34 C-40 -30 -10 -4 0 60 M0 60 C30 50 66 20 76 -34 C40 -30 10 -4 0 60 M0 60 C-40 66 -84 50 -100 20 M0 60 C40 66 84 50 100 20 M-60 80 H60", { center: [0, 20] });
export const mountain = P("M-100 70 L-36 -40 L0 14 L40 -70 L100 70 M-56 -6 L-36 -40 L-18 -12 M28 -48 L40 -70 L54 -46", { peak: [40, -70] });
export const house = P("M-80 -6 L0 -80 L80 -6 M-62 -22 V80 H62 V-22 M-18 80 V30 H18 V80 M30 -50 V-80 H50 V-32", { door: [0, 55] });
export function gear(teeth = 10, r = 80) {
  const pts = [], n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, out = i % 4 === 1 || i % 4 === 2;
    pts.push([Math.cos(a) * (out ? r : r * 0.8), Math.sin(a) * (out ? r : r * 0.8)]);
  }
  return merge(poly(pts, true), circle(r * 0.32));
}
export const cube = P("M0 -90 L80 -46 L80 46 L0 90 L-80 46 L-80 -46 Z M-80 -46 L0 -2 L80 -46 M0 -2 V90", { top: [0, -46], front: [-40, 24] });
export const butterfly = P(
  "M0 -40 V60 M0 -40 C-6 -56 -16 -68 -26 -74 M0 -40 C6 -56 16 -68 26 -74 M0 -20 C-30 -80 -96 -90 -90 -40 C-86 -6 -44 0 0 6 C-40 10 -80 34 -64 70 C-50 96 -12 70 0 30 M0 -20 C30 -80 96 -90 90 -40 C86 -6 44 0 0 6 C40 10 80 34 64 70 C50 96 12 70 0 30",
);
export const hourglass = P("M-60 -90 H60 M-60 90 H60 M-48 -90 C-48 -30 -8 -14 -8 0 C-8 14 -48 30 -48 90 M48 -90 C48 -30 8 -14 8 0 C8 14 48 30 48 90 M-30 74 C-20 56 20 56 30 74", { neck: [0, 0] });
export const bell = P("M-70 50 C-56 36 -54 20 -54 -10 C-54 -50 -30 -74 0 -74 C30 -74 54 -50 54 -10 C54 20 56 36 70 50 Z M-20 50 C-20 76 20 76 20 50 M0 -74 V-90");
export const bubble = P("M-80 -60 C-80 -76 -70 -84 -56 -84 H56 C70 -84 80 -76 80 -60 V20 C80 36 70 44 56 44 H-10 L-50 80 L-40 44 H-56 C-70 44 -80 36 -80 20 Z M-40 -32 H40 M-40 -4 H18", { tail: [-50, 80] });
export const flame = P("M0 90 C-44 90 -64 60 -64 26 C-64 -16 -30 -36 -24 -86 C10 -60 26 -30 22 4 C34 -6 40 -20 38 -36 C58 -14 64 6 64 26 C64 60 44 90 0 90 Z M0 90 C-18 90 -26 76 -26 62 C-26 42 -10 32 -4 14 C10 28 26 44 26 62 C26 78 16 90 0 90");
export const drop = P("M0 -90 C30 -40 60 -6 60 30 C60 66 34 90 0 90 C-34 90 -60 66 -60 30 C-60 -6 -30 -40 0 -90 Z M-30 34 C-30 50 -22 60 -8 64");
export const bolt = P("M20 -96 L-52 14 H-4 L-22 96 L52 -18 H4 Z");
export const check = P("M-70 6 L-22 54 L76 -50");
export const cross = P("M-60 -60 L60 60 M60 -60 L-60 60");
export const plus = P("M0 -70 V70 M-70 0 H70");
export const question = P(`M-40 -44 C-40 -74 -18 -90 4 -90 C30 -90 46 -72 46 -50 C46 -22 4 -14 4 22 V34 ${circleD(4, 66, 7)}`);
export const arrow = P("M-90 0 H86 M44 -40 L88 0 L44 40");
export const target = () => merge(circle(90), circle(60), circle(30), circle(4));
export const magnifier = P(`${circleD(-20, -20, 56)} M20 20 L84 84`, { lens: [-20, -20] });
export const clock = P(`${circleD(0, 0, 86)} M0 0 V-56 M0 0 L38 22`, { center: [0, 0] });
export function battery(level = 1) {
  const w = 140 * Math.max(0, Math.min(1, level));
  return merge(shape("M-86 -44 H78 V44 H-86 Z M78 -18 H94 V18 H78"), level > 0 ? shape(`M-74 -32 H${-74 + w} V32 H-74 Z`) : shape("M0 0"));
}
export const infinity = () => curveFn((t) => {
  const a = t * Math.PI * 2, d = 1 + Math.sin(a) ** 2;
  return [(96 * Math.cos(a)) / d, (96 * Math.sin(a) * Math.cos(a)) / d];
}, 240, true);
export function dna(turns = 2) {
  const a = curveFn((t) => [Math.sin(t * turns * Math.PI * 2) * 40, -96 + 192 * t], 160);
  const b = curveFn((t) => [-Math.sin(t * turns * Math.PI * 2) * 40, -96 + 192 * t], 160);
  const rungs = [];
  for (let i = 1; i < turns * 6; i++) {
    const t = i / (turns * 6), x = Math.sin(t * turns * Math.PI * 2) * 40;
    if (Math.abs(x) > 8) rungs.push(line(-x, -96 + 192 * t, x, -96 + 192 * t));
  }
  return merge(a, b, ...rungs);
}
export const atom = () => merge(ellipse(92, 30), place(ellipse(92, 30), { rot: 60 }), place(ellipse(92, 30), { rot: -60 }), circle(9));
export const flask = P("M-22 -90 H22 M-14 -90 V-30 L-70 70 C-76 82 -70 90 -56 90 H56 C70 90 76 82 70 70 L14 -30 V-90 M-48 34 H48", { liquid: [0, 60] });
export const trophy = P("M-50 -80 H50 V-20 C50 14 26 34 0 34 C-26 34 -50 14 -50 -20 Z M-50 -60 H-80 C-80 -24 -66 -10 -46 -8 M50 -60 H80 C80 -24 66 -10 46 -8 M0 34 V64 M-40 90 H40 L32 64 H-32 Z", { cup: [0, -30] });
export const money = P("M-96 -50 H96 V50 H-96 Z M-76 -30 V30 M76 -30 V30 M0 -30 C-20 -30 -28 -18 -28 0 C-28 18 -20 30 0 30 C20 30 28 18 28 0 C28 -18 20 -30 0 -30 Z");
export const chat = bubble;
export const play = P("M-40 -70 L70 0 L-40 70 Z");
export const pin = P(`M0 92 C-20 60 -66 18 -66 -24 C-66 -62 -36 -90 0 -90 C36 -90 66 -62 66 -24 C66 18 20 60 0 92 Z ${circleD(0, -24, 24)}`, { tip: [0, 92] });
export const cloud = P("M-60 50 C-90 50 -100 20 -84 2 C-90 -26 -58 -44 -36 -30 C-28 -64 18 -74 36 -42 C62 -54 92 -30 80 -2 C100 8 98 50 66 50 Z");
export const tree = P("M0 96 V0 M0 30 L-26 6 M0 14 L22 -8 M-4 0 C-60 6 -84 -40 -56 -66 C-50 -96 -6 -104 8 -80 C40 -96 82 -66 66 -34 C82 -6 56 14 24 4 C16 10 4 8 -4 0 M-50 96 H50");
export const headphones = P("M-74 30 V-6 C-74 -60 -42 -92 0 -92 C42 -92 74 -60 74 -6 V30 M-88 4 H-56 C-50 4 -46 8 -46 14 V74 C-46 80 -50 84 -56 84 H-88 C-94 84 -98 80 -98 74 V14 C-98 8 -94 4 -88 4 Z M88 4 H56 C50 4 46 8 46 14 V74 C46 80 50 84 56 84 H88 C94 84 98 80 98 74 V14 C98 8 94 4 88 4 Z", { left: [-72, 44], right: [72, 44], band: [0, -92] });
export const mic = P(`M-22 -40 C-22 -78 22 -78 22 -40 V0 C22 38 -22 38 -22 0 Z M-44 -6 C-44 40 44 40 44 -6 M0 34 V70 M-30 70 H30`, { head: [0, -40] });
export const speaker = P("M-80 -30 H-40 L20 -80 V80 L-40 30 H-80 Z M44 -40 C64 -20 64 20 44 40 M64 -64 C98 -30 98 30 64 64", { cone: [0, 0] });
export const chip = P("M-56 -56 H56 V56 H-56 Z M-30 -30 H30 V30 H-30 Z M-36 -56 V-80 M-12 -56 V-80 M12 -56 V-80 M36 -56 V-80 M-36 56 V80 M-12 56 V80 M12 56 V80 M36 56 V80 M-56 -36 H-80 M-56 -12 H-80 M-56 12 H-80 M-56 36 H-80 M56 -36 H80 M56 -12 H80 M56 12 H80 M56 36 H80", { core: [0, 0] });
export const wifi = P("M-90 -20 C-40 -70 40 -70 90 -20 M-60 10 C-26 -24 26 -24 60 10 M-30 40 C-12 24 12 24 30 40 M0 70 L0 72");
export const signal = wifi;

/* ---------- composition helpers ---------- */

/** Fit a shape into a box of the given size (keeps the aspect), centred on 0, 0. */
export function fit(sh, size = 200) {
  const b = bounds(sh), k = size / Math.max(b.w, b.h, 1e-6);
  return place(place(sh, { x: -b.cx, y: -b.cy }), { scale: k });
}
export { place, merge, shape, bounds, curveFn };

/** Every library drawing, for the catalogue sheet. */
export const CATALOG = {
  bust: () => bust(), "bust eyes:closed": () => bust({ eyes: "closed" }), profile, person, walker, eye, eyeClosed, hand, ear, heart, brain, lungs, nerves,
  moon, sun: () => sun(), star: () => star(), sparkle: () => sparkle(), planet, galaxyArms: () => galaxyArms(), spiral: () => spiral(),
  cup, gift, envelope, coin, money, door, phone, book, bulb, key, lock, leaf, sprout, lotus, tree, mountain, house, cloud,
  gear: () => gear(), cube, butterfly, hourglass, bell, bubble, flame, drop, bolt, pin, trophy, flask, atom, dna: () => dna(), infinity,
  battery: () => battery(0.6), clock, target, magnifier, wifi, headphones, mic, speaker, chip, play, check, cross, plus, question, arrow,
  'number("8")': () => number("8"), 'number("30")': () => number("30"), 'number("2:00")': () => number("2:00"), 'number("90%")': () => number("90%"),
  "circle": () => circle(), "rect(180,120,16)": () => rect(180, 120, 16), "polygon(6)": () => polygon(6), "arc(90,-120,120)": () => arc(90, -120, 120), "wave()": () => wave(),
};
