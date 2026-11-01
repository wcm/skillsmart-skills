// Pruine: a natural-wine estate you can dive into, from the hill down to the wild yeast on a grape.
import { Loupe } from "../engine/loupe.js";
import { bindUI } from "../engine/ui.js";

const content = {
  estate: {
    name: "Estate", kicker: "The estate",
    title: "Eighteen hectares on <em>one limestone hill.</em>",
    text: "We farm by hand and add nothing in the cellar. Everything that makes our wine is already out here.",
    facts: [["Hectares", "18"], ["Altitude", "320 m"], ["Since", "1962"]],
  },
  vine: {
    name: "Old vines", spot: "The old vines", kicker: "The old vines",
    title: "Grenache, planted <em>in 1962.</em>",
    text: "Deep roots, small crops. Each of these vines gives about one bottle a year.",
    facts: [["Age", "63 years"], ["Yield", "1 bottle a vine"]],
    notes: [{ at: [0.47, 0.7], text: "Trunk · 63 years", side: "right" }],
  },
  grape: {
    name: "Bloom", spot: "One grape", kicker: "The bloom",
    title: "That dusty film has a name: <em>pruine.</em>",
    text: "It's the grape's own wax. We named the estate after it, and we never wash it off.",
    facts: [["Picked", "By hand"], ["Harvest", "Sept 2025"]],
    notes: [{ at: [0.19, 0.465], text: "Morning dew", side: "left" }, { at: [0.8, 0.27], text: "Bloom · natural wax", side: "left" }],
  },
  bloom: {
    name: "Wild yeast", spot: "The bloom", kicker: "Wild yeast",
    title: "The yeast that makes our wine <em>lives right here.</em>",
    text: "Millions of wild yeast cells ride in on the bloom. In the cellar they start the wine on their own. We add nothing.",
    facts: [["Added yeast", "None"], ["Sulphites", "None"]],
    notes: [{ at: [0.33, 0.4], text: "Wild yeast · 5 µm", side: "right" }, { at: [0.62, 0.24], text: "Wax crystals", side: "right" }],
  },
  soil: {
    name: "Soil", spot: "The limestone", kicker: "The soil",
    title: "Pale limestone <em>under every vine.</em>",
    text: "The roots crack down through the rock for water, which keeps the wine fresh through hot summers.",
    facts: [["Rock", "Limestone"], ["Roots", "Down to 6 m"]],
  },
  fossil: {
    name: "Fossil", spot: "A fossil", kicker: "A seabed",
    title: "This hill was a seabed <em>150 million years ago.</em>",
    text: "Fossil shells still turn up in the rock. You can taste the chalk in the finish.",
    facts: [["Age", "Jurassic"], ["Finish", "Chalk, salt"]],
  },
  cellar: {
    name: "Cellar", spot: "The cellar", kicker: "The cellar",
    title: "One old barn, <em>cool all year.</em>",
    text: "No pumps and no filters. The wine moves by gravity, from the press down to the barrels.",
    facts: [["Built", "1870"], ["Inside", "13 °C"]],
    notes: [{ at: [0.705, 0.22], text: "One bulb · 13 °C", side: "right" }],
  },
  barrel: {
    name: "Barrel", spot: "A barrel", kicker: "The barrels",
    title: "Eleven months <em>in old oak.</em>",
    text: "Old barrels give the wine air, not taste. Then it goes straight into the bottle.",
    facts: [["Oak", "15 years old"], ["Ageing", "11 months"]],
    notes: [{ at: [0.47, 0.32], text: "Grenache 2025", side: "right" }, { at: [0.6, 0.73], text: "Chalk tally", side: "right" }],
  },
};

const levels = await (await fetch("img/levels.json")).json();
const thumbs = Object.fromEntries(Object.entries(levels.nodes).map(([id, n]) => [id, `img/${n.thumb}`]));
const stage = document.getElementById("stage");
const lp = await Loupe.create(document.getElementById("loupe"), { levels, base: "img/" });
const ui = bindUI(lp, stage, { content, thumbs });

const shop = document.getElementById("shop");
lp.on("depart", () => { shop.classList.remove("on"); shop.setAttribute("aria-hidden", "true"); });
lp.on("arrive", ({ level }) => {
  const on = level === "bloom";
  shop.classList.toggle("on", on);
  shop.setAttribute("aria-hidden", String(!on));
});

if (new URLSearchParams(location.search).has("tour")) ui.tour();
Object.assign(window, { lp, ui });
