// The WebGL2 runtime (the Wave, Fluid and Glass Shader skills share it). One canvas, sized to its own
// CSS box, so a layout can put it anywhere: full-bleed, one side, a card, a disc. Programs look up their uniforms
// once and set them by type; float render targets come in single and ping-pong pairs; every pass is one
// full-screen triangle. The pointer is heard on the window (so it still works over the copy), mapped into the
// canvas's own 0…1 space (y up), eased, with velocity and a presence that fades when it rests or leaves.
// Resolution steps down when frames run long, drawing stops while the canvas is off-screen, reduced motion gets a
// single still frame, and without WebGL2 the page falls back to the canvas's CSS background.

const UI = "a, button, input, select, textarea, label, summary, [data-ui]";

export const FULLSCREEN_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const T = { FLOAT: 0x1406, VEC2: 0x8b50, VEC3: 0x8b51, VEC4: 0x8b52, INT: 0x1404, BOOL: 0x8b56, MAT3: 0x8b5b, MAT4: 0x8b5c, SAMPLER: 0x8b5e };
const numbered = (src) => src.split("\n").map((l, i) => `${String(i + 1).padStart(4)}  ${l}`).join("\n");

export class Program {
  constructor(gl, fs, vs = FULLSCREEN_VS, name = "program") {
    this.gl = gl;
    this.name = name;
    const shader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(`[${name}] ${type === gl.VERTEX_SHADER ? "vertex" : "fragment"} shader\n${gl.getShaderInfoLog(s)}\n${numbered(src)}`);
        throw new Error(`${name}: shader didn't compile`);
      }
      return s;
    };
    const p = (this.p = gl.createProgram());
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`${name}: ${gl.getProgramInfoLog(p)}`);
    this.u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      this.u[info.name.replace(/\[0\]$/, "")] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size };
    }
  }

  // Bind the program and set whichever of `values` it uses. Arrays of vectors come flattened; textures may be a
  // target ({ tex }) or a raw WebGLTexture.
  use(values = {}) {
    const { gl } = this;
    gl.useProgram(this.p);
    let unit = 0;
    for (const k in values) {
      const u = this.u[k];
      if (!u) continue;
      const v = values[k];
      switch (u.type) {
        case T.FLOAT: u.size > 1 ? gl.uniform1fv(u.loc, v) : gl.uniform1f(u.loc, v); break;
        case T.VEC2: gl.uniform2fv(u.loc, v); break;
        case T.VEC3: gl.uniform3fv(u.loc, v); break;
        case T.VEC4: gl.uniform4fv(u.loc, v); break;
        case T.INT: case T.BOOL: u.size > 1 ? gl.uniform1iv(u.loc, v) : gl.uniform1i(u.loc, +v); break;
        case T.MAT3: gl.uniformMatrix3fv(u.loc, false, v); break;
        case T.MAT4: gl.uniformMatrix4fv(u.loc, false, v); break;
        case T.SAMPLER:
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, v?.tex ?? v ?? null);
          gl.uniform1i(u.loc, unit++);
          break;
      }
    }
  }

  dispose() { this.gl.deleteProgram(this.p); }
}

export class Engine {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = opts;
    const gl = canvas.getContext("webgl2", {
      alpha: !!opts.alpha, antialias: !!opts.antialias, depth: !!opts.depth, stencil: false,
      premultipliedAlpha: true, powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL2 is not available");
    this.gl = gl;
    gl.getExtension("EXT_color_buffer_float");
    gl.getExtension("OES_texture_float_linear");
    this.half = this.#probeHalf();
    this.vao = gl.createVertexArray();
    this.disposables = [];
    this.time = 0;
    this.frameNo = 0;
    this.speed = 1;
    this.scroll = 0;
    this.scale = 1;
    this.ema = 1 / 60;
    this.slow = 0;
    this.checkAt = 0;
    this.visible = true;
    this.running = false;
    this.dirty = true;
    this.still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Pointer, in the canvas's 0…1 space with y up (it can sit outside 0…1). px, py: where it was last frame.
    // sx, sy: eased. vx, vy: velocity in canvas widths/heights per second, eased. presence: 0…1, eases toward 1 while
    // the pointer is live over the page (or a finger is down) and back to 0 when it leaves or the finger lifts.
    this.pointer = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, sx: 0.5, sy: 0.5, vx: 0, vy: 0, cx: -1, cy: -1, down: false, live: false, inside: false, moved: false, presence: 0, type: "mouse" };
  }

  #probeHalf() {
    const { gl } = this;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 4, 4, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(tex);
    return ok;
  }

  // ——— building blocks ———

  program(fs, vs, name) {
    const p = new Program(this.gl, fs, vs, name);
    this.disposables.push(p);
    return p;
  }

  // A render target. type "half" is RGBA16F where the GPU can render to it (RGBA8 where it can't); "byte" is RGBA8.
  target(w, h, { type = "half", filter = "linear", wrap = "clamp" } = {}) {
    const { gl } = this;
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    const half = type === "half" && this.half;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, half ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, half ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    const f = filter === "nearest" ? gl.NEAREST : gl.LINEAR;
    const r = wrap === "repeat" ? gl.REPEAT : wrap === "mirror" ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, r);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, r);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo, w, h, texel: [1 / w, 1 / h], dispose() { gl.deleteTexture(tex); gl.deleteFramebuffer(fbo); } };
  }

  // Two targets to read from one and write to the other, then swap.
  pair(w, h, opts) {
    let a = this.target(w, h, opts), b = this.target(w, h, opts);
    return {
      w: a.w, h: a.h, texel: a.texel,
      get read() { return a; }, get write() { return b; },
      swap() { [a, b] = [b, a]; },
      dispose() { a.dispose(); b.dispose(); },
    };
  }

  // A texture from an image, canvas or video (flipped so v runs up, like everything else here).
  texture(source, { filter = "linear", wrap = "clamp", mipmap = false } = {}) {
    const { gl } = this;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    const r = wrap === "repeat" ? gl.REPEAT : wrap === "mirror" ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, r);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, r);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter === "nearest" ? gl.NEAREST : gl.LINEAR);
    if (mipmap) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter === "nearest" ? gl.NEAREST : gl.LINEAR);
    const w = source.videoWidth || source.naturalWidth || source.width, h = source.videoHeight || source.naturalHeight || source.height;
    return { tex, w, h, texel: [1 / w, 1 / h], mipmap, dispose() { gl.deleteTexture(tex); } };
  }

  // Re-upload a texture from a canvas or video frame.
  update(t, source) {
    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (t.mipmap) gl.generateMipmap(gl.TEXTURE_2D);
  }

  // A small float texture from data (rgba, row by row from the bottom), e.g. a lookup table.
  dataTexture(w, h, floats, { filter = "linear", wrap = "clamp" } = {}) {
    const { gl } = this;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, toHalf(floats));
    const f = filter === "nearest" ? gl.NEAREST : gl.LINEAR, r = wrap === "repeat" ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, r);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, r);
    return { tex, w, h, texel: [1 / w, 1 / h], dispose() { gl.deleteTexture(tex); } };
  }

  // One full-screen pass: `program` with `uniforms`, into `target` (or the canvas when it's null).
  draw(program, uniforms, target = null, { blend = null } = {}) {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, target ? target.w : this.width, target ? target.h : this.height);
    program.use(uniforms);
    if (blend === "add") { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); }
    else if (blend === "over") { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
    else gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (blend) gl.disable(gl.BLEND);
  }

  // Uniforms most looks want.
  get common() {
    const p = this.pointer;
    return {
      uRes: [this.width, this.height], uCss: [this.cssW, this.cssH], uAspect: this.aspect, uDpr: this.dpr,
      uTime: this.time, uPointer: [p.sx, p.sy], uPresence: p.presence, uScroll: this.scroll,
    };
  }

  // Where an element sits on the canvas: uv box (y up) and CSS-pixel box, both relative to the canvas.
  box(el) {
    const r = el.getBoundingClientRect(), c = this.canvas.getBoundingClientRect();
    const x0 = (r.left - c.left) / c.width, x1 = (r.right - c.left) / c.width;
    const y0 = 1 - (r.bottom - c.top) / c.height, y1 = 1 - (r.top - c.top) / c.height;
    return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: r.width, h: r.height, left: r.left - c.left, top: r.top - c.top };
  }

  // ——— life cycle ———

  start(look, options = {}) {
    // measure first, so a look can size its buffers to the canvas when it's created
    this.maxDpr = options.maxDpr ?? 1.5;
    this.resize();
    this.scene = look.create(this, options);
    this.maxDpr = options.maxDpr ?? this.scene.maxDpr ?? 1.5;
    this.resize();
    new ResizeObserver(() => {
      this.dirty = true;
      if (this.still) this.#drawStill();
    }).observe(this.canvas);
    new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible && !this.still) this.play();
    }, { rootMargin: "64px" }).observe(this.canvas);
    this.#listen();
    const rm = matchMedia("(prefers-reduced-motion: reduce)");
    rm.addEventListener?.("change", () => { this.still = rm.matches; this.still ? this.#drawStill() : this.play(); });
    document.documentElement.classList.add("gl-on");
    if (this.still) this.#drawStill();
    else this.play();
    return this;
  }

  play() {
    if (this.running || this.still) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.visible || this.still) { this.running = false; return; }
      this.raf = requestAnimationFrame(loop);
      this.tick(now);
    };
    this.raf = requestAnimationFrame(loop);
  }

  #drawStill() {
    if (!this.scene) return;
    this.resize();
    this.time = this.opts.stillAt ?? this.scene.stillAt ?? 6;
    this.scene.warm?.(this.time);
    this.scene.frame(0, this.time);
  }

  // Ask for a fresh frame when something a look waits on arrives (an image, a font). Only needed in still mode:
  // otherwise the loop draws anyway.
  redraw() {
    if (this.still) this.#drawStill();
  }

  // Step by hand and draw (handy when frames are paused, e.g. in a background tab).
  advance(seconds = 1, fps = 60) {
    const n = Math.max(1, Math.round(seconds * fps));
    for (let i = 0; i < n; i++) this.tick((this.last ?? performance.now()) + 1000 / fps);
  }

  tick(now) {
    const dt = Math.min(1 / 20, Math.max(0, (now - (this.last ?? now)) / 1000));
    this.last = now;
    const p = this.pointer;
    // pointer: last frame's position, eased position, eased velocity, presence
    const rawVx = dt > 0 ? (p.x - p.px) / dt : 0, rawVy = dt > 0 ? (p.y - p.py) / dt : 0;
    p.moved = p.x !== p.px || p.y !== p.py;
    const k = 1 - Math.exp(-dt * 7);
    p.sx += (p.x - p.sx) * k;
    p.sy += (p.y - p.sy) * k;
    const kv = 1 - Math.exp(-dt * 14);
    p.vx += (rawVx - p.vx) * kv;
    p.vy += (rawVy - p.vy) * kv;
    p.presence += ((p.live ? 1 : 0) - p.presence) * (1 - Math.exp(-dt * 3));
    // scroll: how far the canvas has moved up out of view (0 in place, 1 gone)
    const r = this.canvas.getBoundingClientRect();
    this.rect = r;
    this.scroll = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
    // slow for three checks running (~4.5 s): draw fewer pixels, down to half
    if (now > this.checkAt) {
      this.checkAt = now + 1500;
      this.slow = this.ema > 1 / 40 ? this.slow + 1 : 0;
      if (this.slow >= 3 && this.scale > 0.5) { this.scale = Math.max(0.5, this.scale * 0.85); this.slow = 0; this.dirty = true; }
    }
    if (this.dirty) this.resize();
    this.time += dt * this.speed;
    this.frameNo++;
    this.scene.frame(dt * this.speed, this.time);
    p.px = p.x;
    p.py = p.y;
    this.ema += (dt - this.ema) * 0.05;
  }

  resize() {
    this.dirty = false;
    const c = this.canvas;
    const cssW = Math.max(1, c.clientWidth), cssH = Math.max(1, c.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr ?? 1.5) * this.scale;
    const w = Math.max(1, Math.round(cssW * dpr)), h = Math.max(1, Math.round(cssH * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    this.width = w;
    this.height = h;
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = w / cssW;
    this.aspect = cssW / cssH;
    this.rect = c.getBoundingClientRect();
    this.scene?.resize?.(this);
  }

  #listen() {
    const p = this.pointer;
    const at = (e) => {
      const r = this.canvas.getBoundingClientRect();
      p.cx = e.clientX;
      p.cy = e.clientY;
      p.x = (e.clientX - r.left) / r.width;
      p.y = 1 - (e.clientY - r.top) / r.height;
      p.inside = p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
      p.type = e.pointerType || "mouse";
    };
    const first = (e) => { at(e); p.px = p.x; p.py = p.y; p.sx = p.x; p.sy = p.y; };
    let seen = false;
    addEventListener("pointermove", (e) => {
      if (!seen) { seen = true; first(e); }
      at(e);
      if (e.pointerType !== "touch" || p.down) p.live = true;
      this.scene?.move?.(p, e);
    }, { passive: true });
    addEventListener("pointerdown", (e) => {
      if (!seen) { seen = true; first(e); }
      at(e);
      if (e.pointerType === "touch") { p.px = p.x; p.py = p.y; }
      if (e.target.closest?.(UI)) return;
      p.down = true;
      p.live = true;
      this.scene?.down?.(p, e);
    });
    const up = (e) => {
      if (e?.type === "pointercancel" || e?.pointerType === "touch") p.live = false;
      if (!p.down) return;
      p.down = false;
      this.scene?.up?.(p, e);
    };
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    document.documentElement.addEventListener("pointerleave", () => { if (!p.down) p.live = false; });
    addEventListener("blur", () => { up(); p.live = false; });
    // scrolling moves the canvas under a still pointer
    addEventListener("scroll", () => {
      if (p.cx < 0) return;
      const r = this.canvas.getBoundingClientRect();
      p.x = (p.cx - r.left) / r.width;
      p.y = 1 - (p.cy - r.top) / r.height;
      p.inside = p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
    }, { passive: true });
  }
}

// Mount a look on a canvas. Returns the engine, or null (and a `no-gl` class on <html>) when WebGL2 isn't there.
export function mount(canvas, look, options = {}) {
  try {
    const engine = new Engine(canvas, { ...look.engine, ...options.engine });
    engine.start(look, options);
    (window.__shaders ??= []).push(engine);
    return engine;
  } catch (e) {
    console.error(e);
    // an empty drawing buffer lets the canvas's CSS background (the fallback) show
    canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.width = canvas.height = 0;
    document.documentElement.classList.add("no-gl");
    return null;
  }
}

// ——— small helpers ———

// "#ff8800" → [r, g, b] in linear light (what the shaders mix in)
export function rgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
}
export const rgbs = (list) => list.flatMap(rgb);

export function toHalf(floats) {
  const out = new Uint16Array(floats.length);
  const f = new Float32Array(1), i = new Uint32Array(f.buffer);
  for (let k = 0; k < floats.length; k++) {
    f[0] = floats[k];
    const x = i[0], sign = (x >> 16) & 0x8000;
    let e = ((x >> 23) & 0xff) - 127 + 15, m = x & 0x7fffff;
    if (e <= 0) out[k] = sign;
    else if (e >= 31) out[k] = sign | 0x7c00;
    else out[k] = sign | (e << 10) | (m >> 13);
  }
  return out;
}

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const mix = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
