// A headless Chrome for shot.mjs, check.mjs and video.mjs, and a static server for the site. The first run installs
// playwright-core once into a cache folder (never into the project) and drives your installed Chrome or Edge, on the
// graphics card where it can (the pages are WebGL).
import http from "node:http";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { extname, join, normalize } from "node:path";
import { SITE } from "./common.mjs";

function playwright() {
  const dir = (n) => platform() === "darwin" ? join(homedir(), "Library/Caches", n)
    : platform() === "win32" ? join(process.env.LOCALAPPDATA || homedir(), n) : join(homedir(), ".cache", n);
  const caches = [process.env.ZOOM_HERO_CHECK_CACHE, ...["zoom-hero-check", "scroll-gallery-check", "exploded-check", "puff-check", "linework-check"].map(dir)].filter(Boolean);
  let cache = caches.find((c) => existsSync(join(c, "node_modules/playwright-core")));
  if (!cache) {
    cache = caches[0];
    mkdirSync(cache, { recursive: true });
    console.log(`installing playwright-core into ${cache} (once)…`);
    try { execFileSync("npm", ["install", "--silent", "--no-audit", "--no-fund", "--prefix", cache, "playwright-core@1.47.2"], { stdio: "inherit", shell: platform() === "win32" }); }
    catch { return null; }
  }
  return createRequire(join(cache, "index.js"))("playwright-core");
}

// the browser, or null (the caller says what to do)
export async function launch() {
  const pw = playwright();
  if (!pw) { console.error("could not install playwright-core (needs npm and the network once)"); return null; }
  const args = ["--hide-scrollbars", "--force-color-profile=srgb", "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
    "--enable-gpu", "--ignore-gpu-blocklist", ...(platform() === "darwin" ? ["--use-angle=metal"] : [])];
  for (const o of [{ channel: "chrome" }, { channel: "msedge" }, {}]) {
    try { return await pw.chromium.launch({ headless: true, args, ...o }); } catch {}
  }
  console.error("no Chrome found: install Google Chrome, or run: npx playwright install chromium");
  return null;
}

// site/ on a free port
export function serve(root = SITE) {
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
    ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
  const server = http.createServer((req, res) => {
    const p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
    let f = join(root, p);
    if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!existsSync(f)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream", "cache-control": "no-store" }).end(readFileSync(f));
  }).listen(0);
  return { url: (id) => `http://localhost:${server.address().port}/${id}/`, close: () => server.close() };
}

// a page opened in record mode (its clock moves only on lp.tick) and showing, errors collected into `errors`
export async function open(browser, url, opts, errors = []) {
  const ctx = await browser.newContext(opts), page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.location()?.url ?? "")) errors.push(m.text()); });
  page.on("requestfailed", (r) => errors.push(`${r.failure()?.errorText || "failed"}: ${r.url()}`));
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().endsWith("favicon.ico")) errors.push(`${r.status()}: ${r.url()}`); });
  await page.goto(`${url}?record`, { waitUntil: "load", timeout: 60000 }).catch((e) => errors.push(`opening the page: ${e.message.split("\n")[0]}`));
  const ok = await page.waitForFunction(() => window.lp && document.querySelector("canvas.ready"), null, { timeout: 30000 }).then(() => true, () => false);
  if (!ok) errors.push("the engine never showed the page (window.lp)");
  await Promise.race([page.evaluate(() => document.fonts.ready), new Promise((r) => setTimeout(r, 8000))]).catch(() => {});
  return { ctx, page, ok };
}

// a few frames per call, so promises in the page (a tour's next step) can run between them, as in a real recording
export async function tick(page, n, fps = 60) {
  for (let i = 0; i < n; i += 4) await page.evaluate(([k, dt]) => { for (let j = 0; j < k; j++) lp.tick(dt); }, [Math.min(4, n - i), 1 / fps]);
}

// runs the clock until the move is over, then lets the words and spots fade in
export async function settle(page) {
  for (let i = 0; i < 2000; i++) {
    const moving = await page.evaluate(() => { for (let j = 0; j < 6; j++) lp.tick(1 / 60); return lp.state.moving; });
    if (!moving) break;
  }
  await new Promise((r) => setTimeout(r, 1000));
}

export async function go(page, level) {
  await page.evaluate((l) => { window.__move = lp.go(l); }, level);
  await page.waitForFunction(() => lp.state.moving, null, { timeout: 20000 }).catch(() => {});
  await settle(page);
}

// close without hanging on a stuck GPU process
export const finish = async (browser, site) => {
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 6000))]);
  site.close();
};
