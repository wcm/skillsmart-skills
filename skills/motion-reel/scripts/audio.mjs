#!/usr/bin/env node
/*
 * node audio.mjs <reel.js> [--out <reel>.wav] [--from song.mp3 [--at seconds]] [--key A] [--mood minor|major] [--slow 2]
 *
 * The reel's soundtrack, exactly one loop long (frames / fps, to the sample), so video and
 * sound wrap together.
 *
 *   default   a track synthesised from the reel itself: a four-on-the-floor groove at the
 *             reel's tempo, a tick on every scene cut, a fill into the last scene, a breakdown
 *             under it and a swell that lands on the first beat when the reel wraps. Tails of
 *             the last notes are folded onto the start, so the loop has no seam.
 *   --from    fit your own track instead: one loop's worth starting at --at (put it on a
 *             downbeat; scripts/tempo.mjs finds the tempo and the beats), with the bar after
 *             the loop cross-faded into its head so the wrap is continuous. Set the reel's bpm
 *             to the track's first.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadReel, needFfmpeg, parseArgs, reelName } from "./lib.mjs";

const SR = 48000;

/* ------------------------------------------------------------ dsp */

const rnd = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
/* the engine's eases a rewind can run on */
const EASE = {
  linear: (t) => t,
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inOutCubic: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  inOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2),
};
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
/* RBJ biquad, per voice */
function biquad(type, f, q = 0.707) {
  const w = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR, a = Math.sin(w) / (2 * q), c = Math.cos(w);
  let b0, b1, b2, a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
  if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
  else if (type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
  else { b0 = a; b1 = 0; b2 = -a; } /* band-pass */
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => { const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
/* a resonant low-pass whose cutoff can move every sample (Chamberlin state variable) */
function svf() {
  let lp = 0, bp = 0;
  return (x, f, q = 0.9) => { const F = 2 * Math.sin((Math.PI * Math.min(f, SR / 6)) / SR); lp += F * bp; const hp = x - lp - q * bp; bp += F * hp; return lp; };
}

export function synth(info, { key = "A", mood = "minor", seed = 3 } = {}) {
  const len = Math.round((info.frames * SR) / info.fps), spb = len / info.beats, sec = spb / SR;
  const tail = Math.round(SR * 2.5), size = len + tail;
  const drums = [new Float32Array(size), new Float32Array(size)], music = [new Float32Array(size), new Float32Array(size)];
  const put = (bus, i, l, r = l) => { if (i >= 0 && i < size) { bus[0][i] += l; bus[1][i] += r; } };
  const noise = rnd(seed);
  const at = (beat) => Math.round(beat * spb);

  /* instruments: each writes one event starting at sample i0 */
  const kick = (i0, v = 1) => { let ph = 0; for (let i = 0; i < SR * 0.5; i++) { const t = i / SR, f = 46 + 110 * Math.exp(-t / 0.032); ph += (2 * Math.PI * f) / SR; const s = Math.tanh(1.6 * Math.sin(ph) * Math.exp(-t / 0.3) * Math.min(1, t / 0.0015)) + noise() * 0.08 * Math.exp(-t / 0.002); put(drums, i0 + i, s * v * 0.62); } };
  const clap = (i0, v = 1) => { const bp = biquad("bp", 1250, 0.9), bp2 = biquad("bp", 1250, 0.9); for (let i = 0; i < SR * 0.45; i++) { const t = i / SR, burst = [0, 0.011, 0.023].reduce((a, o) => a + (t >= o ? Math.exp(-(t - o) / (o === 0.023 ? 0.13 : 0.008)) : 0), 0); const n = noise(); put(drums, i0 + i, bp(n) * burst * v * 1.1 + bp2(noise()) * Math.exp(-t / 0.28) * 0.13 * v, bp(n) * burst * v * 1.0); } };
  const hat = (i0, v = 1, open = false, pan = 0) => { const hp = biquad("hp", 7600, 0.8), d = open ? 0.2 : 0.032; for (let i = 0; i < SR * (open ? 0.6 : 0.12); i++) { const s = hp(noise()) * Math.exp(-i / SR / d) * v * 0.15; put(drums, i0 + i, s * (1 - pan * 0.4), s * (1 + pan * 0.4)); } };
  const tick = (i0, f = 1800, v = 1) => { for (let i = 0; i < SR * 0.09; i++) { const t = i / SR, e = Math.exp(-t / 0.018); const s = (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(4 * Math.PI * f * t)) * e * 0.22 * v; put(drums, i0 + i, s * 0.8, s); } };
  const crash = (i0, v = 1) => { const hp = biquad("hp", 4200, 0.7), hp2 = biquad("hp", 4500, 0.7); for (let i = 0; i < SR * 2.4; i++) { const e = Math.exp(-i / SR / 0.75) * v * 0.08; put(drums, i0 + i, hp(noise()) * e, hp2(noise()) * e); } };
  const swell = (i0, n) => { const f = svf(), g = svf(); for (let i = 0; i < n; i++) { const k = i / n, c = 300 * 2 ** (k * 4.6), e = k ** 2.2 * 0.16; put(drums, i0 + i, f(noise(), c, 0.5) * e, g(noise(), c * 1.05, 0.5) * e); } };
  const bass = (i0, note, dur, v = 1) => { const f = midi(note), lp = svf(); let ph = 0; const n = Math.round(dur * SR); for (let i = 0; i < n + SR * 0.06; i++) { const t = i / SR; ph += f / SR; const saw = 2 * (ph % 1) - 1, sub = Math.sin(2 * Math.PI * ph); const env = Math.min(1, t / 0.004) * (i < n ? 0.75 + 0.25 * Math.exp(-t / 0.06) : Math.exp(-(i - n) / SR / 0.02)); const s = (lp(saw, 180 + 900 * Math.exp(-t / 0.05), 0.6) * 0.7 + sub * 0.38) * env * v * 0.42; put(music, i0 + i, s); } };
  const stab = (i0, notes, v = 1) => { for (const [k, nt] of notes.entries()) for (const det of [-0.08, 0.08]) { const f = midi(nt + det), lp = svf(); let ph = (k * 0.37 + det) % 1; for (let i = 0; i < SR * 0.5; i++) { const t = i / SR; ph += f / SR; const s = lp(2 * (ph % 1) - 1, 500 + 3200 * Math.exp(-t / 0.07), 0.5) * Math.exp(-t / 0.16) * Math.min(1, t / 0.003) * v * 0.2; put(music, i0 + i, det < 0 ? s : s * 0.6, det < 0 ? s * 0.6 : s); } } };
  const pad = (i0, notes, n, v = 1) => { for (const nt of notes) { const f = midi(nt); for (const [d, pan] of [[-0.06, 0], [0.06, 1]]) { let ph = Math.abs(d); for (let i = 0; i < n + SR * 0.6; i++) { const t = i / SR; ph += (f * (1 + d / 100)) / SR; const tri = 1 - 4 * Math.abs((ph % 1) - 0.5); const env = Math.min(1, t / 0.35) * (i < n ? 1 : Math.exp(-(i - n) / SR / 0.25)); const s = (0.7 * tri + 0.3 * Math.sin(2 * Math.PI * ph * 2)) * env * v * 0.075; put(music, i0 + i, pan ? s * 0.5 : s, pan ? s : s * 0.5); } } } };

  /* harmony: four chords, one a bar, around the key */
  const root = 45 + ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"].indexOf(key.toUpperCase()) - 12 * (["A", "A#", "B"].includes(key.toUpperCase()) ? 0 : 1);
  const prog = mood === "major" ? [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]] : [[0, 3, 7, 10], [-4, 0, 3, 7], [3, 7, 10, 14], [-2, 2, 5, 9]];

  /* arrangement: groove until the last scene, a breakdown under it */
  const last = info.scenes[info.scenes.length - 1], calm = (last.len ?? last.beats) >= 3 ? last.start : info.beats;
  for (let bt = 0; bt < info.beats; bt++) {
    const i0 = at(bt), bar = Math.floor(bt / 4), chord = prog[bar % 4].map((x) => x + root + 24), inGroove = bt < calm;
    if (inGroove) {
      kick(i0, bt === 0 ? 1.15 : 1);
      if (bt % 2 === 1) clap(i0, 0.8);
      hat(at(bt + 0.5), 0.9, bt % 4 === 3, 0.3);
      hat(at(bt + 0.25), 0.28, false, -0.4); hat(at(bt + 0.75), 0.36, false, -0.3);
      bass(at(bt + 0.5), chord[0] - 24, sec * 0.4, 1);
      if (bt % 4 === 0) pad(i0, chord, Math.round(4 * spb), 0.8);
      for (const s16 of [3, 6, 10, 14]) if (Math.floor(s16 / 4) === bt % 4) stab(at(bar * 4 + s16 / 4), chord, bt % 8 < 4 ? 0.8 : 1);
      if (bt >= calm - 2) for (let k = 0; k < 4; k++) clap(at(bt + k / 4), 0.25 + 0.35 * ((bt - (calm - 2)) * 4 + k) / 8);
    } else {
      if (bt % 4 === 0 || bt === calm) pad(i0, chord, Math.round(Math.min(4, info.beats - bt) * spb), 1.3);
      bass(i0, chord[0] - 24, sec * 0.9, 0.7);
      hat(at(bt + 0.5), 0.35, false, 0.2);
    }
  }
  /* a tick on every cut, the first beat lands with a crash, a swell into the wrap */
  for (const s of info.scenes) if (s.start > 0) tick(at(s.start), (s.len ?? s.beats) < 1 ? 2400 : 1700, (s.len ?? s.beats) < 1 ? 0.7 : 1);
  crash(0, 1);
  const sw = Math.round(Math.min(2, info.beats - calm || 2) * spb);
  swell(len - sw, sw);

  /* sidechain the music to the kick, sum, fold the tail onto the head, master */
  const out = [new Float32Array(len), new Float32Array(len)];
  for (let ch = 0; ch < 2; ch++) {
    for (let i = 0; i < size; i++) {
      const bt = (i % len) / spb, ph = bt - Math.floor(bt), duck = bt < calm || i >= len ? 1 - 0.55 * Math.exp(-ph * sec / 0.11) : 1;
      out[ch][i % len] += drums[ch][i] + music[ch][i] * duck;
    }
  }
  /* a rewind plays the track itself backwards at the picture's own speed: it slows to a stop,
     runs back faster and faster (darker and hissier with speed, as tape does) and brakes into the
     moment it lands on, so it lands in time with the picture and the loop has no seam */
  for (const s of info.scenes) if (s.rewind) {
    const rs = at(s.start), re = Math.min(len, at(s.start + (s.len ?? s.beats))), from = rs - 1, to = Math.round(((s.rewind.to || 0) / info.beats) * len), span = Math.max(1, from - to);
    const E = EASE[s.rewind.ease] || EASE.inOutCubic, src = out.map((c) => c.slice(0, rs)), hiss = rnd(77);
    const pos = (i) => from - span * E((i - rs) / (re - rs));
    for (let ch = 0; ch < 2; ch++) {
      let lp = src[ch][rs - 1] || 0;
      for (let i = rs; i < re; i++) {
        const p = pos(i), k = Math.floor(p), f = p - k, v = (src[ch][Math.max(0, k)] || 0) * (1 - f) + (src[ch][Math.min(rs - 1, k + 1)] || 0) * f;
        const speed = Math.abs(pos(i + 1) - p), a = 1 / (1 + 0.22 * Math.max(0, speed - 1));
        lp += (v - lp) * a;
        out[ch][i] = lp * (0.9 + 0.1 * Math.exp(-(i - rs) / 2400)) + hiss() * 0.018 * Math.min(1, speed / 3);
      }
    }
  }
  /* music.shepard: a Shepard–Risset glissando, a tone that rises for ever. Nine octaves of sine
     glide up together, each fading in at the bottom and out at the top. It climbs a whole number
     of octaves per loop, and its base frequency makes every partial's phase a whole number of
     turns at each octave, so the loop is seamless. */
  if (info.music && info.music.shepard) {
    const Ls = len / SR, m = Math.max(1, Math.round(Ls / 12)), T = Ls / m, K = 9, n = Math.max(1, Math.round((27.5 * T) / Math.LN2)), lvl = 0.032 * (+info.music.shepard || 1);
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      let v = 0;
      for (let k = 0; k < K; k++) { const x = (k + t / T) % K, a = Math.exp(-(((x - K / 2) / (K / 5)) ** 2)); v += a * Math.sin(2 * Math.PI * n * 2 ** x); }
      out[0][i] += v * lvl; out[1][i] += v * lvl;
    }
  }
  let peak = 0;
  for (const c of out) {
    /* a gentle master low-pass, run twice round the loop so its state wraps too */
    const lp = biquad("lp", 12500, 0.6), y = new Float32Array(len);
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < len; i++) y[i] = lp(c[i]);
    c.set(y);
  }
  /* level to about -14 dB RMS, soft-clip the peaks, then a ceiling of -0.5 dB */
  let sq = 0;
  for (const c of out) for (let i = 0; i < len; i++) sq += c[i] * c[i];
  const pre = 0.2 / Math.sqrt(sq / (2 * len) || 1);
  for (const c of out) for (let i = 0; i < len; i++) { c[i] = Math.tanh(c[i] * pre * 1.1) / 1.1; peak = Math.max(peak, Math.abs(c[i])); }
  const gain = Math.min(1, 0.94 / (peak || 1));
  for (const c of out) for (let i = 0; i < len; i++) c[i] *= gain;
  return out;
}

/* fit a track: len samples from at, the bar after the loop cross-faded into the head */
export function fitTrack(file, info, at = 0) {
  needFfmpeg();
  const len = Math.round((info.frames * SR) / info.fps), xf = Math.round(Math.min(len / info.beats, SR * 0.6));
  const raw = execFileSync("ffmpeg", ["-v", "error", "-ss", String(at), "-i", file, "-t", String((len + xf) / SR + 0.1), "-f", "f32le", "-ac", "2", "-ar", String(SR), "-"], { maxBuffer: 1 << 30 });
  const src = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4), frames = src.length / 2;
  if (frames < len) throw new Error(`the track is ${(frames / SR).toFixed(2)}s from ${at}s; the loop needs ${(len / SR).toFixed(2)}s`);
  const out = [new Float32Array(len), new Float32Array(len)];
  for (let i = 0; i < len; i++) for (let ch = 0; ch < 2; ch++) {
    let v = src[i * 2 + ch];
    if (i < xf && len + i < frames) { const k = i / xf, a = Math.sin((k * Math.PI) / 2), b = Math.cos((k * Math.PI) / 2); v = v * a + src[(len + i) * 2 + ch] * b; }
    out[ch][i] = v;
  }
  return out;
}

export function writeWav(path, [L, R]) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4); }
  writeFileSync(path, buf);
  return path;
}

export async function makeAudio(reelPath, out, { from, at = 0, key, mood, slow } = {}) {
  const info = await loadReel(reelPath, { slow });
  const ch = from ? fitTrack(resolve(from), info, +at) : synth(info, { key: key || info.music.key || "A", mood: mood || info.music.mood || "minor" });
  return writeWav(out, ch);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = parseArgs(process.argv.slice(2));
  if (!a._[0]) { console.error("usage: node audio.mjs <reel.js> [--out reel.wav] [--from song.mp3 [--at s]] [--key A] [--mood minor|major]"); process.exit(2); }
  const reel = resolve(a._[0]);
  const out = resolve(a.out || join(dirname(reel), `${reelName(reel)}.wav`));
  await makeAudio(reel, out, { from: a.from, at: a.at, key: a.key, mood: a.mood, slow: a.slow });
  console.log(out);
}
