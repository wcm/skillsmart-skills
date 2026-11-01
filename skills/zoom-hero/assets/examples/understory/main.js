// Understory: a cloud forest you can dive into, from the canopy down to the eye of a glass frog.
import { Loupe } from "../engine/loupe.js";
import { bindUI } from "../engine/ui.js";

const root = document.documentElement;

// ---- the counter in the nav: counts up on load, then grows now and then ------------------------------------
const counters = [...document.querySelectorAll("[data-m2]")];
const fmt = (n) => n.toLocaleString("en-US");
let protectedM2 = 48210;
const show = (n) => { const t = fmt(n); for (const c of counters) if (c.textContent !== t) c.textContent = t; };
{
  const t0 = performance.now(), dur = 1500;
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    show(Math.round(protectedM2 * (1 - (1 - t) ** 4)));
    if (t < 1) requestAnimationFrame(step);
  };
  show(0);
  requestAnimationFrame(step);
  const grow = () => {
    show(++protectedM2);
    for (const c of counters) { c.classList.add("bump"); setTimeout(() => c.classList.remove("bump"), 900); }
    setTimeout(grow, 7000 + Math.random() * 9000);
  };
  setTimeout(grow, 9000);
}

// ---- every level, as field notes -----------------------------------------------------------------------
const content = {
  canopy: {
    name: "Canopy", kicker: "Monteverde, Costa Rica",
    title: "A forest that lives <em>inside a cloud.</em>",
    text: "Mist drifts through these treetops most mornings. The trees drink it straight from the air.",
    facts: [["Altitude", "1,550 m"], ["Plants", "2,500 species"], ["Birds", "400 species"]],
  },
  branch: {
    name: "Branch", spot: "A mossy branch", cursor: "Look closer", kicker: "A branch, 30 m up",
    title: "A garden <em>with no ground.</em>",
    text: "Moss, ferns and bromeliads grow right on the bark. They drink the mist and never touch the soil.",
    facts: [["Height", "30 m"], ["Soil", "None"], ["Water", "From the mist"]],
    notes: [{ at: [0.33, 0.16], text: "Bromeliad · a cup of rain", side: "right" }, { at: [0.13, 0.5], text: "Moss · drinks the mist", side: "right" }],
  },
  frog: {
    name: "Glass frog", spot: "On this leaf", cursor: "Look closer", kicker: "A wet leaf, at dawn",
    title: "A frog you can <em>see through.</em>",
    text: "Its belly skin is clear as glass. You can watch its heart beat.",
    facts: [["Species", "Glass frog"], ["Latin", "<i>Hyalinobatrachium</i>"], ["Status", "Vulnerable"]],
    notes: [{ at: [0.4625, 0.45], text: "Heart · seen through the skin", side: "right" }, { at: [0.206, 0.54], text: "Toe pads · sticky", side: "left" }],
  },
  eye: {
    name: "Eye", spot: "Its eye", cursor: "Closer", kicker: "The frog's eye",
    title: "The whole forest, <em>in one eye.</em>",
    text: "Look into it and you see where the frog lives: the canopy, the mist, the dawn sky.",
    facts: [["Eye", "3 mm wide"], ["Hunts", "At night"], ["Eats", "Small insects"]],
    notes: [{ at: [0.39, 0.22], text: "The canopy, reflected", side: "right" }],
  },
  sloth: {
    name: "Sloth", spot: "A sloth", cursor: "Look closer", kicker: "A cecropia tree, 25 m up",
    title: "It climbs down <em>once a week.</em>",
    text: "It eats leaves, sleeps most of the day and moves a few metres. Its fur is a world of its own.",
    facts: [["Species", "Three-toed sloth"], ["Latin", "<i>Bradypus variegatus</i>"], ["Status", "Least concern"]],
    notes: [{ at: [0.615, 0.205], text: "Claws · 8 <b class=u>cm</b>", side: "right" }],
  },
  fur: {
    name: "Fur", spot: "Its fur", cursor: "Closer", kicker: "In the sloth's fur", at: [0.384, 0.467],
    title: "Its fur grows <em>its own algae.</em>",
    text: "Each hair has grooves where green algae grow. Sloth moths live in it too, and nowhere else.",
    facts: [["Moth", "<i>Cryptoses</i>"], ["Algae", "<i>Trichophilus</i>"], ["Found", "Only on sloths"]],
    notes: [{ at: [0.384, 0.47], text: "Sloth moth", side: "right" }, { at: [0.62, 0.55], text: "Green algae", side: "right" }],
  },
  river: {
    name: "River", spot: "The river bank", cursor: "Look closer", kicker: "The river bank, below",
    title: "A flash of blue <em>on wet stone.</em>",
    text: "Blue morphos land on river banks to sip salts from the wet stones.",
    facts: [["Species", "Blue morpho"], ["Latin", "<i>Morpho peleides</i>"], ["Wingspan", "14 cm"]],
    notes: [{ at: [0.16, 0.3], text: "Clear shallows", side: "right" }],
  },
  scales: {
    name: "Scales", spot: "Its wing", cursor: "Closer", kicker: "A morpho's wing",
    title: "This blue <em>has no pigment.</em>",
    text: "Tiny ridges on each scale bend the light into blue. Tilt the wing and the colour shifts.",
    facts: [["Scale", "0.1 mm"], ["Colour", "From structure"], ["Rows", "Like roof tiles"]],
    notes: [{ at: [0.6, 0.6], text: "Wing vein", side: "right" }],
  },
};

const levels = await (await fetch("img/levels.json")).json();
const thumbs = Object.fromEntries(Object.entries(levels.nodes).map(([id, n]) => [id, `img/${n.thumb}`]));
const stage = document.getElementById("stage");
const lp = await Loupe.create(document.getElementById("loupe"), { levels, base: "img/" });
const ui = bindUI(lp, stage, { content, thumbs });

// ---- mist while diving: it thickens mid-level and clears round the point we dive toward ------------------
lp.on("frame", (s) => {
  const f = s.depth - Math.floor(s.depth);
  const haze = s.moving ? Math.sin(Math.PI * f) ** 1.5 : 0;
  root.style.setProperty("--haze", haze.toFixed(3));
  if (s.moving) {
    root.style.setProperty("--hx", `${((s.zoomAt[0] / stage.clientWidth) * 100).toFixed(1)}%`);
    root.style.setProperty("--hy", `${((s.zoomAt[1] / stage.clientHeight) * 100).toFixed(1)}%`);
  }
});

// ---- a spot whose area is off-screen shows as an arrow on the edge (phones): keep it clear of the words ----
const obstacles = [".copy .lp-copy-in:not(.out)", ".hud", ".give.on"];
function keepArrowsClear() {
  const s = stage.getBoundingClientRect();
  const boxes = obstacles.map((q) => stage.querySelector(q)?.getBoundingClientRect()).filter((r) => r && r.height);
  for (const b of stage.querySelectorAll(".lp-spot.edge")) {
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(b.style.transform);
    if (!m) continue;
    const x = Number(m[1]), y = Number(m[2]);
    const hit = boxes.find((r) => x > r.left - s.left - 24 && x < r.right - s.left + 24 && y > r.top - s.top - 30 && y < r.bottom - s.top + 24);
    if (hit) b.style.transform = `translate(${x}px, ${Math.max(26, hit.top - s.top - 32).toFixed(1)}px)`;
  }
}
lp.on("frame", keepArrowsClear);
keepArrowsClear();

// ---- notes: on a narrow screen a label can run off the edge or under the words; turn it round, or tuck it away
function fitNotes() {
  const W = stage.clientWidth, s = stage.getBoundingClientRect();
  let boxes = null;
  for (const n of stage.querySelectorAll(".lp-note")) {
    if (n._fit) continue;
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(n.style.transform);
    if (!m) continue;
    const x = Number(m[1]), y = Number(m[2]), w = n.querySelector("span").offsetWidth + 44;
    const fits = { right: x + w < W - 10, left: x - w > 10 };
    const authored = n.classList.contains("left") ? "left" : "right";
    const side = fits[authored] ? authored : fits[authored === "left" ? "right" : "left"] ? (authored === "left" ? "right" : "left") : null;
    boxes ??= obstacles.map((q) => stage.querySelector(q)?.getBoundingClientRect()).filter((r) => r && r.height);
    const under = boxes.some((r) => x > r.left - s.left - 12 && x < r.right - s.left + 12 && y > r.top - s.top - 18 && y < r.bottom - s.top + 18);
    if (side) { n.classList.toggle("left", side === "left"); n.classList.toggle("right", side === "right"); }
    n.classList.toggle("tucked", !side || under);
    n._fit = true;
  }
}
lp.on("frame", fitNotes);
addEventListener("resize", () => { for (const n of stage.querySelectorAll(".lp-note")) n._fit = false; });
fitNotes();

// ---- the end of the main dive: protect a square metre -----------------------------------------------------
const give = document.getElementById("give");
lp.on("depart", () => { give.classList.remove("on"); give.setAttribute("aria-hidden", "true"); });
lp.on("arrive", ({ level }) => {
  const on = level === "eye";
  give.classList.toggle("on", on);
  give.setAttribute("aria-hidden", String(!on));
});

if (new URLSearchParams(location.search).has("tour")) ui.tour();
Object.assign(window, { lp, ui });
