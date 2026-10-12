// 04 Tide — a long silk banner adrift in deep water, after the moodboard's key art. It is held somewhere off-frame
// and streams in a slow current (engine/banner.js): bends ride down it and grow toward its free end, its rolled
// hems ripple, the free end flutters, and light from the surface plays over it in caustics. It is drawn as a smooth
// spline surface over the cloth, so it reads soft and round rather than faceted. The cursor is a hand in the water:
// wherever it rests on the silk it presses it back, strokes leave swirls in the current for the silk to ride, and a
// click lets go a breath of bubbles.
import * as THREE from "three";
import { Banner } from "../engine/banner.js";
import { loadImage, canvas, drawCover, bakeEnv, glow, room, texture, fontsReady, splineSurface, disposeScene, smooth, inject, rng } from "../engine/kit.js";

export const meta = { id: "tide", no: "04", name: "Tide", native: "潮", veil: "#041b2c", ink: "#e6f3f5", display: "'Instrument Serif', serif", weight: 400, sound: "water" };

export const html = {
  bg: `<div class="td-plate"></div><div class="td-rays"></div><div class="td-rays td-rays--b"></div><div class="td-surface"></div><div class="td-deep"></div>`,
  back: ``,
  hero: `
  <header class="nav">
    <a class="brand" href="#" data-noop>Shio<span lang="ja">潮</span></a>
    <nav class="links"><a href="#" data-noop>Silks</a><a href="#" data-noop>Atelier</a><a href="#" data-noop>Journal</a></nav>
    <a href="#" data-noop class="pill">Discover</a>
  </header>
  <section class="copy">
    <p class="kicker">The Koi Banner · 16 momme charmeuse · 80 × 390 cm</p>
    <h1><em>Silk,</em> unweighted.</h1>
    <p class="lede">Hand-printed with koi and lotus in Kyoto. Let go in deep water, it forgets gravity and follows the current like a breath.</p>
    <div class="cta"><a href="#" data-noop class="btn">Discover the banner <i>→</i></a><span>¥ 128,000</span></div>
  </section>
  <aside class="gauge" aria-hidden="true"><div class="ruler"><b>0</b><b>5</b><b>10</b><b>15</b><b>20</b></div><p class="mark"><i></i><span class="depth">−12.4 m</span></p><p class="temp">18 °C · visibility 22 m</p></aside>
  <footer class="foot"><span>Atelier Shio · Kyoto</span><span class="hint">Rest a hand on the silk · stir the water · click for bubbles</span><span>Nº 04 — Tide</span></footer>`,
};

// ——— the banner ———
const BW = 0.82, BL = 3.9;
const SILK = {
  width: BW, length: BL, cols: 24, rows: 116, ruffle: 0.05,
  // silk in water: the water pushes hard on its face and hardly drags along it, so a bend made at one end travels
  // the whole length instead of being pulled straight
  density: 0.06, gravity: [0, -0.015, 0], substeps: 4, shear: 4e-4, bend: 2, damping: 0.3, kN: 12, kT: 0.05,
  selfCollide: true, thickness: 0.024, hashEvery: 4, maxSpeed: 3,
  current: 0.35,
  // big bends fed in near the held end ride down at an even size; slower ones reshape it along the way
  waves: [{ a: 0.04, len: 1.8, kw: 0.4, p: 0, reach: 1 }, { a: 0.025, len: 1.1, kw: -0.9, p: 2.1, reach: 1 }, { a: 0.012, len: 1.4, kw: 0.8, p: 4, speed: 0.55 }],
  twist: { a: 0.018, len: 2.2, p: 0.7, speed: 0.6 }, curl: { a: 0.03, len: 1.2, p: 1.9, speed: 0.7 }, flutter: { a: 0.06, len: 0.55, speed: 1.4 },
  turbulence: 0.04, hold: { n: 0.1, w: 0.05, roll: 0.22 }, hand: { r: 0.18, press: 0.16 },
};
// where it streams, per layout: held off-frame at `o`, streaming along `dir`, its printed face turned up toward the
// light (`face`), so its billows show as the long S-curves of the key art
const RIGS = {
  wide: { o: [2.3, 0.6, -0.7], dir: [-0.93, -0.2, 0.2], face: [0.05, 0.62, 0.78] },
  tall: { o: [2.62, 1.31, -0.87], dir: [-0.85, -0.38, 0.3], face: [0.05, 0.62, 0.78] },
};
const tallOf = (w, h) => w / h < 1.05;

// the print runs along the banner: a long print is laid end to end with a mirrored copy (so the two meet
// seamlessly); a shorter picture repeats, every other copy mirrored
function bakeSilk(img) {
  const W = 720, H = Math.round((W * BL) / BW), c = canvas(W, H), x = c.getContext("2d");
  x.fillStyle = "#f4f6f1"; x.fillRect(0, 0, W, H);
  x.save();
  x.translate(W, 0); x.rotate(Math.PI / 2); // from here x runs down the banner and y across it
  const ar = img.width / img.height, n = Math.max(1, Math.round(H / (W * ar))), len = H / n;
  for (let k = 0; k < n; k++) {
    x.save();
    x.translate(k * len, 0);
    if (k % 2) { x.translate(len, 0); x.scale(-1, 1); }
    drawCover(x, img, 0, 0, len, W);
    x.restore();
  }
  x.restore();
  // hand-rolled hems: a soft, slightly deeper line along every edge
  x.strokeStyle = "rgba(120, 150, 160, 0.35)"; x.lineWidth = 5; x.strokeRect(2.5, 2.5, W - 5, H - 5);
  return c;
}

function seaEnv(renderer) {
  return bakeEnv(renderer, (s) => {
    s.add(room(0x05283a));
    s.add(glow(0xe6faff, 6, 7, 7, 0, 6, 0, [0, 0, 0])); // the sun through the surface, overhead
    s.add(glow(0x6fd0e8, 1.8, 20, 20, 0, 4.5, 0, [0, 0, 0])); // the bright surface all round
    s.add(glow(0x0d6488, 1.1, 20, 9, 0, 0, -7)); // open water behind
    s.add(glow(0x0d6488, 0.9, 20, 9, 0, 0, 7));
    s.add(glow(0x021018, 1, 20, 20, 0, -5, 0, [0, 0, 0])); // the deep below
  }, 0.06);
}

// caustics: the bright net of light the rippling surface focuses onto whatever is below. Returns the crisp lines
// (`w` sets how fine) and a soft glow around them, from one Voronoi lookup
const CAUSTIC = /* glsl */ `
vec2 h2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
vec2 caust(vec2 p, float t, float w){
  vec2 i = floor(p), f = fract(p); float d1 = 8., d2 = 8.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)); vec2 o = 0.5 + 0.42 * sin(t * 0.8 + 6.2831 * h2(i + g));
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  float e = d2 - d1;
  return vec2(pow(1.0 - smoothstep(0.0, w, e), 2.0), 1.0 - smoothstep(0.0, 0.45, e));
}`;

export async function create(stage, ctx) {
  const { renderer } = stage;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const [art] = await Promise.all([loadImage(ctx.image ?? "img/tide-banner.webp"), loadImage("img/tide-plate.webp"), fontsReady(["italic 30px 'Instrument Serif'"])]);

  const scene = new THREE.Scene();
  const env = seaEnv(renderer);
  scene.environment = env.texture;
  scene.fog = new THREE.Fog(0x0a4560, 5, 9);

  // ——— the silk ———
  const banner = new Banner(SILK), cloth = banner.cloth;
  let rigName = tallOf(stage.w, stage.h) ? "tall" : "wide", shift = 0;
  // settle it into the current before it's shown, damped at first, so it appears already streaming, calmly
  const settle = () => {
    banner.setRig(RIGS[rigName]);
    banner.place();
    const d0 = cloth.damping;
    cloth.damping = 4;
    for (let i = 0; i < 60; i++) banner.step(1 / 60);
    cloth.damping = d0;
    for (let i = 0; i < 180; i++) banner.step(1 / 60);
  };
  settle();

  const surface = splineSurface(cloth, 3);
  const silkTex = texture(bakeSilk(art), { anisotropy: renderer.capabilities.getMaxAnisotropy() });
  const mat = new THREE.MeshPhysicalMaterial({
    map: silkTex, roughness: 0.36, sheen: 1, sheenRoughness: 0.3, sheenColor: new THREE.Color(0xd9f3ff),
    anisotropy: 0.45, side: THREE.DoubleSide, envMapIntensity: 0.4,
  });
  const upView = new THREE.Vector3();
  const tu = inject(mat, "tide-silk", {
    uniforms: { ...surface.uniforms, uTime: { value: 0 }, uUp: { value: upView }, uSunCol: { value: new THREE.Color(0.95, 1, 1).multiplyScalar(1.2) }, uCaust: { value: new THREE.Vector2(0.12, 2.6) }, uGlow: { value: 0.38 } },
    vertHead: `${surface.vertHead}\nvarying vec3 vWPos;`,
    vert: "vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;",
    vertReplace: surface.vertReplace,
    fragHead: `varying vec3 vWPos; uniform float uTime; uniform vec3 uUp; uniform vec3 uSunCol; uniform vec2 uCaust; uniform float uGlow;\n${CAUSTIC}`,
    // the back of a printed silk shows the print paler and cooler
    fragReplace: { "#include <map_fragment>": "#include <map_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.9, 0.95), 0.35);" },
    frag: `{
      // light from the surface: a crisp net of caustics on whatever faces up (brighter nearer the surface), a soft
      // glow of it scattered in the silk, and light shining through wherever we see the underside
      vec2 cp = vWPos.xz * vec2(3.0, 3.8) + vec2(vWPos.y * 0.9, vWPos.y * 0.45);
      cp += 0.22 * sin(cp.yx * 1.3 + uTime * vec2(0.31, 0.23)); // the surface's ripples aren't a tidy net
      float face = dot(normal, uUp), up = clamp(face, 0.0, 1.0), down = clamp(-face, 0.0, 1.0);
      vec2 a = caust(cp, uTime, mix(0.16, 0.07, up)), b = caust(cp * 1.63 + 3.1, uTime * 1.3, mix(0.18, 0.08, up));
      float sharp = max(a.x, b.x * 0.6), soft = 0.5 * (a.y + b.y);
      float lit = (uCaust.x + uCaust.y * up) * (0.75 + 0.25 * smoothstep(-1.0, 1.0, vWPos.y));
      // thin silk seen edge-on gathers the light it scatters
      float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
      outgoingLight += diffuseColor.rgb * uSunCol * ((sharp + 0.15 * soft) * lit + down * uGlow * (0.7 + 0.6 * soft) + 0.18 * rim);
    }`,
  });
  const silk = new THREE.Mesh(surface.geometry, mat);
  silk.frustumCulled = false;
  scene.add(silk);

  // the sun from overhead, little fill: the folds turning away from the light go to the water's blue
  const sun = new THREE.DirectionalLight(0xf6fcff, 3.4);
  sun.position.set(0.3, 4, 1.2);
  const fill = new THREE.HemisphereLight(0x9adcf2, 0x04263a, 0.26);
  scene.add(sun, fill);

  const snow = makeSnow(900);
  const bubbles = makeBubbles(240);
  scene.add(snow, bubbles.points);

  // ——— the hand ———
  const aim = { x: stage.p.x, y: stage.p.y }, ray = { o: [0, 0, 0], d: [0, 0, -1] };
  const rayAt = (x, y) => {
    const r = stage.rayFrom(x, y).ray;
    ray.o[0] = r.origin.x; ray.o[1] = r.origin.y; ray.o[2] = r.origin.z;
    ray.d[0] = r.direction.x; ray.d[1] = r.direction.y; ray.d[2] = r.direction.z;
    return ray;
  };
  const pointer = new THREE.Vector3(), last = new THREE.Vector3(), hp = new THREE.Vector3();
  let stirClock = 0, ambient = 0, motion = 0, touching = false;
  const depthEl = ctx.hero.querySelector(".gauge .depth"), markEl = ctx.hero.querySelector(".gauge .mark");
  // where the pointer is in the water: on the silk if the hand is resting on it, else at the silk's depth
  const inWater = (out) => {
    const H = banner.hand;
    if (H.r > 0.02) return out.set(H.x, H.y, H.z);
    return stage.onPlane(stage.p.x, stage.p.y, 0, out);
  };

  const theme = {
    scene, cloth, banner, parallax: 0.012,
    layout(w, h) {
      const tall = tallOf(w, h), m = w < 760;
      if ((tall ? "tall" : "wide") !== rigName) { rigName = tall ? "tall" : "wide"; shift = 0; settle(); }
      // tall screens: it streams in from the right below the nav and its free end stays above the copy
      const ppm = tall
        ? stage.frame({ center: [0.05, 0.25, 0], worldW: 2.0, worldH: 2.6, sx: 0.5, sy: m ? 0.32 : 0.34, sh: m ? 0.56 : 0.6, sw: 1.04, fov: 26 })
        : stage.frame({ center: [-0.05, -0.02, 0], worldW: 3.1, worldH: 1.95, sx: 0.5, sy: 0.5, sh: 1, sw: 1, fov: 26 });
      // a screen wider than 16:10 shows more water at the sides: slide the banner over so its held end stays out
      // of sight (it streams the same wherever it is)
      const want = tall ? 0 : Math.max(0, 0.6 * (w / ppm - 3.1)); // (the held end is further back, where the view is wider)
      if (want !== shift) { cloth.translate(want - shift, 0, 0); banner.rig.o[0] += want - shift; shift = want; }
      scene.fog.near = stage.view.d - 0.4;
      scene.fog.far = stage.view.d + 3.2;
    },
    onDown(e) {
      inWater(hp);
      for (let i = 0; i < 26; i++) bubbles.spawn(hp.x + (Math.random() - 0.5) * 0.06, hp.y + (Math.random() - 0.5) * 0.04, hp.z + 0.05 + Math.random() * 0.05, 0.004 + Math.random() * 0.012);
      // a push of water away from you, with a turn in it
      const v = rayAt(e.clientX, e.clientY).d;
      banner.stir(hp.x, hp.y, hp.z, v[0] * 0.5, v[1] * 0.5 + 0.12, v[2] * 0.5, (Math.random() < 0.5 ? -1 : 1) * 1.4);
      ctx.audio.bubble(0.3); setTimeout(() => ctx.audio.bubble(0.6), 90); setTimeout(() => ctx.audio.bubble(0.45), 170);
    },
    // physics, 120 times a second
    step(h) {
      const p = stage.p;
      aim.x = smooth(aim.x, p.x, 25, h); aim.y = smooth(aim.y, p.y, 25, h);
      touching = banner.touch(p.active ? rayAt(aim.x, aim.y) : null, h);
      cloth.hashEvery = banner.hand.r > 0.02 ? 1 : 4; // the hand moves silk faster than the current does
      banner.step(h);
    },
    update(dt, t) {
      const p = stage.p;
      if (p.active) inWater(pointer);
      const vx = (pointer.x - last.x) / Math.max(dt, 1e-3), vy = (pointer.y - last.y) / Math.max(dt, 1e-3);
      const speed = Math.min(2.5, Math.hypot(vx, vy));
      last.copy(pointer);
      // each stroke leaves a swirl in the current and a trail of bubbles
      stirClock += dt;
      if (p.active && speed > 0.08 && stirClock > 0.05) {
        stirClock = 0;
        banner.stir(pointer.x, pointer.y, pointer.z, Math.max(-1, Math.min(1, vx * 0.5)), Math.max(-1, Math.min(1, vy * 0.5)), -0.1 * Math.min(1.5, speed), Math.sign(vx * 0.3 - vy) * Math.min(2, speed * 1.2));
        const n = Math.min(4, Math.floor(speed * 2.5));
        for (let i = 0; i < n; i++) bubbles.spawn(pointer.x + (Math.random() - 0.5) * 0.04, pointer.y + (Math.random() - 0.5) * 0.04, pointer.z + 0.04, 0.003 + Math.random() * 0.008);
        if (n && Math.random() < 0.3) ctx.audio.bubble(Math.random());
      }
      // a few bubbles always rising from the deep
      ambient += dt;
      if (ambient > 0.45) { ambient = 0; const bx = -1.4 + Math.random() * 1.3; for (let i = 0; i < 3; i++) bubbles.spawn(bx + Math.random() * 0.05, -1.5 - Math.random() * 0.2, -0.6 - Math.random() * 0.8, 0.002 + Math.random() * 0.006); }

      surface.update();
      upView.set(0, 1, 0).transformDirection(stage.camera.matrixWorldInverse);
      tu.uTime.value = t;
      snow.material.uniforms.uTime.value = t;
      bubbles.update(dt, t, banner.flowFn);
      // the depth gauge follows the pointer
      if (depthEl && p.active) {
        const f = Math.max(0, Math.min(1, p.y / stage.h));
        depthEl.textContent = `−${(6 + f * 12).toFixed(1)} m`;
        markEl.style.setProperty("--y", `${(f * 100).toFixed(1)}%`);
      }
      let v = 0;
      for (let i = 0; i < cloth.n; i += 9) v += Math.abs(cloth.vel[3 * i]) + Math.abs(cloth.vel[3 * i + 1]) + Math.abs(cloth.vel[3 * i + 2]);
      motion = smooth(motion, v / (cloth.n / 9), 4, dt);
      ctx.audio.rustle(Math.max(0, motion - 0.12) * 1.5 + (touching ? 0.05 : 0));
    },
    setImage(img) { silkTex.image = bakeSilk(img); silkTex.needsUpdate = true; },
    dispose() { disposeScene(scene); surface.dispose(); env.dispose(); },
  };
  return theme;
}

// marine snow: tiny specks drifting through the water, moved entirely in the vertex shader
function makeSnow(n) {
  const r = rng(31), pos = new Float32Array(3 * n), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[3 * i] = (r() - 0.5) * 5.4; pos[3 * i + 1] = (r() - 0.5) * 3.6; pos[3 * i + 2] = -1.8 + r() * 2.8; seed[i] = r(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
  return new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: window.devicePixelRatio || 1 } },
    vertexShader: `attribute float seed; uniform float uTime; uniform float uScale; varying float vA;
      void main(){
        vec3 p = position;
        p.x += 0.12 * sin(uTime * 0.07 + seed * 30.0) - uTime * 0.03;
        p.y += mod(seed * 3.6 - uTime * (0.008 + 0.012 * seed), 3.6) - 1.8;
        p.x = mod(p.x + 2.7, 5.4) - 2.7;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.0 + 2.2 * fract(seed * 13.7)) * uScale * (6.0 / -mv.z);
        vA = (0.18 + 0.4 * fract(seed * 5.3)) * smoothstep(-1.8, 0.4, position.z);
      }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(0.78, 0.94, 1.0, vA * smoothstep(0.5, 0.05, d)); }`,
  }));
}

// bubbles: a pool of points, each a little lens with a bright rim and a highlight, wobbling as it rises
function makeBubbles(max) {
  const pos = new Float32Array(3 * max), size = new Float32Array(max), alpha = new Float32Array(max);
  const vel = new Float32Array(max), ph = new Float32Array(max), life = new Float32Array(max);
  let next = 0;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute("size", new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute("alpha", new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const points = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uScale: { value: window.devicePixelRatio || 1 } },
    vertexShader: `attribute float size; attribute float alpha; uniform float uScale; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * uScale * 1400.0 / -mv.z; vA = alpha; }`,
    fragmentShader: `varying float vA;
      void main(){
        vec2 p = gl_PointCoord * 2.0 - 1.0; float d = length(p); if (d > 1.0) discard;
        float rim = smoothstep(0.7, 0.97, d) * (1.0 - smoothstep(0.97, 1.0, d));
        float hl = smoothstep(0.32, 0.0, length(p - vec2(-0.36, -0.38)));
        float body = 0.07 * (1.0 - d);
        gl_FragColor = vec4(vec3(0.86, 0.97, 1.0), (rim * 0.85 + hl * 0.9 + body) * vA);
      }`,
  }));
  points.frustumCulled = false;
  const o = [0, 0, 0];
  return {
    points,
    spawn(x, y, z, r) {
      const i = next; next = (next + 1) % max;
      pos[3 * i] = x; pos[3 * i + 1] = y; pos[3 * i + 2] = z;
      size[i] = r; vel[i] = 0.12 + r * 22; ph[i] = Math.random() * 6.28; life[i] = 1;
    },
    update(dt, t, flow) {
      for (let i = 0; i < max; i++) {
        if (life[i] <= 0) { alpha[i] = 0; continue; }
        flow(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2], o);
        pos[3 * i] += (o[0] * 0.4 + 0.03 * Math.sin(t * 7 + ph[i])) * dt;
        pos[3 * i + 1] += vel[i] * dt;
        pos[3 * i + 2] += o[2] * 0.3 * dt;
        if (pos[3 * i + 1] > 2.4) life[i] = 0;
        alpha[i] = Math.min(1, life[i] * 3) * (0.55 + 0.45 * Math.sin(t * 3 + ph[i]) ** 2);
      }
      g.attributes.position.needsUpdate = g.attributes.size.needsUpdate = g.attributes.alpha.needsUpdate = true;
    },
  };
}
