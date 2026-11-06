// One object cut out of a picture or a frame by name (2 credits; failed ones are free). The model wants a short noun
// ("branch", "sofa", "plant"); a long phrase often comes back empty, so try another short word if it does.
//
//   node mask.mjs <id> occluder "branch"            the title's foreground: the object on the first frame of the walk,
//                                                   → site/<id>/img/occ/0001.webp and img/occ-phone/0001.webp (white
//                                                   where the object is, in front of the title)
//   node mask.mjs <id> occluder "plant" --box 0,0.3,1,0.7   keep only the part inside that box (shares of the frame)
//   node mask.mjs <id> cut out/<id>/sofa.png "sofa" sofa   → out/<id>/sofa-cut.png (the object on transparency) and
//                                                   sofa-mask.png (white where it is): a product, a recolour mask, an
//                                                   object to lift
// With FAL_KEY set, your own fal.ai key is used instead of credits.
import sharp from "sharp";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { file as ref, generate } from "./gen.mjs";
import { OUT, SITE, SKILL, loadWalk, needFfmpeg } from "./common.mjs";

const argv = process.argv.slice(2);
const flag = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const words = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const [id, what, ...rest] = words;
const walk = loadWalk(id);
const dir = join(OUT, id);

async function cut(src, noun, out) {
  await generate("sam-3", { image: ref(src), prompt: noun }, { skill: SKILL, out, label: `${id}/${noun}` });
  const { width, height } = await sharp(src).metadata();
  const alpha = await sharp(out).ensureAlpha().extractChannel(3).resize(width, height).raw().toBuffer();
  if (!alpha.some((v) => v > 0)) console.warn(`"${noun}" came back empty: try another short noun`);
  return { alpha, width, height };
}

if (what === "occluder") {
  needFfmpeg();
  const noun = rest[0];
  const move = flag("--move") ?? Object.keys(walk.moves ?? {})[0];
  const mp4 = join(dir, `${move}.mp4`);
  if (!noun || !existsSync(mp4)) { console.error(`usage: node mask.mjs ${id} occluder "<noun>" (needs out/${id}/${move}.mp4)`); process.exit(1); }
  // the first frame the page shows is this clip's first frame, so the mask is cut from it, not from the picture
  const first = join(dir, `${move}-first.png`);
  spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-i", mp4, "-vf", "select=eq(n\\,0)", "-frames:v", "1", first]);
  const { alpha, width, height } = await cut(first, noun, join(dir, "occluder-cut.png"));
  let m = sharp(alpha, { raw: { width, height, channels: 1 } });
  if (flag("--box")) {
    const [x0, y0, x1, y1] = flag("--box").split(",").map(Number);
    const box = await sharp(Buffer.from(`<svg width="${width}" height="${height}"><rect x="${x0 * width}" y="${y0 * height}" width="${(x1 - x0) * width}" height="${(y1 - y0) * height}" fill="#fff"/></svg>`)).ensureAlpha().extractChannel(3).raw().toBuffer();
    const a = await m.raw().toBuffer();
    for (let i = 0; i < a.length; i++) a[i] = Math.min(a[i], box[i]);
    m = sharp(a, { raw: { width, height, channels: 1 } });
  }
  const raw = await m.raw().toBuffer();
  for (const [sub, w] of [["occ", 1600], ["occ-phone", 960]]) {
    const d = join(SITE, id, "img", sub);
    mkdirSync(d, { recursive: true });
    await sharp(raw, { raw: { width, height, channels: 1 } }).resize(w, Math.round((height * w) / width / 2) * 2).toColourspace("b-w").webp({ lossless: true }).toFile(join(d, "0001.webp"));
  }
  console.log(`occluder → site/${id}/img/occ/0001.webp, occ-phone/0001.webp; in tour.json: "occluder": { "masks": "img/occ/{n}.webp", "frames": [1, 1] }`);
} else if (what === "cut") {
  const [src, noun, name] = rest;
  if (!src || !noun || !name) { console.error(`usage: node mask.mjs ${id} cut <picture> "<noun>" <name>`); process.exit(1); }
  const { alpha, width, height } = await cut(resolve(src), noun, join(dir, `${name}-cut.png`));
  await sharp(alpha, { raw: { width, height, channels: 1 } }).toColourspace("b-w").png().toFile(join(dir, `${name}-mask.png`));
  console.log(`→ ${join(dir, `${name}-cut.png`)}, ${join(dir, `${name}-mask.png`)}`);
} else {
  console.error(`usage: node mask.mjs ${id} occluder "<noun>" | cut <picture> "<noun>" <name>`);
  process.exit(1);
}
