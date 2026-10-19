/* Pixel Hop · sfx: the game's sounds, synthesised from the engine's primitives (R.audio.prim), and
   its two songs for the engine's sequencer. Every sound checks ok() first (sound may be off) and
   plays at now(), which the demo recorder turns into the moment the frame shows it. */
(function () {
  'use strict';
  const R = window.R;
  const A = R.audio;
  const { osc, noise, midi, now, ok } = A.prim;

  // A springy blip that rises.
  A.jump = function () {
    if (!ok()) return;
    const t = now();
    osc('square', 280, 720, t, 0.09, 0.07, null, { filter: 'lowpass', ff: 3200 });
    noise(t, 0.04, 0.05, 'highpass', 4000, null, 0.6);
  };
  // Feet on the road: harder the faster you come down.
  A.land = function (v) {
    if (!ok()) return;
    const t = now();
    const k = R.clamp(v / 300, 0.3, 1);
    osc('sine', 140, 50, t, 0.08, 0.3 * k);
    noise(t, 0.05, 0.12 * k, 'lowpass', 900, 300, 0.8);
  };
  // A coin: two quick bells, a little higher with each coin in a row.
  A.coin = function (n) {
    if (!ok()) return;
    const t = now();
    const up = (n || 0) % 6;
    osc('square', midi(83 + up), null, t, 0.05, 0.05, null, { filter: 'lowpass', ff: 6000 });
    osc('square', midi(88 + up), null, t + 0.05, 0.12, 0.05, null, { filter: 'lowpass', ff: 6000, send: true });
  };
  // Past an obstacle: a soft tick.
  A.clear = function () {
    if (!ok()) return;
    osc('triangle', midi(91), null, now(), 0.03, 0.04);
  };
  // A close call: air rushing past and a sparkle.
  A.close = function () {
    if (!ok()) return;
    const t = now();
    noise(t, 0.35, 0.18, 'bandpass', 600, 4000, 1.2, null, { sweep: 0.3 });
    [96, 100, 103].forEach((m, i) => osc('sine', midi(m), null, t + 0.05 + i * 0.05, 0.12, 0.04, null, { send: true }));
  };
  // Faster: a rising run of notes.
  A.faster = function () {
    if (!ok()) return;
    const t = now();
    [72, 76, 79, 84].forEach((m, i) => osc('square', midi(m), null, t + i * 0.06, 0.1, 0.05, null, { filter: 'lowpass', ff: 5000, send: true }));
  };
  // Go: the run starts.
  A.go = function () {
    if (!ok()) return;
    const t = now();
    osc('square', midi(76), null, t, 0.08, 0.06, null, { filter: 'lowpass', ff: 4000 });
    osc('square', midi(83), null, t + 0.09, 0.16, 0.06, null, { filter: 'lowpass', ff: 4000, send: true });
  };
  // The crash: a smash, glass, and a falling tone. (main ducks the music.)
  A.crash = function () {
    if (!ok()) return;
    const t = now();
    noise(t, 0.6, 0.55, 'lowpass', 5000, 240, 0.7, null, { sweep: 0.5 });
    osc('sine', 130, 34, t, 0.4, 0.7);
    for (let i = 0; i < 5; i++) noise(t + 0.03 + i * 0.04, 0.05, 0.14, 'highpass', 4500 + i * 600, null, 0.5);
    osc('sawtooth', 440, 110, t + 0.08, 0.5, 0.06, null, { filter: 'lowpass', ff: 1800 });
  };

  // ---------- music ----------
  A.seq.songs = [
    // The title: a slow, warm loop.
    { chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bpm: 100, drums: 'half', arp: 'triangle' },
    // The run: minor, driving; main raises the intensity as the road speeds up.
    { chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 48, 52]], bpm: 132, drums: 'drive', arp: 'square' },
  ];
})();
