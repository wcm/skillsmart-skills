// Noble Gas: one switch (or the sign itself) brings the night: the sun drains toward the window, a beat of blue, the
// neon strikes, and the light box swells in after it.
import { bindTheme, daySwitch, pinBox, plainSwitch, shots, start, startState } from "../engine/ui.js";

const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const phone = matchMedia("(max-width: 760px)");
const root = document.documentElement;
const stage = document.getElementById("stage");
const button = document.getElementById("switch");

const jn = await start(document.getElementById("jn"), {
  sets: { neon: shots() },
  weights: ["img/weights0.png"],
  widths: [1600],
  lights: [
    { id: "neon", kind: calm ? "fade" : "neon", warmth: 0 },
    { id: "rest", kind: calm ? "fade" : "warm", warmth: 0 },   // the light box (and what the room gives back)
  ],
  focus: phone.matches ? [0.605, 0.42] : [0.63, 0.42],
  zoom: 1.02,                                                  // crops the dark sliver of window frame at the left edge
  sunFrom: [0, 0.35],
  gold: 0.45,
  dayExpo: 0.25,
  vignette: 0.18,
  bloom: 0.25,
}, { fallback: () => plainSwitch(stage, button, "img/night-1600.webp", { onChange: (n) => (n ? (root.dataset.lit = "") : delete root.dataset.lit) }) });

if (jn) {
  bindTheme(jn, { flipAt: 0.42, span: 0.12 });
  const neon = jn.byId.neon;
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // the title's own flip (its side of the room darkens last), the neon's level for the knob, and the moment the
  // night copy may arrive: the neon's first full strike
  jn.on("change", (s) => {
    root.style.setProperty("--flip-left", smooth(0.62, 0.74, s.sun).toFixed(4));
    root.style.setProperty("--neon", Math.min(1, Math.max(0, neon.level)).toFixed(3));
    if (neon.level > 0.9 && jn.mode === "night") root.dataset.lit = "";
    if (neon.target === 0 && neon.level < 0.5) delete root.dataset.lit;
  });

  // the room's own glow waits for the light box: rising sooner, it leaves a dark ring round the box and the sign
  const night = () => jn.night(calm ? { sun: 0.9, beat: 0.1, stagger: 0.3, order: ["neon", "rest"] } : { sun: 1.8, beat: 0.4, stagger: 0.9, ambientDelay: 0.9, order: ["neon", "rest"] });
  const day = () => jn.day({ sun: calm ? 0.9 : 1.6, lightsOff: 0.3 });
  const sign = document.getElementById("sign");
  let teasing = false;
  const toggle = () => {
    if (teasing) { teasing = false; jn.light("neon", false, { duration: 0.12 }); }
    return jn.mode === "night" ? day() : night();
  };
  daySwitch(button, jn, { onToggle: toggle });

  // the sign: click it to switch; by day, pointing at it lights the glass the way neon looks in daylight (a blush)
  sign.addEventListener("click", toggle);
  jn.on("mode", (m) => sign.setAttribute("aria-label", m === "night" ? "Switch the sign off" : "Switch the sign on"));
  pinBox(jn, sign, [0.415, 0.275, 0.785, 0.41]);
  sign.addEventListener("pointerenter", () => {
    if (jn.mode === "night" || jn.state.sun > 0.01 || calm) return;
    teasing = true;
    jn.light("neon", true);
  });
  sign.addEventListener("pointerleave", () => {
    if (!teasing) return;
    teasing = false;
    if (jn.mode !== "night") jn.light("neon", false);
  });

  phone.addEventListener("change", (e) => jn.setFocus(e.matches ? [0.605, 0.42] : [0.63, 0.42]));
  startState(jn);
  if (jn.mode === "night") root.dataset.lit = "";
  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.target.closest("input, textarea")) return;
    if (e.key === "n" || e.key === "N") toggle();
  });
}
