// Loupe engine: one picture you can dive into, level after level, in WebGL2.
//
// Each level is a picture. A level's children are small areas of it (rects), each re-photographed up close
// (tools/gen.mjs) and measured to the pixel (tools/align.py), so a dive hands over from one picture to the next
// without a jump:
//   - the camera zooms around a fixed point (the one place on screen that stays put between the two views) at a
//     steady rate in log scale, which is how a real zoom feels; one eased run per direction;
//   - the close-up fades in exactly over the area it came from, with soft edges, while it is still small, so
//     detail sharpens as it grows instead of the parent going soft. Its edge is soft over a fixed width of the
//     screen (a small close-up is a round glow of focus, a big one has long gentle edges, never a pasted
//     rectangle), and it starts in its parent's tone there (tint, measured by tools/publish.mjs), easing to its own;
//   - speed shows as a faint radial blur toward the fixed point; at rest the view breathes slowly and leans a
//     little toward the pointer.
//
//   const lp = await Loupe.create(canvas, { levels, base: "img/" })   levels: img/levels.json (tools/publish.mjs)
//   lp.go(id)                 dive or climb to any level through the tree; resolves on arrival
//   lp.back()                 one level up
//   lp.level, lp.path         where we are; ids from the root down to here
//   lp.children(id)           a level's children, in order (the first is the main way down)
//   lp.screenRect(id)         a level's frame on screen now, in CSS px { x, y, w, h }
//   lp.state                  { level, from, to, moving, depth, span, mag, zoomAt }
//   lp.on("frame" | "depart" | "arrive" | "loading", fn)
//   lp.pan(dx, dy)            move the resting view by CSS px (touch drag), within the picture
//   lp.preload()              every picture in memory, for a recording
//   ?record in the URL        the clock only moves on lp.tick(dt), for frame-by-frame capture

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform sampler2D uA, uB;
uniform vec4 uMapA, uMapB;   // uv = px * zw + xy, px in device pixels from the top-left
uniform float uOnB;          // opacity of the close-up layer (0: only A)
uniform vec3 uTintB;         // tone match: the close-up times this agrees with its parent's area
uniform vec2 uFeather;       // soft edge of the close-up, in its own uv (x, y): a fixed width on screen
uniform vec2 uZoomAt;        // the zoom's fixed point, device px
uniform float uBlur;         // radial blur length, share of the distance to uZoomAt
uniform float uTime, uGrain, uVignette;

vec3 scene(vec2 px) {
  vec3 a = texture(uA, px * uMapA.zw + uMapA.xy).rgb;
  if (uOnB <= 0.0) return a;
  vec2 uv = px * uMapB.zw + uMapB.xy;
  vec2 e = smoothstep(vec2(0.0), uFeather, uv) * smoothstep(vec2(0.0), uFeather, 1.0 - uv);
  return mix(a, texture(uB, uv).rgb * uTintB, e.x * e.y * uOnB);
}

float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 col;
  if (uBlur > 0.0004) {
    vec2 d = (px - uZoomAt) * uBlur;
    col = vec3(0.0);
    float ws = 0.0;
    for (int i = 0; i < 10; i++) {
      float f = float(i) / 9.0 - 0.5;           // centred, so the blur doesn't push the picture
      float w = 1.0 - abs(f) * 1.1;
      col += scene(px + d * f) * w;
      ws += w;
    }
    col /= ws;
  } else {
    col = scene(px);
  }
  vec2 q = px / uRes - 0.5;
  col *= 1.0 - uVignette * dot(q, q) * 1.7;
  col += (hash(px + fract(uTime * 0.61) * 173.0) - 0.5) * uGrain;
  outColor = vec4(col, 1.0);
}`;

const DEFAULTS = {
  over: 1.035,         // resting zoom past cover, so the view has room to lean
  breathe: 0.012,      // slow zoom at rest, share of the scale
  breathePeriod: 18,   // s
  lean: 0.6,           // share of the free room the view leans toward the pointer
  blur: 0.005,         // radial blur per unit of log-zoom speed (per second)
  maxBlur: 0.016,
  grain: 0.03,
  vignette: 0.16,
  fadeFrom: 1 / 9,     // a close-up starts to show when it is this share of its full size…
  fadeTo: 1 / 2.4,     // …and fully covers its area from here
  feather: 0.17,       // soft edge of a close-up, share of the screen's width: a small close-up is a soft round glow
  pace: 1,             // dive speed: 1 is about 1.7 s for one level
  hd: 1700,            // above this canvas width (device px) the large pictures are used
  maxTextures: 10,
};

// cubic-bezier easing, as in CSS
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t;
  const Y = (t) => ((ay * t + by) * t + cy) * t;
  const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = X(t) - x, d = dX(t);
      if (Math.abs(e) < 1e-7) break;
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    if (!(t >= 0 && t <= 1)) {           // Newton left the range: bisect
      let lo = 0, hi = 1;
      t = x;
      for (let i = 0; i < 30; i++) { if (X(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    }
    return Y(t);
  };
}
const DIVE = bezier(0.66, 0, 0.18, 1);     // a slow push off, a quick middle, a long soft landing
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Loupe {
  static async create(canvas, opts) {
    const lp = new Loupe(canvas, opts);
    await lp.init();
    return lp;
  }

  constructor(canvas, { levels, base = "", start, ...opts } = {}) {
    this.canvas = canvas;
    this.o = { ...DEFAULTS, ...opts };
    this.base = base;
    this.data = levels;
    this.handlers = {};
    this.record = opts.record ?? new URLSearchParams(location.search).has("record");
    this.time = 0;
    this.tex = new Map();          // id → { tex, q, w, h, used }
    this.loading = new Map();      // `${id}:${q}` → promise
    this.queue = null;
    this.pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    this.panOff = { x: 0, y: 0 };  // resting pan from a drag, in shares of the free room (-1..1)
    this.restClock = 0;

    // the tree: every level's frame in root pixels (world units)
    const nodes = levels.nodes;
    const [W, H] = levels.size;
    this.nodes = {};
    for (const [id, n] of Object.entries(nodes)) this.nodes[id] = { id, ...n, kids: [] };
    for (const n of Object.values(this.nodes)) if (n.parent) this.nodes[n.parent].kids.push(n.id);
    this.rootId = levels.root ?? Object.values(this.nodes).find((n) => !n.parent).id;
    const frame = (id) => {
      const n = this.nodes[id];
      if (n.frame) return n.frame;
      if (!n.parent) return (n.frame = { x: 0, y: 0, w: W, h: H });
      const p = frame(n.parent);
      const [cx, cy, s] = n.rect;
      return (n.frame = { x: p.x + (cx - s / 2) * p.w, y: p.y + (cy - s / 2) * p.h, w: s * p.w, h: s * p.h });
    };
    for (const id in this.nodes) frame(id);
    const depth = (id) => (this.nodes[id].parent ? depth(this.nodes[id].parent) + 1 : 0);
    for (const id in this.nodes) this.nodes[id].depth = depth(id);

    this.level = start && this.nodes[start] ? start : this.rootId;
    this.motion = null;
    this.state = { level: this.level, from: null, to: null, moving: false, depth: 0, span: 0, mag: 1, zoomAt: [0, 0] };
  }

  async init() {
    const gl = this.canvas.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: this.record });
    if (gl) this.initGL(gl);
    else this.ctx2d = this.canvas.getContext("2d");
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas);
    addEventListener("pointermove", (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.pointer.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      this.pointer.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    }, { passive: true });
    if (gl) {
      this.canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.lost = true; });
      this.canvas.addEventListener("webglcontextrestored", () => { this.tex.clear(); this.loading.clear(); this.initGL(this.canvas.getContext("webgl2")); this.lost = false; this.prefetch(); });
    }

    // the first level, then everything around it
    this.path.forEach((id) => this.load(id, "sm"));
    await this.load(this.level, "sm");
    this.view = this.restView(this.level);
    this.updateState();
    this.render();
    this.prefetch();
    if (!this.record) {
      let last = performance.now();
      const loop = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        this.tick(dt);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    this.canvas.classList.add("ready");
    this.emit("ready", this.state);
  }

  initGL(gl) {
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
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const name of ["uRes", "uA", "uB", "uMapA", "uMapB", "uOnB", "uTintB", "uFeather", "uZoomAt", "uBlur", "uTime", "uGrain", "uVignette"]) this.u[name] = gl.getUniformLocation(prog, name);
    gl.uniform1i(this.u.uA, 0);
    gl.uniform1i(this.u.uB, 1);
    // a 1×1 stand-in until a picture arrives
    this.blank = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.blank);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20, 18, 16, 255]));
  }

  // ---- the tree ----------------------------------------------------------------------------------------------
  get path() { return this.lineage(this.level); }
  lineage(id) { const out = []; for (let n = this.nodes[id]; n; n = this.nodes[n.parent]) out.unshift(n.id); return out; }
  children(id = this.level) { return [...this.nodes[id].kids]; }
  parentOf(id = this.level) { return this.nodes[id].parent; }
  node(id) { return this.nodes[id]; }

  // ---- views: a centre in world units and a scale in device px per world unit ---------------------------------
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (w === this.W && h === this.H) return;
    this.W = w; this.H = h; this.dpr = dpr;
    this.canvas.width = w; this.canvas.height = h;
    this.q = w > this.o.hd ? "lg" : "sm";
    if (this.view && !this.motion) this.view = this.restView(this.level);
    if (this.view) { this.updateState(); this.render(); this.prefetch(); }
  }

  coverScale(id) { const f = this.nodes[id].frame; return Math.max(this.W / f.w, this.H / f.h); }

  // the resting view of a level: covering the screen, a touch closer, centred on its focus and kept inside it
  restView(id, { breathe = 0, lean = { x: 0, y: 0 } } = {}) {
    const n = this.nodes[id], f = n.frame;
    const k = this.coverScale(id) * this.o.over * (1 + breathe);
    const vw = this.W / k, vh = this.H / k;
    // on a tall screen most of a wide picture is off to the sides: look toward the main way down
    const main = n.kids.length && this.W / this.H < 1.2 ? this.nodes[n.kids[0]].rect : null;
    const [fx, fy] = n.focus ?? (main ? [main[0], main[1]] : [0.5, 0.5]);
    let cx = f.x + fx * f.w, cy = f.y + fy * f.h;
    cx = Math.min(f.x + f.w - vw / 2, Math.max(f.x + vw / 2, cx));
    cy = Math.min(f.y + f.h - vh / 2, Math.max(f.y + vh / 2, cy));
    // lean (pointer, drag) moves within what is left of the room
    const freeL = cx - (f.x + vw / 2), freeR = f.x + f.w - vw / 2 - cx;
    const freeT = cy - (f.y + vh / 2), freeB = f.y + f.h - vh / 2 - cy;
    cx += lean.x >= 0 ? lean.x * freeR : lean.x * freeL;
    cy += lean.y >= 0 ? lean.y * freeB : lean.y * freeT;
    return { cx, cy, k };
  }

  toScreen(v, x, y) { return [(x - v.cx) * v.k + this.W / 2, (y - v.cy) * v.k + this.H / 2]; }

  screenRect(id, v = this.view) {
    const f = this.nodes[id].frame;
    const [x, y] = this.toScreen(v, f.x, f.y);
    return { x: x / this.dpr, y: y / this.dpr, w: (f.w * v.k) / this.dpr, h: (f.h * v.k) / this.dpr };
  }

  // the point that keeps its place on screen from view a to view b
  fixedPoint(a, b) {
    if (Math.abs(a.k - b.k) < 1e-9 * a.k) return null;
    return { x: (a.cx * a.k - b.cx * b.k) / (a.k - b.k), y: (a.cy * a.k - b.cy * b.k) / (a.k - b.k) };
  }

  viewAt(seg, u) {
    const { a, b, p } = seg;
    if (!p) return { cx: a.cx + (b.cx - a.cx) * u, cy: a.cy + (b.cy - a.cy) * u, k: a.k + (b.k - a.k) * u };
    const k = Math.exp(Math.log(a.k) + (Math.log(b.k) - Math.log(a.k)) * u);
    return { cx: p.x + (a.cx - p.x) * (a.k / k), cy: p.y + (a.cy - p.y) * (a.k / k), k };
  }

  // ---- moving -----------------------------------------------------------------------------------------------
  route(from, to) {
    const a = this.lineage(from), b = this.lineage(to);
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return [...a.slice(i - 1).reverse(), ...b.slice(i)];   // from … common ancestor … to
  }

  go(id) {
    if (!this.nodes[id]) return Promise.reject(new Error(`no level ${id}`));
    if (this.motion) {                                   // finish this move first, then go on
      return new Promise((res) => { this.queue = { id, res }; });
    }
    if (id === this.level) return Promise.resolve(id);
    const ids = this.route(this.level, id);
    return new Promise(async (resolve) => {
      const slow = setTimeout(() => this.emit("loading", true), 160);
      await Promise.all(ids.map((l) => this.load(l, "sm")));
      clearTimeout(slow);
      this.emit("loading", false);
      // runs: one eased stretch per direction (down or up), each a chain of fixed-point zooms
      const runs = [];
      let v = this.view;
      for (let i = 1; i < ids.length; i++) {
        const dir = this.nodes[ids[i]].parent === ids[i - 1] ? 1 : -1;
        const b = this.restView(ids[i]);
        const seg = { a: v, b, p: this.fixedPoint(v, b), from: ids[i - 1], to: ids[i], dir };
        seg.w = Math.abs(Math.log(b.k / v.k)) || 0.3;
        let run = runs[runs.length - 1];
        if (!run || run.dir !== dir) runs.push((run = { dir, segs: [], w: 0 }));
        run.segs.push(seg);
        run.w += seg.w;
        v = b;
      }
      for (const run of runs) run.T = Math.min(4, Math.max(1.05, 0.85 + (0.82 * run.w) / Math.log(8))) / this.o.pace;
      this.motion = { runs, ri: 0, t: 0, target: id, resolve, from: this.level, prevK: this.view.k };
      this.state.from = this.level;
      this.state.to = id;
      this.emit("depart", { from: this.level, to: id, ids });
    });
  }

  back() { const p = this.parentOf(); return p ? this.go(p) : Promise.resolve(this.level); }

  pan(dx, dy) {
    if (this.motion) return;
    const v = this.restView(this.level), f = this.nodes[this.level].frame;
    const roomX = (f.w - this.W / v.k) / 2, roomY = (f.h - this.H / v.k) / 2;
    if (roomX > 1e-9) this.panOff.x = Math.max(-1, Math.min(1, this.panOff.x - (dx * this.dpr) / v.k / roomX));
    if (roomY > 1e-9) this.panOff.y = Math.max(-1, Math.min(1, this.panOff.y - (dy * this.dpr) / v.k / roomY));
  }

  // ---- the clock ------------------------------------------------------------------------------------------
  tick(dt) {
    if (this.lost || !this.view) return;
    this.time += dt;
    const p = this.pointer;
    const m = this.motion;
    if (m) {
      // the pointer's lean fades out while moving, so the landing view is the plain resting one
      p.sx *= Math.exp(-dt * 6); p.sy *= Math.exp(-dt * 6);
      const run = m.runs[m.ri];
      m.t += dt;
      const e = DIVE(Math.min(1, m.t / run.T)) * run.w;
      let acc = 0, seg = run.segs[run.segs.length - 1], u = 1;
      for (const s of run.segs) {
        if (e <= acc + s.w || s === run.segs[run.segs.length - 1]) { seg = s; u = Math.min(1, Math.max(0, (e - acc) / s.w)); break; }
        acc += s.w;
      }
      this.view = this.viewAt(seg, u);
      this.seg = seg;
      if (m.t >= run.T) {
        m.ri++;
        m.t = 0;
        if (m.ri >= m.runs.length) return this.arrive();
      }
    } else {
      this.restClock += dt;
      p.sx += (p.x - p.sx) * (1 - Math.exp(-dt * 2.2));
      p.sy += (p.y - p.sy) * (1 - Math.exp(-dt * 2.2));
      const breathe = this.o.breathe * (0.5 - 0.5 * Math.cos((2 * Math.PI * this.restClock) / this.o.breathePeriod));
      const lean = { x: Math.max(-1, Math.min(1, p.sx * this.o.lean + this.panOff.x)), y: Math.max(-1, Math.min(1, p.sy * this.o.lean * 0.7 + this.panOff.y)) };
      this.view = this.restView(this.level, { breathe, lean });
      this.seg = null;
    }
    const speed = this.prevK ? Math.abs(Math.log(this.view.k / this.prevK)) / Math.max(dt, 1e-3) : 0;
    this.prevK = this.view.k;
    this.blur = Math.min(this.o.maxBlur, speed * this.o.blur);
    this.updateState();
    this.render();
    this.emit("frame", this.state);
  }

  arrive() {
    const m = this.motion;
    this.level = m.target;
    this.motion = null;
    this.seg = null;
    this.restClock = 0;
    this.panOff = { x: 0, y: 0 };
    this.view = this.restView(this.level);
    this.state.from = null;
    this.state.to = null;
    this.updateState();
    this.render();
    this.emit("arrive", { level: this.level, from: m.from });
    this.emit("frame", this.state);
    this.prefetch();
    m.resolve(this.level);
    const q = this.queue;
    this.queue = null;
    if (q) this.go(q.id).then(q.res);
  }

  // ---- what is on screen: a picture, and the close-up growing in it ------------------------------------------
  // While moving, the parent is always drawn under the close-up (the close-up only covers the screen at the very
  // end). The close-up's soft edge narrows to nothing as it fills the screen, so landing on it alone doesn't show.
  layers() {
    if (!this.seg) return { a: this.level, b: null, on: 0, feather: [1e-4, 1e-4], tint: [1, 1, 1] };
    const { from, to, dir } = this.seg;
    const parent = dir > 0 ? from : to, child = dir > 0 ? to : from;
    const ratio = this.view.k / this.restView(child).k;
    const on = smooth(Math.log(this.o.fadeFrom), Math.log(this.o.fadeTo), Math.log(ratio));
    // a soft edge of fixed width on screen: while the close-up is small it is a round glow, as it grows its edges
    // stay a long gentle gradient, and the edge narrows to nothing as the close-up fills the screen
    const f = this.nodes[child].frame;
    const edge = this.o.feather * this.W * Math.min(1, Math.max(0, (1 - ratio) / 0.32));
    const feather = [Math.min(0.5, edge / (f.w * this.view.k) + 1e-4), Math.min(0.5, edge / (f.h * this.view.k) + 1e-4)];
    // the close-up starts in its parent's tone and eases to its own as it fills the screen
    const k = 1 - smooth(Math.log(this.o.fadeFrom), 0, Math.log(ratio));
    const t = this.nodes[child].tint ?? [1, 1, 1];
    const tint = t.map((x) => 1 + (x - 1) * k);
    return { a: parent, b: child, on, feather, tint };
  }

  updateState() {
    const s = this.state;
    s.level = this.level;
    s.moving = !!this.motion;
    let d = this.nodes[this.level].depth, span = this.nodes[this.level].span;
    if (this.seg) {
      const { from, to, dir } = this.seg;
      const P = dir > 0 ? from : to, C = dir > 0 ? to : from;
      const kP = this.restView(P).k, kC = this.restView(C).k;
      const u = Math.min(1, Math.max(0, Math.log(this.view.k / kP) / Math.log(kC / kP)));
      const sp = this.nodes[P].span, sc = this.nodes[C].span;
      d = this.nodes[P].depth + u;
      if (sp && sc) span = Math.exp(Math.log(sp) + (Math.log(sc) - Math.log(sp)) * u);
      const fp = this.seg.p;
      s.zoomAt = fp ? this.toScreen(this.view, fp.x, fp.y).map((x) => x / this.dpr) : [this.W / 2 / this.dpr, this.H / 2 / this.dpr];
    }
    s.depth = d;
    s.span = span;
    const rootSpan = this.nodes[this.rootId].span;
    s.mag = rootSpan && span ? rootSpan / span : 1;
  }

  render() {
    const L = this.layers();
    if (this.ctx2d) return this.render2d(L);
    const gl = this.gl;
    gl.viewport(0, 0, this.W, this.H);
    const map = (id) => {
      const f = this.nodes[id].frame, v = this.view;
      const sx = 1 / (v.k * f.w), sy = 1 / (v.k * f.h);
      return [(v.cx - f.x) / f.w - (this.W / 2) * sx, (v.cy - f.y) / f.h - (this.H / 2) * sy, sx, sy];
    };
    const bind = (unit, id) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      const t = id && this.best(id);
      gl.bindTexture(gl.TEXTURE_2D, t ? t.tex : this.blank);
      return !!t;
    };
    bind(0, L.a);
    gl.uniform4fv(this.u.uMapA, map(L.a));
    const hasB = L.b && bind(1, L.b);
    if (!hasB) bind(1, null);
    gl.uniform4fv(this.u.uMapB, L.b ? map(L.b) : [0, 0, 0, 0]);
    gl.uniform1f(this.u.uOnB, hasB ? L.on : 0);
    gl.uniform2fv(this.u.uFeather, L.feather);
    gl.uniform3fv(this.u.uTintB, L.tint);
    gl.uniform2f(this.u.uRes, this.W, this.H);
    const z = this.state.zoomAt;
    gl.uniform2f(this.u.uZoomAt, z[0] * this.dpr, z[1] * this.dpr);
    gl.uniform1f(this.u.uBlur, this.blur ?? 0);
    gl.uniform1f(this.u.uTime, this.time);
    gl.uniform1f(this.u.uGrain, this.o.grain);
    gl.uniform1f(this.u.uVignette, this.o.vignette);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  render2d(L) {
    const c = this.ctx2d;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#141210";
    c.fillRect(0, 0, this.W, this.H);
    const draw = (id, alpha) => {
      const t = this.best(id);
      if (!t) return;
      const r = this.screenRect(id);
      c.globalAlpha = alpha;
      c.drawImage(t.img, r.x * this.dpr, r.y * this.dpr, r.w * this.dpr, r.h * this.dpr);
    };
    draw(L.a, 1);
    if (L.b) draw(L.b, L.on);
    c.globalAlpha = 1;
  }

  // ---- pictures ---------------------------------------------------------------------------------------------
  best(id) {
    const t = this.tex.get(id);
    if (t) t.used = this.time;
    return t;
  }

  load(id, q = this.q) {
    if (!this.nodes[id].src[1]) q = "sm";          // a page that ships one size of its pictures
    const have = this.tex.get(id);
    if (have && (have.q === q || have.q === "lg")) return Promise.resolve(have);
    const key = `${id}:${q}`;
    if (this.loading.has(key)) return this.loading.get(key);
    const src = this.nodes[id].src;
    const url = this.base + (q === "lg" ? src[1] ?? src[0] : src[0]);
    const p = (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      const bmp = await createImageBitmap(await res.blob());
      const cur = this.tex.get(id);
      if (cur && cur.q === "lg" && q === "sm") { bmp.close?.(); return cur; }
      let entry;
      if (this.gl) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        entry = { tex, q, w: bmp.width, h: bmp.height, used: this.time };
        bmp.close?.();
        if (cur) gl.deleteTexture(cur.tex);
      } else {
        entry = { img: bmp, q, w: bmp.width, h: bmp.height, used: this.time };
      }
      this.tex.set(id, entry);
      this.evict();
      if (!this.motion && this.view) this.render();
      return entry;
    })().finally(() => this.loading.delete(key));
    this.loading.set(key, p);
    p.catch((e) => console.warn("loupe:", e.message));
    return p;
  }

  // every picture in memory, for a recording that must never wait for one
  preload() {
    this.o.maxTextures = Infinity;
    return Promise.all(Object.keys(this.nodes).map((id) => this.load(id, this.q)));
  }

  // what to have ready: where we are and everything one click away
  async prefetch() {
    const here = this.level, q = this.q;
    const near = [here, ...this.children(here), this.parentOf(here)].filter(Boolean);
    this.keep = new Set([...this.path, ...near]);
    try {
      await this.load(here, q);
      for (const id of this.children(here)) await this.load(id, "sm");
      const p = this.parentOf(here);
      if (p) await this.load(p, q);
      for (const id of this.children(here)) await this.load(id, q);
    } catch { /* logged in load */ }
  }

  evict() {
    if (this.tex.size <= this.o.maxTextures) return;
    const gone = [...this.tex.entries()].filter(([id]) => !this.keep?.has(id) && id !== this.level).sort((a, b) => a[1].used - b[1].used);
    while (this.tex.size > this.o.maxTextures && gone.length) {
      const [id, t] = gone.shift();
      if (this.gl) this.gl.deleteTexture(t.tex);
      else t.img.close?.();
      this.tex.delete(id);
    }
  }

  // ---- events -----------------------------------------------------------------------------------------------
  on(name, fn) { (this.handlers[name] ??= []).push(fn); return () => this.off(name, fn); }
  off(name, fn) { this.handlers[name] = (this.handlers[name] ?? []).filter((f) => f !== fn); }
  emit(name, arg) { for (const fn of this.handlers[name] ?? []) fn(arg); }
}
