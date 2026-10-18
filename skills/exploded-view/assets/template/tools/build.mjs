// Exploded View: every picture a page needs, generated through Skillsmart (gen.mjs) and prepared for the page.
//
//   node build.mjs <id> --stills          the pictures to check before any video (about 70 credits)
//   node build.mjs <id> --motion          the rest (about 210 credits)
//   node build.mjs <id>                   every step that is missing or older than what it is made from
//   node build.mjs <id> --only place2     just those steps (comma-separated), even when they are up to date
//   node build.mjs <id> --from clips      that step and every later one, even when they are up to date
//   node build.mjs <id> --fix "…"         one more sentence for the prompts of the steps that run
//   node build.mjs <id> --cost            what the steps would cost, without running them
//   node build.mjs <id> --takes 3 --only place1    three first photos side by side (out/<id>/place1-takes.jpg); then --pick 2
//   node build.mjs <id> --takes 2 --only clips     two takes of each clip (out/<id>/clips-takes-a.jpg, -b.jpg); then --pick a2,b1
//   node build.mjs <id> --only clips,mattes,frames,web --clip a    redo one clip only (a comes apart, b closes)
//
// --stills  place1    the product in its first place, from the prompt (20 credits)
//           cut1      the product cut out of place1 (4), trying in turn (references/cut-outs.md):
//                       1  BiRefNet's soft edges (2) inside SAM 3's mask of the product, found by a common word: `find`,
//                          or `noun` (2). It leaves out what only touches the product: a stand, a reflection, a tray.
//                          When SAM 3 finds nothing (not charged) or the wrong thing, BiRefNet alone, with a warning.
//                          `"cut": "birefnet"` skips SAM 3 for a product that stands free.
//                       2  `detach1`, naming what still clings ("the stove under it"): an edit of the cut-out on the
//                          plain backdrop takes it away, and only what is left is kept (+22)
//                          With `patch1` polygons around the thing when it sits in front of the product (a stand's
//                          cradle under a headband): there the cut-out takes the edited picture, which painted it in
//                       3  `erase1`: polygons in the photo (u, v from 0 to 1) cleared by hand (free)
//                     Also studio1: the cut-out alone on the backdrop, centred at `fit` of the frame's height (clip a's
//                     first frame). After changing find, detach or erase, redo it with --only cut1.
//           place2    the same product, whole, at a new angle in its second place: an edit of studio1 (20)
//           cut2      the same for place2 (`detach2`, `erase2`), and studio2 at the same size (clip b's last frame)
//           exploded  the exploded view: an edit of studio1 (20)
//           cutx      the exploded view cut out with BiRefNet (2); `dropx` points on parts it shouldn't have paint them
//                     out of exploded.png itself (then redo the clips)
// --motion  plates    place1 and place2 with the product removed (2 × 20): what stays when it lifts away
//           clips     Kling: studio1 → exploded (a) and exploded → studio2 (b), 5 s each (2 × 75)
//           mattes    BiRefNet masks of both clips (2 × 10)
//           frames    both clips as alpha WebP frames, cropped to where the product goes (free)
//                     `"specks": 0.03` in the subject clears small round blobs that flash in a clip (sauce drops, crumbs)
//                     from every frame and from cutx; redo with --only cutx,frames,web
//           web       photos, plates and cut-outs as WebP, and layout.json: every box the page lines up (free)
//
// Prompts live in subjects.json. Generation goes through the user's Skillsmart account with credits (gen.mjs); with
// FAL_KEY set on the command it uses that fal.ai key instead. Masters, masks and review sheets go to out/<id>/ (keep
// it: any step can be redone without paying for the earlier ones); the page's files go to ../site/<id>/.

import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generate, file } from "./gen.mjs";

const SKILL = "exploded-view";
const ROOT = dirname(fileURLToPath(import.meta.url));
const STILLS = ["place1", "cut1", "place2", "cut2", "exploded", "cutx"];
const MOTION = ["plates", "clips", "mattes", "frames", "web"];
const STEPS = [...STILLS, ...MOTION];
const SECONDS = 5;       // each clip
const PHOTO_W = 2400;    // published photo width
const FRAME_W = 1400;    // published clip frames are at most this wide
const CUT_MAX = 2000;    // published cut-outs are at most this big

const spec = JSON.parse(readFileSync(join(ROOT, "subjects.json"), "utf8"));
const argv = process.argv.slice(2);
const flag = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const id = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
if (!id || !spec.subjects[id]) {
  console.error(`usage: node build.mjs <id> [--stills | --motion | --only steps | --from step] [--fix "…"] [--cost]\nids in subjects.json: ${Object.keys(spec.subjects).join(", ") || "(none yet)"}`);
  process.exit(1);
}
const s = spec.subjects[id];
const unwritten = Object.entries(s).filter(([, v]) => typeof v === "string" && v.startsWith("WRITE")).map(([k]) => k);
if (unwritten.length && !argv.includes("--cost")) {
  console.error(`subjects.json → ${id} still has slots to write: ${unwritten.join(", ")} (references/prompts.md says how)`);
  process.exit(1);
}
const only = flag("--only")?.split(",");
const from = flag("--from");
for (const k of [...(only ?? []), ...(from ? [from] : [])]) if (!STEPS.includes(k)) { console.error(`unknown step "${k}"; steps: ${STEPS.join(", ")}`); process.exit(1); }
const takes = +(flag("--takes") ?? 0);
const pick = flag("--pick");
const CLIPS = flag("--clip") ? [flag("--clip")] : ["a", "b"]; // --clip a: the clips and mattes steps redo only that clip
if (CLIPS.some((ab) => ab !== "a" && ab !== "b")) { console.error('--clip takes "a" (the one that comes apart) or "b" (the one that closes)'); process.exit(1); }
const fix = flag("--fix");
const steps = only ?? (from ? STEPS.slice(STEPS.indexOf(from)) : argv.includes("--stills") ? STILLS : argv.includes("--motion") ? MOTION : STEPS);
const named = Boolean(only || from);
const cutCost = (n) => (s.cut === "birefnet" ? 2 : 4) + (s[`detach${n}`] ? 22 : 0);
const COST = { place1: 20, cut1: cutCost(1), place2: 20, cut2: cutCost(2), exploded: 20, cutx: 2, plates: 40, clips: 150, mattes: 20, frames: 0, web: 0 };

const out = join(ROOT, "out", id), site = join(ROOT, "..", "site", id);
mkdirSync(out, { recursive: true });
const o = (f) => join(out, f);
const run = promisify(execFile);
const ff = (...args) => run("ffmpeg", ["-loglevel", "error", "-y", ...args], { maxBuffer: 1 << 28, encoding: "buffer" });
const fill = (t, detach = "") => t.replaceAll("{noun}", s.noun).replaceAll("{backdrop}", s.backdrop).replaceAll("{backdropName}", s.backdropName)
  .replaceAll("{detach}", detach);
const note = fix ? ` ${fix}` : "";
const gen = (model, input, dest, label) => generate(model, input, { skill: SKILL, out: dest, label: `${id}/${label}` });

// —— which steps are due: missing, or older than what they're made from (like make) ——
const RECIPE = {
  place1: [[], ["place1.png"]],
  cut1: [["place1.png"], ["cut1.png", "studio1.png"]],
  place2: [["studio1.png"], ["place2.png"]],
  cut2: [["place2.png", "cut1.png"], ["cut2.png", "studio2.png"]],
  exploded: [["studio1.png"], ["exploded.png"]],
  cutx: [["exploded.png"], ["cutx.png"]],
  plates: [["place1.png", "place2.png"], ["plate1.png", "plate2.png"]],
  clips: [["studio1.png", "exploded.png", "studio2.png"], ["clip-a.mp4", "clip-b.mp4"]],
  mattes: [["clip-a.mp4", "clip-b.mp4"], ["mask-a.mp4", "mask-b.mp4"]],
  frames: [["clip-a.mp4", "mask-a.mp4", "clip-b.mp4", "mask-b.mp4"], ["frames.json"]],
  web: [["place1.png", "plate1.png", "place2.png", "plate2.png", "cut1.png", "cut2.png", "cutx.png", "frames.json"], ["web.json"]],
};
const mtime = (f) => (existsSync(o(f)) ? statSync(o(f)).mtimeMs : 0);
function due(step) {
  if (!steps.includes(step)) return false;
  if (named) return true;
  const [ins, outs] = RECIPE[step];
  const newest = Math.max(0, ...ins.map(mtime));
  return outs.some((f) => !existsSync(o(f)) || mtime(f) < newest);
}

function keep(dest) {
  if (!existsSync(dest)) return;
  let n = 1;
  while (existsSync(dest.replace(/\.(\w+)$/, `.bak-${n}.$1`))) n++;
  renameSync(dest, dest.replace(/\.(\w+)$/, `.bak-${n}.$1`));
}
async function probe(f) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries",
    "stream=width,height,r_frame_rate,nb_read_frames", "-of", "csv=p=0", f]);
  const [w, h, rate, n] = stdout.toString().trim().split(",");
  const [a, b] = rate.split("/").map(Number);
  return { w: +w, h: +h, fps: a / (b || 1), count: +n };
}
// one 8-bit channel, W × H, or an error: sharp can hand back extra channels after an operation on a raw buffer
async function one8(img, W, H) {
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 1 || info.width !== W || info.height !== H) throw new Error(`expected ${W}×${H}×1, got ${info.width}×${info.height}×${info.channels}`);
  return data;
}
// the box of everything more than faintly opaque in a one-channel mask
function bbox(m, W, H, min = 24) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x] > min) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}

// —— cut-outs ——
// Every mask is kept (…-birefnet.png, …-sam-<word>.png) and reused while it is newer than its picture.
const fresh = (f, src) => existsSync(f) && statSync(f).mtimeMs >= statSync(src).mtimeMs;
const wordFile = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const alphaOf = async (png, W, H) => one8(sharp(png).resize(W, H, { fit: "fill" }).ensureAlpha().extractChannel(3), W, H);

// BiRefNet: the picture's subject with soft edges (2 credits)
async function birefnet(src, base, label) {
  const png = `${base}-birefnet.png`;
  if (!fresh(png, src)) await gen("birefnet-image", { image: file(src), variant: "heavy", resolution: "2K" }, png, label);
  const { width: W, height: H } = await sharp(src).metadata();
  return alphaOf(png, W, H);
}
// SAM 3: only the object the word names (2 credits); null when it finds nothing, which isn't charged
async function sam(src, base, word, label) {
  const png = `${base}-sam-${wordFile(word)}.png`;
  if (!fresh(png, src)) {
    try { await gen("sam-3", { image: file(src), prompt: word }, png, label); }
    catch (e) {
      if (e.exitCode === 3 || e.exitCode === 5) throw e; // out of credits or at a limit: stop here
      process.exitCode = 0;
      console.log(`[${id}/${label}] SAM 3 found no "${word}" (not charged)`);
      return null;
    }
  }
  const { width: W, height: H } = await sharp(src).metadata();
  return alphaOf(png, W, H);
}

// keep the biggest blob and anything nearly as big: specks and stray bits of the scene go
async function biggest(alpha, W, H) {
  const k = 4, w = Math.ceil(W / k), h = Math.ceil(H / k);
  const small = await one8(sharp(alpha, { raw: { width: W, height: H, channels: 1 } }).resize(w, h, { fit: "fill" }).extractChannel(0), w, h);
  const label = new Int32Array(w * h), sizes = [0];
  for (let i = 0; i < w * h; i++) {
    if (small[i] < 64 || label[i]) continue;
    const n0 = sizes.length, stack = [i];
    label[i] = n0; let n = 0;
    while (stack.length) {
      const p = stack.pop(); n++;
      const x = p % w, y = (p / w) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1])
        if (q >= 0 && !label[q] && small[q] >= 64) { label[q] = n0; stack.push(q); }
    }
    sizes.push(n);
  }
  const top = Math.max(...sizes), keepIt = sizes.map((n) => n >= top * 0.25);
  const res = Buffer.alloc(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gx = Math.min(w - 1, (x / k) | 0), gy = Math.min(h - 1, (y / k) | 0);
    let ok = false;
    for (let dy = -1; dy <= 1 && !ok; dy++) for (let dx = -1; dx <= 1 && !ok; dx++) {
      const qx = gx + dx, qy = gy + dy;
      if (qx >= 0 && qy >= 0 && qx < w && qy < h) { const l = label[qy * w + qx]; ok = l > 0 && keepIt[l]; }
    }
    if (ok) res[y * W + x] = alpha[y * W + x];
  }
  return res;
}

// Polygons in a picture (u across and v down, 0 to 1) as a 0–255 mask, its edge softened by `soften` pixels.
async function polygons(list, W, H, soften = 0) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${list.map((poly) => `<polygon points="${poly.map(([u, v]) => `${u * W},${v * H}`).join(" ")}" fill="#fff"/>`).join("")}</svg>`;
  const hard = await one8(sharp(Buffer.from(svg)).ensureAlpha().extractChannel(3), W, H);
  return soften ? one8(sharp(hard, { raw: { width: W, height: H, channels: 1 } }).blur(soften).extractChannel(0), W, H) : hard;
}

// Specks: small round blobs a matte catches in some frames and not others, so they flash (sauce drops, crumbs). Only
// when the subject asks: `"specks": 0.03` clears every round blob under 3% of the biggest one, in the exploded still
// and in every clip frame. Long thin blobs (a carbon plate seen edge-on, a lace) stay, however small.
function despeckle(alpha, W, H, share) {
  const label = new Int32Array(W * H), sizes = [0], boxes = [null];
  for (let i = 0; i < W * H; i++) {
    if (alpha[i] < 128 || label[i]) continue;
    const id = sizes.length, stack = [i];
    label[i] = id;
    let n = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
    while (stack.length) {
      const p = stack.pop(); n++;
      const x = p % W, y = (p / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1])
        if (q >= 0 && !label[q] && alpha[q] >= 128) { label[q] = id; stack.push(q); }
    }
    sizes.push(n); boxes.push([x0, y0, x1 - x0 + 1, y1 - y0 + 1]);
  }
  const top = Math.max(0, ...sizes);
  const drop = sizes.map((n, l) => {
    if (!l || n >= top * share) return false;
    const [, , bw, bh] = boxes[l];
    return Math.max(bw, bh) <= 3 * Math.min(bw, bh) && n >= 0.3 * bw * bh; // round enough to be a drop
  });
  const removed = drop.filter(Boolean).length;
  if (!removed) return { alpha, removed };
  // clear each blob and its soft rim (within r), but never a pixel near a blob that stays
  const res = Buffer.from(alpha), r = 3;
  const near = (x, y, test) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const qx = x + dx, qy = y + dy;
      if (qx >= 0 && qy >= 0 && qx < W && qy < H && test(label[qy * W + qx])) return true;
    }
    return false;
  };
  for (let l = 1; l < sizes.length; l++) if (drop[l]) {
    const [bx, by, bw, bh] = boxes[l];
    for (let y = Math.max(0, by - r); y < Math.min(H, by + bh + r); y++) for (let x = Math.max(0, bx - r); x < Math.min(W, bx + bw + r); x++) {
      const k = y * W + x;
      if (label[k] === l || (!label[k] && near(x, y, (m) => m === l) && !near(x, y, (m) => m && !drop[m]))) res[k] = 0;
    }
  }
  return { alpha: res, removed };
}

// A part the exploded view shouldn't have (an extra band that came from a stand left in the first cut-out): `dropx`
// lists points (u, v) on such parts. Every part is its own blob there, so each part a point lands on, with its soft rim,
// is painted over with the backdrop in exploded.png itself (the old one is kept as exploded.bak-N.png), so the clips
// leave it out too, and it is cleared from the cut-out.
async function dropParts(src, alpha, W, H, points, label) {
  const raw1 = { raw: { width: W, height: H, channels: 1 } }, raw3 = { raw: { width: W, height: H, channels: 3 } };
  const lab = new Int32Array(W * H);
  let next = 0;
  for (let i = 0; i < W * H; i++) {
    if (alpha[i] < 128 || lab[i]) continue;
    const l = ++next, stack = [i];
    lab[i] = l;
    while (stack.length) {
      const p = stack.pop(), x = p % W, y = (p / W) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1])
        if (q >= 0 && !lab[q] && alpha[q] >= 128) { lab[q] = l; stack.push(q); }
    }
  }
  const hit = new Set();
  for (const [u, v] of points) {
    const x0 = Math.round(u * W), y0 = Math.round(v * H);
    let found = 0;
    for (let r = 0; r <= 16 && !found; r++) for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r && !found; dx++) {
      const x = x0 + dx, y = y0 + dy;
      if (x >= 0 && y >= 0 && x < W && y < H && lab[y * W + x]) found = lab[y * W + x];
    }
    if (found) hit.add(found);
    else console.log(`[${id}/${label}] dropx: no part at ${u}, ${v} (already gone?)`);
  }
  if (!hit.size) return alpha;
  const solid = Buffer.alloc(W * H);
  for (let k = 0; k < W * H; k++) if (hit.has(lab[k])) solid[k] = 255;
  // grown a few pixels to take the soft rim, with a soft edge
  const m = (await one8(sharp(solid, raw1).blur(3).extractChannel(0), W, H)).map((v) => Math.min(255, v * 3));
  const rgb = await sharp(src).removeAlpha().raw().toBuffer(), bg = [1, 3, 5].map((i) => parseInt(s.backdrop.slice(i, i + 2), 16));
  for (let k = 0; k < W * H; k++) if (m[k]) for (let c = 0; c < 3; c++) rgb[k * 3 + c] = Math.round(rgb[k * 3 + c] + (bg[c] - rgb[k * 3 + c]) * m[k] / 255);
  keep(src);
  await sharp(rgb, raw3).png().toFile(src);
  console.log(`[${id}/${label}] dropped ${hit.size} part${hit.size > 1 ? "s" : ""} from the exploded view (old picture kept as a .bak)`);
  return Buffer.from(alpha.map((v, k) => Math.round(v * (1 - m[k] / 255))));
}

// The product alone, as an RGBA the size of the photo (n = 1 or 2), trying the ladder in references/cut-outs.md; for the
// exploded view (n = null), BiRefNet alone: there every part is its own blob.
async function cut(src, n, dest, label) {
  const { width: W, height: H } = await sharp(src).metadata();
  const base = dest.replace(/\.png$/, ""), raw1 = { raw: { width: W, height: H, channels: 1 } }, raw3 = { raw: { width: W, height: H, channels: 3 } };
  const count = (a) => a.reduce((t, v) => t + (v > 128), 0);
  // a mask grown a little, so BiRefNet's soft edges decide the outline inside it
  const grown = async (m) => one8(sharp(m, raw1).blur(10).extractChannel(0), W, H);
  const within = (a, g) => Buffer.from(a.map((v, k) => Math.round(v * Math.min(1, g[k] / 50))));
  const rgb = await sharp(src).removeAlpha().raw().toBuffer();
  let alpha = await birefnet(src, base, label);
  if (n) {
    // 1 · inside SAM 3's mask of the product, found by name
    const word = s.find ?? s.noun;
    if (s.cut !== "birefnet") {
      const S = await sam(src, base, word, `${label} by name`);
      if (S) {
        const kept = within(alpha, await grown(S));
        if (count(kept) < count(alpha) * 0.3) console.log(`[${id}/${label}] SAM 3's "${word}" covers little of the subject, so it's left out: try another word in "find"`);
        else alpha = kept;
      }
    }
    alpha = await biggest(alpha, W, H);
    // 2 · detach: an edit takes away what still clings, on the plain backdrop (an easy edit, unlike one on the busy photo)
    const detach = s[`detach${n}`];
    if (detach) {
      const pre = `${base}-pre.png`, clean = `${base}-clean.png`, asked = `${base}-clean.json`;
      const now = await sharp(rgb, raw3).joinChannel(alpha, raw1).png().toBuffer();
      const picture = await sharp({ create: { width: W, height: H, channels: 3, background: s.backdrop } }).composite([{ input: now }]).png().toBuffer();
      // the edit is reused while the picture and the words are the same (redoing an erase doesn't pay for it again)
      const request = JSON.stringify({ detach, note });
      const same = existsSync(pre) && existsSync(clean) && existsSync(asked) && readFileSync(pre).equals(picture) && readFileSync(asked, "utf8") === request;
      if (!same) {
        writeFileSync(pre, picture);
        await gen("nano-banana-pro", image(fill(spec.detach, detach) + note, [pre]), clean, `${label} detach`);
        writeFileSync(asked, request);
      }
      const cleanMask = await birefnet(clean, `${base}-clean`, `${label} detached`);
      const kept = within(alpha, await grown(cleanMask));
      // 2b · patch: polygons around something pressed against the product, which the grown mask keeps (a stand's
      // cradle in front of a headband). There the cut-out takes the edited picture, toned to match the photo around
      // it: the bit of product the thing hid, as the edit painted it in, and the edit's outline.
      const patch = s[`patch${n}`];
      let P = null, C = null;
      if (patch?.length) {
        P = await polygons(patch, W, H, 1.5);
        C = await sharp(clean).resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer();
        const around = await polygons(patch, W, H, 12), sum = [0, 0, 0, 0, 0, 0];
        for (let k = 0; k < W * H; k++) if (around[k] > 8 && !P[k] && alpha[k] > 230) for (let c = 0; c < 3; c++) { sum[c] += rgb[k * 3 + c]; sum[c + 3] += C[k * 3 + c]; }
        const gain = [0, 1, 2].map((c) => (sum[c + 3] ? sum[c] / sum[c + 3] : 1));
        for (let k = 0; k < W * H; k++) if (P[k]) {
          for (let c = 0; c < 3; c++) C[k * 3 + c] = Math.min(255, Math.round(C[k * 3 + c] * gain[c]));
          kept[k] = Math.round(kept[k] + (cleanMask[k] - kept[k]) * P[k] / 255);
        }
      }
      if (count(kept) < count(alpha) * 0.4) console.log(`[${id}/${label}] the detach edit took away most of the product, so it's left out: look at out/${id}/${label}-clean.png and reword detach${n}`);
      else {
        if (P) for (let k = 0; k < W * H; k++) if (P[k]) for (let c = 0; c < 3; c++) rgb[k * 3 + c] = Math.round(rgb[k * 3 + c] + (C[k * 3 + c] - rgb[k * 3 + c]) * P[k] / 255);
        alpha = await biggest(kept, W, H);
        console.log(`[${id}/${label}] detached ${detach}${P ? ` · patched ${patch.length} area${patch.length > 1 ? "s" : ""} from the edit` : ""}`);
      }
    } else if (s[`patch${n}`]?.length) {
      console.log(`[${id}/${label}] patch${n} needs detach${n}: the detach edit paints in what the thing hid`);
    }
    // 3 · erase: polygons in the photo, u across and v down from 0 to 1
    const erase = s[`erase${n}`];
    if (erase?.length) {
      const E = await polygons(erase, W, H);
      alpha = Buffer.from(alpha.map((v, k) => Math.round(v * (1 - E[k] / 255))));
      console.log(`[${id}/${label}] erased ${erase.length} polygon${erase.length > 1 ? "s" : ""}`);
    }
  } else {
    if (s.dropx?.length) alpha = await dropParts(src, alpha, W, H, s.dropx, label);
    if (s.specks) {
      const d = despeckle(alpha, W, H, s.specks);
      alpha = d.alpha;
      console.log(`[${id}/${label}] cleared ${d.removed} speck${d.removed === 1 ? "" : "s"}`);
    }
  }
  keep(dest);
  await sharp(rgb, raw3).joinChannel(alpha, raw1).png().toFile(dest);
  const box = bbox(alpha, W, H);
  if (!box) throw new Error(`${label}: the cut-out came back empty`);
  console.log(`[${id}/${label}] cut out · box ${box.join(" ")}`);
  return box;
}

// a cut-out (cropped to box) scaled by k and centred on a backdrop the size of the stage
async function studio(src, box, k, W, H, dest) {
  const w = Math.round(box[2] * k), h = Math.round(box[3] * k), x = Math.round((W - w) / 2), y = Math.round((H - h) / 2);
  const part = await sharp(src).extract({ left: box[0], top: box[1], width: box[2], height: box[3] }).resize(w, h).png().toBuffer();
  keep(dest);
  await sharp({ create: { width: W, height: H, channels: 3, background: s.backdrop } }).composite([{ input: part, left: x, top: y }]).png().toFile(dest);
  return [x, y, w, h];
}

// —— review sheets ——
const BOARD = (w, h, cell = 14) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><pattern id="c" width="${cell * 2}" height="${cell * 2}" patternUnits="userSpaceOnUse"><rect width="${cell * 2}" height="${cell * 2}" fill="#fff"/><rect width="${cell}" height="${cell}" fill="#ddd"/><rect x="${cell}" y="${cell}" width="${cell}" height="${cell}" fill="#ddd"/></pattern></defs><rect width="100%" height="100%" fill="url(#c)"/></svg>`);
async function sheet(rows, dest, W = 640) {
  // rows of image files; transparent ones sit on a checkerboard so a cut-out's edges show
  const H = Math.round(W * 9 / 16), G = 8;
  const tiles = [];
  for (const [r, row] of rows.entries()) for (const [c, f] of row.entries()) {
    if (!f || !existsSync(f)) continue;
    const img = await sharp(f).resize(W, H, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    tiles.push({ input: await sharp(BOARD(W, H)).composite([{ input: img }]).png().toBuffer(), left: c * (W + G), top: r * (H + G) });
  }
  const cols = Math.max(...rows.map((r) => r.length));
  await sharp({ create: { width: cols * W + (cols - 1) * G, height: rows.length * H + (rows.length - 1) * G, channels: 3, background: "#1c1b1e" } })
    .composite(tiles).jpeg({ quality: 86 }).toFile(dest);
}

// —— a clip and its mask → numbered alpha WebPs, cropped to everywhere the product goes ——
async function frames(src, mask, dir, stageW, sheetFile, tag) {
  const v = await probe(src), m = await probe(mask);
  const n = Math.min(v.count, m.count);
  const sw = 320, sh = Math.round(sw * v.h / v.w);
  const { stdout } = await ff("-i", mask, "-vf", `scale=${sw}:${sh},format=gray`, "-f", "rawvideo", "-");
  const union = Buffer.alloc(sw * sh);
  for (let f = 0; f < n; f++) for (let k = 0; k < sw * sh; k++) if (stdout[f * sw * sh + k] > union[k]) union[k] = stdout[f * sw * sh + k];
  const b = bbox(union, sw, sh, 40);
  if (!b) throw new Error(`${tag}: the matte is empty`);
  const [bx, by, bw, bh] = b, k = v.w / sw, pad = Math.round(Math.max(bw, bh) * 0.03), even = (x) => Math.floor(x / 2) * 2;
  const cx = even(Math.max(0, (bx - pad) * k)), cy = even(Math.max(0, (by - pad) * k));
  const cw = even(Math.min(v.w - cx, (bw + 2 * pad) * k)), ch = even(Math.min(v.h - cy, (bh + 2 * pad) * k));
  const W = Math.min(FRAME_W, cw), H = even(W * ch / cw);
  const tmp = join(out, `tmp-${tag}`);
  rmSync(tmp, { recursive: true, force: true }); mkdirSync(join(tmp, "c"), { recursive: true }); mkdirSync(join(tmp, "m"));
  const crop = `crop=${cw}:${ch}:${cx}:${cy},scale=${W}:${H}:flags=lanczos`;
  await ff("-i", src, "-vf", crop, "-frames:v", String(n), join(tmp, "c", "%04d.png"));
  // the mask tightened a touch, so no backdrop rims the product
  await ff("-i", mask, "-vf", `${crop},format=gray,lut=y='clip((val-24)*1.12\\,0\\,255)'`, "-frames:v", String(n), join(tmp, "m", "%04d.png"));
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  let specks = 0;
  for (let i = 1; i <= n; i++) {
    const f = String(i).padStart(4, "0") + ".png";
    let a = await sharp(join(tmp, "m", f)).extractChannel(0).raw().toBuffer();
    if (s.specks) { const d = despeckle(a, W, H, s.specks); a = d.alpha; specks += d.removed; }
    // no removeAlpha() here: sharp applies it last, so it would strip the alpha just joined
    await sharp(join(tmp, "c", f)).joinChannel(a, { raw: { width: W, height: H, channels: 1 } })
      .webp({ quality: 74, alphaQuality: 85, effort: 5 }).toFile(join(dir, f.replace(".png", ".webp")));
  }
  const ks = stageW / v.w;
  const manifest = { count: n, fps: v.fps, pattern: "{n}.webp", pad: 4, size: [W, H], crop: [cx * ks, cy * ks, cw * ks, ch * ks].map((x) => Math.round(x)) };
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  const picks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => join(dir, String(Math.round(t * (n - 1)) + 1).padStart(4, "0") + ".webp"));
  await sheet([picks.slice(0, 3), picks.slice(3)], sheetFile, 520);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`[${id}/${tag}] ${n} frames ${W}×${H} · crop ${manifest.crop.join(" ")} (stage px)${s.specks ? ` · ${specks} specks cleared` : ""}`);
  return manifest;
}

// —— twelve moments of each take, one row per take ——
async function takeSheet(files, dest) {
  const rows = [];
  for (const f of files) rows.push((await ff("-i", f, "-vf", "select='not(mod(n\\,11))',scale=240:-2,tile=12x1", "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-")).stdout);
  const ms = await Promise.all(rows.map((r) => sharp(r).metadata()));
  let y = 0;
  await sharp({ create: { width: Math.max(...ms.map((m) => m.width)), height: ms.reduce((a, m) => a + m.height + 8, 0), channels: 3, background: "#1c1b1e" } })
    .composite(rows.map((r, k) => { const c = { input: r, left: 0, top: y }; y += ms[k].height + 8; return c; })).jpeg({ quality: 84 }).toFile(dest);
}

// —— the prompts ——
const P = {
  place1: () => `${fill(s.place1)} ${fill(spec.photo)}${note}`,
  place2: () => `${fill(s.place2)} ${fill(spec.same)} ${fill(spec.photo)}${note}`,
  exploded: () => `${fill(s.exploded)} ${fill(spec.same)} ${fill(spec.exploded)}${note}`,
  plate: (n) => `${fill(s[`remove${n}`])} ${fill(spec.plate)}${note}`,
  clip: (ab) => `${fill(ab === "a" ? s.explode : s.rebuild)} ${fill(spec.clip)}${note}`,
};
const image = (prompt, images) => ({ prompt, ...(images ? { images: images.map((f) => file(isAbsolute(f) ? f : o(f))) } : {}), aspect_ratio: "16:9", resolution: "2K", output_format: "png" });
const clip = (ab) => ({ prompt: P.clip(ab), start_image: file(o(ab === "a" ? "studio1.png" : "exploded.png")), end_image: file(o(ab === "a" ? "exploded.png" : "studio2.png")),
  duration: SECONDS, negative_prompt: fill(spec.negative), cfg_scale: 0.5 });
const save = async (f, fn) => { keep(o(f)); await fn(o(f)); };

// —— the run ——
if (argv.includes("--cost")) {
  const list = STEPS.filter(due).map((k) => [k, (k === "place1" || k === "clips") && takes ? COST[k] * takes : COST[k]]);
  for (const [k, c] of list) console.log(`${k.padEnd(9)} ${c ? `${c} credits` : "free"}`);
  console.log(`total     ${list.reduce((a, [, c]) => a + c, 0)} credits${list.length ? "" : " (nothing to do)"}`);
  process.exit(0);
}

if (pick) {
  if (/^\d+$/.test(pick)) { keep(o("place1.png")); copyFileSync(o(`place1-take-${pick}.png`), o("place1.png")); console.log(`[${id}] take ${pick} → place1.png`); }
  else for (const p of pick.split(",")) {
    const ab = p[0], n = p.slice(1);
    keep(o(`clip-${ab}.mp4`)); copyFileSync(o(`clip-${ab}-take-${n}.mp4`), o(`clip-${ab}.mp4`));
    console.log(`[${id}] take ${ab}${n} → clip-${ab}.mp4`);
  }
  if (!only && !from && !argv.includes("--stills") && !argv.includes("--motion")) process.exit(0);
}

if (takes && steps.includes("place1")) {
  const files = Array.from({ length: takes }, (_, k) => o(`place1-take-${k + 1}.png`));
  await Promise.all(files.map((f, k) => generate("nano-banana-pro", image(P.place1()), { skill: SKILL, out: f, label: `${id}/place1 take ${k + 1}` })));
  const rows = [];
  files.forEach((f, k) => (k % 3 ? rows[rows.length - 1].push(f) : rows.push([f])));
  await sheet(rows, o("place1-takes.jpg"));
  console.log(`→ out/${id}/place1-takes.jpg · then: node build.mjs ${id} --pick <n> --stills`);
  process.exit(0);
}
if (takes && steps.includes("clips")) {
  for (const ab of CLIPS) {
    const files = Array.from({ length: takes }, (_, k) => o(`clip-${ab}-take-${k + 1}.mp4`));
    await Promise.all(files.map((f, k) => generate("kling-v3-pro", clip(ab), { skill: SKILL, out: f, label: `${id}/clip ${ab} take ${k + 1}` })));
    await takeSheet(files, o(`clips-takes-${ab}.jpg`));
  }
  console.log(`→ out/${id}/clips-takes-a.jpg and -b.jpg · then: node build.mjs ${id} --pick a<n>,b<n> --motion`);
  process.exit(0);
}

if (due("place1")) await save("place1.png", (f) => gen("nano-banana-pro", image(P.place1()), f, "place1"));
if (!existsSync(o("place1.png"))) { console.error(`out/${id}/place1.png is missing: run the place1 step first`); process.exit(1); }
const { width: SW, height: SH } = await sharp(o("place1.png")).metadata();

const boxesFile = o("boxes.json");
const boxes = existsSync(boxesFile) ? JSON.parse(readFileSync(boxesFile, "utf8")) : {};
const remember = () => writeFileSync(boxesFile, JSON.stringify(boxes, null, 2) + "\n");

if (due("cut1")) {
  boxes.cut1 = await cut(o("place1.png"), 1, o("cut1.png"), "cut1");
  // the whole product at `fit` of the frame's height: an exploded view needs room around it
  boxes.studio1 = await studio(o("cut1.png"), boxes.cut1, (s.fit ?? 0.42) * SH / boxes.cut1[3], SW, SH, o("studio1.png"));
  remember();
}
if (due("place2")) await save("place2.png", (f) => gen("nano-banana-pro", image(P.place2(), ["studio1.png"]), f, "place2"));
if (due("cut2")) {
  boxes.cut2 = await cut(o("place2.png"), 2, o("cut2.png"), "cut2");
  // studio2 the same size as studio1, so clip b doesn't have to zoom
  const k1 = boxes.studio1[3] / boxes.cut1[3];
  boxes.studio2 = await studio(o("cut2.png"), boxes.cut2, k1 * Math.hypot(boxes.cut1[2], boxes.cut1[3]) / Math.hypot(boxes.cut2[2], boxes.cut2[3]), SW, SH, o("studio2.png"));
  remember();
}
if (due("exploded")) await save("exploded.png", (f) => gen("nano-banana-pro", image(P.exploded(), ["studio1.png"]), f, "exploded"));
if (due("cutx")) { boxes.cutx = await cut(o("exploded.png"), null, o("cutx.png"), "cutx"); remember(); }
if (STILLS.some((k) => steps.includes(k))) {
  await sheet([[o("place1.png"), o("exploded.png"), o("place2.png")], [o("cut1.png"), o("cutx.png"), o("cut2.png")]], o("stills.jpg"));
  console.log(`→ out/${id}/stills.jpg (the three pictures, and their cut-outs on a checkerboard)`);
}

if (due("plates")) await Promise.all([1, 2].map((n) => save(`plate${n}.png`, (f) => gen("nano-banana-pro", image(P.plate(n), [`place${n}.png`]), f, `plate${n}`))));
if (due("clips")) await Promise.all(CLIPS.map((ab) => save(`clip-${ab}.mp4`, (f) => gen("kling-v3-pro", clip(ab), f, `clip ${ab}`))));
if (due("mattes")) await Promise.all(CLIPS.map((ab) => save(`mask-${ab}.mp4`, (f) => gen("birefnet-video", { video: file(o(`clip-${ab}.mp4`)), variant: "heavy", resolution: "2K" }, f, `matte ${ab}`))));
if (due("frames")) {
  boxes.frames = {};
  for (const ab of ["a", "b"]) boxes.frames[ab] = await frames(o(`clip-${ab}.mp4`), o(`mask-${ab}.mp4`), join(site, "frames", ab), SW, o(`frames-${ab}.jpg`), `frames-${ab}`);
  remember();
  writeFileSync(o("frames.json"), JSON.stringify(boxes.frames) + "\n");
}
if (due("web")) {
  mkdirSync(join(site, "img"), { recursive: true });
  const photo = (f, name) => sharp(o(f)).resize(PHOTO_W).webp({ quality: 84, effort: 5 }).toFile(join(site, "img", `${name}.webp`));
  const piece = (f, b, name) => {
    const k = Math.min(1, CUT_MAX / Math.max(b[2], b[3]));
    return sharp(o(f)).extract({ left: b[0], top: b[1], width: b[2], height: b[3] }).resize(Math.round(b[2] * k), Math.round(b[3] * k))
      .webp({ quality: 86, alphaQuality: 92, effort: 5 }).toFile(join(site, "img", `${name}.webp`));
  };
  await Promise.all([photo("place1.png", "place1"), photo("plate1.png", "plate1"), photo("place2.png", "place2"), photo("plate2.png", "plate2"),
    piece("cut1.png", boxes.cut1, "cut1"), piece("cut2.png", boxes.cut2, "cut2"), piece("cutx.png", boxes.cutx, "cutx")]);
  // every box in its own image's pixels; the stage is the 16:9 frame the clips, studios and exploded view share
  const layout = { stage: [SW, SH], photo: [SW, SH], cut1: { photo: boxes.cut1, stage: boxes.studio1 }, cut2: { photo: boxes.cut2, stage: boxes.studio2 },
    cutx: { stage: boxes.cutx }, frames: boxes.frames };
  writeFileSync(join(site, "layout.json"), JSON.stringify(layout, null, 2) + "\n");
  writeFileSync(o("web.json"), JSON.stringify({ at: new Date().toISOString() }) + "\n");
  console.log(`[${id}/web] → site/${id}/img/*.webp, site/${id}/layout.json`);
}
if (MOTION.some((k) => steps.includes(k)) && existsSync(o("frames-a.jpg"))) console.log(`→ out/${id}/frames-a.jpg, frames-b.jpg (six moments of each clip on a checkerboard)`);
