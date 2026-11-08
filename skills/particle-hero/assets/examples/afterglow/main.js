// Afterglow: the lineup in neon dust. Coloured lights wander through each artist and flash on the beat, grains in
// motion leave streaks, the pointer is a warm light you carry through them, and the change of artist lands on a
// downbeat. The festival's name stands behind the dust.
import { stage } from "../engine/stage.js";

const artists = [
  { id: "singer", name: "Nova Reyes", genre: "Soul · live band", slot: "Fri 21 · 22:40 · Main stage" },
  { id: "sax", name: "Theo Akande", genre: "Jazz · quartet", slot: "Sat 22 · 20:15 · The Hangar" },
  { id: "dj", name: "Marlo", genre: "House · all night long", slot: "Sat 22 · 01:00 · Pier stage" },
  { id: "drummer", name: "Kofi Bright", genre: "Afrobeat · twelve-piece", slot: "Sun 23 · 21:30 · Main stage" },
];
const $ = (id) => document.getElementById(id);
$("lineup").innerHTML = artists.map((a, i) => `<li><button data-i="${i}"><span>${a.slot.split(" · ")[0]}</span>${a.name}</button></li>`).join("");

const BPM = 118, BEAT = 60 / BPM, BARS = 3;   // a change every three bars, on the downbeat
const narrow = () => innerWidth < 760;
const still = new URLSearchParams(location.search).has("still");

const lamps = [
  { color: "#ff2e93", x: 0, y: 0, z: 0, power: 0, core: 0.55 },
  { color: "#ffa83a", x: 0, y: 0, z: 0, power: 0, core: 0.55 },
  { color: "#8a5cff", x: 0, y: 0, z: 0, power: 0, core: 0.45 },
];

let lastBeat = -1, held = 0;   // a pick by hand holds the timer for a while
const api = await stage({
  canvas: $("dust"),
  pictures: artists.map((a) => ({ src: `img/${a.id}.webp`, depth: `img/${a.id}-depth.png`, fade: 0.3 })),
  options: {
    transparent: true,
    background: "#0b0611",
    saturation: 1.18,
    exposure: 1.2,
    relief: 0.75,
    kick: 2.6, spread: 0.45, gather: 1.2, blur: 0.14, flightDim: 0.62,
    lamps,
    hot: "#ffc871", hotPower: 0.75,
    streaks: true,
    grain: 0.02,
    hand: { reach: 0.14, drag: 9, spread: 1.6, still: 0.05, depth: 0.8 },
    frame: (w, h) => narrow()
      ? { cx: w * 0.5, cy: h * 0.46, s: Math.min(w * 0.46, h * 0.28) }
      : { cx: w * 0.5, cy: h * 0.43, s: Math.min(h * 0.37, w * 0.24) },
  },
  hold: 1e9,          // the beat decides
  onShow(i) {
    const a = artists[i];
    $("artist").textContent = a.name;
    $("genre").textContent = a.genre;
    $("slot").textContent = a.slot;
    document.querySelectorAll("#lineup button").forEach((b) => b.classList.toggle("on", +b.dataset.i === i));
    document.body.dataset.i = i;
  },
  onFrame(e, dt, api) {
    const t = e.time, beat = Math.floor(t / BEAT), ph = (t / BEAT) % 1;
    // the lights circle the artist, each on its own path; one flashes on each beat, all of them on the downbeat
    lamps.forEach((l, k) => {
      const a = t * (0.3 + 0.07 * k) + k * 2.1;
      l.x = 1.05 * Math.cos(a);
      l.y = 0.75 * Math.sin(a * 1.3 + k);
      l.z = 0.45 * Math.sin(a * 0.8 + k * 1.7);
      const mine = beat % 3 === k || beat % (BARS * 4) === 0;
      l.power = 0.12 + (mine ? 0.75 : 0.1) * Math.exp(-ph * 5.5);
    });
    e.lampState = lamps;
    if (beat !== lastBeat) {
      lastBeat = beat;
      if (beat > 0 && beat % (BARS * 4) === 0 && !still && e.time > held) api.next();
    }
  },
});

$("lineup").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  api.go(+b.dataset.i);
  lastBeat = Math.floor(api.engine.time / BEAT);
  held = api.engine.time + BEAT * BARS * 4 * 1.5;
});
