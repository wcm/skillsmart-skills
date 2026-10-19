/* Flappy Roadster · TUNNEL: the unveil's ramp, where the car hung upside down on its suction fans.
   Drive a neon LED tunnel; tap and the thrusters roll you across to the other surface, where the
   fans hold you on. Gaps and obstacles on one side force you to the other. */
(function () {
  'use strict';
  const R = window.R;
  const DT = R.DT;
  const W = R.W;
  const H = R.H;
  const FLOOR = R.GROUND;
  const CEIL = FLOOR - 160; // a tunnel in the middle of the screen
  const MID = (FLOOR + CEIL) / 2;
  const CELL = 8; // track resolution in px
  const FAR_T = CEIL + 32; // the far wall, seen across the tunnel
  const FAR_B = FLOOR - 32;
  const DROP = 70; // this far through a gap in the floor (or ceiling) and the car is gone
  const VP = W / 2;
  // Signs on the far wall, every SIGN_GAP px of it.
  const SIGN_GAP = 230;
  const SIGNS = ['SPEED LIMIT 0.81 S', 'NO PARKING ON CEILING', 'MIND THE GAP', 'EXIT: 2028', 'SUCTION ZONE', 'CEILING LANE OPEN', 'NO KICKFLIPS', 'UPSIDE DOWN AHEAD'];
  const SIGN_COLS = ['#2ef6ff', '#ff3fd2', '#ffe14d'];

  // Tuned for a 250 px roll from floor to ceiling. Push and pull scale with the distance, so a
  // flip takes just as long in a shorter tunnel.
  const K = (FLOOR - CEIL - 2 * R.ROAD_DY) / 250;
  const TUNE = [
    { speed: 104, accel: 0.06, max: 150, grav: 1350 * K, push: 230 * K },
    { speed: 120, accel: 0.07, max: 172, grav: 1500 * K, push: 240 * K },
    { speed: 140, accel: 0.08, max: 196, grav: 1650 * K, push: 255 * K },
    { speed: 162, accel: 0.09, max: 222, grav: 1800 * K, push: 270 * K },
  ];
  const ROLL = 150;
  const DELAYS = [0, 3, 6, 10, 15, 21, 28, 36, 45];
  const FOOT = [-12, 12];
  const LIP = 9; // deeper than this in a gap and the far edge is a wall

  class TunnelWorld {
    constructor(opts) {
      this.kind = 'tunnel';
      this.noRain = true;
      this.ceil = CEIL;
      this.seed = opts.seed >>> 0;
      this.rand = R.rng(this.seed);
      this.setMode(opts.mode);
      this.skin = opts.skin || { gravity: 1, flap: 1 };
      this.roadDy = this.skin.roadDy || R.ROAD_DY;
      this.replay = opts.replay || null;
      this.state = opts.state || 'ready';
      this.step = 0;
      this.t = 0;
      this.stateT = 0;
      this.dist = 0;
      this.speed = this.m.speed;
      this.score = 0;
      this.near = 0;
      this.combo = 0;
      this.bolts = 0;
      this.boltsTotal = 0;
      this.ludi = 0;
      this.invuln = 0;
      this.phantom = 0;
      this.topSpeed = 0;
      this.zone = 0;
      this.lap = 0;
      this.flips = 0;
      this.ceilT = 0;
      this.pipes = [];
      // Track cells from the car rightwards: { floor, ceil } solidity, plus obstacles and bolts.
      this.cells = [];
      this.cellX = 0; // screen x of cells[0]
      this.genX = 0; // chunks planned so far
      this.genCells = 0; // cells planned so far
      this.need = 'floor'; // the side the car has to be on after the last planned hazard
      this.plan = [];
      this.inputs = [];
      this.queue = [];
      this.auto = !!opts.auto;
      this.autoUntil = this.replay ? this.replay.autoUntil : -1;
      this.cinematic = !!opts.cinematic;
      this.events = [];
      this.deathStep = -1;
      this.deathKind = '';
      this.car = { x: R.CAR_X, y: FLOOR - this.roadDy, vy: 0, ang: 0, va: 0, roll: 0, side: 1, on: true, coyote: 0, alive: true, flapT: 9, fold: 0, bounces: 0, resting: false };
      this.fill();
      if (this.replay) {
        this.replayIdx = 0;
        this.state = 'play';
        this.t = -DT;
      }
    }

    setMode(mode) {
      this.mode = mode;
      this.m = TUNE[Math.max(0, R.MODES.indexOf(mode))];
      this.speed = this.m.speed;
    }
    emit(e) {
      this.events.push(e);
    }
    isAuto() {
      return this.replay ? this.step < this.autoUntil : this.auto;
    }
    tap() {
      this.queue.push(1);
    }
    release() {}
    startIntro() {
      this.state = 'ready';
      this.stateT = 0;
    }

    // ---------------- the track ----------------
    // Cells are generated in chunks: a clear buffer, then hazards on one side, sized so a flip can
    // always be finished between hazards on opposite sides.
    fill() {
      const need = Math.ceil((W + 340 - this.cellX) / CELL) + 2;
      while (this.cells.length < need) {
        if (!this.plan.length) this.planChunk();
        this.cells.push(this.plan.shift());
      }
    }

    planChunk() {
      const rnd = this.rand;
      const k = this.genX++;
      // The speed the car will have here: it gains accel per metre.
      const speed = Math.min(this.m.max, this.m.speed + this.m.accel * ((this.genCells * CELL) / 10)) * 1.03;
      const flipCells = Math.ceil((speed * 0.5 + 44) / CELL);
      const cell = () => ({ floor: true, ceil: true, ob: null, bolt: null });
      const chunk = [];
      const clear = k < 2 ? 22 : flipCells + 1 + Math.floor(rnd() * (k < 8 ? 7 : 4));
      for (let i = 0; i < clear; i++) chunk.push(cell());
      if (k >= 1) {
        // Most hazards sit on the side the car has to be on right now, so passing means flipping.
        const force = rnd() < (k < 4 ? 0.65 : 0.85);
        const side = force ? this.need : this.need === 'floor' ? 'ceil' : 'floor';
        this.need = side === 'floor' ? 'ceil' : 'floor';
        const kind = rnd();
        const len = 4 + Math.floor(rnd() * (k < 6 ? 4 : 8));
        const hazard = [];
        for (let i = 0; i < len; i++) hazard.push(cell());
        if (kind < 0.55) {
          for (const c of hazard) c[side] = false; // a gap
        } else {
          // Obstacles sitting on that side.
          const n = 1 + Math.floor(rnd() * 2);
          for (let j = 0; j < n; j++) {
            const at = Math.floor(rnd() * len);
            hazard[at].ob = { side, type: side === 'floor' ? (rnd() < 0.5 ? 'cone' : 'barrier') : rnd() < 0.5 ? 'lamp' : 'duct' };
          }
          hazard[0].ob = hazard[0].ob || { side, type: side === 'floor' ? 'barrier' : 'duct' };
        }
        // Before a forced flip, a bolt hangs mid-tunnel right where the flip crosses.
        if (k > 1 && force && rnd() < 0.6) chunk[Math.floor(clear * 0.55)].bolt = { y: MID - 18 + rnd() * 36, taken: false };
        chunk.push(...hazard);
      }
      this.genCells += chunk.length;
      this.plan.push(...chunk);
    }

    cellAt(x) {
      const i = Math.floor((x - this.cellX) / CELL);
      return i >= 0 && i < this.cells.length ? this.cells[i] : null;
    }
    solid(side, x0, x1) {
      // Is there surface under any part of [x0, x1]? (The fans hold on with part of the car.)
      for (let x = x0; x <= x1; x += CELL / 2) {
        const c = this.cellAt(x);
        if (c && c[side]) return true;
      }
      return false;
    }
    surfaceFull(side, x0, x1) {
      for (let x = x0; x <= x1; x += CELL / 2) {
        const c = this.cellAt(x);
        if (!c || !c[side]) return false;
      }
      return true;
    }

    obstacleRect(c, i) {
      const x = this.cellX + i * CELL;
      const o = c.ob;
      const h = o.type === 'cone' ? 12 : o.type === 'barrier' ? 18 : o.type === 'lamp' ? 16 : 20;
      const w = o.type === 'barrier' ? 10 : o.type === 'duct' ? 12 : 8;
      return o.side === 'floor' ? [x, FLOOR - h, w, h] : [x, CEIL, w, h];
    }

    // ---------------- the step ----------------
    update() {
      const car = this.car;
      this.t += DT;
      this.stateT += DT;
      if (this.state === 'title' || this.state === 'ready') {
        this.speed = this.m.speed * (this.state === 'title' ? 0.5 : 1);
        this.scroll(this.speed * DT);
        car.y = FLOOR - this.roadDy;
        if (this.state === 'ready' && (this.queue.length || this.auto)) {
          this.queue.length = 0;
          this.state = 'play';
          this.stateT = 0;
          this.step = 0;
          this.t = -DT;
          // Same start as a replay: fresh track from the car onwards.
          this.reset();
          this.emit({ type: 'start' });
          this.forcePress = !this.auto;
          this.update();
        }
        return;
      }
      const acts = [];
      if (this.replay) {
        const ins = this.replay.inputs;
        while (this.replayIdx < ins.length && ins[this.replayIdx] === this.step) {
          acts.push(1);
          this.replayIdx++;
        }
      } else if (this.state === 'play') {
        if (this.forcePress) acts.push(1);
        else if (this.queue.length) {
          if (this.auto) {
            this.auto = false;
            this.autoUntil = this.step;
            this.emit({ type: 'disengage' });
          }
          acts.push(1);
        } else if (this.auto && this.pilot()) acts.push(1);
      }
      this.forcePress = false;
      this.queue.length = 0;
      if (this.state === 'play' && this.auto) this.autoUntil = this.step + 1;

      if (this.state === 'play') {
        for (const a of acts) {
          this.inputs.push(this.step);
          this.flip();
        }
        this.physics();
      } else this.updateDead();

      const m = this.m;
      if (this.state === 'dead') {
        this.speed *= Math.exp(-5 * DT);
        if (this.speed < 1) this.speed = 0;
      } else this.speed = R.approach(this.speed, Math.min(m.max, m.speed + m.accel * this.score) * (this.ludi > 0 ? 1.45 : 1), 3, DT);
      this.topSpeed = Math.max(this.topSpeed, this.speed);
      this.scroll(this.speed * DT);
      if (this.state === 'play') this.interact();
      if (this.ludi > 0) {
        this.ludi -= DT;
        if (this.ludi <= 0) {
          this.ludi = 0;
          this.invuln = 1;
          this.emit({ type: 'ludiEnd' });
        }
      } else if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - DT);
      this.step++;
    }

    reset() {
      this.cells = [];
      this.plan = [];
      this.cellX = 0;
      this.genX = 0;
      this.genCells = 0;
      this.need = 'floor';
      this.rand = R.rng(this.seed);
      this.fill();
      Object.assign(this.car, { y: FLOOR - this.roadDy, vy: 0, ang: 0, side: 1, on: true, roll: 0, coyote: 0, flapT: 9 });
      this.speed = this.m.speed;
      this.dist = 0;
      this.score = 0;
      this.flips = 0;
      this.ceilT = 0;
      this.topSpeed = 0;
    }

    scroll(dx) {
      this.dist += dx;
      this.cellX -= dx;
      while (this.cellX < -CELL * 30 && this.cells.length) {
        this.cells.shift();
        this.cellX += CELL;
      }
      this.fill();
      if (this.state === 'play') {
        const meters = Math.floor(this.dist / 10);
        if (meters > this.score) {
          this.score = meters;
          if (meters % 10 === 0) this.emit({ type: 'score', score: meters, pipe: { stack: false } });
        }
      }
    }

    flip() {
      const car = this.car;
      if (!car.on && car.coyote <= 0) return;
      car.side = -car.side;
      car.on = false;
      car.coyote = 0;
      car.vy = -car.side * -this.m.push * this.skin.flap;
      car.flapT = 0;
      this.flips++;
      this.emit({ type: 'flap', x: car.x, y: car.y, ang: car.ang, flip: car.side });
    }

    physics() {
      const car = this.car;
      const m = this.m;
      car.flapT += DT;
      if (car.side < 0 && car.on) this.ceilT += DT;
      // Roll toward the surface we're heading to: upright on the floor, mirrored on the ceiling.
      const target = car.side > 0 ? 0 : Math.PI;
      car.roll = R.approach(car.roll, target, car.on ? 18 : 9, DT);
      if (car.on) {
        const side = car.side > 0 ? 'floor' : 'ceil';
        if (!this.solid(side, car.x + FOOT[0], car.x + FOOT[1]) && this.ludi <= 0) {
          car.on = false;
          car.coyote = 0.09;
          car.vy = 0;
        }
        return;
      }
      car.coyote = Math.max(0, car.coyote - DT);
      car.vy += car.side * m.grav * this.skin.gravity * DT;
      car.y += car.vy * DT;
      const side = car.side > 0 ? 'floor' : 'ceil';
      const depth = car.side > 0 ? car.y + this.roadDy - FLOOR : CEIL - (car.y - this.roadDy);
      if (depth >= 0 && (this.solid(side, car.x + FOOT[0], car.x + FOOT[1]) || this.ludi > 0)) {
        // Sunk too far into a gap: the far lip catches the nose.
        if (depth > LIP && this.ludi <= 0) return this.crash('lip');
        car.y = car.side > 0 ? FLOOR - this.roadDy : CEIL + this.roadDy;
        const v = Math.abs(car.vy);
        car.vy = 0;
        car.on = true;
        this.emit({ type: 'touch', ceil: car.side < 0, v, x: car.x, y: car.side > 0 ? FLOOR : CEIL });
      }
      if (car.y > FLOOR + DROP) return this.crash('pit');
      if (car.y < CEIL - DROP) return this.crash('suction');
    }

    circles(y, roll) {
      const x = this.car.x;
      const s = Math.cos(roll) >= 0 ? 1 : -1;
      return R.CAR_HIT.map(([hx, hy, r]) => [x + hx, y + hy * s, r]);
    }

    interact() {
      const car = this.car;
      const circles = this.circles(car.y, car.roll);
      for (let i = 0; i < this.cells.length; i++) {
        const c = this.cells[i];
        const cx = this.cellX + i * CELL;
        if (cx > car.x + 30) break;
        if (cx < car.x - 40) continue;
        if (c.ob && !c.ob.smashed) {
          const [rx, ry, rw, rh] = this.obstacleRect(c, i);
          let hit = false;
          let clear = 99;
          for (const [px, py, r] of circles) {
            const nx = px < rx ? rx : px > rx + rw ? rx + rw : px;
            const ny = py < ry ? ry : py > ry + rh ? ry + rh : py;
            const d = Math.hypot(px - nx, py - ny) - r;
            if (d < 0) hit = true;
            if (px + r > rx && px - r < rx + rw) clear = Math.min(clear, d);
          }
          if (hit) {
            if (this.ludi > 0) {
              c.ob.smashed = true;
              this.emit({ type: 'smash', x: rx, y: ry + rh / 2, top: c.ob.side === 'ceil', pipe: { zone: 0, kind: 0, hue: i % 4 } });
            } else if (this.invuln <= 0) return this.crash('wall', c.ob.type);
          } else if (clear < 4 && !c.ob.near) {
            c.ob.near = true;
            this.near++;
            this.emit({ type: 'near', clear: Math.max(0, clear), combo: ++this.combo });
          }
        }
        if (c.bolt && !c.bolt.taken) {
          const bx = cx + CELL / 2;
          if ((bx - car.x) * (bx - car.x) + (c.bolt.y - car.y) * (c.bolt.y - car.y) < 14 * 14) {
            c.bolt.taken = true;
            this.boltsTotal++;
            this.bolts++;
            this.emit({ type: 'bolt', x: bx, y: c.bolt.y, count: this.bolts });
            if (this.bolts >= 3 && this.ludi <= 0) {
              this.bolts = 0;
              this.ludi = 4;
              this.invuln = 0;
              this.emit({ type: 'ludi' });
            }
          }
        }
      }
    }

    crash(kind, what) {
      const car = this.car;
      car.alive = false;
      this.state = 'dead';
      this.stateT = 0;
      this.deathStep = this.step;
      this.deathKind = kind;
      this.victim = what || null;
      this.emit({ type: 'crash', kind, x: car.x, y: car.y, vy: car.vy, zone: 0, speed: this.speed, victim: this.victim, ceil: car.side < 0 });
      car.va = (this.rand() < 0.5 ? -1 : 1) * (6 + this.rand() * 4);
      if (kind === 'wall') car.vy = car.side * -120;
    }

    updateDead() {
      const car = this.car;
      if (car.resting) return;
      car.roll = R.approach(car.roll, car.side > 0 ? 0 : Math.PI, 9, DT);
      if (this.deathKind !== 'wall') {
        // Falling out of the tunnel: keep going.
        car.vy += car.side * this.m.grav * DT;
        car.y += car.vy * DT;
        car.ang += car.va * DT;
        return;
      }
      car.vy += car.side * this.m.grav * 0.6 * DT;
      car.y += car.vy * DT;
      car.ang += car.va * DT;
      const lim = car.side > 0 ? FLOOR - 8 : CEIL + 8;
      if ((car.side > 0 && car.y > lim) || (car.side < 0 && car.y < lim)) {
        car.y = lim;
        if (Math.abs(car.vy) > 60 && car.bounces < 3) {
          car.bounces++;
          this.emit({ type: 'land', x: car.x, y: car.side > 0 ? FLOOR : CEIL, v: Math.abs(car.vy) });
          car.vy = -car.vy * 0.3;
          car.va *= 0.5;
        } else {
          // Settle flat on whichever side it landed.
          car.vy = 0;
          car.va = 0;
          const a = ((car.ang % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          const flat = Math.abs(a - Math.PI) < Math.PI / 2 ? Math.PI : a > Math.PI ? 2 * Math.PI : 0;
          car.ang = R.approach(a, flat, 10, DT);
          if (Math.abs(car.ang - flat) < 0.01) {
            car.ang = flat % (2 * Math.PI);
            car.resting = true;
            // On the ceiling, still held by the fans.
            this.emit({ type: 'rest', upsideDown: (car.side < 0) !== (car.ang > 1) });
          }
        }
      }
    }

    // ---------------- FSF for the tunnel ----------------
    // Try flipping now or after a delay; roll each plan forward through the same rules and flip
    // when "now" survives longest (then, with the most clearance).
    pilot() {
      const car = this.car;
      if (!car.on && car.coyote <= 0) return false;
      // Flip only if now beats staying and no later flip beats now; most steps stop at the first test.
      const now = this.rollout(0);
      if (!(now > this.rollout(-1) + 1e-6)) return false;
      for (let i = 1; i < DELAYS.length; i++) if (this.rollout(DELAYS[i]) > now + 1e-6) return false;
      return true;
    }

    rollout(delay) {
      const car = this.car;
      const m = this.m;
      let y = car.y;
      let vy = car.vy;
      let side = car.side;
      let on = car.on;
      let coyote = car.coyote;
      let roll = car.roll;
      let shift = 0;
      let clearMin = 10;
      // Ludicrous runs out mid-plan: bridged gaps open again, then a second of invulnerability.
      let ludi = this.ludi;
      let inv = this.invuln;
      const g0 = m.grav * this.skin.gravity;
      // Speed follows the sim too: Ludicrous ending mid-flip slows the car, so it lands earlier.
      let sp = this.speed;
      const base = Math.min(m.max, m.speed + m.accel * this.score);
      const bolts = [];
      for (let k = 0; k < this.cells.length; k++) {
        const c = this.cells[k];
        if (c.bolt && !c.bolt.taken) bolts.push([this.cellX + k * CELL + CELL / 2, c.bolt.y]);
      }
      let gotBolt = false;
      const solidAt = (sd, x0, x1) => {
        for (let x = x0; x <= x1; x += CELL / 2) {
          const i = Math.floor((x + shift - this.cellX) / CELL);
          const c = i >= 0 && i < this.cells.length ? this.cells[i] : null;
          if (c && c[sd]) return true;
        }
        return false;
      };
      for (let i = 0; i < ROLL; i++) {
        if (i === delay && (on || coyote > 0)) {
          side = -side;
          on = false;
          coyote = 0;
          vy = side * m.push * this.skin.flap;
        }
        roll = R.approach(roll, side > 0 ? 0 : Math.PI, on ? 18 : 9, DT);
        if (on) {
          if (!solidAt(side > 0 ? 'floor' : 'ceil', car.x + FOOT[0], car.x + FOOT[1]) && ludi <= 0) {
            on = false;
            coyote = 0.09;
            vy = 0;
          }
        } else {
          coyote = Math.max(0, coyote - DT);
          vy += side * g0 * DT;
          y += vy * DT;
          const depth = side > 0 ? y + this.roadDy - FLOOR : CEIL - (y - this.roadDy);
          if (depth >= 0 && (solidAt(side > 0 ? 'floor' : 'ceil', car.x + FOOT[0], car.x + FOOT[1]) || ludi > 0)) {
            if (depth > LIP && ludi <= 0) return i;
            y = side > 0 ? FLOOR - this.roadDy : CEIL + this.roadDy;
            vy = 0;
            on = true;
          }
          if (y > FLOOR + DROP || y < CEIL - DROP) return i;
        }
        sp = R.approach(sp, base * (ludi > 0 ? 1.45 : 1), 3, DT);
        shift += sp * DT;
        if (!gotBolt) for (const [bx, by] of bolts) if ((bx - shift - car.x) ** 2 + (by - y) ** 2 < 13 * 13) gotBolt = true;
        const tough = ludi > 0 || inv > 0;
        if (ludi > 0) {
          ludi -= DT;
          if (ludi <= 0) inv = 1;
        } else if (inv > 0) inv -= DT;
        if (tough) continue;
        // Obstacles.
        const s = Math.cos(roll) >= 0 ? 1 : -1;
        for (let k = 0; k < this.cells.length; k++) {
          const c = this.cells[k];
          const cx = this.cellX + k * CELL - shift;
          if (cx > car.x + 30) break;
          if (cx < car.x - 40 || !c.ob || c.ob.smashed) continue;
          const [, ry, rw, rh] = this.obstacleRect(c, k);
          for (const [hx, hy, r] of R.CAR_HIT) {
            const px = car.x + hx;
            const py = y + hy * s;
            const nx = px < cx ? cx : px > cx + rw ? cx + rw : px;
            const ny = py < ry ? ry : py > ry + rh ? ry + rh : py;
            const d = Math.hypot(px - nx, py - ny) - r;
            if (d < 0.6) return i;
            if (d < clearMin) clearMin = d;
          }
        }
      }
      // Survivors rank by clearance, then by grabbing a bolt on the way.
      return ROLL + 1 + (this.cinematic ? Math.min(clearMin, 2) : clearMin) / 11 + (gotBolt ? 0.6 : 0) - (delay > 0 ? delay * 0.0005 : 0);
    }

    // ---------------- drawing ----------------
    drawBack(view, b, gl, t) {
      // Looking across the tunnel: the far wall, with the ceiling and floor running away from us
      // in perspective, ribbed every few metres, and rainbow LED strips chasing along the wall.
      const F = 0.6; // the far wall is this much smaller, and slower, than the near edges
      const DM = (1 + F) / 2;
      b.fillStyle = '#0c0917';
      b.fillRect(0, CEIL, W, FLOOR - CEIL);
      b.fillStyle = '#130e22';
      b.fillRect(0, CEIL, W, FAR_T - CEIL);
      b.fillRect(0, FAR_B, W, FLOOR - FAR_B);
      const S = 56;
      const off = this.dist % S;
      for (let xn = -off - S * 2; xn < W + S * 3; xn += S) {
        const xf = VP + (xn - VP) * F;
        slant(b, xn, CEIL, xf, FAR_T, '#261d40');
        slant(b, xn, FLOOR - 1, xf, FAR_B, '#261d40');
        b.fillStyle = '#17112b';
        b.fillRect(Math.round(xf) - 2, FAR_T, 5, FAR_B - FAR_T);
        b.fillStyle = '#231a44';
        b.fillRect(Math.round(xf) - 2, FAR_T, 1, FAR_B - FAR_T);
        // A lamp down the middle of the ceiling, lane dashes down the middle of the floor.
        const xm = Math.round(VP + (xn + S / 2 - VP) * DM);
        b.fillStyle = '#fff1c4';
        b.fillRect(xm - 3, (CEIL + FAR_T) >> 1, 6, 2);
        gl.fillStyle = '#ffe9a0';
        gl.fillRect(xm - 4, ((CEIL + FAR_T) >> 1) - 1, 8, 4);
        b.fillStyle = '#3a2f5c';
        b.fillRect(xm - 4, (FLOOR + FAR_B) >> 1, 9, 1);
      }
      // Neon signs along the far wall.
      const fd = this.dist * F;
      const first = Math.floor(fd / SIGN_GAP) - 1;
      for (let k = first; k < first + 3; k++) {
        const text = SIGNS[((k % SIGNS.length) + SIGNS.length) % SIGNS.length];
        const tw = R.measure(text, { font: 'big' });
        const sx = Math.round(k * SIGN_GAP - fd + 40);
        if (sx > W || sx + tw + 10 < 0) continue;
        const sy = k % 2 ? FAR_T + 12 : FAR_B - 27;
        const col = SIGN_COLS[((k % 3) + 3) % 3];
        b.fillStyle = '#08060f';
        b.fillRect(sx, sy, tw + 10, 15);
        b.fillStyle = col;
        for (const [x, y, w, h] of [[sx, sy, tw + 10, 1], [sx, sy + 14, tw + 10, 1], [sx, sy, 1, 15], [sx + tw + 9, sy, 1, 15]]) {
          b.fillRect(x, y, w, h);
          gl.fillRect(x, y, w, h);
        }
        R.text(b, text, sx + 5, sy + 4, { font: 'big', color: col });
        R.text(gl, text, sx + 5, sy + 4, { font: 'big', color: col });
      }

      // Seams where the far wall meets ceiling and floor, then the LED strips along them.
      b.fillStyle = '#2b2152';
      b.fillRect(0, FAR_T, W, 1);
      b.fillRect(0, FAR_B - 1, W, 1);
      const loff = (this.dist * F) % 5;
      for (const y of [FAR_T + 6, FAR_B - 7]) {
        for (let x = -loff; x < W; x += 5) {
          const col = hsl(((x + this.dist * F + t * 90 + y) / 220) % 1);
          b.fillStyle = col;
          b.fillRect(Math.round(x), y, 3, 1);
          gl.fillStyle = col;
          gl.fillRect(Math.round(x), y, 3, 1);
        }
      }
      gl.globalAlpha = 0.07;
      gl.fillStyle = '#ffffff';
      gl.fillRect(0, FAR_T + 3, W, 7);
      gl.fillRect(0, FAR_B - 10, W, 7);
      gl.globalAlpha = 1;
    }

    drawMid(view, b, gl, t) {
      for (let i = 0; i < this.cells.length; i++) {
        const c = this.cells[i];
        const x = Math.round(this.cellX + i * CELL);
        if (x > W + 8) break;
        if (x < -16) continue;
        if (c.ob && !c.ob.smashed) {
          const [rx, ry, rw, rh] = this.obstacleRect(c, i);
          const X = Math.round(rx);
          if (c.ob.type === 'cone') {
            for (let k = 0; k < rh; k++) {
              const w = 1 + Math.floor((k / rh) * (rw - 1));
              b.fillStyle = Math.floor(k / 3) % 2 ? '#ffffff' : '#ff7a1f';
              b.fillRect(X + Math.floor((rw - w) / 2), ry + k, w, 1);
            }
            gl.globalAlpha = 0.4;
            gl.fillStyle = '#ff7a1f';
            gl.fillRect(X, ry, rw, rh);
            gl.globalAlpha = 1;
          } else if (c.ob.type === 'barrier') {
            for (let k = 0; k < rh; k++)
              for (let j = 0; j < rw; j++) {
                b.fillStyle = Math.floor((j + k) / 3) % 2 ? '#ffd93b' : '#15101f';
                b.fillRect(X + j, ry + k, 1, 1);
              }
            b.fillStyle = '#ff2a3d';
            b.fillRect(X, ry, rw, 1);
            gl.fillStyle = '#ff2a3d';
            gl.fillRect(X, ry, rw, 1);
          } else if (c.ob.type === 'lamp') {
            b.fillStyle = '#2a2236';
            b.fillRect(X + 2, ry, 2, rh - 5);
            b.fillStyle = '#3a3150';
            b.fillRect(X, ry + rh - 5, rw, 5);
            b.fillStyle = '#fff1a8';
            b.fillRect(X + 1, ry + rh - 1, rw - 2, 1);
            R.softGlow(gl, X + rw / 2, ry + rh + 2, 12, '#ffe14d', 0.5);
          } else {
            b.fillStyle = '#3d4250';
            b.fillRect(X, ry, rw, rh);
            b.fillStyle = '#5f6577';
            b.fillRect(X, ry, 2, rh);
            b.fillStyle = '#ff2a3d';
            b.fillRect(X, ry + rh - 1, rw, 1);
            gl.fillStyle = '#ff2a3d';
            gl.fillRect(X, ry + rh - 1, rw, 1);
          }
        }
        if (c.bolt && !c.bolt.taken) {
          const s = R.BOLT[Math.floor(t * 6) % 2];
          const bx = x + CELL / 2 - 4;
          const by = Math.round(c.bolt.y - 4 + Math.sin(t * 5 + i) * 2);
          R.softGlow(gl, bx + 4, by + 4, 9, '#ffe14d', 0.5);
          b.drawImage(s.c, bx, by);
          gl.drawImage(s.g, bx, by);
        }
      }
    }

    drawGround(view, b, gl, t) {
      // Ceiling and floor slabs with neon edges; the floor is polished enough to mirror the LEDs.
      // Gaps are black voids with hazard-striped lips.
      const slabs = [
        ['ceil', 0, CEIL, CEIL - 1, '#2ef6ff'],
        ['floor', FLOOR, H, FLOOR, '#ff3fd2'],
      ];
      for (const [side, y0, y1] of slabs) {
        if (side === 'ceil') b.drawImage(roof(), 0, 0);
        else {
          b.fillStyle = '#17121f';
          b.fillRect(0, y0, W, y1 - y0);
        }
        b.fillStyle = '#211a2e';
        const o = Math.floor(this.dist % 24);
        for (let x = -o; x < W; x += 24) b.fillRect(x, side === 'ceil' ? y1 - 6 : y0 + 4, 12, 2);
      }
      // The roof's ribs carry on from the ones running down the tunnel.
      for (let xn = -(this.dist % 56); xn < W; xn += 56) {
        const x = Math.round(xn);
        b.fillStyle = '#1d1630';
        b.fillRect(x - 2, 0, 5, CEIL - 9);
        b.fillStyle = '#2b2247';
        b.fillRect(x - 2, 0, 1, CEIL - 9);
      }
      if (!view.lite) view.reflect(b, gl, t);
      for (const [side, y0, y1, edge, col] of slabs) {
        for (let i = 0; i < this.cells.length; i++) {
          const c = this.cells[i];
          const x = Math.round(this.cellX + i * CELL);
          if (x > W + 8) break;
          if (x < -8) continue;
          if (c[side]) {
            b.fillStyle = col;
            b.fillRect(x, edge, CELL, 1);
            gl.fillStyle = col;
            gl.fillRect(x, edge, CELL, 1);
          } else {
            b.fillStyle = '#000000';
            b.fillRect(x, y0, CELL, y1 - y0);
            const prev = this.cells[i - 1];
            const next = this.cells[i + 1];
            for (const [nb, ex] of [
              [prev, x],
              [next, x + CELL - 2],
            ]) {
              if (nb && nb[side]) {
                for (let k = y0; k < y1; k++) {
                  b.fillStyle = Math.floor(k / 3) % 2 ? '#ffd93b' : '#15101f';
                  b.fillRect(ex, k, 2, 1);
                }
              }
            }
          }
        }
      }
      // A car dropping into a gap is in front of it.
      const car = this.car;
      if (car.y + this.roadDy > FLOOR + 1 || car.y - this.roadDy < CEIL - 1) view.drawCar(b, gl, this, t);
    }
  }

  // The roof over the tunnel: concrete, darkening away from the lit ceiling. Baked on first use.
  let roofCv = null;
  function roof() {
    if (!roofCv) {
      roofCv = R.canvas(W, CEIL);
      for (let y = 0; y < CEIL; y++) {
        roofCv.x.fillStyle = R.rgb(R.mix('#07050c', '#17121f', Math.pow(y / (CEIL - 1), 1.6)));
        roofCv.x.fillRect(0, y, W, 1);
      }
    }
    return roofCv.c;
  }

  // A 1 px line from (x0, y0) to (x1, y1), one pixel per row.
  function slant(b, x0, y0, x1, y1, col) {
    b.fillStyle = col;
    const n = Math.abs(y1 - y0);
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      b.fillRect(Math.round(x0 + (x1 - x0) * u), Math.round(y0 + (y1 - y0) * u), 1, 1);
    }
  }

  function hsl(h) {
    const c = (n) => {
      const k = (n + h * 12) % 12;
      return Math.round(255 * (0.62 - 0.38 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return `rgb(${c(0)},${c(8)},${c(4)})`;
  }

  R.TunnelWorld = TunnelWorld;
  R.TUNNEL_CEIL = CEIL;
})();
