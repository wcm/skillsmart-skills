// Tidelight: the tower rises on a river bend in a tropical city as the page scrolls, floor by floor, then blue hour
// falls and its windows light up from the ground up. Below the film: four plans, the neighbourhood, the sky garden and
// a demo sign-up.
//   chapters      one line at a time in the chapter card, switched on each stage's tick of the stage ruler
//   floor ruler   one tick per floor down the right edge; the amber band rides the top floor standing in the film
//                 (counted off its frames), and at lights-on each tick switches on amber when its floor does in the film
//   residences    a pill switch redraws a line plan, its bubble and the floor rail
//   location      three distances count up once, as they come into view
import { mountBuild, reveal, clamp } from "../engine/chantier.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const STILL = matchMedia("(prefers-reduced-motion: reduce)").matches;
const RECORD = new URLSearchParams(location.search).has("record");
const FLOORS = 48, STOREY = 3.5;
const pad2 = (n) => String(n).padStart(2, "0");
const smooth = (t) => t * t * (3 - 2 * t);

// —————————————————— the build ——————————————————

// the six stages, where each starts in p (FILM[0] + TIME's stage starts × the film's length); the film runs
// [0.04, 0.74]. The title leaves 0.012 → 0.038 and the chapter card comes in at 0.04 with line 01, which holds to
// 0.135: about a quarter of a second in the 3 s glide, like the lines after it.
const STAGES = [0.04, 0.135, 0.229, 0.334, 0.474, 0.593], FILM = [0.04, 0.74], CARD_IN = 0.04;

// The film (three Kling segments, 13 s, 313 frames at 24 fps) spends two thirds of a second on the raft and the first
// slab and most of its time on the glass and the finish, so condo/frames are retimed to give every stage a fairer
// share of the scroll: TIME maps the frames' film share to the source film's, a monotone cubic through the stage
// starts (its frames 0, 16, 30, 54, 150 and 216 of 312: the raft with the crane on the core stub, the first slab
// lifted in its yellow screen, two floors standing, glass on the lowest floors, the crane climbing out of the frame,
// the roof canopy coming into view), plus 288, where the podium is done and only the camera still moves. The drone's
// big move (the first segment, frames 0–120: it sinks, tilts up and swings round) gets about 55% of the film's scroll.
// The frames were exported with the same map by tools/frames.mjs ("retime" in the scene file), so keep the two together.
const TIME = [[0, 0], [0.135, 16 / 312], [0.27, 30 / 312], [0.42, 54 / 312], [0.62, 150 / 312], [0.79, 216 / 312], [0.95, 288 / 312], [1, 1]];
function monotone(keys) {
  const X = keys.map((k) => k[0]), Y = keys.map((k) => k[1]), n = X.length, d = [], m = [];
  for (let k = 0; k < n - 1; k++) d.push((Y[k + 1] - Y[k]) / (X[k + 1] - X[k]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) m[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
  for (let k = 0; k < n - 1; k++) {
    const a = m[k] / d[k], b = m[k + 1] / d[k], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[k] = t * a * d[k]; m[k + 1] = t * b * d[k]; }
  }
  return (x) => {
    if (x <= X[0]) return Y[0];
    if (x >= X[n - 1]) return Y[n - 1];
    let k = 0; while (x > X[k + 1]) k++;
    const h = X[k + 1] - X[k], t = (x - X[k]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * Y[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * Y[k + 1] + (t3 - t2) * h * m[k + 1];
  };
}
const sourceAt = monotone(TIME);

// floors standing at each point of the source film (its frame of 312 → floors), measured off its frames: the top
// slab's height over the ground in floor heights (each frame's own floor pitch), against the finished tower, which is
// 48 of them from the ground to the roof canopy, podium included. The first slab lifts off the raft at frame 12, one
// floor stands at 24, two at 30, eight at 60, twenty at 96 and 24 at the cut to the "top" segment (120); slabs keep
// stacking until the top leaves the frame (212, about 42), and the roof is on when it comes back into view (226).
const RISE = [[0, 0], [12, 0], [16, 0.3], [24, 1], [30, 2], [40, 4], [50, 6], [60, 8], [72, 12], [84, 16], [96, 20], [108, 22],
  [120, 24], [150, 29], [172, 33], [192, 36.5], [204, 40], [216, 43], [226, 48], [312, 48]].map(([f, n]) => [f / 312, n]);
function floorsAt(film) {
  const f = sourceAt(film);
  for (let k = 1; k < RISE.length; k++) {
    const [t0, v0] = RISE[k - 1], [t1, v1] = RISE[k];
    if (f <= t1) return v0 + (v1 - v0) * clamp((f - t0) / (t1 - t0));
  }
  return FLOORS;
}

// what each level holds (214 homes): 6 homes a floor up to 25, 4 on 26–29, the double-height sky garden on 30–31
// (two thirds up, where it stands in the film), 4 homes on 32–41, 3 on 42–47, two penthouses on 48
const usd = (v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, "")}M` : `$${Math.round(v / 1000)}k`);
function level(n) {
  if (n <= 0) return "Lobby and river café";
  if (n === 1) return "Residents’ gym and lounge";
  if (n === 2) return "Podium garden";
  if (n === 30 || n === 31) return "Sky garden and pool";
  if (n >= 48) return "2 penthouses · from $4.6M";
  if (n <= 25) return `6 homes · from ${usd(980000 + (n - 3) * 18000)}`;
  if (n <= 41) return `4 homes · from ${usd(1290000 + (n - 3) * 21000)}`;
  return `3 homes · from ${usd(1940000 + (n - 26) * 30000)}`;
}

// the ruler's 48 ticks, one per floor
const scale = $(".js-scale");
const ticks = [];
for (let i = 1; i <= FLOORS; i++) {
  const el = document.createElement("i");
  el.className = "tick" + (i % 4 === 0 ? " is-major" : "");
  el.style.setProperty("--y", ((i - 0.5) / FLOORS).toFixed(4));
  if (i % 4 === 0) el.dataset.n = pad2(i);
  scale.append(el);
  ticks.push({ el, i, orders: [], on: -1, built: null, near: null });
}

// At lights-on each tick switches on when its floor does in the film. The engine lights the evening picture in an
// order (reveal "rise", noise .35 on a 9-cell value-noise field, soft edge .22); this is that same order, read where
// the tower stands in the frame: five points across its width at each floor's height. On the last frame (and the
// dusk and lit pictures fitted to it) the tower spans x 1101–1328 of the film's 1920 and its floors y .042–.778 of
// the height, from the podium's green roof (y 840) to the roof canopy (y 45); the phone frames are its 760-wide
// window from x 760.
const LIT = { noise: 0.35, cells: 9, soft: 0.22 }, TOWER_V = [0.042, 0.778];
function noiseField(w, h, cells) {
  const gw = Math.ceil(cells * (w / h)) + 2, gh = cells + 2, g = new Float32Array(gw * gh);
  let s = 1234567;
  for (let i = 0; i < g.length; i++) { s = (s * 16807) % 2147483647; g[i] = s / 2147483647; }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = (x / w) * (gw - 2), gy = (y / h) * (gh - 2), x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = smooth(gx - x0), fy = smooth(gy - y0), at = (i, j) => g[j * gw + i];
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx, bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
    out[y * w + x] = top + (bot - top) * fy;
  }
  let lo = 1, hi = 0;
  for (const v of out) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / (hi - lo || 1);
  return out;
}
let ordersFor = null;
function litOrders() {
  const phone = innerWidth < 760;
  if (ordersFor === phone) return;
  ordersFor = phone;
  const [fw, fh] = phone ? [760, 1080] : [1920, 1080], [u0, u1] = phone ? [0.4487, 0.7474] : [0.5734, 0.6917];
  const MW = 160, MH = Math.round((160 * fh) / fw), nz = noiseField(MW, MH, LIT.cells);
  for (const t of ticks) {
    const v = TOWER_V[1] - ((t.i - 0.5) / FLOORS) * (TOWER_V[1] - TOWER_V[0]), y = Math.round(v * (MH - 1));
    t.orders = Array.from({ length: 5 }, (_, j) => {
      const x = Math.round((u0 + ((u1 - u0) * (j + 0.5)) / 5) * (MW - 1));
      return (1 - y / (MH - 1)) * (1 - LIT.noise) + nz[y * MW + x] * LIT.noise;
    });
  }
}
litOrders();
addEventListener("resize", litOrders);

const floorsEl = $(".floors"), head = $(".js-floors-head"), tag = $(".js-tag"), lv = $(".js-lv"), note = $(".js-lv-note");
const floorNum = $(".js-floor"), chaps = $$(".chap"), heights = $$(".js-height"), segs = $(".js-segs");
let shownFloor = -1, shownHead = "", chapOn = -2;

// the chapter card: one line at a time, switched on the stage ruler's tick (the next rises in as this one lifts away).
// ?record captures frame by frame, so there the switch follows p instead of the clock: the old line leaves over
// 0.005 of p and the new one rises in over the next 0.012.
function chapter(p) {
  let i = -1;
  if (p >= CARD_IN) STAGES.forEach((s, k) => { if (p >= s) i = k; });
  if (RECORD) {
    const at = i < 0 ? 1 : Math.max(STAGES[i], CARD_IN), tin = i <= 0 ? 1 : smooth(clamp((p - at - 0.004) / 0.012)), tout = 1 - clamp((p - at) / 0.005);
    chaps.forEach((c, k) => {
      const v = k === i ? tin : k === i - 1 ? tout : 0;
      c.style.transition = "none";
      c.style.opacity = v.toFixed(3);
      c.style.transform = `translateY(${k === i ? ((1 - tin) * 26).toFixed(1) : k < i ? -((1 - tout) * 18).toFixed(1) : 26}px)`;
    });
    return;
  }
  if (i === chapOn) return;
  chapOn = i;
  chaps.forEach((c, k) => { c.classList.toggle("is-on", k === i); c.classList.toggle("was-on", k < i); });
}

// —— the nav reads the page under it: ink on the sky and the light sections, paper once dusk falls or over ink ——
const nav = $(".nav"), hero = $("#build"), toned = $$("main > section[data-tone], footer[data-tone]").filter((s) => s !== hero);
let heroDark = false;
function navTone() {
  const y = 34, hb = hero.getBoundingClientRect().bottom;
  let tone = "light";
  if (hb > y) tone = heroDark ? "dark" : "light";
  else for (const s of toned) { const r = s.getBoundingClientRect(); if (r.top <= y && r.bottom > y) { tone = s.dataset.tone; break; } }
  if (nav.dataset.tone !== tone) nav.dataset.tone = tone;
  // the backing goes on as soon as the pinned stage starts to leave, so the end card can pass under the nav
  nav.toggleAttribute("data-solid", hb < innerHeight - 1);
}
addEventListener("scroll", navTone, { passive: true });

function onUpdate({ p, film, dusk, lit }) {
  const f = floorsAt(film), n = Math.min(FLOORS, Math.floor(f + 0.05));
  floorsEl.style.setProperty("--f", (f / FLOORS).toFixed(4));
  floorsEl.classList.toggle("is-low", f < 1.6 && dusk < 0.5);
  // the ruler comes in once the title has gone
  floorsEl.style.opacity = clamp((p - 0.05) / 0.03).toFixed(3);
  chapter(p);
  if (n !== shownFloor) {
    shownFloor = n;
    floorNum.textContent = pad2(n);
    segs.style.setProperty("--k", (n / FLOORS).toFixed(4));
    for (const el of heights) el.textContent = String(Math.round(n * STOREY)).padStart(3, "0");
    tag.textContent = pad2(n);
    lv.textContent = `Level ${pad2(n)} · ${Math.round(n * STOREY)} m`;
    note.textContent = level(n);
  }
  // built floors stand bright, and the number beside the amber band steps aside; at lights-on each floor switches
  // on amber in the film's own order
  const reach = lit * (1 + LIT.soft);
  let litCount = 0;
  for (const t of ticks) {
    const built = t.i <= n, near = dusk < 0.5 && Math.abs(t.i - 0.5 - f) < 1.6;
    if (built !== t.built) { t.el.classList.toggle("is-built", built); t.built = built; }
    if (near !== t.near) { t.el.classList.toggle("is-near", near); t.near = near; }
    let a = 0;
    if (lit > 0) { for (const o of t.orders) a += smooth(clamp((reach - o) / LIT.soft)); a /= t.orders.length; }
    if (Math.abs(a - t.on) > 0.01 || (a !== t.on && (a === 0 || a === 1))) { t.el.style.setProperty("--on", a.toFixed(3)); t.on = a; }
    if (a > 0.5) litCount++;
  }
  const h = lit > 0 ? `Lit ${pad2(litCount)}/48` : "";
  if (h !== shownHead) { head.textContent = h; shownHead = h; }
  heroDark = dusk > 0.45;
  navTone();
}

// —————————————————— 01 residences ——————————————————

// each plan: the flat glass façade on top (the tower is a softened rectangle with flat glass faces; the penthouse
// takes the whole floor plate, a rectangle with rounded corners), the corridor wall at the back with the front door;
// walls run to "f", the façade. Door: hinge x, y, leaf length, closed and open angles (0° east, 90° south). Keys mark
// the rooms in the legend.
const PLANS = {
  one: {
    unit: "No. 0704", type: "1 bedroom", area: 58, price: "from $980,000", levels: "Levels 03–25", left: 44, total: 63, floor: 7, range: [3, 25], view: [81, 68, 479, 329],
    shape: { kind: "arc", L: 150, R: 490, y: 123, c: 123, back: 372, entry: [354, 392] },
    walls: [[350, "f", 350, 292], [350, 292, 360, 292], [396, 292, 490, 292], [400, 292, 400, 302], [400, 336, 400, 372]],
    doors: [[396, 292, 36, 180, 270], [400, 336, 34, 270, 360], [392, 372, 38, 180, 270]],
    furn: [["rect", 160, 338, 150, 30], ["rect", 190, 344, 36, 18, 5], ["circle", 264, 347, 4.5], ["circle", 284, 347, 4.5], ["circle", 264, 360, 4.5], ["circle", 284, 360, 4.5],
      ["rect", 178, 250, 100, 36, 5], ["line", 182, 276, 274, 276], ["rect", 204, 206, 48, 26, 3],
      ["circle", 298, 196, 19], ["circle", 298, 168, 6], ["circle", 298, 224, 6], ["circle", 326, 196, 6], ["circle", 270, 196, 6],
      ["rect", 396, 166, 84, 66, 4], ["rect", 466, 172, 10, 24, 3], ["rect", 466, 202, 10, 24, 3], ["line", 434, 166, 434, 232],
      ["rect", 408, 264, 78, 22], ["line", 412, 275, 482, 275],
      ["rect", 446, 296, 40, 40], ["line", 446, 296, 486, 336], ["ellipse", 470, 356, 7, 9], ["rect", 406, 348, 26, 20, 5]],
    balcony: [176, 330, 30],
    keys: [[232, 162, "01"], [438, 151, "02"], [448, 352, "03"], [252, 112, "04"]],
    legend: [["01", "Living and kitchen", "31 m²"], ["02", "Bedroom", "13 m²"], ["03", "Bathroom", "5 m²"], ["04", "Balcony", "8 m²"]],
  },
  two: {
    unit: "No. 1804", type: "2 bedrooms", area: 86, price: "from $1,290,000", levels: "Levels 03–41", left: 53, total: 97, floor: 18, range: [3, 41], view: [74, 67, 492, 338],
    shape: { kind: "arc", L: 110, R: 530, y: 120, c: 120, back: 380, entry: [412, 446] },
    walls: [[226, "f", 226, 270], [110, 270, 184, 270], [218, 270, 226, 270], [176, 270, 176, 300], [176, 332, 176, 380],
      [404, "f", 404, 280], [404, 280, 412, 280], [446, 280, 530, 280], [454, 280, 454, 300], [454, 334, 454, 380]],
    doors: [[218, 270, 34, 180, 270], [176, 332, 32, 270, 360], [446, 280, 34, 180, 270], [454, 334, 34, 270, 360], [446, 380, 34, 180, 270]],
    furn: [["rect", 118, 192, 60, 72, 4], ["rect", 124, 253, 22, 8, 3], ["rect", 150, 253, 22, 8, 3], ["line", 118, 222, 178, 222],
      ["rect", 440, 172, 84, 68, 4], ["rect", 510, 178, 10, 24, 3], ["rect", 510, 208, 10, 24, 3], ["line", 478, 172, 478, 240], ["rect", 408, 176, 20, 58],
      ["rect", 296, 252, 100, 34, 5], ["line", 300, 278, 392, 278], ["rect", 322, 206, 48, 26, 3],
      ["circle", 262, 186, 20], ["circle", 262, 158, 6], ["circle", 262, 214, 6], ["circle", 236, 186, 6], ["circle", 290, 186, 6],
      ["rect", 232, 350, 166, 26], ["rect", 252, 355, 36, 16, 5], ["circle", 340, 357, 4.5], ["circle", 358, 357, 4.5], ["circle", 340, 369, 4.5], ["circle", 358, 369, 4.5],
      ["rect", 116, 276, 52, 46], ["line", 116, 276, 168, 322], ["ellipse", 132, 360, 7, 9], ["rect", 148, 352, 22, 20, 5],
      ["rect", 494, 288, 32, 86, 8], ["rect", 499, 294, 22, 74, 8], ["ellipse", 472, 364, 7, 9]],
    balcony: [236, 396, 28],
    keys: [[338, 166, "01"], [466, 154, "02"], [148, 170, "03"], [472, 343, "04"], [142, 336, "05"], [316, 106, "06"]],
    legend: [["01", "Living and kitchen", "36 m²"], ["02", "Bedroom", "14 m²"], ["03", "Bedroom", "11 m²"], ["04", "Bathroom", "6 m²"], ["05", "Shower room", "4 m²"], ["06", "Balcony", "12 m²"]],
  },
  three: {
    unit: "No. 3201", type: "3 bedrooms", area: 124, price: "from $1,940,000", levels: "Levels 26–47", left: 30, total: 52, floor: 32, range: [26, 47], view: [40, 46, 560, 385],
    shape: { kind: "arc", L: 70, R: 570, y: 120, c: 120, back: 386, entry: [456, 490] },
    walls: [[170, "f", 170, 270], [280, "f", 280, 270], [70, 270, 130, 270], [164, 270, 236, 270], [270, 270, 280, 270],
      [70, 306, 140, 306], [174, 306, 240, 306], [274, 306, 282, 306], [180, 306, 180, 386], [282, 306, 282, 386],
      [450, "f", 450, 290], [450, 290, 458, 290], [492, 290, 520, 290], [554, 290, 570, 290], [500, 290, 500, 386]],
    doors: [[164, 270, 34, 180, 270], [270, 270, 34, 180, 270], [174, 306, 34, 180, 90], [274, 306, 34, 180, 90], [492, 290, 34, 180, 270], [554, 290, 34, 180, 90], [490, 386, 34, 180, 270]],
    furn: [["rect", 76, 176, 70, 56, 4], ["rect", 80, 182, 9, 20, 3], ["rect", 80, 206, 9, 20, 3], ["line", 112, 176, 112, 232],
      ["rect", 174, 170, 76, 62, 4], ["rect", 178, 176, 9, 22, 3], ["rect", 178, 204, 9, 22, 3], ["line", 210, 170, 210, 232],
      ["rect", 478, 166, 86, 72, 4], ["rect", 550, 172, 10, 26, 3], ["rect", 550, 206, 10, 26, 3], ["line", 516, 166, 516, 238],
      ["rect", 340, 222, 104, 34, 5], ["line", 344, 248, 440, 248], ["rect", 366, 176, 52, 26, 3],
      ["rect", 292, 162, 36, 68, 4], ["circle", 336, 180, 6], ["circle", 336, 210, 6], ["circle", 310, 154, 6], ["circle", 310, 238, 6],
      ["rect", 318, 300, 100, 28, 3], ["rect", 290, 360, 154, 22], ["rect", 310, 364, 34, 14, 4], ["circle", 396, 366, 4], ["circle", 414, 366, 4], ["circle", 396, 377, 4], ["circle", 414, 377, 4],
      ["rect", 76, 352, 70, 28, 8], ["ellipse", 92, 326, 7, 9], ["rect", 150, 354, 24, 22, 5],
      ["rect", 190, 350, 28, 28, 3], ["circle", 204, 364, 9], ["rect", 222, 350, 28, 28, 3], ["circle", 236, 364, 9],
      ["rect", 506, 352, 60, 28, 8], ["ellipse", 514, 320, 7, 9]],
    balcony: [296, 444, 30],
    keys: [[392, 278, "01"], [500, 156, "02"], [226, 150, "03"], [118, 162, "04"], [118, 330, "05"], [370, 106, "06"]],
    legend: [["01", "Living, dining, kitchen", "48 m²"], ["02", "Main bedroom", "17 m²"], ["03", "Bedroom", "12 m²"], ["04", "Bedroom", "11 m²"], ["05", "Two bathrooms", "10 m²"], ["06", "Balcony", "18 m²"]],
  },
  pent: {
    unit: "No. 4801", type: "Penthouse", area: 240, price: "from $4,600,000", levels: "Level 48", left: 1, total: 2, floor: 48, range: [48, 48], view: [0, 18, 640, 440],
    shape: { kind: "rrect", L: 28, R: 612, top: 106, back: 396, r: 90, entry: [204, 240] },
    walls: [[196, "f", 196, 340], [196, 374, 196, 396], [28, 290, 70, 290], [104, 290, 140, 290], [174, 290, 196, 290], [120, 290, 120, 396],
      [444, "f", 444, 150], [444, 186, 444, 396], [444, 290, 470, 290], [504, 290, 540, 290], [574, 290, 612, 290], [520, 290, 520, 396]],
    doors: [[196, 374, 34, 270, 180], [104, 290, 34, 180, 90], [174, 290, 34, 180, 90], [444, 186, 36, 270, 360], [504, 290, 34, 180, 90], [574, 290, 34, 180, 90], [240, 396, 36, 180, 270]],
    furn: [["rect", 116, 204, 74, 64, 4], ["rect", 178, 210, 9, 24, 3], ["rect", 178, 238, 9, 24, 3], ["line", 148, 204, 148, 268],
      ["rect", 236, 226, 128, 36, 5], ["line", 240, 254, 360, 254], ["rect", 270, 176, 64, 30, 3], ["rect", 380, 170, 50, 100, 4],
      ["circle", 372, 192, 6], ["circle", 372, 220, 6], ["circle", 372, 248, 6],
      ["rect", 280, 318, 120, 30, 3], ["rect", 256, 370, 184, 22], ["rect", 280, 374, 36, 14, 4], ["circle", 392, 376, 4], ["circle", 408, 376, 4], ["circle", 392, 386, 4], ["circle", 408, 386, 4],
      ["rect", 462, 204, 72, 72, 4], ["rect", 468, 266, 26, 8, 3], ["rect", 502, 266, 26, 8, 3], ["line", 462, 236, 534, 236],
      ["rect", 450, 360, 64, 28, 8], ["ellipse", 456, 316, 7, 9], ["rect", 54, 350, 56, 28, 8], ["ellipse", 56, 318, 7, 9],
      ["rect", 126, 334, 16, 56], ["rect", 530, 338, 18, 50], ["rect", 566, 338, 16, 40]],
    balcony: [118, 522, 26],
    keys: [[300, 150, "01"], [340, 300, "02"], [160, 186, "03"], [505, 190, "04"], [88, 337, "05"], [320, 93, "06"]],
    legend: [["01", "Living and dining", "78 m²"], ["02", "Kitchen", "22 m²"], ["03", "Main suite", "38 m²"], ["04", "Guest suite", "29 m²"], ["05", "Two bathrooms", "16 m²"], ["06", "Terrace", "64 m²"]],
  },
};

const NS = "http://www.w3.org/2000/svg";
const node = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const r1 = (v) => Math.round(v * 10) / 10;

// the façade as a curve: a point and its outward normal at s (0 west → 1 east), and its height at x. "arc" is a
// quadratic from (L, y) to (R, y) through control height c (flat when c = y); "rrect" runs up the west side, round the
// corner (radius r), along the top and down the east side
function facade(sh) {
  if (sh.kind === "rrect") {
    const { L, R, top, back, r } = sh, A = back - top - r, B = (Math.PI * r) / 2, C = R - L - 2 * r, T = 2 * A + 2 * B + C;
    const cl = L + r, cr = R - r, cy = top + r;
    return {
      at(s) {
        let d = clamp(s) * T;
        if (d <= A) return { x: L, y: back - d, nx: -1, ny: 0 };
        d -= A;
        if (d <= B) { const th = Math.PI + d / r; return { x: cl + r * Math.cos(th), y: cy + r * Math.sin(th), nx: Math.cos(th), ny: Math.sin(th) }; }
        d -= B;
        if (d <= C) return { x: cl + d, y: top, nx: 0, ny: -1 };
        d -= C;
        if (d <= B) { const th = 1.5 * Math.PI + d / r; return { x: cr + r * Math.cos(th), y: cy + r * Math.sin(th), nx: Math.cos(th), ny: Math.sin(th) }; }
        d -= B;
        return { x: R, y: cy + d, nx: 1, ny: 0 };
      },
      s(x) {
        if (x < cl) return (A + (Math.PI - Math.acos(clamp((x - cl) / r, -1, 0))) * r) / T;
        if (x > cr) return (A + B + C + (Math.PI / 2 - Math.acos(clamp((x - cr) / r, 0, 1))) * r) / T;
        return (A + B + (x - cl)) / T;
      },
      y: (x) => (x < cl ? cy - Math.sqrt(Math.max(0, r * r - (x - cl) ** 2)) : x > cr ? cy - Math.sqrt(Math.max(0, r * r - (x - cr) ** 2)) : top),
    };
  }
  const { L, R, y: y0, c } = sh, M = (L + R) / 2;
  return {
    at(t) {
      const x = (1 - t) ** 2 * L + 2 * t * (1 - t) * M + t * t * R, y = (1 - t) ** 2 * y0 + 2 * t * (1 - t) * c + t * t * y0;
      const dx = 2 * (1 - t) * (M - L) + 2 * t * (R - M), dy = 2 * (1 - t) * (c - y0) + 2 * t * (y0 - c), l = Math.hypot(dx, dy) || 1;
      return { x, y, nx: dy / l, ny: -dx / l };
    },
    s: (x) => (x - L) / (R - L),
    y: (x) => { const t = (x - L) / (R - L); return y0 + 2 * t * (1 - t) * (c - y0); },
  };
}

const svg = $(".js-plan"), keysBox = $(".js-keys"), legendEl = $(".js-legend");
function drawPlan(P, animate = true) {
  const sh = P.shape, F = facade(sh), { back, L, R } = sh, [e0, e1] = sh.entry;
  const curve = (off, s0 = 0, s1 = 1, n = sh.kind === "arc" ? 48 : 160) => Array.from({ length: n + 1 }, (_, k) => { const q = F.at(s0 + ((s1 - s0) * k) / n); return `${r1(q.x + q.nx * off)},${r1(q.y + q.ny * off)}`; });
  const out = curve(0);
  const g = node("g", {});
  let d = 0;
  const wall = (cls, path) => { const e = node("path", { class: cls, d: path, pathLength: 1 }); e.style.setProperty("--d", `${(d++ * 0.035).toFixed(3)}s`); g.append(e); };
  // the floor, the terrace, then the walls drawing in one after another
  g.append(node("path", { class: "floor-fill", d: `M${out.join(" L")} L${R},${back} L${L},${back} Z` }));
  const [b0, b1, boff] = P.balcony, s0 = F.s(b0), s1 = F.s(b1);
  const bOut = curve(boff, s0, s1, 32), bIn = curve(0, s0, s1, 32).reverse();
  g.append(node("path", { class: "balc", d: `M${bOut.join(" L")} L${bIn.join(" L")} Z` }));
  wall("glass", `M${curve(-6).join(" L")}`);
  wall("w-out", `M${L},${back} L${out.join(" L")} L${R},${back}`);
  wall("w-out", `M${L},${back} L${e0},${back} M${e1},${back} L${R},${back}`);
  for (const [x1, y1, x2, y2] of P.walls) wall("w-in", `M${x1},${y1 === "f" ? r1(F.y(x1)) : y1} L${x2},${y2}`);
  for (const [hx, hy, len, a0, a1] of P.doors) {
    const p = (a) => [r1(hx + len * Math.cos((a * Math.PI) / 180)), r1(hy + len * Math.sin((a * Math.PI) / 180))];
    const [ox, oy] = p(a1), [cx, cy] = p(a0);
    wall("door", `M${hx},${hy} L${ox},${oy}`);
    g.append(node("path", { class: "swing", d: `M${cx},${cy} A${len},${len} 0 0 ${a1 > a0 ? 1 : 0} ${ox},${oy}` }));
  }
  for (const [kind, ...v] of P.furn) {
    if (kind === "rect") g.append(node("rect", { class: "furn", x: v[0], y: v[1], width: v[2], height: v[3], rx: v[4] ?? 0 }));
    else if (kind === "circle") g.append(node("circle", { class: "furn", cx: v[0], cy: v[1], r: v[2] }));
    else if (kind === "ellipse") g.append(node("ellipse", { class: "furn", cx: v[0], cy: v[1], rx: v[2], ry: v[3] }));
    else if (kind === "line") g.append(node("line", { class: "furn", x1: v[0], y1: v[1], x2: v[2], y2: v[3] }));
  }
  svg.replaceChildren(g);
  // each plan fills the frame: the view is fitted to that plan (same shape as the frame, 640 × 440)
  const [vx, vy, vw, vh] = P.view;
  svg.setAttribute("viewBox", P.view.join(" "));
  svg.setAttribute("aria-label", `Floor plan of a ${P.type.toLowerCase()} home, ${P.area} square metres`);
  keysBox.replaceChildren(...P.keys.map(([x, y, k]) => { const b = document.createElement("b"); b.textContent = k; b.style.left = `${((x - vx) / vw) * 100}%`; b.style.top = `${((y - vy) / vh) * 100}%`; return b; }));
  legendEl.replaceChildren(...P.legend.map(([k, name, area]) => { const li = document.createElement("li"); li.innerHTML = `<b>${k}</b>${name} <small>${area}</small>`; return li; }));
  if (animate) drawIn();
}
function drawIn() {
  if (STILL || RECORD) return;
  for (const el of [svg, keysBox]) { el.classList.remove("is-drawing"); void el.getBoundingClientRect(); el.classList.add("is-drawing"); }
}

// the floor rail: 48 floors, the type's floors in ink, the shown home's floor in a filled circle
const rail = $(".js-rail"), railDot = $(".js-rail-dot"), railRange = document.createElement("i");
railRange.className = "rail-range";
rail.prepend(railRange);
for (let i = 1; i <= FLOORS; i++) {
  const t = document.createElement("i");
  t.className = "rail-tick" + (i % 8 === 0 ? " is-major" : "");
  t.style.top = `${(1 - (i - 0.5) / FLOORS) * 100}%`;
  if (i % 8 === 0) t.dataset.n = pad2(i);
  rail.append(t);
}

const pills = $$(".pill"), glide = $(".pill-glide");
function placeGlide() {
  const on = pills.find((b) => b.getAttribute("aria-pressed") === "true");
  if (!on) return;
  glide.style.width = `${on.offsetWidth}px`;
  glide.style.transform = `translateX(${on.offsetLeft}px)`;
}
function choose(type, animate = true) {
  const P = PLANS[type];
  pills.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.type === type)));
  placeGlide();
  drawPlan(P, animate);
  $(".js-b-unit").textContent = P.unit;
  $(".js-b-type").textContent = P.type;
  $(".js-b-area").textContent = P.area;
  $(".js-b-price").textContent = P.price;
  $(".js-b-levels").textContent = P.levels;
  $(".js-left").textContent = P.left;
  $(".js-total").textContent = P.total;
  const [a, b] = P.range;
  railRange.style.top = `${(1 - b / FLOORS) * 100}%`;
  railRange.style.height = `${((b - a + 1) / FLOORS) * 100}%`;
  railDot.style.top = `${(1 - (P.floor - 0.5) / FLOORS) * 100}%`;
  railDot.textContent = pad2(P.floor);
}
pills.forEach((b) => b.addEventListener("click", () => choose(b.dataset.type)));
addEventListener("resize", placeGlide);
document.fonts?.ready.then(placeGlide);
choose("one", false);
// the first plan draws itself in as the section comes into view
new IntersectionObserver(([e], io) => { if (e.isIntersecting) { io.disconnect(); drawIn(); } }, { rootMargin: "0px 0px -25% 0px" }).observe(svg);

// —————————————————— 02 location: the distances count up once ——————————————————
const dist = $(".js-dist");
if (dist && !STILL && !RECORD) {
  const nums = $$("span[data-to]", dist);
  nums.forEach((s) => { s.textContent = s.dataset.dec ? "0.0" : "0"; });
  new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    const t0 = performance.now();
    const step = (t) => {
      const k = clamp((t - t0) / 1600), v = 1 - (1 - k) ** 3;
      for (const s of nums) { const to = +s.dataset.to; s.textContent = s.dataset.dec ? (to * v).toFixed(1) : String(Math.round(to * v)); }
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, { rootMargin: "0px 0px -18% 0px" }).observe(dist);
}

// —————————————————— 03 sky garden: the picture drifts slower than the page ——————————————————
const garden = $("#garden"), gardenImg = $(".js-garden-img");
if (garden && !STILL) {
  let queued = false;
  const drift = () => {
    queued = false;
    const r = garden.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const k = (innerHeight - r.top) / (innerHeight + r.height);
    gardenImg.style.transform = `translate3d(0, ${((k - 0.5) * 90).toFixed(1)}px, 0)`;
  };
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(drift); } }, { passive: true });
  drift();
}

// —————————————————— 04 register: a demo form; nothing leaves the page ——————————————————
const form = $(".js-form"), done = $(".js-done");
form?.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(form), name = String(data.get("name") || "").trim().split(/\s+/)[0], email = String(data.get("email") || "").trim();
  done.hidden = false;
  if (!/.+@.+\..+/.test(email)) {
    done.textContent = "Add an email to try it; nothing is sent.";
    form.elements.email.focus();
    return;
  }
  done.textContent = `Thank you${name ? `, ${name}` : ""}. We'd send the ${data.get("type")} plans first, but this is a demo, so nothing was sent.`;
});

// links within the page glide there (the build film plays on the way)
for (const a of $$('a[href^="#"]')) {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href").slice(1), target = id === "top" ? document.body : document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    if (id === "top") scrollTo({ top: 0, behavior: STILL ? "auto" : "smooth" });
    else target.scrollIntoView({ behavior: STILL ? "auto" : "smooth", block: "start" });
  });
}

// —————————————————— mount the film ——————————————————
// wide screens: the frame starts panned left (its left edge on the window's), so the raft and the crane stand right
// of the title, and later eases to centre. The crane's jib and counter-jib pass the nav's height round source frames
// 90–166, until the crane has climbed out of the frame (the counter-jib's left end stands at x ≈ 913 of the film's
// 1920), so the pan holds short of centre from film share .45 to .68 (source frames 65–174) and they stay right of the
// nav's name; then it settles at centre for the finished tower and the end card. Windows wider than 16:9 crop the frame's height, so it rises toward the
// top, where the roof canopy ends up (y .04). Tall windows (a tablet held upright) see a narrow slice that holds the
// raft, then the tower, right of centre, clear of the chapter card and left of the floor ruler (the film's own camera
// moves the tower 200 px right between the cut to "top" and the end).
// 16:9 and wider windows have no room to pan, so the frame is drawn 4% larger there.
const TALL = [[0, 0.46, 0.5], [0.55, 0.48, 0.5], [0.79, 0.58, 0.5], [1, 0.64, 0.5]];
const zoomFor = () => (innerWidth >= 760 && innerWidth / innerHeight >= 1.7 ? 1.04 : 1);
function focusFor() {
  if (innerWidth / innerHeight < 1.1) return TALL;
  const s = Math.max(innerWidth / 1920, innerHeight / 1080) * zoomFor(), slack = 1920 * s - innerWidth;
  const m = slack > 1 ? clamp((913 * s - innerWidth / 2 - 34) / slack, 0, 0.5) : 0.5;   // the name ends ~21 px right of centre
  return [[0, 0, 0.5], [0.45, m, 0.3], [0.68, m, 0.2], [0.86, 0.5, 0.12], [1, 0.5, 0.12]];
}
const build = await mountBuild(hero, {
  frames: "frames",
  film: FILM,
  lit: { dusk: "img/dusk", src: "img/lit", at: [0.76, 0.92], split: 0.4, reveal: "rise", noise: LIT.noise, cells: LIT.cells, soft: LIT.soft },
  focus: focusFor(),
  zoom: zoomFor(),
  // a phone: a full-resolution portrait window of the film (x 760–1520) covers the screen and follows the tower as
  // the film's camera moves it right: the raft and its core in the middle, the rising tower at x 870–1200 a little
  // left of the middle, then the finished tower (1101–1328) and its podium a little left, clear of the ruler
  phone: { mode: "cover", zoom: 1, focus: [[0, 0, 0.5], [0.4, 0.2, 0.5], [0.54, 0.25, 0.5], [0.62, 0.35, 0.5], [0.79, 0.5, 0.5], [1, 0.75, 0.5]] },
  glide: 3000,
  onUpdate,
});
addEventListener("resize", () => { build.options.focus = focusFor(); build.options.zoom = zoomFor(); build.redraw(); });
reveal();
navTone();
