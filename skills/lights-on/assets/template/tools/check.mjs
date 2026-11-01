// Checks a Lights On page in a headless Chrome the way a visitor uses it, and writes a contact sheet of its light.
//
//   node check.mjs <id>                       sheet → tools/out/<id>/check.jpg
//
//   words     no WRITE left in the scene, and the example's brand is gone from the page
//   pictures  the photo set and the measured light shares are there, and each shot lines up with the day photo
//   loaded    everything loads; no errors in the console and no missing files
//   change    the room is much darker at dusk than by day, and each light adds light where it stands, on its own
//   back      back to day, the picture is the day photo again
//   phone     at 390 × 844 nothing scrolls sideways
//
// The sheet: the day, halfway through the sun leaving, the blue hour, each light on its own, the night, then a phone.
// Exit 0 when all pass, 1 when one fails, 2 when no browser could start.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { TOOLS, launch, open, serve } from "./browser.mjs";

const id = process.argv.slice(2).find((a) => !a.startsWith("--"));
const sceneFile = join(TOOLS, "scenes", `${id}.json`);
if (!id || !existsSync(sceneFile)) { console.error("usage: node check.mjs <id>   (needs tools/scenes/<id>.json)"); process.exit(1); }
const scene = JSON.parse(readFileSync(sceneFile, "utf8"));
const dir = join(TOOLS, "..", "site", id);
const OUT = join(TOOLS, "out", id, "check.jpg");
mkdirSync(dirname(OUT), { recursive: true });
const results = [], ok = (name, pass, note) => results.push({ name, pass, note });
const finish = () => {
  for (const r of results) console.log(`${r.pass ? "ok  " : "FAIL"} ${r.name}${r.note ? `: ${r.note}` : ""}`);
  process.exit(results.every((r) => r.pass) ? 0 : 1);
};

// ——— the words and pictures, before any browser ———
const slots = Object.entries(scene.shots).filter(([, s]) => /WRITE/.test(s.prompt ?? "")).map(([k]) => k);
const page = ["index.html", "main.js"].map((f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : "")).join("\n");
const left = scene.example && page.includes(scene.example);
ok("words", !slots.length && !left, [slots.length ? `WRITE left in the scene: ${slots.join(", ")}` : "", left ? `still says "${scene.example}": rewrite index.html and main.js` : ""].filter(Boolean).join(" · "));
const infoFile = join(dir, "img", "scene.json");
if (!existsSync(infoFile)) { ok("pictures", false, `not prepared yet: python prep.py ${id}`); finish(); }
const info = JSON.parse(readFileSync(infoFile, "utf8"));
const unfit = Object.entries(info.shots).filter(([, r]) => r.moved_px > 40).map(([k]) => k);
const noShare = (scene.solos?.length ?? 0) && !existsSync(join(dir, "img", "weights0.png"));
ok("pictures", !unfit.length && !noShare, [unfit.length ? `moved too far to fit the day photo, make them again: ${unfit.join(", ")}` : "", noShare ? "no light shares (weights0.png): every solo shot must exist" : ""].filter(Boolean).join(" · "));

const browser = await launch();
if (!browser) process.exit(2);
const site = serve(), errors = [], shots = [];
const { page: p } = await open(browser, site.url(id), { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, errors);
await p.waitForTimeout(1500);
const set = async (s) => { await p.evaluate((x) => { jn.set(x); jn.tick(1 / 60); }, s); await p.waitForTimeout(150); };
const mean = async () => { const c = await sharp(await p.screenshot({ type: "png" })).greyscale().stats(); return c.channels[0].mean; };
const shot = async (label) => shots.push({ label, buf: await p.screenshot({ type: "jpeg", quality: 88 }) });
const ids = await p.evaluate(() => jn.lights.map((l) => l.id));
const all = (v) => Object.fromEntries(ids.map((k) => [k, v]));

await set({ sun: 0, ambient: 0, lights: all(0) });
const dayMean = await mean();
await shot("Day");
await set({ sun: 0.5, ambient: 0, lights: all(0) });
await shot("The sun leaving");
await set({ sun: 1, ambient: 0, lights: all(0) });
const dusk = await mean();
await shot("Blue hour");
const weak = [];
for (const k of ids) {
  await set({ sun: 1, ambient: 0, lights: { ...all(0), [k]: 1 } });
  if ((await mean()) < dusk + 0.05) weak.push(k);
  await shot(k);
}
await set({ sun: 1, ambient: 1, lights: all(1) });
const nightMean = await mean();
await shot("Night");
ok("change", dusk < dayMean * 0.8 && nightMean > dusk && !weak.length, [dusk >= dayMean * 0.8 ? "the room hardly darkens at dusk" : "", nightMean <= dusk ? "the lights add nothing at night" : "", weak.length ? `these lights add nothing on their own: ${weak.join(", ")}` : ""].filter(Boolean).join(" · "));
await set({ sun: 0, ambient: 0, lights: all(0) });
const backMean = await mean();
ok("back", Math.abs(backMean - dayMean) < 2.5, Math.abs(backMean - dayMean) < 2.5 ? "" : `day ${dayMean.toFixed(1)}, back to ${backMean.toFixed(1)}`);

const errorsPhone = [];
const { page: ph } = await open(browser, site.url(id), { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, errorsPhone);
await ph.waitForTimeout(1500);
await ph.evaluate(() => jn.tick(1 / 60));
const wide = await ph.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
ok("phone", !wide, wide ? "scrolls sideways" : "");
const phoneShot = await ph.screenshot({ type: "jpeg", quality: 88 });
const uniq = [...new Set([...errors, ...errorsPhone])];
ok("loaded", !uniq.length, uniq.slice(0, 3).join(" | "));
await browser.close(); site.close();

const TW = 640, TH = 400, cols = 3, rows = Math.ceil((shots.length + 1) / cols);
const tag = (t) => Buffer.from(`<svg width="${TW}" height="34"><rect width="${t.length * 9 + 20}" height="28" rx="5" fill="#000" opacity=".72"/><text x="10" y="20" font-family="Helvetica" font-size="15" font-weight="700" fill="#fff">${t.replace(/&/g, "&amp;")}</text></svg>`);
const tiles = [];
for (const [i, s] of shots.entries()) {
  const left = (i % cols) * TW, top = Math.floor(i / cols) * TH;
  tiles.push({ input: await sharp(s.buf).resize(TW, TH).toBuffer(), left, top }, { input: tag(s.label), left: left + 6, top: top + 6 });
}
tiles.push({ input: await sharp(phoneShot).resize({ height: TH }).toBuffer(), left: (shots.length % cols) * TW + 120, top: Math.floor(shots.length / cols) * TH });
await sharp({ create: { width: TW * cols, height: TH * rows, channels: 3, background: "#111" } }).composite(tiles).jpeg({ quality: 84 }).toFile(OUT);
console.log(`sheet → ${OUT}`);
finish();
