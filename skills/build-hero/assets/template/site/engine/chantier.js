// Chantier: a pinned stage plays a build film as the page scrolls, from raw materials to the finished place, then
// evening falls and the lights come on. One film per page (frames from tools/web.mjs), built in one light; then two
// pictures made from its last frame: the same place at dusk with every light off, faded in evenly, and with the
// lights on, revealed in an order (from the ground up, outward from a point, across, or scattered).
//
// Pages put their words and readouts in the HTML; the engine times them against the section's scroll progress p
// (0 when the section's top meets the window's top, 1 when its end meets the window's bottom):
//   data-ch-in="0.1 0.3"   fades in and rises at 0.1, leaves at 0.3 (one number: it stays); "0" is in from the start;
//                          data-ch-fade="0.02 0.012" sets how long it takes to come in and to leave (default 0.035)
//   data-ch-count          a number: data-from, data-to, data-at="a b", data-format (int, pad2, pad3, comma, clock,
//                          dec1, or one of the page's own formats)
//   data-ch-step="0.4"     gets .is-done once p passes 0.4; the last one passed also gets .is-now
//   data-ch-bar="a b"      gets --k, 0 → 1 across a..b, for bars and dials in CSS
//   data-ch-hint           leaves on the first scroll
// It also sets --p, --film, --dusk and --lit (each 0..1) on the section for anything else in CSS, and where the
// frame lies on the stage (--fx, --fy, --fw, --fh, in px), so a callout can sit on a part of the picture:
// left: calc(var(--fx) + var(--fw) * 0.62). Don't use the CSS `translate` property on data-ch-in elements: the
// engine moves them with it (transform stays free).
//
//   import { mountBuild } from "../engine/chantier.js";
//   const build = await mountBuild(document.querySelector(".ch"), {
//     frames: "frames",                    // frames/ on wide screens, frames-phone/ under 760 px
//     film: [0.03, 0.78],                  // where the film plays, in p
//     lit: { dusk: "img/dusk", src: "img/lit", at: [0.8, 0.96], split: 0.4, reveal: "rise", noise: 0.3 },
//     focus: [0.5, 0.5],                   // which part of the frame stays in view when the stage is narrower
//     phone: { mode: "band", zoom: 1.5, top: 0.1, focus: [[0, 0.62], [1, 0.5]] },   // or mode: "cover"
//     glide: 5200,                         // one scroll from the top plays the build by itself, in ms (or false)
//   });
//
// Evening: across lit.at, the first `split` share fades the dusk picture in, the rest switches the lights on
// (img/dusk.webp, img/lit.webp and their -phone versions; leave out dusk to go straight to the lights). reveal is
// rise (bottom first), fall, sweep (left first), sweep-left, radial (from `origin`, in frame units) or scatter;
// `noise` (0–1) breaks the order up and `cells` sets its grain (default 9 across the height; more is finer);
// `soft` widens the edge; `flicker` (0–0.2) keeps lit areas flickering gently, like candles. ?record turns smoothing and the glide off and exposes window.chantier.at(p) and
// .tick(dt) for frame-by-frame capture; ?p=0.6 opens the page at that point.
import { FrameSeq } from "./frames.js";

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const seg = (p, a, b) => clamp((p - a) / (b - a || 1e-6));
const smoothstep = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) ** 3;
const params = new URLSearchParams(location.search);
const RECORD = params.has("record");
const STILL = matchMedia("(prefers-reduced-motion: reduce)").matches;
const PHONE = 760;
const nums = (s) => (s ?? "").trim().split(/[\s,]+/).filter(Boolean).map(Number);

const FORMATS = {
  int: (v) => String(Math.round(v)),
  pad2: (v) => String(Math.round(v)).padStart(2, "0"),
  pad3: (v) => String(Math.round(v)).padStart(3, "0"),
  comma: (v) => Math.round(v).toLocaleString("en-US"),
  clock: (v) => { const m = Math.round(v) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; },
  dec1: (v) => v.toFixed(1),
};

// values along keyframes [[t, a, b…], …], eased between them
function along(keys, t) {
  if (!Array.isArray(keys[0])) return keys;
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let k = 1; k < keys.length; k++) {
    const [t1, ...v1] = keys[k], [t0, ...v0] = keys[k - 1];
    if (t <= t1) { const e = smoothstep(seg(t, t0, t1)); return v1.map((v, j) => v0[j] + (v - v0[j]) * e); }
  }
  return keys[keys.length - 1].slice(1);
}

function loadImage(src) {
  return new Promise((done) => { const im = new Image(); im.decoding = "async"; im.onload = () => done(im); im.onerror = () => done(null); im.src = src; });
}

// smooth value noise in 0..1 on a w × h grid, the same every time
function noiseField(w, h, cells = 9) {
  const gw = Math.ceil(cells * (w / h)) + 2, gh = cells + 2, g = new Float32Array(gw * gh);
  let s = 1234567;
  for (let i = 0; i < g.length; i++) { s = (s * 16807) % 2147483647; g[i] = s / 2147483647; }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = (x / w) * (gw - 2), gy = (y / h) * (gh - 2), x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = smoothstep(gx - x0), fy = smoothstep(gy - y0), at = (i, j) => g[j * gw + i];
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx, bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
    out[y * w + x] = top + (bot - top) * fy;
  }
  // stretch to the full 0..1 range
  let lo = 1, hi = 0;
  for (const v of out) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / (hi - lo || 1);
  return out;
}

export async function mountBuild(section, opts = {}) {
  const o = {
    frames: "frames", film: [0.03, 0.8], lit: null, focus: [0.5, 0.5], zoom: 1,
    phone: { mode: "band", zoom: 1.5, top: 0.1, focus: [0.5, 0.5] }, glide: 5200, smooth: 0.22, formats: {}, onUpdate: null,
    ...opts,
  };
  o.phone = { mode: "band", zoom: 1.5, top: 0.1, focus: [0.5, 0.5], ...(opts.phone ?? {}) };
  const formats = { ...FORMATS, ...o.formats };
  const stage = section.querySelector(".ch-stage") ?? section;
  const make = (cls) => { const c = document.createElement("canvas"); c.className = cls; c.setAttribute("aria-hidden", "true"); stage.prepend(c); return c; };
  const canvas = stage.querySelector(".ch-canvas") ?? make("ch-canvas");
  const back = stage.querySelector(".ch-back") ?? make("ch-back");
  const ctx = canvas.getContext("2d"), bctx = back.getContext("2d");
  const layer = document.createElement("canvas"), lctx = layer.getContext("2d");
  const ins = [...section.querySelectorAll("[data-ch-in]")].map((el) => {
    const [a, b] = nums(el.dataset.chIn), [fi = 0.035, fo = fi] = nums(el.dataset.chFade);
    return { el, a, b, fi, fo, last: -1 };
  });
  const counts = [...section.querySelectorAll("[data-ch-count]")].map((el) => ({ el, from: +(el.dataset.from ?? 0), to: +(el.dataset.to ?? 100), at: nums(el.dataset.at ?? "0 1"), fmt: formats[el.dataset.format ?? "int"] ?? formats.int, last: "" }));
  const steps = [...section.querySelectorAll("[data-ch-step]")].map((el) => ({ el, at: +el.dataset.chStep }));
  // where each step starts in the film, for rulers: --x, 0..1
  for (const s of steps) s.el.style.setProperty("--x", seg(s.at, o.film[0], o.film[1]).toFixed(4));
  const bars = [...section.querySelectorAll("[data-ch-bar]")].map((el) => ({ el, at: nums(el.dataset.chBar), last: -1 }));
  const hints = [...section.querySelectorAll("[data-ch-hint]")];
  const rise = () => parseFloat(getComputedStyle(section).getPropertyValue("--ch-rise")) || 56;

  let vw = innerWidth, vh = innerHeight, dpr = Math.min(2, devicePixelRatio || 1), phone = vw < PHONE, RISE = rise();
  let seq = null, litImg = null, duskImg = null, litFor = null, litNoise = null, mask = null, mctx = null;
  let shown = -1, target = 0, drawnKey = "", frameVars = "", time = 0, ready = false;

  async function loadFor(isPhone) {
    const dir = isPhone ? `${o.frames}-phone` : o.frames;
    seq = await FrameSeq.load(dir);
    if (!seq) throw new Error(`chantier: no ${dir}/manifest.json`);
    seq.onframe = (i) => { if (Math.abs(i - shown) < 2.5) { drawnKey = ""; kick(); } };
    await seq.first;
    seq.preload();
    if (o.lit) {
      litFor = isPhone;
      const sfx = isPhone ? "-phone" : "";
      loadImage(`${o.lit.src}${sfx}.webp`).then((im) => { if (litFor === isPhone) { litImg = im; drawnKey = ""; kick(); } });
      if (o.lit.dusk) loadImage(`${o.lit.dusk}${sfx}.webp`).then((im) => { if (litFor === isPhone) { duskImg = im; drawnKey = ""; kick(); } });
    }
  }

  // where the frame sits on the canvas, in canvas pixels, at film time t
  function rect(W, H, t) {
    const [iw, ih] = seq.meta.size;
    if (phone && o.phone.mode === "band") {
      const [fx] = along(o.phone.focus, t), w = W * o.phone.zoom, h = (w * ih) / iw;
      return { x: (W - w) * fx, y: H * o.phone.top, w, h, band: true };
    }
    const [fx, fy] = along(phone ? o.phone.focus : o.focus, t);
    const z = phone ? o.phone.zoom : o.zoom, s = Math.max(W / iw, H / ih) * z, w = iw * s, h = ih * s;
    return { x: (W - w) * fx, y: (H - h) * (fy ?? 0.5), w, h, band: false };
  }

  // the order lights come on in: a mask of the frame, opaque where lit
  let orderField = null, maskData = null;
  function litMask(k) {
    const L = o.lit, MW = 160, MH = Math.round((160 * seq.meta.size[1]) / seq.meta.size[0]);
    if (!mask) {
      // each mask pixel's turn, 0..1, worked out once: the reveal's order broken up by noise
      mask = document.createElement("canvas"); mask.width = MW; mask.height = MH; mctx = mask.getContext("2d");
      litNoise = noiseField(MW, MH, L.cells ?? 9);
      maskData = mctx.createImageData(MW, MH);
      orderField = new Float32Array(MW * MH);
      const n = L.noise ?? 0.25, [ox, oy] = L.origin ?? [0.5, 0.6], kind = L.reveal ?? "rise";
      const far = Math.max(Math.hypot(ox, oy), Math.hypot(1 - ox, oy), Math.hypot(ox, 1 - oy), Math.hypot(1 - ox, 1 - oy));
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
        const u = x / (MW - 1), v = y / (MH - 1), i = y * MW + x, nz = litNoise[i];
        const base = kind === "fall" ? v : kind === "sweep" ? u : kind === "sweep-left" ? 1 - u
          : kind === "radial" ? Math.hypot(u - ox, v - oy) / far : kind === "scatter" ? nz : 1 - v;
        orderField[i] = base * (1 - n) + nz * n;
      }
    }
    const d = maskData.data, soft = L.soft ?? 0.22, fl = STILL ? 0 : L.flicker ?? 0, reach = k * (1 + soft);
    for (let i = 0; i < orderField.length; i++) {
      let a = smoothstep(clamp((reach - orderField[i]) / soft));
      if (fl && a > 0) { const nz = litNoise[i]; a *= 1 - fl * (0.5 + 0.5 * Math.sin(time * (5.3 + nz * 4) + nz * 40)) * (0.6 + 0.4 * Math.sin(time * 1.7 + nz * 13)); }
      d[i * 4 + 3] = (a * 255) | 0;
    }
    mctx.putImageData(maskData, 0, 0);
    return mask;
  }

  // how far evening has come at p: the dusk fade, then the lights
  function evening(p) {
    if (!o.lit) return { k: 0, dusk: 0, lights: 0 };
    const k = seg(p, o.lit.at[0], o.lit.at[1]), split = o.lit.dusk ? o.lit.split ?? 0.4 : 0;
    return { k, dusk: split ? smoothstep(seg(k, 0, split)) : 0, lights: seg(k, split, 1) };
  }

  function draw(force) {
    if (!seq) return;
    const p = progressNow(), ev = evening(p), litK = ev.lights;
    const t = shown / Math.max(1, seq.count - 1);
    const key = `${shown.toFixed(3)}|${ev.k.toFixed(4)}|${canvas.width}|${phone}|${o.lit?.flicker && litK > 0 ? time.toFixed(2) : ""}`;
    if (key === drawnKey && !force) return;
    const W = canvas.width, H = canvas.height, r = rect(W, H, t);
    const i0 = Math.floor(shown), a = shown - i0, im0 = seq.get(i0);
    if (!im0) return;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(im0, r.x, r.y, r.w, r.h);
    const im1 = a > 0.02 && seq.ok(seq.images[i0 + 1]) ? seq.images[i0 + 1] : null;
    if (im1) { ctx.globalAlpha = a; ctx.drawImage(im1, r.x, r.y, r.w, r.h); ctx.globalAlpha = 1; }
    if (ev.dusk > 0 && duskImg) { ctx.globalAlpha = ev.dusk; ctx.drawImage(duskImg, r.x, r.y, r.w, r.h); ctx.globalAlpha = 1; }
    if (litK > 0 && litImg) {
      if (litK >= 1 && !o.lit.flicker) ctx.drawImage(litImg, r.x, r.y, r.w, r.h);
      else {
        if (layer.width !== W || layer.height !== H) { layer.width = W; layer.height = H; }
        lctx.globalCompositeOperation = "source-over";
        lctx.clearRect(0, 0, W, H);
        lctx.drawImage(litImg, r.x, r.y, r.w, r.h);
        lctx.globalCompositeOperation = "destination-in";
        lctx.imageSmoothingQuality = "high";
        lctx.drawImage(litMask(litK), r.x, r.y, r.w, r.h);
        lctx.globalCompositeOperation = "source-over";
        ctx.drawImage(layer, 0, 0);
      }
    }
    if (r.band) {
      // a phone: the frame in a wide band, faded at its top and bottom into a blurred copy that fills the screen
      ctx.globalCompositeOperation = "destination-in";
      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.14, "#000"); g.addColorStop(0.86, "#000"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      const bw = back.width, bh = back.height, [iw, ih] = seq.meta.size, s = Math.max(bw / iw, bh / ih) * 1.15;
      const bx = (bw - iw * s) / 2, by = (bh - ih * s) / 2;
      bctx.drawImage(im0, bx, by, iw * s, ih * s);
      if (ev.dusk > 0 && duskImg) { bctx.globalAlpha = ev.dusk; bctx.drawImage(duskImg, bx, by, iw * s, ih * s); }
      if (litK > 0 && litImg) { bctx.globalAlpha = litK; bctx.drawImage(litImg, bx, by, iw * s, ih * s); }
      bctx.globalAlpha = 1;
    }
    drawnKey = key;
    const fr = `${(r.x / dpr).toFixed(1)}|${(r.y / dpr).toFixed(1)}|${(r.w / dpr).toFixed(1)}|${(r.h / dpr).toFixed(1)}`;
    if (fr !== frameVars) {
      frameVars = fr;
      const [fx, fy, fw, fh] = fr.split("|");
      section.style.setProperty("--fx", `${fx}px`); section.style.setProperty("--fy", `${fy}px`);
      section.style.setProperty("--fw", `${fw}px`); section.style.setProperty("--fh", `${fh}px`);
    }
    if (!ready) { ready = true; api.ready = true; section.classList.add("ch-ready"); }
  }

  function progressNow() {
    const b = section.getBoundingClientRect();
    return clamp(-b.top / Math.max(1, b.height - vh));
  }

  function update(p) {
    const filmK = seg(p, o.film[0], o.film[1]), ev = evening(p), litK = ev.lights;
    target = filmK * (seq.count - 1);
    if (shown < 0 || RECORD || STILL) shown = target;
    section.style.setProperty("--p", p.toFixed(4));
    section.style.setProperty("--film", filmK.toFixed(4));
    section.style.setProperty("--dusk", ev.dusk.toFixed(4));
    section.style.setProperty("--lit", litK.toFixed(4));
    for (const it of ins) {
      const tin = it.a <= 0 ? 1 : seg(p, it.a, it.a + it.fi), tout = Number.isFinite(it.b) ? 1 - seg(p, it.b, it.b + it.fo) : 1;
      const v = Math.min(tin, tout);
      if (Math.abs(v - it.last) < 0.002 && v !== 0 && v !== 1) continue;
      if (v === it.last) continue;
      it.last = v;
      it.el.style.opacity = v.toFixed(3);
      it.el.style.translate = `0 ${((1 - easeOut(tin)) * RISE - (1 - tout) * RISE * 0.5).toFixed(1)}px`;
      it.el.style.visibility = v < 0.01 ? "hidden" : "";
      it.el.classList.toggle("is-in", v > 0.5);
    }
    for (const c of counts) {
      const s = c.fmt(c.from + (c.to - c.from) * seg(p, c.at[0], c.at[1]));
      if (s !== c.last) { c.el.textContent = s; c.last = s; }
    }
    let now = null;
    for (const s of steps) { const on = p >= s.at; s.el.classList.toggle("is-done", on); if (on) now = s; }
    for (const s of steps) s.el.classList.toggle("is-now", s === now);
    for (const b of bars) { const k = seg(p, b.at[0], b.at[1] ?? 1); if (k !== b.last) { b.el.style.setProperty("--k", k.toFixed(4)); b.last = k; } }
    for (const h of hints) h.style.opacity = (1 - seg(p, 0, 0.015)).toFixed(3);
    o.onUpdate?.({ p, film: filmK, dusk: ev.dusk, lit: litK, time });
    return litK;
  }

  // —— the loop: runs while the film catches up with the scroll, or while lit areas flicker ——
  let ticking = false, visible = true;
  function frame() {
    const p = progressNow(), litK = update(p);
    if (!RECORD && !STILL) shown += (target - shown) * o.smooth;
    if (Math.abs(target - shown) < 0.01) shown = target;
    draw();
    const flickering = !RECORD && !STILL && o.lit?.flicker && litK > 0 && visible;
    if (flickering) time += 1 / 60;
    if (Math.abs(target - shown) > 0.01 || flickering) requestAnimationFrame(frame);
    else ticking = false;
  }
  const kick = () => { if (!ticking && seq) { ticking = true; requestAnimationFrame(frame); } };

  function layout() {
    vw = innerWidth; vh = stage.clientHeight || innerHeight; dpr = Math.min(2, devicePixelRatio || 1); RISE = rise();
    canvas.width = Math.round(canvas.clientWidth * dpr); canvas.height = Math.round(canvas.clientHeight * dpr);
    back.width = 64; back.height = Math.max(1, Math.round((64 * vh) / vw));
    const isPhone = vw < PHONE;
    section.classList.toggle("ch-band", isPhone && o.phone.mode === "band");
    if (isPhone !== phone && seq) { phone = isPhone; litImg = duskImg = null; mask = null; shown = -1; loadFor(phone).then(() => { update(progressNow()); draw(true); }); return; }
    phone = isPhone;
    drawnKey = "";
    update(progressNow());
    draw(true);
  }

  // —— one scroll down from the top plays the build by itself, at an even pace (scrolling up stops it) ——
  let glide = null;
  const RAMP = 0.14;
  const glideEase = (t) => { const v = 1 / (1 - RAMP); if (t < RAMP) return (v * t * t) / (2 * RAMP); if (t > 1 - RAMP) return 1 - (v * (1 - t) ** 2) / (2 * RAMP); return v * (t - RAMP / 2); };
  const glideEnd = () => (o.glideTo ?? (o.lit ? o.lit.at[1] : o.film[1]));
  const atTop = () => progressNow() < 0.01 && section.getBoundingClientRect().top > -8 && section.getBoundingClientRect().top < 8;
  function autoGlide() {
    if (glide || !o.glide || RECORD || STILL) return false;
    const top = scrollY + section.getBoundingClientRect().top, from = scrollY, to = top + (section.offsetHeight - vh) * glideEnd();
    if (to - from < 40) return false;
    const t0 = performance.now(), g = (glide = { stop: false });
    const step = (t) => {
      if (g.stop) { glide = null; return; }
      const k = clamp((t - t0) / o.glide);
      scrollTo(0, from + (to - from) * glideEase(k));
      if (k < 1) requestAnimationFrame(step); else glide = null;
    };
    requestAnimationFrame(step);
    return true;
  }
  addEventListener("wheel", (e) => {
    if (glide) { if (e.deltaY < 0) glide.stop = true; else e.preventDefault(); return; }
    if (e.deltaY > 0 && atTop() && autoGlide()) e.preventDefault();
  }, { passive: false });
  let touchY = null;
  addEventListener("touchstart", (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  addEventListener("touchmove", (e) => {
    const dy = touchY == null ? 0 : touchY - e.touches[0].clientY;
    if (glide) { if (dy < -6) glide.stop = true; else e.preventDefault(); return; }
    if (dy > 6 && atTop() && autoGlide()) e.preventDefault();
  }, { passive: false });
  addEventListener("keydown", (e) => {
    if (!["ArrowDown", "PageDown", " "].includes(e.key) || e.target.closest?.("input, textarea, select, button, a")) return;
    if (atTop() && autoGlide()) e.preventDefault();
  });

  // options.focus and options.phone may be changed later: call redraw() after
  const api = {
    ready: false, section, options: o, record: RECORD,
    get size() { return seq?.meta.size; },
    get p() { return progressNow(); },
    // scroll to p and draw it once its frames have arrived (for recording and screenshots)
    async at(p) {
      const top = scrollY + section.getBoundingClientRect().top;
      scrollTo(0, top + (section.offsetHeight - vh) * p);
      update(progressNow());
      const want = [Math.floor(target), Math.min(seq.count - 1, Math.floor(target) + 1)].map((i) => seq.images[i]);
      for (const im of want) { if (!im._asked) { im._asked = true; im.src = im._src; } if (!seq.ok(im)) await new Promise((r) => { const t = setInterval(() => { if (seq.ok(im) || im.complete) { clearInterval(t); r(); } }, 20); }); }
      const ev = evening(p);
      if (ev.lights > 0) while (!litImg) await new Promise((r) => setTimeout(r, 30));
      if (ev.dusk > 0 && o.lit.dusk) while (!duskImg) await new Promise((r) => setTimeout(r, 30));
      shown = target;
      draw(true);
    },
    tick(dt) { time += dt; drawnKey = ""; update(progressNow()); draw(true); },
    redraw() { drawnKey = ""; kick(); },
  };
  window.chantier = api;

  await loadFor(phone);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(stage);
  addEventListener("scroll", kick, { passive: true });
  addEventListener("resize", layout);
  layout();
  if (params.has("p")) await api.at(clamp(+params.get("p")));
  return api;
}

// live clocks: elements with data-clock="Europe/Madrid" show that place's time (HH:MM), kept current
export function clocks(root = document) {
  const els = [...root.querySelectorAll("[data-clock]")];
  const tick = () => els.forEach((el) => { el.textContent = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: el.dataset.clock }).format(new Date()); });
  tick();
  if (els.length) setInterval(tick, 15000);
}

// fades in and lifts sections below the hero as they come into view: elements with data-reveal (and an optional
// --delay); ?record shows them at once
export function reveal(root = document) {
  const els = [...root.querySelectorAll("[data-reveal]")];
  if (RECORD || STILL) { els.forEach((el) => el.classList.add("is-shown")); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-shown"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -12% 0px" });
  els.forEach((el) => io.observe(el));
}
