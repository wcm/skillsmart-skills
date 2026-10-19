// Shared by the browser scripts: a static server for the game folder, and one of its pages
// opened in headless Chromium with the manual clock on (__fr, see engine/app.js), so every frame
// is exact.

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { chromium } from 'playwright';
import { ROOT, OUT, PAGES, needGame } from './paths.mjs';

export { ROOT, OUT, PAGES, TOOLS, gameTools, needGame } from './paths.mjs';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

export function serve() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
    const file = join(ROOT, path || 'index.html');
    if (file !== ROOT && !file.startsWith(ROOT + sep)) return res.writeHead(403).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() })));
}

// A headless browser: Playwright's own Chromium if it's installed (npx playwright install
// chromium), else the Google Chrome or Microsoft Edge already on the computer.
export async function launch(opts = {}) {
  for (const o of [{}, { channel: 'chrome' }, { channel: 'msedge' }]) {
    try {
      return await chromium.launch({ ...opts, ...o });
    } catch {
      /* try the next one */
    }
  }
  throw new Error('no browser to run in: install Google Chrome, or run `npx playwright install chromium` in tools/');
}

// game: a key of PAGES. width × height is the CSS viewport; scale is the device pixel ratio.
export async function open(game, { width = 390, height = 844, scale = 2 } = {}) {
  needGame(game);
  await mkdir(OUT, { recursive: true });
  const server = await serve();
  const browser = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, acceptDownloads: true });
  const p = await context.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.goto(server.url + PAGES[game], { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__fr);
  await p.evaluate(() => {
    localStorage.clear();
    __fr.manual(true);
  });
  const g = {
    page: p,
    errors,
    ev: (fn, arg) => p.evaluate(fn, arg),
    tick: (n = 1, dt = 1 / 60) => p.evaluate(([n, dt]) => __fr.tick(dt, n), [n, dt]),
    shot: (file) => p.locator('#game').screenshot({ path: file }),
    // Tick one frame at a time until test() (async or not) is true; false if it never was.
    async until(test, max = 1500) {
      for (let i = 0; i < max; i++) {
        await g.tick();
        if (await test()) return true;
      }
      return false;
    },
    // Run fn in the page (a button press that saves a file) and keep the download as file.
    async download(fn, file) {
      const dl = p.waitForEvent('download', { timeout: 8000 }).catch(() => null);
      await g.ev(fn);
      const d = await dl;
      if (d) await d.saveAs(file);
      return !!d;
    },
    async close() {
      await browser.close();
      server.close();
    },
  };
  return g;
}
