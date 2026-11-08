// Herbier: coloured ink on cream paper. Each plant evaporates into a mist of its own colours and the perfume condenses
// out of it; a hand through it smears the ink and lets it settle.
import { stage } from "../engine/stage.js";

const forms = [
  { id: "rose", scent: 0, what: "The rose", note: "Rosa centifolia, picked at dawn in May", buy: "Discover" },
  { id: "rose-bottle", scent: 0, what: "N° 04 — Rose de Mai", note: "Eau de parfum · pink pepper, May rose, white musk · 50 ml · €165", buy: "Add to bag" },
  { id: "fig", scent: 1, what: "The fig", note: "Ficus carica, leaf and fruit, late summer", buy: "Discover" },
  { id: "fig-bottle", scent: 1, what: "N° 11 — Figue Verte", note: "Eau de parfum · fig leaf, green sap, cedar · 50 ml · €165", buy: "Add to bag" },
];
const scents = [
  { no: "N° 04", name: "Rose de Mai", forms: [0, 1] },
  { no: "N° 11", name: "Figue Verte", forms: [2, 3] },
];
const roman = ["I.", "II.", "III.", "IV."];
const $ = (id) => document.getElementById(id);

$("scents").innerHTML = scents.map((s, k) => `
  <div class="scent" data-k="${k}">
    <p class="no">${s.no}</p>
    <p class="name">${s.name}</p>
    <div class="steps">
      <button data-i="${s.forms[0]}">The plant</button><span>→</span><button data-i="${s.forms[1]}">The scent</button>
    </div>
  </div>`).join("");

const narrow = () => innerWidth < 760;

const api = await stage({
  canvas: $("dust"),
  pictures: forms.map((f) => ({ src: `img/${f.id}.webp`, depth: `img/${f.id}-depth.png`, relief: 0.55 })),
  options: {
    ink: true,
    background: "#f1eadf",
    exposure: 1.0,
    relief: 0.55,
    // the plant evaporates into a mist of its own colours, from the stem up, and the perfume condenses out of it
    travel: "swarm",
    kick: 0.7, air: 1.1, blur: 0.2, spread: 0.9, gather: 1.6,
    order: { dir: [0, 1, 0.2], jitter: 0.55 },
    vignette: 0.22, grain: 0.008,
    sway: 0.7, parallax: 0.7,
    hand: { reach: 0.12, drag: 7, spread: 1.6, still: 0.04, depth: 0.4 },
    frame: (w, h) => narrow()
      ? { cx: w * 0.5, cy: h * 0.49, s: Math.min(w * 0.42, h * 0.235) }
      : { cx: w * 0.585, cy: h * 0.52, s: Math.min(h * 0.37, w * 0.24) },
  },
  hold: 4.2,
  onShow(i) {
    const f = forms[i];
    $("roman").textContent = roman[i];
    $("what").textContent = f.what;
    $("note").textContent = f.note;
    $("buy").textContent = f.buy;
    document.querySelectorAll(".scent").forEach((el) => el.classList.toggle("on", +el.dataset.k === f.scent));
    document.querySelectorAll(".scent button").forEach((b) => b.classList.toggle("on", +b.dataset.i === i));
    document.body.dataset.scent = f.scent;
  },
});

$("scents").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (b) api.pick(+b.dataset.i);
});
