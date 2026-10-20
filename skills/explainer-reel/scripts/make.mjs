#!/usr/bin/env node
/*
 * node make.mjs <reel.js> [--format 9x16 | 4x5 | 1x1 | 16x9 | all | 9x16,1x1] [--draft] [--no-audio] [--out <dir>]
 *
 * The whole reel in one go:
 *   <name>.html               the reel as one self-contained page (next to the reel file; scripts/page.mjs)
 *   out/<name>.wav            its soundtrack: the voice-over over the ambient bed and the sound cues, the bed
 *                             ducking under the voice, levelled to −14 LUFS (−20 without a voice-over)
 *   out/<name>-<format>.mp4   one MP4 per format, rendered frame by frame by Skillsmart's render.mjs
 *
 *   --format   9x16 (default: Reels, TikTok, Shorts), 4x5 and 1x1 (feeds), 16x9 (YouTube, slides: the picture on
 *              the left, the captions in a column on the right), all (9x16, 1x1 and 16x9), or a list
 *   --draft    half size: a quick look in a fraction of the time
 *   --no-audio the picture only
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ffmpegPath, launch, openReel, serve } from "./browser.mjs";
import { buildPage } from "./page.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const reelArg = args.find((a, i) => !a.startsWith("--") && !["--format", "--out"].includes(args[i - 1]));
if (!reelArg || !existsSync(reelArg)) { console.error("usage: node make.mjs <reel.js> [--format 9x16|4x5|1x1|16x9|all] [--draft] [--no-audio] [--out dir]"); process.exit(2); }
const reelPath = resolve(reelArg), name = basename(reelPath, ".js");
const FORMATS = ["9x16", "4x5", "1x1", "16x9"];
const asked = String(opt("format", "9x16"));
const formats = asked === "all" ? ["9x16", "1x1", "16x9"] : asked.split(",").map((f) => f.trim());
for (const f of formats) if (!FORMATS.includes(f)) { console.error(`--format ${f}? one of ${FORMATS.join(", ")}, or all`); process.exit(2); }
const ff = ffmpegPath();
const outDir = resolve(opt("out", join(process.cwd(), "out")));
mkdirSync(outDir, { recursive: true });
const draft = args.includes("--draft");
const show = (p) => relative(process.cwd(), p) || p;

/* 1. the page */
const page = buildPage(reelPath);
console.log(`page   ${show(page)}`);

/* 2. the soundtrack */
let wav = null;
if (!args.includes("--no-audio")) {
  const srv = await serve(reelPath), browser = await launch();
  const p = await openReel(browser, srv.url("&mode=render&scale=0.25"), { scale: 0.25 });
  const info = await p.evaluate(() => window.trame.info);
  const tmp = join(tmpdir(), `explainer-reel-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  const fx = join(tmp, "fx.wav");
  writeFileSync(fx, Buffer.from(await p.evaluate(() => window.trame.audio()), "base64"));
  await browser.close(); srv.close();
  const timing = (() => { try { return JSON.parse(readFileSync(reelPath.replace(/\.js$/, ".timing.json"), "utf8")); } catch { return null; } })();
  const vo = timing?.audio ? join(dirname(reelPath), timing.audio) : null;
  const d = info.duration.toFixed(3);
  wav = join(outDir, `${name}.wav`);
  if (vo && existsSync(vo)) {
    // the bed and cues duck under the voice (sidechain) and come back up in its pauses; asetpts rebuilds the
    // timestamps after loudnorm so the audio runs to the end
    const filter = `[1:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,asplit=2[vo][key];[0:a]atrim=0:${d},aformat=sample_fmts=fltp:channel_layouts=stereo[fx0];[fx0][key]sidechaincompress=threshold=0.02:ratio=6:attack=20:release=400[fx];[vo][fx]amix=inputs=2:duration=longest:normalize=0,atrim=0:${d},loudnorm=I=-14:TP=-1.5:LRA=11,asetpts=N/SR/TB,aresample=44100[mix]`;
    execFileSync(ff, ["-loglevel", "error", "-y", "-i", fx, "-i", vo, "-filter_complex", filter, "-map", "[mix]", wav], { timeout: 10 * 60 * 1000 });
    console.log(`sound  ${show(wav)}  (voice-over ${basename(vo)} over the bed)`);
  } else {
    execFileSync(ff, ["-loglevel", "error", "-y", "-i", fx, "-af", `atrim=0:${d},loudnorm=I=-20:TP=-2:LRA=11,asetpts=N/SR/TB,aresample=44100`, wav]);
    console.log(`sound  ${show(wav)}  (no voice-over yet: the bed and cues only; scripts/voice.mjs makes one)`);
  }
  rmSync(tmp, { recursive: true, force: true });
}

/* 3. one MP4 per format, frame by frame */
const render = join(dirname(fileURLToPath(import.meta.url)), "render.mjs");
for (const f of formats) {
  const mp4 = join(outDir, `${name}-${f}${draft ? "-draft" : ""}.mp4`);
  const a = [render, "video", page, "--format", f, "--out", mp4, "--crf", draft ? "26" : "20"];
  if (draft) a.push("--draft");
  if (wav) a.push("--audio", wav, "--audio-fade", "0.6");
  const r = spawnSync(process.execPath, a, { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status || 1);
}
console.log(`\nopen ${show(page)} in a browser to play it with its sound (the voice-over file sits next to it)`);
