// 01 Urchin: a hundred and forty thick glass rods round a chrome core with one white light inside. Each rod is a
// hexagonal prism: light enters one facet and leaves through the facet two round (a 60° prism), each of seven
// wavelengths bent by its own index, so the thin white strip lights of the studio, the ring light behind the camera
// and the core itself break into spectra across the facets as the urchin turns. Light is also carried out along
// each rod from the core, with pulses running outward; the rods breathe and a slow wave of reach rolls across them.
// Drag to tilt and roll it (it keeps turning when flung, then settles into its own slow spin); the rods pointing at
// the cursor reach for it; a tap makes it bloom.
import * as THREE from "three";
import { SPECTRUM } from "../engine/glsl.js";
import { makePost } from "../engine/post.js";
import { aim, pointerRay } from "../engine/stage.js";
import { Trackball } from "../engine/trackball.js";
import { bakeEnv } from "../engine/glass.js";

export const meta = {
  id: "urchin", no: "01", name: "Spectra", bg: "#020308", ink: "#f3f1ee",
  title: "Spectra · Vision models that see everything",
};

// The page in front of the canvas: nav, copy and footer. Links stay put until they go somewhere real (data-noop).
export const html = {
  hero: `
  <header class="nav">
    <a class="brand" href="#" data-noop><i class="ur-mark" aria-hidden="true"></i>Spectra</a>
    <nav class="links"><a href="#" data-noop>Research</a><a href="#" data-noop>Models</a><a href="#" data-noop>API</a><a href="#" data-noop>Careers</a></nav>
    <a class="pill" href="#" data-noop>Try Spectra 3</a>
  </header>
  <section class="copy">
    <p class="kicker"><i aria-hidden="true"></i><span>Spectra 3 · now in preview</span></p>
    <h1>One image,<br><em>every colour.</em></h1>
    <p class="lede">A vision model that splits a single picture into everything inside it: objects, depth, motion and meaning. Like white light through glass, nothing is lost on the way.</p>
    <div class="cta"><a class="btn" href="#" data-noop>Read the paper <i>→</i></a><span>140 tasks · one model</span></div>
    <p class="hint">Drag to tilt and roll it · the rods reach for you · tap to bloom</p>
  </section>
  <footer class="foot"><span>Spectra Research · San Francisco</span><span>Dispersion, 7 wavelengths</span></footer>`,
};

const N = 140, CORE = 0.42, RADIUS = 2.45;

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The studio the glass sees, in world space: black, with thin white strip lights all round, a ring light behind the
// camera and a dim fill. Thin and bright is what a prism splits into a rainbow. It is baked once into a small cube map
// (red: the studio; green: the soft light bars the glass sees through itself), so each look is one texture fetch.
const STRIPS = [
  // centre direction, axis along the strip, width, half-length, brightness
  [[-0.85, 0.15, 0.5], [0.1, 1.0, 0.15], 0.03, 0.7, 7],
  [[0.9, -0.05, 0.45], [-0.1, 1.0, 0.0], 0.025, 0.7, 6],
  [[0.05, 0.92, 0.35], [1.0, 0.0, 0.1], 0.025, 0.6, 5],
  [[-0.1, -0.9, 0.4], [1.0, 0.25, 0.0], 0.02, 0.55, 4],
  [[0.3, 0.2, -0.93], [0.0, 1.0, 0.2], 0.035, 0.8, 5],
  [[-0.6, -0.3, -0.74], [0.7, 0.7, 0.0], 0.03, 0.6, 4],
];
function stripUniforms() {
  const center = [], axis = [], side = [], params = [];
  for (const [c, a, w, l, b] of STRIPS) {
    const C = new THREE.Vector3(...c).normalize(), A = new THREE.Vector3(...a).normalize();
    center.push(C); axis.push(A); side.push(new THREE.Vector3().crossVectors(A, C).normalize());
    params.push(new THREE.Vector3(w, l, b));
  }
  return { uStripC: { value: center }, uStripA: { value: axis }, uStripS: { value: side }, uStripP: { value: params } };
}
const STUDIO = /* glsl */ `
uniform vec3 uStripC[${STRIPS.length}], uStripA[${STRIPS.length}], uStripS[${STRIPS.length}], uStripP[${STRIPS.length}];
vec3 studio(vec3 d) {
  float L = 0.0;
  for (int i = 0; i < ${STRIPS.length}; i++) {
    vec3 p = uStripP[i];
    L += p.z * smoothstep(p.x, p.x * 0.25, abs(dot(d, uStripS[i]))) * smoothstep(p.y, p.y * 0.6, abs(dot(d, uStripA[i]))) * step(0.2, dot(d, uStripC[i]));
  }
  L += 1.6 * smoothstep(0.01, 0.003, abs(d.z - 0.913)); // a ring light behind the camera, ~24° round the view axis
  return vec3(L) + vec3(0.015, 0.018, 0.03) * (0.6 + 0.4 * d.y);
}
// what the glass sees through itself: soft bars of white from the studio's light boxes. Each wavelength leaves the
// prism at its own angle and so lands on a different part of the bars: rainbow bands through the body of every rod.
vec3 bars(vec3 d) {
  float b = pow(0.5 + 0.5 * sin(dot(d, vec3(0.8, 0.5, 0.33)) * 11.0), 6.0) + pow(0.5 + 0.5 * sin(dot(d, vec3(-0.3, 0.9, -0.3)) * 7.0 + 1.3), 8.0);
  return vec3(1.25 * b);
}
`;
const BAKE = /* glsl */ `${STUDIO}
vec3 env(vec3 d) { return vec3(studio(d).r, bars(d).r, 0.0); }`;
// what the rods and the chrome read back
const ENV = /* glsl */ `
uniform samplerCube uEnv;
float studio(vec3 d) { return textureCube(uEnv, d).r; }
float bars(vec3 d) { return textureCube(uEnv, d).g; }
// the white light inside the core, seen along direction d from a point whose way to the core is toCore
vec3 coreLight(vec3 d, vec3 toCore) {
  float c = max(dot(d, toCore), 0.0);
  return vec3(1.0, 0.98, 0.95) * (3.0 * pow(c, 200.0) + 0.12 * pow(c, 10.0));
}
`;

const ROD_VERT = /* glsl */ `
attribute vec3 aDir;
attribute float aLen, aSeed, aRad, aEdge;
uniform float uTime, uPresence, uBurst;
uniform vec3 uCursor, uWave;
varying float vAlong, vSeed, vReach, vEdge;
varying vec3 vWN, vWP, vAxis;
void main() {
  vec3 dir = normalize(aDir);
  vec3 wdir = normalize(mat3(modelMatrix) * dir);
  float reach = smoothstep(0.72, 0.99, dot(wdir, uCursor)) * uPresence;
  float breathe = 1.0 + 0.05 * sin(uTime * 0.8 + aSeed * 6.2831) + 0.03 * sin(uTime * 0.37 + aSeed * 17.0);
  float wave = 0.08 * sin(dot(dir, uWave) * 3.2 - uTime * 1.05);
  float len = aLen * (breathe + wave) * (1.0 + 0.25 * reach + uBurst * (0.3 + 0.3 * fract(aSeed * 7.31)));
  vec3 up = abs(dir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tx = normalize(cross(up, dir)), tz = cross(dir, tx);
  // each rod turned about its own axis, so the facets don't all line up
  float tw = aSeed * 6.2831;
  mat2 r = mat2(cos(tw), sin(tw), -sin(tw), cos(tw));
  vec2 pxz = r * position.xz, nxz = r * normal.xz;
  vec3 p = tx * pxz.x * aRad + tz * pxz.y * aRad + dir * (${(CORE * 0.85).toFixed(3)} + position.y * len);
  vec3 n = tx * nxz.x + tz * nxz.y + dir * normal.y;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWP = wp.xyz;
  vWN = normalize(mat3(modelMatrix) * n);
  vAxis = wdir;
  vAlong = position.y;
  vSeed = aSeed;
  vReach = reach;
  vEdge = aEdge;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const ROD_FRAG = /* glsl */ `
uniform float uTime, uBurst, uSpread;
varying float vAlong, vSeed, vReach, vEdge;
varying vec3 vWN, vWP, vAxis;
${SPECTRUM}
${ENV}
vec3 turn(vec3 v, vec3 a, float t) { return v * cos(t) + cross(a, v) * sin(t) + a * dot(a, v) * (1.0 - cos(t)); }
void main() {
  vec3 A = normalize(vAxis);
  vec3 N = normalize(vWN);
  vec3 V = normalize(cameraPosition - vWP);
  vec3 toCore = normalize(-vWP);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float F = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  // a side facet and the facet 120° round from it make a 60° prism; the end caps just let light through
  vec3 Np = N - A * dot(N, A);
  bool side = dot(Np, Np) > 0.25;
  Np = side ? normalize(Np) : N;
  vec3 Ea = turn(Np, A, 2.0944), Eb = turn(Np, A, -2.0944);
  // a prism spreads its spectrum across its edge, i.e. round the rod: fan the wavelengths that way on every path
  vec3 around = normalize(cross(A, N) + 1e-4);
  vec3 refr = vec3(0.0), wsum = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    float s = float(i) / 6.0;
    vec3 k = spectrum(s);
    float ior = 1.5 + uSpread * (0.5 - s); // violet bends most
    vec3 T = refract(-V, N, 1.0 / ior);
    vec3 E = side ? (dot(T, Ea) > dot(T, Eb) ? Ea : Eb) : -N;
    vec3 T2 = refract(T, -E, ior);
    if (dot(T2, T2) < 1e-4) T2 = reflect(T, -E); // total internal reflection
    T2 = normalize(T2 + around * (s - 0.5) * 0.2);
    // the bars hang a few units away, so each point along a rod sees a different part of them: bands run along the glass
    refr += k * (0.45 * studio(T2) + bars(normalize(T2 * 2.5 + vWP)) + coreLight(T2, toCore));
    wsum += k;
  }
  refr /= wsum;
  // reflections of the strips, nudged apart round the rod per channel so even the glints carry a colour edge
  vec3 R = reflect(-V, N);
  vec3 refl = vec3(studio(normalize(R + around * 0.035)), studio(R), studio(normalize(R - around * 0.035)));
  vec3 col = (refl + 0.5 * coreLight(R, toCore)) * F * 0.55 + refr * (1.0 - F) * 1.1;
  // light carried out along the rod from the core, turning spectral as it goes, with pulses running outward
  float carry = exp(-vAlong * 2.6);
  float pulse = pow(0.5 + 0.5 * sin(vAlong * 7.0 - uTime * 2.0 + vSeed * 40.0), 16.0);
  vec3 tint = mix(vec3(1.0), spectrum(fract(vAlong * 0.8 + vSeed * 0.37 - uTime * 0.03)) * 1.5, 0.85 * smoothstep(0.02, 0.3, vAlong));
  col += tint * (0.08 * carry + 0.22 * pulse * (0.3 + carry) + 0.4 * uBurst * carry) * (0.35 + 0.65 * (1.0 - ndv));
  // the arris between facets catches a thin line of light
  float e = side ? min(vEdge, 1.0 - vEdge) : 1.0;
  col += smoothstep(0.07, 0.0, e) * mix(vec3(1.0), spectrum(fract(vAlong * 1.3 + vSeed)) * 1.4, 0.6) * (0.12 + 0.5 * carry);
  // a rod pointing straight at the viewer stacks its whole length into one spot: let it fade instead of flaring
  col *= (1.0 + 0.4 * vReach) * (1.0 - 0.65 * smoothstep(0.7, 0.96, abs(dot(A, V))));
  if (any(isnan(col))) col = vec3(0.0);
  gl_FragColor = vec4(min(col * 0.42, vec3(24.0)), 1.0);
}`;

const CHROME_VERT = /* glsl */ `
varying vec3 vN, vW;
void main() {
#ifdef USE_INSTANCING
  mat4 m = modelMatrix * instanceMatrix;
#else
  mat4 m = modelMatrix;
#endif
  vec4 wp = m * vec4(position, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(m) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

// Polished chrome in the same studio, with the rods' spectral glow round its horizon.
const CHROME_FRAG = /* glsl */ `
uniform float uTime, uGlow;
varying vec3 vN, vW;
${SPECTRUM}
${ENV}
void main() {
  vec3 V = normalize(cameraPosition - vW), N = normalize(vN);
  vec3 r = reflect(-V, N);
  vec3 c = vec3(studio(r)) * 0.5 + spectrum(fract(atan(r.z, r.x) * 0.159 + r.y * 0.35 + uTime * 0.03)) * (0.3 + uGlow) * pow(max(1.0 - abs(r.y), 0.0), 2.5);
  float F = 0.55 + 0.45 * pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 5.0);
  c *= F;
  if (any(isnan(c))) c = vec3(0.0);
  gl_FragColor = vec4(c, 1.0);
}`;

// The white light inside: a billboard at the centre, so the chrome core hides its middle and it blooms around it.
const GLOW_VERT = /* glsl */ `
uniform float uSize;
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FRAG = /* glsl */ `
uniform float uPower;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float g = exp(-r * r * 9.0) * 1.6 + exp(-r * 4.0) * 0.35;
  gl_FragColor = vec4(vec3(1.0, 0.97, 0.94) * g * uPower * smoothstep(1.0, 0.7, r), 1.0);
}`;

// A hexagonal prism with flat facets, base at the origin, along +y. Each side-facet vertex is labelled 0 or 1 by
// which of the facet's two vertical edges it sits on, so the shader knows how close it is to an arris.
function prism() {
  const g = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false).translate(0, 0.5, 0).toNonIndexed();
  g.computeVertexNormals();
  const pos = g.getAttribute("position"), edge = new Float32Array(pos.count).fill(0.5);
  for (let t = 0; t < pos.count; t += 3) {
    const ys = [0, 1, 2].map((i) => pos.getY(t + i));
    if (ys[0] === ys[1] && ys[1] === ys[2]) continue; // a cap
    const a0 = Math.atan2(pos.getZ(t), pos.getX(t));
    const da = [0, 1, 2].map((i) => {
      let d = Math.atan2(pos.getZ(t + i), pos.getX(t + i)) - a0;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      return d;
    });
    const lo = Math.min(...da);
    da.forEach((d, i) => (edge[t + i] = Math.abs(d - lo) < 1e-3 ? 0 : 1));
  }
  g.setAttribute("aEdge", new THREE.BufferAttribute(edge, 1));
  return g;
}

export function create(stage) {
  const { renderer } = stage;
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps the spectrum saturated where ACES would wash it out
  renderer.toneMappingExposure = 1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020308);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const tilt = new THREE.Group(), spin = new THREE.Group();
  scene.add(tilt);
  tilt.add(spin);
  spin.quaternion.setFromEuler(new THREE.Euler(0.35, 0.4, 0.1));
  const env = bakeEnv(renderer, BAKE, { uniforms: stripUniforms() });
  const disposables = [env];

  // ——— the rods ———
  const base = prism();
  const geo = new THREE.InstancedBufferGeometry();
  for (const k of ["position", "normal", "aEdge"]) geo.setAttribute(k, base.getAttribute(k));
  geo.instanceCount = N;
  const rand = rng(7);
  const dir = new Float32Array(N * 3), len = new Float32Array(N), seed = new Float32Array(N), rad = new Float32Array(N);
  const golden = Math.PI * (3 - Math.sqrt(5)), v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const y = 1 - ((i + 0.5) / N) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
    v.set(Math.cos(th) * r + (rand() - 0.5) * 0.12, y + (rand() - 0.5) * 0.12, Math.sin(th) * r + (rand() - 0.5) * 0.12).normalize();
    v.toArray(dir, i * 3);
    len[i] = 1.15 + 0.8 * Math.pow(rand(), 1.3);
    seed[i] = rand();
    rad[i] = 0.055 + 0.025 * rand();
  }
  geo.setAttribute("aDir", new THREE.InstancedBufferAttribute(dir, 3));
  geo.setAttribute("aLen", new THREE.InstancedBufferAttribute(len, 1));
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
  geo.setAttribute("aRad", new THREE.InstancedBufferAttribute(rad, 1));
  const u = {
    uTime: { value: 0 }, uPresence: { value: 0 }, uBurst: { value: 0 }, uSpread: { value: 0.5 }, uEnv: { value: env.texture },
    uCursor: { value: new THREE.Vector3(0, 0, 1) }, uWave: { value: new THREE.Vector3(1, 0, 0) },
  };
  const rodMat = new THREE.ShaderMaterial({
    uniforms: u, vertexShader: ROD_VERT, fragmentShader: ROD_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const rods = new THREE.Mesh(geo, rodMat);
  rods.frustumCulled = false;
  spin.add(rods);
  disposables.push(base, geo, rodMat);

  // ——— the chrome core and a collar where each rod enters it ———
  const chromeU = { uTime: u.uTime, uGlow: { value: 0 }, uEnv: u.uEnv };
  const chromeMat = new THREE.ShaderMaterial({ uniforms: chromeU, vertexShader: CHROME_VERT, fragmentShader: CHROME_FRAG });
  const coreGeo = new THREE.SphereGeometry(CORE, 64, 40);
  spin.add(new THREE.Mesh(coreGeo, chromeMat));
  const studGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1);
  const studs = new THREE.InstancedMesh(studGeo, chromeMat, N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), s3 = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    v.fromArray(dir, i * 3);
    q.setFromUnitVectors(Y, v);
    const r = rad[i] * 1.35;
    m.compose(v.clone().multiplyScalar(CORE * 0.98), q, s3.set(r, 0.09, r));
    studs.setMatrixAt(i, m);
  }
  spin.add(studs);
  disposables.push(chromeMat, coreGeo, studGeo);

  const glowU = { uSize: { value: 0.95 }, uPower: { value: 0.4 } };
  const glowMat = new THREE.ShaderMaterial({
    uniforms: glowU, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const glowGeo = new THREE.PlaneGeometry(2, 2);
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.frustumCulled = false;
  spin.add(glow);
  disposables.push(glowMat, glowGeo);

  const post = makePost(renderer, scene, camera, { bloom: [0.35, 0.3, 0.75], disperse: 0.018, vignette: 0.55, samples: 2 });

  // ——— motion: a slow spin of its own, a trackball drag with a fling, and a parallax lean toward the cursor ———
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.9); // z = 0.9, just in front of the core
  const hit = new THREE.Vector3(), aimDir = new THREE.Vector3(0, 0, 1);
  const ball = new Trackball(spin, { own: [0.15, 1, 0.08], spin: 0.11 });
  let burst = 0, burstV = 0, leanX = 0, leanY = 0;

  return {
    maxDpr: 1.25,
    resize(w, h, dpr) {
      camera.position.set(0, 0, aim(camera, w, h, stage.slot, RADIUS));
      post.resize(w, h, dpr);
    },
    down(e) { ball.down(e); },
    move(e) { ball.move(e); },
    up() { if (ball.up()) burstV += 4.5; }, // a tap, not a drag: bloom
    update(dt, t) {
      const p = stage.p, k = 1 - Math.exp(-dt * 3), drag = ball.dragging;
      ball.update(dt);
      leanX += (-p.sy * 0.16 * p.presence - leanX) * k;
      leanY += (p.sx * 0.22 * p.presence - leanY) * k;
      tilt.rotation.set(leanX, leanY, 0);
      scene.updateMatrixWorld();

      // the rods reach for the point under the cursor, a little in front of the core
      if (!drag && pointerRay(camera, p).intersectPlane(plane, hit)) aimDir.lerp(hit.normalize(), 1 - Math.exp(-dt * 8)).normalize();
      u.uCursor.value.copy(aimDir);
      u.uPresence.value = drag ? 0 : p.presence;

      burstV += -burst * 40 * dt - burstV * 5 * dt;
      burst += burstV * dt;
      u.uBurst.value = burst;
      u.uTime.value = t;
      u.uWave.value.set(Math.cos(t * 0.21), Math.sin(t * 0.13) * 0.6, Math.sin(t * 0.21)).normalize();
      chromeU.uGlow.value = 0.25 * Math.max(0, burst);
      glowU.uPower.value = 0.38 + 0.06 * Math.sin(t * 1.7) + 0.5 * Math.max(0, burst);
      post.render(t);
    },
    dispose() {
      ball.dispose();
      post.dispose();
      disposables.forEach((d) => d.dispose());
      studs.dispose();
    },
  };
}
