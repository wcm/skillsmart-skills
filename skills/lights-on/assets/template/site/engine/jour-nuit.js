// Jour / Nuit engine: one photographed place in three lights, composited as real light in WebGL2.
//
//   day    the place in daylight
//   dark   the same frame at night with every light off (blue hour)
//   night  the same frame at night with the lights on
//
// The three are aligned to the pixel (tools/align.py), so nothing moves; only light changes:
//   - the sun leaves: each pixel goes from day to dark at its own moment, sunlit patches last and the far side of
//     the room first, so light seems to drain toward the window, with a golden-hour grade on the way;
//   - lights come on one by one: night − dark is the light the lamps add, split between them by soft regions, added
//     in linear light (a lamp switched on by day adds the same light to the sunny room, so it barely shows, as in life);
//   - each light has a kind: warm (an incandescent warm-up that glows orange at low power), neon (an ignition
//     flicker), led, candle (a living flicker) or fade.
// Variants (curtain fabrics) are more sets of the three, wiped in from the top like cloth unfurling.
//
//   const jn = await JourNuit.create(canvas, { sets: { linen: { day, dark, night } }, lights: [...], ... })
//   jn.night() / jn.day() / jn.toggle()        the whole sequence
//   jn.set({ sun, ambient, lights: { id: level } })   direct control (scroll)
//   jn.light(id, on)                           one light, with its kind's curve
//   jn.use("blackout")                         wipe to another set
//   jn.toScreen(u, v)                          image coords (0..1, top-left) → CSS px in the canvas, for hotspots
//   jn.on("change", fn)                        every frame something moved: fn(jn.state)
//   ?record in the URL: the clock only moves on jn.tick(dt), for frame-by-frame capture.

const MAX_LIGHTS = 12;

const VERT = `#version 300 es
in vec2 p;
out vec2 v_uv;
void main() { v_uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D uDay, uDark, uNight;
uniform sampler2D uDayB, uDarkB, uNightB;
uniform sampler2D uW0, uW1;     // measured light shares (tools/prep.py): lights 0–2 in RGB, 3–5
uniform bool uMeasured;
uniform vec4 uCover;            // xy: visible size of the image (uv), zw: offset (uv, top-left origin)
uniform float uSun;             // 0 day, 1 the sun is gone
uniform vec2 uSunFrom;          // where daylight comes from (image uv): light drains toward it
uniform float uSunSpan;         // how long each pixel takes to change (share of the whole)
uniform float uGold;            // strength of the golden-hour grade
uniform float uExpo;            // exposure of the added light (low by day, 1 at night)
uniform int uN;
uniform vec4 uL[${MAX_LIGHTS}]; // cx, cy, rx, ry (image uv)
uniform vec4 uLp[${MAX_LIGHTS}];// level, angle, falloff, warmth
uniform float uAmbient;         // the night light no region claims
uniform float uBloom;
uniform float uWipe;            // < 0: no second set; 0..1: set B unfurls from the top, or is drawn across
uniform int uWipeDir;           // 0 down (unfurl), 1 across (a curtain drawn along its rod, left to right)
uniform vec4 uWipeRect;         // across: the cloth's area (image uv); outside it the room's light just crossfades
uniform float uTime, uGrain, uVignette, uSeed;
uniform vec2 uRes;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.03 + 7.1) + 0.15 * vnoise(p * 4.1 + 3.7); }

vec3 toSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 compose(sampler2D tDay, sampler2D tDark, sampler2D tNight, vec2 uv) {
  vec3 day = texture(tDay, uv).rgb;
  vec3 dark = texture(tDark, uv).rgb;
  vec3 night = texture(tNight, uv).rgb;

  // the sun: each pixel's moment comes from how sunlit it is, how near the window, and a little noise
  float lum = dot(textureLod(tDay, uv, 4.0).rgb, LUMA);
  float lit = clamp(log2(lum * 24.0 + 1.0) / log2(25.0), 0.0, 1.0);
  float near = 1.0 - clamp(distance(uv, uSunFrom) / 1.25, 0.0, 1.0);
  float n = fbm(uv * vec2(4.0, 2.6) + uSeed);
  float tau = clamp(0.52 * lit + 0.30 * near + 0.18 * n, 0.0, 1.0) * (1.0 - uSunSpan);
  float m = clamp((uSun - tau) / uSunSpan, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);
  float g = sin(clamp(uSun * 1.35, 0.0, 1.0) * 3.14159) * uGold;     // rises, then gives way to blue
  vec3 grade = mix(vec3(1.0), vec3(1.12, 0.94, 0.74), g) * mix(1.0, 0.78, smoothstep(0.15, 0.75, uSun));
  vec3 base = mix(day * grade, dark, m);

  // the lights: night − dark, shared out between the lights: by photos of each light alone (measured), or by soft
  // regions round each light
  float e[${MAX_LIGHTS}];
  float sumE = 0.0;
  vec3 w0 = uMeasured ? texture(uW0, uv).rgb : vec3(0.0);
  vec3 w1 = uMeasured ? texture(uW1, uv).rgb : vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uN) break;
    if (uMeasured) {
      e[i] = i < 3 ? w0[i] : i < 6 ? w1[i - 3] : 0.0;
    } else {
      vec2 d = uv - uL[i].xy;
      float a = uLp[i].y;
      d = mat2(cos(a), sin(a), -sin(a), cos(a)) * d;
      float r = length(d / uL[i].zw);
      e[i] = pow(clamp(1.0 - r, 0.0, 1.0), uLp[i].z);
    }
    sumE += e[i];
  }
  float norm = max(sumE, 1.0);
  vec3 w = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uN) break;
    float lv = uLp[i].x;
    // an incandescent lamp at low power is dim and orange
    vec3 tint = mix(vec3(1.0), mix(vec3(1.0, 0.42, 0.12), vec3(1.0), pow(clamp(lv, 0.0, 1.0), 0.45)), uLp[i].w);
    w += (e[i] / norm) * lv * tint;
  }
  w += (1.0 - min(sumE, 1.0)) * uAmbient;

  vec3 add = night - dark;
  vec3 col = base + uExpo * w * add;
  // a soft halo around what glows
  vec3 h1 = max(textureLod(tNight, uv, 5.0).rgb - textureLod(tDark, uv, 5.0).rgb, 0.0);
  vec3 h2 = max(textureLod(tNight, uv, 7.0).rgb - textureLod(tDark, uv, 7.0).rgb, 0.0);
  col += uExpo * w * (h1 * 0.16 + h2 * 0.12) * uBloom;
  return col;
}

void main() {
  vec2 s = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 uv = uCover.zw + s * uCover.xy;
  vec3 col = compose(uDay, uDark, uNight, uv);
  if (uWipe >= 0.0) {
    vec3 colB = compose(uDayB, uDarkB, uNightB, uv);
    float k;
    if (uWipeDir == 1) {
      // drawn across: the leading edge runs along the rod, a little ahead at the top where the carrier pulls
      vec4 r = uWipeRect;
      float u = (uv.x - r.x) / (r.z - r.x);
      float v = clamp((uv.y - r.y) / (r.w - r.y), 0.0, 1.0);
      float edge = uWipe * 1.3 - 0.15 - v * 0.08;
      float folds = (fbm(vec2(v * 2.0 + uSeed, uWipe * 1.5)) - 0.5) * 0.05;
      float inCloth = step(r.x, uv.x) * step(uv.x, r.z) * step(r.y, uv.y) * step(uv.y, r.w);
      float across = smoothstep(edge + 0.035, edge - 0.035, u + folds);
      float room = smoothstep(0.1, 0.9, uWipe);
      k = mix(room, across, inCloth);
    } else {
      // unfurls from the top, its hem uneven
      float hem = uWipe * 1.5 - 0.25;
      float wav = (fbm(vec2(uv.x * 9.0, uWipe * 2.0 + uSeed)) - 0.5) * 0.16;
      k = smoothstep(hem + 0.06, hem - 0.06, uv.y + wav);
    }
    col = mix(col, colB, k);
  }
  vec3 c = toSRGB(col);
  // vignette, deeper at night
  vec2 q = s - 0.5;
  c *= 1.0 - uVignette * (0.6 + 0.4 * uSun) * smoothstep(0.35, 1.05, length(q * vec2(1.0, 0.86)) * 1.25);
  // grain: finer in the light, heavier in the dark, as on film
  float gr = hash(gl_FragCoord.xy + fract(uTime * 37.0) * 311.0) - 0.5;
  float y = dot(c, LUMA);
  c += gr * uGrain * mix(1.35, 0.55, y);
  outColor = vec4(c, 1.0);
}`;

// --- light curves ----------------------------------------------------------------------------------------------

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
export const ease = {
  linear: (x) => x,
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  out: (x) => 1 - Math.pow(1 - x, 3),
  in: (x) => x * x * x,
  // slow start, steady middle, soft landing: the time goes to the change, not the ends
  brisk: (x) => { const a = 0.18; return x < a ? (x * x) / (2 * a * (1 - a)) * 1 : x > 1 - a ? 1 - ((1 - x) * (1 - x)) / (2 * a * (1 - a)) : (x - a / 2) / (1 - a); },
};

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// value of a light (0..1+) `t` seconds after it was switched on (kind decides the curve)
const KINDS = {
  warm: { on: 0.9, off: 0.35, curve: (t, d) => ease.out(clamp01(t / d)) },
  fade: { on: 1.4, off: 0.8, curve: (t, d) => ease.inOut(clamp01(t / d)) },
  led: { on: 0.18, off: 0.15, curve: (t, d) => ease.out(clamp01(t / d)) },
  candle: { on: 1.1, off: 0.5, curve: (t, d) => ease.out(clamp01(t / d)) },
  neon: {
    on: 0.95, off: 0.22,
    // strike, die, strike, flutter, catch, then settle down from a slight overshoot
    curve: (t, d, light) => {
      const p = light.pattern;
      if (t >= d) return 1;
      let acc = 0;
      for (const [len, v] of p) { if (t < acc + len) return v; acc += len; }
      const k = clamp01((t - acc) / Math.max(0.001, d - acc));
      return 1 + 0.12 * (1 - ease.out(k)) * Math.sin(k * 3.1416);
    },
  },
};

function neonPattern(seed) {
  const r = rng(seed);
  return [[0.035 + r() * 0.02, 0.55], [0.05 + r() * 0.04, 0.0], [0.03, 0.8], [0.09 + r() * 0.05, 0.05], [0.04, 0.95], [0.05, 0.25], [0.06 + r() * 0.03, 1.0], [0.03, 0.6]];
}

// --- loading -----------------------------------------------------------------------------------------------------

async function bitmap(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const blob = await res.blob();
  return createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
}

function texture(gl, bmp) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
  if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
  return t;
}

// pick the picture size for this screen: "img/x/day.webp" + widths [1600, 3200] → "img/x/day-1600.webp" or the full one
function sized(url, widths, need) {
  if (!widths?.length) return url;
  const w = widths.find((x) => x >= need) ?? widths[widths.length - 1];
  return url.replace(/(\.\w+)$/, `-${w}$1`);
}

// --- the engine ---------------------------------------------------------------------------------------------------

export class JourNuit {
  static async create(canvas, opts) {
    const jn = new JourNuit(canvas, opts);
    await jn.load();
    return jn;
  }

  constructor(canvas, opts) {
    this.canvas = canvas;
    this.o = {
      focus: [0.5, 0.5],      // the point of the picture kept on screen when cropped (image coords, top-left)
      sunFrom: [1, 0.4],
      sunSpan: 0.42,
      gold: 0.75,
      dayExpo: 0.32,          // how strong lamp light reads against daylight
      bloom: 1,
      grain: 0.028,
      vignette: 0.22,
      zoom: 1,                // >1 crops in (a slow push can animate it)
      widths: null,
      seed: 7,
      ...opts,
    };
    this.lights = (opts.lights ?? []).map((l, i) => ({
      kind: "warm", rx: 0.12, ry: 0.12, angle: 0, falloff: 1.4, warmth: l.kind === "warm" || !l.kind ? 1 : 0, gain: 1,
      ...l, i, level: 0, target: 0, since: -1e9, from: 0, pattern: neonPattern((opts.seed ?? 7) * 31 + i * 7), hover: 0,
    }));
    this.byId = Object.fromEntries(this.lights.map((l) => [l.id, l]));
    this.state = { sun: 0, ambient: 0, wipe: -1, set: Object.keys(opts.sets)[0], next: null };
    this.tweens = [];
    this.listeners = {};
    this.recording = new URLSearchParams(location.search).has("record");
    this.clock = 0;
    this.dirty = true;
  }

  async load() {
    const gl = this.canvas.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: this.recording, powerPreference: "high-performance" });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    this.prog = prog;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const n of ["uDay", "uDark", "uNight", "uDayB", "uDarkB", "uNightB", "uW0", "uW1", "uMeasured", "uCover", "uSun", "uSunFrom", "uSunSpan", "uGold", "uExpo", "uN", "uL", "uLp", "uAmbient", "uBloom", "uWipe", "uWipeDir", "uWipeRect", "uTime", "uGrain", "uVignette", "uSeed", "uRes"])
      this.u[n] = gl.getUniformLocation(prog, n);
    ["uDay", "uDark", "uNight", "uDayB", "uDarkB", "uNightB", "uW0", "uW1"].forEach((n, i) => gl.uniform1i(this.u[n], i));

    // measured light shares: linear data, not colour, so a plain RGBA texture
    if (this.o.weights) {
      const wt = await Promise.all([].concat(this.o.weights).map(async (url) => {
        const b = await bitmap(url);
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, b);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
      }));
      this.weightTex = [wt[0], wt[1] ?? wt[0]];
    }

    // the first set loads before anything shows; the others follow quietly
    const need = Math.min(4096, Math.max(window.innerWidth, window.innerHeight * (16 / 9)) * Math.min(2, devicePixelRatio || 1));
    this.need = need;
    this.tex = {};
    const names = Object.keys(this.o.sets);
    await this.loadSet(names[0]);
    this.rest = Promise.all(names.slice(1).map((n) => this.loadSet(n).catch((e) => console.warn(e))));
    const first = this.o.sets[names[0]];
    this.imgW = first.width ?? this.texSize.w;
    this.imgH = first.height ?? this.texSize.h;

    this.resize();
    new ResizeObserver(() => this.resize()).observe(this.canvas);
    this.loop = this.loop.bind(this);
    if (!this.recording) requestAnimationFrame(this.loop);
    else this.render();
    window.jn = this;
  }

  async loadSet(name) {
    if (this.tex[name]) return this.tex[name];
    const s = this.o.sets[name];
    this.byUrl ??= {};
    // a set may reuse a picture (no separate dark: dark = night); each url loads once
    const get = (url) => (this.byUrl[url] ??= bitmap(sized(url, this.o.widths, this.need)).then((b) => {
      this.texSize ??= { w: b.width, h: b.height };
      const t = texture(this.gl, b);
      b.close?.();
      return t;
    }));
    this.tex[name] = await Promise.all(["day", "dark", "night"].map((k) => get(s[k] ?? s.night)));
    this.dirty = true;
    return this.tex[name];
  }

  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.cssW = r.width; this.cssH = r.height;
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.cover();
    this.dirty = true;
    this.emit("resize");
  }

  // visible part of the image for a cover fit around the focus point
  cover() {
    const ia = this.imgW / this.imgH, ca = this.cssW / Math.max(1, this.cssH);
    let vw = 1, vh = 1;
    if (ca > ia) vh = ia / ca; else vw = ca / ia;
    vw /= this.o.zoom; vh /= this.o.zoom;
    const [fx, fy] = this.o.focus;
    const ox = Math.min(1 - vw, Math.max(0, fx - vw / 2));
    const oy = Math.min(1 - vh, Math.max(0, fy - vh / 2));
    this.view = { vw, vh, ox, oy };
  }

  toScreen(u, v) {
    const { vw, vh, ox, oy } = this.view;
    return { x: ((u - ox) / vw) * this.cssW, y: ((v - oy) / vh) * this.cssH, visible: u >= ox && u <= ox + vw && v >= oy && v <= oy + vh };
  }

  fromScreen(x, y) {
    const { vw, vh, ox, oy } = this.view;
    return { u: ox + (x / this.cssW) * vw, v: oy + (y / this.cssH) * vh };
  }

  setFocus(focus, zoom = this.o.zoom) { this.o.focus = focus; this.o.zoom = zoom; this.cover(); this.dirty = true; this.emit("resize"); }

  on(ev, fn) { (this.listeners[ev] ??= []).push(fn); return this; }
  emit(ev, ...a) { for (const fn of this.listeners[ev] ?? []) fn(...a); }

  now() { return this.recording ? this.clock : performance.now() / 1000; }

  // --- control ---

  tween(key, to, { duration = 1, delay = 0, ease: e = ease.inOut } = {}) {
    this.tweens = this.tweens.filter((t) => t.key !== key);
    const from = this.state[key];
    if (duration <= 0 && delay <= 0) { this.state[key] = to; this.dirty = true; return Promise.resolve(); }
    return new Promise((done) => this.tweens.push({ key, from, to, start: this.now() + delay, duration: Math.max(0.0001, duration), ease: e, done }));
  }

  // switch one light; its kind gives the curve unless a duration is given
  light(id, on = true, { delay = 0, duration } = {}) {
    const l = typeof id === "object" ? id : this.byId[id];
    if (!l) return;
    const target = on === true ? 1 : on === false ? 0 : on;
    const kind = KINDS[l.kind] ?? KINDS.warm;
    l.from = l.level; l.target = target;
    l.since = this.now() + delay;
    l.dur = duration ?? (target > l.level ? kind.on : kind.off);
    if (l.kind === "neon" && target > l.level) l.pattern = neonPattern(Math.floor(this.now() * 997) + l.i);
    this.dirty = true;
  }

  isOn(id) { const l = this.byId[id]; return !!l && l.target > 0.5; }

  // direct control for scroll: sun, ambient, lights {id: level}
  set({ sun, ambient, lights } = {}) {
    if (sun !== undefined) { this.tweens = this.tweens.filter((t) => t.key !== "sun"); this.state.sun = clamp01(sun); }
    if (ambient !== undefined) { this.tweens = this.tweens.filter((t) => t.key !== "ambient"); this.state.ambient = clamp01(ambient); }
    if (lights) for (const [id, v] of Object.entries(lights)) {
      const l = this.byId[id]; if (!l) continue;
      l.from = l.level = l.target = v; l.since = -1e9; l.dur = 0;
    }
    this.dirty = true;
    this.emit("change", this.state);
  }

  // the whole evening: the sun goes, a beat of blue, then the lights in their order
  // (the sun runs on a brisk curve: a steady middle with soft ends, so the change itself gets the time)
  async night({ sun = 1.9, beat = 0.25, stagger = 0.22, order, ambient = 1, ambientDelay = 0, sunEase = ease.brisk } = {}) {
    this.mode = "night";
    const token = (this.seq = (this.seq ?? 0) + 1);
    this.emit("mode", "night");
    await this.tween("sun", 1, { duration: sun * (1 - this.state.sun * 0.85), ease: sunEase });
    if (token !== this.seq) return;
    const ids = order ?? this.lights.map((l) => l.id);
    const t0 = beat;
    ids.forEach((id, k) => this.light(id, true, { delay: t0 + k * stagger }));
    this.tween("ambient", ambient, { duration: 1.2, delay: t0 + ambientDelay, ease: ease.inOut });
  }

  // morning: lights off together (neon first), then the sun returns
  async day({ sun = 1.6, lightsOff = 0.35, sunEase = ease.brisk } = {}) {
    this.mode = "day";
    const token = (this.seq = (this.seq ?? 0) + 1);
    this.emit("mode", "day");
    // nothing lit yet (turned back mid-dusk): the sun turns round at once instead of waiting for the lights
    const lit = this.lights.some((l) => l.target > 0 || l.level > 0.01) || this.state.ambient > 0.01;
    if (!lit) this.tween("sun", this.state.sun, { duration: 0 });
    this.lights.forEach((l, k) => this.light(l.id, false, { delay: k * 0.04 }));
    this.tween("ambient", 0, { duration: lightsOff + 0.2, ease: ease.out });
    if (lit) await new Promise((r) => this.after(lightsOff, r));
    if (token !== this.seq) return;
    await this.tween("sun", 0, { duration: sun * (0.15 + this.state.sun * 0.85), ease: sunEase });
  }

  toggle(opts) { return this.mode === "night" ? this.day(opts) : this.night(opts); }

  after(seconds, fn) { this.tweens.push({ key: Symbol("after"), from: 0, to: 0, start: this.now() + seconds, duration: 0.0001, ease: ease.linear, done: fn, noop: true }); }

  // wipe to another set (curtain fabric); resolves when done
  async use(name, { duration = 1.6 } = {}) {
    if (name === this.state.set && this.state.wipe < 0) return;
    await this.loadSet(name);
    if (this.state.next && this.state.wipe >= 0) { this.state.set = this.state.next; }
    this.state.next = name;
    this.state.wipe = 0;
    await this.tween("wipe", 1, { duration, ease: ease.inOut });
    if (this.state.next === name) { this.state.set = name; this.state.next = null; this.state.wipe = -1; this.dirty = true; }
  }

  // --- time ---

  // record mode: time moves only here, and the page's CSS transitions follow the same clock
  tick(dt = 1 / 60) {
    this.clock += dt;
    this.step();
    this.render();
    for (const a of document.getAnimations()) {
      if (a.jnStart === undefined) { a.jnStart = this.clock - (a.currentTime ?? 0) / 1000; a.pause(); }
      a.currentTime = (this.clock - a.jnStart) * 1000;
    }
  }

  loop() {
    this.step();
    if (this.dirty || this.live()) this.render();
    requestAnimationFrame(this.loop);
  }

  live() {
    return this.tweens.length > 0 || this.lights.some((l) => (l.level > 0.001 && (l.kind === "candle" || l.kind === "neon")) || l.level !== l.target || l.hover !== (l.hoverTarget ?? 0));
  }

  // a light under the pointer brightens a touch (an invitation, not a switch)
  hover(id, on) { const l = this.byId[id]; if (l) { l.hoverTarget = on ? 1 : 0; this.dirty = true; } }

  step() {
    const t = this.now();
    const dt = Math.min(0.1, Math.max(0, t - (this.lastStep ?? t)));
    this.lastStep = t;
    let moved = false;
    for (const tw of [...this.tweens]) {
      if (t < tw.start) continue;
      const k = clamp01((t - tw.start) / tw.duration);
      if (!tw.noop) this.state[tw.key] = tw.from + (tw.to - tw.from) * tw.ease(k);
      moved = true;
      if (k >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.done?.(); }
    }
    for (const l of this.lights) {
      const kind = KINDS[l.kind] ?? KINDS.warm;
      const since = t - l.since;
      let v;
      if (since < 0) v = l.from;
      else if (l.target > l.from) v = l.from + (l.target - l.from) * kind.curve(since, l.dur || 0.0001, l);
      else v = l.from + (l.target - l.from) * ease.out(clamp01(since / (l.dur || 0.0001)));
      if (since >= (l.dur ?? 0) + 0.2 && l.kind !== "neon") v = l.target;
      if (l.kind === "candle" && v > 0) {
        const s = l.i * 13.7;
        v *= 0.9 + 0.07 * Math.sin(t * 7.3 + s) * Math.sin(t * 3.1 + s * 2) + 0.05 * Math.sin(t * 17.9 + s * 3) * Math.sin(t * 1.3);
      }
      if (l.kind === "neon" && v > 0.5 && since > (l.dur ?? 0)) v *= 0.985 + 0.015 * Math.sin(t * 61.0 + l.i) * Math.sin(t * 2.3);
      const ht = l.hoverTarget ?? 0;
      if (l.hover !== ht) { l.hover += (ht - l.hover) * Math.min(1, dt * 9); if (Math.abs(ht - l.hover) < 0.002) l.hover = ht; moved = true; }
      v += l.hover * 0.14 * (1 - Math.min(1, v));
      if (v !== l.level) { l.level = v; moved = true; }
    }
    if (moved) { this.dirty = true; this.emit("change", this.state); }
  }

  render() {
    const gl = this.gl;
    const set = this.tex[this.state.set];
    if (!set) return;
    const next = this.state.next ? this.tex[this.state.next] : null;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    [...set, ...(next ?? set), ...(this.weightTex ?? [set[0], set[0]])].forEach((t, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); });
    gl.uniform1i(this.u.uMeasured, this.weightTex ? 1 : 0);
    const { vw, vh, ox, oy } = this.view;
    gl.uniform4f(this.u.uCover, vw, vh, ox, oy);
    const s = this.state;
    gl.uniform1f(this.u.uSun, s.sun);
    gl.uniform2f(this.u.uSunFrom, this.o.sunFrom[0], this.o.sunFrom[1]);
    gl.uniform1f(this.u.uSunSpan, this.o.sunSpan);
    gl.uniform1f(this.u.uGold, this.o.gold);
    gl.uniform1f(this.u.uExpo, this.o.dayExpo + (1 - this.o.dayExpo) * smooth(s.sun));
    const n = Math.min(MAX_LIGHTS, this.lights.length);
    const L = new Float32Array(MAX_LIGHTS * 4), P = new Float32Array(MAX_LIGHTS * 4);
    this.lights.slice(0, n).forEach((l, i) => {
      L.set([l.x, l.y, l.rx, l.ry], i * 4);
      P.set([Math.max(0, l.level) * l.gain, l.angle, l.falloff, l.warmth], i * 4);
    });
    gl.uniform1i(this.u.uN, n);
    gl.uniform4fv(this.u.uL, L);
    gl.uniform4fv(this.u.uLp, P);
    gl.uniform1f(this.u.uAmbient, s.ambient);
    gl.uniform1f(this.u.uBloom, this.o.bloom);
    gl.uniform1f(this.u.uWipe, next ? s.wipe : -1);
    const wipe = this.o.wipe ?? {};
    gl.uniform1i(this.u.uWipeDir, wipe.dir === "across" ? 1 : 0);
    gl.uniform4fv(this.u.uWipeRect, wipe.rect ?? [0, 0, 1, 1]);
    gl.uniform1f(this.u.uTime, this.now());
    gl.uniform1f(this.u.uGrain, this.o.grain);
    gl.uniform1f(this.u.uVignette, this.o.vignette);
    gl.uniform1f(this.u.uSeed, this.o.seed * 0.137);
    gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.dirty = false;
    if (!this.shown) { this.shown = true; this.canvas.classList.add("ready"); this.emit("ready"); }
  }
}
