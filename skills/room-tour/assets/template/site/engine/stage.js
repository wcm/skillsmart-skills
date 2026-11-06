// The stage (design-system.md 3.1): WebGL2 draws the walk's pictures cover-fit into a rect R with a focus point, and
// everything else on the page maps frame fractions to the screen through the same toScreen().
//
//   R          the viewport, or the gallery's growing window (title.window), or the furniture's inset frame
//   pictures   a stop's frame, a move's web frame (with the scroll-driven join between two clips of a move), a 120 ms
//              clock cross-fade when a move starts from a stop, the sharp 2560 px still after 250 ms at rest, the
//              recolour (a second picture inside a mask), the cut's rising sheet; in ?record, frame blending between
//              the two nearest full-rate frames
//   occluder   a second canvas above the title that draws the same pictures through title.occluder.masks
//   passes     stage.addPass({ draw(info) }) draws more WebGL after the pictures (the art layer, step 8)

import { clamp, lerp, ease, dev, numbered, phoneDir, loadImage, warn } from "./util.js";
import { Fade } from "./clock.js";

const VS = `#version 300 es
in vec2 aPos;
uniform vec4 uDst;
uniform vec2 uView;
out vec2 vUv;
void main() {
  vUv = aPos;
  vec2 p = uDst.xy + aPos * uDst.zw;
  vec2 c = p / uView * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uT0, uT1, uT2, uT3;
uniform vec4 uW;
uniform float uAlpha, uDark;
uniform vec4 uClip;
uniform float uRadius;
uniform vec2 uView;
uniform sampler2D uM0, uM1;
uniform float uMaskOn, uMaskMix;
uniform vec2 uFeather;
out vec4 o;
float sdRound(vec2 p, vec4 r, float rad) {
  vec2 c = r.xy + r.zw * 0.5;
  vec2 q = abs(p - c) - (r.zw * 0.5 - vec2(rad));
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
}
float maskAt(vec2 uv) { return mix(texture(uM0, uv).r, texture(uM1, uv).r, uMaskMix); }
void main() {
  vec3 c = texture(uT0, vUv).rgb * uW.x;
  if (uW.y > 0.0) c += texture(uT1, vUv).rgb * uW.y;
  if (uW.z > 0.0) c += texture(uT2, vUv).rgb * uW.z;
  if (uW.w > 0.0) c += texture(uT3, vUv).rgb * uW.w;
  c *= 1.0 - uDark;
  vec2 px = vec2(gl_FragCoord.x, uView.y - gl_FragCoord.y);
  float a = uAlpha * clamp(0.5 - sdRound(px, uClip, uRadius), 0.0, 1.0);
  if (uMaskOn > 0.5) {
    float m = 0.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      float w = (2.0 - abs(float(i))) * (2.0 - abs(float(j)));
      m += maskAt(vUv + vec2(float(i), float(j)) * uFeather) * w;
    }
    a *= m / 16.0;
  }
  o = vec4(c * a, a);
}`;

/** one WebGL2 canvas: a texture cache and one draw call for every picture layer */
export class Renderer {
  constructor(canvas, { preserve = false } = {}) {
    this.canvas = canvas;
    this.preserve = preserve;
    this.cache = new Map();
    this.uses = 0;
    this.max = 20;
    this.init();
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.ok = false; warn("WebGL context lost"); });
    canvas.addEventListener("webglcontextrestored", () => { this.cache.clear(); this.init(); this.onrestore?.(); });
  }

  init() {
    const gl = (this.gl = this.canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: this.preserve, powerPreference: "high-performance" }));
    if (!gl) { this.ok = false; this.ctx2d = this.canvas.getContext("2d"); warn("no WebGL2: drawing the stage with a plain 2D canvas (no masks)"); return; }
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
    for (const n of ["uDst", "uView", "uT0", "uT1", "uT2", "uT3", "uW", "uAlpha", "uDark", "uClip", "uRadius", "uM0", "uM1", "uMaskOn", "uMaskMix", "uFeather"]) this.u[n] = gl.getUniformLocation(p, n);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const one = (rgba) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
      return t;
    };
    this.black = one([0, 0, 0, 255]);
    this.white = one([255, 255, 255, 255]);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.ok = true;
  }

  /** canvas size in CSS px × dpr */
  size(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
    if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
  }

  /** the texture of an image (uploaded once, kept in a small LRU cache) */
  tex(img, mip = false) {
    const gl = this.gl;
    let e = this.cache.get(img);
    if (!e) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      if (mip) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      e = { t };
      this.cache.set(img, e);
      if (this.cache.size > this.max) {
        let oldest = null;
        for (const [k, v] of this.cache) if (k !== img && (!oldest || v.used < oldest[1].used)) oldest = [k, v];
        if (oldest) { gl.deleteTexture(oldest[1].t); this.cache.delete(oldest[0]); }
      }
    }
    e.used = ++this.uses;
    return e.t;
  }

  clear() {
    if (this.ok) { const gl = this.gl; gl.viewport(0, 0, this.canvas.width, this.canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    else this.ctx2d?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * one picture layer: up to four images mixed by weight, drawn into `dst` (CSS px), clipped to `clip` with `radius`,
   * darkened by `dark`, faded by `alpha`, optionally through a mask (two mask images mixed by maskMix; frame space)
   */
  draw({ imgs, weights, dst, clip, radius = 0, alpha = 1, dark = 0, mask = null, maskMix = 0, feather = 0, mip = false }) {
    const d = this.dpr;
    if (!this.ok) {
      const c = this.ctx2d;
      if (!c || mask) return;
      c.save();
      c.beginPath();
      c.roundRect?.(clip[0] * d, clip[1] * d, clip[2] * d, clip[3] * d, radius * d);
      c.clip();
      let acc = 0;
      imgs.forEach((im, i) => {
        const w = weights[i];
        if (!im || w <= 0) return;
        acc += w;
        c.globalAlpha = alpha * (w / acc);
        c.drawImage(im, dst[0] * d, dst[1] * d, dst[2] * d, dst[3] * d);
      });
      if (dark > 0) { c.globalAlpha = alpha * dark; c.fillStyle = "#000"; c.fillRect(clip[0] * d, clip[1] * d, clip[2] * d, clip[3] * d); }
      c.restore();
      return;
    }
    const gl = this.gl, u = this.u;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(u.uView, this.canvas.width, this.canvas.height);
    gl.uniform4f(u.uDst, dst[0] * d, dst[1] * d, dst[2] * d, dst[3] * d);
    gl.uniform4f(u.uClip, clip[0] * d, clip[1] * d, clip[2] * d, clip[3] * d);
    gl.uniform1f(u.uRadius, Math.max(0, Math.min(radius * d, (Math.min(clip[2], clip[3]) * d) / 2)));
    gl.uniform1f(u.uAlpha, alpha);
    gl.uniform1f(u.uDark, dark);
    const w = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      const im = imgs[i];
      gl.bindTexture(gl.TEXTURE_2D, im ? this.tex(im, mip) : this.black);
      w[i] = im ? weights[i] : 0;
      gl.uniform1i(u[`uT${i}`], i);
    }
    const sum = w[0] + w[1] + w[2] + w[3] || 1;
    gl.uniform4f(u.uW, w[0] / sum, w[1] / sum, w[2] / sum, w[3] / sum);
    gl.uniform1f(u.uMaskOn, mask ? 1 : 0);
    for (let i = 0; i < 2; i++) {
      gl.activeTexture(gl.TEXTURE4 + i);
      gl.bindTexture(gl.TEXTURE_2D, mask?.[i] ? this.tex(mask[i]) : this.white);
      gl.uniform1i(u[`uM${i}`], 4 + i);
    }
    gl.uniform1f(u.uMaskMix, mask?.[1] ? maskMix : 0);
    gl.uniform2f(u.uFeather, feather / Math.max(1, dst[2]), feather / Math.max(1, dst[3]));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

const key = (pics) => pics.map((q) => `${q.seq?.dir}#${q.web}`).join("|");

export class Stage {
  /**
   * @param o.canvas, o.occCanvas   the stage canvas and the occluder canvas
   * @param o.tl                    Timeline; o.d normalized tour.json; o.clock; o.base (URL base for images)
   */
  constructor(o) {
    Object.assign(this, { tl: o.tl, d: o.d, clock: o.clock, record: o.record, blend: o.blend ?? o.record, reduced: o.reduced, base: o.base ?? "" });
    this.gl = new Renderer(o.canvas, { preserve: o.record });
    this.occ = o.occCanvas ? new Renderer(o.occCanvas, { preserve: o.record }) : null;
    this.gl.onrestore = () => this.invalidate();
    this.passes = [];
    this.map = null;
    this.dirty = true;
    this.join = { from: null, k: new Fade(o.clock, 1) };  // the clock cross-fade at a stop (120 ms)
    this.cutFade = new Fade(o.clock, 0);                   // reduced motion: the cut is a 200 ms cross-fade
    this.still = new Fade(o.clock, 0);
    this.rc = null;                                        // recolour
    this.lastKey = "";
    this.picSince = 0;
    this.prevSeg = null;
    this.passFrame = 0;
    this.drawn = [];
    this.occAlpha = 0;
    this.stats = { paints: 0, wanted: 0, exact: 0, off: 0, shown: new Set(), asked: new Set(), ms: [] };
    const first = Object.values(this.tl.moves).flatMap((g) => g.clips).find((c) => c.seq)?.seq;
    this.fw = first?.size?.[0] ?? 1600;
    this.fh = first?.size?.[1] ?? 900;
    this.stills = {};
    this.masks = [];
  }

  invalidate() { this.dirty = true; }

  /** loads the sharp stills (only stops with sharp: true) and the occluder masks; resolves when all have loaded */
  async loadExtras(phone) {
    const jobs = [];
    for (const [id, st] of Object.entries(this.d.stops)) {
      if (!st.sharp) continue;
      const src = phone ? st.stillPhone ?? dev(st.still, true) : dev(st.still, false);
      if (!src) { warn(`stops.${id}.sharp is true but it has no still`); continue; }
      jobs.push(loadImage(this.base + src).then((im) => { this.stills[id] = im; this.invalidate(); }));
    }
    const occ = this.d.title.occluder;
    if (occ?.masks) {
      const [a, b] = occ.frames ?? [1, 1];
      const pattern = phone ? phoneDir(occ.masks) : occ.masks;
      this.maskFrames = [a, b];
      for (let n = a; n <= b; n++) jobs.push(loadImage(this.base + numbered(pattern, n)).then((im) => { this.masks[n] = im; this.invalidate(); }));
    }
    await Promise.all(jobs);
  }

  /** the canvases follow the stage's size */
  layout(vw, vh, dpr) {
    this.vw = vw; this.vh = vh; this.dpr = dpr;
    this.gl.size(vw, vh, dpr);
    this.occ?.size(vw, vh, dpr);
    this.invalidate();
  }

  // ——— where things are ———

  /** R: the rect the pictures cover (3.1) */
  rectAt(state) {
    const { vw, vh } = this;
    let R = { x: 0, y: 0, w: vw, h: vh, r: 0 };
    const win = this.d.title.window;
    if (win) {
      const box = dev(win, state.phone) ?? win.desktop;
      const k = ease.inout(clamp(state.screens / (win.grow ?? 0.45)));
      if (box && k < 1) {
        const [x, y, w, h] = box;
        R = { x: lerp(x * vw, 0, k), y: lerp(y * vh, 0, k), w: lerp(w * vw, vw, k), h: lerp(h * vh, vh, k), r: lerp(win.radius ?? 0, 0, k) };
      }
    }
    const fr = this.d.theme.frame;
    if (fr?.kind === "inset") {
      const tl = this.tl;
      const k = ease.inout(clamp((state.screens - tl.W) / Math.min(1, tl.E || 1)));
      const ins = (dev(fr.inset, state.phone) ?? 12) * (1 - k), rad = (dev(fr.radius, state.phone) ?? 10) * (1 - k);
      R = { x: R.x + ins, y: R.y + ins, w: R.w - 2 * ins, h: R.h - 2 * ins, r: Math.max(R.r, rad) };
    }
    return R;
  }

  focusAt(state) {
    const d = this.d, seg = state.seg;
    const f = (id) => d.stops[id]?.focus ?? [0.5, 0.5];
    if (seg.kind === "move") {
      const keys = seg.ref.focusKeys;
      const t = state.move?.t ?? 0;
      if (keys?.length) {
        if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
        for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
          const [t0, x0, y0] = keys[i - 1], [t1, x1, y1] = keys[i], k = (t - t0) / (t1 - t0 || 1);
          return [lerp(x0, x1, k), lerp(y0, y1, k)];
        }
        const l = keys[keys.length - 1];
        return [l[1], l[2]];
      }
      const a = f(seg.from), b = f(seg.to), k = ease.inout(t);
      return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
    }
    if (seg.kind === "cut") return f((state.cut?.k ?? 0) < 0.3 ? seg.from : seg.to);
    if (seg.kind === "end") return f(state.last);
    return f(seg.id);
  }

  /** cover-fit with focus into R (3.1); offsets land on device pixels so a 1:1 frame stays sharp */
  mappingFor(R, focus) {
    const s = Math.max(R.w / this.fw, R.h / this.fh);
    const dw = this.fw * s, dh = this.fh * s, d = this.dpr || 1;
    const ox = Math.round((R.x + clamp(R.w / 2 - focus[0] * dw, R.w - dw, 0)) * d) / d;
    const oy = Math.round((R.y + clamp(R.h / 2 - focus[1] * dh, R.h - dh, 0)) * d) / d;
    return { R, s, dw, dh, ox, oy, focus };
  }

  /** frame fractions → viewport px, with the current mapping (or a given one) */
  toScreen([x, y], m = this.map) {
    if (!m) return [0, 0];
    return [m.ox + x * m.dw, m.oy + y * m.dh];
  }
  fromScreen([px, py], m = this.map) {
    if (!m) return [0, 0];
    return [(px - m.ox) / m.dw, (py - m.oy) / m.dh];
  }

  // ——— what to draw ———

  /** the base pictures for a state: [{ seq, web (fractional), w }] (before blending) */
  picsFor(state) {
    const seg = state.seg, tl = this.tl;
    if (seg.kind === "move") {
      const f = state.move?.frame;
      if (!f) { const s = tl.stopPic(seg.from); return s ? [{ ...s, w: 1 }] : []; }
      if (f.join) return [{ seq: f.seq, web: f.web, src: f.src, w: 1 - f.join.mix }, { seq: f.join.seq, web: f.join.web, src: f.join.src, w: f.join.mix }];
      return [{ seq: f.seq, web: f.web, src: f.src, w: 1 }];
    }
    if (seg.kind === "cut") { const s = tl.stopPic(seg.from); return s ? [{ ...s, w: 1 }] : []; }
    const id = seg.kind === "end" ? state.last : seg.id;
    const s = tl.stopPic(id);
    return s ? [{ ...s, w: 1 }] : [];
  }

  /** whole frames: with the recording frames (?record, ?rec) a fractional frame blends its two neighbours (6.1);
   *  otherwise the nearest frame */
  expand(pics) {
    const out = [];
    for (const q of pics) {
      if (!q.seq || q.w <= 0) continue;
      if (this.blend) {
        const a = Math.floor(q.web + 1e-6), b = Math.min(q.seq.count - 1, a + 1), f = clamp(q.web - a);
        if (f < 1e-4 || a === b) out.push({ seq: q.seq, i: a, w: q.w });
        else { out.push({ seq: q.seq, i: a, w: q.w * (1 - f) }); out.push({ seq: q.seq, i: b, w: q.w * f }); }
      } else out.push({ seq: q.seq, i: Math.round(q.web), w: q.w });
    }
    return out;
  }

  /** the stop whose picture is on screen at rest (a stop, the title, or the last stop under the end) */
  restStop(state) {
    const k = state.seg.kind;
    return k === "title" || k === "stop" ? state.seg.id : k === "end" ? state.last : null;
  }

  /** logic for one engine step (clock fades); runs in record replays too, so no drawing here */
  step(state) {
    const now = this.clock.now();
    const R = this.rectAt(state);
    const focus = this.focusAt(state);
    this.map = this.mappingFor(R, focus);
    const pics = this.expand(this.picsFor(state));
    const k = key(pics.map((q) => ({ seq: q.seq, web: q.i })));
    const seg = state.seg;
    // a move that starts from a stop (or any jump between clips that aren't joined by scroll) cross-fades 120 ms;
    // a cut makes its own transition
    if (this.pics && k !== this.lastKey) {
      const cutting = seg.kind === "cut" || this.prevSeg?.kind === "cut";
      const continuous = cutting || pics.some((q) => this.pics.some((r) => r.seq === q.seq));
      if (!continuous && !this.clock.instant) { this.join.from = this.pics; this.join.k.snap(0).to(1, 120, "linear"); }
      this.picSince = now;
    }
    if (this.join.k.done) this.join.from = null;
    this.lastKey = k;
    this.pics = pics;
    this.prevSeg = seg;
    // reduced motion: the cut is a 200 ms cross-fade at its middle
    if (seg.kind === "cut" && this.reduced) this.cutFade.to(state.cut.k >= 0.5 ? 1 : 0, 200, "linear");
    else this.cutFade.snap(seg.kind === "cut" ? (state.cut.k >= 0.5 ? 1 : 0) : 0);
    // the sharp still: after 250 ms with the picture at rest on a sharp stop; out at once when the next move starts
    const rs = this.restStop(state);
    const sharp = rs && this.d.stops[rs]?.sharp && this.stills[rs];
    if (sharp && now - this.picSince >= 250) this.still.to(1, 300, "linear");
    else if (!sharp || seg.kind === "move") this.still.to(0, 120, "linear");
    this.stillStop = sharp ? rs : this.still.value > 0 ? this.stillStop : null;
    // the recolour shows at its stop only
    if (this.rc) {
      this.rc.here.to(!this.rc.stop || this.rc.stop === rs ? 1 : 0, 300, "inout");
      if (this.rc.prev && this.rc.fade.done) this.rc.prev = null;
    }
    this.state = state;
  }

  /** every image the current state needs (record mode waits for all of them before painting, 6.1) */
  needs(state) {
    const out = [];
    const add = (pics) => { for (const q of this.expand(pics)) out.push(q.seq.ensure(q.i)); };
    add(this.picsFor(state));
    if (this.join.from) for (const q of this.join.from) out.push(q.seq.ensure(q.i));
    if (state.seg.kind === "cut") { const s = this.tl.sheetPic(state.seg.id); if (s) add([{ ...s, w: 1 }]); }
    const wait = (im) => (im && !im.complete ? new Promise((r) => { im.addEventListener("load", r, { once: true }); im.addEventListener("error", r, { once: true }); }) : null);
    if (this.rc) for (const im of [this.rc.src, this.rc.mask, this.rc.prev?.src, this.rc.prev?.mask]) out.push(wait(im));
    return Promise.all(out);
  }

  /** draw the current state */
  render(state = this.state) {
    if (!state || !this.map) return;
    const t0 = performance.now();
    const gl = this.gl, m = this.map, R = m.R;
    const seg = state.seg;
    // the pictures, as [img, weight] (the nearest loaded frame outside record mode)
    const imgsOf = (pics, stat) => {
      const out = [];
      for (const q of pics) {
        let i = q.i;
        if (!this.record) {
          const n = q.seq.nearest(i);
          if (stat && q === pics[0]) { this.stats.wanted++; this.stats.asked.add(`${q.seq.dir}#${i}`); if (n === i) this.stats.exact++; else if (n >= 0) this.stats.off += Math.abs(n - i); }
          if (n < 0) continue;
          i = n;
          if (stat && q === pics[0]) this.stats.shown.add(`${q.seq.dir}#${i}`);
        } else if (!q.seq.ok(i)) { const n = q.seq.nearest(i); if (n < 0) continue; i = n; }
        out.push({ img: q.seq.images[i], w: q.w, seq: q.seq, i });
      }
      return out;
    };
    let base = imgsOf(this.pics ?? [], seg.kind === "move");
    const jk = this.join.k.value;
    if (this.join.from && jk < 1) {
      const from = imgsOf(this.join.from).map((x) => ({ ...x, w: x.w * (1 - jk) }));
      base = [...from, ...base.map((x) => ({ ...x, w: x.w * jk }))];
    }
    // at most four textures in one draw: keep the heaviest
    if (base.length > 4) base = base.sort((a, b) => b.w - a.w).slice(0, 4);
    const still = this.still.value, rc = this.rc, rcA = rc ? rc.fade.value * rc.here.value : 0;
    const rcP = rc?.prev ? rc.prev.a * rc.here.value : 0;
    const cut = seg.kind === "cut" ? state.cut : null;
    const sk = [base.map((x) => `${x.seq.dir}${x.i}:${x.w.toFixed(4)}`).join(), R.x, R.y, R.w, R.h, R.r, m.ox, m.oy, m.dw, still.toFixed(3), rcA.toFixed(3), rcP.toFixed(3),
      cut ? cut.k.toFixed(4) + this.cutFade.value : "", this.occAlpha.toFixed(3), this.passes.length ? ++this.passFrame : ""].join("/");
    if (sk === this.sceneKey && !this.dirty) return;
    this.sceneKey = sk;
    this.dirty = false;
    gl.clear();
    const clip = [R.x, R.y, R.w, R.h];
    const dst = (mm, dy = 0) => [mm.ox, mm.oy + dy, mm.dw, mm.dh];
    const layer = (r, list, mm, o = {}) => list.length && r.draw({ imgs: list.map((x) => x.img), weights: list.map((x) => x.w), dst: dst(mm, o.dy), clip, radius: R.r, alpha: o.alpha ?? 1, dark: o.dark ?? 0, mask: o.mask, maskMix: o.maskMix, feather: o.feather, mip: o.mip });
    if (cut) {
      // the cut (4.11): the next stop's picture rises as a sheet; the old one drifts up 10 % and darkens to .6
      const sheet = this.tl.sheetPic(seg.id);
      const sheetImgs = sheet ? imgsOf(this.expand([{ ...sheet, w: 1 }])) : [];
      const toMap = this.mappingFor(R, this.d.stops[seg.to]?.focus ?? [0.5, 0.5]);
      const fromMap = this.mappingFor(R, this.d.stops[seg.from]?.focus ?? [0.5, 0.5]);
      if (this.reduced) {
        const f = this.cutFade.value;
        if (f < 1) layer(gl, base, fromMap);
        if (f > 0) layer(gl, sheetImgs, toMap, { alpha: f });
      } else {
        const e = ease.inout(clamp(cut.k / 0.6));
        layer(gl, base, fromMap, { dy: -0.1 * R.h * e, dark: 0.6 * e });
        if (e > 0) {
          const top = R.y + R.h * (1 - e);
          gl.draw({ imgs: sheetImgs.map((x) => x.img), weights: sheetImgs.map((x) => x.w), dst: dst(toMap, R.h * (1 - e)), clip: [R.x, top, R.w, R.y + R.h - top], radius: 0 });
        }
        state.cut.sheetTop = R.y + R.h * (1 - e);
      }
    } else {
      layer(gl, base, m);
      const rs = this.stillStop;
      if (still > 0 && rs && this.stills[rs]) layer(gl, [{ img: this.stills[rs], w: 1 }], m, { alpha: still, mip: true });
      const ready = (im) => im && im.complete && im.naturalWidth > 0;
      if (rc?.prev && ready(rc.prev.src) && ready(rc.prev.mask)) layer(gl, [{ img: rc.prev.src, w: 1 }], m, { alpha: rc.prev.a * rc.here.value, mask: [rc.prev.mask], feather: rc.prev.feather ?? 0, mip: true });
      if (rcA > 0 && ready(rc.src) && ready(rc.mask)) layer(gl, [{ img: rc.src, w: 1 }], m, { alpha: rcA, mask: [rc.mask], feather: rc.feather ?? 0, mip: true });
    }
    this.drawn = base;
    this.view = this.viewOf(base, state);
    for (const p of this.passes) p.draw({ renderer: gl, gl: gl.gl, map: m, pics: base, state, toScreen: (q) => this.toScreen(q, m), dpr: this.dpr, stage: this });
    this.renderOcc(state, base, layer);
    this.stats.paints++;
    if (this.stats.ms.length < 2000) this.stats.ms.push(performance.now() - t0);
  }

  /**
   * what is on screen right now (extension point): the picture with the most weight, as the clip it belongs to, its
   * (fractional, in ?record) web frame and source frame, plus every drawn picture. Tracked tags and art quads must use
   * this, not the wanted frame: outside ?record the stage shows the nearest frame that has loaded.
   */
  viewOf(base, state) {
    const by = new Map();
    for (const x of base) {
      const e = by.get(x.seq) ?? { seq: x.seq, w: 0, web: 0, src: 0 };
      e.w += x.w; e.web += x.w * x.i; e.src += x.w * x.seq.map[x.i];
      by.set(x.seq, e);
    }
    let top = null;
    for (const e of by.values()) if (!top || e.w > top.w) top = e;
    const clipOf = (seq) => {
      for (const g of Object.values(this.tl.moves)) { const i = g.clips.findIndex((c) => c.seq === seq); if (i >= 0) return { move: g.id, clip: i, path: g.clips[i].path }; }
      return { move: null, clip: -1, path: seq?.dir ?? null };
    };
    const pics = [...by.values()].map((e) => ({ ...clipOf(e.seq), seq: e.seq, w: e.w, web: e.web / (e.w || 1), src: e.src / (e.w || 1) }));
    const v = top ? pics.find((q) => q.seq === top.seq) : null;
    return { move: v?.move ?? null, clip: v?.clip ?? -1, path: v?.path ?? null, seq: v?.seq ?? null, web: v?.web ?? 0, src: v?.src ?? 0,
      exact: !this.record || base.every((x) => x.seq.ok(x.i)), pics, map: this.map, segment: state.seg.id };
  }

  /** the occluder (4.3): the same pictures through the title's masks, above the title */
  renderOcc(state, base, layer) {
    const r = this.occ;
    if (!r) return;
    const a = this.occAlpha;
    if (!(a > 0) || !this.masks.length) { if (this.occDrawn) { r.clear(); this.occDrawn = false; } return; }
    const [lo, hi] = this.maskFrames;
    // which mask: move 1's first clip, by its published web frame (masks follow the 1600 px set's numbering)
    let w = 0;
    const seg = state.seg, mv1 = this.tl.d.walk[1];
    if (seg.kind === "move" && seg.id === mv1 && state.move?.frame && state.move.frame.clip === 0) {
      const f = state.move.frame, pub = this.pubSeq ?? f.seq;
      w = pub.webAt(f.src);
    } else if (seg.kind !== "title") w = Infinity;
    const n = clamp(w + 1, lo, hi), a0 = Math.floor(n), b0 = Math.min(hi, a0 + 1);
    const m0 = this.masks[a0] ?? this.masks[hi], m1 = this.masks[b0] ?? m0;
    r.clear();
    const still = this.still.value;
    layer(r, base, this.map, { alpha: a, mask: [m0, m1], maskMix: n - a0, feather: this.d.title.occluder.feather ?? 1.5 });
    if (still > 0 && this.stillStop && this.stills[this.stillStop]) layer(r, [{ img: this.stills[this.stillStop], w: 1 }], this.map, { alpha: a * still, mask: [m0, m1], maskMix: n - a0, feather: this.d.title.occluder.feather ?? 1.5, mip: true });
    this.occDrawn = true;
  }

  // ——— the API layers use ———

  /**
   * cross-fades a second picture over the current stop picture inside a mask (3.1). `src`, `mask`: URLs or images;
   * `opacity` 0 fades it out; `stop`: only at that stop (it fades out when the walk leaves and back when it returns).
   */
  setRecolour({ src, mask, opacity = 1, ms = 300, stop = null, feather = 0, ease: e = "inout" } = {}) {
    // synchronous on purpose: the fade starts now (so ?record replays it at the same clock time); the pictures load
    // on their own (cached by URL) and the stage draws the recolour once they have (record mode waits for them)
    const img = (x) => (typeof x === "string" ? this.image(x) : x);
    if (!this.rc) this.rc = { fade: new Fade(this.clock, 0), here: new Fade(this.clock, 0), prev: null };
    const rc = this.rc;
    if (src || mask) {
      const s = src ? img(src) : rc.src, k = mask ? img(mask) : rc.mask;
      if (rc.src && s !== rc.src && rc.fade.value * rc.here.value > 0.001) {
        // a new picture over an old one: the old one stays under it until the new one is in (oat → plum, no rust between)
        rc.prev = { src: rc.src, mask: rc.mask, a: rc.fade.value * rc.here.value, feather: rc.feather };
        rc.fade.snap(0);
      }
      rc.src = s; rc.mask = k;
    }
    rc.stop = stop;
    rc.feather = feather;
    rc.here.snap(!stop || stop === this.restStop(this.state ?? { seg: { kind: "" } }) ? 1 : 0);
    if (opacity <= 0) rc.prev = null;
    rc.fade.to(opacity, ms, e);
    this.invalidate();
    return Promise.all([rc.src, rc.mask].map((im) => (im && !im.complete ? new Promise((r) => { im.addEventListener("load", r, { once: true }); im.addEventListener("error", r, { once: true }); }) : null)));
  }

  /** an image by URL, loaded once and kept (recolour pictures and masks) */
  image(url) {
    this.images ??= new Map();
    let im = this.images.get(url);
    if (!im) {
      im = new Image();
      im.decoding = "async";
      im.addEventListener("load", () => this.invalidate(), { once: true });
      im.addEventListener("error", () => console.warn(`[tour] couldn't load ${url}`), { once: true });
      im.src = this.base + url;
      this.images.set(url, im);
    }
    return im;
  }

  /** a WebGL pass drawn after the pictures each paint: { draw(info) }, info = { renderer, gl, map, pics, state, toScreen, dpr, stage } */
  addPass(pass) { this.passes.push(pass); this.invalidate(); return () => { this.passes = this.passes.filter((p) => p !== pass); }; }
}
