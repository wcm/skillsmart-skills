// Flappy Roadster: how far the autopilot gets in each drive mode, and whether a replay built from
// seed + inputs ends exactly like the live run (the killcam depends on it); 0-60 gets its robot
// and timed taps instead.
//
//   node sim.mjs roadster                   → every game
//   node sim.mjs roadster tunnel            → one game: fly | kickflip | tunnel | launch
//   node sim.mjs roadster kickflip 20 150   → runs per drive mode, score cap
//
// Exits non-zero if a replay drifts from its live run.

import { load } from '../../stub.mjs';

const R = load(['engine/core', 'games/roadster/sim', 'games/roadster/art', 'games/roadster/zones', 'games/roadster/vehicles', 'games/roadster/mode-kickflip', 'games/roadster/mode-tunnel', 'games/roadster/mode-launch']);

const STEPS = 120 * 600; // ten minutes of game time, whatever the cap
const GAMES = {
  fly: { World: R.World, runs: 10, cap: 120, unit: '' },
  kickflip: { World: R.KickflipWorld, runs: 10, cap: 150, unit: '' },
  tunnel: { World: R.TunnelWorld, runs: 10, cap: 400, unit: ' m' },
};
const [only, runsArg, capArg] = process.argv.slice(2);
if (only && !GAMES[only] && only !== 'launch') throw new Error(`unknown game "${only}": fly | kickflip | tunnel | launch`);

function run(w, cap) {
  for (let n = 0; n < STEPS && w.state !== 'dead' && w.score < cap; n++) {
    w.update();
    w.events.length = 0;
  }
  return w;
}

for (const [name, g] of Object.entries(GAMES)) {
  if (only && only !== name) continue;
  const runs = +runsArg || g.runs;
  const cap = +capArg || g.cap;
  console.log(`${name.toUpperCase()}: autopilot, ${runs} seeds per mode, cap ${cap}${g.unit}`);
  for (const mode of R.MODES) {
    const deaths = [];
    for (let s = 1; s <= runs; s++) {
      const w = run(new g.World({ seed: s * 7717, mode, auto: true, state: 'ready' }), cap);
      if (w.state === 'dead') deaths.push(`${w.score}:${w.deathKind}${w.victim ? '/' + w.victim : ''}`);
    }
    console.log(`  ${mode.name.padEnd(9)} ${runs - deaths.length}/${runs} reached ${cap}${g.unit}${deaths.length ? '  died at ' + deaths.join(' ') : ''}`);
  }
  // Replay check: the autopilot drives, a "player" takes over after 8 s and taps every
  // half second (releasing between, for kickflip's held jumps), then the run is rebuilt from
  // its seed and inputs alone.
  const mode = R.MODES[1];
  const live = new g.World({ seed: 999, mode, auto: true, state: 'ready' });
  for (let n = 0; n < STEPS && live.state !== 'dead'; n++) {
    live.update();
    live.events.length = 0;
    if (live.state === 'play' && live.step >= 960 && live.step % 61 === 0) live.tap();
    if (live.step % 61 === 10) live.release && live.release();
  }
  const rep = run(new g.World({ seed: 999, mode, replay: { inputs: live.inputs.slice(), autoUntil: live.autoUntil } }), Infinity);
  const a = [live.state, live.score, live.deathStep, live.car.y];
  const b = [rep.state, rep.score, rep.deathStep, rep.car.y];
  const same = a.every((v, i) => v === b[i]);
  console.log(`  replay ${same ? 'matches' : 'DRIFTS'}: live ${a.join(' ')} · replay ${b.join(' ')} · ${live.inputs.length} inputs`);
  if (!same) process.exitCode = 1;
}

if (!only || only === 'launch') {
  console.log('0-60: the FSF robot over 200 seeds, then taps at set times after green');
  const tally = {};
  for (let s = 1; s <= 200; s++) {
    const w = new R.LaunchWorld({ seed: s * 31, mode: R.MODES[s % 4], auto: true, state: 'ready' });
    for (let n = 0; n < 120 * 8 && !w.car.resting; n++) {
      w.update();
      w.events.length = 0;
    }
    const r = w.result;
    const key = !r ? 'no result' : r.foul ? `foul (${r.kind})` : r.rating.name;
    tally[key] = (tally[key] || 0) + 1;
  }
  console.log('  robot:', Object.entries(tally).map(([k, v]) => `${k} ×${v}`).join(', '));
  // Fake clock: each step is 1/120 s, and green "shows" 4 ms after the step that lit it.
  for (const after of [-0.3, 0, 0.005, 0.12, 0.2, 0.31, 0.6, 9]) {
    const w = new R.LaunchWorld({ seed: 5, mode: R.MODES[1], state: 'ready' });
    let clock = 0;
    let tapped = false;
    for (let n = 0; n < 120 * 12 && !w.car.resting; n++) {
      clock += 1000 / 120;
      w.update();
      if (w.events.some((e) => e.type === 'green')) w.greenShownAt = clock + 4;
      w.events.length = 0;
      if (w.state === 'play' && !tapped && w.stateT >= w.greenT + after) {
        tapped = true;
        w.tap(clock);
      }
    }
    const r = w.result;
    console.log(`  tap ${String(after).padStart(5)} s after green → ${r.foul ? `red light, ${r.rt.toFixed(3)} s` : `${r.rt.toFixed(3)} s ${r.rating.name}${r.asleep ? ' (asleep)' : ''}`}`);
  }
}
