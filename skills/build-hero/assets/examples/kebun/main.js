// Kebun: the build hero (a pool and tropical garden going in behind a Singapore house, then the pool lights at
// dusk) and the page's small interactions. The first screen shows the film in a rounded window under the name; the first scroll opens the
// window to the full screen with a clip-path on the engine's canvases (the canvas itself is never resized).
import { mountBuild, reveal, clocks, clamp, seg } from "../engine/chantier.js";

const $ = (s, r = document) => r.querySelector(s);
const root = document.documentElement;
const section = $("#build");
const stage = $(".ch-stage", section);
const win = $(".intro-window", section);
const mark = $(".wordmark", section);
const hud = $(".hud", section);
const nav = $(".nav");

const PHONE = 760;                        // the engine's phone breakpoint
const OPEN = [0, 0.055];                  // the window opens over this stretch of p
const ROW = 0.2;                          // wide screens: this row of the frame sits at the window's top at p = 0
                                          // (the house's ground floor, then the earth with the pool strung out on it)
const BAND = { zoom: 1.8, top: 0.14, lift: 0 };   // phones: the film as a band under the name (top is set from the
                                                   // layout); lift: how far it rises as the window opens, in share of H
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) ** 3;
const isPhone = () => innerWidth < PHONE;
const px = (v) => `${v.toFixed(1)}px`;
// phones with a real browser height (the toolbar takes 100–180 px) get a smaller band, so the words below fit
const bandZoom = () => ((stage.clientHeight || innerHeight) < 760 ? 1.55 : 1.8);

// the frame sizes of frames/ and frames-phone/, read from their manifests (the window's offset depends on them)
const SIZE = { wide: [1600, 900], phone: [1080, 608] };
await Promise.all([["wide", "frames"], ["phone", "frames-phone"]].map(([k, dir]) =>
  fetch(`${dir}/manifest.json`).then((r) => r.json()).then((m) => { if (Array.isArray(m?.size)) SIZE[k] = m.size; }).catch(() => {})));

// —— captions: four, each fading out before the next fades in (never two at once). The 3 s glide crosses the film at
// about 0.36 of p a second, so the fades are kept short (eased in over CF_IN, about 48 ms in the glide; out over
// CF_OUT) and each caption reads fully for about 0.37 s or more. The rise is separate: smaller and slower (over
// RISE_K, about 130 ms, easing out), so a caption settles gently into place while it is already readable instead of
// jumping up in one go ——
const CF_IN = 0.017, CF_OUT = 0.013, RISE_K = 0.045, CAP_RISE = 30, CAP_LIFT = 12;
const caps = [...section.querySelectorAll(".hud-cap[data-cap]")].map((el) => {
  const [a, b] = el.dataset.cap.trim().split(/\s+/).map(Number);
  return { el, a, b, last: "" };
});

// —— the giant name fills the width (and never more than about a third of the screen's height) ——
function fitMark() {
  const span = mark.firstElementChild;
  mark.style.fontSize = "100px";
  const w = span.getBoundingClientRect().width || 1;
  const W = stage.clientWidth || innerWidth, H = stage.clientHeight || innerHeight;
  const cap = isPhone() ? 0.15 : W >= 1600 ? 0.37 : 0.35;
  const size = Math.min((100 * mark.clientWidth) / w, H * cap);
  mark.style.fontSize = `${size.toFixed(1)}px`;
  // wide screens: the film window (and the line under the name) lines up with the name's own edges, but the
  // window is always at least about 80% of the width
  if (!isPhone()) {
    const nameW = (w * size) / 100;
    section.style.setProperty("--win-x", px(clamp((W - nameW) / 2, W * 0.07, W * 0.1)));
  } else section.style.removeProperty("--win-x");
}

// —— where the window is on the first screen (from the .intro-window placeholder), and how far the picture is
// lowered inside it so the first frame shows the house and the staked-out earth, not only the rain tree ——
let geo = null, build = null;
function measure() {
  const W = stage.clientWidth, H = stage.clientHeight, phone = isPhone();
  if (phone) {
    // the band sits so that its crisp middle starts just under the name, which is where the window opens from
    BAND.zoom = bandZoom();
    const [iw, ih] = SIZE.phone, bh = (W * BAND.zoom * ih) / iw;
    const F = parseFloat(mark.style.fontSize) || W * 0.23;
    const winTop = mark.offsetTop + mark.offsetHeight + F * 0.2 + 12;
    BAND.top = clamp((winTop - 0.13 * bh) / H, 0.04, 0.45);
    // on a short screen the band rises as the window opens, just enough to clear the captions (which sit above
    // the tiles), and never so far that its crisp part slides under the project chip
    const capTop = Math.min(...caps.map((c) => c.el.offsetTop)), chip = $(".hud-tl", hud);
    const chipBottom = chip.offsetTop + chip.offsetHeight + 4, top = BAND.top * H;
    BAND.lift = clamp(top + bh - (capTop - 6), 0, Math.max(0, top + 0.13 * bh - chipBottom)) / H;
    if (build) { build.options.phone.zoom = BAND.zoom; build.redraw(); }
    section.style.setProperty("--bt", px(BAND.top * H));
    section.style.setProperty("--bh", px(bh));
  }
  const t = win.offsetTop, l = win.offsetLeft, w = win.offsetWidth, h = win.offsetHeight;
  const rad = parseFloat(getComputedStyle(win).borderTopLeftRadius) || 24;
  let ty = 0;
  if (!phone) {
    // lower the picture so its ROW sits at the window's top, but never so far that its own top edge drops into
    // the window (on screens wider than the frame the picture is taller than the stage)
    const [iw, ih] = SIZE.wide, s = Math.max(W / iw, H / ih), fh = ih * s, fy = (H - fh) / 2;
    ty = clamp(t - (fy + ROW * fh), 0, t - Math.max(0, fy));
  }
  geo = { W, H, t, l, r: W - l - w, b: H - t - h, rad, ty, key: Math.random() };
}

let last = "";
function openWindow(p) {
  if (!geo) measure();
  const k = easeInOut(seg(p, OPEN[0], OPEN[1])), c = 1 - k;
  const key = `${k.toFixed(4)}|${geo.key}`;
  if (key === last) return;
  last = key;
  root.style.setProperty("--open", k.toFixed(4));
  const canvas = stage.querySelector(".ch-canvas"), back = stage.querySelector(".ch-back");
  const { t, l, r, b, rad, ty, W, H } = geo, y = ty * c, done = c < 0.0005;
  const box = `inset(${px(t * c)} ${px(r * c)} ${px(b * c)} ${px(l * c)} round ${px(rad * c)})`;
  if (canvas) {
    // the clip moves with the canvas, so the lowered picture's window is drawn y higher in its own space
    canvas.style.transform = y > 0.05 ? `translate3d(0, ${px(y)}, 0)` : "";
    canvas.style.clipPath = done ? "" : `inset(${px(t * c - y)} ${px(r * c)} ${px(b * c + y)} ${px(l * c)} round ${px(rad * c)})`;
  }
  if (build && isPhone()) build.options.phone.top = BAND.top - BAND.lift * k;
  if (back) {
    // the blurred copy behind a phone's band sits at inset -12%; it fades in as the window opens, so the band's
    // soft edges first meet the paper, not a dark slab
    const ox = 0.12 * W, oy = 0.12 * H;
    back.style.clipPath = done ? "" : `inset(${px(t * c + oy)} ${px(r * c + ox)} ${px(b * c + oy)} ${px(l * c + ox)} round ${px(rad * c)})`;
    back.style.opacity = done ? "" : smooth(seg(k, 0.3, 0.9)).toFixed(3);
  }
  // the scaffold belongs to the film: while the window opens it only shows inside it
  hud.style.clipPath = done ? "" : box;
}

function captions(p) {
  for (const c of caps) {
    const tin = seg(p, c.a, c.a + CF_IN), tout = 1 - seg(p, c.b - CF_OUT, c.b), v = smooth(Math.min(tin, tout));
    const y = (1 - easeOut(seg(p, c.a, c.a + RISE_K))) * CAP_RISE - smooth(1 - tout) * CAP_LIFT;
    const key = `${v.toFixed(3)}|${y.toFixed(1)}`;
    if (key === c.last) continue;
    c.last = key;
    c.el.style.opacity = v.toFixed(3);
    c.el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    c.el.style.visibility = v < 0.01 ? "hidden" : "visible";
  }
}

// the pen line under "June." draws in with the end (by p, so it records frame by frame too)
let penLast = -1;
function drawPen(p) {
  const k = Math.round(seg(p, 0.888, 0.922) * 1000) / 1000;
  if (k !== penLast) { penLast = k; section.style.setProperty("--draw", k.toFixed(3)); }
}

// one "Plan your pool" at a time: the nav's steps aside while the end's own button is on screen
let endOn = null;
function navEnd(p) {
  const on = p > 0.875 && section.getBoundingClientRect().bottom > innerHeight * 0.45;
  if (on !== endOn) { endOn = on; nav.classList.toggle("is-end", on); }
}
// … and while the quote form's own "Plan your pool" button is on screen
new IntersectionObserver(([e]) => nav.classList.toggle("is-plan", e.isIntersecting), { rootMargin: "-60px 0px 0px 0px" }).observe($("#quote"));

// past the hero, the nav gets a paper band, so the sections' headings don't run between its pills
const navPast = () => nav.classList.toggle("is-past", section.getBoundingClientRect().bottom < nav.offsetTop + nav.offsetHeight + 12);
addEventListener("scroll", navPast, { passive: true });
navPast();

// before the engine's own resize handler, so its redraw sees the new window
addEventListener("resize", () => { fitMark(); geo = null; });
fitMark();
measure();
captions(0);

document.fonts?.ready.then(() => { fitMark(); geo = null; last = ""; openWindow(build ? build.p : 0); });

build = await mountBuild(section, {
  frames: "frames",
  film: [0.04, 0.72],
  // tropical blue hour, then the pool lights and the garden's uplights come on outward from the pool: the origin is
  // the middle of the lit water in img/lit.webp (the pool runs from x 0.43–0.83 at the house to 0.15–0.83 at the
  // front, y 0.5–1; its in-wall lights sit along the near-left wall), so the uplights in the frangipani and the
  // ferns on the right come on last
  lit: { dusk: "img/dusk", src: "img/lit", at: [0.76, 0.92], split: 0.4, reveal: "radial", origin: [0.56, 0.74], noise: 0.3 },
  focus: [[0, 0.52, 0.5], [1, 0.55, 0.5]],
  // phones: the strung-out rectangle and then the walled box (frame x 0.34–0.8 over frames 1–18), the pool from
  // above (~0.53) as the drone comes down to its low view by frame 45 (film 0.56), then the finished pool and the
  // house (~0.6)
  phone: { mode: "band", zoom: BAND.zoom, top: BAND.top, focus: [[0, 0.58], [0.22, 0.56], [0.36, 0.53], [0.56, 0.56], [1, 0.6]] },
  glide: 3000,
  onUpdate: ({ p }) => { openWindow(p); captions(p); drawPen(p); navEnd(p); },
});
last = ""; openWindow(build.p); build.redraw();

// —— projects: No. 14 turns from day to night as it passes ——
const night = $(".proj--14");
let projWait = false;
function projects() {
  projWait = false;
  const r = night.getBoundingClientRect(), vh = innerHeight;
  const k = easeInOut(clamp((vh * 0.8 - r.top) / (vh * 0.5)));
  night.style.setProperty("--night", k.toFixed(3));
  night.classList.toggle("is-night", k > 0.5);
}
addEventListener("scroll", () => { if (!projWait) { projWait = true; requestAnimationFrame(projects); } }, { passive: true });
projects();

// —— the quote bar: a rough schedule from size, finish and start month (a demo: nothing is sent); a start in the
// northeast monsoon (November to January) gets a week for the rain ——
const form = $("#quote"), est = $(".q-est"), note = $(".q-note");
const WEEKS = { plunge: 9, lap: 12, family: 13, long: 14 }, EXTRA = { green: 0, terrazzo: 1, mosaic: 1, basalt: 2 };
const MONSOON = [10, 11, 0];
const field = (n) => form.querySelector(`[name="${n}"]`).value;
function estimate() {
  const m = +field("start"), rain = MONSOON.includes(m) ? 1 : 0;
  const weeks = WEEKS[field("size")] + EXTRA[field("finish")] + rain;
  const now = new Date(), y = now.getFullYear() + (m <= now.getMonth() ? 1 : 0);
  const swim = new Date(y, m, 1 + weeks * 7);
  est.innerHTML = `<span>About ${weeks} weeks, garden included${rain ? ", one for the monsoon" : ""}</span><b>Swim by ${swim.getDate()} ${swim.toLocaleString("en-GB", { month: "long" })}</b>`;
}
form.addEventListener("change", () => { estimate(); note.textContent = "This is a demo; nothing is sent."; });
form.addEventListener("submit", (e) => { e.preventDefault(); note.textContent = "Demo only: nothing was sent. A real site would book the visit."; });
estimate();

reveal();
clocks();
