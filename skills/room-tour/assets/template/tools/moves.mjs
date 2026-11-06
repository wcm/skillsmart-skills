// The moves of a walk: one video clip per move, from one stop's picture to the next, made with MiniMax H3 Max Turbo at
// 1080p (11 credits a second; failed ones are free). Each clip is a single continuous camera move, so the clips join
// into one walk at the stops. H3 takes no negative prompt: the prompt says what must stay still ({move} does).
//
//   node moves.mjs <id> --cost                 what one take of every move costs, in credits
//   node moves.mjs <id> move-1 --n 2           two takes: out/<id>/move-1-take1.mp4 (+ -strip.jpg, a contact sheet)
//   node moves.mjs <id> move-1 --fix "…"       add a note to the prompt for this run (the take's .txt keeps the full prompt)
//   node moves.mjs <id> move-1 --edges         the left and right edges of every take over time, on one sheet: where the
//                                              video model invents what no picture showed (a sofa, a wall corner)
//   node moves.mjs <id> --keep move-1:2        take 2 becomes out/<id>/move-1.mp4: sized to 1920 × 1080, and the still frames
//                                              the model adds at the start and end trimmed, so the scroll never stalls
//   node moves.mjs --strip <file.mp4> --n 16   a denser sheet of any video, for review
//
// "moves" in walks/<id>.json: { "move-1": { "start": "entry", "end": "living", "duration": 7, "prompt": "…" } }
// Takes are numbered after the ones already there. With FAL_KEY set, your own fal.ai key is used instead of credits.
import sharp from "sharp";
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, openSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { file as ref, generate } from "./gen.mjs";
import { CREDITS, OUT, PROMPTS, SKILL, keepOld, loadWalk, needFfmpeg, probe, rawFrames } from "./common.mjs";

const argv = process.argv.slice(2);
const flag = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
needFfmpeg();

const grab = (mp4, t, vf) => spawnSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", mp4, "-frames:v", "1", "-vf", vf, "-f", "image2pipe", "-vcodec", "png", "-"], { maxBuffer: 1 << 26 }).stdout;
const tag = (W, text) => Buffer.from(`<svg width="${W}" height="40"><rect x="8" y="8" width="${12 + 10 * text.length}" height="26" rx="5" fill="#000" opacity=".7"/><text x="16" y="27" font-family="Helvetica" font-size="17" fill="#fff">${text}</text></svg>`);

/** n frames of a video, five to a row, each with its time */
export async function strip(mp4, n = 10) {
  const p = probe(mp4), dur = p.seconds || 5, W = 560, H = 315, tiles = [];
  // the last tile is the last frame: a file can run past it (an H3 clip by about 0.07 s), and a seek past it finds nothing
  const last = p.count > 1 && p.fps ? (p.count - 1) / p.fps - 0.01 : dur - 0.2;
  for (let k = 0; k < n; k++) {
    const t = Math.max(0, Math.min(last, (dur * k) / (n - 1)));
    tiles.push({ input: await sharp(grab(mp4, t, `scale=${W}:${H}`)).composite([{ input: tag(W, `${t.toFixed(1)}s`), left: 0, top: 0 }]).toBuffer(), left: (k % 5) * W, top: Math.floor(k / 5) * H });
  }
  const dest = mp4.replace(/\.mp4$/, n === 10 ? "-strip.jpg" : `-strip${n}.jpg`);
  await sharp({ create: { width: W * 5, height: H * Math.ceil(n / 5), channels: 3, background: "#111" } }).composite(tiles).jpeg({ quality: 84 }).toFile(dest);
  console.log(`strip → ${dest}`);
  return dest;
}

if (flag("--strip")) { await strip(flag("--strip"), Number(flag("--n") ?? 10)); process.exit(0); }

const words = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const [id, name] = words;
const walk = loadWalk(id);
const moves = walk.moves ?? {};
const dir = join(OUT, id);
const fill = (text) => text.replaceAll("{move}", PROMPTS.move).replaceAll("{style}", walk.style ?? "");

if (argv.includes("--cost")) {
  const list = Object.entries(moves), secs = list.reduce((a, [, m]) => a + (m.duration ?? 6), 0);
  console.log(`${list.length} move${list.length === 1 ? "" : "s"}, ${secs} s: one take of each is ${secs * CREDITS.videoSecond} credits (${list.map(([k, m]) => `${k} ${(m.duration ?? 6) * CREDITS.videoSecond}`).join(", ")}). Two takes each: ${secs * 2 * CREDITS.videoSecond}.`);
  process.exit(0);
}

if (flag("--keep")) {
  const [mv, t] = flag("--keep").split(":");
  const src = join(dir, `${mv}-take${t}.mp4`), dest = join(dir, `${mv}.mp4`);
  if (!existsSync(src)) { console.error(`no ${src}`); process.exit(1); }
  // the model eases in and holds still at the end: drop frames that don't move (a still frame would stall the scroll)
  const { frames } = rawFrames(src, 320);
  const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 3) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return s / a.length; };
  const d = frames.slice(1).map((f, i) => diff(frames[i], f));
  const STILL = 0.35;
  let a = 0, b = d.length;
  while (a < d.length && d[a] < STILL) a++;
  while (b > a && d[b - 1] < STILL) b--;
  const end = Math.min(frames.length - 1, b + 1);     // one frame of the settle stays
  keepOld(dest);
  // video models size the frame from the start picture (1928 × 1072 from some, 1920 × 1080 from others): scale to
  // cover 1920 × 1080 and centre-crop, a uniform scale, never a stretch
  const fit = "scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,setsar=1";
  const r = spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-i", src, "-vf", `trim=start_frame=${a}:end_frame=${end + 1},setpts=PTS-STARTPTS,${fit},fps=24,format=yuv420p`, "-an", "-c:v", "libx264", "-crf", "12", "-preset", "slow", dest], { encoding: "utf8" });
  if (r.status) { console.error(r.stderr); process.exit(1); }
  writeFileSync(dest.replace(/\.mp4$/, ".txt"), `take ${t} of ${mv}: frames ${a}–${end} of ${frames.length}\n`);
  console.log(`${mv}: take ${t} → ${dest} (kept frames ${a}–${end} of ${frames.length})`);
  process.exit(0);
}

const mv = moves[name];
if (!mv) { console.error(`moves of ${id}: ${Object.keys(moves).join(", ") || "none yet"}`); process.exit(1); }

if (argv.includes("--edges")) {
  // each take's left and right fifths, eight moments, one row per take
  const takes = [];
  for (let t = 1; existsSync(join(dir, `${name}-take${t}.mp4`)); t++) takes.push(join(dir, `${name}-take${t}.mp4`));
  if (!takes.length) { console.error(`no takes of ${name} yet`); process.exit(1); }
  const N = 8, W = 200, H = 562, rows = [];
  for (const [k, mp4] of takes.entries()) {
    const dur = probe(mp4).seconds || 5;
    for (let i = 0; i < N; i++) {
      const t = 0.15 * dur + ((0.8 * dur) * i) / (N - 1);
      for (const [side, x] of [["L", "0"], ["R", "iw*4/5"]]) {
        const img = await sharp(grab(mp4, t, `crop=iw/5:ih:${x}:0,scale=${W}:${H}`)).composite([{ input: tag(W, `${k + 1}${side} ${t.toFixed(1)}s`), left: 0, top: 0 }]).toBuffer();
        rows.push({ input: img, left: (i * 2 + (side === "R" ? 1 : 0)) * (W + 4), top: k * (H + 8) });
      }
    }
  }
  const dest = join(dir, `${name}-edges.jpg`);
  await sharp({ create: { width: N * 2 * (W + 4), height: takes.length * (H + 8), channels: 3, background: "#111" } }).composite(rows).jpeg({ quality: 82 }).toFile(dest);
  console.log(`edges → ${dest}`);
  process.exit(0);
}

if (/\bWRITE\b/.test(mv.prompt ?? "WRITE")) { console.error(`Write this move's prompt first in walks/${id}.json`); process.exit(1); }
const startPic = join(dir, `${mv.start}.png`), endPic = join(dir, `${mv.end}.png`);
for (const p of [startPic, endPic]) if (!existsSync(p)) { console.error(`needs ${p} (node pictures.mjs ${id})`); process.exit(1); }
const n = Number(flag("--n") ?? 1);
// take numbers are reserved with a .reserved file, so runs started side by side don't write over each other
const takes = [];
for (let t = 1; takes.length < n; t++) {
  if (existsSync(join(dir, `${name}-take${t}.mp4`))) continue;
  try { closeSync(openSync(join(dir, `${name}-take${t}.reserved`), "wx")); takes.push(t); } catch {}
}
const prompt = [fill(mv.prompt), flag("--fix") ?? ""].filter(Boolean).join(" ");
const input = {
  prompt,
  start_image: ref(startPic),
  end_image: ref(endPic),
  duration: mv.duration ?? 6,
};
if (mv.negative || walk.negative || walk.cfg != null) console.warn("note: H3 Max Turbo takes no negative prompt or cfg; say in the move's prompt what must stay still");
const results = await Promise.allSettled(takes.map(async (t) => {
  const dest = join(dir, `${name}-take${t}.mp4`);
  try {
    await generate("h3-max-turbo", input, { skill: SKILL, out: dest, label: `${id}/${name} #${t}` });
    writeFileSync(dest.replace(/\.mp4$/, ".txt"), `${basename(startPic)} → ${basename(endPic)}, ${input.duration} s\n${prompt}\n`);
    await strip(dest, 16);
  } finally { rmSync(join(dir, `${name}-take${t}.reserved`), { force: true }); }
}));
for (const r of results) if (r.status === "rejected") { console.error(r.reason?.message ?? r.reason); process.exitCode ||= r.reason?.exitCode ?? 1; }
