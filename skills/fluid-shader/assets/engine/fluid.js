// A stable-fluids solver on the GPU (Stam's method, the one the well-known WebGL fluid demos use). Velocity lives on
// a coarse grid shaped like the canvas; vorticity confinement puts back the small swirls the grid smooths away; a
// Jacobi pressure solve keeps the flow from piling up; advection is semi-Lagrangian, or MacCormack for fields that
// must stay sharp (ink lines, film bands). Any number of fields ride on the flow, each at its own resolution.
// Velocity is in grid cells per second. The pointer stirs it along the whole path it moved since the last frame, so
// a quick flick leaves a continuous wake instead of a row of dots.
import { HEAD } from "./glsl.js";

const SPLAT = HEAD + /* glsl */ `
uniform sampler2D uTarget;
uniform float uAspect, uRadius, uPaint;
uniform vec2 uPoint;
uniform vec4 uValue;
void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  float g = exp(-dot(p, p) / uRadius);
  vec4 base = texture(uTarget, vUv);
  outColor = uPaint > 0.5 ? mix(base, uValue, g) : base + uValue * g;
}`;

const CURL = HEAD + /* glsl */ `
uniform sampler2D uVelocity;
uniform vec2 uTexel;
void main() {
  float L = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).y, R = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).y;
  float T = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).x, B = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).x;
  outColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

const VORTICITY = HEAD + /* glsl */ `
uniform sampler2D uVelocity, uCurl;
uniform vec2 uTexel;
uniform float uCurlAmt, uDt;
void main() {
  float L = texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x, R = texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture(uCurl, vUv + vec2(0.0, uTexel.y)).x, B = texture(uCurl, vUv - vec2(0.0, uTexel.y)).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 1e-4;
  force *= uCurlAmt * C;
  force.y *= -1.0;
  vec2 v = texture(uVelocity, vUv).xy + force * uDt;
  outColor = vec4(clamp(v, -3000.0, 3000.0), 0.0, 1.0);
}`;

const DIVERGENCE = HEAD + /* glsl */ `
uniform sampler2D uVelocity;
uniform vec2 uTexel;
void main() {
  vec2 vL = vUv - vec2(uTexel.x, 0.0), vR = vUv + vec2(uTexel.x, 0.0), vT = vUv + vec2(0.0, uTexel.y), vB = vUv - vec2(0.0, uTexel.y);
  float L = texture(uVelocity, vL).x, R = texture(uVelocity, vR).x, T = texture(uVelocity, vT).y, B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  // walls all round: the flow turns back at the edges
  if (vL.x < 0.0) L = -C.x;
  if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y;
  if (vB.y < 0.0) B = -C.y;
  outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const SCALE = HEAD + /* glsl */ `
uniform sampler2D uTexture;
uniform float uValue;
void main() { outColor = uValue * texture(uTexture, vUv); }`;

const PRESSURE = HEAD + /* glsl */ `
uniform sampler2D uPressure, uDivergence;
uniform vec2 uTexel;
void main() {
  float L = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x, R = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x, B = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  outColor = vec4((L + R + B + T - texture(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT = HEAD + /* glsl */ `
uniform sampler2D uPressure, uVelocity;
uniform vec2 uTexel;
void main() {
  float L = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x, R = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x, B = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  outColor = vec4(texture(uVelocity, vUv).xy - vec2(R - L, T - B), 0.0, 1.0);
}`;

const ADVECT = HEAD + /* glsl */ `
uniform sampler2D uVelocity, uSource;
uniform vec2 uSimTexel;
uniform float uDt, uDissipation;
void main() {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uSimTexel;
  outColor = texture(uSource, coord) / (1.0 + uDissipation * uDt);
}`;

// MacCormack: a forward step, a backward step from that, half the round-trip error added back, then clamped to the
// four texels the forward step read from so it can't overshoot.
const MACCORMACK = HEAD + /* glsl */ `
uniform sampler2D uVelocity, uSource, uFwd, uBack;
uniform vec2 uSimTexel, uSrcTexel;
uniform float uDt, uDissipation;
void main() {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uSimTexel;
  vec4 r = texture(uFwd, vUv) + 0.5 * (texture(uSource, vUv) - texture(uBack, vUv));
  vec2 st = coord / uSrcTexel - 0.5;
  vec2 i = floor(st);
  vec4 a = texture(uSource, (i + vec2(0.5, 0.5)) * uSrcTexel), b = texture(uSource, (i + vec2(1.5, 0.5)) * uSrcTexel);
  vec4 c = texture(uSource, (i + vec2(0.5, 1.5)) * uSrcTexel), d = texture(uSource, (i + vec2(1.5, 1.5)) * uSrcTexel);
  r = clamp(r, min(min(a, b), min(c, d)), max(max(a, b), max(c, d)));
  outColor = r / (1.0 + uDissipation * uDt);
}`;

const COPY = HEAD + /* glsl */ `
uniform sampler2D uSource;
void main() { outColor = texture(uSource, vUv); }`;

const TAU = Math.PI * 2;

export class Fluid {
  constructor(engine, o = {}) {
    this.e = engine;
    this.o = { sim: 128, iters: 20, curl: 20, velocityDissipation: 0.2, pressureDecay: 0.8, ...o };
    const P = (fs, name) => engine.program(fs, undefined, name);
    this.p = {
      splat: P(SPLAT, "splat"), curl: P(CURL, "curl"), vorticity: P(VORTICITY, "vorticity"), divergence: P(DIVERGENCE, "divergence"),
      scale: P(SCALE, "scale"), pressure: P(PRESSURE, "pressure"), gradient: P(GRADIENT, "gradient"),
      advect: P(ADVECT, "advect"), mac: P(MACCORMACK, "maccormack"), copy: P(COPY, "copy"),
    };
    this.fields = [];
    this.build();
  }

  // a grid with `short` cells on the canvas's shorter side
  dims(short) {
    const a = this.e.aspect;
    return a >= 1 ? [Math.round(short * a), short] : [short, Math.round(short / a)];
  }

  // keep what's there when the shape changes (a phone's URL bar, a rotate): copy it across, stretched
  #remake(old, w, h, opts) {
    const fresh = this.e.pair(w, h, opts);
    if (old) {
      this.e.draw(this.p.copy, { uSource: old.read }, fresh.write);
      fresh.swap();
      old.dispose();
    }
    return fresh;
  }

  build() {
    this.aspect = this.e.aspect;
    const [w, h] = this.dims(this.o.sim);
    this.vel = this.#remake(this.vel, w, h);
    this.pressure?.dispose();
    this.pressure = this.e.pair(w, h);
    this.div?.dispose();
    this.div = this.e.target(w, h);
    this.curlT?.dispose();
    this.curlT = this.e.target(w, h);
    this.w = w;
    this.h = h;
    this.texel = [1 / w, 1 / h];
    for (const f of this.fields) f.rebuild();
  }

  resize() {
    if (Math.abs(this.e.aspect - this.aspect) > 0.002) this.build();
  }

  // A field that rides on the flow: `short` texels on the shorter side.
  field(short, opts = {}) {
    const fluid = this;
    const f = {
      short, opts,
      rebuild() {
        const [w, h] = fluid.dims(short);
        this.pair = fluid.#remake(this.pair, w, h, opts);
        this.tmpA?.dispose();
        this.tmpB?.dispose();
        this.tmpA = this.tmpB = null;
        this.w = w;
        this.h = h;
        this.texel = [1 / w, 1 / h];
      },
      get read() { return this.pair.read; },
      get write() { return this.pair.write; },
      swap() { this.pair.swap(); },
    };
    f.rebuild();
    this.fields.push(f);
    return f;
  }

  // Add (or, with paint, blend toward) a gaussian of `value` at x, y (canvas uv). radius is in height units, squared.
  splat(target, x, y, value, radius, paint = false) {
    this.e.draw(this.p.splat, { uTarget: target.read, uAspect: this.e.aspect, uRadius: radius, uPoint: [x, y], uValue: value, uPaint: paint ? 1 : 0 }, target.write);
    target.swap();
  }

  // Push the fluid along the pointer's path since last frame. `each(x, y, speed)` runs at every step along it.
  stir(p, dt, { force = 1, radius = 0.0016, each, max = 2600 } = {}) {
    const dx = p.x - p.px, dy = p.y - p.py;
    const len = Math.hypot(dx * this.e.aspect, dy);
    if (len < 1e-5 || len > 0.5) return 0;
    const h = Math.max(dt, 1 / 120);
    let vx = (dx / h) * this.w * force, vy = (dy / h) * this.h * force;
    const sp = Math.hypot(vx, vy);
    if (sp > max) { vx *= max / sp; vy *= max / sp; }
    const step = Math.sqrt(radius) * 0.9;
    const n = Math.min(10, Math.max(1, Math.ceil(len / step)));
    for (let i = 1; i <= n; i++) {
      const t = i / n, x = p.px + dx * t, y = p.py + dy * t;
      this.splat(this.vel, x, y, [vx, vy, 0, 0], radius);
      each?.(x, y, len / h);
    }
    return len / h;
  }

  // A splash: pushes radiating out from a point.
  burst(x, y, { n = 10, speed = 1100, radius = 0.0012, ring = 0.02, twist = 0 } = {}) {
    const a0 = Math.random() * TAU;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU;
      const ox = (Math.cos(a) * ring) / this.e.aspect, oy = Math.sin(a) * ring;
      const dirx = Math.cos(a + twist), diry = Math.sin(a + twist);
      this.splat(this.vel, x + ox, y + oy, [dirx * speed, diry * speed, 0, 0], radius);
    }
  }

  // One step of the flow. `forces(vel)` may draw extra forces into the velocity (it must write vel.write and swap).
  step(dt, forces) {
    const { e, p, vel, texel } = this;
    e.draw(p.curl, { uVelocity: vel.read, uTexel: texel }, this.curlT);
    e.draw(p.vorticity, { uVelocity: vel.read, uCurl: this.curlT, uTexel: texel, uCurlAmt: this.o.curl, uDt: dt }, vel.write);
    vel.swap();
    forces?.(vel);
    e.draw(p.divergence, { uVelocity: vel.read, uTexel: texel }, this.div);
    e.draw(p.scale, { uTexture: this.pressure.read, uValue: this.o.pressureDecay }, this.pressure.write);
    this.pressure.swap();
    for (let i = 0; i < this.o.iters; i++) {
      e.draw(p.pressure, { uPressure: this.pressure.read, uDivergence: this.div, uTexel: texel }, this.pressure.write);
      this.pressure.swap();
    }
    e.draw(p.gradient, { uPressure: this.pressure.read, uVelocity: vel.read, uTexel: texel }, vel.write);
    vel.swap();
    e.draw(p.advect, { uVelocity: vel.read, uSource: vel.read, uSimTexel: texel, uDt: dt, uDissipation: this.o.velocityDissipation }, vel.write);
    vel.swap();
  }

  // Carry a field along the flow.
  advect(field, dt, dissipation = 0, mac = false) {
    const { e, p } = this;
    const base = { uVelocity: this.vel.read, uSimTexel: this.texel };
    if (!mac) {
      e.draw(p.advect, { ...base, uSource: field.read, uDt: dt, uDissipation: dissipation }, field.write);
      field.swap();
      return;
    }
    field.tmpA ??= e.target(field.w, field.h, field.opts);
    field.tmpB ??= e.target(field.w, field.h, field.opts);
    e.draw(p.advect, { ...base, uSource: field.read, uDt: dt, uDissipation: 0 }, field.tmpA);
    e.draw(p.advect, { ...base, uSource: field.tmpA, uDt: -dt, uDissipation: 0 }, field.tmpB);
    e.draw(p.mac, { ...base, uSource: field.read, uFwd: field.tmpA, uBack: field.tmpB, uSrcTexel: field.texel, uDt: dt, uDissipation: dissipation }, field.write);
    field.swap();
  }

  // Fill a field (or the velocity) from a full-screen program.
  paint(target, program, uniforms) {
    this.e.draw(program, uniforms, target.write);
    target.swap();
  }
}
