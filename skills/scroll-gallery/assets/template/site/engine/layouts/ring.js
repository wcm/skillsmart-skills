// Ring: pictures on a circle. How the circle tilts and which way the pictures face make the variants.
//   arc       the circle faces you, far bigger than the screen; the pictures sit on its rim like a rainbow and roll
//   band      the circle tilts back; the pictures stand round it facing out, bent to it, turning in haze
//   surround  you stand inside it near its back, with a wide lens: huge at both edges, small straight ahead
//   platter   the pictures stand round a spinning record on a walnut player, bent to the ring
//   wheel     records on edge round an upright axis, like a jukebox; the one that comes round to you opens wide
import * as THREE from "three";
import { Pose, TAU, X, Y, Z, view, lerp, clamp, smooth, ease, hash, wrap, wrapPi, stagger, arrive, depart, easeOut, easeIn, facing, softShadow, shadowSet, woodMat, solidMat, solidity } from "./common.js";

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _n = new THREE.Vector3();
const nearest = (n, angleOf) => { let best = 0, bd = Infinity; for (let b = 0; b < n; b++) { const d = Math.abs(angleOf(b)); if (d < bd) { bd = d; best = b; } } return best; };

// ── arc ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export function arc(cfg, page, set) {
  const n = set.n;
  const sc = (ctx) => Math.min(1, ctx.sw / 15.5);
  const R = (ctx) => (ctx.mobile ? 4.6 : 7.4 * sc(ctx));
  const cardH = (ctx) => (ctx.mobile ? Math.min(2.4, (ctx.sw * 0.4) / ctx.meanAspect) : 3.1 * sc(ctx));
  const top = (ctx) => (ctx.mobile ? 1.6 : 3.3 * sc(ctx));                // the rim's highest point
  const step = (ctx) => (cardH(ctx) * ctx.meanAspect * 1.3) / R(ctx);
  const side = (ctx) => Math.min((n - 1) / 2, ctx.mobile ? 1.6 : 3.2);     // how many steps either side of the top are in view
  const centre = (t, ctx) => lerp(side(ctx), n - 1 - side(ctx), t);
  const angle = (b, t, ctx) => (b - centre(t, ctx)) * step(ctx);
  const C = (ctx, out) => out.set(0, top(ctx) - R(ctx), 0);
  // a flat card on the rim, turned along it: sharp at the top, a little softer and darker down each side
  function place(b, a, ctx, o) {
    const r = R(ctx);
    if (Math.abs(a) > 2.0) { o.hide(); return; }
    C(ctx, o.p).add(_v.set(Math.sin(a) * r, Math.cos(a) * r, 0));
    o.q.setFromAxisAngle(Z, -a);
    o.h = cardH(ctx); o.w = o.h * set.aspect[b];
    o.radius = 0.09; o.shade = 0.1; o.thick = 0.03; o.gloss = 0.14;
    const off = Math.abs(a) / step(ctx);
    o.blur = Math.min(2.2, Math.max(0, off - 0.6) * 0.9); o.dim = 0.25 * smooth(0.8, 3.4, off);
  }
  return {
    hold: cfg.hold ?? 1.3,
    view: (t, ctx) => view([0, 0, ctx.D * lerp(1.03, 0.98, t)], [0, 0, 0], 40, 0.02),
    pivot: () => new THREE.Vector3(0, 0, 0),
    hero: (t, ctx) => nearest(n, (b) => angle(b, t, ctx)),
    // the top picture's name, in the middle of the arc
    feature: (t, ctx) => ({ b: nearest(n, (b) => angle(b, t, ctx)), at: new THREE.Vector3(0, top(ctx) - R(ctx) * (ctx.mobile ? 0.62 : 0.55), 0) }),
    pose(b, t, ctx, o) { place(b, angle(b, t, ctx), ctx, o); },
    // in: rolled on round the rim from the right; out: rolled off to the left
    enter(b, e, ctx, o) { place(b, angle(b, 0, ctx) + (1 - easeOut(stagger(e, b, n, 0.45))) * 1.1, ctx, o); },
    exit(b, x, ctx, o) { place(b, angle(b, 1, ctx) - easeIn(stagger(x, b, n, 0.45)) * 1.1, ctx, o); },
    focus: (b, ctx) => ({ t: clamp((b - side(ctx)) / Math.max(1, n - 1 - 2 * side(ctx))) }),
  };
}

// ── band ────────────────────────────────────────────────────────────────────────────────────────────────────────
export function band(cfg, page, set) {
  const n = set.n, front = cfg.front ?? 0;
  const tilt = new THREE.Quaternion().setFromAxisAngle(Z, 0.22).multiply(new THREE.Quaternion().setFromAxisAngle(X, 0.42));
  const R = (ctx) => (ctx.mobile ? 3.6 : 6.4);
  const C = (ctx) => _c.set(0, ctx.mobile ? 0 : -0.2, ctx.mobile ? -0.6 : -1.2);
  const _c = new THREE.Vector3();
  const size = (ctx) => (TAU * R(ctx) / n) * 0.92;                        // each picture's width, a narrow gap between
  const angle = (b, t, ctx) => ((b - front) / n) * TAU - t * TAU * 0.42 - ctx.time * 0.03;
  const self = {
    hold: cfg.hold ?? 1.3,
    view: (t, ctx) => view([0, lerp(0.9, 0.3, t), ctx.D * lerp(1, 0.94, t)], [0, -0.1, 0], 40, 0.03),
    pivot: (t, ctx) => C(ctx).clone(),
    hero: (t, ctx) => nearest(n, (b) => wrapPi(angle(b, t, ctx))),
    pose(b, t, ctx, o) {
      const a = angle(b, t, ctx), r = R(ctx);
      _n.set(Math.sin(a), 0, Math.cos(a)).applyQuaternion(tilt);
      o.p.copy(_n).multiplyScalar(r).add(C(ctx));
      facing(o.q, _n, _v.set(0, 1, 0).applyQuaternion(tilt));
      o.w = size(ctx); o.h = o.w / set.aspect[b];
      o.k = 1 / r; o.twoSided = 1; o.shade = 0.3; o.radius = -1;
      // the far side, seen from behind through the ring, sinks back into the haze
      const toward = _n.dot(_v.copy(ctx.cam.p).sub(o.p).normalize());
      o.dim = 0.5 * smooth(0.15, -0.6, toward); o.blur = 3 * smooth(0.1, -0.5, toward);
      o.fog = 0.35; o.fogNear = 10; o.fogFar = 26;
    },
    enter(b, e, ctx, o) { const u = stagger(e, b, n, 0.5); o.w *= easeOut(u); o.h *= easeOut(u); },
    exit(b, x, ctx, o) { const u = stagger(x, b, n, 0.5); o.w *= 1 - easeIn(u); o.h *= 1 - easeIn(u); },
    focus: (b, ctx) => ({ t: clamp(wrap(((b - front) / n) * TAU - ctx.time * 0.03, TAU) / (TAU * 0.42)) }),
  };
  return self;
}

// ── surround: the runway ────────────────────────────────────────────────────────────────────────────────────────
// The ring holds `ring` places (7 by default) but carries any number of looks: they come round from the right, pass
// in front of you, grow as they pass you and go on round behind. On a phone the ring stands on end.
const SHOW = 2.15, GONE = 2.45;                                            // past the edge of the view, long before a look would reach you
export function surround(cfg, page, set) {
  const n = set.n, step = TAU / (cfg.ring ?? 7), cloth = !!cfg.cloth;
  const R = (ctx) => (ctx.mobile ? 4.2 : 6.2);
  const back = (ctx) => (ctx.mobile ? 0.82 : 0.92);                       // where the camera stands, from the axis toward the near side (× R)
  const slot = (ctx) => R(ctx) * step * 0.93;
  const size = (ctx) => (ctx.mobile ? slot(ctx) : slot(ctx) / ctx.meanAspect);
  const c0 = Math.min(Math.floor(SHOW / step), (n - 1) / 2);
  const centre = (t) => lerp(c0, n - 1 - c0, t);
  const angle = (b, t) => (b - centre(t)) * step;
  function place(b, a, ctx, o) {
    const r = R(ctx), gone = 1 - smooth(SHOW, GONE, Math.abs(a)), h = size(ctx) * gone;
    a = clamp(a, -GONE, GONE);
    if (ctx.mobile) { o.w = h * set.aspect[b]; o.h = h; o.p.set(0, Math.sin(a) * r, -Math.cos(a) * r); o.q.setFromAxisAngle(X, a); }
    else { o.h = h; o.w = h * set.aspect[b]; o.p.set(Math.sin(a) * r, 0, -Math.cos(a) * r); o.q.setFromAxisAngle(Y, -a); o.k = -1 / r; }
    o.shade = 0.3; o.radius = 0.02;
    // silk panels hanging from the rail (on a phone the ring stands on end, so they stay stiff)
    if (cloth && !ctx.mobile) { o.cloth = 1; o.mat = 1; o.gloss = 0.16; o.thick = 0.012; o.sheen = 0.05; o.sheenPow = 12; }
  }
  // in and out like a curtain: the ring parts in the middle and each half slides off round its own side (out),
  // or closes in from both sides (in); a look that was out of view stays out of it
  const curtain = (b, t, u, ctx, o) => {
    const a = angle(b, t);
    o.reset();
    if (Math.abs(a) > SHOW) { o.hide(); return; }
    place(b, a + (a < 0 || (a === 0 && b % 2) ? -1 : 1) * (GONE + 0.1 - Math.abs(a) * 0.15) * u, ctx, o);
  };
  const self = {
    hold: cfg.hold ?? 1.5, exitLen: 0.55,
    view: (t, ctx) => view([0, 0, R(ctx) * back(ctx)], [0, 0, -R(ctx)], ctx.mobile ? 76 : 80, 0.12),
    hero: (t) => nearest(n, (b) => angle(b, t)),
    pose(b, t, ctx, o) { place(b, angle(b, t), ctx, o); },
    enter(b, e, ctx, o) { curtain(b, 0, 1 - easeOut(e), ctx, o); },
    exit(b, x, ctx, o) { curtain(b, 1, easeIn(x), ctx, o); },
    floor: (t, ctx) => (ctx.mobile ? null : { y: -size(ctx) / 2 - 0.12, s: 0.3, f: 3.4 }),
    focus: (b) => ({ t: clamp((b - c0) / Math.max(1, n - 1 - 2 * c0)) }),
    // the rail the silk hangs from: a thin steel ring along the panels' top edges, with a ring clip at each
    props: cloth ? {
      build(g) {
        this.rail = new THREE.Mesh(new THREE.TorusGeometry(1, 0.0055, 10, 240), solidMat("#9ea0a3", 0.9));
        this.clips = Array.from({ length: n * 3 }, () => new THREE.Mesh(new THREE.TorusGeometry(1, 0.28, 8, 24), solidMat("#b9bbbe", 0.9)));
        g.add(this.rail, ...this.clips);
        this.parts = [this.rail, ...this.clips];
      },
      update(w, t, ctx) {
        const r = R(ctx), top = size(ctx) / 2, show = !ctx.mobile;
        this.rail.visible = show;
        this.rail.position.set(0, top + 0.08, 0); this.rail.rotation.set(Math.PI / 2, 0, 0); this.rail.scale.setScalar(r);
        this.clips.forEach((m, i) => {
          const b = Math.floor(i / 3), o = ctx.cardPose(self.index, b);
          if (!o || !show || o.cloth < 0.5) { m.visible = false; return; }
          const a = angle(b, t) + ((i % 3) - 1) * (o.w / r) * 0.42;
          m.visible = true; m.position.set(Math.sin(a) * r, top + 0.02, -Math.cos(a) * r); m.rotation.set(0, -a, 0); m.scale.setScalar(0.07);
        });
        solidity(this.parts, Math.min(1, w * 1.5));
      },
    } : null,
  };
  return self;
}

// ── platter: a walnut record player, its record spinning; the covers stand round it, facing out, bent to the ring ──
export function platter(cfg, page, set) {
  const n = set.n;
  const deck = (ctx) => Math.min(1, ctx.sw / (ctx.mobile ? 8.4 : 12.4), ctx.H / 10);
  const FLOOR = -2.4, ringR = (ctx) => 5.6 * deck(ctx), coverS = (ctx) => 2.9 * deck(ctx);
  const PW = 6.0, PD = 4.7, PH = 0.62, PLATTER = 2.05;                    // the plinth and the platter, × deck
  const turn = (t, ctx) => t * TAU * 0.75 + ctx.time * 0.12;
  const front = (t, ctx) => nearest(n, (b) => wrapPi((b / n) * TAU + turn(t, ctx) - Math.PI / 2));
  const self = {
    hold: cfg.hold ?? 1.3,
    view: (t, ctx) => view([0, lerp(3.6, 2.9, t), lerp(12.6, 11.8, t)], [0, -1.1, 0], 44, 0.06),
    pivot: (t, ctx) => new THREE.Vector3(0, FLOOR * deck(ctx) + coverS(ctx) / 2, 0),
    hero: front,
    pose(b, t, ctx, o) {
      const s = coverS(ctx), Rr = ringR(ctx), a = (b / n) * TAU + turn(t, ctx);
      _n.set(Math.cos(a), 0, Math.sin(a));
      o.p.set(_n.x * Rr, FLOOR * deck(ctx) + s / 2 + 0.01, _n.z * Rr);
      facing(o.q, _n, Y);
      o.w = o.h = s; o.k = 1 / Rr; o.shade = 0.32; o.twoSided = 1;
    },
    // in: the covers rise out of the floor round the player one by one; out: they lift away up out of view
    enter(b, e, ctx, o) { o.p.y -= (o.h + 0.3) * (1 - easeOut(stagger(e, b, n, 0.6))); o.clip = FLOOR * deck(ctx); },
    exit(b, x, ctx, o) { depart(o, easeIn(stagger(x, b, n, 0.5)), (a) => { a.p.x *= 1.35; a.p.z = a.p.z * 1.2 - 2; a.p.y += 9 * deck(ctx); }); },
    focus: (b, ctx) => ({ t: clamp(wrap(Math.PI / 2 - (b / n) * TAU - ctx.time * 0.12, TAU) / (TAU * 0.75)) }),
    props: {
      build(g, ctx, look) {
        const wood = ctx.sceneTex("walnut");
        this.g = g;
        this.plinth = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), woodMat(wood, [1, 1], 1.05));
        this.platter = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96), solidMat("#9a9a96", 0.35));
        // the record: grooves, a sheen that stays with the light, the label printed with the cover in front
        this.disc = new THREE.Mesh(new THREE.CircleGeometry(1, 128), new THREE.ShaderMaterial({
          transparent: true, uniforms: { uMap: { value: null }, uHas: { value: 0 }, uLabel: { value: new THREE.Color(look.accent) }, uSpin: { value: 0 }, uA: { value: 1 } },
          vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: `uniform sampler2D uMap; uniform float uHas, uSpin, uA; uniform vec3 uLabel; varying vec2 vP;
            void main(){ float r = length(vP), a = atan(vP.y, vP.x);
              vec3 c = vec3(0.04) + 0.014 * sin(r * 520.0) * step(0.36, r) * step(r, 0.96);
              c += 0.17 * pow(abs(cos(a - 2.1)), 26.0) * step(0.36, r) * (1.0 - smoothstep(0.94, 0.99, r));
              c = mix(c, vec3(0.075), step(0.965, r));
              if (r < 0.34) {
                float cs = cos(uSpin), sn = sin(uSpin); vec2 q = mat2(cs, -sn, sn, cs) * vP / 0.68 + 0.5;
                c = uHas > 0.5 ? texture2D(uMap, q).rgb : uLabel;
                c *= 0.92 + 0.08 * smoothstep(0.3, 0.34, r);
              }
              if (r < 0.022) c = vec3(0.8);
              gl_FragColor = vec4(c, uA); }`,
        }));
        this.disc.rotation.x = -Math.PI / 2;
        // the tonearm: a post, an arm, a counterweight and a head, in satin metal
        const metal = solidMat("#c9c8c2", 0.5), dark = solidMat("#1c1c1c", 0.25);
        this.arm = new THREE.Group();
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.36, 32), metal);
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.5, 12), metal);
        const weight = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.28, 24), dark);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.34), dark);
        post.position.y = 0.18; tube.rotation.x = Math.PI / 2; tube.position.set(0, 0.36, 1.05); weight.rotation.x = Math.PI / 2; weight.position.set(0, 0.36, -0.36); head.position.set(0, 0.3, 2.32);
        this.arm.add(post, tube, weight, head);
        this.shadow = softShadow(); this.shadow.rotation.x = -Math.PI / 2;
        // the floor shows only as a pool of soft light round the player, so the shadows have somewhere to fall
        this.pool = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, uniforms: { uA: { value: 1 }, uC: { value: new THREE.Color(look.ink) } },
          vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: `uniform float uA; uniform vec3 uC; varying vec2 vP; void main(){ float r = length(vP); gl_FragColor = vec4(uC, uA * 0.13 * (1.0 - smoothstep(0.0, 1.0, r)) * (1.0 - smoothstep(0.0, 1.0, r))); }`,
        }));
        this.pool.rotation.x = -Math.PI / 2; this.pool.renderOrder = -5;
        this.feet = Array.from({ length: n }, () => { const m = softShadow(); m.rotation.x = -Math.PI / 2; return m; });
        g.add(this.pool, this.shadow, ...this.feet, this.plinth, this.platter, this.disc, this.arm);
        this.parts = [this.plinth, this.platter, this.disc, ...this.arm.children];
      },
      update(w, t, ctx) {
        const sc = deck(ctx), fy = FLOOR * sc, top = fy + PH * sc, e = self.phase?.e ?? 1, x = self.phase?.x ?? 0;
        // the player rises into place as it arrives, and sinks away as it goes
        const rise = (1 - easeOut(e)) * -5 * sc + easeIn(x) * -6 * sc;
        this.g.position.y = rise;
        this.plinth.scale.set(PW * sc, PH * sc, PD * sc); this.plinth.position.set(0, fy + (PH * sc) / 2, 0);
        this.platter.scale.set(PLATTER * sc, 0.12 * sc, PLATTER * sc); this.platter.position.set(-0.55 * sc, top + 0.06 * sc, 0.1 * sc);
        this.disc.position.set(-0.55 * sc, top + 0.125 * sc, 0.1 * sc); this.disc.scale.setScalar(PLATTER * sc * 0.97);
        const U = this.disc.material.uniforms;
        U.uSpin.value = -turn(t, ctx) * 3.2;
        // the label is the cover standing nearest you
        const pic = ctx.picture(self.index, front(t, ctx));
        if (pic) { U.uMap.value = pic.tex; U.uHas.value = 1; }
        this.arm.position.set(PW * sc * 0.36, top, -PD * sc * 0.3); this.arm.scale.setScalar(sc);
        this.arm.rotation.y = lerp(-0.25, -0.62, smooth(0.2, 0.9, e) * (1 - x));
        shadowSet(this.shadow, PW * sc + 1.4, PD * sc + 1.4, 0.7, 0.55 * w); this.shadow.position.set(0.2, fy + 0.006, 0.3);
        this.pool.position.set(0, fy - 0.002, 0.4); this.pool.scale.setScalar(ringR(ctx) * 1.75); this.pool.material.uniforms.uA.value = w;
        this.feet.forEach((m, b) => {
          const o = ctx.cardPose(self.index, b);
          if (!o) { m.visible = false; return; }
          const up = Math.max(0, o.p.y - o.h / 2 - fy - 0.01 - rise);
          _v.set(0, 0, 1).applyQuaternion(o.q);
          m.position.set(o.p.x + _v.x * 0.18, fy + 0.004, o.p.z + _v.z * 0.18); m.rotation.z = Math.atan2(_v.x, _v.z);
          shadowSet(m, o.w * 1.05, 0.6 + up * 0.3, 0.24 + up * 0.2, 0.5 * w * (1 - smooth(0, 3, up)));
        });
        solidity(this.parts, Math.min(smooth(0, 0.12, e), 1 - smooth(0.9, 1, x)));
        this.g.visible = w > 0.01;
      },
    },
  };
  return self;
}

// ── wheel: the jukebox ──────────────────────────────────────────────────────────────────────────────────────────
// A wide ring of small records standing on edge on a walnut turntable, seen from above. The ring turns with the scroll;
// the record that comes round to the front rises straight up out of the ring, turns to face you and grows big, its
// vinyl sliding out, then sinks back into its place as the next one comes.
export function wheel(cfg, page, set) {
  const n = set.n, step = TAU / n, TURN = cfg.turn ?? 0.13;
  const sc = (ctx) => Math.min(1, ctx.sw / (ctx.mobile ? 7.2 : 15), ctx.H / 10);
  const RING = (ctx) => 5.4 * sc(ctx), S = (ctx) => 1.7 * sc(ctx), BIG = (ctx) => 3.3 * sc(ctx), FLOOR = (ctx) => -2.2 * sc(ctx);
  const spin = { yaw: 0, pitch: 0 };
  const angle = (b, t, ctx) => b * step - t * TAU * TURN + spin.yaw;
  const opening = (a0) => Math.exp(-((a0 / (step * 0.62)) ** 2));
  const _f = new THREE.Quaternion(), _c = new THREE.Quaternion(), _d = new THREE.Vector3();
  const self = {
    hold: cfg.hold ?? 1.4, turnable: true, spin,
    view: (t, ctx) => view([0, lerp(9.6, 8.6, t) * sc(ctx), lerp(14.6, 13.6, t) * sc(ctx) + (ctx.mobile ? 4 : 0)], [0, -0.9 * sc(ctx), 0.6 * sc(ctx)], 40, 0.05),
    pivot: (t, ctx) => new THREE.Vector3(0, FLOOR(ctx) + S(ctx) / 2, 0),
    hero: (t, ctx) => nearest(n, (b) => wrapPi(angle(b, t, ctx))),
    // the risen record's name, under it
    feature: (t, ctx) => { const b = nearest(n, (b) => wrapPi(angle(b, t, ctx))); return opening(wrapPi(angle(b, t, ctx))) > 0.7 ? { b } : null; },
    pose(b, t, ctx, o) {
      const s = S(ctx), a0 = wrapPi(angle(b, t, ctx)), open = opening(a0);
      const rise = smooth(0, 0.42, open), turn = smooth(0.3, 1, open);
      _n.set(Math.sin(a0), 0, Math.cos(a0));                                 // out from the middle
      _v.set(Math.cos(a0), 0, -Math.sin(a0));                                 // along the ring: a standing record's face
      const size = lerp(s, BIG(ctx), turn);
      o.p.copy(_n).multiplyScalar(RING(ctx) + turn * 0.5 * sc(ctx));
      o.p.y = FLOOR(ctx) + s / 2 + rise * (s * 1.1 + 0.5 * sc(ctx)) + turn * ((size - s) * 0.5 + 0.9 * sc(ctx));
      facing(_f, _v, Y);
      if (turn > 1e-3) { facing(_c, _d.copy(ctx.cam.p).sub(o.p).normalize(), Y); _f.slerp(_c, ease(turn)); }
      o.q.copy(_f);
      o.w = o.h = size; o.twoSided = 1; o.shade = 0.4; o.radius = 0; o.thick = 0.045; o.edgeTint = 0.6;
      o.dim = 0.3 * (1 - turn) * smooth(0.2, -0.9, Math.cos(a0));              // the far side of the ring, a little darker
      o.disc = 0.32 * turn * turn; o.discDir = 0;
    },
    // in: each record rises up out of the turntable into its place; out: back down into it
    enter(b, e, ctx, o) { const u = easeOut(stagger(e, (b * 7) % n, n, 0.6)); o.p.y -= (1 - u) * S(ctx) * 1.2; o.clip = FLOOR(ctx); if (u <= 0) o.hide(); },
    exit(b, x, ctx, o) { const u = easeIn(stagger(x, (b * 7) % n, n, 0.5)); o.p.y -= u * S(ctx) * 1.2; o.clip = FLOOR(ctx); if (u >= 1) o.hide(); },
    focus(b, ctx) { return { t: null, spin: { yaw: wrapPi(spin.yaw - wrapPi(angle(b, ctx.tNow, ctx))), pitch: 0 } }; },
    props: {
      // the turntable the ring stands on: a walnut platter with a dark felt mat, a chrome spindle, a soft shadow
      build(g, ctx) {
        this.platter = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 128), woodMat(ctx.sceneTex("walnut"), [2, 1], 0.95));
        this.mat = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 128), solidMat("#141414", 0.15));
        this.spindle = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32), solidMat("#c9c8c2", 0.8));
        this.shadow = softShadow(); this.shadow.rotation.x = -Math.PI / 2;
        g.add(this.shadow, this.platter, this.mat, this.spindle);
        this.parts = [this.platter, this.mat, this.spindle];
      },
      update(w, t, ctx) {
        const R = RING(ctx), s = S(ctx), fy = FLOOR(ctx), e = self.phase?.e ?? 1, x = self.phase?.x ?? 0;
        const sink = (1 - easeOut(e)) * -3 * sc(ctx) + easeIn(x) * -3 * sc(ctx);
        this.platter.scale.set(R + s * 0.75, 0.32 * sc(ctx), R + s * 0.75); this.platter.position.set(0, fy - 0.16 * sc(ctx) + sink, 0);
        this.mat.scale.set(R + s * 0.68, 0.02, R + s * 0.68); this.mat.position.set(0, fy + 0.006 + sink, 0);
        this.spindle.scale.set(0.12 * sc(ctx), 0.5 * sc(ctx), 0.12 * sc(ctx)); this.spindle.position.set(0, fy + 0.25 * sc(ctx) + sink, 0);
        this.platter.rotation.y = -t * TAU * TURN + spin.yaw;
        this.shadow.position.set(0.3, fy - 0.33 * sc(ctx) + sink, 0.4);
        shadowSet(this.shadow, (R + s) * 2.5, (R + s) * 2.5, 1.4, 0.35 * w);
        solidity(this.parts, Math.min(smooth(0, 0.25, e), 1 - smooth(0.7, 1, x)));
      },
    },
  };
  return self;
}
