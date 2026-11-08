// A prop for the stage or the gallery: a photographed pedestal, stand, plate charger or lazy susan, cut out by name and
// cropped to itself. It goes in tools/subjects/<id>.json:
//   "props": { "pedestal": { "prompt": "Studio photograph of a single tall fluted museum pedestal …", "keep": "pedestal", "aspect": "9:16" } }
//
//   node prop.mjs <id> <name>                  → site/<id>/img/<name>.webp (900 px wide, transparent round it) and
//                                                <name>.json { w, h, top }: top is the middle of its top face (where a
//                                                subject's feet go), in the image's own pixels. 22 credits: the photo
//                                                20, the cut-out 2
//   node prop.mjs <id> <name> --redo           a new photo
//   node prop.mjs <id> <name> --photo my.jpg   cut out your own picture instead (2 credits)
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { OUT, SITE, SKILL, TOOLS, flag, loadSubjects, words } from "./common.mjs";
import { file, generate } from "./gen.mjs";
import { samAlpha } from "./mask.mjs";

const argv = process.argv.slice(2);
const [id, name] = words(argv, ["--redo"]);
const S = loadSubjects(id);
const P = S.props?.[name];
const own = flag(argv, "--photo");
if (!name || (!P && !own)) { console.error(`usage: node prop.mjs <id> <name>, with "props": { "${name ?? "pedestal"}": { "prompt", "keep", "aspect" } } in tools/subjects/${id}.json`); process.exit(1); }
const dir = join(OUT, id, "props");
mkdirSync(dir, { recursive: true });
const photo = join(dir, `${name}.png`), cut = join(dir, `${name}-cut.png`);
if (own) await sharp(resolve(TOOLS, own)).rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).png().toFile(photo);
else if (!existsSync(photo) || argv.includes("--redo")) {
  if (existsSync(photo)) copyFileSync(photo, join(dir, `${name}-old.png`));
  await generate("nano-banana-pro", { prompt: P.prompt, aspect_ratio: P.aspect ?? "3:4", resolution: "2K" }, { skill: SKILL, out: photo, label: `${id}/${name} photo` });
}
await generate("sam-3", { image: file(photo), prompt: P?.keep ?? name }, { skill: SKILL, out: cut, label: `${id}/${name} cut-out` });

const { data: rgb, info } = await sharp(photo).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const m = await samAlpha(cut, W, H);
let x0 = W, x1 = -1, y0 = H, y1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
if (x1 < 0) { console.error(`sam-3 found no "${P?.keep ?? name}" in ${photo}: change "keep" to the word for what's in the picture`); process.exit(1); }
const width = x1 - x0 + 1, height = y1 - y0 + 1;
// a top face is an ellipse: its middle is where the outline first reaches the prop's full width
let yMid = y0;
for (let y = y0; y < y0 + width * 0.4; y++) {
  let l = W, r = -1;
  for (let x = x0; x <= x1; x++) if (m[y * W + x] > 127) { if (x < l) l = x; if (x > r) r = x; }
  if (r - l + 1 >= width * 0.985) { yMid = y; break; }
}
// RGBA by hand: colour from the photo, alpha from the mask with a slightly softened edge, cropped to the prop
const soft = await sharp(m, { raw: { width: W, height: H, channels: 1 } }).blur(0.8).extractChannel(0).raw().toBuffer();
const rgba = Buffer.alloc(width * height * 4);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const s = (y + y0) * W + (x + x0), d = (y * width + x) * 4;
  rgba[d] = rgb[s * 3]; rgba[d + 1] = rgb[s * 3 + 1]; rgba[d + 2] = rgb[s * 3 + 2]; rgba[d + 3] = soft[s];
}
const img = join(SITE, id, "img");
mkdirSync(img, { recursive: true });
const outW = Math.min(900, width), k = outW / width;
await sharp(rgba, { raw: { width, height, channels: 4 } }).resize(outW).webp({ quality: 86, alphaQuality: 95 }).toFile(join(img, `${name}.webp`));
const meta = { w: outW, h: Math.round(height * k), top: Math.round((yMid - y0) * k) };
writeFileSync(join(img, `${name}.json`), JSON.stringify(meta));
console.log(`${id}/${name}: site/${id}/img/${name}.webp ${meta.w}×${meta.h}, top face at ${meta.top} px (${(meta.top / meta.h).toFixed(4)} of its height)`);
