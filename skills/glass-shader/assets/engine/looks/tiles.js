// Tiles: a wall of thick frosted glass blocks with rounded corners over a soft ball of colour. Each block is a lens,
// the way Liquid's drops are, a little gentler: it shows its own part of the ball, magnified, and its wide rounded
// rim bends harder and harder toward the edge, pulling the picture in from its middle and turning it over right at
// the edge, where red and blue split. The glass frosts it all, richens the colour it lets through and lifts it a
// touch toward white, so a block over bare ground still shows faintly. Nothing is drawn on the glass: no outlines, no highlights, no shadows,
// only the picture behind, bent and frosted. The blocks follow the lattice of an element (`grid`: its box and its
// CSS variables --cols, --rows, --gap, --tile-r set their size and spacing) and carry on past it, off the page,
// stopping only at the copy: right of the title (`title`) on wide screens, above the copy (`clear`) on tall ones.
// The ball drifts slowly round behind the grid's element and leans after the cursor, kept where the blocks always
// cover it; a click makes it swell for a moment.
import { HEAD, NOISE, COLOR } from "../glsl.js";
import { orb, blurChain } from "../backdrop.js";
import { clamp } from "../core.js";

export const meta = { id: "tiles", name: "Tiles", kind: "frosted glass tiles" };

const FS = HEAD + NOISE + COLOR + /* glsl */ `
uniform sampler2D uBack, uB1, uB2, uB3;
uniform vec2 uCss, uCells;
uniform vec4 uGrid;      // the element the lattice is taken from: x0, y0, x1, y1 (uv, y up)
uniform vec3 uClear;     // the copy's side: (1, x, 0) no blocks left of x, or (2, y, 0) none below y (CSS px, y up)
uniform float uGap, uRadius, uMag, uRefract, uRim, uDisperse, uFrost, uSat, uMilk, uTime, uGrain;
// the backdrop, from sharp (0) through a quarter, an eighth and a sixteenth of its size (1, 2, 3)
vec3 read(vec2 uv, float b) {
  if (b < 1.0) return mix(texture(uBack, uv).rgb, texture(uB1, uv).rgb, b);
  if (b < 2.0) return mix(texture(uB1, uv).rgb, texture(uB2, uv).rgb, b - 1.0);
  return mix(texture(uB2, uv).rgb, texture(uB3, uv).rgb, min(b - 2.0, 1.0));
}
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  vec2 px = vUv * uCss;
  vec2 g0 = uGrid.xy * uCss, g1 = uGrid.zw * uCss;
  vec2 pitch = (g1 - g0 + uGap) / uCells, hs = (pitch - uGap) * 0.5;
  vec2 c = g0 + floor((px - g0) / pitch) * pitch + hs, lp = px - c;
  float d = sdRoundBox(lp, hs, uRadius);                 // < 0 inside the block, in CSS px
  // the blocks stop at the copy: a block is there only if all of it is clear of the copy's side
  bool present = uClear.x < 0.5 || (uClear.x < 1.5 ? c.x - hs.x >= uClear.y : c.y - hs.y >= uClear.y);

  vec3 col = texture(uBack, vUv).rgb;
  if (present && d < 0.75) {
    float B = min(hs.x, hs.y) * uRim;                    // the rounded rim's width
    float s = 1.0 - clamp(-d / B, 0.0, 1.0);              // 0 where the top is flat, 1 at the very edge
    float slope = min(s / sqrt(max(1.0 - s * s, 0.004)), 4.0);
    vec2 e = vec2(0.5, 0.0);
    vec2 n = normalize(vec2(sdRoundBox(lp + e.xy, hs, uRadius) - sdRoundBox(lp - e.xy, hs, uRadius),
                            sdRoundBox(lp + e.yx, hs, uRadius) - sdRoundBox(lp - e.yx, hs, uRadius)) + 1e-6);
    // where it looks: its own middle, magnified, pulled in harder and harder across the rim
    vec2 bend = -n * slope * uRefract * B;
    vec2 at = c + lp * uMag + bend;
    vec2 split = bend * uDisperse;
    float b = uFrost + 0.3 * s;
    vec3 glass = vec3(read((at + split) / uCss, b).r, read(at / uCss, b).g, read((at - split) / uCss, b).b);
    glass = mix(max(fromOklab(oklab(glass) * vec3(1.0, uSat, uSat)), 0.0), vec3(1.0), uMilk);
    col = mix(col, glass, 1.0 - smoothstep(-0.75, 0.75, d));
  }
  outColor = vec4(toSRGB(shoulder(col)) + grain(gl_FragCoord.xy, uTime, uGrain), 1.0);
}`;

export function create(engine, o = {}) {
  const back = orb(engine, o.backdrop);
  const blur = blurChain(engine, 4);
  const prog = engine.program(FS, undefined, "tiles");
  let backT;
  function size() {
    backT?.dispose();
    backT = engine.target(engine.width, engine.height);
    blur.size(engine.width, engine.height);
  }
  size();

  let grid = [0.5, 0.1, 0.95, 0.9], cells = [4, 5], gap = 5, corner = 26, side = 400, clear = [0, 0, 0];
  const wide = () => engine.aspect >= 0.85;
  function measure() {
    if (!o.grid) return;
    const b = engine.box(o.grid), cs = getComputedStyle(o.grid), num = (k, d) => { const v = parseFloat(cs.getPropertyValue(k)); return Number.isFinite(v) ? v : d; };
    grid = [b.x0, b.y0, b.x1, b.y1];
    side = Math.min(b.w, b.h);
    cells = [num("--cols", 4), num("--rows", 5)];
    gap = num("--gap", 5);
    corner = num("--tile-r", 26);
    // where the blocks stop: right of the title's column on wide screens, above the copy on tall ones; edge is where
    // the first whole row or column of blocks actually begins (CSS px, y up)
    const at = (start, size, count, limit) => { const pitch = (size + gap) / count; return start + Math.ceil((limit - start) / pitch) * pitch; };
    if (wide() && o.title) {
      const limit = engine.box(o.title).x1 * engine.cssW + gap * 3;
      clear = [1, limit, at(b.x0 * engine.cssW, b.w, cells[0], limit)];
    } else if (!wide() && o.clear) {
      const limit = engine.box(o.clear).y1 * engine.cssH + gap * 2;
      clear = [2, limit, at(b.y0 * engine.cssH, b.h, cells[1], limit)];
    } else clear = [0, 0, 0];
  }
  measure();

  // the ball: a slow drift of its own round the grid's element, leaning after the cursor on a soft spring, and kept
  // where the blocks cover all of its glow (away from the copy's side)
  const ball = { x: 0, y: 0, vx: 0, vy: 0, pulse: 0, placed: false };
  const ballR = () => (o.ball ?? 0.6) * side;   // CSS px
  function steer(dt, t) {
    const p = engine.pointer;
    const hw = (grid[2] - grid[0]) / 2, hh = (grid[3] - grid[1]) / 2, mx = (grid[0] + grid[2]) / 2, my = (grid[1] + grid[3]) / 2;
    let x0 = mx - hw * 0.55, x1 = mx + hw * 0.55, y0 = my - hh * 0.55, y1 = my + hh * 0.55;
    const glow = ballR();
    if (clear[0] === 1) x0 = Math.min(Math.max(x0, (clear[2] + glow) / engine.cssW), x1);
    if (clear[0] === 2) y0 = Math.min(Math.max(y0, (clear[2] + glow) / engine.cssH), y1);
    let tx = mx + hw * 0.3 * Math.sin(t * 0.19), ty = my + hh * 0.25 * Math.sin(t * 0.14 + 1.3);
    if (p.presence > 0.01) {
      tx += (p.sx - tx) * p.presence;
      ty += (p.sy - ty) * p.presence;
    }
    tx = clamp(tx, x0, x1);
    ty = clamp(ty, y0, y1);
    if (!ball.placed) Object.assign(ball, { x: tx, y: ty, placed: true });
    const k = o.follow ?? 3, c = 2 * Math.sqrt(k) * 0.85;
    ball.vx += ((tx - ball.x) * k - ball.vx * c) * dt;
    ball.vy += ((ty - ball.y) * k - ball.vy * c) * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.pulse = Math.max(0, ball.pulse - dt * 1.3);
  }

  return {
    maxDpr: o.maxDpr ?? 1.5,
    stillAt: 4,
    resize() { size(); measure(); },
    down() { ball.pulse = 1; },
    frame(dt, t) {
      if (engine.frameNo % 30 === 1) measure();
      steer(Math.min(dt, 1 / 30), t);
      back.render(backT, t, [ball.x, ball.y], ballR() / engine.cssH, ball.pulse);
      blur.build(backT, 1.6);
      engine.draw(prog, {
        uBack: backT, uB1: blur.levels[1], uB2: blur.levels[2], uB3: blur.levels[3], uCss: [engine.cssW, engine.cssH],
        uGrid: grid, uCells: cells, uClear: clear, uGap: gap, uRadius: corner,
        uMag: o.magnify ?? 0.62, uRefract: o.refract ?? 0.45, uRim: o.rim ?? 0.55, uDisperse: o.dispersion ?? 0.18,
        uFrost: o.frost ?? 1.6, uSat: o.saturate ?? 1.3, uMilk: o.milk ?? 0.07, uTime: t, uGrain: o.grain ?? 0.015,
      });
    },
  };
}
