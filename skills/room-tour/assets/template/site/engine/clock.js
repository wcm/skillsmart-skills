// The engine clock (design-system.md 5.1). Every timed animation reads `clock.now()`; nothing uses CSS transitions or
// setTimeout, so ?record can step time exactly. In normal mode now() follows performance.now(); in record mode the
// engine sets it from the frame number.
//
//   const f = new Fade(clock);     // a value 0–1 (or any range) that moves on the clock
//   f.to(1, 300, "out", 60);       // target, ms, easing name, delay ms; no-op while already heading there
//   f.value                        // where it is now
//
// A Fade is a pure function of the clock and the moment it was last retargeted, so replaying the same steps gives the
// same values (record mode relies on that).

import { clamp, ease } from "./util.js";

export class Clock {
  constructor({ record = false } = {}) {
    this.record = record;
    this.t = 0;          // ms
    this.dt = 0;         // ms since the previous step
    this.instant = false; // seek(): every fade lands at once
    this.busyUntil = 0;   // the latest end of any running fade (the engine keeps painting until then)
    this.origin = performance.now();
  }
  now() { return this.t; }
  seconds() { return this.t / 1000; }
  /** normal mode: follow the real clock */
  tick() { const t = performance.now() - this.origin; this.dt = Math.max(0, t - this.t); this.t = t; return this.t; }
  /** record mode: jump to a time (ms) */
  set(ms) { this.dt = ms - this.t; this.t = ms; }
  /** record mode: move on by dt ms */
  step(dt) { this.set(this.t + dt); }
  get busy() { return this.t < this.busyUntil; }
  /** keep the engine painting for the next `ms` (a component's own timed animation) */
  hold(ms) { this.busyUntil = Math.max(this.busyUntil, this.t + ms); }
  reset() { this.t = 0; this.dt = 0; this.busyUntil = 0; }
}

export class Fade {
  constructor(clock, v = 0) {
    this.clock = clock;
    this.v0 = v; this.target = v; this.t0 = -1e9; this.ms = 0; this.ease = ease.linear; this.name = "linear";
  }
  get value() {
    const k = this.ms <= 0 ? 1 : clamp((this.clock.now() - this.t0) / this.ms);
    return this.v0 + (this.target - this.v0) * this.ease(k);
  }
  /** 0–1 of the current run (1 when settled) */
  get progress() { return this.ms <= 0 ? 1 : clamp((this.clock.now() - this.t0) / this.ms); }
  get done() { return this.progress >= 1; }
  to(target, ms = 300, easeName = "out", delay = 0) {
    if (target === this.target && (this.ms > 0 || this.v0 === target)) return this;
    const from = this.value;
    if (this.clock.instant || ms <= 0) return this.snap(target);
    // a run that starts part-way covers the rest of the way in proportionally less time (never under 30 %)
    const part = Math.abs(this.target - this.v0) > 1e-6 ? clamp(Math.abs(target - from) / Math.abs(this.target - this.v0), 0.3, 1) : 1;
    this.v0 = from; this.target = target; this.ms = ms * part; this.t0 = this.clock.now() + delay;
    this.ease = ease[easeName] ?? ease.linear; this.name = easeName;
    this.clock.busyUntil = Math.max(this.clock.busyUntil, this.t0 + this.ms + 34);
    return this;
  }
  snap(v) { this.v0 = v; this.target = v; this.ms = 0; this.t0 = this.clock.now(); return this; }
  /** finish the current run now */
  settle() { return this.snap(this.target); }
}

/**
 * An entrance that plays forward when `on` turns true and its exit when it turns false (captions, counters): the time
 * of the last switch is all it keeps. `in(ms)` and `out(ms)` give 0–1 progress of each phase.
 */
export class Switch {
  constructor(clock, on = false) { this.clock = clock; this.on = on; this.t = -1e9; this.from = on ? 1 : 0; }
  set(on) {
    if (on === this.on) return false;
    // the exit starts from wherever the entrance had got to (and the other way round)
    this.from = this.level;
    this.on = on;
    this.t = this.clock.instant ? -1e9 : this.clock.now();
    if (!this.clock.instant) this.clock.hold(1600);
    return true;
  }
  /** ms since the last switch */
  get age() { return this.clock.now() - this.t; }
  /** a rough 0–1 "how visible" used when the switch flips mid-run */
  get level() { return this.on ? clamp(this.age / 900) : this.from * (1 - clamp(this.age / 300)); }
  settle() { this.t = -1e9; }
}
