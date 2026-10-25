// Checks a gallery page in a headless Chrome the way a visitor uses it, and writes a contact sheet of its scenes.
//
//   node check.mjs <id>                       sheet → tools/out/<id>/check.jpg
//
//   words     no WRITE slot left in page.json, and every picture a scene names is on the page
//   loaded    every picture and piece of scenery loads; no errors in the console and no missing files
//   title     on the first screen the pictures leave the title readable: they cover under a third of its letters
//   cards     at every tenth of a screen of scroll some picture shows (no empty frame between two scenes)
//   hover     a picture under the cursor shows its label
//   open      clicking it brings it forward with its details, and Escape puts it back
//   index     Index opens the list, and a title in it brings that picture into view
//   phone     at 390 × 844 nothing scrolls sideways and every frame shows a picture
//
// The sheet reads like the scroll: the opening, each scene and each change between two, a picture opened, and three
// moments on a phone. Exit 0 when all pass, 1 when one fails, 2 when no browser could start.
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { launch, open, serve } from "./browser.mjs";
import { pageFile, readPage } from "./page.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const id = argv.find((a) => !a.startsWith("--"));
if (!id || !existsSync(pageFile(id))) { console.error("usage: node check.mjs <id>   (needs site/<id>/page.json)"); process.exit(1); }
const OUT = join(ROOT, "out", id, "check.jpg");
mkdirSync(dirname(OUT), { recursive: true });

const results = [], ok = (name, pass, note) => results.push({ name, pass, note });

// ——— the words, before any browser ———
const pg = readPage(id), ids = new Set(pg.items.map((it) => it.id)), slots = [];
const look = (v, where) => {
  if (typeof v === "string" && /^WRITE/.test(v)) slots.push(where);
  else if (Array.isArray(v)) v.forEach((x, i) => look(x, `${where}[${i}]`));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) look(x, where ? `${where}.${k}` : k);
};
look({ ...pg, items: undefined }, "");
pg.items.forEach((it) => look({ title: it.title, sub: it.sub, meta: it.meta, text: it.text }, `item ${it.id}`));
const lost = [];
pg.sequence.forEach((s, i) => {
  for (const c of [...(Array.isArray(s.cards) ? s.cards : []), ...(s.looks || []).filter((x) => x !== "mix"), ...(s.end ? [s.end] : [])])
    if (!ids.has(c)) lost.push(`scene ${i + 1}: ${c}`);
});
ok("words", !slots.length && !lost.length, [slots.length ? `${slots.length} WRITE slot${slots.length > 1 ? "s" : ""} left (${slots.slice(0, 4).join(", ")}${slots.length > 4 ? ", …" : ""})` : "",
  lost.length ? `pictures not on the page: ${lost.slice(0, 4).join(", ")}` : ""].filter(Boolean).join(" · "));

const browser = await launch();
if (!browser) process.exit(2);
const site = serve(), URL0 = site.url(id), errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// a screenshot's pixels, for comparing frames
async function raw(png) { const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, n: info.width * info.height }; }
// every tenth of a screen: the moments where no picture shows
const empties = (page) => page.evaluate(() => {
  const total = accrochage.segs.at(-1).b, empty = [];
  for (let v = 0; v <= total + 1e-6; v += 0.1) {
    accrochage.go(v);
    if (!accrochage.sets.flat().some((c) => c.mesh.visible)) empty.push(+v.toFixed(1));
  }
  accrochage.go(0);
  return { total, empty };
});

try {
  // ——— desktop ———
  const W = 1440, H = 900, { ctx, page, loaded } = await open(browser, URL0, { viewport: { width: W, height: H } }, errors);
  ok("loaded", loaded === true, loaded === true ? "" : "the pictures did not finish loading in 60 s");
  await page.waitForFunction(() => accrochage.state.intro >= 1, null, { timeout: 20000 }).catch(() => {});

  // the title on the first screen: its letters (title on, minus title off, with no pictures), then how many of them the
  // pictures cover; drawn frame by frame with the clock stopped, so nothing else moves between the three frames
  await page.evaluate(() => { accrochage.go(0); accrochage.record(true); });
  const frame = (cards, title) => page.evaluate(([c, t]) => {
    for (const x of accrochage.sets.flat()) { x.mat.visible = c; if (x.refl) x.refl.material.visible = c; if (x.disc) x.disc.material.visible = c; }
    accrochage.title.material.visible = t; accrochage.tick(0, 0);
  }, [cards, title]);
  const shots = [];
  for (const [c, t] of [[true, true], [false, true], [false, false]]) { await frame(c, t); await sleep(120); shots.push(await raw(await page.screenshot())); }
  await frame(true, true);
  await page.evaluate(() => accrochage.record(false));
  const [all, letters, bare] = shots;
  let n = 0, hid = 0;
  for (let p = 0; p < all.n; p++) {
    const k = p * 3, d = (a, b) => Math.max(Math.abs(a.data[k] - b.data[k]), Math.abs(a.data[k + 1] - b.data[k + 1]), Math.abs(a.data[k + 2] - b.data[k + 2]));
    if (d(letters, bare) > 40) { n++; if (d(all, letters) > 40) hid++; }
  }
  const cover = n ? hid / n : 1;
  ok("title", n > 2000 && cover < 0.34, n > 2000 ? `pictures cover ${(cover * 100).toFixed(0)}% of the title's letters on the first screen` : "the title doesn't show on the first screen");

  const { total, empty } = await empties(page);
  ok("cards", !empty.length, `${total.toFixed(1)} screens of scroll${empty.length ? `; no picture at ${empty.slice(0, 6).join(", ")}` : ""}`);

  // the sheet's moments: the opening, each scene's middle and each change's middle
  const tiles = [];
  const segs = await page.evaluate(() => accrochage.segs.map((s) => ({ hold: s.hold, a: s.a, b: s.b })));
  await page.evaluate(() => accrochage.go(0)); await sleep(500); tiles.push(await page.screenshot());
  for (const s of segs) { await page.evaluate((v) => accrochage.go(v), (s.a + s.b) / 2); await sleep(350); tiles.push(await page.screenshot()); }

  // hover, open, Escape: a picture near the middle of the first scene
  const v1 = (segs[0].a + segs[0].b) / 2;
  await page.evaluate((v) => accrochage.go(v), v1); await sleep(600);
  const spot = await page.evaluate(() => {
    const cam = accrochage.camera, c = accrochage.sets[0].filter((c) => c.mesh.visible && c.pose.w > 0.6)
      .map((c) => { const v = c.mesh.position.clone().project(cam); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, z: v.z }; })
      .filter((p) => p.x > 80 && p.x < innerWidth - 80 && p.y > 120 && p.y < innerHeight - 120 && p.z < 1)
      .sort((a, b) => Math.hypot(a.x - innerWidth / 2, a.y - innerHeight / 2) - Math.hypot(b.x - innerWidth / 2, b.y - innerHeight / 2));
    return c[0] || null;
  });
  if (!spot) { ok("hover", false, "no picture in reach in the first scene"); ok("open", false, "no picture to click"); }
  else {
    await page.mouse.move(spot.x - 40, spot.y - 40); await page.mouse.move(spot.x, spot.y, { steps: 8 }); await sleep(500);
    const tip = await page.evaluate(() => { const t = document.querySelector(".a-tip"); return { on: t.classList.contains("on"), text: [...t.childNodes].map((e) => e.textContent.trim()).filter(Boolean).join(" ") }; });
    ok("hover", tip.on && !!tip.text, tip.on ? `“${tip.text}”` : "no label under the cursor");
    await page.mouse.click(spot.x, spot.y); await sleep(1400);
    const cap = await page.evaluate(() => ({ on: document.querySelector(".a-cap").classList.contains("on"), title: document.querySelector(".a-cap h2")?.textContent || "" }));
    tiles.push(await page.screenshot());
    await page.keyboard.press("Escape"); await sleep(900);
    const back = await page.evaluate(() => accrochage.state.sel === -1 && !document.querySelector(".a-cap").classList.contains("on"));
    ok("open", cap.on && !!cap.title && back, cap.on ? `“${cap.title}” came forward${back ? " and went back" : ", but Escape didn't put it back"}` : "clicking a picture didn't bring it forward");
  }

  // Index: open it, pick a picture from the middle of the list
  await page.click(".a-index"); await sleep(700);
  const listOpen = await page.evaluate(() => document.querySelector(".a-list").classList.contains("open"));
  const k = Math.floor(pg.items.length / 2);
  if (listOpen) { await page.click(`.a-list li[data-i="${k}"] button`); await sleep(1800); }
  const sel = await page.evaluate(() => accrochage.state.sel);
  ok("index", listOpen && sel === k, !listOpen ? "Index didn't open" : sel === k ? `picture ${pg.items[k].id} brought into view` : `picked ${pg.items[k].id}, showing ${sel}`);
  await ctx.close();

  // ——— phone ———
  const ph = await open(browser, URL0, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, errors);
  await ph.page.waitForFunction(() => accrochage.state.intro >= 1, null, { timeout: 20000 }).catch(() => {});
  const fit = await ph.page.evaluate(() => ({ scroll: document.scrollingElement.scrollWidth, vw: innerWidth }));
  const pe = await empties(ph.page);
  const phoneTiles = [];
  for (const v of [0, (segs[2]?.a + segs[2]?.b) / 2 || 1, segs.at(-1).b]) { await ph.page.evaluate((x) => accrochage.go(x), v); await sleep(400); phoneTiles.push(await ph.page.screenshot()); }
  ok("phone", fit.scroll <= fit.vw + 1 && !pe.empty.length, `page ${fit.scroll} px wide in ${fit.vw}${pe.empty.length ? `; no picture at ${pe.empty.slice(0, 6).join(", ")}` : ""}`);
  await ph.ctx.close();

  const uniq = [...new Set(errors)];
  ok("console", !uniq.length, uniq.slice(0, 3).join(" | "));

  // ——— the sheet: the scroll in rows of three, then the phone ———
  const TW = 480, TH = 300, cols = 3, rows = Math.ceil(tiles.length / cols), PH = Math.max(TH * 2 + 8, 520), PW = Math.round(PH * 390 / 844);
  const desk = await Promise.all(tiles.map((b) => sharp(b).resize(TW, TH).png().toBuffer()));
  const phones = await Promise.all(phoneTiles.map((b) => sharp(b).resize(PW, PH).png().toBuffer()));
  const comps = [...desk.map((b, i) => ({ input: b, left: 10 + (i % cols) * (TW + 8), top: 10 + Math.floor(i / cols) * (TH + 8) })),
    ...phones.map((b, i) => ({ input: b, left: 10 + cols * (TW + 8) + 8 + i * (PW + 8), top: 10 }))];
  await sharp({ create: { width: 20 + cols * (TW + 8) + 8 + phones.length * (PW + 8), height: Math.max(rows * (TH + 8), PH) + 20, channels: 3, background: "#1c1b1e" } })
    .composite(comps).jpeg({ quality: 84 }).toFile(OUT);
} catch (e) {
  ok("run", false, e.message.split("\n")[0]);
}
await browser.close(); site.close();
for (const r of results) console.log(`${r.pass ? "pass" : "FAIL"}  ${r.name.padEnd(8)} ${r.note ?? ""}`);
console.log(`sheet → ${OUT}`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
