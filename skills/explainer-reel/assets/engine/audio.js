/*
 * Sound: a soft ambient bed under the voice, and small cues the elements raise as they enter
 * (a tick for a label, clicks while text types, a swell while a line draws, a whoosh for a morph,
 * a chime when a progress dot fills). All synthesised in an OfflineAudioContext from a seed, so
 * the preview and the export hear the same thing and nothing has to be licensed.
 */
import { rng } from "./geom.js";

const MOODS = {
  // [root midi, chord intervals] × 4, each held `bar` seconds
  warm: { bar: 8, chords: [[50, [0, 7, 11, 14, 16]], [47, [0, 7, 10, 14, 15]], [43, [0, 7, 11, 14, 19]], [45, [0, 7, 9, 14, 16]]], cutoff: 1100 },
  night: { bar: 10, chords: [[45, [0, 7, 10, 14, 15]], [41, [0, 7, 11, 14, 16]], [48, [0, 7, 11, 14, 19]], [43, [0, 7, 9, 14, 17]]], cutoff: 800 },
  bright: { bar: 6, chords: [[48, [0, 7, 12, 16, 19]], [45, [0, 7, 12, 15, 19]], [41, [0, 7, 12, 16, 21]], [43, [0, 7, 12, 14, 19]]], cutoff: 1600 },
  tense: { bar: 6, chords: [[45, [0, 7, 12, 15]], [46, [0, 6, 12, 15]], [45, [0, 7, 12, 15]], [44, [0, 7, 13, 15]]], cutoff: 900, pulse: true },
};
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function impulse(ctx, secs = 3.2, decay = 2.6, seed = 5) {
  const r = rng(seed), n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / n, decay);
  }
  return b;
}
function noiseBuf(ctx, secs = 2, seed = 9) {
  const r = rng(seed), n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
  return b;
}

function bed(ctx, out, dur, mood, gain) {
  const M = MOODS[mood] || MOODS.warm, bus = ctx.createGain();
  bus.gain.value = gain;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = M.cutoff; lp.Q.value = 0.4;
  bus.connect(lp); lp.connect(out);
  const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
  lfo.frequency.value = 0.05; lfoG.gain.value = M.cutoff * 0.35;
  lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start(0); lfo.stop(dur + 4);
  const bars = Math.ceil(dur / M.bar) + 1;
  for (let i = 0; i < bars; i++) {
    const [root, iv] = M.chords[i % M.chords.length], t0 = i * M.bar - 1.5, t1 = t0 + M.bar + 3;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, Math.max(0, t0));
    env.gain.linearRampToValueAtTime(1, Math.max(0, t0) + 2.5);
    env.gain.setValueAtTime(1, t1 - 3);
    env.gain.linearRampToValueAtTime(0, t1);
    env.connect(bus);
    const notes = [root - 12, ...iv.map((x) => root + 12 + x)];
    notes.forEach((m, j) => {
      for (const det of j === 0 ? [0] : [-7, 7]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = j === 0 ? "sine" : "triangle";
        o.frequency.value = hz(m); o.detune.value = det;
        g.gain.value = j === 0 ? 0.16 : 0.045;
        o.connect(g); g.connect(env);
        o.start(Math.max(0, t0)); o.stop(t1 + 0.1);
      }
    });
    if (M.pulse) for (let b = 0; b < M.bar / 0.5; b++) {
      const t = Math.max(0, t0 + 1.5 + b * 0.5), o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = hz(root - 12);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.45);
    }
  }
  // air: filtered noise breathing on top
  const air = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ag = ctx.createGain();
  air.buffer = noiseBuf(ctx, 4, 21); air.loop = true;
  bp.type = "bandpass"; bp.frequency.value = 5200; bp.Q.value = 0.7;
  ag.gain.value = 0.012;
  air.connect(bp); bp.connect(ag); ag.connect(out);
  air.start(0); air.stop(dur + 4);
}

function cue(ctx, out, c, noise, r, sc) {
  const t = Math.max(0, c.t), g = ctx.createGain(), k = c.gain ?? 1;
  g.connect(out);
  const osc = (type, f0, f1, d, vol, at = t) => {
    const o = ctx.createOscillator(), e = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, at); if (f1) o.frequency.exponentialRampToValueAtTime(f1, at + d);
    e.gain.setValueAtTime(0, at); e.gain.linearRampToValueAtTime(vol, at + 0.006); e.gain.exponentialRampToValueAtTime(0.0008, at + d);
    o.connect(e); e.connect(g); o.start(at); o.stop(at + d + 0.05);
  };
  const hiss = (f0, f1, d, vol, q = 1.2, at = t, type = "bandpass") => {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), e = ctx.createGain();
    s.buffer = noise; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, at); f.frequency.exponentialRampToValueAtTime(f1, at + d);
    e.gain.setValueAtTime(0, at); e.gain.linearRampToValueAtTime(vol, at + d * 0.45); e.gain.linearRampToValueAtTime(0, at + d);
    s.connect(f); f.connect(e); e.connect(g); s.start(at, r() * 1.5); s.stop(at + d + 0.05);
  };
  switch (c.kind) {
    case "tick": osc("sine", 2300, 0, 0.05, 0.05 * k); osc("sine", 3450, 0, 0.03, 0.02 * k); break;
    case "pop": osc("sine", 560, 190, 0.11, 0.12 * k); break;
    case "type": {
      const d = Math.min(c.dur ?? 0.4, 1.2);
      for (let x = 0; x < d; x += 0.034 + r() * 0.02) hiss(3200 + r() * 1500, 3000, 0.012, 0.05 * k, 3, t + x, "highpass");
      break;
    }
    case "draw": { const d = Math.max(0.3, Math.min(c.dur ?? 1, 2)); hiss(500, 1700, d, 0.035 * k, 0.9); break; }
    case "morph": case "whoosh": {
      const d = Math.max(0.4, Math.min(c.dur ?? 1, 2));
      hiss(280, 2400, d * 0.6, 0.07 * k, 0.8); hiss(2400, 500, d * 0.5, 0.05 * k, 0.8, t + d * 0.5);
      osc("sine", 90, 150, d, 0.05 * k);
      break;
    }
    case "chime": {
      // a bright glass bell that rings on: bar partials (with the octave) decaying over seconds, each with a
      // slightly detuned twin so it shimmers as it fades, and a quick strike on top. Steps climb a major scale
      // (progress dots go up the scale; "Saved" rings an octave up); sound.chime: { pitch, decay, gain } tunes it
      const C = sc.reel.sound?.chime || {}, steps = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4, 5 / 2];
      const f = c.f ?? (C.pitch ?? 880) * steps[Math.max(0, (c.step ?? 1) - 1) % steps.length], L = c.decay ?? C.decay ?? 4.2, v0 = k * (C.gain ?? 1);
      [[1, 0.06], [2, 0.026], [2.76, 0.03], [5.4, 0.018], [8.93, 0.01], [13.3, 0.005]].forEach(([m, v]) => {
        const d = L / Math.pow(m, 0.42);
        osc("sine", f * m, 0, d, v * v0);
        osc("sine", f * m * 1.0021, 0, d * 0.85, v * v0 * 0.45);
      });
      osc("triangle", f * 4, 0, 0.07, 0.016 * v0);
      break;
    }
    case "thump": osc("sine", 130, 48, 0.3, 0.14 * k); break;
    case "sparkle": for (let i = 0; i < 6; i++) osc("sine", 2600 + r() * 2600, 0, 0.12, 0.022 * k, t + r() * 0.45); break;
    case "rise": hiss(300, 4000, c.dur ?? 1.5, 0.05 * k, 1.4); break;
  }
}

/** Render the reel's sound to an AudioBuffer. o: { bed, sfx, volume, voice (bool: duck the bed) } */
export async function renderAudio(sc, o = {}) {
  const S = sc.reel.sound || {};
  const mood = o.bed ?? S.bed ?? "warm", sfx = o.sfx ?? S.sfx ?? true, vol = o.volume ?? S.volume ?? 1;
  const rate = 44100, dur = sc.duration + 0.5;
  const AC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  const ctx = new AC(2, Math.ceil(rate * dur), rate);
  const master = ctx.createGain();
  master.gain.value = 0.9 * vol;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 3;
  master.connect(comp); comp.connect(ctx.destination);
  const verb = ctx.createConvolver(), wet = ctx.createGain(), dry = ctx.createGain();
  verb.buffer = impulse(ctx); wet.gain.value = 0.32; dry.gain.value = 0.85;
  const mix = ctx.createGain();
  mix.connect(dry); mix.connect(verb); verb.connect(wet); dry.connect(master); wet.connect(master);
  if (mood !== "none") bed(ctx, mix, dur, mood, (o.voice ? 0.55 : 1) * (S.bedGain ?? 1) * 0.5);
  if (sfx) {
    const noise = noiseBuf(ctx, 3), r = rng(31), fx = ctx.createGain();
    fx.gain.value = S.sfxGain ?? 1;
    fx.connect(mix);
    let last = {};
    for (const c of sc.cues) {
      if (last[c.kind] != null && c.t - last[c.kind] < (c.kind === "type" ? 0.25 : 0.06)) continue;
      last[c.kind] = c.t;
      cue(ctx, fx, c, noise, r, sc);
    }
  }
  return ctx.startRendering();
}

/** 16-bit PCM WAV bytes for an AudioBuffer. */
export function wav(buf) {
  const ch = buf.numberOfChannels, n = buf.length, rate = buf.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); out.setUint32(4, 36 + n * ch * 2, true); str(8, "WAVE"); str(12, "fmt ");
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, rate, true);
  out.setUint32(28, rate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); str(36, "data"); out.setUint32(40, n * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let p = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(p, v < 0 ? v * 0x8000 : v * 0x7fff, true); p += 2; }
  return new Uint8Array(out.buffer);
}
