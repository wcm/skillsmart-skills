// Marble: ink floating on water, the way paper marbling is made, and worked the way marblers work it. A drop is
// exact, not painted: it pushes every bit of ink around it outward while keeping its area, so drops in the same
// place make the classic rings. A stylus (the cursor, or the tines of a rake that now and then crosses the bath) drags
// the ink along its path and nothing more: the bath is thick, so there is no wake and no swirl, only the pattern
// pulled into combs and feathers, the motion marblers call a tine line. Every resample softens edges a little, and
// marbling inks don't blend, so each frame nudges in-between pixels toward the nearer ink to keep lines crisp.
import { HEAD, NOISE, COLOR } from "../glsl.js";
import { Fluid } from "../fluid.js";
import { rgb } from "../core.js";

export const meta = { id: "marble", name: "Marble", kind: "ink on water" };

const FILL = HEAD + /* glsl */ `
uniform vec3 uPaper;
void main() { outColor = vec4(uPaper, 1.0); }`;

// an area-keeping drop of radius uR at uC: a point at distance d outside it came from distance sqrt(d² − R²)
const DROP = HEAD + /* glsl */ `
uniform sampler2D uInk;
uniform vec2 uC;
uniform float uR, uAspect, uPx;
uniform vec3 uColor;
void main() {
  vec2 p = (vUv - uC) * vec2(uAspect, 1.0);
  float d = length(p);
  float s = sqrt(max(1.0 - uR * uR / max(d * d, 1e-9), 0.0));
  vec4 outside = texture(uInk, uC + (p * s) / vec2(uAspect, 1.0));
  outColor = mix(vec4(uColor, 1.0), outside, smoothstep(uR - uPx, uR + uPx, d));
}`;

// Every resample (a drop pushing ink aside, a step of the flow) softens edges a little. Marbling inks don't blend,
// so a pixel between two inks is pulled toward the nearer one: edges stay crisp however often the sheet is worked.
const SNAP = /* glsl */ `
uniform vec3 uInks[6];
uniform float uSnap;
vec3 snap(vec3 c) {
  float d1 = 1e9, d2 = 1e9;
  vec3 c1 = c, c2 = c;
  for (int i = 0; i < 6; i++) {
    vec3 e = c - uInks[i];
    float d = dot(e, e);
    if (d < d1) { d2 = d1; c2 = c1; d1 = d; c1 = uInks[i]; }
    else if (d < d2) { d2 = d; c2 = uInks[i]; }
  }
  float t = sqrt(d1) / max(sqrt(d1) + sqrt(d2), 1e-5);
  return mix(c, mix(c1, c2, smoothstep(0.5 - 0.5 * uSnap, 0.5 + 0.5 * uSnap, t)), uSnap > 0.0 ? 1.0 : 0.0);
}`;

const SHARPEN = HEAD + SNAP + /* glsl */ `
uniform sampler2D uInk;
uniform float uAmount;
void main() {
  vec4 c = texture(uInk, vUv);
  outColor = vec4(mix(c.rgb, snap(c.rgb), uAmount), 1.0);
}`;

// A stylus drag: each point near a stroke moves along it, fully at the stroke and less with distance (an exponential
// falloff), with no return flow, so nothing swirls. Up to eight strokes at once (the cursor, a rake's tines).
const TINE = HEAD + /* glsl */ `
uniform sampler2D uInk;
uniform vec4 uSeg[8];   // from x, y to x, y (uv)
uniform float uReach[8];
uniform float uCount, uAspect;
void main() {
  vec2 asp = vec2(uAspect, 1.0);
  vec2 p = vUv * asp;
  vec2 shift = vec2(0.0);
  for (int i = 0; i < 8; i++) {
    if (float(i) >= uCount) break;
    vec2 a = uSeg[i].xy * asp, ab = uSeg[i].zw * asp - a;
    float L2 = dot(ab, ab);
    if (L2 < 1e-12) continue;
    float h = clamp(dot(p - a, ab) / L2, 0.0, 1.0);
    shift += ab * exp(-length(p - a - ab * h) / uReach[i]);
  }
  outColor = texture(uInk, (p - shift) / asp);
}`;

const SHOW = HEAD + NOISE + COLOR + SNAP + /* glsl */ `
uniform sampler2D uInk;
uniform vec2 uTexel;
uniform vec3 uPaper;
uniform float uTime, uGrain, uAspect;
uniform vec2 uCss;
void main() {
  vec3 c = snap(texture(uInk, vUv).rgb);
  vec3 l = snap(texture(uInk, vUv - vec2(uTexel.x, 0.0)).rgb), r = snap(texture(uInk, vUv + vec2(uTexel.x, 0.0)).rgb);
  vec3 b = snap(texture(uInk, vUv - vec2(0.0, uTexel.y)).rgb), t = snap(texture(uInk, vUv + vec2(0.0, uTexel.y)).rgb);
  // pigment gathers at the edge of each band
  float edge = clamp((length(r - l) + length(t - b)) * 1.6, 0.0, 1.0);
  c *= 1.0 - 0.22 * edge;
  // paper: a faint tooth and long fibres
  vec2 q = vUv * uCss;
  float tooth = gnoise(q * 0.9) * 0.5 + gnoise(q * 0.23) * 0.5;
  float fibre = gnoise(vec2(q.x * 0.02, q.y * 0.6));
  c *= 0.985 + 0.02 * tooth + 0.012 * fibre;
  outColor = vec4(toSRGB(c) + grain(gl_FragCoord.xy, uTime, uGrain), 1.0);
}`;

export function create(engine, o = {}) {
  // the fluid helper only manages the ink field here (sizing, painting); the bath itself never flows
  const fluid = new Fluid(engine, { sim: 32, iters: 1 });
  const short = Math.min(engine.width, engine.height);
  const ink = fluid.field(o.inkRes ?? Math.round(Math.min(1100, Math.max(560, short))));
  const fill = engine.program(FILL, undefined, "marble fill");
  const dropP = engine.program(DROP, undefined, "marble drop");
  const tineP = engine.program(TINE, undefined, "marble tine");
  const show = engine.program(SHOW, undefined, "marble show");
  const sharpen = engine.program(SHARPEN, undefined, "marble sharpen");
  const paper = rgb(o.paper ?? "#f2e9d8");
  const inks = (o.inks ?? ["#1d3a73", "#b2392d", "#d9a23f", "#1f1d1b", "#2f6b5e"]).slice(0, 5).map(rgb);
  const palette = [paper, ...inks].flat();
  while (palette.length < 18) palette.push(...paper);
  let inkNo = 0;
  const nextInk = () => inks[inkNo++ % inks.length];
  const rand = (a, b) => a + Math.random() * (b - a);
  const queue = [];
  const segs = new Float32Array(32), reach = new Float32Array(8);
  let rake = null, nextRake = 3.5, nextSprinkle = 1.5;

  function drop(x, y, r, color) {
    fluid.paint(ink, dropP, { uInk: ink.read, uC: [x, y], uR: r, uAspect: engine.aspect, uPx: 1.1 / Math.max(1, ink.h), uColor: color });
  }

  // drag the ink along up to eight strokes at once; a long stroke is taken in short steps so the drag stays smooth
  function tines(strokes) {
    if (!strokes.length) return;
    const longest = Math.max(...strokes.map(([ax, ay, bx, by]) => Math.hypot((bx - ax) * engine.aspect, by - ay)));
    const steps = Math.min(6, Math.max(1, Math.ceil(longest / 0.012)));
    for (let k = 0; k < steps; k++) {
      strokes.slice(0, 8).forEach(([ax, ay, bx, by, r], i) => {
        const t0 = k / steps, t1 = (k + 1) / steps;
        segs.set([ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1], i * 4);
        reach[i] = r;
      });
      fluid.paint(ink, tineP, { uInk: ink.read, uSeg: segs, uReach: reach, uCount: Math.min(8, strokes.length), uAspect: engine.aspect });
    }
  }

  // battal, the stone pattern: each colour sprinkled all over in turn, later drops pressing the earlier ones into veins
  function stones() {
    fluid.paint(ink, fill, { uPaper: paper });
    const area = engine.aspect;
    for (let c = 0; c < inks.length; c++) {
      const n = Math.round((c < 2 ? 34 : 22) * area);
      for (let i = 0; i < n; i++) drop(Math.random(), Math.random(), rand(0.03, 0.066), inks[c]);
    }
  }

  // a rake of tines drawn slowly across the bath along a gentle wave
  function startRake(t) {
    const horizontal = engine.aspect < 0.85 ? Math.random() < 0.3 : Math.random() < 0.7;
    rake = { t0: t, dur: o.rakeTime ?? 7, horizontal, phase: rand(0, 6), amp: rand(0.015, 0.035), tines: 7, dir: Math.random() < 0.5 ? 1 : -1, last: null };
  }
  function rakeStrokes(t) {
    const u = (t - rake.t0) / rake.dur;
    if (u >= 1) { rake = null; nextRake = t + rand(7, 11); return []; }
    const s = rake.dir > 0 ? u : 1 - u;
    const along = -0.05 + s * 1.1;
    const pts = [];
    for (let i = 0; i < rake.tines; i++) {
      const across = (i + 0.5) / rake.tines + rake.amp * Math.sin(along * 12 + rake.phase);
      pts.push(rake.horizontal ? [along, across] : [across, along]);
    }
    const strokes = rake.last ? pts.map(([x, y], i) => [rake.last[i][0], rake.last[i][1], x, y, 0.016]) : [];
    rake.last = pts;
    return strokes;
  }

  function simulate(dt, t, p) {
    // a few fresh drops now and then, somewhere new
    if (t > nextSprinkle) {
      const x = rand(0.08, 0.92), y = rand(0.1, 0.9), n = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) queue.push({ x: x + rand(-0.025, 0.025), y: y + rand(-0.025, 0.025), r: rand(0.012, 0.028), at: t + i * 0.35 });
      nextSprinkle = t + rand(2.2, 3.8);
    }
    let worked = false;
    while (queue.length && queue[0].at <= t) {
      const d = queue.shift();
      drop(d.x, d.y, d.r, nextInk());
      worked = true;
    }
    if (!rake && t > nextRake) startRake(t);
    const strokes = rake ? rakeStrokes(t) : [];
    // the cursor is one more stylus
    if (p && p.presence > 0.02 && p.moved && Math.hypot((p.x - p.px) * engine.aspect, p.y - p.py) < 0.3) {
      strokes.push([p.px, p.py, p.x, p.y, o.reach ?? 0.014]);
    }
    if (strokes.length) { tines(strokes); worked = true; }
    if (worked) fluid.paint(ink, sharpen, { uInk: ink.read, uInks: palette, uSnap: 0.5, uAmount: 0.08 });
  }

  // start from stones, then rake once through them so the first frame is already a marbled sheet
  stones();
  fluid.paint(ink, sharpen, { uInk: ink.read, uInks: palette, uSnap: 0.3, uAmount: 1 });
  startRake(0);
  rake.dur = 2.4;
  for (let i = 0; i < 146; i++) simulate(1 / 60, i / 60, null);
  rake = null;
  const t0 = 146 / 60;
  nextRake = t0 + 4;
  nextSprinkle = t0 + 1.5;

  return {
    maxDpr: o.maxDpr ?? 1.5,
    stillAt: 0,
    resize() { fluid.resize(); },
    down(p) { drop(p.x, p.y, rand(0.022, 0.042), nextInk()); },
    frame(dt, t) {
      if (dt > 0) simulate(Math.min(dt, 1 / 30), t + t0, engine.pointer);
      engine.draw(show, { uInk: ink.read, uTexel: ink.read.texel, uPaper: paper, uInks: palette, uSnap: o.crisp ?? 0.35, uTime: t, uGrain: o.grain ?? 0.025, uAspect: engine.aspect, uCss: [engine.cssW, engine.cssH] });
    },
  };
}
