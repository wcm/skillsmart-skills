// Checks a page headless, on a desktop and a phone screen.
//  - It uses the page the way a visitor does: a click on the first subject, one wheel notch and one key press (each must
//    land exactly one page on), back up, and Escape back to the gallery.
//  - It draws the recording script (?record) on a contact sheet you can read: the gallery, the opening, a page at
//    rest, a turn at a quarter, half (the line across the subject) and three quarters, the next pages, the flight home.
//
//   node check.mjs <id>     → tools/out/<id>/check-desktop.jpg, check-phone.jpg
//
// Exit code 1 if something is wrong: a page error, a missing frame or file, a word still to WRITE, gallery items that
// don't match the pages, text under 11 px, a page that scrolls sideways, or a scroll that doesn't land on the next page.
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { launch, open, serve } from "./browser.mjs";
import { OUT, SITE } from "./common.mjs";

const id = process.argv[2];
const pageDir = join(SITE, id ?? "");
if (!id || !existsSync(join(pageDir, "index.html"))) { console.error(`no site/${id}/index.html`); process.exit(1); }
const dest = join(OUT, id);
mkdirSync(dest, { recursive: true });
const problems = [];
for (const f of ["index.html", "style.css"]) if (existsSync(join(pageDir, f)) && /\bWRITE\b/.test(readFileSync(join(pageDir, f), "utf8"))) problems.push(`${f}: still has words to WRITE`);

const browser = await launch();
if (!browser) { console.error("no browser: serve the site (python3 tools/serve.py), open the page and go through the checklist in SKILL.md by hand"); process.exit(2); }
const site = serve();

// text under 11 px that a visitor can see, and sideways scrolling
const look = (page) => page.evaluate(() => {
  const small = new Set();
  for (const el of document.querySelectorAll("body *")) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (cs.visibility === "hidden" || cs.display === "none" || !r.width || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    let o = 1; for (let e = el; e; e = e.parentElement) o *= +getComputedStyle(e).opacity;
    if (o > 0.05 && parseFloat(cs.fontSize) < 10.5) small.add(`"${el.textContent.trim().slice(0, 30)}" (${parseFloat(cs.fontSize)} px)`);
  }
  return { small: [...small].slice(0, 4), overflow: document.documentElement.scrollWidth - innerWidth };
});
const settle = (page, ms) => page.waitForTimeout(ms);
const state = (page) => page.evaluate(() => ({ p: window.turntable.p, cls: document.documentElement.className }));

for (const [name, opts, tw, th, cols] of [
  ["desktop", { viewport: { width: 1440, height: 900 } }, 480, 300, 4],
  ["phone", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 240, 520, 6],
]) {
  const errors = [];
  const live = await open(browser, site.url(id), opts, errors);
  const { page } = live;

  // the pages and the gallery agree, and every subject has its frames
  const layout = await page.evaluate(() => ({
    pages: [...document.querySelectorAll("[data-detail] .page[data-subject]")].map((p) => p.dataset.subject),
    items: [...document.querySelectorAll("[data-gallery] .item[data-subject]")].map((p) => p.dataset.subject),
    loaded: window.turntable.turns.map((t) => (t ? t.images.filter((im) => im.complete && im.naturalWidth).length / t.count : 0)),
  }));
  if (name === "desktop") {
    if (!layout.pages.length) problems.push("no pages: [data-detail] needs one .page[data-subject] per subject");
    const lost = layout.pages.filter((s) => !layout.items.includes(s)), extra = layout.items.filter((s) => !layout.pages.includes(s));
    if (lost.length) problems.push(`pages with no gallery item: ${lost.join(", ")}`);
    if (extra.length) problems.push(`gallery items with no page: ${extra.join(", ")}`);
    layout.pages.forEach((s, i) => {
      if (!existsSync(join(pageDir, "frames", s, "manifest.json"))) problems.push(`${s}: no frames (node frames.mjs ${id})`);
      else if (layout.loaded[i] < 1) problems.push(`${s}: ${Math.round((1 - layout.loaded[i]) * 100)}% of its frames didn't load`);
    });
    console.log(`${layout.pages.length} pages: ${layout.pages.join(", ")}`);
  }
  const g = await look(page);
  for (const s of g.small) problems.push(`${name}, gallery: text under 11 px: ${s}`);
  if (g.overflow > 1) problems.push(`${name}, gallery: the page scrolls sideways by ${g.overflow} px`);

  // open the first subject, as a click would
  await page.evaluate(() => document.querySelector("[data-gallery] .item[data-subject]")?.click());
  await settle(page, 2200);
  let st = await state(page);
  if (!/is-detail/.test(st.cls)) problems.push(`${name}: clicking the first gallery item didn't open its page`);
  else {
    const d = await look(page);
    for (const s of d.small) problems.push(`${name}, page: text under 11 px: ${s}`);
    if (d.overflow > 1) problems.push(`${name}, page: the page scrolls sideways by ${d.overflow} px`);
    if (name === "desktop" && layout.pages.length > 1) {
      // one wheel notch = one whole turn to the next page; a key the same; then back
      await page.mouse.move(720, 450);
      await page.mouse.wheel(0, 120);
      await settle(page, 1900);
      st = await state(page);
      if (Math.abs(st.p - 1) > 0.03) problems.push(`one wheel notch should land on the next page, but stopped at ${st.p.toFixed(2)}`);
      await page.keyboard.press("ArrowUp");
      await settle(page, 1900);
      st = await state(page);
      if (Math.abs(st.p) > 0.03) problems.push(`the up arrow should land back on the first page, but stopped at ${st.p.toFixed(2)}`);
    }
    await page.keyboard.press("Escape");
    await settle(page, 1900);
    st = await state(page);
    if (!/is-gallery/.test(st.cls)) problems.push(`${name}: Escape didn't fly back to the gallery`);
  }
  await live.ctx.close();

  // the recording script on a contact sheet
  const rec = await open(browser, site.url(id, "?record"), opts, errors);
  await rec.page.waitForFunction(() => window.turntable.timeline, null, { timeout: 60000 });
  const tl = await rec.page.evaluate(() => ({ duration: window.turntable.timeline.duration, m: window.turntable.timeline.marks }));
  const m = tl.m, moments = [["gallery", m.open * 0.6], ["opening", m.open + (m.pages - m.open) * 0.55]];
  for (let i = 0; i <= m.turns; i++) {
    const t0 = m.pages + i * m.cycle;
    moments.push([`page ${i + 1}`, t0 + m.rest * 0.6]);
    if (i < m.turns) for (const f of i === 0 ? [0.25, 0.5, 0.75] : [0.5]) moments.push([`turn ${Math.round(f * 100)}%`, t0 + m.rest + m.snap * f]);
  }
  moments.push(["flying home", m.close + m.closing * 0.5], ["gallery again", tl.duration - 0.05]);
  const tiles = [];
  let at = 0;
  for (const [label, t] of moments) {
    // the script builds up as it plays, so step through every moment up to this one
    await rec.page.evaluate(async ([from, t]) => {
      const tl = window.turntable.timeline;
      for (let s = from; s < t; s += 1 / 30) tl.seek(s);
      tl.seek(t);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, [at, t]);
    at = t;
    const png = await rec.page.screenshot({ type: "png" });
    const tag = Buffer.from(`<svg width="${tw}" height="28"><rect width="${14 + 8 * label.length}" height="24" rx="4" fill="#000" opacity=".72"/><text x="7" y="17" font-family="Helvetica" font-size="14" font-weight="700" fill="#fff">${label}</text></svg>`);
    tiles.push(await sharp(png).resize(tw, th).composite([{ input: tag, left: 0, top: 0 }]).toBuffer());
  }
  const rows = Math.ceil(tiles.length / cols);
  await sharp({ create: { width: cols * tw, height: rows * th, channels: 3, background: "#111" } })
    .composite(tiles.map((b, i) => ({ input: b, left: (i % cols) * tw, top: Math.floor(i / cols) * th }))).jpeg({ quality: 84 }).toFile(join(dest, `check-${name}.jpg`));
  console.log(`${join(dest, `check-${name}.jpg`)}${name === "desktop" ? ` (the recording script: ${tl.duration.toFixed(1)} s)` : ""}`);
  await rec.ctx.close();
  for (const e of new Set(errors)) problems.push(`${name}: ${e}`);
}
await browser.close();
site.close();
if (problems.length) { console.log(`\n${problems.length} to look at:\n- ${[...new Set(problems)].join("\n- ")}`); process.exitCode = 1; }
else console.log("\nno problems found: now read both sheets (the checklist in SKILL.md)");
