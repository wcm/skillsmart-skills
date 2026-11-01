// The build film, in short Kling segments between keyframes (15 credits a second; failed ones are free). Kling does one
// job at a time well: asked to build everything in one long take, it makes what's in the end picture appear early and
// slide into place. So each segment does one job, and the segments are joined into out/<id>/film.mp4.
//
//   node film.mjs <id> --cost                  what one take of every segment costs, in credits
//   node film.mjs <id> rise --n 2              two takes of a segment: out/<id>/film-rise-take1.mp4 (+ -strip.jpg, a sheet)
//   node film.mjs <id> rise --fix "…"          add a note to the prompt for this run (the take's .txt keeps the full prompt)
//   node film.mjs <id> --join rise:1,top:3     join takes into out/<id>/film.mp4 (each next segment's first frame, the
//                                              shared keyframe, is dropped; a one-segment film is a join of one)
//   node film.mjs --strip out/<id>/film.mp4 --n 40    a denser sheet of any video, for review
//
// "film" in scenes/<id>.json: { "negative": "…", "segments": { "rise": { "start": "start", "end": "half", "duration": 5, "prompt": "…" } } }
// Takes are numbered after the ones already there. With FAL_KEY set, your own fal.ai key is used instead of credits.
import sharp from "sharp";
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, openSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { file as ref, generate } from "./gen.mjs";
import { CREDITS, OUT, PROMPTS, SKILL, keepOld, loadScene, needFfmpeg } from "./common.mjs";

const argv = process.argv.slice(2);
const flag = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
needFfmpeg();

export async function strip(mp4, n = 10) {
  const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4], { encoding: "utf8" });
  const dur = parseFloat(probe.stdout) || 10;
  const W = 560, H = 315, tiles = [];
  for (let k = 0; k < n; k++) {
    const t = Math.min(dur - 0.05, (dur * k) / (n - 1));
    const r = spawnSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", mp4, "-frames:v", "1", "-vf", `scale=${W}:${H}`, "-f", "image2pipe", "-vcodec", "png", "-"], { maxBuffer: 1 << 26 });
    const tag = Buffer.from(`<svg width="${W}" height="${H}"><rect x="8" y="8" width="70" height="26" rx="5" fill="#000" opacity=".7"/><text x="16" y="27" font-family="Helvetica" font-size="17" fill="#fff">${t.toFixed(1)}s</text></svg>`);
    tiles.push({ input: await sharp(r.stdout).composite([{ input: tag }]).toBuffer(), left: (k % 5) * W, top: Math.floor(k / 5) * H });
  }
  const dest = mp4.replace(/\.mp4$/, n === 10 ? "-strip.jpg" : `-strip${n}.jpg`);
  await sharp({ create: { width: W * 5, height: H * Math.ceil(n / 5), channels: 3, background: "#111" } }).composite(tiles).jpeg({ quality: 84 }).toFile(dest);
  console.log(`strip → ${dest}`);
  return dest;
}

if (flag("--strip")) { await strip(flag("--strip"), Number(flag("--n") ?? 10)); process.exit(0); }

const words = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const [id, name] = words;
const scene = loadScene(id);
const film = scene.film ?? {};
const segments = film.segments ?? {};
const dir = join(OUT, id);

if (argv.includes("--cost")) {
  const list = Object.entries(segments), secs = list.reduce((a, [, s]) => a + (s.duration ?? 5), 0);
  console.log(`${list.length} segment${list.length === 1 ? "" : "s"}, ${secs} s: one take of each is ${secs * CREDITS.filmSecond} credits (${list.map(([k, s]) => `${k} ${(s.duration ?? 5) * CREDITS.filmSecond}`).join(", ")}). Two takes each: ${secs * 2 * CREDITS.filmSecond}.`);
  process.exit(0);
}

if (flag("--join")) {
  const parts = flag("--join").split(",").map((x) => { const [s, t] = x.split(":"); return join(dir, `film-${s}-take${t}.mp4`); });
  for (const f of parts) if (!existsSync(f)) { console.error(`no ${f}`); process.exit(1); }
  const dest = join(dir, "film.mp4");
  keepOld(dest);
  // Kling sizes its frame from the start picture (1928 × 1072 from some, 1920 × 1080 from others), so each segment is
  // scaled to cover 1920 × 1080 and centre-cropped: a uniform scale, never a stretch
  const fit = "scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,setsar=1";
  const chains = parts.map((_, i) => `[${i}:v]${fit},${i ? "trim=start_frame=1," : ""}setpts=PTS-STARTPTS,fps=24,format=yuv420p[v${i}]`).join(";");
  const filter = `${chains};${parts.map((_, i) => `[v${i}]`).join("")}concat=n=${parts.length}:v=1:a=0[out]`;
  const r = spawnSync("ffmpeg", ["-loglevel", "error", "-y", ...parts.flatMap((f) => ["-i", f]), "-filter_complex", filter, "-map", "[out]", "-c:v", "libx264", "-crf", "14", "-preset", "medium", dest], { encoding: "utf8" });
  if (r.status) { console.error(r.stderr); process.exit(1); }
  writeFileSync(dest.replace(/\.mp4$/, ".txt"), `joined: ${flag("--join")}\n`);
  await strip(dest);
  console.log(`${parts.map((f) => basename(f)).join(" + ")} → ${dest}`);
  process.exit(0);
}

const seg = segments[name];
if (!seg) { console.error(`segments of ${id}: ${Object.keys(segments).join(", ") || "none yet"}`); process.exit(1); }
if (/\bWRITE\b/.test(seg.prompt ?? "WRITE")) { console.error(`Write this segment's prompt first in scenes/${id}.json`); process.exit(1); }
const startPic = join(dir, `${seg.start}.png`), endPic = join(dir, `${seg.end}.png`);
for (const p of [startPic, endPic]) if (!existsSync(p)) { console.error(`needs ${p} (node pictures.mjs ${id})`); process.exit(1); }
const n = Number(flag("--n") ?? 1);
const stem = `film-${name}`;
// take numbers are reserved with a .reserved file, so runs started side by side don't write over each other
const takes = [];
for (let t = 1; takes.length < n; t++) {
  if (existsSync(join(dir, `${stem}-take${t}.mp4`))) continue;
  try { closeSync(openSync(join(dir, `${stem}-take${t}.reserved`), "wx")); takes.push(t); } catch {}
}
const prompt = flag("--fix") ? `${seg.prompt} ${flag("--fix")}` : seg.prompt;
const input = {
  prompt,
  start_image: ref(startPic),
  end_image: ref(endPic),
  duration: seg.duration ?? 5,
  negative_prompt: seg.negative ?? film.negative ?? PROMPTS.negative,
  cfg_scale: film.cfg ?? 0.5,
};
const results = await Promise.allSettled(takes.map(async (t) => {
  const dest = join(dir, `${stem}-take${t}.mp4`);
  try {
    await generate("kling-v3-pro", input, { skill: SKILL, out: dest, label: `${id}/${name} #${t}` });
    writeFileSync(dest.replace(/\.mp4$/, ".txt"), `${basename(startPic)} → ${basename(endPic)}, ${input.duration} s\n${prompt}\n`);
    await strip(dest);
  } finally { rmSync(join(dir, `${stem}-take${t}.reserved`), { force: true }); }
}));
for (const r of results) if (r.status === "rejected") { console.error(r.reason?.message ?? r.reason); process.exitCode ||= r.reason?.exitCode ?? 1; }
