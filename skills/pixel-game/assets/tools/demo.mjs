// Demo videos: frame-exact 1080×1920 MP4s with each game's own soundtrack, cut down to the best
// moments. Each game's directors are in tools/games/<game>/demo.mjs: a director plays the page
// through its manual clock (__fr), recording some stretches and skipping others (a skip is a hard cut: the game runs on, nothing is captured, one-off
// sounds are dropped, the music keeps its state). Every sound is logged instead of played and
// rendered offline afterwards, in time with the frames, and evened out to the loudness social
// apps play at (-16 LUFS). Needs ffmpeg.
//
//   node demo.mjs                   → every game's videos, into out/demo-<video>.mp4
//   node demo.mjs kombat            → one game's videos
//   node demo.mjs fly kombat-sam    → just those
//
// A director is async run(r) using the recorder below: r.rec(secs, until), r.skip(until, cap),
// r.act(fn, arg) and r.peek(expr), where until and expr are expressions over g (main's state)
// and w (its world or round). The seeds and moments were picked by simulating ahead with the
// same sim (see tools/games/<game>/sim.mjs); they change if the sim does.

import { spawn } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { OUT, PAGES, gameTools, open } from './lib.mjs';

const FPS = 30;
const BATCH = 6; // frames per round trip to the page

class Recorder {
  // duckers: the game's sounds that silence the music by themselves (the music replay has to know).
  constructor(game, name, duckers) {
    this.game = game;
    this.name = name;
    this.duckers = duckers || [];
    this.base = join(OUT, `demo-${name}`);
    this.frames = 0;
  }

  async start() {
    this.g = await open(this.game, { width: 540, height: 960, scale: 1 });
    await this.g.ev((DUCKERS) => {
      __fr.view.resize(5);
      const A = R.audio;
      A.init = () => false;
      A.level = 0;
      window.__vt = 0;
      window.__mute = false;
      window.__alog = [];
      window.__seq0 = { song: A.seq.song, intensity: A.seq.intensity, ducked: A.seq.ducked };
      window.__duckers = DUCKERS;
      // Log every sound instead of playing it; skips drop the one-off sounds.
      for (const n of Object.keys(A)) {
        if (typeof A[n] !== 'function' || ['init', 'setup', 'setLevel'].includes(n)) continue;
        A['_' + n] = A[n];
        A[n] = (...a) => {
          if (!__mute) __alog.push({ t: __vt, fn: n, a });
        };
      }
      // The music's state changes are always kept, so after a cut it plays on in the right song.
      for (const n of ['setSong', 'setIntensity', 'duck', 'slow', 'stutter']) {
        const f = A.seq[n].bind(A.seq);
        A.seq['_' + n] = f;
        A.seq[n] = (...a) => {
          if (!__mute || n !== 'stutter') __alog.push({ t: __vt, seq: n, a });
          f(...a);
        };
      }
      // Two 1/60 s ticks per video frame: the engine never thinks it's running slow.
      const canvas = document.getElementById('game');
      window.__demo = (max, cond, capture) => {
        const f = cond ? new Function('g', 'w', 'R', `return (${cond});`) : null;
        const out = [];
        let hit = false;
        window.__mute = !capture;
        for (let i = 0; i < max; i++) {
          const g = __fr.game;
          if (f && f(g, g.world || g.round || null, R)) {
            hit = true;
            break;
          }
          __fr.tick(1 / 60, 2);
          if (capture) {
            __vt += 1 / 30;
            out.push(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]);
          }
        }
        window.__mute = false;
        return { out, hit };
      };
    }, this.duckers);
    this.ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-crf', '19', '-r', String(FPS), `${this.base}-video.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
  }

  // Run something in the page (fn and its argument, as for page.evaluate).
  act(fn, arg) {
    return this.g.ev(fn, arg);
  }
  // Read something from the page: an expression over g (main's state), w (its world or round).
  peek(expr) {
    return this.g.ev((expr) => {
      const g = __fr.game;
      return new Function('g', 'w', 'R', `return (${expr});`)(g, g.world || g.round || null, R);
    }, expr);
  }

  // Record up to `secs` seconds, stopping early once `until` (an expression) is true.
  async rec(secs, until) {
    let left = Math.round(secs * FPS);
    while (left > 0) {
      const r = await this.g.ev(([n, c]) => __demo(n, c, true), [Math.min(BATCH, left), until || null]);
      for (const b64 of r.out) {
        this.frames++;
        if (!this.ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise((res) => this.ff.stdin.once('drain', res));
      }
      left -= r.out.length;
      if (r.hit) return true;
    }
    return false;
  }
  // Run on without recording until `until` is true (or `cap` seconds pass): a cut.
  async skip(until, cap = 600) {
    let left = Math.round(cap * FPS);
    while (left > 0) {
      const r = await this.g.ev(([n, c]) => __demo(n, c, false), [Math.min(240, left), until]);
      if (r.hit) return true;
      left -= 240;
    }
    return false;
  }

  async finish() {
    this.ff.stdin.end();
    await new Promise((res) => this.ff.on('close', res));
    const dur = this.frames / FPS;
    // The soundtrack: the sequencer replayed through the logged song, intensity and duck
    // changes, then every logged sound at its time, all into an OfflineAudioContext.
    const wav = await this.g.ev(async (dur) => {
      const A = R.audio;
      const sr = 44100;
      const ctx = new OfflineAudioContext(2, Math.ceil(sr * (dur + 0.5)), sr);
      A.setup(ctx);
      A.level = 0;
      A.seq.ducked = false;
      const log = __alog.slice();
      const changes = log.filter((e) => e.seq === 'setSong' || e.seq === 'setIntensity' || e.seq === 'duck' || __duckers.includes(e.fn));
      let { song, intensity, ducked } = __seq0;
      let ci = 0;
      let t = 0.05;
      let step = 0;
      while (t < dur) {
        while (ci < changes.length && changes[ci].t <= t) {
          const c = changes[ci++];
          if (c.seq === 'setSong') song = c.a[0];
          if (c.seq === 'setIntensity') intensity = c.a[0];
          if (c.seq === 'duck') ducked = c.a[0];
          if (c.fn) ducked = true;
        }
        const z = A.seq.songs[song] || A.seq.songs[0];
        const sd = 60 / z.bpm / 4;
        A.seq.intensity = intensity;
        if (!ducked) A.seq.play(step, t, z, sd);
        t += sd;
        step = (step + 1) % 64;
      }
      for (const e of log) {
        A.at = e.t + 0.01;
        if (e.fn) A['_' + e.fn](...e.a);
        else if (e.seq === 'slow' || e.seq === 'stutter') A.seq['_' + e.seq](...e.a);
      }
      A.at = null;
      const buf = await ctx.startRendering();
      const n = buf.length;
      const L = buf.getChannelData(0);
      const Rr = buf.getChannelData(1);
      const out = new DataView(new ArrayBuffer(44 + n * 4));
      const str = (o, s) => {
        for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i));
      };
      str(0, 'RIFF');
      out.setUint32(4, 36 + n * 4, true);
      str(8, 'WAVE');
      str(12, 'fmt ');
      out.setUint32(16, 16, true);
      out.setUint16(20, 1, true);
      out.setUint16(22, 2, true);
      out.setUint32(24, sr, true);
      out.setUint32(28, sr * 4, true);
      out.setUint16(32, 4, true);
      out.setUint16(34, 16, true);
      str(36, 'data');
      out.setUint32(40, n * 4, true);
      for (let i = 0; i < n; i++) {
        out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
        out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, Rr[i])) * 32767, true);
      }
      const bytes = new Uint8Array(out.buffer);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return { b64: btoa(bin), sounds: log.length };
    }, dur);
    writeFileSync(`${this.base}-audio.wav`, Buffer.from(wav.b64, 'base64'));
    const errors = this.g.errors.slice();
    await this.g.close();
    await new Promise((res) => spawn('ffmpeg', ['-y', '-v', 'error', '-i', `${this.base}-video.mp4`, '-i', `${this.base}-audio.wav`, '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', `${this.base}.mp4`], { stdio: 'inherit' }).on('close', res));
    rmSync(`${this.base}-video.mp4`);
    rmSync(`${this.base}-audio.wav`);
    console.log(`${this.base}.mp4: ${this.frames} frames, ${dur.toFixed(1)} s, ${wav.sounds} sounds${errors.length ? '\n  ' + errors.join('\n  ') : ''}`);
  }
}

// ---------------- the runner ----------------
const all = {};
for (const game of Object.keys(PAGES)) {
  const file = join(gameTools(game), 'demo.mjs');
  if (!existsSync(file)) continue;
  const mod = await import(pathToFileURL(file));
  for (const [name, v] of Object.entries(mod.videos || {})) all[name] = { game, run: v.run, duckers: mod.duckers };
}
const pick = process.argv.slice(2);
const names = pick.length ? pick.flatMap((p) => (all[p] ? [p] : Object.keys(all).filter((n) => all[n].game === p))) : Object.keys(all);
const bad = pick.filter((p) => !all[p] && !Object.values(all).some((v) => v.game === p));
if (bad.length) throw new Error(`unknown video "${bad[0]}": ${Object.keys(all).join(' | ')}`);
for (const name of names) {
  const v = all[name];
  const r = new Recorder(v.game, name, v.duckers);
  await r.start();
  await v.run(r);
  await r.finish();
}
