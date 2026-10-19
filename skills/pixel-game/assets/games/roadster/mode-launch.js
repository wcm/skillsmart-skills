/* Flappy Roadster · 0-60: the unveil's launch as a reaction test. Stage at the line, watch the
   tree, tap on green. The car does its part in Tesla's 0.67 s ("w/ rollout subtracted", as is
   tradition) and your reaction time goes on top. Beat the Roadster's own 0.81 s. */
(function () {
  'use strict';
  const R = window.R;
  const DT = R.DT;
  const G = R.GROUND;
  const W = R.W;

  const CAR_T = 0.81; // Tesla's 0-60 caption
  const ROLLOUT_T = 0.67; // "0.67 seconds (w/ rollout subtracted)"
  R.LAUNCH_T = { car: CAR_T, rollout: ROLLOUT_T };
  const PX_M = 10; // the sprite is 44 px for a car about 4.4 m long
  const MPS60 = 26.82;
  const ACC = MPS60 / CAR_T; // about 3.4 g
  const STAGE_T = 0.95; // pre-stage and stage bulbs, then the tree starts
  const ASLEEP = 2.5; // no tap this long after green and the car goes without you
  // Per drive mode: seconds between ambers (0 is a pro tree, all three at once) and the random
  // hold before green, so the light can't be timed.
  const TREE = [
    { amber: 0.6, hold: [0.45, 1.05] },
    { amber: 0.5, hold: [0.3, 1.25] },
    { amber: 0.4, hold: [0.25, 1.45] },
    { amber: 0, hold: [0.2, 1.7] },
  ];
  const TREE_X = 195; // off to the right, clear of the title's call to tap
  const LINE_X = R.CAR_X + 17;

  // Reaction ratings, fastest first. A total under 0.81 s beats Tesla's own number.
  const RATINGS = [
    { rt: 0.1, name: 'ARE YOU A ROBOT?', col: '#7dff6b' },
    { rt: CAR_T - ROLLOUT_T, name: 'FASTER THAN THE ROADSTER', col: '#7dff6b' },
    { rt: 0.18, name: 'PLAID REFLEXES', col: '#ffe14d' },
    { rt: 0.22, name: 'LUDICROUS', col: '#ffe14d' },
    { rt: 0.27, name: 'SPORT', col: '#2ef6ff' },
    { rt: 0.34, name: 'CHILL', col: '#2ef6ff' },
    { rt: 0.5, name: 'SUNDAY DRIVER', col: '#ff9ae8' },
    { rt: 99, name: 'STILL WAITING FOR 2020', col: '#ff3fd2' },
  ];
  R.launchRating = (rt) => RATINGS.find((r) => rt < r.rt);

  class LaunchWorld {
    constructor(opts) {
      this.kind = 'launch';
      this.seed = opts.seed >>> 0;
      this.rand = R.rng(this.seed);
      this.setMode(opts.mode);
      this.skin = opts.skin || { gravity: 1, flap: 1 };
      this.roadDy = this.skin.roadDy || R.ROAD_DY;
      this.state = opts.state || 'ready';
      this.step = 0;
      this.t = 0;
      this.stateT = 0;
      this.dist = 0;
      this.speed = 0;
      this.score = 0;
      this.near = 0;
      this.combo = 0;
      this.bolts = 0;
      this.ludi = 0;
      this.invuln = 0;
      this.phantom = 0;
      this.topSpeed = 0;
      this.zone = 0;
      this.lap = 0;
      this.pipes = [];
      this.inputs = [];
      this.queue = [];
      this.auto = !!opts.auto;
      this.autoUntil = -1;
      this.events = [];
      this.deathStep = -1;
      this.deathKind = '';
      // Lights: pre-stage, stage, ambers lit (0-3), green, red.
      this.lights = { pre: false, stage: false, amber: 0, green: false, red: false };
      this.phase = 'stage'; // stage → tree → green → launch | foul → done
      this.phaseT = 0;
      this.greenT = 0; // tree time when green comes on
      this.greenShownAt = 0; // performance.now() of the first frame showing green (set by main)
      this.launchT = 0;
      this.mph = 0;
      this.result = null;
      this.robot = null;
      this.car = { x: R.CAR_X, y: G - this.roadDy, vy: 0, ang: 0, va: 0, alive: true, flapT: 9, fold: 0, bounces: 0, resting: false, creep: 0 };
    }

    setMode(mode) {
      this.mode = mode;
      this.tree = TREE[Math.max(0, R.MODES.indexOf(mode))];
    }

    emit(e) {
      this.events.push(e);
    }
    isAuto() {
      return this.auto;
    }
    tap(ts) {
      this.queue.push(ts == null ? (typeof performance !== 'undefined' ? performance.now() : 0) : ts);
    }
    release() {}
    startIntro() {
      this.state = 'ready';
      this.stateT = 0;
    }

    update() {
      const car = this.car;
      this.t += DT;
      this.stateT += DT;
      this.phaseT += DT;
      if (this.state === 'title') {
        car.y = G - this.roadDy;
        return;
      }
      if (this.state === 'ready') {
        // Rolling into the beams: pre-stage, then stage, then the tree takes over.
        this.queue.length = 0;
        if (!this.lights.pre && this.stateT > 0.2) {
          this.lights.pre = true;
          this.emit({ type: 'stage', n: 1 });
        }
        if (!this.lights.stage && this.stateT > 0.55) {
          this.lights.stage = true;
          this.emit({ type: 'stage', n: 2 });
        }
        if (this.stateT >= STAGE_T) this.startTree();
        return;
      }
      if (this.state === 'play') this.updateTree();
      else this.updateDone();
      this.step++;
    }

    startTree() {
      const tr = this.tree;
      const hold = tr.hold[0] + this.rand() * (tr.hold[1] - tr.hold[0]);
      this.greenT = (tr.amber ? 2 * tr.amber : 0) + hold;
      this.state = 'play';
      this.stateT = 0;
      this.phase = 'tree';
      this.phaseT = 0;
      this.step = 0;
      this.emit({ type: 'start' });
      if (this.auto) {
        // FSF reacts in a couple of hundredths. Now and then it launches on its own.
        this.robot = this.rand() < 0.12 ? { at: this.greenT * (0.3 + this.rand() * 0.6), phantom: true } : { at: this.greenT + 0.02 + this.rand() * 0.015, phantom: false };
      }
    }

    updateTree() {
      const L = this.lights;
      const tr = this.tree;
      const t = this.stateT;
      if (this.phase === 'tree' || this.phase === 'green') {
        const n = tr.amber ? Math.min(3, 1 + Math.floor(t / tr.amber)) : 3;
        if (n !== L.amber && t < this.greenT) {
          L.amber = n;
          this.emit({ type: 'amber', n, pro: !tr.amber });
        }
        if (this.phase === 'tree' && t >= this.greenT) {
          this.phase = 'green';
          this.phaseT = 0;
          L.amber = 0;
          L.green = true;
          this.emit({ type: 'green' });
        }
      }
      if (this.phase === 'tree') {
        if (this.queue.length) return this.foul(t - this.greenT, 'falsestart');
        if (this.robot && this.robot.phantom && t >= this.robot.at) return this.foul(t - this.greenT, 'phantom');
      } else if (this.phase === 'green') {
        const robotGo = this.robot && !this.robot.phantom && t >= this.robot.at;
        if (this.queue.length) {
          const ts = this.queue[0];
          // Timed against the frame that first showed green; before that frame, it's a jump.
          const rt = this.greenShownAt ? (ts - this.greenShownAt) / 1000 : t - this.greenT - DT;
          if (rt < 0) return this.foul(rt, 'falsestart');
          if (this.auto) {
            this.auto = false;
            this.emit({ type: 'disengage' });
          }
          this.go(rt, false);
        } else if (this.auto && robotGo) this.go(this.robot.at - this.greenT, true);
        else if (this.phaseT >= ASLEEP) this.go(ASLEEP, false, true);
      } else if (this.phase === 'launch') this.updateLaunch();
      this.queue.length = 0;
    }

    go(rt, robot, asleep) {
      this.queue.length = 0;
      this.phase = 'launch';
      this.phaseT = 0;
      this.launchT = 0;
      this.result = { rt, foul: false, robot, asleep: !!asleep, total: rt + ROLLOUT_T, raw: rt + CAR_T, rating: R.launchRating(rt) };
      this.score = Math.round(rt * 1000);
      this.car.flapT = 0;
      this.inputs.push(this.step);
      this.emit({ type: 'launch', rt, robot, x: this.car.x, y: this.car.y });
    }

    updateLaunch() {
      const car = this.car;
      this.launchT += DT;
      const v = ACC * this.launchT;
      this.mph = Math.min(v / 0.44704, 999);
      this.speed = v * PX_M * 0.25; // a touch of drift for the smoke
      this.topSpeed = Math.max(this.topSpeed, this.mph / 1.9);
      car.x = R.CAR_X + 0.5 * ACC * this.launchT * this.launchT * PX_M;
      car.flapT += DT;
      car.ang = this.launchT < 0.25 ? -0.05 : 0;
      if (!this.sixty && this.launchT >= CAR_T) {
        this.sixty = true;
        this.emit({ type: 'sixty', x: car.x, y: car.y, result: this.result });
        this.finish();
      }
    }

    foul(rt, kind) {
      this.queue.length = 0;
      this.phase = 'foul';
      this.phaseT = 0;
      this.lights.red = true;
      this.lights.amber = 0;
      this.lights.green = false;
      this.result = { rt, foul: true, robot: kind === 'phantom', kind, total: 0, raw: 0, rating: null };
      this.score = 0;
      this.emit({ type: 'foul', kind, rt, x: this.car.x, y: this.car.y });
      this.finish();
    }

    finish() {
      this.state = 'dead';
      this.stateT = 0;
      this.deathKind = this.result.foul ? this.result.kind : 'launch';
      this.emit({ type: 'finish', kind: this.deathKind, result: this.result, x: this.car.x, y: this.car.y });
    }

    updateDone() {
      const car = this.car;
      if (this.phase === 'launch') {
        this.updateLaunch();
        if (car.x > W + 80 && this.stateT > 0.9) car.resting = true;
      } else {
        // Red light: the car lurches over the line and stops.
        car.creep = Math.min(1, car.creep + DT / 0.25);
        car.x = R.CAR_X + 9 * R.easeOut(car.creep);
        car.ang = car.creep < 1 ? -0.04 * Math.sin(car.creep * Math.PI) : 0;
        if (this.stateT > 0.9) car.resting = true;
      }
    }

    // ---------------- drawing ----------------
    drawMid(view, b, gl) {
      const L = this.lights;
      const x0 = TREE_X - 13;
      const y0 = G - 124; // the housing stands on a short pole, level with the car
      // Pole and housing.
      b.fillStyle = '#1d1a26';
      b.fillRect(TREE_X - 2, y0 + 110, 4, G - (y0 + 110));
      b.fillStyle = '#34303f';
      b.fillRect(TREE_X - 2, y0 + 110, 1, G - (y0 + 110));
      b.fillStyle = '#07060b';
      b.fillRect(x0, y0, 26, 112);
      b.fillStyle = '#2a2633';
      b.fillRect(x0, y0, 26, 1);
      b.fillRect(x0, y0, 1, 112);
      b.fillRect(x0 + 25, y0, 1, 112);
      b.fillRect(x0, y0 + 111, 26, 1);
      b.fillStyle = '#16141c';
      b.fillRect(x0 + 12, y0 + 2, 2, 108);
      const bulb = (cx, cy, r, on, col, off) => {
        R.disc(b, cx, cy, r + 1, '#000000');
        R.disc(b, cx, cy, r, on ? col : off);
        if (on) {
          R.disc(b, cx - 1, cy - 1, Math.max(1, r - 2), '#ffffff');
          R.disc(gl, cx, cy, r + 1, col);
          R.softGlow(gl, cx, cy, r * 5, col, 0.55);
        }
      };
      for (const dx of [-6, 6]) {
        const cx = TREE_X + dx;
        bulb(cx, y0 + 7, 2, L.pre, '#fff4c2', '#2d2918');
        bulb(cx, y0 + 15, 2, L.stage, '#fff4c2', '#2d2918');
        for (let i = 0; i < 3; i++) bulb(cx, y0 + 29 + i * 16, 5, L.amber > i, '#ffb21e', '#33240b');
        bulb(cx, y0 + 79, 5, L.green, '#39ff7a', '#0b2a16');
        bulb(cx, y0 + 97, 5, L.red, '#ff2a3d', '#2e0a10');
      }
      // Sign above: which tree.
      R.text(b, this.tree.amber ? 'SPORTSMAN' : 'PRO TREE', TREE_X, y0 - 8, { font: 'small', color: '#8a7fb0', align: 'center' });
    }

    drawTop(view, b, gl) {
      // The start line and the staging beam across the lane.
      b.fillStyle = '#e9e6f2';
      b.fillRect(LINE_X, G, 2, 7);
      b.fillRect(LINE_X - 1, G + 7, 3, 6);
      gl.fillStyle = '#ffffff';
      gl.fillRect(LINE_X, G, 2, 4);
      if (this.lights.stage && this.phase !== 'launch') {
        b.fillStyle = 'rgba(255,42,61,0.7)';
        b.fillRect(LINE_X, G - 6, 1, 6);
        gl.fillStyle = '#ff2a3d';
        gl.fillRect(LINE_X, G - 6, 1, 6);
      }
    }
  }

  R.LaunchWorld = LaunchWorld;
})();
