#!/usr/bin/env node
/*
 * node share.mjs <reel.mp4> [--mb 25] [--out <reel>-share.mp4]
 *
 * A copy of a rendered reel that fits a size limit (a chat app, an email, an upload form): the
 * same frames and sound, re-encoded in two passes at the bitrate that lands just under --mb
 * megabytes. A video already under the limit is copied as it is.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { needFfmpeg, parseArgs } from "./lib.mjs";

const a = parseArgs(process.argv.slice(2));
if (!a._[0]) { console.error("usage: node share.mjs <reel.mp4> [--mb 25] [--out reel-share.mp4]"); process.exit(2); }
needFfmpeg();
const src = resolve(a._[0]), out = resolve(a.out || src.replace(/\.mp4$/i, "") + "-share.mp4"), mb = +(a.mb || 25);
const limit = mb * 1024 * 1024;
if (statSync(src).size <= limit) { copyFileSync(src, out); console.log(`${out} (already under ${mb} MB)`); process.exit(0); }

const probe = (args) => execFileSync("ffprobe", ["-v", "error", ...args, src]).toString().trim();
const seconds = +probe(["-show_entries", "format=duration", "-of", "csv=p=0"]);
const hasAudio = probe(["-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0"]) !== "";
const audioK = hasAudio ? 160 : 0;
/* 4% for the container and the encoder's overshoot */
const videoK = Math.floor(((limit * 8 * 0.96) / seconds - audioK * 1000) / 1000);
if (videoK < 500) { console.error(`${mb} MB is too small for ${seconds.toFixed(1)} s of video (${videoK} kb/s)`); process.exit(1); }
const dir = mkdtempSync(join(tmpdir(), "reel-share-")), log = join(dir, "pass");
const common = ["-c:v", "libx264", "-preset", "slow", "-b:v", `${videoK}k`, "-maxrate", `${Math.round(videoK * 1.6)}k`, "-bufsize", `${videoK * 2}k`, "-pix_fmt", "yuv420p", "-passlogfile", log];
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, ...common, "-pass", "1", "-an", "-f", "mp4", process.platform === "win32" ? "NUL" : "/dev/null"]);
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, ...common, "-pass", "2", ...(hasAudio ? ["-c:a", "aac", "-b:a", `${audioK}k`] : ["-an"]), "-movflags", "+faststart", out]);
rmSync(dir, { recursive: true, force: true });
console.log(`${out}: ${(statSync(out).size / 1024 / 1024).toFixed(1)} MB, ${seconds.toFixed(2)} s at ${videoK} kb/s`);
