// The front page's thumbnails: one frame of each game at 432×768, saved to ../thumbs/<game>.png.
// The moment is the thumb() each game's tools/games/<game>/screens.mjs exports.
//
//   node thumbs.mjs            → every game
//   node thumbs.mjs kombat     → just those named

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, PAGES, gameTools, needGame, open } from './lib.mjs';

const dir = join(ROOT, 'thumbs');
await mkdir(dir, { recursive: true });
const only = process.argv.slice(2);
only.forEach(needGame);
for (const game of Object.keys(PAGES)) {
  if (only.length && !only.includes(game)) continue;
  const file = join(gameTools(game), 'screens.mjs');
  const mod = existsSync(file) ? await import(pathToFileURL(file)) : {};
  if (!mod.thumb) {
    console.log(`${game.padEnd(9)} no thumb() in tools/games/${game}/screens.mjs`);
    continue;
  }
  const g = await open(game, { width: 216, height: 384, scale: 2 });
  await mod.thumb(g);
  await g.page.evaluate(() => {
    document.querySelectorAll('.side').forEach((el) => (el.style.display = 'none'));
    document.getElementById('app').style.padding = '0';
    window.dispatchEvent(new Event('resize'));
  });
  await g.tick(2);
  await g.shot(join(dir, `${game}.png`));
  console.log(`${game.padEnd(9)} → thumbs/${game}.png${g.errors.length ? '  ' + g.errors.join(' | ') : ''}`);
  await g.close();
}
