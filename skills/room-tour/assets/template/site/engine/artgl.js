// The art layer's WebGL program (design-system.md 4.13): one artwork drawn onto a quad through a projective mapping
// (a homography, never affine), lit by the clip's grey light map and clipped by its canvas mask.
//
//   corners   the quad on screen (CSS px, TL TR BR BL): on the wall it is the tracked canvas; during a lift it flies
//             to an upright rectangle, so the same program draws both
//   wall      the work's place in the frame (frame fractions, TL TR BR BL): where the light map and the canvas mask
//             are read, so the wall's light travels with the work while it lifts and fades out (light → 0)
//   light     the keyed frame (frames.py --key: the canvas is a neutral grey that keeps the room's light), sampled
//             softly (9 taps over ±2 frame px, canvas pixels only), divided by the canvas's median at the stop and
//             clamped to 0.6–1.2, mixed in by `light` (1 on the wall, 0 once lifted)
//   mask      the canvas mask of the frame (frames/<clip>/mask/NNNN.webp): anything in front of a canvas stays in
//             front; mixed in by `maskMix`
//   edges     a 1 px anti-aliased edge, and the paint softened ~0.6 px so it sits in the video, not on it
//
// Works with any Renderer from stage.js (it borrows its context and texture cache).

import { squareToQuad, inv3 } from "./util.js";

const VS = `#version 300 es
in vec2 aPos;
uniform vec4 uRect;
uniform vec2 uView;
void main() {
  vec2 p = uRect.xy + aPos * uRect.zw;
  vec2 c = p / uView * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
uniform vec2 uView;
uniform mat3 uHinv;
uniform mat3 uWall;
uniform sampler2D uArt, uL0, uL1, uM0, uM1;
uniform vec2 uLw;
uniform float uMaskOn, uLight, uMaskMix, uNorm, uAlpha, uRadius, uSoft;
uniform vec2 uTexel;
uniform vec4 uClip;
out vec4 o;
vec2 warp(mat3 m, vec2 p) { vec3 q = m * vec3(p, 1.0); return q.xy / q.z; }
float sdRound(vec2 p, vec4 r, float rad) {
  vec2 c = r.xy + r.zw * 0.5;
  vec2 q = abs(p - c) - (r.zw * 0.5 - vec2(rad));
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
}
float maskAt(vec2 f) { return uLw.x * texture(uM0, f).r + uLw.y * texture(uM1, f).r; }
float lightAt(vec2 f) { return dot(uLw.x * texture(uL0, f).rgb + uLw.y * texture(uL1, f).rgb, vec3(0.3333)); }
void main() {
  vec2 px = vec2(gl_FragCoord.x, uView.y - gl_FragCoord.y);
  vec2 uv = warp(uHinv, px);
  vec2 fw = max(fwidth(uv), vec2(1e-6));
  vec2 e = min(uv, 1.0 - uv) / fw;
  float cov = clamp(min(e.x, e.y) + 0.5, 0.0, 1.0);
  if (cov <= 0.0) discard;
  vec2 dx = dFdx(uv) * uSoft, dy = dFdy(uv) * uSoft;
  vec2 tc = clamp(uv, 0.0, 1.0);
  vec4 art = 0.25 * (texture(uArt, tc + dx + dy) + texture(uArt, tc - dx - dy) + texture(uArt, tc + dx - dy) + texture(uArt, tc - dx + dy));
  vec2 f = warp(uWall, tc);
  float light = 1.0, m = 1.0;
  if (uLight > 0.001) {
    float sl = 0.0, sw = 0.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = f + vec2(float(i), float(j)) * uTexel * 2.0;
      float w = uMaskOn > 0.5 ? maskAt(g) + 0.002 : 1.0;
      sl += lightAt(g) * w; sw += w;
    }
    light = mix(1.0, clamp((sl / max(sw, 1e-4)) / max(uNorm, 1e-3), 0.6, 1.2), uLight);
  }
  if (uMaskOn > 0.5 && uMaskMix > 0.001) m = mix(1.0, maskAt(f), uMaskMix);
  float clipA = clamp(0.5 - sdRound(px, uClip, uRadius), 0.0, 1.0);
  float a = cov * art.a * m * uAlpha * clipA;
  o = vec4(art.rgb * light * a, a);
}`;

export class ArtGL {
  /** @param r a Renderer (stage.js) whose context and texture cache this borrows */
  constructor(r) {
    this.r = r;
    this.ok = false;
    this.art = new Map();
    if (r.ok) this.init();
  }

  init() {
    const gl = (this.gl = this.r.gl);
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = (this.prog = gl.createProgram());
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this.u = {};
    for (const n of ["uRect", "uView", "uHinv", "uWall", "uArt", "uL0", "uL1", "uM0", "uM1", "uLw", "uMaskOn", "uLight", "uMaskMix", "uNorm", "uAlpha", "uRadius", "uSoft", "uTexel", "uClip"]) this.u[n] = gl.getUniformLocation(p, n);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.ok = true;
  }

  /** the artwork's texture, mipmapped (a 2000 px work drawn 300 px wide stays clean) */
  artTex(img) {
    const gl = this.gl;
    let t = this.art.get(img);
    if (!t) {
      t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.art.set(img, t);
    }
    return t;
  }

  /**
   * draws one work. o = { img, corners: [[x, y] × 4] CSS px, wall: [x0, y0, … x3, y3] frame fractions, lights: [{ img,
   * w }] (up to 2), masks: [img | null] (same order), norm (0–1), light (0–1), maskMix (0–1), alpha, clip: [x, y, w, h]
   * CSS px, radius, soft (px, default 0.3), texel: [1 / frame w, 1 / frame h] }
   */
  draw(o) {
    if (!this.ok || !o.img) return;
    const gl = this.gl, u = this.u, r = this.r, d = r.dpr || 1;
    const W = gl.canvas.width, H = gl.canvas.height;
    const dev = o.corners.map(([x, y]) => [x * d, y * d]);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of dev) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    x0 = Math.max(0, Math.floor(x0) - 2); y0 = Math.max(0, Math.floor(y0) - 2); x1 = Math.min(W, Math.ceil(x1) + 2); y1 = Math.min(H, Math.ceil(y1) + 2);
    if (x1 <= x0 || y1 <= y0) return;
    const hinv = inv3(squareToQuad(dev.flat()));
    const wall = squareToQuad(o.wall ?? [0, 0, 1, 0, 1, 1, 0, 1]);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    gl.uniform4f(u.uRect, x0, y0, x1 - x0, y1 - y0);
    gl.uniform2f(u.uView, W, H);
    gl.uniformMatrix3fv(u.uHinv, true, new Float32Array(hinv));
    gl.uniformMatrix3fv(u.uWall, true, new Float32Array(wall));
    const lights = (o.lights ?? []).filter((l) => l?.img).slice(0, 2);
    const sum = lights.reduce((a, l) => a + l.w, 0) || 1;
    // the unit is made active before the texture is fetched: creating a texture binds it to the active unit, which
    // would otherwise replace the previous unit's binding on the first draw (and only then: ?record's same-pixels rule)
    const bind = (unit, name, get) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, get()); gl.uniform1i(u[name], unit); };
    bind(0, "uArt", () => this.artTex(o.img));
    bind(1, "uL0", () => (lights[0] ? r.tex(lights[0].img) : r.white));
    bind(2, "uL1", () => (lights[1] ? r.tex(lights[1].img) : r.white));
    const masks = o.masks ?? [];
    const maskOn = lights.length > 0 && lights.every((_, i) => masks[i]);
    bind(3, "uM0", () => (maskOn ? r.tex(masks[0]) : r.white));
    bind(4, "uM1", () => (maskOn && masks[1] ? r.tex(masks[1]) : r.white));
    gl.uniform2f(u.uLw, lights[0] ? lights[0].w / sum : 1, lights[1] ? lights[1].w / sum : 0);
    gl.uniform1f(u.uMaskOn, maskOn ? 1 : 0);
    gl.uniform1f(u.uLight, lights.length ? o.light ?? 1 : 0);
    gl.uniform1f(u.uMaskMix, o.maskMix ?? 1);
    gl.uniform1f(u.uNorm, o.norm ?? 0.36);
    gl.uniform1f(u.uAlpha, o.alpha ?? 1);
    gl.uniform1f(u.uSoft, o.soft ?? 0.3);
    gl.uniform2f(u.uTexel, o.texel?.[0] ?? 1 / 1600, o.texel?.[1] ?? 1 / 900);
    const c = o.clip ?? [0, 0, W / d, H / d];
    gl.uniform4f(u.uClip, c[0] * d, c[1] * d, c[2] * d, c[3] * d);
    gl.uniform1f(u.uRadius, Math.max(0, Math.min((o.radius ?? 0) * d, (Math.min(c[2], c[3]) * d) / 2)));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }
}
