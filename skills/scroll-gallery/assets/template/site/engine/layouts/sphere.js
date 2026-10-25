// Sphere: pictures on a ball. dive: you fly in through its shell until the pictures are all round you, the ball
// turns, and the camera closes in on the one ahead until it fills the screen. Drag to look round.
import * as THREE from "three";
import { Pose, TAU, X, Y, Z, view, lerp, clamp, smooth, ease, easeOut, easeIn, stagger, arrive, depart, facing, ballPoints } from "./common.js";

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _up = new THREE.Vector3();
const FWD = new THREE.Vector3(0, 0, -1);

export function dive(cfg, page, set) {
  const n = set.n;
  const tip = new THREE.Quaternion().setFromAxisAngle(X, 0.35).multiply(new THREE.Quaternion().setFromAxisAngle(Z, 0.2));
  const dirs = ballPoints(n).map((d) => d.applyQuaternion(tip));
  const endSlot = cfg.end ? set.items.findIndex((it) => it.id === cfg.end) : -1;   // the picture the dive ends on
  const spin = { yaw: 0, pitch: 0 };
  const Q = new THREE.Quaternion(), ahead = new THREE.Vector3();
  let target = 0;
  const R = (ctx) => (ctx.mobile ? 5.6 : 7);
  const cardH = (ctx) => R(ctx) * Math.sqrt((4 * Math.PI) / n) * 0.46;
  const turnAt = (t) => 1.5 * ease(clamp(t / 0.82));                       // the ball turns while you are inside, then stops
  const IN = 0.3, CLOSE = 0.76;
  const rot = (t, ctx, out) => out.setFromAxisAngle(X, 0.12 + spin.pitch).multiply(_q2.setFromAxisAngle(Y, -turnAt(t) + spin.yaw));
  // turn the ball's points so the picture it ends on is the one straight ahead when the ball stops
  if (endSlot >= 0) {
    const R = new THREE.Quaternion().setFromAxisAngle(X, 0.12).multiply(new THREE.Quaternion().setFromAxisAngle(Y, -turnAt(0.76)));
    const F = new THREE.Quaternion().setFromUnitVectors(dirs[endSlot].clone().applyQuaternion(R), FWD);
    const fix = R.clone().invert().multiply(F).multiply(R);
    dirs.forEach((d) => d.applyQuaternion(fix));
  }
  // the picture nearest straight ahead once the ball stops: the one the camera closes in on
  // (or the one asked for from the list)
  let asked = -1;
  const pickTarget = (ctx) => {
    rot(CLOSE, ctx, _q);
    let best = 0, bd = -2;
    if (asked >= 0 || endSlot >= 0) best = asked >= 0 ? asked : endSlot;
    else dirs.forEach((d, b) => { const c = _v.copy(d).applyQuaternion(_q).dot(FWD); if (c > bd) { bd = c; best = b; } });
    target = best;
  };
  const self = {
    hold: cfg.hold ?? 1.5, turnable: true, spin,
    view: (t, ctx) => {
      const r = R(ctx), fly = ease(clamp(t / IN)), close = ease(smooth(CLOSE, 1, t));
      pickTarget(ctx);
      ahead.copy(dirs[target]).applyQuaternion(rot(t, ctx, _q));
      // from outside the ball in to its middle, looking ahead; then on toward the picture ahead
      const p = [0, lerp(1.2, 0, fly), lerp(r + 15, 0.4, fly)];
      const at = [0, 0, lerp(0, -r, smooth(0.5, 1, fly))];
      if (close > 0) {
        const near = r - cardH(ctx) * 1.15;
        for (let i = 0; i < 3; i++) { const a = "xyz"[i]; p[i] = lerp(p[i], ahead[a] * near, close); at[i] = lerp(at[i], ahead[a] * r, close); }
      }
      return view(p, at, lerp(lerp(40, 74, smooth(0.45, 1, fly)), 50, close), 0.06);
    },
    pivot: () => new THREE.Vector3(0, 0, 0),
    hero: () => target,
    prepare(t, ctx) { rot(t, ctx, Q); },
    pose(b, t, ctx, o) {
      const r = R(ctx);
      _v.copy(dirs[b]).applyQuaternion(Q);
      o.p.copy(_v).multiplyScalar(r);
      // facing in, upright along the ball's own lines of latitude
      _up.set(0, 1, 0).applyQuaternion(Q); _up.addScaledVector(_v, -_up.dot(_v));
      if (_up.lengthSq() < 1e-6) _up.set(1, 0, 0);
      facing(o.q, _v2.copy(_v).negate(), _up.normalize());
      o.h = cardH(ctx); o.w = o.h * set.aspect[b];
      o.sphere = 1; o.k = -1 / r; o.twoSided = 1; o.shade = 0.18; o.radius = 0.04; o.thick = 0.02; o.gloss = 0.14;
      o.fog = 0.25; o.fogNear = 8; o.fogFar = 24;
    },
    // in: the pictures gather onto the ball from further out; out: they drift off into the dark
    enter(b, e, ctx, o) { arrive(o, easeOut(stagger(e, b, n, 0.6)), (a) => { a.p.multiplyScalar(1.8); a.w *= 0.3; a.h *= 0.3; }); },
    exit(b, x, ctx, o) { depart(o, easeIn(stagger(x, b, n, 0.5)), (a) => { a.p.multiplyScalar(2.2); a.w *= 0.2; a.h *= 0.2; }); },
    // the camera closes in on b, wherever it is on the ball
    focus(b) { asked = b; return { t: 0.97 }; },
    unfocus() { asked = -1; },
  };
  return self;
}
