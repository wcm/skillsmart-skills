// Mosaic: one picture made of tiles.
//   tiles  a grid of tiles as tall as the screen. It starts as many pictures, one on each tile; then waves of tiles
//          turn over one at a time, each wave making one picture of the whole grid, so in between it is made of two.
//          It can fold up like a map into the closed book that comes next.
//   cube   a picture on each face of a glass cube, cut into nine; it scrambles, turns once round and solves itself.
import * as THREE from "three";
import { Pose, TAU, X, Y, Z, view, lerp, clamp, smooth, ease, easeOut, easeIn, hash, stagger, facing, centreOf } from "./common.js";

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _e = new THREE.Euler();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _m = new THREE.Matrix4();

// ── tiles ───────────────────────────────────────────────────────────────────────────────────────────────────────
export function tiles(cfg, page, set) {
  const COLS = cfg.cols ?? 4, ROWS = cfg.rows ?? 5, n = COLS * ROWS;
  const looks = set.looks;                                                 // the pictures the waves make, as item numbers
  const W = looks.length, START = 0.07, SPAN = 0.86 / Math.max(1, W), DUR = Math.min(0.09, SPAN * 0.62), SPREAD = Math.min(0.07, SPAN * 0.45);
  const figAspect = cfg.aspect ?? set.lookAspect ?? 2 / 3;                 // the grid's shape: the pictures' own
  let cw = 1, ch = 1;
  const delay = (c, r) => ((c + r) / (COLS + ROWS - 2)) * SPREAD;
  // how far the tile has turned: one half turn per wave
  const turned = (c, r, t) => { let f = 0; for (let i = 0; i < W; i++) f += clamp((t - START - i * SPAN - delay(c, r)) / DUR); return f; };
  const part = (c, r) => [c / COLS, (ROWS - 1 - r) / ROWS, 1 / COLS, 1 / ROWS];
  // the picture tile b shows at stage j: its own whole picture at 0, then each look's part of the grid; a "mix" look is
  // a patchwork, every tile taking its part from a different picture
  const lookAt = (j, b) => (j === 0 ? -1 : looks[Math.min(j, W) - 1] === "mix" ? set.k[(b * 7 + 3) % set.k.length] : looks[Math.min(j, W) - 1]);
  // what tile b shows on its two sides when it has turned f: stage i going, i + 1 coming
  function faces(b, f, o) {
    const c = b % COLS, r = Math.floor(b / COLS), i = Math.min(Math.floor(f), W), even = i % 2 === 0;
    const pic = (j) => lookAt(j, b);
    const going = pic(i), coming = pic(Math.min(i + 1, W));
    const [px, py, pw, ph] = part(c, r);
    const setFront = (k) => { o.img = k; if (k < 0) { o.part(0, 0, 1, 1); o.face = 0; } else { o.part(px, py, pw, ph); o.face = figAspect; } };
    const setBack = (k) => { o.imgB = k < 0 ? set.k[b] : k; if (k < 0) { o.partB(0, 0, 1, 1); o.faceB = 0; } else { o.partB(px, py, pw, ph); o.faceB = figAspect; } };
    if (even) { setFront(going); setBack(coming); } else { setFront(coming); setBack(going); }
  }
  const self = {
    hold: cfg.hold ?? 1.6,
    looksAt: looks,
    setup(ctx) {
      let FH = ctx.H * (ctx.mobile ? 0.84 : 0.95), FW = FH * figAspect;
      if (FW > ctx.sw * 0.98) { FW = ctx.sw * 0.98; FH = FW / figAspect; }
      cw = FW / COLS; ch = FH / ROWS;
    },
    view: (t, ctx) => {
      const yaw = lerp(-0.09, 0.09, t);
      return view([Math.sin(yaw) * ctx.D, lerp(0.35, -0.35, t), Math.cos(yaw) * ctx.D], [0, 0, 0], 40, 0.02);
    },
    tile: (b, out) => out.set((b % COLS - (COLS - 1) / 2) * cw, ((ROWS - 1) / 2 - Math.floor(b / COLS)) * ch, 0),
    pose(b, t, ctx, o) {
      const c = b % COLS, r = Math.floor(b / COLS), f = turned(c, r, t), u = f - Math.floor(f);
      self.tile(b, o.p);
      o.p.z = 0.55 * Math.sin(Math.PI * u) * (f < W ? 1 : 0);              // a turning tile lifts toward you
      // glazed tiles: a gap between them, a thick body, a wet glaze and a rounded bevel
      o.w = cw * 0.962; o.h = ch * 0.962; o.radius = ch * 0.035; o.shade = 0.3; o.mat = 3; o.thick = ch * 0.09; o.gloss = 0.3; o.edgeTint = 0.25;
      o.flip = f; faces(b, f, o);
      o.q.setFromAxisAngle(Z, 0.05 * Math.sin(Math.PI * u) * (hash(b) - 0.5));
    },
    // in: each tile turns in from edge on, from the middle out; out: it turns away
    enter(b, e, ctx, o) {
      const c = b % COLS, r = Math.floor(b / COLS), d = Math.hypot(c - (COLS - 1) / 2, r - (ROWS - 1) / 2) / Math.hypot((COLS - 1) / 2, (ROWS - 1) / 2);
      const u = easeOut(clamp((e - d * 0.45) / 0.55));
      if (u <= 0) { o.hide(); return; }
      o.flip -= 0.5 * (1 - u); o.w *= lerp(0.6, 1, u); o.h *= lerp(0.6, 1, u);
    },
    exit(b, x, ctx, o) { const u = easeIn(stagger(x, b, n, 0.5)); o.flip += 0.5 * u; o.w *= 1 - u * 0.4; o.h *= 1 - u * 0.4; if (u >= 1) o.hide(); },
    focus: (b) => null,
    // ── the fold: the grid folds up like a map (the columns, then the rows), and the packet lands as the next scene's
    // closed book, the top tile opening out into the whole cover. m: 0–1 through the change; cover: the book's cover pose
    fold(b, m, ctx, o, cover) {
      const c = b % COLS, r = Math.floor(b / COLS), f = ease(smooth(0, 0.34, m)), g = ease(smooth(0.3, 0.62, m)), land = ease(smooth(0.6, 0.88, m));
      // across: the columns fold in a zigzag behind the first; panel j turns −π·f about its hinge (odd ones), the
      // even ones stay facing you; the hinges are chained from the left edge
      const chain = (j, a) => (j % 2 ? -Math.PI * a : 0);
      let hx = -(COLS / 2) * cw, hz = 0, minX = hx, maxX = hx;
      const hinges = [];
      for (let j = 0; j < COLS; j++) {
        hinges.push([hx, hz]);
        const ph = chain(j, f); hx += cw * Math.cos(ph); hz += cw * Math.sin(ph);
        minX = Math.min(minX, hx); maxX = Math.max(maxX, hx);
      }
      const [x0, z0] = hinges[c], phC = chain(c, f), shiftX = -(minX + maxX) / 2;
      _q.setFromAxisAngle(Y, -phC);
      const y = ((ROWS - 1) / 2 - r) * ch;
      _v.set(cw / 2, 0, 0).applyQuaternion(_q).add(_v2.set(x0 + shiftX, y, z0));
      // down: the folded strip's rows fold the same way, behind the top one
      const rchain = (j, a) => (j % 2 ? -Math.PI * a : 0);
      let vy = (ROWS / 2) * ch, vz = 0, minY = vy, maxY = vy;
      const rh = [];
      for (let j = 0; j < ROWS; j++) {
        rh.push([vy, vz]);
        const ph = rchain(j, g); vy -= ch * Math.cos(ph); vz += ch * Math.sin(ph);
        minY = Math.min(minY, vy); maxY = Math.max(maxY, vy);
      }
      const [y0, rz0] = rh[r], phR = rchain(r, g), shiftY = -(minY + maxY) / 2, topR = (ROWS / 2 - r) * ch;
      _q2.setFromAxisAngle(X, -phR);
      _v3.set(_v.x, _v.y - topR, _v.z).applyQuaternion(_q2);
      // folded, every tile lies a hair behind the one before it, so the top-left one stays on top
      o.p.set(_v3.x, _v3.y + y0 + shiftY, _v3.z + rz0 - c * 0.01 * f - r * 0.045 * g);
      o.q.copy(_q2).multiply(_q);
      o.w = cw * 0.962; o.h = ch * 0.962; o.radius = ch * 0.035 * (1 - land); o.shade = 0.3; o.flip = 0; o.mat = 3; o.thick = ch * 0.09 * (1 - land) + 0.01; o.gloss = 0.3;
      faces(b, W, o);
      o.imgB = -1; o.partB(0, 0, 1, 1); o.faceB = 0;                         // a folded tile shows its plain back
      // land: the packet flies to the cover; the top tile opens out into the whole picture as it goes
      if (land > 0) {
        centreOf(cover, _v);
        const sx = cover.w / (cw * 0.962), sy = cover.h / (ch * 0.962);
        o.p.set(o.p.x * lerp(1, sx, land), o.p.y * lerp(1, sy, land), o.p.z);
        o.p.applyQuaternion(_q3.identity().slerp(cover.q, land)).add(_v2.copy(_v).multiplyScalar(land));
        o.q.premultiply(_q3);
        if (b === 0) { o.w = lerp(o.w, cover.w, land); o.h = lerp(o.h, cover.h, land); o.part(lerp(o.sx, 0, land), lerp(o.sy, 0, land), lerp(o.sw, 1, land), lerp(o.sh, 1, land)); o.face = lerp(figAspect, cover.w / cover.h, land); }
        else { o.w *= lerp(1, sx, land); o.h *= lerp(1, sy, land); }
      }
    },
    props: {
      // the grid's lines, carried on past the pictures across the whole screen
      build(g, ctx, look) {
        this.l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: look.ink, transparent: true, opacity: 0.1, depthWrite: false }));
        this.l.frustumCulled = false; this.l.userData.opacity = 0.1; this.l.renderOrder = -8;
        g.add(this.l); this.key = "";
      },
      update(w, t, ctx) {
        const key = `${cw}:${ch}:${ctx.W}`;
        if (key !== this.key) {
          this.key = key;
          const pts = [], X0 = -(COLS / 2) * cw, Y0 = (ROWS / 2) * ch, ex = ctx.W * 0.8, ey = ctx.H * 0.8;
          for (let k = -Math.ceil(ex / cw); k <= COLS + Math.ceil(ex / cw); k++) pts.push(X0 + k * cw, -ey - Y0, -0.05, X0 + k * cw, ey + Y0, -0.05);
          for (let k = -Math.ceil(ey / ch); k <= ROWS + Math.ceil(ey / ch); k++) pts.push(-ex + X0, Y0 - k * ch, -0.05, ex - X0, Y0 - k * ch, -0.05);
          this.l.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
        }
        this.l.material.opacity = 0.1 * w;
      },
    },
  };
  return self;
}

// ── cube ────────────────────────────────────────────────────────────────────────────────────────────────────────
// Each face is one picture, cut into nine stickers (the cube's slots are its 54 stickers). It gathers out of the air
// into a cube, scrambles, turns once round and solves itself, then flies apart again.
export function cube(cfg, page, set) {
  const MOVES = ["R", "U'", "F"];
  const AX = { R: [X, 1, -1], L: [X, -1, 1], U: [Y, 1, -1], D: [Y, -1, 1], F: [Z, 1, -1], B: [Z, -1, 1] };
  const inv = (m) => (m.endsWith("'") ? m[0] : m + "'");
  const PITCH = 0.5, YAW = -0.72, A = 0.12;
  const FACES = [[Z, Y], [X, Y], [Z.clone().negate(), Y], [X.clone().negate(), Y], [Y, Z.clone().negate()], [Y.clone().negate(), Z]];
  const key = (a) => (a[0] + 1) * 9 + (a[1] + 1) * 3 + (a[2] + 1);
  const cubies = Array.from({ length: 27 }, (_, i) => ({ home: [Math.floor(i / 9) - 1, Math.floor(i / 3) % 3 - 1, (i % 3) - 1], p: new THREE.Vector3(), q: new THREE.Quaternion() }));
  const stickers = [];
  FACES.forEach(([nrm, up], f) => {
    const x = new THREE.Vector3().crossVectors(up, nrm), y = new THREE.Vector3().crossVectors(nrm, x);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const at = nrm.clone().add(x.clone().multiplyScalar(c - 1)).add(y.clone().multiplyScalar(1 - r)).round();
      stickers.push({ f, n: nrm, up, c: cubies[key([at.x, at.y, at.z])], sub: [c / 3, (2 - r) / 3, 1 / 3, 1 / 3] });
    }
  });
  const faces = set.k.slice(0, 6);
  while (faces.length < 6) faces.push(set.k[faces.length % Math.max(1, set.k.length)]);
  const scatter = stickers.map((s, e) => ({
    dir: new THREE.Vector3(hash(e * 3.1) - 0.5, hash(e * 5.7) - 0.5, hash(e * 7.3) - 0.5).multiplyScalar(0.9),
    far: 4 + 5 * hash(e * 1.7), axis: new THREE.Vector3(hash(e * 2.3) - 0.5, hash(e * 4.1) - 0.5, hash(e * 6.7) - 0.5).normalize(), turn: (hash(e * 8.9) - 0.5) * 5, rank: hash(e * 9.7),
  }));
  const cubeQ = new THREE.Quaternion(), centre = new THREE.Vector3();
  let size = 1.5, gap = 1;
  function twist(m, amount) {
    const [axis, layer, dir] = AX[m[0]], d = m.endsWith("'") ? -dir : dir;
    _q.setFromAxisAngle(axis, ((d * Math.PI) / 2) * amount);
    for (const c of cubies) if (Math.round(c.p.dot(axis)) === layer) { c.p.applyQuaternion(_q); c.q.premultiply(_q); }
    if (amount === 1) for (const c of cubies) c.p.set(Math.round(c.p.x), Math.round(c.p.y), Math.round(c.p.z));
  }
  // taken apart like an exploded drawing: each face's stickers move out along the face's own direction and a little
  // apart, then fly on outward, tumbling, and shrink away. u: 0 whole, 1 gone
  const _fcN = new THREE.Vector3(), _fcC = new THREE.Vector3();
  const apart = (o, e, u) => {
    const s = scatter[e], k1 = smooth(0, 0.45, u), k2 = smooth(0.35 + 0.25 * s.rank, 1, u);
    _fcN.copy(stickers[e].n).applyQuaternion(cubeQ);
    _fcC.copy(_fcN).multiplyScalar(size * 1.5).add(centre);
    o.p.add(_v3.copy(o.p).sub(_fcC).multiplyScalar(0.22 * k1));
    o.p.addScaledVector(_fcN, size * (1.4 * k1 + s.far * 0.9 * k2));
    o.p.addScaledVector(_v3.copy(s.dir), size * 3 * k2);
    o.q.premultiply(_q3.setFromAxisAngle(s.axis, s.turn * 0.35 * k2));
    o.w *= 1 - k2; o.h *= 1 - k2;
  };
  const spin = { yaw: 0, pitch: 0 };
  const self = {
    hold: cfg.hold ?? 1.5, turnable: true, spin,
    slots: stickers.map((s) => faces[s.f]),
    view: (t, ctx) => view([0, 0.4, 13.2], [0, 0.1, 0], 40, 0.04),
    pivot: () => centre.clone(),
    hero: (t) => 0,
    setup(ctx) { size = Math.min(ctx.H * 0.175, ctx.sw * (ctx.mobile ? 0.25 : 0.17)); },
    prepare(t, ctx) {
      for (const c of cubies) { c.p.set(...c.home); c.q.identity(); }
      const n = MOVES.length, run = (seq, u) => seq.forEach((m, i) => { const f = clamp(u - i); if (f > 0) twist(m, f >= 1 ? 1 : ease(f)); });
      // the moves are slow and eased, with a pause between them; the scramble, a rest, then the solve
      const slow = (u) => { const i = Math.floor(u), f = u - i; return i + ease(clamp((f - 0.12) / 0.76)); };
      if (t <= 0.5) run(MOVES, slow(clamp((t - A) / (0.46 - A)) * n));
      else { run(MOVES, n); run(MOVES.slice().reverse().map(inv), slow(clamp((t - 0.54) / (0.46 - A)) * n)); }
      gap = lerp(0.9, 1, Math.max(1 - smooth(0, 0.07, t), smooth(0.93, 1, t)));   // the stickers part a little, and close again at the end
      // a slow half turn over the whole stretch, a gentle nod, a slight drift with time
      cubeQ.setFromEuler(_e.set(PITCH + spin.pitch + 0.1 * Math.sin(Math.PI * t), YAW + spin.yaw - Math.PI * ease(t) + 0.08 * Math.sin(ctx.time * 0.21), 0, "XYZ"));
      centre.set(0, 0.15 + 0.12 * Math.sin(ctx.time * 0.6), 0);
    },
    pose(e, t, ctx, o) {
      const s = stickers[e], c = s.c;
      _v.copy(s.n).applyQuaternion(c.q).multiplyScalar(size / 2 + 0.006).add(_v2.copy(c.p).multiplyScalar(size));
      o.p.copy(_v).applyQuaternion(cubeQ).add(centre);
      o.q.copy(cubeQ).multiply(c.q).multiply(facing(_q2, s.n, s.up));
      o.w = o.h = size * gap;
      o.part(...s.sub); o.face = 1;
      o.radius = size * 0.1 * clamp((1 - gap) * 10); o.shade = 0.3; o.sheen = 0.12; o.sheenPow = 20;
    },
    // in: the pieces gather out of the air into an exploded view and close into a cube; out: it comes apart the same way
    enter(e, u, ctx, o) { apart(o, e, 1 - u); o.twoSided = 1; },
    exit(e, x, ctx, o) { apart(o, e, x); o.twoSided = 1; },
    focus(b) {
      const f = [[-PITCH, -YAW], [-PITCH, -Math.PI / 2 - YAW], [-PITCH, Math.PI - YAW], [-PITCH, Math.PI / 2 - YAW], [Math.PI / 2 - PITCH, -YAW], [-Math.PI / 2 - PITCH, -YAW]][stickers[b].f];
      return { t: 0.04, spin: { pitch: f[0], yaw: f[1] } };
    },
    props: {
      // the cubies: frosted glass, there only while the stickers are apart, so the faces fly in and out clean
      build(g, ctx, look) {
        const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.3, depthWrite: false });
        this.box = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, 27);
        this.box.frustumCulled = false; this.opacity = mat.opacity;
        g.add(this.box);
      },
      update(w, t, ctx) {
        const show = clamp((1 - gap) * 10) * (w >= 1 ? 1 : 0);
        cubies.forEach((c, i) => {
          _v.copy(c.p).multiplyScalar(size).applyQuaternion(cubeQ).add(centre);
          _q.copy(cubeQ).multiply(c.q);
          this.box.setMatrixAt(i, _m.compose(_v, _q, _v2.setScalar(size * 0.97 * Math.max(show, 0.001))));
        });
        this.box.instanceMatrix.needsUpdate = true;
        this.box.material.opacity = this.opacity * show;
        this.box.visible = show > 0.01;
      },
    },
  };
  return self;
}
