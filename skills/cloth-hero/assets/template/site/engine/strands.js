// Bead strands: `count` chains of `beads` particles hanging from fixed anchors. Each substep: gravity and air drag,
// stiff links between neighbouring beads (top down, so the anchors carry the chain), a soft bend link two beads apart,
// a tether from every bead to its anchor (so a long chain can't stretch and bounce), a "finger" (a cylinder through
// the curtain along z) that pushes beads aside softly, and bead-on-bead collisions across strands, so pushed strands
// bunch instead of passing through each other. Step it with a fixed dt (see cloth.js).

export class Strands {
  // stagger: alternate strands hang this much further back, so neighbours can swing past each other instead of
  // jostling in one plane (as real strands do); collide: bead-on-bead collisions on or off
  constructor({ count, beads, pitch, link, radius, x0, y0, z0 = 0, substeps = 8, gravity = -9.81, damping = 0.35, bend = 2e-5, maxSpeed = 5, stagger = 0, collide = true, tetherSlack = 1, linkIters = 1, ftl = false, spans = null }) {
    Object.assign(this, { count, beads, pitch, link, radius, substeps, gravity, damping, bend, maxSpeed, collideOn: collide, tetherSlack, linkIters, ftl, spans });
    const n = (this.n = count * beads);
    this.pos = new Float32Array(3 * n);
    this.prev = new Float32Array(3 * n);
    this.vel = new Float32Array(3 * n);
    this.invMass = new Float32Array(n).fill(1);
    for (let s = 0; s < count; s++)
      for (let k = 0; k < beads; k++) {
        const i = s * beads + k;
        this.pos[3 * i] = x0 + s * pitch;
        this.pos[3 * i + 1] = y0 - k * link;
        this.pos[3 * i + 2] = z0 - (s & 1) * stagger;
      }
    for (let s = 0; s < count; s++) this.invMass[s * beads] = 0;
    this.prev.set(this.pos);
    // the finger: soft = share of the overlap removed per substep; maxPush = how far (m) it can carry a bead from its
    // strand's resting line before the bead slips off it and falls back
    this.finger = { x: 0, y: 0, r: 0, zPush: 0.1, soft: 0.35, maxPush: Infinity };
    this.zMax = Infinity; // a wall in front: beads can't come further forward than this
    // wind: windFn(s, t, out) gives strand s's air velocity [x, z]; air couples the beads to it at `air` per second
    this.windFn = null;
    this.air = 1.2;
    this.windX = new Float32Array(count);
    this.windZ = new Float32Array(count);
    this.impacts = 0; // summed collision speed since last read (for sound)
    this.hit = { x: 0, y: 0 };

    // a uniform grid over the area the curtain can swing into, cells one bead wide
    const cell = (this.cell = 2 * radius);
    this.gx0 = x0 - 0.8; this.gy0 = y0 - beads * link - 0.6;
    this.gw = Math.ceil(((count - 1) * pitch + 1.6) / cell);
    this.gh = Math.ceil((beads * link + 0.8) / cell);
    this.cellStart = new Int32Array(this.gw * this.gh + 1);
    this.fill = new Int32Array(this.gw * this.gh);
    this.cellItems = new Int32Array(n);
    this.cellOf = new Int32Array(n);
  }

  moveAnchors(x0, y0, z0 = 0) {
    for (let s = 0; s < this.count; s++) {
      const i = 3 * s * this.beads;
      const dx = x0 + s * this.pitch - this.pos[i], dy = y0 - this.pos[i + 1], dz = z0 - this.pos[i + 2];
      for (let k = 0; k < this.beads; k++) {
        const j = 3 * (s * this.beads + k);
        this.pos[j] += dx; this.pos[j + 1] += dy; this.pos[j + 2] += dz;
        this.prev[j] += dx; this.prev[j + 1] += dy; this.prev[j + 2] += dz;
      }
    }
    this.gx0 = x0 - 0.8; this.gy0 = y0 - this.beads * this.link - 0.6;
  }

  step(dt, t) {
    if (dt <= 0) return;
    const S = this.substeps, sdt = dt / S;
    // the air each strand hangs in, once per step
    if (this.windFn) { const o = [0, 0]; for (let s = 0; s < this.count; s++) { o[0] = o[1] = 0; this.windFn(s, t, o); this.windX[s] = o[0]; this.windZ[s] = o[1]; } }
    for (let s = 0; s < S; s++) {
      this.integrate(sdt, t);
      for (let it = 0; it < this.linkIters; it++) this.solveLinks(sdt);
      if (this.spans) this.solveSpans();
      else if (this.ftl) this.solveLeader();
      else if (this.tetherSlack < 9) this.solveTethers();
      this.solveFinger();
      if (this.collideOn) this.collide();
      if (this.zMax < Infinity) for (let i = 2; i < 3 * this.n; i += 3) if (this.pos[i] > this.zMax) this.pos[i] = this.zMax;
      const { pos, prev, vel } = this, k = 1 / sdt;
      for (let i = 0, m = 3 * this.n; i < m; i++) vel[i] = (pos[i] - prev[i]) * k;
    }
  }

  integrate(sdt, t) {
    const { pos, prev, vel, invMass, beads } = this;
    const g = this.gravity * sdt, damp = Math.max(0, 1 - this.damping * sdt), max = this.maxSpeed, max2 = max * max;
    const air = this.windFn ? 1 - Math.exp(-this.air * sdt) : 0;
    for (let s = 0, i = 0; s < this.count; s++) {
      const wx = this.windX[s], wz = this.windZ[s];
      for (let k = 0; k < beads; k++, i++) {
      const i3 = 3 * i;
      prev[i3] = pos[i3]; prev[i3 + 1] = pos[i3 + 1]; prev[i3 + 2] = pos[i3 + 2];
      if (invMass[i] === 0) continue;
      let vx = vel[i3], vy = vel[i3 + 1] + g, vz = vel[i3 + 2];
      if (air) { vx += (wx - vx) * air; vz += (wz - vz) * air; }
      vx *= damp; vy *= damp; vz *= damp;
      const sp2 = vx * vx + vy * vy + vz * vz;
      if (sp2 > max2) { const q = max / Math.sqrt(sp2); vx *= q; vy *= q; vz *= q; }
      vel[i3] = vx; vel[i3 + 1] = vy; vel[i3 + 2] = vz;
      pos[i3] += vx * sdt; pos[i3 + 1] += vy * sdt; pos[i3 + 2] += vz * sdt;
      }
    }
  }

  solveLinks(sdt) {
    const { pos, invMass, beads, link: step } = this;
    const aB = this.bend / (sdt * sdt);
    for (let s = 0; s < this.count; s++) {
      const base = s * beads;
      for (let k = 0; k + 1 < beads; k++) link(base + k, base + k + 1, step, 0);
      for (let k = 0; k + 2 < beads; k++) link(base + k, base + k + 2, 2 * step, aB, true);
    }
    function link(i, j, rest, alpha, pushOnly) {
      const wi = invMass[i], wj = invMass[j], w = wi + wj;
      if (w === 0) return;
      const i3 = 3 * i, j3 = 3 * j;
      const dx = pos[j3] - pos[i3], dy = pos[j3 + 1] - pos[i3 + 1], dz = pos[j3 + 2] - pos[i3 + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-9 || (pushOnly && len > rest)) return;
      const c = (len - rest) / (len * (w + alpha));
      pos[i3] += wi * c * dx; pos[i3 + 1] += wi * c * dy; pos[i3 + 2] += wi * c * dz;
      pos[j3] -= wj * c * dx; pos[j3 + 1] -= wj * c * dy; pos[j3 + 2] -= wj * c * dz;
    }
  }

  // span limits: bead k may be no further than m links from bead k − m (both move, like any constraint). They stop a
  // long strand stretching under its own weight, but say nothing about direction, so a strand pushed aside still
  // hangs plumb below the push (a tether to the anchor would drag it back toward its old line).
  solveSpans() {
    const { pos, invMass, beads, link } = this;
    for (const m of this.spans) {
      const L = m * link, L2 = L * L;
      for (let s = 0; s < this.count; s++) {
        const base = s * beads;
        for (let k = m; k < beads; k++) {
          const i = base + k - m, j = base + k, wi = invMass[i], wj = invMass[j], w = wi + wj;
          const i3 = 3 * i, j3 = 3 * j;
          const dx = pos[j3] - pos[i3], dy = pos[j3 + 1] - pos[i3 + 1], dz = pos[j3 + 2] - pos[i3 + 2], d2 = dx * dx + dy * dy + dz * dz;
          if (d2 <= L2 || w === 0) continue;
          const d = Math.sqrt(d2), c = (d - L) / (d * w);
          pos[i3] += wi * c * dx; pos[i3 + 1] += wi * c * dy; pos[i3 + 2] += wi * c * dz;
          pos[j3] -= wj * c * dx; pos[j3 + 1] -= wj * c * dy; pos[j3 + 2] -= wj * c * dz;
        }
      }
    }
  }

  // follow the leader (Müller 2012): sweep each strand from its anchor down and pull every bead back to within one
  // link of the bead above it. The chain can't stretch (so it can't bounce), yet below a push it hangs plumb.
  solveLeader() {
    const { pos, beads, link } = this, l2 = link * link;
    for (let s = 0; s < this.count; s++) {
      for (let k = 1, i3 = 3 * (s * beads + 1); k < beads; k++, i3 += 3) {
        const dx = pos[i3] - pos[i3 - 3], dy = pos[i3 + 1] - pos[i3 - 2], dz = pos[i3 + 2] - pos[i3 - 1], d2 = dx * dx + dy * dy + dz * dz;
        if (d2 <= l2) continue;
        const q = link / Math.sqrt(d2);
        pos[i3] = pos[i3 - 3] + dx * q; pos[i3 + 1] = pos[i3 - 2] + dy * q; pos[i3 + 2] = pos[i3 - 1] + dz * q;
      }
    }
  }

  // every bead stays within a straight chain's length of its anchor
  solveTethers() {
    const { pos, beads, link } = this;
    for (let s = 0; s < this.count; s++) {
      const a3 = 3 * s * beads, ax = pos[a3], ay = pos[a3 + 1], az = pos[a3 + 2];
      for (let k = 2; k < beads; k++) {
        const i3 = a3 + 3 * k, dx = pos[i3] - ax, dy = pos[i3 + 1] - ay, dz = pos[i3 + 2] - az;
        const d2 = dx * dx + dy * dy + dz * dz, L = k * link * this.tetherSlack;
        if (d2 <= L * L) continue;
        const q = L / Math.sqrt(d2);
        pos[i3] = ax + dx * q; pos[i3 + 1] = ay + dy * q; pos[i3 + 2] = az + dz * q;
      }
    }
  }

  // a finger through the curtain: beads inside its circle (in x, y) are eased out of it, and a little back — until
  // a bead has been carried maxPush from its strand's resting line; then it slips off and the strand falls back
  solveFinger() {
    const f = this.finger;
    if (f.r <= 1e-4) return;
    const { pos, invMass, beads } = this, r = f.r + this.radius, r2 = r * r, soft = f.soft, mp = f.maxPush;
    for (let i = 0; i < this.n; i++) {
      if (invMass[i] === 0) continue;
      const i3 = 3 * i, dx = pos[i3] - f.x;
      if (dx > r || dx < -r) continue;
      const dy = pos[i3 + 1] - f.y, d2 = dx * dx + dy * dy;
      if (d2 >= r2) continue;
      const d = Math.sqrt(d2) || 1e-6;
      let push = (r - d) * soft;
      if (mp < Infinity) {
        // how far this bead already sits from where its strand hangs (its anchor's x), in the direction of the push
        const disp = pos[i3] - pos[3 * ((i / beads) | 0) * beads], out = (dx / d) * Math.sign(disp || dx);
        if (out > 0) push *= Math.max(0, Math.min(1, (mp - Math.abs(disp)) / (0.35 * mp)));
        if (push <= 0) continue;
      }
      pos[i3] += (dx / d) * push;
      pos[i3 + 1] += (dy / d) * push;
      pos[i3 + 2] -= push * f.zPush;
    }
  }

  collide() {
    const { pos, vel, invMass, beads, cell, gw, gh, cellStart, cellItems, cellOf } = this;
    const d = 2 * this.radius, d2 = d * d;
    cellStart.fill(0);
    for (let i = 0; i < this.n; i++) {
      const cx = Math.min(gw - 1, Math.max(0, ((pos[3 * i] - this.gx0) / cell) | 0));
      const cy = Math.min(gh - 1, Math.max(0, ((pos[3 * i + 1] - this.gy0) / cell) | 0));
      const c = cy * gw + cx;
      cellOf[i] = c;
      cellStart[c + 1]++;
    }
    for (let c = 0; c < gw * gh; c++) cellStart[c + 1] += cellStart[c];
    const fill = this.fill;
    fill.set(cellStart.subarray(0, gw * gh));
    for (let i = 0; i < this.n; i++) cellItems[fill[cellOf[i]]++] = i;

    let impacts = 0;
    for (let i = 0; i < this.n; i++) {
      const c = cellOf[i], cx = c % gw, cy = (c / gw) | 0, si = (i / beads) | 0, ki = i - si * beads;
      const i3 = 3 * i;
      for (let oy = -1; oy <= 1; oy++) {
        const yy = cy + oy;
        if (yy < 0 || yy >= gh) continue;
        for (let ox = -1; ox <= 1; ox++) {
          const xx = cx + ox;
          if (xx < 0 || xx >= gw) continue;
          const cc = yy * gw + xx;
          for (let q = cellStart[cc], end = cellStart[cc + 1]; q < end; q++) {
            const j = cellItems[q];
            if (j <= i) continue;
            const sj = (j / beads) | 0;
            if (sj === si && Math.abs(j - sj * beads - ki) < 2) continue;
            const j3 = 3 * j;
            const dx = pos[j3] - pos[i3], dy = pos[j3 + 1] - pos[i3 + 1], dz = pos[j3 + 2] - pos[i3 + 2];
            const dd = dx * dx + dy * dy + dz * dz;
            if (dd >= d2 || dd < 1e-12) continue;
            const wi = invMass[i], wj = invMass[j], w = wi + wj;
            if (w === 0) continue;
            const dist = Math.sqrt(dd), k = (d - dist) / (dist * w);
            pos[i3] -= dx * k * wi; pos[i3 + 1] -= dy * k * wi; pos[i3 + 2] -= dz * k * wi;
            pos[j3] += dx * k * wj; pos[j3 + 1] += dy * k * wj; pos[j3 + 2] += dz * k * wj;
            // relative speed of the two beads → how loud this knock is
            const vx = vel[i3] - vel[j3], vy = vel[i3 + 1] - vel[j3 + 1], vz = vel[i3 + 2] - vel[j3 + 2], rv2 = vx * vx + vy * vy + vz * vz;
            if (rv2 > 0.0625) { impacts += Math.sqrt(rv2); this.hit.x = pos[i3]; this.hit.y = pos[i3 + 1]; }
          }
        }
      }
    }
    this.impacts += impacts;
  }
}
