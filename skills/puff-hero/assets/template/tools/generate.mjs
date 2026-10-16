// The still: a page's puffy letters, alone on a plain backdrop, from the prompt formula in pages.json:
//   "<Words>, as <material>. <deform> <camera> <frame>"
// Words, material and backdrop are the page's; deform, camera and frame are shared and tested, so every page comes
// out as the same kind of object: wildly deformed, overinflated letters tumbling into one cluster, floating in mid-air
// at a three-quarter angle, with no floor and no shadow on the backdrop (so they cut out cleanly).
//
//   node generate.mjs hero --takes 3     three takes side by side in out/hero/takes.png (numbered)
//   node generate.mjs hero --pick 2      take 2 becomes the still
//   node generate.mjs hero               a single still, no takes
//   node generate.mjs hero --fix "…"     an extra sentence for this run, e.g. "make the R rounder"
//
// Each still is one nano-banana-pro image at 2K: 20 Skillsmart credits, generated through gen.mjs (the first run may
// open the browser once to connect this computer; with FAL_KEY set it uses that fal.ai key instead, without credits).
// Outputs: ./out/<id>/still.png (2K; the one it replaces is kept as still.bak-N.png), take-N.png, takes.png

import sharp from "sharp";
import { mkdirSync, readFileSync, existsSync, renameSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generate } from "./gen.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));

const spec = JSON.parse(readFileSync(join(ROOT, "pages.json"), "utf8"));
const argv = process.argv.slice(2);
const flag = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const fix = flag("--fix"), takes = +(flag("--takes") ?? 0), pick = flag("--pick");
const ids = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const todo = ids.length ? ids : Object.keys(spec.pages);

function prompt(p){
  const words = p.words.charAt(0).toUpperCase() + p.words.slice(1);
  return `${words}, as ${p.material}. ${spec.deform} ${spec.camera} ${spec.frame.replace("{bg}", p.bg)}${fix ? ` ${fix}` : ""}`;
}
function keep(dest){
  if (!existsSync(dest)) return;
  let n = 1;
  while (existsSync(dest.replace(".png", `.bak-${n}.png`))) n++;
  renameSync(dest, dest.replace(".png", `.bak-${n}.png`));
}
async function one(id, dest){
  const p = spec.pages[id], t = Date.now(), name = dest.split("/").pop();
  if (!p) throw new Error(`pages.json has no page "${id}"`);
  // generated next to dest first, so a failed generation leaves the earlier file where it was
  const tmp = dest.replace(/\.png$/, ".new.png");
  await generate("nano-banana-pro", { prompt: prompt(p), aspect_ratio: p.ratio ?? "1:1", resolution: "2K", output_format: "png" },
    { skill: "puff-hero", out: tmp, label: `${id}/${name.replace(/\.png$/, "")}` });
  keep(dest);
  renameSync(tmp, dest);
  console.log(`[${id}] → ${dest} (${((Date.now() - t) / 1000).toFixed(0)}s)`);
}
// a page's takes in a row, numbered
export async function sheet(id, n){
  const H = 560, files = Array.from({ length: n }, (_, k) => join(ROOT, "out", id, `take-${k + 1}.png`)).filter(existsSync);
  if (!files.length) return;
  const tiles = await Promise.all(files.map((f) => sharp(f).resize({ height: H }).png().toBuffer()));
  const ws = await Promise.all(tiles.map(async (t) => (await sharp(t).metadata()).width));
  const label = (k) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="44"><rect width="60" height="44" fill="#000" opacity=".6"/><text x="30" y="31" text-anchor="middle" font-family="Helvetica" font-size="26" fill="#fff">${k}</text></svg>`);
  let x = 0;
  const comp = tiles.flatMap((t, k) => { const c = [{ input: t, left: x, top: 0 }, { input: label(k + 1), left: x + 10, top: 10 }]; x += ws[k] + 8; return c; });
  await sharp({ create: { width: x, height: H, channels: 3, background: "#1c1b1e" } }).composite(comp).png().toFile(join(ROOT, "out", id, "takes.png"));
  console.log(`[${id}] → out/${id}/takes.png (pick one: node generate.mjs ${id} --pick N)`);
}

// run only when called as a script (sheet() can be imported)
const main = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (main) for (const id of todo) mkdirSync(join(ROOT, "out", id), { recursive: true });
if (!main){}
else if (pick){
  for (const id of todo){ keep(join(ROOT, "out", id, "still.png")); copyFileSync(join(ROOT, "out", id, `take-${pick}.png`), join(ROOT, "out", id, "still.png")); console.log(`[${id}] take ${pick} → still.png`); }
} else if (takes){
  await Promise.all(todo.flatMap((id) => Array.from({ length: takes }, (_, k) => one(id, join(ROOT, "out", id, `take-${k + 1}.png`)).catch((e) => console.error(`[${id}] take ${k + 1} failed:`, e.message, e.body ? JSON.stringify(e.body).slice(0, 300) : "")))));
  for (const id of todo) await sheet(id, takes);
} else {
  await Promise.all(todo.map((id) => one(id, join(ROOT, "out", id, "still.png")).catch((e) => console.error(`[${id}] failed:`, e.message, e.body ? JSON.stringify(e.body).slice(0, 400) : ""))));
}
