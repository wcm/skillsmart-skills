// Screenshots of a page in any state, and a dive as a contact sheet.
//
//   node shot.mjs <id> --shot out/a.png
//   node shot.mjs <id> --size 390x844 --scale 2 --shot out/phone.png
//   node shot.mjs <id> --go <level> --shot out/b.png            dive to a level (walks the tree), then a screenshot
//   node shot.mjs <id> --film <level> 8 out/dive.jpg            a move as 8 frames on one sheet
//   node shot.mjs <id> --hover ".lp-spot .lp-spot-dot" --shot out/c.png
//
// Steps run in order; --eval runs JS in the page, --tick N moves the clock N frames (1/60 s), --wait waits (ms, real
// time). Console errors print last.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { TOOLS, flagOf } from "./common.mjs";
import { finish, go, launch, open, serve, settle, tick } from "./browser.mjs";

const argv = process.argv.slice(2), flag = flagOf(argv), id = argv[0];
if (!id) { console.error("usage: node shot.mjs <id> [steps]"); process.exit(1); }
const [W, H] = flag("--size", "1440x900").split("x").map(Number), scale = Number(flag("--scale", 1));
const browser = await launch();
if (!browser) process.exit(2);
const site = serve(), errors = [];
const { page } = await open(browser, site.url(id), { viewport: { width: W, height: H }, deviceScaleFactor: scale, ...(W < 760 ? { isMobile: true, hasTouch: true } : {}) }, errors);
await new Promise((r) => setTimeout(r, 1800));   // the title's entrance
const path = (p) => { const f = resolve(TOOLS, p); mkdirSync(dirname(f), { recursive: true }); return f; };
for (let i = 1; i < argv.length; i++) {
  const a = argv[i], v = argv[i + 1];
  if (a === "--eval") { await page.evaluate(`(async () => { ${v} })()`).catch((e) => errors.push(`eval: ${e.message}`)); i++; }
  else if (a === "--go") { await go(page, v); i++; }
  else if (a === "--tick") { await tick(page, Number(v)); i++; }
  else if (a === "--settle") await settle(page);
  else if (a === "--hover") { await page.hover(v, { timeout: 5000 }).catch((e) => errors.push(`hover ${v}: ${e.message.split("\n")[0]}`)); await tick(page, 2); i++; }
  else if (a === "--click") { await page.click(v, { timeout: 5000 }).catch((e) => errors.push(`click ${v}: ${e.message.split("\n")[0]}`)); i++; }
  else if (a === "--wait") { await new Promise((r) => setTimeout(r, Number(v))); i++; }
  else if (a === "--shot") { await new Promise((r) => setTimeout(r, 120)); await page.screenshot({ path: path(v) }); console.log("→", path(v)); i++; }
  else if (a === "--film") {
    const n = Number(argv[i + 2]), out = path(argv[i + 3]);
    i += 3;
    await page.evaluate((l) => { window.__move = lp.go(l); }, v);
    await page.waitForFunction(() => lp.state.moving, null, { timeout: 20000 }).catch(() => {});
    const frames = await page.evaluate(() => Math.round(lp.motion.runs.reduce((s, r) => s + r.T, 0) * 60));
    const shots = [];
    let done = 0;
    for (let k = 0; k < n; k++) {
      const at = Math.round((k / (n - 1)) * frames);
      await tick(page, at - done);
      done = at;
      await new Promise((r) => setTimeout(r, 60));
      shots.push(await page.screenshot());
    }
    await settle(page);
    const tw = 720, th = Math.round((tw * H) / W), cols = Math.min(4, n), rows = Math.ceil(n / cols);
    const tiles = await Promise.all(shots.map((s) => sharp(s).resize(tw, th).toBuffer()));
    await sharp({ create: { width: tw * cols, height: th * rows, channels: 3, background: "#000" } })
      .composite(tiles.map((t, k) => ({ input: t, left: (k % cols) * tw, top: Math.floor(k / cols) * th }))).jpeg({ quality: 84 }).toFile(out);
    console.log("→", out);
  }
  else if (["--size", "--scale"].includes(a)) i++;
}
if (errors.length) console.log("page messages:\n  " + [...new Set(errors)].join("\n  "));
await finish(browser, site);
process.exit(0);
