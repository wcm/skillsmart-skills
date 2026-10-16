// puff.js — the puffy layer: a transparent loop of overinflated letters that floats over the page. It is the only
// thing on the page that moves.
//
//   import { mountPuff } from "./puff.js";
//   const puff = mountPuff(document.querySelector(".puff"), { src: "img/hero/puff", size: .7, maxW: .64, y: .52 });
//   puff.onSized((rect) => drawBackground(rect));   // after the letters are measured, and after every resize()
//
// Files (made by tools/video.mjs): <src>.webm (VP9 with alpha: Chrome, Firefox, Edge), <src>.mov (HEVC with alpha:
// Safari), <src>.webp (the loop's first frame: shown at rest, and its alpha decides what counts as "on the letters").
//
// What it does:
//   rest    the first frame, drifting a hair (CSS)
//   lean    wherever the cursor is, the letters slide and turn toward it on a spring that overshoots a little, and their
//           shadow slides away from it (CSS variables --sx, --sy, −1…1) as if the cursor were a lamp
//   pop     the moment the cursor reaches the letters (or a finger taps them, or the page opens): a kick to a fast,
//           lightly damped spring, so they swell ~6–9% (a touch taller than wide) and rebound two or three times
//   loop    plays while the cursor is on the letters, then runs on to its end — its first frame again — so it always
//           stops where it started. A tap on a touch screen plays it once.
// prefers-reduced-motion: no lean, no pop, no drift; the loop still plays when asked for.

const SAFARI = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);   // HEVC alpha; everyone else VP9 alpha
const TOUCH = matchMedia("(hover: none)").matches;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

const DEFAULTS = {
  size: .7,          // the letters' height as a share of the window's height…
  maxW: .64,         // …capped at this share of its width (phones, under 760 px: phoneMaxW)
  phoneMaxW: .92,
  x: .5, y: .5,      // the centre, as shares of the window
  move: [16, 12],    // lean: px toward the cursor (x, y)
  turn: [10, 7],     // lean: degrees of turn (about y, about x)
  swell: .03,        // scale while the cursor is on the letters
  pop: 2,            // the pop's kick; 2 ≈ a 9% swell at its peak
  popOnLoad: .8,     // the pop as the page opens (0: none)
};

export function mountPuff(el, options){
  const o = { ...DEFAULTS, ...options };
  const label = el.getAttribute("aria-label") ?? "";
  el.innerHTML = `<div class="tilt"><div class="drift"><video muted playsinline preload="auto" disablepictureinpicture
    poster="${o.src}.webp" src="${o.src}.${SAFARI ? "mov" : "webm"}" aria-hidden="true"></video></div></div>`;
  el.setAttribute("role", "img");
  if (label) el.setAttribute("aria-label", label);
  const v = el.querySelector("video"), tilt = el.querySelector(".tilt"), sized = [];
  const st = { want: false, alpha: null, ar: 1, tx: 0, ty: 0, x: { x: 0, v: 0 }, y: { x: 0, v: 0 }, s: { x: 0, v: 0 }, p: { x: 0, v: 0 } };

  // the first frame: its shape sizes the layer, and its alpha (small, a little blurred, since the letters move while
  // the loop plays) is the hit test
  let ready;
  const loaded = new Promise((res) => (ready = res));
  const img = new Image();
  img.onload = () => {
    st.ar = img.width / img.height;
    const c = document.createElement("canvas"); c.width = 200; c.height = Math.round(200 / st.ar);
    const x = c.getContext("2d", { willReadFrequently: true }); x.filter = "blur(3px)"; x.drawImage(img, 0, 0, c.width, c.height);
    st.alpha = { w: c.width, h: c.height, d: x.getImageData(0, 0, c.width, c.height).data };
    resize();
    ready();
    if (o.popOnLoad) setTimeout(() => pop(o.popOnLoad), 260);
  };
  img.src = `${o.src}.webp`;

  function resize(){
    const W = innerWidth, H = innerHeight, maxW = W < 760 ? o.phoneMaxW : o.maxW;
    const h = Math.min(H * o.size, W * maxW / st.ar), w = h * st.ar;
    Object.assign(el.style, { width: `${w}px`, height: `${h}px`, left: `${W * o.x}px`, top: `${H * o.y}px` });
    const r = el.getBoundingClientRect();
    for (const fn of sized) fn(r);
  }
  function over(px, py){
    if (!st.alpha) return false;
    const r = el.getBoundingClientRect(), u = (px - r.left) / r.width, w = (py - r.top) / r.height;
    if (u < 0 || w < 0 || u >= 1 || w >= 1) return false;
    const a = st.alpha;
    return a.d[(Math.floor(w * a.h) * a.w + Math.floor(u * a.w)) * 4 + 3] > 40;
  }
  function pop(strength = 1){ if (!REDUCED) st.p.v += o.pop * strength; }
  function want(on){
    if (on && !st.want) pop();
    st.want = on;
    document.body.style.cursor = on && !TOUCH ? "pointer" : "";
    if (on && v.paused) v.play().catch(() => {});
  }
  function aim(px, py){
    if (REDUCED) return;
    const r = el.getBoundingClientRect();
    st.tx = Math.max(-1, Math.min(1, (px - r.left - r.width / 2) / (innerWidth / 2)));
    st.ty = Math.max(-1, Math.min(1, (py - r.top - r.height / 2) / (innerHeight / 2)));
  }
  // once through, then again only while the cursor is still on the letters; it always ends on its first frame
  v.addEventListener("ended", () => { if (st.want) v.play().catch(() => {}); else v.currentTime = 0; });
  const onMove = (e) => { aim(e.clientX, e.clientY); if (!TOUCH) want(over(e.clientX, e.clientY)); };
  const onLeave = () => { want(false); st.tx = st.ty = 0; };
  const onDown = (e) => { if (TOUCH && over(e.clientX, e.clientY)){ st.want = false; pop(); if (v.paused) v.play().catch(() => {}); } };
  addEventListener("pointermove", onMove);
  addEventListener("pointerdown", onDown);
  document.addEventListener("pointerleave", onLeave);

  // springs: the lean (k 70, c 12: a little overshoot), the swell (k 120, c 14), the pop (k 260, c 9: fast, bouncy)
  const spring = (s, to, dt, k, c) => { s.v += (k * (to - s.x) - c * s.v) * dt; s.x += s.v * dt; return s.x; };
  let last = performance.now(), raf = 0;
  const tick = (now) => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const x = spring(st.x, st.tx, dt, 70, 12), y = spring(st.y, st.ty, dt, 70, 12);
    const s = spring(st.s, st.want ? 1 : 0, dt, 120, 14), q = spring(st.p, 0, dt, 260, 9), base = 1 + s * o.swell;
    tilt.style.transform = `perspective(1400px) translate3d(${(x * o.move[0]).toFixed(2)}px, ${(y * o.move[1]).toFixed(2)}px, 0) ` +
      `rotateX(${(-y * o.turn[1]).toFixed(2)}deg) rotateY(${(x * o.turn[0]).toFixed(2)}deg) scale(${(base + q * .85).toFixed(4)}, ${(base + q * 1.2).toFixed(4)})`;
    el.style.setProperty("--sx", (-x).toFixed(3));
    el.style.setProperty("--sy", (-y).toFixed(3));
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const api = {
    el, video: v, ready: loaded, pop, resize,
    onSized(fn){ sized.push(fn); if (st.alpha) fn(el.getBoundingClientRect()); return api; },
    // a point on the letters themselves, in window px (for tests)
    pointOnLetters(){
      const r = el.getBoundingClientRect(), a = st.alpha; if (!a) return null;
      for (let k = 0; k < 800; k++){ const u = .25 + .5 * ((k * 37) % 100) / 100, w = .3 + .4 * ((k * 61) % 100) / 100;
        if (a.d[(Math.floor(w * a.h) * a.w + Math.floor(u * a.w)) * 4 + 3] > 230) return [r.left + u * r.width, r.top + w * r.height]; }
      return [r.left + r.width / 2, r.top + r.height / 2];
    },
    destroy(){ cancelAnimationFrame(raf); removeEventListener("pointermove", onMove); removeEventListener("pointerdown", onDown); document.removeEventListener("pointerleave", onLeave); v.pause(); },
  };
  window.__puff = api;   // a console and test handle
  return api;
}
