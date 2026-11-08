// A Particle Hero page: the subjects in tools/pictures/<id>.json, turned to dust one after another, with a list to pick
// one. Start from a look, then change what the brief needs (references/looks.md, references/engine.md).
import { stage } from "../engine/stage.js";
import { looks, beatLamps } from "../engine/looks.js";

const LOOK = "dust";   // dust | ink | neon | print

// one entry per picture, in the order of tools/pictures/<id>.json; `id` is the picture's name in img/
const subjects = [
  { id: "one", name: "WRITE", line: "WRITE" },
  { id: "two", name: "WRITE", line: "WRITE" },
  { id: "three", name: "WRITE", line: "WRITE" },
];

const HOLD = 4.2;      // seconds each subject stays before the next
const $ = (id) => document.getElementById(id);
const narrow = () => innerWidth < 760;
document.body.dataset.look = LOOK;

const list = $("pick");
list.innerHTML = subjects.map((s, i) => `<li><button data-i="${i}"><span>${String(i + 1).padStart(2, "0")}</span>${s.name}<i></i></button></li>`).join("");

const api = await stage({
  canvas: $("dust"),
  // trackers suit the dust look, callouts the print look; leave hudCanvas out for none
  hudCanvas: LOOK === "dust" || LOOK === "print" ? $("hud") : null,
  hud: LOOK === "print"
    ? { color: "rgba(28,26,24,0.85)", dim: "rgba(28,26,24,0.32)", primary: 0, secondary: 10, links: false, ruler: { pad: 26 } }
    : { ruler: { pad: 28, wide: 1, tall: 1 } },
  pictures: subjects.map((s) => ({
    src: `img/${s.id}.webp`, depth: `img/${s.id}-depth.png`,
    fade: LOOK === "neon" ? 0.3 : 0,          // portraits cut off at the bottom thin out instead of ending on a line
  })),
  options: {
    ...looks[LOOK],
    // where the subject sits: its centre and half its height, in CSS px. Keep the title's band clear of it.
    frame: (w, h) => narrow()
      ? { cx: w * 0.5, cy: h * 0.6, s: Math.min(w * 0.42, h * 0.27) }
      : { cx: w * 0.64, cy: h * 0.5, s: Math.min(h * 0.36, w * 0.25) },
  },
  hold: HOLD,
  onShow(i) {
    const s = subjects[i];
    $("no").textContent = `${String(i + 1).padStart(2, "0")} / ${String(subjects.length).padStart(2, "0")}`;
    $("name").textContent = s.name;
    $("line").textContent = s.line;
    list.querySelectorAll("button").forEach((b) => { b.classList.toggle("on", +b.dataset.i === i); b.querySelector("i").style.transform = "scaleX(0)"; });
  },
  onFrame(e) {
    if (LOOK === "neon") beatLamps(e, { bpm: 118 });
    // the active name fills in with time held
    const bar = list.querySelector("button.on i");
    if (bar) bar.style.transform = `scaleX(${Math.min(1, (e.time - e.t0) / (HOLD + e.o.spread + e.o.gather))})`;
  },
});

list.addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (b) api.pick(+b.dataset.i);
});
