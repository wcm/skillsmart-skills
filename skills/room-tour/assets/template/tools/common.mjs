// What the Room Tour tools share: the project's folders, a page's walk file, the prompt parts and the prices.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const TOOLS = dirname(fileURLToPath(import.meta.url));
export const OUT = join(TOOLS, "out");
export const SITE = join(TOOLS, "..", "site");
export const SKILL = "room-tour";
export const PROMPTS = JSON.parse(readFileSync(join(TOOLS, "prompts.json"), "utf8"));
export const SIZE = { width: 2560, height: 1440 };          // every picture, whatever the model returns
export const CREDITS = { picture: 20, videoSecond: 11, cutout: 2 };

/** a page's walk file: tools/walks/<id>.json (its pictures, moves and frame choices) */
export function loadWalk(id) {
  const file = join(TOOLS, "walks", `${id}.json`);
  if (!id || !existsSync(file)) {
    const have = existsSync(join(TOOLS, "walks")) ? readdirSync(join(TOOLS, "walks")).filter((f) => !f.startsWith("_")).map((f) => f.replace(/\.json$/, "")) : [];
    console.error(`pages: ${have.join(", ") || "none yet"}`);
    process.exit(1);
  }
  const walk = JSON.parse(readFileSync(file, "utf8"));
  mkdirSync(join(OUT, id), { recursive: true });
  return walk;
}

/** keeps an earlier version as name.bak-N.ext */
export function keepOld(dest) {
  if (!existsSync(dest)) return;
  const m = dest.match(/^(.*?)(\.[^.]+)$/);
  let n = 1;
  while (existsSync(`${m[1]}.bak-${n}${m[2]}`)) n++;
  renameSync(dest, `${m[1]}.bak-${n}${m[2]}`);
}

export function needFfmpeg() {
  for (const bin of ["ffmpeg", "ffprobe"]) {
    try { execFileSync(bin, ["-version"], { stdio: "ignore" }); }
    catch { console.error(`${bin} is missing: brew install ffmpeg (macOS), winget install ffmpeg (Windows), apt install ffmpeg (Linux)`); process.exit(1); }
  }
}

/** a video's length in seconds, frame rate and frame count */
export function probe(mp4) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries", "stream=width,height,r_frame_rate,nb_read_packets", "-show_entries", "format=duration", "-of", "json", mp4], { encoding: "utf8" });
  const j = JSON.parse(r.stdout || "{}"), s = j.streams?.[0] ?? {};
  const [a, b] = (s.r_frame_rate ?? "24/1").split("/").map(Number);
  return { width: s.width, height: s.height, fps: a / (b || 1), count: Number(s.nb_read_packets) || 0, seconds: Number(j.format?.duration) || 0 };
}

/** every frame of a video as raw RGB at a given width (for small measurements, not for the web frames) */
export function rawFrames(mp4, width) {
  const p = probe(mp4), height = Math.round((p.height * width) / p.width / 2) * 2;
  const r = spawnSync("ffmpeg", ["-loglevel", "error", "-i", mp4, "-vf", `scale=${width}:${height}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 30 });
  const size = width * height * 3, frames = [];
  for (let o = 0; o + size <= r.stdout.length; o += size) frames.push(r.stdout.subarray(o, o + size));
  return { width, height, frames };
}
