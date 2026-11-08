// Fauna Borealis: bone-white dust on black. Trackers lock onto each animal, the wind takes grains
// off its back, and a swarm carries one animal into the next.
import { stage } from "../engine/stage.js";

const animals = [
  { id: "stag", name: "Reindeer", latin: "Rangifer tarandus" },
  { id: "owl", name: "Snowy owl", latin: "Bubo scandiacus" },
  { id: "wolf", name: "Arctic wolf", latin: "Canis lupus arctos" },
  { id: "horse", name: "Wild horse", latin: "Equus ferus" },
];

const list = document.getElementById("specimens");
list.innerHTML = animals.map((a, i) => `<li><button data-i="${i}"><span>${String(i + 1).padStart(2, "0")}</span>${a.name}<i></i></button></li>`).join("");
const $ = (id) => document.getElementById(id);

const narrow = () => innerWidth < 760;

const api = await stage({
  canvas: $("dust"),
  hudCanvas: $("hud"),
  hud: { ruler: { pad: 28, wide: 1, tall: 1 } },
  pictures: animals.map((a) => ({ src: `img/${a.id}.webp`, depth: `img/${a.id}-depth.png` })),
  options: {
    background: "#060606",
    mono: 0.88,
    tint: "#f4e7d2",
    exposure: 1.05,
    relief: 0.85,
    wind: { amount: 0.55, angle: 0.08, x: 0.3, y: 0 },
    frame: (w, h) => narrow()
      ? { cx: w * 0.5, cy: h * 0.6, s: Math.min(w * 0.42, h * 0.27) }
      : { cx: w * 0.64, cy: h * 0.5, s: Math.min(h * 0.36, w * 0.25) },
  },
  hold: 4.2,
  onShow(i) {
    const a = animals[i];
    $("no").textContent = `${String(i + 1).padStart(2, "0")} / ${String(animals.length).padStart(2, "0")}`;
    $("name").textContent = a.name;
    $("latin").textContent = a.latin;
    list.querySelectorAll("button").forEach((b) => { b.classList.toggle("on", +b.dataset.i === i); b.querySelector("i").style.transform = "scaleX(0)"; });
  },
  onFrame(e, dt, api) {
    // the active name fills in with time held
    const b = list.querySelector("button.on i");
    if (b) b.style.transform = `scaleX(${Math.min(1, (e.time - e.t0) / (4.2 + e.o.spread + e.o.gather))})`;
  },
});

list.addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (b) api.pick(+b.dataset.i);
});
