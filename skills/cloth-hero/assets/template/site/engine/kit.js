// Shared helpers for the themes: image loading and canvas baking, procedural texture maps (weave, droplets,
// bamboo), PMREM environments built from small emissive scenes, shader injection into three's materials,
// cloth → mesh bridges (plain, or a smooth GPU spline surface), and (re-exported from noise.js) value noise.
import * as THREE from "three";
import { rng } from "./noise.js";

export { rng, noise3 } from "./noise.js";

// ——— images & canvases ———
export const loadImage = (src) =>
  new Promise((res, rej) => {
    const i = new Image();
    i.decoding = "async";
    i.onload = () => res(i);
    i.onerror = () => rej(new Error(`image ${src}`));
    i.src = src;
  });

export function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

export const dims = (img) => [img.naturalWidth || img.width, img.naturalHeight || img.height];

export function drawCover(ctx, img, x, y, w, h, fx = 0.5, fy = 0.5) {
  const [iw, ih] = dims(img), s = Math.max(w / iw, h / ih), sw = w / s, sh = h / s;
  ctx.drawImage(img, (iw - sw) * fx, (ih - sh) * fy, sw, sh, x, y, w, h);
}

export function drawContain(ctx, img, x, y, w, h) {
  const [iw, ih] = dims(img), s = Math.min(w / iw, h / ih), dw = iw * s, dh = ih * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

// cheap, cross-browser blur: down-sample with smoothing, then scale back up
export function softBlur(src, radius) {
  const f = Math.max(1, radius / 1.5), w = src.width, h = src.height;
  const sm = canvas(Math.max(1, Math.round(w / f)), Math.max(1, Math.round(h / f)));
  const sx = sm.getContext("2d");
  sx.imageSmoothingQuality = "high";
  sx.drawImage(src, 0, 0, sm.width, sm.height);
  const out = canvas(w, h), ox = out.getContext("2d");
  ox.imageSmoothingQuality = "high";
  ox.drawImage(sm, 0, 0, w, h);
  return out;
}

export async function fontsReady(list) {
  try { await Promise.all(list.map((f) => document.fonts.load(f))); } catch {}
}

export function texture(src, { srgb = true, repeat, anisotropy = 8 } = {}) {
  const t = new THREE.CanvasTexture(src);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// ——— procedural maps ———

// Plain weave, tileable: warp and weft threads of uneven thickness with slubs, over/under alternating.
// Returns { normal, open }: a tangent-space normal map and an "openness" map (1 where light passes between threads).
export function weaveMaps(size = 512, threads = 32, seed = 7) {
  const r = rng(seed), T = threads, Pc = size / T, TAU = Math.PI * 2;
  const mk = () => Array.from({ length: T }, () => ({ w: 0.62 + 0.3 * r(), k1: 1 + ((r() * 3) | 0), p1: r() * TAU, k2: 3 + ((r() * 5) | 0), p2: r() * TAU, s: 0.12 + 0.2 * r() }));
  const warp = mk(), weft = mk();
  const h = new Float32Array(size * size), open = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = Math.floor(x / Pc), j = Math.floor(y / Pc);
      const fx = ((x % Pc) + 0.5) / Pc - 0.5, fy = ((y % Pc) + 0.5) / Pc - 0.5;
      const a = warp[i], b = weft[j];
      const ww = a.w * (1 + a.s * Math.sin((TAU * a.k1 * y) / size + a.p1) + 0.6 * a.s * Math.sin((TAU * a.k2 * y) / size + a.p2));
      const wf = b.w * (1 + b.s * Math.sin((TAU * b.k1 * x) / size + b.p1) + 0.6 * b.s * Math.sin((TAU * b.k2 * x) / size + b.p2));
      const pw = Math.sqrt(Math.max(0, 1 - (fx / (0.5 * ww)) ** 2));
      const pf = Math.sqrt(Math.max(0, 1 - (fy / (0.5 * wf)) ** 2));
      const over = (i + j) & 1;
      const hw = pw * (over ? 0.42 : 0.62 + 0.38 * Math.cos(Math.PI * fy));
      const hf = pf * (over ? 0.62 + 0.38 * Math.cos(Math.PI * fx) : 0.42);
      h[y * size + x] = Math.max(hw, hf) + (r() - 0.5) * 0.05;
      const cover = Math.max(pw, pf);
      open[y * size + x] = 1 - Math.min(1, cover / 0.3);
    }
  const nc = canvas(size, size), oc = canvas(size, size);
  const nd = nc.getContext("2d").createImageData(size, size), od = oc.getContext("2d").createImageData(size, size);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 0.5, dy = (at(x, y + 1) - at(x, y - 1)) * 0.5;
      let nx = -dx * 4, ny = dy * 4, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const o = 4 * (y * size + x);
      nd.data[o] = (nx * 0.5 + 0.5) * 255; nd.data[o + 1] = (ny * 0.5 + 0.5) * 255; nd.data[o + 2] = (nz * 0.5 + 0.5) * 255; nd.data[o + 3] = 255;
      const v = open[y * size + x] * 255;
      od.data[o] = od.data[o + 1] = od.data[o + 2] = v; od.data[o + 3] = 255;
    }
  nc.getContext("2d").putImageData(nd, 0, 0);
  oc.getContext("2d").putImageData(od, 0, 0);
  return { normal: nc, open: oc };
}

// Beaded water: little domes, slightly elongated downward, tileable. A normal map for a clear coat.
export function dropletNormals(size = 1024, count = 1300, seed = 3, scale = 1) {
  const r = rng(seed), c = canvas(size, size), ctx = c.getContext("2d"), img = ctx.createImageData(size, size), d = img.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = 128; d[i + 1] = 128; d[i + 2] = 255; d[i + 3] = 255; }
  const occ = new Uint8Array(size * size);
  for (let k = 0; k < count; k++) {
    const rad = (1.4 + 9 * r() ** 3) * scale, ry = rad * (1 + 0.35 * r()), cx = r() * size, cy = r() * size;
    let free = true;
    for (let y = -ry; y <= ry && free; y += 2) for (let x = -rad; x <= rad; x += 2) {
      const X = ((Math.round(cx + x) % size) + size) % size, Y = ((Math.round(cy + y) % size) + size) % size;
      if (occ[Y * size + X]) { free = false; break; }
    }
    if (!free) continue;
    for (let y = Math.floor(-ry); y <= ry; y++)
      for (let x = Math.floor(-rad); x <= rad; x++) {
        const u = x / rad, v = y / ry, q = u * u + v * v;
        if (q >= 1) continue;
        const X = ((Math.round(cx + x) % size) + size) % size, Y = ((Math.round(cy + y) % size) + size) % size;
        occ[Y * size + X] = 1;
        const z = Math.sqrt(1 - q) * 0.9;
        const l = Math.hypot(u, -v, z), o = 4 * (Y * size + X);
        d[o] = (u / l * 0.5 + 0.5) * 255; d[o + 1] = (-v / l * 0.5 + 0.5) * 255; d[o + 2] = (z / l * 0.5 + 0.5) * 255;
      }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Bamboo pole, wrapped along the cylinder's length (v) with nodes every `seg` of it.
export function bambooMap(nodes = 5) {
  const w = 64, h = 1024, c = canvas(w, h), x = c.getContext("2d"), r = rng(11);
  const g = x.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "#8e7a45"); g.addColorStop(0.35, "#cbb57c"); g.addColorStop(0.55, "#d8c48e"); g.addColorStop(1, "#8e7a45");
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 120; i++) { x.fillStyle = `rgba(${r() < 0.5 ? "90,70,30" : "255,245,210"},${0.04 + r() * 0.06})`; x.fillRect(r() * w, r() * h, 1, 30 + r() * 200); }
  for (let k = 1; k < nodes; k++) {
    const y = (k / nodes) * h;
    x.fillStyle = "rgba(70,52,20,.55)"; x.fillRect(0, y - 2, w, 3);
    x.fillStyle = "rgba(255,240,200,.35)"; x.fillRect(0, y + 1, w, 3);
    const gg = x.createLinearGradient(0, y - 18, 0, y + 18);
    gg.addColorStop(0, "rgba(0,0,0,0)"); gg.addColorStop(0.5, "rgba(80,60,25,.18)"); gg.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = gg; x.fillRect(0, y - 18, w, 36);
  }
  return c;
}

// ——— environments ———
// Build a small scene of emissive panels and bake it into a prefiltered environment map.
export function bakeEnv(renderer, build, sigma = 0.04) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();
  build(scene);
  const rt = pmrem.fromScene(scene, sigma);
  pmrem.dispose();
  scene.traverse((o) => { o.geometry?.dispose(); if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose(); m.dispose(); }); });
  return rt;
}

export function glow(color, intensity, w, h, x, y, z, lookAt = [0, 0, 0], map) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide, map: map ?? null });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  p.position.set(x, y, z);
  p.lookAt(...lookAt);
  return p;
}

export function room(color, size = 20) {
  return new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }));
}

// ——— shader injection ———
// Adds uniforms and code to a built-in material: `fragHead`/`vertHead` go after <common>, `vert` after
// <project_vertex>, `frag` just before <opaque_fragment> (where outgoingLight is final and `normal` is in view space).
export function inject(material, key, { uniforms = {}, vertHead = "", vert = "", fragHead = "", frag = "", vertReplace = {}, fragReplace = {} }) {
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    let v = sh.vertexShader.replace("#include <common>", `#include <common>\n${vertHead}`).replace("#include <project_vertex>", `#include <project_vertex>\n${vert}`);
    let f = sh.fragmentShader.replace("#include <common>", `#include <common>\n${fragHead}`).replace("#include <opaque_fragment>", `${frag}\n#include <opaque_fragment>`);
    for (const [a, b] of Object.entries(vertReplace)) v = v.replace(a, b);
    for (const [a, b] of Object.entries(fragReplace)) f = f.replace(a, b);
    sh.vertexShader = v;
    sh.fragmentShader = f;
  };
  material.customProgramCacheKey = () => key;
  return uniforms;
}

// ——— cloth → mesh ———
export function clothGeometry(cloth) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(cloth.pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute("normal", new THREE.BufferAttribute(cloth.nrm, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute("uv", new THREE.BufferAttribute(cloth.uv, 2));
  g.setIndex(new THREE.BufferAttribute(cloth.tris, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
  return g;
}

export function syncGeometry(g) {
  g.attributes.position.needsUpdate = true;
  g.attributes.normal.needsUpdate = true;
}

// A cloth (one rectangular patch) drawn as a smooth surface: its particles are the control points of a uniform cubic
// B-spline surface, evaluated on the GPU `sub` times finer than the particle grid, so silhouettes, folds and
// highlights come out round and soft instead of faceted, at no cost to the physics. Hand the returned uniforms,
// vertHead and vertReplace to inject(); call update() after each physics step.
const SPLINE_HEAD = /* glsl */ `
uniform highp sampler2D uCtl; uniform vec2 uCtlN; attribute vec2 grid;
vec4 bsW(float t) { float s = 1.0 - t, t2 = t * t, t3 = t2 * t; return vec4(s * s * s, 3.0 * t3 - 6.0 * t2 + 4.0, -3.0 * t3 + 3.0 * t2 + 3.0 * t + 1.0, t3) / 6.0; }
vec4 bsD(float t) { float s = 1.0 - t, t2 = t * t; return vec4(-s * s, 3.0 * t2 - 4.0 * t, -3.0 * t2 + 2.0 * t + 1.0, t2) * 0.5; }`;
const SPLINE_BEGIN = /* glsl */ `
vec3 sP = vec3(0.0), sU = vec3(0.0), sV = vec3(0.0);
{
  vec2 g0 = min(floor(grid), uCtlN - 2.0), f = grid - g0;
  vec4 wu = bsW(f.x), wv = bsW(f.y), du = bsD(f.x), dv = bsD(f.y);
  ivec2 b0 = ivec2(g0);
  for (int b = 0; b < 4; b++) {
    vec3 row = vec3(0.0), drow = vec3(0.0);
    for (int a = 0; a < 4; a++) {
      vec3 q = texelFetch(uCtl, b0 + ivec2(a, b), 0).xyz;
      row += wu[a] * q; drow += du[a] * q;
    }
    sP += wv[b] * row; sU += wv[b] * drow; sV += dv[b] * row;
  }
}
vec3 objectNormal = normalize(cross(sV, sU));
#ifdef USE_TANGENT
vec3 objectTangent = normalize(sU);
#endif`;

export function splineSurface(cloth, sub = 3) {
  const p = cloth.patches[0], { cols: NC, rows: NR, base, u0 = 0, u1 = 1, v0 = 1, v1 = 0 } = p, TW = NC + 2, TH = NR + 2;
  // control points, with one ring of extra points continuing the edges straight on (so the surface reaches them)
  const data = new Float32Array(TW * TH * 4);
  const tex = new THREE.DataTexture(data, TW, TH, THREE.RGBAFormat, THREE.FloatType);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  const nu = (NC - 1) * sub + 1, nv = (NR - 1) * sub + 1;
  const grid = new Float32Array(2 * nu * nv), uv = new Float32Array(2 * nu * nv), idx = new Uint32Array(6 * (nu - 1) * (nv - 1));
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const k = j * nu + i, c = i / sub, r = j / sub;
      grid[2 * k] = c; grid[2 * k + 1] = r;
      uv[2 * k] = u0 + (u1 - u0) * (c / (NC - 1)); uv[2 * k + 1] = v0 + (v1 - v0) * (r / (NR - 1));
    }
  let t = 0; // same winding as the cloth's own triangles, so the same side is the front
  for (let j = 0; j + 1 < nv; j++)
    for (let i = 0; i + 1 < nu; i++) { const a = j * nu + i, c = a + nu; idx[t++] = a; idx[t++] = c; idx[t++] = a + 1; idx[t++] = a + 1; idx[t++] = c; idx[t++] = c + 1; }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3 * nu * nv), 3)); // placed in the shader
  geometry.setAttribute("grid", new THREE.BufferAttribute(grid, 2));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(new THREE.BufferAttribute(idx, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
  const P = cloth.pos;
  const update = () => {
    for (let j = -1; j <= NR; j++) {
      const ja = j < 0 ? 0 : j >= NR ? NR - 1 : j, jb = j < 0 ? 1 : j >= NR ? NR - 2 : ja, wj = j === ja ? 1 : 2;
      for (let i = -1; i <= NC; i++) {
        const ia = i < 0 ? 0 : i >= NC ? NC - 1 : i, ib = i < 0 ? 1 : i >= NC ? NC - 2 : ia, wi = i === ia ? 1 : 2;
        const aa = 3 * (base + ja * NC + ia), ba = 3 * (base + ja * NC + ib), ab = 3 * (base + jb * NC + ia), bb = 3 * (base + jb * NC + ib);
        const o = 4 * ((j + 1) * TW + i + 1);
        for (let e = 0; e < 3; e++) data[o + e] = wj * (wi * P[aa + e] + (1 - wi) * P[ba + e]) + (1 - wj) * (wi * P[ab + e] + (1 - wi) * P[bb + e]);
      }
    }
    tex.needsUpdate = true;
  };
  update();
  return {
    geometry, update,
    uniforms: { uCtl: { value: tex }, uCtlN: { value: new THREE.Vector2(NC, NR) } },
    vertHead: SPLINE_HEAD,
    vertReplace: { "#include <beginnormal_vertex>": SPLINE_BEGIN, "#include <begin_vertex>": "vec3 transformed = sP;" },
    dispose: () => tex.dispose(),
  };
}

export function disposeScene(scene) {
  scene.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) [].concat(o.material).forEach((m) => {
      for (const k of Object.keys(m)) if (m[k]?.isTexture) m[k].dispose();
      m.dispose();
    });
  });
}

export const smooth = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
