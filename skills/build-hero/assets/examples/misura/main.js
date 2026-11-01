// Misura · the kitchen site: the build hero (engine/chantier.js) with its timeline, plus the small things below it:
// the nav's day/night state, one finish at a time, and the demo booking form.
import { mountBuild, reveal, clocks, clamp } from "../engine/chantier.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const STILL = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (new URLSearchParams(location.search).has("record")) document.documentElement.classList.add("is-record");
const pad2 = (n) => String(n).padStart(2, "0");
const spaced = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

// —— modules fitted: the wall's twelve go up while the oak panels fly to it (frames 29 → 57 of the film), the
// island's six while the butter boards hinge up (frames 82 → 97); frame i of 158 plays at p = 0.04 + (i - 1) / 157 × 0.7.
// The frames are every distinct frame of the Seedance take while things move, and only every fourth while the room
// stands still after the terrazzo lands (frames/manifest.json "src" lists the take's frames, 1-based, of 241) ——
const MODULES = [[0.1648, 0], [0.2897, 12], [0.4011, 12], [0.468, 18]];
function modulesAt(p) {
  if (p <= MODULES[0][0]) return 0;
  for (let k = 1; k < MODULES.length; k++) {
    const [p1, n1] = MODULES[k], [p0, n0] = MODULES[k - 1];
    if (p <= p1) return Math.floor(n0 + (n1 - n0) * clamp((p - p0) / (p1 - p0)) + 1e-6);
  }
  return 18;
}

// —— the build's own number formats ——
const formats = {
  // the counter gets p itself (data-from 0, data-to 1, data-at "0 1")
  modules: (p) => pad2(modulesAt(p)),
  // millimetres with a space for thousands, as on a drawing (4 800); rounded to 10 while the line draws
  mm: (v) => spaced(Math.round(v / 10) * 10),
  // the build runs 0 → 4: one unit per day on site
  day: (v) => pad2(Math.min(4, Math.floor(v + 1e-6) + 1)),
  // and each day runs 07:30 → 18:00, then starts again the next morning
  shift: (v) => {
    if (v >= 4 - 1e-6) return "18:00";
    const m = Math.round(450 + (v - Math.floor(v)) * 630);
    return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
  },
};

// —— the nav: its small name appears once the giant one has gone; paper type on a dark shade once evening has
// fallen on the film; a solid night bar while the lit hero scrolls away under it, then the paper bar ——
const nav = $("#nav"), build = $("#build");
let dusk = 0, navQueued = false;
function navState() {
  navQueued = false;
  const r = build.getBoundingClientRect();
  const p = clamp(-r.top / Math.max(1, r.height - innerHeight));
  const over = r.bottom > nav.offsetHeight;
  // on a phone the nav sits on the sheet, which is half dark at dusk .5; on wide screens it sits on the picture
  const night = over && dusk > (innerWidth < 760 ? 0.5 : 0.6);
  nav.classList.toggle("is-night", night);
  nav.classList.toggle("is-out", night && p > 0.999);
  nav.classList.toggle("has-mark", !over || p > 0.06);
  nav.classList.toggle("is-solid", !over);
}
addEventListener("scroll", () => { if (!navQueued) { navQueued = true; requestAnimationFrame(navState); } }, { passive: true });
addEventListener("resize", () => navState());
navState();

// —— captions: one per stage (data-cap="from to", in p). At a reading pace each fades in and rises with the scroll as
// its stage starts, and goes just before the next comes in, so two never overlap (the engine's data-ch-in fades are
// too slow for stages this short). A fast pass (the 3 s glide, or a flick: the scroll covering more than 0.15 of the
// hero a second, over the last quarter second) would flash all six in under two seconds, so then only the three big
// moves are named (data-cap-key: the wall going up, the island hinging up, the fittings), each picked for where the
// film will be a moment later and held at least 450 ms once in; there they fade by time (style.css: .hud-cap
// transitions) ——
const easeOut = (t) => 1 - (1 - t) ** 3;
const RECORD = document.documentElement.classList.contains("is-record");
const stageEl = $("#build .ch-stage");
const caps = $$(".hud-cap[data-cap]").map((el) => { const [a, b] = el.dataset.cap.trim().split(/\s+/).map(Number); return { el, a, b, key: el.hasAttribute("data-cap-key"), v: -1, y: 0, off: 0 }; });
const CAP_IN = 0.02, CAP_OUT = 0.012, CAP_RISE = 34;
const FAST = 0.15, FAST_FOR = 80, CALM = 0.07, SPAN = 250, CAP_FADE = 170, CAP_HOLD = 450, CAP_LOOK = 300;
let capFast = false, capNow = -1, capAt = -1e9, vel = 0, calmSince = 0, fastSince = -1, capLoop = false, hist = [];
function showCap(c, v, y) {
  if (v === c.v && y === c.y) return;
  c.v = v; c.y = y;
  c.el.style.opacity = v.toFixed(3);
  c.el.style.transform = `translateY(${y.toFixed(1)}px)`;
  c.el.classList.toggle("is-on", v > 0.01);
}
// a caption coming back in rises from below, not from where it last left
function fromBelow(c) {
  if (c.y === CAP_RISE) return;
  c.el.style.transition = "none";
  c.el.style.transform = `translateY(${CAP_RISE}px)`;
  void c.el.offsetWidth;
  c.el.style.transition = "";
  c.y = CAP_RISE;
}
const heroP = () => { const r = build.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - (stageEl?.clientHeight || innerHeight))); };
function captions(p) {
  const t = performance.now(), last = hist[hist.length - 1];
  if (!last || t - last.t > 6) {
    // the scroll speed in p a second: how far it went in the last quarter second (one notch of a mouse wheel stays
    // under FAST, a pass keeps above it); a jump (a link, ?p=, a screenshot) is no speed
    if (last && Math.abs(p - last.p) > 0.04) hist = [];
    hist.push({ t, p });
    while (hist.length > 1 && hist[1].t <= t - SPAN) hist.shift();
    const base = hist[0];
    vel = base.t <= t - SPAN ? ((p - base.p) / SPAN) * 1000 : 0;
  }
  const speed = Math.abs(vel);
  // from the top any scroll is the glide (the engine plays it), so there the pass starts as soon as the film moves
  if (speed <= FAST) fastSince = -1;
  else if (fastSince < 0) fastSince = t;
  const pass = (fastSince >= 0 && t - fastSince >= FAST_FOR) || (p < 0.05 && speed > 0.08);
  if (!capFast && pass && !RECORD && !STILL) {
    // carry on from the caption that is in, as if it had just come in
    let best = -1;
    caps.forEach((c, i) => { if (c.v > 0.5 && (best < 0 || c.v > caps[best].v)) best = i; });
    capFast = true; capNow = best; capAt = best < 0 ? -1e9 : t - CAP_FADE; calmSince = t;
    if (!capLoop) {
      // the film may come to rest before a caption has had its time: keep looking until the pass is over
      capLoop = true;
      const tick = () => { if (!capFast) { capLoop = false; return; } captions(heroP()); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
  }
  if (capFast) {
    if (speed > CALM) calmSince = t;
    else if (t - calmSince > 240 && t - capAt >= CAP_FADE + CAP_HOLD) capFast = false;
  }
  if (!capFast) {
    for (const c of caps) {
      const tin = clamp((p - c.a) / CAP_IN), tout = clamp((c.b - p) / CAP_OUT);
      showCap(c, Math.min(tin, tout), (1 - easeOut(tin)) * CAP_RISE - (1 - tout) * 12);
    }
    return;
  }
  // the key caption for where the film will be in a moment, else the one for where it is; between two key ones
  // the last one stays in
  const keyAt = (q) => caps.findIndex((c) => c.key && q >= c.a && q < c.b);
  let want = keyAt(p + (vel * CAP_LOOK) / 1000);
  if (want < 0) want = keyAt(p);
  if (want < 0) want = capNow >= 0 && caps[capNow].key ? capNow : -1;
  if (p < caps[0].a || p >= caps[caps.length - 1].b) want = -1;
  if (want !== capNow && t - capAt >= CAP_FADE + CAP_HOLD) { capNow = want; capAt = t; }
  // the scaffold comes down at dusk (style.css .hud > *), and so does a caption still being held then
  const hud = 1 - Math.min(1, dusk * 1.6);
  caps.forEach((c, i) => {
    if (i === capNow) { if (c.v <= 0.01) fromBelow(c); showCap(c, hud, 0); }
    else if (c.v > 0.01) { c.off = t; showCap(c, 0, -12); }
    else if (t - c.off > 320) showCap(c, 0, CAP_RISE);
  });
}
captions(0);
// a wrapped caption's box is as wide as its max-width, not its longest line: size each one to its words, so the
// paper shade behind it covers the text and as little of the picture as possible (wide screens; phones set it on paper)
function fitCaps() {
  const range = document.createRange();
  for (const { el } of caps) {
    el.style.width = "";
    if (innerWidth < 760) continue;
    let w = 0;
    for (const part of el.children) { range.selectNodeContents(part); for (const r of range.getClientRects()) w = Math.max(w, r.width); }
    if (w) el.style.width = `${Math.ceil(w) + 2}px`;
  }
}
fitCaps();
document.fonts?.ready.then(fitCaps);
addEventListener("resize", fitCaps);

// —— where the finished frame sits on wide screens: once the camera is down at the kitchen, it drifts a little so the
// whole wall of units is in view, as far from the left edge as the frame allows (it fills the film almost edge to
// edge: 32 → 1417 of 1600 px) and at least 16 px in from the right, so the dimension lines' ticks land on its ends.
// On screens wider than 16:9 (most laptop windows) the frame is cropped top and bottom: during the build the crop
// keeps the units' top clear of the nav for the drawing; as dusk falls and the drawing pulls back, it eases up so
// the island's plinth (y .80 of the frame) clears "Fitted." and its buttons ——
const FRAME = [1600, 900], WALL = [0.02, 0.8856], WALL_TOP = 0.0878, PLINTH = 0.8;
const smooth = (t) => t * t * (3 - 2 * t);
let fit = null;
function frameFit(w, h) {
  if (w < 760) return null;
  const s = Math.max(w / FRAME[0], h / FRAME[1]), fw = FRAME[0] * s, fh = FRAME[1] * s;
  const spareX = w - fw, spareY = h - fh, navH = 64;
  const fx = Math.min(0, w - 16 - fw * WALL[1]);
  const x = spareX > -1 || fx < spareX ? 0.5 : fx / spareX;
  if (spareY > -1) return { x, wall: 0.5, end: 0.5 };
  const wallY = Math.max(spareY / 2, Math.min(0, navH + 18 - fh * WALL_TOP));
  // where the end card's title starts (it sits at the bottom of the stage; the engine's rise doesn't move offsetTop)
  const end = $(".end"), title = $(".end-title");
  const titleTop = end && title ? end.offsetTop + title.offsetTop : h - 0.2 * h;
  const endY = Math.max(spareY, Math.min(wallY, titleTop - 28 - fh * PLINTH));
  return { x, wall: wallY / spareY, end: endY / spareY };
}
function focusAt(p) {
  if (!fit) return [0.5, 0.5];
  const y = fit.wall + (fit.end - fit.wall) * smooth(clamp((p - 0.76) / 0.11));
  if (fit.x === 0.5 && y === 0.5) return [[0, 0.5, 0.5]];
  return [[0, 0.5, 0.5], [0.5, 0.5, 0.5], [1, fit.x, y]];
}

// —— links within the page glide there (the hero's own glide only starts from a wheel or swipe at the top) ——
for (const a of $$('a[href^="#"]')) {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href").slice(1), el = id && document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    scrollTo({ top: id === "build" ? 0 : el.getBoundingClientRect().top + scrollY, behavior: STILL ? "auto" : "smooth" });
  });
}

// —— finishes: one at a time ——
const fin = $(".fin");
if (fin) {
  const pics = $$(".fin-pic", fin), texts = $$(".fin-text", fin), tabs = $$(".fin-tabs button", fin), num = $(".fin-i", fin), tbNum = $(".fin-tb-i", fin);
  let at = 0;
  const show = (i) => {
    at = (i + texts.length) % texts.length;
    pics.forEach((el, k) => el.classList.toggle("is-on", k === at));
    texts.forEach((el, k) => { el.classList.toggle("is-on", k === at); el.setAttribute("aria-hidden", String(k !== at)); });
    tabs.forEach((el, k) => el.setAttribute("aria-pressed", String(k === at)));
    num.textContent = pad2(at + 1);
    if (tbNum) tbNum.textContent = pad2(at + 1);
  };
  $$("[data-fin]", fin).forEach((b) => b.addEventListener("click", () => show(at + Number(b.dataset.fin))));
  tabs.forEach((b, k) => b.addEventListener("click", () => show(k)));
  show(0);
}

// —— book a design visit (a demo: nothing is sent) ——
const days = $("#days");
if (days) {
  const wd = new Intl.DateTimeFormat("en-GB", { weekday: "short" }), mo = new Intl.DateTimeFormat("en-GB", { month: "short" });
  const list = [], d = new Date();
  d.setHours(12, 0, 0, 0);
  while (list.length < 5) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) list.push(new Date(d)); }
  days.innerHTML = list.map((x, i) => `<button type="button" class="day" role="radio" aria-checked="${i === 1}" tabindex="${i === 1 ? 0 : -1}" data-label="${wd.format(x)} ${x.getDate()} ${mo.format(x)}"><small>${wd.format(x)}<span> · ${mo.format(x)}</span></small><b>${x.getDate()}</b></button>`).join("");
  const chips = $$(".day", days);
  const pick = (i, focus) => {
    chips.forEach((c, k) => { c.setAttribute("aria-checked", String(k === i)); c.tabIndex = k === i ? 0 : -1; });
    if (focus) chips[i].focus();
  };
  chips.forEach((c, i) => c.addEventListener("click", () => pick(i)));
  days.addEventListener("keydown", (e) => {
    const i = chips.indexOf(document.activeElement), step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (i < 0 || !step) return;
    e.preventDefault();
    pick((i + step + chips.length) % chips.length, true);
  });
}
// sizes read like a drawing: 4800 → 4 800, and the chosen plan is dimensioned with them as you type
const digits = (input) => input.value.replace(/\D/g, "").replace(/^0+/, "");
const planFigs = { width: $$(".plan-w"), depth: $$(".plan-d") };
for (const input of $$(".sizes input")) {
  const figs = planFigs[input.name];
  const live = () => {
    if (!figs) return;
    const n = digits(input);
    for (const el of figs) { el.textContent = n ? spaced(Number(n)) : input.placeholder; el.classList.toggle("is-typed", !!n); }
  };
  input.addEventListener("input", live);
  input.addEventListener("blur", () => { const n = digits(input); input.value = n ? spaced(Number(n)) : ""; live(); });
}
$("#book")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.currentTarget, out = $("#book-out");
  const shape = { straight: "straight", "l-shape": "L-shaped", "u-shape": "U-shaped", island: "island" };
  const layout = shape[$(`input[name="layout"]:checked`, f)?.value] ?? "new";
  const day = $(".day[aria-checked='true']", f)?.dataset.label ?? "a weekday";
  const w = digits(f.elements.width);
  // the note above the button already says it is a demo
  out.textContent = `Thank you. A designer would come on ${day} to measure your ${w ? `${spaced(Number(w))} mm ` : ""}${layout} kitchen.`;
});

// —— the build ——
// the counter's segment bar fills one segment per module, in step with the number
const segBar = $(".hud-segs");
let segLast = -1;
const segs = (p) => { const n = modulesAt(p); if (n !== segLast && segBar) { segLast = n; segBar.style.setProperty("--k", (n / 18).toFixed(4)); } };
// on a phone "Fitted." sits on the sheet below the film, not over it, so it can come in as the lights start
if (innerWidth < 760) { const end = $(".end"); if (end) end.dataset.chIn = "0.825"; }
reveal();
clocks();
let api = null, focusY = null;
// the frame eases up at dusk only where the screen is wider than 16:9; the engine draws it as evening falls (its own
// redraws run through the whole of dusk, so no extra redraw is needed)
function settle(p, opts) {
  if (!fit || fit.end === fit.wall) return;
  const f = focusAt(p), y = f[f.length - 1][2];
  if (y !== focusY) { focusY = y; opts.focus = f; }
}
fit = frameFit(innerWidth, stageEl?.clientHeight || innerHeight);
try {
  const opts = {
    frames: "frames",
    film: [0.04, 0.74],
    lit: { dusk: "img/dusk", src: "img/lit", at: [0.76, 0.92], split: 0.4, reveal: "sweep", noise: 0.2 },
    focus: focusAt(0),
    // on a phone the band is zoomed just enough that the finished island fits whole (frame x .139 → .848), centred
    phone: { mode: "band", zoom: 1.36, top: 0.12, focus: [[0, 0.5], [1, 0.476]] },
    // one scroll plays the build and comes to rest on the lit kitchen with "Fitted." fully in
    glide: 3000,
    glideTo: 0.95,
    formats,
    // (the engine's api is window.chantier from the start, before mountBuild returns: ?p= draws through it)
    onUpdate: (s) => { dusk = s.dusk; settle(s.p, (api ?? window.chantier)?.options ?? opts); navState(); captions(s.p); segs(s.p); },
  };
  api = await mountBuild(build, opts);
  addEventListener("resize", () => {
    fit = frameFit(innerWidth, stageEl?.clientHeight || innerHeight);
    focusY = null;
    api.options.focus = focusAt(api.p);
    api.redraw();
  });
} catch (err) {
  console.error(err);
}
