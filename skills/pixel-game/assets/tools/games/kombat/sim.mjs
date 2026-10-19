// Model Kombat: is the fight fair? CPU vs CPU at every level (Sam and Dario should split about
// 50/50), three bots that play like people (a button masher, a casual player, and a player who
// blocks, zones and uses the super) against each level, and the K.O. replay: a round where a player takes over
// from the CPU, rebuilt from its seed, inputs and takeover step alone.
//
//   node sim.mjs kombat        → 200 rounds per level
//   node sim.mjs kombat 50     → rounds per level
//
// Exits non-zero if a replay drifts from its live round.

import { load } from '../../stub.mjs';

const R = load(['engine/core', 'games/kombat/fight']);
const IN = R.IN;
const N = +process.argv[2] || 200;
const LIMIT = 120 * 90;

// One round to the end; bots[side] drives that side, if any. Returns the round.
function fight(seed, ids, level, bots) {
  const r = new R.Round({ seed, ids, cpu: [!bots[0], !bots[1]], level, wins: [1, 1] });
  while (r.state !== 'done' && r.step < LIMIT) {
    bots.forEach((b, side) => b && r.input(side, b(r, side)));
    r.update();
    r.events.length = 0;
  }
  return r;
}

// A bot with a person's habits. It re-thinks every `react` seconds, holds a direction between
// and presses on the step it decides.
function person(prof, seed) {
  const rnd = R.rng(seed);
  let t = 0;
  let hold = 0;
  return (r, side) => {
    const f = r.f[side];
    const o = f.foe;
    t -= R.DT;
    if (t > 0) return hold;
    t = prof.react * (0.8 + rnd() * 0.4);
    hold = 0;
    if (r.state === 'finish') return r.winner === side ? IN.S : 0;
    const toward = o.x > f.x ? IN.R : IN.L;
    const away = toward === IN.R ? IN.L : IN.R;
    const dist = Math.abs(o.x - f.x);
    const swing = o.state === 'attack' && o.move !== 'throw' && dist < 52;
    const incoming = r.proj.some((p) => p.alive && p.side !== side && Math.abs(p.x - f.x) < 80);
    if ((swing || incoming) && rnd() < prof.block) return (hold = away);
    if (f.meter >= 100 && rnd() < prof.super) return IN.S;
    if (dist > 60) {
      if (f.cool <= 0 && rnd() < prof.zone) return IN.S;
      if (rnd() < 0.08) return IN.U | toward;
      return (hold = toward);
    }
    if (dist > 32) {
      hold = toward;
      return rnd() < 0.3 ? hold | IN.Kk : hold;
    }
    return rnd() < 0.65 ? IN.P : IN.Kk;
  };
}
const PEOPLE = {
  masher: { react: 0.16, block: 0, zone: 0.05, super: 0.3 },
  casual: { react: 0.28, block: 0.25, zone: 0.15, super: 0.6 },
  player: { react: 0.2, block: 0.5, zone: 0.3, super: 0.9 },
};

console.log(`MODEL KOMBAT: ${N} rounds per level`);
for (let lv = 0; lv < R.LEVELS.length; lv++) {
  const tally = { sam: 0, dario: 0, draw: 0 };
  let secs = 0;
  let timeups = 0;
  for (let s = 1; s <= N; s++) {
    const r = fight(s * 101, s % 2 ? ['sam', 'dario'] : ['dario', 'sam'], lv, [null, null]);
    tally[r.winner < 0 ? 'draw' : r.f[r.winner].id]++;
    secs += r.step / 120;
    if (r.koStep < 0) timeups++;
  }
  const line = [`  ${R.LEVELS[lv].name.padEnd(6)} cpu vs cpu: sam ${pct(tally.sam)} · dario ${pct(tally.dario)} · ${(secs / N).toFixed(0)} s a round, ${timeups} on time`];
  for (const [name, prof] of Object.entries(PEOPLE)) {
    let won = 0;
    for (let s = 1; s <= N; s++) {
      const r = fight(s * 977, s % 2 ? ['sam', 'dario'] : ['dario', 'sam'], lv, [person(prof, s), null]);
      if (r.winner === 0) won++;
    }
    line.push(`${name} wins ${pct(won)}`);
  }
  console.log(line.join(' · '));
}
function pct(n) {
  return `${Math.round((n / N) * 100)}%`.padStart(4);
}

// The replay: CPU vs CPU, then the player bot takes over side 0 after 8 s.
{
  const ids = ['dario', 'sam'];
  const bot = person(PEOPLE.player, 5);
  const live = new R.Round({ seed: 4242, ids, cpu: [true, true], level: 2, wins: [1, 0] });
  while (live.state !== 'done' && live.step < LIMIT) {
    if (live.step === 960) live.takeOver(0);
    if (!live.f[0].cpu) live.input(0, bot(live, 0));
    live.update();
    live.events.length = 0;
  }
  const rep = new R.Round({ seed: 4242, ids, cpu: [true, true], level: 2, wins: [1, 0], replay: live.inputs.slice(), cpuUntil: live.f.map((f) => f.cpuUntil) });
  while (rep.step < live.step) {
    rep.update();
    rep.events.length = 0;
  }
  const a = [live.state, live.step, live.winner, live.koStep, live.doneStep, live.f[0].hp, live.f[1].hp, live.f[0].x.toFixed(3), live.f[1].x.toFixed(3)];
  const b = [rep.state, rep.step, rep.winner, rep.koStep, rep.doneStep, rep.f[0].hp, rep.f[1].hp, rep.f[0].x.toFixed(3), rep.f[1].x.toFixed(3)];
  const same = a.join() === b.join();
  console.log(`  replay ${same ? 'matches' : 'DRIFTS'}: live ${a.join(' ')} · replay ${b.join(' ')} · ${live.inputs.length} inputs, takeover at ${live.f[0].cpuUntil}`);
  if (!same) process.exitCode = 1;
}
