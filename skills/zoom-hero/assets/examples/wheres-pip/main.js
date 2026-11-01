// Where's Pip?: a seek-and-find picture book you can dive into. Pip is hiding somewhere in a harbour town; two
// clues lead from a lit window, to a boat, to the lighthouse. The game runs on the shared engine: ui.lock keeps a
// spot shut until the clue that points to it is found.
import { Loupe } from "../engine/loupe.js";
import { bindUI } from "../engine/ui.js";

const params = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, "0");

const content = {
  town: {
    name: "Town", kicker: "How to play",
    title: "Start at the <em>lit window.</em>",
    text: "Click it to look closer. Each clue shows you where to look next.",
  },
  window: {
    name: "Window", spot: "The lit window", cursor: "Peek", at: [0.51, 0.56], kicker: "The window",
    title: "Tea time at <em>number 12.</em>",
    text: "The Bells are having tea. Pip was here a minute ago, and left a note by the teapot.",
    notes: [{ at: [0.598, 0.655], text: "A cat. Not Pip.", side: "right" }],
  },
  note: {
    name: "Note", spot: "A note", cursor: "Read", at: [0.46, 0.6], kicker: "The note",
    title: "A boat, and an arrow <em>pointing at it.</em>",
    text: "Pip's drawings are always clues. This one says: go down to the harbour.",
    notes: [{ at: [0.505, 0.555], text: "A scarf on the mast?", side: "right" }],
  },
  boat: {
    name: "Boat", spot: "The pink boat", cursor: "Look", at: [0.47, 0.6], kicker: "The pink boat",
    title: "Whose scarf is <em>on the mast?</em>",
    text: "A long yellow scarf, tied on at the very top. Pip has one just like it.",
    notes: [{ at: [0.447, 0.385], text: "A gull. Not Pip.", side: "left" }],
  },
  scarf: {
    name: "Scarf", spot: "The scarf", cursor: "Look", at: [0.48, 0.42], kicker: "The scarf",
    title: "A tag with a <em>lighthouse</em> on it.",
    text: "Pip tied it on with string, and drew the next place to look.",
    notes: [{ at: [0.35, 0.395], text: "Tied on with string", side: "left" }],
  },
  lighthouse: {
    name: "Lighthouse", spot: "The lighthouse", cursor: "Climb", at: [0.56, 0.45], kicker: "The lighthouse",
    title: "Someone is waving <em>from the top.</em>",
    text: "Look behind the glass of the lamp room. A pink bobble hat. A yellow coat.",
  },
  pip: {
    name: "Pip", spot: "Someone waving", cursor: "Pip?", kicker: "Found",
    title: "Hello, <em>Pip!</em>",
    text: "Pip climbed up to light the lamp, with Bramble the dog. Thanks for finding them.",
    notes: [{ at: [0.332, 0.68], text: "Bramble, the dog", side: "right" }],
  },
};

// ---- the game ------------------------------------------------------------------------------------------------
const game = { note: false, scarf: false, pip: false };
const visited = new Set();
const step = () => (game.pip ? 3 : game.scarf ? 2 : game.note ? 1 : 0);

// the town's words follow the game
const townSteps = [
  null,
  { kicker: "Clue 1 of 2", title: "Now find <em>the pink boat.</em>", text: "Pip drew it on the note. It's tied up at the quay, right below the window." },
  { kicker: "Clue 2 of 2", title: "Up to <em>the lighthouse!</em>", text: "The tag shows the striped tower on the rocks. Look right at the top." },
  { kicker: "All found", title: "Pip was in <em>the lighthouse.</em>", text: "That's one town. The book has twelve more, and Pip hides in every one." },
];

// the clue cards: what Pip drew, cut from the close-up
const clues = {
  note: { k: "Clue 1 of 2", t: "Pip went to the harbour!", s: "The note shows a pink boat. Find it at the quay.", pic: "url(img/note-1600.webp) 44.5% 64% / 520% auto" },
  scarf: { k: "Clue 2 of 2", t: "Pip went to the lighthouse!", s: "The tag shows the striped tower. Look at the very top.", pic: "url(img/scarf-1600.webp) 47.5% 39% / 600% auto" },
};

function render(id, c, lp) {
  const w = id === "town" && step() ? { ...c, ...townSteps[step()] } : c;
  const facts = (w.facts ?? []).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  return `<p class="lp-kicker"><span>${pad(lp.node(id).depth + 1)}</span>${w.kicker ?? w.name}</p>` +
    (w.title ? `<h2 class="lp-title">${w.title}</h2>` : "") +
    (w.text ? `<p class="lp-text">${w.text}</p>` : "") +
    (facts ? `<dl class="lp-facts">${facts}</dl>` : "");
}

// ---- the engine and the shared interface ------------------------------------------------------------------
const levels = await (await fetch("img/levels.json")).json();
const thumbs = Object.fromEntries(Object.entries(levels.nodes).map(([id, n]) => [id, `img/${n.thumb}`]));
const stage = $("#stage");
const lp = await Loupe.create($("#loupe"), { levels, base: "img/" });
const ui = bindUI(lp, stage, { content, thumbs, render });

// ---- the page's own pieces ----------------------------------------------------------------------------------
const tracker = $("#tracker"), count = $("#count");
const clueCard = $("#clue"), found = $("#found"), order = $("#order");

function lockAll() {
  ui.lock("boat", !game.note);
  ui.lock("lighthouse", !game.scarf);
}

function updateTracker(bump) {
  const n = Number(game.note) + Number(game.scarf);
  count.textContent = n;
  for (const s of tracker.querySelectorAll(".slot")) s.classList.toggle("got", game[s.dataset.slot]);
  tracker.classList.toggle("started", n > 0 || game.pip);
  tracker.setAttribute("aria-label", `Clues ${n} of 2${game.pip ? ", Pip found" : ""}`);
  if (bump) { tracker.classList.remove("bump"); void tracker.offsetWidth; tracker.classList.add("bump"); }
}

function show(el, on) {
  el.classList.toggle("on", on);
  el.setAttribute("aria-hidden", String(!on));
}

function showClue(id) {
  const c = clues[id];
  clueCard.querySelector(".clue-k").textContent = c.k;
  clueCard.querySelector(".clue-t").textContent = c.t;
  clueCard.querySelector(".clue-s").textContent = c.s;
  clueCard.querySelector(".clue-pic").style.background = `${c.pic} no-repeat, var(--paper)`;
  clueCard.classList.remove("stow");
  show(clueCard, true);
}

// a seeded scatter, so every visit throws the same confetti
function confetti() {
  const box = $("#confetti");
  box.replaceChildren();
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const inks = ["var(--pink)", "var(--pink)", "var(--yellow)", "var(--yellow)", "var(--navy)", "var(--paper)"];
  const wide = Math.min(innerWidth * 0.46, 620), tall = Math.min(innerHeight * 0.2, 170);
  for (let i = 0; i < 56; i++) {
    const e = document.createElement("i");
    let x = (rnd() * 2 - 1) * wide, y = (rnd() * 2 - 1) * tall - tall * 0.25;
    // keep the banner itself clear
    if (Math.abs(x) < wide * 0.42 && Math.abs(y) < tall * 0.45) x = Math.sign(x || 1) * (wide * 0.42 + rnd() * wide * 0.5);
    const s = 7 + Math.round(rnd() * rnd() * 22);
    e.style.cssText = `--x:${x.toFixed(0)}px;--y:${y.toFixed(0)}px;--s:${s}px;--c:${inks[i % inks.length]};--d:${(rnd() * 0.25).toFixed(2)}s;--f:${(6 + rnd() * 14).toFixed(0)}px`;
    if (s > 15 && rnd() < 0.6) e.className = "tone";
    box.append(e);
  }
}

function celebrate() {
  confetti();
  show(found, true);
  show(order, true);
}

function hideCards() {
  if (clueCard.classList.contains("on")) { clueCard.classList.add("stow"); show(clueCard, false); }
  show(found, false);
  show(order, false);
}

// re-print the words of the level we're on (after a reset, without moving)
function refreshCopy() {
  const box = document.createElement("div");
  box.className = "lp-copy-in";
  box.dataset.level = lp.level;
  box.innerHTML = render(lp.level, content[lp.level] ?? {}, lp);
  for (const c of document.querySelectorAll('[data-lp="copy"]')) {
    for (const old of c.querySelectorAll(".lp-copy-in:not(.out)")) { old.classList.add("out"); setTimeout(() => old.remove(), 650); }
    c.append(box);
  }
  requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add("on")));
}

function reset() {
  Object.assign(game, { note: false, scarf: false, pip: false });
  visited.clear();
  lockAll();
  hideCards();
  updateTracker();
}

lp.on("depart", hideCards);
lp.on("arrive", ({ level }) => {
  visited.add(level);
  let news = false;
  if (level === "note" || level === "scarf" || level === "pip") {
    // a clue (or Pip) found; anything deeper on the trail means the earlier clues were found too
    news = !game[level];
    game.note = true;
    if (level !== "note") game.scarf = true;
    if (level === "pip") game.pip = true;
    lockAll();
  }
  if (level === "note" || level === "scarf") showClue(level);
  if (level === "pip") celebrate();
  // a spot a clue has just opened gets a sticker until it's visited
  if (level === "town") {
    for (const id of ["boat", "lighthouse"]) {
      if (!ui.locked(id) && !visited.has(id)) stage.querySelector(`.lp-spot[data-id="${id}"]`)?.classList.add("fresh");
    }
  }
  updateTracker(news);
});

clueCard.querySelector(".clue-b").addEventListener("click", () => ui.dive("town"));
$("#again").addEventListener("click", () => {
  reset();
  if (lp.level === "town" && !lp.state.moving) refreshCopy();
  else lp.go("town");
});

// the title's three plates slip a little with the pointer, as if the paper moved in the press
const title = $(".title");
let px = 0, py = 0, tx = 0, ty = 0;
addEventListener("pointermove", (e) => { tx = (e.clientX / innerWidth) * 2 - 1; ty = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
(function slip() {
  px += (tx - px) * 0.06;
  py += (ty - py) * 0.06;
  title.style.setProperty("--px", px.toFixed(3));
  title.style.setProperty("--py", py.toFixed(3));
  requestAnimationFrame(slip);
})();

reset();
lp.emit("frame", lp.state);   // place the spots the locks just rebuilt (in ?record the clock waits for a tick)

if (params.has("tour")) ui.tour({ hold: 1.3, plan: ["window", "note", "town", "boat", "scarf", "town", "lighthouse", "pip"] });
Object.assign(window, { lp, ui, game, reset });
