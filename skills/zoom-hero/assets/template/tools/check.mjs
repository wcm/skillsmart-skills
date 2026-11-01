// Checks a page headless, level by level, on a desktop and a phone screen. Writes contact sheets to look at, and fails
// on what it can measure: errors, slots left to write, spots under the words or readouts, spots off the screen.
//
//   node check.mjs <id>        → out/<id>/check-desktop.jpg, check-phone.jpg
import sharp from "sharp";
import { join } from "node:path";
import { dirOf, loadTree } from "./common.mjs";
import { finish, go, launch, open, serve } from "./browser.mjs";

const id = process.argv[2];
const tree = loadTree(id), dir = dirOf(id);
const browser = await launch();
if (!browser) { console.error("no browser: serve the page (python3 tools/serve.py) and check it by hand (SKILL.md, step 6)"); process.exit(2); }
const site = serve(), errors = [], problems = [];
const nodes = tree.nodes, ids = Object.keys(nodes);

// the spots overlapping the words or readouts on the level showing
const overlaps = () => {
  const box = (e) => { const r = e.getBoundingClientRect(); return r.width && r.height && getComputedStyle(e).visibility !== "hidden" ? r : null; };
  const hits = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const blocks = [...document.querySelectorAll('.lp-copy-in:not(.out), [data-lp="span"], [data-lp="mag"], [data-lp="back"]:not(:disabled)')].map(box).filter(Boolean);
  const out = [];
  for (const s of document.querySelectorAll(".lp-spot")) {
    const d = box(s.querySelector(".lp-spot-dot"));
    if (!d) continue;
    if (d.right < 0 || d.bottom < 0 || d.left > innerWidth || d.top > innerHeight) out.push(`${s.dataset.id}: off the screen`);
    if (blocks.some((b) => hits(d, b))) out.push(`${s.dataset.id}: under the words or readouts`);
  }
  return out;
};

async function run(opts, name, list) {
  const { page, ok } = await open(browser, site.url(id), opts, errors);
  if (!ok) return;
  await new Promise((r) => setTimeout(r, 1800));
  const shots = [];
  for (const l of list) {
    if (await page.evaluate((x) => lp.level !== x, l)) await go(page, l);
    await page.waitForTimeout(250);
    shots.push(await page.screenshot());
    if (name === "desktop") for (const o of await page.evaluate(overlaps)) problems.push(`${l} → ${o}`);
    if (await page.evaluate(() => /\bWRITE\b/.test(document.body.innerText))) problems.push(`${l}: words still to write (WRITE) on the page`);
  }
  const [w, h, cols] = name === "desktop" ? [800, 500, 3] : [260, 563, 6];
  const tiles = await Promise.all(shots.map((s) => sharp(s).resize(w, h).toBuffer()));
  const out = join(dir, `check-${name}.jpg`);
  await sharp({ create: { width: w * Math.min(cols, tiles.length), height: h * Math.ceil(tiles.length / cols), channels: 3, background: "#000" } })
    .composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * w, top: Math.floor(i / cols) * h }))).jpeg({ quality: 82 }).toFile(out);
  console.log(`${name}: ${list.length} levels → ${out}`);
  await page.context().close();
}

await run({ viewport: { width: 1440, height: 900 } }, "desktop", ids);
// the phone: the main way down
const main = [ids[0]];
for (let l = ids[0]; ;) { l = ids.find((k) => nodes[k].parent === l); if (!l) break; main.push(l); }
await run({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, "phone", main);

for (const e of [...new Set(errors)]) problems.push(`page error: ${e}`);
await finish(browser, site);
if (problems.length) { console.log(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}:\n  ` + problems.join("\n  ")); process.exit(1); }
console.log("\nno problems measured. Look at the sheets too: titles readable, words readable on every level, spots on real things.");
process.exit(0);
