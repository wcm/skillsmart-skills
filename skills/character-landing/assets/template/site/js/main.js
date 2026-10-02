// Scroll-driven character landing page.
//   Scene 0: hero. The character peeks up from the bottom edge, big and front-facing, eyes following the pointer.
//   Scrolling zooms it out into scene 1 (rest); scenes 2…N-1 each settle on a pose, the clips between them scrubbed by scroll.
// Characters are listed in characters/index.json; each lives in characters/<id>/ (see character.json).
import { clamp, lerp, smooth, mixRGB, css, reduced } from "./util.js";
import { createBackground } from "./background.js";
import { loadCharacter, prefetch } from "./character.js";

const SCREENS_PER_SCENE = 2.5;   // viewport heights of scrolling per scene
const PALETTE_FADE = 700;   // ms, when switching characters
const MAX_CANVAS = 2400;    // px, backing-store cap for the huge hero

const $ = s => document.querySelector(s);
const tabsEl = $("#tabs"), pill = $(".tabs .pill"), titlesEl = $("#titles");
const mascot = $("#mascot"), body = mascot.querySelector(".body"), shadow = mascot.querySelector(".shadow");
const cv = mascot.querySelector("canvas"), ctx = cv.getContext("2d");
const bg = createBackground($("#bg"));

let ch = null;              // current character
let titleEls = [];
let N = 5;
let paletteFrom = null;     // {cols, ink, t0} while cross-fading palettes between characters
let poster = 0;             // background look, eased toward the character's theme (0 mesh … 1 poster)
let lastCols = null, lastInk = null;

/* ------------------------------------------------------------------ tabs */
function buildTabs(chars) {
  for (const c of chars) {
    const b = document.createElement("button");
    b.role = "tab";
    b.dataset.id = c.id;
    // avatar: zoom into the head using the figure bounds
    const f = c.heroFig, zoom = Math.round(100 / Math.max(0.2, (f.feet - f.top) * 0.42));
    b.innerHTML = `<span class="av" style="background-image:url(${c.poster});--zoom:${zoom}%;--pos:${Math.round(f.cx * 100)}% ${Math.round(f.top * 100 + 4)}%"></span>${c.name}`;
    b.addEventListener("click", () => select(c.id));
    tabsEl.appendChild(b);
  }
  document.fonts?.ready.then(movePill);
  addEventListener("resize", movePill);
}

function movePill() {
  const b = tabsEl.querySelector('[aria-selected="true"]');
  if (!b) return;
  pill.style.width = b.offsetWidth + "px";
  pill.style.transform = `translateX(${b.offsetLeft}px)`;
}

/* ------------------------------------------------------------------ switching characters */
async function select(id, { instant = false } = {}) {
  if (ch?.id === id) return;
  tabsEl.querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", b.dataset.id === id));
  movePill();
  try { localStorage.setItem("landing-character", id); } catch {}
  history.replaceState(null, "", `?c=${id}`);

  const next = await loadCharacter(id);
  if (!instant) {
    mascot.classList.add("swap"); titlesEl.classList.add("swap");
    if (lastCols) paletteFrom = { cols: lastCols, ink: lastInk, t0: performance.now() };
    await Promise.all([next.ready, wait(reduced ? 0 : 320)]);
  } else {
    await next.ready;
  }
  ch = next;
  N = ch.scenes.length;
  applyTheme(ch.spec.theme);
  buildTitles();
  box = null;
  lastKey = "";
  mascot.classList.remove("swap"); titlesEl.classList.remove("swap");
  ch.seq.preload();
}

// Per-character typography and background look from character.json "theme"; anything omitted falls back to the
// defaults in styles.css (Instrument Serif titles, Inter body, italic emphasis, mesh gradient).
const THEME_VARS = { title: "--title-font", body: "--body-font", titleWeight: "--title-weight", titleTracking: "--title-tracking", titleScale: "--title-scale" };
function applyTheme(theme = {}) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(THEME_VARS)) theme[k] != null ? root.style.setProperty(v, theme[k]) : root.style.removeProperty(v);
  root.dataset.em = theme.em ?? "italic";
  if (theme.fonts && !document.querySelector(`link[href="${theme.fonts}"]`)) {
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = theme.fonts;
    l.onload = () => document.fonts.ready.then(fitTitles);
    document.head.appendChild(l);
  }
}

function buildTitles() {
  titlesEl.innerHTML = "";
  titleEls = ch.scenes.map((s, n) => {
    const d = document.createElement("div");
    d.className = n === 0 ? "t hero" : "t";
    d.innerHTML = `<h1>${s.title}</h1>` + (s.sub ? `<p>${s.sub}</p>` : "");
    titlesEl.appendChild(d);
    return d;
  });
  $("#scroller").style.height = `${(N - 1) * SCREENS_PER_SCENE * 100 + 100}vh`;
  fitTitles();
}

// A wrapped block keeps its full max-width, leaving empty space after the longest line — which, for a title on the
// left, sits between the text and the character. Shrink each side title to its longest rendered line.
function fitTitles() {
  const range = document.createRange();
  titleEls.forEach((el, n) => {
    if (n === 0) return; // the hero is centred
    el.style.width = "";
    const left = el.getBoundingClientRect().left;
    let w = 0;
    for (const child of el.children) {
      range.selectNodeContents(child);
      for (const r of range.getClientRects()) w = Math.max(w, r.right - left);
    }
    if (w) el.style.width = Math.ceil(w) + 1 + "px";
  });
}
document.fonts?.ready.then(() => titleEls.length && fitTitles());
addEventListener("resize", () => titleEls.length && fitTitles());

const wait = ms => new Promise(r => setTimeout(r, ms));

/* ------------------------------------------------------------------ layout */
// Sizes come from the figure's own bounds so every character reads at the same scale.
const GAP = () => (innerWidth < 700 ? 14 : 36);
const sideOf = n => (n % 2 === 1 ? 1 : -1);   // +1: title left, character right

function scene(n) {
  const W = innerWidth, H = innerHeight, mobile = W < 700, f = ch.fig, gap = GAP();
  const el = titleEls[n], tw = el.offsetWidth, th = el.offsetHeight;
  const figSpan = f.feet - f.top;

  if (n === 0) {
    const f = ch.heroFig, figSpan = f.feet - f.top;
    // Peek: a big figure whose top share (ch.peek) rises above the bottom edge; the title floats centred above it.
    const size = Math.min(
      H * (mobile ? .92 : 1.0) / figSpan,
      H * (mobile ? .52 : .56) / (ch.peek * figSpan),   // leave the top of the screen for the title
      W * (mobile ? 1.2 : .95) / (2 * f.halfW));
    const figTop = H - ch.peek * figSpan * size;
    const tabs = mobile ? 72 : 80;
    const titleY = clamp(H * .4 - th / 2, tabs, Math.max(tabs, figTop - gap - th));
    return { title: { x: (W - tw) / 2, y: titleY }, box: { x: W / 2 - f.cx * size, y: figTop - f.top * size, size } };
  }

  const size = ch.bleed
    ? Math.min(H * (mobile ? .56 : .84) / figSpan, W * (mobile ? .56 : .48) / (2 * f.halfW))
    : Math.min(H * (mobile ? .40 : .64) / figSpan, W * (mobile ? .46 : .42) / (2 * f.halfW));
  const half = f.halfW * size, side = sideOf(n);
  const total = tw + gap + 2 * half;
  const x0 = Math.max(mobile ? 16 : 40, (W - total) / 2);
  const titleX = side > 0 ? x0 : x0 + 2 * half + gap;
  const cx = side > 0 ? x0 + tw + gap + half : x0 + half;
  const cy = H * .54;
  return {
    title: { x: titleX, y: cy - th / 2 },
    // a waist-up figure sits on the bottom edge (its cut-off hidden below the fold); full figures centre on cy
    box: { x: cx - f.cx * size, y: ch.bleed ? H - f.feet * size + 2 : cy - (f.top + f.feet) / 2 * size, size },
  };
}

/* ------------------------------------------------------------------ pointer */
const pointer = { x: innerWidth / 2, y: innerHeight * .3, t: -1e9 };
const look = { x: 0, y: 0 };
let blinkAt = performance.now() + 2500, s = 0;

addEventListener("pointermove", e => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.t = performance.now();
}, { passive: true });

/* ------------------------------------------------------------------ loop */
let sp = 0, box = null;
const t0 = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  if (!ch) return;
  const max = document.documentElement.scrollHeight - innerHeight;
  const target = max > 0 ? clamp(scrollY / max) : 0;
  sp += (target - sp) * (reduced ? 1 : 0.1);
  if (Math.abs(target - sp) < 1e-5) sp = target;

  s = sp * (N - 1);
  const i = Math.min(N - 2, Math.floor(s));
  const f = s - i;
  const time = reduced ? 0 : (now - t0) / 1000;

  /* palette + ink (cross-faded from the previous character on switch) */
  const k = smooth(.25, .85, f);
  let cols = ch.palette[i].colors.map((c, j) => mixRGB(c, ch.palette[i + 1].colors[j], k));
  let ink = mixRGB(ch.palette[i].ink, ch.palette[i + 1].ink, k);
  if (paletteFrom) {
    const t = smooth(0, 1, (now - paletteFrom.t0) / PALETTE_FADE);
    cols = cols.map((c, j) => mixRGB(paletteFrom.cols[j], c, t));
    ink = mixRGB(paletteFrom.ink, ink, t);
    if (t >= 1) paletteFrom = null;
  }
  lastCols = cols; lastInk = ink;
  document.documentElement.style.setProperty("--ink", css(ink));
  document.documentElement.style.setProperty("--bg", css(cols[2]));
  document.documentElement.style.setProperty("--hl", css(mixRGB(cols[3], cols[2], .3)));
  poster += ((ch.spec.theme?.gradient === "poster" ? 1 : 0) - poster) * (reduced ? 1 : .05);
  bg.draw(cols, time, poster);

  /* titles: each scene owns s = n; fade across ±0.5 with a calm hold */
  titleEls.forEach((el, n) => {
    const d = s - n;
    let o = 1 - smooth(.14, .48, Math.abs(d));
    if (n === 0 && d < 0) o = 1;
    if (n === N - 1 && d > 0) o = 1;
    const pos = scene(n).title;
    const lift = (1 - o) * 18 * Math.sign(d);
    el.style.opacity = o.toFixed(3);
    el.style.filter = o > .995 ? "none" : `blur(${((1 - o) * 10).toFixed(2)}px)`;
    el.style.transform = `translate3d(${pos.x}px, ${pos.y - lift}px, 0)`;
    el.style.visibility = o < .01 ? "hidden" : "visible";
  });

  /* character position: the hero zooms out from the first scroll; later scenes glide mid-transition */
  const m = i === 0 ? smooth(0, .9, f) : smooth(.3, .75, f);
  const A = scene(i).box, B = scene(i + 1).box;
  const goal = { x: lerp(A.x, B.x, m), y: lerp(A.y, B.y, m), size: lerp(A.size, B.size, m) };
  if (!box) box = { ...goal };
  const ease = reduced ? 1 : 0.14;
  box.x += (goal.x - box.x) * ease; box.y += (goal.y - box.y) * ease; box.size += (goal.size - box.size) * ease;
  mascot.style.width = mascot.style.height = box.size + "px";
  mascot.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`;
  shadow.style.display = ch.bleed ? "none" : "";
  shadow.style.top = (ch.fig.feet * 100).toFixed(1) + "%";
  shadow.style.width = (ch.fig.halfW * 150).toFixed(1) + "%";

  /* eyes: follow the pointer through the zoom-out, drift home as the first pose begins at scene 1 */
  const engage = 1 - smooth(.7, .98, s);
  let lx = 0, ly = 0;
  if (now - pointer.t > 3500) { lx = Math.sin(time * .7) * .5; ly = Math.sin(time * .43) * .25; }
  else {
    const hf = ch.heroFig, ex = box.x + hf.cx * box.size, ey = box.y + (hf.top + (hf.feet - hf.top) * .22) * box.size;
    const dx = pointer.x - ex, dy = pointer.y - ey, d = Math.hypot(dx, dy) || 1;
    const reach = Math.min(1, d / (box.size * .35));
    lx = dx / d * reach; ly = dy / d * reach;
  }
  look.x += (lx * engage - look.x) * .15; look.y += (ly * engage - look.y) * .15;

  /* breathing + a slight lean toward the pointer while engaged */
  const breathe = reduced ? 0 : Math.sin(time * 2.1) * .008 * engage;
  body.style.transform = `rotate(${(look.x * 1.4 * engage).toFixed(2)}deg) scale(${1 - breathe * .5}, ${1 + breathe})`;

  /* blink every few seconds */
  let blink = 0;
  if (now > blinkAt) { const b = (now - blinkAt) / 160; blink = b < 1 ? Math.sin(b * Math.PI) : 0; if (b >= 1) blinkAt = now + 2600 + Math.random() * 3000; }

  draw(blink);
}

let lastKey = "";
function draw(blink) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.min(MAX_CANVAS, Math.round(box.size * dpr));
  if (Math.abs(cv.width - w) > 2) { cv.width = cv.height = w; lastKey = ""; }

  // Rest until scene 1; scene j (≥1) settles on marks[j-1] (0 = rest, then each pose), easing between marks.
  const marks = ch.seq.meta.marks ?? [0, ch.seq.count - 1];
  const mark = j => marks[clamp(j - 1, 0, marks.length - 1)];
  const j = Math.floor(s), f = s - j;
  const idx = s < 1 ? 0 : lerp(mark(j), mark(j + 1), smooth(.15, .85, f));
  const g = ch.seq.get(Math.round(idx));
  if (!g) return;
  let src, key;
  if (g.i === 0) {
    src = ch.rig ? ch.rig.render(look, blink) : ch.hero.naturalWidth ? ch.hero : g.im;
    key = `h${look.x.toFixed(3)},${look.y.toFixed(3)},${blink.toFixed(2)}`;
  } else { src = g.im; key = "t" + g.i; }
  key += ch.id;
  if (key === lastKey) return;
  lastKey = key;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(src, 0, 0, cv.width, cv.height);
}

/* ------------------------------------------------------------------ boot */
const specs = (await Promise.all((await (await fetch("characters/index.json")).json()).map(loadCharacter))).filter(Boolean);
const ids = specs.map(c => c.id);
buildTabs(specs);
tabsEl.hidden = specs.length < 2; // a single-character page needs no switcher
if (!specs.length) {
  // nothing generated yet (no characters/<id>/seq/manifest.json)
  titlesEl.innerHTML = `<div class="t hero" style="opacity:1;transform:translate(-50%,40vh);left:50%"><h1>Almost there.</h1><p>No character frames yet — run the generator, then reload.</p></div>`;
} else {
  let start = new URLSearchParams(location.search).get("c");
  try { start ||= localStorage.getItem("landing-character"); } catch {}
  await select(ids.includes(start) ? start : ids[0], { instant: true });
  prefetch(ids);
  requestAnimationFrame(frame);
}
