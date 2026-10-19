// Pixel Hop: does the autopilot get through (it plans with the real physics, so it should clear
// everything), how do players who react late do, and does a replay built from the seed and the
// inputs end exactly like the live run (the replay depends on it)?
//
//   node sim.mjs hop           → 20 autopilot runs to 120, 40 runs per kind of player
//   node sim.mjs hop 50 200    → runs, score cap
//
// Exits non-zero if a replay drifts from its live run.

import { load } from '../../stub.mjs';

const R = load(['engine/core', 'games/hop/sim']);
const HOP = R.HOP;
const RUNS = +process.argv[2] || 20;
const CAP = +process.argv[3] || 120;
const LIMIT = 120 * 60 * 10; // ten minutes of game time

function run(w, cap, drive) {
  while (w.state !== 'dead' && w.score < cap && w.step < LIMIT) {
    if (drive) w.input = drive(w);
    w.update();
  }
  return w;
}

// The autopilot on RUNS seeds.
let made = 0;
let ms = 0;
const deaths = [];
const closes = [];
for (let s = 1; s <= RUNS; s++) {
  const t0 = performance.now();
  const w = run(new R.World({ seed: s * 7919, auto: true }), CAP);
  ms += performance.now() - t0;
  if (w.score >= CAP) made++;
  else deaths.push(`${w.score}:${w.hit && w.hit.kind}`);
  closes.push(w.stats.close);
}
console.log(`PIXEL HOP: autopilot on ${RUNS} seeds, cap ${CAP}`);
console.log(`  ${made}/${RUNS} reached ${CAP}${deaths.length ? '  died at ' + deaths.join(' ') : ''} · ${(closes.reduce((a, b) => a + b, 0) / RUNS).toFixed(1)} close calls a run · ${(ms / RUNS).toFixed(0)} ms a run to simulate`);

// Players who time each jump by eye: they aim to press `aim` seconds before reaching the obstacle,
// off by a random amount up to `miss`, and hold for up to `hold` seconds (longer for coins).
function person(aim, miss, hold, seed) {
  const rnd = R.rng(seed);
  let at = null;
  let left = 0;
  return (w) => {
    if (w.state === 'ready') return w.t > 0.5;
    if (left > 0) return left-- > 0;
    const ob = w.obs.find((o) => !o.scored && o.x + o.w >= w.dist + HOP.X);
    if (!ob || !w.ground) return false;
    if (at !== ob) {
      at = ob;
      at.aim = aim + (rnd() * 2 - 1) * miss;
    }
    const eta = (ob.x - (w.dist + HOP.X + HOP.HW - HOP.INSET)) / w.speed;
    if (eta > at.aim) return false;
    at = null;
    left = Math.round((hold * rnd()) / R.DT);
    return true;
  };
}
for (const [name, aim, miss, hold] of [['sharp', 0.17, 0.06, 0.2], ['casual', 0.17, 0.11, 0.15], ['sloppy', 0.15, 0.16, 0.25]]) {
  const scores = [];
  for (let s = 1; s <= 40; s++) scores.push(run(new R.World({ seed: s * 104729 }), 300, person(aim, miss, hold, s)).score);
  scores.sort((a, b) => a - b);
  console.log(`  ${name.padEnd(7)} median ${scores[20]} · worst ${scores[0]} · best ${scores[39]}`);
}

// The replay: a run the autopilot starts and a player takes over, rebuilt from seed + inputs.
const live = new R.World({ seed: 424242, auto: true });
const p = person(0.17, 0.08, 0.2, 9);
while (live.state !== 'dead' && live.step < LIMIT) {
  if (live.step === 1200) live.takeOver();
  if (!live.auto) live.input = p(live);
  live.update();
}
const rep = run(new R.World({ seed: 424242, replay: { inputs: live.inputs } }), 1e9);
const sig = (w) => `${w.state} ${w.score} ${w.coinCount} ${w.deathStep} ${w.dist.toFixed(3)}`;
const same = sig(live) === sig(rep);
console.log(`  replay ${same ? 'matches' : 'DRIFTS'}: live ${sig(live)} · replay ${sig(rep)} · ${live.inputs.length} inputs, takeover at 1200`);
if (!same) process.exitCode = 1;
