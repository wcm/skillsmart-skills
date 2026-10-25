// A card that hangs like cloth: a small sheet pinned along its top edge, simulated in the card's own frame with the
// Cloth Hero solver. The card's own motion through the room comes in as inertia and as wind (still air rushing past a
// moving panel), so a silk panel swings and billows when the ring it hangs from turns, and settles when it stops.
// Each frame the sheet's offsets from flat go into a small float texture that the card's vertex shader reads (uClothMap).
import * as THREE from "three";
import { Cloth } from "./cloth.js";

const COLS = 11, ROWS = 15, STEP = 1 / 60;
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _g = new THREE.Vector3(), _a = new THREE.Vector3();

export class Sheet {
  constructor(linear) {
    this.data = new Float32Array(COLS * ROWS * 4);
    this.map = new THREE.DataTexture(this.data, COLS, ROWS, THREE.RGBAFormat, THREE.FloatType);
    this.map.minFilter = this.map.magFilter = linear ? THREE.LinearFilter : THREE.NearestFilter;
    this.map.needsUpdate = true;
    this.w = 0; this.h = 0; this.cloth = null;
    this.p = new THREE.Vector3(); this.v = new THREE.Vector3(); this.acc = new THREE.Vector3(); this.fresh = true; this.left = 0;
  }
  build(w, h) {
    this.w = w; this.h = h;
    // silk: light, a little stretch, soft to bend, slowed by the air
    this.cloth = new Cloth({ patches: [{ cols: COLS, rows: ROWS, width: w, height: h, x: -w / 2, y: h / 2, z: 0 }], density: 0.12, substeps: 8,
      stretch: 1e-5, shear: 4e-4, bend: 0.6, damping: 0.4, kN: 3.2, kT: 0.25, gravity: [0, -9.81, 0], maxSpeed: 8 });
    for (let c = 0; c < COLS; c++) this.cloth.pin(c);
    this.cloth.buildTethers(1.0);
    this.fresh = true;
  }
  // the card is w × h, at world position p turned by q; t: the time, for the breeze
  step(w, h, p, q, dt, t) {
    // a card that only grows or shrinks a little keeps its sheet, scaled; a new shape gets a new one
    if (!this.cloth || w > this.w * 1.6 || w < this.w * 0.4 || Math.abs(w / h - this.w / this.h) > 0.08 * (this.w / this.h)) this.build(w, h);
    const sx = w / this.w, sy = h / this.h;
    dt = Math.min(dt, 0.1);
    if (this.fresh) { this.p.copy(p); this.v.set(0, 0, 0); this.acc.set(0, 0, 0); this.fresh = false; }
    if (dt > 0) {
      _v.copy(p).sub(this.p).divideScalar(dt);                             // how fast the panel's frame moves
      _a.copy(_v).sub(this.v).divideScalar(dt);
      this.acc.lerp(_a.clampLength(0, 40), 0.25);
      this.v.copy(_v); this.p.copy(p);
    }
    _q.copy(q).invert();
    // gravity less (some of) the frame's own acceleration, in the panel's frame: a gentle swing, not a flap
    this.cloth.gravity.set(_g.set(0, -9.81, 0).addScaledVector(this.acc, -0.5).applyQuaternion(_q).toArray());
    // still air with a slow breeze, seen from the moving panel
    const bx = 0.22 * Math.sin(t * 0.37), bz = 0.3 * Math.sin(t * 0.23 + 1.3) + 0.15;
    _v.set(bx, 0, bz).addScaledVector(this.v, -0.55).applyQuaternion(_q);
    const wx = _v.x, wy = _v.y, wz = _v.z;
    this.cloth.fillWind((x, y, z, out, i) => {
      const ripple = Math.sin(x * 1.7 + t * 1.6 + y * 0.6) * 0.2 + Math.sin(y * 2.3 - t * 1.1) * 0.14;
      out[0] = wx; out[1] = wy; out[2] = wz + ripple;
    });
    this.left += dt;
    let n = 0;
    while (this.left >= STEP && n < 4) { this.cloth.step(STEP); this.left -= STEP; n++; }
    if (n === 4) this.left = 0;
    // the offsets from flat, the top row first in the sheet and last in the texture (v runs up)
    const { pos, rest } = this.cloth, d = this.data;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c, j = ((ROWS - 1 - r) * COLS + c) * 4;
      d[j] = (pos[3 * i] - rest[3 * i]) * sx; d[j + 1] = (pos[3 * i + 1] - rest[3 * i + 1]) * sy; d[j + 2] = (pos[3 * i + 2] - rest[3 * i + 2]) * (sx + sy) * 0.5; d[j + 3] = 1;
    }
    this.map.needsUpdate = true;
  }
  reset() { this.fresh = true; }
}
