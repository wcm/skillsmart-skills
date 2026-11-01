// Deux Temps: one room, two times, and scroll is the clock. The sun leaves the café, then the pendants, the candles,
// the back bar and the stage come on, one after another. The page follows the room, never leads it: the framed day
// photo opens to full bleed as the light goes, the wordmark condenses and thickens with the daylight, and only once
// the room is blue does the night fall down the page like a horizon line, every word turning from espresso to cream
// exactly where it passes. Then the facts under the wordmark turn over line by line, each with its light.
import { bindTheme, shots, start } from "../engine/ui.js";
import { ease } from "../engine/jour-nuit.js";
import { roomSound } from "../engine/sound.js";

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ramp = (a, b, x) => clamp01((x - a) / (b - a));
const sstep = (a, b, x) => { const t = ramp(a, b, x); return t * t * (3 - 2 * t); };
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const root = document.documentElement;
const vars = {};
const css = (k, v) => { if (vars[k] !== v) { vars[k] = v; root.style.setProperty(k, v); } };   // only real changes restyle
const track = $("#track"), hero = $(".hero"), stage = $("#stage"), band = $(".band"), nav = $(".nav"), mark = $("#mark"), clock = $("#clock");
const cornerL = $("#cornerL"), cornerR = $("#cornerR"), tonight = $("#tonight"), evening = $("#evening"), say = $("#say");
const tagSlot = $("#tagSlot"), tagNight = $("#tagNight"), moreSlot = $("#moreSlot"), moreNight = $("#moreNight"), sound = $("#sound"), end = $(".end");
const radios = $$("#seg [role=radio]");
const flips = $$(".flip[data-at]").map((el) => ({ el, at: Number(el.dataset.at), on: null }));
const range2 = (s) => s?.split(" ").map(Number);
const shows = $$("[data-show]").map((el) => ({ el, show: range2(el.dataset.show), wide: range2(el.dataset.wide), state: null }));
// the small words the night line turns over as it passes their middle (the wordmark is cut by it: style.css)
const inked = $$(".links a, .now time, .sound > *, .facts .flip > *, .tagline.day > span, .more.day, .seg button").map((el) => ({ el, y: 0, nite: null }));
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const phone = matchMedia("(max-width: 760px)");
// wide screens: the photo is a wide band there, its bottom corners full of faces and candles at night, so the corners
// close at dusk and the evening's words move up beside the condensed wordmark. Below 1180px that room holds one block:
// Tonight takes the tagline's place when the stage comes up.
const wide = matchMedia("(min-width: 1180px), (min-width: 1000px) and (min-aspect-ratio: 7/5)");
const roomy = matchMedia("(min-width: 1180px)");

// --- the day, as a function of the scroll p: 0 is 07:30, 1 is 23:00 -------------------------------------------------
const AT = {
  sun: [0.02, 0.44],      // a short beat of blue hour after it, before the first lamps
  pendants: [0.48, 0.62], candles: [0.56, 0.7], bar: [0.64, 0.8], stage: [0.74, 0.9],
  ambient: [0.55, 0.92],
  type: [0.03, 0.45],     // the wordmark condenses and thickens as the daylight goes
  frame: [0.04, 0.36],    // the print opens to full bleed, before the night line passes behind it
  corners: [0.17, 0.32],  // wide screens: the corner cut-outs fold away with the morning lines
  edge: [0.25, 0.345, 0.38], // the night falls down the band once the room is mostly blue (sun ≈ .6 → .9), then
                          // drops behind the picture to the corners (sun ≈ .95)
  six: 0.233,             // the clock reads 18:00: Café | Bar turns over
  card: 0.865,            // Tonight, once the stage is up
};
// the clock races through the day, slows for the evening: golden hour near 18:00, blue hour at half past seven,
// 21:00 as the stage comes up
const HOURS = [[0, 7.5], [0.04, 7.75], [0.2, 17.5], [0.3, 19], [0.48, 19.75], [0.62, 20.25], [0.825, 21], [1, 23]];
// Archivo's D and S side bearings (em) at the two ends of the morph, so the ink lines up with the page edge
const BEAR = { day: [0.1125, 0.0668], night: [0.0459, 0.018] };
const LIGHTS = ["pendants", "candles", "bar", "stage"];

const lightsAt = (p) => ({
  sun: sstep(...AT.sun, p),
  ambient: inOut(ramp(...AT.ambient, p)),
  lights: Object.fromEntries(LIGHTS.map((id) => [id, inOut(ramp(...AT[id], p))])),
});
// how much of the night the room sound plays: a little with the blue hour, the rest as the lamps and the stage come up
const nightMix = (p) => { const L = lightsAt(p); return clamp01(0.25 * L.sun + 0.75 * LIGHTS.reduce((a, id) => a + L.lights[id], 0) / LIGHTS.length); };

function hour(p) {
  for (let i = 1; i < HOURS.length; i++) {
    const [p1, h1] = HOURS[i];
    if (p <= p1) { const [p0, h0] = HOURS[i - 1]; return lerp(h0, h1, ramp(p0, p1, p)); }
  }
  return HOURS[HOURS.length - 1][1];
}
const hhmm = (h) => { const m = Math.floor(h * 60 + 1e-6); return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };

// --- the photograph ----------------------------------------------------------------------------------------------
const canvas = $("#jn"), img = stage.querySelector("img");
const clipped = [canvas, img];
let jn = null;
const engine = start(canvas, {
  sets: { cafe: shots() },
  weights: ["img/weights0.png", "img/weights1.png"],
  widths: [1600],
  lights: [
    { id: "pendants", kind: "warm" },
    { id: "candles", kind: "candle", warmth: 0.5 },
    { id: "bar", kind: "fade" },
    { id: "stage", kind: "fade" },
  ],
  focus: [0.45, 0.3],
  sunFrom: [0, 0.35],
  gold: 0.8,
  vignette: 0.2,
}, {
  fallback: () => {
    // no WebGL2: the night picture crossfades over the day one (engine/ui.css)
    const night = Object.assign(document.createElement("img"), { className: "jn-night", src: "img/night-1600.webp", alt: "" });
    img.after(night);
    clipped.push(night);
    night.style.clipPath = lastClip;
  },
});

// --- the outline: a print with rounded corners on the page by day, full bleed by night. The two bottom corners are
// cut out of the photo, so the words there sit on the page, not on a face or a light. -----------------------------
const R_PRINT = 9, R_NOTCH = 12;
let geo = null, lastClip = "";

function roundPath(pts) {
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const [px, py] = pts[(i + n - 1) % n], [x, y, r0] = pts[i], [nx, ny] = pts[(i + 1) % n];
    const lin = Math.hypot(x - px, y - py) || 1, lout = Math.hypot(nx - x, ny - y) || 1;
    const r = Math.max(0, Math.min(r0, lin / 2, lout / 2));
    const a = [x + ((px - x) / lin) * r, y + ((py - y) / lin) * r], b = [x + ((nx - x) / lout) * r, y + ((ny - y) / lout) * r];
    const turn = (x - px) * (ny - y) - (y - py) * (nx - x);   // > 0: a convex corner (the path runs clockwise)
    d += `${i ? "L" : "M"}${a[0].toFixed(1)} ${a[1].toFixed(1)}`;
    if (r > 0.05) d += `A${r.toFixed(2)} ${r.toFixed(2)} 0 0 ${turn > 0 ? 1 : 0} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
  }
  return `${d}Z`;
}

function outline(W, H, m, ro, L, R) {
  const pts = [[m, 0, ro], [W - m, 0, ro]];
  if (R) pts.push([W - m, H - R.h, ro], [W - R.w, H - R.h, R_NOTCH], [W - R.w, H - m, ro]);
  else pts.push([W - m, H - m, ro]);
  if (L) pts.push([L.w, H - m, ro], [L.w, H - L.h, R_NOTCH], [m, H - L.h, ro]);
  else pts.push([m, H - m, ro]);
  return roundPath(pts);
}

// layout positions, read once per layout (never per frame)
const yIn = (el) => { let y = 0; for (let e = el; e && e !== hero; e = e.offsetParent) y += e.offsetTop; return y; };
function measure() {
  const s = stage.getBoundingClientRect();
  const cut = (el, left) => {
    if (!el.offsetParent) return null;
    const r = el.getBoundingClientRect();
    return { w: left ? r.right - s.left : s.right - r.left, h: s.bottom - r.top };
  };
  const H = hero.clientHeight;
  geo = {
    W: s.width, H: s.height, heroH: H, pad: parseFloat(getComputedStyle(band).paddingLeft) || 16,
    soft: Math.round(Math.min(18, Math.max(10, H * 0.016))), band: band.offsetHeight,
    L: cut(cornerL, true), R: cut(cornerR, false), nav: [yIn(nav), yIn(nav) + nav.offsetHeight],
    card: { w: tonight.offsetWidth, h: tonight.offsetHeight, in: tonight.parentElement === cornerL },
  };
  css("--soft", `${geo.soft}px`);
  mark.style.setProperty("--y", `${yIn(mark)}px`);
  for (const w of inked) { w.y = yIn(w.el) + w.el.offsetHeight / 2; w.nite = null; }
}

let frameK = 0, shutK = 0, cardK = 0;
function drawOutline() {
  if (!geo) return;
  const { W, H, pad, L, R, card } = geo;
  const m = lerp(pad, 0, frameK), ro = lerp(R_PRINT, 0, frameK), c = inOut(cardK), k = 1 - shutK;
  // when Tonight sits in the corner (narrow screens), the cut grows round it as it arrives
  let Lc = L && (card.in ? { w: lerp(L.w, Math.max(L.w, card.w + pad + 22), c), h: L.h + c * (card.h + 14) } : { ...L });
  let Rc = R && { ...R };
  // wide screens: the cuts shrink into their corners, so the night has the whole picture
  for (const C of [Lc, Rc]) if (C) { C.w *= k; C.h *= k; }
  if (Lc && (Lc.w < m + 2 || Lc.h < m + 2)) Lc = null;
  if (Rc && (Rc.w < m + 2 || Rc.h < m + 2)) Rc = null;
  const v = `path("${outline(W, H, m, ro, Lc, Rc)}")`;
  if (v !== lastClip) { lastClip = v; for (const el of clipped) el.style.clipPath = v; }
}

// --- the wordmark's ink fills the band's width at its widest and lightest -------------------------------------------
function fitMark() {
  const probe = mark.cloneNode(true);
  probe.removeAttribute("id");
  Object.assign(probe.style, { position: "absolute", visibility: "hidden", left: "0", top: "0", margin: "0", fontSize: "100px", fontStretch: "125%", fontWeight: "300" });
  band.appendChild(probe);
  const w = probe.getBoundingClientRect().width;
  probe.remove();
  const cs = getComputedStyle(band);
  const avail = band.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const ink = w - (BEAR.day[0] + BEAR.day[1] - 0.012) * 100;   // the box less the side bearings and the last letter's spacing
  if (ink > 0) css("--mark-size", `${((avail / ink) * 100).toFixed(2)}px`);
}

// --- everything that follows the clock -----------------------------------------------------------------------------
let isBar = null, isNight = null, cardWant = 0, applying = false;
const ALT = [
  "A café in morning sun: arched windows, a man reading at a marble table, a barista at the espresso machine, an empty stage with a piano and a double bass",
  "The same room at night: pendants and candles lit, a full bar, and a trio on the lit stage, singer, piano and double bass",
];
function apply(p, { instant = false } = {}) {
  const L = lightsAt(p);
  applying = true;
  if (jn) jn.set(L);   // fires "change": the house variables and the page's own light follow
  else theme(p, L.sun);
  applying = false;
  const k = sstep(...AT.type, p);
  css("--wdth", lerp(125, 62, k).toFixed(2));
  css("--wght", lerp(300, 800, k).toFixed(1));
  css("--lsb", `${lerp(BEAR.day[0], BEAR.night[0], k).toFixed(4)}em`);
  const bar = p >= AT.six;
  if (bar !== isBar) {
    isBar = bar;
    css("--seg", bar ? "1" : "0");   // the thumb slides over in half a second (style.css), however fast the scroll
    radios.forEach((b, i) => { const on = (i === 1) === bar; b.setAttribute("aria-checked", on); b.tabIndex = on ? 0 : -1; });
  }
  const t = hhmm(hour(p));
  if (clock.textContent !== t) clock.textContent = t;
  for (const f of flips) {
    const on = p >= f.at;
    if (on === f.on) continue;
    f.on = on;
    f.el.classList.toggle("on", on);
    const [a, b] = f.el.children;   // only the line that shows is read out
    a.setAttribute("aria-hidden", on); b.setAttribute("aria-hidden", !on);
  }
  for (const s of shows) {
    const [a, b] = (wide.matches && s.wide) || s.show;
    const state = p < a ? -1 : p >= b ? 1 : 0;   // before its stretch, up, or past it
    if (state === s.state) continue;
    s.state = state;
    s.el.classList.toggle("in", state === 0);
    s.el.classList.toggle("past", state === 1);
    s.el.inert = state !== 0;   // a line that is not up is neither read out nor focused
  }
  const night = p >= 0.5;
  if (night !== isNight) { isNight = night; img.alt = ALT[night ? 1 : 0]; }
  frameK = sstep(...AT.frame, p);
  shutK = wide.matches ? inOut(ramp(...AT.corners, p)) : 0;
  const want = p >= AT.card ? 1 : 0;
  if (want !== cardWant || instant) { cardWant = want; card(want, instant); }
  drawOutline();
}

// the page's light: a golden hour with the photo's, then the night line falling from the top
function theme(p, sun) {
  const H = geo?.heroH ?? innerHeight, soft = geo?.soft ?? 14, B = (geo?.band ?? H * 0.35) + soft;
  const [e0, e1, e2] = AT.edge;
  // slow over the nav and the wordmark; then quick behind the photo, where only the corners can see it
  const edge = p < e1 ? lerp(-soft - 2, B, Math.pow(ramp(e0, e1, p), 1.4)) : lerp(B, H + soft + 2, ramp(e1, e2, p));
  const fall = ramp(e0, e2, p);
  const [n0, n1] = geo?.nav ?? [10, 50];
  css("--edge", `${edge.toFixed(1)}px`);
  for (const w of inked) { const n = edge > w.y; if (n !== w.nite) { w.nite = n; w.el.classList.toggle("nite", n); } }
  css("--gold", (Math.sin(clamp01(sun * 1.35) * Math.PI) * 0.75).toFixed(4));
  css("--page", fall.toFixed(4));
  css("--veil", sstep(0.36, 0.5, p).toFixed(4));
  css("--warm", (0.35 + 0.65 * sstep(0.47, 0.75, p)).toFixed(4));   // blue hour, then the lamps
  css("--cue", (1 - ramp(0.004, 0.03, p)).toFixed(4));
  // the house --flip (body ink) and data-mode (the no-WebGL night picture) follow the line too: written every time,
  // since the house bindTheme writes its own on each change of the engine
  root.style.setProperty("--flip", ramp(n0 - 6, n1 + 6, edge).toFixed(4));
  root.dataset.mode = fall > 0.5 ? "night" : "day";
}

// Tonight: a fade on the engine's clock (so a ?record capture steps it frame by frame)
const CARD_IN = 0.6, CARD_OUT = 0.4;
function showCard(k) {
  cardK = k;
  css("--card", inOut(k).toFixed(4));
  tonight.setAttribute("aria-hidden", k < 0.5 ? "true" : "false");
  say.inert = evening.classList.contains("compact") && k >= 0.5;
  if (geo?.card.in) drawOutline();
}
function card(want, instant) {
  if (!jn || instant || reduced.matches) { jn?.tween("card", want, { duration: 0 }); showCard(want); return; }
  jn.state.card ??= cardK;
  jn.tween("card", want, { duration: Math.abs(want - jn.state.card) * (want ? CARD_IN : CARD_OUT), ease: ease.linear });
}

// --- scroll: read it, follow it softly (so trackpad steps never jump) -------------------------------------------------
let target = 0, cur = 0, raf = 0, last = 0, gliding = false;
const range = () => Math.max(1, track.offsetHeight - innerHeight);
const read = () => clamp01((scrollY - track.offsetTop) / range());
const posOf = (p) => track.offsetTop + p * range();

function tick(t) {
  raf = 0;
  const dt = last ? Math.min(0.1, (t - last) / 1000) : 1 / 60;
  last = t;
  const follow = reduced.matches ? 1 : 1 - Math.pow(1 - 0.12, dt * 60);
  cur += (target - cur) * follow;
  if (Math.abs(target - cur) < 1e-4) cur = target;
  apply(cur);
  if (cur !== target) raf = requestAnimationFrame(tick);
  else last = 0;
}
const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
addEventListener("scroll", () => {
  if (gliding) stopGlide(false);   // the user took the scrollbar mid-glide: follow them
  target = read();
  kick();
}, { passive: true });

// Café | Bar: a click plays the evening (or the morning) straight through, then leaves the page scrolled there. The
// glide is a tween on the engine's clock (so ?record steps it too); it scrolls once at the end, invisibly (the hero is
// pinned): scrolling the window on every frame can make a pinned element trail the scroll by a frame or two.
function stopGlide(sync) {
  if (!gliding) return;
  gliding = false;
  jn?.tween("p", cur, { duration: 0 });
  if (sync) scrollTo(0, posOf(cur));   // the wheel takes over from where the glide was
}
function glide(toP) {
  stopGlide(false);
  // the footer is in view, no engine, or no motion wanted: just scroll there
  if (!jn || scrollY > posOf(1) + 1 || reduced.matches) { scrollTo({ top: posOf(toP), behavior: reduced.matches ? "instant" : "smooth" }); return; }
  if (Math.abs(toP - cur) < 1e-3) return;
  // the whole day in about 3.4 s: a soft start, a steady middle (the sun ~1.5 s, then the lamps), a soft landing
  const dur = Math.min(3.4, 0.9 + 2.5 * Math.abs(toP - cur));
  gliding = true;
  jn.state.p = cur;
  jn.tween("p", toP, { duration: dur, ease: ease.brisk }).then(() => {
    if (!gliding) return;
    gliding = false;
    scrollTo(0, posOf(toP));
    target = cur = toP;
  });
}
for (const ev of ["wheel", "touchstart", "keydown"]) addEventListener(ev, (e) => { if (gliding && !(ev === "keydown" && e.target.closest?.("#seg"))) stopGlide(true); }, { passive: true });
radios.forEach((b) => {
  b.addEventListener("click", () => glide(Number(b.dataset.to)));
  b.addEventListener("keydown", (e) => {
    const dir = { ArrowLeft: 0, ArrowUp: 0, ArrowRight: 1, ArrowDown: 1 }[e.key];
    if (dir === undefined) return;
    e.preventDefault();
    radios[dir].focus();
    glide(dir);
  });
});

// for recording: jump straight to a moment of the day (Tonight and the line swaps still play out on the clock)
window.progress = (p, { instant = false } = {}) => {
  p = clamp01(Number(p) || 0);
  stopGlide(false);
  scrollTo(0, posOf(p));
  target = cur = p;
  apply(p, { instant });
};

// --- layout ---------------------------------------------------------------------------------------------------------
const relayout = () => { fitMark(); measure(); apply(cur); };
// wide screens: the evening's lines and Tonight sit in the band. Narrower ones keep them in the corner: Tonight joins
// the tagline there; on phones the menu link and the sound go there too (the nav and the right corner have no room).
const row = Object.assign(document.createElement("div"), { className: "links-row" });
function place() {
  if (wide.matches) { say.append(tagNight, moreNight); evening.append(tonight); }
  else { tagSlot.append(tagNight); moreSlot.append(moreNight); cornerL.prepend(tonight); }
  if (phone.matches) { row.append(moreSlot, sound); cornerL.append(row); }
  else { cornerR.append(moreSlot); end.prepend(sound); row.remove(); }
  evening.hidden = !wide.matches;
  evening.classList.toggle("compact", wide.matches && !roomy.matches);
  for (const s of shows) s.state = null;   // thresholds differ between the two layouts
}
for (const mq of [phone, wide, roomy]) mq.addEventListener("change", () => { place(); relayout(); });
place();
new ResizeObserver(() => { measure(); apply(cur); }).observe(stage);
addEventListener("resize", relayout);
// the wordmark is measured in its own face: wait for it (one variable file covers every width and weight)
document.fonts?.load('300 expanded 100px "Archivo"', "DEUX TEMPS").then(relayout, () => {});
document.fonts?.ready.then(relayout);
relayout();

const q = new URLSearchParams(location.search);
const startAt = q.has("night") ? 1 : q.has("t") ? Number(q.get("t")) : null;
if (startAt !== null) window.progress(startAt, { instant: true });
else { target = cur = read(); apply(cur, { instant: true }); }

jn = await engine;
if (jn) {
  // the house variables (--sun, --lit, --night) follow the engine; the page's own light is set in theme(). The glide
  // and Tonight are tweens on the engine too: their values arrive here, frame by frame.
  bindTheme(jn);
  jn.on("change", (s) => {
    if (gliding && !applying && s.p !== cur) { target = cur = s.p; apply(cur); }
    if (s.card !== undefined && s.card !== cardK) showCard(s.card);
    theme(cur, s.sun);
  });
  const syncImg = () => {
    const { vw, vh, ox, oy } = jn.view;
    img.style.objectPosition = `${vw < 1 ? (ox / (1 - vw)) * 100 : 50}% ${vh < 1 ? (oy / (1 - vh)) * 100 : 50}%`;
  };
  jn.on("resize", syncImg);
  syncImg();
  apply(cur, { instant: true });
}

// room sound, off until asked: a quiet morning café, then a live set coming up with the lamps
roomSound(jn ?? { state: {} }, sound, { day: "audio/day.mp4", night: "audio/night.mp4", mix: () => nightMix(cur), volume: 0.7 });
