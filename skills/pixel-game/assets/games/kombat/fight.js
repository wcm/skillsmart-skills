/* Model Kombat · fight: one round as a deterministic simulation, stepped at 120 Hz. Two fighters
   (either can be the CPU), their frame data, blocking, combos, projectiles, the two supers and
   the K.O. Same seed and same inputs give the same round, so a K.O. can be replayed exactly.

   Inputs are bits per step: L, R held; U, P, K, S pressed (jump, punch, kick, special). */
(function () {
  'use strict';
  const R = window.R;
  const DT = (R.DT = 1 / 120);
  const W = R.W;

  R.KOMBAT = {
    FLOOR: 252, // the stage floor, in screen pixels
    LEFT: 14,
    RIGHT: W - 14,
    TIME: 60, // seconds a round lasts
    HP: 100,
  };
  const K = R.KOMBAT;
  const IN = (R.IN = { L: 1, R: 2, U: 4, P: 8, Kk: 16, S: 32 });

  // Difficulty: the CPU's reaction time, how often it blocks, presses and zones. Tuned against
  // bots that play like people (tools/sim/kombat.mjs): a casual player wins about three rounds in
  // four on TURBO, two in five on PRO and hardly any on MAX.
  R.LEVELS = [
    { id: 'mini', name: 'MINI', react: 0.34, block: 0.3, aggro: 0.9, proj: 0.2, anti: 0.2, jump: 0.1 },
    { id: 'turbo', name: 'TURBO', react: 0.27, block: 0.48, aggro: 1.2, proj: 0.26, anti: 0.35, jump: 0.12 },
    { id: 'pro', name: 'PRO', react: 0.23, block: 0.56, aggro: 1.35, proj: 0.3, anti: 0.45, jump: 0.14 },
    { id: 'max', name: 'MAX', react: 0.19, block: 0.68, aggro: 1.55, proj: 0.33, anti: 0.6, jump: 0.15 },
  ];

  // Frame data, in seconds. box: [x0, x1, y0, y1] relative to the feet, facing right.
  const MOVES = {
    jab: { start: 0.06, active: 0.06, rec: 0.12, dmg: 5, stun: 0.22, push: 70, box: [8, 30, -52, -38], anim: 'jab' },
    kick: { start: 0.12, active: 0.07, rec: 0.2, dmg: 9, stun: 0.32, push: 110, box: [8, 36, -34, -18], anim: 'kick' },
    air: { start: 0.05, active: 9, rec: 0, dmg: 8, stun: 0.3, push: 90, box: [4, 30, -32, -12], anim: 'jumpkick' },
    throw: { start: 0.2, active: 0, rec: 0.26, anim: 'throw' },
  };
  const HURT = [-9, 9, -68, 0];
  const SUPER_T = 4.2; // how long a super lasts
  const SLOW_K = 1.3; // SLOW DOWN lasts this much longer: CPU vs CPU then splits 50/50 (tools/sim/kombat.mjs)
  const PROJ = { speed: 120, dmg: 8, stun: 0.3, push: 90, w: 18, h: 14, cool: 1.4 };
  const WALK = 52;
  const BACK = 40;
  const JUMP = 300;
  const GRAV = 1000;
  const GAP = 20; // fighters' bodies don't overlap closer than this

  class Fighter {
    constructor(side, id, x, cpu) {
      this.side = side;
      this.id = id;
      this.x = x;
      this.y = 0;
      this.vx = 0;
      this.vy = 0;
      this.face = side === 0 ? 1 : -1;
      this.hp = K.HP;
      this.meter = 0;
      this.state = 'idle';
      this.stateT = 0;
      this.move = null;
      this.moveT = 0;
      this.hitDone = false;
      this.airUsed = false;
      this.stun = 0;
      this.cool = 0;
      this.combo = 0; // hits landed in the current combo
      this.cpu = !!cpu;
      this.cpuUntil = cpu ? Infinity : -1; // the step a player took over from the CPU
      this.held = 0;
      this.edge = 0;
      this.scale = 1;
      this.fast = 0; // ACCELERATE left
      this.slowed = 0; // SLOW DOWN left
      this.plan = null;
      this.planT = 0;
      this.stats = { hits: 0, best: 0, specials: 0, supers: 0, blocks: 0 };
    }
    get grounded() {
      return this.y >= 0;
    }
    // Is it pressing away from the other fighter?
    back(other) {
      const away = other.x > this.x ? IN.L : IN.R;
      return !!(this.held & away);
    }
  }

  class Round {
    // o: { seed, ids: [p1, p2], cpu: [bool, bool], level, wins: [n, n], need, replay, cpuUntil }
    // A replay takes the live round's inputs and cpuUntil (when a player took over the CPU).
    constructor(o) {
      this.seed = o.seed >>> 0;
      this.rand = R.rng(this.seed);
      this.level = R.LEVELS[o.level == null ? 1 : o.level];
      this.wins = o.wins || [0, 0];
      this.need = o.need || 2;
      this.f = [new Fighter(0, o.ids[0], 70, o.cpu && o.cpu[0]), new Fighter(1, o.ids[1], W - 70, o.cpu && o.cpu[1])];
      this.f[0].foe = this.f[1];
      this.f[1].foe = this.f[0];
      if (o.cpuUntil) this.f.forEach((f, i) => (f.cpuUntil = o.cpuUntil[i]));
      this.proj = [];
      this.t = 0;
      this.step = 0;
      this.time = K.TIME;
      this.state = 'fight'; // fight | finish | done
      this.stateT = 0;
      this.events = [];
      this.inputs = []; // [step, bits] for the human fighters, side 0 then side 1 as [step, side, bits]
      this.replay = o.replay || null;
      this.replayIdx = 0;
      this.live = [0, 0]; // the human inputs for the next step
      this.winner = -1;
      this.firstHit = false;
      this.koStep = -1;
      this.doneStep = -1; // the step the round ended (a K.O., the finisher, or time)
    }

    emit(e) {
      this.events.push(e);
    }

    // A player grabs the controls from the CPU (CPU vs CPU mode, then a tap).
    takeOver(side) {
      const f = this.f[side];
      if (!f.cpu) return;
      f.cpu = false;
      f.cpuUntil = this.step;
      f.plan = null;
      this.emit({ type: 'takeover', side });
    }

    // The human input for a side: held bits plus presses since the last step.
    input(side, bits) {
      this.live[side] = bits;
    }

    update() {
      this.t += DT;
      this.stateT += DT;
      // Inputs: recorded on replay, live otherwise; the CPU decides for itself.
      // A press shows up in the bits for one step only, so every press is recorded as a change
      // and so is the step after it.
      for (const f of this.f) {
        let bits = 0;
        const cpu = this.replay ? this.step < f.cpuUntil : f.cpu;
        if (cpu) bits = this.think(f);
        else if (this.replay) {
          const ins = this.replay;
          while (this.replayIdx < ins.length && ins[this.replayIdx][0] === this.step && ins[this.replayIdx][1] === f.side) f.cur = ins[this.replayIdx++][2];
          bits = f.cur || 0;
        } else {
          bits = this.live[f.side];
          this.live[f.side] &= IN.L | IN.R;
          if (bits !== (f.cur || 0)) {
            this.inputs.push([this.step, f.side, bits]);
            f.cur = bits;
          }
        }
        f.edge = bits & ~(IN.L | IN.R);
        f.held = bits & (IN.L | IN.R);
      }
      // The deciding K.O.: the winner's special press is the finisher.
      if (this.state === 'finish') {
        const wf = this.f[this.winner];
        const wcpu = this.replay ? this.step < wf.cpuUntil : wf.cpu;
        if (!wcpu && wf.edge & IN.S) this.endFinish(true);
      }

      // Supers change how fast each fighter's clock runs.
      for (const f of this.f) {
        f.scale = (f.fast > 0 ? 2 : 1) * (f.slowed > 0 ? 0.5 : 1);
        if (f.fast > 0) f.fast = Math.max(0, f.fast - DT);
        if (f.slowed > 0) f.slowed = Math.max(0, f.slowed - DT);
      }
      for (const f of this.f) this.fighter(f, DT * f.scale);
      this.separate();
      for (const f of this.f) this.strike(f);
      this.projectiles();
      if (this.state === 'fight') {
        this.time = Math.max(0, this.time - DT);
        if (this.time <= 0) this.timeUp();
      } else if (this.state === 'finish' && this.stateT > 3.2) this.endFinish(false);
      this.step++;
    }

    // ---------------- a fighter's step ----------------
    fighter(f, dt) {
      const o = f.foe;
      f.stateT += dt;
      if (f.cool > 0) f.cool = Math.max(0, f.cool - dt);
      const free = this.state === 'fight' && (f.state === 'idle' || f.state === 'walk' || f.state === 'block');
      // Face the other fighter whenever standing free.
      if (free && f.grounded) f.face = o.x >= f.x ? 1 : -1;

      if (free) {
        const e = f.edge;
        if (e & IN.S && f.meter >= 100) return this.superMove(f);
        if (e & IN.P) return this.attack(f, 'jab');
        if (e & IN.Kk) return this.attack(f, 'kick');
        if (e & IN.S && f.cool <= 0) return this.attack(f, 'throw');
        if (e & IN.U) {
          f.state = 'jump';
          f.stateT = 0;
          f.vy = -JUMP;
          f.vx = (f.held & IN.R ? 1 : 0) * 70 - (f.held & IN.L ? 1 : 0) * 70;
          f.airUsed = false;
          this.emit({ type: 'jump', side: f.side });
          return;
        }
        const dir = (f.held & IN.R ? 1 : 0) - (f.held & IN.L ? 1 : 0);
        const threat = this.threat(f);
        if (dir !== 0 && f.back(o) && threat) {
          if (f.state !== 'block') {
            f.state = 'block';
            f.stateT = 0;
          }
          f.vx = 0;
        } else if (dir !== 0) {
          if (f.state !== 'walk') {
            f.state = 'walk';
            f.stateT = 0;
          }
          f.vx = dir * (dir === f.face ? WALK : BACK);
        } else {
          if (f.state !== 'idle') {
            f.state = 'idle';
            f.stateT = 0;
          }
          f.vx = 0;
        }
      }

      switch (f.state) {
        case 'jump':
          if (f.edge & (IN.P | IN.Kk) && !f.airUsed) {
            f.airUsed = true;
            f.move = 'air';
            f.moveT = 0;
            f.hitDone = false;
            this.emit({ type: 'swing', side: f.side, kind: 'air' });
          }
          if (f.move === 'air') f.moveT += dt;
          f.vy += GRAV * dt;
          f.y += f.vy * dt;
          if (f.y >= 0) {
            f.y = 0;
            f.vy = 0;
            f.vx = 0;
            f.move = null;
            f.state = 'idle';
            f.stateT = 0;
            this.emit({ type: 'land', side: f.side });
          }
          break;
        case 'attack': {
          f.moveT += dt;
          const m = MOVES[f.move];
          f.vx = 0;
          if (f.move === 'throw' && !f.thrown && f.moveT >= m.start) {
            f.thrown = true;
            const kind = f.id === 'sam' ? 'ad' : 'tv';
            this.proj.push({ side: f.side, kind, x: f.x + f.face * 18, y: -44, vx: f.face * PROJ.speed, t: 0, alive: true });
            f.cool = PROJ.cool;
            f.stats.specials++;
            this.emit({ type: 'proj', side: f.side, kind, x: f.x + f.face * 18, y: K.FLOOR - 44 });
          }
          if (f.moveT >= m.start + m.active + m.rec) {
            f.move = null;
            f.state = 'idle';
            f.stateT = 0;
          }
          break;
        }
        case 'super':
          f.vx = 0;
          if (f.stateT >= 0.6) {
            f.state = 'idle';
            f.stateT = 0;
          }
          break;
        case 'hit':
        case 'blockstun':
          f.stun -= dt;
          f.vx *= Math.exp(-10 * dt);
          if (f.stun <= 0) {
            f.stateT = 0;
            f.vx = 0;
            // Still in the air: fall the rest of the way with no air attack left.
            if (f.y < 0) {
              f.state = 'jump';
              f.airUsed = true;
            } else f.state = 'idle';
          }
          break;
        case 'ko':
        case 'deprecated':
          f.vx *= Math.exp(-4 * dt);
          break;
        default:
          break;
      }
      // Knocked into the air (or out in mid-air): fall back down.
      if (f.y < 0 && f.state !== 'jump') {
        f.vy += GRAV * dt;
        f.y = Math.min(0, f.y + f.vy * dt);
        if (f.y >= 0) f.vy = 0;
      }
      f.x = R.clamp(f.x + f.vx * dt, K.LEFT, K.RIGHT);
    }

    // Is something about to hit this fighter (a swing in range, or a projectile on its way)?
    threat(f) {
      const o = f.foe;
      if ((o.state === 'attack' && o.move !== 'throw') || o.move === 'air') {
        if (Math.abs(o.x - f.x) < 52) return true;
      }
      for (const p of this.proj) if (p.alive && p.side !== f.side && Math.sign(f.x - p.x) === Math.sign(p.vx) && Math.abs(f.x - p.x) < 70) return true;
      return false;
    }

    attack(f, move) {
      f.state = 'attack';
      f.stateT = 0;
      f.move = move;
      f.moveT = 0;
      f.hitDone = false;
      f.thrown = false;
      f.vx = 0;
      this.emit({ type: move === 'throw' ? 'windup' : 'swing', side: f.side, kind: move });
    }

    superMove(f) {
      f.state = 'super';
      f.stateT = 0;
      f.meter = 0;
      f.vx = 0;
      f.stats.supers++;
      // Sam speeds himself up; Dario slows the other fighter down. Doubling your own speed is
      // worth more than halving the other's, so the slowdown lasts longer.
      if (f.id === 'sam') f.fast = SUPER_T;
      else f.foe.slowed = SUPER_T * SLOW_K;
      this.emit({ type: 'super', side: f.side, kind: f.id === 'sam' ? 'accelerate' : 'slowdown' });
    }

    // Keep the two bodies apart. A fighter high in the air can pass over the other.
    separate() {
      const [a, b] = this.f;
      if (a.state === 'ko' || b.state === 'ko' || a.state === 'deprecated' || b.state === 'deprecated') return;
      if (a.y < -40 || b.y < -40) return;
      const d = b.x - a.x;
      if (Math.abs(d) >= GAP) return;
      const s = d >= 0 ? 1 : -1;
      const push = (GAP - Math.abs(d)) / 2;
      a.x -= s * push;
      b.x += s * push;
      // Against a wall, the other one gives way.
      for (const [f, o] of [[a, b], [b, a]]) {
        if (f.x < K.LEFT) {
          o.x += K.LEFT - f.x;
          f.x = K.LEFT;
        } else if (f.x > K.RIGHT) {
          o.x -= f.x - K.RIGHT;
          f.x = K.RIGHT;
        }
      }
    }

    // ---------------- hits ----------------
    box(f, b) {
      const x0 = f.face > 0 ? f.x + b[0] : f.x - b[1];
      const x1 = f.face > 0 ? f.x + b[1] : f.x - b[0];
      return [x0, x1, f.y + b[2], f.y + b[3]];
    }
    hurt(f) {
      return [f.x + HURT[0], f.x + HURT[1], f.y + HURT[2], f.y + HURT[3]];
    }

    strike(f) {
      if (!f.move || f.hitDone || f.move === 'throw') return;
      const m = MOVES[f.move];
      if (f.moveT < m.start || f.moveT > m.start + m.active) return;
      const o = f.foe;
      if (o.state === 'ko' || o.state === 'super' || this.state !== 'fight') return;
      const a = this.box(f, m.box);
      const h = this.hurt(o);
      if (a[0] < h[1] && a[1] > h[0] && a[2] < h[3] && a[3] > h[2]) {
        f.hitDone = true;
        this.land(f, o, m, (a[0] + a[1]) / 2 - f.face * 6, R.KOMBAT.FLOOR + (a[2] + a[3]) / 2, f.move);
      }
    }

    // A hit connects: blocked, or damage, hitstun, knockback, meter, combos, the K.O.
    land(f, o, m, x, y, kind) {
      const blocked = (o.state === 'block' || o.state === 'blockstun' || ((o.state === 'idle' || o.state === 'walk') && o.back(f))) && o.grounded;
      const dirx = Math.sign(o.x - f.x) || f.face;
      if (blocked) {
        o.state = 'blockstun';
        o.stateT = 0;
        o.stun = 0.16;
        o.vx = dirx * m.push * 0.6;
        o.hp = Math.max(1, o.hp - (kind === 'proj' ? 2 : 1));
        o.meter = Math.min(100, o.meter + 5);
        f.meter = Math.min(100, f.meter + 2);
        o.stats.blocks++;
        f.combo = 0;
        this.emit({ type: 'block', side: o.side, x, y, kind });
        return;
      }
      const inCombo = o.state === 'hit';
      f.combo = inCombo ? f.combo + 1 : 1;
      const scaleDmg = Math.max(0.5, 1 - 0.1 * (f.combo - 1));
      const dmg = Math.max(1, Math.round(m.dmg * scaleDmg));
      o.hp = Math.max(0, o.hp - dmg);
      o.state = 'hit';
      o.stateT = 0;
      o.stun = m.stun;
      o.move = null;
      o.vx = dirx * m.push;
      if (kind === 'air') o.vy = Math.min(o.vy, -60);
      o.meter = Math.min(100, o.meter + 6);
      f.meter = Math.min(100, f.meter + 10);
      f.stats.hits++;
      f.stats.best = Math.max(f.stats.best, f.combo);
      const first = !this.firstHit;
      this.firstHit = true;
      this.emit({ type: 'hit', side: f.side, victim: o.side, x, y, kind, dmg, combo: f.combo, first });
      if (o.hp <= 0) this.knockOut(f, o);
    }

    knockOut(f, o) {
      this.winner = f.side;
      this.koStep = this.step;
      const decides = this.wins[f.side] + 1 >= this.need;
      for (const p of this.proj) p.alive = false;
      if (decides) {
        // The deciding round: the loser stays up, dazed, for the finisher.
        this.state = 'finish';
        this.stateT = 0;
        o.state = 'dazed';
        o.stateT = 0;
        o.vx = 0;
        f.state = 'idle';
        f.stateT = 0;
        f.move = null;
        this.emit({ type: 'ko', winner: f.side, loser: o.side, finish: true, perfect: f.hp >= K.HP });
      } else {
        this.state = 'done';
        this.stateT = 0;
        this.doneStep = this.step;
        o.state = 'ko';
        o.stateT = 0;
        f.state = 'win';
        f.stateT = 0;
        f.move = null;
        this.emit({ type: 'ko', winner: f.side, loser: o.side, finish: false, perfect: f.hp >= K.HP });
      }
    }

    // During the finisher window: the winner's special deprecates the loser; otherwise a plain win.
    endFinish(deprecated) {
      const f = this.f[this.winner];
      const o = f.foe;
      this.state = 'done';
      this.stateT = 0;
      this.doneStep = this.step;
      o.state = deprecated ? 'deprecated' : 'ko';
      o.stateT = 0;
      f.state = 'win';
      f.stateT = 0;
      this.emit({ type: deprecated ? 'deprecate' : 'fall', winner: f.side, loser: o.side });
    }

    timeUp() {
      const [a, b] = this.f;
      this.state = 'done';
      this.stateT = 0;
      this.doneStep = this.step;
      this.winner = a.hp === b.hp ? -1 : a.hp > b.hp ? 0 : 1;
      for (const f of this.f) {
        f.state = this.winner === f.side ? 'win' : this.winner < 0 ? 'idle' : 'dazed';
        f.stateT = 0;
        f.move = null;
        f.vx = 0;
      }
      this.emit({ type: 'timeup', winner: this.winner });
    }

    // ---------------- projectiles ----------------
    projectiles() {
      for (const p of this.proj) {
        if (!p.alive) continue;
        p.t += DT;
        p.x += p.vx * DT;
        if (p.x < -20 || p.x > W + 20) p.alive = false;
      }
      // Two ads meet in the middle and cancel out.
      const live = this.proj.filter((p) => p.alive);
      for (let i = 0; i < live.length; i++)
        for (let j = i + 1; j < live.length; j++) {
          const a = live[i];
          const b = live[j];
          if (a.side !== b.side && Math.abs(a.x - b.x) < PROJ.w) {
            a.alive = b.alive = false;
            this.emit({ type: 'clash', x: (a.x + b.x) / 2, y: K.FLOOR - 44 });
          }
        }
      if (this.state !== 'fight') return;
      for (const p of this.proj) {
        if (!p.alive) continue;
        const o = this.f[1 - p.side];
        if (o.state === 'ko' || o.state === 'super') continue;
        const h = this.hurt(o);
        if (p.x + PROJ.w / 2 > h[0] && p.x - PROJ.w / 2 < h[1] && p.y + PROJ.h / 2 > h[2] && p.y - PROJ.h / 2 < h[3]) {
          p.alive = false;
          const f = this.f[p.side];
          this.land(f, o, { dmg: PROJ.dmg, stun: PROJ.stun, push: PROJ.push }, p.x, K.FLOOR + p.y, 'proj');
          if (this.state !== 'fight') return;
        }
      }
      this.proj = this.proj.filter((p) => p.alive);
    }

    // ---------------- the CPU ----------------
    // It re-thinks every so often (its reaction time), holds a direction in between and presses
    // a button when it decides to. Everything it rolls comes from the round's seeded rng.
    think(f) {
      const o = f.foe;
      const L = this.level;
      const rnd = this.rand;
      if (this.state === 'finish') {
        // Winning CPU: deprecate after a beat.
        if (this.winner === f.side && this.stateT > 1.1 && !f.finished) {
          f.finished = true;
          this.endFinish(true);
        }
        return 0;
      }
      if (this.state !== 'fight') return 0;
      f.planT -= DT * f.scale;
      const toward = o.x > f.x ? IN.R : IN.L;
      const away = toward === IN.R ? IN.L : IN.R;
      const dist = Math.abs(o.x - f.x);
      let press = 0;
      if (f.planT <= 0) {
        f.planT = L.react * (0.7 + rnd() * 0.6);
        const threat = this.threat(f);
        const incoming = this.proj.some((p) => p.alive && p.side !== f.side && Math.abs(p.x - f.x) < 90 && Math.sign(f.x - p.x) === Math.sign(p.vx));
        if (f.meter >= 100 && rnd() < 0.5) press = IN.S;
        else if (incoming) {
          const r = rnd();
          if (r < L.block * 0.5) f.plan = { hold: away, t: 0.5 };
          else if (r < L.block * 0.5 + L.anti) press = IN.U | toward;
          else if (f.cool <= 0 && r < 0.85) press = IN.S;
          else f.plan = { hold: away, t: 0.3 };
        } else if (threat && rnd() < L.block) f.plan = { hold: away, t: 0.35 };
        else if (!o.grounded && dist < 60 && rnd() < L.anti) press = IN.P;
        else if (dist > 72) {
          const r = rnd();
          if (f.cool <= 0 && r < L.proj) press = IN.S;
          else if (r < L.proj + L.jump) press = IN.U | toward;
          else f.plan = { hold: toward, t: 0.4 };
        } else if (dist > 34) {
          const r = rnd();
          if (r < 0.25 * L.aggro && dist < 40) press = IN.Kk;
          else if (r < L.jump) press = IN.U | toward;
          else if (f.cool <= 0 && r < L.jump + L.proj * 0.4) press = IN.S;
          else f.plan = { hold: toward, t: 0.25 };
        } else {
          const r = rnd();
          if (r < Math.min(0.5, 0.3 * L.aggro)) press = IN.P;
          else if (r < Math.min(0.75, 0.5 * L.aggro)) press = IN.Kk;
          else if (r < Math.min(0.75, 0.5 * L.aggro) + 0.15) f.plan = { hold: away, t: 0.3 };
          else f.plan = { hold: 0, t: 0.2 };
        }
      }
      let held = 0;
      if (f.plan) {
        held = f.plan.hold;
        f.plan.t -= DT * f.scale;
        if (f.plan.t <= 0) f.plan = null;
      }
      return held | press;
    }
  }

  R.Round = Round;
  R.MOVES = MOVES;
  R.PROJ = PROJ;
})();
