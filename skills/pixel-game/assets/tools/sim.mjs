// Headless checks of the deterministic game worlds, no browser or install needed: each game's
// tools/games/<game>/sim.mjs runs in its own process (every game loads its own window.R).
//
//   node sim.mjs                     → every game
//   node sim.mjs kombat [args]       → one game, its own args (see tools/games/<game>/sim.mjs)
//
// Exits non-zero if any game's check fails (a replay drifting from its live run).

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PAGES, gameTools, needGame } from './paths.mjs';

const [game, ...args] = process.argv.slice(2);
if (game) needGame(game);
let failed = false;
for (const name of game ? [game] : Object.keys(PAGES)) {
  const file = join(gameTools(name), 'sim.mjs');
  if (!existsSync(file)) {
    console.log(`${name}: no tools/games/${name}/sim.mjs yet`);
    continue;
  }
  const run = spawnSync(process.execPath, [file, ...args], { stdio: 'inherit' });
  if (run.status !== 0) failed = true;
}
if (failed) process.exitCode = 1;
