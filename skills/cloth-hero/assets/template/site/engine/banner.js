// A long cloth streaming in a current, after a silk banner let go in deep water. It is held at one end (off-screen)
// so the current runs along it, and the current gives it its shape: wherever the silk leans across the flow, the
// flow pushes it back into line, and that carries every bend down the banner at the current's own speed. So slow
// waves stirred in along its length build up toward the free end, as a flag's do, and every move of the held end
// travels down it. The hems are cut a little longer than the middle, so they can't lie flat and ripple like a
// hand-rolled silk edge. A hand pressing in from the viewer's side can rest on it anywhere.
// Pure JS (no three.js), so it runs headless in Node too.
import { Cloth } from "./cloth.js";
import { noise3 } from "./noise.js";

const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const smooth = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const TAU = Math.PI * 2;

export class Banner {
  constructor({
    width, length, cols, rows,
    ruffle = 0.05, // how much longer the hems are than the middle
    current = 0.45, // m/s along the banner
    // [{ a (m/s), len (m), kw (phase change across the width), p, speed (× the current; 1 rides it), reach (m) }]:
    // bends stirred in along the length. One that rides the current keeps feeding the same bend all the way down,
    // so it grows toward the free end; `reach` keeps it to the first metres, from where the bends travel on at an
    // even size. One that moves at another speed only reshapes the silk where it is.
    waves = [],
    twist = null, curl = null, // { a, len, p, speed }: the edges moving against each other / together against the middle
    flutter = null, // { a, len, speed }: quicker ripples near the free end, outrunning the current
    turbulence = 0.05,
    hold = { n: 0.1, w: 0.05, roll: 0.3 }, // how far the held end wanders (m, m, rad)
    hand = { r: 0.18, press: 0.16 },
    ...clothOptions
  }) {
    const c = (this.cloth = new Cloth({ patches: [{ cols, rows, width, height: length, x: -width / 2, y: 0, z: 0 }], ...clothOptions }));
    Object.assign(this, { width, length, cols, rows, current, twist, curl, flutter, turbulence, holdAmp: hold, handR: hand.r, press: hand.press });
    this.waves = waves.map((v) => ({ ...v, k: TAU / v.len }));
    for (const v of [twist, curl, flutter]) if (v) v.k = TAU / v.len;
    const dx = (this.dx = width / (cols - 1)), dy = (this.dy = length / (rows - 1));
    // every column's links are cut to its own length: the hems a few per cent long, easing to true in the middle
    this.along = Float32Array.from({ length: cols }, (_, k) => 1 + ruffle * Math.exp(-Math.min(k, cols - 1 - k) / 1.1));
    for (let m = 0; m < c.cRest.length; m++) {
      const i = c.cIdx[2 * m], j = c.cIdx[2 * m + 1], ki = i % cols, kj = j % cols;
      const dr = Math.abs(((j / cols) | 0) - ((i / cols) | 0)), dk = Math.abs(kj - ki);
      c.cRest[m] = Math.hypot(dk * dx, dr * dy * 0.5 * (this.along[ki] + this.along[kj]));
    }
    // held by its first row; each particle may hang no further from the top of its column than the column is long
    for (let k = 0; k < cols; k++) c.pin(k);
    c.buildTethers(1);
    for (let i = cols; i < c.n; i++) { c.tetherPin[i] = i % cols; c.tetherLen[i] = ((i / cols) | 0) * dy * this.along[i % cols]; }

    this.T = 0; this.drift = 0; this.U = current; this.ticks = 0;
    this.stirs = [];
    // it presses along the pointer ray, moving silk at most 3 mm a substep (about 1.5 m/s at four substeps)
    this.hand = { x: 0, y: 0, z: 0, r: 0, on: true, k: 0.7, dir: [0, 0, -1], step: 0.003 };
    this.depth = 0; // where along the pointer ray the hand rests
    c.spheres.push(this.hand);
    this.flowFn = (x, y, z, o) => this.flow(x, y, z, o);
  }

  // The frame it streams in: held at `o`, streaming along `dir`, its printed face turned toward `face`.
  setRig({ o, dir, face }) {
    const s = norm(dir), f = norm(face), d = f[0] * s[0] + f[1] * s[1] + f[2] * s[2];
    const n = norm([f[0] - d * s[0], f[1] - d * s[1], f[2] - d * s[2]]);
    const w = [n[1] * s[2] - n[2] * s[1], n[2] * s[0] - n[0] * s[2], n[0] * s[1] - n[1] * s[0]]; // n × s: columns run this way
    this.rig = { o: [...o], s, n, w };
    this.dir = s;
  }

  // lay it out straight along the rig, at rest
  place() {
    const { cloth: c, rig: R, cols, rows, dx, dy } = this;
    for (let r = 0; r < rows; r++)
      for (let k = 0; k < cols; k++) {
        const i = r * cols + k, a = -this.width / 2 + k * dx, b = r * dy;
        for (let e = 0; e < 3; e++) c.pos[3 * i + e] = c.prev[3 * i + e] = R.o[e] + R.w[e] * a + R.s[e] * b;
      }
    c.vel.fill(0);
    c.glide.clear();
    this.holdAt(this.T, true);
    c.computeNormals();
  }

  // the held end drifts and rolls a little, slowly; each move travels down the banner
  holdAt(t, snap = false) {
    const { cloth: c, rig: R, holdAmp: A, cols, dx } = this;
    const hn = A.n * (0.7 * Math.sin(0.41 * t) + 0.3 * Math.sin(0.93 * t + 1));
    const hw = A.w * Math.sin(0.29 * t + 2);
    const roll = A.roll * (0.75 * Math.sin(0.23 * t) + 0.25 * Math.sin(0.61 * t + 1)), cr = Math.cos(roll), sr = Math.sin(roll);
    for (let k = 0; k < cols; k++) {
      const a = -this.width / 2 + k * dx, p = [0, 0, 0];
      for (let e = 0; e < 3; e++) p[e] = R.o[e] + R.n[e] * hn + R.w[e] * hw + (R.w[e] * cr + R.n[e] * sr) * a;
      if (snap) c.pin(k, p[0], p[1], p[2]);
      else c.movePin(k, p[0], p[1], p[2]);
    }
  }

  // the water's velocity at a point
  flow(x, y, z, o) {
    const R = this.rig, px = x - R.o[0], py = y - R.o[1], pz = z - R.o[2];
    const s = px * R.s[0] + py * R.s[1] + pz * R.s[2];
    const w = (px * R.w[0] + py * R.w[1] + pz * R.w[2]) / (0.5 * this.width);
    const D = this.drift;
    let vn = 0;
    for (const v of this.waves) vn += v.a * (v.reach ? Math.exp(-s / v.reach) : 1) * Math.sin(v.k * (s - (v.speed ?? 1) * D) + v.kw * w + v.p);
    const tw = this.twist, cu = this.curl, fl = this.flutter;
    if (tw) vn += tw.a * w * Math.sin(tw.k * (s - (tw.speed ?? 1) * D) + tw.p);
    if (cu) vn += cu.a * (w * w - 0.33) * Math.sin(cu.k * (s - (cu.speed ?? 1) * D) + cu.p);
    if (fl) {
      const u = Math.min(1, Math.max(0, (s / this.length - 0.45) / 0.55));
      vn += fl.a * u * u * Math.sin(fl.k * (s - fl.speed * this.drift) + 2.6 * w);
    }
    const T = this.T, tb = this.turbulence;
    vn += tb * 2 * (noise3(x * 1.3 + 3, y * 1.3, z * 1.3 + T * 0.23) - 0.5);
    const vw = tb * 1.2 * (noise3(x * 1.1 + 9, y * 1.1 + 5, z * 1.1 - T * 0.17) - 0.5);
    const F = this.dir, U = this.U;
    o[0] = U * F[0] + vn * R.n[0] + vw * R.w[0];
    o[1] = U * F[1] + vn * R.n[1] + vw * R.w[1];
    o[2] = U * F[2] + vn * R.n[2] + vw * R.w[2];
    // swirls left by the hand
    for (const st of this.stirs) {
      const ex = x - st.x, ey = y - st.y, ez = z - st.z, f = Math.exp(-(ex * ex + ey * ey + ez * ez) / 0.07) * st.life;
      if (f < 0.002) continue;
      o[0] += st.vx * f - ey * st.spin * f;
      o[1] += st.vy * f + ex * st.spin * f;
      o[2] += st.vz * f;
    }
  }

  stir(x, y, z, vx, vy, vz, spin) {
    this.stirs.push({ x, y, z, vx, vy, vz, spin, life: 1 });
    if (this.stirs.length > 24) this.stirs.shift();
  }

  // The hand: a sphere that rests on the silk under the pointer and presses `press` into it. `ray` is
  // { o: [x, y, z], d: [x, y, z] } from the camera through the pointer, or null when there is no pointer.
  // Where does the silk sit there, not counting the dent the hand is already making? Its average depth in a ring
  // just outside the hand. But a wave crest under the pointer can stand well in front of that ring, and a hand
  // placed behind the silk would push it toward you, so the hand also always stays in front of the nearest silk
  // under the pointer.
  touch(ray, h) {
    const H = this.hand, P = this.cloth.pos, R = this.handR;
    let ok = false;
    if (ray) {
      const [ox, oy, oz] = ray.o, [dx, dy, dz] = ray.d;
      const in2 = (0.6 * R) ** 2, r0 = (R + 0.05) ** 2, r1 = (R + 0.25) ** 2;
      let sum = 0, cnt = 0, core = 0, front = Infinity;
      for (let i = 0, n = this.cloth.n; i < n; i += 2) {
        const vx = P[3 * i] - ox, vy = P[3 * i + 1] - oy, vz = P[3 * i + 2] - oz, t = vx * dx + vy * dy + vz * dz;
        const q = vx * vx + vy * vy + vz * vz - t * t;
        if (q < in2) { core++; if (t < front) front = t; }
        else if (q > r0 && q < r1) { sum += t; cnt++; }
      }
      ok = core > 0 && cnt > 5;
      if (ok) {
        const want = sum / cnt - (R - this.press);
        this.depth = H.r < 0.01 ? want : smooth(this.depth, want, 10, h);
        const t = Math.min(this.depth, front - 0.02);
        H.x = ox + dx * t; H.y = oy + dy * t; H.z = oz + dz * t;
        H.dir[0] = dx; H.dir[1] = dy; H.dir[2] = dz;
      }
    }
    H.r = smooth(H.r, ok ? R : 0, ok ? 7 : 1.2, h);
    return ok;
  }

  step(h) {
    const T = (this.T += h);
    // the current swells and eases, and wanders a few degrees
    this.U = this.current * (1 + 0.18 * Math.sin(T * 0.13) * Math.sin(T * 0.07 + 1));
    this.drift += this.U * h;
    const R = this.rig, a = 0.05 * Math.sin(T * 0.051), b = 0.04 * Math.sin(T * 0.037 + 1);
    this.dir = norm([R.s[0] + R.n[0] * a + R.w[0] * b, R.s[1] + R.n[1] * a + R.w[1] * b, R.s[2] + R.n[2] * a + R.w[2] * b]);
    this.holdAt(T);
    for (const st of this.stirs) {
      st.life *= Math.exp(-h / 1.6);
      st.x += this.dir[0] * this.U * 0.6 * h; st.y += this.dir[1] * this.U * 0.6 * h; st.z += this.dir[2] * this.U * 0.6 * h;
    }
    while (this.stirs.length && this.stirs[0].life < 0.02) this.stirs.shift();
    if (this.ticks++ % 2 === 0) this.cloth.fillWind(this.flowFn); // the field changes slowly: every other step is plenty
    this.cloth.step(h);
  }
}
