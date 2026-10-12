// Sound, off until asked for. Everything is synthesised from noise and sine waves (no files): each page names an
// ambience in its meta (`sound: "rain" | "street" | "night" | "water"`, or none) and gets a quiet bed plus a "rustle"
// voice whose loudness follows how fast its cloth is moving, and one-shot events: bead knocks for a bead curtain,
// bubbles under water.
let ctx = null, on = false, master = null, noise = null, bed = [], rustle = null, lastClack = 0, birds = 0;

const BEDS = {
  rain: { rain: [1400, 7000, 0.07], hum: [55, 0.018], rustle: [2600, 0.9] }, // night rain and a neon hum; crinkly vinyl
  street: { rain: [300, 1100, 0.02], hum: null, rustle: [1100, 0.7], birds: true }, // a morning street with birds; linen
  night: { rain: [120, 420, 0.016], hum: null, rustle: [0, 0] }, // a still night (bead knocks come from the page)
  water: { rain: [60, 420, 0.11], hum: [68, 0.03], rustle: [520, 0.6], lfo: true }, // deep water swelling; silk
};

function ensure() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function noiseSource() {
  const s = ctx.createBufferSource();
  s.buffer = noise;
  s.loop = true;
  return s;
}

function filtered(type, f, q = 0.7) {
  const b = ctx.createBiquadFilter();
  b.type = type; b.frequency.value = f; b.Q.value = q;
  return b;
}

function chirp() {
  if (!on || !ctx) return;
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), p = (Math.random() - 0.5) * 1.4;
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  o.type = "sine";
  const f = 3200 + Math.random() * 1800;
  for (let k = 0; k < 3; k++) {
    o.frequency.setValueAtTime(f, t + k * 0.09);
    o.frequency.exponentialRampToValueAtTime(f * 1.35, t + k * 0.09 + 0.05);
  }
  g.gain.setValueAtTime(0, t);
  for (let k = 0; k < 3; k++) { g.gain.linearRampToValueAtTime(0.012, t + k * 0.09 + 0.01); g.gain.linearRampToValueAtTime(0, t + k * 0.09 + 0.06); }
  o.connect(g);
  if (pan) { pan.pan.value = p; g.connect(pan).connect(master); } else g.connect(master);
  o.start(t); o.stop(t + 0.32);
}

export const audio = {
  get on() { return on; },
  toggle() {
    on = !on;
    if (on) { ensure(); ctx.resume(); master.gain.setTargetAtTime(1, ctx.currentTime, 0.3); }
    else if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
    return on;
  },
  // switch the ambience to `name` (a key of BEDS), or silence it with null
  theme(name) {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const n of bed) { try { n.gain?.gain.setTargetAtTime(0, t, 0.3); n.src?.stop(t + 1.5); } catch {} }
    bed = [];
    rustle = null;
    clearInterval(birds);
    const b = BEDS[name];
    if (!b) return;
    const [lo, hi, level] = b.rain;
    const src = noiseSource(), g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(level, t, 0.8);
    const lp = filtered("lowpass", hi);
    src.connect(filtered("highpass", lo)).connect(lp).connect(g).connect(master);
    if (b.lfo) { // slow swell under water
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 0.08; lg.gain.value = 160;
      lfo.connect(lg).connect(lp.frequency);
      lfo.start();
      bed.push({ src: lfo });
    }
    src.start();
    bed.push({ src, gain: g });
    if (b.hum) {
      const o = ctx.createOscillator(), hg = ctx.createGain();
      o.frequency.value = b.hum[0];
      hg.gain.value = 0;
      hg.gain.setTargetAtTime(b.hum[1], t, 1);
      o.connect(hg).connect(master);
      o.start();
      bed.push({ src: o, gain: hg });
    }
    if (b.rustle[0]) {
      const rs = noiseSource(), rg = ctx.createGain();
      rg.gain.value = 0;
      rs.connect(filtered("bandpass", b.rustle[0], b.rustle[1])).connect(rg).connect(master);
      rs.start();
      bed.push({ src: rs, gain: rg });
      rustle = rg;
    }
    if (b.birds) birds = setInterval(() => Math.random() < 0.45 && chirp(), 2600);
  },
  // 0..1: how much the cloth is moving right now
  rustle(amount) {
    if (!on || !rustle) return;
    rustle.gain.setTargetAtTime(Math.min(0.22, amount * 0.22), ctx.currentTime, 0.06);
  },
  // a bead knocking another: short, bright, a little different every time
  clack(strength = 0.5, pan = 0) {
    if (!on || !ctx) return;
    const now = ctx.currentTime;
    if (now - lastClack < 0.025) return;
    lastClack = now;
    const o = ctx.createOscillator(), g = ctx.createGain(), f = 1900 + Math.random() * 1600;
    o.type = "triangle";
    o.frequency.setValueAtTime(f, now);
    o.frequency.exponentialRampToValueAtTime(f * 0.82, now + 0.05);
    const v = Math.min(0.09, 0.02 + strength * 0.06);
    g.gain.setValueAtTime(v, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    const n = noiseSource(), ng = ctx.createGain();
    ng.gain.setValueAtTime(v * 0.6, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
    let out = master;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(master); out = p; }
    o.connect(g).connect(out);
    n.connect(filtered("bandpass", 4200, 3)).connect(ng).connect(out);
    o.start(now); o.stop(now + 0.08);
    n.start(now); n.stop(now + 0.03);
  },
  bubble(size = 0.5) {
    if (!on || !ctx) return;
    const now = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = 260 + (1 - size) * 700;
    o.type = "sine";
    o.frequency.setValueAtTime(f, now);
    o.frequency.exponentialRampToValueAtTime(f * 2.6, now + 0.07);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.05, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    o.connect(g).connect(master);
    o.start(now); o.stop(now + 0.12);
  },
};
