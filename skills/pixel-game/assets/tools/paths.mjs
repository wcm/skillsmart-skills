// Where things are, for every script here; nothing in this file needs an npm install.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOOLS = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(TOOLS, '..');
export const OUT = join(TOOLS, 'out');
// The pages, by game: every page in the folder above that loads games/<game>/main.js.
// { roadster: 'flappy-roadster.html', kombat: 'model-kombat.html', … }
export const PAGES = Object.fromEntries(
  readdirSync(ROOT)
    .filter((f) => f.endsWith('.html'))
    .sort()
    .flatMap((f) => {
      const m = readFileSync(join(ROOT, f), 'utf8').match(/games\/([a-z0-9-]+)\/main\.js/);
      return m ? [[m[1], f]] : [];
    })
);
// A game's own tools: tools/games/<game>/ (sim.mjs, screens.mjs, demo.mjs, sheet.html).
export const gameTools = (game) => join(TOOLS, 'games', game);
export function needGame(game) {
  if (!PAGES[game]) throw new Error(`unknown game "${game}": ${Object.keys(PAGES).join(' | ') || 'no pages load games/<game>/main.js'}`);
  return game;
}
