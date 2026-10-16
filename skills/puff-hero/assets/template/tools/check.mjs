// Checks the page in a headless Chrome, the way a visitor uses it, and writes a contact sheet (rest · hovered · phone).
//
//   node check.mjs                          serves ../site itself
//   node check.mjs --site ../site --out out/check.png
//
//   console   no errors
//   loaded    the letters' first frame and loop load
//   lean      with the cursor at the right edge, the letters turn toward it
//   pop       when the cursor reaches the letters they swell (≥ 4%) and rebound
//   loop      the loop plays while the cursor is on the letters
//   finish    after the cursor leaves, the loop runs on and stops on its first frame
//   reduced   with prefers-reduced-motion, the letters don't lean
//   phone     at 390 × 844 the letters fit and nothing scrolls sideways
//
// Exit 0 when all pass, 1 when one fails, 2 when no browser could start. The first run installs playwright-core once
// into a cache folder (never into the project) and drives your installed Chrome or Edge.
import http from "node:http";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, extname, join, resolve, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const SITE = resolve(ROOT, flag("--site", "../site")), OUT = resolve(ROOT, flag("--out", "out/check.png"));
mkdirSync(dirname(OUT), { recursive: true });

// ——— playwright-core, once, outside the project ———
const caches = [process.env.PUFF_CHECK_CACHE, ...["puff-check", "linework-check"].map((n) => platform() === "darwin" ? join(homedir(), "Library/Caches", n)
  : platform() === "win32" ? join(process.env.LOCALAPPDATA || homedir(), n) : join(homedir(), ".cache", n))].filter(Boolean);
let cache = caches.find((c) => existsSync(join(c, "node_modules/playwright-core")));
if (!cache){
  cache = caches[0];
  mkdirSync(cache, { recursive: true });
  console.log(`installing playwright-core into ${cache} (once)…`);
  try { execFileSync("npm", ["install", "--silent", "--no-audit", "--no-fund", "--prefix", cache, "playwright-core@1.47.2"], { stdio: "inherit" }); }
  catch { console.error("could not install playwright-core; check the page by hand (SKILL.md, step 6)"); process.exit(2); }
}
const { chromium } = createRequire(join(cache, "index.js"))("playwright-core");

// ——— a static server for the site ———
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webm": "video/webm", ".mov": "video/quicktime",
  ".mp4": "video/mp4", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  let f = join(SITE, p || "index.html");
  if (!f.startsWith(SITE)) { res.writeHead(403).end(); return; }
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream", "cache-control": "no-store" }).end(readFileSync(f));
}).listen(0);
const URL0 = `http://localhost:${server.address().port}/`;

let browser;
for (const o of [{ channel: "chrome" }, { channel: "msedge" }, {}]){ try { browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"], ...o }); break; } catch {} }
if (!browser){ console.error("no Chrome found: install Google Chrome, or run: npx playwright install chromium"); server.close(); process.exit(2); }

const results = [], ok = (name, pass, note) => { results.push({ name, pass, note }); };
const errors = [];
const open = async (ctxOpts) => {
  const ctx = await browser.newContext(ctxOpts), page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(URL0, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__puff, null, { timeout: 20000 });
  await page.evaluate(() => window.__puff.ready);
  return { ctx, page };
};
const transform = (page) => page.evaluate(() => window.__puff.el.querySelector(".tilt").style.transform);
const rotY = (t) => +(t.match(/rotateY\(([-\d.]+)deg\)/)?.[1] ?? 0);

try {
  // ——— desktop ———
  const W = 1440, H = 900, { ctx, page } = await open({ viewport: { width: W, height: H } });
  const loaded = await page.waitForFunction(() => window.__puff.video.readyState >= 2, null, { timeout: 30000 }).then(() => true, () => false);
  ok("loaded", loaded, loaded ? "" : "the loop did not load (check site/img/<id>/puff.webm)");
  await page.waitForTimeout(1300);
  const rest = await page.screenshot();

  await page.mouse.move(4, 4); await page.mouse.move(W - 4, 4, { steps: 20 }); await page.mouse.move(W - 4, H * .5, { steps: 10 });
  await page.waitForTimeout(900);
  const ry = rotY(await transform(page));
  ok("lean", ry > 3, `turned ${ry.toFixed(1)}° toward the cursor`);

  const at = await page.evaluate(() => window.__puff.pointOnLetters());
  await page.evaluate(() => { window.__rec = []; const t0 = performance.now(); const f = (t) => { const m = window.__puff.el.querySelector(".tilt").style.transform.match(/scale\(([^,]+), ([^)]+)\)/); if (m) window.__rec.push(+m[2]); if (t - t0 < 1400) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await page.mouse.move(at[0], at[1]);      // straight onto the letters: the pop starts with the first event
  await page.waitForTimeout(1500);
  const rec = await page.evaluate(() => window.__rec), peak = Math.max(...rec), after = rec.slice(rec.indexOf(peak)), dip = Math.min(...after);
  ok("pop", peak >= 1.04 && dip < peak - .02, `swelled to ${(peak * 100).toFixed(0)}%, rebounded to ${(dip * 100).toFixed(0)}%`);
  const playing = await page.evaluate(() => !window.__puff.video.paused);
  ok("loop", playing, playing ? "" : "the loop did not play on hover (is the video muted and playsinline?)");
  const hover = await page.screenshot();

  await page.mouse.move(4, at[1], { steps: 12 }); await page.mouse.move(4, 4, { steps: 6 });
  const dur = await page.evaluate(() => window.__puff.video.duration || 5);
  const done = await page.waitForFunction(() => window.__puff.video.paused && window.__puff.video.currentTime < .05, null, { timeout: (dur + 3) * 1000 }).then(() => true, () => false);
  ok("finish", done, done ? "stopped on its first frame" : "the loop did not finish on its first frame after the cursor left");
  await ctx.close();

  // ——— reduced motion ———
  const r = await open({ viewport: { width: W, height: H }, reducedMotion: "reduce" });
  await r.page.mouse.move(W - 4, 4, { steps: 10 }); await r.page.waitForTimeout(700);
  const rr = rotY(await transform(r.page));
  ok("reduced", Math.abs(rr) < .5, `turned ${rr.toFixed(1)}°`);
  await r.ctx.close();

  // ——— phone ———
  const ph = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ph.page.waitForTimeout(1300);
  const fit = await ph.page.evaluate(() => ({ scroll: document.scrollingElement.scrollWidth, vw: innerWidth, w: window.__puff.el.getBoundingClientRect().width }));
  ok("phone", fit.scroll <= fit.vw + 1 && fit.w <= fit.vw * .96, `letters ${Math.round(fit.w)} px wide in ${fit.vw}; page ${fit.scroll} px wide`);
  const phone = await ph.page.screenshot();
  await ph.ctx.close();

  ok("console", !errors.length, errors.slice(0, 3).join(" | "));

  // ——— contact sheet ———
  const SH = 520, tiles = await Promise.all([rest, hover, phone].map((b) => sharp(b).resize({ height: SH }).png().toBuffer()));
  const ws = await Promise.all(tiles.map(async (t) => (await sharp(t).metadata()).width));
  let x = 0;
  await sharp({ create: { width: ws.reduce((a, w) => a + w + 10, 10), height: SH + 20, channels: 3, background: "#1c1b1e" } })
    .composite(tiles.map((t, k) => { const c = { input: t, left: 10 + x, top: 10 }; x += ws[k] + 10; return c; })).png().toFile(OUT);
} catch (e){
  ok("run", false, e.message.split("\n")[0]);
}
await browser.close(); server.close();
for (const r of results) console.log(`${r.pass ? "pass" : "FAIL"}  ${r.name.padEnd(8)} ${r.note ?? ""}`);
console.log(`sheet → ${OUT}`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
