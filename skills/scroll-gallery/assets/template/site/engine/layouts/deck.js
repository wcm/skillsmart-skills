// Deck: a deck of pictures laid along a path, the front one biggest. The path makes the variants.
//   stack   records face to face in a walnut crate; you flip through them and the front one lifts out
//   slabs   covers as thick slabs piled down the screen, a label on each one's edge; the middle one opens
//   sweep   a C-shaped curve going into depth, the front picture largest; the deck flows along it
//   ribbon  a long deck twisting through space, its pictures turned along it
//   trail   the deck follows the cursor (or a slow drawn path), each picture bigger than the one behind it
import * as THREE from "three";
import { Pose, TAU, X, Y, Z, view, lerp, clamp, smooth, hash, wrap, ease, stagger, arrive, depart, easeOut, easeIn, backOut, facing, rigid, softShadow, shadowSet, woodMat, solidity, labelTexture } from "./common.js";

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _n = new THREE.Vector3();
const nearestTo = (n, f) => clamp(Math.round(f), 0, n - 1);

// ── stack: the crate ────────────────────────────────────────────────────────────────────────────────────────────
// A walnut record bin, open at the top, its sides sloping down to a low front. The records stand in it; the ones
// you have flipped past lean forward against the front.
export function stack(cfg, page, set) {
  const n = set.n;
  const coverS = (ctx) => Math.min(ctx.H * 0.52, ctx.sw * (ctx.mobile ? 0.74 : 0.4));
  const crateQ = new THREE.Quaternion().setFromAxisAngle(X, 0.24), CRATE = new THREE.Vector3(0, -1.15, 0);
  // the bin, in units of a cover: inside from −IW to IW across, from ZB (back) to ZF (front), floor at Y0
  const IW = 0.6, Y0 = -0.56, FRONT = Y0 + 0.34, BACK = Y0 + 0.68, ZF = 0.5, TK = 0.045;
  const ZB = -(n * 0.08 + 0.12);
  // how far forward a record's foot stands in the bin
  const standAt = (b, t, ctx) => { const s = coverS(ctx), d = b - t * (n - 1), gap = s * 0.08; return d >= 0 ? -d * gap : Math.min(-d * gap * 0.4, (ZF - TK - 0.1) * s); };
  let f = 0;
  const self = {
    hold: cfg.hold ?? 1.3, stack: true, leave: 0.3, land: 0.3,
    view: (t, ctx) => view([0, lerp(3.4, 2.8, t), lerp(12.4, 11.6, t)], [0, -0.5, 0], 40, 0.07),
    pivot: (t, ctx) => CRATE.clone(),
    flyArc: (ctx) => new THREE.Vector3(0, coverS(ctx) * 1.25, 0.6),
    hero: (t) => nearestTo(n, t * (n - 1)),
    prepare(t) { f = t * (n - 1); },
    pose(b, t, ctx, o) {
      const s = coverS(ctx), d = b - f;
      // standing behind the one you are at, leaning a little back; the ones flipped past lie forward on the front
      const zb = standAt(b, t, ctx);
      const rest = Math.atan2((ZF - TK) * s - zb, (FRONT - Y0) * s);        // leaning on the front's top edge
      const lean = d >= 0 ? -0.16 * smooth(0, 1.2, d) : (rest - 0.02) * smooth(0, 1, -d);
      const lift = s * 0.3 * Math.exp(-((d / 0.5) ** 2));
      _q.setFromAxisAngle(X, lean);
      _v.set(0, s / 2, 0).applyQuaternion(_q).add(_v2.set(0, -s * 0.55 + lift, zb));
      o.p.copy(_v).applyQuaternion(crateQ).add(CRATE);
      o.q.copy(crateQ).multiply(_q);
      o.w = o.h = s; o.shade = 0.45; o.dim = 0.32 * smooth(1.5, 6, d); o.radius = 0; o.thick = 0.045; o.edgeTint = 0.6;
      o.disc = 0.2 * Math.exp(-((d / 0.45) ** 2)); o.discDir = Math.PI / 2;  // the record you lift slides up out of its sleeve
    },
    // in: dropped into the bin, the back ones first; out: lifted out from the top of the pile down, stood up straight
    enter(b, e, ctx, o) { arrive(o, easeOut(stagger(e, n - 1 - b, n, 0.6)), (a) => { a.p.y += coverS(ctx) * 2.2; a.disc = 0; }); },
    exit(b, x, ctx, o) {
      const sc = coverS(ctx);
      depart(o, easeIn(stagger(x, n - 1 - b, n, 0.5)), (a) => { a.q.copy(crateQ); a.p.set(0, -sc * 0.05 + sc * 2.9, standAt(b, 1, ctx)).applyQuaternion(crateQ).add(CRATE); a.disc = 0; });
    },
    focus: (b) => ({ t: b / Math.max(1, n - 1) }),
    props: {
      // the walnut bin and its soft shadow
      build(g, ctx) {
        const wood = woodMat(ctx.sceneTex("walnut"), [1, 1], 1.08), side = woodMat(ctx.sceneTex("walnut"), [1, 1], 0.92);
        this.g = new THREE.Group(); g.add(this.g);
        const box = (mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat); this.g.add(m); return m; };
        this.front = box(wood); this.backW = box(side); this.bottom = box(side);
        // the sides: a slope from the tall back to the low front
        const shape = new THREE.Shape([new THREE.Vector2(ZB - TK, Y0 - TK), new THREE.Vector2(ZF + TK, Y0 - TK), new THREE.Vector2(ZF + TK, FRONT), new THREE.Vector2(ZB - TK, BACK)]);
        const sg = new THREE.ExtrudeGeometry(shape, { depth: TK, bevelEnabled: false });
        sg.rotateY(-Math.PI / 2);
        this.sides = [-1, 1].map((sx) => { const m = new THREE.Mesh(sg, side); m.userData.sx = sx; this.g.add(m); return m; });
        this.shadow = softShadow(); g.add(this.shadow);
        this.parts = [this.front, this.backW, this.bottom, ...this.sides];
        wood.uniforms.uRepeat.value.set(1, 0.35); side.uniforms.uRepeat.value.set(0.6, 0.6);
      },
      update(w, t, ctx) {
        const s = coverS(ctx), e = self.phase?.e ?? 1, x = self.phase?.x ?? 0;
        // the bin slides up into place as the records arrive, and down away as they leave
        const drop = (1 - easeOut(clamp(e * 1.6))) * -ctx.H * 0.8 + easeIn(clamp((x - 0.4) / 0.6)) * -ctx.H * 0.9;
        this.g.position.copy(CRATE).add(_v.set(0, drop, 0)); this.g.quaternion.copy(crateQ); this.g.scale.setScalar(s);
        const W = IW + TK, D = ZF - ZB;
        this.front.scale.set(2 * W + 2 * TK, FRONT - Y0 + TK, TK); this.front.position.set(0, (FRONT + Y0 - TK) / 2, ZF + TK / 2);
        this.backW.scale.set(2 * W + 2 * TK, BACK - Y0 + TK, TK); this.backW.position.set(0, (BACK + Y0 - TK) / 2, ZB - TK / 2);
        this.bottom.scale.set(2 * W, TK, D); this.bottom.position.set(0, Y0 - TK / 2, (ZF + ZB) / 2);
        this.sides.forEach((m) => m.position.set(m.userData.sx < 0 ? -W : W + TK, 0, 0));
        const solid = Math.min(smooth(0, 0.12, e), 1 - smooth(0.9, 1, x));
        solidity(this.parts, solid);
        this.g.visible = w > 0.01 && solid > 0.001;
        _v.set(0, (Y0 - TK) * s - 0.01, ((ZF + ZB) / 2) * s).applyQuaternion(crateQ).add(CRATE).add(_v2.set(0.12, drop, 0));
        this.shadow.position.copy(_v); this.shadow.quaternion.copy(crateQ).multiply(_q.setFromAxisAngle(X, -Math.PI / 2));
        shadowSet(this.shadow, (2 * W + 0.5) * s, (D + 0.5) * s, 0.35 * s, 0.4 * w);
      },
    },
  };
  return self;
}

// ── slabs ───────────────────────────────────────────────────────────────────────────────────────────────────────
// Covers lying tipped far back, so you look along them, piled down the screen with a gap between each; each has its
// title on its front edge, in its own colour. As you scroll the pile rises, and the one in the middle turns up to face
// you and comes forward, its record sliding out, while the others part round it.
export function slabs(cfg, page, set) {
  const n = set.n, LIE = -1.19, OPEN = -0.46;
  const S = (ctx) => (ctx.mobile ? Math.min(3.4, ctx.sw * 0.8) : Math.min(4.6, ctx.sw * 0.3, ctx.H * 0.46));
  const gap = (ctx) => S(ctx) * 0.45;                                      // from one slab to the next, closed
  const room = (ctx) => S(ctx) * 0.4;                                      // the extra room round the open one
  const focusAt = (t) => lerp(0.6, n - 1.4, t);
  const openOf = (b, f) => Math.exp(-(((b - f) / 0.55) ** 2));
  let ys = [], f = 0;
  const self = {
    hold: cfg.hold ?? 1.3, stack: true,
    view: (t, ctx) => view([0, 1.4, ctx.D * 1.02], [0, 0, 0], 40, 0.04),
    titleAt: (ctx) => ({ p: new THREE.Vector3(0, ctx.mobile ? 3.1 : 2.75, -2.5), q: new THREE.Quaternion(), w: ctx.sw * (ctx.mobile ? 1.05 : 0.66) }),
    hero: () => nearestTo(n, f),
    pivot: () => new THREE.Vector3(0, 0, 0),
    prepare(t, ctx) {
      f = focusAt(t);
      // each slab's height in the pile, the gaps widening round the open one; the pile slides so the open one stays put
      ys = [0];
      for (let b = 1; b < n; b++) ys.push(ys[b - 1] - gap(ctx) - room(ctx) * (openOf(b - 1, f) + openOf(b, f)) / 2);
      // the pile starts low, under the title, and rises into the middle as you scroll
      const j = clamp(Math.floor(f), 0, n - 2), at = lerp(ys[j], ys[j + 1], f - j) + lerp(ctx.mobile ? 2.4 : 2.1, 0, smooth(0, 0.35, t));
      ys = ys.map((y) => y - at);
    },
    pose(b, t, ctx, o) {
      const s = S(ctx), op = openOf(b, f);
      o.w = o.h = s * (1 + 0.08 * op);
      o.p.set(0, ys[b] - 0.1 + op * 0.2, op * 1.1);
      o.q.setFromAxisAngle(X, lerp(LIE, OPEN, ease(op)));
      o.shade = 0.35; o.radius = 0; o.sheen = 0.06; o.sheenPow = 14;
      o.thick = Math.max(0.14, o.w * 0.072); o.edgeTint = 0.85; o.gloss = 0.1;
      o.disc = 0.3 * smooth(0.55, 1, op); o.discDir = 0;
      o.dim = 0.22 * (1 - op) * smooth(1.2, 4, Math.abs(b - f));
    },
    // in: dropped onto the pile one after another, the top first, with a little bounce
    enter(b, e, ctx, o) {
      const u = stagger(e, b, n, 0.62);
      if (u <= 0) { o.hide(); return; }
      o.p.y += ctx.H * 1.15 * (1 - backOut(u)); o.q.multiply(_q.setFromAxisAngle(Z, (hash(b) - 0.5) * 0.3 * (1 - u)));
    },
    exit(b, x, ctx, o) { depart(o, easeIn(stagger(x, b, n, 0.5)), (a) => { a.p.x -= ctx.W * 1.2; a.disc = 0; }); },
    focus: (b) => ({ t: clamp((b - 0.6) / Math.max(1, n - 2)) }),
    props: {
      // the front edge of each slab: its title and artist on a strip of the cover's own colour
      build(g, ctx, look) {
        this.edges = set.items.map((it, b) => {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: labelTexture(it.title, it.sub || "", set.colors[b] || "#333", look.font, 14), transparent: true }));
          m.frustumCulled = false; g.add(m); return m;
        });
      },
      update(w, t, ctx) {
        this.edges.forEach((m, b) => {
          const o = ctx.cardPose(self.index, b);
          if (!o || o.w < 0.05) { m.visible = false; return; }
          const th = o.thick;
          m.visible = true;
          m.quaternion.copy(o.q).multiply(_q.setFromAxisAngle(X, Math.PI / 2));
          m.position.copy(_v.set(0, -o.h / 2 - 0.004, 0).applyQuaternion(o.q).add(o.p));
          m.scale.set(o.w, th, 1);
          m.material.opacity = w;
          m.material.color.setScalar(1 - (o.dim || 0) * 0.8);
        });
      },
    },
  };
  return self;
}

// ── sweep ───────────────────────────────────────────────────────────────────────────────────────────────────────
// The deck lies along a C that sweeps from the front, low on the right, round to the left and up into the distance.
// It flows toward you: each picture steps forward one place at a time (push) or glides (linear); the front one flies
// past you and goes back round to the far end. Three switches change the corners, the size and the flow.
export function sweep(cfg, page, set) {
  const n = set.n;
  const sw = { round: true, large: true, push: true };
  const RUN = cfg.run ?? 0.75;                                             // how much of the deck goes by over the hold
  const curve = (u, ctx, out) => {
    const m = ctx.mobile, phi = -0.95 - u * 4.1, z = lerp(m ? 2.2 : 3.2, -11, Math.pow(u, 0.85));
    const scale = (ctx.D - z) / ctx.D, rx = ctx.sw * (m ? 0.3 : 0.27), ry = ctx.H * (m ? 0.3 : 0.34);
    return out.set(((m ? 0.06 : 0.12) * ctx.sw + Math.cos(phi) * rx) * scale, (Math.sin(phi) * ry - 0.2) * scale, z);
  };
  const flow = (t) => { const F = t * n * RUN; return sw.push ? Math.floor(F) + ease(clamp((F % 1) * 1.15)) : F; };
  const place = (b, t) => wrap((b - flow(t)) / n + 0.035, 1);
  const size = (ctx) => (ctx.mobile ? Math.min(ctx.H * 0.34, (ctx.sw * 0.62) / ctx.meanAspect) : Math.min(ctx.H * 0.46, (ctx.sw * 0.24) / ctx.meanAspect)) * (sw.large ? 1 : 0.62);
  const self = {
    hold: cfg.hold ?? 1.4,
    controls: [["round", "Rounded", "Sharp"], ["large", "Large", "Small"], ["push", "Push", "Linear"]], switches: sw,
    view: (t, ctx) => view([lerp(0.5, -0.5, t), lerp(-0.3, 0.3, t), ctx.D], [0, 0, 0], 40, 0.05),
    pivot: (t, ctx) => new THREE.Vector3(0.12 * ctx.sw, 0, -4),
    hero: (t) => { let best = 0, bu = 2; for (let b = 0; b < n; b++) { const u = place(b, t); if (u < bu) { bu = u; best = b; } } return best; },
    pose(b, t, ctx, o) {
      const u = place(b, t);
      curve(u, ctx, o.p);
      // the front one, once past its place, flies out past you; the far end grows out of nothing
      const past = smooth(0.035, 0, u), born = smooth(1, 0.93, u);
      o.p.add(_v.set(ctx.sw * 0.25, -ctx.H * 0.35, 6).multiplyScalar(past));
      const h = size(ctx) * born;
      o.h = h; o.w = h * set.aspect[b];
      o.q.setFromAxisAngle(Z, -0.06 + u * 0.12).multiply(_q.setFromAxisAngle(Y, lerp(-0.18, 0.28, u)));
      o.radius = sw.round ? -1 : 0.0001; o.shade = 0.2; o.thick = o.w * 0.03; o.gloss = 0.2; o.sheen = 0.08; o.sheenPow = 40;
      o.dim = 0.25 * smooth(0.5, 1, u);
    },
    enter(b, e, ctx, o) { const u = easeOut(stagger(e, n - 1 - b, n, 0.55)); o.w *= u; o.h *= u; },
    exit(b, x, ctx, o) { const u = 1 - easeIn(stagger(x, b, n, 0.5)); o.w *= u; o.h *= u; },
    focus: (b) => ({ t: clamp(((b + 0.035 * n) % n) / (n * RUN)) }),
  };
  return self;
}

// ── ribbon ──────────────────────────────────────────────────────────────────────────────────────────────────────
// A long S through space, near and low on the left, far and high on the right. The pictures stand along it nearly
// face to face, turned toward you, the ribbon twisting as they flow along it.
export function ribbon(cfg, page, set) {
  const n = set.n, FLOW = cfg.flow ?? 0.22;
  const spine = (s, ctx, out) => {
    const m = ctx.mobile;
    if (m) return out.set(Math.sin(s * TAU * 0.9 + 0.4) * ctx.sw * 0.32, lerp(-0.62, 0.6, s) * ctx.H, lerp(4.5, -10, s) + 1.4 * Math.sin(s * TAU * 0.6));
    return out.set(lerp(-0.66, 0.72, s) * ctx.sw, lerp(-0.4, 0.3, s) * ctx.H + 1.8 * Math.sin(s * TAU * 1.05 + 0.3), lerp(6, -13, s) + 2.2 * Math.sin(s * TAU * 0.7));
  };
  const at = (b, t, ctx) => wrap(b / n + t * FLOW + ctx.time * 0.004, 1);
  const size = (ctx) => (ctx.mobile ? Math.min(ctx.H * 0.3, (ctx.sw * 0.56) / ctx.meanAspect) : Math.min(ctx.H * 0.42, (ctx.sw * 0.22) / ctx.meanAspect));
  const self = {
    hold: cfg.hold ?? 1.4,
    view: (t, ctx) => view([lerp(-0.6, 0.6, t), lerp(0.2, -0.2, t), ctx.D * 1.04], [0, 0, -2], 40, 0.09),
    pivot: (t, ctx) => spine(0.5, ctx, new THREE.Vector3()),
    hero: (t, ctx) => { let best = 0, bd = 9; for (let b = 0; b < n; b++) { const d = Math.abs(at(b, t, ctx) - 0.22); if (d < bd) { bd = d; best = b; } } return best; },
    pose(b, t, ctx, o) {
      const s = at(b, t, ctx), ds = 0.004;
      spine(s, ctx, o.p);
      spine(s + ds, ctx, _v).sub(spine(s - ds, ctx, _v2)).normalize();       // along the ribbon
      _v2.copy(ctx.cam.p).sub(o.p).normalize();                            // toward you
      _n.copy(_v).multiplyScalar(0.72).addScaledVector(_v2, 0.7).normalize();
      _n.applyAxisAngle(_v, 0.85 * Math.sin(s * TAU * 1.3 + t * 2.6));      // the twist
      facing(o.q, _n, Y);
      const ends = smooth(0, 0.05, s) * smooth(1, 0.95, s), h = size(ctx) * ends;
      o.h = h; o.w = h * set.aspect[b];
      // thick acrylic: a clear glossy coat, a glowing rim, light caught along the edges
      o.shade = 0.4; o.sheen = 0.22; o.sheenPow = 60; o.twoSided = 1; o.radius = -1; o.mat = 2; o.thick = o.w * 0.055; o.gloss = 0.55;
    },
    enter(b, e, ctx, o) { const u = easeOut(stagger(e, Math.floor(at(b, 0, ctx) * n), n, 0.55)); o.w *= u; o.h *= u; },
    exit(b, x, ctx, o) { const u = 1 - easeIn(stagger(x, Math.floor(at(b, 1, ctx) * n), n, 0.5)); o.w *= u; o.h *= u; },
    focus: (b, ctx) => ({ t: clamp(wrap(0.22 - b / n, 1) / FLOW) }),
  };
  return self;
}

// ── trail ───────────────────────────────────────────────────────────────────────────────────────────────────────
// The head of the deck follows the cursor; the rest follow its path, each a little smaller and further back. When
// the cursor rests (or on a phone) the head draws a slow figure of its own, which the scroll also moves along.
export function trail(cfg, page, set) {
  const n = set.n, SHRINK = cfg.shrink ?? 0.9;
  const head = new THREE.Vector3(), target = new THREE.Vector3(), path = [];
  let started = false, lastT = 0;
  const H0 = (ctx) => (ctx.mobile ? Math.min(ctx.H * 0.28, (ctx.sw * 0.5) / ctx.meanAspect) : Math.min(ctx.H * 0.34, (ctx.sw * 0.2) / ctx.meanAspect));
  const sizeOf = (j, ctx) => H0(ctx) * Math.pow(SHRINK, j);
  const auto = (t, ctx, out, at = ctx.time) => {
    // a wide, slightly wandering loop round the title, so the deck never folds back over itself or sits on the title
    const tau = at * 0.55 + t * 3.4 + 0.6, hw = ctx.sw / 2, hh = ctx.H / 2;
    // (on a phone the title sits at the top and the loop below it)
    if (ctx.mobile) return out.set(Math.sin(tau) * hw * 0.56 + Math.sin(tau * 2.3) * 0.2, Math.cos(tau) * hh * 0.4 - hh * 0.3 + Math.sin(tau * 1.7) * 0.2, 0);
    return out.set(Math.sin(tau) * hw * 0.7 + Math.sin(tau * 2.3) * 0.45, Math.cos(tau) * hh * 0.66 + Math.sin(tau * 1.7) * 0.3, 0);
  };
  // the point at a length d back along the path from the head
  const back = (d, out) => {
    let left = d;
    for (let i = path.length - 1; i > 0; i--) {
      const a = path[i], b = path[i - 1], l = a.distanceTo(b);
      if (l >= left) return out.lerpVectors(a, b, l > 1e-6 ? left / l : 0);
      left -= l;
    }
    return out.copy(path[0] || head);
  };
  let spots = [];
  const self = {
    hold: cfg.hold ?? 1.2, follows: true,
    view: (t, ctx) => view([0, 0, ctx.D], [0, 0, 0], 40, 0.03),
    hero: () => 0,
    titleAt: (ctx) => ({ p: new THREE.Vector3(0, ctx.mobile ? 3.5 * (ctx.D + 2.5) / ctx.D : 0, -2.5), q: new THREE.Quaternion(), w: ctx.sw * (ctx.mobile ? 0.9 : 0.5) * (ctx.D + 2.5) / ctx.D }),
    prepare(t, ctx) {
      // where the head is going: the cursor while it moves, else the slow figure
      const p = ctx.pointer;
      if (p.live) target.set(p.x * ctx.W / 2, p.y * ctx.H / 2, 0); else auto(t, ctx, target);
      // the first time (or after a jump), the path it would have drawn over the last few seconds, so the deck is already
      // spread along its loop instead of cutting across from where it was
      if (!started || (!p.live && target.distanceTo(head) > ctx.H * 0.3)) {
        path.length = 0;
        for (let k = 90; k >= 0; k--) path.push(auto(t, ctx, new THREE.Vector3(), ctx.time - k * 0.06));
        head.copy(path[path.length - 1]); started = true;
      }
      const dt = Math.max(0, Math.min(0.1, ctx.dt));
      head.lerp(target, 1 - Math.exp(-dt * (p.live ? 9 : 4)));
      if (ctx.jump) head.copy(target);
      if (head.distanceTo(path[path.length - 1]) > 0.04) { path.push(head.clone()); if (path.length > 1600) path.splice(0, path.length - 1600); }
      // each picture's distance back along the path: half its height plus half the next one's, overlapping
      let d = 0;
      spots = [];
      for (let j = 0; j < n; j++) { spots.push(d); d += 0.6 * (sizeOf(j, ctx) + sizeOf(j + 1, ctx)) / 2; }
      lastT = t;
    },
    pose(b, t, ctx, o) {
      const h = sizeOf(b, ctx);
      if (b === 0) o.p.copy(head); else back(spots[b], o.p);
      // leaning a little into the direction it is travelling
      back(spots[b] + 0.6, _v); _v.sub(o.p);
      const lean = _v.lengthSq() > 1e-6 ? clamp(-_v.x * 0.06, -0.16, 0.16) : 0;
      o.p.z = 0.6 - b * 0.32;
      o.q.setFromAxisAngle(Z, lean + (hash(b) - 0.5) * 0.08);
      o.h = h; o.w = h * set.aspect[b]; o.shade = 0.1; o.thick = 0.025; o.gloss = 0.14; o.radius = 0.03;
      o.dim = 0.42 * smooth(0, n, b);
    },
    // in: the pictures come out of the head one after another; out: they shrink back into it
    enter(b, e, ctx, o) { const u = clamp((e - (b / n) * 0.75) / 0.25); if (u <= 0) { o.hide(); return; } const s = backOut(u); o.w *= s; o.h *= s; },
    exit(b, x, ctx, o) { const u = 1 - easeIn(stagger(x, n - 1 - b, n, 0.5)); o.w *= u; o.h *= u; },
    focus: () => null,
  };
  return self;
}
