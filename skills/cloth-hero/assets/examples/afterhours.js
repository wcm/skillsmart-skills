// 01 Afterhours — a digital-fashion label from the long night after the internet. A square of black holographic PVC,
// printed with a rendered model, is clipped to a wire in a rain-dark megacity.
// The sheet is a 53 × 53 XPBD cloth with stiff stretch, firm bending (vinyl folds big and smooth, then creases) and
// friction-free self-collision, hung from four chrome clips set a little closer than its width so the top falls in
// swags. A slight, slow wind keeps it alive; the physics runs on the stage's fixed clock, so it never shivers. Its look comes from the environment: a baked room of
// neon tubes, horizontal studio strips and the city itself, reflected in a thin-film iridescent clear coat with
// beaded rain. Drag to pull it; the cursor is also a light; a thin HUD frames the specimen and reads the tension.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Cloth } from "../engine/cloth.js";
import { loadImage, canvas, drawCover, dropletNormals, bakeEnv, glow, room, texture, fontsReady, clothGeometry, syncGeometry, disposeScene, smooth, noise3 } from "../engine/kit.js";

export const meta = { id: "afterhours", no: "01", name: "Afterhours", native: "02:47", veil: "#06060a", ink: "#f3f0fa", display: "'Unbounded', sans-serif", weight: 300, sound: "rain" };

export const html = {
  bg: `<div class="ah-plate"></div><div class="ah-rain"></div><div class="ah-rain ah-rain--far"></div><div class="ah-vignette"></div><div class="ah-scan"></div>`,
  back: `<p class="ah-ghost">After<br>hours</p>`,
  hero: `
  <header class="nav">
    <a class="brand" href="#" data-noop>AFTERHOURS<sup>v4.7</sup></a>
    <nav class="links"><a href="#" data-noop>Drop 07</a><a href="#" data-noop>Models</a><a href="#" data-noop>Archive</a></nav>
    <div class="actions"><a href="#" data-noop class="bag">Bag [0]</a><a href="#" data-noop class="pill">Pre-order</a></div>
  </header>
  <section class="copy">
    <p class="kicker"><b>Look 07</b> Digital human · holo-PVC 0.3 mm</p>
    <h1><span>Pull me</span><span class="soft">closer.</span></h1>
    <p class="lede">Holographic vinyl cut for the long night after the internet, worn by models who were rendered, not born. It holds every crease like a memory, and lets go when you do.</p>
    <div class="cta"><a href="#" data-noop class="btn">Pre-order the trench <i>→</i></a><span class="price">€ 680 · ships in November</span></div>
  </section>
  <div class="ah-hud" aria-hidden="true"><i></i><i></i><i></i><i></i><span class="tl">SPECIMEN 07 / HOLO-PVC</span><span class="br">TENSION <b>0.00</b></span></div>
  <aside class="side"><p class="code">AH—07 / RENDERED NOT BORN</p><p class="coords">SECTOR 9 · 02:47:09 · RAIN 92%</p></aside>
  <footer class="foot"><span>Sector 9, after rain</span><span class="hint">Drag the sheet · let go to drop it</span><span>Drop 07 — Wet Chrome</span></footer>`,
};

const W = 1.4, H = 1.4, COLS = 53, ROWS = 53, CLIPS = [0, 17, 35, 52], SLACK = 0.88;

function bakePrint(img) {
  const w = 2048, h = 2048, c = canvas(w, h), x = c.getContext("2d"), M = 112;
  x.fillStyle = "#05050a";
  x.fillRect(0, 0, w, h);
  drawCover(x, img, 0, 0, w, h, 0.5, 0.32);
  const g = x.createLinearGradient(0, h * 0.5, 0, h);
  g.addColorStop(0, "rgba(5,5,10,0)"); g.addColorStop(0.62, "rgba(5,5,10,.7)"); g.addColorStop(1, "rgba(5,5,10,.94)");
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  // large-format print banding
  x.globalAlpha = 0.05; x.fillStyle = "#000";
  for (let y = 0; y < h; y += 5) x.fillRect(0, y, w, 2);
  x.globalAlpha = 1;
  // HUD: corner marks, a crosshair on the face, a barcode
  x.strokeStyle = "rgba(25,227,255,.8)"; x.lineWidth = 3;
  const k = 46;
  for (const [cx, cy, sx, sy] of [[M * 0.6, M * 0.6, 1, 1], [w - M * 0.6, M * 0.6, -1, 1], [M * 0.6, h - M * 0.6, 1, -1], [w - M * 0.6, h - M * 0.6, -1, -1]]) {
    x.beginPath(); x.moveTo(cx, cy + sy * k); x.lineTo(cx, cy); x.lineTo(cx + sx * k, cy); x.stroke();
  }
  x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 2;
  const fx = w * 0.3, fy = h * 0.36; // on the model's face
  x.beginPath(); x.arc(fx, fy, 160, 0, Math.PI * 2); x.stroke();
  for (const [a, b, cc, d] of [[fx - 230, fy, fx - 180, fy], [fx + 180, fy, fx + 230, fy], [fx, fy - 230, fx, fy - 180], [fx, fy + 180, fx, fy + 230]]) { x.beginPath(); x.moveTo(a, b); x.lineTo(cc, d); x.stroke(); }
  x.font = "500 30px 'Geist Mono'"; x.fillStyle = "rgba(255,255,255,.88)"; x.textBaseline = "top";
  x.fillText("[ HOLO / PVC ]", M, M);
  x.fillText("UNIT 07 — RENDERED, NOT BORN", M, M + 44);
  x.textAlign = "right";
  x.fillText("Nº 07 — 0.3 MM", w - M, M);
  x.fillStyle = "#19e3ff"; x.fillText("● REC 02:47:09", w - M, M + 44);
  x.textAlign = "left";
  x.fillStyle = "rgba(255,255,255,.8)";
  let bx = w - M - 260;
  for (let i = 0; i < 46; i++) { const bw = 2 + ((i * 7) % 5) * 2; x.fillRect(bx, h * 0.47, bw, 120); bx += bw + 3 + ((i * 3) % 4); }
  x.font = "500 22px 'Geist Mono'"; x.fillText("SYN-0007-AH", w - M - 260, h * 0.47 + 132);
  // wordmark with a cyan / magenta split
  let size = 330;
  x.font = `800 ${size}px Unbounded`;
  const tw = Math.max(x.measureText("AFTER").width, x.measureText("HOURS").width);
  size = Math.min(size, (size * (w - 2 * M)) / tw);
  x.font = `800 ${size}px Unbounded`;
  x.textBaseline = "alphabetic";
  const y2 = h - M - 120, y1 = y2 - size * 0.9;
  for (const [dx, col, op] of [[-8, "#19e3ff", "lighter"], [8, "#ff2e88", "lighter"], [0, "#f4f1ff", "source-over"]]) {
    x.globalCompositeOperation = op; x.fillStyle = col;
    x.fillText("AFTER", M + dx, y1); x.fillText("HOURS", M + dx, y2);
  }
  x.globalCompositeOperation = "source-over";
  x.font = "500 28px 'Geist Mono'"; x.fillStyle = "rgba(255,255,255,.72)";
  x.fillText("DROP 07 — WET CHROME", M, h - M - 38);
  x.textAlign = "right"; x.fillText("SECTOR 9  ·  02:47", w - M, h - M - 38);
  return c;
}

// a tile of falling rain streaks for the CSS backdrop (it scrolls one tile height per loop, so it never jumps)
function rainTile(seed, count, len, alpha, w = 360, h = 480) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let lines = "";
  for (let i = 0; i < count; i++) {
    const x = r() * w, y = r() * h, l = len * (0.5 + r()), a = alpha * (0.4 + 0.6 * r());
    for (const oy of [0, -h]) lines += `<line x1="${x.toFixed(1)}" y1="${(y + oy).toFixed(1)}" x2="${(x - l * 0.07).toFixed(1)}" y2="${(y + oy + l).toFixed(1)}" stroke="rgba(214,226,255,${a.toFixed(2)})" stroke-width="1"/>`;
  }
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${lines}</svg>`)}")`;
}

// the room the vinyl reflects: dark, with long white strips overhead, magenta and cyan tubes, and the city itself
function neonEnv(renderer, plate) {
  return bakeEnv(renderer, (s) => {
    s.add(room(0x040407));
    for (const [y, z, k] of [[2.4, 3.2, 7], [3.1, 1.6, 5], [3.6, -0.4, 3.5]]) s.add(glow(0xf4f2ff, k, 14, 0.16, 0, y, z));
    s.add(glow(0xff2e88, 6, 0.12, 7, -4.2, 0.4, 2.6));
    s.add(glow(0xff2e88, 3, 0.1, 5, -6, 0.2, -1.5));
    s.add(glow(0x19e3ff, 6, 0.12, 7, 4.2, 0.6, 2.4));
    s.add(glow(0x19e3ff, 2.5, 0.1, 5, 6, 0.2, -2));
    s.add(glow(0x9b5cff, 2.6, 1.6, 0.4, 1.6, -1.4, 4.2));
    const t = new THREE.Texture(plate);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    s.add(glow(0xffffff, 1.5, 16, 9, 0, 0.6, 7.5, [0, 0.6, 0], t));
    s.add(glow(0x0b0b14, 1, 16, 16, 0, -3.5, 0, [0, 10, 0]));
  }, 0.03);
}

export async function create(stage, ctx) {
  const { renderer } = stage;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const [model, plate] = await Promise.all([
    loadImage(ctx.image ?? "img/afterhours-human.webp"),
    loadImage("img/afterhours-city.webp"),
    fontsReady(["800 100px Unbounded", "500 30px 'Geist Mono'"]),
  ]);
  ctx.bg.querySelectorAll(".ah-rain").forEach((el, k) => {
    el.style.backgroundImage = k ? rainTile(7, 70, 26, 0.35) : rainTile(3, 46, 44, 0.55);
    el.style.setProperty("--ry", "480px");
  });

  const scene = new THREE.Scene();
  const env = neonEnv(renderer, plate);
  scene.environment = env.texture;

  // ——— the sheet ———
  const cloth = new Cloth({
    patches: [{ cols: COLS, rows: ROWS, width: W, height: H, x: -W / 2, y: H / 2, z: 0 }],
    density: 0.4, substeps: 6, stretch: 0, shear: 1e-6, bend: 0.06, damping: 0.6, kN: 2.4, kT: 0.12,
    selfCollide: true, thickness: 0.02, friction: 0, grabSpeed: 2, maxSpeed: 7, jitter: 0.004,
  });
  CLIPS.forEach((c) => cloth.pin(c, cloth.rest[3 * c] * SLACK, H / 2, 0));

  const print = texture(bakePrint(model), { anisotropy: renderer.capabilities.getMaxAnisotropy() });
  const drops = texture(dropletNormals(1024, 900, 3, 0.55), { srgb: false, repeat: [1.8, 1.8] });
  const mat = new THREE.MeshPhysicalMaterial({
    map: print, roughness: 0.2, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.035, clearcoatNormalMap: drops, clearcoatNormalScale: new THREE.Vector2(0.45, 0.45),
    iridescence: 0.8, iridescenceIOR: 1.33, iridescenceThicknessRange: [160, 640],
    envMapIntensity: 1.3, side: THREE.DoubleSide,
  });
  const geo = clothGeometry(cloth);
  const sheet = new THREE.Mesh(geo, mat);
  sheet.castShadow = sheet.receiveShadow = true;
  scene.add(sheet);

  // ——— clips and wire ———
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdcdce6, metalness: 1, roughness: 0.16, envMapIntensity: 1.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15151c, metalness: 0.4, roughness: 0.35 });
  const clipGeo = new RoundedBoxGeometry(0.056, 0.038, 0.018, 3, 0.005);
  const loopGeo = new THREE.TorusGeometry(0.013, 0.0016, 8, 28, Math.PI);
  for (const c of CLIPS) {
    const x = cloth.pos[3 * c], y = cloth.pos[3 * c + 1];
    const body = new THREE.Mesh(clipGeo, chrome);
    body.position.set(x, y - 0.002, 0);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.004, 0.0185), dark);
    jaw.position.set(x, y - 0.02, 0);
    const loop = new THREE.Mesh(loopGeo, chrome);
    loop.position.set(x, y + 0.017, 0);
    body.castShadow = loop.castShadow = true;
    scene.add(body, jaw, loop);
  }
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.0017, 0.0017, 16, 8), chrome);
  wire.rotation.z = Math.PI / 2;
  wire.position.set(0, H / 2 + 0.03, 0);
  scene.add(wire);

  // ——— light ———
  const key = new THREE.DirectionalLight(0xf2efff, 1.1);
  key.position.set(-0.6, 2.4, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -1, right: 1, top: 1, bottom: -1, near: 1, far: 7 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.012; key.shadow.radius = 4;
  const magenta = new THREE.DirectionalLight(0xff2e88, 0.9);
  magenta.position.set(-3, 0.4, 1.2);
  const cyan = new THREE.DirectionalLight(0x19e3ff, 0.8);
  cyan.position.set(3, 0.2, 1);
  const torch = new THREE.PointLight(0xffe0f4, 0, 2.4, 2); // the cursor
  torch.position.set(0, 0, 0.45);
  scene.add(key, magenta, cyan, torch, new THREE.AmbientLight(0x221a33, 0.6));

  // ——— input ———
  const pointer = new THREE.Vector3(), last = new THREE.Vector3(), air = { x: 0, y: 0, vx: 0, vy: 0, s: 0, k: 0 };
  let grabbing = false, hovering = false, motion = 0, grabPoint = null, tension = 0, sinceRelease = 9, T = 0;
  const hud = ctx.hero.querySelector(".ah-hud"), hudT = hud?.querySelector("b");
  const hit = (e) => {
    const r = stage.rayFrom(e.clientX, e.clientY).intersectObject(sheet, false)[0];
    if (!r) return null;
    const f = r.face;
    return { point: r.point, i: cloth.nearest(r.point.x, r.point.y, r.point.z, [f.a, f.b, f.c]) };
  };

  const theme = {
    scene, cloth, parallax: 0.012,
    layout(w, h) {
      const m = w < 760, tall = w / h < 1.05;
      if (m) stage.frame({ center: [0, 0, 0], worldW: 1.35, worldH: 1.5, sx: 0.5, sy: 0.35, sh: 0.5, sw: 0.94, fov: 24 });
      else if (tall) stage.frame({ center: [0, 0, 0], worldW: 1.35, worldH: 1.5, sx: 0.55, sy: 0.37, sh: 0.62, sw: 0.86, fov: 24 });
      else stage.frame({ center: [0, -0.01, 0], worldW: 1.35, worldH: 1.5, sx: 0.635, sy: 0.535, sh: 0.86, sw: 0.6, fov: 24 });
      // the HUD frames the sheet at rest
      if (hud) {
        const a = stage.toScreen(new THREE.Vector3(-W * SLACK / 2 - 0.05, H / 2 + 0.07, 0)), b = stage.toScreen(new THREE.Vector3(W * SLACK / 2 + 0.05, -H / 2 - 0.05, 0));
        Object.assign(hud.style, { left: `${a[0]}px`, top: `${a[1]}px`, width: `${b[0] - a[0]}px`, height: `${b[1] - a[1]}px` });
      }
    },
    onDown(e) {
      const h = hit(e);
      if (!h || h.i < 0) return;
      grabbing = true;
      grabPoint = h.point.clone();
      cloth.grab(h.i, 0.05);
      document.body.dataset.cursor = "grabbing";
      hud?.classList.add("on");
    },
    onMove(e) {
      if (grabbing) {
        const p = stage.onPlane(e.clientX, e.clientY, 0, new THREE.Vector3(), grabPoint);
        cloth.drag(p.x, p.y, p.z);
        tension = Math.min(1, p.distanceTo(grabPoint) / 0.6);
      } else if (!stage.p.touch) { hovering = !!hit(e); document.body.dataset.cursor = hovering ? "grab" : ""; }
    },
    onUp() {
      if (!grabbing) return;
      grabbing = false;
      sinceRelease = 0;
      cloth.release();
      document.body.dataset.cursor = hovering ? "grab" : "";
      hud?.classList.remove("on");
    },
    // physics, 120 times a second
    step(h) {
      T += h;
      // check folds against each other every step while it's being handled (so a fold can't slip through the
      // sheet), every other step once it has settled again
      sinceRelease += h;
      cloth.hashEvery = grabbing || sinceRelease < 3 ? 1 : 2;
      // a night wind: slow gusts that roll across the sheet, smooth enough never to shiver it
      const g = 0.55 + 0.45 * Math.sin(T * 0.23) * Math.sin(T * 0.14 + 2);
      cloth.fillWind((x, y, z, o) => {
        o[0] = 0.07 * Math.sin(T * 0.35 + y * 1.3) + 0.06 * (noise3(x * 0.9 + 3, y * 0.9, T * 0.08) - 0.5);
        o[2] = 0.1 + 0.28 * g * (0.4 + noise3(x * 0.9 + T * 0.14, y * 0.9, T * 0.07));
        if (air.k < 0.01) return;
        const dx = x - air.x, dy = y - air.y, f = Math.exp(-(dx * dx + dy * dy) / 0.025) * air.k;
        o[0] += air.vx * f * 0.35; o[1] += air.vy * f * 0.35; o[2] -= air.s * f * 0.25;
      });
      cloth.step(h);
    },
    update(dt) {
      const p = stage.p;
      if (p.active) stage.onPlane(p.x, p.y, 0, pointer);
      // air pushed by the hand: follows its velocity, presses into the sheet when it moves fast
      const vx = (pointer.x - last.x) / Math.max(dt, 1e-3), vy = (pointer.y - last.y) / Math.max(dt, 1e-3);
      last.copy(pointer);
      air.vx = smooth(air.vx, vx, 10, dt); air.vy = smooth(air.vy, vy, 10, dt);
      air.s = Math.min(3, Math.hypot(air.vx, air.vy));
      air.k = smooth(air.k, p.active && !grabbing && air.s > 0.05 ? 1 : 0, 4, dt);
      air.x = pointer.x; air.y = pointer.y;
      syncGeometry(geo);
      let v = 0;
      for (let i = 0; i < cloth.n; i += 11) v += Math.abs(cloth.vel[3 * i]) + Math.abs(cloth.vel[3 * i + 1]) + Math.abs(cloth.vel[3 * i + 2]);
      motion = smooth(motion, v / (cloth.n / 11), 8, dt);
      ctx.audio.rustle(Math.max(0, motion - 0.04) * (grabbing ? 2.2 : 1.2));
      // the cursor's light hangs just in front of the sheet
      torch.intensity = smooth(torch.intensity, p.active ? 1.6 : 0, 3, dt);
      torch.position.x = smooth(torch.position.x, pointer.x, 8, dt);
      torch.position.y = smooth(torch.position.y, pointer.y, 8, dt);
      if (!grabbing) tension = smooth(tension, 0, 3, dt);
      if (hudT) hudT.textContent = tension.toFixed(2);
    },
    setImage(img) {
      print.image = bakePrint(img);
      print.needsUpdate = true;
    },
    dispose() {
      document.body.dataset.cursor = "";
      disposeScene(scene);
      env.dispose();
    },
  };

  // let it fall into its swags (heavily damped) and catch the wind before anyone sees it
  const d0 = cloth.damping;
  cloth.damping = 6;
  for (let i = 0; i < 360; i++) theme.step(1 / 120);
  cloth.damping = d0;
  for (let i = 0; i < 240; i++) theme.step(1 / 120);
  syncGeometry(geo);
  return theme;
}
