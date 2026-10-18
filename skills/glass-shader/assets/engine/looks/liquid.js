// Liquid: water drops of every size resting on a photo, from a few big ones (the soft, thick kind phone interfaces
// are made of now) down to a dusting of dew. Each drop is a circle, and near ones melt into one another with a
// smooth union. Each has a rounded rim: steep at the edge, so the photo bends hard there and its colours split, and
// flat in the middle of a big drop, where it barely moves; a small drop is all rim, a little lens that turns the
// photo over. A bright rim catches the light from the top left, and a soft shadow sits under each drop.
// The big drop follows the cursor over the photo like a loupe and gathers the small ones it passes, which merge into
// it, and new dew keeps forming in the gaps. Drag any drop to move it (it takes in the ones it runs over); click the
// photo to flick out a droplet that runs to the nearest drop and merges with it.
//
// With dozens of drops, testing every one at every pixel would be slow, so each frame the canvas is cut into cells
// and a small float texture lists, for each cell, the drops that reach into it; a pixel only looks at its cell's.
import { HEAD, NOISE, COLOR } from "../glsl.js";
import { photo, blurChain } from "../backdrop.js";
import { clamp } from "../core.js";

export const meta = { id: "liquid", name: "Liquid", kind: "water drops" };

const CAP = 24;     // drops listed per cell
const CELL = 0.07;  // cell size, in canvas heights

const FS = HEAD + NOISE + COLOR + /* glsl */ `
uniform sampler2D uBack, uSoft;
uniform sampler2D uCells;   // a row per cell: (count, 0, 0, 0), then up to ${CAP} drops as (x, y, r, melt)
uniform vec2 uGrid, uRes;
uniform float uAspect, uBevel, uRefract, uAberr, uTime, uGrain, uFrost;
vec3 back(vec2 uv) { return mix(texture(uBack, uv).rgb, texture(uSoft, uv).rgb, uFrost); }
void main() {
  vec2 asp = vec2(uAspect, 1.0), p = vUv * asp;
  float px = 1.0 / uRes.y;
  ivec2 cell = ivec2(clamp(floor(vUv * uGrid), vec2(0.0), uGrid - 1.0));
  int row = cell.y * int(uGrid.x) + cell.x;
  int count = int(texelFetch(uCells, ivec2(0, row), 0).r);

  // the drops that reach here, melted together (a smooth union) while keeping track of the surface's slope and of
  // the size of the drop that shapes it; and the soft shadow each casts a little below itself
  float d = 1e3, size = 0.0, shadow = 0.0;
  vec2 g = vec2(0.0, 1.0);
  for (int j = 0; j < ${CAP}; j++) {
    if (j >= count) break;
    vec4 b = texelFetch(uCells, ivec2(j + 1, row), 0);
    vec2 q = p - b.xy * asp;
    float l = max(length(q), 1e-6), di = l - b.z;
    float h = max(b.w - abs(d - di), 0.0) / b.w;
    float w = d < di ? h * 0.5 : 1.0 - h * 0.5;
    g = mix(g, q / l, w);
    size = mix(size, b.z, w);
    d = min(d, di) - h * h * b.w * 0.25;
    float ds = length(q + vec2(0.0, min(0.014, b.z * 0.15))) - b.z;
    shadow = max(shadow, 1.0 - smoothstep(-0.1 * b.z, 0.45 * b.z, ds));
  }

  vec3 col = texture(uBack, vUv).rgb;
  col *= 1.0 - 0.22 * shadow * smoothstep(-px, px, d);
  if (d < px) {
    vec2 n2 = g / max(length(g), 1e-4);            // outward
    float bevel = min(uBevel, size * 0.8);         // a big drop's rim, or all of a small one
    float t = clamp(-d / bevel, 0.0, 1.0);         // 0 at the edge, 1 where the rim has flattened out
    float s = 1.0 - t;
    float slope = min(s / sqrt(max(1.0 - s * s, 0.004)), 5.0);
    vec2 off = -n2 * slope * uRefract * bevel / asp;
    vec3 glass;
    glass.r = back(vUv + off * (1.0 + uAberr)).r;
    glass.g = back(vUv + off).g;
    glass.b = back(vUv + off * (1.0 - uAberr)).b;
    glass = glass * 1.05 + 0.012;
    vec3 N = normalize(vec3(n2 * slope * 0.55, 1.0));
    vec3 L = normalize(vec3(-0.45, 0.65, 0.62));
    float spec = pow(max(dot(reflect(vec3(0.0, 0.0, -1.0), N), L), 0.0), 60.0);
    float rimLit = (1.0 - smoothstep(0.0, 0.22, t)) * (0.35 + 0.65 * max(dot(n2, normalize(vec2(-0.6, 0.8))), 0.0) + 0.4 * max(dot(n2, normalize(vec2(0.6, -0.8))), 0.0));
    glass += vec3(1.0) * (spec * 0.7 + rimLit * 0.32);
    // the dark ring at the edge, wider on small drops, the way dew looks
    glass *= mix(0.8, 1.0, smoothstep(0.0, mix(0.32, 0.05, smoothstep(0.005, 0.04, size)), t));
    col = mix(col, glass, 1.0 - smoothstep(-px, px, d));
  }
  col = shoulder(col);
  outColor = vec4(toSRGB(col) + grain(gl_FragCoord.xy, uTime, uGrain), 1.0);
}`;

export function create(engine, o = {}) {
  const gl = engine.gl;
  const wide = () => engine.aspect >= 0.85;
  // the photo sits on the right on wide screens (on top on tall ones) and fades into the page toward the copy
  const fade = () => (wide() ? [o.split ?? 0.4, (o.split ?? 0.4) + 0.2, 0, 0] : [0.5, 0.66, 1, 0]);
  const back = photo(engine, o.src, { focus: o.focus ?? [0.55, 0.5], parallax: 0.01, page: o.page ?? "#f6f1ea", fade });
  const blur = blurChain(engine, 2);
  back.ready.then(() => engine.redraw());
  const prog = engine.program(FS, undefined, "liquid");
  let backT;
  function size() {
    backT?.dispose();
    backT = engine.target(engine.width, engine.height);
    blur.size(engine.width, engine.height);
    sizeCells();
  }

  // the cell lists: an RGBA32F texture, CAP + 1 texels wide, a row per cell
  let gx = 1, gy = 1, cellTex = null, cells = null, counts = null;
  function sizeCells() {
    gx = Math.max(1, Math.ceil(engine.aspect / CELL));
    gy = Math.ceil(1 / CELL);
    cells = new Float32Array((CAP + 1) * 4 * gx * gy);
    counts = new Int32Array(gx * gy);
    if (cellTex) gl.deleteTexture(cellTex);
    cellTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, cellTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, CAP + 1, gx * gy, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  size();
  const rand = (a, b) => a + Math.random() * (b - a);

  // where the drops live: the photo's part of the canvas; drops are placed as fractions of it, so they follow a resize
  const region = () => (wide() ? { x0: (o.split ?? 0.4) + 0.12, x1: 0.97, y0: 0.08, y1: 0.92 } : { x0: 0.06, x1: 0.94, y0: 0.62, y1: 0.9 });
  const toCanvas = (fx, fy) => { const r = region(); return [r.x0 + (r.x1 - r.x0) * fx, r.y0 + (r.y1 - r.y0) * fy]; };
  const toFrac = (x, y) => { const r = region(); return [(x - r.x0) / (r.x1 - r.x0), (y - r.y0) / (r.y1 - r.y0)]; };
  const scale = () => (wide() ? 1 : 0.5);
  // how many drops the photo holds: about one per this much area (canvas heights squared), on top of the big ones
  const target = () => { const r = region(); return Math.round(((r.x1 - r.x0) * engine.aspect * (r.y1 - r.y0)) / (o.spacing ?? 0.011)); };

  const drops = [];
  const add = (fx, fy, size, extra = {}) => {
    const [x, y] = toCanvas(fx, fy);
    const b = { fx, fy, x, y, vx: 0, vy: 0, size, base: size, grow: 1, main: false, seed: rand(0, 100), ...extra };
    drops.push(b);
    return b;
  };
  const radius = (b) => b.size * scale() * (b.grow < 1 ? b.grow * b.grow * (3 - 2 * b.grow) : 1);
  // is there room for a drop of radius r at (x, y)? (a gap between drops, and a wider berth round the big one)
  const room = (x, y, r) => drops.every((b) => Math.hypot((x - b.x) * engine.aspect, y - b.y) > r + radius(b) + 0.008 + (b.main ? 0.05 : 0));
  // a drop size: mostly dew, now and then a bigger bead
  const dew = () => { const u = Math.random(); return u < 0.5 ? rand(0.008, 0.018) : u < 0.82 ? rand(0.018, 0.032) : rand(0.032, 0.055); };
  const scatter = (n, size, extra) => {
    for (let i = 0, tries = 0; i < n && tries < n * 40; tries++) {
      const fx = Math.random(), fy = Math.random(), s = size(), [x, y] = toCanvas(fx, fy);
      if (!room(x, y, s * scale())) continue;
      add(fx, fy, s, extra);
      i++;
    }
  };

  // the big ones first, then dew in the gaps
  const layout = o.drops ?? [[0.5, 0.5, 0.15], [0.2, 0.78, 0.075], [0.82, 0.24, 0.09], [0.78, 0.8, 0.062], [0.2, 0.22, 0.056], [0.62, 0.9, 0.048]];
  layout.forEach(([fx, fy, s], i) => add(fx, fy, s, { main: i === 0 }));
  const main = drops[0];
  scatter(Math.max(0, target() - drops.length), dew);

  const sprites = []; // droplets in flight
  let grabbed = null, grabOff = [0, 0], nextDew = 0;
  const near = (x, y) => {
    let best = null, bd = 1e9;
    for (const b of drops) {
      const d = Math.hypot((x - b.x) * engine.aspect, y - b.y) - radius(b);
      if (d < bd) { bd = d; best = b; }
    }
    return [best, bd];
  };
  // b takes in a: their water adds up (the big drop swells for a moment, then settles back to its size)
  const absorb = (b, a) => {
    b.size = Math.sqrt(b.size * b.size + a.size * a.size * (a.grow < 1 ? a.grow : 1));
    if (b.main) b.size = Math.min(b.size, b.base * 1.5);
    else b.base = b.size;
  };

  function step(dt, t) {
    const p = engine.pointer, r = region();
    const inPhoto = p.presence > 0.05 && p.x > r.x0 - 0.08 && p.y > r.y0 - 0.08 && p.y < r.y1 + 0.08;
    for (const b of drops) {
      const [hx, hy] = toCanvas(b.fx, b.fy);
      const wob = 0.012 * clamp(b.size / 0.05, 0.1, 1);
      let tx = hx + wob * Math.sin(t * 0.4 + b.seed), ty = hy + wob * Math.cos(t * 0.33 + b.seed * 1.3);
      let k = 14;
      if (b === grabbed) { tx = p.x + grabOff[0]; ty = p.y + grabOff[1]; k = 120; }
      else if (b.main && inPhoto && !grabbed) { tx = p.sx; ty = p.sy; k = 22; }
      let ax = (tx - b.x) * k, ay = (ty - b.y) * k;
      // the big drop gathers small ones as it passes
      if (!b.main && b !== grabbed) {
        const dx = (main.x - b.x) * engine.aspect, dy = main.y - b.y, dist = Math.hypot(dx, dy);
        const reach = radius(main) + radius(b) + 0.07;
        if (dist < reach && dist > 1e-4) {
          const pull = (1 - dist / reach) * 9;
          ax += (dx / dist) * pull / engine.aspect;
          ay += (dy / dist) * pull;
        }
      }
      const c = 2 * Math.sqrt(k) * (b === grabbed ? 1 : 0.62);
      b.vx += (ax - b.vx * c) * dt;
      b.vy += (ay - b.vy * c) * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.grow < 1) b.grow = Math.min(1, b.grow + dt / 1.6);
      if (b.main) b.size += (b.base - b.size) * (1 - Math.exp(-dt * (b.size > b.base * 1.4 ? 3 : 0.35)));
    }
    // drops that have run into each other merge: the big one, or the one in hand, takes in the other
    for (let i = drops.length - 1; i >= 0; i--) {
      const a = drops[i];
      for (const b of drops) {
        if (b === a) continue;
        const ra = radius(a), rb = radius(b);
        if (Math.hypot((a.x - b.x) * engine.aspect, a.y - b.y) > (ra + rb) * 0.6) continue;
        const keep = a.main || a === grabbed ? a : b.main || b === grabbed ? b : ra > rb ? a : b;
        const lose = keep === a ? b : a;
        absorb(keep, lose);
        drops.splice(drops.indexOf(lose), 1);
        if (lose === grabbed) grabbed = null;
        break;
      }
    }
    // new dew forms in the gaps
    if (t > nextDew && drops.length < target() + layout.length) {
      nextDew = t + 0.25;
      for (let tries = 0; tries < 12; tries++) {
        const fx = Math.random(), fy = Math.random(), s = dew(), [x, y] = toCanvas(fx, fy);
        if (room(x, y, s * scale() + 0.01)) { add(fx, fy, s, { grow: 0 }); break; }
      }
    }
    // droplets fly to the nearest drop and merge
    for (let i = sprites.length - 1; i >= 0; i--) {
      const s = sprites[i];
      const [b] = near(s.x, s.y);
      const dx = (b.x - s.x) * engine.aspect, dy = b.y - s.y, dist = Math.hypot(dx, dy);
      s.vx += ((dx / dist) * 2.6 / engine.aspect - s.vx * 1.2) * dt;
      s.vy += ((dy / dist) * 2.6 - s.vy * 1.2) * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (dist < radius(b) * 0.85) {
        absorb(b, s);
        sprites.splice(i, 1);
      }
    }
  }

  // list each drop in every cell it reaches into: its own radius plus the melt and its shadow, plus a pixel
  function bin() {
    cells.fill(0);
    counts.fill(0);
    const list = [...drops, ...sprites.map((s) => ({ ...s, grow: 1 }))].map((b) => {
      const r = radius(b);
      return [b.x, b.y, r, clamp(0.45 * r + 0.004, 0.006, 0.06)];
    }).sort((a, b) => b[2] - a[2]);
    for (const b of list) {
      if (b[2] < 1e-4) continue;
      const reach = b[2] + Math.max(b[3], 0.6 * b[2]) + 0.004;
      const x0 = Math.max(0, Math.floor((b[0] - reach / engine.aspect) * gx)), x1 = Math.min(gx - 1, Math.floor((b[0] + reach / engine.aspect) * gx));
      const y0 = Math.max(0, Math.floor((b[1] - reach) * gy)), y1 = Math.min(gy - 1, Math.floor((b[1] + reach) * gy));
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const row = cy * gx + cx, n = counts[row];
          if (n >= CAP) continue;
          cells.set(b, (row * (CAP + 1) + 1 + n) * 4);
          counts[row] = n + 1;
        }
      }
    }
    for (let row = 0; row < gx * gy; row++) cells[row * (CAP + 1) * 4] = counts[row];
    gl.bindTexture(gl.TEXTURE_2D, cellTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, CAP + 1, gx * gy, gl.RGBA, gl.FLOAT, cells);
  }

  return {
    maxDpr: o.maxDpr ?? 1.75,
    stillAt: 3,
    resize: size,
    down(p) {
      const [b, d] = near(p.x, p.y);
      if (d < 0.012) { grabbed = b; grabOff = [b.x - p.x, b.y - p.y]; return; }
      const r = region();
      if (p.x < r.x0 - 0.1 || p.y < r.y0 - 0.1 || sprites.length > 6) return;
      const a = rand(0, Math.PI * 2);
      sprites.push({ x: p.x, y: p.y, size: rand(0.016, 0.026), grow: 1, vx: Math.cos(a) * 0.25, vy: Math.sin(a) * 0.25 });
    },
    up() {
      if (!grabbed) return;
      const r = region();
      [grabbed.fx, grabbed.fy] = toFrac(clamp(grabbed.x, r.x0 - 0.05, r.x1), clamp(grabbed.y, r.y0, r.y1));
      grabbed = null;
    },
    frame(dt, t) {
      step(Math.min(dt, 1 / 30), t);
      bin();
      if (!back.render(backT, dt, t)) return;
      blur.build(backT, 1.2);
      engine.draw(prog, {
        uBack: backT, uSoft: blur.levels[0], uCells: cellTex, uGrid: [gx, gy], uAspect: engine.aspect,
        uBevel: o.bevel ?? 0.07, uRefract: o.refract ?? 0.75, uAberr: o.aberration ?? 0.18, uFrost: o.frost ?? 0.08,
        uRes: [engine.width, engine.height], uTime: t, uGrain: o.grain ?? 0.02,
      });
    },
  };
}
