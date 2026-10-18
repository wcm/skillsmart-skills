// Film: a soap film stretched across a wand. The colours are real thin-film interference: each pixel's thickness
// (in microns) looks up a table made once from the physics (two reflections, 380–780 nm, the CIE observer), so the
// bands run in the true order, from black film through gold, magenta and blue to pale pastels where it's thick.
// The film drains: thin at the top, thick at the bottom, and thin film is born at the wire and rises in plumes (it's
// lighter), which is what makes soap films swirl. The cursor blows on it; a click pops it, a hole racing out from
// where you clicked, and a fresh film is drawn up from the bottom a moment later, thick and colourless at first,
// its bands appearing as it drains.
import { HEAD, NOISE, COLOR } from "../glsl.js";
import { Fluid } from "../fluid.js";
import { rgb } from "../core.js";

export const meta = { id: "film", name: "Film", kind: "soap film" };
export const engine = { alpha: true };

const R = 0.4; // the film's radius, in canvas heights (the canvas is square)

const FORCES = HEAD + NOISE + /* glsl */ `
uniform sampler2D uVelocity, uFilm;
uniform float uDt, uBuoy, uMean, uTime, uAspect, uR, uStir;
uniform vec2 uC;
void main() {
  vec2 v = texture(uVelocity, vUv).xy;
  float T = texture(uFilm, vUv).r;
  v.y += uBuoy * (uMean - T) * uDt;
  // a faint draught, so it never quite settles
  vec2 q = vUv * 3.0 + vec2(uTime * 0.05, -uTime * 0.04);
  float e = 0.05;
  v += uStir * vec2(gnoise(q + vec2(0.0, e)) - gnoise(q - vec2(0.0, e)), gnoise(q - vec2(e, 0.0)) - gnoise(q + vec2(e, 0.0))) / (2.0 * e) * uDt;
  float d = length((vUv - uC) * vec2(uAspect, 1.0));
  v *= 1.0 - smoothstep(uR - 0.012, uR + 0.004, d);
  outColor = vec4(v, 0.0, 1.0);
}`;

const DRAIN = HEAD + NOISE + /* glsl */ `
uniform sampler2D uFilm;
uniform float uDt, uAspect, uR, uRestore, uDrain, uTime, uSmooth;
uniform vec2 uC, uTexel;
// thick (pale, high-order colours) over most of the film, thinning fast near the top into the vivid first orders and
// a sliver of black film
float profile(float y) { y = clamp(y, 0.0, 1.0); return 0.03 + 1.6 * pow(1.0 - y, 0.55); }
void main() {
  vec2 q = (vUv - uC) * vec2(uAspect, 1.0);
  float d = length(q);
  float y = q.y / uR * 0.5 + 0.5;
  float T = texture(uFilm, vUv).r;
  // a little smoothing each step softens the fine streaks rising plumes leave behind
  float n = (texture(uFilm, vUv + vec2(uTexel.x, 0.0)).r + texture(uFilm, vUv - vec2(uTexel.x, 0.0)).r
           + texture(uFilm, vUv + vec2(0.0, uTexel.y)).r + texture(uFilm, vUv - vec2(0.0, uTexel.y)).r) * 0.25;
  T = mix(T, n, uSmooth);
  T += (profile(y) - T) * uRestore * uDt;
  T -= uDrain * T * (0.25 + y) * uDt;
  // the wire holds a thick border
  T = mix(T, 1.45, smoothstep(uR - 0.005, uR, d) * 0.4);
  outColor = vec4(max(T, 0.0), 0.0, 0.0, 1.0);
}`;

const DIP = HEAD + NOISE + /* glsl */ `
uniform float uAspect, uR, uExtra;
uniform vec2 uC;
void main() {
  vec2 q = (vUv - uC) * vec2(uAspect, 1.0);
  float y = q.y / uR * 0.5 + 0.5;
  float yc = clamp(y, 0.0, 1.0);
  float T = 0.03 + 1.6 * pow(1.0 - yc, 0.55) + uExtra * (1.0 - 0.6 * yc);
  T += 0.05 * gnoise(vUv * 6.0);
  outColor = vec4(T, 0.0, 0.0, 1.0);
}`;

const SHOW = HEAD + NOISE + COLOR + /* glsl */ `
uniform sampler2D uFilm, uLut;
uniform vec2 uC, uRes;
uniform float uAspect, uR, uTime, uGrain, uExposure, uFill;
uniform vec4 uPop;  // x, y, age, on
uniform vec3 uWire;
void main() {
  vec2 q = (vUv - uC) * vec2(uAspect, 1.0);
  float d = length(q);
  float px = 1.0 / uRes.y;
  float T = texture(uFilm, vUv).r;
  vec3 film = texture(uLut, vec2(clamp(T / 1.5, 0.0, 1.0), 0.5)).rgb * uExposure;

  // the film only shows colour by reflecting light, so light it with one big soft source up and to the left:
  // colours glow there and fade to a faint sheen across the rest, like a photograph of a bubble
  vec2 lq = (q - vec2(-0.32, 0.36) * uR) / uR;
  float env = 0.22 + 1.25 * exp(-dot(lq, lq) / 0.55);
  film *= env;

  // where the film is: inside the wire, not yet popped, and as far up as a fresh dip has reached
  float a = 1.0 - smoothstep(uR - px, uR + px, d);
  float y = q.y / uR * 0.5 + 0.5;
  a *= 1.0 - smoothstep(uFill - 0.03, uFill + 0.01, y);
  float flash = 0.0;
  if (uPop.w > 0.5) {
    vec2 c = (uPop.xy - uC) * vec2(uAspect, 1.0);
    float hr = uPop.z * 2.8 * uR;
    float dh = length(q - c);
    flash = exp(-pow((dh - hr) / 0.006, 2.0)) * step(uPop.z, 0.42) * a;
    a *= smoothstep(hr - 0.004, hr + 0.004, dh) * step(uPop.z, 0.42);
  }
  vec3 col = film * a + vec3(1.0) * flash * 0.7 * (0.5 + 0.5 * hash12(floor(q * 260.0)));
  // premultiplied: the film is light, so its alpha is its brightest channel (it screens over the page)
  vec3 s = toSRGB(shoulder(col));
  float alpha = clamp(max(max(s.r, s.g), s.b), 0.0, 1.0);

  // the wire: a thin round loop, lit from the upper left, and its handle running off to the lower right
  float wr = 0.0055;
  float dw = abs(d - uR) / wr;
  vec2 hd = normalize(vec2(0.62, -0.78));
  vec2 ha = hd * uR, hb = hd * 0.75;
  vec2 pa = q - ha, ba = hb - ha;
  float hh = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float dhandle = length(pa - ba * hh) / (wr * 1.15);
  float dwire = min(dw, dhandle);
  if (dwire < 1.2) {
    vec2 nrm2 = dw < dhandle ? normalize(q) * sign(d - uR) : normalize(pa - ba * hh);
    float nz = sqrt(max(1.0 - min(dwire * dwire, 1.0), 0.0));
    vec3 n = normalize(vec3(nrm2 * min(dwire, 1.0), nz));
    float lit = 0.25 + 0.75 * max(dot(n, normalize(vec3(-0.5, 0.6, 0.62))), 0.0);
    float spec = pow(max(dot(reflect(vec3(0.0, 0.0, -1.0), n), normalize(vec3(-0.45, 0.55, 0.7))), 0.0), 24.0);
    vec3 wire = uWire * lit + spec * 0.9;
    float wa = 1.0 - smoothstep(0.85, 1.2, dwire);
    wa *= dhandle < dw ? 1.0 - smoothstep(0.55, 0.75, length(q)) : 1.0;
    s = mix(s, toSRGB(shoulder(wire)), wa);
    alpha = mix(alpha, 1.0, wa);
  }
  s += grain(gl_FragCoord.xy, uTime, uGrain) * alpha;
  outColor = vec4(clamp(s, 0.0, alpha), alpha);
}`;

// Reflectance of a soap film (n = 1.33, normal incidence, both reflections) for thicknesses 0…1.5 µm, as linear
// RGB, white-balanced so a perfect mirror would be neutral.
function filmTable(n = 512, maxNm = 1500) {
  const nf = 1.33, r = (nf - 1) / (nf + 1), r2 = r * r;
  const g = (x, mu, s1, s2) => { const t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); };
  const xb = (l) => 1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
  const yb = (l) => 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
  const zb = (l) => 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8);
  const toRGB = (X, Y, Z) => [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
  let WX = 0, WY = 0, WZ = 0;
  for (let l = 380; l <= 780; l += 4) { WX += xb(l); WY += yb(l); WZ += zb(l); }
  const white = toRGB(WX / WY, 1, WZ / WY);
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const d = (i / (n - 1)) * maxNm;
    let X = 0, Y = 0, Z = 0;
    for (let l = 380; l <= 780; l += 4) {
      const cd = Math.cos((4 * Math.PI * nf * d) / l);
      const Rl = (2 * r2 * (1 - cd)) / (1 + r2 * r2 - 2 * r2 * cd);
      X += Rl * xb(l); Y += Rl * yb(l); Z += Rl * zb(l);
    }
    const c = toRGB(X / WY, Y / WY, Z / WY);
    out[i * 4] = Math.max(0, c[0] / white[0]);
    out[i * 4 + 1] = Math.max(0, c[1] / white[1]);
    out[i * 4 + 2] = Math.max(0, c[2] / white[2]);
    out[i * 4 + 3] = 1;
  }
  return out;
}

export function create(engine, o = {}) {
  const fluid = new Fluid(engine, { sim: 128, curl: o.curl ?? 2, velocityDissipation: o.calm ?? 1.0, iters: 20 });
  const film = fluid.field(o.filmRes ?? 520);
  const forces = engine.program(FORCES, undefined, "film forces");
  const drain = engine.program(DRAIN, undefined, "film drain");
  const dip = engine.program(DIP, undefined, "film dip");
  const show = engine.program(SHOW, undefined, "film show");
  const lut = engine.dataTexture(512, 1, filmTable());
  const wire = rgb(o.wire ?? "#b9bcc4");
  const C = [0.5, 0.5];
  let pop = [0.5, 0.5, 0, 0], fill = 1.1, state = "film", stateAt = 0, nextBirth = 0, warmed = false;

  const newFilm = (extra) => {
    fluid.paint(film, dip, { uAspect: engine.aspect, uR: R, uC: C, uExtra: extra });
    fluid.paint(fluid.vel, fluid.p.scale, { uTexture: fluid.vel.read, uValue: 0 });
  };
  newFilm(0);

  function simulate(dt, t, p) {
    // thin film is born at the wire, low down, and rises
    if (t > nextBirth && state === "film") {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const x = C[0] + (Math.cos(a) * (R - 0.025)) / engine.aspect, y = C[1] + Math.sin(a) * (R - 0.025);
      fluid.splat(film, x, y, [0.75 + Math.random() * 0.25, 0, 0, 1], 0.0007, true);
      fluid.splat(fluid.vel, x, y, [-Math.cos(a) * 18, 40, 0, 0], 0.0009);
      nextBirth = t + 0.9 + Math.random() * 0.8;
    }
    // the cursor blows on it
    if (p && p.presence > 0.02 && p.moved && state === "film") fluid.stir(p, dt, { force: o.touch ?? 0.12, radius: 0.005, max: 320 });
    fluid.step(dt, (vel) => {
      engine.draw(forces, { uVelocity: vel.read, uFilm: film.read, uDt: dt, uBuoy: o.buoyancy ?? 60, uMean: 0.9, uTime: t, uAspect: engine.aspect, uR: R, uStir: o.draught ?? 2.5, uC: C }, vel.write);
      vel.swap();
    });
    fluid.advect(film, dt, 0, true);
    fluid.paint(film, drain, { uFilm: film.read, uDt: dt, uAspect: engine.aspect, uR: R, uRestore: o.restore ?? 0.05, uDrain: o.drain ?? 0.03, uTime: t, uC: C, uTexel: film.read.texel, uSmooth: o.smooth ?? 0.12 });
  }

  function step(dt, t) {
    pop[2] += dt;
    if (state === "popping" && pop[2] > 0.75) { state = "gone"; stateAt = t; }
    if (state === "gone" && t - stateAt > 0.5) { newFilm(0.35); state = "rising"; stateAt = t; fill = -0.05; pop[3] = 0; }
    if (state === "rising") {
      fill += dt * 1.6;
      if (fill > 1.1) { fill = 1.1; state = "film"; }
    }
  }

  return {
    maxDpr: o.maxDpr ?? 1.75,
    stillAt: 9,
    resize() { fluid.resize(); },
    down(p) {
      const dx = (p.x - C[0]) * engine.aspect, dy = p.y - C[1];
      if (state !== "film" || Math.hypot(dx, dy) > R) return;
      pop = [p.x, p.y, 0, 1];
      state = "popping";
    },
    warm(t) { for (let i = 0; i < 300; i++) simulate(1 / 60, t - (300 - i) / 60, null); warmed = true; },
    frame(dt, t) {
      if (!warmed) { warmed = true; this.warm(t); }
      if (dt > 0) { step(dt, t); simulate(Math.min(dt, 1 / 30), t, engine.pointer); }
      engine.draw(show, {
        uFilm: film.read, uLut: lut, uC: C, uRes: [engine.width, engine.height], uAspect: engine.aspect, uR: R, uTime: t,
        uGrain: o.grain ?? 0.03, uExposure: o.exposure ?? 3.0, uFill: fill, uPop: pop, uWire: wire,
      });
    },
  };
}
