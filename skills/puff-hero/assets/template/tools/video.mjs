// A seamless, transparent loop of a page's puffy letters.
//   1 loop    Kling turns the still into a clip that starts and ends on it (same first and last frame)
//   2 matte   BiRefNet (video) returns a mask of the letters for every frame
//   3 encode  the clip, cropped to everywhere the letters go during the loop, with the mask as its alpha: a VP9 WebM
//             (Chrome, Firefox, Edge), an HEVC-with-alpha MOV (Safari; needs macOS to encode) and the first frame as
//             a WebP (the page at rest, and the hit test)
//
//   node video.mjs hero --takes 2     two loops (out/hero/loop-take-N.mp4), side by side in out/hero/loop-takes.mp4
//                                     and loop-takes.png, each with how lively it is and its size over time; stops there
//   node video.mjs hero --pick 2      take 2 becomes the loop, then matte and encode
//   node video.mjs hero               one loop, then matte and encode (no takes)
//   node video.mjs hero --from matte  start at a later step (matte | encode), reusing what's in out/
//
// The loop prompt is the shared pop (`motion.template`, with the page's `subject` and `shine`) or the page's own
// `motion`, then the shared `loop` line; negatives are the shared `negative`, the pop's own and the page's own.
// A page's `matte` picks the cut-out's BiRefNet variant: "heavy" (the default) or "matting" (fur and fuzz).
// Credits (Skillsmart, through gen.mjs): a loop is kling-v3-pro at 15 a second (60 for the pop's 4 s, 75 for 5 s);
// the matte is birefnet-video at 2 a second of the loop (8–10). Loops and mattes run in parallel; encodes run one at
// a time here. With FAL_KEY set, gen.mjs uses that fal.ai key instead, without credits.
// Outputs: ./out/<id>/{loop-raw.mp4, mask.mp4 (earlier ones kept as *.bak-N.mp4), sheet.png} → <publish>/<id>/puff.*

import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, readFileSync, existsSync, renameSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { file, generate } from "./gen.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));

const spec = JSON.parse(readFileSync(join(ROOT, "pages.json"), "utf8"));
const argv = process.argv.slice(2);
const flag = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const takes = +(flag("--takes") ?? 0), pick = flag("--pick");
const from = flag("--from") ?? (pick ? "matte" : "loop");
const ids = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const todo = ids.length ? ids : Object.keys(spec.pages);
const STEPS = ["loop", "matte", "encode"], start = STEPS.indexOf(from);
const MAXW = 1600;                                         // published width at most
const PUBLISH = resolve(ROOT, spec.publish ?? "../site/img");

const run = promisify(execFile);
const ff = (...args) => run("ffmpeg", ["-loglevel", "error", "-y", ...args], { maxBuffer: 1 << 28, encoding: "buffer" });
const probe = async (f) => (await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=width,height,r_frame_rate,nb_read_frames", "-of", "csv=p=0", f])).stdout.toString().trim();
function keep(dest){
  if (!existsSync(dest)) return;
  let n = 1;
  while (existsSync(dest.replace(/\.(\w+)$/, `.bak-${n}.$1`))) n++;
  renameSync(dest, dest.replace(/\.(\w+)$/, `.bak-${n}.$1`));
}
// one generation into dest: made next to it first, so a failed one leaves the earlier file where it was
async function into(dest, model, input, label){
  const tmp = dest.replace(/\.(\w+)$/, ".new.$1");
  await generate(model, input, { skill: "puff-hero", out: tmp, label });
  keep(dest);
  renameSync(tmp, dest);
}
// HEVC with alpha (Safari's transparent video) is encoded with Apple's VideoToolbox, so only on a Mac
const hevcAlpha = run("ffmpeg", ["-hide_banner", "-h", "encoder=hevc_videotoolbox"]).then((r) => /^Encoder hevc_videotoolbox/m.test(r.stdout + r.stderr), () => false);
// the page's own motion line, or the shared pop with {subject} and {shine} filled in
const motion = (p) => p.motion ?? spec.motion.template.replace("{subject}", p.subject).replace("{shine}", p.shine ?? "");
// one encode at a time, so each finishes as fast as the machine allows
let lane = Promise.resolve();
const serial = (fn) => { const r = lane.then(fn); lane = r.catch(() => {}); return r; };

// every frame of the mask, small: the union of where the letters go (the crop), how much of them moves, and any frame
// whose border is mostly opaque (the matte kept the backdrop there)
export async function measure(mask){
  const [mw, mh] = (await probe(mask)).split(",").map(Number), w = 240, h = Math.round(w * mh / mw), n = w * h;
  const { stdout } = await ff("-i", mask, "-vf", `scale=${w}:${h},format=gray`, "-f", "rawvideo", "-");
  const frames = Math.floor(stdout.length / n);
  let x0 = w, y0 = h, x1 = 0, y1 = 0, area = 0, max = 0, sum = 0;
  const bad = [], b = Math.max(2, Math.round(w * .02));
  for (let k = 0; k < n; k++) if (stdout[k] > 128) area++;
  for (let f = 0; f < frames; f++){
    let moved = 0, edge = 0, ne = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < b || y < b || x >= w - b || y >= h - b){ edge += stdout[f * n + y * w + x] > 128; ne++; }
    if (edge / ne > .5){ bad.push(f); continue; }
    for (let k = 0; k < n; k++){
      const v = stdout[f * n + k];
      if (v > 40){ const x = k % w, y = (k / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (Math.abs(v - stdout[k]) > 64) moved++;
    }
    const m = moved / Math.max(1, area); sum += m; if (m > max) max = m;
  }
  const s = mw / w, pad = Math.round(Math.max(x1 - x0, y1 - y0) * .025);
  const cx = Math.max(0, (x0 - pad) * s), cy = Math.max(0, (y0 - pad) * s);
  const even = (v) => Math.floor(v / 2) * 2;
  const crop = { x: even(cx), y: even(cy), w: even(Math.min(mw - cx, (x1 - x0 + 1 + 2 * pad) * s)), h: even(Math.min(mh - cy, (y1 - y0 + 1 + 2 * pad) * s)) };
  return { crop, motion: { max, mean: sum / Math.max(1, frames - bad.length) }, frames, bad };
}

// a raw loop's liveliness and size over time, without a matte: the backdrop is flat and still, so whatever differs
// from it is letters. small/big: the letters' area at its least and most, against the first frame. Under ~85% the
// letters squeezed in; over ~103% they swelled; changes of a few percent mean they barely moved
export async function rawStats(f){
  const [mw, mh] = (await probe(f)).split(",").map(Number), w = 200, h = Math.round(w * mh / mw), n = w * h;
  const { stdout } = await ff("-i", f, "-vf", `scale=${w}:${h},format=rgb24`, "-f", "rawvideo", "-");
  const F = Math.floor(stdout.length / (n * 3)), px = (f, k, c) => stdout[(f * n + k) * 3 + c];
  const bg = [0, 1, 2].map((c) => { let s = 0, m = 0; for (let k = 0; k < n; k++){ const x = k % w, y = (k / w) | 0; if (x < 3 || y < 3 || x >= w - 3 || y >= h - 3){ s += px(0, k, c); m++; } } return s / m; });
  const letter = (f, k) => Math.abs(px(f, k, 0) - bg[0]) + Math.abs(px(f, k, 1) - bg[1]) + Math.abs(px(f, k, 2) - bg[2]) > 54;
  let a0 = 0; for (let k = 0; k < n; k++) a0 += letter(0, k);
  let max = 0, sum = 0, small = 1, big = 1;
  for (let f = 1; f < F; f++){
    let moved = 0, a = 0;
    for (let k = 0; k < n; k++){ a += letter(f, k); if (Math.abs(px(f, k, 0) - px(0, k, 0)) + Math.abs(px(f, k, 1) - px(0, k, 1)) + Math.abs(px(f, k, 2) - px(0, k, 2)) > 60) moved++; }
    const m = moved / a0; sum += m; max = Math.max(max, m); small = Math.min(small, a / a0); big = Math.max(big, a / a0);
  }
  return { max, mean: sum / (F - 1), small, big };
}

// one Kling loop of the still into dest: the still is its first and its last frame
async function loop(p, still, dest, tag, label){
  tag("loop…");
  await into(dest, "kling-v3-pro", {
    prompt: `${motion(p)} ${spec.loop}`, start_image: file(still), end_image: file(still),
    duration: +(p.seconds ?? (p.motion ? "5" : spec.motion.seconds)),
    negative_prompt: [spec.negative, p.motion ? null : spec.motion.negative, p.negative].filter(Boolean).join(", "),
    cfg_scale: (p.motion ? null : spec.motion.cfg) ?? spec.cfg ?? .5,
  }, label);
}

// the loop takes for a person to choose from: playing side by side, labelled, three times through (loop-takes.mp4),
// and twelve moments of each in a row (loop-takes.png). Named apart from generate.mjs's still takes (take-N.png)
export async function takesReview(out, files, labels){
  const H = 480, GAP = 8, BAR = 46;
  const dims = await Promise.all(files.map(async (f) => (await probe(f)).split(",").map(Number)));
  const widths = dims.map(([w, h]) => Math.round(H * w / h / 2) * 2), total = widths.reduce((a, w) => a + w, 0) + GAP * (files.length - 1);
  let x = 0;
  const texts = labels.map((l, k) => { const cx = x + widths[k] / 2; x += widths[k] + GAP; return `<text x="${cx}" y="30" text-anchor="middle" font-family="Helvetica, Arial" font-size="19" fill="#f2f2f2">${l}</text>`; }).join("");
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${BAR}"><rect width="100%" height="100%" fill="#1c1b1e"/>${texts}</svg>`)).png().toFile(join(out, "loop-takes-bar.png"));
  const scaled = files.map((_, k) => `[${k}:v]scale=${widths[k]}:${H}:flags=lanczos${k < files.length - 1 ? `,pad=${widths[k] + GAP}:${H}:0:0:color=#1c1b1e` : ""},setsar=1[v${k}]`).join(";");
  const row = files.length > 1 ? `${files.map((_, k) => `[v${k}]`).join("")}hstack=inputs=${files.length}[row]` : `[v0]null[row]`;
  await ff(...files.flatMap((f) => ["-stream_loop", "2", "-i", f]), "-i", join(out, "loop-takes-bar.png"), "-filter_complex",
    `${scaled};${row};[row]pad=${total}:${H + BAR}:0:${BAR}:color=#1c1b1e[p];[p][${files.length}:v]overlay=0:0,format=yuv420p`,
    "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-movflags", "+faststart", "-an", join(out, "loop-takes.mp4"));
  for (const [k, f] of files.entries()) await ff("-i", f, "-vf", "select='not(mod(n\\,8))',scale=240:-2,tile=12x1", "-frames:v", "1", join(out, `loop-take-${k + 1}.png`));
  const rows = await Promise.all(files.map((_, k) => sharp(join(out, `loop-take-${k + 1}.png`)).png().toBuffer()));
  const ms = await Promise.all(rows.map((r) => sharp(r).metadata()));
  let y = 0;
  await sharp({ create: { width: Math.max(...ms.map((m) => m.width)), height: ms.reduce((a, m) => a + m.height + 8, 0), channels: 3, background: "#1c1b1e" } })
    .composite(rows.map((r, k) => { const c = { input: r, left: 0, top: y }; y += ms[k].height + 8; return c; })).png().toFile(join(out, "loop-takes.png"));
}

async function one(id){
  const p = spec.pages[id];
  if (!p) throw new Error(`pages.json has no page "${id}"`);
  const out = join(ROOT, "out", id), site = join(PUBLISH, id);
  mkdirSync(out, { recursive: true }); mkdirSync(site, { recursive: true });
  const still = join(out, "still.png"), raw = join(out, "loop-raw.mp4"), mask = join(out, "mask.mp4");
  const t = Date.now(), tag = (s) => console.log(`[${id}] ${s} (${((Date.now() - t) / 1000).toFixed(0)}s)`);
  if ((takes || start === 0) && !existsSync(still)) throw new Error(`out/${id}/still.png is missing: run generate.mjs ${id} first`);

  if (pick && start > 1) throw new Error("a picked take needs its own matte: use --pick on its own (it mattes, then encodes)");
  if (pick){ keep(raw); copyFileSync(join(out, `loop-take-${pick}.mp4`), raw); tag(`take ${pick} → loop-raw.mp4`); }
  if (takes){
    const files = await Promise.all(Array.from({ length: takes }, async (_, k) => { const f = join(out, `loop-take-${k + 1}.mp4`); await loop(p, still, f, (s) => tag(`take ${k + 1} ${s}`), `${id}/loop take ${k + 1}`); return f; }));
    const labels = [];
    for (const [k, f] of files.entries()){
      const r = await rawStats(f), size = `${(r.small * 100).toFixed(0)}–${(r.big * 100).toFixed(0)}%`;
      labels.push(`take ${k + 1} · moves ${(r.mean * 100).toFixed(0)}% · size ${size}`);
      tag(`take ${k + 1}: changes up to ${(r.max * 100).toFixed(0)}% (avg ${(r.mean * 100).toFixed(0)}%) · size ${size} of the first frame`);
    }
    await takesReview(out, files, labels);
    return tag(`→ out/${id}/loop-takes.mp4 and loop-takes.png (pick one: node video.mjs ${id} --pick N)`);
  }
  if (start <= 0){
    await loop(p, still, raw, tag, `${id}/loop`);
    tag(`→ loop-raw.mp4 (${await probe(raw)})`);
  }
  if (start <= 1){
    tag("matte…");
    await into(mask, "birefnet-video", { video: file(raw), variant: p.matte ?? "heavy", resolution: "2K" }, `${id}/matte`);
    tag(`→ mask.mp4 (${await probe(mask)})`);
  }
  await serial(async () => {
    const { crop: c, motion: m, frames, bad } = await measure(mask);
    if (bad.length) throw new Error(`the matte kept the backdrop on ${bad.length} frame(s) (${bad.slice(0, 8).join(", ")}…): set the page's "matte" to the other variant ("heavy" or "matting"), then --from matte`);
    const W = Math.min(MAXW, c.w), H = Math.round(W * c.h / c.w / 2) * 2;
    // the mask tightened a touch so no backdrop rims the letters, then merged in as alpha
    const cut = `crop=${c.w}:${c.h}:${c.x}:${c.y},scale=${W}:${H}`;
    const graph = `[1:v]${cut},format=gray,lut=y='clip((val-24)*1.12\\,0\\,255)'[m];[0:v]${cut}:flags=lanczos[c];[c][m]alphamerge`;
    await ff("-i", raw, "-i", mask, "-filter_complex", `${graph},format=yuva420p`, "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "30",
      "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", "-auto-alt-ref", "0", "-an", join(site, "puff.webm"));
    if (await hevcAlpha) await ff("-i", raw, "-i", mask, "-filter_complex", `${graph},format=bgra`, "-c:v", "hevc_videotoolbox", "-allow_sw", "1", "-alpha_quality", "0.8",
      "-b:v", "7M", "-tag:v", "hvc1", "-an", "-movflags", "+faststart", join(site, "puff.mov"));
    else tag("no HEVC-with-alpha encoder here (it needs macOS): Safari will show the still and the pop, without the loop. Run --from encode on a Mac to add puff.mov");
    await ff("-i", raw, "-i", mask, "-filter_complex", `${graph},format=rgba`, "-frames:v", "1", join(out, "first.png"));
    await sharp(join(out, "first.png")).webp({ quality: 90, alphaQuality: 95 }).toFile(join(site, "puff.webp"));
    tag(`encoded ${W}×${H} (crop ${c.w}×${c.h} at ${c.x},${c.y}) · motion: up to ${(m.max * 100).toFixed(0)}% of the letters change, ${(m.mean * 100).toFixed(0)}% on average`);

    // review: six moments of the loop over a checkerboard (the matte's edges show), 3 × 2, picked by frame number
    // from the merged stream (seeking the two inputs separately can pair the wrong frames)
    const idx = [0, 1, 2, 3, 4, 5].map((k) => Math.round(k * (frames - 1) / 5)), tw = 520, th = Math.round(tw * H / W), cell = 14;
    await ff("-i", raw, "-i", mask, "-filter_complex", `${graph},select='${idx.map((i) => `eq(n\\,${i})`).join("+")}',format=rgba`, "-fps_mode", "passthrough", "-start_number", "0", join(out, "f%d.png"));
    const board = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${th}"><defs><pattern id="c" width="${cell * 2}" height="${cell * 2}" patternUnits="userSpaceOnUse"><rect width="${cell * 2}" height="${cell * 2}" fill="#fff"/><rect width="${cell}" height="${cell}" fill="#ddd"/><rect x="${cell}" y="${cell}" width="${cell}" height="${cell}" fill="#ddd"/></pattern></defs><rect width="100%" height="100%" fill="url(#c)"/></svg>`);
    const tiles = await Promise.all(idx.map(async (_, k) => sharp(board).composite([{ input: await sharp(join(out, `f${k}.png`)).resize(tw, th).png().toBuffer() }]).png().toBuffer()));
    await sharp({ create: { width: tw * 3 + 16, height: th * 2 + 8, channels: 3, background: "#1c1b1e" } })
      .composite(tiles.map((b, k) => ({ input: b, left: (k % 3) * (tw + 8), top: Math.floor(k / 3) * (th + 8) }))).png().toFile(join(out, "sheet.png"));
    tag(`→ out/${id}/sheet.png`);
  });
}

// run only when called as a script (measure() and rawStats() can be imported)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href){
  await Promise.all(todo.map((id) => one(id).catch((e) => console.error(`[${id}] failed:`, e.message, e.body ? JSON.stringify(e.body).slice(0, 500) : ""))));
}
