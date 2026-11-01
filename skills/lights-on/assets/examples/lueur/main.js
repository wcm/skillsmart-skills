// Lueur: five lamps, beautiful switched off. Click one and the evening falls: the sun drains toward the window and
// only that lamp comes on, its card beside it. The Lights switch brings the whole evening, all five left to right,
// and takes it away again: lamps off first, then the morning. Switch the last lamp off and the morning comes back.
import { ease } from "../engine/jour-nuit.js";
import { bindTheme, pin, pinBox, sceneInfo, shots, start, startState } from "../engine/ui.js";

const PIECES = [
  { id: "mushroom", name: "Ambre", kind: "Mushroom table lamp", material: "Mouth-blown amber glass", maker: "Studio Varde", price: 680 },
  { id: "pendant", name: "Lune", kind: "Lantern pendant, Ø70", material: "Washi paper, bamboo", maker: "Atelier Oku", price: 540 },
  { id: "sconce", name: "Albâtre", kind: "Wall sconce", material: "Spanish alabaster", maker: "Maison Rhee", price: 890 },
  { id: "arc", name: "Arc", kind: "Floor lamp", material: "Brushed brass, linen", maker: "Studio Varde", price: 1450 },
  { id: "column", name: "Plissé", kind: "Column floor lamp", material: "Pleated paper, oak", maker: "Atelier Oku", price: 720 },
];
const BY = Object.fromEntries(PIECES.map((p, i) => [p.id, { ...p, n: String(i + 1).padStart(2, "0") }]));
const euro = (n) => `€${n.toLocaleString("en-GB")}`;

// The pictures are the generated 16:9 frame with a strip of the same wall added on top (16:10), so a 16:10 screen
// shows all five lamps. Coordinates below are in the 16:9 frame (scene.json); TALL maps them into the pictures.
const TALL = (v) => 0.1 + 0.9 * v;
// each hotspot: the measured centre of the lamp's light, nudged onto the shade
const NUDGE = { mushroom: [0.001, -0.011], pendant: [-0.023, 0.006], sconce: [-0.001, 0.014], arc: [-0.01, -0.016], column: [-0.016, -0.02] };
const FALLBACK = { mushroom: [0.051, 0.511], pendant: [0.433, 0.23], sconce: [0.602, 0.326], arc: [0.7, 0.396], column: [0.969, 0.482] };
// where a number sits when the shade under the dot is too dark for it (amber glass, brass): on the wall just above
const LABEL = { mushroom: [0.062, 0.444], arc: [0.672, 0.322] };
// the shade (a card or chip never covers it; for the arc lamp, its whole arc)
const KEEP = { arc: [0.66, 0.28, 0.815, 0.405] };
const BOX = { mushroom: [0.012, 0.455, 0.094, 0.6], pendant: [0.322, 0.108, 0.492, 0.362], sconce: [0.573, 0.3, 0.63, 0.38], arc: [0.66, 0.35, 0.716, 0.405], column: [0.922, 0.305, 0.982, 0.8] };
// where each lamp's light lands brightest (measured from its photo alone): while it is on, a card leaves it in view
const POOL = {
  mushroom: [[0, 0.34, 0.11, 0.62]],
  pendant: [[0.31, 0.1, 0.5, 0.37], [0.25, 0.58, 0.62, 0.7]],    // the lantern, and the table top under it
  sconce: [[0.55, 0.21, 0.63, 0.43]],
  arc: [[0.6, 0.36, 0.8, 0.64]],                                // the shade and its wash down the wall
  column: [[0.91, 0.3, 0.99, 0.8]],
};
// the lantern (in the tall pictures) and its cord: the title keeps clear of both, and of the lantern's glow at night
const LANTERN = { x: 0.409, y: 0.312, rx: 0.083, ry: 0.106 }, CORD = 0.413;

const info = await sceneInfo();
const measured = Object.fromEntries((info?.lights ?? []).map((l) => [l.id, [l.x, l.y]]));
const at = (id) => { const [x, y] = measured[id] ?? FALLBACK[id]; const [dx, dy] = NUDGE[id]; return [x + dx, y + dy]; };

const stage = document.getElementById("stage");
const root = document.documentElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const dur = (s) => (reduce ? Math.min(s, 0.3) : s);
// a phone, or any window taller than wide: the title gets a band of page above the photo (same query as style.css)
const narrow = matchMedia("(max-width: 760px), (max-aspect-ratio: 21/20)");
const FOCUS = { wide: [0.5, 0.46], narrow: [0.515, 0.46] };

const jn = await start(document.getElementById("jn"), {
  sets: { room: shots({ day: "day-tall", dark: "dark-tall", night: "night-tall" }) },
  weights: ["img/weights0-tall.png", "img/weights1-tall.png"],
  widths: [1600],
  lights: PIECES.map((p) => ({ id: p.id, kind: "warm" })),   // channel order of the weights
  focus: narrow.matches ? FOCUS.narrow : FOCUS.wide,
  sunFrom: [1, TALL(0.4)],
  gold: 0.6,
  dayExpo: 0.3,
  vignette: 0.2,
  bloom: 0.8,
}, { fallback });

// without WebGL: the day picture, the night one over it, and the switch crossfades them
function fallback() {
  root.classList.add("no-gl");
  const img = document.createElement("img");
  img.className = "jn-night"; img.alt = ""; img.src = "img/night-tall-1600.webp";
  stage.querySelector("img").after(img);
  const sw = document.getElementById("lights");
  sw.setAttribute("role", "switch"); sw.setAttribute("aria-checked", "false");
  sw.addEventListener("click", () => {
    const night = root.dataset.mode !== "night";
    root.dataset.mode = night ? "night" : "day";
    for (const v of ["--flip", "--night", "--lit", "--sun", "--flip-mid", "--flip-lamps", "--flip-floor"]) root.style.setProperty(v, night ? 1 : 0);
    sw.setAttribute("aria-checked", String(night));
  });
}

if (jn) {
  // Text turns cream where the photo behind it turns dark, measured on the pictures (contrast stays above 3:1 the
  // whole way): the wall behind the title and the nav is far from the window and darkens first; the far-left wall
  // above the amber lamp at mid-dusk; the lamps' shades later; the sunlit floor under the clock last. On a phone the
  // copy sits on a band of page that darkens evenly, so it turns at mid-dusk too.
  bindTheme(jn, { flipAt: 0.37, span: 0.06 });
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const flips = () => {
    const s = jn.state.sun;
    root.style.setProperty("--flip-lamps", smooth(0.55, 0.61, s).toFixed(4));
    root.style.setProperty("--flip-floor", smooth(0.57, 0.63, s).toFixed(4));
    root.style.setProperty("--flip-mid", smooth(0.46, 0.54, s).toFixed(4));
  };
  jn.on("change", flips);
  flips();

  const lit = new Set();      // lamps switched on (or catching)
  let token = 0;              // the latest sequence; older timers stand down
  let duskAt = -1;            // when the evening is deep enough for a lamp to catch (engine clock)

  // the night light no lamp claims: low while a few lamps are on, so they stay the stars; fuller once all five are
  const ambientFor = (n) => (n >= PIECES.length ? 0.5 : 0.035 * n);
  const settle = (delay = 0) => {
    const all = lit.size === PIECES.length;
    jn.tween("ambient", ambientFor(lit.size), { duration: dur(all ? 1.2 : 0.8), delay: delay + (all ? 0.4 : 0.1), ease: ease.inOut });
  };

  // the sun goes (if it hasn't); returns how long until a lamp may catch: every lamp waits for the same depth of dusk,
  // so a second click mid-dusk does not light its lamp (or open its card) before the evening has fallen
  const evening = () => {
    if (jn.mode !== "night") {
      jn.mode = "night";
      jn.emit("mode", "night");
      const d = dur(1.4) * (1 - jn.state.sun * 0.85);
      jn.tween("sun", 1, { duration: d, ease: ease.inOut });
      duskAt = jn.now() + d * 0.57;     // the sun at about two thirds
    }
    return Math.max(0, duskAt - jn.now());
  };
  // lamps off (quick), then the morning comes back; at once if nothing had caught yet
  const morning = ({ keepCard = false } = {}) => {
    const my = ++token;
    const glowing = jn.lights.some((l) => l.level > 0.02) || jn.state.ambient > 0.01;
    jn.mode = "day";
    jn.emit("mode", "day");
    if (!keepCard) closeCard();
    PIECES.forEach((p, k) => jn.light(p.id, false, { duration: 0.3, delay: k * 0.03 }));
    lit.clear();
    syncCard();
    jn.tween("ambient", 0, { duration: 0.45, ease: ease.out });
    const rise = () => { if (my === token) jn.tween("sun", 0, { duration: dur(1.4) * (0.15 + jn.state.sun * 0.85), ease: ease.inOut }); };
    glowing ? jn.after(dur(0.3), rise) : rise();
  };
  const setLamp = (id, on, delay = 0) => {
    if (on === lit.has(id)) return;
    on ? lit.add(id) : lit.delete(id);
    jn.light(id, on, { delay, duration: reduce ? 0.3 : undefined });
    settle(delay);
    syncCard();
    // the last lamp switched off: a beat of blue dark, then the morning (its card stays, in daylight)
    if (!on && !lit.size && jn.mode === "night") {
      const my = ++token;
      jn.after(dur(0.9), () => { if (my === token && !lit.size) morning({ keepCard: true }); });
    }
  };
  const allOn = () => {
    token++;
    closeCard();
    const d = evening();
    PIECES.forEach((p, k) => { if (!lit.has(p.id)) { lit.add(p.id); jn.light(p.id, true, { delay: d + k * 0.16, duration: reduce ? 0.3 : undefined }); } });
    settle(d + 0.64);
  };
  // a lamp clicked: the evening falls and only that lamp comes on; its card opens once it has caught
  const pick = (id, viaKeys) => {
    if (openId === id) {
      if (!card.classList.contains("show")) return;               // a double click keeps the card coming
      if (lit.has(id)) return closeCard();                        // its lamp is on: the dot closes the card
      token++;
      return setLamp(id, true, evening());                        // switched off from its card: the dot lights it again
    }
    token++;
    const was = lit.has(id);
    const d = evening();
    setLamp(id, true, d);
    openCard(id, { delay: d + (was ? 0.05 : 0.4), focus: viaKeys });
  };

  // --- the Lights switch ---
  const sw = document.getElementById("lights");
  sw.setAttribute("role", "switch");
  const syncSwitch = () => sw.setAttribute("aria-checked", String(jn.mode === "night"));
  jn.on("mode", syncSwitch);
  syncSwitch();
  sw.addEventListener("click", () => (jn.mode === "night" ? morning() : allOn()));

  // --- hotspots ---
  let quiet = null;           // a hotspot given focus back by Escape: no glow on an unlit lamp the user just closed
  const spots = PIECES.map((p) => {
    const el = document.createElement("div");
    el.className = "jn-spot spot";
    el.dataset.id = p.id;
    el.innerHTML = `<button type="button" aria-label="${BY[p.id].name}, ${p.kind.toLowerCase()}: switch it on"><span class="n" aria-hidden="true">${BY[p.id].n}</span></button><span class="chip" aria-hidden="true"><b>${p.name}</b><em>—</em><span>${euro(p.price)}</span></span>`;
    const btn = el.querySelector("button");
    btn.addEventListener("click", (e) => pick(p.id, e.detail === 0));
    btn.addEventListener("pointerenter", () => jn.hover(p.id, true));
    btn.addEventListener("pointerleave", () => jn.hover(p.id, false));
    btn.addEventListener("focus", () => { if (quiet === p.id) quiet = null; else jn.hover(p.id, true); });
    btn.addEventListener("blur", () => jn.hover(p.id, false));
    document.getElementById("spots").append(el);
    const [x, y] = at(p.id);
    return { id: p.id, x, y: TALL(y), el, btn, chip: el.querySelector(".chip") };
  });
  const spotById = Object.fromEntries(spots.map((s) => [s.id, s]));
  pin(jn, spots);
  for (const s of spots) {
    const hit = document.createElement("button");
    hit.type = "button";
    hit.className = "hit";
    hit.tabIndex = -1;
    hit.setAttribute("aria-hidden", "true");
    hit.addEventListener("click", () => pick(s.id));
    hit.addEventListener("pointerenter", () => { jn.hover(s.id, true); s.el.classList.add("hover"); });
    hit.addEventListener("pointerleave", () => { jn.hover(s.id, false); s.el.classList.remove("hover"); });
    document.getElementById("spots").prepend(hit);
    const [x0, y0, x1, y1] = BOX[s.id];
    pinBox(jn, hit, [x0, TALL(y0), x1, TALL(y1)]);
  }

  // --- geometry on screen ---
  const copy = document.getElementById("copy"), title = copy.querySelector(".title"), lede = copy.querySelector(".lede");
  const nav = document.querySelector(".nav"), base = document.querySelector(".base"), bagLink = document.querySelector(".bag");
  const rect = (el) => { const r = el.getBoundingClientRect(), o = stage.getBoundingClientRect(); return { x0: r.left - o.left, y0: r.top - o.top, x1: r.right - o.left, y1: r.bottom - o.top }; };
  const box = ([x0, y0, x1, y1]) => { const a = jn.toScreen(x0, TALL(y0)), b = jn.toScreen(x1, TALL(y1)); return { x0: a.x, y0: a.y, x1: b.x, y1: b.y }; };
  const grow = (r, m) => ({ x0: r.x0 - m, y0: r.y0 - m, x1: r.x1 + m, y1: r.y1 + m });
  const overlap = (r, q) => Math.max(0, Math.min(r.x1, q.x1) - Math.max(r.x0, q.x0)) * Math.max(0, Math.min(r.y1, q.y1) - Math.max(r.y0, q.y0));
  const area = (r) => (r.x1 - r.x0) * (r.y1 - r.y0);
  const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b));

  // numbers sit on the side of the dot that faces the room's middle (or on the wall above a dark shade); the hover chip
  // sits beside the lamp's shade, on whichever side covers no other lamp and stays on screen
  const sides = () => {
    const W = stage.clientWidth;
    const words = rect(copy);
    for (const s of spots) {
      const p = jn.toScreen(s.x, s.y);
      s.el.classList.toggle("left", p.x > W * 0.62);
      const l = LABEL[s.id];
      if (l) {
        const q = jn.toScreen(l[0], TALL(l[1]));
        s.el.classList.add("above");
        s.el.style.setProperty("--lx", `${(16 + q.x - p.x).toFixed(1)}px`);    // the number lives in the 32px button
        s.el.style.setProperty("--ly", `${(16 + q.y - p.y).toFixed(1)}px`);
      }
      const own = box(BOX[s.id]), cw = s.chip.offsetWidth, ch = s.chip.offsetHeight;
      if (!cw) continue;
      // beside the shade (right, left), else above or below it
      const best = [[own.x1 + 12, p.y - ch / 2], [own.x0 - 12 - cw, p.y - ch / 2], [p.x - cw / 2, own.y0 - 10 - ch], [p.x - cw / 2, own.y1 + 10]].map(([x, y], i) => {
        const r = { x0: x, y0: y, x1: x + cw, y1: y + ch };
        let cost = i * 0.5 + (r.x0 < 12 || r.x1 > W - 12 || r.y0 < rect(nav).y1 ? 50 : 0) + (overlap(r, grow(words, 8)) ? 30 : 0);
        for (const o of spots) if (o.id !== s.id) cost += 10 * Math.min(1, overlap(r, grow(box(KEEP[o.id] ?? BOX[o.id]), 6)) / 60);
        return { x, y, cost };
      }).sort((a, b) => a.cost - b.cost)[0];
      s.el.style.setProperty("--chip-x", `${(best.x - p.x).toFixed(1)}px`);
      s.el.style.setProperty("--chip-y", `${(best.y - p.y).toFixed(1)}px`);
    }
  };

  // --- the card ---
  const card = document.getElementById("card");
  const $ = (id) => document.getElementById(id);
  const lampSw = $("card-lamp");
  let openId = null, closing = 0;
  const bagged = new Set();
  const fill = (id) => {
    const p = BY[id];
    $("card-idx").textContent = `${p.n} · ${p.kind}`;
    $("card-name").textContent = p.name;
    $("card-material").textContent = p.material;
    $("card-maker").textContent = p.maker;
    $("card-price").textContent = euro(p.price);
    $("card-add").textContent = bagged.has(id) ? "In your bag" : "Add to bag";
    syncCard();
  };
  function syncCard() {
    if (!openId) return;
    lampSw.setAttribute("aria-checked", String(lit.has(openId)));
    lampSw.setAttribute("aria-label", `${BY[openId].name}: light`);
  }
  // beside its lamp, on the side with room: of the spots round the lamp's shade (beside it, above it, below it), the one
  // that hides no lamp, no hotspot, no light that is on and not the title, staying near the lamp and high on the wall
  const place = () => {
    if (!openId || card.hidden) return;
    if (narrow.matches) { card.style.removeProperty("--cx"); card.style.removeProperty("--cy"); return; }
    const W = stage.clientWidth, H = stage.clientHeight;
    const pad = parseFloat(getComputedStyle(nav).paddingLeft);
    const own = box(KEEP[openId] ?? BOX[openId]);
    const dot = jn.toScreen(spotById[openId].x, spotById[openId].y);
    const cw = card.offsetWidth, ch = card.offsetHeight, gap = 24;
    const top = rect(nav).y1 + 6, bottom = rect(base).y0 - 14;
    const words = grow(rect(copy), 14);
    const cands = [];
    for (const y of [dot.y - 34, own.y0, own.y1 - ch, top]) cands.push([own.x1 + gap, y], [own.x0 - gap - cw, y]);
    for (const x of [dot.x - cw / 2, own.x0, own.x1 - cw]) cands.push([x, own.y0 - gap - ch], [x, own.y1 + gap]);
    let best = null;
    for (const [x, y] of cands) {
      const cx = clamp(x, pad, W - pad - cw), cy = clamp(y, top, bottom - ch);
      const r = { x0: cx, y0: cy, x1: cx + cw, y1: cy + ch };
      // near its lamp: how far it was pushed to stay on screen, and how far its nearest edge is from the dot
      const far = Math.hypot(Math.max(r.x0 - dot.x, 0, dot.x - r.x1), Math.max(r.y0 - dot.y, 0, dot.y - r.y1));
      let cost = (Math.abs(cx - x) + Math.abs(cy - y)) / 40 + far / 45 + 3 * (cy + ch / 2) / H;
      if (overlap(r, grow(own, 6))) cost += 40;
      if (overlap(r, words)) cost += 60;
      for (const o of spots) {
        if (o.id === openId || o.el.hidden) continue;
        const p = jn.toScreen(o.x, o.y);
        if (p.x > r.x0 - 26 && p.x < r.x1 + 26 && p.y > r.y0 - 26 && p.y < r.y1 + 26) cost += 25;
        const b = box(BOX[o.id]);
        cost += (lit.has(o.id) ? 18 : 8) * Math.min(1, overlap(r, b) / (0.15 * area(b)));
      }
      for (const id of lit) for (const p of POOL[id]) { const q = box(p); cost += 14 * Math.min(1, overlap(r, q) / Math.min(area(r), area(q))); }
      if (!best || cost < best.cost) best = { cost, cx, cy };
    }
    card.style.setProperty("--cx", `${Math.round(best.cx)}px`);
    card.style.setProperty("--cy", `${Math.round(best.cy)}px`);
  };
  // shown in its place: it moves there unseen, then rises in (a card never slides across the room)
  const reveal = (id, focus) => {
    if (openId !== id) return;
    fill(id);
    card.hidden = false;
    card.classList.add("jump");
    place();
    void card.offsetWidth;
    card.classList.remove("jump");
    card.classList.add("show");
    if (focus) lampSw.focus({ preventScroll: true });
  };
  const openCard = (id, { delay = 0, focus = false } = {}) => {
    const swap = openId && openId !== id && card.classList.contains("show");
    openId = id;
    closing++;
    spots.forEach((s) => s.el.classList.toggle("open", s.id === id));
    if (swap) card.classList.remove("show");
    jn.after(swap ? Math.max(delay, 0.26) : delay, () => reveal(id, focus));
  };
  function closeCard({ refocus = false } = {}) {
    if (!openId) return;
    const id = openId;
    openId = null;
    spots.forEach((s) => s.el.classList.remove("open"));
    card.classList.remove("show");
    const my = ++closing;
    jn.after(0.45, () => { if (!openId && my === closing) card.hidden = true; });
    if (refocus) { quiet = lit.has(id) ? null : id; spotById[id].btn.focus({ preventScroll: true }); }
  }
  $("card-close").addEventListener("click", () => closeCard({ refocus: true }));
  // the card's own switch: off, or on (bringing the evening if it is still day)
  lampSw.addEventListener("click", () => {
    if (!openId) return;
    if (lit.has(openId)) return setLamp(openId, false);
    token++;
    setLamp(openId, true, evening());
  });
  $("card-add").addEventListener("click", (e) => {
    if (!openId) return;
    bagged.add(openId);
    $("bag").textContent = bagged.size;
    e.currentTarget.textContent = "In your bag";
  });
  $("card-view").addEventListener("click", (e) => e.preventDefault());
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCard({ refocus: card.contains(document.activeElement) });
    if ((e.key === "l" || e.key === "L") && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && !e.target.closest?.("input, textarea, select")) sw.click();
  });
  // a click on the photo away from the card closes it
  stage.addEventListener("pointerdown", (e) => { if (openId && !card.contains(e.target) && !e.target.closest(".spot, .hit, .nav")) closeCard(); });

  // --- the title: as big as the calm wall allows, between the painting at the left edge and the lantern, under the
  // nav and above the branches. Each line runs as far as its own height allows: the top line up to the cord, the
  // lower one round the lantern and the glow it has at night. On a phone (or a tall window) the photo starts under a
  // band of page that holds the title. ---
  const layout = () => {
    const W = stage.clientWidth, H = stage.clientHeight;
    title.style.fontSize = lede.style.maxWidth = "";
    copy.style.left = copy.style.top = bagLink.style.marginRight = "";
    const focus = narrow.matches ? FOCUS.narrow : FOCUS.wide;
    if (jn.o.focus[0] !== focus[0]) return jn.setFocus(focus);     // emits resize, which lays out again
    const navBottom = rect(nav).y1;
    if (narrow.matches) {
      copy.style.top = `${navBottom + 14}px`;
      stage.style.setProperty("--band", `${Math.round(copy.offsetTop + copy.offsetHeight + 26)}px`);
      return;
    }
    stage.style.removeProperty("--band");
    const pad = parseFloat(getComputedStyle(nav).paddingLeft);
    const left = Math.max(pad, jn.toScreen(0.053, 0).x);           // clear of the painting at the far left
    const top = navBottom + Math.max(14, H * 0.025);
    const bottom = jn.toScreen(0, TALL(0.232)).y;                   // above the branches
    const c = jn.toScreen(LANTERN.x, LANTERN.y), e = jn.toScreen(LANTERN.x + LANTERN.rx, LANTERN.y + LANTERN.ry);
    const glow = Math.max(24, (e.x - c.x) * 0.3), rx = e.x - c.x + glow, ry = e.y - c.y + glow;
    const cord = jn.toScreen(CORD, 0).x - 26;
    const reach = (y0, y1) => {                                     // how far right a line spanning y0..y1 may run
      const dy = (Math.min(Math.max(c.y, y0), y1) - c.y) / ry;
      return Math.abs(dy) < 1 ? Math.min(cord, c.x - rx * Math.sqrt(1 - dy * dy)) : cord;
    };
    title.style.fontSize = "100px";
    const w = [0, 1].map((i) => Math.max(...[...title.children].map((v) => v.children[i]?.offsetWidth ?? 0)) / 100);
    lede.style.width = "max-content";
    const ledeW = lede.offsetWidth, lh = parseFloat(getComputedStyle(lede).lineHeight);
    lede.style.width = "";
    const rest = copy.offsetHeight - title.offsetHeight;           // the lede (one line) and its gap
    // the lede keeps clear of the lantern too: on one line, or on two when the lantern comes close (a 4:3 screen)
    const ledeLines = (s) => {
      const y = top + 1.9 * s;
      for (const n of [1, 2]) {
        if (y + rest + (n - 1) * lh > bottom) return 0;
        if (left + ledeW * (n === 1 ? 1 : 0.62) <= reach(y + rest - lh, y + rest + (n - 1) * lh)) return n;
      }
      return 0;
    };
    const fits = (s) => ledeLines(s) > 0 && w.every((wi, i) => left + wi * s <= reach(top + i * 0.95 * s, top + (i * 0.95 + 1.1) * s));
    let lo = 40, hi = Math.min(118, Math.max(52, W * 0.066));
    if (fits(hi)) lo = hi;
    else for (let k = 0; k < 16; k++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
    title.style.fontSize = `${lo.toFixed(1)}px`;
    if (ledeLines(lo) === 2) lede.style.maxWidth = `${Math.ceil(ledeW * 0.62)}px`;
    copy.style.left = `${left}px`;
    copy.style.top = `${top}px`;
    // plain nav text ends before the window (its glare and the dark curtain); only the frosted switch sits on it
    const over = rect(bagLink).x1 - (jn.toScreen(0.836, 0).x - 12);
    if (over > 0) bagLink.style.marginRight = `${over}px`;
  };
  const relayout = () => { layout(); sides(); place(); };
  jn.on("resize", relayout);
  narrow.addEventListener("change", relayout);
  document.fonts?.ready.then(relayout);
  relayout();

  // --- the clock follows the sun: 11:40 by day, 21:40 at night; hotspots light up as their lamps catch ---
  const clock = $("clock");
  const swaps = [...document.querySelectorAll(".copy .day, .copy .night")];
  let shown = "", mode = "";
  // screen readers get the copy that shows
  const syncCopy = () => {
    if (root.dataset.mode === mode) return;
    mode = root.dataset.mode;
    swaps.forEach((el) => el.toggleAttribute("aria-hidden", !el.classList.contains(mode)));
  };
  syncCopy();
  jn.on("change", () => {
    syncCopy();
    const m = Math.round(11 * 60 + 40 + jn.state.sun * 600);
    const t = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    if (t !== shown) clock.textContent = shown = t;
    for (const s of spots) {
      const on = jn.byId[s.id].level > 0.45;
      if (on === s.el.classList.contains("lit")) continue;
      s.el.classList.toggle("lit", on);
      s.btn.setAttribute("aria-label", `${BY[s.id].name}, ${BY[s.id].kind.toLowerCase()}${on ? ", lit: details" : ": switch it on"}`);
    }
  });

  // ?night opens on the whole evening (all five on); ?t=0.4 holds the sun
  startState(jn);
  if (jn.mode === "night") {
    PIECES.forEach((p) => lit.add(p.id));
    jn.set({ ambient: ambientFor(lit.size) });
  }
  window.lueur = { pick, allOn, morning, closeCard };
}
