// Character asset pipeline: prompt (+ optional refs) → clean key-colour still → pose stills → pose-to-pose videos
// → one alpha WebP frame sequence with a mark at each pose.
//
//   FAL_KEY=... node generate.mjs <id>                        all steps
//   FAL_KEY=... node generate.mjs <id> --steps image          just the rest still (check it before paying for more)
//   FAL_KEY=... node generate.mjs <id> --steps poses          pose stills edited from the rest still (check them too)
//   FAL_KEY=... node generate.mjs <id> --steps clips          rest → pose 1 → pose 2 → … videos (+ frames)
//   FAL_KEY=... node generate.mjs <id> --steps clips --clip 2 redo just one clip (others are kept) and re-cut frames
//   node generate.mjs <id> --steps frames                     re-cut frames from existing clips (no fal calls)
//   FAL_KEY=... node generate.mjs <id> --edit "fix only X…" [--target clean|pose-2]
//                                                             targeted edit of one still (previous version kept as *.bak-N.png)
// Review sheets: out/<id>/poses-sheet.png (after poses) and out/<id>/seq-sheet.png (after frames).
//
// Everything about a character lives in ../site/characters/<id>/character.json:
// the page reads `name`/`scenes`/`eyes`, this script reads `generate` (`imagePrompt`, `poses[]`, `poseNote`, `key`).
// Each clip starts and ends on exact stills, so the sequence settles precisely on every pose.
// Outputs: ../site/characters/<id>/{still.png, hero.webp, seq/}   (seq/manifest.json has bbox + pose marks)
//          ./out/<id>/{clean.png, pose-N.png, clip-N.mp4}          (intermediates)

import { fal } from "@fal-ai/client";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(ROOT, "..");

const IMAGE_MODEL = "fal-ai/nano-banana-pro";           // text → image
const IMAGE_EDIT_MODEL = "fal-ai/nano-banana-pro/edit"; // refs → image
const VIDEO_MODEL = "fal-ai/kling-video/v3/pro/image-to-video";
const FPS = 24;
const WIDTH = 720;
const ALL_STEPS = ["image", "poses", "clips", "frames"];

const argv = process.argv.slice(2);
const id = argv.find((a) => !a.startsWith("--"));
if (!id) throw new Error("usage: node generate.mjs <character-id> [--steps image,poses,clips,frames,measure]");
const stepsArg = argv[argv.indexOf("--steps") + 1];
const steps = new Set(argv.includes("--steps") ? stepsArg.split(",") : ALL_STEPS);
const only = argv.includes("--clip") ? Number(argv[argv.indexOf("--clip") + 1]) : null;
const editPrompt = argv.includes("--edit") ? argv[argv.indexOf("--edit") + 1] : null;
const editTarget = argv.includes("--target") ? argv[argv.indexOf("--target") + 1] : "clean";
if (editPrompt) steps.clear();

const SITE_DIR = join(PROJECT, "site", "characters", id);
const OUT = join(ROOT, "out", id);
const spec = JSON.parse(readFileSync(join(SITE_DIR, "character.json"), "utf8"));
const gen = spec.generate;
const poses = gen.poses ?? [];
const key = { color: "#00B140", similarity: 0.14, blend: 0.08, despill: "green", ...gen.key };
const fill = (s) => s.replaceAll("{KEY}", key.color);
const CLEAN = join(OUT, "clean.png");
const posePath = (n) => (n === 0 ? CLEAN : join(OUT, `pose-${n}.png`));
const clipPath = (n) => join(OUT, `clip-${n}.mp4`);
mkdirSync(OUT, { recursive: true });

// Side-by-side contact sheet of square images on a flat backdrop, for reviewing a batch at a glance.
async function sheet(files, dest, bg = "#ffffff", tile = 480) {
  const tiles = await Promise.all(files.filter(existsSync).map(async (f) => {
    const fg = await sharp(f).resize(tile, tile).toBuffer();
    return sharp({ create: { width: tile, height: tile, channels: 3, background: bg } }).composite([{ input: fg }]).png().toBuffer();
  }));
  await sharp({ create: { width: tile * tiles.length, height: tile, channels: 3, background: bg } })
    .composite(tiles.map((input, i) => ({ input, left: i * tile, top: 0 }))).png().toFile(dest);
  console.log(`[${id}] review sheet → ${dest}`);
}

async function upload(path) {
  const type = path.endsWith(".png") ? "image/png" : "image/jpeg";
  return fal.storage.upload(new Blob([readFileSync(path)], { type }));
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url}: ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

const log = (tag) => (update) => {
  if (update.status === "IN_PROGRESS") update.logs?.forEach((l) => console.log(`  [${id}/${tag}]`, l.message));
};

async function editImage(prompt, refs, dest, tag) {
  const model = refs.length ? IMAGE_EDIT_MODEL : IMAGE_MODEL;
  const input = { prompt, aspect_ratio: "1:1", resolution: "2K", output_format: "png" };
  if (refs.length) input.image_urls = await Promise.all(refs.map(upload));
  const { data } = await fal.subscribe(model, { input, logs: true, onQueueUpdate: log(tag) });
  return download(data.images[0].url, dest);
}

async function image() {
  const refs = (gen.refs ?? []).map((r) => resolve(PROJECT, r)).filter(existsSync);
  console.log(`[${id}] rest still`, refs.length ? `(${refs.length} refs)` : "");
  await editImage(fill(gen.imagePrompt), refs, CLEAN, "image");
  await keyStill(CLEAN, join(SITE_DIR, "still.png"));
}

// Every pose is an edit of the rest still, so identity, outfit and framing carry over.
async function poseStills() {
  if (!existsSync(CLEAN)) throw new Error(`${CLEAN} missing, run --steps image first`);
  await Promise.all(poses.map((p, i) => {
    console.log(`[${id}] pose ${i + 1}: ${p.name}`);
    return editImage(fill(`${p.pose} ${gen.poseNote ?? ""}`), [CLEAN], posePath(i + 1), `pose-${i + 1}`);
  }));
  await sheet([CLEAN, ...poses.map((_, i) => posePath(i + 1))], join(OUT, "poses-sheet.png"));
}

// One targeted fix on a still, keeping everything else: e.g. "make the trouser hems solid", "add white headphones".
async function edit() {
  const src = editTarget === "clean" ? CLEAN : join(OUT, `${editTarget}.png`);
  if (!existsSync(src)) throw new Error(`${src} missing`);
  let n = 1;
  while (existsSync(src.replace(".png", `.bak-${n}.png`))) n++;
  writeFileSync(src.replace(".png", `.bak-${n}.png`), readFileSync(src));
  console.log(`[${id}] edit ${editTarget} (previous kept as .bak-${n}.png)`);
  await editImage(`${editPrompt} Keep everything else exactly the same: the same character, face, outfit, pose, framing, art style and the perfectly flat solid ${key.color} background.`, [src], src, "edit");
  if (src === CLEAN) await keyStill(CLEAN, join(SITE_DIR, "still.png"));
}

// Clip n runs from pose n-1 (0 = rest) to pose n, pinned by start and end frames.
async function clips() {
  await Promise.all(poses.map(async (p, i) => {
    if (only && only !== i + 1) return;
    const from = posePath(i), to = posePath(i + 1);
    for (const f of [from, to]) if (!existsSync(f)) throw new Error(`${f} missing, run --steps poses first`);
    console.log(`[${id}] clip ${i + 1}: → ${p.name}`);
    const [start, end] = await Promise.all([upload(from), upload(to)]);
    const { data } = await fal.subscribe(VIDEO_MODEL, {
      input: {
        start_image_url: start,
        end_image_url: end,
        prompt: fill(`${p.move} Locked-off static camera, no zoom, no cuts. The character stays in place. ` +
          `The flat chroma-key green background stays perfectly uniform the whole time. Smooth, natural, expressive motion.`),
        duration: "5",
        generate_audio: false,
        negative_prompt: "camera movement, zoom, background change, shadow, extra limbs, text, blur, distortion, walking away",
      },
      logs: true,
      onQueueUpdate: log(`clip-${i + 1}`),
    });
    await download(data.video.url, clipPath(i + 1));
  }));
}

// Average of a corner patch: generated key colours drift from the requested hex.
async function sampleKey(png) {
  const { data } = await sharp(png).removeAlpha().extract({ left: 4, top: 4, width: 24, height: 24 }).raw().toBuffer({ resolveWithObject: true });
  const avg = [0, 1, 2].map((c) => Math.round(data.filter((_, i) => i % 3 === c).reduce((a, b) => a + b, 0) / (data.length / 3)));
  return "0x" + avg.map((v) => v.toString(16).padStart(2, "0")).join("");
}

function keyFilter(k) {
  const f = [`format=rgba`, `chromakey=${k}:${key.similarity}:${key.blend}`];
  if (key.despill) f.push(`despill=type=${key.despill}:mix=0.6:expand=0.1`);
  return f.join(",");
}

async function keyStill(src, dest) {
  const k = await sampleKey(src);
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", src, "-vf", `${keyFilter(k)},scale=${WIDTH * 1.5}:-2:flags=lanczos`, dest]);
}

// All clips → one numbered sequence. Clip n's first frame duplicates clip n-1's last, so it's dropped.
// marks[k] = frame index where the sequence rests on pose k (0 = rest).
async function frames() {
  const mp4s = poses.map((_, i) => clipPath(i + 1)).filter(existsSync);
  if (!mp4s.length) return console.log(`[${id}] no clips, skipping frames`);
  const dir = join(SITE_DIR, "seq");
  const tmp = join(OUT, "png");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const probe = join(OUT, "probe.png");
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", mp4s[0], "-frames:v", "1", probe]);
  const k = await sampleKey(probe);

  // Full-resolution first frame: the big front-facing hero, same framing as the sequence.
  const hero = join(OUT, "hero.png");
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", mp4s[0], "-frames:v", "1", "-vf", keyFilter(k), hero]);
  await sharp(hero).webp({ quality: 86, alphaQuality: 95, effort: 5 }).toFile(join(SITE_DIR, "hero.webp"));

  const marks = [0];
  let n = 0;
  for (const [ci, mp4] of mp4s.entries()) {
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", mp4, "-vf", `fps=${FPS},${keyFilter(k)},scale=${WIDTH}:-2:flags=lanczos`, join(tmp, "%04d.png")]);
    const files = readdirSync(tmp).filter((f) => f.endsWith(".png")).sort().slice(ci === 0 ? 0 : 1);
    for (const f of files) {
      n++;
      await sharp(join(tmp, f)).webp({ quality: 78, alphaQuality: 90, effort: 5 }).toFile(join(dir, String(n).padStart(4, "0") + ".webp"));
    }
    marks.push(n - 1);
  }
  rmSync(tmp, { recursive: true, force: true });
  console.log(`[${id}] seq: ${n} frames, marks ${marks.join(" ")} (key ${k})`);
  await measure({ marks });
  const pick = [0, 0.17, 0.33, 0.5, 0.67, 0.83, 1].map((t) => join(dir, String(Math.round(t * (n - 1)) + 1).padStart(4, "0") + ".webp"));
  await sheet(pick, join(OUT, "seq-sheet.png"), gen.reviewBg ?? "#e83e8c", 300);
}

// Bounding boxes of the figure as fractions of the frame: the union across all frames (side scenes) and the
// rest pose alone (the peeking hero). The page uses them to place the character.
async function measure(extra = {}) {
  const dir = join(SITE_DIR, "seq");
  if (!existsSync(dir)) return;
  const prev = existsSync(join(dir, "manifest.json")) ? JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) : {};
  const files = readdirSync(dir).filter((f) => f.endsWith(".webp")).sort();
  let W, H, x0 = 1, y0 = 1, x1 = 0, y1 = 0, rest;
  for (const f of files) {
    const { data, info } = await sharp(join(dir, f)).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
    W = info.width; H = info.height;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      if (data[y * W + x] > 128) { x0 = Math.min(x0, x / W); x1 = Math.max(x1, x / W); y0 = Math.min(y0, y / H); y1 = Math.max(y1, y / H); }
    }
    rest ??= [x0, y0, x1, y1]; // first frame = the rest pose, which the hero shows
  }
  const r = (v) => Math.round(v * 1000) / 1000;
  const manifest = { count: files.length, fps: FPS, width: W, height: H, pattern: "{n}.webp", pad: 4,
    bbox: [r(x0), r(y0), r(x1), r(y1)], restBbox: rest.map(r), marks: extra.marks ?? prev.marks };
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`[${id}] seq: bbox ${manifest.bbox.join(" ")}`);
}

const needsFal = editPrompt || ["image", "poses", "clips"].some((s) => steps.has(s));
if (needsFal) {
  if (!process.env.FAL_KEY) throw new Error("Set FAL_KEY (https://fal.ai/dashboard/keys)");
  fal.config({ credentials: process.env.FAL_KEY });
}
if (editPrompt) await edit();
if (steps.has("image")) await image();
if (steps.has("poses")) await poseStills();
if (steps.has("clips")) await clips();
if (steps.has("clips") || steps.has("frames")) await frames();
if (steps.has("measure")) await measure();
console.log(`[${id}] done`);
