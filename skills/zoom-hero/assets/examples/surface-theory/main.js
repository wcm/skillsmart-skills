// Surface Theory: follow one drop of Serum 05 from the cheek down to the molecule. Everything on the picture is a
// measurement: the face's notes read like a skin scan, and calipers pinned to the picture measure what you see.
import { Loupe } from "../engine/loupe.js";
import { bindUI, fmtMag } from "../engine/ui.js";

const content = {
  portrait: {
    name: "Face",
    notes: [
      { at: [0.69, 0.15], text: "Hydration <b>92%</b>", side: "left" },
      { at: [0.695, 0.47], text: "Barrier <b>+38%</b>", side: "left" },
    ],
  },
  cheek: {
    name: "Cheek", spot: "The cheek", kicker: "The cheek", at: [0.49, 0.6],
    title: "Pressed in, <em>not rubbed.</em>",
    text: "Warm two drops on your fingertips and press them into dry skin. Serum 05 sinks in within a minute.",
    facts: [["Dose", "2 drops"], ["Sinks in", "58 s"], ["Use", "AM and PM"]],
    notes: [
      { at: [0.3, 0.235], text: "Lash <b>9 mm</b>", side: "right" },
      { at: [0.334, 0.403], text: "Freckle <b>2 mm</b>", side: "left" },
    ],
  },
  drop: {
    name: "Drop", spot: "The drop", kicker: "The drop",
    title: "4.2 mm long, <em>mostly water.</em>",
    text: "Serum 05 is a light gel, 86% water. The other 14% does the work: niacinamide, ceramide and glycerin.",
    facts: [["Water", "86%"], ["Acidity", "pH 5.5"]],
    notes: [{ at: [0.257, 0.185], text: "Pore <b>0.08 mm</b>", side: "right" }],
  },
  cells: {
    name: "Cells", spot: "Skin cells", kicker: "Skin cells",
    title: "Flat cells, <em>stacked like bricks.</em>",
    text: "Your outer skin is about 15 layers of flat, dead cells, held together by ceramide. On the right, the serum fills the gaps.",
    facts: [["Layers", "15"], ["Renewed", "Every 28 days"]],
    notes: [{ at: [0.7, 0.58], text: "Serum <b>in the gaps</b>", side: "right" }],
  },
  molecule: {
    name: "Molecule", spot: "Niacinamide", kicker: "The molecule",
    title: "Niacinamide, <em>0.8 nm across.</em>",
    text: "Small enough to slip between cells. At 10%, it helps skin hold on to water and evens out its tone.",
    facts: [["Dose", "10%"], ["Also called", "Vitamin B3"]],
  },
  bottle: {
    name: "Bottle", spot: "The bottle", kicker: "The bottle", at: [0.686, 0.2],
    title: "30 ml, <em>in frosted glass.</em>",
    text: "Enough for about two months, morning and night. No fragrance and no essential oils.",
    facts: [["Volume", "30 ml"], ["Fragrance", "None"]],
    notes: [{ at: [0.72, 0.29], text: "Fill line <b>30 ml</b>", side: "right" }],
  },
  dropper: {
    name: "Dropper", spot: "The dropper", kicker: "The dropper",
    title: "A glass tip, <em>one drop at a time.</em>",
    text: "Glass doesn't react with the serum. Squeeze once and one even drop falls.",
    facts: [["Tip", "2.9 mm"], ["One drop", "0.01 ml"]],
  },
};

// Calipers, in shares of the level's own picture: the dimension line from a to b, dashed extension lines from the
// subject's edges (from) to its ends, and the reading on one side of it (right of an upright line, above a level one).
const calipers = {
  drop: { a: [0.705, 0.128], b: [0.705, 0.876], from: [[0.53, 0.128], [0.51, 0.876]], label: "4.2 mm" },
  cells: { a: [0.278, 0.294], b: [0.348, 0.294], from: [[0.278, 0.33], [0.348, 0.325]], label: "42 µm" },
  molecule: { a: [0.49, 0.095], b: [0.49, 0.675], from: [[0.43, 0.095], [0.37, 0.675]], label: "0.8 nm" },
  dropper: { a: [0.82, 0.355], b: [0.82, 0.79], from: [[0.7, 0.355], [0.72, 0.79]], label: "2.9 mm" },
};

const params = new URLSearchParams(location.search);
const levels = await (await fetch("img/levels.json")).json();
// The molecule's view is 2.4 nm across (levels.json says 20 nm), so the 0.8 nm molecule measures true against the
// Field readout and its caliper.
levels.nodes.molecule.span = 2.4e-9;
// the loupe cursor says how far each dive zooms
for (const [id, n] of Object.entries(levels.nodes)) if (n.parent && content[id]) content[id].cursor ??= fmtMag(levels.nodes[n.parent].span / n.span);
const thumbs = Object.fromEntries(Object.entries(levels.nodes).map(([id, n]) => [id, `img/${n.thumb}`]));

const stage = document.getElementById("stage");
const canvas = document.getElementById("loupe");
const lp = await Loupe.create(canvas, { levels, base: "img/" });

// a phone sees a quarter of the face picture: keep both the drop and the bottle in it
const fit = () => { lp.node(lp.rootId).focus = innerWidth / innerHeight < 1.2 ? [0.66, 0.5] : undefined; };
fit();
addEventListener("resize", fit);

// the first level's words are the title on the wall (index.html); the others are swapped in on arrival
const pad = (n) => String(n).padStart(2, "0");
const render = (id, c) => {
  if (id === lp.rootId) return "";
  const facts = (c.facts ?? []).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  return `<p class="lp-kicker"><span>${pad(lp.node(id).depth + 1)}</span>${c.kicker ?? c.name}</p>` +
    `<h2 class="lp-title">${c.title}</h2>` + (c.text ? `<p class="lp-text">${c.text}</p>` : "") +
    (facts ? `<dl class="lp-facts">${facts}</dl>` : "");
};
const ui = bindUI(lp, stage, { content, thumbs, render });

// ---- layers on the picture ----------------------------------------------------------------------------------
const el = (tag, cls, html) => { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; };
const print = el("div", "print", "<b>Surface Theory</b><i></i><strong>Serum <em>05</em></strong><span>Niacinamide 10%<br>+ ceramide NP</span><small>30 ml · 1 fl oz</small>");
print.setAttribute("aria-hidden", "true");
canvas.after(print);
const scan = el("div", "scan", "<i></i>");
const cals = el("div", "cals");
stage.querySelector(".scrim").after(scan, cals);

// the bottle's blank label carries the brand, printed on the picture: it follows the label through every move
const LABEL = { x: 0.587, y: 0.32, w: 0.191 };   // in the bottle's picture
function placePrint() {
  const r = lp.screenRect("bottle"), W = stage.clientWidth, H = stage.clientHeight;
  const lw = r.w * LABEL.w, x = r.x + r.w * LABEL.x, y = r.y + r.h * LABEL.y;
  const on = lw > 30 && lw < W && x < W && y < H && x + lw > 0 && y + lw * 1.18 > 0;
  print.style.visibility = on ? "visible" : "hidden";
  if (on) print.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${(lw / 200).toFixed(5)})`;
}

// a scan line runs down the face once each time you land on it
const FACE = { x: 0.6, y: 0.075, w: 0.235, h: 0.5 };
function placeScan() {
  const r = lp.screenRect(lp.rootId);
  scan.style.transform = `translate(${(r.x + r.w * FACE.x).toFixed(1)}px, ${(r.y + r.h * FACE.y).toFixed(1)}px)`;
  scan.style.width = `${(r.w * FACE.w).toFixed(1)}px`;
  scan.style.height = `${(r.h * FACE.h).toFixed(1)}px`;
}
function runScan() { scan.classList.remove("run"); void scan.offsetWidth; scan.classList.add("run"); }

// calipers: drawn in after landing, from the subject out to the dimension line, then the reading
let cal = null;
const NS = "http://www.w3.org/2000/svg";
function makeCaliper(id) {
  if (cal) { const old = cal.box; old.classList.remove("on"); setTimeout(() => old.remove(), 600); }
  cal = null;
  const d = calipers[id];
  if (!d) return;
  const box = el("div", "cal");
  const svg = document.createElementNS(NS, "svg");
  const line = (cls) => { const l = document.createElementNS(NS, "line"); l.setAttribute("class", cls); svg.append(l); return l; };
  const parts = {};
  for (const halo of [true, false]) for (const k of ["extA", "extB", "main", "tickA", "tickB"]) {
    const cls = `${halo ? "halo " : ""}${k.startsWith("ext") ? "ext" : k.startsWith("tick") ? "tick" : "main"}`;
    (parts[k] ??= []).push(line(cls));
  }
  const label = el("span", "cal-label", d.label);
  box.append(svg, label);
  cals.append(box);
  requestAnimationFrame(() => box.classList.add("on"));
  cal = { id, d, box, parts, label, t0: performance.now() + 250 };
}
const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
function drawCaliper(now) {
  if (!cal) return;
  const r = lp.screenRect(cal.id);
  const P = ([u, v]) => [r.x + r.w * u, r.y + r.h * v];
  const A = P(cal.d.a), B = P(cal.d.b), FA = P(cal.d.from[0]), FB = P(cal.d.from[1]);
  const t = (now - cal.t0) / 1000;
  const e1 = ease(t / 0.45), e2 = ease((t - 0.18) / 0.6), e3 = t > 0.62 ? 1 : 0;
  const set = (ls, x1, y1, x2, y2) => { for (const l of ls) { l.setAttribute("x1", x1.toFixed(1)); l.setAttribute("y1", y1.toFixed(1)); l.setAttribute("x2", x2.toFixed(1)); l.setAttribute("y2", y2.toFixed(1)); } };
  // extension lines grow from the subject toward the line
  set(cal.parts.extA, FA[0], FA[1], FA[0] + (A[0] - FA[0]) * e1, FA[1] + (A[1] - FA[1]) * e1);
  set(cal.parts.extB, FB[0], FB[1], FB[0] + (B[0] - FB[0]) * e1, FB[1] + (B[1] - FB[1]) * e1);
  // the dimension line opens from its middle
  const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  const a = [M[0] + (A[0] - M[0]) * e2, M[1] + (A[1] - M[1]) * e2], b = [M[0] + (B[0] - M[0]) * e2, M[1] + (B[1] - M[1]) * e2];
  set(cal.parts.main, a[0], a[1], b[0], b[1]);
  // end ticks across the line
  const len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, nx = -(B[1] - A[1]) / len, ny = (B[0] - A[0]) / len, k = 6 * e3;
  set(cal.parts.tickA, A[0] - nx * k, A[1] - ny * k, A[0] + nx * k, A[1] + ny * k);
  set(cal.parts.tickB, B[0] - nx * k, B[1] - ny * k, B[0] + nx * k, B[1] + ny * k);
  const upright = Math.abs(B[1] - A[1]) > Math.abs(B[0] - A[0]);
  cal.label.style.transform = upright
    ? `translate(${(M[0] + 12).toFixed(1)}px, ${M[1].toFixed(1)}px) translateY(-50%)`
    : `translate(${M[0].toFixed(1)}px, ${(M[1] - 12).toFixed(1)}px) translate(-50%, -100%)`;
  cal.label.classList.toggle("on", t > 0.5);
}

function place(now = performance.now()) {
  placePrint();
  placeScan();
  drawCaliper(now);
}
lp.on("frame", () => place());
// the engine's clock may be stopped (?record): keep the calipers drawing in on real time
(function loop(now) { drawCaliper(now); requestAnimationFrame(loop); })(performance.now());

// ---- arriving and leaving -----------------------------------------------------------------------------------
const shop = document.getElementById("shop");
lp.on("depart", () => {
  shop.classList.remove("on");
  shop.setAttribute("aria-hidden", "true");
  scan.classList.remove("run");
  makeCaliper(null);
});
lp.on("arrive", ({ level }) => {
  const end = level === "molecule";
  shop.classList.toggle("on", end);
  shop.setAttribute("aria-hidden", String(!end));
  if (level === lp.rootId) runScan();
  makeCaliper(level);
  place();
});
place();
runScan();

// Add to bag
const bagN = document.getElementById("bag-n"), buy = document.getElementById("buy");
buy.addEventListener("click", () => {
  bagN.textContent = String(Number(bagN.textContent) + 1);
  bagN.classList.add("full");
  buy.classList.add("done");
  buy.textContent = "Added · €48";
});

if (params.has("tour")) ui.tour({ hold: 1.6 });
Object.assign(window, { lp, ui });
