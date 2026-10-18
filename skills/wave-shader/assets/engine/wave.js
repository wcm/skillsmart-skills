// The Wave Shader's one engine: a wavy surface of colour, seen by a camera, lit and grained. Every look in this folder is
// this file with different settings (see the presets at the bottom), the way ShaderGradient's looks are one shader.
//
// A grid mesh is lifted by a few long waves and slow noise. Its shape decides what it reads as: a plane seen from
// above is silk (Haze), the same plane from a low camera is a sea (Swell), a hanging sheet that glows instead of
// reflecting is an aurora (light piles up where the sheet folds edge-on, the way real curtains look), and a long
// strip that sways and twists is a ribbon. Colour comes from one ramp, read across the surface, up its crests and
// along its length. Light is either "lit" (wrapped diffuse, a broad sheen, a sharp highlight, sky in the grazing
// angles, fog into the distance) or "glow" (an emitting sheet, drawn at half size, blurred and added over the sky).
// The sky is its own pass: a gradient, an optional sun, stars and a treeline.
//
// The cursor presses the surface where it points (it lifts a plane, bends a sheet toward you, pushes a ribbon) and
// leans the camera a touch; a click sends a ring of waves out from where it lands. Both are found by casting the
// pointer's ray onto the shape's mean plane, so they sit on the surface, not on the screen.
import { HEAD, NOISE, COLOR } from "./glsl.js";
import { rgb, rgbs, damp } from "./core.js";

export const engine = { depth: true, antialias: true };

const COLS = 240, ROWS = 170;
const SHAPE = { plane: 0, sheet: 1, ribbon: 2 };

const VS = `#version 300 es
precision highp float;
in vec2 aGrid;
uniform mat4 uViewProj;
uniform float uTime, uAmp, uFreq, uWarp;
uniform int uShape;
uniform vec4 uShapeA, uShapeB;
uniform vec4 uPress;    // where the pointer meets the surface (2 coords on the shape's plane), radius, strength
uniform vec4 uRipple;   // where a click landed (2 coords), age, strength
out vec3 vPos;
out vec3 vNormal;
out vec2 vGrid;
out float vH;
out float vRing;
${NOISE}
float waves(vec2 p, float t) {
  p *= uFreq;
  float h = 0.55 * sin(dot(p, vec2(0.28, 0.78)) - t * 0.62)
          + 0.32 * sin(dot(p, vec2(-0.66, 0.62)) - t * 0.78 + 1.7)
          + 0.16 * sin(dot(p, vec2(1.25, 0.45)) - t * 1.05 + 0.6);
  h += uWarp * (0.55 * gnoise(p * 0.16 + vec2(t * 0.03, -t * 0.05)) + 0.12 * gnoise(p * 0.6 - vec2(t * 0.1, t * 0.08)));
  return h;
}
// the pointer's press and the click's ring, measured on the shape's own plane
float touch(vec2 q, out float ring) {
  vec2 d = q - uPress.xy;
  float press = uPress.w * exp(-dot(d, d) / (uPress.z * uPress.z));
  float r = length(q - uRipple.xy), front = uRipple.z * 3.0;
  ring = uRipple.w * exp(-pow((r - front) / 1.3, 2.0)) * exp(-uRipple.z * 0.6);
  return press + ring * sin((r - front) * 2.4) * 0.5;
}
vec3 surf(vec2 g, out float h, out float ring) {
  float t = uTime;
  vec3 p, up;
  vec2 q;
  if (uShape == 0) {
    // a plane: x across, z away, rows spaced to match perspective (dense near, sparse far)
    float d = uShapeA.x * pow(uShapeA.y / uShapeA.x, g.y);
    float spread = d * uShapeA.z + uShapeA.w;
    vec2 xz = vec2((g.x * 2.0 - 1.0) * spread, -d);
    h = waves(xz, t) * uAmp * mix(1.0, uShapeB.x, smoothstep(uShapeB.y, uShapeB.z, d));
    p = vec3(xz.x, h, xz.y);
    up = vec3(0.0, 1.0, 0.0);
    q = xz;
  } else if (uShape == 1) {
    // a hanging sheet: x across, y up, folded in depth; it curves round you, near at the sides, far in the middle
    float x = (g.x * 2.0 - 1.0) * uShapeA.x;
    float y = uShapeA.z + g.y * uShapeA.y;
    float k = x / uShapeA.x;
    h = waves(vec2(x * 1.1, y * 0.16 + t * 0.04), t) * uAmp;
    y += uShapeB.y * gnoise(vec2(x * 0.12 + 3.0, t * 0.05));
    p = vec3(x, y, uShapeA.w - uShapeB.x * (1.0 - k * k) + h);
    up = vec3(0.0, 0.0, 1.0);
    q = p.xy;
  } else {
    // a ribbon: a long strip that sways, bends and twists along its length, tilted across the picture
    float x = (g.x * 2.0 - 1.0) * uShapeA.x;
    float u = g.y * 2.0 - 1.0;
    // twist: a steady turn along the length, a wave of extra turn rolling along it, and a slow spin over time
    float tw = uShapeA.z * x + uShapeA.w * sin(x * 0.45 - t * 0.35) + t * uShapeB.w;
    vec3 c = vec3(x, uShapeB.x * sin(x * 0.42 * uFreq + t * 0.33) + uWarp * 0.5 * gnoise(vec2(x * 0.22, t * 0.08)),
                  uShapeB.y * cos(x * 0.31 + t * 0.27));
    vec3 across = vec3(0.0, cos(tw), sin(tw));
    up = vec3(0.0, -sin(tw), cos(tw));
    h = 0.08 * uAmp * waves(vec2(x * 1.6, u * 3.0), t);
    p = c + across * u * uShapeA.y + up * h;
    float ca = cos(uShapeB.z), sa = sin(uShapeB.z);
    p.xy = mat2(ca, sa, -sa, ca) * p.xy;
    up.xy = mat2(ca, sa, -sa, ca) * up.xy;
    up = vec3(0.0, 0.0, 1.0) * 0.6 + up * 0.4;
    q = p.xy;
  }
  float push = touch(q, ring);
  p += up * push;
  h += push;
  return p;
}
void main() {
  float h, ring, hx, rx;
  vec2 e = vec2(1.0 / ${COLS - 1}.0, 1.0 / ${ROWS - 1}.0);
  vec3 p = surf(aGrid, h, ring);
  vec3 dx = surf(aGrid + vec2(e.x, 0.0), hx, rx) - surf(aGrid - vec2(e.x, 0.0), hx, rx);
  vec3 dy = surf(aGrid + vec2(0.0, e.y), hx, rx) - surf(aGrid - vec2(0.0, e.y), hx, rx);
  vNormal = normalize(cross(dx, dy));
  vPos = p;
  vGrid = aGrid;
  vH = h;
  vRing = ring;
  gl_Position = uViewProj * vec4(p, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vPos;
in vec3 vNormal;
in vec2 vGrid;
in float vH;
in float vRing;
out vec4 outColor;
uniform vec3 uEye, uSunDir, uSun, uHorizon, uSkyLow;
uniform vec3 uRamp[5];
uniform vec4 uColorBy;   // weights: across, height, along; then an offset
uniform vec4 uLit;       // ambient, diffuse, sheen, highlight
uniform vec4 uFogP;      // fog start, fog density, sky in grazing angles, sparkle
uniform vec4 uGlowP;     // lower-edge softness, fade upward, ray frequency, ray amount
uniform vec4 uGlowQ;     // brightness, wings, tall screen, brightening near the pointer
uniform vec2 uRes, uPointer;
uniform vec2 uFibre;     // amount, strands across the surface
uniform vec4 uDof;       // on, focus distance, how far from it things are fully soft, softness at one edge
uniform vec3 uFwd;
uniform float uTime, uGrain, uGlow, uPresence, uAspect;
${NOISE}
${COLOR}
vec3 ramp(float u) {
  u = clamp(u, 0.0, 1.0) * 4.0;
  float i = floor(min(u, 3.999)), f = u - i;
  vec3 a = uRamp[0], b = uRamp[1];
  if (i == 1.0) { a = uRamp[1]; b = uRamp[2]; }
  if (i == 2.0) { a = uRamp[2]; b = uRamp[3]; }
  if (i == 3.0) { a = uRamp[3]; b = uRamp[4]; }
  return mixOk(a, b, smoothstep(0.0, 1.0, f));
}
void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(uEye - vPos);
  if (dot(n, v) < 0.0) n = -n;   // both faces, each facing whoever looks at it
  float u = uColorBy.w + uColorBy.x * (vGrid.x - 0.5) + uColorBy.y * vH + uColorBy.z * (vGrid.y - 0.5)
          + 0.05 * sin(uTime * 0.05 + vGrid.y * 3.0);

  if (uGlow > 0.5) {
    // a thin glowing sheet, piling up where it's seen edge-on. Nothing about it is even: how high each stretch
    // reaches, where its light begins and how sharply, how long each ray is and how bright each patch is all
    // wander along the curtain and drift in time, so it never reads as a band with clean edges.
    vec2 suv = gl_FragCoord.xy / uRes;
    float x = vGrid.x, rise = vGrid.y, t = uTime;
    float reach = 0.2 + 0.95 * smoothstep(-0.45, 0.5, gnoise(vec2(x * 6.0, t * 0.025)) + 0.4 * gnoise(vec2(x * 19.0, t * 0.04 + 4.0)));
    float start = 0.02 + 0.24 * smoothstep(-0.35, 0.6, gnoise(vec2(x * 4.0 + 9.0, t * 0.03)) + 0.3 * gnoise(vec2(x * 13.0, t * 0.05 + 2.0)));
    float soft = uGlowP.x * (0.3 + 1.4 * (0.5 + 0.5 * gnoise(vec2(x * 8.0 + 2.0, t * 0.05))));
    float strand = 0.5 + 0.5 * gnoise(vec2(x * uGlowP.z + vH * 1.5, t * 0.06));
    float len = reach * (0.4 + 0.85 * strand);
    float r = rise - start;
    float prof = smoothstep(-soft, soft, r) * exp(-max(r, 0.0) * uGlowP.y / max(reach, 0.15));
    prof *= 1.0 - smoothstep(len * 0.5, len, r);
    float rays = 0.5 + 0.5 * gnoise(vec2(x * uGlowP.z * 1.7 + vH * 1.5, rise * 1.3 - t * 0.08));
    rays = mix(1.0, rays * 1.5, uGlowP.w);
    float patches = 0.18 + 0.82 * smoothstep(-0.45, 0.55, gnoise(vec2(x * 3.2 - t * 0.04, 7.0)));
    float edgeOn = pow(1.0 / max(abs(dot(n, v)), 0.1), 0.9);
    vec2 dp = (suv - uPointer) * vec2(uAspect, 1.0);
    float near = uPresence * exp(-dot(dp, dp) / 0.06);
    float I = prof * edgeOn * rays * patches * uGlowQ.x * (1.0 + uGlowQ.w * near + 3.0 * abs(vRing));
    // keep it to the sides (wide) or the top (tall), with a ragged inner edge
    float wob = 0.14 * gnoise(vec2(suv.y * 3.5, t * 0.05)) + 0.06 * gnoise(vec2(suv.y * 11.0, t * 0.08 + 3.0));
    float wide = smoothstep(0.22 + wob, 0.86 + wob, abs(suv.x - 0.5) * 2.0);
    float tall = smoothstep(0.48 + wob * 0.6, 0.85 + wob * 0.6, suv.y);
    I *= mix(1.0, mix(wide, tall, uGlowQ.z), uGlowQ.y);
    float hue = clamp(max(r, 0.0) / max(reach, 0.2) * 1.35 + u + 0.05 * sin(x * 9.0 + t * 0.07), 0.0, 1.0);
    outColor = vec4(ramp(hue) * I, 1.0);
    return;
  }

  float dist = length(uEye - vPos);
  if (uFogP.w > 0.0) {
    // fine ripples break a sun's glitter path into sparkles, fading out with distance
    float fine = 1.0 - smoothstep(4.0, 26.0, dist);
    vec2 rq = vPos.xz * 3.1 + vec2(uTime * 0.6, -uTime * 0.4);
    n = normalize(n + uFogP.w * fine * vec3(gnoise(rq), 0.0, gnoise(rq + 9.7)));
  }
  vec3 L = normalize(uSunDir);
  vec3 base = ramp(u);
  if (uFibre.x > 0.0) {
    // fine strands running along the surface, like the fibres of brushed silk
    float f = gnoise(vec2(vGrid.y * uFibre.y, vGrid.x * 2.0 + uTime * 0.02))
            + 0.6 * gnoise(vec2(vGrid.y * uFibre.y * 2.3 + 11.0, vGrid.x * 5.0 - uTime * 0.03));
    base = mix(base, base * (1.0 + 1.6 * f) + 0.18 * max(f, 0.0), uFibre.x);
  }
  float diff = dot(n, L) * 0.5 + 0.5;
  vec3 hv = normalize(L + v);
  float nh = max(dot(n, hv), 0.0);
  float spec = (pow(nh, 220.0) * 2.2 + pow(nh, 36.0) * 0.35) * uLit.w;
  float sheen = pow(nh, 7.0) * uLit.z;
  float fres = pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 col = base * (uLit.x + uLit.y * pow(diff, 1.4));
  col += uSun * (spec + sheen);
  col = mix(col, uSkyLow, fres * uFogP.z);
  col = mix(col, uHorizon, 1.0 - exp(-max(dist - uFogP.x, 0.0) * uFogP.y));
  col = shoulder(col);
  // with focus on, alpha carries how out of focus this point is: by its distance from the focal plane, and
  // (optionally) more toward one edge of the surface, so that edge melts away
  // (the surface never writes below 0.02, so the composite can tell it from the empty background, which writes 0)
  float coc = 1.0;
  if (uDof.x > 0.5) {
    coc = clamp(abs(dot(vPos - uEye, uFwd) - uDof.y) / uDof.z, 0.0, 1.0);
    coc = max(coc, uDof.w * (1.0 - smoothstep(0.0, 0.32, vGrid.y)));
    coc = 0.02 + 0.98 * coc;
  }
  outColor = vec4(toSRGB(col) + grain(gl_FragCoord.xy, uTime, uGrain), coc);
}`;

// stars and a treeline, shared by the sky and the glow composite
const SKYBITS = /* glsl */ `
uniform vec2 uCss;
uniform float uDpr;
float stars(vec2 uv, float t) {
  float cell = 7.0;
  vec2 g = uv * uCss / cell;
  vec2 id = floor(g), f = fract(g);
  float h = hash12(id);
  if (h > 0.075) return 0.0;
  vec2 c = 0.2 + 0.6 * hash22(id + 3.7);
  float px = 1.0 / (cell * uDpr);
  float size = mix(0.6, 1.5, pow(hash12(id + 9.1), 3.0)) / cell;
  float tw = 0.65 + 0.35 * sin(t * (0.6 + 2.2 * hash12(id + 1.3)) + h * 80.0);
  return (1.0 - smoothstep(size - px, size + px, length(f - c))) * tw * mix(0.25, 1.0, pow(hash12(id + 5.5), 2.0));
}
// rolling hills with two rows of pines, standing on the horizon line y0 (canvas uv)
float land(vec2 uv, float y0) {
  float x = uv.x * uCss.x;
  float y = (y0 + 0.012 + 0.025 * fbm3(vec2(uv.x * 2.2, 0.5)) + 0.01 * gnoise(vec2(uv.x * 9.0, 2.0))) * uCss.y;
  float best = y;
  for (int row = 0; row < 2; row++) {
    float w = row == 0 ? 19.0 : 12.0;
    float g = x / w + float(row) * 0.5;
    float id = floor(g), f = fract(g) - 0.5;
    for (int n = -1; n <= 1; n++) {
      float cid = id + float(n);
      float jit = (hash12(vec2(cid, float(row))) - 0.5) * 0.6;
      float th = (row == 0 ? 34.0 : 20.0) * mix(0.55, 1.35, hash12(vec2(cid, 7.0 + float(row))));
      if (hash12(vec2(cid, 3.0 + float(row))) < 0.2) th *= 0.35;
      float dx = abs((f - float(n) - jit) * w);
      best = max(best, y - 3.0 + th * max(0.0, 1.0 - dx / (th * 0.28)));
    }
  }
  return best / uCss.y;
}`;

const SKY = HEAD + NOISE + COLOR + SKYBITS + /* glsl */ `
uniform vec3 uSkyTop, uSkyMid, uSkyLow, uHorizon, uSun;
uniform float uTime, uGrain, uHorizonY, uAspect, uSunOn, uStars, uLinear, uClouds, uSkyAlpha;
uniform vec2 uSunUv;
void main() {
  vec2 uv = vUv;
  float y = (uv.y - uHorizonY) / max(1.0 - uHorizonY, 0.05);
  vec3 col = mix(uSkyLow, uSkyMid, smoothstep(0.0, 0.42, y));
  col = mix(col, uSkyTop, smoothstep(0.32, 1.0, y));
  col = mix(uHorizon, col, smoothstep(-0.02, 0.16, y));
  if (uSunOn > 0.5) {
    float r = length((uv - uSunUv) * vec2(uAspect, 1.0));
    col += uSun * (exp(-r * 9.0) * 0.5 + exp(-r * 2.6) * 0.2);
    col += uSun * (1.0 - smoothstep(0.022, 0.026, r)) * 1.1;
  }
  if (uClouds > 0.0) {
    float c = fbm3(vec2(uv.x * 2.4 + uTime * 0.004, y * 9.0));
    col += uSkyLow * smoothstep(0.05, 0.4, c) * 0.08 * uClouds * smoothstep(0.05, 0.45, y) * (1.0 - smoothstep(0.5, 0.9, y));
  }
  if (uStars > 0.0) col += stars(uv, uTime) * uStars * vec3(0.85, 0.9, 1.0) * smoothstep(0.02, 0.3, y);
  if (uLinear > 0.5) { outColor = vec4(col, 1.0); return; }
  col = shoulder(col);
  outColor = vec4(toSRGB(col) + grain(gl_FragCoord.xy, uTime, uGrain), uSkyAlpha);
}`;

const BLUR = HEAD + /* glsl */ `
uniform sampler2D uSource;
uniform vec2 uDir;
void main() {
  vec4 c = texture(uSource, vUv) * 0.2270270270;
  c += (texture(uSource, vUv + uDir * 1.3846153846) + texture(uSource, vUv - uDir * 1.3846153846)) * 0.3162162162;
  c += (texture(uSource, vUv + uDir * 3.2307692308) + texture(uSource, vUv - uDir * 3.2307692308)) * 0.0702702703;
  outColor = c;
}`;

// glow: sky + the sheet (sharp and blurred) + the treeline on top, then tone and grain
const COMPOSE = HEAD + NOISE + COLOR + SKYBITS + /* glsl */ `
uniform sampler2D uSky, uGlowA, uGlowB;
uniform vec3 uLand, uLandLit;
uniform float uTime, uGrain, uSharp, uSoft, uLandOn, uHorizonY;
void main() {
  vec3 col = texture(uSky, vUv).rgb;
  vec3 a = texture(uGlowA, vUv).rgb, b = texture(uGlowB, vUv).rgb;
  col += a * uSharp + b * uSoft;
  if (uLandOn > 0.5) {
    float l = land(vUv, uHorizonY);
    float px = 1.0 / uCss.y;
    float inLand = 1.0 - smoothstep(l - px, l + px, vUv.y);
    col = mix(col, uLand + uLandLit * (b * 0.05), inLand);
  }
  col = shoulder(col);
  outColor = vec4(toSRGB(col) + grain(gl_FragCoord.xy, uTime, uGrain), 1.0);
}`;

// focus: the sharp picture, a soft one and a softer one, mixed by how out of focus each pixel is. A pixel of the
// surface uses its own blur; a pixel of empty background (alpha 0) takes the blur that spills onto it from soft
// parts nearby, so out-of-focus parts get soft silhouettes while sharp parts keep crisp edges.
const FOCUS = HEAD + NOISE + COLOR + /* glsl */ `
uniform sampler2D uSharp, uSoft, uSofter;
uniform float uTime, uGrain;
void main() {
  vec4 a = texture(uSharp, vUv), b = texture(uSoft, vUv), c = texture(uSofter, vUv);
  float own = (a.a - 0.02) / 0.98;
  float spill = max(b.a, c.a) * 1.35;
  float coc = a.a < 0.01 ? spill : max(own, spill * 0.35);
  vec3 col = mix(a.rgb, b.rgb, smoothstep(0.04, 0.42, coc));
  col = mix(col, c.rgb, smoothstep(0.42, 0.92, coc));
  outColor = vec4(col + grain(gl_FragCoord.xy, uTime, uGrain * 0.6), 1.0);
}`;

// ——— small vector and matrix helpers (column-major, like GL) ———
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));
function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}

export function create(engine, base = {}) {
  const { gl } = engine;
  // a preset may carry overrides for tall (phone) screens, where a wide scene is cropped to its middle
  let o = base;
  const pick = () => { o = engine.aspect < 0.85 && base.tall ? { ...base, ...base.tall } : base; };
  pick();
  const shape = SHAPE[o.shape ?? "plane"];
  const glow = o.light === "glow";
  const col = { skyTop: "#150d38", skyMid: "#5a2d8f", skyLow: "#e0679a", horizon: "#ffa27d", sun: "#fff0d8", land: "#020409", ...o.sky };
  const ramp = rgbs(o.colors ?? ["#1b1142", "#4b2aa6", "#c33fae", "#ff6f6a", "#ffc58e"]);
  const skyProg = engine.program(SKY, undefined, "wave sky");
  const surfProg = engine.program(FS, VS, "wave surface");
  const focus = !glow && o.focus ? o.focus : null;
  const blurProg = glow || focus ? engine.program(BLUR, undefined, "wave blur") : null;
  const composeProg = glow ? engine.program(COMPOSE, undefined, "wave compose") : null;
  const focusProg = focus ? engine.program(FOCUS, undefined, "wave focus") : null;

  // the grid: COLS × ROWS vertices in 0…1, two triangles per cell
  const grid = new Float32Array(COLS * ROWS * 2);
  for (let j = 0, k = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) { grid[k++] = i / (COLS - 1); grid[k++] = j / (ROWS - 1); }
  const idx = new Uint16Array((COLS - 1) * (ROWS - 1) * 6);
  for (let j = 0, k = 0; j < ROWS - 1; j++) for (let i = 0; i < COLS - 1; i++) {
    const a = j * COLS + i, b = a + 1, d = a + COLS, e = d + 1;
    idx[k++] = a; idx[k++] = d; idx[k++] = b; idx[k++] = b; idx[k++] = d; idx[k++] = e;
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, grid, gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(surfProg.p, "aGrid");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  const skyU = {
    uSkyTop: rgb(col.skyTop), uSkyMid: rgb(col.skyMid), uSkyLow: rgb(col.skyLow), uHorizon: rgb(col.horizon), uSun: rgb(col.sun),
  };
  let fov, shapeA, shapeB;
  const settle = () => {
    pick();
    fov = ((o.fov ?? 38) * Math.PI) / 180;
    shapeA = o.shapeA ?? [1.6, 260, 1.0, 2.5];
    shapeB = o.shapeB ?? [0.25, 10, 70, 0];
  };
  settle();
  let press = [0, 0, o.pressRadius ?? 1.6, 0], ripple = [0, 0, 99, 0];
  let lean = [0, 0], sunLean = 0, viewProj, eye, fwd, right, upv, shift, sunUv = [0.5, -1];
  let skyT, glowA, glowB, glowT;
  let msaa, sharpT, softA, softB, softerA, softerB;

  // an antialiased framebuffer to draw the scene into before it is softened (canvas MSAA doesn't reach targets)
  function multisample(w, h) {
    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
    const fbo = gl.createFramebuffer(), color = gl.createRenderbuffer(), depth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, color);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, color);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, w, h, dispose() { gl.deleteFramebuffer(fbo); gl.deleteRenderbuffer(color); gl.deleteRenderbuffer(depth); } };
  }

  function size() {
    settle();
    if (focus) {
      [msaa, sharpT, softA, softB, softerA, softerB].forEach((t) => t?.dispose());
      const w = engine.width, h = engine.height;
      msaa = multisample(w, h);
      sharpT = engine.target(w, h, { type: "byte" });
      softA = engine.target(w / 2, h / 2, { type: "byte" });
      softB = engine.target(w / 2, h / 2, { type: "byte" });
      softerA = engine.target(w / 4, h / 4, { type: "byte" });
      softerB = engine.target(w / 4, h / 4, { type: "byte" });
    }
    if (!glow) return;
    [skyT, glowA, glowB, glowT].forEach((t) => t?.dispose());
    skyT = engine.target(engine.width, engine.height);
    glowA = engine.target(engine.width / 2, engine.height / 2);
    glowB = engine.target(engine.width / 2, engine.height / 2);
    glowT = engine.target(engine.width / 2, engine.height / 2);
  }
  size();

  // where the horizon sits for a level camera (a fraction of the height from the bottom), if the look wants one
  const horizonAt = () => (typeof o.horizon === "function" ? o.horizon(engine.aspect) : o.horizon);

  function camera() {
    const aspect = engine.aspect, f = 1 / Math.tan(fov / 2);
    const h = horizonAt();
    shift = h == null ? (o.shift ?? 0) : -(h * 2 - 1);
    const near = 0.05, far = 400, nf = 1 / (near - far);
    const proj = new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, shift, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
    eye = o.eye ?? [0, 1.9, 0];
    const target0 = o.target ?? [eye[0], eye[1], eye[2] - 1];
    // lean toward the pointer: turn the view a little, as if the head followed it
    const back0 = norm(sub(eye, target0));
    const r0 = norm(cross([0, 1, 0], back0)), u0 = cross(back0, r0);
    const dist = Math.hypot(...sub(target0, eye));
    const target = add(target0, add(scale(r0, lean[0] * dist), scale(u0, lean[1] * dist)));
    const back = norm(sub(eye, target));
    right = norm(cross([0, 1, 0], back));
    upv = cross(back, right);
    fwd = scale(back, -1);
    const view = new Float32Array([right[0], upv[0], back[0], 0, right[1], upv[1], back[1], 0, right[2], upv[2], back[2], 0, -dot(right, eye), -dot(upv, eye), -dot(back, eye), 1]);
    viewProj = mul(proj, view);
  }

  // the pointer's ray, from canvas uv, in world space
  function ray(px, py) {
    const th = Math.tan(fov / 2);
    return norm(add(fwd, add(scale(right, (px * 2 - 1) * th * engine.aspect), scale(upv, (py * 2 - 1 + shift) * th))));
  }
  // where it meets the shape's mean plane, as the two coordinates the shader measures on (or null)
  function onShape(px, py) {
    const d = ray(px, py);
    let p0, n;
    if (shape === 0) { p0 = [0, 0, 0]; n = [0, 1, 0]; }
    else if (shape === 1) { p0 = [0, 0, shapeA[3] - shapeB[0] * 0.6]; n = [0, 0, 1]; }
    else { p0 = [0, 0, 0]; n = [0, 0, 1]; }
    const den = dot(d, n);
    if (Math.abs(den) < 1e-4) return null;
    const t = dot(sub(p0, eye), n) / den;
    if (t <= 0) return null;
    const hit = add(eye, scale(d, t));
    return shape === 0 ? [hit[0], hit[2]] : [hit[0], hit[1]];
  }

  // a world point on the canvas (uv), or null when it's behind the camera
  function project(pw) {
    const c = [0, 1, 2, 3].map((r) => viewProj[r] * pw[0] + viewProj[4 + r] * pw[1] + viewProj[8 + r] * pw[2] + viewProj[12 + r]);
    return c[3] > 0 ? [(c[0] / c[3]) * 0.5 + 0.5, (c[1] / c[3]) * 0.5 + 0.5] : null;
  }
  function sun() {
    if (!o.sunDir) return [[0, 1, 0], [0.5, -1]];
    const a = sunLean, s = o.sunDir;
    const dir = [s[0] * Math.cos(a) - s[2] * Math.sin(a), s[1], s[0] * Math.sin(a) + s[2] * Math.cos(a)];
    return [dir, project(add(eye, scale(norm(dir), 300))) ?? [0.5, -1]];
  }
  // where eye level meets the sky, for the sky gradient and the treeline
  function horizonUv() {
    const h = horizonAt();
    if (h != null) return h;
    const flat = Math.hypot(fwd[0], fwd[2]) > 1e-4 ? norm([fwd[0], 0, fwd[2]]) : [0, 0, -1];
    const uv = project(add(eye, scale(flat, 1000)));
    return uv ? uv[1] : 0;
  }

  function drawSurface(target, uniforms) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, target ? target.w : engine.width, target ? target.h : engine.height);
    surfProg.use(uniforms);
    gl.bindVertexArray(vao);
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  return {
    maxDpr: o.maxDpr ?? 1.5,
    stillAt: o.stillAt ?? 7,
    resize: size,
    down(p) {
      const hit = onShape(p.x, p.y) ?? (shape === 0 ? onShape(p.x, Math.min(p.y, (horizonAt() ?? 0.5) - 0.08)) : null);
      if (hit) ripple = [hit[0], hit[1], 0, o.ripple ?? 1];
    },
    frame(dt, t0) {
      const p = engine.pointer;
      const t = t0 * (o.speed ?? 1);
      ripple[2] += dt;
      const lk = o.lean ?? 0.04;
      lean[0] = damp(lean[0], (p.sx - 0.5) * lk * p.presence, 2, dt);
      lean[1] = damp(lean[1], (p.sy - 0.5) * lk * 0.5 * p.presence, 2, dt);
      sunLean = damp(sunLean, (p.sx - 0.5) * (o.sunLean ?? 0) * p.presence, 1.5, dt);
      camera();
      const hit = onShape(p.sx, p.sy);
      if (hit) { press[0] = hit[0]; press[1] = hit[1]; }
      press[3] = damp(press[3], hit ? p.presence * (o.press ?? 0.4) : 0, 3, dt);
      const [sunDir, sUv] = sun();
      sunUv = sUv;
      const hy = horizonUv();
      const common = {
        uTime: t, uGrain: o.grain ?? 0.045, uAspect: engine.aspect, uCss: [engine.cssW, engine.cssH], uDpr: engine.dpr,
      };
      const surfaceU = {
        ...skyU, ...common, uViewProj: viewProj, uEye: eye, uSunDir: sunDir, uRamp: ramp,
        uAmp: o.amp ?? 1, uFreq: o.freq ?? 1, uWarp: o.warp ?? 1, uShape: shape, uShapeA: shapeA, uShapeB: shapeB,
        uPress: press, uRipple: ripple, uColorBy: o.colorBy ?? [0.6, 0.62, 0, 0.5],
        uLit: o.lit ?? [0.22, 1.05, 0.16, 1], uFogP: o.fog ?? [4, 0.03, 0.55, 0.16],
        uGlowP: o.glowShape ?? [0.08, 1.8, 90, 0.6], uGlowQ: [o.glowBright ?? 0.5, o.wings ? 1 : 0, engine.aspect < 0.85 ? 1 : 0, o.glowNear ?? 0.8],
        uGlow: glow ? 1 : 0, uPresence: p.presence, uPointer: [p.sx, p.sy], uFibre: o.fibre ?? [0, 0],
        uDof: focus && o.focus ? [1, o.focus.distance, o.focus.range, o.focus.edge ?? 0] : [0, 0, 1, 0], uFwd: fwd,
      };
      const skyUniforms = {
        ...skyU, ...common, uHorizonY: hy, uSunOn: o.sunDir ? 1 : 0, uSunUv: sunUv, uStars: o.stars ?? 0, uClouds: o.clouds ?? 0,
      };

      if (!glow && !focus) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, engine.width, engine.height);
        gl.clearDepth(1);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.disable(gl.DEPTH_TEST);
        engine.draw(skyProg, { ...skyUniforms, uLinear: 0, uSkyAlpha: 1 });
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LESS);
        drawSurface(null, { ...surfaceU, uRes: [engine.width, engine.height] });
        gl.disable(gl.DEPTH_TEST);
        return;
      }
      if (focus) {
        // focus: draw the scene antialiased, resolve it, blur it twice, then mix by how out of focus each pixel is
        gl.bindFramebuffer(gl.FRAMEBUFFER, msaa.fbo);
        gl.viewport(0, 0, msaa.w, msaa.h);
        gl.clearDepth(1);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.disable(gl.DEPTH_TEST);
        engine.draw(skyProg, { ...skyUniforms, uLinear: 0, uSkyAlpha: 0 }, msaa);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LESS);
        drawSurface(msaa, { ...surfaceU, uRes: [msaa.w, msaa.h] });
        gl.disable(gl.DEPTH_TEST);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msaa.fbo);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, sharpT.fbo);
        gl.blitFramebuffer(0, 0, msaa.w, msaa.h, 0, 0, sharpT.w, sharpT.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
        const r = o.focus?.blur ?? 2.4;
        engine.draw(blurProg, { uSource: sharpT, uDir: [r / softA.w, 0] }, softB);
        engine.draw(blurProg, { uSource: softB, uDir: [0, r / softA.h] }, softA);
        engine.draw(blurProg, { uSource: softA, uDir: [r / softerA.w, 0] }, softerB);
        engine.draw(blurProg, { uSource: softerB, uDir: [0, r / softerA.h] }, softerA);
        engine.draw(blurProg, { uSource: softerA, uDir: [(r * 1.8) / softerA.w, 0] }, softerB);
        engine.draw(blurProg, { uSource: softerB, uDir: [0, (r * 1.8) / softerA.h] }, softerA);
        engine.draw(focusProg, { uSharp: sharpT, uSoft: softA, uSofter: softerA, uTime: t, uGrain: o.grain ?? 0.04 });
        return;
      }
      // glow: sky into a target, the sheet added up at half size, blurred, then everything composed with the land on top
      engine.draw(skyProg, { ...skyUniforms, uLinear: 1, uSkyAlpha: 1 }, skyT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, glowA.fbo);
      gl.viewport(0, 0, glowA.w, glowA.h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      drawSurface(glowA, { ...surfaceU, uRes: [glowA.w, glowA.h] });
      gl.disable(gl.BLEND);
      // blur twice, the second time wider, for a soft halo round the curtain
      const s = o.glowBlur ?? 2.2, w = glowA.w, h = glowA.h;
      engine.draw(blurProg, { uSource: glowA, uDir: [s / w, 0] }, glowT);
      engine.draw(blurProg, { uSource: glowT, uDir: [0, s / h] }, glowB);
      engine.draw(blurProg, { uSource: glowB, uDir: [(s * 2.5) / w, 0] }, glowT);
      engine.draw(blurProg, { uSource: glowT, uDir: [0, (s * 2.5) / h] }, glowB);
      engine.draw(composeProg, {
        ...common, uSky: skyT, uGlowA: glowA, uGlowB: glowB, uLand: rgb(col.land), uLandLit: rgb(col.horizon),
        uSharp: o.glowSharp ?? 0.7, uSoft: o.glowSoft ?? 1.1, uLandOn: o.land ? 1 : 0, uHorizonY: hy,
      });
    },
  };
}
