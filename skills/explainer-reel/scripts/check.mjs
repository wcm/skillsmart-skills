#!/usr/bin/env node
/*
 * node check.mjs <reel.js> [--format 9x16|4x5|1x1|16x9] [--out sheet.png] [--at 1.5,4,9] [--looks 6.2] [--scale 0.5] [--cols 6] [--width 540]
 *
 * Renders stills and tiles them into one contact sheet (default: <reel>-check.png next to the reel):
 *   default    one still per beat, just before the next caption arrives, plus the final frame
 *   --scale 1  full-size stills (default 0.5); --width sets each tile's width (default: the still's)
 *   --at       stills at those times
 *   --looks t  the frame at time t through every look (each in its own default palette)
 * Then prints the checks:
 *   console    no error or warning from the page (a missing `at` word warns)
 *   pace       every caption stays up 0.6 s or more and is spoken at 4.5 words a second or less
 *   length     the reel runs 8–90 s
 *   layout     (warns) words off the frame or under Instagram's buttons, over the caption, over other
 *              words, or crossed by a drawing; read each one and fix the real ones
 *   cover      (warns) the first frame (the thumbnail) is much darker than the reel's typical frame:
 *              start with the cover already formed (`in: "cut"` just before 0), not drawing on
 * Exit 0 when all pass, 1 when one fails, 2 when no browser could be started.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { serve, launch, openReel, ffmpegPath } from "./browser.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const reelPath = args[0];
if (!reelPath || !existsSync(reelPath)) { console.error("usage: node check.mjs <reel.js> [--out sheet.png] [--at t1,t2] [--looks t] [--scale 0.5] [--cols 6] [--width px]"); process.exit(2); }
const ff = ffmpegPath();
const scale = parseFloat(opt("scale", "0.5"));
const format = opt("format", "9x16");
const out = resolve(opt("out", reelPath.replace(/\.js$/, `${format === "9x16" ? "" : `-${format}`}${args.includes("--looks") ? "-looks.png" : "-check.png"}`)));
const srv = await serve(reelPath);
const browser = await launch();
const logs = [];
const onLog = (type, text) => { if (type === "error" || type === "warning") logs.push(`${type}: ${text}`); };

const tmp = join(tmpdir(), `trame-check-${process.pid}`);
mkdirSync(tmp, { recursive: true });
let shots = [];
const page = await openReel(browser, srv.url(`&mode=render&scale=${scale}&format=${format}`), { scale, onLog, format });
const info = await page.evaluate(() => window.trame.info);
const beats = await page.evaluate(() => window.trame.beats);

const layout = [];
const shoot = async (p, t, name) => {
  const jpg = await p.evaluate(async (t) => { window.trame.frame(t); return window.trame.grab("image/png"); }, t);
  if (!args.includes("--looks")) for (const issue of await p.evaluate((t) => window.trame.audit(t), t)) layout.push(`${t.toFixed(1)} s: ${issue}`);
  const f = join(tmp, `${String(shots.length).padStart(3, "0")}.png`);
  writeFileSync(f, Buffer.from(jpg, "base64"));
  shots.push({ f, t, name });
};

if (args.includes("--looks")) {
  const t = parseFloat(opt("looks", "3"));
  for (const look of ["halftone", "led", "crt", "neon", "riso", "blueprint", "dither", "chalk"]) {
    const p = await openReel(browser, srv.url(`&mode=render&scale=${scale}&format=${format}&look=${look}&palette=default`), { scale, onLog, format });
    await shoot(p, t, look);
    await p.close();
  }
} else {
  // each beat as it stands just before the next caption arrives (so cues on its last word have landed)
  const times = opt("at") ? opt("at").split(",").map(Number) : [...beats.map((b, i) => Math.max(b.start + 0.3, beats[i + 1] ? beats[i + 1].start - 0.24 : b.end + 0.35)), info.duration - 0.05];
  for (const t of times.slice(0, 48)) await shoot(page, t, `${t.toFixed(1)}s`);
}
// the cover: frame 0 against the reel's typical frame, by mean brightness
let cover = null;
if (!opt("at") && !args.includes("--looks")) {
  const png = await page.evaluate(async () => { window.trame.frame(0); return window.trame.grab("image/png"); });
  writeFileSync(join(tmp, "cover.png"), Buffer.from(png, "base64"));
  const luma = (f) => { const raw = execFileSync(ff, ["-loglevel", "error", "-i", f, "-vf", "scale=54:96,format=gray", "-f", "rawvideo", "-"]); let sum = 0; for (const b of raw) sum += b; return sum / raw.length; };
  const typical = shots.map((x) => luma(x.f)).sort((a, b) => a - b)[Math.floor(shots.length / 2)];
  cover = { l: luma(join(tmp, "cover.png")), typical };
}
const cols = parseInt(opt("cols", String(Math.min(shots.length, args.includes("--looks") ? 4 : 6))), 10);
const rows = Math.ceil(shots.length / cols);
execFileSync(ff, ["-loglevel", "error", "-y", "-framerate", "1", "-i", join(tmp, "%03d.png"), "-vf", `scale=${opt("width", Math.round((format === "16x9" ? 1920 : 1080) * scale))}:-1,pad=iw+8:ih+8:4:4:black,tile=${cols}x${rows}`, "-frames:v", "1", out]);
await browser.close(); srv.close();
rmSync(tmp, { recursive: true, force: true });

/* checks */
let fail = 0;
const line = (ok, name, msg, soft) => { console.log(`${ok ? "pass" : soft ? "warn" : "FAIL"}  ${name.padEnd(8)} ${msg}`); if (!ok && !soft) fail++; };
const uniq = [...new Set(logs)];
line(!uniq.length, "console", uniq.length ? uniq.slice(0, 6).join("\n                ") : "clean");
// a caption must stay up long enough to read (until the next one), and not be spoken faster than 4.5 words a second
const fast = beats.filter((b, i) => (beats[i + 1] ? beats[i + 1].start : info.duration) - b.start < 0.6 || b.text.replace(/\*/g, "").split(/\s+/).length / Math.max(0.1, b.end - b.start) > 4.5);
line(!fast.length, "pace", fast.length ? fast.map((b) => `"${b.text}" ${(b.end - b.start).toFixed(2)} s`).join("; ") : `${beats.length} beats, ${(beats.reduce((s, b) => s + b.text.split(/\s+/).length, 0) / info.duration * 60).toFixed(0)} words/min overall`);
line(info.duration >= 8 && info.duration <= 90, "length", `${info.duration.toFixed(1)} s`);
if (cover) line(cover.l >= cover.typical * 0.6, "cover", `first frame ${cover.l.toFixed(1)} vs typical ${cover.typical.toFixed(1)} (mean brightness)${cover.l < cover.typical * 0.6 ? ": the thumbnail is nearly empty; start the cover formed" : ""}`, true);
if (!args.includes("--looks")) line(!layout.length, "layout", layout.length ? layout.slice(0, 14).join("\n                ") + (layout.length > 14 ? `\n                … ${layout.length - 14} more` : "") : "nothing overlaps, nothing off the frame", true);
console.log(`sheet ${out}  (${shots.map((s) => s.name).join(", ").slice(0, 160)})`);
process.exit(fail ? 1 : 0);
