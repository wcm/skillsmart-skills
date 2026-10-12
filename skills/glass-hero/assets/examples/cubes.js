// 02 Cubes: a wall of clear glass blocks with rounded edges in front of a pearl light box ruled with black lines. Each
// block refracts the rules behind it through its real thickness, wavelength by wavelength, and the rules are dense and
// cross at two angles, so every block holds many light-to-dark edges to bend and split into colour; the rounded
// arrises act as lenses and bend them hardest. A slow wave rolls through the blocks and the rules drift; blocks near
// the cursor turn and lift toward it; drag to tilt and roll the whole wall (it settles back).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { makePost } from "../engine/post.js";
import { aim, pointerRay } from "../engine/stage.js";
import { Trackball } from "../engine/trackball.js";
import { GlassStage, GLASS_LAYER, glassMaterial, bakeEnv, backdrop, STRIP } from "../engine/glass.js";

export const meta = {
  id: "cubes", no: "02", name: "Brique", bg: "#eceae6", ink: "#141416",
  title: "Brique · Glass block for daylight",
};

// The page in front of the canvas: nav, copy and footer. Links stay put until they go somewhere real (data-noop).
export const html = {
  hero: `
  <header class="nav">
    <a class="brand" href="#" data-noop>Brique<span>Verrerie</span></a>
    <nav class="links"><a href="#" data-noop>Blocks</a><a href="#" data-noop>Projects</a><a href="#" data-noop>Studio</a></nav>
    <a class="pill" href="#" data-noop>Order samples</a>
  </header>
  <section class="copy">
    <p class="kicker"><i aria-hidden="true"></i><span>Collection 2026 · Soft edge</span></p>
    <h1>Glass block,<br><em>made for daylight.</em></h1>
    <p class="lede">Pressed by hand in Lyon with softened edges. Build a wall that keeps the light and bends the room behind it into colour.</p>
    <div class="cta"><a class="btn" href="#" data-noop>See the blocks <i>→</i></a><span>19 × 19 × 8 cm · €14</span></div>
    <p class="hint">Drag to tilt the wall · blocks near your cursor turn to the light</p>
  </section>
  <footer class="foot"><span>Brique Verrerie · Lyon</span><span>Nº 02 — Soft edge</span></footer>`,
};

const COLS = 6, ROWS = 5, SIZE = 0.6, PITCH = 0.72, RADIUS = 2.45;

// Pearl paper with a soft pastel bloom, and, behind the wall only, a light box of black rules that slowly drift: a
// main set of bold and fine rules on a diagonal, and a lighter set crossing them. On a pale page the glass only shows
// colour where it bends a dark line against light, so the more edges behind it, the more rainbow in it.
const BACKDROP = /* glsl */ `
uniform float uTime, uAspect, uReach;
uniform vec2 uSlot;
varying vec2 vUv;
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
float bars(float x, float duty) {
  float f = fract(x), aa = fwidth(x) * 1.2;
  return smoothstep(duty * 0.5 + aa, duty * 0.5 - aa, abs(f - 0.5));
}
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y), slot = vec2(uSlot.x * uAspect, 1.0 - uSlot.y);
  vec3 c = mix(lin(vec3(0.95, 0.945, 0.93)), lin(vec3(0.91, 0.915, 0.94)), vUv.y);
  vec2 a = p - slot - vec2(0.3, -0.25) * uReach * 2.0, b = p - slot - vec2(-0.25, 0.3) * uReach * 2.0;
  c = mix(c, lin(vec3(0.99, 0.8, 0.86)), 0.45 * exp(-dot(a, a) / (uReach * uReach) * 2.0));
  c = mix(c, lin(vec3(0.76, 0.84, 1.0)), 0.45 * exp(-dot(b, b) / (uReach * uReach) * 2.0));
  float box = 1.0 - smoothstep(0.72, 1.0, length(p - slot) / uReach);
  float x = p.x - p.y * 0.18 + uTime * 0.02, y = p.x * 0.45 + p.y - uTime * 0.012;
  float ink = max(max(bars(x * 3.2, 0.08), bars(x * 11.0 + 0.3, 0.09)), max(bars(x * 23.0 + 0.6, 0.12) * 0.7, bars(y * 7.0, 0.08) * 0.6));
  c = mix(c, lin(vec3(0.04, 0.04, 0.05)), ink * box);
  gl_FragColor = vec4(c, 1.0);
}`;

// A bright white room with a few black flags and two hot strips: crisp lines in the glass's reflections.
const ENV = /* glsl */ `
${STRIP}
vec3 env(vec3 d) {
  vec3 c = vec3(0.55 + 0.2 * d.y);
  c *= 1.0 - 0.9 * smoothstep(0.07, 0.03, abs(dot(d, normalize(vec3(1.0, 0.0, 0.35)))));
  c *= 1.0 - 0.85 * smoothstep(0.05, 0.02, abs(d.y - 0.42));
  c *= 1.0 - 0.8 * smoothstep(0.05, 0.02, abs(dot(d, normalize(vec3(-0.6, 0.2, 1.0)))));
  c += 4.0 * strip(d, vec3(-0.7, 0.5, 0.5), vec3(0.3, 1.0, 0.0), 0.03, 0.7);
  c += 3.0 * strip(d, vec3(0.6, 0.6, 0.55), vec3(1.0, -0.2, 0.0), 0.025, 0.6);
  return c;
}`;

export function create(stage) {
  const { renderer } = stage;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.layers.enable(GLASS_LAYER);
  const gs = new GlassStage(renderer, { bgScale: 1, backScale: 1 });
  const env = bakeEnv(renderer, ENV);
  const bgU = { uTime: { value: 0 }, uAspect: { value: 1 }, uReach: { value: 0.5 }, uSlot: { value: new THREE.Vector2() } };
  const bd = backdrop(BACKDROP, bgU);
  scene.add(bd);

  const wall = new THREE.Group();
  scene.add(wall);
  const home = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.3, 0.5, 0.05));
  wall.quaternion.copy(home);
  const ball = new Trackball(wall, { home, settle: 0.7 });

  const geo = new RoundedBoxGeometry(SIZE, SIZE, SIZE, 6, 0.13); // round arrises: little lenses
  const mat = glassMaterial(gs, env, {
    ior: 1.6, spread: 1.1, samples: 14, depth: 4.0, absorb: [0.32, 0.3, 0.26], reflect: 0.3, through: 0.06, saturation: 1.9,
    // a thin film on the faces: rainbow bands that shift with the viewing angle, as a tint so they colour without whitening
    hooks: { shade: "color *= mix(vec3(1.0), spectrum(fract(ndv * 1.6 + thick * 0.8 + 0.05 * uTime)) * 1.6 + 0.15, 0.3 * (1.0 - 0.5 * ndv));" },
  });
  const cubes = new THREE.InstancedMesh(geo, mat, COLS * ROWS);
  cubes.layers.set(GLASS_LAYER);
  cubes.frustumCulled = false;
  wall.add(cubes);
  const n = COLS * ROWS;
  const grid = [], turn = new Float32Array(n), lift = new Float32Array(n);
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) grid.push([(i - (COLS - 1) / 2) * PITCH, (j - (ROWS - 1) / 2) * PITCH, i, j]);

  const post = makePost(renderer, scene, camera, { bloom: null, disperse: 0.006, vignette: 0.12, grain: 0.022 });

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const waveAxis = new THREE.Vector3(1, 1, 0.25).normalize(), hoverAxis = new THREE.Vector3();
  const inv = new THREE.Matrix4(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3(), ray = new THREE.Ray();
  let hx = 0, hy = 0;

  return {
    maxDpr: 1.5,
    resize(w, h, dpr) {
      const s = stage.slot;
      camera.position.set(0, 0, aim(camera, w, h, s, RADIUS));
      post.resize(w, h, dpr);
      gs.resize(w, h, dpr);
      bgU.uAspect.value = w / h;
      bgU.uSlot.value.set(s.x, s.y);
      bgU.uReach.value = ((s.size * Math.min(h * Math.min(s.y, 1 - s.y), w * Math.min(s.x, 1 - s.x))) / h) * 1.32;
    },
    down(e) { ball.down(e); },
    move(e) { ball.move(e); },
    up() { ball.up(); },
    update(dt, t) {
      const p = stage.p;
      ball.update(dt);
      scene.updateMatrixWorld();
      // where the cursor meets the wall, in the wall's own plane
      inv.copy(wall.matrixWorld).invert();
      ray.copy(pointerRay(camera, p)).applyMatrix4(inv);
      if (ray.intersectPlane(plane, hit)) { hx += (hit.x - hx) * 0.2; hy += (hit.y - hy) * 0.2; }
      const near = ball.dragging ? 0 : p.presence;
      const k = 1 - Math.exp(-dt * 5);
      grid.forEach(([x, y, i, j], c) => {
        const f = near * Math.exp(-((x - hx) ** 2 + (y - hy) ** 2) / 0.7);
        turn[c] += (f * 0.85 - turn[c]) * k;
        lift[c] += (f * 0.4 - lift[c]) * k;
        // a slow wave rolling across the wall, and a tilt toward the cursor
        const wave = 0.5 * Math.sin(t * 0.75 - i * 0.7 - j * 0.45);
        const dx = hx - x, dy = hy - y, dl = Math.hypot(dx, dy) || 1;
        q.setFromAxisAngle(waveAxis, wave);
        q2.setFromAxisAngle(hoverAxis.set(-dy / dl, dx / dl, 0), turn[c]);
        q.premultiply(q2);
        pos.set(x, y, lift[c] + 0.06 * Math.sin(t * 0.7 + i * 0.9 + j * 0.6));
        cubes.setMatrixAt(c, m4.compose(pos, q, one));
      });
      cubes.instanceMatrix.needsUpdate = true;
      bgU.uTime.value = t;
      mat.uniforms.uTime.value = t;
      gs.render(scene, camera);
      post.render(t);
    },
    dispose() {
      ball.dispose();
      post.dispose();
      gs.dispose();
      env.dispose();
      geo.dispose();
      mat.dispose();
      cubes.dispose();
      bd.geometry.dispose();
      bd.material.dispose();
    },
  };
}
