// Stride: four sneaker models printed in fine safety-orange dots on a light ground, like a one-colour print: the ink
// never piles darker than its own orange. One model melts into the next along matched dots (a sole stays a sole), a
// scan line sweeps through the depth, and thin callouts lock on.
import { stage } from "../engine/stage.js";

const models = [
  { id: "runner", name: "Runner", lede: "Everyday miles on a deep foam bed.", price: "$180",
    specs: [["Zigzag knit upper", "one piece · 212 g"], ["Padded heel", "8 mm drop"], ["38 mm foam", "rubber outsole"]] },
  { id: "court", name: "Court", lede: "A high-top for the asphalt, built to scuff.", price: "$160",
    specs: [["Full-grain leather", "contrast stitch"], ["Padded collar", "ankle lock"], ["Cupsole", "stitched through"]] },
  { id: "trail", name: "Trail", lede: "Ripstop and lugs for the wet side of the hill.", price: "$195",
    specs: [["Ripstop upper", "water-shedding"], ["Toggle lace", "one pull"], ["5 mm lugs", "sticky rubber"]] },
  { id: "slip", name: "Slip", lede: "No laces, a gum sole, out the door.", price: "$120",
    specs: [["Suede upper", "brushed"], ["Elastic gore", "slip on"], ["Gum rubber", "vulcanised"]] },
];
const $ = (id) => document.getElementById(id);
$("models").innerHTML = models.map((m, i) => `<li><button data-i="${i}"><span>${String(i + 1).padStart(2, "0")}</span>${m.name}<i></i></button></li>`).join("");

const narrow = () => innerWidth < 760;

const api = await stage({
  canvas: $("dust"),
  hudCanvas: $("hud"),
  hud: {
    color: "rgba(28,26,24,0.85)", dim: "rgba(28,26,24,0.32)",
    font: "400 10px 'IBM Plex Mono', ui-monospace, monospace",
    calloutFont: "500 12px 'Archivo', sans-serif",
    primary: 0, secondary: 10, links: false,
    ruler: { pad: 26 },
    callouts: (form) => {
      const m = models[form.pic];
      if (!m || narrow()) return [];
      const h = 1 / form.aspect;   // the shoe's half-height in picture space
      return [
        { at: [-0.12, 0.42 * h], text: m.specs[0][0], sub: m.specs[0][1], dx: 150, dy: -140 },
        { at: [0.72, 0.5 * h], text: m.specs[1][0], sub: m.specs[1][1], dx: 130, dy: -40 },
        { at: [-0.35, -0.72 * h], text: m.specs[2][0], sub: m.specs[2][1], dx: 230, dy: 120 },
      ];
    },
  },
  pictures: models.map((m) => ({ src: `img/${m.id}.webp`, depth: `img/${m.id}-depth.png` })),
  options: {
    ink: true,
    background: "#f3f2ee",
    mono: 1,
    inkColor: "#ff5a1f",
    inkCap: 3.22,           // never darker than the orange itself
    levels: { lo: 0.02, hi: 0.98, gamma: 1.9 },   // each shoe's own tones, mid-tones kept light: dark leather keeps its seams
    disc: true,
    count: innerWidth < 760 ? 1 << 17 : 1 << 18,
    size: 0.8,
    exposure: 0.55,
    relief: 0.8,
    scan: true,
    travel: "melt",
    spread: 0.8, gather: 1.2, blur: 0.08,
    order: { dir: [1, 0, 0], jitter: 0.25 },    // toe to heel
    vignette: 0.15, grain: 0.01,
    sway: 0.6, parallax: 0.8,
    hand: { reach: 0.135, drag: 9, spread: 2.0, still: 0.05, depth: 0.8 },
    frame: (w, h) => narrow()
      ? { cx: w * 0.5, cy: h * 0.55, s: w * 0.44 }
      : { cx: w * 0.6, cy: h * 0.52, s: Math.min(w * 0.25, h * 0.55) },
  },
  hold: 4.2,
  onShow(i) {
    const m = models[i];
    $("no").textContent = `Model ${String(i + 1).padStart(2, "0")}`;
    $("name").textContent = m.name;
    $("lede").textContent = m.lede;
    $("price").textContent = m.price;
    document.querySelectorAll("#models button").forEach((b) => { b.classList.toggle("on", +b.dataset.i === i); b.querySelector("i").style.transform = "scaleX(0)"; });
  },
  onFrame(e) {
    const b = document.querySelector("#models button.on i");
    if (b) b.style.transform = `scaleX(${Math.min(1, (e.time - e.t0) / (4.2 + e.o.spread + e.o.gather))})`;
  },
});

$("models").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (b) api.pick(+b.dataset.i);
});
