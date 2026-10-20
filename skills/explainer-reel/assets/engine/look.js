/*
 * Looks: the filter every frame goes through. Two 2D layers come in (art: the drawings; ui: the
 * captions and the CTA), get blurred small (a tight glow at 1/4 size, a wide haze at 1/8), and one
 * full-size pass per look turns them into the frame:
 *
 *   halftone   the reference: crisp line, a glow quantised into a dot screen, a magenta ghost, grain
 *   led        everything on a grid of round LEDs; captions stay crisp on top
 *   crt        curved tube, scanlines, RGB aperture mask, bloom, a rolling band
 *   neon       smooth wide bloom, no screen
 *   riso       ink on paper: multiply, a misregistered second plate, halftone shading, speckle
 *   blueprint  drafting grid on blue paper, soft glow
 *   dither     ordered Bayer dither into the palette's four main colours
 *   chalk      grainy broken strokes and smudges on a slate board
 *
 * Kept cheap on purpose: headless Chrome renders with a software GPU, so every full-size pass costs.
 */
import { hexToRgb } from "./theme.js";

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const DOWN = `#version 300 es
precision highp float; in vec2 uv; uniform sampler2D src; uniform vec2 texel; out vec4 o;
void main() {
  vec2 d = texel * 0.5;
  o = 0.25 * (texture(src, uv + vec2(-d.x, -d.y)) + texture(src, uv + vec2(d.x, -d.y)) + texture(src, uv + vec2(-d.x, d.y)) + texture(src, uv + vec2(d.x, d.y)));
}`;

const BLUR = `#version 300 es
precision highp float; in vec2 uv; uniform sampler2D src; uniform vec2 dir; out vec4 o;
void main() {
  vec4 c = texture(src, uv) * 0.2270270270;
  c += (texture(src, uv + dir * 1.3846153846) + texture(src, uv - dir * 1.3846153846)) * 0.3162162162;
  c += (texture(src, uv + dir * 3.2307692308) + texture(src, uv - dir * 3.2307692308)) * 0.0702702703;
  o = c;
}`;

const PRELUDE = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D art, ui, glow, haze, uiglow;
uniform vec2 res; uniform float k, time, frame, grainAmt;
uniform vec3 bg, ghost, c0, c1, c2, c3;
float h12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1, 0)), u.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
// film grain in 2 px cells, re-rolled 8 times a second: per-pixel noise every frame looks the same
// and multiplies the video's bitrate by eight
float grain(vec2 fc) { return (h12(floor(fc / (2.0 * max(1.0, k))) + fract(floor(time * 8.0) * 0.6180339) * 917.0) - 0.5) * grainAmt; }
float vignette(vec2 u, float s) { vec2 d = u - 0.5; return 1.0 - s * dot(d * vec2(1.0, 0.75), d * vec2(1.0, 0.75)) * 2.2; }
vec4 A(vec2 u) { return texture(art, u); }
vec4 U(vec2 u) { return texture(ui, u); }
vec3 over(vec3 under, vec4 top) { return under * (1.0 - top.a) + top.rgb; }
vec3 hue(vec3 c) { float m = max(c.r, max(c.g, c.b)); return c / max(m, 1e-4); }
float lum(vec3 c) { return max(c.r, max(c.g, c.b)); }
vec3 uiLayer(vec3 col, vec2 u, float split, float glowAmt) {
  vec2 s = vec2(split * k, 0.0) / res;
  vec4 m = U(u);
  vec3 c = vec3(U(u + s).r, m.g, U(u - s).b);
  col += texture(uiglow, u).rgb * glowAmt;
  return col * (1.0 - m.a) + c;
}
`;

const LOOKS = {
  halftone: `
vec3 look(vec2 fc) {
  vec2 u = uv;
  float mott = fbm(u * vec2(2.2, 3.6) + 3.1) - 0.5;
  vec3 col = bg * (1.0 + 0.55 * mott) + vec3(0.006) * mott;
  float cell = 6.0 * k;
  vec2 cc = (floor(fc / cell) + 0.5) * cell;
  vec3 g = texture(glow, cc / res).rgb;
  float L = lum(g);
  float rad = cell * 0.5 * clamp(sqrt(L * 3.4), 0.0, 1.08);
  float d = 1.0 - smoothstep(rad - 0.75, rad + 0.75, length(fc - cc));
  col += hue(g) * d * (0.32 + 0.68 * clamp(L * 2.2, 0.0, 1.0)) * 0.95;
  col += texture(haze, u).rgb * 0.22;
  vec2 go = vec2(4.0, -4.0) * k / res;
  col += ghost * A(u - go).a * 0.32;
  vec2 s = vec2(1.6 * k, 0.0) / res;
  vec4 a = A(u);
  col = col * (1.0 - a.a) + vec3(A(u + s).r, a.g, A(u - s).b);
  col = uiLayer(col, u, 1.0, 0.5); // a smaller split than the art's, so small crisp text stays sharp
  col *= vignette(u, 0.55);
  col += grain(fc) * 0.055;
  return col;
}`,
  neon: `
vec3 look(vec2 fc) {
  vec2 u = uv;
  vec3 col = bg * (1.0 + 0.35 * (fbm(u * 3.0) - 0.5));
  col += texture(glow, u).rgb * 1.25 + texture(haze, u).rgb * 0.9;
  vec4 a = A(u);
  col = col * (1.0 - a.a) + a.rgb + a.rgb * 0.35;
  col = uiLayer(col, u, 1.0, 0.7);
  col *= vignette(u, 0.6);
  col += grain(fc) * 0.03;
  return col;
}`,
  led: `
vec3 sceneAt(vec2 u) {
  // light each LED from the glow (smooth, so thin lines never fall between LEDs) plus the line itself
  vec4 a = A(u);
  vec3 g = texture(glow, u).rgb;
  vec3 c = bg + g * 1.6 / (1.0 + lum(g) * 1.2) + texture(haze, u).rgb * 0.3;
  return c * (1.0 - a.a * 0.6) + a.rgb * 0.85;
}
vec3 look(vec2 fc) {
  float cell = 9.0 * k;
  vec2 cc = (floor(fc / cell) + 0.5) * cell;
  vec3 lit = sceneAt(cc / res);
  float d = length(fc - cc) / (cell * 0.5);
  float m = 1.0 - smoothstep(0.62, 0.82, d);
  vec3 col = bg * 0.55 + (lit - bg * 0.55) * m * 1.15 + bg * 0.5 * m;
  col += texture(haze, uv).rgb * 0.35;
  col = uiLayer(col, uv, 0.0, 0.8);
  col *= vignette(uv, 0.5);
  col += grain(fc) * 0.025;
  return col;
}`,
  crt: `
vec3 look(vec2 fc) {
  vec2 p = uv * 2.0 - 1.0;
  p *= 1.0 + vec2(0.035, 0.055) * dot(p, p);
  vec2 u = p * 0.5 + 0.5;
  if (u.x < 0.0 || u.x > 1.0 || u.y < 0.0 || u.y > 1.0) return vec3(0.0);
  vec2 s = vec2(1.5 * k, 0.0) / res;
  vec4 a = A(u);
  vec3 col = bg + texture(glow, u).rgb * 1.2 + texture(haze, u).rgb * 0.7;
  col = col * (1.0 - a.a) + vec3(A(u + s).r, a.g, A(u - s).b) * 1.1;
  vec4 m = U(u);
  col += texture(uiglow, u).rgb * 0.8;
  col = col * (1.0 - m.a) + vec3(U(u + s).r, m.g, U(u - s).b);
  float sl = 0.78 + 0.22 * sin(fc.y * 3.14159 / (1.5 * k));
  col *= sl;
  float ph = mod(floor(fc.x / max(1.0, k)), 3.0);
  col *= ph < 0.5 ? vec3(1.0, 0.82, 0.82) : ph < 1.5 ? vec3(0.82, 1.0, 0.82) : vec3(0.82, 0.82, 1.0);
  float band = fract(time * 0.12);
  col *= 1.0 + 0.07 * smoothstep(0.06, 0.0, abs(u.y - (1.0 - band)));
  col *= 1.0 + 0.015 * sin(time * 50.0);
  vec2 e = abs(p);
  float corner = smoothstep(1.0, 0.96, max(e.x, e.y) + 0.06 * pow(min(e.x, e.y), 6.0));
  col *= vignette(u, 0.9) * corner;
  col += grain(fc) * 0.04;
  return col;
}`,
  riso: `
vec3 look(vec2 fc) {
  vec2 u = uv;
  float fib = fbm(fc * vec2(0.02, 0.08) / k) - 0.5;
  vec3 col = bg * (1.0 + 0.05 * (fbm(u * 6.0) - 0.5) + 0.03 * fib);
  float cell = 7.0 * k;
  mat2 R = mat2(0.866, 0.5, -0.5, 0.866);
  vec2 q = R * fc;
  vec2 cc = (floor(q / cell) + 0.5) * cell;
  float L = clamp(texture(glow, (transpose(R) * cc) / res).a * 2.6, 0.0, 1.0);
  float dt = 1.0 - smoothstep(cell * 0.5 * sqrt(L) - 0.7, cell * 0.5 * sqrt(L) + 0.7, length(q - cc));
  col *= mix(vec3(1.0), ghost, dt * 0.55);
  vec2 go = vec2(5.0, -3.0) * k / res;
  float gh = A(u - go).a;
  col *= mix(vec3(1.0), ghost, gh * 0.5);
  vec4 a = A(u);
  float speck = smoothstep(0.82, 0.9, vnoise(fc * 0.45 / k + 7.0));
  vec3 ink = a.a > 0.0 ? a.rgb / a.a : vec3(1.0);
  col *= mix(vec3(1.0), ink, a.a * (0.92 - 0.6 * speck));
  vec4 m = U(u);
  vec3 uink = m.a > 0.0 ? m.rgb / m.a : vec3(1.0);
  col *= mix(vec3(1.0), ghost, U(u - go * 0.6).a * 0.35);
  col *= mix(vec3(1.0), uink, m.a * 0.95);
  col += grain(fc) * 0.05;
  col *= vignette(u, 0.25);
  return col;
}`,
  blueprint: `
vec3 look(vec2 fc) {
  vec2 u = uv;
  vec3 col = bg * (1.0 + 0.1 * (fbm(u * vec2(3.0, 5.0)) - 0.5));
  vec2 gp = fc / k;
  float minor = 1.0 - smoothstep(0.0, 1.2, min(abs(mod(gp.x, 30.0) - 15.0), abs(mod(gp.y, 30.0) - 15.0)) - 13.8);
  float major = 1.0 - smoothstep(0.0, 1.4, min(abs(mod(gp.x, 150.0) - 75.0), abs(mod(gp.y, 150.0) - 75.0)) - 73.6);
  col += c2 * (minor * 0.05 + major * 0.09);
  col += texture(glow, u).rgb * 0.55 + texture(haze, u).rgb * 0.25;
  vec4 a = A(u);
  col = over(col, a);
  col = uiLayer(col, u, 0.0, 0.35);
  col += grain(fc) * 0.04;
  col *= vignette(u, 0.5);
  return col;
}`,
  dither: `
float bayer(vec2 p) {
  vec2 q = mod(p, 4.0);
  int i = int(q.x) + int(q.y) * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i]) + 0.5) / 16.0;
}
vec3 look(vec2 fc) {
  float px = 4.0 * k;
  vec2 q = floor(fc / px);
  vec2 u = (q + 0.5) * px / res;
  vec4 a = A(u);
  vec3 col = bg + texture(glow, u).rgb * 0.9 + texture(haze, u).rgb * 0.4;
  col = over(col, a);
  vec4 m = U(u);
  col = col * (1.0 - m.a) + m.rgb;
  float l = dot(col, vec3(0.3, 0.55, 0.15));
  float l0 = dot(c0, vec3(0.3, 0.55, 0.15)), l3 = dot(c3, vec3(0.3, 0.55, 0.15));
  float x = clamp((l - l0) / max(1e-3, l3 - l0), 0.0, 1.0) * 3.0;
  float f = floor(x + bayer(q) - 0.5 + 0.5);
  f = clamp(f, 0.0, 3.0);
  return f < 0.5 ? c0 : f < 1.5 ? c1 : f < 2.5 ? c2 : c3;
}`,
  chalk: `
vec3 look(vec2 fc) {
  vec2 u = uv;
  float sm = fbm(u * vec2(2.0, 3.2) + 5.0);
  vec3 col = bg * (1.0 + 0.25 * (sm - 0.5)) + vec3(0.035) * smoothstep(0.55, 0.85, fbm(u * vec2(1.4, 6.0) + 11.0));
  col += texture(haze, u).rgb * 0.35 + texture(glow, u).rgb * 0.15;
  float tex = smoothstep(0.18, 0.75, vnoise(fc * 0.55 / k) * 0.6 + vnoise(fc * 0.13 / k) * 0.5);
  vec4 a = A(u);
  col = col * (1.0 - a.a * tex) + a.rgb * tex;
  vec4 m = U(u);
  float t2 = 0.55 + 0.45 * tex;
  col = col * (1.0 - m.a * t2) + m.rgb * t2;
  col += grain(fc) * 0.06;
  col *= vignette(u, 0.5);
  return col;
}`,
};

const FINAL = (name) => `${PRELUDE}${LOOKS[name] || LOOKS.halftone}
void main() { o = vec4(look(gl_FragCoord.xy), 1.0); }`;

export const LOOK_NAMES = Object.keys(LOOKS);

/**
 * createLook(canvas): a renderer bound to one output canvas.
 *   render(artCanvas, uiCanvas, { look, pal, t, frame })
 */
export function createLook(canvas) {
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
  if (!gl) throw new Error("trame: WebGL2 is not available");
  const W = canvas.width, H = canvas.height, k = Math.min(W, H) / 1080; // the screen's dot pitch follows the short side

  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + "\n" + src.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n"));
    return s;
  };
  const vs = sh(gl.VERTEX_SHADER, VS);
  const prog = (src) => {
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, src));
    gl.bindAttribLocation(p, 0, "p"); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  };
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const tex = (w, h) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  };
  const target = (w, h) => {
    const t = tex(w, h), f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  };
  const q = [Math.max(1, Math.round(W / 4)), Math.max(1, Math.round(H / 4))];
  const e = [Math.max(1, Math.round(W / 8)), Math.max(1, Math.round(H / 8))];
  const T = { art: tex(), ui: tex(), g1: target(...q), g2: target(...q), h1: target(...e), h2: target(...e), u1: target(...q), u2: target(...q) };
  const down = prog(DOWN), blur = prog(BLUR), finals = {};

  const run = (pr, dst, bind) => {
    gl.useProgram(pr.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.f : null);
    gl.viewport(0, 0, dst ? dst.w : W, dst ? dst.h : H);
    bind(pr.u);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  const bindTex = (unit, t, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); };
  const downTo = (src, sw, sh2, dst) => run(down, dst, (u) => { bindTex(0, src, u.src); gl.uniform2f(u.texel, 1 / sw, 1 / sh2); });
  const blurPass = (a, b, r = 1) => {
    run(blur, b, (u) => { bindTex(0, a.t, u.src); gl.uniform2f(u.dir, r / a.w, 0); });
    run(blur, a, (u) => { bindTex(0, b.t, u.src); gl.uniform2f(u.dir, 0, r / a.h); });
  };
  const upload = (t, c) => {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  };
  const v3 = (h) => hexToRgb(h).map((x) => x / 255);

  return {
    gl,
    render(artC, uiC, { look = "halftone", pal, t = 0, frame = 0, grain = 1 }) {
      upload(T.art, artC); upload(T.ui, uiC);
      downTo(T.art, W, H, T.g1); blurPass(T.g1, T.g2, 1.4);
      downTo(T.g1.t, q[0], q[1], T.h1); blurPass(T.h1, T.h2, 2.0); blurPass(T.h1, T.h2, 1.0);
      downTo(T.ui, W, H, T.u1); blurPass(T.u1, T.u2, 1.2);
      const pr = (finals[look] ||= prog(FINAL(look)));
      const lumOf = (h) => { const [r, g, b] = v3(h); return 0.3 * r + 0.55 * g + 0.15 * b; };
      const four = [pal.bg, pal.dim, pal.ink, pal.accent].sort((a, b) => lumOf(a) - lumOf(b));
      run(pr, null, (u) => {
        bindTex(0, T.art, u.art); bindTex(1, T.ui, u.ui); bindTex(2, T.g1.t, u.glow); bindTex(3, T.h1.t, u.haze); bindTex(4, T.u1.t, u.uiglow);
        gl.uniform2f(u.res, W, H); gl.uniform1f(u.k, k); gl.uniform1f(u.time, t); gl.uniform1f(u.frame, frame); gl.uniform1f(u.grainAmt, grain * 0.6);
        gl.uniform3fv(u.bg, v3(pal.bg)); gl.uniform3fv(u.ghost, v3(pal.ghost));
        for (let i = 0; i < 4; i++) if (u["c" + i]) gl.uniform3fv(u["c" + i], v3(four[i]));
      });
    },
  };
}
