// From the Cloth Hero skill's engine (cloth.js), unchanged: the XPBD cloth the runway's silk panels hang from.
// XPBD cloth with small steps (Macklin et al. 2019; Müller's Ten Minute Physics): one or more rectangular patches
// of particles joined by stretch, shear and bend distance constraints, solved once per substep.
// On top of that: per-vertex aerodynamic drag against a wind / water-current field (this is what makes cloth fall,
// billow and settle like cloth instead of like rubber), long-range tethers to the pins (no particle may end up further
// from its pin than it is in the flat cloth, which removes the springy stretch-and-bounce of long chains), sphere
// colliders, kinematic pins that glide between frames, a pinch-grab with soft falloff, and optional friction-free
// self-collision through a spatial hash.
// Step it with a fixed dt: the stage calls step() at a steady 120 Hz whatever the display does, because with a
// varying frame time the cloth's equilibrium shifts every frame and it never stops shimmering.
import { SpatialHash } from "./hash.js";

export class Cloth {
  constructor({
    patches,
    density = 0.25, // kg/m²
    gravity = [0, -9.81, 0],
    substeps = 12,
    stretch = 0, shear = 2e-4, bend = 0.3, // compliances (inverse stiffness); 0 = rigid
    damping = 0.1, // 1/s, applied to all motion
    kN = 4, kT = 0.3, // 1/s, how fast the medium removes normal / tangential relative velocity
    selfCollide = false, thickness = 0.012, friction = 0, contactSoft = 1,
    hashEvery = 2, // rebuild self-collision neighbours every n steps (1 for cloth that gets folded hard)
    grabSpeed = 3, // m/s: how fast a grabbed point can follow the hand (fast enough to feel direct, slow enough
    // that a fold can't jump through the sheet between two collision checks)
    maxSpeed = 8,
    jitter = 0,
  }) {
    Object.assign(this, { substeps, damping, kN, kT, thickness, friction, contactSoft, hashEvery, grabSpeed, maxSpeed });
    this.gravity = Float32Array.from(gravity);
    let n = 0;
    for (const p of patches) { p.base = n; n += p.cols * p.rows; }
    this.n = n;
    this.patches = patches;
    const f3 = () => new Float32Array(3 * n);
    this.pos = f3(); this.prev = f3(); this.vel = f3(); this.rest = f3(); this.nrm = f3(); this.wind = f3();
    this.uv = new Float32Array(2 * n);
    this.invMass = new Float32Array(n);
    this.w0 = new Float32Array(n);

    const cons = [], tris = [];
    for (const p of patches) {
      const { cols, rows, width, height, x = 0, y = 0, z = 0, u0 = 0, u1 = 1, v0 = 1, v1 = 0, base } = p;
      const dx = width / (cols - 1), dy = height / (rows - 1);
      const m = (density * width * height) / (cols * rows);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const i = base + r * cols + c, px = x + c * dx, py = y - r * dy;
          this.rest[3 * i] = px; this.rest[3 * i + 1] = py; this.rest[3 * i + 2] = z;
          this.pos[3 * i] = px; this.pos[3 * i + 1] = py; this.pos[3 * i + 2] = z + (Math.random() - 0.5) * jitter;
          this.uv[2 * i] = u0 + (u1 - u0) * (c / (cols - 1));
          this.uv[2 * i + 1] = v0 + (v1 - v0) * (r / (rows - 1));
          this.invMass[i] = 1 / m;
        }
      const id = (r, c) => base + r * cols + c;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          if (c + 1 < cols) cons.push(id(r, c), id(r, c + 1), 0);
          if (r + 1 < rows) cons.push(id(r, c), id(r + 1, c), 0);
        }
      for (let r = 0; r + 1 < rows; r++)
        for (let c = 0; c + 1 < cols; c++) cons.push(id(r, c), id(r + 1, c + 1), 1, id(r, c + 1), id(r + 1, c), 1);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          if (c + 2 < cols) cons.push(id(r, c), id(r, c + 2), 2);
          if (r + 2 < rows) cons.push(id(r, c), id(r + 2, c), 2);
        }
      // alternate the diagonal so folds don't all lean one way
      for (let r = 0; r + 1 < rows; r++)
        for (let c = 0; c + 1 < cols; c++) {
          const a = id(r, c), b = id(r, c + 1), cc = id(r + 1, c), d = id(r + 1, c + 1);
          if ((r + c) & 1) tris.push(a, cc, b, b, cc, d);
          else tris.push(a, cc, d, a, d, b);
        }
    }
    const m = cons.length / 3;
    this.cIdx = new Int32Array(2 * m);
    this.cRest = new Float32Array(m);
    this.cType = new Uint8Array(m);
    for (let k = 0; k < m; k++) {
      const i = cons[3 * k], j = cons[3 * k + 1];
      this.cIdx[2 * k] = i; this.cIdx[2 * k + 1] = j; this.cType[k] = cons[3 * k + 2];
      this.cRest[k] = Math.hypot(this.rest[3 * j] - this.rest[3 * i], this.rest[3 * j + 1] - this.rest[3 * i + 1], this.rest[3 * j + 2] - this.rest[3 * i + 2]);
    }
    this.compliance = [stretch, shear, bend];
    this.tris = new Uint32Array(tris);
    this.prev.set(this.pos);
    this.w0.set(this.invMass);

    this.tetherPin = null; // per particle: the pin it hangs from (−1: none) and how far that is in the flat cloth
    this.tetherLen = null;
    this.pins = []; // particle indices held in place
    this.glide = new Map(); // pinned particle → { fx, fy, fz, tx, ty, tz }, interpolated over the substeps
    this.spheres = []; // { x, y, z, r, on, k (softness), dir (optional: push only along this unit vector), step (optional: most it moves cloth per substep) }
    this.grabbed = null;
    this.hash = selfCollide ? new SpatialHash(4 * thickness, n) : null; // cells as wide as a whole query: 8 per lookup
    this.frame = 0;
    this.computeNormals();
  }

  pin(i, x, y, z) {
    if (x !== undefined) {
      this.pos[3 * i] = this.prev[3 * i] = x;
      this.pos[3 * i + 1] = this.prev[3 * i + 1] = y;
      this.pos[3 * i + 2] = this.prev[3 * i + 2] = z;
    }
    this.invMass[i] = this.w0[i] = 0;
    if (!this.pins.includes(i)) this.pins.push(i);
  }

  // Long-range attachments (Kim et al. 2012): tie every free particle to its nearest pin with a rope as long as the
  // flat cloth allows. Call after pinning.
  buildTethers(slack = 1.0) {
    const { rest, n } = this;
    this.tetherPin = new Int32Array(n).fill(-1);
    this.tetherLen = new Float32Array(n);
    if (!this.pins.length) return;
    for (let i = 0; i < n; i++) {
      if (this.w0[i] === 0) continue;
      let best = -1, bd = Infinity;
      for (const p of this.pins) {
        const d = Math.hypot(rest[3 * i] - rest[3 * p], rest[3 * i + 1] - rest[3 * p + 1], rest[3 * i + 2] - rest[3 * p + 2]);
        if (d < bd) { bd = d; best = p; }
      }
      this.tetherPin[i] = best;
      this.tetherLen[i] = bd * slack;
    }
  }

  // move a pinned particle to a new place by the end of the next step (no jolt to its neighbours)
  movePin(i, x, y, z) {
    const p = this.pos;
    this.glide.set(i, { fx: p[3 * i], fy: p[3 * i + 1], fz: p[3 * i + 2], tx: x, ty: y, tz: z });
  }

  translate(dx, dy, dz) {
    for (const a of [this.pos, this.prev])
      for (let i = 0; i < this.n; i++) { a[3 * i] += dx; a[3 * i + 1] += dy; a[3 * i + 2] += dz; }
    if (this.grabbed) { const g = this.grabbed; g.tx += dx; g.ty += dy; g.tz += dz; g.px += dx; g.py += dy; g.pz += dz; }
  }

  // fill the wind / current velocity at every particle: fn(x, y, z, out, i)
  fillWind(fn) {
    const { pos, wind } = this, out = [0, 0, 0];
    for (let i = 0; i < this.n; i++) {
      out[0] = out[1] = out[2] = 0;
      fn(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2], out, i);
      wind[3 * i] = out[0]; wind[3 * i + 1] = out[1]; wind[3 * i + 2] = out[2];
    }
  }

  // ——— grabbing ———
  nearest(x, y, z, candidates) {
    let best = -1, bd = Infinity;
    for (const i of candidates) {
      const d = (this.pos[3 * i] - x) ** 2 + (this.pos[3 * i + 1] - y) ** 2 + (this.pos[3 * i + 2] - z) ** 2;
      if (d < bd && this.w0[i] > 0) { bd = d; best = i; }
    }
    return best;
  }

  grab(i, radius = 0.05) {
    const { pos, rest } = this, list = [];
    for (let k = 0; k < this.n; k++) {
      if (this.w0[k] === 0) continue;
      const d = Math.hypot(rest[3 * k] - rest[3 * i], rest[3 * k + 1] - rest[3 * i + 1], rest[3 * k + 2] - rest[3 * i + 2]);
      if (d > radius) continue;
      list.push({ k, w: k === i ? 1 : 0.15 + 0.6 * (1 - d / radius) ** 2, ox: pos[3 * k] - pos[3 * i], oy: pos[3 * k + 1] - pos[3 * i + 1], oz: pos[3 * k + 2] - pos[3 * i + 2] });
    }
    const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
    this.grabbed = { i, list, tx: x, ty: y, tz: z, px: x, py: y, pz: z };
    this.invMass[i] = 0;
  }

  // keep the target within reach of every pin, so pulling never over-stretches the sheet
  drag(x, y, z) {
    const g = this.grabbed;
    if (!g) return;
    const { pos, rest } = this, c = g.i;
    for (let it = 0; it < 3; it++)
      for (const p of this.pins) {
        const L = 1.01 * Math.hypot(rest[3 * c] - rest[3 * p], rest[3 * c + 1] - rest[3 * p + 1], rest[3 * c + 2] - rest[3 * p + 2]);
        const dx = x - pos[3 * p], dy = y - pos[3 * p + 1], dz = z - pos[3 * p + 2], d = Math.hypot(dx, dy, dz);
        if (d > L) { const k = L / d; x = pos[3 * p] + dx * k; y = pos[3 * p + 1] + dy * k; z = pos[3 * p + 2] + dz * k; }
      }
    g.tx = x; g.ty = y; g.tz = z;
  }

  release() {
    if (!this.grabbed) return;
    this.invMass[this.grabbed.i] = this.w0[this.grabbed.i];
    this.grabbed = null;
  }

  // ——— simulation ———
  step(dt) {
    if (dt <= 0) return;
    const S = this.substeps, sdt = dt / S;
    // neighbour lists last `hashEvery` steps: within that time nothing should travel further than the query reach
    if (this.hash && this.frame++ % this.hashEvery === 0) { this.hash.create(this.pos); this.hash.queryAll(this.pos, 2 * this.thickness); }
    const g = this.grabbed;
    if (g) { // the grabbed point follows the hand at a bounded speed
      const dx = g.tx - g.px, dy = g.ty - g.py, dz = g.tz - g.pz, d = Math.hypot(dx, dy, dz), m = this.grabSpeed * dt;
      const k = d > m ? m / d : 1;
      g.ex = g.px + dx * k; g.ey = g.py + dy * k; g.ez = g.pz + dz * k;
    }
    for (let s = 0; s < S; s++) {
      const f = (s + 1) / S;
      for (const [i, m] of this.glide) {
        this.pos[3 * i] = m.fx + (m.tx - m.fx) * f;
        this.pos[3 * i + 1] = m.fy + (m.ty - m.fy) * f;
        this.pos[3 * i + 2] = m.fz + (m.tz - m.fz) * f;
      }
      this.integrate(sdt);
      this.solveConstraints(sdt);
      if (g) this.solveGrab(g.px + (g.ex - g.px) * f, g.py + (g.ey - g.py) * f, g.pz + (g.ez - g.pz) * f);
      this.solveSpheres();
      if (this.tetherPin) this.solveTethers();
      if (this.hash) this.solveSelf();
      this.updateVel(sdt);
    }
    this.glide.clear();
    if (g) { g.px = g.ex; g.py = g.ey; g.pz = g.ez; }
    this.computeNormals();
  }

  integrate(sdt) {
    const { pos, prev, vel, invMass, nrm, wind, gravity } = this;
    const gx = gravity[0] * sdt, gy = gravity[1] * sdt, gz = gravity[2] * sdt;
    const fN = 1 - Math.exp(-this.kN * sdt), fT = 1 - Math.exp(-this.kT * sdt);
    const damp = Math.max(0, 1 - this.damping * sdt), max2 = this.maxSpeed * this.maxSpeed;
    for (let i = 0, n = this.n; i < n; i++) {
      const i3 = 3 * i;
      prev[i3] = pos[i3]; prev[i3 + 1] = pos[i3 + 1]; prev[i3 + 2] = pos[i3 + 2];
      if (invMass[i] === 0) continue;
      let vx = vel[i3] + gx, vy = vel[i3 + 1] + gy, vz = vel[i3 + 2] + gz;
      // drag through the medium: the normal part of the relative velocity goes fast, the tangential part slowly
      const rx = vx - wind[i3], ry = vy - wind[i3 + 1], rz = vz - wind[i3 + 2];
      const nx = nrm[i3], ny = nrm[i3 + 1], nz = nrm[i3 + 2];
      const vn = rx * nx + ry * ny + rz * nz;
      vx -= vn * nx * fN + (rx - vn * nx) * fT;
      vy -= vn * ny * fN + (ry - vn * ny) * fT;
      vz -= vn * nz * fN + (rz - vn * nz) * fT;
      vx *= damp; vy *= damp; vz *= damp;
      const sp = vx * vx + vy * vy + vz * vz;
      if (sp > max2) { const k = this.maxSpeed / Math.sqrt(sp); vx *= k; vy *= k; vz *= k; }
      vel[i3] = vx; vel[i3 + 1] = vy; vel[i3 + 2] = vz;
      pos[i3] += vx * sdt; pos[i3 + 1] += vy * sdt; pos[i3 + 2] += vz * sdt;
    }
  }

  solveConstraints(sdt) {
    const { pos, invMass, cIdx, cRest, cType } = this;
    const k2 = 1 / (sdt * sdt), al = [this.compliance[0] * k2, this.compliance[1] * k2, this.compliance[2] * k2];
    for (let k = 0, m = cRest.length; k < m; k++) {
      const i = cIdx[2 * k], j = cIdx[2 * k + 1];
      const wi = invMass[i], wj = invMass[j], w = wi + wj;
      if (w === 0) continue;
      const i3 = 3 * i, j3 = 3 * j;
      const dx = pos[j3] - pos[i3], dy = pos[j3 + 1] - pos[i3 + 1], dz = pos[j3 + 2] - pos[i3 + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-9) continue;
      const s = (len - cRest[k]) / (len * (w + al[cType[k]]));
      pos[i3] += wi * s * dx; pos[i3 + 1] += wi * s * dy; pos[i3 + 2] += wi * s * dz;
      pos[j3] -= wj * s * dx; pos[j3 + 1] -= wj * s * dy; pos[j3 + 2] -= wj * s * dz;
    }
  }

  solveGrab(tx, ty, tz) {
    const { pos } = this, g = this.grabbed;
    for (const e of g.list) {
      const k3 = 3 * e.k, x = tx + e.ox, y = ty + e.oy, z = tz + e.oz;
      if (e.k === g.i) { pos[k3] = x; pos[k3 + 1] = y; pos[k3 + 2] = z; continue; }
      const a = e.w * 0.45;
      pos[k3] += (x - pos[k3]) * a; pos[k3 + 1] += (y - pos[k3 + 1]) * a; pos[k3 + 2] += (z - pos[k3 + 2]) * a;
    }
  }

  solveSpheres() {
    const { pos, invMass } = this;
    for (const s of this.spheres) {
      if (!s.on || s.r <= 1e-4) continue;
      const r = s.r, r2 = r * r, soft = s.k ?? 1, u = s.dir, cap = s.step ?? r;
      for (let i = 0, n = this.n; i < n; i++) {
        if (invMass[i] === 0) continue;
        const i3 = 3 * i, dx = pos[i3] - s.x;
        if (dx > r || dx < -r) continue;
        const dy = pos[i3 + 1] - s.y;
        if (dy > r || dy < -r) continue;
        const dz = pos[i3 + 2] - s.z, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= r2 || d2 < 1e-12) continue;
        if (u) {
          // a hand pressing in along `dir`: whatever is inside goes straight back to the sphere's far side, never
          // sideways (shoving cloth along its own surface stretches it) and never back toward the hand; a little at a
          // time, so a fold it pushes can't jump through the layer behind it between two collision checks
          const a = dx * u[0] + dy * u[1] + dz * u[2], push = Math.min((Math.sqrt(r2 - (d2 - a * a)) - a) * soft, cap);
          pos[i3] += u[0] * push; pos[i3 + 1] += u[1] * push; pos[i3 + 2] += u[2] * push;
          continue;
        }
        const d = Math.sqrt(d2), k = ((r - d) / d) * soft;
        pos[i3] += dx * k; pos[i3 + 1] += dy * k; pos[i3 + 2] += dz * k;
      }
    }
  }

  solveTethers() {
    const { pos, invMass, tetherPin, tetherLen } = this;
    for (let i = 0; i < this.n; i++) {
      const p = tetherPin[i];
      if (p < 0 || invMass[i] === 0) continue;
      const i3 = 3 * i, p3 = 3 * p;
      const dx = pos[i3] - pos[p3], dy = pos[i3 + 1] - pos[p3 + 1], dz = pos[i3 + 2] - pos[p3 + 2];
      const d2 = dx * dx + dy * dy + dz * dz, L = tetherLen[i];
      if (d2 <= L * L) continue;
      const k = L / Math.sqrt(d2);
      pos[i3] = pos[p3] + dx * k; pos[i3 + 1] = pos[p3 + 1] + dy * k; pos[i3 + 2] = pos[p3 + 2] + dz * k;
    }
  }

  // Particles closer than the cloth's thickness push apart (only when closer than they are in the flat cloth).
  // Where two layers lie on each other they are pushed apart along the cloth's normal only, not along the line
  // between the two particles: otherwise a fold sliding over the sheet bumps across a bed of particle "marbles",
  // which feels like the cloth sticking to itself.
  solveSelf() {
    const { pos, prev, rest, invMass, hash, nrm } = this, t = this.thickness, t2 = t * t;
    for (let id0 = 0; id0 < this.n; id0++) {
      if (invMass[id0] === 0) continue;
      const a = 3 * id0;
      for (let j = hash.firstAdjId[id0], last = hash.firstAdjId[id0 + 1]; j < last; j++) {
        const id1 = hash.adjIds[j];
        if (invMass[id1] === 0) continue;
        const b = 3 * id1;
        let dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > t2 || d2 === 0) continue;
        const r2 = (rest[b] - rest[a]) ** 2 + (rest[b + 1] - rest[a + 1]) ** 2 + (rest[b + 2] - rest[a + 2]) ** 2;
        if (d2 > r2) continue;
        const minD = r2 < t2 ? Math.sqrt(r2) : t, d = Math.sqrt(d2);
        // the two layers' shared normal (flip one if the cloth is folded back on itself)
        let sx = nrm[a], sy = nrm[a + 1], sz = nrm[a + 2];
        const sg = sx * nrm[b] + sy * nrm[b + 1] + sz * nrm[b + 2] >= 0 ? 1 : -1;
        sx += sg * nrm[b]; sy += sg * nrm[b + 1]; sz += sg * nrm[b + 2];
        const sl = Math.sqrt(sx * sx + sy * sy + sz * sz);
        const along = sl > 1e-6 ? (dx * sx + dy * sy + dz * sz) / sl : 0;
        if (sl > 1e-6 && Math.abs(along) > 0.3 * d) {
          const k = (0.5 * (minD - Math.abs(along)) * (along >= 0 ? 1 : -1)) / sl;
          dx = sx * k; dy = sy * k; dz = sz * k;
        } else {
          const k = (0.5 * (minD - d)) / d;
          dx *= k; dy *= k; dz *= k;
        }
        // a soft contact: only part of the overlap goes each substep, so touching layers settle instead of chattering
        dx *= this.contactSoft; dy *= this.contactSoft; dz *= this.contactSoft;
        pos[a] -= dx; pos[a + 1] -= dy; pos[a + 2] -= dz;
        pos[b] += dx; pos[b + 1] += dy; pos[b + 2] += dz;
        // friction (off by default: with it, folded cloth glues itself together)
        const f = this.friction;
        if (f > 0) {
          const v0x = pos[a] - prev[a], v0y = pos[a + 1] - prev[a + 1], v0z = pos[a + 2] - prev[a + 2];
          const v1x = pos[b] - prev[b], v1y = pos[b + 1] - prev[b + 1], v1z = pos[b + 2] - prev[b + 2];
          const ax = (v0x + v1x) * 0.5, ay = (v0y + v1y) * 0.5, az = (v0z + v1z) * 0.5;
          pos[a] += (ax - v0x) * f; pos[a + 1] += (ay - v0y) * f; pos[a + 2] += (az - v0z) * f;
          pos[b] += (ax - v1x) * f; pos[b + 1] += (ay - v1y) * f; pos[b + 2] += (az - v1z) * f;
        }
      }
    }
  }

  updateVel(sdt) {
    const { pos, prev, vel } = this, k = 1 / sdt;
    for (let i = 0, m = 3 * this.n; i < m; i++) vel[i] = (pos[i] - prev[i]) * k;
  }

  computeNormals() {
    const { pos, nrm, tris } = this;
    nrm.fill(0);
    for (let t = 0, m = tris.length; t < m; t += 3) {
      const a = 3 * tris[t], b = 3 * tris[t + 1], c = 3 * tris[t + 2];
      const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2];
      const e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      nrm[a] += nx; nrm[a + 1] += ny; nrm[a + 2] += nz;
      nrm[b] += nx; nrm[b + 1] += ny; nrm[b + 2] += nz;
      nrm[c] += nx; nrm[c + 1] += ny; nrm[c + 2] += nz;
    }
    for (let i = 0; i < this.n; i++) {
      const i3 = 3 * i, l = Math.hypot(nrm[i3], nrm[i3 + 1], nrm[i3 + 2]) || 1;
      nrm[i3] /= l; nrm[i3 + 1] /= l; nrm[i3 + 2] /= l;
    }
  }
}
