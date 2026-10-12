// 03 Twist: a trefoil loop of thick, ribbed glass in a dark room of soft coloured glows. Seventy-two fine ribs run
// round the tube, twisting slowly along it and flowing; each one tilts the surface a little, so every rib refracts
// the glows behind it and catches the studio's softboxes and strip lights at its own angle, wavelength by wavelength,
// and the colour runs along the loop in fine contours, dark in the grooves. It turns slowly on its own; drag to tilt
// and roll it; the cursor is a light whose glint slides along the ribs.
import * as THREE from "three";
import { makePost } from "../engine/post.js";
import { aim, pointerRay } from "../engine/stage.js";
import { Trackball } from "../engine/trackball.js";
import { GlassStage, GLASS_LAYER, glassMaterial, bakeEnv, backdrop, STRIP } from "../engine/glass.js";

export const meta = {
  id: "twist", no: "03", name: "Loop", bg: "#050309", ink: "#f3f1ee",
  title: "Loop 2026 · A festival of generative design",
};

// The page in front of the canvas: nav, copy and footer. Links stay put until they go somewhere real (data-noop).
export const html = {
  hero: `
  <header class="nav">
    <a class="brand" href="#" data-noop>Loop<span>26</span></a>
    <nav class="links"><a href="#" data-noop>Programme</a><a href="#" data-noop>Artists</a><a href="#" data-noop>Venue</a></nav>
    <a class="pill" href="#" data-noop>Get tickets</a>
  </header>
  <section class="copy">
    <p class="kicker"><i aria-hidden="true"></i><span>Berlin · 14–16 May 2026</span></p>
    <h1>Bend<br><em>light.</em></h1>
    <p class="lede">Three days of light, code and glass at Kraftwerk Berlin: sixty artists, twelve installations and one loop that never closes.</p>
    <div class="cta"><a class="btn" href="#" data-noop>Get tickets <i>→</i></a><span>From €89</span></div>
    <p class="hint">Drag to tilt and roll it · your cursor is a light along the ribs</p>
  </section>
  <footer class="foot"><span>Kraftwerk · Köpenicker Str. 70</span><span>Loop Festival Nº 7</span></footer>`,
};

const RADIUS = 1.8, RIBS = 72, TWIST = 9;

// A smooth dark room: near-black, with soft glows round the loop (hot orange low on the left, electric blue high on
// the right, a little magenta low on the right) that drift very slowly. No hard features: the ribs supply the detail,
// bending the glows into contours.
const BACKDROP = /* glsl */ `
uniform float uTime, uAspect, uReach;
uniform vec2 uSlot;
varying vec2 vUv;
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y), slot = vec2(uSlot.x * uAspect, 1.0 - uSlot.y);
  vec3 c = mix(vec3(0.004, 0.002, 0.008), vec3(0.002, 0.003, 0.012), vUv.y);
  vec2 drift = 0.06 * uReach * vec2(sin(uTime * 0.11), cos(uTime * 0.13));
  vec2 a = p - slot - vec2(-0.36, -0.3) * uReach * 2.0 - drift;
  vec2 b = p - slot - vec2(0.36, 0.32) * uReach * 2.0 + drift;
  vec2 m = p - slot - vec2(0.42, -0.36) * uReach * 2.0;
  float r2 = uReach * uReach;
  c += vec3(1.0, 0.3, 0.02) * 0.75 * exp(-dot(a, a) / r2 * 2.0);
  c += vec3(0.02, 0.25, 1.0) * 0.85 * exp(-dot(b, b) / r2 * 2.0);
  c += vec3(0.9, 0.05, 0.5) * 0.35 * exp(-dot(m, m) / r2 * 3.0);
  gl_FragColor = vec4(c, 1.0);
}`;

// A dark studio of hot softboxes, orange on the left and below, electric blue on the right, hot pink overhead, plus
// two thin white strips for sharp glints.
const ENV = /* glsl */ `
${STRIP}
vec3 env(vec3 d) {
  vec3 c = mix(vec3(0.01, 0.0, 0.01), vec3(0.0, 0.01, 0.05), smoothstep(-0.3, 0.6, d.y));
  c += vec3(1.0, 0.32, 0.04) * 10.0 * strip(d, vec3(-0.85, -0.1, 0.5), vec3(0.15, 1.0, 0.0), 0.18, 0.9);
  c += vec3(1.0, 0.5, 0.3) * 5.0 * strip(d, vec3(-0.2, -0.85, 0.5), vec3(1.0, 0.1, 0.0), 0.12, 0.9);
  c += vec3(0.05, 0.3, 1.0) * 10.0 * strip(d, vec3(0.8, 0.3, 0.5), vec3(-0.2, 1.0, 0.1), 0.15, 0.9);
  c += vec3(1.0, 0.15, 0.55) * 6.0 * strip(d, vec3(0.1, 0.95, 0.3), vec3(1.0, 0.0, 0.0), 0.08, 0.8);
  c += vec3(1.0) * 1.2 * smoothstep(0.2, 0.9, d.y);
  c += vec3(1.0) * 26.0 * strip(d, vec3(-0.4, 0.4, 0.8), vec3(0.6, 0.8, 0.0), 0.015, 0.5);
  c += vec3(1.0) * 18.0 * strip(d, vec3(0.5, -0.3, 0.8), vec3(0.2, 1.0, 0.0), 0.012, 0.5);
  return c;
}`;

export function create(stage) {
  const { renderer } = stage;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.layers.enable(GLASS_LAYER);
  const gs = new GlassStage(renderer, { bgScale: 0.6, backScale: 0.75 });
  const env = bakeEnv(renderer, ENV);
  const bgU = { uTime: { value: 0 }, uAspect: { value: 1 }, uReach: { value: 0.5 }, uSlot: { value: new THREE.Vector2() } };
  const bd = backdrop(BACKDROP, bgU);
  scene.add(bd);

  const knot = new THREE.Group();
  knot.quaternion.setFromEuler(new THREE.Euler(0.5, 0.2, 0.3));
  scene.add(knot);
  const ball = new Trackball(knot, { own: [0.25, 1, 0.1], spin: 0.07 });

  const geo = new THREE.TorusKnotGeometry(1.0, 0.36, 800, 220, 2, 3);
  geo.computeTangents();
  const mat = glassMaterial(gs, env, {
    ior: 1.5, spread: 1.0, depth: 5.0, absorb: [0.12, 0.08, 0.04], reflect: 2.6, through: 1.2, saturation: 1.45, tangents: true,
    uniforms: { uLight: { value: new THREE.Vector3(0, 0, 1) }, uLightOn: { value: 0 } },
    hooks: {
      head: /* glsl */ `uniform vec3 uLight; uniform float uLightOn; float gRib = 0.0;`,
      // the ribs: a fine fluting round the tube that twists along it and slowly flows
      normal: /* glsl */ `
        vec3 Tg = normalize(vVT - N * dot(vVT, N));
        vec3 B = normalize(cross(N, Tg));
        float ph = vUv.y * ${RIBS}.0 + vUv.x * ${TWIST}.0 + uTime * 0.12;
        gRib = 0.7 * cos(6.2831853 * ph) + 0.3 * cos(6.2831853 * (ph / 3.0 + 0.2)); // two widths of rib (72 and 9 divide by 3: no seam)
        N = normalize(N + B * gRib * 0.8);`,
      // dark in the grooves, and a glint wherever a rib faces the cursor's light
      shade: /* glsl */ `
        color *= 0.32 + 0.68 * smoothstep(-0.95, 0.2, gRib);
        color += vec3(1.0, 0.92, 0.85) * pow(max(dot(R, uLight), 0.0), 60.0) * 2.5 * uLightOn;`,
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.layers.set(GLASS_LAYER);
  knot.add(mesh);

  const post = makePost(renderer, scene, camera, { bloom: [0.6, 0.4, 0.8], disperse: 0.014, vignette: 0.45 });
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -2.5), hit = new THREE.Vector3();

  return {
    maxDpr: 1.5,
    resize(w, h, dpr) {
      const s = stage.slot;
      camera.position.set(0, 0, aim(camera, w, h, s, RADIUS));
      post.resize(w, h, dpr);
      gs.resize(w, h, dpr);
      bgU.uAspect.value = w / h;
      bgU.uSlot.value.set(s.x, s.y);
      bgU.uReach.value = ((s.size * Math.min(h * Math.min(s.y, 1 - s.y), w * Math.min(s.x, 1 - s.x))) / h) * 1.2;
    },
    down(e) { ball.down(e); },
    move(e) { ball.move(e); },
    up() { ball.up(); },
    update(dt, t) {
      const p = stage.p, u = mat.uniforms;
      ball.update(dt);
      // the cursor's light hangs between the loop and the viewer, under the pointer
      if (pointerRay(camera, p).intersectPlane(plane, hit)) u.uLight.value.lerp(hit.normalize(), 1 - Math.exp(-dt * 6)).normalize();
      u.uLightOn.value += ((ball.dragging ? 0.4 : p.presence) - u.uLightOn.value) * (1 - Math.exp(-dt * 3));
      u.uTime.value = t;
      bgU.uTime.value = t;
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
      bd.geometry.dispose();
      bd.material.dispose();
    },
  };
}
