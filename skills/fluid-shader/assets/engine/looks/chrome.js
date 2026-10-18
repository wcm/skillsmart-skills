// Chrome: liquid metal under a lamp you hold. The surface is a slowly flowing, folded height field (domain-warped
// noise), worked out afresh for every pixel rather than carried along by a simulation, so it's smooth everywhere and
// has no walls to streak against. Each pixel's slope bends the view into a dark studio with soft light strips, which
// is all chrome is: reflections. The cursor never touches the metal. It's a lamp held over it: the folds that face it
// catch its light, the highlights glide over them as it moves, and the studio leans a little toward it. A click lets
// a slow ring spread through the metal.
import { HEAD, NOISE, COLOR } from "../glsl.js";
import { rgb } from "../core.js";

export const meta = { id: "chrome", name: "Chrome", kind: "liquid metal" };

// The height map is drawn a few texels bigger than the canvas (uFit), so the slopes along the canvas edge are read
// from real neighbours, not a clamped copy of the edge, which would leave a faint line down each side.
const HEIGHT = HEAD + NOISE + /* glsl */ `
uniform float uTime, uAspect, uScale;
uniform vec2 uFit;
uniform vec4 uDrop; // x, y, age, strength
float pattern(vec2 q, float t) {
  vec2 a = vec2(fbm3(q + vec2(0.0, t * 0.05)), fbm3(q + vec2(5.2, -t * 0.04)));
  vec2 b = vec2(fbm3(q + 1.4 * a + vec2(1.7, 9.2) + t * 0.03), fbm3(q + 1.4 * a + vec2(8.3, 2.8) - t * 0.035));
  return fbm3(q + 1.5 * b) + 0.04 * gnoise(q * 2.6 + b);
}
void main() {
  vec2 uv = (vUv - 0.5) * uFit + 0.5;
  vec2 q = (uv - 0.5) * vec2(uAspect, 1.0) * uScale;
  float h = pattern(q, uTime);
  // a dropped ring
  vec2 d = (uv - uDrop.xy) * vec2(uAspect, 1.0);
  float r = length(d), front = uDrop.z * 0.55;
  h += uDrop.w * 0.16 * sin((r - front) * 38.0) * exp(-pow((r - front) / 0.07, 2.0)) * exp(-uDrop.z * 1.2);
  outColor = vec4(h, 0.0, 0.0, 1.0);
}`;

const SHADE = HEAD + NOISE + COLOR + /* glsl */ `
uniform sampler2D uHeight;
uniform vec2 uHTexel, uFit, uLean;
uniform float uRelief, uTime, uGrain, uAspect;
uniform vec3 uTint, uWarm, uLampColor;
uniform vec4 uLamp; // x, y, strength, height over the metal (in canvas heights)
// a dark studio: a big soft box overhead, a thin horizon strip, a tall strip each side
vec3 studio(vec3 r) {
  float x = r.x, y = r.y;
  vec3 c = vec3(0.035) + vec3(0.1) * smoothstep(-1.0, 1.0, y);
  c += vec3(1.0) * smoothstep(0.18, 0.4, y) * (1.0 - smoothstep(0.62, 0.98, y)) * 0.95;
  c += vec3(1.0) * exp(-pow((y + 0.14) / 0.04, 2.0)) * 0.75;
  c += uWarm * exp(-pow((x - 0.58) / 0.07, 2.0)) * smoothstep(-0.7, 0.1, y) * 0.65;
  c += vec3(0.85, 0.9, 1.0) * exp(-pow((x + 0.66) / 0.09, 2.0)) * smoothstep(-0.4, 0.5, y) * 0.4;
  return c;
}
void main() {
  vec2 hv = (vUv - 0.5) / uFit + 0.5;
  float hL = texture(uHeight, hv - vec2(uHTexel.x, 0.0)).r, hR = texture(uHeight, hv + vec2(uHTexel.x, 0.0)).r;
  float hB = texture(uHeight, hv - vec2(0.0, uHTexel.y)).r, hT = texture(uHeight, hv + vec2(0.0, uHTexel.y)).r;
  float h = texture(uHeight, hv).r;
  vec2 g = vec2((hR - hL) / (2.0 * uHTexel.x * uFit.x * uAspect), (hT - hB) / (2.0 * uHTexel.y * uFit.y)) * uRelief;
  vec3 n = normalize(vec3(-g, 1.0));
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  // the studio leans a little toward the lamp, as if the metal tipped under it
  vec3 c = studio(normalize(r + vec3(uLean, 0.0))) * uTint;
  // the lamp: a round soft box with a hot centre, held over the metal at the cursor. A fold catches it where its
  // reflection points at the lamp, and folds nearer the lamp catch more.
  vec3 toLamp = vec3((uLamp.xy - vUv) * vec2(uAspect, 1.0), uLamp.w);
  float s = dot(r, normalize(toLamp));
  float near = exp(-dot(toLamp.xy, toLamp.xy) * 3.0);
  c += uLampColor * (0.7 * smoothstep(0.88, 0.95, s) + 2.0 * pow(max(s, 0.0), 260.0)) * near * uLamp.z;
  // deep valleys hold less light
  c *= 0.7 + 0.3 * smoothstep(-0.45, 0.35, h);
  // a faint sheen on the broad tops
  c += uTint * 0.05 * smoothstep(0.2, 0.6, h);
  c = shoulder(c);
  outColor = vec4(toSRGB(c) + grain(gl_FragCoord.xy, uTime, uGrain), 1.0);
}`;

export function create(engine, o = {}) {
  const heightP = engine.program(HEIGHT, undefined, "chrome height");
  const shade = engine.program(SHADE, undefined, "chrome shade");
  const tint = rgb(o.tint ?? "#e9eef7"), warm = rgb(o.warm ?? "#ffe7cf"), lampColor = rgb(o.lamp ?? "#fff0e0");
  const MARGIN = 3; // texels of height map beyond each edge of the canvas
  let height, fit = [1, 1];
  const sizeHeight = () => {
    height?.dispose();
    const w = Math.max(8, Math.round(engine.width * 0.5)), h = Math.max(8, Math.round(engine.height * 0.5));
    height = engine.target(w + 2 * MARGIN, h + 2 * MARGIN);
    fit = [(w + 2 * MARGIN) / w, (h + 2 * MARGIN) / h];
  };
  sizeHeight();
  let drop = [0.5, 0.5, 99, 0];
  // the lamp trails the cursor a little, so its light glides rather than jumps
  const lamp = { x: 0.5, y: 0.5 };

  return {
    maxDpr: o.maxDpr ?? 1.5,
    stillAt: 5,
    resize() { sizeHeight(); },
    down(p) { drop = [p.x, p.y, 0, 0.7]; },
    frame(dt, t) {
      const p = engine.pointer;
      // while it's dark, the lamp waits under the cursor, so it never flies in from somewhere else
      if (p.presence < 0.02) { lamp.x = p.x; lamp.y = p.y; }
      else {
        const k = 1 - Math.exp(-dt * (o.glide ?? 4));
        lamp.x += (p.x - lamp.x) * k;
        lamp.y += (p.y - lamp.y) * k;
      }
      drop[2] += dt;
      const ts = t * (o.speed ?? 1), on = p.presence * (o.lampStrength ?? 1), lean = (o.lean ?? 0.3) * on;
      engine.draw(heightP, { uTime: ts, uAspect: engine.aspect, uScale: o.scale ?? 1.15, uFit: fit, uDrop: drop }, height);
      engine.draw(shade, {
        uHeight: height, uHTexel: height.texel, uFit: fit, uRelief: o.relief ?? 0.12, uTime: ts, uGrain: o.grain ?? 0.03,
        uAspect: engine.aspect, uTint: tint, uWarm: warm, uLampColor: lampColor,
        uLamp: [lamp.x, lamp.y, on, o.lampHeight ?? 0.32], uLean: [(lamp.x - 0.5) * lean, (lamp.y - 0.5) * lean],
      });
    },
  };
}
