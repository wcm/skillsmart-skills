/* Meta Gear Solid · sfx: the sneaking sounds, synthesised from the engine's primitives. The "!"
   sting when someone catches you, the cardboard box going down and up, footsteps that change
   with the floor, the chime of glasses waking up by themselves, the codec call, and two songs: a
   tense sneaking loop and the alert. */
(function () {
  'use strict';
  const R = window.R;
  const A = R.audio;
  const { osc, noise, midi, now, ok } = A.prim;

  // The alert: a bright two-note stab over a low hit, the sound of being seen.
  A.alert = function () {
    if (!ok()) return;
    const t = now();
    for (const m of [88, 95]) osc('square', midi(m), midi(m) * 0.98, t, 0.32, 0.09, null, { filter: 'lowpass', ff: 6000, send: true });
    osc('sawtooth', midi(76), null, t, 0.3, 0.06, null, { filter: 'lowpass', ff: 3000 });
    osc('sine', 110, 40, t, 0.5, 0.6);
    noise(t, 0.25, 0.3, 'highpass', 3000, null, 0.6);
    A.seq.stutter();
  };
  // The camera shutter, then the stamp lands.
  A.shutter = function () {
    if (!ok()) return;
    const t = now();
    noise(t, 0.03, 0.4, 'highpass', 5000, null, 0.5);
    noise(t + 0.07, 0.04, 0.35, 'bandpass', 3000, null, 1.2);
    osc('square', 2400, 1800, t + 0.07, 0.03, 0.04);
  };
  A.boxDown = function () {
    if (!ok()) return;
    const t = now();
    osc('sine', 150, 60, t, 0.12, 0.35);
    noise(t, 0.09, 0.28, 'lowpass', 900, 250, 0.8);
    noise(t, 0.05, 0.1, 'bandpass', 2200, null, 2);
  };
  A.boxUp = function () {
    if (!ok()) return;
    const t = now();
    noise(t, 0.1, 0.12, 'bandpass', 800, 2400, 1.4, null, { sweep: 0.09 });
  };
  // A footstep: wood clacks, rubber thuds, carpet whispers.
  A.step = function (foot, zone) {
    if (!ok()) return;
    const t = now();
    const up = foot ? 1.08 : 1;
    if (zone === 'cafe') {
      noise(t, 0.04, 0.12, 'bandpass', 1800 * up, null, 3);
      osc('triangle', 320 * up, 200, t, 0.03, 0.05);
    } else if (zone === 'gym') {
      osc('sine', 90 * up, 50, t, 0.07, 0.18);
      noise(t, 0.04, 0.05, 'lowpass', 500, null, 0.7);
    } else if (zone === 'wedding') noise(t, 0.06, 0.06, 'bandpass', 900 * up, 600, 0.8);
    else noise(t, 0.05, 0.07, 'lowpass', 1200 * up, 500, 0.7);
  };
  // A guest stares at your box: a puzzled rising pair.
  A.huh = function () {
    if (!ok()) return;
    const t = now();
    osc('triangle', midi(79), null, t, 0.1, 0.1);
    osc('triangle', midi(84), null, t + 0.1, 0.16, 0.1);
  };
  // Glasses waking up by themselves: the soft two-note chime of an assistant listening.
  A.wake = function () {
    if (!ok()) return;
    const t = now();
    osc('sine', midi(84), null, t, 0.14, 0.12, null, { send: true });
    osc('sine', midi(91), null, t + 0.13, 0.2, 0.12, null, { send: true });
  };
  A.listen = function () {
    if (!ok()) return;
    const t = now();
    osc('sine', 220, 230, t, 1.2, 0.05, null, { attack: 0.2 });
    noise(t, 1.2, 0.04, 'bandpass', 1500, 2500, 2, null, { attack: 0.3 });
  };
  A.turnWarn = function () {
    if (!ok()) return;
    const t = now();
    noise(t, 0.12, 0.06, 'bandpass', 1200, 700, 1.5);
  };
  A.close = function () {
    if (!ok()) return;
    const t = now();
    noise(t, 0.25, 0.16, 'bandpass', 600, 3200, 1.1, null, { sweep: 0.22 });
    osc('sine', midi(86), null, t + 0.05, 0.12, 0.05, null, { send: true });
  };
  A.fooled = function () {
    if (!ok()) return;
    const t = now();
    osc('triangle', midi(72), null, t, 0.08, 0.06);
    osc('triangle', midi(67), null, t + 0.08, 0.12, 0.06);
  };
  // Through a door: a little ding and the room's name.
  A.room = function () {
    if (!ok()) return;
    const t = now();
    [76, 81, 88].forEach((m, i) => osc('square', midi(m), null, t + i * 0.07, 0.14, 0.05, null, { filter: 'lowpass', ff: 4000, send: true }));
  };
  // The codec: a call coming in, and the blips of text.
  A.codecRing = function () {
    if (!ok()) return;
    const t = now();
    for (let i = 0; i < 4; i++) osc('square', i % 2 ? midi(81) : midi(76), null, t + i * 0.09, 0.07, 0.06, null, { filter: 'lowpass', ff: 3000 });
  };
  A.codecBlip = function () {
    if (!ok()) return;
    osc('square', midi(93), null, now(), 0.02, 0.025, null, { filter: 'lowpass', ff: 3500 });
  };

  // ---------- music ----------
  A.seq.songs = [
    // Sneaking: a low minor loop, half-time, a triangle arp creeping over it.
    { chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]], bpm: 92, drums: 'half', arp: 'triangle' },
    // Alert: the same keys, driving.
    { chords: [[50, 53, 57], [51, 55, 58], [50, 53, 57], [49, 52, 56]], bpm: 152, drums: 'drive', arp: 'square' },
  ];
})();
