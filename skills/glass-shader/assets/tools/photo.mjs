// The photo a glass look sits in front of (Steam's rainy street, Liquid's flowers, or one made for your page),
// generated through your Skillsmart account: one nano-banana-pro image at 2K, 20 credits each. The first run may open
// the browser once to connect this computer; with FAL_KEY set it uses that fal.ai key instead, without credits.
//
//   node photo.mjs street                                    the prompt in photos.json → ../site/img/street.jpg
//   node photo.mjs street --fix "more neon, fewer people"    an extra sentence, for this run only
//   node photo.mjs harbour --prompt "A harbour at dusk…"     a new photo; its prompt is saved in photos.json
//   node photo.mjs harbour --aspect 3:2 --prompt "…"         another shape (16:9 by default)
//
// Each run writes site/img/<id>.jpg and keeps the photo it replaces as <id>.bak-N.jpg. A page loads it with
// mount(…, { src: "img/<id>.jpg" }). Failed generations aren't charged.
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "./gen.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SPEC = join(ROOT, "photos.json");
const spec = JSON.parse(readFileSync(SPEC, "utf8"));
const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const id = argv.find((x, i) => !x.startsWith("--") && !argv[i - 1]?.startsWith("--"));
if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error('Usage: node photo.mjs <id> [--prompt "…"] [--aspect 16:9] [--fix "…"]');
  process.exit(2);
}
if (flag("--prompt")) {
  spec.photos[id] = { aspect: flag("--aspect") ?? "16:9", prompt: flag("--prompt") };
  writeFileSync(SPEC, JSON.stringify(spec, null, 2) + "\n");
}
const photo = spec.photos[id];
if (!photo) {
  console.error(`There's no "${id}" in photos.json yet: give it a --prompt`);
  process.exit(2);
}

const fix = flag("--fix");
const dest = join(ROOT, "..", "site", "img", `${id}.jpg`);
const fresh = join(ROOT, "..", "site", "img", `${id}.new.jpg`);
console.log(`Generating ${id}: 20 credits…`);
await generate("nano-banana-pro", {
  prompt: `${spec.style} ${photo.prompt}${fix ? ` ${fix}` : ""}`,
  aspect_ratio: photo.aspect ?? "16:9",
  resolution: "2K",
  output_format: "jpeg",
}, { skill: "glass-shader", out: fresh, label: id });
// only now that the new photo is here does the old one step aside
if (existsSync(dest)) {
  let n = 1;
  while (existsSync(dest.replace(/\.jpg$/, `.bak-${n}.jpg`))) n++;
  renameSync(dest, dest.replace(/\.jpg$/, `.bak-${n}.jpg`));
}
renameSync(fresh, dest);
rmSync(fresh, { force: true });
console.log(`Saved site/img/${id}.jpg`);
