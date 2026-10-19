/* Flappy Roadster · sfx: the Roadster's sounds, synthesised from the engine's primitives, and a
   synthwave song per zone for the engine's sequencer. */
(function () {
  'use strict';
  const R = window.R;
  const A = R.audio;
  const { env, osc, noise, midi, now, ok } = A.prim;

  // ---------- sound effects ----------
  // Cold-gas thruster: a filtered hiss that drops in pitch, a thump, and a valve click.
  A.thrust = function (rate) {
    if (!ok()) return;
    rate = rate || 1;
    const t = now();
    const j = 0.92 + Math.random() * 0.16;
    noise(t, 0.26 / rate, 0.34, 'bandpass', 3400 * j * rate, 820 * rate, 0.7, null, { sweep: 0.2 / rate });
    noise(t, 0.12 / rate, 0.12, 'highpass', 6000 * rate, null, 0.5);
    osc('sine', 120 * rate, 46 * rate, t, 0.1 / rate, 0.24);
    osc('square', 2100 * rate, null, t, 0.012, 0.025);
  };
  A.liftoff = function () {
    if (!ok()) return;
    const t = now();
    noise(t, 1.1, 0.42, 'bandpass', 2600, 500, 0.6, null, { sweep: 1.0, attack: 0.02 });
    noise(t, 0.9, 0.2, 'lowpass', 400, 120, 0.7);
    osc('sine', 70, 40, t, 0.6, 0.35);
  };
  A.fold = function () {
    if (!ok()) return;
    const t = now();
    // Servo whirr: the wing and nozzles arming.
    osc('sawtooth', 180, 520, t, 0.42, 0.05, null, { filter: 'lowpass', ff: 900, ff1: 2400 });
    osc('square', 2600, null, t + 0.42, 0.02, 0.03);
  };
  A.score = function (n) {
    if (!ok()) return;
    const t = now();
    const up = (n % 10) * 0.6;
    osc('triangle', midi(88 + up), null, t, 0.07, 0.11, null, { send: true });
    osc('triangle', midi(95 + up), null, t + 0.06, 0.13, 0.1, null, { send: true });
    if (n % 10 === 0) {
      for (const [i, m] of [76, 80, 83, 88].entries()) osc('square', midi(m), null, t + 0.12 + i * 0.06, 0.18, 0.05, null, { filter: 'lowpass', ff: 3000, send: true });
    }
  };
  A.near = function (rate) {
    if (!ok()) return;
    rate = rate || 1;
    const t = now();
    noise(t, 0.55 / rate, 0.34, 'bandpass', 500 * rate, 4200 * rate, 2.2, null, { sweep: 0.35 / rate, pan: -0.8, pan1: 0.8, attack: 0.05 });
    osc('sine', 2637, null, t + 0.05, 0.45, 0.06, null, { send: true });
  };
  A.bolt = function (n) {
    if (!ok()) return;
    const t = now();
    const base = 79 + (n - 1) * 2;
    [0, 4, 7, 12].forEach((s, i) => osc('square', midi(base + s), null, t + i * 0.045, 0.08, 0.06, null, { filter: 'lowpass', ff: 4000, send: true }));
  };
  A.ludi = function () {
    if (!ok()) return;
    const t = now();
    osc('sawtooth', 110, 1320, t, 0.6, 0.16, null, { filter: 'lowpass', ff: 300, ff1: 7000, sweep: 0.6 });
    noise(t, 0.6, 0.18, 'highpass', 800, 7000, 0.7, null, { attack: 0.5 });
    osc('sine', 64, 30, t + 0.6, 0.7, 0.6);
    noise(t + 0.6, 0.9, 0.22, 'highpass', 6000, null, 0.5);
  };
  A.smash = function () {
    if (!ok()) return;
    const t = now();
    noise(t, 0.2, 0.42, 'lowpass', 2400, 400, 0.8);
    osc('square', 150, 55, t, 0.12, 0.12, null, { filter: 'lowpass', ff: 1200 });
    noise(t, 0.14, 0.12, 'highpass', 5000, null, 0.5);
  };
  A.bounce = function () {
    if (!ok()) return;
    const t = now();
    osc('sine', 300, 120, t, 0.1, 0.16);
    noise(t, 0.06, 0.12, 'highpass', 3000, null, 0.5);
  };
  A.crash = function (kind, rate) {
    if (!ok()) return;
    rate = rate || 1;
    const t = now();
    noise(t, 0.9 / rate, 0.6, 'lowpass', 6000 * rate, 260, 0.7, null, { sweep: 0.8 / rate });
    osc('sine', 120 * rate, 34, t, 0.38 / rate, 0.75);
    for (const f of [523, 787, 1231]) osc('square', f * rate, f * 0.96 * rate, t, 0.55 / rate, 0.05, null, { filter: 'bandpass', ff: f * 2 * rate, q: 3 });
    for (let i = 0; i < 6; i++) noise(t + Math.random() * 0.25, 0.05, 0.16, 'highpass', 5200 * rate, null, 0.4);
    if (kind === 'reentry') noise(t, 1.6, 0.3, 'lowpass', 900, 200, 0.6, null, { attack: 0.1 });
    A.seq.duck(true);
  };
  A.land = function (v) {
    if (!ok()) return;
    const t = now();
    const s = Math.min(1, (v || 200) / 300);
    osc('sine', 95, 40, t, 0.16, 0.4 * s);
    noise(t, 0.12, 0.2 * s, 'lowpass', 500, 160, 0.7);
    osc('square', 640, 600, t, 0.12, 0.03 * s, null, { filter: 'bandpass', ff: 1400, q: 4 });
  };
  A.zone = function () {
    if (!ok()) return;
    const t = now();
    noise(t, 1.0, 0.25, 'bandpass', 300, 3000, 1.4, null, { attack: 0.3, sweep: 0.9, pan: 0.8, pan1: -0.8 });
    for (const m of [69, 73, 76, 81]) osc('sawtooth', midi(m), null, t + 0.05, 0.9, 0.028, null, { filter: 'lowpass', ff: 1200, ff1: 4000, attack: 0.25, send: true });
  };
  // Phantom braking gets a record scratch.
  A.scratch = function () {
    if (!ok()) return;
    const t = now();
    const c = A.ctx;
    const s = c.createBufferSource();
    s.buffer = A.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 6;
    [300, 2600, 500, 2200, 260].forEach((v, i) => f.frequency.linearRampToValueAtTime(v, t + i * 0.06));
    const g = c.createGain();
    env(g, t, 0.01, 0.5, 0.32);
    s.connect(f);
    f.connect(g);
    g.connect(A.sfx);
    s.start(t);
    s.stop(t + 0.4);
    A.seq.stutter();
  };
  // ---------- the road games ----------
  // Kickflip landed: a rising chime per flip in the combo.
  A.trick = function (n) {
    if (!ok()) return;
    const t = now();
    const base = 84 + Math.min(4, n - 1) * 2;
    [0, 7, 12].forEach((s, i) => osc('square', midi(base + s), null, t + i * 0.05, 0.1, 0.05, null, { filter: 'lowpass', ff: 4200, send: true }));
  };
  // Suction fans grabbing the tunnel: a deep thunk and a short whoosh of air.
  A.suck = function (v) {
    if (!ok()) return;
    const t = now();
    const s = Math.min(1, (v || 200) / 300);
    osc('sine', 150, 48, t, 0.14, 0.35 * s + 0.1);
    noise(t, 0.16, 0.16, 'bandpass', 900, 300, 1.2);
  };
  // Falling out of the tunnel: a cartoon whistle down.
  A.fall = function () {
    if (!ok()) return;
    const t = now();
    osc('sine', 1600, 300, t, 0.9, 0.08, null, { sweep: 0.9 });
  };
  // Two-tone police siren as you pass a cruiser.
  A.siren = function () {
    if (!ok()) return;
    const t = now();
    for (let i = 0; i < 4; i++) osc('square', i % 2 ? 660 : 880, null, t + i * 0.16, 0.15, 0.035, null, { filter: 'lowpass', ff: 2400 });
  };
  // Staging bulbs click on.
  A.stage = function (n) {
    if (!ok()) return;
    osc('square', n > 1 ? 1760 : 1320, null, now(), 0.02, 0.04, null, { filter: 'lowpass', ff: 3000 });
  };
  // The tree: amber blips, then a higher green.
  A.amber = function () {
    if (!ok()) return;
    osc('square', 587, null, now(), 0.09, 0.08, null, { filter: 'lowpass', ff: 2200 });
  };
  A.green = function () {
    if (!ok()) return;
    const t = now();
    osc('square', 1175, null, t, 0.22, 0.09, null, { filter: 'lowpass', ff: 4000 });
    osc('sine', 2350, null, t, 0.18, 0.05);
  };
  // Launch: every rear thruster at once, a sub-bass punch and an electric whine climbing.
  A.launch = function () {
    if (!ok()) return;
    const t = now();
    noise(t, 1.0, 0.5, 'bandpass', 2800, 700, 0.6, null, { sweep: 0.9 });
    noise(t, 0.5, 0.3, 'lowpass', 600, 120, 0.7);
    osc('sine', 90, 34, t, 0.5, 0.8);
    osc('sawtooth', 160, 2400, t, 0.85, 0.06, null, { filter: 'lowpass', ff: 900, ff1: 5000, sweep: 0.8 });
  };
  A.sixty = function () {
    if (!ok()) return;
    const t = now();
    [88, 95, 100].forEach((m, i) => osc('triangle', midi(m), null, t + i * 0.05, 0.2, 0.1, null, { send: true }));
  };
  // Red light: a flat buzzer.
  A.foul = function () {
    if (!ok()) return;
    const t = now();
    osc('square', 98, null, t, 0.5, 0.16, null, { filter: 'lowpass', ff: 900 });
    osc('square', 104, null, t, 0.5, 0.12, null, { filter: 'lowpass', ff: 900 });
    A.seq.duck(true);
  };
  // Kickflip: a board "pop".
  A.pop = function () {
    if (!ok()) return;
    const t = now();
    noise(t, 0.05, 0.4, 'bandpass', 1900, null, 5);
    osc('sine', 340, 180, t, 0.06, 0.2);
    noise(t + 0.05, 0.35, 0.16, 'bandpass', 800, 2400, 1.5, null, { attack: 0.08 });
  };

  // ---------- music ----------
  // Four chords per loop; each zone picks chords, tempo and texture.
  const ZONE_MUSIC = [
    { chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bpm: 108, drums: 'four', arp: 'square' },
    { chords: [[53, 57, 60], [55, 59, 62], [52, 55, 59], [57, 60, 64]], bpm: 112, drums: 'four', arp: 'triangle' },
    { chords: [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]], bpm: 96, drums: 'half', arp: 'triangle' },
    { chords: [[52, 55, 59], [48, 52, 55], [50, 54, 57], [47, 50, 54]], bpm: 120, drums: 'drive', arp: 'sawtooth' },
  ];
  A.seq.songs = ZONE_MUSIC;
})();
