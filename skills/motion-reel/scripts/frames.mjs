#!/usr/bin/env node
/*
 * node frames.mjs <reel.js> [--scene <n|type>] [--n 8] [--at f1,f2,…] [--beats b1,b2,…] [--samples 1]
 *                 [--scale 0.5] [--cols 6] [--slow 2] [--out <reel>-frames.png]
 *
 * A strip of frames to look at while working on a scene: n frames spread across one scene
 * (its number, 1-based, or its type), or the frames you name (--at), or global beats (--beats).
 * Each frame is labelled with its number, its beat and the scene. --one writes a single frame
 * at full size instead.
 */
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { buildPage, launch, openReel, parseArgs, reelName } from "./lib.mjs";

const a = parseArgs(process.argv.slice(2), ["one"]);
if (!a._[0]) { console.error("usage: node frames.mjs <reel.js> [--scene n|type] [--n 8] [--at f,f] [--beats b,b] [--scale .5] [--cols 6] [--one]"); process.exit(2); }
const reel = resolve(a._[0]), name = reelName(reel);
const out = resolve(a.out || join(dirname(reel), `${name}-frames.png`));
const page = buildPage(reel, join(tmpdir(), `reel-frames-${process.pid}.html`));
const browser = await launch();
const { page: p, info } = await openReel(browser, page, { scale: a.one ? +(a.scale || 1) : +(a.scale || 0.5), samples: +(a.samples || 1), slow: a.slow, format: a.format });

let frames;
if (a.at) frames = String(a.at).split(",").map(Number);
else if (a.beats) frames = String(a.beats).split(",").map((b) => Math.round((+b / info.beats) * info.frames));
else {
  const s = a.scene ? info.scenes.find((x) => String(x.i + 1) === String(a.scene) || x.type === a.scene) : null;
  const [f0, f1] = s ? [s.from, s.to - 1] : [0, info.frames - 1], n = +(a.n || (s ? 8 : 24));
  frames = Array.from({ length: n }, (_, i) => Math.round(f0 + ((f1 - f0) * i) / Math.max(1, n - 1)));
}
const png = await p.evaluate(([frames, cols, one, info]) => {
  const src = Reel.g.canvas;
  if (one) { Reel.draw(frames[0]); return src.toDataURL("image/png").split(",")[1]; }
  const cw = src.width, ch = src.height, lab = 22, gap = 6, rows = Math.ceil(frames.length / cols);
  const k = Math.min(1, 1800 / (cols * (cw + gap))), w = Math.round(cw * k), h = Math.round(ch * k);
  const sheet = document.createElement("canvas"); sheet.width = cols * (w + gap) + gap; sheet.height = rows * (h + lab + gap) + gap;
  const x = sheet.getContext("2d"); x.fillStyle = "#111"; x.fillRect(0, 0, sheet.width, sheet.height);
  x.font = '500 12px "JetBrains Mono", monospace';
  frames.forEach((f, i) => {
    Reel.draw(f);
    const bx = gap + (i % cols) * (w + gap), by = gap + Math.floor(i / cols) * (h + lab + gap);
    const B = (f / info.frames) * info.beats, s = info.scenes.find((q) => f >= q.from && f < q.to) || info.scenes.at(-1);
    x.fillStyle = "#ddd"; x.fillText(`F${f} b${B.toFixed(2)} · ${s.i + 1} ${s.type} +${(B - s.start).toFixed(2)}`, bx, by + 15);
    x.drawImage(src, bx, by + lab, w, h);
  });
  return sheet.toDataURL("image/png").split(",")[1];
}, [frames, +(a.cols || Math.min(6, frames.length)), !!a.one, info]);
writeFileSync(out, Buffer.from(png, "base64"));
const errs = [...new Set(p.errors)];
await browser.close();
for (const e of errs) console.log("page: " + e);
console.log(out);
