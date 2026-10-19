/* Pixel Game engine · audio: every sound is synthesised live with WebAudio, so there are no audio
   files. This holds the mix (master, sound effects, music with a lowpass for ducking, a feedback
   delay), the synth primitives games build their effects from (R.audio.prim), a few UI sounds
   every game shares, and a four-chord step sequencer that plays whatever songs a game sets. */
(function () {
  'use strict';
  const R = window.R;
  const A = (R.audio = {
    ctx: null,
    level: 0, // 0 music + sfx, 1 sfx only, 2 muted
    started: false,
  });

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  A.init = function () {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    let c;
    try {
      c = new AC();
    } catch (e) {
      return false;
    }
    A.setup(c);
    A.seq.start();
    return true;
  };

  // Build the mix on any context; an OfflineAudioContext can render a run's soundtrack to a file.
  A.setup = function (c) {
    A.ctx = c;
    A.master = c.createGain();
    A.master.gain.value = A.level === 2 ? 0 : 0.8;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    A.master.connect(comp);
    comp.connect(c.destination);
    A.sfx = c.createGain();
    A.sfx.gain.value = 0.9;
    A.sfx.connect(A.master);
    A.musicIn = c.createGain();
    A.musicFilter = c.createBiquadFilter();
    A.musicFilter.type = 'lowpass';
    A.musicFilter.frequency.value = 18000;
    A.music = c.createGain();
    A.music.gain.value = A.level === 0 ? 0.32 : 0;
    A.musicIn.connect(A.musicFilter);
    A.musicFilter.connect(A.music);
    A.music.connect(A.master);
    // A feedback delay for the arps and chimes.
    A.delay = c.createDelay(1);
    A.delay.delayTime.value = (60 / 108) * 0.75;
    const fb = c.createGain();
    fb.gain.value = 0.32;
    const dl = c.createBiquadFilter();
    dl.type = 'lowpass';
    dl.frequency.value = 2600;
    A.delay.connect(dl);
    dl.connect(fb);
    fb.connect(A.delay);
    dl.connect(A.musicIn);
    // Two seconds of white noise, shared by every noisy sound.
    const len = c.sampleRate * 2;
    A.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = A.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  };

  A.setLevel = function (lv) {
    A.level = lv;
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    A.master.gain.setTargetAtTime(lv === 2 ? 0 : 0.8, t, 0.03);
    A.music.gain.setTargetAtTime(lv === 0 ? 0.32 : 0, t, 0.05);
  };

  // ---------- primitives ----------
  function env(g, t, a, peak, dec, sustain) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + dec);
  }
  // An oscillator note: type, start and end frequency, start time, length, peak level, output.
  // o: { attack, sweep, detune, filter, ff, ff1, q, send (into the delay) }.
  function osc(type, f0, f1, t, dur, peak, dest, o) {
    o = o || {};
    const c = A.ctx;
    const n = c.createOscillator();
    n.type = type;
    n.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) n.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + (o.sweep || dur));
    if (o.detune) n.detune.setValueAtTime(o.detune, t);
    const g = c.createGain();
    env(g, t, o.attack || 0.004, peak, dur);
    let node = n;
    if (o.filter) {
      const f = c.createBiquadFilter();
      f.type = o.filter;
      f.frequency.setValueAtTime(o.ff || 2000, t);
      if (o.ff1) f.frequency.exponentialRampToValueAtTime(o.ff1, t + dur);
      f.Q.value = o.q || 1;
      n.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(dest || A.sfx);
    if (o.send) g.connect(A.delay);
    n.start(t);
    n.stop(t + (o.attack || 0.004) + dur + 0.05);
    return n;
  }
  // Filtered noise: start time, length, peak, filter type, start and end frequency, Q, output.
  // o: { attack, sweep, rate, pan, pan1 }.
  function noise(t, dur, peak, type, f0, f1, q, dest, o) {
    o = o || {};
    const c = A.ctx;
    const s = c.createBufferSource();
    s.buffer = A.noiseBuf;
    s.playbackRate.value = o.rate || 1;
    const f = c.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + (o.sweep || dur));
    f.Q.value = q || 1;
    const g = c.createGain();
    env(g, t, o.attack || 0.004, peak, dur);
    s.connect(f);
    f.connect(g);
    let out = g;
    if (o.pan != null && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.setValueAtTime(o.pan, t);
      if (o.pan1 != null) p.pan.linearRampToValueAtTime(o.pan1, t + dur);
      g.connect(p);
      out = p;
    }
    out.connect(dest || A.sfx);
    s.start(t, Math.random() * 1.5);
    s.stop(t + (o.attack || 0.004) + dur + 0.05);
  }
  // A.at, when set, is the time sounds play at (an offline render); otherwise just ahead of now.
  const now = () => (A.at != null ? A.at : A.ctx.currentTime + 0.005);
  const ok = () => A.ctx && A.level < 2;
  A.prim = { env, osc, noise, midi, now, ok };

  // ---------- sounds every game shares ----------
  A.ui = function () {
    if (!ok()) return;
    osc('square', 1320, null, now(), 0.025, 0.04, null, { filter: 'lowpass', ff: 3000 });
  };
  A.deny = function () {
    if (!ok()) return;
    const t = now();
    osc('square', 220, null, t, 0.08, 0.06, null, { filter: 'lowpass', ff: 1200 });
    osc('square', 165, null, t + 0.09, 0.12, 0.06, null, { filter: 'lowpass', ff: 1200 });
  };
  A.best = function () {
    if (!ok()) return;
    const t = now();
    [72, 76, 79, 84, 88, 91].forEach((m, i) => osc('square', midi(m), null, t + i * 0.07, 0.16, 0.06, null, { filter: 'lowpass', ff: 5000, send: true }));
  };
  // The stamp slamming down on the result, with an optional sad trombone.
  A.stamp = function (trombone) {
    if (!ok()) return;
    const t = now();
    osc('sine', 72, 38, t, 0.3, 0.8);
    noise(t, 0.08, 0.3, 'lowpass', 1800, 400, 0.8);
    if (trombone) {
      // Wah, wah, wah, waaaah.
      const notes = [70, 69, 68, 67];
      notes.forEach((m, i) => {
        const st = t + 0.25 + i * 0.36;
        const dur = i === 3 ? 1.0 : 0.3;
        const n = osc('sawtooth', midi(m - 12), null, st, dur, 0.14, null, { filter: 'lowpass', ff: 500, ff1: 1500, attack: 0.04 });
        if (i === 3 && A.ctx) {
          const lfo = A.ctx.createOscillator();
          const lg = A.ctx.createGain();
          lfo.frequency.value = 6;
          lg.gain.value = 5;
          lfo.connect(lg);
          lg.connect(n.frequency);
          lfo.start(st + 0.2);
          lfo.stop(st + dur);
        }
      });
    }
  };
  // Autopilot chimes: up when it engages, down when it hands back control.
  A.engage = function () {
    if (!ok()) return;
    const t = now();
    osc('sine', 660, null, t, 0.14, 0.12);
    osc('sine', 880, null, t + 0.13, 0.2, 0.12);
  };
  A.disengage = function () {
    if (!ok()) return;
    const t = now();
    osc('sine', 880, null, t, 0.14, 0.14);
    osc('sine', 587, null, t + 0.14, 0.28, 0.14);
  };

  // ---------- the sequencer ----------
  // Four chords per loop, sixteen steps per bar. A song is { chords: [[midi...] ×4], bpm,
  // drums: 'four' | 'half' | 'drive', arp: oscillator type }; a game sets seq.songs and picks one.
  // Intensity: 0 pad and bass only (menus), 1 adds drums, 2 adds the arp and hats, 3 goes all out.
  const seq = (A.seq = {
    songs: [{ chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bpm: 108, drums: 'four', arp: 'square' }],
    song: 0,
    intensity: 0,
    step: 0,
    next: 0,
    timer: null,
    ducked: false,
    start() {
      if (seq.timer) return;
      seq.next = A.ctx.currentTime + 0.1;
      seq.timer = setInterval(seq.tick, 25);
    },
    tick() {
      const c = A.ctx;
      if (!c || c.state !== 'running') return;
      const z = seq.songs[seq.song] || seq.songs[0];
      const stepDur = 60 / z.bpm / 4;
      if (seq.next < c.currentTime - 0.3) seq.next = c.currentTime + 0.05;
      while (seq.next < c.currentTime + 0.14) {
        if (A.level === 0 && !seq.ducked) seq.play(seq.step, seq.next, z, stepDur);
        seq.next += stepDur;
        seq.step = (seq.step + 1) % 64;
      }
    },
    play(step, t, z, sd) {
      const bar = Math.floor(step / 16);
      const s = step % 16;
      const ch = z.chords[bar];
      const out = A.musicIn;
      const I = seq.intensity;
      // Pad at the top of each bar.
      if (s === 0) for (const m of ch) osc('sawtooth', midi(m), null, t, sd * 15, 0.035, out, { filter: 'lowpass', ff: 900, attack: 0.4, detune: (Math.random() - 0.5) * 14 });
      // Bass: eighths with octave jumps; sixteenths when the drums drive.
      const root = ch[0] - 24;
      const bassEvery = z.drums === 'drive' ? 1 : 2;
      if (s % bassEvery === 0) {
        const m = root + (s % 4 === 2 ? 12 : 0);
        osc('sawtooth', midi(m), null, t, sd * (bassEvery - 0.2), I >= 1 ? 0.12 : 0.08, out, { filter: 'lowpass', ff: I >= 2 ? 900 : 500, ff1: 220 });
      }
      if (I >= 2) {
        // Arp of chord tones.
        const tones = [ch[0], ch[1], ch[2], ch[0] + 12, ch[2], ch[1]];
        const m = tones[s % tones.length] + (I >= 3 ? 24 : 12);
        osc(z.arp, midi(m), null, t, sd * 0.9, 0.028, out, { filter: 'lowpass', ff: I >= 3 ? 7000 : 3200, send: true });
      }
      if (I >= 1) {
        // Drums.
        const kick = z.drums === 'half' ? s === 0 || s === 10 : s % 4 === 0;
        const snare = z.drums === 'half' ? s === 8 : s === 4 || s === 12;
        if (kick) osc('sine', 150, 40, t, 0.18, 0.5, out);
        if (snare) {
          noise(t, 0.16, 0.22, 'bandpass', 1800, 900, 0.8, out);
          osc('triangle', 190, 140, t, 0.08, 0.1, out);
        }
        const hat = I >= 3 ? true : s % 2 === 0;
        if (hat && I >= 2) noise(t, s % 4 === 2 ? 0.08 : 0.03, 0.06, 'highpass', 8000, null, 0.5, out);
      }
    },
    setSong(i) {
      seq.song = i;
    },
    setIntensity(i) {
      seq.intensity = i;
      const z = seq.songs[seq.song] || seq.songs[0];
      if (A.delay) A.delay.delayTime.value = (60 / z.bpm) * 0.75;
    },
    // Music off (and muffled) for a crash or a result screen.
    duck(on) {
      seq.ducked = on;
      if (!A.ctx) return;
      A.musicFilter.frequency.setTargetAtTime(on ? 300 : 18000, now(), on ? 0.05 : 0.3);
    },
    // Bullet time: the music goes underwater.
    slow(on) {
      if (!A.ctx || seq.ducked) return;
      A.musicFilter.frequency.setTargetAtTime(on ? 700 : 18000, now(), on ? 0.04 : 0.25);
    },
    // Half a second of silence, like a record skipping.
    stutter() {
      if (!A.ctx) return;
      const t = now();
      A.music.gain.setValueAtTime(0, t);
      A.music.gain.setTargetAtTime(A.level === 0 ? 0.32 : 0, t + 0.45, 0.08);
    },
  });
})();
