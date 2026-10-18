// Checks a page in a headless Chrome the way a visitor scrolls it, and writes a contact sheet of its moments.
//
//   node check.mjs <id>                       serves ../site itself
//   node check.mjs <id> --out out/check.jpg
//
//   loaded    both clips' frames load, and the photos and cut-outs
//   lift      the cut-out lands exactly on the product in the first photo (the hand-off from photo to cut-out is
//             invisible); the same at the landing in the second photo
//   labels    at the hold every label is on screen and none overlaps another
//   console   no errors
//   phone     at 390 × 844 nothing scrolls sideways and the legend shows at the hold
//   reduced   with prefers-reduced-motion the page still scrubs
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
const id = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const SITE = resolve(ROOT, flag("--site", "../site"));
if (!id || !existsSync(join(SITE, id, "layout.json"))) { console.error("usage: node check.mjs <id>   (needs site/<id>/layout.json: run build.mjs first)"); process.exit(1); }
const OUT = resolve(ROOT, flag("--out", `out/${id}/check.jpg`));
mkdirSync(dirname(OUT), { recursive: true });

// ——— playwright-core, once, outside the project ———
const caches = [process.env.EXPLODED_CHECK_CACHE, ...["exploded-check", "puff-check", "linework-check"].map((n) => platform() === "darwin" ? join(homedir(), "Library/Caches", n)
  : platform() === "win32" ? join(process.env.LOCALAPPDATA || homedir(), n) : join(homedir(), ".cache", n))].filter(Boolean);
let cache = caches.find((c) => existsSync(join(c, "node_modules/playwright-core")));
if (!cache) {
  cache = caches[0];
  mkdirSync(cache, { recursive: true });
  console.log(`installing playwright-core into ${cache} (once)…`);
  try { execFileSync("npm", ["install", "--silent", "--no-audit", "--no-fund", "--prefix", cache, "playwright-core@1.47.2"], { stdio: "inherit" }); }
  catch { console.error("could not install playwright-core; check the page by hand (SKILL.md, step 8)"); process.exit(2); }
}
const { chromium } = createRequire(join(cache, "index.js"))("playwright-core");

// ——— a static server for the site ———
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  let f = join(SITE, p || "index.html");
  if (!f.startsWith(SITE)) { res.writeHead(403).end(); return; }
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream", "cache-control": "no-store" }).end(readFileSync(f));
}).listen(0);
const URL0 = `http://localhost:${server.address().port}/${id}/`;

let browser;
for (const o of [{ channel: "chrome" }, { channel: "msedge" }, {}]) { try { browser = await chromium.launch({ headless: true, ...o }); break; } catch {} }
if (!browser) { console.error("no Chrome found: install Google Chrome, or run: npx playwright install chromium"); server.close(); process.exit(2); }

const results = [], ok = (name, pass, note) => results.push({ name, pass, note });
const errors = [];
async function open(opts) {
  const ctx = await browser.newContext(opts), page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(URL0, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.explode, null, { timeout: 30000 });
  return { ctx, page };
}
const seek = async (page, p) => { await page.evaluate((x) => window.explode.seek(x), p); await page.waitForTimeout(250); await page.evaluate((x) => window.explode.seek(x), p); };
// the mean difference of two screenshots inside a box (0–255): the same picture scores near 0
async function diff(a, b, box) {
  const [ra, rb] = await Promise.all([a, b].map((s) => sharp(s).extract(box).removeAlpha().raw().toBuffer()));
  let sum = 0;
  for (let k = 0; k < ra.length; k++) sum += Math.abs(ra[k] - rb[k]);
  return sum / ra.length;
}

try {
  // ——— desktop ———
  const W = 1440, H = 900, { ctx, page } = await open({ viewport: { width: W, height: H } });
  const loaded = await page.evaluate(() => Promise.race([window.explode.ready, new Promise((r) => setTimeout(() => r(false), 60000))]));
  const counts = await page.evaluate(() => [...document.images].filter((i) => !i.complete || !i.naturalWidth).length);
  ok("loaded", loaded === true && counts === 0, loaded === true ? (counts ? `${counts} pictures failed to load` : "") : "the clips' frames did not finish loading in 60 s");

  // the hand-offs: the photo against the cut-out over the empty place, inside the product's box on screen
  const boxAt = (which) => page.evaluate((w) => {
    const img = document.querySelector(w === 1 ? ".e-place1 .e-photo-front" : ".e-place2 .e-photo-front").getBoundingClientRect();
    return img;
  }, which);
  const layout = await page.evaluate(() => fetch("layout.json").then((r) => r.json()));
  const shots = {};
  for (const [name, p] of [["photo1", 0.04], ["lift", 0.0655], ["land", 0.838], ["photo2", 0.9]]) { await seek(page, p); shots[name] = await page.screenshot(); }
  for (const [check, a, b, n] of [["lift", "photo1", "lift", 1], ["landing", "land", "photo2", 2]]) {
    const r = await boxAt(n), [pw] = layout.photo, k = r.width / pw, bx = layout[`cut${n}`].photo;
    const box = { left: Math.max(0, Math.round(r.x + bx[0] * k)), top: Math.max(0, Math.round(r.y + bx[1] * k)) };
    box.width = Math.max(1, Math.min(W - box.left, Math.round(bx[2] * k))); box.height = Math.max(1, Math.min(H - box.top, Math.round(bx[3] * k)));
    const d = await diff(shots[a], shots[b], box);
    ok(check, d < 14, `the product differs by ${d.toFixed(1)} of 255 between the photo and the cut-out${d < 14 ? "" : ": the cut-out doesn't line up (rebuild the cuts and web steps)"}`);
  }

  // the hold: labels on screen and apart
  await seek(page, 0.52);
  const lab = await page.evaluate(() => [...document.querySelectorAll(".e-label")].map((l) => { const r = l.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom, getComputedStyle(l).opacity]; }));
  const off = lab.filter(([l, t, r, b]) => l < 0 || t < 0 || r > W || b > H).length;
  let overlap = 0;
  for (let i = 0; i < lab.length; i++) for (let j = i + 1; j < lab.length; j++) {
    const [a, b] = [lab[i], lab[j]];
    if (a[0] < b[2] - 2 && b[0] < a[2] - 2 && a[1] < b[3] - 2 && b[1] < a[3] - 2) overlap++;
  }
  ok("labels", !off && !overlap && lab.every((l) => +l[4] > 0.9), `${lab.length} labels · ${off} off screen · ${overlap} overlapping`);
  const tiles = [];
  for (const p of [0, 0.13, 0.3, 0.52, 0.72, 0.97]) { await seek(page, p); tiles.push(await page.screenshot()); }
  await ctx.close();

  // ——— reduced motion ———
  const r = await open({ viewport: { width: W, height: H }, reducedMotion: "reduce" });
  await r.page.evaluate(() => window.scrollTo(0, document.querySelector(".e-scroll").offsetHeight * 0.5));
  await r.page.waitForTimeout(500);
  const rp = await r.page.evaluate(() => window.explode.progress);
  ok("reduced", rp > 0.4, `scrolled halfway, showing ${(rp * 100).toFixed(0)}%`);
  await r.ctx.close();

  // ——— phone ———
  const ph = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ph.page.evaluate(() => window.explode.ready);
  const phoneTiles = [];
  for (const p of [0, 0.52, 0.97]) { await seek(ph.page, p); phoneTiles.push(await ph.page.screenshot()); }
  await seek(ph.page, 0.52);
  const fit = await ph.page.evaluate(() => ({ scroll: document.scrollingElement.scrollWidth, vw: innerWidth, legend: +getComputedStyle(document.querySelector(".e-legend")).opacity }));
  ok("phone", fit.scroll <= fit.vw + 1 && fit.legend > 0.9, `page ${fit.scroll} px wide in ${fit.vw}; legend ${fit.legend > 0.9 ? "shows" : "hidden"} at the hold`);
  await ph.ctx.close();

  ok("console", !errors.length, errors.slice(0, 3).join(" | "));

  // ——— contact sheet: six desktop moments, then three on a phone ———
  const TW = 480, TH = 300, PH = TH * 2 + 8, PW = Math.round(PH * 390 / 844);
  const desk = await Promise.all(tiles.map((b) => sharp(b).resize(TW, TH).png().toBuffer()));
  const phones = await Promise.all(phoneTiles.map((b) => sharp(b).resize(PW, PH).png().toBuffer()));
  const comps = [...desk.map((b, i) => ({ input: b, left: 10 + (i % 3) * (TW + 8), top: 10 + Math.floor(i / 3) * (TH + 8) })),
    ...phones.map((b, i) => ({ input: b, left: 10 + 3 * (TW + 8) + 8 + i * (PW + 8), top: 10 }))];
  await sharp({ create: { width: 20 + 3 * (TW + 8) + 8 + 3 * (PW + 8), height: PH + 20, channels: 3, background: "#1c1b1e" } }).composite(comps).jpeg({ quality: 84 }).toFile(OUT);
} catch (e) {
  ok("run", false, e.message.split("\n")[0]);
}
await browser.close(); server.close();
for (const r of results) console.log(`${r.pass ? "pass" : "FAIL"}  ${r.name.padEnd(8)} ${r.note ?? ""}`);
console.log(`sheet → ${OUT}`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
