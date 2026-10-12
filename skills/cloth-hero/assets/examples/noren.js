// 02 Noren — four panels of indigo-dyed hemp-linen hung in a Kyoto doorway at sunrise; the focus of the page.
// Heavy, slightly stiff linen: each panel is a 13 × 43 cloth under a bamboo pole, twice the weight of the vinyl with
// firmer bending and strong internal damping, and every particle is tethered to the pole by the length of cloth
// above it — so it hangs straight, moves only when pushed, and settles without any springy bounce. Your cursor is a
// hand pushing through; "Walk in" sends a whole person through the slits. The linen glows: the sun behind the
// doorway shines through the weave (stronger between threads, weaker under dark indigo), and the picture is baked
// into dye that bleeds along coarse, slubby hemp threads with the creases of a cloth that has been folded away.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Cloth } from "../engine/cloth.js";
import { loadImage, canvas, drawContain, softBlur, weaveMaps, bambooMap, texture, fontsReady, clothGeometry, syncGeometry, disposeScene, smooth, noise3, inject, rng } from "../engine/kit.js";

export const meta = { id: "noren", no: "02", name: "Noren", native: "暖簾", veil: "#ece4d3", ink: "#1c2a4f", display: "'Shippori Mincho', serif", weight: 500, sound: "street" };

export const html = {
  bg: `<div class="nr-paper"><i class="nr-rule"></i></div><div class="nr-plate"></div><div class="nr-glow"></div>`,
  back: ``,
  hero: `
  <header class="nav">
    <a class="brand" href="#" data-noop><b lang="ja">縹</b><span>Hanada</span></a>
    <span class="sub">Indigo atelier · Kyoto</span>
    <nav class="links"><a href="#" data-noop>Atelier</a><a href="#" data-noop>Dyeing</a><a href="#" data-noop>Visit</a></nav>
    <a href="#" data-noop class="pill">Reserve a vat</a>
  </header>
  <section class="copy">
    <p class="kicker"><span lang="ja">暖簾をくぐる</span><em>noren o kuguru</em> — to step beneath the curtain; to come in.</p>
    <h1>Step through<br>the blue.</h1>
    <p class="lede">Hemp-linen dipped forty times in fermented indigo, then dried in the morning street. Each panel is cut free at the slit, so it parts for whoever comes in and falls softly closed behind them.</p>
    <div class="cta"><button type="button" class="btn walk">Walk in</button><span>Open 7:00 — 17:00</span></div>
    <dl class="facts"><div><dt>Since</dt><dd>1891</dd></div><div><dt>Dips</dt><dd>40</dd></div><div><dt>Cloth</dt><dd>Hemp-linen, 420 g/m²</dd></div></dl>
  </section>
  <aside class="vert" lang="ja">藍染の家　京都・西陣</aside>
  <footer class="foot"><span>Nishijin, Kyoto · 7:12 am</span><span class="hint">Lift a panel · move through · click to walk in</span><span>Nº 02 — Aizome</span></footer>`,
};

const PANELS = 4, PW = 0.34, PH = 1.2, GAP = 0.004, COLS = 13, ROWS = 43, NW = PANELS * PW;
const POLE_Y = 0.6, SLEEVE = 0.03, TOP = POLE_Y - SLEEVE;
// the photo: its doorway spans 29–71% of the width; the lintel's underside is 4.5% from the top
const PLATE = { aspect: 1340 / 2400, doorW: 0.42, door: 0.5, lintel: 0.045 };

const AI = [26, 38, 72], HANADA = [58, 88, 134], FLAX = [222, 209, 183];

function bakeDye(art) {
  const W = 1700, H = Math.round((W * PH) / NW), r = rng(5);
  // ink mask: the picture's darks, auto-levelled so photos work as well as ink paintings
  const mw = 425, mh = Math.round((mw * H) / W), m = canvas(mw, mh), mx = m.getContext("2d");
  mx.fillStyle = "#fff"; mx.fillRect(0, 0, mw, mh);
  drawContain(mx, art, 0.06 * mw, 0.12 * mh, 0.88 * mw, 0.82 * mh);
  const id = mx.getImageData(0, 0, mw, mh), d = id.data, hist = new Uint32Array(256), lum = new Float32Array(mw * mh);
  for (let i = 0; i < mw * mh; i++) { const l = 0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2]; lum[i] = l; hist[l | 0]++; }
  const pct = (p) => { let a = 0; for (let k = 0; k < 256; k++) { a += hist[k]; if (a >= p * mw * mh) return k; } return 255; };
  const lo = pct(0.01), hi = Math.max(lo + 20, pct(0.6));
  for (let i = 0; i < mw * mh; i++) { const v = Math.max(0, Math.min(1, (hi - lum[i]) / (hi - lo))) * 255; d[4 * i] = d[4 * i + 1] = d[4 * i + 2] = v; d[4 * i + 3] = 255; }
  mx.putImageData(id, 0, 0);
  const big = canvas(W, H), bx = big.getContext("2d");
  bx.imageSmoothingQuality = "high";
  bx.drawImage(m, 0, 0, W, H);
  const blur = softBlur(big, 18);
  const bd = bx.getImageData(0, 0, W, H).data, ld = blur.getContext("2d").getImageData(0, 0, W, H).data;
  const out = bx.createImageData(W, H), o = out.data;
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < H; y++) {
    // hand-woven hemp: whole picks of weft run thicker or thinner, giving faint horizontal bars
    const bar = 0.93 + 0.1 * noise3(0.5, y * 0.11, 7) + 0.04 * noise3(1.5, y * 0.6, 8);
    for (let x = 0; x < W; x++) {
      const i = y * W + x, mm = bd[4 * i] / 255, bb = ld[4 * i] / 255;
      // dye wicks along the threads: streaky noise, long in y (warp) and in x (weft)
      const n = 0.6 * noise3(x * 0.9, y * 0.03, 1.7) + 0.4 * noise3(x * 0.03, y * 0.9, 4.1);
      const dye = ss(0.3, 0.64, Math.max(mm, bb * 0.92) + (n - 0.5) * 0.34);
      const halo = Math.max(0, bb - mm) * (1 - dye);
      // slubs: thick spots in the warp, and an uneven hand-spun tone overall
      const slub = 0.06 * Math.max(0, noise3(x * 0.35, y * 0.012, 3) - 0.62) * 6;
      const mott = bar * (0.95 + 0.08 * noise3(x * 0.004, y * 0.004, 9)) + 0.05 * (noise3(x * 0.5, y * 0.01, 3) - 0.5) - slub * 0.6;
      const a = ss(0, 0.45, dye), b = ss(0.45, 1, dye);
      for (let c = 0; c < 3; c++) {
        let v = FLAX[c] * mott;
        v += (HANADA[c] - v) * a;
        v += (AI[c] * (0.9 + 0.14 * n) - v) * b;
        v += (HANADA[c] * 1.15 - v) * halo * 0.4;
        o[4 * i + c] = v;
      }
      o[4 * i + 3] = 255;
    }
  }
  bx.putImageData(out, 0, 0);
  // creases where the cloth was folded in thirds for storage
  for (const fy of [0.37, 0.69]) {
    const y = fy * H;
    const g = bx.createLinearGradient(0, y - 14, 0, y + 14);
    g.addColorStop(0, "rgba(255,248,235,0)"); g.addColorStop(0.42, "rgba(255,248,235,.16)"); g.addColorStop(0.5, "rgba(50,38,25,.2)"); g.addColorStop(0.62, "rgba(50,38,25,.06)"); g.addColorStop(1, "rgba(50,38,25,0)");
    bx.fillStyle = g; bx.fillRect(0, y - 14, W, 28);
  }
  // the indigo band that wraps the pole, with a line of flax stitching under it
  const band = H * 0.07;
  bx.fillStyle = `rgb(${AI})`; bx.fillRect(0, 0, W, band);
  for (let k = 0; k < 1100; k++) { bx.fillStyle = `rgba(${r() < 0.5 ? "8,14,34" : "70,90,140"},${0.08 + r() * 0.12})`; bx.fillRect(r() * W, r() * band, 1 + r() * 2, 4 + r() * 30); }
  bx.strokeStyle = "rgba(226,214,188,.6)"; bx.lineWidth = 2.5; bx.setLineDash([10, 8]);
  bx.beginPath(); bx.moveTo(0, band - 11); bx.lineTo(W, band - 11); bx.stroke(); bx.setLineDash([]);
  // thick folded hems on every panel edge and along the foot
  for (let k = 0; k <= PANELS; k++) {
    const x = (k / PANELS) * W;
    for (const [dx, a] of [[0, 0.2], [7, 0.1], [14, 0.05]]) { bx.fillStyle = `rgba(40,30,20,${a})`; bx.fillRect(x - 3 - dx, band, 6, H); bx.fillRect(x - 3 + dx, band, 6, H); }
  }
  const foot = bx.createLinearGradient(0, H - 34, 0, H);
  foot.addColorStop(0, "rgba(40,30,20,0)"); foot.addColorStop(0.5, "rgba(40,30,20,.12)"); foot.addColorStop(1, "rgba(40,30,20,.3)");
  bx.fillStyle = foot; bx.fillRect(0, H - 34, W, 34);
  // the atelier's persimmon seal, dyed into the last panel
  const s = W * 0.05, sx = W * 0.91, sy = H * 0.87;
  bx.globalAlpha = 0.86; bx.fillStyle = "#c2602a"; bx.fillRect(sx - s / 2, sy - s / 2, s, s);
  bx.fillStyle = "#efe4cf"; bx.font = `800 ${s * 0.72}px 'Shippori Mincho'`; bx.textAlign = "center"; bx.textBaseline = "middle";
  bx.fillText("縹", sx, sy + s * 0.04); bx.globalAlpha = 1;
  return big;
}

export async function create(stage, ctx) {
  const { renderer } = stage;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const [art] = await Promise.all([loadImage(ctx.image ?? "img/noren-art.webp"), loadImage("img/noren-plate.webp"), fontsReady(["800 60px 'Shippori Mincho'"])]);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(renderer), 0.04);
  pmrem.dispose();
  scene.environment = env.texture;

  // ——— four panels ———
  const cloth = new Cloth({
    patches: Array.from({ length: PANELS }, (_, i) => ({
      cols: COLS, rows: ROWS, width: PW - GAP, height: PH, x: -NW / 2 + i * PW + GAP / 2, y: TOP, z: 0,
      u0: i / PANELS + 0.003, u1: (i + 1) / PANELS - 0.003, v0: 1, v1: 0,
    })),
    density: 0.62, substeps: 6, stretch: 0, shear: 1e-4, bend: 0.2, damping: 1.2, kN: 7, kT: 0.3,
    selfCollide: true, thickness: 0.02, contactSoft: 0.5, grabSpeed: 2, maxSpeed: 4, jitter: 0.002,
  });
  for (let p = 0; p < PANELS; p++) for (let c = 0; c < COLS; c++) cloth.pin(p * COLS * ROWS + c);
  cloth.buildTethers(1.0);

  const aniso = renderer.capabilities.getMaxAnisotropy();
  const dye = texture(bakeDye(art), { anisotropy: aniso });
  const weave = weaveMaps(512, 24, 7);
  const weaveN = texture(weave.normal, { srgb: false, repeat: [5, 4.4], anisotropy: aniso });
  const weaveO = texture(weave.open, { srgb: false, repeat: [5, 4.4], anisotropy: aniso });
  const mat = new THREE.MeshPhysicalMaterial({
    map: dye, normalMap: weaveN, normalScale: new THREE.Vector2(2, 2),
    roughness: 0.98, sheen: 0.35, sheenRoughness: 0.85, sheenColor: new THREE.Color("#f3e7d2"),
    envMapIntensity: 0.3, side: THREE.DoubleSide,
  });
  const sunDirView = new THREE.Vector3();
  inject(mat, "noren-linen-2", {
    uniforms: { uSunDir: { value: sunDirView }, uSunCol: { value: new THREE.Color(1, 0.78, 0.52).multiplyScalar(1.5) }, uOpen: { value: weaveO } },
    fragHead: "uniform vec3 uSunDir; uniform vec3 uSunCol; uniform sampler2D uOpen;",
    frag: `{
      // sunlight from the doorway behind comes through the linen: brightest between threads, dimmest under dark indigo
      float back = clamp(-dot(normal, uSunDir), 0.0, 1.0);
      float open = texture2D(uOpen, vNormalMapUv).r;
      outgoingLight += diffuseColor.rgb * uSunCol * (0.16 + 1.05 * open) * (0.1 + 0.9 * back * back);
    }`,
  });
  const geo = clothGeometry(cloth);
  const noren = new THREE.Mesh(geo, mat);
  scene.add(noren);

  // ——— pole, sleeve, brackets ———
  const bamboo = texture(bambooMap(6), { repeat: [1, 1] });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, NW + 0.4, 28), new THREE.MeshStandardMaterial({ map: bamboo, roughness: 0.42, envMapIntensity: 0.6 }));
  pole.rotation.z = Math.PI / 2;
  pole.position.set(0, POLE_Y, 0);
  const sleeveMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(`rgb(${AI})`), normalMap: weaveN, normalScale: new THREE.Vector2(1.6, 1.6), roughness: 0.97, sheen: 0.4, sheenColor: new THREE.Color("#6a7fb0"), envMapIntensity: 0.35 });
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(SLEEVE, SLEEVE, NW, 32, 1, true), sleeveMat);
  sleeve.rotation.z = Math.PI / 2;
  sleeve.position.set(0, POLE_Y, 0);
  const iron = new THREE.MeshStandardMaterial({ color: 0x1a1714, metalness: 0.6, roughness: 0.5 });
  for (const sx of [-(NW / 2 + 0.17), NW / 2 + 0.17]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.08, 0.013), iron);
    b.position.set(sx, POLE_Y + 0.04, -0.01);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0055, 8, 20, Math.PI), iron);
    hook.position.set(sx, POLE_Y, 0); hook.rotation.set(0, Math.PI / 2, Math.PI);
    scene.add(b, hook);
  }
  scene.add(pole, sleeve);

  // ——— light: soft daylight in front, low sun behind ———
  const sun = new THREE.DirectionalLight(0xffd8a4, 2.0);
  sun.position.set(0.35, POLE_Y + 1.4, -2.6);
  // raking daylight from the street side, so folds and the weave read
  const fill = new THREE.DirectionalLight(0xfff1df, 1.6);
  fill.position.set(-2.4, POLE_Y + 1.1, 1.5);
  scene.add(sun, fill, new THREE.HemisphereLight(0xfff5e6, 0xbfa883, 0.6));

  // dust in the light behind the panels
  const motes = makeMotes(260);
  scene.add(motes);

  // ——— colliders: the hand (soft: it eases the cloth aside rather than shoving it), and a person walking through ———
  const hand = { x: 0, y: 0, z: 0.04, r: 0, on: true, k: 0.4 };
  const walker = { x: 0, y: -0.08, z: 1, r: 0.27, on: false };
  cloth.spheres.push(hand, walker);
  let walk = null;
  const pointer = new THREE.Vector3(), prevP = new THREE.Vector3();
  const startWalk = (x) => { walk = { t: 0, x: Math.max(-0.5, Math.min(0.5, x)) }; walker.on = true; };
  ctx.hero.querySelector(".walk")?.addEventListener("click", () => startWalk(0));
  const hitNoren = (e) => {
    const r = stage.rayFrom(e.clientX, e.clientY).intersectObject(noren, false)[0];
    if (!r) return null;
    const f = r.face;
    return { point: r.point, i: cloth.nearest(r.point.x, r.point.y, r.point.z, [f.a, f.b, f.c]) };
  };
  const overNoren = (e) => !!hitNoren(e);
  // press and drag lifts a panel; a quick click without dragging walks in
  let grab = null, sinceRelease = 9;

  const bgPlate = ctx.bg.querySelector(".nr-plate"), bgGlow = ctx.bg.querySelector(".nr-glow");
  let motion = 0, handTarget = 0, speed = 0, T = 0;

  const theme = {
    scene, cloth, parallax: 0.01,
    layout(w, h) {
      // the noren is the subject: as big as the photo area allows; the doorway photo is scaled to frame it
      const m = w < 760 || w / h < 1.05; // portrait screens stack: photo on top, paper below
      const top = Math.round(Math.max(60, h * 0.085));
      const area = m ? { x: 0, y: top, w, h: Math.round(h * 0.62) - top } : { x: Math.round(w * 0.3), y: top, w: w - Math.round(w * 0.3), h: h - top };
      const ppm = Math.min((area.w * (m ? 0.86 : 0.8)) / NW, (area.h * 0.86) / (PH + 0.06));
      let dw = (1.12 * NW * ppm) / PLATE.doorW, dh = dw * PLATE.aspect;
      const cover = Math.max(area.w / dw, area.h / dh, 1);
      dw *= cover; dh *= cover;
      const offX = Math.max(area.w - dw, Math.min(0, area.w / 2 - PLATE.door * dw));
      const offY = 0;
      Object.assign(bgPlate.style, { left: `${area.x}px`, top: `${area.y}px`, width: `${area.w}px`, height: `${area.h}px`, backgroundSize: `${dw}px ${dh}px`, backgroundPosition: `${offX}px ${offY}px` });
      const doorX = area.x + offX + PLATE.door * dw, poleY = area.y + offY + PLATE.lintel * dh + 0.035 * ppm;
      Object.assign(bgGlow.style, { left: `${doorX}px`, top: `${poleY + 0.62 * ppm}px` });
      stage.frame({ center: [0, POLE_Y, 0], ppm, sx: doorX / w, sy: poleY / h, fov: 26 });
    },
    onDown(e) {
      const h = hitNoren(e);
      if (!h || h.i < 0) return;
      grab = { point: h.point.clone(), x: e.clientX, y: e.clientY, at: performance.now(), lifted: false };
      cloth.grab(h.i, 0.06);
      document.body.dataset.cursor = "grabbing";
    },
    onMove(e) {
      if (grab) {
        if (Math.hypot(e.clientX - grab.x, e.clientY - grab.y) > 6) grab.lifted = true;
        const p = stage.onPlane(e.clientX, e.clientY, 0, new THREE.Vector3(), grab.point);
        cloth.drag(p.x, p.y, p.z);
      } else if (!stage.p.touch) document.body.dataset.cursor = overNoren(e) ? "grab" : "";
    },
    onUp(e) {
      if (!grab) return;
      cloth.release();
      sinceRelease = 0;
      // a click rather than a lift: walk in where it was clicked
      if (!grab.lifted && performance.now() - grab.at < 350) startWalk(grab.point.x);
      grab = null;
      document.body.dataset.cursor = e.clientX !== undefined && overNoren(e) ? "grab" : "";
    },
    // physics, 120 times a second
    step(h) {
      T += h;
      // check folds against each other every step while a panel is held or falling back, so none can slip through
      sinceRelease += h;
      cloth.hashEvery = grab || sinceRelease < 3 ? 1 : 2;
      // the hand: a sphere a little in front of the cloth, so it pushes the panels back and apart
      hand.r = smooth(hand.r, grab ? 0 : handTarget, handTarget > hand.r && !grab ? 5 : 3, h);
      hand.x = smooth(hand.x, pointer.x, 14, h);
      hand.y = smooth(hand.y, pointer.y, 14, h);
      if (walk) {
        walk.t += h / 1.9;
        const e = walk.t < 1 ? 0.5 - 0.5 * Math.cos(Math.PI * walk.t) : 1;
        walker.x = walk.x; walker.z = 0.75 - 1.8 * e;
        if (walk.t >= 1) { walk = null; walker.on = false; }
      }
      // a draft from the courtyard in slow gusts, different from panel to panel, so the four move on their own
      const g = 0.65 + 0.35 * Math.sin(T * 0.19) * Math.sin(T * 0.11 + 1.4);
      cloth.fillWind((x, y, z, o) => {
        o[2] = 0.03 + 0.36 * g * noise3(x * 3.2 + 7, y * 0.8 - T * 0.26, T * 0.18);
        o[0] = 0.1 * (noise3(x * 3.2 + 11, y * 0.8, T * 0.15) - 0.5);
      });
      cloth.step(h);
    },
    update(dt) {
      const p = stage.p;
      if (p.active) stage.onPlane(p.x, p.y, 0, pointer);
      speed = smooth(speed, pointer.distanceTo(prevP) / Math.max(dt, 1e-3), 8, dt);
      prevP.copy(pointer);
      const inside = p.active && Math.abs(pointer.x) < NW / 2 + 0.1 && pointer.y < TOP + 0.05 && pointer.y > TOP - PH - 0.1;
      handTarget = inside ? 0.24 : 0;
      syncGeometry(geo);
      sunDirView.copy(sun.position).normalize().transformDirection(stage.camera.matrixWorldInverse);
      motes.material.uniforms.uTime.value += dt;
      // how much the linen is moving, for the rustle
      let v = 0;
      for (let i = 0; i < cloth.n; i += 7) v += Math.abs(cloth.vel[3 * i + 2]);
      motion = smooth(motion, v / (cloth.n / 7), 6, dt);
      ctx.audio.rustle(Math.max(0, motion - 0.03) * 1.6 + speed * 0.02 * hand.r * 8);
    },
    setImage(img) {
      dye.image = bakeDye(img);
      dye.needsUpdate = true;
    },
    dispose() {
      document.body.dataset.cursor = "";
      disposeScene(scene);
      env.dispose();
    },
  };

  // settle before anyone sees it
  for (let i = 0; i < 360; i++) theme.step(1 / 120);
  syncGeometry(geo);
  return theme;
}

// warm specks drifting slowly through the light behind the noren
function makeMotes(n) {
  const r = rng(21), pos = new Float32Array(3 * n), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[3 * i] = (r() - 0.5) * 1.7; pos[3 * i + 1] = -0.8 + r() * 1.4; pos[3 * i + 2] = -0.15 - r() * 0.9; seed[i] = r(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: window.devicePixelRatio || 1 } },
    vertexShader: `attribute float seed; uniform float uTime; uniform float uScale; varying float vA;
      void main(){
        vec3 p = position;
        p.y += mod(uTime * (0.012 + 0.02 * seed) + seed * 1.3, 1.3) - 0.3;
        p.x += 0.05 * sin(uTime * 0.3 + seed * 40.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.5 + 2.5 * seed) * uScale * (3.0 / -mv.z);
        vA = 0.25 + 0.5 * fract(seed * 7.13);
      }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(1.0, 0.86, 0.62, vA * smoothstep(0.5, 0.0, d)); }`,
  });
  return new THREE.Points(g, m);
}
