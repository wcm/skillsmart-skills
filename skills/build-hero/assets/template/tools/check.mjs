// Checks a page headless, on a desktop and a phone screen: the build at twelve points on contact sheets you can read,
// the one-scroll auto-play's length, and what's wrong.
//
//   node check.mjs <id>     → out/<id>/check-desktop.jpg, check-phone.jpg
//
// Exit code 1 if something is wrong (a page error, a missing file, a word still to WRITE, an auto-play far from 3 s).
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { launch, open, serve } from "./browser.mjs";
import { OUT, SITE, loadScene } from "./common.mjs";

const id = process.argv[2];
loadScene(id);
const pageDir = join(SITE, id);
if (!existsSync(join(pageDir, "frames/manifest.json"))) { console.error(`no frames yet: node frames.mjs ${id}`); process.exit(1); }
const dest = join(OUT, id);
mkdirSync(dest, { recursive: true });
const problems = [];
for (const f of ["index.html", "main.js"]) if (/\bWRITE\b/.test(readFileSync(join(pageDir, f), "utf8"))) problems.push(`${f}: still has words to WRITE`);

const browser = await launch();
if (!browser) { console.error("no browser: serve the site (python3 tools/serve.py), open the page and go through the checklist in SKILL.md by hand"); process.exit(2); }
const site = serve();
const POINTS = [0, 0.05, 0.12, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.88, 1];

for (const [name, opts, tw, th, cols] of [
  ["desktop", { viewport: { width: 1440, height: 900 } }, 640, 400, 4],
  ["phone", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 280, 606, 6],
]) {
  const errors = [];
  const { ctx, page } = await open(browser, site.url(id), opts, errors);
  const tiles = [];
  for (const p of POINTS) {
    await page.evaluate((k) => window.chantier.at(k), p);
    await page.waitForTimeout(350);
    const png = await page.screenshot({ type: "png" });
    const label = Buffer.from(`<svg width="${tw}" height="30"><rect width="76" height="26" rx="4" fill="#000" opacity=".72"/><text x="8" y="19" font-family="Helvetica" font-size="15" font-weight="700" fill="#fff">p ${p}</text></svg>`);
    tiles.push(await sharp(png).resize(tw, th).composite([{ input: label, left: 0, top: 0 }]).toBuffer());
  }
  const rows = Math.ceil(tiles.length / cols);
  await sharp({ create: { width: cols * tw, height: rows * th, channels: 3, background: "#111" } })
    .composite(tiles.map((b, i) => ({ input: b, left: (i % cols) * tw, top: Math.floor(i / cols) * th }))).jpeg({ quality: 84 }).toFile(join(dest, `check-${name}.jpg`));
  console.log(join(dest, `check-${name}.jpg`));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 1) problems.push(`${name}: the page scrolls sideways by ${overflow} px`);
  await ctx.close();
  for (const e of new Set(errors)) problems.push(`${name}: ${e}`);

  // the auto-play: one wheel tick at the top, on the page's real clock
  const glideErrors = [];
  const g = await open(browser, site.url(id), { viewport: opts.viewport }, glideErrors, { record: false });
  await g.page.mouse.move(Math.round(opts.viewport.width / 2), Math.round(opts.viewport.height / 2));
  await g.page.mouse.wheel(0, 120);
  const glide = await g.page.evaluate(async () => {
    const api = window.chantier, target = api.options.glideTo ?? (api.options.lit ? api.options.lit.at[1] : api.options.film[1]);
    if (!api.options.glide) return null;
    const t0 = performance.now();
    while (performance.now() - t0 < 9000) {
      if (api.p >= target - 0.012) return { s: (performance.now() - t0) / 1000, p: api.p };
      await new Promise((r) => setTimeout(r, 40));
    }
    return { s: null, p: api.p };
  });
  if (name === "desktop" || glide?.s == null) console.log(`${name} auto-play: ${glide?.s == null ? `not finished after 9 s (p ${glide?.p?.toFixed(3)})` : `${glide.s.toFixed(2)} s`}`);
  if (glide && (glide.s == null || glide.s < 2.2 || glide.s > 4)) problems.push(`${name}: the one-scroll auto-play took ${glide.s?.toFixed(2) ?? "over 9"} s; it should be about 3 s (glide: 3000 in main.js)`);
  await g.ctx.close();
}
await browser.close(); site.close();
if (problems.length) { console.log(`\n${problems.length} to look at:\n- ${[...new Set(problems)].join("\n- ")}`); process.exitCode = 1; }
else console.log("\nNo problems found. Look at the sheets yourself as well.");
