#!/usr/bin/env node
/*
 * node check.mjs <reel.js> [--out <reel>-check.png] [--slow 2]
 *
 * Opens the reel in headless Chrome, draws every scene at three moments and the frames
 * around the wrap, writes one contact sheet (<reel>-check.png) and prints a line per check:
 *
 *   console   no error or warning from the page
 *   spec      the reel's own warnings: unknown options, text that does not fit
 *   words     no «placeholder» of a starter is left
 *   bars      the scenes add up to whole bars, so the loop sits on the music
 *   length    6 to 90 seconds (most reels run 20 to 60)
 *   pace      every scene holds the screen 2 s or more, every shot of a burst 1 s (a warning)
 *   seam      the wrap (last frame → first) moves no more than the frames either side of it
 *   cuts      every cut changes the picture (a warning: the same ground across a cut)
 *   blank     no scene is a flat colour in the middle of its time
 *
 * Exit 0 when all pass, 1 when one fails, 2 when no browser could be started.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { buildPage, launch, openReel, parseArgs, reelName } from "./lib.mjs";

const a = parseArgs(process.argv.slice(2));
if (!a._[0]) { console.error("usage: node check.mjs <reel.js> [--out sheet.png]"); process.exit(2); }
const reel = resolve(a._[0]), name = reelName(reel);
const sheet = resolve(a.out || join(dirname(reel), `${name}-check.png`));
const page = buildPage(reel, join(tmpdir(), `reel-check-${process.pid}.html`));
let browser;
try { browser = await launch(); } catch (e) { console.error(String(e.message || e)); process.exit(2); }
const { page: p, info } = await openReel(browser, page, { scale: 0.5, slow: a.slow, format: a.format });

const result = await p.evaluate(async (info) => {
  const N = info.frames, g = Reel.g, src = g.canvas;
  /* a small copy of a frame, for comparing */
  const tiny = document.createElement("canvas"); tiny.width = 108; tiny.height = Math.round((108 * info.h) / info.w);
  const tx = tiny.getContext("2d", { willReadFrequently: true });
  const sample = (f) => { Reel.draw(f); tx.drawImage(src, 0, 0, tiny.width, tiny.height); return tx.getImageData(0, 0, tiny.width, tiny.height).data; };
  const diff = (A, B) => { let s = 0; for (let i = 0; i < A.length; i += 4) s += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); return s / (A.length / 4) / 3; };
  const spread = (A) => { let m = [0, 0, 0], n = A.length / 4; for (let i = 0; i < A.length; i += 4) { m[0] += A[i]; m[1] += A[i + 1]; m[2] += A[i + 2]; } m = m.map((x) => x / n); let v = 0; for (let i = 0; i < A.length; i += 4) v += (A[i] - m[0]) ** 2 + (A[i + 1] - m[1]) ** 2 + (A[i + 2] - m[2]) ** 2; return Math.sqrt(v / n / 3); };

  /* the wrap: diffs of consecutive frames from N-6 to 5 */
  const around = []; for (let k = -6; k <= 5; k++) around.push((k + N) % N);
  const frames = around.map(sample), diffs = [];
  for (let i = 0; i < frames.length - 1; i++) diffs.push(diff(frames[i], frames[i + 1]));
  const seamAt = 5, seam = diffs[seamAt], others = diffs.filter((_, i) => i !== seamAt).sort((x, y) => x - y);
  /* every cut, for the record */
  /* a cut is a hand-off (not a cut that should change the picture) when a transition carries it,
     the scene continues the one before, or the one before lands on it (a rewind) */
  const cuts = info.scenes.slice(1).map((s) => { const pv = info.scenes[s.i - 1]; return { i: s.i, label: s.label, d: diff(sample(s.from - 1), sample(s.from)), continues: [].concat(Reel.defs[s.type].continues || []).includes(pv.type) || !!(pv.out && pv.out !== "cut") || !!(s.in && s.in !== "cut") || pv.seamless }; });
  const blanks = info.scenes.filter((s) => spread(sample(Math.round((s.from + s.to) / 2))) < 2).map((s) => `${s.i + 1} ${s.label}`);

  /* the sheet: each scene at 20%, 55%, 90%; then the wrap */
  const cw = 180, ch = Math.round((cw * info.h) / info.w), per = 8, lab = 26, gap = 6;
  const bands = Math.ceil(info.scenes.length / per), sw = 112, sh = Math.round((sw * info.h) / info.w);
  const sheet = document.createElement("canvas");
  sheet.width = per * (cw + gap) + gap; sheet.height = bands * (3 * (ch + gap) + lab + gap) + sh + lab + 3 * gap + 30;
  const x = sheet.getContext("2d");
  x.fillStyle = "#111"; x.fillRect(0, 0, sheet.width, sheet.height);
  x.font = '500 13px "JetBrains Mono", monospace'; x.fillStyle = "#ddd";
  info.scenes.forEach((s, k) => {
    const bx = gap + (k % per) * (cw + gap), by = gap + Math.floor(k / per) * (3 * (ch + gap) + lab + gap);
    x.fillStyle = "#ddd"; x.fillText(`${String(s.i + 1).padStart(2, "0")} ${s.label.slice(0, 16)} ${+(s.len ?? s.beats).toFixed(2)}b`, bx, by + 16);
    [0.2, 0.55, 0.9].forEach((q, r) => { Reel.draw(Math.min(s.to - 1, Math.round(s.from + q * (s.to - s.from)))); x.drawImage(src, bx, by + lab + r * (ch + gap), cw, ch); });
  });
  const sy = gap + bands * (3 * (ch + gap) + lab + gap);
  x.fillStyle = "#ddd"; x.fillText(`the wrap: frames ${N - 6} … ${N - 1} | 0 … 5   (seam diff ${seam.toFixed(2)}, neighbours median ${others[Math.floor(others.length / 2)].toFixed(2)})`, gap, sy + 16);
  around.forEach((f, i) => { Reel.draw(f); const xx = gap + i * (sw + 4) + (i >= 6 ? 14 : 0); x.drawImage(src, xx, sy + lab, sw, sh); if (i === 6) { x.fillStyle = "#e8643a"; x.fillRect(xx - 10, sy + lab, 4, sh); } });
  return { seam, diffs, others, cuts, blanks, png: sheet.toDataURL("image/png").split(",")[1], warnings: Reel.warnings() };
}, info);

writeFileSync(sheet, Buffer.from(result.png, "base64"));
await browser.close();

const lines = [];
const check = (ok, id, msg, warnOnly = false) => lines.push({ ok, id, msg, warnOnly });
const errs = [...new Set(p.errors.filter((e) => !e.includes("[reel]")))];
check(!errs.length, "console", errs.length ? errs.join(" | ") : "clean");
check(!result.warnings.length, "spec", result.warnings.length ? result.warnings.join(" | ") : "no warnings");
/* a starter's «placeholders» are where the reel's own words go: none may be left */
const src = readFileSync(reel, "utf8"), left = [...src.matchAll(/«[^»\n]*»/g)].map((m) => `${m[0]} (line ${src.slice(0, m.index).split("\n").length})`);
check(!left.length, "words", left.length ? `${left.length} placeholder${left.length > 1 ? "s" : ""} left: ${left.slice(0, 8).join(", ")}${left.length > 8 ? " …" : ""}` : "no placeholders left");
check(Number.isInteger(info.bars), "bars", `${info.beats} beats = ${info.bars} bars at ${info.bpm} BPM`);
check(info.seconds >= 6 && info.seconds <= 90, "length", `${info.seconds.toFixed(2)}s, ${info.frames} frames at ${info.fps}fps${info.seconds < 20 || info.seconds > 60 ? " (most reels run 20–60s)" : ""}`);
/* a scene gone before the eye has found what it does is wasted: more beats, or slow */
const spb = info.seconds / info.beats, sec = (b) => b * spb;
const short = info.scenes.filter((s) => sec(s.len) < 2 - 1e-6).map((s) => `${s.i + 1} ${s.label} ${sec(s.len).toFixed(2)}s`);
const quick = info.scenes.filter((s) => s.shot && sec(s.shot) < 1 - 1e-6).map((s) => `${s.i + 1} ${s.label} ${sec(s.shot).toFixed(2)}s a shot`);
check(!short.length && !quick.length, "pace", short.length || quick.length ? `too short to follow (a scene needs 2s on screen, a shot of a burst 1s): ${[...short, ...quick].join(", ")}; give it more beats, or slow` : "every scene holds 2s or more, every shot 1s or more", true);
const med = result.others[Math.floor(result.others.length / 2)], max = result.others.at(-1);
check(result.seam <= Math.max(1.5 * max, 6), "seam", `last → first frame differs by ${result.seam.toFixed(2)}; the frames around it by ${med.toFixed(2)} (median), ${max.toFixed(2)} (max)`);
const flat = result.cuts.filter((c) => c.d < 12 && !c.continues);
check(!flat.length, "cuts", flat.length ? `the picture barely changes at the cut into ${flat.map((c) => `${c.i + 1} ${c.label}`).join(", ")}: fine for a hand-off through the dot, otherwise change a bg or reorder` : "every cut changes the picture", true);
check(!result.blanks.length, "blank", result.blanks.length ? `flat at mid-scene: ${result.blanks.join(", ")}` : "every scene draws");
for (const l of lines) console.log(`${l.ok ? "PASS" : l.warnOnly ? "WARN" : "FAIL"}  ${l.id.padEnd(8)} ${l.msg}`);
console.log(`      cuts     ${result.cuts.map((c) => `${c.i + 1}:${c.d.toFixed(0)}`).join(" ")}`);
console.log(sheet);
process.exit(lines.some((l) => !l.ok && !l.warnOnly) ? 1 : 0);
