#!/usr/bin/env node
/*
 * node tempo.mjs <song.mp3|wav|m4a> [--min 70] [--max 180]
 *
 * The tempo of a track and where its beats fall, so a reel can be cut to it: set the reel's
 * bpm to the tempo, then render with --audio <song> --at <a beat time> (a downbeat a few bars
 * in is usually the best entry). Prints the tempo, the first beat and the next sixteen.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { needFfmpeg, parseArgs } from "./lib.mjs";

const a = parseArgs(process.argv.slice(2));
if (!a._[0]) { console.error("usage: node tempo.mjs <song> [--min 70] [--max 180]"); process.exit(2); }
needFfmpeg();
const SR = 11025, HOP = 110; /* ~10 ms frames */
const raw = execFileSync("ffmpeg", ["-v", "error", "-i", resolve(a._[0]), "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"], { maxBuffer: 1 << 30 });
const x = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);

/* onset strength: rise in log energy of a low band and a high band, per hop */
const n = Math.floor(x.length / HOP), env = new Float32Array(n);
let lo = 0, prevL = 0, prevH = 0;
for (let k = 0; k < n; k++) {
  let el = 0, eh = 0;
  for (let i = k * HOP; i < (k + 1) * HOP; i++) { lo += 0.08 * (x[i] - lo); el += lo * lo; eh += (x[i] - lo) ** 2; }
  const L = Math.log(1e-9 + el), H = Math.log(1e-9 + eh);
  env[k] = Math.max(0, L - prevL) + Math.max(0, H - prevH);
  prevL = L; prevH = H;
}
const mean = env.reduce((s, v) => s + v, 0) / n;
for (let k = 0; k < n; k++) env[k] = Math.max(0, env[k] - mean);

/* tempo: autocorrelation, weighted towards 120 so octaves resolve the usual way */
const fps = SR / HOP, min = +(a.min || 70), max = +(a.max || 180);
let best = { s: -1 };
for (let bpm = min; bpm <= max; bpm += 0.1) {
  const lag = (60 / bpm) * fps;
  let s = 0;
  for (const m of [1, 2, 4]) { const L = lag * m, l0 = Math.floor(L), f = L - l0; for (let k = 0; k + l0 + 1 < n; k++) s += env[k] * (env[k + l0] * (1 - f) + env[k + l0 + 1] * f) / m; }
  s *= Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.9) ** 2);
  if (s > best.s) best = { s, bpm };
}
/* phase: the offset whose beat grid collects the most onset strength */
const period = (60 / best.bpm) * fps;
let ph = { s: -1 };
for (let o = 0; o < period; o += 0.25) { let s = 0; for (let t = o; t < n; t += period) s += env[Math.round(t)] || 0; if (s > ph.s) ph = { s, o }; }
const first = ph.o / fps, beat = 60 / best.bpm;
console.log(`tempo   ${best.bpm.toFixed(1)} BPM   (a beat is ${beat.toFixed(4)}s)`);
console.log(`first   beat at ${first.toFixed(3)}s`);
console.log(`beats   ${Array.from({ length: 16 }, (_, i) => (first + i * beat).toFixed(2)).join(" ")}`);
console.log(`length  ${(x.length / SR).toFixed(2)}s`);
