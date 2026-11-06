// Turns the kept moves in out/<id>/ into the frames the page scrubs (free, nothing is generated).
//
//   node frames.mjs <id>              every move: site/<id>/frames/<move>/ (1600 wide) and <move>-phone/ (960 wide)
//   node frames.mjs <id> move-2       one move
//   node frames.mjs <id> --rec        also <move>-rec/: every frame at full rate, for the recording (?record and ?rec);
//                                     local only, keep frames/*-rec/ out of what you publish
//   node frames.mjs <id> --key        chroma-green canvases become a neutral grey that keeps their light, the rest loses
//                                     any green cast, and each set gets mask/NNNN.webp (white where a canvas shows) for
//                                     artworks laid on by the page (references/gallery.md)
// Options: --q 64 (WebP quality; 56–60 for busy foliage when a page is over budget), --step 2 (keep every 2nd frame),
//          --phone 960 (the phone set's width; 1280 if phones look soft and the budget allows).
//
// manifest.json: { count, fps, pattern: "{n}.webp", pad: 4, size: [w, h], src: { fps, count, size }, map } — `map` is
// the source frame of each web frame (tracks and canvas quads are per source frame; the last step can be shorter).
import sharp from "sharp";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OUT, SITE, loadWalk, needFfmpeg, probe } from "./common.mjs";

const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const words = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const [id, ...only] = words;
const walk = loadWalk(id);
needFfmpeg();
const Q = +flag("--q", walk.frames?.q ?? 64), STEP = +flag("--step", walk.frames?.step ?? 2), PHONE = +flag("--phone", walk.frames?.phone ?? 960);
const REC = argv.includes("--rec"), KEY = argv.includes("--key") || walk.frames?.key === true;
const names = only.length ? only : Object.keys(walk.moves ?? {});

/** the frames of a video as raw RGB, one at a time (the stream waits while each is handled) */
async function* framesOf(mp4, W, H) {
  const child = spawn("ffmpeg", ["-loglevel", "error", "-i", mp4, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  const size = W * H * 3;
  let frame = Buffer.allocUnsafe(size), have = 0;
  for await (const chunk of child.stdout) {
    let o = 0;
    while (o < chunk.length) {
      const n = Math.min(size - have, chunk.length - o);
      chunk.copy(frame, have, o, o + n);
      have += n; o += n;
      if (have === size) { yield frame; frame = Buffer.allocUnsafe(size); have = 0; }
    }
  }
}

// a square max (dilate) or min (erode) filter of radius r on a 0/1 mask, separable
function morph(m, W, H, r, max) {
  const tmp = new Uint8Array(m.length), out = new Uint8Array(m.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = max ? 0 : 1;
    for (let k = Math.max(0, x - r); k <= Math.min(W - 1, x + r); k++) v = max ? v | m[y * W + k] : v & m[y * W + k];
    tmp[y * W + x] = v;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = max ? 0 : 1;
    for (let k = Math.max(0, y - r); k <= Math.min(H - 1, y + r); k++) v = max ? v | tmp[k * W + x] : v & tmp[k * W + x];
    out[y * W + x] = v;
  }
  return out;
}

// --key: canvases → a grey at their own brightness, green spill removed everywhere; returns the canvas mask (0–255)
function keyed(rgb, W, H) {
  const n = W * H, key = new Uint8Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 3) {
    const r = rgb[p], g = rgb[p + 1], b = rgb[p + 2];
    key[i] = g - Math.max(r, b) > 45 && g > 70 ? 1 : 0;
  }
  const closed = morph(morph(key, W, H, 3, true), W, H, 3, false);
  const wide = morph(closed, W, H, 1, true);
  for (let i = 0, p = 0; i < n; i++, p += 3) {
    const r = rgb[p], g = rgb[p + 1], b = rgb[p + 2];
    if (wide[i]) { const grey = Math.min(255, 0.92 * (0.25 * r + 0.6 * g + 0.15 * b)); rgb[p] = rgb[p + 1] = rgb[p + 2] = grey; }
    else rgb[p + 1] = Math.min(g, (r + b) / 2 + 2);
  }
  const mask = Buffer.alloc(n);
  for (let i = 0; i < n; i++) mask[i] = wide[i] ? 255 : 0;
  return mask;
}

const sizeOf = (d) => readdirSync(d, { recursive: true }).reduce((a, f) => { const p = join(d, String(f)); return a + (statSync(p).isFile() ? statSync(p).size : 0); }, 0);

for (const name of names) {
  const mp4 = join(OUT, id, `${name}.mp4`);
  if (!existsSync(mp4)) { console.error(`no ${mp4}: keep a take first (node moves.mjs ${id} --keep ${name}:<take>)`); process.exitCode = 1; continue; }
  const info = probe(mp4), W = info.width, H = info.height, N = info.count;
  const picks = [];
  for (let i = 0; i < N; i += STEP) picks.push(i);
  if (picks[picks.length - 1] !== N - 1) picks.push(N - 1);      // always end on the last frame: it meets the next stop
  const pickAt = new Map(picks.map((k, i) => [k, i]));
  const sets = [
    { dir: join(SITE, id, "frames", name), width: 1600, q: Q, every: false },
    { dir: join(SITE, id, "frames", `${name}-phone`), width: PHONE, q: Q, every: false },
    ...(REC ? [{ dir: join(SITE, id, "frames", `${name}-rec`), width: 1600, q: 85, every: true }] : []),
  ];
  for (const s of sets) { rmSync(s.dir, { recursive: true, force: true }); mkdirSync(s.dir, { recursive: true }); if (KEY) mkdirSync(join(s.dir, "mask"), { recursive: true }); }
  let i = 0;
  for await (const rgb of framesOf(mp4, W, H)) {
    const web = pickAt.get(i);
    if (web != null || REC) {
      const mask = KEY ? keyed(rgb, W, H) : null;
      await Promise.all(sets.map(async (s) => {
        const n = s.every ? i : web;
        if (n == null) return;
        const h = Math.round((H * s.width) / W / 2) * 2, file = `${String(n + 1).padStart(4, "0")}.webp`;
        await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).resize(s.width, h, { kernel: "lanczos3" }).webp({ quality: s.q }).toFile(join(s.dir, file));
        if (mask) await sharp(mask, { raw: { width: W, height: H, channels: 1 } }).resize(s.width, h).blur(0.6).toColourspace("b-w").webp({ lossless: true }).toFile(join(s.dir, "mask", file));
      }));
    }
    i++;
  }
  for (const s of sets) {
    const h = Math.round((H * s.width) / W / 2) * 2;
    const map = s.every ? Array.from({ length: i }, (_, k) => k) : picks.filter((k) => k < i);
    writeFileSync(join(s.dir, "manifest.json"), JSON.stringify({ count: map.length, fps: info.fps / (s.every ? 1 : STEP), pattern: "{n}.webp", pad: 4, size: [s.width, h], src: { fps: info.fps, count: i, size: [W, H] }, map }));
  }
  console.log(`${name}: ${picks.length} frames from ${i} (${info.fps} → ${(info.fps / STEP).toFixed(0)} fps): ` +
    sets.map((s) => `${s.dir.split("/frames/")[1]} ${(sizeOf(s.dir) / 1e6).toFixed(1)} MB`).join(", "));
}
const pub = existsSync(join(SITE, id, "frames")) ? readdirSync(join(SITE, id, "frames")).filter((d) => !d.endsWith("-rec")).reduce((a, d) => a + sizeOf(join(SITE, id, "frames", d)), 0) : 0;
console.log(`frames published with the page (without -rec): ${(pub / 1e6).toFixed(1)} MB; keep the whole page under about 20 MB`);
