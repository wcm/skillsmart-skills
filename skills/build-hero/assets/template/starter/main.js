// The build: the film plays across `film` of the hero's scroll, then evening falls across `lit.at`.
import { mountBuild, reveal } from "../engine/chantier.js";

await mountBuild(document.getElementById("build"), {
  frames: "frames",
  film: [0.04, 0.74],
  // WRITE: the order the lights come on: rise (bottom first), fall, sweep (left first), sweep-left, radial (from
  // origin, in frame units) or scatter; flicker for candles
  lit: { dusk: "img/dusk", src: "img/lit", at: [0.76, 0.92], split: 0.4, reveal: "rise", noise: 0.3 },
  focus: [0.5, 0.5],                                         // which part of the frame stays in view on narrow screens
  phone: { mode: "cover", zoom: 1, focus: [[0, 0.5, 0.5], [1, 0.5, 0.5]] },   // [film time, x, y]: the crop follows the subject
  glide: 3000,                                               // one scroll from the top plays everything in 3 s
});
reveal();
