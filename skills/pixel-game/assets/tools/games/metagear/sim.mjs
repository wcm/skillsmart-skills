// Meta Gear Solid: how far the autopilot (GHOST MODE) sneaks on each seed, what catches it, and
// the POV footage: a run where a player takes over from the autopilot, rebuilt from its seed and
// inputs alone.
//
//   node sim.mjs metagear          → 12 seeds, cap 600 m
//   node sim.mjs metagear 30 1000  → seeds, cap in metres
//
// Exits non-zero if a replay drifts from its live run.

import { load } from '../../stub.mjs';

const R = load(['engine/core', 'games/metagear/sim']);
const [runsArg, capArg] = process.argv.slice(2);
const RUNS = +runsArg || 12;
const CAP = +capArg || 600;
const LIMIT = 120 * 60 * 30; // half an hour of game time

// To the cap, a capture, or 30 s without a step forward (stuck behind someone forever).
function run(w, cap) {
  let lastD = -1;
  let lastT = 0;
  w.longest = 0;
  while (w.state !== 'dead' && w.step < LIMIT && w.score < cap) {
    w.update();
    if (w.d > lastD) {
      w.longest = Math.max(w.longest, w.t - lastT);
      lastD = w.d;
      lastT = w.t;
    } else if (w.state === 'play' && w.t - lastT > 30) {
      w.stuck = true;
      break;
    }
  }
  return w;
}

console.log(`META GEAR SOLID: ghost mode on ${RUNS} seeds, cap ${CAP} m`);
const caught = [];
const stuck = [];
let secs = 0;
let made = 0;
let longest = 0;
const t0 = Date.now();
for (let s = 1; s <= RUNS; s++) {
  const w = run(new R.World({ seed: s * 7919, auto: true }), CAP);
  secs += w.t;
  longest = Math.max(longest, w.longest);
  if (w.state === 'dead' || w.state === 'caught') caught.push(`${w.score} m ${w.why} by ${w.catcher.kind} (seed ${s}, room ${w.catcher.room})`);
  else if (w.stuck) stuck.push(`${w.score} m (seed ${s})`);
  else made++;
}
console.log(`  ${made}/${RUNS} reached ${CAP} m · ${(secs / RUNS / 60).toFixed(1)} min a run · longest wait ${longest.toFixed(1)} s · ${((Date.now() - t0) / RUNS).toFixed(0)} ms per run to simulate`);
if (caught.length) console.log('  caught: ' + caught.join(' · '));
if (stuck.length) console.log('  stuck: ' + stuck.join(' · '));

// A person: sees only what's on screen now and reacts a beat late. Walks while nothing covers
// the next stretch of path, waits out turners facing this way, and doesn't stop on the marked
// spots (walkways, a turner's gaze) if they can help it.
function person(w, react, look) {
  const queue = [];
  let want = false;
  return () => {
    const d = w.d;
    const list = w.near(d, 170);
    let go = true;
    for (const gs of list) {
      const p = gs.pose(w.t);
      for (let a = 0; a <= look; a += 4) if (gs.sees(p, R.pathX(d + a), d + a)) go = false;
      if (p.wakeWarn || p.wake) if (Math.hypot(R.pathX(d) - p.x, d - p.d) < R.MG.RING + 12) go = false;
      if (gs.kind === 'turn' && gs.d > d - 10 && gs.d - d < 90 && (p.warn || Math.abs(p.a - gs.awayA) > 0.1)) go = false;
    }
    // Never stop on a walkway or in a starer's marked gaze: keep going if the way is clear.
    if (!go && w.badSpot(d, list)) {
      let clear = true;
      for (const gs of list) if (gs.sees(gs.pose(w.t), R.pathX(d + 2), d + 2)) clear = false;
      if (clear) go = true;
    }
    queue.push([w.t + react, go]);
    while (queue.length && queue[0][0] <= w.t) want = queue.shift()[1];
    return want;
  };
}
console.log('  people (react · look ahead): distance reached on 30 seeds');
for (const [name, react, look] of [['careful', 0.25, 20], ['casual', 0.3, 12], ['rushed', 0.3, 4]]) {
  const got = [];
  let stalls = 0;
  for (let s = 1; s <= 30; s++) {
    const w = new R.World({ seed: s * 104729 });
    const bot = person(w, react, look);
    let lastD = 0;
    let lastT = 0;
    while (w.state !== 'dead' && w.step < LIMIT && w.score < 2000) {
      w.input = bot();
      w.update();
      if (w.d > lastD) {
        lastD = w.d;
        lastT = w.t;
      } else if (w.t - lastT > 40) break; // a person would have found a gap by now
    }
    if (w.state !== 'dead' && w.score < 2000) stalls++;
    got.push(w.score);
  }
  got.sort((a, b) => a - b);
  const med = got[15];
  console.log(`    ${name.padEnd(8)} median ${med} m · worst ${got[0]} m · best ${got[29]} m · ${got.filter((m) => m < 40).length} runs under 40 m · ${stalls} stalled`);
}

// The replay: the autopilot sneaks for 20 s, then a "player" holds and lets go on a rhythm.
{
  const live = new R.World({ seed: 31337, auto: true });
  while (live.state !== 'dead' && live.step < LIMIT) {
    if (live.step === 2400) live.takeOver();
    if (!live.auto) live.input = live.step % 150 < 80;
    live.update();
  }
  const rep = run(new R.World({ seed: 31337, replay: { inputs: live.inputs.slice(), autoUntil: live.autoUntil } }), Infinity);
  const a = [live.state, live.score, live.deathStep, live.why, live.catcher && live.catcher.id, live.d.toFixed(3)];
  const b = [rep.state, rep.score, rep.deathStep, rep.why, rep.catcher && rep.catcher.id, rep.d.toFixed(3)];
  const same = a.join() === b.join();
  console.log(`  replay ${same ? 'matches' : 'DRIFTS'}: live ${a.join(' ')} · replay ${b.join(' ')} · ${live.inputs.length} inputs, takeover at ${live.autoUntil}`);
  if (!same) process.exitCode = 1;
}
