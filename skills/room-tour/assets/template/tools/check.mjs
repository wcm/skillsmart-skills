// Checks a page headless, on a desktop and a phone screen: every stop and three moments of every move on contact sheets
// you can read, the recording's length, and what's wrong.
//
//   node check.mjs <id>     → out/<id>/check-desktop.jpg, check-phone.jpg
//
// Exit code 1 if something is wrong: a page error or warning (tour.json fields included), a missing file, a word still to
// WRITE, text under 14 px, a page that scrolls sideways, or a recording far from 25 s.
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { launch, open, serve } from "./browser.mjs";
import { OUT, SITE, loadWalk } from "./common.mjs";

const id = process.argv[2];
loadWalk(id);
const pageDir = join(SITE, id);
if (!existsSync(join(pageDir, "tour.json"))) { console.error(`no site/${id}/tour.json`); process.exit(1); }
const dest = join(OUT, id);
mkdirSync(dest, { recursive: true });
const problems = [];
for (const f of ["index.html", "tour.json", "style.css"]) if (existsSync(join(pageDir, f)) && /\bWRITE\b/.test(readFileSync(join(pageDir, f), "utf8"))) problems.push(`${f}: still has words to WRITE`);

const browser = await launch();
if (!browser) { console.error("no browser: serve the site (python3 tools/serve.py), open the page and go through the checklist in SKILL.md by hand"); process.exit(2); }
const site = serve();

for (const [name, opts, tw, th, cols] of [
  ["desktop", { viewport: { width: 1440, height: 900 } }, 640, 400, 4],
  ["phone", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 280, 606, 6],
]) {
  // the live page: errors, sideways scroll and small text, scrolled to a few places
  const errors = [];
  const live = await open(browser, site.url(id), opts, errors);
  for (const f of [0, 0.35, 0.7, 1]) {
    await live.page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), f);
    await live.page.waitForTimeout(600);
    const found = await live.page.evaluate(() => {
      const small = new Set();
      for (const el of document.querySelectorAll("body *")) {
        if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0 || !r.width || r.bottom < 0 || r.top > innerHeight) continue;
        let o = 1; for (let e = el; e; e = e.parentElement) o *= +getComputedStyle(e).opacity;
        if (o > 0.05 && parseFloat(cs.fontSize) < 13.5) small.add(`${el.textContent.trim().slice(0, 30)} (${parseFloat(cs.fontSize)} px)`);
      }
      return { small: [...small].slice(0, 4), overflow: document.documentElement.scrollWidth - innerWidth };
    });
    if (found.overflow > 1) problems.push(`${name}: the page scrolls sideways by ${found.overflow} px`);
    for (const s of found.small) problems.push(`${name}: text under 14 px: ${s}`);
  }
  await live.ctx.close();

  // the recording timeline: every stop, and each move at a third, a half and two thirds
  const rec = await open(browser, site.url(id, "?record"), opts, errors);
  const tl = await rec.page.evaluate(() => ({ fps: tour.fps, duration: tour.duration, problems: tour.problems ?? [], segs: tour.timeline.segments.map((s) => ({ id: s.id, kind: s.kind, t: s.t })) }));
  for (const p of tl.problems) problems.push(`${name}: ${typeof p === "string" ? p : JSON.stringify(p)}`);
  if (name === "desktop") {
    console.log(`recording: ${tl.duration.toFixed(1)} s (${tl.segs.map((s) => s.id).join(" → ")})`);
    if (tl.duration < 18 || tl.duration > 32) problems.push(`the recording is ${tl.duration.toFixed(1)} s; aim for about 25 s (moves.*.rec, record.hold, record.end in tour.json)`);
  }
  const shots = [];
  for (const s of tl.segs) for (const f of s.kind === "move" || s.kind === "cut" ? [0.33, 0.5, 0.67] : s.kind === "beat" ? [] : [0.6]) {
    shots.push({ n: Math.round((s.t[0] + (s.t[1] - s.t[0]) * f) * tl.fps), label: `${s.id}${s.kind === "move" ? ` ${Math.round(f * 100)}%` : ""}` });
  }
  const tiles = [];
  for (const { n, label } of shots) {
    await rec.page.evaluate((n) => window.tour.frame(n), n);
    const png = await rec.page.screenshot({ type: "png" });
    const tag = Buffer.from(`<svg width="${tw}" height="30"><rect width="${14 + 8.5 * label.length}" height="26" rx="4" fill="#000" opacity=".72"/><text x="8" y="19" font-family="Helvetica" font-size="15" font-weight="700" fill="#fff">${label}</text></svg>`);
    tiles.push(await sharp(png).resize(tw, th).composite([{ input: tag, left: 0, top: 0 }]).toBuffer());
  }
  const rows = Math.ceil(tiles.length / cols);
  await sharp({ create: { width: cols * tw, height: rows * th, channels: 3, background: "#111" } })
    .composite(tiles.map((b, i) => ({ input: b, left: (i % cols) * tw, top: Math.floor(i / cols) * th }))).jpeg({ quality: 84 }).toFile(join(dest, `check-${name}.jpg`));
  console.log(join(dest, `check-${name}.jpg`));
  await rec.ctx.close();
  for (const e of new Set(errors)) problems.push(`${name}: ${e}`);
}
await browser.close(); site.close();
if (problems.length) { console.log(`\n${problems.length} to look at:\n- ${[...new Set(problems)].join("\n- ")}`); process.exitCode = 1; }
else console.log("\nNo problems found. Look at both sheets yourself as well (SKILL.md, Step 7).");
