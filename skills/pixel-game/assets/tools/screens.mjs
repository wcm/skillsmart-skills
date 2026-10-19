// Screenshots of a game from start to finish, for eyeballing a change. Each game's flow is
// tools/games/<game>/screens.mjs: it plays the page on the manual clock and names each moment.
//
//   node screens.mjs kombat              → out/screens/kombat-<moment>.png
//   node screens.mjs roadster fly        → anything after the game goes to its flow

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { OUT, PAGES, gameTools, needGame, open } from './lib.mjs';

const [game = Object.keys(PAGES)[0], ...args] = process.argv.slice(2);
needGame(game);
const file = join(gameTools(game), 'screens.mjs');
if (!existsSync(file)) throw new Error(`no screenshot flow for "${game}" yet: write tools/games/${game}/screens.mjs`);
const { default: flow } = await import(pathToFileURL(file));
const dir = join(OUT, 'screens');
await mkdir(dir, { recursive: true });
const g = await open(game);
const shot = (name) => g.shot(join(dir, `${game}-${name}.png`));
const shareCard = (name) => g.download(() => __fr.press('share'), join(dir, `${game}-${name}-share.png`));
await flow({ g, shot, shareCard, args });
console.log(`screens in ${dir}`);
console.log(g.errors.length ? g.errors.join('\n') : 'no page errors');
await g.close();
