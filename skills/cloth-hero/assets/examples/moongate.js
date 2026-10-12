// 03 Moon Gate — Maison Yuè, a haute-joaillerie house. A round moon gate cut into a dark oxblood-lacquer wall, a
// moonlit garden beyond, and inside the gate a curtain of 64 strands × 70 beads — pearl, coral, onyx, white jade and
// night-blue glass. Every bead takes the colour of one pixel of a painting of a full moon crossed by a plum branch,
// so together they hang as the moon itself. Reach through and it breaks into pearls; let go and it is whole again.
// The strands are heavy and well damped (no swinging back and forth), tethered so they can't stretch and bounce, and
// the finger that parts them is small and soft. The wall is real geometry in front of the strands, so it is what
// crops the curtain to a circle.
import * as THREE from "three";
import { Strands } from "../engine/strands.js";
import { loadImage, canvas, drawCover, bakeEnv, glow, room, texture, fontsReady, disposeScene, smooth, rng, noise3 } from "../engine/kit.js";

export const meta = { id: "moongate", no: "03", name: "Moon Gate", native: "月", veil: "#190807", ink: "#efe6d6", display: "'Bodoni Moda', serif", weight: 500, sound: "night" };

export const html = {
  bg: `<div class="mg-garden"></div><div class="mg-haze"></div>`,
  back: ``,
  hero: `
  <header class="nav">
    <a class="brand" href="#" data-noop>YUÈ<span lang="zh">月</span></a>
    <nav class="links"><a href="#" data-noop>Haute joaillerie</a><a href="#" data-noop>Maison</a><a href="#" data-noop>Appointments</a></nav>
    <a href="#" data-noop class="pill">Book a viewing</a>
  </header>
  <section class="copy">
    <p class="kicker">Collection Mid-Autumn · <span lang="zh">中秋</span></p>
    <h1>A full moon,<br><em>strung by hand.</em></h1>
    <p class="lede">Pearl, coral, onyx and white jade: four thousand beads on silk, hung in a moon gate. Reach through and the moon breaks into pearls; let go and it is whole again.</p>
    <div class="cta"><a href="#" data-noop class="btn">Book a private viewing <i>→</i></a><span>Paris · Shanghai</span></div>
  </section>
  <aside class="idiom"><p class="zh" lang="zh">花好月圆</p><p class="py">huā hǎo yuè yuán</p><p>Flowers in bloom, the moon full: every happiness at once.</p></aside>
  <footer class="foot"><span>Maison Yuè · Haute joaillerie</span><span class="hint">Reach through the pearls</span><span>Nº 03 — Mid-Autumn</span></footer>`,
};

const R = 0.85; // the gate's radius
const COUNT = 64, PITCH = 0.0266, LINK = 0.0246, BEADS = 70, BR = 0.0114;
const ANCHOR_Y = R * 0.985, X0 = (-(COUNT - 1) * PITCH) / 2;
const KIND = { stone: 0, pearl: 1, glass: 2, gold: 3 };

// one colour per bead from the painting, sampled where the bead hangs at rest (the painting fills the gate's square)
function beadColors(img) {
  const S = 4, cw = COUNT * S, ch = BEADS * S, c = canvas(cw, ch), x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high";
  // canvas rows run down the curtain from the rod (ANCHOR_Y) over BEADS·LINK; the painting fills the gate's square
  // (y from +R to −R), so its top edge sits at row (ANCHOR_Y − R) / span · ch
  const span = BEADS * LINK;
  x.fillStyle = "#0b1428"; x.fillRect(0, 0, cw, ch);
  drawCover(x, img, 0, ((ANCHOR_Y - R) / span) * ch, cw, ((2 * R) / span) * ch, 0.5, 0.5);
  const d = x.getImageData(0, 0, cw, ch).data, N = COUNT * BEADS, col = new Float32Array(3 * N), r = rng(9);
  for (let s = 0; s < COUNT; s++)
    for (let k = 0; k < BEADS; k++) {
      let a = 0, b = 0, g = 0;
      for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) { const o = 4 * ((k * S + yy) * cw + s * S + xx); a += d[o]; g += d[o + 1]; b += d[o + 2]; }
      const i = s * BEADS + k;
      col[3 * i] = a / (S * S * 255); col[3 * i + 1] = g / (S * S * 255); col[3 * i + 2] = b / (S * S * 255);
    }
  // the painting's ground (night) from its outer ring
  const ring = [];
  for (let s = 0; s < COUNT; s++) for (const k of [1, 2, BEADS - 2, BEADS - 3]) ring.push(s * BEADS + k);
  for (let k = 0; k < BEADS; k++) for (const s of [0, 1, COUNT - 1, COUNT - 2]) ring.push(s * BEADS + k);
  const med = [0, 1, 2].map((c2) => ring.map((i) => col[3 * i + c2]).sort((p, q) => p - q)[ring.length >> 1]);
  const kinds = new Uint8Array(N), out = new Float32Array(3 * N), scale = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const k = i % BEADS, R0 = col[3 * i], G0 = col[3 * i + 1], B0 = col[3 * i + 2];
    const lum = 0.299 * R0 + 0.587 * G0 + 0.114 * B0, mx = Math.max(R0, G0, B0), mn = Math.min(R0, G0, B0), sat = mx > 0 ? (mx - mn) / mx : 0;
    const dist = Math.hypot(R0 - med[0], G0 - med[1], B0 - med[2]);
    scale[i] = 0.93 + 0.12 * r();
    if (k === 1) { kinds[i] = KIND.gold; out.set([0.86, 0.68, 0.36], 3 * i); scale[i] = 0.72; continue; } // gold spacer under the rod
    if ((B0 >= R0 * 0.95 && lum < 0.5) || (dist < 0.16 && lum < 0.4)) { // night (the painting's mottled blue silk): deep midnight glass; a few clear ones catch the light like stars
      kinds[i] = KIND.glass;
      const star = r() < 0.04, v = 0.75 + 0.25 * r();
      out.set(star ? [0.7, 0.76, 0.9] : [0.045 * v, 0.07 * v, 0.17 * v], 3 * i);
      continue;
    }
    if (lum > 0.45 && sat < 0.5 && R0 >= B0) { // the moon: pearls, warm and pale
      kinds[i] = KIND.pearl;
      const v = 0.95 + 0.05 * r();
      out.set([Math.min(1, (0.72 + R0 * 0.3) * v), Math.min(1, (0.64 + G0 * 0.3) * v), Math.min(1, (0.48 + B0 * 0.3) * v)], 3 * i);
      continue;
    }
    kinds[i] = KIND.stone; // branch, blossoms, buds: onyx, coral, white jade
    for (let c2 = 0; c2 < 3; c2++) {
      const v = col[3 * i + c2], boosted = lum + (v - lum) * 1.4;
      out[3 * i + c2] = Math.max(0, Math.min(1, (boosted - 0.5) * 1.15 + 0.48));
    }
  }
  return { kinds, colors: out, scale };
}

// lacquer for the wall: deep oxblood with a faint vertical grain and the soft unevenness of hand-rubbed layers
function lacquerMaps() {
  const n = 1024, c = canvas(n, n), x = c.getContext("2d"), nc = canvas(n, n), nx = nc.getContext("2d");
  const img = x.createImageData(n, n), nimg = nx.createImageData(n, n);
  const h = new Float32Array(n * n);
  for (let y = 0; y < n; y++)
    for (let xx = 0; xx < n; xx++) {
      const g = noise3(xx * 0.02, y * 0.0012, 1) * 0.6 + noise3(xx * 0.08, y * 0.004, 2) * 0.4; // grain runs vertically
      const m = noise3(xx * 0.004, y * 0.004, 3);
      h[y * n + xx] = g;
      const o = 4 * (y * n + xx), v = 0.82 + 0.18 * m + 0.08 * (g - 0.5);
      img.data[o] = 64 * v; img.data[o + 1] = 15 * v; img.data[o + 2] = 12 * v; img.data[o + 3] = 255;
    }
  for (let y = 0; y < n; y++)
    for (let xx = 0; xx < n; xx++) {
      const dx = h[y * n + ((xx + 1) % n)] - h[y * n + ((xx - 1 + n) % n)], dy = h[((y + 1) % n) * n + xx] - h[((y - 1 + n) % n) * n + xx];
      let a = -dx * 1.4, b = dy * 1.4, z = 1;
      const l = Math.hypot(a, b, z);
      const o = 4 * (y * n + xx);
      nimg.data[o] = (a / l * 0.5 + 0.5) * 255; nimg.data[o + 1] = (b / l * 0.5 + 0.5) * 255; nimg.data[o + 2] = (z / l * 0.5 + 0.5) * 255; nimg.data[o + 3] = 255;
    }
  x.putImageData(img, 0, 0);
  nx.putImageData(nimg, 0, 0);
  return { color: c, normal: nc };
}

function nightEnv(renderer) {
  return bakeEnv(renderer, (s) => {
    s.add(room(0x140707));
    s.add(glow(0xffd9a8, 2.2, 3.4, 3.4, -3, 3, 3.6)); // the lantern, top left in front
    s.add(glow(0xbfd2ff, 2.2, 6, 4, 0, 1.5, -6)); // moonlit garden behind
    s.add(glow(0x9fb4e8, 1.2, 3, 3, 1.5, 4, -3)); // the moon
    s.add(glow(0x3a1410, 1, 12, 12, 0, -4, 0, [0, 10, 0]));
  }, 0.05);
}

export async function create(stage, ctx) {
  const { renderer } = stage;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const [art] = await Promise.all([loadImage(ctx.image ?? "img/moongate-moon.webp"), loadImage("img/moongate-garden.webp"), fontsReady(["500 40px 'Bodoni Moda'"])]);

  const scene = new THREE.Scene();
  const env = nightEnv(renderer);
  scene.environment = env.texture;

  // ——— the wall with its moon gate ———
  const lac = lacquerMaps(), aniso = renderer.capabilities.getMaxAnisotropy();
  const lacColor = texture(lac.color, { repeat: [3, 2.2], anisotropy: aniso });
  const lacNormal = texture(lac.normal, { srgb: false, repeat: [3, 2.2], anisotropy: aniso });
  const shape = new THREE.Shape();
  shape.moveTo(-6, -4); shape.lineTo(6, -4); shape.lineTo(6, 4); shape.lineTo(-6, 4); shape.lineTo(-6, -4);
  const hole = new THREE.Path();
  hole.absarc(0, 0, R, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const wallGeo = new THREE.ShapeGeometry(shape, 160);
  { // UVs in metres / 4, so the lacquer texture repeats at a sensible size
    const p = wallGeo.attributes.position, uv = wallGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 4, p.getY(i) / 4);
  }
  const lacquer = new THREE.MeshPhysicalMaterial({ map: lacColor, normalMap: lacNormal, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.32, envMapIntensity: 0.45 });
  const wall = new THREE.Mesh(wallGeo, lacquer);
  wall.position.z = 0.09;
  scene.add(wall);
  // the reveal: the wall's thickness inside the opening, and a gold rim at its face
  const reveal = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.16, 160, 1, true), new THREE.MeshPhysicalMaterial({ color: 0x2a0907, roughness: 0.5, clearcoat: 0.6, side: THREE.BackSide, envMapIntensity: 0.4 }));
  reveal.rotation.x = Math.PI / 2;
  reveal.position.z = 0.01;
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b26a, metalness: 1, roughness: 0.28, envMapIntensity: 1.2 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.004, 0.009, 16, 220), gold);
  rim.position.z = 0.092;
  const rim2 = new THREE.Mesh(new THREE.TorusGeometry(R + 0.07, 0.0035, 10, 220), gold);
  rim2.position.z = 0.092;
  scene.add(reveal, rim, rim2);
  // the brass rod the strands hang from, just inside the top of the gate
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2 * R + 0.2, 16), gold);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, ANCHOR_Y + 0.012, 0);
  scene.add(rod);

  // ——— the strands ———
  // span limits instead of tethers to the rod: strands can't stretch or bounce, and one pushed aside hangs plumb
  // below the push, the way a real strand drapes, rather than being drawn back to its line
  const sim = new Strands({ count: COUNT, beads: BEADS, pitch: PITCH, link: LINK, radius: BR, x0: X0, y0: ANCHOR_Y, substeps: 3, damping: 2.4, bend: 6e-6, maxSpeed: 3, spans: [4, 12, 36], linkIters: 2 });
  // the finger: strands part around it, and any carried more than 24 cm slip off and fall back
  Object.assign(sim.finger, { zPush: 0.1, soft: 0.75, maxPush: 0.24 });
  sim.zMax = 0.05; // the wall's face is at 0.09: nothing comes through it
  // a slight night breeze through the gate, rolling across the strands
  sim.air = 1.2;
  sim.windFn = (s, t, o) => {
    o[0] = 0.16 * (0.7 * Math.sin(t * 0.45 + s * 0.09) + 0.3 * Math.sin(t * 1.1 + s * 0.31));
    o[1] = 0.12 * Math.sin(t * 0.37 + s * 0.13 + 1);
  };
  const N = sim.n;
  const geos = [new THREE.SphereGeometry(1, 10, 7), new THREE.SphereGeometry(1, 12, 8), new THREE.SphereGeometry(1, 10, 7), new THREE.SphereGeometry(1, 8, 6)];
  const mats = [
    new THREE.MeshPhysicalMaterial({ roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xfff0dc), envMapIntensity: 1.1 }),
    new THREE.MeshPhysicalMaterial({ roughness: 0.28, iridescence: 1, iridescenceIOR: 1.55, iridescenceThicknessRange: [260, 520], sheen: 1, sheenColor: new THREE.Color(0xfff3e4), sheenRoughness: 0.35, clearcoat: 0.8, envMapIntensity: 1.15 }),
    new THREE.MeshPhysicalMaterial({ roughness: 0.09, specularIntensity: 0.9, envMapIntensity: 0.16 }), // night glass: deep, one small sharp highlight
    new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.22, envMapIntensity: 1.3 }),
  ];
  const meshes = geos.map((g, k) => {
    const m = new THREE.InstancedMesh(g, mats[k], N);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    scene.add(m);
    return m;
  });
  const kindOf = new Uint8Array(N), slot = new Int32Array(N), scale = new Float32Array(N);
  const tmpColor = new THREE.Color();
  function paint(img) {
    const { kinds, colors, scale: sc } = beadColors(img);
    meshes.forEach((m) => (m.count = 0));
    for (let i = 0; i < N; i++) {
      const m = meshes[kinds[i]];
      kindOf[i] = kinds[i]; slot[i] = m.count++; scale[i] = sc[i];
      m.setColorAt(slot[i], tmpColor.setRGB(colors[3 * i], colors[3 * i + 1], colors[3 * i + 2], THREE.SRGBColorSpace));
    }
    meshes.forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  }
  paint(art);

  // silk thread between the beads
  const thread = new Float32Array(N * 6);
  const threadGeo = new THREE.BufferGeometry();
  threadGeo.setAttribute("position", new THREE.BufferAttribute(thread, 3).setUsage(THREE.DynamicDrawUsage));
  const threads = new THREE.LineSegments(threadGeo, new THREE.LineBasicMaterial({ color: 0x8a6a3a, transparent: true, opacity: 0.45 }));
  threads.frustumCulled = false;
  scene.add(threads);

  // ——— light: a lantern in front, the moon behind ———
  const lantern = new THREE.SpotLight(0xffd6a0, 16, 0, 0.95, 1, 1.4);
  lantern.position.set(-2.2, 2.4, 3.4);
  lantern.target.position.set(0.25, -0.2, 0);
  const moon = new THREE.DirectionalLight(0xbcd0ff, 1.6);
  moon.position.set(0.6, 1.4, -2.5);
  scene.add(lantern, lantern.target, moon, new THREE.HemisphereLight(0x3a2a2a, 0x120606, 0.6));

  // ——— draw ———
  const m4 = new Float32Array(16);
  function sync() {
    const p = sim.pos;
    for (let i = 0; i < N; i++) {
      const s = (i / BEADS) | 0, k = i - s * BEADS, i3 = 3 * i;
      const a = 3 * (k > 0 ? i - 1 : i), b = 3 * (k < BEADS - 1 ? i + 1 : i);
      let tx = p[a] - p[b], ty = p[a + 1] - p[b + 1], tz = p[a + 2] - p[b + 2];
      const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      let xx = ty, xy = -tx;
      const xl = Math.sqrt(xx * xx + xy * xy) || 1;
      xx /= xl; xy /= xl;
      const zx = xy * tz, zy = -xx * tz, zz = xx * ty - xy * tx;
      const sc = BR * scale[i], sy = sc * (kindOf[i] === KIND.stone ? 1.08 : 1);
      m4[0] = xx * sc; m4[1] = xy * sc; m4[2] = 0; m4[3] = 0;
      m4[4] = tx * sy; m4[5] = ty * sy; m4[6] = tz * sy; m4[7] = 0;
      m4[8] = zx * sc; m4[9] = zy * sc; m4[10] = zz * sc; m4[11] = 0;
      m4[12] = p[i3]; m4[13] = p[i3 + 1]; m4[14] = p[i3 + 2]; m4[15] = 1;
      meshes[kindOf[i]].instanceMatrix.array.set(m4, 16 * slot[i]);
      const o = 6 * i;
      if (k === 0) { thread[o] = p[i3]; thread[o + 1] = ANCHOR_Y + 0.012; thread[o + 2] = p[i3 + 2]; }
      else { thread[o] = p[i3 - 3]; thread[o + 1] = p[i3 - 2]; thread[o + 2] = p[i3 - 1]; }
      thread[o + 3] = p[i3]; thread[o + 4] = p[i3 + 1]; thread[o + 5] = p[i3 + 2];
    }
    meshes.forEach((m) => (m.instanceMatrix.needsUpdate = true));
    threadGeo.attributes.position.needsUpdate = true;
  }

  const pointer = new THREE.Vector3(), f = sim.finger;
  const garden = ctx.bg.querySelector(".mg-garden"), haze = ctx.bg.querySelector(".mg-haze");
  let clackBudget = 0, fingerR = 0, T = 0;
  const theme = {
    scene, parallax: 0.02,
    layout(w, h) {
      const tall = w / h < 1.05, m = w < 760;
      let ppm;
      if (tall) ppm = stage.frame({ center: [0, 0, 0], worldW: 2 * R + 0.3, worldH: 2 * R + 0.3, sx: 0.5, sy: m ? 0.34 : 0.37, sh: m ? 0.5 : 0.56, sw: 0.94, fov: 24 });
      else ppm = stage.frame({ center: [0, 0, 0], worldW: 2 * R + 0.3, worldH: 2 * R + 0.3, sx: 0.62, sy: 0.53, sh: 0.9, sw: 0.62, fov: 24 });
      // the garden photo is centred on the gate, a little larger than it
      const [cx, cy] = stage.toScreen(new THREE.Vector3(0, 0, 0)), dh = 2 * R * ppm * 1.5, dw = (dh * 16) / 9;
      Object.assign(garden.style, { left: `${cx - dw * 0.52}px`, top: `${cy - dh * 0.48}px`, width: `${dw}px`, height: `${dh}px` });
      Object.assign(haze.style, { left: `${cx}px`, top: `${cy}px`, width: `${2 * R * ppm}px`, height: `${2 * R * ppm}px` });
    },
    // physics, 120 times a second
    step(h) {
      T += h;
      fingerR = smooth(fingerR, f.target ?? 0, (f.target ?? 0) > fingerR ? 6 : 4, h);
      f.r = fingerR;
      // the finger follows the pointer quickly, but never jumps through the strands, and never leaves the gate
      let px = pointer.x, py = pointer.y;
      const pr = Math.hypot(px, py), lim = R - 0.02;
      if (pr > lim) { px *= lim / pr; py *= lim / pr; }
      const maxStep = 3 * h, dx = px - f.x, dy = py - f.y, dl = Math.hypot(dx, dy);
      const k = dl > maxStep ? maxStep / dl : 1;
      f.x += dx * k; f.y += dy * k;
      if (fingerR < 0.004) { f.x = px; f.y = py; }
      sim.step(h, T);
    },
    update(dt) {
      const p = stage.p;
      if (p.active) stage.onPlane(p.x, p.y, 0, pointer);
      const inGate = p.active && pointer.x * pointer.x + pointer.y * pointer.y < (R - 0.01) ** 2;
      f.target = inGate ? (p.touch ? 0.125 : 0.11) : 0;
      sync();
      // a knock for every hard collision, panned to where it happened
      clackBudget = Math.min(6, clackBudget + dt * 40);
      if (sim.impacts > 0.6 && clackBudget >= 1) {
        const n = Math.min(3, Math.floor(sim.impacts / 1.2) + 1);
        for (let q = 0; q < n && clackBudget >= 1; q++, clackBudget--) ctx.audio.clack(Math.min(1, sim.impacts / 8), sim.hit.x / 0.9);
      }
      sim.impacts = 0;
    },
    setImage(img) { paint(img); },
    dispose() { disposeScene(scene); env.dispose(); },
  };

  for (let i = 0; i < 240; i++) theme.step(1 / 120);
  sync();
  return theme;
}
