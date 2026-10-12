// The pictures a cloth page needs: the picture on the cloth and the scene around it. Prompts live in images.json;
// each image is generated through the user's Skillsmart account (20 credits; see gen.mjs) or taken from a file.
//
//   node images.mjs                                  every image in images.json
//   node images.mjs velvet                           the images of one page (names starting "velvet-")
//   node images.mjs velvet-art                       one image
//   node images.mjs velvet-art --fix "bolder shapes" one image, with an extra note for this run
//   node images.mjs velvet-art --use ~/photo.jpg     no generation: the user's own picture becomes velvet-art
//
// images.json: { photo, flat, images: { "<name>": { ratio, prompt, style?: "photo" | "flat" | "none", from?: "<name>" } } }
// `style` appends the shared "photo" (default) or "flat" line, or nothing. `from` makes the image an edit of another
// one (e.g. the same scene with something removed), so generate that one first.
// Outputs: ./out/<name>.png (2K masters, earlier versions kept as *.bak-N.png) → ../site/img/<name>.webp

import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { file, generate } from "./gen.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "out");
const SITE = join(ROOT, "..", "site", "img");
const spec = JSON.parse(readFileSync(join(ROOT, "images.json"), "utf8"));
const argv = process.argv.slice(2);
const flag = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const fix = flag("--fix");
const use = flag("--use");
const ids = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const all = Object.keys(spec.images);
const todo = ids.length ? all.filter((n) => ids.some((id) => n === id || n.startsWith(`${id}-`))) : all;
const usage = (msg) => { console.error(msg); process.exit(2); };
if (use && ids.length !== 1) usage("--use takes exactly one image name, e.g. node images.mjs velvet-art --use photo.jpg");
if (!todo.length && !use) usage(`Nothing in images.json matches ${ids.join(", ")}. Names: ${all.join(", ") || "(none yet)"}`);
mkdirSync(OUT, { recursive: true });
mkdirSync(SITE, { recursive: true });

// The web copy: at most 2400 px on the long side, WebP.
const publish = (src, name) => sharp(src).rotate().resize(2400, 2400, { fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toFile(join(SITE, `${name}.webp`));

async function one(name) {
  const s = spec.images[name];
  const style = s.style === "none" ? "" : ` ${spec[s.style ?? "photo"] ?? ""}`;
  const master = join(OUT, `${name}.png`), next = join(OUT, `${name}.new.png`);
  const input = { prompt: `${s.prompt}${style}${fix ? ` ${fix}` : ""}`, aspect_ratio: s.ratio ?? "16:9", resolution: "2K", output_format: "png" };
  if (s.from) {
    const ref = join(OUT, `${s.from}.png`);
    if (!existsSync(ref)) throw new Error(`${name} is an edit of ${s.from}: generate ${s.from} first`);
    input.images = [file(ref)];
  }
  await generate("nano-banana-pro", input, { skill: "cloth-hero", out: next, label: name });
  if (existsSync(master)) {
    let n = 1;
    while (existsSync(master.replace(".png", `.bak-${n}.png`))) n++;
    renameSync(master, master.replace(".png", `.bak-${n}.png`));
  }
  renameSync(next, master);
  await publish(master, name);
  console.log(`[${name}] → site/img/${name}.webp`);
}

if (use) {
  await publish(use, ids[0]);
  console.log(`[${ids[0]}] ${use} → site/img/${ids[0]}.webp (no credits used)`);
} else {
  // side by side, then the edits (`from`) once what they edit exists; a failure is reported and the rest carry on
  const report = (name) => (e) => console.error(`[${name}] failed: ${e.message}`);
  await Promise.all(todo.filter((n) => !spec.images[n].from).map((n) => one(n).catch(report(n))));
  for (const n of todo.filter((n) => spec.images[n].from)) await one(n).catch(report(n));
}
