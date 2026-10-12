// 03 Halo: a ring of light drifting up through mist, as a long exposure. One ring rises along an egg-shaped path,
// narrowing as it goes, and the exposure keeps its ghosts: a stack of smoky, feathered rings with faint spectral
// edges. At its foot a soft rainbow arch (orange outside, lilac inside) curves over a low white-gold sun, on a dusk
// gradient from slate teal to apricot. The rings never stop rising; the cursor leans the stack and nudges the sun,
// and holding the pointer down speeds the rise and draws the rings and the arch tighter and brighter.
import * as THREE from "three";
import { SPECTRUM, NOISE, QUAD_VERT } from "../engine/glsl.js";

export const meta = {
  id: "halo", no: "05", name: "Halo", bg: "#6d7884", ink: "#fffaf3",
  title: "Halo",
};

// The page in front of the canvas: nav, copy and footer. Links stay put until they go somewhere real (data-noop).
export const html = {
  hero: `
  <header class="nav">
    <a class="brand" href="#" data-noop>Halo</a>
    <nav class="links"><a href="#" data-noop>Journal</a><a href="#" data-noop>About</a></nav>
    <a class="pill" href="#" data-noop>Subscribe</a>
  </header>
  <section class="copy">
    <p class="kicker"><i aria-hidden="true"></i><span>Spectral halo · long exposure</span></p>
    <h1>Light, <em>slowly.</em></h1>
    <p class="lede">A ring of light drifting up through mist. The long exposure stacks its ghosts into one soft egg, with a rainbow arch and a low sun at its foot.</p>
    <p class="hint">Move to lean the rings · hold to rise through them</p>
  </section>
  <footer class="foot"><span>Halo · a light-only piece</span><span>No glass</span></footer>`,
};

const RINGS = 11;

const FRAG = /* glsl */ `
uniform vec2 uRes, uSlot, uPtr;
uniform float uScale, uTime, uFlow, uRise, uPresence;
varying vec2 vUv;
${SPECTRUM}
${NOISE}

// three octaves are plenty for soft smoke and mist
float fbm3(vec2 p) { return 0.5 * vnoise(p) + 0.25 * vnoise(p * 2.03 + 17.1) + 0.125 * vnoise(p * 4.1 + 31.7); }

vec3 sky(float y) {
  vec3 c = mix(vec3(0.93, 0.73, 0.58), vec3(0.75, 0.62, 0.58), smoothstep(0.0, 0.3, y));
  c = mix(c, vec3(0.43, 0.47, 0.52), smoothstep(0.22, 0.6, y));
  return mix(c, vec3(0.17, 0.27, 0.34), smoothstep(0.55, 1.0, y));
}

// signed distance (first order) to an ellipse with half-axes ab centred at c; q returns the ellipse-space point
float ellipse(vec2 p, vec2 c, vec2 ab, out vec2 q) {
  q = (p - c) / ab;
  float e = length(q);
  return (e - 1.0) * e / max(length(q / ab), 1e-4);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  vec2 p = (frag - vec2(uSlot.x, 1.0 - uSlot.y) * uRes) / uScale;
  float t = uTime;
  vec3 col = sky(uv.y);

  // drifting mist
  col += (fbm3(p * 2.2 + vec2(t * 0.012, -t * 0.03)) - 0.44) * 0.05;

  float lean = 0.12 * uPtr.x * uPresence;
  vec2 sun = vec2(0.025 * uPtr.x * uPresence + 0.006 * sin(t * 0.4), -0.44);

  // the ghosts: one ring rising and narrowing along an egg, smeared into a stack by the exposure
  vec3 ghosts = vec3(0.0);
  for (int k = 0; k < ${RINGS}; k++) {
    float fk = float(k);
    float s = fract(fk / ${RINGS}.0 + uFlow);
    float a = (0.31 * pow(sin(3.14159 * mix(0.2, 1.0, s)), 0.7) + 0.01) * (1.0 + 0.06 * sin(fk * 2.7));
    vec2 c = vec2(lean * s * s + 0.016 * sin(t * 0.35 + s * 5.0 + fk), -0.34 + 0.72 * s);
    float w = mix(0.01, 0.028, s) * (1.0 - 0.4 * uRise);
    vec2 q;
    float d = ellipse(p, c, vec2(a, a * 0.5), q);
    if (abs(d) > 0.16 + 6.0 * w) continue;
    float th = atan(q.y, q.x);
    // smoke: the ring wobbles and thins out along its length
    float n = fbm3(vec2(cos(th), sin(th)) * 1.3 + vec2(fk * 2.3, s * 3.0 + t * 0.15)) * 1.1; // around a circle: no seam
    d += (n - 0.5) * 0.03 * (0.4 + s);
    float smoke = 1.6 * smoothstep(0.25, 0.8, n);
    float fade = smoothstep(0.0, 0.12, s) * (1.0 - smoothstep(0.62, 1.0, s));
    float f = 0.003 + 0.004 * uRise; // a hint of dispersion: warm outside, cool inside
    // the exposure smears each ring along its path: the ring, and two fainter, softer copies trailing below
    vec3 band = vec3(0.0);
    for (int m = 0; m < 3; m++) {
      float fm = float(m), dm = d + fm * 0.013 * (q.y > 0.0 ? 0.6 : 1.0), wm = w * (1.0 + 0.7 * fm);
      band += vec3(exp(-pow((dm - f) / wm, 2.0)), exp(-pow(dm / wm, 2.0)), exp(-pow((dm + f) / wm, 2.0))) / (1.0 + 1.4 * fm);
    }
    // the near arc (upper, seen from below) bright, the far arc fainter: loops, not stripes
    ghosts += band * fade * smoke * (0.72 + 0.4 * clamp(q.y, -1.0, 1.0));
  }
  col += ghosts * vec3(1.0, 0.84, 0.8) * (0.16 + 0.07 * uRise);

  // the rainbow arch over the sun, smeared upward a little like everything else in the exposure
  vec2 ac = sun + vec2(lean * 0.05, 0.0);
  float R = 0.26 + 0.006 * sin(t * 0.5);
  float vis = smoothstep(sun.y - 0.03, sun.y + 0.16, p.y);
  vec3 arch = vec3(0.0);
  for (int j = 0; j < 3; j++) {
    float off = float(j) * 0.022;
    float rd = length((p - ac - vec2(0.0, off)) / vec2(1.0, 1.08)) - R;
    float tt = rd / (0.052 - 0.014 * uRise);
    vec3 spec = mix(spectrum(clamp(0.5 + 0.5 * tt, 0.0, 1.0)) * 1.3, vec3(1.0), 0.1);
    arch += spec * exp(-tt * tt * 1.5) * (j == 0 ? 0.95 : 0.25);
    // lilac light pooled inside the arch
    if (j == 0) arch += vec3(0.78, 0.64, 0.95) * smoothstep(0.02, -0.16, rd) * 0.3;
  }
  col += arch * vis * (0.8 + 0.35 * uRise);

  // the sun at its foot
  float r = length(p - sun);
  col += vec3(1.0, 0.97, 0.9) * exp(-r * r / 0.0005) * (1.3 + 0.6 * uRise);
  col += vec3(1.0, 0.86, 0.68) * (exp(-r * r / 0.007) * 0.5 + exp(-r / 0.2) * 0.22);

  // soft film: highlights roll off instead of clipping, then grain (which also dithers the gradient)
  vec3 hi = max(col - 0.8, 0.0);
  col = min(col, 0.8) + 0.2 * (1.0 - exp(-hi / 0.2));
  col += (hash12(frag + fract(t * 7.31) * 311.0) - 0.5) * 0.035;
  gl_FragColor = vec4(col, 1.0);
}`;

export function create(stage) {
  const { renderer } = stage;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const u = {
    uRes: { value: new THREE.Vector2() }, uSlot: { value: new THREE.Vector2() }, uPtr: { value: new THREE.Vector2() },
    uScale: { value: 1 }, uTime: { value: 0 }, uFlow: { value: 0 }, uRise: { value: 0 }, uPresence: { value: 0 },
  };
  const geo = new THREE.PlaneGeometry(2, 2);
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: QUAD_VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false });
  scene.add(new THREE.Mesh(geo, mat));
  let rise = 0, flow = 0.3;

  return {
    maxDpr: 1, // it is all soft light: one pixel per CSS pixel is plenty
    resize(w, h, dpr) {
      const s = stage.slot;
      u.uRes.value.set(w * dpr, h * dpr);
      u.uSlot.value.set(s.x, s.y);
      // fit the egg and its glow (half-height ≈ 0.54, half-width ≈ 0.34 units) into the slot
      u.uScale.value = dpr * Math.min((s.size * h * Math.min(s.y, 1 - s.y)) / 0.54, (s.size * w * Math.min(s.x, 1 - s.x)) / 0.34);
    },
    update(dt, t) {
      const p = stage.p;
      rise += ((p.down ? 1 : 0) - rise) * (1 - Math.exp(-dt * 2.2));
      flow += dt * 0.032 * (1 + 3.5 * rise);
      u.uTime.value = t;
      u.uFlow.value = flow % 1;
      u.uRise.value = rise;
      u.uPtr.value.set(p.sx, p.sy);
      u.uPresence.value = p.presence;
      renderer.render(scene, camera);
    },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
