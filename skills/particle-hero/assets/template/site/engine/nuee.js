// Nuée, the Particle Hero engine: pictures made of dust. Each picture (a cut-out plus its depth map) becomes a few hundred thousand grains,
// packed where the picture is bright or has edges and pushed back by its depth. A change of picture throws the grains
// out and gathers them into the next one; the pointer moves through them like a hand through smoke.
//
// The grains live in a GPU simulation (position, velocity and colour per grain, in float textures), so a push
// has momentum and settles back on its own, and a change can be interrupted at any moment. What doesn't need
// memory (breathing, the wind that blows grains off one side, the lights) is worked out per frame when drawing.
//
// Two ways to show them: light on a dark ground (grains add light), or ink on paper (grains add ink, and the
// paper shows through what's left, so colours mix like real ink).

const TAN = Math.tan((17 * Math.PI) / 180); // half the vertical field of view

// ---------------------------------------------------------------------------------------------------------------
// shaders

const HEAD = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uint hashu(uint x) { x ^= x >> 16; x *= 0x7feb352dU; x ^= x >> 15; x *= 0x846ca68bU; x ^= x >> 16; return x; }
float h01(uint x) { return float(hashu(x) >> 8) * 5.9604645e-8; }
// a slow, smooth air current; a sum of sines is enough at this scale and costs nothing
vec3 flow(vec3 q, float t) {
  return 0.5 * vec3(sin(q.y * 2.3 + t) + sin(q.z * 3.1 - t * 0.7 + q.x),
                    sin(q.x * 2.7 - t * 0.8) + sin(q.z * 2.9 + t * 0.6 + q.y),
                    sin(q.x * 3.3 + t * 0.5) + sin(q.y * 3.7 - t));
}
`;

const QUAD_VS = `#version 300 es
out vec2 vUv;
void main() { vec2 q = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0); vUv = q * 0.5 + 0.5; gl_Position = vec4(q, 0.0, 1.0); }`;

// one step of the simulation: every grain is one texel
const SIM_FS = HEAD + `
uniform sampler2D uP, uV, uC;              // the grains now: position (w: how far into its flight), velocity, colour
uniform sampler2D uAp, uAc, uBp, uBc;      // homes: the picture it's leaving (A) and the one it's going to (B)
uniform highp usampler2D uPA, uPB;         // which home each grain takes in each picture
uniform uint uMask, uWMask, uShift;
uniform float uT, uDt, uTime, uReset;      // uT: seconds since the change began
uniform vec4 uMove;                        // x travel (0 melt, 1 swarm), y seed, z how long the letting-go is spread over, w how long the gathering takes
uniform vec4 uMove2;                       // x kick, y how out of focus a grain arrives, z how much the air carries a grain in flight, w air drag
uniform vec3 uSpring;                      // stiffness at rest, damping ratio, stiffness while gathering
uniform float uRamp, uTrack;
uniform vec4 uOrder;                       // the front a change crosses the picture along (xyz), and how much each grain ignores it (w)                       // 0: the pull home builds late (a long cloud), 1: early (the next picture shows through sooner)
uniform mat4 uVP; uniform vec3 uRight, uUp, uFwd; uniform vec2 uProj; uniform float uAspect;
uniform vec4 uPtr;                         // the pointer's path this frame, in screen space: from xy to zw
uniform vec4 uPtrV;                        // xy its velocity (screen units a second), z how present it is, w its reach
uniform vec4 uHand;                        // x how strongly grains are taken along, y how much the wake spreads, z how much a still hand parts them, w how much they scatter in depth
layout(location = 0) out vec4 oP; layout(location = 1) out vec4 oV; layout(location = 2) out vec4 oC;
ivec2 cell(highp usampler2D perm, ivec2 px) { uint s = texelFetch(perm, px, 0).r; return ivec2(int(s & uWMask), int(s >> uShift)); }
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  uint i = uint(px.y) * (uWMask + 1u) + uint(px.x);
  ivec2 ca = cell(uPA, px), cb = cell(uPB, px);
  vec4 A = texelFetch(uAp, ca, 0), B = texelFetch(uBp, cb, 0);
  if (uReset > 0.5) { oP = vec4(B.xyz, 1.0); oV = vec4(0.0); oC = texelFetch(uBc, cb, 0); return; }
  vec4 P = texelFetch(uP, px, 0), V = texelFetch(uV, px, 0), C = texelFetch(uC, px, 0);
  uint sd = uint(uMove.y);
  float rd = h01(i * 2654435761u + sd);
  vec3 rv = vec3(h01(i ^ (sd * 3u + 11u)), h01(i * 7u + sd + 5u), h01(i * 13u + sd * 5u + 3u)) * 2.0 - 1.0;
  float r1 = h01(i * 3u + 17u), r2 = h01(i * 5u + 29u), r3 = h01(i * 11u + 71u);

  // when this grain lets go: a front crosses the picture (by default the near layers go first), each grain a little
  // early or late; a swarm is all jitter: anyone, any time
  float front = clamp(dot((A.xyz + B.xyz) * 0.5, uOrder.xyz) * 0.5 + 0.5, 0.0, 1.0);
  float delay = mix(front, rd, uOrder.w) * uMove.z;
  float local = uT - delay, e = clamp(local / uMove.w, 0.0, 1.0), es = e * e * (3.0 - 2.0 * e);
  bool gone = local > 0.0;
  vec3 home = gone ? B.xyz : A.xyz;
  vec4 hc = gone ? texelFetch(uBc, cb, 0) : texelFetch(uAc, ca, 0);

  vec3 p = P.xyz, v = V.xyz;
  // the throw: the moment it lets go, it is kicked outward and toward us; most go a little way, a few go far
  if (gone && local - uDt <= 0.0 && uMove2.x > 0.0) {
    float far = h01(i * 29u + sd * 7u + 1u); far = 0.12 + 0.88 * far * far;
    vec3 dir = normalize(vec3(A.xy * 0.9 + rv.xy * 0.85, 0.3 + 0.9 * abs(rv.z)));
    v += dir * uMove2.x * far;
  }
  // arriving grains come in out of focus and sharpen: the picture appears as a soft cloud of its own colours first
  // and on a schedule: the target slides from the old home to the new one, so far travellers arrive with the rest
  // (1: a melt, every grain on its own track; 0: a swarm, the grains find their own way home)
  vec3 path = gone ? mix(A.xyz, B.xyz, mix(1.0, es, uTrack)) : home;
  vec3 tgt = path + (gone ? rv * uMove2.y * (1.0 - es) * (1.0 - es) : vec3(0.0));
  // the pull home is weak at first (so the throw opens), then firm
  float k = gone && e < 1.0 ? uSpring.z * (0.02 + 0.98 * es * mix(es, 1.0, uRamp)) : uSpring.x;
  float c = 2.0 * uSpring.y * sqrt(k) + uMove2.w * (gone ? 1.0 - es : 0.0);
  vec3 acc = (tgt - p) * k - v * c;
  float hump = gone ? sin(3.14159265 * e) : 0.0;
  acc += flow(p * 1.7 + rv * 0.3, uTime * 0.7) * (uMove2.z * hump);

  // the hand: grains near the pointer's path are taken along with it, spread sideways a little, then let go
  vec4 cp = uVP * vec4(p, 1.0);
  float w = max(cp.w, 0.05);
  vec2 s = cp.xy / w, asp = vec2(uAspect, 1.0);
  vec2 ab = (uPtr.zw - uPtr.xy) * asp, as2 = (s - uPtr.xy) * asp;
  float h = clamp(dot(as2, ab) / max(dot(ab, ab), 1e-9), 0.0, 1.0);
  vec2 off = as2 - ab * h;
  float fall = exp(-dot(off, off) / (uPtrV.w * uPtrV.w)) * uPtrV.z;
  if (fall > 0.002) {
    vec2 pva = uPtrV.xy * asp;
    vec2 want = (pva * (0.5 + 0.9 * r1) + vec2(-pva.y, pva.x) * (r2 - 0.5) * uHand.y) / asp;
    vec2 rad = off / max(length(off), 1e-4) / asp;
    vec3 wv = uRight * (want.x * w / uProj.x) + uUp * (want.y * w / uProj.y);
    vec3 vp = uRight * dot(v, uRight) + uUp * dot(v, uUp);
    v += (wv - vp) * fall * min(1.0, uHand.x * uDt);
    v += (uRight * (rad.x * w / uProj.x) + uUp * (rad.y * w / uProj.y)) * fall * uHand.z * uDt;
    v += uFwd * (r3 - 0.5) * length(pva) * fall * uHand.w * uDt;
    acc += flow(p * 3.0 + rv, uTime * 1.3) * fall * min(1.0, length(pva)) * 0.6;
  }
  v += acc * uDt;
  p += v * uDt;
  // colour follows the grain home, a little behind
  vec4 cc = mix(C, hc, 1.0 - exp(-uDt * (gone ? 1.5 + 5.0 * es : 4.0)));
  oP = vec4(p, gone ? e : 1.0); oV = vec4(v, 0.0); oC = cc;
}`;

// drawing the grains (pass 0: grains, 1: haze around the lights, 2: streaks of grains in motion)
const PTS_VS = HEAD + `
uniform sampler2D uP, uV, uC;
uniform uint uWMask, uShift, uStride;
uniform mat4 uVP;
uniform float uTime, uDist, uSize, uMinPx, uGain, uAspect, uBreath, uPass, uTail, uInk, uMono, uSat, uFlightDim;
uniform vec3 uTint, uInkAbs;
uniform vec4 uLine;                        // the wind's edge: a point on it and the normal toward the side that blows away
uniform vec3 uWind;                        // which way and how hard
uniform vec4 uLamp[4]; uniform vec3 uLampCol[4];
uniform vec3 uHot;                         // the pointer as a light: screen xy, strength
uniform vec3 uHotCol;
uniform vec2 uScan;                        // a plane passing through the depth: where it is, how strong
out vec3 vCol;
vec3 drift(vec3 p, uint i, float t, out float alive, out float gone, out float home) {
  alive = 1.0; gone = 0.0; home = 1.0;
  if (uWind.z < 0.004) return p;
  float r1 = h01(i * 3u + 17u), r2 = h01(i * 5u + 29u), r3 = h01(i * 11u + 71u), r4 = h01(i * 17u + 113u), r5 = h01(i * 23u + 191u);
  // the edge wavers slowly, and every grain feels it a little early or late, so the picture frays rather than cuts
  float along = dot(p.xy - uLine.xy, vec2(-uLine.w, uLine.z));
  float ragged = 0.11 * sin(along * 3.1 + t * 0.13) + 0.06 * sin(along * 7.7 - t * 0.09 + 1.7) + (r5 - 0.5) * 0.34;
  float away = smoothstep(0.0, 1.15, dot(p.xy - uLine.xy, uLine.zw) + ragged);
  if (away <= 0.0) return p;
  // each grain lives a short life past the edge: it stays home, lets go, thins out on the wind, and forms again
  float per = 3.5 + 5.5 * r1, ph = fract(t / per + r2);
  float hold = mix(0.82, 0.06, away);
  gone = max(0.0, (ph - hold) / (1.0 - hold));
  float tr = gone * sqrt(gone), reach = uWind.z * 1.8 * away * (0.55 + 0.9 * r3);
  vec3 tb = flow(p * 1.7 + vec3(r4 * 7.0, r1 * 5.0, r3 * 3.0), t * 0.3 + ph * 2.5);
  p.xy += uWind.xy * reach * tr;
  p += tb * tr * reach * 0.3;
  p.z += (r4 - 0.5) * tr * reach * 0.6;
  alive = mix(1.0, smoothstep(0.0, 0.07, ph) * (1.0 - smoothstep(0.3, 1.0, gone)), smoothstep(0.0, 0.3, away));
  // the grains still home stand in for the ones away, so the fraying side keeps its brightness and only thins far out
  home = (1.0 + 0.6 * away * (1.0 - away) * (1.0 - min(1.0, gone * 6.0))) * (1.0 - 0.55 * away * away);
  return p;
}
void main() {
  bool streak = uPass > 1.5;
  uint vid = uint(gl_VertexID);
  uint i = (streak ? vid >> 1 : vid) * uStride;
  float tail = streak ? float(vid & 1u) : 0.0;
  ivec2 c2 = ivec2(int(i & uWMask), int(i >> uShift));
  vec4 P = texelFetch(uP, c2, 0), C = texelFetch(uC, c2, 0);
  vec3 p = P.xyz, col = C.rgb;
  float r1 = h01(i * 3u + 17u), r3 = h01(i * 11u + 71u);
  float air = P.w < 1.0 ? sin(3.14159265 * P.w) : 0.0;
  if (streak) p -= texelFetch(uV, c2, 0).xyz * uTail * tail;

  // breathing: the whole picture, shallow and slow
  p.xy *= 1.0 + 0.011 * uBreath;
  p.z = p.z * (1.0 + 0.1 * uBreath) + 0.014 * uBreath;
  float alive, gone, home;
  p = drift(p, i, uTime - tail * 0.18, alive, gone, home);

  float near = clamp(p.z + 0.5, 0.0, 1.0);
  float lit = 0.0; vec3 lcol = vec3(0.0);
  for (int k = 0; k < 4; k++) { vec3 d = p - uLamp[k].xyz; float l = uLamp[k].w / (1.0 + dot(d, d) * 3.2); lit += l; lcol += uLampCol[k] * l; }
  vec4 cp = uVP * vec4(p, 1.0);
  vec2 sp = cp.xy / max(cp.w, 0.05);
  { vec2 d = (sp - uHot.xy) * vec2(uAspect, 1.0); float l = uHot.z * exp(-dot(d, d) * 14.0); lit += l; lcol += uHotCol * l; }
  lcol /= max(lit, 1e-4);
  float band = uScan.y * exp(-pow((p.z - uScan.x) / 0.025, 2.0));

  float sz = uSize * (0.6 + 0.9 * r3) * uDist / max(cp.w, 0.05) * (1.0 - 0.45 * gone) * (1.0 + 0.5 * min(1.0, lit) + 0.8 * band);
  float fade = min(1.0, sz / uMinPx), base = uGain * fade * fade * alive * home;
  float g = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 c;
  if (uInk < 0.5) {             // light on dark: col is the light a grain gives
    col = mix(vec3(g), col, uSat);
    col = mix(col, g * uTint, uMono);
    c = col * base * mix(0.5, 1.15, near) * (1.0 - uFlightDim * air);
    if (uPass < 0.5 || streak) c += mix(col, lcol, 0.8) * base * lit * 2.4 + mix(col, vec3(1.0), 0.6) * base * band * 2.2;
    else { sz *= 7.0; c = lcol * base * lit * 0.08; }   // the haze: a few grains drawn wide and faint, so light hangs in the dust
  } else {                      // ink on paper: col is how a grain's ink takes each colour away (1: all of it)
    vec3 ink = mix(col, uInkAbs, uMono);
    c = ink * base * mix(0.65, 1.15, near) * (1.0 - 0.3 * air) * (1.0 + 1.6 * band);
    if (uPass > 0.5 && !streak) c = vec3(0.0);
  }
  if (streak) c *= (1.0 - tail) * 0.8;
  gl_PointSize = max(sz, uMinPx);
  gl_Position = cp;
  vCol = c;
}`;

const PTS_FS = `#version 300 es
precision highp float;
in vec3 vCol; uniform float uPass, uDisc; out vec4 o;
void main() {
  float r = length(gl_PointCoord * 2.0 - 1.0);
  float a = uPass > 1.5 ? 1.0 : uDisc > 0.5 ? smoothstep(1.0, 0.82, r) : smoothstep(1.0, 0.25, r);
  o = vec4(vCol * a, 1.0);
}`;

// the frame: light is tone-mapped over the ground; ink takes colour from the paper
const OUT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uAcc;
uniform vec3 uBg; uniform float uInk, uExposure, uGrain, uVig, uTime, uAspect, uClear, uInkCap;
uniform vec4 uCore[4]; uniform vec3 uCoreCol[4];
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec3 a = texture(uAcc, vUv).rgb;
  vec2 q = vUv * 2.0 - 1.0;
  float vig = 1.0 - uVig * dot(q * vec2(0.85, 1.0), q * vec2(0.85, 1.0)) * 0.5;
  float n = hash(gl_FragCoord.xy + fract(uTime * 7.3) * 91.0) - 0.5;
  vec3 col;
  if (uInk < 0.5) {
    vec3 L = a * uExposure;
    for (int k = 0; k < 4; k++) { vec2 d = (q - uCore[k].xy) * vec2(uAspect, 1.0); float r2 = dot(d, d) / (uCore[k].w * uCore[k].w);
      L += uCoreCol[k] * uCore[k].z * (0.5 * exp(-r2 * 2.5) + 0.14 * exp(-sqrt(r2) * 1.5)); }
    vec3 t = 1.0 - exp(-L);
    t = mix(t, vec3(max(t.r, max(t.g, t.b))), smoothstep(0.75, 1.0, max(t.r, max(t.g, t.b))) * 0.35);   // the brightest go toward white, like film
    col = uBg * vig + t * mix(1.0, vig, 0.5);
    if (uClear > 0.5) {         // see-through: the page shows wherever there is no light, and light covers it where there is
      float a = clamp(max(t.r, max(t.g, t.b)) * 1.6, 0.0, 1.0);
      o = vec4(t * mix(1.0, vig, 0.5) + n * uGrain * a, a);
      return;
    }
  } else {
    // paper: a faint tooth, then the ink takes colour away
    float fib = vnoise(gl_FragCoord.xy * vec2(0.9, 0.12)) * 0.5 + vnoise(gl_FragCoord.xy * 0.35) * 0.5;
    vec3 paper = uBg * (0.985 + 0.03 * fib) * vig;
    // one ink printed over itself stops at its own colour (a cap of 3.22 = exactly the ink), so piles don't go muddy
    vec3 d = a * uExposure;
    float m = max(d.r, max(d.g, d.b));
    if (m > uInkCap) d *= uInkCap / m;
    col = paper * exp(-d);
  }
  col += n * uGrain;
  o = vec4(col, 1.0);
}`;

// ---------------------------------------------------------------------------------------------------------------
// GL helpers

function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + "\n" + src.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n"));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let k = 0; k < n; k++) {
    const info = gl.getActiveUniform(p, k);
    u[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

function texture(gl, w, h, internal, format, type, data, filter = gl.NEAREST) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data ?? null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

const hex = (h) => { const n = parseInt(h.replace("#", ""), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// pixel order along a Hilbert curve, so grains with neighbouring numbers sit near each other in every picture:
// a melt then moves each grain only a short way
const hilbertCache = new Map();
function hilbert(R) {
  if (hilbertCache.has(R)) return hilbertCache.get(R);
  const order = new Uint32Array(R * R);
  for (let d = 0; d < R * R; d++) {
    let t = d, x = 0, y = 0;
    for (let s = 1; s < R; s <<= 1) {
      const rx = 1 & (t >> 1), ry = 1 & (t ^ rx);
      if (ry === 0) {
        if (rx === 1) { x = s - 1 - x; y = s - 1 - y; }
        const tmp = x; x = y; y = tmp;
      }
      x += s * rx; y += s * ry; t >>= 2;
    }
    order[d] = y * R + x;
  }
  hilbertCache.set(R, order);
  return order;
}

// ---------------------------------------------------------------------------------------------------------------
// pictures → grains

// (the load event, not img.decode(): decode never settles while the page is in a background tab)
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

// Lays a picture (and its depth map) into an R×R square, and deals N grains over it: more where it's bright (or, on
// paper, dark), more on edges and the outline, a little everywhere on the subject, and more on what's near.
// Returns grain homes (x, y in -1..1, z the depth), their colours, and a few strong points for trackers.
export function buildForm(img, depthImg, { N, R = 1024, ink = false, relief = 0.8, fill = 1, seed = 7, outline = 0.3, fade = 0, levels = null } = {}) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = R;
  const g = cv.getContext("2d", { willReadFrequently: true });
  // the subject's own outline (from the cut-out), so every subject fills its place the same way
  const crop = bounds(img);
  const k = (Math.min(R / crop.w, R / crop.h)) * fill;
  const iw = Math.round(crop.w * k), ih = Math.round(crop.h * k);
  const ox = Math.round((R - iw) / 2), oy = Math.round((R - ih) / 2);
  const draw = (im) => g.drawImage(im, crop.x * (im.width / img.width), crop.y * (im.height / img.height), crop.w * (im.width / img.width), crop.h * (im.height / img.height), ox, oy, iw, ih);
  g.clearRect(0, 0, R, R);
  draw(img);
  const rgba = g.getImageData(0, 0, R, R).data;
  g.clearRect(0, 0, R, R);
  g.fillStyle = "#000";
  g.fillRect(0, 0, R, R);
  if (depthImg) draw(depthImg);
  const dep = g.getImageData(0, 0, R, R).data;

  const RR = R * R;
  const lum = new Float32Array(RR), alpha = new Float32Array(RR), near = new Float32Array(RR), wgt = new Float32Array(RR);
  const tone = new Float32Array(RR); // brightness on dark, darkness on paper
  const samples = [];
  for (let i = 0; i < RR; i++) {
    const a = rgba[4 * i + 3] / 255;
    alpha[i] = a;
    let r = rgba[4 * i] / 255, gg = rgba[4 * i + 1] / 255, b = rgba[4 * i + 2] / 255;
    if (ink) { r = r * a + 1 - a; gg = gg * a + 1 - a; b = b * a + 1 - a; } else { r *= a; gg *= a; b *= a; }
    lum[i] = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    tone[i] = ink ? Math.min(1, -Math.log(Math.max(0.04, Math.min(r, gg, b))) / 3.219) : lum[i];
    if (a > 0.5 && (i & 15) === 0) samples.push(dep[4 * i]);
  }
  // depth, stretched over the subject only
  samples.sort((x, y) => x - y);
  const lo = samples.length ? samples[Math.floor(samples.length * 0.02)] : 0;
  const hi = samples.length ? samples[Math.floor(samples.length * 0.98)] : 255;
  for (let i = 0; i < RR; i++) near[i] = clamp((dep[4 * i] - lo) / Math.max(1, hi - lo), 0, 1);
  // levels: stretch the subject's own tones from its lightest to its darkest, then bend the middle (gamma > 1 keeps
  // mid-tones light), so a picture that is all dark (black leather) still shows its seams and highlights
  if (levels) {
    const ts = [];
    for (let i = 0; i < RR; i += 7) if (alpha[i] > 0.5) ts.push(tone[i]);
    ts.sort((x, y) => x - y);
    const t0 = ts.length ? ts[Math.floor(ts.length * (levels.lo ?? 0.03))] : 0;
    const t1 = ts.length ? ts[Math.floor(ts.length * (levels.hi ?? 0.97))] : 1;
    const gam = levels.gamma ?? 1;
    for (let i = 0; i < RR; i++) tone[i] = Math.pow(clamp((tone[i] - t0) / Math.max(1e-3, t1 - t0), 0, 1), gam);
  }

  let total = 0;
  const edge = new Float32Array(RR);
  for (let y = 1; y < R - 1; y++) {
    for (let x = 1; x < R - 1; x++) {
      const i = y * R + x;
      if (alpha[i] < 0.03) continue;
      const L = levels ? tone : lum;    // with levels, edges are read from the stretched tones too
      const ex = L[i + 1] - L[i - 1], ey = L[i + R] - L[i - R];
      const e = Math.min(1, 3.5 * Math.hypot(ex, ey));
      const ea = Math.min(1, 1.5 * Math.hypot(alpha[i + 1] - alpha[i - 1], alpha[i + R] - alpha[i - R]));
      const t = tone[i];
      edge[i] = e;
      // a picture cut off at the bottom (a portrait) thins out toward its lower edge instead of ending on a line
      const low = fade > 0 ? Math.min(1, Math.max(0, (oy + ih - y) / (fade * ih))) : 1;
      const w = ((ink ? 0.07 : 0.03) * alpha[i] + 0.85 * Math.pow(t, ink ? 0.95 : 1.2) + 0.5 * e * (0.25 + t) + (fade > 0 ? 0 : outline * ea)) * (0.4 + 0.6 * near[i]) * low * low * (3 - 2 * low);
      wgt[i] = w;
      total += w;
    }
  }

  const pos = new Float32Array(4 * N), col = new Uint8Array(4 * N);
  const order = hilbert(R), rand = rng(seed);
  const step = total / N;
  let next = rand() * step, acc = 0, n = 0, last = 0;
  const emit = (i) => {
    const x = i % R, y = (i / R) | 0, o = 4 * n;
    pos[o] = ((x + rand()) / R) * 2 - 1;
    pos[o + 1] = 1 - ((y + rand()) / R) * 2;
    pos[o + 2] = (near[i] - 0.5 + 0.014 * (rand() - 0.5)) * relief;
    pos[o + 3] = 1;
    const a = alpha[i];
    let r = rgba[4 * i] / 255, gg = rgba[4 * i + 1] / 255, b = rgba[4 * i + 2] / 255;
    if (ink) {
      // how this ink takes away each colour, relative to its strongest: a red ink takes green and blue, leaves red
      r = r * a + 1 - a; gg = gg * a + 1 - a; b = b * a + 1 - a;
      const lg = Math.log(Math.max(0.04, Math.min(r, gg, b)));
      const ch = [r, gg, b].map((c) => (lg > -0.03 ? 0.7 : Math.min(1, Math.log(Math.max(0.04, c)) / lg)));
      col[o] = 255 * ch[0]; col[o + 1] = 255 * ch[1]; col[o + 2] = 255 * ch[2];
    } else {
      // dim places get fewer grains, so each one carries its colour nearer full strength
      r *= a; gg *= a; b *= a;
      const m = Math.max(r, gg, b, 1 / 255), t = lum[i];
      const boost = 1 + 0.85 * (Math.min(1 / (0.1 + 0.9 * t), 1 / m) - 1);
      col[o] = Math.min(255, 255 * r * boost); col[o + 1] = Math.min(255, 255 * gg * boost); col[o + 2] = Math.min(255, 255 * b * boost);
    }
    col[o + 3] = 255;
    n++;
  };
  for (let d = 0; d < RR && n < N; d++) {
    const i = order[d], w = wgt[i];
    if (w <= 0) continue;
    acc += w;
    last = i;
    while (acc > next && n < N) { emit(i); next += step; }
  }
  while (n < N) emit(last);

  // trackers: the strongest point in each cell of a grid, then a spread-out few of them
  const G = 24, feats = [], cand = [];
  for (let gy = 1; gy < G - 1; gy++) for (let gx = 1; gx < G - 1; gx++) {
    let best = 0, bi = -1;
    for (let y = Math.floor((gy * R) / G); y < Math.floor(((gy + 1) * R) / G); y += 2)
      for (let x = Math.floor((gx * R) / G); x < Math.floor(((gx + 1) * R) / G); x += 2) {
        const i = y * R + x;
        if (alpha[i] < 0.5) continue;
        const v = edge[i] * (0.3 + tone[i]) + 0.35 * tone[i] * tone[i];
        if (v > best) { best = v; bi = i; }
      }
    if (bi >= 0) cand.push({ i: bi, v: best * (0.5 + near[bi]) });
  }
  cand.sort((a, b) => b.v - a.v);
  for (const [gap, max] of [[0.5, 8], [0.2, 36]]) {
    for (const c of cand) {
      if (feats.length >= max) break;
      const x = ((c.i % R) + 0.5) / R * 2 - 1, y = 1 - (((c.i / R) | 0) + 0.5) / R * 2;
      if (feats.every((f) => Math.hypot(f.x - x, f.y - y) > gap)) feats.push({ x, y, z: (near[c.i] - 0.5) * relief });
    }
  }
  return { pos, col, feats, aspect: iw / ih };
}

// the box round what's opaque in a picture, with a small margin (the whole picture if it has no alpha)
function bounds(img) {
  const S = 256, c = document.createElement("canvas");
  const k = S / Math.max(img.width, img.height);
  c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (d[4 * (y * c.width + x) + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  if (x1 < 0) return { x: 0, y: 0, w: img.width, h: img.height };
  const m = 0.03 * Math.max(x1 - x0, y1 - y0);
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(c.width, x1 + 1 + m); y1 = Math.min(c.height, y1 + 1 + m);
  return { x: x0 / k, y: y0 / k, w: (x1 - x0) / k, h: (y1 - y0) / k };
}

// ---------------------------------------------------------------------------------------------------------------
// the engine

const DEFAULTS = {
  count: 0,                 // grains (a power of two); 0 picks by screen
  ink: false,               // false: light on dark. true: ink on paper
  background: "#050506",    // the ground, or the paper
  exposure: 1,
  mono: 0,                  // 0 the picture's own colours, 1 all one colour
  tint: "#ffffff",          // that colour, on dark
  inkColor: "#111111",      // that colour, on paper
  saturation: 1,
  flightDim: 0.35,          // grains in flight give less light (a dense cloud would otherwise burn to white)
  size: 1,                  // grain size
  disc: false,              // hard round dots (print) instead of soft grains
  relief: 0.8,
  wind: { amount: 0, angle: 0, x: 0, y: 0 },   // the drift: how hard, which way it blows (radians), where the edge is
  breath: 0.5,
  sway: 1,                  // the camera's own slow drift
  parallax: 1,              // how much the camera follows the pointer
  travel: "swarm",          // swarm | melt
  spread: 0.55, gather: 1.3, kick: 2.0, blur: 0.12, air: 0.7, drag: 1.6, ramp: 0.6,
  track: 0.35,              // in a swarm, how much grains keep to a schedule (a melt always does)
  order: null,              // { dir: [x, y, z], jitter }: the front a change crosses the picture along (default: near first)
  matchIters: 32,           // passes when pairing grains for a melt (more: shorter, cleaner moves; slower to work out)
  spring: [14, 0.95, 34],    // at rest (how a push settles), damping ratio, while gathering
  hand: { reach: 0.13, drag: 9, spread: 1.3, still: 0.06, depth: 0.6, strength: 1 },
  lamps: [],                // [{ color, x, y, z, power }] lights in the dust; set .power per frame from the page
  hot: null,                // the pointer as a light: a colour, or null
  hotPower: 0.6,
  streaks: false,
  scan: false,              // a plane sweeping through the depth
  grain: 0.012, vignette: 0.6,
  frame: (w, h) => ({ cx: w / 2, cy: h / 2, s: Math.min(w, h) * 0.42 }), // where the picture sits: centre and half-height in CSS px
  fixedDt: 0,               // a fixed time step (for recording)
  transparent: false,       // light on dark only: let the page show through where there is no dust (to put type behind it)
  levels: null,             // { lo, hi, gamma }: stretch each picture's tones before dealing grains (see buildForm)
  inkCap: 99,               // on paper: the darkest the ink can pile up (3.22 = the ink's own colour; lower = lighter still)
};

export class Nuee {
  constructor(canvas, options = {}) {
    this.o = { ...DEFAULTS, ...options, hand: { ...DEFAULTS.hand, ...(options.hand || {}) }, wind: { ...DEFAULTS.wind, ...(options.wind || {}) } };
    this.canvas = canvas;
    const gl = (this.gl = canvas.getContext("webgl2", { antialias: false, alpha: !!this.o.transparent, premultipliedAlpha: true, powerPreference: "high-performance", preserveDrawingBuffer: !!this.o.fixedDt }));
    if (!gl) throw new Error("WebGL2 is not available");
    if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("float render targets are not available");
    const small = Math.min(innerWidth, innerHeight) < 700 || innerWidth < 760;
    const N = this.o.count || (small ? 1 << 17 : 1 << 19);
    this.N = N;
    this.tw = 1024;
    this.th = N / this.tw;
    this.shift = Math.round(Math.log2(this.tw));
    this.R = small ? 512 : 1024;

    this.sim = program(gl, QUAD_VS, SIM_FS);
    this.pts = program(gl, PTS_VS, PTS_FS);
    this.out = program(gl, QUAD_VS, OUT_FS);
    this.vao = gl.createVertexArray();

    // two sets of state, read one and write the other
    this.state = [0, 1].map(() => {
      const t = [0, 1, 2].map(() => texture(gl, this.tw, this.th, gl.RGBA32F, gl.RGBA, gl.FLOAT));
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      t.forEach((tex, k) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + k, gl.TEXTURE_2D, tex, 0));
      return { t, fb };
    });
    this.ping = 0;
    this.forms = [];
    this.A = null; this.B = null;       // { form, perm: Uint32Array, grain -> home }
    this.permTex = [0, 1].map(() => texture(gl, this.tw, this.th, gl.R32UI, gl.RED_INTEGER, gl.UNSIGNED_INT));
    this.matches = new Map();           // "a>b" -> Uint32Array: home in a -> home in b
    this.pending = new Map();
    this.t0 = 0; this.move = [1, 1, 0.7, 1.5]; this.move2 = [1, 0.2, 0.5, 1.6]; this.track = 0; this.order = [0, 0, -1, 1];
    this.time = 0;
    this.reset = true;
    this.ptr = { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, on: 0, inside: false, seen: false, lastMove: -1 };
    this.cam = { yaw: 0, pitch: 0, tyaw: 0, tpitch: 0 };
    this.lampState = this.o.lamps.map((l) => ({ ...l, power: l.power ?? 0 }));
    this.hotPower = 0;
    this.listeners = [];
    this._bindPointer();
    this.resize();
    addEventListener("resize", () => this.resize());
  }

  _bindPointer() {
    const set = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.ptr.y = 1 - ((e.clientY - r.top) / r.height) * 2;
      this.ptr.inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!this.ptr.seen) { this.ptr.px = this.ptr.x; this.ptr.py = this.ptr.y; this.ptr.seen = true; }
      this.ptr.lastMove = this.time;
    };
    addEventListener("pointermove", set, { passive: true });
    addEventListener("pointerdown", set, { passive: true });
    document.addEventListener("pointerleave", () => { this.ptr.inside = false; });
    addEventListener("blur", () => { this.ptr.inside = false; });
  }

  // a scripted pointer, for recordings: x, y in screen units (-1..1), or null to let go
  setPointer(x, y) {
    if (x === null) { this.ptr.inside = false; return; }
    if (!this.ptr.seen) { this.ptr.px = x; this.ptr.py = y; this.ptr.seen = true; }
    this.ptr.x = x; this.ptr.y = y; this.ptr.inside = true; this.ptr.lastMove = this.time;
  }

  resize() {
    const gl = this.gl;
    const r = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(1, r.width); this.cssH = Math.max(1, r.height);
    // sharp on a retina screen, but no more than about 3 million pixels to fill
    const dpr = Math.min(devicePixelRatio || 1, 2, Math.max(1, Math.sqrt(3.2e6 / (this.cssW * this.cssH))));
    this.dpr = dpr;
    const W = Math.round(this.cssW * dpr), H = Math.round(this.cssH * dpr);
    if (W === this.W && H === this.H) return;
    this.W = this.canvas.width = W;
    this.H = this.canvas.height = H;
    if (this.acc) { gl.deleteTexture(this.acc); gl.deleteFramebuffer(this.accFb); }
    this.acc = texture(gl, W, H, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, null, gl.LINEAR);
    this.accFb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.accFb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.acc, 0);
  }

  // adds a picture; resolves to its index
  async addPicture(src, depthSrc, opts = {}) {
    const [img, dep] = await Promise.all([loadImage(src), depthSrc ? loadImage(depthSrc) : null]);
    const f = buildForm(img, dep, { N: this.N, R: this.R, ink: this.o.ink, relief: opts.relief ?? this.o.relief, fill: opts.fill ?? 1, seed: 7 + this.forms.length, outline: opts.outline ?? 0.3, fade: opts.fade ?? 0, levels: opts.levels ?? this.o.levels });
    return this.addForm(f, opts);
  }

  addForm(f, opts = {}) {
    const gl = this.gl;
    const form = {
      pos: texture(gl, this.tw, this.th, gl.RGBA32F, gl.RGBA, gl.FLOAT, f.pos),
      col: texture(gl, this.tw, this.th, gl.RGBA32F, gl.RGBA, gl.FLOAT, Float32Array.from(f.col, (v) => v / 255)),
      feats: f.feats, aspect: f.aspect, ...opts,
    };
    form.index = this.forms.push(form) - 1;
    form.homes = f.pos;   // kept for pairing grains between pictures
    if (!this.B) {
      const id = new Uint32Array(this.N);
      for (let i = 0; i < this.N; i++) id[i] = i;
      this.A = this.B = { form, perm: id };
      this._uploadPerms();
      this.reset = true; this.t0 = this.time - 100;
    }
    return form.index;
  }

  get current() { return this.B ? this.B.form.index : -1; }

  // how far the change into the current picture has gone (0..1, by its gathering)
  get progress() { return clamp((this.time - this.t0) / (this.move[2] + this.move[3]), 0, 1); }

  show(index, opts = {}) {
    const form = this.forms[index];
    if (!form || !this.B) return;
    const travel = opts.travel ?? form.travel ?? this.o.travel;
    // a melt needs its pairing (worked out in the background); until it's ready, this change is a gentle swarm instead
    // of a blocky melt
    const pairing = travel === "melt" ? this.matches.get(`${this.B.form.index}>${index}`) : null;
    if (travel === "melt" && !pairing) { this.prepare(this.B.form.index, index); opts = { ...opts, kick: (opts.kick ?? this.o.kick) * 0.35 }; }
    const swarm = travel === "swarm" || !pairing;
    // which home each grain takes: in a swarm, any home at all; in a melt, the one its present home is paired with
    const old = this.B.perm, perm = new Uint32Array(this.N), mask = this.N - 1;
    if (swarm) {
      const a = ((Math.random() * 4294967296) >>> 0) | 1, b = (Math.random() * 4294967296) >>> 0;
      for (let i = 0; i < this.N; i++) perm[i] = (Math.imul(old[i], a) + b) & mask;
    } else {
      for (let i = 0; i < this.N; i++) perm[i] = pairing[old[i]];
    }
    this.A = this.B;
    this.B = { form, perm };
    this._uploadPerms();
    this.t0 = this.time;
    const o = { ...this.o, ...opts };
    this.move = [swarm ? 1 : 0, 1 + Math.floor(Math.random() * 60000), o.spread, o.gather];
    this.move2 = [swarm ? o.kick : o.kick * 0.15, o.blur * (swarm ? 1 : 0.5), o.air, o.drag];
    this.track = swarm ? o.track : 1;
    const ord = o.order || {};
    const dir = ord.dir || [0, 0, -1];
    this.order = [dir[0], dir[1], dir[2], ord.jitter ?? (swarm ? 1 : 0.4)];
    this.listeners.forEach((fn) => fn("show", index));
  }

  _uploadPerms() {
    const gl = this.gl;
    [this.A.perm, this.B.perm].forEach((p, k) => {
      gl.bindTexture(gl.TEXTURE_2D, this.permTex[k]);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.tw, this.th, gl.RED_INTEGER, gl.UNSIGNED_INT, p);
    });
  }

  // works out (in a worker) how the grains of picture a pair with those of picture b, for a melt between them
  prepare(a, b) {
    const key = `${a}>${b}`;
    if (this.matches.has(key)) return Promise.resolve(this.matches.get(key));
    if (this.pending.has(key)) return this.pending.get(key);
    if (!this.worker) {
      this.worker = new Worker(new URL("./match-worker.js", import.meta.url));
      this.jobs = new Map();
      this.worker.onmessage = (e) => { const j = this.jobs.get(e.data.id); this.jobs.delete(e.data.id); j && j(e.data.map); };
    }
    const id = Math.random().toString(36).slice(2);
    const p = new Promise((res) => this.jobs.set(id, res)).then((map) => { this.matches.set(key, map); this.pending.delete(key); return map; });
    this.pending.set(key, p);
    this.worker.postMessage({ id, a: this.forms[a].homes, b: this.forms[b].homes, n: this.N, iters: this.o.matchIters });
    return p;
  }

  on(fn) { this.listeners.push(fn); }

  // the camera for this frame: a view-projection matrix with the picture shifted to its frame
  _camera() {
    const W = this.cssW, H = this.cssH;
    const f = this.o.frame(W, H);
    const D = H / (2 * f.s * TAN);
    const t = this.time, sw = this.o.sway;
    const yaw = this.cam.yaw + 0.16 * sw * Math.sin(0.23 * t);
    const pitch = this.cam.pitch + 0.05 * sw * Math.sin(0.17 * t + 1);
    const cy = Math.cos(pitch), sy = Math.sin(pitch);
    const eye = [D * cy * Math.sin(yaw), D * sy, D * cy * Math.cos(yaw)];
    const fwd = eye.map((v) => -v / D);
    let right = [-fwd[2], 0, fwd[0]];
    const rl = Math.hypot(...right) || 1;
    right = right.map((v) => v / rl);
    const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
    const aspect = W / H, near = Math.max(0.01, D * 0.05), far = D * 6 + 20;
    const P00 = 1 / (TAN * aspect), P11 = 1 / TAN;
    const ox = (f.cx / W) * 2 - 1, oy = 1 - (f.cy / H) * 2;   // the lens shift that puts the picture at its frame
    // view matrix (column-major), rows: right, up, -fwd
    const view = [
      right[0], up[0], -fwd[0], 0,
      right[1], up[1], -fwd[1], 0,
      right[2], up[2], -fwd[2], 0,
      -(right[0] * eye[0] + right[1] * eye[1] + right[2] * eye[2]),
      -(up[0] * eye[0] + up[1] * eye[1] + up[2] * eye[2]),
      fwd[0] * eye[0] + fwd[1] * eye[1] + fwd[2] * eye[2], 1,
    ];
    const A = (far + near) / (near - far), B = (2 * far * near) / (near - far);
    // projection with lens shift: clip.x = P00 x - ox z, clip.y = P11 y - oy z, clip.w = -z
    const proj = [P00, 0, 0, 0, 0, P11, 0, 0, -ox, -oy, A, -1, 0, 0, B, 0];
    const m = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += proj[k * 4 + r] * view[c * 4 + k];
      m[c * 4 + r] = s;
    }
    this.camInfo = { m, right, up, fwd, P00, P11, D, aspect, eye, ox, oy, s: f.s };
    return this.camInfo;
  }

  // where a point of the picture lands on screen, in CSS px (null if behind)
  project(x, y, z) {
    const c = this.camInfo;
    if (!c) return null;
    const m = c.m;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w < 0.01) return null;
    const nx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w, ny = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    return { x: (nx * 0.5 + 0.5) * this.cssW, y: (0.5 - ny * 0.5) * this.cssH, w };
  }

  // the point on the picture's plane (z) under a screen point (-1..1)
  unproject(nx, ny, z = 0) {
    const c = this.camInfo;
    if (!c) return null;
    const vx = (nx + c.ox) / c.P00, vy = (ny + c.oy) / c.P11; // view-space direction at depth -1
    const dir = [0, 1, 2].map((k) => c.right[k] * vx + c.up[k] * vy + c.fwd[k]);
    const t = (z - c.eye[2]) / dir[2];
    return { x: c.eye[0] + dir[0] * t, y: c.eye[1] + dir[1] * t, z };
  }

  step(dt) {
    dt = this.o.fixedDt || clamp(dt, 0, 1 / 20);
    this.time += dt;
    const p = this.ptr, o = this.o;
    // the pointer: velocity smoothed, presence fading in and out
    const vx = (p.x - p.px) / Math.max(dt, 1e-4), vy = (p.y - p.py) / Math.max(dt, 1e-4);
    const kS = 1 - Math.exp(-dt / 0.05);
    p.vx += (clamp(vx, -12, 12) - p.vx) * kS;
    p.vy += (clamp(vy, -12, 12) - p.vy) * kS;
    p.on += ((p.inside && p.seen ? 1 : 0) - p.on) * (1 - Math.exp(-dt / 0.25));
    // the camera turns a little toward the pointer
    const kc = 1 - Math.exp(-dt / 1.2);
    this.cam.yaw += ((p.inside ? p.x : 0) * 0.22 * o.parallax - this.cam.yaw) * kc;
    this.cam.pitch += ((p.inside ? -p.y : 0) * 0.12 * o.parallax - this.cam.pitch) * kc;
    const moving = clamp(Math.hypot(p.vx, p.vy) * 1.5, 0, 1);
    this.hotPower += ((p.inside ? 0.45 + 0.55 * moving : 0) - this.hotPower) * (1 - Math.exp(-dt / 0.3));
    const cam = this._camera();
    this._simulate(dt, cam);
    p.px = p.x; p.py = p.y;
  }

  _simulate(dt, cam) {
    const gl = this.gl, o = this.o, u = this.sim.u, p = this.ptr;
    const src = this.state[this.ping], dst = this.state[1 - this.ping];
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
    gl.viewport(0, 0, this.tw, this.th);
    gl.disable(gl.BLEND);
    gl.useProgram(this.sim.p);
    gl.bindVertexArray(this.vao);
    const tex = [src.t[0], src.t[1], src.t[2], this.A.form.pos, this.A.form.col, this.B.form.pos, this.B.form.col];
    ["uP", "uV", "uC", "uAp", "uAc", "uBp", "uBc"].forEach((n, k) => {
      gl.activeTexture(gl.TEXTURE0 + k);
      gl.bindTexture(gl.TEXTURE_2D, tex[k]);
      gl.uniform1i(u[n], k);
    });
    gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, this.permTex[0]); gl.uniform1i(u.uPA, 7);
    gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, this.permTex[1]); gl.uniform1i(u.uPB, 8);
    gl.uniform1ui(u.uMask, this.N - 1);
    gl.uniform1ui(u.uWMask, this.tw - 1);
    gl.uniform1ui(u.uShift, this.shift);
    gl.uniform1f(u.uT, this.time - this.t0);
    gl.uniform1f(u.uDt, dt);
    gl.uniform1f(u.uTime, this.time);
    gl.uniform1f(u.uReset, this.reset ? 1 : 0);
    gl.uniform4fv(u.uMove, this.move);
    gl.uniform4fv(u.uMove2, this.move2);
    gl.uniform3f(u.uSpring, o.spring[0], o.spring[1], o.spring[2] ?? o.spring[0] * 2);
    gl.uniform1f(u.uRamp, o.ramp);
    gl.uniform1f(u.uTrack, this.track);
    gl.uniform4fv(u.uOrder, this.order);
    gl.uniformMatrix4fv(u.uVP, false, cam.m);
    gl.uniform3fv(u.uRight, cam.right);
    gl.uniform3fv(u.uUp, cam.up);
    gl.uniform3fv(u.uFwd, cam.fwd.map((v) => -v));
    gl.uniform2f(u.uProj, cam.P00, cam.P11);
    gl.uniform1f(u.uAspect, cam.aspect);
    gl.uniform4f(u.uPtr, p.px, p.py, p.x, p.y);
    const h = o.hand;
    gl.uniform4f(u.uPtrV, p.vx, p.vy, p.on * h.strength, h.reach);
    gl.uniform4f(u.uHand, h.drag, h.spread, h.still, h.depth);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.ping = 1 - this.ping;
    this.reset = false;
  }

  render() {
    const gl = this.gl, o = this.o, cam = this.camInfo, u = this.pts.u;
    if (!cam || !this.B) return;
    const st = this.state[this.ping];
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.accFb);
    gl.viewport(0, 0, this.W, this.H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.pts.p);
    gl.bindVertexArray(this.vao);
    ["uP", "uV", "uC"].forEach((n, k) => { gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, st.t[k]); gl.uniform1i(u[n], k); });
    gl.uniform1ui(u.uWMask, this.tw - 1);
    gl.uniform1ui(u.uShift, this.shift);
    gl.uniformMatrix4fv(u.uVP, false, cam.m);
    // grain size and brightness from how many grains share the picture's area on screen
    const spx = cam.s * this.dpr;                                       // half the picture's height in device px
    const size = clamp(2 * spx * Math.sqrt(0.6 / this.N) * 1.9, 1.3 * this.dpr, 3.6 * this.dpr) * o.size;
    const cover = (this.N * 0.35 * size * size) / (0.6 * 4 * spx * spx);
    const gain = clamp(0.62 / (cover + 0.12), 0.06, 1);
    gl.uniform1f(u.uTime, this.time);
    gl.uniform1f(u.uDist, cam.D);
    gl.uniform1f(u.uSize, size);
    gl.uniform1f(u.uMinPx, 1);
    gl.uniform1f(u.uGain, gain);
    gl.uniform1f(u.uAspect, cam.aspect);
    const L = (this.time / 5.6) % 1;
    const breath = 2 * (L < 0.42 ? -Math.cos((Math.PI * L) / 0.42) : Math.cos((Math.PI * (L - 0.42)) / 0.58)) * o.breath;
    gl.uniform1f(u.uBreath, breath);
    gl.uniform1f(u.uTail, 0.06);
    gl.uniform1f(u.uInk, o.ink ? 1 : 0);
    gl.uniform1f(u.uMono, o.mono);
    gl.uniform1f(u.uSat, o.saturation);
    gl.uniform1f(u.uFlightDim, o.flightDim);
    gl.uniform3fv(u.uTint, hex(o.tint));
    gl.uniform3fv(u.uInkAbs, hex(o.inkColor).map((c) => clamp(Math.log(Math.max(0.04, c)) / Math.log(0.04), 0, 1)));
    const wd = o.wind, nx = Math.cos(wd.angle), ny = Math.sin(wd.angle);
    gl.uniform4f(u.uLine, wd.x, wd.y, nx, ny);
    gl.uniform3f(u.uWind, nx, ny, wd.amount);
    const lamps = new Float32Array(16), lcol = new Float32Array(12), cores = new Float32Array(16), ccol = new Float32Array(12);
    this.lampState.slice(0, 4).forEach((l, k) => {
      lamps.set([l.x, l.y, l.z, l.power], 4 * k);
      lcol.set(hex(l.color), 3 * k);
      const s = this.project(l.x, l.y, l.z);
      if (s && l.power > 0.004) { cores.set([(s.x / this.cssW) * 2 - 1, 1 - (s.y / this.cssH) * 2, l.power * (l.core ?? 1), 0.3 / (s.w * TAN)], 4 * k); ccol.set(hex(l.color), 3 * k); }
    });
    gl.uniform4fv(u.uLamp, lamps);
    gl.uniform3fv(u.uLampCol, lcol);
    const p = this.ptr;
    gl.uniform3f(u.uHot, p.x, p.y, o.hot ? this.hotPower * o.hotPower : 0);
    gl.uniform3fv(u.uHotCol, hex(o.hot || "#ffffff"));
    if (o.scan) {
      const P = (this.time % 7) / 7, S = 0.5 * o.relief + 0.05;
      gl.uniform2f(u.uScan, lerp(S, -S, P / 0.75), P < 0.75 ? Math.pow(Math.sin((Math.PI * P) / 0.75), 0.6) : 0);
      this.scanZ = P < 0.75 ? lerp(S, -S, P / 0.75) : null;
    } else gl.uniform2f(u.uScan, 0, 0);
    gl.uniform1f(u.uDisc, o.disc ? 1 : 0);
    this.pts.u.uDisc && gl.uniform1f(this.pts.u.uDisc, o.disc ? 1 : 0);
    gl.uniform1f(u.uPass, 0);
    gl.uniform1ui(u.uStride, 1);
    gl.drawArrays(gl.POINTS, 0, this.N);
    const lampSum = this.lampState.reduce((s, l) => s + l.power, 0) + (o.hot ? this.hotPower : 0);
    if (!o.ink && lampSum > 0.004) {
      gl.uniform1f(u.uPass, 1);
      gl.uniform1ui(u.uStride, 8);
      gl.drawArrays(gl.POINTS, 0, this.N >> 3);
    }
    if (o.streaks) {
      gl.uniform1f(u.uPass, 2);
      gl.uniform1ui(u.uStride, 3);
      gl.drawArrays(gl.LINES, 0, 2 * Math.floor(this.N / 3));
    }
    // to the screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
    gl.disable(gl.BLEND);
    gl.useProgram(this.out.p);
    const ou = this.out.u;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.acc);
    gl.uniform1i(ou.uAcc, 0);
    gl.uniform3fv(ou.uBg, hex(o.background));
    gl.uniform1f(ou.uInk, o.ink ? 1 : 0);
    gl.uniform1f(ou.uClear, o.transparent && !o.ink ? 1 : 0);
    gl.uniform1f(ou.uInkCap, o.inkCap);
    gl.uniform1f(ou.uExposure, o.exposure);
    gl.uniform1f(ou.uGrain, o.grain);
    gl.uniform1f(ou.uVig, o.vignette);
    gl.uniform1f(ou.uTime, this.time);
    gl.uniform1f(ou.uAspect, cam.aspect);
    gl.uniform4fv(ou.uCore, cores);
    gl.uniform3fv(ou.uCoreCol, ccol);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // runs on its own; returns a stop function. onFrame(engine, dt) is called after each step, before drawing.
  start(onFrame) {
    let last = performance.now(), raf = 0, alive = true;
    const loop = (now) => {
      if (!alive) return;
      const dt = (now - last) / 1000;
      last = now;
      this.resize();
      if (this.B) {
        this.step(dt);
        onFrame && onFrame(this, this.o.fixedDt || clamp(dt, 0, 1 / 20));
        this.render();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }
}

// cycles through the pictures on its own, and lets a page jump to one; pauses while the page is hidden
export function autoplay(engine, { hold = 4.5, first = 0, onShow } = {}) {
  let next = engine.time + hold, paused = false;
  const api = {
    go(i, opts) { engine.show(i, opts); next = engine.time + hold + engine.o.spread + engine.o.gather; onShow && onShow(i); },
    pause(v = true) { paused = v; },
    tick() {
      if (paused || engine.forms.length < 2) return;
      if (engine.time >= next) api.go((engine.current + 1) % engine.forms.length);
    },
  };
  onShow && onShow(first);
  return api;
}
