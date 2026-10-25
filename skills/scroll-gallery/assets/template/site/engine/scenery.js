// Scenery: what a layout stands in, from its `scene` in page.json.
//   back:  { img, dist }          a soft photo (scene/<img>.webp) behind the cards, `dist` from the layout's camera
//          { img, surface: true }  the same, lying on the layout's own surface (the table, under the book, the wall);
//                                  tile: true repeats it across instead of cropping it (a long wall of boards)
//          { shader, a, b, c }     a pattern instead: stars, glow, halftone, beams, tunnel, paper, dots, linen
//          { glow: true, a }        the picture in front, blurred into a wash of its own light (a, how strong)
//   mid:   [{ img, x, y, w | h, dist, drift, tint, a }]   line drawings behind the cards (a turntable taken apart, a
//          synth), white lines tinted to `tint`, w of the view's width or h of its height; each draws itself in from the
//          middle as its layout arrives, and out as it goes
//   front: [{ img, x, y, w, dist, drift, sway, tint, a }]   shapes in front of the cards (clouds, fog, a skyline):
//          at screen position x, y (−1…1) and w of the view's width, `dist` from the camera, drifting with the scroll;
//          sway [x, y, speed] moves it gently with time as well
//   rain, dust                    fine weather in front: thin rain streaks, motes in a lamp's light (dust: { color, size })
// Everything sits where the layout's camera looks from halfway through its stretch, so the camera's own moves give
// parallax. The backdrop wipes in and out with the page's background; the rest fades with the layout.
import * as THREE from "three";

const DEG = Math.PI / 180;
const vert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const head = `
uniform float uA, uTime; uniform vec2 uWipe, uRes; uniform vec3 uCa, uCb, uCc;
varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wipe() {
  float y = gl_FragCoord.y / uRes.y;
  float lo = uWipe.x <= 0.0 ? 1.0 : smoothstep(uWipe.x - 0.03, uWipe.x + 0.03, y);
  float hi = uWipe.y >= 1.0 ? 1.0 : 1.0 - smoothstep(uWipe.y - 0.03, uWipe.y + 0.03, y);
  return lo * hi;
}`;
const PATTERNS = {
  // a night sky: the gradient, and small stars that breathe
  stars: `void main() {
    vec3 c = mix(uCb, uCa, vUv.y);
    vec2 g = vUv * vec2(170.0, 96.0), id = floor(g), f = fract(g) - 0.5;
    float r = h(id), d = length(f - (vec2(h(id + 3.1), h(id + 7.7)) - 0.5) * 0.7);
    c += step(0.88, r) * smoothstep(0.09, 0.0, d) * (0.55 + 0.45 * sin(uTime * (0.6 + r * 2.0) + r * 40.0)) * (0.35 + 0.65 * vUv.y) * 0.9;
    gl_FragColor = vec4(c, uA * wipe()); }`,
  // a pale sky with the sun somewhere behind the haze
  glow: `void main() {
    vec3 c = mix(uCb, uCa, vUv.y);
    c = mix(c, uCc, 0.75 * exp(-pow(length((vUv - vec2(0.68, 0.74)) * vec2(1.6, 1.0)) / 0.32, 2.0)));
    gl_FragColor = vec4(c, uA * wipe()); }`,
  // a shop window's halftone: dots that grow across the glass
  halftone: `void main() {
    vec2 g = vUv * vec2(96.0, 54.0), f = fract(g) - 0.5;
    float r = mix(0.04, 0.36, smoothstep(0.1, 1.0, (vUv.x * 0.7 + (1.0 - vUv.y) * 0.5)));
    vec3 c = mix(mix(uCb, uCa, vUv.y), uCc, (1.0 - smoothstep(r - 0.04, r + 0.04, length(f))) * 0.55);
    gl_FragColor = vec4(c, uA * wipe()); }`,
  // the dance floor: soft beams of light swinging slowly from the ceiling
  beams: `void main() {
    vec3 c = mix(uCb, uCa, vUv.y);
    for (int i = 0; i < 4; i++) {
      float fi = float(i), x0 = 0.2 + 0.2 * fi, a = 0.35 * sin(uTime * 0.17 + fi * 1.9);
      vec2 p = vUv - vec2(x0, 1.05); float ang = atan(p.x, -p.y) - a;
      c += mix(uCc, vec3(0.55, 0.65, 1.0), mod(fi, 2.0)) * exp(-ang * ang * 90.0) * 0.16 * smoothstep(1.1, 0.0, length(p));
    }
    gl_FragColor = vec4(c, uA * wipe()); }`,
  // the end of a road tunnel: a warm glow where the walls meet
  tunnel: `void main() {
    vec3 c = mix(uCb, uCa, vUv.y);
    c += uCc * 0.32 * exp(-pow(length((vUv - vec2(0.5, 0.52)) * vec2(1.8, 1.0)) / 0.16, 2.0));
    gl_FragColor = vec4(c, uA * wipe()); }`,
  // a fine grid of dots over a soft gradient, like a design tool's canvas
  dots: `void main() {
    vec3 c = mix(uCb, uCa, vUv.y);
    vec2 g = vUv * vec2(120.0, 68.0), f = fract(g) - 0.5;
    c = mix(c, uCc, (1.0 - smoothstep(0.06, 0.1, length(f))) * 0.32);
    gl_FragColor = vec4(c, uA * wipe()); }`,
  // linen: a soft gradient with a fine woven texture and the slubs of real thread
  linen: `void main() {
    vec3 c = mix(uCb, uCa, vUv.y);
    vec2 g = vUv * vec2(420.0, 236.0);
    float warp = 0.5 + 0.5 * sin(g.x * 3.14159), weft = 0.5 + 0.5 * sin(g.y * 3.14159);
    float slub = h(vec2(floor(g.x * 0.25), floor(g.y * 0.04))) * 0.5 + h(vec2(floor(g.x * 0.03), floor(g.y * 0.25))) * 0.5;
    c *= 0.965 + 0.045 * mix(warp, weft, step(0.5, fract((floor(g.x) + floor(g.y)) * 0.5))) + (slub - 0.5) * 0.035;
    c *= 1.0 - 0.12 * pow(length((vUv - 0.5) * vec2(1.2, 1.0)), 2.0);
    gl_FragColor = vec4(c, uA * wipe()); }`,
  // a backdrop of coloured paper: the gradient, a soft vignette, a little grain
  paper: `void main() {
    vec3 c = mix(uCb, uCa, vUv.y);
    c *= 1.0 - 0.28 * pow(length((vUv - 0.5) * vec2(1.3, 1.0)), 2.0);
    c += (h(floor(vUv * vec2(900.0, 520.0))) - 0.5) * 0.025;
    gl_FragColor = vec4(c, uA * wipe()); }`,
};
const photoFrag = `${head}
uniform sampler2D uMap; uniform float uDim; uniform vec3 uBg; uniform vec4 uCrop;
void main() { vec3 c = texture2D(uMap, uCrop.xy + vUv * uCrop.zw).rgb; gl_FragColor = vec4(mix(c, uBg, uDim), uA * wipe()); }`;
// the picture in front, blurred to its colours and spread behind everything; the last one fades out under the new one
const glowFrag = `${head}
uniform sampler2D uMap, uMapB; uniform float uMix, uStrength; uniform vec3 uBg;
void main() {
  vec3 c = mix(texture2D(uMapB, vUv, 7.5).rgb, texture2D(uMap, vUv, 7.5).rgb, uMix);
  float v = 1.0 - smoothstep(0.05, 0.85, length((vUv - 0.5) * vec2(1.3, 1.0)));
  c = mix(uBg, c * 0.85, uStrength * v);
  c += (h(floor(vUv * vec2(900.0, 520.0))) - 0.5) * 0.02;
  gl_FragColor = vec4(c, uA * wipe()); }`;
const shapeFrag = `${head}
uniform sampler2D uMap; uniform vec4 uTint;
void main() { vec4 t = texture2D(uMap, vUv); gl_FragColor = vec4(mix(t.rgb, uTint.rgb, uTint.a), t.a * uA); }`;
const lineFrag = `${head}
uniform sampler2D uMap; uniform vec4 uTint; uniform float uReveal;
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  float a = texture2D(uMap, vUv).a;
  // drawn in from the middle outward, unevenly, like a pen working over the sheet
  float m = length((vUv - 0.5) * vec2(1.5, 1.0)) * 1.2 + (n2(vUv * 9.0) - 0.5) * 0.3;
  float on = 1.0 - smoothstep(uReveal * 1.3 - 0.1, uReveal * 1.3, m);
  gl_FragColor = vec4(uTint.rgb, a * uA * on * wipe()); }`;
const rainFrag = `${head}
void main() {
  vec2 g = vec2(vUv.x * 140.0 + vUv.y * 9.0, vUv.y * 3.0 + uTime * 2.2), id = floor(g), f = fract(g);
  float r = h(vec2(id.x, floor(g.y + h(vec2(id.x, 1.0)) * 7.0)));
  float streak = step(0.93, r) * smoothstep(0.5, 0.48, abs(f.x - 0.5) * 9.0) * smoothstep(0.0, 0.5, f.y) * (1.0 - smoothstep(0.5, 1.0, f.y));
  gl_FragColor = vec4(uCa, streak * uA * 0.22); }`;

function uniforms(extra) {
  return { uA: { value: 0 }, uTime: { value: 0 }, uWipe: { value: new THREE.Vector2(0, 1) }, uRes: { value: new THREE.Vector2(1, 1) }, uCa: { value: new THREE.Color() }, uCb: { value: new THREE.Color() }, uCc: { value: new THREE.Color() }, ...extra };
}
const mat = (frag, u, order) => new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: u, transparent: true, depthWrite: false });

export function buildScene(cfg = {}, env) {
  const { scene, i, sizes, track, loader, prep, ctx, look } = env;
  const parts = [], fronts = [];
  const load = (name, done) => { const url = `scene/${name}.webp`; if (track) track(url, done); else loader.load(url, (t) => done(prep(t))); };
  const plane = (m) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); p.frustumCulled = false; p.visible = false; scene.add(p); parts.push(p); return p; };
  let back = null, rain = null, dust = null;

  if (cfg.back?.img) {
    const u = uniforms({ uMap: { value: null }, uDim: { value: 0 }, uBg: { value: new THREE.Color(look.bg[1]) }, uCrop: { value: new THREE.Vector4(0, 0, 1, 1) } });
    back = plane(mat(photoFrag, u)); back.userData = { cfg: cfg.back, aspect: sizes[cfg.back.img] ? sizes[cfg.back.img].w / sizes[cfg.back.img].h : 16 / 9 };
    load(cfg.back.img, (t) => { if (cfg.back.tile) t.wrapS = THREE.RepeatWrapping; u.uMap.value = t; });
  } else if (cfg.back?.glow) {
    const u = uniforms({ uMap: { value: null }, uMapB: { value: null }, uMix: { value: 1 }, uStrength: { value: cfg.back.a ?? 0.5 }, uBg: { value: new THREE.Color(look.bg[1]) } });
    back = plane(mat(glowFrag, u)); back.userData = { cfg: cfg.back, aspect: 0, glow: true };
  } else if (cfg.back?.shader) {
    const u = uniforms();
    u.uCa.value.set(cfg.back.a || look.bg[0]); u.uCb.value.set(cfg.back.b || look.bg[1]); u.uCc.value.set(cfg.back.c || look.accent);
    back = plane(mat(`${head}\n${PATTERNS[cfg.back.shader]}`, u)); back.userData = { cfg: cfg.back, aspect: 0 };
  }
  if (back) back.renderOrder = -30 + i;
  const mids = [];
  for (const f of cfg.mid || []) {
    const u = uniforms({ uMap: { value: null }, uTint: { value: new THREE.Vector4(1, 1, 1, 1) }, uReveal: { value: 0 } });
    const c = new THREE.Color(f.tint || look.ink); u.uTint.value.set(c.r, c.g, c.b, 1);
    const m = plane(mat(lineFrag, u)); m.renderOrder = -20 + i;
    m.userData = { cfg: f, aspect: sizes[f.img] ? sizes[f.img].w / sizes[f.img].h : 16 / 9 };
    load(f.img, (t) => (u.uMap.value = t));
    mids.push(m);
  }
  for (const f of cfg.front || []) {
    const u = uniforms({ uMap: { value: null }, uTint: { value: new THREE.Vector4(0, 0, 0, 0) } });
    if (f.tint) { const c = new THREE.Color(f.tint); u.uTint.value.set(c.r, c.g, c.b, 1); }
    const m = plane(mat(shapeFrag, u)); m.renderOrder = 20 + i;
    m.userData = { cfg: f, aspect: sizes[f.img] ? sizes[f.img].w / sizes[f.img].h : 1 };
    load(f.img, (t) => (u.uMap.value = t));
    fronts.push(m);
  }
  if (cfg.rain) {
    const u = uniforms(); u.uCa.value.set(cfg.rain.color || "#cfd8ff");
    rain = plane(mat(rainFrag, u)); rain.renderOrder = 25 + i;
  }
  if (cfg.dust) {
    const n = 90, pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let k = 0; k < n; k++) { pos.set([(Math.random() - 0.5) * 16, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 5], k * 3); seed[k] = Math.random(); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    dust = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uA: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color(cfg.dust.color || "#ffd9a8") }, uSize: { value: cfg.dust.size ?? 1 } },
      vertexShader: `attribute float seed; uniform float uTime, uSize; varying float vS;
        void main(){ vec3 p = position + vec3(sin(uTime * 0.11 + seed * 30.0) * 0.6, mod(uTime * 0.06 * (0.4 + seed) + seed * 8.0, 8.0) - 4.0, cos(uTime * 0.09 + seed * 20.0) * 0.4);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (1.0 + seed * 2.2) * 110.0 * uSize / -mv.z; vS = seed; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uA; uniform vec3 uColor; varying float vS;
        void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uColor, uA * (0.2 + 0.45 * vS) * smoothstep(0.5, 0.1, d)); }`,
    }));
    dust.frustumCulled = false; dust.visible = false; dust.renderOrder = 24 + i; scene.add(dust); parts.push(dust);
  }

  const home = { p: new THREE.Vector3(), q: new THREE.Quaternion(), fov: 40, aspect: 1.6 }, _v = new THREE.Vector3();
  // a plane `dist` in front of the home camera, covering its view (and some more, for the camera's moves)
  function cover(m, dist, sx, sy, wFrac, aspect, over, hFrac = 0) {
    const hh = dist * Math.tan((home.fov / 2) * DEG), hw = hh * home.aspect;
    m.position.set(sx * hw, sy * hh, -dist).applyQuaternion(home.q).add(home.p);
    m.quaternion.copy(home.q);
    if (hFrac) { const h = hFrac * 2 * hh; m.scale.set(h * aspect, h, 1); return; }   // sized by the view's height, for any screen shape
    if (wFrac) { const w = wFrac * 2 * hw; m.scale.set(w, w / aspect, 1); return; }
    // a backdrop: cover the view at any aspect, cropping the picture rather than stretching it
    const W = 2 * hw * over, H = 2 * hh * over;
    m.scale.set(W, H, 1);
    const crop = m.material.uniforms.uCrop?.value;
    if (crop && aspect) { const va = W / H; if (va > aspect) crop.set(0, (1 - aspect / va) / 2, 1, aspect / va); else crop.set((1 - va / aspect) / 2, 0, va / aspect, 1); }
  }

  return {
    // called on resize with where the layout's camera looks from halfway through, and its surface if it has one
    place(view, surface) {
      home.p.copy(view.p); home.q.copy(view.q); home.fov = view.fov; home.aspect = view.aspect;
      if (back) {
        const c = back.userData.cfg;
        if (c.surface && surface) {
          back.position.copy(surface.p); back.quaternion.copy(surface.q);
          const W = surface.w, H = surface.h, a = back.userData.aspect;
          back.scale.set(W, H, 1);
          const crop = back.material.uniforms.uCrop?.value;
          if (crop && a && c.tile) crop.set(0, 0, W / H / a, 1);           // repeated across, the whole height kept (a long wall)
          else if (crop && a) { const va = W / H; if (va > a) crop.set(0, (1 - a / va) / 2, 1, a / va); else crop.set((1 - va / a) / 2, 0, va / a, 1); }
        } else cover(back, c.dist || 40, 0, 0, 0, back.userData.aspect, c.over || 1.35);
      }
      for (const m of [...mids, ...fronts]) { const f = m.userData.cfg; cover(m, f.dist || 5, f.x || 0, f.y || 0, f.w || 0.5, m.userData.aspect, 1, f.h || 0); m.userData.base = m.position.clone(); m.userData.hw = (f.dist || 5) * Math.tan((home.fov / 2) * DEG) * home.aspect; }
      if (rain) cover(rain, 3.2, 0, 0, 0, 0, 1.2);
      if (dust) dust.position.set(0, 0, -11).applyQuaternion(home.q).add(home.p);
    },
    update(w, t, wipe, dim, hero) {
      const show = w > 0.001 || (wipe[1] - wipe[0] > 0 && w > 0);
      for (const p of parts) p.visible = show;
      if (!show) return;
      const res = [innerWidth * devicePixelRatio, innerHeight * devicePixelRatio];
      if (back) {
        const u = back.material.uniforms;
        u.uA.value = Math.min(1, w * 4); u.uWipe.value.set(wipe[0], wipe[1]); u.uRes.value.set(...res); u.uTime.value = ctx.time;
        if (u.uDim) u.uDim.value = (back.userData.cfg.dim || 0) + dim * 0.5;
        if (back.userData.glow) {
          if (hero && hero.tex !== u.uMap.value) { u.uMapB.value = u.uMap.value || hero.tex; u.uMap.value = hero.tex; u.uMix.value = 0; }
          u.uMix.value = Math.min(1, u.uMix.value + Math.max(ctx.dt, 1 / 60) * 1.4);
          u.uStrength.value = (back.userData.cfg.a ?? 0.5) * (1 - dim * 0.5);
        }
        back.visible = wipe[1] > wipe[0] + 1e-4 && (!back.userData.glow || !!u.uMap.value);
      }
      for (const m of mids) {
        const f = m.userData.cfg, u = m.material.uniforms, d = f.drift || [0, 0];
        u.uA.value = (f.a ?? 0.5) * (1 - dim * 0.5) * Math.min(1, w * 6); u.uReveal.value = Math.min(1, w); u.uWipe.value.set(wipe[0], wipe[1]); u.uRes.value.set(...res);
        m.position.copy(m.userData.base).add(_v.set(d[0] * (t - 0.5) * m.userData.hw, d[1] * (t - 0.5) * m.userData.hw, 0).applyQuaternion(home.q));
      }
      for (const m of fronts) {
        const f = m.userData.cfg, u = m.material.uniforms, d = f.drift || [0, 0], sw = f.sway || [0, 0, 0], tm = ctx.time * sw[2];
        u.uA.value = (f.a ?? 1) * w * (1 - dim * 0.6);
        m.position.copy(m.userData.base).add(_v.set((d[0] * (t - 0.5) + sw[0] * Math.sin(tm)) * m.userData.hw, (d[1] * (t - 0.5) + sw[1] * Math.sin(tm * 0.7 + 1)) * m.userData.hw, 0).applyQuaternion(home.q));
      }
      if (rain) { const u = rain.material.uniforms; u.uA.value = w; u.uTime.value = ctx.time; u.uRes.value.set(...res); }
      if (dust) { dust.material.uniforms.uA.value = w; dust.material.uniforms.uTime.value = ctx.time; }
    },
  };
}
