/* Model Kombat · sfx: fight sounds and announcer stings, synthesised from the engine's
   primitives, and two songs for the sequencer (a calm one for the select screen, a fight theme). */
(function () {
  'use strict';
  const R = window.R;
  const A = R.audio;
  const { osc, noise, midi, now, ok } = A.prim;

  // A swing through the air: a quick filtered whoosh, heavier for a kick.
  A.swing = function (kind) {
    if (!ok()) return;
    const t = now();
    const heavy = kind === 'kick' || kind === 'air';
    noise(t, heavy ? 0.16 : 0.1, heavy ? 0.22 : 0.15, 'bandpass', heavy ? 700 : 1200, heavy ? 2400 : 3400, 1.2, null, { sweep: heavy ? 0.14 : 0.08 });
  };
  // A hit landing: a thump, a crack, and a little higher for each hit of a combo.
  A.smack = function (kind, combo) {
    if (!ok()) return;
    const t = now();
    const up = Math.min(6, (combo || 1) - 1) * 0.06;
    const heavy = kind === 'kick' || kind === 'air' || kind === 'proj';
    osc('sine', (heavy ? 140 : 180) * (1 + up), 45, t, heavy ? 0.22 : 0.14, heavy ? 0.7 : 0.5);
    noise(t, 0.08, heavy ? 0.4 : 0.3, 'highpass', 2600 * (1 + up), null, 0.6);
    noise(t, 0.12, 0.2, 'lowpass', 900, 200, 0.7);
    osc('square', 90 * (1 + up), 60, t, 0.06, 0.08, null, { filter: 'lowpass', ff: 800 });
  };
  A.guard = function () {
    if (!ok()) return;
    const t = now();
    osc('square', 1240, 900, t, 0.05, 0.06, null, { filter: 'bandpass', ff: 1800, q: 3 });
    noise(t, 0.06, 0.18, 'bandpass', 3200, null, 2);
  };
  A.hop = function () {
    if (!ok()) return;
    const t = now();
    noise(t, 0.12, 0.12, 'bandpass', 600, 1800, 1.2, null, { sweep: 0.1 });
  };
  A.thud = function () {
    if (!ok()) return;
    const t = now();
    osc('sine', 110, 50, t, 0.1, 0.3);
    noise(t, 0.06, 0.12, 'lowpass', 600, 200, 0.7);
  };
  // Sam's pop-up ad: a notification ding-ding. Dario's TV: a burst of static and a CRT thunk.
  A.adPop = function () {
    if (!ok()) return;
    const t = now();
    osc('sine', midi(88), null, t, 0.08, 0.12, null, { send: true });
    osc('sine', midi(93), null, t + 0.08, 0.14, 0.12, null, { send: true });
    noise(t, 0.18, 0.1, 'bandpass', 900, 3000, 1, null, { sweep: 0.15 });
  };
  A.tvOn = function () {
    if (!ok()) return;
    const t = now();
    osc('sine', 60, 40, t, 0.08, 0.4);
    noise(t, 0.3, 0.22, 'bandpass', 4200, 1800, 0.6, null, { rate: 1.6 });
    osc('square', 15700 / 4, null, t, 0.25, 0.015);
  };
  A.clash = function () {
    if (!ok()) return;
    const t = now();
    noise(t, 0.4, 0.45, 'lowpass', 5000, 300, 0.7);
    osc('square', 300, 80, t, 0.2, 0.1, null, { filter: 'lowpass', ff: 1400 });
    osc('sine', 80, 30, t, 0.3, 0.6);
  };
  // ACCELERATE climbs; SLOW DOWN sinks and drones.
  A.superUp = function (kind) {
    if (!ok()) return;
    const t = now();
    if (kind === 'accelerate') {
      osc('sawtooth', 110, 1760, t, 0.7, 0.14, null, { filter: 'lowpass', ff: 400, ff1: 8000, sweep: 0.7 });
      [72, 76, 79, 84, 88].forEach((m, i) => osc('square', midi(m), null, t + 0.12 + i * 0.05, 0.12, 0.05, null, { filter: 'lowpass', ff: 5000, send: true }));
    } else {
      osc('sawtooth', 880, 55, t, 0.9, 0.14, null, { filter: 'lowpass', ff: 6000, ff1: 300, sweep: 0.9 });
      osc('sine', 55, 45, t + 0.2, 1.6, 0.35);
      noise(t, 1.2, 0.1, 'lowpass', 1200, 200, 0.8, null, { attack: 0.3 });
    }
  };
  A.knock = function () {
    if (!ok()) return;
    const t = now();
    osc('sine', 70, 28, t, 0.9, 0.9);
    noise(t, 0.9, 0.4, 'lowpass', 3000, 120, 0.7, null, { sweep: 0.8 });
    noise(t, 0.06, 0.4, 'highpass', 4000, null, 0.6);
    A.seq.duck(true);
  };
  // Announcer stings (no voices, just brass and gongs).
  A.sting = function (kind) {
    if (!ok()) return;
    const t = now();
    const brass = (notes, gap, dur, lvl) => notes.forEach((m, i) => osc('sawtooth', midi(m), null, t + i * gap, dur, lvl, null, { filter: 'lowpass', ff: 1800, attack: 0.02 }));
    if (kind === 'round') brass([57, 64], 0.16, 0.22, 0.12);
    else if (kind === 'fight') {
      osc('square', 98, 92, t, 1.1, 0.2, null, { filter: 'lowpass', ff: 900 });
      osc('sine', 196, 190, t, 0.9, 0.2);
      noise(t, 0.6, 0.3, 'bandpass', 2500, 900, 0.9);
    } else if (kind === 'finish') brass([45, 52, 57, 60], 0.12, 0.5, 0.12);
    else if (kind === 'deprecate') {
      osc('sine', 900, 40, t, 1.2, 0.3, null, { sweep: 1.1 });
      for (let i = 0; i < 6; i++) noise(t + i * 0.12, 0.05, 0.18, 'highpass', 3000 + i * 400, null, 0.5);
      osc('square', 220, 55, t + 0.3, 1.0, 0.06, null, { filter: 'lowpass', ff: 700 });
    } else if (kind === 'perfect') [72, 76, 79, 84, 88, 91, 96].forEach((m, i) => osc('triangle', midi(m), null, t + i * 0.06, 0.2, 0.08, null, { send: true }));
    else if (kind === 'win') brass([60, 64, 67, 72], 0.1, 0.4, 0.1);
  };
  A.crowd = function (big) {
    if (!ok()) return;
    const t = now();
    noise(t, big ? 1.6 : 0.8, big ? 0.22 : 0.12, 'bandpass', 1400, 900, 0.5, null, { attack: big ? 0.25 : 0.1 });
    noise(t, big ? 1.4 : 0.6, 0.08, 'highpass', 5000, null, 0.4, null, { attack: 0.2 });
  };
  A.tick = function () {
    if (!ok()) return;
    osc('square', 1760, null, now(), 0.03, 0.04, null, { filter: 'lowpass', ff: 3000 });
  };

  // ---------- music ----------
  A.seq.songs = [
    // Select screen: slow, minor, half-time.
    { chords: [[57, 60, 64], [52, 55, 59], [53, 57, 60], [55, 59, 62]], bpm: 96, drums: 'half', arp: 'triangle' },
    // The fight: driving minor at 140.
    { chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], bpm: 140, drums: 'drive', arp: 'square' },
  ];
})();
