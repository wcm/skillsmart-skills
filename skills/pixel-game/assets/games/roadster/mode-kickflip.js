/* Flappy Roadster · KICKFLIP: the unveil's stunt as a game. You drive in the traffic lane, so the
   only way past is over: tap to thrust-jump (hold to burn longer), tap in the air to kickflip, ride
   on roofs. Land mid-flip and you bail. Deterministic like the flying mode, so the killcam works. */
(function () {
  'use strict';
  const R = window.R;
  const DT = R.DT;
  const G = R.GROUND;
  const W = R.W;

  // Per drive mode: scroll speed, gravity, jump impulse, trick length, traffic spacing.
  // A tap clears one car; holding the burn clears two, or leaves room for a double kickflip.
  const TUNE = [
    { speed: 118, accel: 0.7, max: 160, gravity: 720, jump: 290, trickT: 0.42, gap: 1.25 },
    { speed: 136, accel: 0.8, max: 182, gravity: 760, jump: 300, trickT: 0.4, gap: 1.1 },
    { speed: 158, accel: 0.9, max: 206, gravity: 820, jump: 312, trickT: 0.38, gap: 1.0 },
    { speed: 182, accel: 1.0, max: 232, gravity: 880, jump: 326, trickT: 0.36, gap: 0.92 },
  ];
  const HOLD_MAX = 0.3; // extra burn while the tap is held
  const HOLD_G = 0.32; // gravity scale during the burn
  const STEP_UP = 6; // a roof edge this low is driven over, not crashed into
  const BAIL = 0.72; // land before this much of a kickflip and you bail
  const PITCH_DOWN = 0.1; // cars come down nearly flat, so the nose can't snag a roof before the wheels

  const ROLL = 150;
  const LANE_V = 10; // a crawling jam; one lane, so every car moves together
  const FOOT = [-17, 16]; // the car's footprint along the road (its hit circles' span), relative to its x
  const HOLDS = [0, 0.08, 0.16, 0.23, 0.3];
  const DELAYS = [0, 2, 4, 6, 9, 12, 16, 21, 27];
  const SPAWN_AHEAD = 300;

  // Highest roof of vehicle v (drawn at vx) over the span [xa, xb], as a world y; null if none.
  function roofTop(v, vx, xa, xb) {
    let top = null;
    for (const [x0, x1, t] of v.spr.rects) {
      if (xb >= vx + x0 && xa <= vx + x1) {
        const wy = G - v.spr.h + t;
        if (top === null || wy < top) top = wy;
      }
    }
    return top;
  }

  class KickflipWorld {
    constructor(opts) {
      this.kind = 'kickflip';
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
      this.tricks = 0;
      this.roofs = 0;
      this.cars = 0;
      this.bestChain = 0;
      this.pipes = [];
      this.traffic = [];
      this.groups = 0;
      this.vid = 0;
      this.inputs = [];
      this.queue = [];
      this.auto = !!opts.auto;
      this.autoUntil = this.replay ? this.replay.autoUntil : -1;
      this.cinematic = !!opts.cinematic;
      this.events = [];
      this.deathStep = -1;
      this.deathKind = '';
      this.car = {
        x: R.CAR_X,
        y: G - this.roadDy,
        vy: 0,
        ang: 0,
        va: 0,
        alive: true,
        flapT: 9,
        fold: 0,
        bounces: 0,
        resting: false,
        on: 'road', // 'road', a traffic vehicle, or null in the air
        hold: false,
        holdT: 0,
        trickP: null,
        trickQ: 0,
        trickN: 0,
        airT: 0,
        chain: 0,
      };
      this.pilotRelease = -1;
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
    release() {
      this.queue.push(0);
    }
    startIntro() {
      this.state = 'ready';
      this.stateT = 0;
    }

    // ---------------- traffic ----------------
    spawnGroup(x) {
      const rnd = this.rand;
      const k = this.groups++;
      const r1 = rnd();
      const r2 = rnd();
      const r3 = rnd();
      const r4 = rnd();
      const r5 = rnd();
      const small = ['model3', 'modely', 'cybercab', 'cybertruck'];
      const paintFor = (kind, r) => (kind === 'cybertruck' ? 'steel' : kind === 'cybercab' ? 'gold' : ['red', 'white', 'blue', 'black', 'grey'][Math.floor(r * 5)]);
      let kinds;
      if (k === 4) kinds = ['cybercab', 'model3', 'modely', 'cybertruck', 'model3'];
      else if (k < 2) kinds = [small[Math.floor(r2 * 2)]];
      else if (r1 < 0.12 && k > 5) kinds = ['semi'];
      else if (r1 < 0.2 && k > 3) kinds = ['police'];
      else if (r1 < 0.42) kinds = [small[Math.floor(r2 * 4)], small[Math.floor(r3 * 4)]];
      else kinds = [small[Math.floor(r2 * 4)]];
      const vs = LANE_V;
      void r4;
      const group = k;
      let gx = x;
      kinds.forEach((kind, i) => {
        const paint = kind === 'semi' ? 'white' : kind === 'police' ? 'black' : paintFor(kind, rnd());
        const spr = R.vehicle(kind, paint);
        const v = { id: this.vid++, kind, spr, x: gx, vs, group, scored: false, bolt: null, smashed: false, minClear: 99, lineup: k === 4 };
        if (i === 0 && r5 < 0.3 && k > 1) v.bolt = { dy: 26 + rnd() * 14, taken: false };
        this.traffic.push(v);
        gx += spr.w + (kinds.length > 1 ? 4 + Math.floor(rnd() * 5) : 0);
      });
      if (k === 4) this.emit({ type: 'lineup' });
      // Space before the next group: enough runway to land and jump again.
      return gx + (92 + rnd() * 120) * this.m.gap + (kinds.length > 1 ? 30 : 0);
    }

    surfaceUnder(v, x) {
      return roofTop(v, v.x, x, x);
    }

    // ---------------- the step ----------------
    update() {
      const car = this.car;
      this.t += DT;
      this.stateT += DT;
      if (this.state === 'title') return this.drive(0.55);
      if (this.state === 'ready') {
        this.drive(1);
        // A press starts the run; a stray release (from the retry tap) doesn't.
        if (this.queue.includes(1) || this.auto) {
          this.queue.length = 0;
          this.state = 'play';
          this.stateT = 0;
          this.step = 0;
          this.t = -DT;
          this.speed = this.m.speed;
          car.y = G - this.roadDy;
          car.ang = 0;
          car.on = 'road';
          this.emit({ type: 'start' });
          this.forcePress = true;
          this.update();
        }
        return;
      }

      // Inputs.
      const acts = [];
      if (this.replay) {
        const ins = this.replay.inputs;
        while (this.replayIdx < ins.length && ins[this.replayIdx][0] === this.step) acts.push(ins[this.replayIdx++][1]);
      } else if (this.state === 'play') {
        if (this.forcePress) acts.push(1);
        if (this.queue.length) {
          if (this.auto && this.queue.includes(1)) {
            this.auto = false;
            this.autoUntil = this.step;
            this.emit({ type: 'disengage' });
          }
          acts.push(...this.queue);
        } else if (this.auto && !this.forcePress) {
          const a = this.pilot();
          if (a !== null) acts.push(a);
        }
      }
      this.forcePress = false;
      this.queue.length = 0;
      if (this.state === 'play' && this.auto) this.autoUntil = this.step + 1;

      if (this.state === 'play') {
        for (const a of acts) {
          this.inputs.push([this.step, a]);
          if (a) this.press();
          else car.hold = false;
        }
        this.physics();
      } else this.updateDead();

      // Speed and traffic.
      const m = this.m;
      if (this.state === 'dead') {
        this.speed *= Math.exp(-5 * DT);
        if (this.speed < 1) this.speed = 0;
      } else this.speed = R.approach(this.speed, Math.min(m.max, m.speed + m.accel * this.score) * (this.ludi > 0 ? 1.5 : 1), 3, DT);
      this.topSpeed = Math.max(this.topSpeed, this.speed);
      this.dist += this.speed * DT;
      for (const v of this.traffic) v.x -= (this.speed - (this.state === 'dead' ? 0 : v.vs)) * DT;
      while (this.traffic.length && this.traffic[0].x + this.traffic[0].spr.w < -30) this.traffic.shift();
      if (this.state === 'play') {
        // Traffic is placed well past the right edge, so the autopilot's lookahead sees it coming.
        if (this.nextX == null) this.nextX = W + 70;
        this.nextX -= (this.speed - LANE_V) * DT;
        while (this.nextX < W + SPAWN_AHEAD) this.nextX = this.spawnGroup(this.nextX);
        this.interact();
      }
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

    drive(mul) {
      this.speed = R.approach(this.speed, this.m.speed * mul, 3, DT);
      this.dist += this.speed * DT;
      const car = this.car;
      car.y = G - this.roadDy + (Math.sin(this.t * 17) > 0.92 ? -1 : 0);
      car.ang = 0;
      car.on = 'road';
    }

    press() {
      const car = this.car;
      if (car.on) {
        car.vy = -this.m.jump * this.skin.flap;
        car.on = null;
        car.hold = true;
        car.holdT = 0;
        car.airT = 0;
        car.chain = 0;
        car.trickN = 0;
        car.flapT = 0;
        this.emit({ type: 'flap', x: car.x, y: car.y, ang: car.ang });
      } else if (car.trickP === null) {
        car.trickP = 0;
        this.emit({ type: 'trickStart' });
      } else if (car.trickQ < 2) car.trickQ++;
    }

    physics() {
      const car = this.car;
      const m = this.m;
      car.flapT += DT;
      if (car.on === null) {
        const burning = car.hold && car.holdT < HOLD_MAX && car.vy < 80;
        const g = m.gravity * this.skin.gravity * (burning ? HOLD_G : 1);
        car.vy = Math.min(car.vy + g * DT, 560);
        const before = car.y;
        car.y += car.vy * DT;
        car.holdT += DT;
        car.airT += DT;
        car.burning = burning;
        if (car.trickP !== null) {
          car.trickP += DT / m.trickT;
          if (car.trickP >= 1) this.finishTrick();
        }
        car.ang = R.approach(car.ang, R.clamp(car.vy / 520, -0.3, PITCH_DOWN), 8, DT);
        if (car.vy > 0) this.land(before);
      } else {
        car.burning = false;
        car.ang = R.approach(car.ang, 0, 14, DT);
        if (car.on !== 'road') {
          // Riding a roof: sit on the highest roof under the car's length (small steps are driven
          // over) and drop off once no part of the car is above it.
          const top = roofTop(car.on, car.on.x, car.x + FOOT[0], car.x + FOOT[1]);
          const cur = car.y + this.roadDy;
          if (top === null) {
            car.on = null;
            car.vy = 0;
            car.airT = 0;
            car.chain = 0;
            car.trickN = 0;
          } else if (top < cur && cur - top <= STEP_UP) car.y = top - this.roadDy;
        }
      }
    }

    finishTrick() {
      const car = this.car;
      car.trickN++;
      this.tricks++;
      this.score++;
      this.emit({ type: 'trick', n: car.trickN });
      if (car.trickQ > 0) {
        car.trickQ--;
        car.trickP = 0;
      } else car.trickP = null;
    }

    land(before) {
      const car = this.car;
      const bottom = car.y + this.roadDy;
      const prev = before + this.roadDy;
      let surf = null;
      let top = G;
      for (const v of this.traffic) {
        if (v.smashed) continue;
        const t = roofTop(v, v.x, car.x + FOOT[0], car.x + FOOT[1]);
        if (t !== null && prev <= t + 1 && bottom >= t && t < top) {
          top = t;
          surf = v;
        }
      }
      if (!surf && bottom < G) return;
      // Touchdown.
      if (car.trickP !== null) {
        if (car.trickP < BAIL) return this.crash('bail');
        this.finishTrick();
        car.trickP = null;
      }
      car.trickQ = 0;
      car.y = top - this.roadDy;
      const v = car.vy;
      car.vy = 0;
      car.on = surf || 'road';
      car.hold = false;
      if (surf) {
        this.roofs++;
        this.score++;
      }
      this.bestChain = Math.max(this.bestChain, car.chain);
      this.emit({ type: 'touch', roof: !!surf, kind: surf ? surf.kind : null, chain: car.chain, tricks: car.trickN, v, x: car.x, y: top });
      car.chain = 0;
      car.trickN = 0;
    }

    circles(y, ang) {
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const x = this.car.x;
      return R.CAR_HIT.map(([hx, hy, r]) => [x + hx * ca - hy * sa, y + hx * sa + hy * ca, r]);
    }

    interact() {
      const car = this.car;
      const circles = this.circles(car.y, car.ang);
      const tough = this.ludi > 0 || this.invuln > 0;
      for (const v of this.traffic) {
        if (v.smashed) continue;
        const h = v.spr.h;
        // Clearance while flying over it.
        if (car.on === null && car.x > v.x && car.x < v.x + v.spr.w) {
          const t = this.surfaceUnder(v, car.x);
          if (t !== null) v.minClear = Math.min(v.minClear, t - (car.y + this.roadDy));
        }
        let hit = false;
        for (const [x0, x1, top] of v.spr.rects) {
          const rx = v.x + x0;
          const ry = G - h + top;
          for (const [cx, cy, r] of circles) {
            const nx = cx < rx ? rx : cx > rx + (x1 - x0) ? rx + (x1 - x0) : cx;
            const ny = cy < ry ? ry : cy > G ? G : cy;
            if ((cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r) hit = true;
          }
        }
        if (hit) {
          if (this.ludi > 0) {
            v.smashed = true;
            this.score++;
            this.cars++;
            this.emit({ type: 'smash', x: v.x + v.spr.w / 2, y: G - h / 2, top: false, pipe: { zone: 0, kind: 0, hue: v.id % 4 }, vehicle: v });
            continue;
          }
          if (!tough) return this.crash(car.on === null && car.vy > 0 ? 'crash' : 'rearend', v);
        }
        if (v.bolt && !v.bolt.taken) {
          const bx = v.x + v.spr.w / 2;
          const by = G - h - v.bolt.dy;
          if ((bx - car.x) * (bx - car.x) + (by - car.y) * (by - car.y) < 13 * 13) {
            v.bolt.taken = true;
            this.boltsTotal++;
            this.bolts++;
            this.emit({ type: 'bolt', x: bx, y: by, count: this.bolts });
            if (this.bolts >= 3 && this.ludi <= 0) {
              this.bolts = 0;
              this.ludi = 4;
              this.invuln = 0;
              this.emit({ type: 'ludi' });
            }
          }
        }
        if (!v.scored && v.x + v.spr.w < car.x - 22) {
          v.scored = true;
          this.score++;
          this.cars++;
          if (car.on !== 'road') car.chain++;
          this.emit({ type: 'score', score: this.score, pipe: { stack: false }, vehicle: v });
          if (v.kind === 'police') this.emit({ type: 'police' });
          if (v.minClear < 4 && v.minClear > -1) {
            this.near++;
            this.combo++;
            this.emit({ type: 'near', clear: Math.max(0, v.minClear), combo: this.combo });
          } else this.combo = 0;
          if (v.lineup && !this.traffic.some((q) => q.lineup && !q.scored)) this.emit({ type: 'lineupDone' });
        }
      }
    }

    crash(kind, v) {
      const car = this.car;
      car.alive = false;
      this.state = 'dead';
      this.stateT = 0;
      this.deathStep = this.step;
      this.deathKind = kind;
      this.victim = v ? v.kind : null;
      this.emit({ type: 'crash', kind, x: car.x, y: car.y, vy: car.vy, zone: 0, speed: this.speed, victim: this.victim });
      car.trickP = null;
      car.va = (this.rand() < 0.5 ? -1 : 1) * (7 + this.rand() * 5);
      car.vy = kind === 'bail' ? -90 : -160;
    }

    updateDead() {
      const car = this.car;
      if (car.resting) return;
      car.vy = Math.min(car.vy + this.m.gravity * DT, 520);
      car.y += car.vy * DT;
      car.ang += car.va * DT;
      const hh = Math.abs(Math.sin(car.ang)) * 19 + Math.abs(Math.cos(car.ang)) * 6;
      if (car.y + hh >= G) {
        car.y = G - hh;
        if (car.vy > 60 && car.bounces < 3) {
          car.bounces++;
          this.emit({ type: 'land', x: car.x, y: G, v: car.vy });
          car.vy = -car.vy * 0.32;
          car.va *= 0.5;
        } else {
          car.vy = 0;
          const a = ((car.ang % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          const flat = Math.abs(a - Math.PI) < Math.PI / 2 ? Math.PI : a > Math.PI ? 2 * Math.PI : 0;
          car.ang = R.approach(a, flat, 10, DT);
          car.va = 0;
          if (Math.abs(car.ang - flat) < 0.01) {
            car.ang = flat;
            car.resting = true;
            this.emit({ type: 'rest', upsideDown: flat === Math.PI });
          }
        }
      }
    }

    // ---------------- FSF for traffic ----------------
    // On the ground: search jump timings and holds by rollout, and jump when "now" scores best.
    // In the air: kickflip when the rest of the flight has room for one.
    pilot() {
      const car = this.car;
      if (this.pilotRelease >= 0 && this.step >= this.pilotRelease) {
        this.pilotRelease = -1;
        return 0;
      }
      if (car.on === null) {
        const left = this.airLeft();
        const room = this.m.trickT * (this.cinematic ? 1.05 : 1.15) + 0.03;
        if (car.trickP === null && left > room) return 1;
        if (this.cinematic && car.trickP !== null && car.trickQ === 0 && left > (1 - car.trickP) * this.m.trickT + room) return 1;
        return null;
      }
      const ahead = this.traffic.some((v) => !v.smashed && v.x + v.spr.w > car.x - 20 && v.x < car.x + 40 + this.speed * 1.2);
      if (!ahead || this.ludi > 0) return null;
      // Try every jump time and hold; act only when "now" is the best of them.
      let best = null;
      for (const d of DELAYS)
        for (const h of HOLDS) {
          const r = this.rollout(d, h);
          if (r.ok && (!best || r.score > best.score + 1e-6)) best = { d, h, score: r.score };
        }
      if (!best) {
        // Nothing clears it cleanly: jump anyway and hope for a roof.
        this.pilotRelease = this.step + Math.round(HOLD_MAX / DT);
        return 1;
      }
      if (best.d === 0) {
        this.pilotRelease = best.h > 0 ? this.step + Math.round(best.h / DT) : this.step + 1;
        return 1;
      }
      return null;
    }

    // Simulate driving `delay` steps, then a jump holding the burn for `hold` seconds, through the
    // same step order as the sim: land against this step's traffic, then traffic moves, then
    // collide. Scores safe plans by clearance, runway after landing, and a roof bonus.
    rollout(delay, hold) {
      const car = this.car;
      const m = this.m;
      const g0 = m.gravity * this.skin.gravity;
      let y = car.y;
      let vy = 0;
      let on = car.on;
      let holdT = 0;
      let air = false;
      let ang = car.ang;
      let landed = -1;
      let runway = 0;
      let roofLanding = false;
      let minClear = 12;
      const rel = this.speed;
      const veh = this.traffic.filter((v) => !v.smashed && v.x < car.x + 420);
      const xAt = (v, i) => v.x - (rel - v.vs) * DT * i;
      for (let i = 0; i < ROLL; i++) {
        if (i === delay) {
          if (!on) return { ok: false, score: 0 };
          vy = -m.jump * this.skin.flap;
          on = null;
          air = true;
          holdT = 0;
        }
        if (on === null) {
          // The press itself burns for one step even when released straight away.
          const b = holdT < Math.max(hold, DT * 0.5) && vy < 80;
          vy = Math.min(vy + g0 * (b ? HOLD_G : 1) * DT, 560);
          const prev = y + this.roadDy;
          y += vy * DT;
          holdT += DT;
          ang = R.approach(ang, R.clamp(vy / 520, -0.3, PITCH_DOWN), 8, DT);
          if (vy > 0) {
            const bottom = y + this.roadDy;
            let top = G;
            let roof = null;
            for (const v of veh) {
              const vx = xAt(v, i);
              const wy = roofTop(v, vx, car.x + FOOT[0], car.x + FOOT[1]);
              if (wy !== null && prev <= wy + 1 && bottom >= wy && wy < top) {
                top = wy;
                roof = v;
              }
            }
            if (roof || bottom >= G) {
              y = top - this.roadDy;
              vy = 0;
              on = roof || 'road';
              if (air && landed < 0) {
                landed = i;
                roofLanding = !!roof;
              }
            }
          }
        } else if (on !== 'road') {
          const vx = xAt(on, i);
          const top = roofTop(on, vx, car.x + FOOT[0], car.x + FOOT[1]);
          if (top === null) {
            on = null;
            vy = 0;
          } else if (top < y + this.roadDy && y + this.roadDy - top <= STEP_UP) y = top - this.roadDy;
        } else if (landed >= 0) runway++;
        // Traffic has moved; collide.
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        for (const v of veh) {
          const vx = xAt(v, i + 1);
          if (vx > car.x + 30 || vx + v.spr.w < car.x - 30) continue;
          for (const [x0, x1, t] of v.spr.rects) {
            const rx = vx + x0;
            const ry = G - v.spr.h + t;
            for (const [hx, hy, r] of R.CAR_HIT) {
              const cx = car.x + hx * ca - hy * sa;
              const cy = y + hx * sa + hy * ca;
              const nx = cx < rx ? rx : cx > rx + (x1 - x0) ? rx + (x1 - x0) : cx;
              const ny = cy < ry ? ry : cy > G ? G : cy;
              const d = Math.sqrt((cx - nx) * (cx - nx) + (cy - ny) * (cy - ny)) - r;
              if (d < 0.6) return { ok: false, score: i };
              if (air && d < minClear) minClear = d;
            }
          }
        }
        if (landed >= 0 && i - landed > 40) break;
      }
      if (!air) return { ok: true, score: 0 };
      if (landed < 0) return { ok: true, score: 30 + minClear };
      return { ok: true, score: 50 + Math.min(minClear, 8) * 3 + Math.min(runway, 40) * 0.5 + (roofLanding ? 4 : 0) - delay * 0.02 };
    }

    // Seconds left in the air if nothing else is pressed.
    airLeft() {
      const car = this.car;
      const g0 = this.m.gravity * this.skin.gravity;
      let y = car.y;
      let vy = car.vy;
      let holdT = car.holdT;
      for (let i = 0; i < 240; i++) {
        const b = car.hold && holdT < HOLD_MAX && vy < 80;
        vy = Math.min(vy + g0 * (b ? HOLD_G : 1) * DT, 560);
        y += vy * DT;
        holdT += DT;
        if (vy > 0) {
          const bottom = y + this.roadDy;
          if (bottom >= G) return i * DT;
          for (const v of this.traffic) {
            if (v.smashed) continue;
            const vx = v.x - (this.speed - v.vs) * DT * i;
            for (const [x0, x1, t] of v.spr.rects) if (car.x >= vx + x0 && car.x <= vx + x1 && bottom >= G - v.spr.h + t && bottom - vy * DT <= G - v.spr.h + t + 1) return i * DT;
          }
        }
      }
      return 2;
    }

    // ---------------- drawing ----------------
    drawMid(view, b, gl, t) {
      const eta = (R.game && R.game.eta) || 2028;
      for (const v of this.traffic) {
        if (v.smashed || v.x > W + 4 || v.x + v.spr.w < -4) continue;
        R.drawVehicle(b, gl, v, v.x, G, t, `ROADSTERS · ETA ${eta}`);
        if (v.bolt && !v.bolt.taken) {
          const s = R.BOLT[Math.floor(t * 6) % 2];
          const bx = Math.round(v.x + v.spr.w / 2 - 4);
          const by = Math.round(G - v.spr.h - v.bolt.dy - 4 + Math.sin(t * 5 + v.id) * 2);
          R.softGlow(gl, bx + 4, by + 4, 9, '#ffe14d', 0.5);
          b.drawImage(s.c, bx, by);
          gl.drawImage(s.g, bx, by);
        }
      }
    }
  }

  R.KickflipWorld = KickflipWorld;
})();
