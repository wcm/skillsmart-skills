// What every layout shares: the pose of a card, the ways in and out, and small props (soft shadows, wood, labels,
// threads, lines). World units: from the default camera the view is 10 high at z = 0 (ctx.H) and ctx.sw wide.
import * as THREE from "three";

export const TAU = Math.PI * 2, DEG = Math.PI / 180;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t) => t * t * t;
export const backOut = (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
export const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const wrap = (x, m) => ((x % m) + m) % m;
export const wrapPi = (a) => wrap(a + Math.PI, TAU) - Math.PI;
export const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
export const view = (p, at, fov = 40, dof = 0.08) => ({ p, at, fov, dof });
export const mix3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const _m = new THREE.Matrix4(), _fx = new THREE.Vector3(), _fy = new THREE.Vector3(), _fz = new THREE.Vector3();

// Where a card is and how it looks. p is the card's pivot point (its middle, or its spine for a page), q its turn.
//   w, h        size;  pivot, side, theta, k, twist   a page turning about an edge, or a card bent round a cylinder (k)
//   ring        bent in its own plane round a wheel's rim (1 / radius);  sphere   curved both ways, on a ball of 1 / k
//   flip        turned over about its own upright middle, in half turns (0.5: edge on)
//   img, imgB   which picture it shows on the front (−1: its own) and on the back (−1: plain paper, or its own if twoSided)
//   sx sy sw sh, bx by bw bh   the part of the picture on the front and on the back (a tile, a cube's sticker)
//   face, faceB the shape the whole picture is fitted to before a part is taken (0: the card's own shape)
//   blur        soft on its own (focus);  dim   faded toward the background;  shade, sheen   light;  fog   haze with depth
//   disc        a record slid out of its sleeve by this much of the cover, toward discDir
//   thick, gloss, grain, edgeTint, mat   the slab's thickness, how much it reflects, its grain, how much the picture
//               tints its edge, its material (0 paper, 1 silk, 2 acrylic, 3 glazed tile); −1: the page's own
//   cloth       how much it hangs like cloth (0 a stiff card, 1 the simulated sheet)
export const NUM = ["w", "h", "pivot", "theta", "k", "twist", "lift", "shade", "sheen", "sheenPow", "fog", "fogNear", "fogFar",
  "gutter", "deckle", "shadow", "shadowAt", "dim", "radius", "flip", "ring", "disc", "discDir", "blur",
  "sx", "sy", "sw", "sh", "bx", "by", "bw", "bh", "face", "faceB", "thick", "gloss", "grain", "edgeTint", "cloth"];
const KEEP = ["side", "sphere", "twoSided", "clip", "img", "imgB", "mat"];
export class Pose {
  constructor() { this.p = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.reset(); }
  reset() {
    this.p.set(0, 0, 0); this.q.identity();
    this.w = 1; this.h = 1; this.pivot = 0.5; this.side = 1; this.theta = 0; this.k = 0; this.twist = 0; this.lift = 0;
    this.shade = 0; this.sheen = 0; this.sheenPow = 30; this.fog = 0; this.fogNear = 10; this.fogFar = 60;
    this.gutter = 0; this.deckle = 0; this.shadow = 0; this.shadowAt = 0; this.dim = 0; this.radius = -1; this.flip = 0;
    this.ring = 0; this.disc = 0; this.discDir = 0; this.blur = 0;
    this.sx = 0; this.sy = 0; this.sw = 1; this.sh = 1; this.bx = 0; this.by = 0; this.bw = 1; this.bh = 1; this.face = 0; this.faceB = 0;
    this.thick = -1; this.gloss = -1; this.grain = -1; this.edgeTint = -1; this.mat = -1; this.cloth = 0;
    this.sphere = 0; this.twoSided = 0; this.clip = -1e4; this.img = -1; this.imgB = -1;
    return this;
  }
  copy(o) { this.p.copy(o.p); this.q.copy(o.q); for (const f of NUM) this[f] = o[f]; for (const f of KEEP) this[f] = o[f]; return this; }
  hide() { this.w = this.h = 0; return this; }
  part(x, y, w, h) { this.sx = x; this.sy = y; this.sw = w; this.sh = h; return this; }
  partB(x, y, w, h) { this.bx = x; this.by = y; this.bw = w; this.bh = h; return this; }
}

// from pose a to pose b (o is a third pose)
export function mixPose(a, b, e, o) {
  o.p.lerpVectors(a.p, b.p, e); o.q.slerpQuaternions(a.q, b.q, e);
  for (const f of NUM) o[f] = lerp(a[f], b[f], e);
  for (const f of KEEP) o[f] = e < 0.5 ? a[f] : b[f];
  o.clip = b.clip;
  return o;
}
// The ways in and out. u runs 0–1 for the whole set; stagger() gives card k of n its own part of it, so they go one
// after another. arrive() brings o (at rest) in from an away pose that fn makes from a copy of it; depart() sends it off.
export const stagger = (u, k, n, spread = 0.5) => clamp((u - spread * (n > 1 ? k / (n - 1) : 0)) / (1 - spread));
const _away = new Pose(), _rest = new Pose();
export function arrive(o, u, fn) { if (u >= 1) return o; _rest.copy(o); _away.copy(o); fn(_away); return mixPose(_away, _rest, u, o); }
export function depart(o, u, fn) { if (u <= 0) return o; _rest.copy(o); _away.copy(o); fn(_away); return mixPose(_rest, _away, u, o); }
// grown out of nothing where it stands (or shrunk away): the default way in and out
export function grow(o, u) { const s = easeOut(clamp(u)); o.w *= s; o.h *= s; return o; }
// move a pose as one piece: turn it by q about the point c, then shift it by d
export function rigid(o, c, q, d) { o.p.sub(c).applyQuaternion(q).add(c).add(d); o.q.premultiply(q); return o; }
// a rotation that turns the card's +z to n, with its +y toward up
export function facing(q, n, up) {
  _fz.copy(n).normalize();
  _fx.crossVectors(up, _fz);
  if (_fx.lengthSq() < 1e-8) _fx.set(1, 0, 0); else _fx.normalize();
  _fy.crossVectors(_fz, _fx);
  return q.setFromRotationMatrix(_m.makeBasis(_fx, _fy, _fz));
}
// the middle of a card whose pivot is on an edge (a page), for things that need its centre
export function centreOf(o, out) {
  return out.set((0.5 - o.pivot) * o.w * Math.cos(o.theta), 0, o.side * (0.5 - o.pivot) * o.w * Math.sin(o.theta)).applyQuaternion(o.q).add(o.p);
}

// ── props ───────────────────────────────────────────────────────────────────────────────────────────────────────
export const lineMat = (color, opacity = 1) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
export function lines(n, color, opacity) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  const l = new THREE.LineSegments(g, lineMat(color, opacity));
  l.frustumCulled = false; l.userData.opacity = opacity;
  return l;
}
export function setSeg(l, i, a, b) { l.geometry.attributes.position.array.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6); }
export const done = (...ls) => ls.forEach((l) => (l.geometry.attributes.position.needsUpdate = true));
export const fadeObj = (obj, w) => obj.traverse((o) => { if (o.material) { if (o.material.uniforms?.uA) o.material.uniforms.uA.value = (o.userData.opacity ?? 1) * w; else o.material.opacity = (o.userData.opacity ?? 1) * w; } });
// a soft rounded shadow, sized and placed by its owner
export function softShadow() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uSize: { value: new THREE.Vector2(1, 1) }, uBlur: { value: 0.5 }, uA: { value: 0.2 }, uC: { value: new THREE.Color(0, 0, 0) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec2 uSize; uniform float uBlur, uA; uniform vec3 uC; varying vec2 vUv;
      void main(){ vec2 p = (vUv - 0.5) * uSize, q = abs(p) - (uSize * 0.5 - uBlur * 1.2); float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
        gl_FragColor = vec4(uC, uA * (1.0 - smoothstep(-uBlur, uBlur, d))); }`,
  }));
  m.frustumCulled = false;
  return m;
}
export const shadowSet = (m, w, h, blur, a) => { m.scale.set(w, h, 1); m.material.uniforms.uSize.value.set(w, h); m.material.uniforms.uBlur.value = blur; m.material.uniforms.uA.value = a; m.visible = a > 0.002; };
// wood (a crate, a turntable's plinth): a photo of walnut, lit softly from the upper left
export function woodMat(tex, repeat = [1, 1], tone = 1) {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uMap: { value: tex }, uA: { value: 1 }, uRepeat: { value: new THREE.Vector2(...repeat) }, uTone: { value: tone } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uA, uTone; uniform vec2 uRepeat; varying vec2 vUv; varying vec3 vN;
      void main(){ vec3 c = texture2D(uMap, fract(vUv * uRepeat)).rgb; vec3 n = normalize(vN);
        float l = 0.42 + 0.62 * max(dot(n, normalize(vec3(-0.45, 0.85, 0.55))), 0.0) + 0.08 * n.z;
        gl_FragColor = vec4(c * l * uTone, uA); }`,
  });
}
// matte or satin parts (a platter, a tonearm, a hub): one colour, the same soft light, a little sheen
export function solidMat(color, sheen = 0.2) {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uC: { value: new THREE.Color(color) }, uA: { value: 1 }, uSheen: { value: sheen } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 uC; uniform float uA, uSheen; varying vec3 vN; varying vec3 vV;
      void main(){ vec3 n = normalize(vN), L = normalize(vec3(-0.45, 0.85, 0.55));
        float l = 0.45 + 0.6 * max(dot(n, L), 0.0); float s = pow(max(dot(n, normalize(L + normalize(vV))), 0.0), 40.0);
        gl_FragColor = vec4(uC * l + uSheen * s, uA); }`,
  });
}
// the solid parts of a prop come in solid at once and go out solid, not as a ghost of themselves
export function solidity(parts, a) { for (const p of parts) { p.material.uniforms.uA.value = a; p.material.transparent = a < 0.999; } }

// a line of type on a strip of colour (a record's spine), as a texture `aspect` times as wide as it is high
export function labelTexture(text, sub, bg, font, aspect = 10, px = 64) {
  const c = document.createElement("canvas"), g = c.getContext("2d");
  c.height = Math.round(px * 1.6); c.width = Math.round(c.height * aspect);
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  const col = new THREE.Color(bg), lum = 0.3 * col.r + 0.59 * col.g + 0.11 * col.b;
  g.fillStyle = lum > 0.55 ? "#111" : "#f4f1ea"; g.textBaseline = "middle";
  g.font = `700 ${px * 0.62}px ${font}`;
  const t = text.toUpperCase(); g.fillText(t, px * 0.5, c.height / 2);
  if (sub) { const x = px * 0.5 + g.measureText(t).width + px * 0.4; g.globalAlpha = 0.7; g.font = `400 ${px * 0.5}px ${font}`; g.fillText(sub, x, c.height / 2); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 8;
  return tex;
}

// A thread: a thin strip that turns to face the camera, sagging between two pins, drawn in from one end (reveal).
export class Thread {
  constructor(color, width = 0.022, n = 28) {
    this.n = n; this.width = width;
    const g = new THREE.BufferGeometry(), idx = [];
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((n + 1) * 2 * 3), 3));
    for (let i = 0; i < n; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; this.mesh.userData.opacity = 1;
    this.pts = Array.from({ length: n + 1 }, () => new THREE.Vector3());
    this._t = new THREE.Vector3(); this._c = new THREE.Vector3(); this._s = new THREE.Vector3();
  }
  // from a to b, sagging by sag, shown from a up to reveal (0–1), facing eye
  set(a, b, sag, reveal, eye) {
    const { n, pts } = this, pos = this.mesh.geometry.attributes.position.array, r = clamp(reveal);
    for (let i = 0; i <= n; i++) {
      const u = (i / n) * r;
      pts[i].lerpVectors(a, b, u); pts[i].y -= sag * 4 * u * (1 - u);
    }
    for (let i = 0; i <= n; i++) {
      this._t.subVectors(pts[Math.min(n, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      this._c.subVectors(eye, pts[i]).normalize();
      this._s.crossVectors(this._t, this._c).normalize().multiplyScalar(this.width / 2);
      pos.set([pts[i].x - this._s.x, pts[i].y - this._s.y, pts[i].z - this._s.z, pts[i].x + this._s.x, pts[i].y + this._s.y, pts[i].z + this._s.z], i * 6);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.visible = r > 0.002;
  }
}

// points spread evenly over a ball (a Fibonacci spiral), as unit vectors
export function ballPoints(n) {
  const out = [], g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2, r = Math.sqrt(1 - y * y), a = i * g;
    out.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  return out;
}
