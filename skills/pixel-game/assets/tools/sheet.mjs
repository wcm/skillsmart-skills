// Render a game's sprite-sheet page (tools/games/<game>/sheet.html) to out/<game>-sheet.png.
//   node sheet.mjs kombat
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { OUT, PAGES, gameTools, launch, needGame, serve } from './lib.mjs';

const game = needGame(process.argv[2] || Object.keys(PAGES)[0]);
if (!existsSync(join(gameTools(game), 'sheet.html'))) throw new Error(`no sprite sheet for "${game}": write tools/games/${game}/sheet.html`);
await mkdir(OUT, { recursive: true });
const server = await serve();
const browser = await launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${server.url}tools/games/${game}/sheet.html`);
await page.waitForFunction(() => window.done, null, { timeout: 10000 }).catch(() => {});
await page.locator('canvas').screenshot({ path: join(OUT, `${game}-sheet.png`) });
console.log(errors.length ? errors.join('\n') : `out/${game}-sheet.png`);
await browser.close();
server.close();
