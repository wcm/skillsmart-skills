// Book: pages with a real curl. pages: a thin glossy lookbook lying on a textured ground; it arrives closed, opens,
// and its pages turn with the scroll.
// A leaf is two cards back to back. A turning page is a circular arc, held so that no part of it ever dips below the
// pages it lies on: the curl and the corner's lead are limited by how far the page has turned, on both sides.
import * as THREE from "three";
import { X, view, lerp, clamp, smooth, ease, easeOut, easeIn, rigid, softShadow, shadowSet } from "./common.js";

const _v = new THREE.Vector3();

export function pages(cfg, page, set) {
  const n = set.n, STIFF = 1.15, CURL = 1.5, LEAD = 0.32, DZ = 0.014;
  const bookQ = new THREE.Quaternion().setFromAxisAngle(X, -0.3);
  let L = 4, w = 3, h = 5, P = [], spine = new THREE.Vector3(), openness = 0;
  const shadow = new Map();
  const carry = { q: new THREE.Quaternion(), d: new THREE.Vector3(), c: new THREE.Vector3() };
  const bend = (p) => {
    const th = Math.PI * p, tw = Math.min(LEAD * Math.sin(th), 1.8 * Math.min(th, Math.PI - th));
    return { th, tw, kw: Math.min(CURL * Math.sin(th), Math.max(0, th - tw / 2) * 0.9) };
  };
  // slid along the table's own plane (never through it), turning about its own up, lifted a little off it
  const carried = (u, ctx, sign) => {
    carry.c.copy(spine);
    carry.q.setFromAxisAngle(_v.set(0, 0, 1).applyQuaternion(bookQ), 0.2 * u * sign);
    carry.d.set(ctx.sw * 0.08 * u * sign, -ctx.H * 1.25 * u, 0.4 * Math.sin(Math.PI * Math.min(1, u * 1.5))).applyQuaternion(bookQ);
  };
  const self = {
    hold: cfg.hold ?? 1.5, stack: true, leave: 0.3, land: 0.3,
    view: (t, ctx) => view([0, lerp(-1.9, -1.5, t), lerp(13.2, 12.6, t)], [0, 0.25, 0], 40, 0.05),
    surface: (ctx) => ({ p: new THREE.Vector3(0, 0, -0.14).applyQuaternion(bookQ).add(_v.set(0, 0.1, 0)), q: bookQ.clone(), w: ctx.sw * 1.9, h: ctx.H * 2 }),
    titleAt: (ctx) => ({ p: new THREE.Vector3(0, 0.2, -0.1).applyQuaternion(bookQ).add(_v.set(0, 0.1, 0)), q: bookQ.clone(), w: ctx.sw * 0.9 }),
    hero: () => { let k = 0; while (k < L && P[k] >= 0.5) k++; return Math.min(n - 1, Math.max(0, 2 * k - 1)); },
    setup(ctx) {
      L = Math.ceil(n / 2);
      const pa = set.aspect.reduce((a, b) => a + b, 0) / n;
      h = Math.min(ctx.H * 0.72, (ctx.sw * 0.94) / (2 * pa)); w = h * pa;
    },
    prepare(t, ctx) {
      const T = t * (L - 1);
      P = Array.from({ length: L }, (_, k) => ease(clamp((T - k) * STIFF - (STIFF - 1) / 2)));
      openness = P[0];
      spine.set(-(w / 2) * (1 - openness), 0.1, 0);
      carry.q.identity(); carry.d.set(0, 0, 0);
      // a turning page shades the page it is passing over
      shadow.clear();
      P.forEach((p, k) => {
        if (p <= 0 || p >= 1) return;
        const { th, kw } = bend(p), kk = kw / w;
        const edge = kk < 1e-4 ? w * Math.cos(th) : (Math.sin(th) - Math.sin(th - kk * w)) / kk;
        const amt = 0.42 * Math.sin(th);
        if (edge > 0 && 2 * k + 2 < n) shadow.set(2 * k + 2, [edge, amt]);
        if (edge < 0 && k > 0) shadow.set(2 * k - 1, [-edge, amt]);
      });
    },
    pose(b, t, ctx, o) {
      const leaf = b >> 1, back = b & 1, p = P[leaf], { th, tw, kw } = bend(p);
      const z = lerp((L - 1 - leaf) * DZ, leaf * DZ, p) + 0.05 * Math.sin(Math.PI * p);
      o.p.set(0, 0, z).applyQuaternion(bookQ).add(spine);
      o.q.copy(bookQ);
      o.w = w; o.h = h;
      if (!back) { o.pivot = 0; o.side = 1; o.theta = th; o.k = kw / w; o.twist = tw; }
      else { o.pivot = 1; o.side = -1; o.theta = Math.PI - th; o.k = -kw / w; o.twist = -tw; }
      o.lift = 0.003; o.shade = 1; o.gutter = 1; o.radius = 0;
      o.sheen = 0.28; o.sheenPow = 46;
      const sh = shadow.get(b);
      if (sh) { o.shadowAt = sh[0]; o.shadow = sh[1]; }
    },
    // the closed book's front cover, for a picture that has to land on it (the fold)
    cover: (ctx, o) => { self.prepare(0, ctx); self.pose(0, 0, ctx, o); return o; },
    // in: the closed book slides up onto the table from below, turning straight as it comes; out: down and away
    enter(b, e, ctx, o) { carried(1 - easeOut(e), ctx, 1); rigid(o, carry.c, carry.q, carry.d); },
    exit(b, x, ctx, o) { carried(easeIn(x), ctx, -1); rigid(o, carry.c, carry.q, carry.d); },
    focus: (b) => ({ t: Math.ceil(b / 2) / Math.max(1, L - 1) }),
    props: {
      // the book's soft shadow on the table; it only reaches left once the cover has landed
      build(g) { this.m = softShadow(); g.add(this.m); },
      update(wt) {
        const left = w * smooth(0.82, 1, openness), W = left + w + 1.0, H = h + 1.0;
        this.m.quaternion.copy(bookQ);
        this.m.position.set((w - left) / 2, -0.12, -0.06).applyQuaternion(bookQ).add(spine);
        rigid({ p: this.m.position, q: this.m.quaternion }, carry.c, carry.q, carry.d);
        shadowSet(this.m, W, H, 0.6, 0.28 * wt);
      },
    },
  };
  return self;
}
