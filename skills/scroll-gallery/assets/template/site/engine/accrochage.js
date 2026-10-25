// Accrochage engine: a gallery whose pictures move through scenes as you scroll, each scene a layout (layouts.js).
//   A page is index.html (fonts and colours: --accent, --font-display, --font-ui) + page.json (the words, the scenes in
//   order, the pictures and their prompts) + images.json, img/ and scene/ (written by tools/build.mjs and scene.mjs).
//   Each scene has its own cards, one per place. A place shows one of the page's pictures, and a picture can be in many
//   places (a wheel of 40 made of 20 pictures, the 54 stickers of a cube). A scene holds for its stretch of scroll while
//   its layout moves the cards and the camera with t (0–1). Between two scenes the change ("change" in page.json) is:
//     reform   (the default) every picture in both scenes flies from its place in one to its place in the next; the
//              others leave and arrive each layout's own way
//     reshape  the same, but together and swinging round the middle of each shape: a circle tilts into a band
//     dive     a reshape the camera flies through
//     fan      the pictures rise into an arch in front of you and turn over, one after another, into the next ones
//     fold     the tiles fold up like a map into the next scene's closed book, which then opens
//   The page opens on a face-down deck dealt into the first scene ("open": "deal") or with that scene's own way in.
//   Index lists the pictures; clicking one goes to a scene it is in and brings it into view. Clicking a picture brings
//   it forward with its details beside it.
//   page.json "nav" puts links top right ([{ label, href }]; the one for this page is marked, one without href is a label).
//   window.accrochage.go(v) jumps to v screen heights of scroll and draws it at once, for checks and screenshots;
//   .ready resolves once every picture and every piece of scenery has loaded; .record(true) stops the page drawing on its
//   own and .tick(v, dt) draws one frame dt seconds after the last (for video); .restart() replays the opening.
import * as THREE from "three";
import { cardGeometry, cardMaterial, reflectMaterial, placeholder, discGeometry, discMaterial } from "./card.js";
import { LAYOUTS, Pose, NUM, clamp, lerp, smooth, ease, hash } from "./layouts.js";
import { buildScene } from "./scenery.js";
import { makePost } from "./post.js";
import { Sheet } from "./cloth/sheet.js";

THREE.ColorManagement.enabled = false;

const MORPH = 1.0, FOV = 40, VIEW_H = 10, DEG = Math.PI / 180;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const json = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const ratio = (s) => { const [a, b] = String(s || "1:1").split(":").map(Number); return a / b; };
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fade = (rate, dt) => 1 - Math.exp(-dt * rate);
const pad = (n) => String(n).padStart(2, "0");

const page = await json("page.json");
page.card = { radius: 0.03, back: "#f4f2ee", ...page.card };   // the pictures' material: materials.md in the skill
const images = (await json("images.json")) || {};
const sceneSizes = (await json("scene/scene.json")) || {};
const items = page.items, N = items.length, seq = page.sequence;
const index = new Map(items.map((it, i) => [it.id, i]));
// a scene's pictures as item numbers: its list of ids ("all": every picture), repeated round to `count` places
function listOf(s) {
  let k = (s.cards === "all" ? items.map((it) => it.id) : s.cards || []).map((id) => index.get(id)).filter((x) => x != null);
  if (s.count && k.length) k = Array.from({ length: s.count }, (_, i) => k[i % k.length]);
  return k;
}
await document.fonts.ready;

// ── the page ─────────────────────────────────────────────────────────────────────────────────────────────────────
const metaOf = (it) => (it.meta || []).map(esc);
const details = (it) => `<div class="m">${metaOf(it).join("<br>")}</div><p>${esc(it.text)}</p>${it.tracks ? `<ol class="tr">${it.tracks.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>` : ""}`;
const entry = (it, k) => `<li data-i="${k}"><button type="button"><span class="n">${pad(k + 1)}</span><span class="t">${esc(it.title)}${it.sub ? `<span class="s">${esc(it.sub)}</span>` : ""}</span></button>
    <div class="d"><div class="in">${details(it)}</div></div></li>`;
// the links top right (page.json "nav": [{ label, href, current }]); the one for this page is marked
const here = (href) => { try { return new URL(href, location.href).pathname.replace(/index\.html$/, "") === location.pathname.replace(/index\.html$/, ""); } catch { return false; } };
const navHTML = (page.nav || []).map((n, i) => {
  const inner = `<i>${pad(i + 1)}</i><span>${esc(n.label)}</span>`, cur = n.current || (n.href && here(n.href)) ? ' aria-current="page"' : "";
  return n.href ? `<a href="${esc(n.href)}"${cur}>${inner}</a>` : `<span${cur}>${inner}</span>`;
}).join("");
document.body.insertAdjacentHTML("afterbegin", `
  <div class="a-bg"></div><div class="a-bg a-bg2"></div>
  <div class="a-title"><h1>${esc(page.title)}</h1><p>${esc(page.kicker)}<span>${esc(page.count)}</span></p></div>
  <canvas class="a-gl"></canvas>
  <header class="a-top">
    <a class="a-brand" href="../">${esc(page.brand)}</a>
    <nav class="a-demos">${navHTML}</nav>
  </header>
  <aside class="a-list" aria-label="Index"><p class="a-list-h">${esc(page.title)}<span>${esc(page.count)}</span></p><ol>${items.map(entry).join("")}</ol></aside>
  <footer class="a-foot">
    <button class="a-index" type="button" aria-expanded="false"><b>Index</b><span>${esc(page.count)}</span></button>
    <div class="a-switches" hidden></div>
    <div class="a-scene" aria-live="polite"><span class="a-num"><b>01</b><i>/${pad(seq.length)}</i></span><span class="a-name"><span>${esc(seq[0].name)}</span></span><span class="a-bar"><i></i></span></div>
  </footer>
  <section class="a-cap" aria-live="polite"></section>
  <div class="a-tip" aria-hidden="true"></div>
  <div class="a-feat" aria-hidden="true"><span class="n"></span><b></b><span class="m"></span></div>
  <div class="a-load"><span>000</span></div>
  <div class="a-space"></div>`);
const $ = (s) => document.querySelector(s);
const list = $(".a-list"), entries = [...list.querySelectorAll("li[data-i]")];
const entryOf = new Map(entries.map((li) => [+li.dataset.i, li]));
const titleEl = $(".a-title"), indexBtn = $(".a-index"), capEl = $(".a-cap"), loadEl = $(".a-load"), tipEl = $(".a-tip"), featEl = $(".a-feat"), root = document.documentElement;
const sceneEl = $(".a-scene"), numEl = sceneEl.querySelector(".a-num b"), nameEl = sceneEl.querySelector(".a-name"), barEl = sceneEl.querySelector(".a-bar i"), switchEl = $(".a-switches");

// ── the scene ────────────────────────────────────────────────────────────────────────────────────────────────────
const canvas = $(".a-gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const clothLinear = renderer.extensions.has("OES_texture_float_linear");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.3, 600);
// the page's own colours, drawn first: each scene's gradient, the next one wiping up from the bottom
const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false,
  uniforms: { uA0: { value: new THREE.Color() }, uA1: { value: new THREE.Color() }, uB0: { value: new THREE.Color() }, uB1: { value: new THREE.Color() }, uWipe: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `uniform vec3 uA0, uA1, uB0, uB1; uniform float uWipe; varying vec2 vUv;
    void main(){ gl_FragColor = vec4(vUv.y < uWipe ? mix(uB1, uB0, vUv.y) : mix(uA1, uA0, vUv.y), 1.0); }`,
}));
backdrop.frustumCulled = false; backdrop.renderOrder = -1000;
scene.add(backdrop);
const post = makePost(renderer, scene, camera);
const D = VIEW_H / 2 / Math.tan((FOV / 2) * DEG);
camera.position.set(0, 0, D);

// every texture the page loads is counted, so a recording or a check can wait for all of them (window.accrochage.ready)
const texLoader = new THREE.TextureLoader(), every = { want: 0, got: 0 };
const loader = {
  load(url, onLoad, onProgress, onError) {
    every.want++;
    return texLoader.load(url, (t) => { every.got++; onLoad?.(t); }, onProgress, (e) => { every.got++; onError?.(e); });
  },
};
const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const prep = (t) => { t.anisotropy = aniso; t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
const loading = { want: 0, got: 0 };
function track(url, done) {
  loading.want++;
  loader.load(url, (t) => { loading.got++; done(prep(t)); }, undefined, () => loading.got++);
}
const pics = items.map((it) => {
  const info = images[it.id];
  return { it, aspect: info ? info.w / info.h : ratio(it.aspect), tex: prep(placeholder(info?.color, it.id)), full: false, color: info?.color };
});
// the first scene's pictures first, so it can open as soon as they are in
const first = new Set(listOf(seq[0]));
for (const k of [...first, ...pics.keys()].filter((k, i, a) => a.indexOf(k) === i)) {
  const p = pics[k];
  if (!images[p.it.id]) continue;
  if (first.has(k)) track(`img/${p.it.id}.webp`, (t) => { if (!p.full) p.tex = t; });
  else loader.load(`img/${p.it.id}.webp`, (t) => { if (!p.full) p.tex = prep(t); });
}
// textures of the scenery that layouts use themselves (the walnut of a crate), loaded once
const sceneTex = new Map();
const sceneTexture = (name) => {
  if (!sceneTex.has(name)) { const t = prep(new THREE.Texture()); sceneTex.set(name, t); loader.load(`scene/${name}.webp`, (img) => { t.image = img.image; t.needsUpdate = true; }); }
  return sceneTex.get(name);
};

// the layouts, each with its own pictures
const layouts = seq.map((s, li) => {
  // a scene's extra pictures (the tiles' looks): item numbers, or "mix" for a patchwork of all of them
  const k = listOf(s), looks = (s.looks || []).map((id) => (id === "mix" ? "mix" : index.get(id))).filter((x) => x != null);
  const firstLook = looks.find((x) => x !== "mix");
  const set = { n: k.length, k, items: k.map((i) => items[i]), aspect: k.map((i) => pics[i].aspect), colors: k.map((i) => pics[i].color), looks, lookAspect: firstLook != null ? pics[firstLook].aspect : null };
  const make = LAYOUTS[s.layout]?.[s.look];
  if (!make) throw new Error(`no layout ${s.layout} / ${s.look}`);
  const L = make(s, page, set);
  L.slotItems = L.slots || k;
  L.n = L.slotItems.length; L.index = li; L.phase = { e: 1, x: 0 }; L.cfg = s;
  return L;
});
function cardMesh(k, li, b, reflects, disc) {
  const mat = cardMaterial(pics[k].tex, page.card.back, page.card.radius, page.card.frame);
  mat.uniforms.uEdge.value.set(page.card.edge || "#f1eee7");
  const mesh = new THREE.Mesh(cardGeometry, mat);
  mesh.frustumCulled = false; mesh.visible = false;
  scene.add(mesh);
  let refl = null, dm = null;
  if (reflects) { refl = new THREE.Mesh(cardGeometry, reflectMaterial(mat)); refl.frustumCulled = false; refl.renderOrder = -1; refl.visible = false; scene.add(refl); }
  if (disc) { dm = new THREE.Mesh(discGeometry, discMaterial()); dm.frustumCulled = false; dm.visible = false; scene.add(dm); }
  return { mesh, mat, refl, disc: dm, k, li, b, pose: new Pose(), a: new Pose(), b2: new Pose(), r: new Pose(), pres: 0, hov: 0, spin: hash(k + b) * 6, sheet: null };
}
const sets = layouts.map((L, li) => L.slotItems.map((k, b) => cardMesh(k, li, b, !!L.floor, !!page.card.disc)));
const cards = sets.flat();
// where each picture is first shown: the scene and place the list takes you to
const where = items.map((_, k) => { for (const [li, s] of sets.entries()) { const c = s.find((c) => c.k === k); if (c) return { li, b: c.b }; } return null; });

const cam = { p: new THREE.Vector3(0, 0, D), at: new THREE.Vector3(), fov: FOV, dof: 0, q: new THREE.Quaternion() };
const ctx = { H: VIEW_H, W: 16, sw: 14, cx: 0, mobile: false, time: 0, dt: 0, utc: 0, vel: 0, D, tNow: 0, cam, jump: false, pointer: { x: 0, y: 0, live: false, at: -1e9, mouse: false } };
ctx.meanAspect = pics.reduce((a, p) => a + p.aspect, 0) / N;
// where the card in place b of scene li is right now, or null if it isn't showing; its picture; a scenery texture
ctx.cardPose = (li, b) => { const c = sets[li]?.[b]; return c && c.mesh.visible ? c.pose : null; };
ctx.picture = (li, b) => { const c = sets[li]?.[b]; return c ? pics[c.pose.img >= 0 ? c.pose.img : c.k] : null; };
ctx.sceneTex = sceneTexture;

const looks = seq.map((s) => ({ ink: s.ink, accent: css("--accent") || "#ff5a1f", font: css("--font-ui") || "system-ui", display: css("--font-display") || "serif", bg: s.bg }));
const groups = layouts.map((L, i) => { const g = new THREE.Group(); g.visible = false; scene.add(g); L.props?.build(g, ctx, looks[i]); return g; });
const sceneries = seq.map((s, i) => buildScene(s.scene, { scene, i, sizes: sceneSizes, track: i === 0 ? track : null, loader, prep, ctx, look: looks[i] }));
const tones = seq.map((s) => ({ a: new THREE.Color(s.bg[0]), b: new THREE.Color(s.bg[1]), ink: new THREE.Color(s.ink) }));

// The title is drawn into the scene, between the first layout's backdrop and its pictures, so the pictures can pass
// over it. It is set in the page's own type (the hidden h1 carries the styles and stays for screen readers).
const STRETCH = [[56, "ultra-condensed"], [68, "extra-condensed"], [81, "condensed"], [94, "semi-condensed"], [106, "normal"], [119, "semi-expanded"], [200, "expanded"]];
const title = (() => {
  const h1 = titleEl.querySelector("h1"), kp = titleEl.querySelector("p"), cs = getComputedStyle(h1), ks = getComputedStyle(kp);
  const px = 320, c = document.createElement("canvas"), g = c.getContext("2d");
  const text = cs.textTransform === "uppercase" ? page.title.toUpperCase() : page.title;
  const kick = `${page.kicker}  ·  ${page.count}`.toUpperCase();
  const setTitle = () => {
    g.font = `${cs.fontStyle} ${cs.fontWeight} ${px}px ${cs.fontFamily}`;
    g.fontStretch = STRETCH.find(([v]) => parseFloat(cs.fontStretch) <= v)?.[1] || "normal";
    g.letterSpacing = `${(parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize) || 0) * px}px`;
  };
  setTitle();
  const tw = g.measureText(text).width, W = Math.ceil(tw + px * 0.4), H = Math.ceil(px * 1.5);
  c.width = W; c.height = H;
  setTitle(); g.fillStyle = seq[0].ink; g.textAlign = "center"; g.textBaseline = "alphabetic";
  g.fillText(text, W / 2, px * 1.0);
  g.font = `${ks.fontWeight} ${px * 0.075}px ${ks.fontFamily}`; g.letterSpacing = `${px * 0.075 * 0.22}px`;
  g.fillText(kick, W / 2, px * 1.32);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = aniso;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
  m.renderOrder = -12; m.frustumCulled = false; scene.add(m);
  return { m, aspect: W / H };
})();
const bgA = new THREE.Color(), bgB = new THREE.Color(), bgMid = new THREE.Color(), ink = new THREE.Color();

// ── the timeline: each scene holds for its stretch of scroll, then the pictures change over ───────────────────────
const segs = [];
let TOTAL = 0;
layouts.forEach((L, i) => {
  segs.push({ hold: true, i, a: TOTAL, b: (TOTAL += L.hold) });
  if (i < layouts.length - 1) segs.push({ hold: false, i, a: TOTAL, b: (TOTAL += seq[i + 1].len ?? MORPH), kind: seq[i + 1].change || "reform" });
});
const segAt = (v) => segs.find((s) => v <= s.b) || segs.at(-1);
const holdOf = (i) => segs.find((s) => s.hold && s.i === i);
const active = (v) => { const s = segAt(v); return s.hold ? s.i : v - s.a < (s.b - s.a) / 2 ? s.i : s.i + 1; };

// ── the camera: each layout says where it looks from; between scenes the camera glides from one to the next ───────
const DEFAULT_VIEW = { p: [0, 0, D], at: [0, 0, 0], fov: FOV, dof: 0.1 };
const newView = () => ({ p: new THREE.Vector3(), at: new THREE.Vector3(), fov: 0, dof: 0 });
const _va = newView(), _vb = newView(), _vh = newView(), _vx = newView();
function viewOf(L, t, o) {
  const v = L.view?.(t, ctx) || DEFAULT_VIEW;
  o.p.set(...v.p); o.at.set(...v.at); o.fov = v.fov ?? FOV; o.dof = v.dof ?? 0.1;
  return o;
}
const UP = new THREE.Vector3(0, 1, 0);
function setCamera(a, b, e) {
  cam.p.lerpVectors(a.p, b.p, e); cam.at.lerpVectors(a.at, b.at, e);
  cam.fov = lerp(a.fov, b.fov, e); cam.dof = lerp(a.dof, b.dof, e);
  camera.position.copy(cam.p); camera.up.copy(UP); camera.lookAt(cam.at);
  cam.q.copy(camera.quaternion);
  if (Math.abs(camera.fov - cam.fov) > 1e-4) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();
}
// a point dist in front of the camera, at screen position (sx, sy), each −1…1
ctx.inFront = (dist, sx, sy, out) => {
  const hh = dist * Math.tan((cam.fov / 2) * DEG), hw = hh * camera.aspect;
  return out.set(sx * hw, sy * hh, -dist).applyQuaternion(cam.q).add(cam.p);
};
ctx.halfH = (dist) => dist * Math.tan((cam.fov / 2) * DEG);

// ── the changes ──────────────────────────────────────────────────────────────────────────────────────────────────
// Where each card of a layout is at t, seen through its own camera: on screen or not, and where.
const _pp = new Pose(), _pv = new THREE.Vector3();
function placesOf(L, t, li) {
  setCamera(viewOf(L, t, _vx), _vx, 0); L.prepare?.(t, ctx);
  return sets[li].map((c, b) => {
    L.pose(b, t, ctx, _pp.reset());
    const inFront = _pv.copy(_pp.p).applyMatrix4(camera.matrixWorldInverse).z < -0.5;
    _pv.copy(_pp.p).project(camera);
    const on = inFront && _pp.w > 0.05 && _pp.h > 0.05 && Math.abs(_pv.x) < 1.15 && Math.abs(_pv.y) < 1.15;
    return { b, k: c.k, on, x: inFront ? _pv.x : 10 * Math.sign(_pp.p.x || 1), y: _pv.y, z: _pp.p.z + (Math.cos(_pp.theta) >= 0 ? 0.001 : -0.001) };
  });
}
// A re-form: each card of the next scene that is on screen takes the nearest card on screen in this one showing the
// same picture, and flies from there; they go one after another from left to right.
function matchMap(i) {
  const pa = placesOf(layouts[i], 1, i), pb = placesOf(layouts[i + 1], 0, i + 1);
  const used = new Set(), aOf = new Map();
  for (const q of pb) {
    if (!q.on) continue;
    let best = null, bd = Infinity;
    for (const p of pa) if (p.on && !used.has(p.b) && p.k === q.k) { const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2; if (d < bd) { bd = d; best = p; } }
    if (best) { used.add(best.b); aOf.set(q.b, best.b); }
  }
  const order = [...aOf.keys()].sort((u, v) => pa[aOf.get(u)].x - pa[aOf.get(v)].x), rank = new Map(order.map((b, r) => [b, order.length > 1 ? r / (order.length - 1) : 0]));
  return { aOf, taken: used, rank };
}
// The fan: which arch slot each card rises to. The k-th from the left in one scene takes the k-th slot, and so does
// the k-th from the left in the next, spread over the slots, so no two paths cross. Stacks go one at a time.
function fanMap(i) {
  const A = layouts[i], B = layouts[i + 1];
  const pa = placesOf(A, 1, i).filter((p) => p.on).sort((u, v) => u.x - v.x || v.z - u.z);
  const pb = placesOf(B, 0, i + 1).filter((p) => p.on).sort((u, v) => u.x - v.x || u.z - v.z);
  const n = Math.max(pa.length, pb.length, 1), slot = (r, len) => (len > 1 ? Math.round((r * (n - 1)) / (len - 1)) : Math.floor((n - 1) / 2));
  const turns = (L, places, leaving) => {
    const out = new Map(), m = Math.max(1, places.length - 1);
    if (L.stack) [...places].sort((u, v) => (leaving ? v.z - u.z : u.z - v.z)).forEach((p, r) => out.set(p.b, r / m));
    else places.forEach((p, r) => out.set(p.b, r / m));
    return out;
  };
  const a = new Map(pa.map((p, r) => [p.b, slot(r, pa.length)])), b = new Map(pb.map((p, r) => [p.b, slot(r, pb.length)]));
  return { a, b, n, leave: turns(A, pa, true), land: turns(B, pb, false) };
}
const plans = [];

const space = $(".a-space");
const _tc = new THREE.PerspectiveCamera();
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  post.setSize(w, h, renderer.getPixelRatio());
  camera.aspect = w / h; camera.updateProjectionMatrix();
  ctx.mobile = w < 760;
  ctx.W = (VIEW_H * w) / h;
  ctx.sw = ctx.W - (ctx.mobile ? 0.5 : 1.0);
  layouts.forEach((L) => L.setup?.(ctx));
  for (let i = 0; i + 1 < layouts.length; i++) {
    const kind = seq[i + 1].change || "reform";
    plans[i] = kind === "fan" ? fanMap(i) : kind === "fold" ? null : matchMap(i);
  }
  // the title: where the first layout says, or just behind the middle of what its camera looks at
  const v0 = viewOf(layouts[0], 0, _vh), at = layouts[0].titleAt?.(ctx);
  if (at) { title.m.position.copy(at.p); title.m.quaternion.copy(at.q); title.m.scale.set(at.w, at.w / title.aspect, 1); }
  else {
    _tc.position.copy(v0.p); _tc.up.set(0, 1, 0); _tc.lookAt(v0.at);
    const d = v0.p.distanceTo(v0.at) + 2.5, hw = d * Math.tan((v0.fov / 2) * DEG) * (w / h), tw = Math.min(hw * 2 * 0.9, d * Math.tan((v0.fov / 2) * DEG) * 2 * title.aspect * 0.42);
    title.m.position.set(0, 0, -d).applyQuaternion(_tc.quaternion).add(v0.p); title.m.quaternion.copy(_tc.quaternion); title.m.scale.set(tw, tw / title.aspect, 1);
  }
  // the scenery stands where each layout's camera looks from halfway through its stretch
  sceneries.forEach((sc, i) => {
    const v = viewOf(layouts[i], 0.5, _vh);
    _tc.position.copy(v.p); _tc.up.set(0, 1, 0); _tc.lookAt(v.at);
    sc.place({ p: v.p.clone(), q: _tc.quaternion.clone(), fov: v.fov, aspect: w / h }, layouts[i].surface?.(ctx));
  });
  space.style.height = `${(TOTAL + 1) * h}px`;
}
resize();
addEventListener("resize", resize);

// ── poses ────────────────────────────────────────────────────────────────────────────────────────────────────────
const radiusOf = (p) => (p.radius < 0 ? page.card.radius : p.radius);
// what a card is made of, where its layout leaves it to the page: thickness, gloss, grain, edge tint and material
const CARD = { thick: page.card.thick ?? 0.03, gloss: page.card.gloss ?? 0.1, grain: page.card.grain ?? 0.5, edgeTint: page.card.edgeTint ?? 0, mat: page.card.mat ?? 0 };
const MATS = Object.keys(CARD);
const resolve = (p) => { for (const f of MATS) if (p[f] < 0) p[f] = CARD[f]; return p; };
const bent = (p) => p.pivot !== 0.5 && (Math.abs(p.theta) > 1e-4 || Math.abs(p.k) > 1e-4);
const shapeOf = (p) => { if (p.face <= 0 && p.h > 1e-4) p.face = p.w / p.h; if (p.faceB <= 0 && p.h > 1e-4) p.faceB = p.w / p.h; };
// a card part of the way from pose a to pose b, bowing a little toward you. e is how far it has travelled, r how far
// it has turned (and, for a page, changed shape): cards spread out before they turn, and turn before they close in.
// With middles ca, cb (a reshape) it swings round the moving middle instead of flying straight.
const TURNING = new Set(["theta", "k", "twist", "pivot"]);
const _toCam = new THREE.Vector3(), _da = new THREE.Vector3(), _db = new THREE.Vector3(), _mid = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qe = new THREE.Quaternion();
function blend(a, b, e, o, r = e, bow = 0.6, ca = null, cb = null) {
  const side = bent(a) ? a.side : b.side, ra = radiusOf(a), rb = radiusOf(b), sphere = a.sphere || b.sphere;
  shapeOf(a); shapeOf(b); resolve(a); resolve(b);
  if (ca) {
    _da.copy(a.p).sub(ca); _db.copy(b.p).sub(cb);
    const la = _da.length(), lb = _db.length();
    _mid.lerpVectors(ca, cb, e);
    if (la < 1e-3 || lb < 1e-3) o.p.lerpVectors(a.p, b.p, e);
    else { _qa.setFromUnitVectors(_da.normalize(), _db.normalize()); _qe.identity().slerp(_qa, e); o.p.copy(_da).applyQuaternion(_qe).multiplyScalar(lerp(la, lb, e)).add(_mid); }
  } else o.p.lerpVectors(a.p, b.p, e);
  if (bow) o.p.addScaledVector(_toCam.copy(cam.p).sub(o.p).normalize(), Math.sin(Math.PI * e) * bow);
  o.q.slerpQuaternions(a.q, b.q, r);
  for (const f of NUM) o[f] = lerp(a[f], b[f], TURNING.has(f) ? r : e);
  o.radius = lerp(ra, rb, e); o.side = side; o.sphere = sphere; o.twoSided = e < 0.5 ? a.twoSided : b.twoSided; o.clip = b.clip;
  o.img = e < 0.5 ? a.img : b.img; o.imgB = e < 0.5 ? a.imgB : b.imgB;
  o.disc *= Math.cos(Math.PI * e) ** 2;                                   // a record tucks back into its sleeve while it flies
  return o;
}
const _fq = new THREE.Quaternion(), ZAXIS = new THREE.Vector3(0, 0, 1);
// the arch of the fan: a wide arc in front of you, its circle's centre below the view
function archPose(r, n, o) {
  o.reset();
  const dist = 6, hh = ctx.halfH(dist), hw = hh * camera.aspect, R = hh * 1.45, cy = -hh * 1.2;   // nearer than any layout comes
  const span = Math.min(1.05, Math.asin(Math.min(1, (hw * 0.86) / R))), step = n > 1 ? (2 * span) / (n - 1) : 0;
  const h = Math.min(hh * 0.56, n > 1 ? (step * R) / 1.32 / ctx.meanAspect : hh * 0.56), a = (r - (n - 1) / 2) * step;
  o.p.set(R * Math.sin(a), cy + R * Math.cos(a), -dist + r * 0.012).applyQuaternion(cam.q).add(cam.p);
  o.q.copy(cam.q).multiply(_fq.setFromAxisAngle(ZAXIS, -a));
  o.h = h; o.w = h * ctx.meanAspect; o.shade = 0.12;                       // flat cards turned along the arch
  return o;
}
let camE = 0;
const hide = (c) => { c.pose.reset(); c.pose.w = c.pose.h = 0; };
const weights = layouts.map(() => 0), presence = layouts.map(() => 0), ts = layouts.map(() => 0), wipes = layouts.map(() => [0, 1]), floors = layouts.map(() => null);

// a change through the fan: the old pictures rise into the arch and turn over; halfway round, edge-on to you, each
// hands over to the picture of the next scene that takes its slot, which turns on round and flies into place
function fan(i, m) {
  const A = layouts[i], B = layouts[i + 1], map = plans[i], n = map.n;
  setCamera(_va, _va, 0); A.prepare?.(1, ctx); for (const c of sets[i]) A.pose(c.b, 1, ctx, c.a.reset());
  setCamera(_vb, _vb, 0); B.prepare?.(0, ctx); for (const c of sets[i + 1]) B.pose(c.b, 0, ctx, c.b2.reset());
  setCamera(_va, _vb, camE);
  const L1 = 0.16, L3 = 0.16, ripple = (r) => smooth(0.38 + (0.12 * r) / Math.max(1, n - 1), 0.5 + (0.12 * r) / Math.max(1, n - 1), m);
  for (const c of sets[i]) {
    const r = map.a.get(c.b);
    if (r == null) { hide(c); continue; }
    const turn = ripple(r);
    if (turn >= 0.5) { hide(c); continue; }
    archPose(r, n, c.r);
    const u1 = clamp((m - L1 * map.leave.get(c.b)) / (0.45 - L1));
    if (u1 < 1) blend(c.a, c.r, ease(u1), c.pose, ease(clamp((u1 - 0.3) / 0.7))); else c.pose.copy(c.r);
    c.pose.flip = turn;
  }
  for (const c of sets[i + 1]) {
    const r = map.b.get(c.b);
    if (r == null) { c.pose.copy(c.b2); if (m < 0.9) hide(c); continue; }
    const turn = ripple(r);
    if (turn < 0.5) { hide(c); continue; }
    archPose(r, n, c.r);
    const u3 = clamp((m - 0.55 - L3 * map.land.get(c.b)) / (0.45 - L3));
    if (u3 > 0) blend(c.r, c.b2, ease(u3), c.pose, ease(clamp(u3 / 0.65))); else c.pose.copy(c.r);
    c.pose.flip = turn - 1;                                               // −½ → 0: the rest of the turn, its face coming round
  }
  presence[i] = 1 - smooth(0.05, 0.4, m); presence[i + 1] = smooth(0.6, 0.95, m);
  ts[i] = 1; ts[i + 1] = 0;
  A.phase.e = 1; A.phase.x = smooth(0, 0.5, m); B.phase.e = smooth(0.5, 1, m); B.phase.x = 0;
  const fa = A.floor?.(1, ctx), fb = B.floor?.(0, ctx);
  floors[i] = fa && { ...fa, s: fa.s * (1 - smooth(0, 0.4, m)) }; floors[i + 1] = fb && { ...fb, s: fb.s * smooth(0.6, 1, m) };
}
// a re-form (or reshape, or dive): the cards both scenes share fly from one place to the other, the rest leave and
// arrive their own layout's way
function reform(i, m, kind) {
  const A = layouts[i], B = layouts[i + 1], map = plans[i], together = kind !== "reform";
  const XL = A.exitLen ?? 0.55, EL = B.enterLen ?? 0.55;
  const x = clamp(m / XL), e = clamp((m - (1 - EL)) / EL);
  // the next scene's own things (a crate, a player) arrive early, so the pictures land in them rather than they round the pictures
  A.phase.e = 1; A.phase.x = x; B.phase.e = smooth(0.02, 0.5, m); B.phase.x = 0;
  ts[i] = 1; ts[i + 1] = 0;
  setCamera(_va, _va, 0); A.prepare?.(1, ctx);
  const ca = together ? A.pivot?.(1, ctx) : null;
  for (const c of sets[i]) {
    A.pose(c.b, 1, ctx, c.a.reset());
    if (map.taken.has(c.b)) { hide(c); continue; }                      // it flies as the next scene's card
    c.pose.copy(c.a);
    if (x >= 1) { hide(c); continue; }
    if (A.exit) A.exit(c.b, x, ctx, c.pose); else { c.pose.w *= 1 - x; c.pose.h *= 1 - x; }
  }
  setCamera(_vb, _vb, 0); B.prepare?.(0, ctx);
  const cb = together ? B.pivot?.(0, ctx) : null;
  for (const c of sets[i + 1]) {
    B.pose(c.b, 0, ctx, c.b2.reset());
    if (map.aOf.has(c.b)) continue;
    c.pose.copy(c.b2);
    if (e <= 0) { hide(c); continue; }
    if (B.enter) B.enter(c.b, e, ctx, c.pose); else { c.pose.w *= e; c.pose.h *= e; }
  }
  setCamera(_va, _vb, camE);
  const spread = together ? 0.14 : 0.4, from = 0.06, len = 0.88, arc = B.flyArc?.(ctx);
  for (const [b, a] of map.aOf) {
    const c = sets[i + 1][b], u = clamp((m - from - spread * len * map.rank.get(b)) / (len * (1 - spread)));
    blend(sets[i][a].a, c.b2, ease(u), c.pose, ease(clamp((u - 0.12) / 0.88)), together ? 0 : 0.6, ca && cb ? ca : null, cb);
    if (arc) c.pose.p.addScaledVector(arc, Math.sin(Math.PI * ease(u)));   // up and over, and down into place
  }
  presence[i] = 1 - smooth(0.2, 0.85, x); presence[i + 1] = smooth(0.02, 0.45, m);
  const fa = A.floor?.(1, ctx), fb = B.floor?.(0, ctx);
  floors[i] = fa && { ...fa, s: fa.s * (1 - x) }; floors[i + 1] = fb && { ...fb, s: fb.s * e };
}
// the fold: the tiles fold into the next scene's closed book, which takes over as the packet lands on its cover
const _cover = new Pose();
function fold(i, m) {
  const A = layouts[i], B = layouts[i + 1], landed = m >= 0.88;
  setCamera(_vb, _vb, 0); B.cover(ctx, _cover.reset());
  setCamera(_va, _va, 0); A.prepare?.(1, ctx);
  for (const c of sets[i]) {
    if (landed) { hide(c); continue; }
    A.pose(c.b, 1, ctx, c.pose.reset()); A.fold(c.b, m, ctx, c.pose, _cover);
  }
  setCamera(_vb, _vb, 0); B.prepare?.(0, ctx);
  for (const c of sets[i + 1]) { if (!landed) { hide(c); continue; } B.pose(c.b, 0, ctx, c.pose.reset()); }
  setCamera(_va, _vb, camE);
  A.phase.e = 1; A.phase.x = m; B.phase.e = 1; B.phase.x = 0;
  ts[i] = 1; ts[i + 1] = 0;
  presence[i] = 1 - smooth(0, 0.35, m); presence[i + 1] = smooth(0.7, 1, m);
}

// the deck the page opens on: face down, a little in front of you
const _dq = new THREE.Quaternion();
function deckPose(k, o) {
  o.reset();
  const dist = 9, hh = ctx.halfH(dist), h = hh * 0.56, breathe = 0.04 * Math.sin(ctx.time * 1.6);
  o.p.set((hash(k + 4) - 0.5) * 0.08, -hh * 0.08 + k * 0.006 + breathe, -dist + k * 0.014).applyQuaternion(cam.q).add(cam.p);
  o.q.copy(cam.q).multiply(_dq.setFromAxisAngle(ZAXIS, (hash(k + 9) - 0.5) * 0.09));
  o.h = h; o.w = h * ctx.meanAspect; o.flip = 1; o.shade = 0.1;
  return o;
}

// the picture brought forward: big, a little left of the middle, its details beside it; a record slides out of its sleeve
const present = new Pose();
function presentPose(aspect, o) {
  o.reset();
  const dist = 5.6, hh = ctx.halfH(dist), hw = hh * camera.aspect, disc = page.card.disc ? 1 : 0;
  let h = hh * 2 * (ctx.mobile ? 0.5 - disc * 0.08 : 0.8 - disc * 0.16), w = h * aspect;
  const maxW = hw * 2 * (ctx.mobile ? 0.88 : 0.5);
  if (w > maxW) { w = maxW; h = w / aspect; }
  ctx.inFront(dist, ctx.mobile ? -0.12 * disc : -0.28 - 0.16 * disc, ctx.mobile ? 0.3 : 0.02, o.p);
  o.q.copy(cam.q);
  o.w = w; o.h = h; o.disc = disc * 0.4;
  return o;
}

const _v = new THREE.Vector3(), _c = new THREE.Vector3(), _c2 = new THREE.Vector3(), _qf = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _pf = new THREE.Vector3(), _dn = new THREE.Vector3();
const YAXIS = new THREE.Vector3(0, 1, 0);
const vars = {};
const setVar = (k, v) => { if (vars[k] !== v) root.style.setProperty(k, (vars[k] = v)); };

function apply(c, o, glow, floor) {
  const U = c.mat.uniforms;
  const fk = o.img >= 0 ? o.img : c.k, front = pics[fk];
  const bk = o.imgB >= 0 ? o.imgB : o.twoSided ? fk : -1, back = bk >= 0 ? pics[bk] : null;
  // turning over: a half turn about the card's own upright middle, so it stays where it is
  let p = o.p, q = o.q;
  if (Math.abs(o.flip) > 1e-4) {
    _c.set((0.5 - o.pivot) * o.w * Math.cos(o.theta), 0, o.side * (0.5 - o.pivot) * o.w * Math.sin(o.theta));
    _qr.setFromAxisAngle(YAXIS, Math.PI * o.flip);
    _pf.copy(_c).sub(_c2.copy(_c).applyQuaternion(_qr)).applyQuaternion(o.q).add(o.p);
    _qf.copy(o.q).multiply(_qr);
    p = _pf; q = _qf;
  }
  const vis = !!front && o.w > 0.003 && o.h > 0.003;
  c.mesh.visible = vis;
  if (vis) {
    c.mesh.position.copy(p); c.mesh.quaternion.copy(q);
    U.uMap.value = front.tex; U.uImgAspect.value = front.aspect;
    U.uBackImage.value = back ? 1 : 0;
    if (back) { U.uMapB.value = back.tex; U.uImgAspectB.value = back.aspect; }
    U.uSub.value.set(o.sx, o.sy, o.sw, o.sh); U.uFace.value = o.face;
    // a two-sided card with nothing else on its back shows the same part of the same picture there
    if (o.imgB < 0 && o.twoSided) { U.uSubB.value.set(o.sx, o.sy, o.sw, o.sh); U.uFaceB.value = o.face; }
    else { U.uSubB.value.set(o.bx, o.by, o.bw, o.bh); U.uFaceB.value = o.faceB; }
    U.uSize.value.set(o.w, o.h); U.uPivot.value = o.pivot; U.uSide.value = o.side;
    U.uTheta.value = o.theta; U.uK.value = o.k; U.uTwist.value = o.twist; U.uLift.value = o.lift * Math.cos(Math.PI * o.flip);
    U.uSphere.value = o.sphere ? 1 : 0; U.uRing.value = o.ring; U.uClip.value = o.clip;
    U.uShade.value = o.shade; U.uSheen.value = o.sheen; U.uSheenPow.value = o.sheenPow;
    U.uFog.value = o.fog; U.uFogNear.value = o.fogNear; U.uFogFar.value = o.fogFar;
    U.uGutter.value = o.gutter; U.uDeckle.value = o.deckle; U.uShadow.value.set(o.shadowAt, o.shadow);
    U.uDim.value = o.dim; U.uRadius.value = radiusOf(o); U.uGlow.value = glow; U.uBlur.value = c.pres > 0.02 ? 0 : o.blur;
    resolve(o);
    U.uThick.value = o.thick; U.uGloss.value = o.gloss; U.uGrain.value = o.grain; U.uEdgeTint.value = o.edgeTint; U.uMat.value = o.mat;
    // a card that hangs like cloth: its sheet is simulated in its own frame while it shows
    if (o.cloth > 0.01) {
      c.sheet ||= new Sheet(clothLinear);
      c.sheet.step(o.w, o.h, p, q, frameDt, ctx.time);
      U.uCloth.value = o.cloth; U.uClothMap.value = c.sheet.map;
    } else { U.uCloth.value = 0; c.sheet?.reset(); }
    U.uBg.value.copy(bgMid); U.uFogColor.value.copy(bgMid);
    U.uFocus.value = cam.p.distanceTo(cam.at); U.uDof.value = c.pres > 0.02 ? 0 : cam.dof;
  }
  if (c.refl) {
    const on = vis && floor && floor.s > 0.005 && c.pres < 0.02;
    c.refl.visible = !!on;
    if (on) {
      c.refl.position.copy(p); c.refl.quaternion.copy(q);
      const R = c.refl.material.uniforms;
      R.uFloor.value = floor.y; R.uRefl.value = floor.s; R.uReflFade.value = floor.f;
    }
  }
  if (c.disc) {
    // the record, slid out of its sleeve along discDir by o.disc of the cover; only from the front
    _dn.set(0, 0, 1).applyQuaternion(q);
    const on = vis && o.disc > 0.004 && Math.abs(o.flip) < 1e-3 && Math.abs(o.k) < 1e-3 && _dn.dot(_v.copy(camera.position).sub(p)) > 0;
    c.disc.visible = on;
    if (on) {
      const s = Math.min(o.w, o.h) * 0.96, DU = c.disc.material.uniforms;
      c.disc.position.set(Math.cos(o.discDir) * o.disc * o.w, Math.sin(o.discDir) * o.disc * o.h, -0.012).applyQuaternion(q).add(p);
      c.disc.quaternion.copy(q); c.disc.scale.set(s, s, 1);
      DU.uMap.value = front.tex; DU.uSpin.value = c.spin; DU.uDim.value = o.dim; DU.uBg.value.copy(bgMid);
    }
  }
}

// ── picking: each card's flat outline on screen, nearest first ─────────────────────────────────────────────────────
const quad = [0, 1, 2, 3].map(() => new THREE.Vector3()), _n = new THREE.Vector3();
function inside(x, y) {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i], b = quad[(i + 1) % 4], c = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (c === 0) continue;
    if (!s) s = Math.sign(c); else if (Math.sign(c) !== s) return false;
  }
  return true;
}
function pick(e) {
  const seg = segAt(state.v);
  if (!seg.hold || state.intro < 1) return null;
  const rect = canvas.getBoundingClientRect(), x = ((e.clientX - rect.left) / rect.width) * 2 - 1, y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  let best = null, bestZ = Infinity;
  for (const c of sets[seg.i]) {
    const o = c.pose;
    if (!c.mesh.visible || o.w < 0.05 || (o.theta > 0.08 && o.theta < Math.PI - 0.08)) continue;
    if (Math.abs(o.flip % 1) > 0.1 && Math.abs(o.flip % 1) < 0.9) continue;
    _n.set(0, 0, Math.cos(o.theta) >= 0 ? 1 : -1).applyQuaternion(o.q);
    if (!o.twoSided && Math.round(o.flip) % 2 === 0 && _n.dot(_c.copy(camera.position).sub(o.p)) <= 0) continue;
    const x0 = -o.pivot * o.w, x1 = (1 - o.pivot) * o.w;
    [[x0, -o.h / 2], [x1, -o.h / 2], [x1, o.h / 2], [x0, o.h / 2]].forEach(([qx, qy], j) => quad[j].set(qx, qy, 0).applyQuaternion(o.q).add(o.p).project(camera));
    if (quad.some((q) => q.z > 1)) continue;
    if (inside(x, y)) { const z = (quad[0].z + quad[2].z) / 2; if (z < bestZ) { bestZ = z; best = c; } }
  }
  return best;
}
const shownItem = (c) => (c.pose.img >= 0 ? c.pose.img : c.k);

// ── selecting ────────────────────────────────────────────────────────────────────────────────────────────────────
const state = { v: 0, sel: -1, selCard: null, mode: "", hover: null, listHover: -1, dim: 0, selAt: 0, auto: 0, intro: 0, introAt: 0, panel: 0 };
// the 1800 px picture, once it is opened (images.json "full": false when a page ships only the 900 px one)
function loadFull(k) {
  const p = pics[k];
  if (p.full || !images[p.it.id] || images[p.it.id].full === false) return;
  p.full = true;
  loader.load(`img/${p.it.id}-full.webp`, (t) => (p.tex = prep(t)));
}
function expand(k) {
  entries.forEach((li) => li.classList.toggle("on", +li.dataset.i === k));
  if (k < 0) return;
  const li = entryOf.get(k), top = li.offsetTop, bottom = top + li.offsetHeight + 160;
  if (top < list.scrollTop + 30 || bottom > list.scrollTop + list.clientHeight) list.scrollTo({ top: Math.max(0, top - list.clientHeight * 0.3), behavior: "smooth" });
}
function caption(k) {
  if (k < 0) { capEl.classList.remove("on"); return; }
  const it = items[k];
  capEl.innerHTML = `<span class="n"><b>${pad(k + 1)}</b> / ${pad(N)}</span><h2>${esc(it.title)}</h2>${it.sub ? `<p class="s">${esc(it.sub)}</p>` : ""}${details(it)}<span class="x">Close</span>`;
  capEl.classList.add("on");
}
function select(k, mode, card = null) {
  state.sel = k; state.mode = mode; state.selCard = card; state.selAt = scrollY / innerHeight;
  expand(k);
  caption(mode === "present" ? k : -1);
  if (mode === "present") loadFull(k);
}
function clear() { state.sel = -1; state.mode = ""; state.selCard = null; expand(-1); caption(-1); layouts.forEach((L) => L.unfocus?.()); }
// go where a scroll position is: a glide when it is near, a cut when it is more than one scene away
function goTo(v, li) {
  state.auto = performance.now();
  scrollTo({ top: v * innerHeight, behavior: "instant" });
  if (Math.abs(li - active(state.v)) > 1) state.v = v;
}
// bring picture k into view: go to the scene it is in (this one if it is here), then turn, scroll or flip it to it
function focusTo(k, mode = "focus") {
  const here = active(state.v), inHere = sets[here].find((c) => c.k === k);
  const { li, b } = inHere ? { li: here, b: inHere.b } : where[k], L = layouts[li], hold = holdOf(li), still = here === li && segAt(state.v).hold;
  ctx.tNow = still ? ctx.tNow : 0.02;
  const f = L.focus?.(b, ctx);
  const v = f && f.t != null ? hold.a + f.t * (hold.b - hold.a) : still ? null : hold.a + 0.02 * (hold.b - hold.a);
  if (f?.spin && L.spin) L.spin.target = f.spin;
  if (v != null) goTo(v, li);
  select(k, mode, sets[li][b]);
  state.selAt = v ?? scrollY / innerHeight;
}
function openList(on) {
  list.classList.toggle("open", on); indexBtn.setAttribute("aria-expanded", on);
  document.body.classList.toggle("list-open", on);
}

list.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const k = +btn.closest("li[data-i]").dataset.i;
  if (state.sel === k) clear(); else focusTo(k);
  if (ctx.mobile) openList(false);
});
list.addEventListener("pointerover", (e) => { const li = e.target.closest("li[data-i]"); state.listHover = li && e.pointerType === "mouse" ? +li.dataset.i : -1; });
list.addEventListener("pointerleave", () => (state.listHover = -1));
indexBtn.addEventListener("click", () => openList(!list.classList.contains("open")));
capEl.addEventListener("click", () => clear());
addEventListener("keydown", (e) => {
  if (e.key === "Escape") { if (state.sel >= 0) clear(); else openList(false); }
  if (e.key === "i" && !e.metaKey && !e.ctrlKey) openList(!list.classList.contains("open"));
  if (state.sel >= 0 && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
    e.preventDefault();
    focusTo((state.sel + (e.key === "ArrowRight" ? 1 : N - 1)) % N, state.mode);
  }
});
addEventListener("scroll", () => {
  if (state.sel >= 0 && performance.now() - state.auto > 900 && Math.abs(scrollY / innerHeight - state.selAt) > 0.4) clear();
}, { passive: true });

// the switches a layout offers while it is on screen (the sweep's corners, size and flow)
let switchesOf = -1;
function showSwitches(li) {
  if (li === switchesOf) return;
  switchesOf = li;
  const L = layouts[li];
  if (!L.controls) { switchEl.hidden = true; switchEl.innerHTML = ""; return; }
  switchEl.innerHTML = L.controls.map(([key, on, off]) => `<button type="button" data-k="${key}" aria-pressed="${!!L.switches[key]}"><span>${esc(on)}</span><span>${esc(off)}</span></button>`).join("");
  switchEl.hidden = false;
}
switchEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-k]"), L = layouts[switchesOf];
  if (!btn || !L?.switches) return;
  L.switches[btn.dataset.k] = !L.switches[btn.dataset.k];
  btn.setAttribute("aria-pressed", L.switches[btn.dataset.k]);
});

// dragging turns the turnable layouts, and elsewhere scrubs the scroll sideways; a click picks; the cursor leads the trail
let drag = null;
canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, id: e.pointerId }; });
addEventListener("pointermove", (e) => {
  const P = ctx.pointer;
  P.x = (e.clientX / innerWidth) * 2 - 1; P.y = -(e.clientY / innerHeight) * 2 + 1; P.at = performance.now(); P.mouse = e.pointerType === "mouse";
  if (drag && e.pointerId === drag.id) {
    const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
    drag.lx = e.clientX; drag.ly = e.clientY;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) { drag.moved = true; canvas.setPointerCapture?.(e.pointerId); }
    if (drag.moved) {
      const L = layouts[active(state.v)];
      if (L.turnable && segAt(state.v).hold) { L.spin.target = null; L.spin.yaw += dx * 0.005; L.spin.pitch = clamp(L.spin.pitch + dy * 0.004, -1.2, 1.2); }
      else if (!L.follows) scrollBy(0, -dx * 2.2);
    }
    return;
  }
  if (e.pointerType !== "mouse") return;
  const c = e.target === canvas ? pick(e) : null;
  state.hover = c;
  canvas.style.cursor = c ? "pointer" : "";
  tipEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
});
addEventListener("pointerup", (e) => {
  if (drag && !drag.moved && e.target === canvas) {
    const c = pick(e);
    if (!c) clear();
    else if (state.selCard === c && state.mode === "present") clear();
    else select(shownItem(c), "present", c);
  }
  drag = null;
});
document.addEventListener("pointerleave", () => { state.hover = null; ctx.pointer.at = -1e9; });

// ── every frame ──────────────────────────────────────────────────────────────────────────────────────────────────
let last = performance.now(), anim = 0, lastOn = -1, born = performance.now(), tipFor = null, frameDt = 0, featFor = -1;
const _fp = new THREE.Vector3();
function frame(now, jump = false) {
  const dt = jump ? 1 : Math.min(0.05, (now - last) / 1000);
  last = now; frameDt = jump ? 0 : dt;
  const target = scrollY / innerHeight, prev = state.v;
  state.v = jump ? target : state.v + (target - state.v) * fade(6, dt);
  if (Math.abs(target - state.v) < 2e-4) state.v = target;
  ctx.vel = lerp(ctx.vel, (state.v - prev) / Math.max(dt, 1e-3), 0.12);
  if (state.sel < 0 && state.listHover < 0 && !reduced) anim += dt;
  ctx.time = anim; ctx.dt = state.sel < 0 ? dt : 0; ctx.jump = jump;
  ctx.utc = (Date.now() / 3.6e6) % 24;
  ctx.pointer.live = ctx.pointer.mouse && now - ctx.pointer.at < 2500 && !list.classList.contains("open");

  // the opening: a counter while the first pictures load, then the deck is dealt or the first scene comes in its own
  // way (skipped if you arrive mid-page)
  const loaded = loading.want ? loading.got / loading.want : 1;
  loadEl.firstChild.textContent = String(Math.round(Math.min(loaded, (now - born) / 900) * 100)).padStart(3, "0");
  if (!state.introAt && loaded >= 1 && now - born > 900) state.introAt = now;
  if (state.introAt) state.intro = Math.min(1, state.intro + (jump ? 1 : dt / (reduced ? 0.2 : page.open === "deal" ? 1.7 : 2.2)));
  if (state.v > 0.3) state.intro = 1;
  loadEl.classList.toggle("done", !!state.introAt);
  document.body.classList.toggle("ready", !!state.introAt);

  const seg = segAt(state.v);
  for (const c of cards) hide(c);
  weights.fill(0); presence.fill(0); floors.fill(null);
  let m = 0;
  if (seg.hold) {
    const i = seg.i, L = layouts[i], t = clamp((state.v - seg.a) / (seg.b - seg.a)), intro = i === 0 && state.intro < 1;
    ctx.tNow = t; weights[i] = presence[i] = 1; ts[i] = t; wipes[i] = [0, 1];
    L.phase.e = intro && page.open !== "deal" ? state.intro : 1; L.phase.x = 0;
    setCamera(viewOf(L, t, _va), _va, 0);
    L.prepare?.(t, ctx);
    for (const c of sets[i]) L.pose(c.b, t, ctx, c.pose.reset());
    if (intro && page.open === "deal") sets[i].forEach((c, s) => {
      const u = clamp((state.intro - 0.06 * (L.n - 1 - s)) / (1 - 0.06 * (L.n - 1)));
      deckPose(s, c.a); c.b2.copy(c.pose);
      blend(c.a, c.b2, ease(u), c.pose, ease(clamp((u - 0.15) / 0.85)));
      c.pose.flip = 1 - smooth(0.25, 0.75, u);
    });
    else if (intro && L.enter) for (const c of sets[i]) L.enter(c.b, state.intro, ctx, c.pose);
    floors[i] = L.floor?.(t, ctx) || null;
  } else {
    const i = seg.i, A = layouts[i], B = layouts[i + 1];
    m = clamp((state.v - seg.a) / (seg.b - seg.a));
    weights[i] = 1 - ease(m); weights[i + 1] = ease(m);
    camE = ease(smooth(seg.kind === "dive" ? 0.05 : 0.15, seg.kind === "dive" ? 0.95 : 0.85, m));
    viewOf(A, 1, _va); viewOf(B, 0, _vb);
    if (seg.kind === "dive") _va.p.lerp(_va.at, 0.35 * smooth(0, 0.5, m));   // the camera pushes on in through the old scene
    if (seg.kind === "fan") fan(i, m); else if (seg.kind === "fold") fold(i, m); else reform(i, m, seg.kind);
    setCamera(_va, _vb, camE);
  }

  // the list folded out pushes the view over to make room
  state.panel += ((list.classList.contains("open") && !ctx.mobile ? 1 : 0) - state.panel) * fade(8, dt);
  const shift = state.panel * Math.min(340, innerWidth * 0.26) * 0.5;
  if (shift > 0.5) camera.setViewOffset(innerWidth, innerHeight, -shift, 0, innerWidth, innerHeight); else camera.clearViewOffset();

  // the turnable layouts ease toward a picture someone asked for
  for (const L of layouts) if (L.spin?.target) {
    const s = L.spin, tg = L.spin.target;
    s.yaw += Math.atan2(Math.sin(tg.yaw - s.yaw), Math.cos(tg.yaw - s.yaw)) * fade(4, dt);
    s.pitch += (tg.pitch - s.pitch) * fade(4, dt);
  }

  // the colours: the next scene's background wipes up from the bottom; the ink turns over halfway
  const ia = seg.i, ib = seg.hold ? seg.i : seg.i + 1, em = seg.hold ? 0 : smooth(0.1, 0.9, m);
  ink.copy(tones[ia].ink).lerp(tones[ib].ink, smooth(0.38, 0.62, em));
  bgA.copy(tones[ia].a).lerp(tones[ia].b, 0.5); bgB.copy(tones[ib].a).lerp(tones[ib].b, 0.5);
  bgMid.copy(bgA).lerp(bgB, em);
  setVar("--bg-a", seq[ia].bg[0]); setVar("--bg-b", seq[ia].bg[1]);
  setVar("--bg2-a", seq[ib].bg[0]); setVar("--bg2-b", seq[ib].bg[1]);
  setVar("--wipe", `${((1 - em) * 100).toFixed(2)}%`);
  { const B = backdrop.material.uniforms; B.uA0.value.set(seq[ia].bg[0]); B.uA1.value.set(seq[ia].bg[1]); B.uB0.value.set(seq[ib].bg[0]); B.uB1.value.set(seq[ib].bg[1]); B.uWipe.value = em; }
  setVar("--ink", `#${ink.getHexString()}`);
  if (!seg.hold) { wipes[ia] = [em, 1]; wipes[ib] = [0, em]; }

  // hover, focus and the picture brought forward
  const want = state.sel >= 0 ? (state.mode === "present" ? 0.86 : 0.4) : 0;
  state.dim += (want - state.dim) * fade(6, dt);
  for (const c of cards) {
    const shown = c.pose.w > 0.003, k = shownItem(c), L = layouts[c.li];
    const pointed = state.hover === c || k === state.listHover || (state.mode === "focus" && state.selCard === c);
    c.pres += ((seg.hold && shown && state.mode === "present" && state.selCard === c ? 1 : 0) - c.pres) * fade(5.5, dt);
    c.hov += ((seg.hold && shown && pointed ? 1 : 0) - c.hov) * fade(9, dt);
    const o = c.pose, mine = state.selCard === c;
    o.dim = Math.max(o.dim, state.dim * (1 - Math.max(c.pres, mine ? 1 : 0)));
    if (c.hov > 0.001 && shown) { o.p.addScaledVector(_v.copy(cam.p).sub(o.p).normalize(), c.hov * (L.hoverPull ?? 0.45)); o.blur *= 1 - c.hov; o.dim *= 1 - c.hov * 0.7; }
    if (c.pres > 0.001 && shown) { c.b2.copy(o); blend(c.b2, presentPose(pics[k].aspect, present), ease(c.pres), o); o.blur *= 1 - c.pres; }
    if (c.disc && o.disc > 0.004) c.spin += dt * (0.25 + c.pres * 1.2);
    // the picture coming forward draws last, over everything (see-through scenery included)
    const front = c.pres > 0.02;
    c.mesh.renderOrder = front ? 50 : 0;
    if (c.mat.transparent !== front) { c.mat.transparent = front; c.mat.depthTest = !front; c.mat.needsUpdate = true; }
    if (c.disc) { c.disc.renderOrder = front ? 49 : 0; if (c.disc.material.depthTest !== !front) { c.disc.material.depthTest = !front; c.disc.material.needsUpdate = true; } }
    apply(c, o, c.hov, floors[c.li]);
  }

  const reveal = state.intro;
  layouts.forEach((L, i) => {
    const w = presence[i] * (i === 0 ? smooth(0, 0.6, reveal) : 1);
    groups[i].visible = w > 0.001;
    if (groups[i].visible) L.props?.update(w, ts[i], ctx);
    const hero = weights[i] > 0.001 ? L.hero?.(ts[i], ctx) : null;
    sceneries[i].update(weights[i] * (i === 0 ? smooth(0, 0.6, reveal) : 1), ts[i], wipes[i], state.dim, hero != null && hero >= 0 ? ctx.picture(i, hero) : null);
  });

  // the words: the title arrives with the opening and leaves as soon as you scroll; the corner names the scene
  const go = smooth(0.04, 0.55, state.v);
  title.m.material.opacity = (1 - go) * smooth(0.5, 1, reveal) * (1 - Math.min(1, state.dim * 1.2));
  title.m.visible = title.m.material.opacity > 0.001;
  const on = active(state.v);
  if (on !== lastOn) {
    numEl.textContent = pad(on + 1);
    // the name rolls over, up or down with the scroll (a jump just swaps it)
    const roll = lastOn >= 0 && !jump, next = document.createElement("span");
    next.textContent = seq[on].name; next.className = roll ? (on > lastOn ? "in-up" : "in-down") : "";
    for (const old of [...nameEl.children]) { if (roll && !old.className.startsWith("out")) { old.className = on > lastOn ? "out-up" : "out-down"; setTimeout(() => old.remove(), 600); } else if (!roll) old.remove(); }
    nameEl.appendChild(next);
    showSwitches(on);
    document.body.dataset.scene = seq[on].look;
    lastOn = on;
  }
  setVar("--progress", (clamp(state.v / TOTAL) * 100).toFixed(2) + "%");
  // the picture a layout puts forward (the arc's top, the jukebox's risen record): its name, set in the scene
  const feat = seg.hold && state.sel < 0 && state.intro >= 1 ? layouts[seg.i].feature?.(ts[seg.i], ctx) : null;
  if (feat) {
    // under the card itself, unless the layout names a point
    const c = sets[seg.i][feat.b], k = shownItem(c), o = c.pose;
    if (feat.at) _fp.copy(feat.at); else _fp.set(0, -o.h / 2 - 0.22, 0).applyQuaternion(o.q).add(o.p);
    _fp.project(camera);
    featEl.style.transform = `translate(${((_fp.x + 1) / 2) * innerWidth}px, ${((1 - _fp.y) / 2) * innerHeight}px) translate(-50%, 0)`;
    if (k !== featFor) {
      featFor = k; const it = items[k];
      featEl.querySelector(".n").textContent = pad(k + 1); featEl.querySelector("b").textContent = it.title;
      featEl.querySelector(".m").textContent = (it.sub ? [it.sub] : []).concat((it.meta || []).slice(0, 2)).join("  ·  ");
      featEl.classList.remove("swap"); void featEl.offsetWidth; featEl.classList.add("swap");
    }
  }
  featEl.classList.toggle("on", !!feat);
  // the cursor's label: the title of the picture under it
  const tip = seg.hold && state.hover && state.sel < 0 ? shownItem(state.hover) : -1;
  if (tip !== tipFor) { tipFor = tip; if (tip >= 0) tipEl.innerHTML = `<b>${pad(tip + 1)}</b>${esc(items[tip].title)}`; tipEl.classList.toggle("on", tip >= 0); }

  post.render(jump ? 0 : dt);
}
// ready: resolves once every picture and every piece of scenery has loaded (or failed to): checks and recordings wait for it
let readyDone;
const ready = new Promise((r) => (readyDone = r));
// recording: the page stops drawing on its own and draws one frame per tick(v, dt), dt seconds apart, for video
let manual = false, clock = 0;
function loop(now) {
  if (readyDone && every.got >= every.want) { readyDone(true); readyDone = null; }
  if (!manual) frame(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.accrochage = {
  segs, state, ctx, layouts, sets, scene, plans, camera, ready, title: title.m,
  go(v) { state.intro = 1; state.introAt ||= 1; scrollTo({ top: v * innerHeight, behavior: "instant" }); frame(performance.now(), true); },
  record(on) { manual = on; clock = last; },
  tick(v, dt = 1 / 30) { scrollTo({ top: v * innerHeight, behavior: "instant" }); clock += dt * 1000; frame(clock); },
  restart() { state.intro = 0; state.introAt = 0; born = clock; },
  focus: (k) => focusTo(k), present: (k) => select(k, "present", where[k] && sets[where[k].li][where[k].b]), clear, openList,
};
