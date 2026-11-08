// Checks a page headless, on a desktop and a phone screen, and lays what it saw out on contact sheets you can read: the
// first subject formed, a change to the next one at four moments, a hand pushed through it, and the phone layout.
//
//   node check.mjs <id>     → tools/out/<id>/check-desktop.jpg, check-phone.jpg
//
// Exit code 1 if something is wrong: a page error or warning, a missing picture, a word still to WRITE, text under
// 10 px, a page that scrolls sideways, or fewer subjects on the page than in tools/pictures/<id>.json.
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { launch, open, serve } from "./browser.mjs";
import { OUT, SITE, loadPictures } from "./common.mjs";

const id = process.argv[2];
const spec = loadPictures(id);
const pageDir = join(SITE, id);
if (!existsSync(join(pageDir, "index.html"))) { console.error(`no site/${id}/index.html`); process.exit(1); }
const dest = join(OUT, id);
mkdirSync(dest, { recursive: true });
const problems = [];
for (const f of ["index.html", "main.js", "style.css"]) if (existsSync(join(pageDir, f)) && /\bWRITE\b/.test(readFileSync(join(pageDir, f), "utf8"))) problems.push(`${f}: still has words to WRITE`);
for (const p of spec.pictures ?? []) for (const f of [`${p.id}.webp`, `${p.id}-depth.png`]) if (!existsSync(join(pageDir, "img", f))) problems.push(`site/${id}/img/${f} is missing (node tools/pictures.mjs ${id})`);

const browser = await launch();
if (!browser) { console.error("no browser: serve the site (python3 tools/serve.py), open the page and go through the checklist in SKILL.md by hand"); process.exit(2); }
const site = serve();

// steps the page by hand (its own timer paused), so every run sees the same moments
const steps = {
  formed: (p) => p.evaluate(() => { nuee.pause(); nuee.advance(3.2); }),
  // (a melt waits for its pairing first, as it has by the time a visitor's timer runs out)
  change: (p, sec) => p.evaluate(async (sec) => {
    if (sec !== 0) { nuee.advance(sec); return; }
    const e = nuee.engine, to = (nuee.current + 1) % e.forms.length;
    if (e.o.travel === "melt") await e.prepare(e.current, to);
    nuee.go(to);
  }, sec),
  // a hand swept across the middle of the subject, left to right and a little down, stopped halfway through its wake
  hand: (p) => p.evaluate(() => {
    const e = nuee.engine, f = e.o.frame(e.cssW, e.cssH);
    const cx = (f.cx / e.cssW) * 2 - 1, cy = 1 - (f.cy / e.cssH) * 2, rx = (f.s / e.cssW) * 2, ry = (f.s / e.cssH) * 2;
    for (let k = 0; k <= 30; k++) { const u = k / 30; e.setPointer(cx + (u - 0.5) * 1.6 * rx, cy + (0.25 - u * 0.5) * ry); nuee.advance(1 / 60); }
    nuee.advance(0.15);
  }),
  away: (p) => p.evaluate(() => { nuee.engine.setPointer(null); nuee.advance(1.6); }),
};

for (const [name, opts, tw, cols, script] of [
  ["desktop", { viewport: { width: 1440, height: 900 } }, 560, 3,
    [["formed", "first subject"], ["change0", null], ["change", 0.5, "0.5 s"], ["change", 0.6, "1.1 s"], ["change", 0.9, "2.0 s"], ["change", 1.4, "next, formed"], ["hand", "a hand through it"], ["away", "settled"]]],
  ["phone", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 260, 3,
    [["formed", "first subject"], ["change0", null], ["change", 1.0, "changing"], ["change", 2.4, "next, formed"]]],
]) {
  const errors = [];
  const { ctx, page } = await open(browser, site.url(id), opts, errors);
  const found = await page.evaluate(() => {
    const small = new Set();
    for (const el of document.querySelectorAll("body *")) {
      if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0 || !r.width || r.bottom < 0 || r.top > innerHeight) continue;
      if (parseFloat(cs.fontSize) < 10) small.add(`${el.textContent.trim().slice(0, 30)} (${parseFloat(cs.fontSize)} px)`);
    }
    return { small: [...small].slice(0, 4), overflow: document.documentElement.scrollWidth - innerWidth, forms: nuee.engine.forms.length, grains: nuee.engine.N };
  });
  if (found.overflow > 1) problems.push(`${name}: the page scrolls sideways by ${found.overflow} px`);
  for (const s of found.small) problems.push(`${name}: text under 10 px: ${s}`);
  if (found.forms < (spec.pictures ?? []).length) problems.push(`${name}: ${found.forms} subjects on the page, ${(spec.pictures ?? []).length} in tools/pictures/${id}.json`);
  if (name === "desktop") console.log(`${found.forms} subjects, ${found.grains.toLocaleString("en-US")} grains`);

  const shots = [];
  for (const [step, a, b] of script) {
    if (step === "change0") { await steps.change(page, 0); continue; }
    if (step === "change") await steps.change(page, a); else await steps[step](page);
    shots.push({ png: await page.screenshot(), label: step === "change" ? b : a });
  }
  for (const e of errors) problems.push(`${name}: ${e}`);
  await ctx.close();

  const th = Math.round((tw * opts.viewport.height) / opts.viewport.width), rows = Math.ceil(shots.length / cols);
  const tiles = await Promise.all(shots.map(async (s, k) => ({
    input: await sharp(s.png).resize(tw, th).composite([{ input: Buffer.from(`<svg width="${tw}" height="22"><rect width="100%" height="22" fill="#000" opacity="0.6"/><text x="8" y="15" font-family="monospace" font-size="12" fill="#ff0">${s.label}</text></svg>`), top: 0, left: 0 }]).png().toBuffer(),
    left: (k % cols) * (tw + 6), top: Math.floor(k / cols) * (th + 6),
  })));
  await sharp({ create: { width: cols * (tw + 6) - 6, height: rows * (th + 6) - 6, channels: 3, background: "#777" } }).composite(tiles).jpeg({ quality: 82 }).toFile(join(dest, `check-${name}.jpg`));
  console.log(`${name} → tools/out/${id}/check-${name}.jpg`);
}
await browser.close();
site.close();

if (problems.length) { console.log(`\n${problems.length} problem(s):`); for (const p of problems) console.log(`  · ${p}`); process.exit(1); }
console.log("no problems found: now look at the sheets (checklist in SKILL.md)");
