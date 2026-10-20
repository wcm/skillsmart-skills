#!/usr/bin/env node
/*
 * node make.mjs <reel.js> [--format 9x16 | 1x1 | 4x5 | 16x9 | all | 9x16,1x1] [--draft]
 *                         [--audio synth | none | <your track> [--at <seconds>]] [--out <dir>]
 *
 * The whole reel in one go:
 *   <name>.html            the reel as one page (next to the reel file): it plays on a loop in a browser
 *   out/<name>.wav         its soundtrack, exactly one loop long
 *   out/<name>-9x16.mp4    one MP4 per format, rendered frame by frame by render.mjs, with motion blur,
 *                          the soundtrack laid on without a fade, so the loop has no seam
 *
 *   --format   9x16 (the default; Reels, TikTok, Shorts), 1x1 and 4x5 (feeds), 16x9 (scenes are composed
 *              for tall frames, so it works but everything sits smaller), all, or a list
 *   --draft    half size, 15 fps, no motion blur: a quick look at the rhythm in seconds
 *   --audio    synth (the default: a track made from the reel), none, or your own track, one loop of it
 *              from --at seconds (set the reel's bpm to the track's first: scripts/tempo.mjs)
 */
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { makeAudio } from "./audio.mjs";
import { buildPage, needFfmpeg, parseArgs, reelName } from "./lib.mjs";

const a = parseArgs(process.argv.slice(2), ["draft"]);
if (!a._[0]) { console.error("usage: node make.mjs <reel.js> [--format 9x16|1x1|4x5|16x9|all] [--draft] [--audio synth|none|track.mp3 [--at s]] [--out dir]"); process.exit(2); }
needFfmpeg();
const reel = resolve(a._[0]), name = reelName(reel), dir = dirname(reel), out = resolve(a.out || join(dir, "out"));
const FORMATS = ["9x16", "1x1", "4x5", "16x9"];
const formats = String(a.format || "9x16") === "all" ? ["9x16", "1x1", "16x9"] : String(a.format || "9x16").split(",").map((f) => f.trim());
for (const f of formats) if (!FORMATS.includes(f)) { console.error(`--format ${f}? one of ${FORMATS.join(", ")} or all`); process.exit(2); }
mkdirSync(out, { recursive: true });

/* 1. the page */
const page = buildPage(reel, join(dir, `${name}.html`));
console.log(`page   ${relative(process.cwd(), page)}`);

/* 2. the soundtrack: one exact loop */
let wav = null;
const audio = a.audio ?? "synth";
if (audio !== "none") {
  wav = join(out, `${name}.wav`);
  await makeAudio(reel, wav, audio === "synth" || audio === true ? {} : { from: audio, at: a.at || 0 });
  console.log(`sound  ${relative(process.cwd(), wav)}`);
}

/* 3. one MP4 per format, frame by frame */
const render = join(dirname(fileURLToPath(import.meta.url)), "render.mjs");
for (const f of formats) {
  const mp4 = join(out, `${name}-${f}${a.draft ? "-draft" : ""}.mp4`);
  const args = [render, "video", page, "--format", f, "--out", mp4];
  if (a.draft) args.push("--draft", "--q:samples", "1");
  if (wav) args.push("--audio", wav, "--audio-fade", "0");
  const r = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status || 1);
}
console.log(`\nplay it on a loop with its sound: open ${relative(process.cwd(), page)}${wav ? `?audio=${relative(dir, wav).split("\\").join("/")}` : ""}`);
