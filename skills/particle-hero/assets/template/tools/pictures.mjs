// A page's subjects, ready for the engine: each one made from a prompt (or taken from your own photo), cut out, given a
// depth map, and copied into the page as site/<id>/img/<name>.webp (the cut-out) and <name>-depth.png.
//
//   node pictures.mjs <id>                  every subject still missing, then the page copies and a contact sheet
//   node pictures.mjs <id> owl wolf         only these
//   node pictures.mjs <id> owl --force      make it again (the old files are kept as .bak-N)
//   node pictures.mjs <id> owl --fix "…"    add a note to its prompt for this run
//   node pictures.mjs <id> --dry            say what would be made and what it costs, make nothing
//   node pictures.mjs <id> --pack           only the page copies and the sheet, from what's in tools/out/<id>/
//
// The list is tools/pictures/<id>.json (see references/pictures.md):
//   { "background": "black" | "white", "aspect": "1:1", "style": "a sentence added to every prompt",
//     "pictures": [ { "id": "stag", "prompt": "…" }, { "id": "logo", "photo": "../brand/logo.png", "cutout": false } ] }
//
// Credits: a picture 20, a cut-out 2 (your own photo: only the cut-out). Depth maps are made on this computer, free.
import sharp from "sharp";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { CREDITS, OUT, SITE, SKILL, TOOLS, keepOld, loadPictures } from "./common.mjs";
import { depthMap } from "./depth.mjs";
import { file, generate } from "./gen.mjs";

const argv = process.argv.slice(2);
const flag = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const words = argv.filter((a, i) => !a.startsWith("--") && !(argv[i - 1] === "--fix"));
const [id, ...only] = words;
const force = argv.includes("--force"), dry = argv.includes("--dry"), packOnly = argv.includes("--pack");
const fix = flag("--fix");
const spec = loadPictures(id);
const dir = join(OUT, id);

const GROUND = {
  black: "Photographed in a dark studio on a pure black seamless background, nothing else in the frame. Crisp detail, natural colours, no text, no watermark. The whole subject sits inside the frame with a generous margin all round, nothing cut off by the edges.",
  white: "Photographed on a pure white seamless background, nothing else in the frame, soft diffused studio light, a faint soft shadow, crisp detail, natural colours, no text, no logo, no label, no watermark. The whole subject sits inside the frame with a generous margin all round, nothing cut off by the edges.",
};
const ground = GROUND[spec.background ?? "black"];
if (!ground) { console.error(`background must be "black" or "white"`); process.exit(1); }

const list = (spec.pictures ?? []).filter((p) => !only.length || only.includes(p.id));
if (!list.length) { console.error(`nothing to make: no pictures${only.length ? ` named ${only.join(", ")}` : ""} in tools/pictures/${id}.json`); process.exit(1); }
const paths = (p) => ({ master: join(dir, `${p.id}.png`), cut: join(dir, `${p.id}-cut.png`), depth: join(dir, `${p.id}-depth.png`) });

// what this run will make, and its cost
const plan = list.map((p) => {
  const f = paths(p);
  return {
    p, f,
    make: !packOnly && !p.photo && (force || !existsSync(f.master)),
    cut: !packOnly && p.cutout !== false && (force || !existsSync(f.cut)),
    depth: !packOnly && (force || !existsSync(f.depth)),
  };
});
const credits = plan.reduce((s, x) => s + (x.make ? CREDITS.picture : 0) + (x.cut ? CREDITS.cutout : 0), 0);
const made = plan.filter((x) => x.make).length, cuts = plan.filter((x) => x.cut).length;
console.log(`${id}: ${plan.length} subject(s) · ${made} to make (${CREDITS.picture} each) · ${cuts} to cut out (${CREDITS.cutout} each) · ${credits} credits${process.env.FAL_KEY ? " (or your fal.ai key)" : ""}`);
if (dry) process.exit(0);

async function one({ p, f, make, cut, depth }) {
  const tag = `${id}/${p.id}`;
  mkdirSync(dir, { recursive: true });
  if (p.photo && (force || !existsSync(f.master))) {
    const src = resolve(TOOLS, p.photo);
    if (!existsSync(src)) throw new Error(`${tag}: no photo at ${src}`);
    keepOld(f.master);
    await sharp(src).rotate().png().toFile(f.master);
  }
  if (make) {
    keepOld(f.master);
    const prompt = [p.prompt, spec.style, ground, fix].filter(Boolean).join(" ");
    await generate("nano-banana-pro", { prompt, aspect_ratio: p.aspect ?? spec.aspect ?? "1:1", resolution: "2K", output_format: "png" }, { skill: SKILL, out: f.master, label: tag });
  }
  if (!existsSync(f.master)) throw new Error(`${tag}: no picture yet (tools/out/${id}/${p.id}.png)`);
  if (cut) {
    keepOld(f.cut);
    await generate("birefnet-image", { image: file(f.master), variant: "heavy", resolution: "2K" }, { skill: SKILL, out: f.cut, label: `${tag} cut-out` });
  }
  if (p.cutout === false && !existsSync(f.cut)) copyFileSync(f.master, f.cut);
  if (depth) { await depthMap(f.master, f.depth); console.log(`[${tag}] depth ✓`); }
  // the page's copies: 1024 px on the long side is all the engine reads
  const img = join(SITE, id, "img");
  mkdirSync(img, { recursive: true });
  const fit = { width: 1024, height: 1024, fit: "inside" };
  await sharp(f.cut).resize(fit).webp({ quality: 90, alphaQuality: 100 }).toFile(join(img, `${p.id}.webp`));
  await sharp(f.depth).resize(fit).grayscale().png().toFile(join(img, `${p.id}-depth.png`));
}

// a few at a time (depth maps one after another: they share the model)
let failures = 0;
const queue = [...plan];
await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
  while (queue.length) {
    const job = queue.shift();
    try { await one(job); } catch (e) { failures++; console.error(`[${id}/${job.p.id}] ${e.message}`); if (e.exitCode === 3 || e.exitCode === 5) queue.length = 0; }
  }
}));

// a contact sheet to look at: each subject as made, cut out over grey, and its depth
const C = 300, rows = [];
for (const { p, f } of plan) if ([f.master, f.cut, f.depth].every(existsSync)) rows.push([f.master, f.cut, f.depth]);
if (rows.length) {
  const tiles = await Promise.all(rows.flatMap((r, y) => r.map(async (src, x) => ({
    input: await sharp(src).resize(C - 6, C - 6, { fit: "contain", background: x === 1 ? "#808080" : "#202020" }).flatten({ background: x === 1 ? "#808080" : "#202020" }).png().toBuffer(),
    left: x * C + 3, top: y * C + 3,
  }))));
  await sharp({ create: { width: 3 * C, height: rows.length * C, channels: 3, background: "#111" } }).composite(tiles).jpeg({ quality: 85 }).toFile(join(dir, "sheet.jpg"));
  console.log(`sheet → tools/out/${id}/sheet.jpg (each row: the picture, its cut-out over grey, its depth)`);
}
if (failures) { console.error(`${failures} subject(s) failed`); process.exitCode ||= 1; }
else console.log(`✓ site/${id}/img/ is ready`);
