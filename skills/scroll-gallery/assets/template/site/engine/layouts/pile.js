// Pile: pictures lying loose. table (prints on a cutting mat, each with a soft shadow) · board (a big picture in the
// middle, the others pinned round it on red threads).
import * as THREE from "three";
import { Pose, Thread, Z, view, lerp, smooth, clamp, hash, stagger, arrive, depart, easeOut, easeIn, backOut, softShadow, shadowSet } from "./common.js";

const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _hp = new THREE.Vector3();

// ── table: three prints above the title printed on the mat, three below it, so the title reads between them ─────
const TABLE = [[0.14, 0.82, -0.1], [0.47, 0.87, 0.06], [0.87, 0.85, -0.05], [0.16, 0.17, 0.07], [0.58, 0.13, -0.08], [0.88, 0.17, 0.05]];
function spot(b, n) {
  if (n <= TABLE.length) return TABLE[b];
  // more prints than the curated spots: two loose rows, jittered
  const cols = Math.ceil(n / 2), c = b % cols, top = b < cols;
  return [(c + 0.5 + (hash(b) - 0.5) * 0.4) / cols, top ? 0.8 + (hash(b + 7) - 0.5) * 0.06 : 0.2 + (hash(b + 7) - 0.5) * 0.06, (hash(b + 3) - 0.5) * 0.2];
}
export function table(cfg, page, set) {
  const n = set.n;
  const size = (ctx) => Math.min(3.3, ctx.H * 0.33, (ctx.sw * 0.25) / ctx.meanAspect);
  const self = {
    hold: cfg.hold ?? 1.2,
    // the table is seen as you'd stand at it, the far edge up the page; the camera leans in as you scroll
    view: (t) => view([lerp(-0.6, 0.6, t), lerp(-4.6, -2.8, t), lerp(13.2, 10.8, t)], [0, 0.3, 0], 40, 0.05),
    surface: (ctx) => ({ p: new THREE.Vector3(0, 0.6, -0.06), q: new THREE.Quaternion(), w: ctx.sw * 2, h: ctx.H * 2.3 }),
    titleAt: (ctx) => ({ p: new THREE.Vector3(-ctx.sw * 0.02, 0.3, -0.03), q: new THREE.Quaternion(), w: ctx.sw * (ctx.mobile ? 0.98 : 0.72) }),
    pose(b, t, ctx, o) {
      const h = size(ctx);
      o.h = h; o.w = h * set.aspect[b];
      // the prints drift apart a little and turn as you scroll, as if the table were being cleared
      const [u, v, rot] = spot(b, n), open = lerp(0.96, 1.12, smooth(0, 1, t)), turn = lerp(-0.05, 0.06, t);
      const x = (u - 0.5) * ctx.sw * 0.9 * open, y = (v - 0.5) * ctx.H * 0.92 * lerp(1, 0.94, t), c = Math.cos(turn), s = Math.sin(turn);
      o.p.set(x * c - y * s, x * s + y * c, b * 0.03);
      o.q.setFromAxisAngle(Z, rot + turn + (hash(b + 11) - 0.5) * 0.22 * t);
      o.shade = 0.12; o.radius = 0.02; o.thick = 0.035; o.gloss = 0.16; o.grain = 0.8;
    },
    // in: dropped onto the table one by one from your hand; out: picked up and taken off the top of the table
    enter(b, e, ctx, o) { arrive(o, easeOut(stagger(e, b, n, 0.55)), (a) => { a.p.z += 7; a.p.y -= 2.2; a.q.multiply(_q.setFromAxisAngle(Z, (hash(b) - 0.5) * 1.1)); }); },
    exit(b, x, ctx, o) { depart(o, easeIn(stagger(x, b, n, 0.5)), (a) => { a.p.z += 5; a.p.y += ctx.H * 1.2; a.q.multiply(_q.setFromAxisAngle(Z, (hash(b + 3) - 0.5) * 0.7)); }); },
    focus: () => null,
    props: {
      // a soft shadow under each print, which follows it, spreading and fading as it lifts
      build(g) { this.shadows = Array.from({ length: n }, () => softShadow()); g.add(...this.shadows); },
      update(w, t, ctx) {
        this.shadows.forEach((m, b) => {
          const o = ctx.cardPose(self.index, b);
          if (!o) { m.visible = false; return; }
          const up = Math.max(0, o.p.z - b * 0.03);
          m.position.set(o.p.x + 0.12 + up * 0.1, o.p.y - 0.18 - up * 0.14, -0.02); m.quaternion.copy(o.q);
          shadowSet(m, o.w + 0.55 + up * 0.55, o.h + 0.55 + up * 0.55, 0.28 + up * 0.32, 0.3 * w * (1 - smooth(0.05, 1.6, up)));
        });
      },
    },
  };
  return self;
}

// ── board: one big picture standing over the title, the rest pinned on the board on an arc round its pin, each on
// a red thread. The arc is centred on the pin, so every thread runs straight out to its own picture and crosses no other.
const ARC_D = [74, 94, 113, 132, 150, 168], ARC_M = [18, 48, 78, 108, 138, 166];
export function board(cfg, page, set) {
  const n = set.n, others = n - 1, color = cfg.thread || "#e8261d";
  const heroH = (ctx) => (ctx.mobile ? Math.min(ctx.H * 0.36, (ctx.sw * 0.66) / set.aspect[0]) : Math.min(ctx.H * 0.5, (ctx.sw * 0.3) / set.aspect[0]));
  const cardH = (ctx) => (ctx.mobile ? Math.min(ctx.H * 0.13, (ctx.sw * 0.26) / ctx.meanAspect) : Math.min(ctx.H * 0.17, (ctx.sw * 0.1) / ctx.meanAspect));
  const heroAt = (ctx, out) => (ctx.mobile ? out.set(0, -ctx.H * 0.14, 0.3) : out.set(ctx.sw * 0.27, -ctx.H * 0.1, 0.3));
  const pinOf = (ctx, out) => heroAt(ctx, out).add(_v2.set(0, heroH(ctx) * 0.4, 0.02));
  const spotOf = (b, ctx, out) => {
    const list = ctx.mobile ? ARC_M : ARC_D, j = b - 1;
    const deg = j < list.length ? list[j] : list[0] + ((list.at(-1) - list[0]) * j) / Math.max(1, others - 1);
    const a = deg * (Math.PI / 180), far = ctx.mobile && j % 2 ? 0.72 : 1;
    const rx = (ctx.mobile ? 0.44 : 0.66) * ctx.sw * far, ry = (ctx.mobile ? 0.34 : 0.29) * ctx.H * far;
    return pinOf(ctx, out).add(_v2.set(Math.cos(a) * rx, Math.sin(a) * ry, 0)).setZ(0.05 + b * 0.004);
  };
  const self = {
    hold: cfg.hold ?? 1.0, hoverPull: 1.4,
    // the camera swings a little round the board, so the big picture stands off it
    view: (t, ctx) => {
      const yaw = lerp(-0.08, 0.08, t), d = ctx.D * lerp(1.02, 0.95, t);
      return view([Math.sin(yaw) * d, lerp(0.3, -0.3, t), Math.cos(yaw) * d], [0, 0, 0], 40, 0.04);
    },
    titleAt: (ctx) => ({ p: new THREE.Vector3(ctx.mobile ? 0 : -ctx.sw * 0.12, -ctx.H * (ctx.mobile ? 0.4 : 0.32), -0.04), q: new THREE.Quaternion(), w: ctx.sw * (ctx.mobile ? 0.98 : 0.74) }),
    hero: () => 0,
    pose(b, t, ctx, o) {
      const tm = ctx.time;
      if (b === 0) {
        const h = heroH(ctx);
        o.h = h; o.w = h * set.aspect[0];
        heroAt(ctx, o.p).add(_v.set(0, 0.04 * Math.sin(tm * 0.6), 0));
        o.shade = 0.14; o.thick = 0.06; o.gloss = 0.16;
        return;
      }
      const h = cardH(ctx);
      o.h = h; o.w = h * set.aspect[b];
      spotOf(b, ctx, o.p).add(_v.set(0, 0.03 * Math.sin(tm * 0.7 + b * 1.3), 0));
      o.q.setFromAxisAngle(Z, (hash(b + 4) - 0.5) * 0.1 + 0.012 * Math.sin(tm * 0.5 + b));
      o.shade = 0.18; o.thick = 0.035; o.gloss = 0.12;
    },
    // in: the big picture settles; the threads run out from its pin and each picture arrives as its thread reaches it
    enter(b, e, ctx, o) {
      if (b === 0) { const u = clamp(e / 0.35); o.w *= lerp(0.7, 1, backOut(u)); o.h *= lerp(0.7, 1, backOut(u)); if (u <= 0) o.hide(); return; }
      const u = clamp((e - reach(b, n) + 0.02) / 0.2);
      if (u <= 0) { o.hide(); return; }
      const s = backOut(u); o.w *= s; o.h *= s;
    },
    // out: the pinned pictures are pulled off and thrown out past the edges; the big one goes last
    exit(b, x, ctx, o) {
      if (b === 0) { depart(o, easeIn(clamp((x - 0.35) / 0.65)), (a) => { a.p.z += 6; a.w *= 0.4; a.h *= 0.4; }); return; }
      depart(o, easeIn(stagger(x, b - 1, others, 0.45)), (a) => { a.p.x *= 2.3; a.p.y *= 1.8; a.p.z += 3; a.q.multiply(_q.setFromAxisAngle(Z, (hash(b) - 0.5) * 1.2)); });
    },
    focus: () => null,
    props: {
      build(g, ctx, look) {
        this.threads = Array.from({ length: others }, () => new Thread(color, 0.022));
        this.pins = Array.from({ length: n }, () => new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color, transparent: true })));
        this.shadows = Array.from({ length: n }, () => softShadow());
        g.add(...this.shadows, ...this.threads.map((t) => t.mesh), ...this.pins);
      },
      update(w, t, ctx) {
        const e = self.phase?.e ?? 1, x = self.phase?.x ?? 0, eye = ctx.cam.p, hero = ctx.cardPose(self.index, 0);
        const from = pinOf(ctx, _hp);
        if (hero) from.copy(hero.p).add(_v2.set(0, hero.h * 0.4, 0.02).applyQuaternion(hero.q));
        this.pins[0].position.copy(from); this.pins[0].scale.setScalar(0.08); this.pins[0].quaternion.copy(ctx.cam.q); this.pins[0].visible = !!hero; this.pins[0].material.opacity = w;
        for (let b = 0; b < n; b++) {
          // a soft shadow on the board under each picture, further off as it comes toward you
          const o = ctx.cardPose(self.index, b), sh = this.shadows[b];
          if (!o || o.w < 0.01) { sh.visible = false; continue; }
          const up = Math.max(0, o.p.z - (b ? 0.05 : 0.3));
          sh.position.set(o.p.x + 0.1 + up * 0.12, o.p.y - 0.14 - up * 0.16, -0.03); sh.quaternion.copy(o.q);
          shadowSet(sh, o.w + 0.35 + up * 0.5, o.h + 0.35 + up * 0.5, 0.2 + up * 0.25, (b ? 0.22 : 0.3) * w * (1 - smooth(0.4, 2.5, up)));
        }
        for (let b = 1; b < n; b++) {
          const o = ctx.cardPose(self.index, b), th = this.threads[b - 1], pin = this.pins[b];
          // each thread runs out just before its picture arrives, and is pulled back first on the way out
          const reveal = Math.min(smooth(reach(b, n) - 0.24, reach(b, n), e), 1 - smooth(0, 0.4, x));
          if (!o || !hero || o.w < 0.01) { th.mesh.visible = false; pin.visible = false; continue; }
          edgeToward(o, from, _v2);
          th.set(from, _v2, 0.08 + from.distanceTo(_v2) * 0.025, reveal, eye);
          th.mesh.material.opacity = w;
          pin.position.copy(_v2).add(_v.set(0, 0, 0.02).applyQuaternion(o.q)); pin.quaternion.copy(o.q); pin.scale.setScalar(0.05); pin.visible = reveal > 0.98;
          pin.material.opacity = w;
        }
      },
    },
  };
  return self;
}
// the point on card o's edge that faces p: where a thread from p meets it
const _ed = new THREE.Vector3(), _eq = new THREE.Quaternion();
function edgeToward(o, p, out) {
  _eq.copy(o.q).invert();
  _ed.copy(p).sub(o.p).applyQuaternion(_eq);
  const hw = o.w / 2, hh = o.h / 2, k = Math.min(hw / Math.max(Math.abs(_ed.x), 1e-6), hh / Math.max(Math.abs(_ed.y), 1e-6)) * 0.94;
  return out.set(_ed.x * k, _ed.y * k, 0.03).applyQuaternion(o.q).add(o.p);
}
// when picture b's thread reaches it on the way in (0–1 of the arrival)
const reach = (b, n) => 0.32 + 0.4 * ((b - 1) / Math.max(1, n - 2));
