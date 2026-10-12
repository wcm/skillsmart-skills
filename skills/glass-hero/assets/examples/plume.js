// 04 Plume: white smoke rising through black, seen through a prism. A small stable-fluids simulation (vorticity,
// buoyancy, a slow curl-noise breeze) carries smoke up from two sources that sway like incense, and now and then a
// swirl stirs it. The smoke is shaded as silk lit from the left; the display then looks at it through a prism: each
// of fifteen wavelengths sees the smoke shifted a little along a slowly turning axis, so every fold splits into a
// bold fringe, red on one side and violet on the other. The cursor stirs the air; a click lets out a puff.
import * as THREE from "three";
import { NOISE, spectrumRGB } from "../engine/glsl.js";

export const meta = {
  id: "plume", no: "06", name: "Plume", bg: "#040405", ink: "#f3f1ee",
  title: "Plume",
};

// The page in front of the canvas: nav, copy and footer. Links stay put until they go somewhere real (data-noop).
export const html = {
  hero: `
  <header class="nav">
    <a class="brand" href="#" data-noop>Plume</a>
    <nav class="links"><a href="#" data-noop>Work</a><a href="#" data-noop>About</a></nav>
    <a class="pill" href="#" data-noop>Contact</a>
  </header>
  <section class="copy">
    <p class="kicker"><i aria-hidden="true"></i><span>Chromatic fringing · live smoke</span></p>
    <h1>Smoke, <em>split.</em></h1>
    <p class="lede">White smoke seen through a prism. Every fold and edge splits into a bold fringe, red on one side and violet on the other.</p>
    <p class="hint">Move to stir the smoke · click for a puff</p>
  </section>
  <footer class="foot"><span>Plume · a light-only piece</span><span>Stable fluids, 15-tap prism</span></footer>`,
};

const SIM = 128, DYE = 720, JACOBI = 20, TAPS = 15;
// the weight of each wavelength sample, and their sum, worked out once
const K = Array.from({ length: TAPS }, (_, i) => new THREE.Vector3(...spectrumRGB(i / (TAPS - 1))));
const KSUM = K.reduce((a, k) => a.add(k), new THREE.Vector3());

const VERT = /* glsl */ `
uniform vec2 texel;
varying vec2 vUv, vL, vR, vT, vB;
void main() {
  vUv = uv;
  vL = uv - vec2(texel.x, 0.0); vR = uv + vec2(texel.x, 0.0);
  vT = uv + vec2(0.0, texel.y); vB = uv - vec2(0.0, texel.y);
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;
const HEAD = /* glsl */ `varying vec2 vUv, vL, vR, vT, vB;\n`;

const SHADERS = {
  splat: `uniform sampler2D uTarget; uniform float aspect, radius, swirl; uniform vec3 color; uniform vec2 point;
    void main() {
      vec2 p = vUv - point; p.x *= aspect;
      float g = exp(-dot(p, p) / radius);
      vec3 add = color * g;
      add.xy += swirl * vec2(-p.y, p.x) / sqrt(radius) * g; // a vortex instead of a push
      gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + add, 1.0);
    }`,
  curl: `uniform sampler2D uVelocity;
    void main() {
      float L = texture2D(uVelocity, vL).y, R = texture2D(uVelocity, vR).y, T = texture2D(uVelocity, vT).x, B = texture2D(uVelocity, vB).x;
      gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
    }`,
  // vorticity confinement, buoyancy, and a slow breeze from curl noise
  forces: `uniform sampler2D uVelocity, uCurl, uDye; uniform float curl, dt, buoyancy, time, breeze, aspect, home, pull;
    ${NOISE}
    void main() {
      float L = texture2D(uCurl, vL).x, R = texture2D(uCurl, vR).x, T = texture2D(uCurl, vT).x, B = texture2D(uCurl, vB).x, C = texture2D(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      force = force / (length(force) + 1e-4) * curl * C;
      force.y *= -1.0;
      vec2 vel = texture2D(uVelocity, vUv).xy + force * dt;
      vel.y += buoyancy * texture2D(uDye, vUv).x * dt;
      vec2 np = vUv * vec2(aspect, 1.0) * 2.0 + vec2(time * 0.02, -time * 0.06);
      float e = 0.03;
      vel += breeze * vec2(vnoise(np + vec2(0.0, e)) - vnoise(np - vec2(0.0, e)), vnoise(np - vec2(e, 0.0)) - vnoise(np + vec2(e, 0.0))) / (2.0 * e) * dt;
      // a gentle pull back toward the plume's column, so it curls beside the copy, not over it
      vel.x += (home - vUv.x) * pull * dt;
      gl_FragColor = vec4(clamp(vel, -2000.0, 2000.0), 0.0, 1.0);
    }`,
  // walls on three sides; the top is open so the smoke can leave
  divergence: `uniform sampler2D uVelocity;
    void main() {
      float L = texture2D(uVelocity, vL).x, R = texture2D(uVelocity, vR).x, T = texture2D(uVelocity, vT).y, B = texture2D(uVelocity, vB).y;
      vec2 C = texture2D(uVelocity, vUv).xy;
      if (vL.x < 0.0) L = -C.x;
      if (vR.x > 1.0) R = -C.x;
      if (vB.y < 0.0) B = -C.y;
      gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
    }`,
  scale: `uniform sampler2D uTexture; uniform float value;
    void main() { gl_FragColor = value * texture2D(uTexture, vUv); }`,
  pressure: `uniform sampler2D uPressure, uDivergence;
    void main() {
      float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x, T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
      gl_FragColor = vec4((L + R + B + T - texture2D(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);
    }`,
  gradient: `uniform sampler2D uPressure, uVelocity;
    void main() {
      float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x, T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
      gl_FragColor = vec4(texture2D(uVelocity, vUv).xy - vec2(R - L, T - B), 0.0, 1.0);
    }`,
  advect: `uniform sampler2D uVelocity, uSource; uniform vec2 simTexel; uniform float dt, dissipation;
    void main() {
      vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * simTexel;
      gl_FragColor = texture2D(uSource, coord) / (1.0 + dissipation * dt);
    }`,
  // smoke as silk: translucent body, lit from the left, with the thin edges of every fold bright
  shade: `uniform sampler2D uDye;
    void main() {
      float d = texture2D(uDye, vUv).x;
      float dx = texture2D(uDye, vR).x - texture2D(uDye, vL).x, dy = texture2D(uDye, vT).x - texture2D(uDye, vB).x;
      vec3 n = normalize(vec3(-dx * 5.0, -dy * 5.0, 1.0));
      float lit = 0.5 + 0.7 * max(dot(n, normalize(vec3(-0.7, 0.25, 0.65))), 0.0);
      float body = 1.0 - exp(-d * 2.4);
      float rim = clamp(length(vec2(dx, dy)) * 2.6, 0.0, 1.0);
      gl_FragColor = vec4(1.5 * (body * (0.32 + 0.55 * lit) + rim * (0.4 + 0.8 * body)), 0.0, 0.0, 1.0);
    }`,
};

const DISPLAY = /* glsl */ `
uniform sampler2D uSmoke;
uniform vec2 uRes, uAxis;
uniform float uFringe, uTime, uAspect;
uniform vec3 uK[${TAPS}], uKSum;
varying vec2 vUv;
${NOISE}
void main() {
  vec2 uv = vUv;
  // the prism: each wavelength sees the smoke shifted along one axis, spreading a little more toward the edges
  vec2 dir = normalize(uAxis + (uv - 0.5) * vec2(uAspect, 1.0) * 0.6);
  float spread = uFringe * (0.85 + 0.5 * length((uv - 0.5) * vec2(uAspect, 1.0)));
  vec3 c = vec3(0.0);
  for (int i = 0; i < ${TAPS}; i++) {
    float s = float(i) / ${TAPS - 1}.0;
    c += uK[i] * texture2D(uSmoke, uv + (s - 0.5) * spread * dir * vec2(1.0 / uAspect, 1.0)).x;
  }
  c /= uKSum;
  // push saturation so the split reads as colour, not blur
  c = max(mix(vec3(dot(c, vec3(0.3, 0.55, 0.15))), c, 2.2), 0.0);
  // a near-black room with a faint shaft of the side light
  vec3 bg = vec3(0.014, 0.014, 0.018);
  bg += vec3(0.05, 0.05, 0.055) * exp(-pow((uv.y - 0.6 + uv.x * 0.15) / 0.16, 2.0)) * (1.0 - smoothstep(0.0, 0.75, uv.x));
  vec3 col = bg + c * vec3(1.0, 0.99, 0.97);
  vec3 hi = max(col - 0.85, 0.0);
  col = min(col, 0.85) + 0.15 * (1.0 - exp(-hi / 0.15));
  col *= mix(1.0, smoothstep(1.1, 0.3, length((uv - 0.5) * vec2(uAspect, 1.0)) / max(uAspect, 1.0) * 1.4), 0.5);
  col += (hash12(gl_FragCoord.xy + fract(uTime * 7.31) * 311.0) - 0.5) * 0.03;
  gl_FragColor = vec4(col, 1.0);
}`;

function rt(w, h) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
  });
}
function pingpong(w, h) {
  let a = rt(w, h), b = rt(w, h);
  return { w, h, get read() { return a; }, get write() { return b; }, swap() { [a, b] = [b, a]; }, dispose() { a.dispose(); b.dispose(); } };
}
const fit = (short, aspect) => (aspect >= 1 ? [Math.round(short * aspect), short] : [short, Math.round(short / aspect)]);

export function create(stage) {
  const { renderer } = stage;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  scene.add(quad);
  const mats = {};
  for (const [k, body] of Object.entries(SHADERS)) {
    mats[k] = new THREE.ShaderMaterial({ uniforms: { texel: { value: new THREE.Vector2() } }, vertexShader: VERT, fragmentShader: HEAD + body, depthTest: false, depthWrite: false });
  }
  const display = new THREE.ShaderMaterial({
    uniforms: { uSmoke: { value: null }, uRes: { value: new THREE.Vector2() }, uAxis: { value: new THREE.Vector2(1, 0) }, uFringe: { value: 0.03 }, uTime: { value: 0 }, uAspect: { value: 1 }, uK: { value: K }, uKSum: { value: KSUM } },
    vertexShader: VERT, fragmentShader: DISPLAY, depthTest: false, depthWrite: false,
  });

  let simW = 0, simH = 0;
  let vel, dye, pressure, divergence, curl, smoke, simTexel = new THREE.Vector2(), dyeTexel = new THREE.Vector2(), aspect = 1;

  function pass(name, uniforms, target, texel = simTexel) {
    const m = mats[name];
    for (const [k, v] of Object.entries(uniforms)) (m.uniforms[k] ??= { value: null }).value = v;
    m.uniforms.texel.value.copy(texel);
    quad.material = m;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  }
  function splat(field, x, y, color, radius, swirl = 0) {
    pass("splat", { uTarget: field.read.texture, aspect, point: new THREE.Vector2(x, y), color: new THREE.Vector3(...color), radius, swirl }, field.write, field === dye ? dyeTexel : simTexel);
    field.swap();
  }

  function build(w, h) {
    [vel, dye, pressure, divergence, curl, smoke].forEach((t) => t?.dispose());
    aspect = w / h;
    const [sw, sh] = fit(SIM, aspect), [dw, dh] = fit(DYE, aspect);
    vel = pingpong(sw, sh); pressure = pingpong(sw, sh);
    divergence = rt(sw, sh); curl = rt(sw, sh);
    dye = pingpong(dw, dh); smoke = rt(dw, dh);
    simTexel.set(1 / sw, 1 / sh);
    dyeTexel.set(1 / dw, 1 / dh);
    seeded = false;
  }

  // ——— the sources: two incense-like plumes under the slot, swaying, and an occasional swirl ———
  let seeded = false, nextSwirl = 3, puff = 0;
  const sources = () => {
    const s = stage.slot;
    return s.wide ? [[s.x + 0.03, 0.02, 1], [s.x - 0.1, 0.0, 0.6]] : [[0.56, 0.02, 1], [0.38, 0.0, 0.6]];
  };

  return {
    maxDpr: 1.25,
    resize(w, h, dpr) {
      // the simulation depends on the window's shape, not on how many pixels we draw, so a change of resolution keeps the smoke
      if (w !== simW || h !== simH) { simW = w; simH = h; build(w, h); }
      display.uniforms.uRes.value.set(w * dpr, h * dpr);
      display.uniforms.uAspect.value = w / h;
    },
    down() { puff = 1; },
    update(dt, t) {
      const p = stage.p, h = Math.min(dt, 1 / 30);
      if (h <= 0) return;
      // a head start, so the first frame already has smoke in it
      if (!seeded) { seeded = true; for (let i = 0; i < 150; i++) this.simulate(1 / 60, t - (150 - i) / 60, null); }
      this.simulate(h, t, p);
      display.uniforms.uSmoke.value = smoke.texture;
      const ang = 0.5 + 0.3 * Math.sin(t * 0.07);
      display.uniforms.uAxis.value.set(Math.cos(ang), Math.sin(ang));
      display.uniforms.uTime.value = t;
      display.uniforms.uFringe.value = 0.06 * Math.min(1, stage.w / stage.h); // measured against the shorter side
      quad.material = display;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    },
    simulate(h, t, p) {
      // sources
      for (const [x, y, k] of sources()) {
        const sx = x + 0.025 * Math.sin(t * 0.6 * k + k * 4) + 0.012 * Math.sin(t * 1.7 + k);
        splat(dye, sx, y + 0.04, [6 * k * h, 0, 0], 0.00025);
        splat(vel, sx, y + 0.04, [Math.sin(t * 0.9 + k * 3) * 800 * k * h, 1500 * k * h, 0], 0.0006);
      }
      if (t > nextSwirl) {
        const s = stage.slot;
        splat(vel, (s.wide ? s.x : 0.5) + (Math.random() - 0.5) * 0.2, 0.45 + Math.random() * 0.2, [0, 0, 0], 0.006, (Math.random() < 0.5 ? -1 : 1) * 150);
        nextSwirl = t + 5 + Math.random() * 4;
      }
      // the cursor stirs the air; a click lets out a puff
      if (p && p.presence > 0.05) {
        const speed = Math.hypot(p.vx, p.vy);
        if (speed > 0.02) splat(vel, (p.sx + 1) / 2, (p.sy + 1) / 2, [p.vx * 0.5 * vel.w * 0.5 * p.presence, p.vy * 0.5 * vel.h * 0.5 * p.presence, 0], 0.0015);
      }
      if (p && puff > 0) {
        splat(dye, (p.sx + 1) / 2, (p.sy + 1) / 2, [1.4, 0, 0], 0.0012);
        splat(vel, (p.sx + 1) / 2, (p.sy + 1) / 2, [0, 40, 0], 0.002, (Math.random() < 0.5 ? -1 : 1) * 120);
        puff = 0;
      }
      // the fluid step
      pass("curl", { uVelocity: vel.read.texture }, curl);
      pass("forces", { uVelocity: vel.read.texture, uCurl: curl.texture, uDye: dye.read.texture, curl: 9, dt: h, buoyancy: 95, time: t, breeze: 2.5, aspect, home: stage.slot.wide ? stage.slot.x : 0.5, pull: 60 }, vel.write); vel.swap();
      pass("divergence", { uVelocity: vel.read.texture }, divergence);
      pass("scale", { uTexture: pressure.read.texture, value: 0.8 }, pressure.write); pressure.swap();
      for (let i = 0; i < JACOBI; i++) { pass("pressure", { uPressure: pressure.read.texture, uDivergence: divergence.texture }, pressure.write); pressure.swap(); }
      pass("gradient", { uPressure: pressure.read.texture, uVelocity: vel.read.texture }, vel.write); vel.swap();
      pass("advect", { uVelocity: vel.read.texture, uSource: vel.read.texture, simTexel, dt: h, dissipation: 0.4 }, vel.write); vel.swap();
      pass("advect", { uVelocity: vel.read.texture, uSource: dye.read.texture, simTexel, dt: h, dissipation: 0.4 }, dye.write, dyeTexel); dye.swap();
      pass("shade", { uDye: dye.read.texture }, smoke, dyeTexel);
    },
    dispose() {
      [vel, dye, pressure, divergence, curl, smoke].forEach((t) => t?.dispose());
      Object.values(mats).forEach((m) => m.dispose());
      display.dispose();
      quad.geometry.dispose();
      renderer.setRenderTarget(null);
    },
  };
}
