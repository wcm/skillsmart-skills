// The gallery's scenery: soft photos behind the pictures, surfaces they lie on, line drawings, and shapes in front
// (fog, clouds), generated with Skillsmart credits from tools/scenery.json → pages → <id>, then made into web files.
//
//   node scene.mjs <id>                     every piece the page doesn't have yet, then the web files
//   node scene.mjs <id> --only fog,table    redo some (the old master is kept as <name>.bak-N.png)
//   node scene.mjs <id> --fix "…"           one more line added to every prompt in this run
//   node scene.mjs <id> --build             only remake the web files from the masters (free)
//   node scene.mjs <id> --cost              what it would cost, and stop
//
// Kinds (each prompt gets the matching shared style line from scenery.json):
//   back     a soft photo behind the cards, blurred a little more so the pictures stay the sharpest thing
//   surface  a sharp photo of a material to lie on or hang against (a cutting mat, tissue paper, walnut)
//   cutout   an object cut from a white background (2 credits more), blurred as if out of focus
//   luma     a bright shape on black (fog, a cloud): its brightness becomes its opacity, so soft edges stay soft
//   ink      a black shape on white (a skyline): its darkness becomes its opacity
//   lines    a white line drawing on black (a technical drawing): keyed to clean white lines, tinted on the page
// 20 credits a piece (a cut-out 22); failed generations aren't charged. Masters: tools/out/scene/<id>/; web files:
// site/<id>/scene/<name>.webp and scene.json (their sizes); a review sheet: tools/out/scene/<id>/sheet.jpg.
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generate, file } from "./gen.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const id = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const only = flag("--only")?.split(","), fix = flag("--fix"), buildOnly = argv.includes("--build");
const spec = JSON.parse(readFileSync(join(ROOT, "scenery.json"), "utf8"));
const pieces = spec.pages?.[id];
if (!id || !pieces) { console.error(`usage: node scene.mjs <id> [--only a,b] [--fix "…"] [--build] [--cost]   (needs scenery.json → pages → ${id || "<id>"})`); process.exit(1); }
const master = (n, s = "") => join(ROOT, "out", "scene", id, `${n}${s}.png`);
const SITE = join(ROOT, "..", "site", id, "scene");
mkdirSync(dirname(master("x")), { recursive: true }); mkdirSync(SITE, { recursive: true });

const keep = (dest) => {
  if (!existsSync(dest)) return;
  let n = 1;
  while (existsSync(dest.replace(".png", `.bak-${n}.png`))) n++;
  renameSync(dest, dest.replace(".png", `.bak-${n}.png`));
};

async function make(n, s) {
  const style = { back: spec.style, surface: spec.surfaceStyle, lines: spec.linesStyle }[s.kind] || "Plain studio photo, no text, no watermark.";
  const prompt = `${s.prompt} ${style}${fix ? ` ${fix}` : ""}`, fresh = master(n, ".new");
  await generate("nano-banana-pro", { prompt, aspect_ratio: s.aspect || "16:9", resolution: "2K", output_format: "png" }, { skill: "scroll-gallery", out: fresh, label: `${id}/${n}` });
  keep(master(n)); renameSync(fresh, master(n));
  if (s.kind === "cutout") {
    await generate("birefnet-image", { image: file(master(n)), variant: "heavy", resolution: "2K" }, { skill: "scroll-gallery", out: master(n, ".cut"), label: `${id}/${n} cut-out` });
  }
}

// brightness (or darkness) as opacity, for shapes on a flat black (or white) ground; lines: white, keyed harder
async function keyed(f, dark, blur, line = false) {
  const { data, info } = await sharp(f).resize(1800, 1800, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  const ss = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    const a = line ? ss(0.1, 0.7, l) : dark ? ss(0.25, 0.8, 1 - l) : ss(0.05, 0.6, l);
    if (line) { out[j] = out[j + 1] = out[j + 2] = 255; }
    else { out[j] = dark ? 0 : Math.min(255, data[i] * 1.1 + 18); out[j + 1] = dark ? 0 : Math.min(255, data[i + 1] * 1.1 + 18); out[j + 2] = dark ? 0 : Math.min(255, data[i + 2] * 1.1 + 22); }
    out[j + 3] = Math.round(a * 255);
  }
  const img = sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } });
  return blur >= 0.3 ? img.blur(blur) : img;
}

// a piece with no master (one kept from an example) keeps the web file it has
async function web(n, s) {
  const dest = join(SITE, `${n}.webp`);
  if (!existsSync(master(n)) || (s.kind === "cutout" && !existsSync(master(n, ".cut")))) {
    if (!existsSync(dest)) return null;
    const { width, height } = await sharp(dest).metadata();
    return { w: width, h: height, kept: true };
  }
  if (s.kind === "back" || s.kind === "surface") {
    const img = sharp(master(n)).resize(2400, 2400, { fit: "inside" });
    await (s.blur >= 0.3 ? img.blur(s.blur) : img).webp({ quality: s.kind === "surface" ? 84 : 78 }).toFile(dest);
  } else if (s.kind === "cutout") {
    await sharp(master(n, ".cut")).resize(1600, 1600, { fit: "inside" }).blur(Math.max(0.3, s.blur || 0.3)).webp({ quality: 80, alphaQuality: 90 }).toFile(dest);
  } else await (await keyed(master(n), s.kind === "ink", s.blur, s.kind === "lines")).webp({ quality: 86, alphaQuality: 92 }).toFile(dest);
  const { width, height } = await sharp(dest).metadata();
  return { w: width, h: height };
}

if (!buildOnly) {
  const unknown = only?.filter((n) => !pieces[n]) || [];
  if (unknown.length) { console.error(`no piece ${unknown.join(", ")} in scenery.json → pages → ${id}`); process.exit(1); }
  const has = (n, s) => existsSync(join(SITE, `${n}.webp`)) || (existsSync(master(n)) && (s.kind !== "cutout" || existsSync(master(n, ".cut"))));
  const todo = Object.entries(pieces).filter(([n, s]) => (only ? only.includes(n) : !has(n, s)));
  const cost = todo.reduce((a, [, s]) => a + (s.kind === "cutout" ? 22 : 20), 0);
  console.log(`${todo.length} piece${todo.length === 1 ? "" : "s"} to make: ${cost} credits`);
  if (argv.includes("--cost")) process.exit(0);
  let next = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (next < todo.length) {
      const [n, s] = todo[next++];
      try { await make(n, s); }
      catch (e) { if (e.exitCode === 3 || e.exitCode === 5) { next = todo.length; throw e; } console.error(`[${id}/${n}] failed: ${e.message}`); }
    }
  }));
}

// the web files, their sizes, and a review sheet on mid grey (so cut-outs and line drawings show)
const sizes = {}, tiles = [];
let x = 0, y = 0;
for (const [n, s] of Object.entries(pieces)) {
  const size = await web(n, s);
  if (!size) continue;
  sizes[n] = { w: size.w, h: size.h };
  const buf = await sharp(join(SITE, `${n}.webp`)).resize(480, 300, { fit: "contain", background: { r: 128, g: 128, b: 128, alpha: 1 } }).flatten({ background: "#808080" }).toBuffer();
  if (x + 480 > 1940) { x = 0; y += 330; }
  tiles.push({ input: buf, left: x, top: y }, { input: Buffer.from(`<svg width="480" height="26"><text x="0" y="19" font-family="Helvetica" font-size="15" fill="#eee">${n} (${s.kind})</text></svg>`), left: x, top: y + 302 });
  x += 490;
}
writeFileSync(join(SITE, "scene.json"), JSON.stringify(sizes, null, 1) + "\n");
if (tiles.length) {
  await sharp({ create: { width: 1950, height: y + 334, channels: 3, background: "#3a3a3a" } }).composite(tiles).jpeg({ quality: 84 }).toFile(join(ROOT, "out", "scene", id, "sheet.jpg"));
  console.log(`${Object.keys(sizes).length} pieces → site/${id}/scene, sheet → tools/out/scene/${id}/sheet.jpg`);
}
