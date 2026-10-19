/* Meta Gear Solid · sim: one sneaking run as a deterministic simulation, stepped at 120 Hz. While
   the screen is held the player walks up a path through rooms full of smart-glasses wearers; let
   go and they drop under a cardboard box. Every guest's glasses see a cone: walk inside one and
   you're recorded. Some glasses wake up on their own and listen in a ring around them: walk
   inside that and you're recorded too. A box is safe from a glance, but a guest who turns round
   and stares at it lifts it, and one walking past trips over it.

   Guests move on patterns of the world clock, so the autopilot can look ahead exactly. Every
   change of the held input is recorded (the autopilot's too), so the same seed and inputs give
   the same run: that's the POV footage after a capture. */
(function () {
  'use strict';
  const R = window.R;
  const W = R.W;
  const DT = (R.DT = 1 / 120);
  const TAU = Math.PI * 2;

  const MG = (R.MG = {
    PY: 300, // the player's row on screen
    SPEED: 40, // walking, px/s
    M: 16, // px per metre
    ROOM: 640, // one room, px
    START: 150, // the empty stretch inside the front door
    CONE: 0.42, // half the cone's angle
    SPOT: 0.16, // seconds in a cone before you're seen
    SUS: 0.8, // seconds a box can be stared at by a guest who turned round
    RING: 44, // how far woken glasses hear
    WARN: 0.6, // the warning before a false wake
    WAKE: 1.4, // how long a false wake listens
    CAUGHT: 1.0, // the "!" freeze before the run ends
  });

  // The rooms, in order, and who's in them. The handles are made up.
  R.ZONES = [
    { id: 'cafe', name: 'COFFEE SHOP', kinds: ['sweep', 'sweep', 'turn', 'patrol'], handles: ['@LATTE_POV', '@OAT_MILK_ERA', '@FOAM_ART_DAILY', '@BARISTA_CAM', '@COLD_BREW_CREW'] },
    { id: 'gym', name: 'GYM', kinds: ['patrol', 'turn', 'sweep', 'patrol'], handles: ['@REP_COUNTER', '@LEG_DAY_LIVE', '@MIRROR_SELFIE', '@PROTEIN_POV', '@SPOT_ME_BRO'] },
    { id: 'wedding', name: 'WEDDING', kinds: ['sweep', 'spin', 'turn', 'sweep'], handles: ['@VOWS_IN_4K', '@BEST_MAN_CAM', '@AUNTIE_UPLOADS', '@FIRST_DANCE_POV', '@PLUS_ONE_LIVE'] },
    { id: 'expo', name: 'TECH EXPO', kinds: ['sweep', 'patrol', 'turn', 'spin'], handles: ['@KEYNOTE_GUY', '@DEMO_DAY_POV', '@SWAG_BAG_CAM', '@LANYARD_LIFE', '@EARLY_ADOPTER'] },
  ];

  // The path the player walks: straight in from the door, then gentle curves.
  R.pathX = (d) => W / 2 + Math.sin(d / 170) * 22 * R.clamp((d - 60) / 240, 0, 1);

  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // A guest. Kinds: sweep (looks side to side), turn (faces away, then turns to look), patrol
  // (walks across the path), spin (dances). pose(t) is pure.
  class Guest {
    constructor(o) {
      Object.assign(this, o);
      this.spot = 0; // seen walking, 0..1
      this.sus = 0; // a box in view, 0..1
      this.closeT = 0;
      this.fooled = false;
      this.peak = 0;
    }
    pose(t) {
      let x = this.x;
      let a = this.base;
      let warn = false;
      let moving = 0;
      if (this.kind === 'sweep') a = this.base + this.amp * Math.sin(this.w * t + this.ph);
      else if (this.kind === 'spin') a = this.base + this.w * t;
      else if (this.kind === 'turn') {
        const p = (t + this.ph) % this.per;
        if (p < this.away) a = this.awayA;
        else if (p < this.away + 0.5) {
          a = this.awayA;
          warn = true;
        }
      } else if (this.kind === 'patrol') {
        // There and back along a line, a beat's pause at each end, facing the way it walks.
        const p = ((t + this.ph) % this.per) / this.per;
        const u = p < 0.5 ? p * 2 : 2 - p * 2;
        const e = R.easeInOut(R.clamp((u - 0.1) / 0.8, 0, 1));
        x = this.x + (this.x1 - this.x) * e;
        const right = (this.x1 > this.x) === p < 0.5;
        a = right ? this.tilt : Math.PI - this.tilt;
        moving = u > 0.1 && u < 0.9 ? (right ? 1 : -1) : 0;
      }
      let ring = 0;
      let wake = false;
      let wakeWarn = false;
      if (this.wper) {
        const q = (t + this.wph) % this.wper;
        if (q < MG.WARN) wakeWarn = true;
        else if (q < MG.WARN + MG.WAKE) {
          wake = true;
          ring = MG.RING * Math.min(1, (q - MG.WARN) / 0.25);
        }
      }
      return { x, d: this.d, a, warn, ring, wake, wakeWarn, moving };
    }
    // Is a point at (px, pd) inside this guest's view at pose p? A margin widens the view (the
    // autopilot keeps clear of the edges).
    sees(p, px, pd, margin) {
      const m = margin || 0;
      const vx = px - p.x;
      const vy = p.d - pd; // screen y grows as d shrinks
      const r = Math.hypot(vx, vy);
      if (r > this.range + m * 10) return false;
      if (r < 6 + m * 10) return true;
      return Math.abs(wrapA(Math.atan2(vy, vx) - p.a)) < MG.CONE + m;
    }
    // The stretch of path [lo, hi] it can ever see or hear (or trip over a box in), over 12 s.
    // Sampled with the autopilot's margin and padded, so it errs on the long side.
    reach() {
      let lo = Infinity;
      let hi = -Infinity;
      for (let dd = -140; dd <= 140; dd += 4) {
        const pd = this.d + dd;
        const px = R.pathX(pd);
        let hit = !!this.wper && Math.hypot(px - this.x, dd) < MG.RING + 6;
        for (let k = 0; k < 150 && !hit; k++) {
          const p = this.pose(k * 0.08);
          if (this.sees(p, px, pd, 0.06) || this.trips(p, px, pd, 4)) hit = true;
        }
        if (hit) {
          lo = Math.min(lo, pd);
          hi = Math.max(hi, pd);
        }
      }
      return lo === Infinity ? [this.d, this.d] : [lo - 4, hi + 4];
    }
    // The spots this guest marks as no place for a box: a turner's gaze when it turns round, a
    // patroller's walkway.
    marks(px, pd) {
      if (this.kind === 'patrol') return Math.abs(pd - this.d) < 15;
      if (this.kind === 'turn') return this.sees({ x: this.x, d: this.d, a: this.base }, px, pd, 0.06);
      return false;
    }
    // A patroller walking into a box on its line.
    trips(p, px, pd, margin) {
      return this.kind === 'patrol' && p.moving !== 0 && Math.abs(p.d - pd) < 9 + (margin || 0) && Math.abs(p.x - px) < 11 + (margin || 0);
    }
    // Close to the edge of the view, but not in it.
    grazes(p, px, pd) {
      const vx = px - p.x;
      const vy = p.d - pd;
      const r = Math.hypot(vx, vy);
      if (r > this.range + 10) return false;
      const da = Math.abs(wrapA(Math.atan2(vy, vx) - p.a));
      return da < MG.CONE + 0.12;
    }
  }

  class World {
    // o: { seed, auto, replay: { inputs, autoUntil } }
    constructor(o) {
      this.seed = o.seed >>> 0;
      this.rand = R.rng(this.seed);
      this.replay = o.replay || null;
      this.replayIdx = 0;
      this.auto = !!o.auto;
      this.autoUntil = this.replay ? this.replay.autoUntil : -1;
      this.state = 'ready'; // ready | play | caught | dead
      this.stateT = 0;
      this.step = 0;
      this.t = 0;
      this.d = 0;
      this.held = false;
      this.input = false; // the player's finger, set from outside
      this.walking = false;
      this.boxed = true;
      this.stepT = 0;
      this.foot = 0;
      this.room = 0;
      this.rooms = 0; // generated
      this.guests = [];
      this.decor = [];
      this.inputs = []; // [step, held] at every change, the autopilot's included
      this.events = [];
      this.deathStep = -1;
      this.catcher = null;
      this.why = '';
      this.stats = { boxes: 0, close: 0, fooled: 0, rooms: 0, walked: 0 };
      this.autoHold = false;
      this.thinkT = 0;
      this.planEnd = null; // where the autopilot means to stop and box
      this.nid = 0;
      this.gen = null; // a room being built ahead
      while (this.rooms < 2) this.genRoom(this.rooms++);
    }

    emit(e) {
      this.events.push(e);
    }
    get score() {
      return Math.floor(this.d / MG.M);
    }
    isAuto() {
      return this.replay ? this.step < this.autoUntil : this.auto;
    }
    // A player's touch takes the controls from the autopilot.
    takeOver() {
      if (!this.auto || this.replay) return;
      this.auto = false;
      this.autoUntil = this.step;
      this.emit({ type: 'disengage' });
    }

    // ---------------- the rooms ----------------
    // A room's guests go one after another along the path: each one's reach (the stretch of
    // path it can ever see or hear) starts a gap after the last one's, so a box can always wait
    // between them and every guest is a puzzle of its own.
    genRoom(k) {
      const gen = this.roomGen(k);
      while (!gen.next().done);
    }
    // The same, one guest per call to next(): the world builds rooms ahead a step at a time, so
    // a new room never costs a frame.
    *roomGen(k) {
      const rnd = this.rand;
      const z = R.ZONES[k % R.ZONES.length];
      const d0 = k * MG.ROOM;
      const end = d0 + MG.ROOM;
      const lv = Math.min(k, 9);
      const gap = Math.max(22, 64 - lv * 5);
      if (this.cursor == null) this.cursor = MG.START;
      for (let n = 0; n < 12; n++) {
        // The first guest of the run is an easy one.
        const kind = k === 0 && n === 0 ? 'sweep' : z.kinds[Math.floor(rnd() * z.kinds.length)];
        const gs = this.makeGuest(kind, lv, z, k, rnd);
        this.placeAt(gs, this.cursor + gap + 80);
        let [lo] = gs.reach();
        this.placeAt(gs, gs.d + this.cursor + gap - lo);
        let hi;
        [lo, hi] = gs.reach();
        if (hi > end - 16) break; // the next room takes it from here
        // Someone who turns round must face the wall long enough to walk past them.
        if (kind === 'turn') {
          gs.away = Math.max(gs.away, (hi - lo) / MG.SPEED + 0.8);
          gs.per = gs.away + 0.5 + gs.lookT;
        }
        gs.lo = lo;
        gs.hi = hi;
        this.guests.push(gs);
        this.cursor = hi;
        yield;
      }
      // Furniture and props on both sides of the path, clear of the guests.
      for (let dd = d0 + 20; dd < end - 20; dd += 26 + rnd() * 22) {
        for (const side of [-1, 1]) {
          if (rnd() < 0.35) continue;
          const px = R.pathX(dd);
          const x = px + side * (34 + rnd() * 60);
          if (x < 10 || x > W - 10) continue;
          if (this.guests.some((gs) => Math.abs(gs.d - dd) < 18 && Math.abs(gs.x - x) < 22)) continue;
          this.decor.push({ x: Math.round(x), d: Math.round(dd), v: Math.floor(rnd() * 8), zone: z.id });
        }
      }
    }

    makeGuest(kind, lv, z, k, rnd) {
      const o = { id: this.nid++, kind, side: rnd() < 0.5 ? -1 : 1, zone: z.id, room: k, look: Math.floor(rnd() * 64), handle: z.handles[Math.floor(rnd() * z.handles.length)] };
      const side = o.side;
      if (kind === 'sweep') {
        // Beside the path, looking side to side across it.
        o.off = 40 + rnd() * 26;
        o.base = (side < 0 ? 0 : Math.PI) + (side < 0 ? 0.35 : -0.35);
        o.amp = 0.6 + rnd() * 0.3 + Math.min(lv, 4) * 0.02;
        o.w = 0.6 + lv * 0.09 + rnd() * 0.25;
        o.ph = rnd() * TAU;
        o.range = 64 + lv * 2.5;
      } else if (kind === 'turn') {
        // Faces the wall, warns with a shuffle, then turns to look back down the path.
        o.off = 26 + rnd() * 20;
        o.base = Math.PI / 2 + (side < 0 ? -0.5 : 0.5);
        o.awayA = side < 0 ? Math.PI : 0;
        o.away = Math.max(1.4, 1.9 + rnd() * 1.2 - lv * 0.08);
        o.lookT = 1.0 + lv * 0.06 + rnd() * 0.3;
        o.per = o.away + 0.5 + o.lookT;
        o.ph = rnd() * o.per;
        o.range = 72;
      } else if (kind === 'patrol') {
        // Walks across the path and back.
        o.span = 60 + rnd() * 16;
        o.per = Math.max(6.5, (4.6 + rnd() - lv * 0.1) * 2);
        o.ph = rnd() * o.per;
        o.tilt = 0.3;
        o.range = 60 + lv * 2;
      } else {
        // Dancing in circles.
        o.off = 40 + rnd() * 20;
        o.w = (rnd() < 0.5 ? -1 : 1) * (1.0 + lv * 0.09 + rnd() * 0.35);
        o.base = rnd() * TAU;
        o.range = 58;
      }
      // Some glasses wake up by themselves now and then (only on guests who just glance at
      // boxes, so a false wake never pins a box somewhere it'll be found).
      const r = rnd();
      if (k > 0 && (kind === 'sweep' || kind === 'spin') && r < Math.min(0.6, 0.15 + lv * 0.07)) {
        o.wper = 5 + rnd() * 3;
        o.wph = rnd() * o.wper;
      }
      return new Guest(o);
    }

    placeAt(gs, d) {
      gs.d = Math.round(d);
      const px = R.pathX(gs.d);
      if (gs.kind === 'patrol') {
        gs.x = R.clamp(Math.round(px - gs.side * gs.span), 8, W - 8);
        gs.x1 = R.clamp(Math.round(px + gs.side * gs.span), 8, W - 8);
      } else gs.x = R.clamp(Math.round(px + gs.side * gs.off), 8, W - 8);
    }

    near(d, span) {
      return this.guests.filter((gs) => Math.abs(gs.d - d) < span);
    }

    // ---------------- the autopilot ----------------
    // Walking through (pathX(d), d) at time t: would anyone see or hear it? (With the autopilot's
    // margin of 0.06 rad and 0.6 px.)
    exposed(d, t, list) {
      const px = R.pathX(d);
      for (const gs of list) {
        const p = gs.pose(t);
        if (gs.sees(p, px, d, 0.06)) return true;
        if (p.ring > 0 && Math.hypot(px - p.x, d - p.d) < p.ring + 4) return true;
        // A false wake about to start counts as heard.
        if (p.wakeWarn && Math.hypot(px - p.x, d - p.d) < MG.RING + 4) return true;
      }
      return false;
    }
    // Is d a bad place for a box? Where someone who turns round will stare, or on a patroller's
    // walkway: sooner or later it gets found, whatever the timing.
    badSpot(d, list) {
      const px = R.pathX(d);
      for (const gs of list) if (gs.marks(px, d)) return true;
      return false;
    }
    // A box at d from time t: safe for good? (now: the box is already there, count the stare.)
    boxOK(d, t, list, now) {
      if (this.badSpot(d, list)) {
        if (!now) return false;
        // Already boxed there: fine only while no one is about to stare or walk into it.
        const px = R.pathX(d);
        for (const gs of list) {
          let sus = gs.sus;
          for (let k = 1; k <= 30; k++) {
            const p = gs.pose(t + k * 0.05);
            if (gs.trips(p, px, d, 4)) return false;
            if (gs.kind === 'turn') {
              sus = gs.sees(p, px, d) ? sus + 0.05 / MG.SUS : Math.max(0, sus - 0.05 / 0.8);
              if (sus > 0.85) return false;
            }
          }
        }
      }
      return true;
    }
    // Walk if some stretch of walking is safe and ends somewhere safe to box; else box, unless
    // staying here gets the box lifted and a short dash is safe.
    pilot() {
      const t = this.t;
      // Where the player is at time t if they walk this step (the move comes after the decision).
      const d = this.d + MG.SPEED * DT;
      const list = this.near(d, 170);
      // Walking for h seconds from now, checked from the very next step (the decision holds for
      // a few steps) and then every 1/30 s.
      const walkSafe = (h) => {
        for (const dt of [0, DT, 2 * DT, 3 * DT, 4 * DT]) if (this.exposed(d + MG.SPEED * dt, t + dt, list)) return false;
        for (let s = 1; s <= Math.ceil(h * 30); s++) {
          const dt = s / 30;
          if (this.exposed(d + MG.SPEED * dt, t + dt, list)) return false;
        }
        return true;
      };
      // Keep to a plan that still holds: walk on to where it said to stop.
      if (this.planEnd != null) {
        const h = (this.planEnd - d) / MG.SPEED;
        if (h > 0.05 && walkSafe(h)) return true;
        this.planEnd = null;
      }
      for (const h of [0.15, 0.34, 0.7, 1.1, 1.6, 2.2, 3.0, 4.0]) {
        if (!walkSafe(h)) break;
        if (this.boxOK(d + MG.SPEED * h, t + h, list, false)) {
          this.planEnd = d + MG.SPEED * h;
          return true;
        }
      }
      if (!this.boxOK(this.d, t, list, true) && walkSafe(0.2)) return true;
      return false;
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
      } else if (this.state === 'ready' || this.state === 'play') {
        if (this.auto) {
          this.thinkT -= DT;
          if (this.thinkT <= 0) {
            this.thinkT = 1 / 40;
            this.autoHold = this.state === 'ready' ? this.t > 0.6 : this.pilot();
          }
          held = this.autoHold;
        } else held = this.input;
        if (held !== this.held) this.inputs.push([this.step, held ? 1 : 0]);
      }
      if (this.state === 'caught' || this.state === 'dead') held = false;
      this.held = held;
      if (this.state === 'play' && this.auto) this.autoUntil = this.step + 1;

      if (this.state === 'ready' && held) {
        this.state = 'play';
        this.stateT = 0;
        this.emit({ type: 'start' });
      }
      if (this.state === 'play') this.play(held);
      else if (this.state === 'caught' && this.stateT >= MG.CAUGHT) {
        this.state = 'dead';
        this.stateT = 0;
        this.emit({ type: 'dead' });
      }
      for (const gs of this.guests) gs.closeT = Math.max(0, gs.closeT - DT);
      this.step++;
    }

    play(held) {
      // Box or walk.
      if (held && this.boxed) {
        this.boxed = false;
        this.emit({ type: 'unbox' });
      } else if (!held && !this.boxed) {
        this.boxed = true;
        this.stats.boxes++;
        this.emit({ type: 'box' });
      }
      this.walking = held;
      if (held) {
        this.d += MG.SPEED * DT;
        this.stats.walked += DT;
        this.stepT += DT;
        if (this.stepT >= 0.3) {
          this.stepT = 0;
          this.foot ^= 1;
          this.emit({ type: 'step', foot: this.foot });
        }
      }
      // New rooms ahead, old guests behind dropped.
      const room = Math.floor(this.d / MG.ROOM);
      if (room > this.room) {
        this.room = room;
        this.stats.rooms++;
        this.emit({ type: 'room', k: room, zone: R.ZONES[room % R.ZONES.length] });
      }
      if (!this.gen && this.rooms < this.room + 2) this.gen = this.roomGen(this.rooms++);
      if (this.gen && this.gen.next().done) this.gen = null;
      if (this.guests.length > 60) this.guests = this.guests.filter((gs) => gs.d > this.d - 160);
      if (this.decor.length > 200) this.decor = this.decor.filter((dc) => dc.d > this.d - 160);

      // Who sees what.
      const px = R.pathX(this.d);
      const pd = this.d;
      for (const gs of this.near(pd, 130)) {
        const p = gs.pose(this.t);
        if (p.warn && !gs.warned) this.emit({ type: 'turn', g: gs });
        gs.warned = p.warn;
        if (p.wakeWarn && !gs.waking) this.emit({ type: 'wake', g: gs });
        gs.waking = p.wakeWarn;
        if (p.wake && !gs.woke) this.emit({ type: 'ring', g: gs });
        gs.woke = p.wake;
        const seen = gs.sees(p, px, pd);
        if (this.walking) {
          gs.sus = Math.max(0, gs.sus - DT / 0.8);
          if (seen) {
            gs.spot += DT / MG.SPOT;
            if (gs.spot >= 1) return this.caught(gs, 'seen');
          } else {
            gs.spot = Math.max(0, gs.spot - DT / 0.15);
            if (gs.closeT <= 0 && gs.grazes(p, px, pd)) {
              gs.closeT = 2.5;
              this.stats.close++;
              this.emit({ type: 'close', g: gs });
            }
          }
          if (p.ring > 0 && Math.hypot(px - p.x, pd - p.d) < p.ring) return this.caught(gs, 'heard');
        } else {
          gs.spot = 0;
          if (gs.trips(p, px, pd)) return this.caught(gs, 'bump');
          if (gs.kind === 'turn' && seen) {
            // Turned round and staring at a box.
            gs.sus += DT / MG.SUS;
            if (gs.sus >= 0.3 && !gs.fooled) {
              gs.fooled = true;
              this.emit({ type: 'sus', g: gs });
            }
            if (gs.sus >= 1) return this.caught(gs, 'box');
          } else {
            gs.sus = Math.max(0, gs.sus - DT / 0.8);
            if (seen) gs.peak = 1;
            else if (gs.peak > 0) {
              // Looked right at the box and moved on.
              gs.peak = 0;
              gs.fooled = false;
              this.stats.fooled++;
              this.emit({ type: 'fooled', g: gs });
            }
          }
        }
      }
    }

    caught(gs, why) {
      this.state = 'caught';
      this.stateT = 0;
      this.catcher = gs;
      this.why = why;
      this.deathStep = this.step;
      this.walking = false;
      this.emit({ type: 'caught', g: gs, why });
    }
  }

  R.World = World;
  R.Guest = Guest;
})();
