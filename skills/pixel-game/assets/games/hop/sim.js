/* Pixel Hop · sim: one run as a deterministic simulation, stepped at 120 Hz. The hero runs along
   a neon road; a press jumps, holding it jumps higher. Clear an obstacle to score; touch one and
   the run is over. Coins hang in arcs over some of them.

   This is the starter game: the smallest complete version of how every game here works. The
   world draws nothing. It is the seed, a seeded random generator and the inputs it was given,
   so a run replays exactly (every change of the held input is recorded, the autopilot's too).
   The autopilot plans by running copies of this same world forward, so it can't be wrong about
   the physics. */
(function () {
  'use strict';
  const R = window.R;
  const DT = (R.DT = 1 / 120);

  const HOP = (R.HOP = {
    G: 272, // the road, about 70% of the way down: the action sits in the middle of a 9:16 frame
    X: 46, // where the hero runs (its left edge)
    HW: 16, // the hero's sprite
    HH: 19,
    INSET: 3, // the hitbox is this much narrower than the sprite on each side: near misses count
    JUMP: 320, // take-off speed, px/s: a tap hops about 50 px high
    GRAV: 1000, // falling
    FLOAT: 450, // rising with the button held: a full hold reaches about 85 px, for the coins
    HOLD: 0.22, // how long a hold keeps lifting, s
    BUFFER: 0.1, // a press this long before landing still jumps, s
    SPEED0: 130, // px/s at the start
    SPEED1: 220, // top speed
    STEP_UP: 3, // px/s gained per obstacle cleared
    CLOSE: 3, // clearing an obstacle by fewer px than this is a close call
    DYING: 0.9, // the crash plays this long before the run is over, s
  });
  // Obstacles: w × h in px, standing on the road.
  const KINDS = {
    cone: { w: 11, h: 14 },
    barrier: { w: 18, h: 16 },
    tower: { w: 13, h: 30 },
  };
  R.HOP_KINDS = KINDS;
  // The autopilot's hold lengths to try, in steps, shortest (lowest jump, closest call) first.
  const HOLDS = [1, 8, 15, 21, 27];
  const LEAD = 2; // it jumps at the last step from which a jump still clears

  class World {
    // o: { seed, auto, replay: { inputs } }
    constructor(o) {
      this.seed = o.seed >>> 0;
      this.rand = R.rng(this.seed);
      this.replay = o.replay || null;
      this.replayIdx = 0;
      this.auto = !!o.auto && !this.replay;
      this.ghost = false; // a copy the autopilot runs forward: spawns nothing, records nothing
      this.state = 'ready'; // ready → run → dying → dead
      this.stateT = 0;
      this.step = 0;
      this.t = 0;
      this.input = false; // the player's finger, set from outside before each update
      this.held = false;
      this.dist = 0; // how far the road has scrolled, px
      this.speed = HOP.SPEED0;
      this.y = 0; // the hero's height above the road, px (up is positive)
      this.vy = 0;
      this.ground = true;
      this.lift = false; // the current jump still rises faster while held
      this.holdT = 0;
      this.buffer = 0;
      this.obs = []; // { x (world px), w, h, kind, scored, min (closest clearance) }
      this.coins = []; // { x, y, got }
      this.nextAt = 190; // where the next obstacle goes
      this.score = 0;
      this.coinCount = 0;
      this.inputs = []; // [step, held] at every change
      this.events = [];
      this.deathStep = -1;
      this.hit = null; // what the hero ran into
      this.plan = 0; // the autopilot: steps left to hold
      this.stats = { jumps: 0, close: 0, closest: 99, air: 0 };
      this.spawn();
    }

    emit(e) {
      if (!this.ghost) this.events.push(e);
    }
    // A player's touch takes the controls from the autopilot.
    takeOver() {
      if (!this.auto || this.replay) return;
      this.auto = false;
      this.plan = 0;
      this.emit({ type: 'disengage' });
    }
    // A copy for the autopilot to run forward. The random generator isn't copied: a copy
    // never spawns, and everything it can reach is already on the road.
    copy() {
      const w = Object.create(World.prototype);
      Object.assign(w, this);
      w.ghost = true;
      w.replay = null;
      w.auto = false;
      w.events = [];
      w.inputs = [];
      w.stats = Object.assign({}, this.stats);
      w.obs = this.obs.map((o) => Object.assign({}, o));
      w.coins = [];
      return w;
    }

    // ---------------- the road ahead ----------------
    // Obstacles always sit further apart than the longest jump at the speed they'll be met, so
    // each one can be cleared on its own: there's never a spot with no way through.
    spawn() {
      if (this.ghost) return;
      const r = this.rand;
      while (this.nextAt < this.dist + R.W + 60) {
        const kinds = this.score < 2 ? ['cone', 'barrier'] : this.score < 6 ? ['cone', 'barrier', 'barrier', 'tower'] : ['cone', 'barrier', 'tower', 'tower'];
        const kind = r.pick(kinds);
        const k = KINDS[kind];
        const ob = { x: this.nextAt, w: k.w, h: k.h, kind, scored: false, min: 99 };
        this.obs.push(ob);
        if (r.chance(0.55)) {
          const top = k.h + 22 + r.int(0, 12);
          for (let i = -1; i <= 1; i++) this.coins.push({ x: ob.x + ob.w / 2 + i * 11, y: top + (i === 0 ? 6 : 0), got: false });
        }
        const v = Math.min(HOP.SPEED1, this.speed + 24);
        const longest = v * 0.86 + 34; // a full hold is in the air about 0.85 s
        this.nextAt = ob.x + ob.w + longest + r.range(0, Math.max(30, 110 - this.score * 3));
      }
      // Forget what's well behind.
      while (this.obs.length && this.obs[0].x + this.obs[0].w < this.dist - 40) this.obs.shift();
      while (this.coins.length && this.coins[0].x < this.dist - 40) this.coins.shift();
    }

    // ---------------- one step ----------------
    update() {
      this.events.length = 0;
      this.t += DT;
      this.stateT += DT;
      // The held input: recorded on replay, else the autopilot or the player's finger.
      let held = this.held;
      if (this.replay) {
        const ins = this.replay.inputs;
        while (this.replayIdx < ins.length && ins[this.replayIdx][0] === this.step) held = !!ins[this.replayIdx++][1];
      } else if (this.state === 'ready' || this.state === 'run') {
        held = this.auto ? (this.state === 'ready' ? this.t > 0.7 : this.pilot()) : this.input;
        if (held !== this.held && !this.ghost) this.inputs.push([this.step, held ? 1 : 0]);
      }
      const press = held && !this.held;
      this.held = held;
      if (this.state === 'ready' && press) {
        // The first press starts the run; it doesn't jump.
        this.state = 'run';
        this.stateT = 0;
        this.emit({ type: 'start' });
      } else if (this.state === 'run') this.run(press, held);
      else if (this.state === 'dying') this.dying();
      this.step++;
    }

    run(press, held) {
      // Jump: a press on the road, or one just before landing.
      if (press) this.buffer = HOP.BUFFER;
      this.buffer -= DT;
      if (this.ground && this.buffer > 0) {
        this.ground = false;
        this.vy = HOP.JUMP;
        this.lift = true;
        this.holdT = 0;
        this.buffer = 0;
        this.stats.jumps++;
        this.emit({ type: 'jump' });
      }
      if (!this.ground) {
        if (!held) this.lift = false;
        const lifting = this.lift && this.vy > 0 && this.holdT < HOP.HOLD;
        if (lifting) this.holdT += DT;
        this.vy -= (lifting ? HOP.FLOAT : HOP.GRAV) * DT;
        this.y += this.vy * DT;
        this.stats.air = Math.max(this.stats.air, this.y);
        if (this.y <= 0) {
          this.y = 0;
          this.ground = true;
          this.emit({ type: 'land', v: -this.vy });
          this.vy = 0;
        }
      }
      // The road scrolls a little faster with every obstacle cleared.
      const target = Math.min(HOP.SPEED1, HOP.SPEED0 + HOP.STEP_UP * this.score);
      this.speed += (target - this.speed) * Math.min(1, DT * 1.5);
      this.dist += this.speed * DT;
      this.spawn();

      const x0 = this.dist + HOP.X + HOP.INSET;
      const x1 = this.dist + HOP.X + HOP.HW - HOP.INSET;
      for (const ob of this.obs) {
        if (ob.x > x1 || ob.x + ob.w < x0) {
          // Behind the hero now: scored, and was it close?
          if (!ob.scored && ob.x + ob.w < x0) {
            ob.scored = true;
            this.score++;
            this.emit({ type: 'clear', kind: ob.kind, score: this.score });
            if (ob.min < HOP.CLOSE) {
              this.stats.close++;
              this.stats.closest = Math.min(this.stats.closest, ob.min);
              this.emit({ type: 'close', px: Math.max(0, Math.round(ob.min)) });
            }
            if (this.score % 10 === 0) this.emit({ type: 'faster', score: this.score });
          }
          continue;
        }
        const gap = this.y - ob.h;
        if (gap < 0) {
          this.crash(ob);
          return;
        }
        ob.min = Math.min(ob.min, gap);
      }
      for (const c of this.coins) {
        if (c.got) continue;
        if (c.x + 3 >= x0 && c.x - 3 <= x1 && c.y + 3 >= this.y && c.y - 3 <= this.y + HOP.HH) {
          c.got = true;
          this.coinCount++;
          this.emit({ type: 'coin', x: c.x - this.dist, y: c.y, n: this.coinCount });
        }
      }
    }

    crash(ob) {
      this.state = 'dying';
      this.stateT = 0;
      this.hit = ob;
      this.deathStep = this.step;
      this.vy = 210; // knocked up and back
      this.ground = false;
      this.emit({ type: 'crash', kind: ob.kind, x: ob.x - this.dist, h: ob.h });
    }
    dying() {
      // The hero tumbles back down; the road slides to a stop.
      this.speed *= Math.exp(-6 * DT);
      this.dist += this.speed * DT;
      this.vy -= HOP.GRAV * DT;
      this.y = Math.max(0, this.y + this.vy * DT);
      if (this.stateT >= HOP.DYING) {
        this.state = 'dead';
        this.stateT = 0;
        this.emit({ type: 'dead' });
      }
    }

    // ---------------- the autopilot ----------------
    // Holds the button for `plan` steps. On the road it waits for the next obstacle, then jumps at
    // the last step from which some hold still clears it by the margin it wants: a few pixels
    // most of the time, nothing at all (a close call) for one obstacle in four. Each try is a
    // copy of this world run forward with that input, so the plan follows the real physics.
    // It never touches this.rand: replays don't run it, they replay its inputs.
    pilot() {
      if (this.plan > 0) {
        this.plan--;
        return true;
      }
      if (!this.ground) return false;
      const ob = this.obs.find((o) => !o.scored && o.x + o.w >= this.dist + HOP.X);
      if (!ob) return false;
      if (ob.x - (this.dist + HOP.X + HOP.HW) > this.speed * 0.75 + 24) return false;
      const close = (Math.imul(Math.round(ob.x), 2654435761) ^ this.seed) >>> 0;
      for (const need of close % 4 === 0 ? [0] : [6, 0]) {
        const now = this.tryJump(0, ob, need);
        if (now < 0) continue; // not with this margin
        if (this.tryJump(LEAD, ob, need) >= 0) return false; // it can still wait
        this.plan = now - 1;
        return true;
      }
      return false; // nothing clears it from here
    }
    // Wait `delay` steps, then hold for each length in HOLDS until one clears `ob` by at least
    // `need` px and lands. Returns the hold in steps, or -1.
    tryJump(delay, ob, need) {
      const k = this.obs.indexOf(ob);
      for (const hold of HOLDS) {
        const w = this.copy();
        w.held = false;
        let ok = false;
        for (let i = 0; i < 240; i++) {
          w.input = i >= delay && i < delay + hold;
          w.update();
          if (w.state !== 'run') break;
          if (w.ground && i > delay && w.dist + HOP.X > ob.x + ob.w + 1) {
            ok = w.obs[k].min >= need;
            break;
          }
        }
        if (ok) return hold;
      }
      return -1;
    }
  }

  R.World = World;
})();
