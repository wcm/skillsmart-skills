// 04 Flower: a flower of thin glass in coloured light, seen through a soft old lens. Two rings of cupped petals, a
// dome of glass beads at the heart and a bud on a curving stem. The glass is thin, so it shows the light where you
// see it edge-on: warm at the heart, pink, violet and blue toward the tips, with the rims split into a spectrum and
// a soft studio reflected in it. The lens keeps one spot in focus and lets the rest go soft, splitting each
// wavelength a little more the further out of focus it is; halation and grain on top. The petals breathe, the
// flower sways and its light slowly changes; focus follows the cursor and the petals open toward it; drag to tilt
// and turn the flower (it settles back).
import * as THREE from "three";
import { SPECTRUM } from "../engine/glsl.js";
import { Lens } from "../engine/lens.js";
import { aim } from "../engine/stage.js";
import { Trackball } from "../engine/trackball.js";
import { bakeEnv, backdrop } from "../engine/glass.js";

export const meta = {
  id: "flower", no: "04", name: "Iris Nº 4", bg: "#06050c", ink: "#f6eef4",
  title: "Iris Nº 4 · Eau de parfum",
};

// The page in front of the canvas: nav, copy and footer. Links stay put until they go somewhere real (data-noop).
export const html = {
  hero: `
  <header class="nav">
    <a class="brand" href="#" data-noop>Maison Iris</a>
    <nav class="links"><a href="#" data-noop>Parfums</a><a href="#" data-noop>The house</a><a href="#" data-noop>Boutiques</a></nav>
    <a class="pill" href="#" data-noop>Discover Nº 4</a>
  </header>
  <section class="copy">
    <p class="kicker"><i aria-hidden="true"></i><span>Nº 4 · Eau de parfum</span></p>
    <h1>Bloom,<br><em>in soft focus.</em></h1>
    <p class="lede">Orris butter, violet leaf and a breath of pink pepper. A perfume that opens slowly, like a flower you only half remember.</p>
    <div class="cta"><a class="btn" href="#" data-noop>Find your bottle <i>→</i></a><span>50 ml · €210</span></div>
    <p class="hint">Move to pull focus · drag to turn the flower</p>
  </section>
  <footer class="foot"><span>Maison Iris · Paris</span><span>Grasse orris, 2026 harvest</span></footer>`,
};

const RADIUS = 1.75, OUTER = 8, INNER = 6, BUD = 6, BEADS = 70, DEW = 4; // dew drops per outer petal
const OUTER_SHAPE = [1.2, 0.6, 0.18, 0.2], INNER_SHAPE = [0.7, 0.38, 0.25, 0.3], BUD_SHAPE = [0.55, 0.22, 0.3, 0.5];

// A cupped petal: narrow at the base, broad and round with a soft notch at the tip (like a cosmos), bending toward the
// viewer. u runs base → tip, v across (−1…1).
function petalPoint(u, v, [length, width, cup, curl]) {
  const w = width * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.6)), 0.55);
  const notch = 1 - 0.1 * Math.exp(-((v * 3) ** 2)) * Math.pow(u, 6);
  return [v * w, u * length * notch, cup * v * v * w + curl * u * u];
}
function petalGeometry(shape) {
  const g = new THREE.PlaneGeometry(1, 1, 12, 28), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, ...petalPoint(p.getY(i) + 0.5, p.getX(i) * 2, shape));
  g.computeVertexNormals();
  return g;
}

const VERT = /* glsl */ `
varying vec3 vWN, vWP;
varying vec2 vUv;
void main() {
#ifdef USE_INSTANCING
  mat4 m = modelMatrix * instanceMatrix;
#else
  mat4 m = modelMatrix;
#endif
  vec4 wp = m * vec4(position, 1.0);
  vWP = wp.xyz;
  vWN = normalize(mat3(m) * normal);
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

// Thin glass: dim face-on, glowing edge-on in the flower's colours, its rims split into a spectrum.
const PETAL_FRAG = /* glsl */ `
uniform samplerCube uEnv;
uniform float uTime, uHue, uGain, uWarm;
uniform vec3 uTint;
uniform float uPalette;
varying vec3 vWN, vWP;
varying vec2 vUv;
${SPECTRUM}
vec3 palette(float x) {
  x = clamp(x, 0.0, 1.0);
  vec3 c = mix(vec3(1.0, 0.26, 0.0), vec3(1.0, 0.05, 0.4), smoothstep(0.0, 0.3, x));
  c = mix(c, vec3(0.55, 0.06, 1.0), smoothstep(0.35, 0.75, x));
  return mix(c, vec3(0.04, 0.24, 1.0), smoothstep(0.8, 1.0, x));
}
void main() {
  vec3 N = normalize(vWN), V = normalize(cameraPosition - vWP);
  float edge = 1.0 - abs(dot(N, V));
  float u = vUv.y, v = abs(vUv.x * 2.0 - 1.0);
  vec3 hue = mix(uTint, palette(u + 0.14 * sin(uHue)), uPalette);
  vec3 body = hue * (0.38 + 0.9 * pow(edge, 1.3));
  vec3 split = spectrum(fract(0.1 + 0.75 * edge + 0.35 * u + 0.04 * uTime)) * (1.8 * pow(edge, 2.5) + 1.3 * smoothstep(0.78, 1.0, v) * smoothstep(0.05, 0.3, u));
  vec3 refl = textureCube(uEnv, reflect(-V, N)).rgb * (0.08 + 1.2 * pow(edge, 4.0));
  vec3 heart = vec3(1.0, 0.5, 0.16) * exp(-u * 4.5) * uWarm;
  vec3 col = (body + split + refl + heart) * uGain;
  if (any(isnan(col))) col = vec3(0.0);
  gl_FragColor = vec4(col, 1.0);
}`;

// The beads at the heart: warm light with a spectral rim.
const BEAD_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vWN, vWP;
varying vec2 vUv;
${SPECTRUM}
void main() {
  vec3 N = normalize(vWN), V = normalize(cameraPosition - vWP);
  float edge = 1.0 - abs(dot(N, V));
  vec3 col = vec3(1.0, 0.62, 0.22) * (0.35 + 0.5 * edge) + spectrum(fract(edge * 0.8 + uTime * 0.05)) * pow(edge, 2.0) * 0.8;
  gl_FragColor = vec4(col * 0.8, 1.0);
}`;

// Dew on the petals: a hot white glint at the centre of each drop, a spectral rim, twinkling.
const DEW_VERT = /* glsl */ `
attribute float aSeed;
varying vec3 vWN, vWP;
varying float vSeed;
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  vec4 wp = m * vec4(position, 1.0);
  vWP = wp.xyz;
  vWN = normalize(mat3(m) * normal);
  vSeed = aSeed;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const DEW_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vWN, vWP;
varying float vSeed;
${SPECTRUM}
void main() {
  vec3 N = normalize(vWN), V = normalize(cameraPosition - vWP);
  float ndv = clamp(dot(N, V), 0.0, 1.0), edge = 1.0 - ndv;
  float twinkle = 0.5 + 0.5 * pow(0.5 + 0.5 * sin(uTime * 2.3 + vSeed * 40.0), 6.0);
  vec3 col = vec3(1.0) * pow(ndv, 14.0) * 7.0 * twinkle + spectrum(fract(edge * 1.2 + vSeed)) * pow(edge, 1.5) * 2.2;
  gl_FragColor = vec4(col, 1.0);
}`;

// A soft studio: pink on the left, blue on the right, warm from below.
const ENV = /* glsl */ `
vec3 env(vec3 d) {
  vec3 c = vec3(0.01, 0.01, 0.02);
  c += vec3(1.0, 0.1, 0.5) * 3.5 * pow(max(dot(d, normalize(vec3(-0.8, 0.3, 0.5))), 0.0), 10.0);
  c += vec3(0.1, 0.4, 1.0) * 3.5 * pow(max(dot(d, normalize(vec3(0.8, 0.2, 0.4))), 0.0), 10.0);
  c += vec3(1.0, 0.45, 0.05) * 2.5 * pow(max(dot(d, normalize(vec3(0.0, -0.9, 0.4))), 0.0), 8.0);
  c += vec3(1.0) * 8.0 * pow(max(dot(d, normalize(vec3(-0.3, 0.8, 0.5))), 0.0), 300.0);
  return c;
}`;

// Deep indigo, with a faint warm haze round the flower and a cool one above it.
const BACKDROP = /* glsl */ `
uniform vec2 uSlot;
uniform float uAspect;
varying vec2 vUv;
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y), s = vec2(uSlot.x * uAspect, 1.0 - uSlot.y);
  vec3 c = mix(vec3(0.0004, 0.0003, 0.001), vec3(0.001, 0.0007, 0.003), vUv.y);
  c += vec3(0.01, 0.002, 0.012) * exp(-dot(p - s, p - s) * 3.0);
  c += vec3(0.0, 0.003, 0.012) * exp(-dot(p - s - vec2(0.4, 0.35), p - s - vec2(0.4, 0.35)) * 4.0);
  gl_FragColor = vec4(c, 1.0);
}`;

export function create(stage) {
  const { renderer } = stage;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const env = bakeEnv(renderer, ENV, { size: 128 });
  const bgU = { uSlot: { value: new THREE.Vector2() }, uAspect: { value: 1 } };
  const bd = backdrop(BACKDROP, bgU);
  scene.add(bd);
  const lens = new Lens(renderer, { levels: 4 });
  const disposables = [env, lens, bd.geometry, bd.material];

  // the flower turns as a whole under the trackball; inside it, a gentle sway of its own
  const flower = new THREE.Group(), sway = new THREE.Group();
  const home = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.4, 0.35, 0.12));
  flower.quaternion.copy(home);
  scene.add(flower);
  flower.add(sway);
  const ball = new Trackball(flower, { home, settle: 0.5 });

  const glass = (tint, palette, gain, warm) => new THREE.ShaderMaterial({
    uniforms: { uEnv: { value: env.texture }, uTime: { value: 0 }, uHue: { value: 0 }, uGain: { value: gain }, uWarm: { value: warm }, uTint: { value: new THREE.Color(...tint) }, uPalette: { value: palette } },
    vertexShader: VERT, fragmentShader: PETAL_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const petalMat = glass([1, 1, 1], 1, 0.5, 0.45);
  const stemMat = glass([0.25, 0.75, 0.45], 0, 0.5, 0);
  const budMat = glass([1, 1, 1], 1, 0.5, 0.5);
  const beadMat = new THREE.ShaderMaterial({ uniforms: { uTime: petalMat.uniforms.uTime }, vertexShader: VERT, fragmentShader: BEAD_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  disposables.push(petalMat, stemMat, budMat, beadMat);

  const ring = (geo, mat, n) => {
    const im = new THREE.InstancedMesh(geo, mat, n);
    im.frustumCulled = false;
    disposables.push(geo, im);
    return im;
  };
  const outer = ring(petalGeometry(OUTER_SHAPE), petalMat, OUTER);
  const inner = ring(petalGeometry(INNER_SHAPE), petalMat, INNER);
  sway.add(outer, inner);

  // dew: a few drops resting on each outer petal, carried with it as it breathes
  const dewSeed = new Float32Array(OUTER * DEW), dewAt = [];
  for (let i = 0; i < OUTER * DEW; i++) {
    const u = 0.35 + 0.5 * Math.random(), v = (Math.random() - 0.5) * 1.3, [x, y, z] = petalPoint(u, v, OUTER_SHAPE);
    dewAt.push(new THREE.Vector3(x, y, z + 0.03));
    dewSeed[i] = Math.random();
  }
  const dewGeo = new THREE.SphereGeometry(1, 16, 12);
  dewGeo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(dewSeed, 1));
  const dewMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: DEW_VERT, fragmentShader: DEW_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const dew = ring(dewGeo, dewMat, OUTER * DEW);
  disposables.push(dewMat);
  sway.add(dew);

  // the heart: glass beads in a sunflower spiral over a low dome
  const beads = ring(new THREE.SphereGeometry(1, 12, 8), beadMat, BEADS);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  for (let i = 0; i < BEADS; i++) {
    const r = 0.27 * Math.sqrt((i + 0.5) / BEADS), a = i * Math.PI * (3 - Math.sqrt(5));
    beads.setMatrixAt(i, m4.compose(pos.set(r * Math.cos(a), r * Math.sin(a), 0.16 * (1 - (r / 0.27) ** 2) + 0.06), q.identity(), scl.setScalar(0.034)));
  }
  sway.add(beads);

  // the stem, and a bud on a short stem of its own
  const stemCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, -0.08), new THREE.Vector3(0.05, -0.9, -0.2), new THREE.Vector3(-0.15, -2.0, -0.3), new THREE.Vector3(-0.35, -3.4, -0.35)]);
  const stemGeo = new THREE.TubeGeometry(stemCurve, 80, 0.045, 10);
  const budCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.12, -1.7, -0.28), new THREE.Vector3(-0.55, -1.85, -0.35), new THREE.Vector3(-0.9, -1.75, -0.45)]);
  const budStemGeo = new THREE.TubeGeometry(budCurve, 30, 0.03, 8);
  sway.add(new THREE.Mesh(stemGeo, stemMat), new THREE.Mesh(budStemGeo, stemMat));
  disposables.push(stemGeo, budStemGeo);
  const bud = ring(petalGeometry(BUD_SHAPE), budMat, BUD);
  const budGroup = new THREE.Group();
  budGroup.position.set(-0.95, -1.72, -0.45);
  budGroup.rotation.set(0.6, -0.4, 0.9);
  budGroup.add(bud);
  sway.add(budGroup);

  // petals: a turn about the flower's axis, a step out from the heart, then a tilt toward the viewer
  const rz = new THREE.Matrix4(), rx = new THREE.Matrix4(), tr = new THREE.Matrix4();
  function setPetals(im, n, open, out, offset, t, breathe) {
    for (let i = 0; i < n; i++) {
      const a = offset + (i / n) * Math.PI * 2;
      rz.makeRotationZ(a);
      tr.makeTranslation(0, out, 0);
      rx.makeRotationX(open + breathe * Math.sin(t * 0.6 + i * 0.7));
      im.setMatrixAt(i, m4.copy(rz).multiply(tr).multiply(rx));
    }
    im.instanceMatrix.needsUpdate = true;
  }

  const center = new THREE.Vector3(), focus = new THREE.Vector2(0.5, 0.5), want = new THREE.Vector2(), pm = new THREE.Matrix4();
  let openness = 0;

  return {
    maxDpr: 1.25,
    resize(w, h, dpr) {
      const s = stage.slot;
      camera.position.set(0, 0, aim(camera, w, h, s, RADIUS));
      camera.updateMatrixWorld();
      lens.resize(w, h, dpr);
      bgU.uAspect.value = w / h;
      bgU.uSlot.value.set(s.x, s.y);
    },
    down(e) { ball.down(e); },
    move(e) { ball.move(e); },
    up() { ball.up(); },
    update(dt, t) {
      const p = stage.p, near = ball.dragging ? 0 : p.presence;
      ball.update(dt);
      sway.rotation.set(0.06 * Math.sin(t * 0.5), 0.08 * Math.sin(t * 0.37), 0.05 * Math.sin(t * 0.29));
      // the petals open a little toward an attentive cursor (the camera's matrices must be current before projecting)
      camera.updateMatrixWorld();
      center.set(0, 0, 0).project(camera);
      const dist = Math.hypot((p.sx - center.x) * (stage.w / stage.h), p.sy - center.y);
      openness += (near * Math.exp(-dist * dist * 2) - openness) * (1 - Math.exp(-dt * 2));
      if (!Number.isFinite(openness)) openness = 0;
      setPetals(outer, OUTER, 0.5 - 0.22 * openness, 0.12, 0, t, 0.05);
      for (let i = 0; i < OUTER * DEW; i++) {
        outer.getMatrixAt(Math.floor(i / DEW), pm);
        dew.setMatrixAt(i, m4.compose(pos.copy(dewAt[i]).applyMatrix4(pm), q.identity(), scl.setScalar(0.022 + 0.012 * dewSeed[i])));
      }
      dew.instanceMatrix.needsUpdate = true;
      dewMat.uniforms.uTime.value = t;
      setPetals(inner, INNER, 0.85 - 0.25 * openness, 0.08, Math.PI / INNER, t + 1, 0.06);
      setPetals(bud, BUD, 1.15, 0.02, 0, t + 2, 0.04);
      for (const m of [petalMat, stemMat, budMat]) { m.uniforms.uTime.value = t; m.uniforms.uHue.value = t * 0.12; }
      // focus: wherever the cursor is; otherwise drifting about the heart of the flower
      if (near > 0.05) want.set((p.sx + 1) / 2, (p.sy + 1) / 2);
      else want.set((center.x + 1) / 2 + 0.04 * Math.sin(t * 0.21), (center.y + 1) / 2 + 0.04 * Math.sin(t * 0.17));
      focus.lerp(want, 1 - Math.exp(-dt * 3));
      lens.u.uFocus.value.copy(focus);
      lens.u.uBase.value = THREE.MathUtils.lerp(0.14 + 0.1 * Math.sin(t * 0.23), 0.03, near);
      lens.u.uSoft.value = 0.55;
      lens.u.uDisperse.value = 0.07;
      lens.u.uGlow.value = 0.24;
      lens.u.uGrain.value = 0.06;
      lens.u.uExposure.value = 1.45;
      lens.u.uSat.value = 1.35;
      lens.u.uTime.value = t;
      lens.render(scene, camera);
    },
    dispose() {
      ball.dispose();
      disposables.forEach((d) => d.dispose());
    },
  };
}
