// The page: the puffy letters (puff.js) over a background drawn once in code (backgrounds.js).
// Everything here is meant to be edited for the brand: where the letters sit, which background, its colours.
import { mountPuff } from "./puff.js";
import * as bg from "./backgrounds.js";

// size: the letters' height as a share of the window (capped at maxW of its width); y: their centre
const puff = mountPuff(document.querySelector(".puff"), { src: "img/{{ID}}/puff", size: .7, maxW: .64, y: .52 });

// The background, drawn again whenever the letters are measured (on load and after every resize). Keep one recipe,
// or write a new one that belongs to this brand (references/backgrounds.md). Keep it still and calmer than the letters.
puff.onSized(async (r) => {
  await document.fonts.ready;
  const x = bg.prepare(document.querySelector("canvas.bg"));
  bg.crayonClouds(x, { ink: "#ffffff", tint: "#c9d6f3", fill: .38, keepOut: bg.rects(".site", ".label", ".cta") });
  // other recipes:
  //   bg.twistedGrid(document.querySelector("canvas.bg"), { a: "#c3f15a", b: "#8fd83b" });          // needs its own canvas
  //   bg.swirl(x, { center: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, color: "#d8d6d0" });
  //   bg.sprinkles(x, { colors: ["#f26b4b", "#2f4fd8", "#f6c42c", "#7fd6a6", "#ffffff"], center: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, clear: r, keepOut: bg.rects(".site", ".label", ".cta") });
  //   bg.outlineRows(document.querySelector(".rows"), { word: "HUGGER", family: "Unbounded" });     // a <div class="rows"> behind the letters
});

let t;
addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => puff.resize(), 80); });
