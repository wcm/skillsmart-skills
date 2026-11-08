// Turntable: a subject turns on the spot while its pages scroll behind it.
//
// The page (index.html) holds a gallery ([data-gallery] with .item[data-subject] buttons, each with an <img>) and the
// detail ([data-detail] with one .page[data-subject] per subject, in order, then an optional .end). Every page gets its
// own fixed copy of the stage, clipped by the page's own shape (clip-path), so the line between two pages is also the
// line where one subject turns into the next. Frames come from frames/<id>/ (tools/frames.mjs).
//
//   start({ line: "straight" | "arc" | "slash" | "wave" | "zigzag",  the line between pages (drawn by CSS)
//           flood: "circle" | "rise" | "drop" | "tile",              how the page colour fills the screen on opening
//           gallery: "row" | "ring" | "lineup" | "tiles",            "ring" turns the items round an ellipse
//           snap: { ms: 1150 } | false,      one wheel/swipe/key = one whole eased turn to the next page
//           turn: 360, dir: 1, flick: false, ring: {…}, record: { subject, pages, rest, … } })
//
// window.turntable = { open(k), close(), next(), prev(), p, ready (every frame loaded), stages, turns }.
// ?record adds window.turntable.timeline = { duration, seek(t) } for frame-by-frame capture; ?subject=k opens one.
import { Loader, Turn } from "./frames.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;
const pad2 = (n) => String(n).padStart(2, "0");

export async function start(options = {}) {
  const o = { line: "straight", flood: "circle", gallery: "row", turn: 360, dir: 1, flick: false, dragDeg: 0.42, ...options };
  const S = o.snap === false ? null : { ms: 1150, ...o.snap };
  const html = document.documentElement, body = document.body;
  const params = new URLSearchParams(location.search);
  const recording = params.has("record");
  body.dataset.line = o.line;
  body.dataset.layout = o.gallery;
  if (S) body.dataset.snap = "on";
  html.classList.add("is-gallery");

  const gallery = $("[data-gallery]"), detail = $("[data-detail]");
  const pages = $$(".page[data-subject]", detail);
  const end = $(".end", detail);
  const items = $$(".item[data-subject]", gallery);
  const ids = pages.map((p) => p.dataset.subject);

  // ---- frames ----
  const turns = await Promise.all(ids.map((id) => Turn.load(`frames/${id}`)));
  const loader = new Loader(turns);
  const meta = turns.find(Boolean)?.meta ?? { w: 3, h: 4 };
  body.style.setProperty("--stage-ratio", meta.w / meta.h);
  if (meta.ground != null) body.style.setProperty("--ground", meta.ground / meta.h);
  if (meta.centre != null) body.style.setProperty("--ground", meta.centre / meta.h);
  for (const it of items) {
    const img = $("img", it);
    if (img && !img.getAttribute("src")) img.src = `frames/${it.dataset.subject}/001.webp`;
  }

  // a wavy line (three waves across) or a torn-receipt zigzag (fine teeth): written once as a polygon, its height --wave
  const teeth = 36;
  const wave = o.line === "zigzag" ? (x) => Math.abs(((x * teeth) % 1) - 0.5) * 2 : (x) => 0.5 - 0.5 * Math.cos(x * 2 * Math.PI * 3);
  if (o.line === "wave" || o.line === "zigzag") {
    const n = o.line === "zigzag" ? teeth * 2 : 60;
    const pts = Array.from({ length: n + 1 }, (_, i) => `${(i / n) * 100}% calc(var(--wave) * ${wave(i / n).toFixed(4)})`);
    body.style.setProperty("--wave-path", `polygon(${pts.join(", ")}, 100% 100%, 0 100%)`);
    body.dataset.line = "wave";
  }

  // ---- a fixed stage inside every page ----
  const stages = pages.map((page, i) => {
    const stage = document.createElement("div");
    stage.className = "stage";
    stage.innerHTML = `<div class="stage-box"><div class="base"></div><div class="shadow"></div><canvas></canvas><div class="fore"></div></div>`;
    page.prepend(stage);
    // a page's own props join its stage: data-stage="back" behind the subject, "front" over it (they swap with it)
    const box = $(".stage-box", stage);
    for (const el of $$("[data-stage]", page)) {
      if (el.dataset.stage === "front") box.append(el);
      else box.insertBefore(el, $(".shadow", box));
    }
    const canvas = $("canvas", stage);
    const s = { i, page, stage, box: $(".stage-box", stage), canvas, ctx: canvas.getContext("2d"), turn: turns[i], key: null, words: $(".words", page) };
    if (s.turn) s.turn.onframe = () => { dirty = true; };
    return s;
  });

  const grab = document.createElement("div");
  grab.className = "grab";
  grab.setAttribute("aria-hidden", "true");
  body.append(grab);

  // ---- geometry ----
  let tops = [], focal = 0, dpr = 1;
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:0";
  body.append(probe);
  const px = (v) => { probe.style.height = `var(${v}, 0px)`; return probe.getBoundingClientRect().height; };

  // the line's height below the page's top at the subject's axis
  function edge() {
    const W = innerWidth, box = stages[0]?.box.getBoundingClientRect();
    const x = box ? box.left + box.width / 2 : W / 2;
    if (o.line === "slash") return px("--slash") * (1 - x / W);
    if (o.line === "arc") { const t = clamp((x - W / 2) / (W / 2), -1, 1); return px("--arc") * (1 - Math.sqrt(1 - t * t)); }
    if (o.line === "wave" || o.line === "zigzag") return px("--wave") * wave(x / W);
    return 0;
  }

  function measure() {
    const y0 = scrollY, e = edge();
    tops = pages.map((pg, i) => pg.getBoundingClientRect().top + y0 + (i ? e : 0));
    const last = pages.at(-1).getBoundingClientRect();
    tops.push(end ? end.getBoundingClientRect().top + y0 + e : last.bottom + y0);
    const box = stages[0].box.getBoundingClientRect();
    focal = box.top + box.height / 2;
    dpr = Math.min(2, devicePixelRatio || 1);
    for (const s of stages) {
      const w = Math.round(box.width * dpr), h = Math.round(box.height * dpr);
      if (s.canvas.width !== w || s.canvas.height !== h) { s.canvas.width = w; s.canvas.height = h; s.key = null; }
      // the words stick centred, so they need their own height
      if (s.words) s.words.style.setProperty("--wh", `${s.words.offsetHeight}px`);
    }
    dirty = true;
  }

  // scroll → progress p: p = i when page i's middle is at the stage, i ± 0.5 when a line crosses it
  function progress(y) {
    const f = y + focal, n = pages.length;
    if (f < tops[0]) return -0.5 - (tops[0] - f) / (tops[1] - tops[0]);
    for (let i = 0; i < n; i++) if (f < tops[i + 1]) return i - 0.5 + (f - tops[i]) / (tops[i + 1] - tops[i]);
    return n - 0.5 + (f - tops[n]) / (tops[n] - tops[n - 1]);
  }
  function scrollFor(p) {
    const n = pages.length, i = clamp(Math.floor(p + 0.5), 0, n - 1);
    return tops[i] + (p - i + 0.5) * (tops[i + 1] - tops[i]) - focal;
  }

  // ---- drawing ----
  let dirty = true, offset = 0, vel = 0, dragging = false, settleUntil = 0, P = 0;
  const phone = matchMedia("(max-width: 760px)");
  const now = document.querySelector("[data-now]");

  // where in its frames a subject is, a fraction t of a turn in: the films slow down near the front, so t is spread
  // over the frames by how much each one actually moves (manifest.cum); the easing then comes from the scroll alone
  function framePos(turn, t) {
    const c = turn.meta.cum, n = turn.count;
    if (!c) return t * n;
    let lo = 0, hi = n;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (c[mid] <= t) lo = mid; else hi = mid; }
    return lo + (t - c[lo]) / Math.max(1e-6, c[lo + 1] - c[lo]);
  }

  function render() {
    const p = (P = progress(scrollY));
    const n = pages.length;
    for (const s of stages) {
      const q = p - s.i;
      if (q < -1.1 || q > 1.1) continue;
      const turn = s.turn;
      if (turn) {
        let t = (q * o.turn + offset) / 360;
        t -= Math.floor(t);
        // between two frames, the next one fades in over the last, so the turn stays smooth at any speed
        let x = framePos(turn, o.dir < 0 ? 1 - t : t);
        x = ((x % turn.count) + turn.count) % turn.count;
        const k = Math.floor(x), f = x - k;
        const a = turn.get(k), b = f > 0.04 ? turn.get(k + 1) : null;
        const key = `${a?.src}|${b === a ? "" : b?.src}|${b ? f.toFixed(2) : ""}`;
        if (a && key !== s.key) {
          s.ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
          s.ctx.globalAlpha = 1;
          s.ctx.drawImage(a, 0, 0, s.canvas.width, s.canvas.height);
          if (b && b !== a) { s.ctx.globalAlpha = f; s.ctx.drawImage(b, 0, 0, s.canvas.width, s.canvas.height); s.ctx.globalAlpha = 1; }
          s.key = key;
        }
        s.page.style.setProperty("--angle", `${(t * 360).toFixed(1)}deg`);
      }
      s.page.style.setProperty("--q", q.toFixed(4));
      // words: arrive with a short rise, leave with a fade (sooner on phones, where they pass over the subject)
      const fade = phone.matches ? 1 - smooth(0.1, 0.26, q) : 1 - smooth(0.3, 0.5, q);
      const rise = q < 0 ? smooth(-0.3, -0.5, q) * 48 : -smooth(0.3, 0.5, q) * 24;
      s.page.style.setProperty("--fade", fade.toFixed(3));
      s.page.style.setProperty("--rise", `${rise.toFixed(1)}px`);
      // --arrive: 1 while the page rests, 0 by the time a line crosses (props fly in with it);
      // --grey: 1 while the subject turns, 0 once it faces front (a colour pop on arrival)
      s.page.style.setProperty("--arrive", (1 - smooth(0, 0.5, Math.abs(q))).toFixed(3));
      s.page.style.setProperty("--grey", smooth(0.06, 0.3, Math.abs(q)).toFixed(3));
    }
    if (now) now.textContent = pad2(clamp(Math.round(p), 0, n - 1) + 1);
    body.style.setProperty("--p", p.toFixed(4));
  }

  // drag and flick turn the subject on top of the scroll; moving to another page eases it back
  function tick(dt) {
    if (dragging) return;
    if (Math.abs(vel) > 0.004) {
      offset += vel * dt;
      vel *= (o.flick ? 0.9968 : 0.992) ** dt;
      dirty = true;
    } else if (vel) vel = 0;
    else if (performance.now() < settleUntil) {
      const target = Math.round(offset / 360) * 360, d = target - offset;
      if (Math.abs(d) > 0.1) { offset += d * (1 - 0.99 ** dt); dirty = true; } else offset = target;
    }
  }
  let lx = 0, lt = 0;
  grab.addEventListener("pointerdown", (e) => {
    dragging = true; lx = e.clientX; lt = e.timeStamp; vel = 0;
    grab.setPointerCapture(e.pointerId);
    body.classList.add("is-dragging");
  });
  grab.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lx, dt = Math.max(1, e.timeStamp - lt);
    offset += dx * o.dragDeg * o.dir;
    vel = 0.75 * vel + 0.25 * ((dx * o.dragDeg * o.dir) / dt);
    lx = e.clientX; lt = e.timeStamp;
    dirty = true;
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    body.classList.remove("is-dragging");
    if (!o.flick) vel *= 0.3;
  };
  grab.addEventListener("pointerup", release);
  grab.addEventListener("pointercancel", release);
  addEventListener("resize", () => { measure(); layoutRing(); if (S && html.classList.contains("is-detail")) scrollTo(0, stopY(stopAt(scrollY))); });

  // ---- snapping: one gesture = one whole turn to the next page, eased; it never rests halfway ----
  let snapping = null, idle = 0;
  const stopList = () => [...pages.map((_, i) => scrollFor(i)), ...(end ? [end.getBoundingClientRect().top + scrollY] : [])];
  const stopY = (k) => stopList()[clamp(k, 0, stopList().length - 1)];
  const stopAt = (y) => { const l = stopList(); let best = 0; l.forEach((v, i) => { if (Math.abs(v - y) < Math.abs(l[best] - y)) best = i; }); return best; };
  const inDetail = () => html.classList.contains("is-detail") && !busy;
  function snapTo(k, ms = S.ms) {
    const l = stopList();
    k = clamp(k, 0, l.length - 1);
    const from = scrollY, to = l[k];
    if (Math.abs(to - from) < 1) return;
    snapping = { k, from, to, t0: performance.now(), ms };
    settleUntil = performance.now() + ms + 700;
    loader.focus(Math.min(k, pages.length - 1));
  }
  const step = (dir) => snapTo((snapping ? snapping.k : stopAt(scrollY)) + dir);

  if (S) {
    let lastT = 0, lastA = 0;
    addEventListener("wheel", (e) => {
      if (!inDetail()) return;
      e.preventDefault();
      const d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
      const a = Math.abs(d), gap = e.timeStamp - lastT;
      // A new gesture: a push that speeds up, or anything after a real quiet. The fading momentum of a trackpad swipe
      // only ever gets weaker (a busy page may deliver it with gaps), so it never starts another turn.
      const fresh = (a > lastA * 1.4 && a > 10) || gap > 600;
      lastT = e.timeStamp; lastA = a;
      if (snapping || !fresh || a < 4) return;
      step(d > 0 ? 1 : -1);
    }, { passive: false });
    let ty = null, tx = 0;
    addEventListener("touchstart", (e) => { if (inDetail()) { ty = e.touches[0].clientY; tx = e.touches[0].clientX; } }, { passive: true });
    addEventListener("touchmove", (e) => { if (inDetail() && !dragging) e.preventDefault(); }, { passive: false });
    addEventListener("touchend", (e) => {
      if (ty == null) return;
      const dy = ty - e.changedTouches[0].clientY, dx = tx - e.changedTouches[0].clientX;
      ty = null;
      if (!dragging && Math.abs(dy) > 36 && Math.abs(dy) > Math.abs(dx) * 1.2 && !snapping) step(dy > 0 ? 1 : -1);
    });
    addEventListener("keydown", (e) => {
      if (!inDetail() || e.target.closest?.("input, textarea")) return;
      const k = { ArrowDown: 1, PageDown: 1, " ": 1, ArrowUp: -1, PageUp: -1 }[e.key];
      if (k) { e.preventDefault(); if (!snapping) step(e.shiftKey && e.key === " " ? -1 : k); }
      if (e.key === "Home") { e.preventDefault(); snapTo(0); }
      if (e.key === "End") { e.preventDefault(); snapTo(stopList().length - 1); }
    });
  }
  // any other scroll (the scrollbar, find in page) lands on the nearest page once it stops
  addEventListener("scroll", () => {
    dirty = true;
    settleUntil = performance.now() + 700;
    if (!S || snapping || !inDetail() || recording) return;
    clearTimeout(idle);
    idle = setTimeout(() => { if (!snapping && inDetail()) snapTo(stopAt(scrollY), 650); }, 160);
  }, { passive: true });

  // ---- the ring gallery: items round an ellipse, slowly turning ----
  let rot = 0, ringSpin = !recording;
  function layoutRing() {
    if (o.gallery !== "ring") return;
    const W = gallery.clientWidth, H = gallery.clientHeight, n = items.length;
    const R = { cx: 0.5, cy: 0.56, rx: 0.36, ry: 0.22, back: 0.62, ...o.ring };
    items.forEach((it, j) => {
      const a = rot + (j * 2 * Math.PI) / n;
      const depth = (Math.sin(a) + 1) / 2;
      const s = R.back + (1 - R.back) * depth;
      it.style.transform = `translate(${W * R.cx + W * R.rx * Math.cos(a)}px, ${H * R.cy + H * R.ry * Math.sin(a)}px) translate(-50%, -50%) scale(${s})`;
      it.style.zIndex = String(Math.round(depth * 100));
      it.style.setProperty("--depth", depth.toFixed(3));
    });
  }
  // the angle that brings item j to the front, nearest to where the ring is now
  const frontRot = (j) => { const t = Math.PI / 2 - (j * 2 * Math.PI) / items.length; return t + Math.round((rot - t) / (2 * Math.PI)) * 2 * Math.PI; };

  // ---- opening and closing ----
  let busy = false, open = -1;

  function floodShape(kind, from) {
    const W = innerWidth, H = innerHeight;
    const dTop = detail.getBoundingClientRect().top, vTop = -dTop;
    const r = from.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const R = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));
    if (kind === "rise") return (u) => `inset(${vTop + (1 - u) * H}px 0 0 0)`;
    if (kind === "drop") return (u) => `inset(0 0 ${detail.offsetHeight - (vTop + u * H)}px 0)`;
    if (kind === "tile") {
      const rad = parseFloat(getComputedStyle(from).borderRadius) || 0;
      return (u) => {
        const v = 1 - u;
        return `inset(${vTop + r.top * v}px ${(W - r.right) * v}px ${detail.offsetHeight - vTop - H + (H - r.bottom) * v}px ${r.left * v}px round ${rad * v}px)`;
      };
    }
    return (u) => `circle(${R * u}px at ${cx}px ${cy - dTop}px)`;
  }

  // the flight between a gallery item and the stage, as a function of u (0 = in the gallery, 1 = on the stage), so a
  // recording can seek it; used forwards to open and backwards to close
  function flight(k) {
    const item = items.find((it) => it.dataset.subject === ids[k]) ?? items[k];
    const thumb = $("img", item);
    const s = stages[k];
    const r0 = thumb.getBoundingClientRect(), r1 = s.box.getBoundingClientRect();
    const flyer = thumb.cloneNode();
    flyer.className = "flyer";
    Object.assign(flyer.style, { left: `${r1.left}px`, top: `${r1.top}px`, width: `${r1.width}px`, height: `${r1.height}px` });
    body.append(flyer);
    thumb.style.visibility = "hidden";
    s.canvas.style.opacity = "0";
    const flood = floodShape(o.flood, o.flood === "tile" ? item : thumb);
    const others = items.filter((it) => it !== item);
    return {
      set(u) {
        const e = easeInOut(clamp(u / 0.92));
        const sx = r0.width / r1.width, sy = r0.height / r1.height;
        flyer.style.transform = `translate(${(r0.left - r1.left) * (1 - e)}px, ${(r0.top - r1.top) * (1 - e)}px) scale(${sx + (1 - sx) * e}, ${sy + (1 - sy) * e})`;
        detail.style.clipPath = flood(easeOut(clamp(u / 0.8)));
        for (const it of others) it.style.opacity = String(1 - smooth(0, 0.4, u));
        gallery.style.opacity = String(1 - smooth(0.45, 0.85, u));
        if (s.words) { s.words.style.opacity = String(smooth(0.5, 1, u)); s.words.style.translate = `0 ${(1 - easeOut(clamp((u - 0.5) / 0.5))) * 48}px`; }
      },
      clear() {
        flyer.remove();
        thumb.style.visibility = "";
        s.canvas.style.opacity = "";
        detail.style.clipPath = "";
        gallery.style.opacity = "";
        for (const it of others) it.style.opacity = "";
        if (s.words) { s.words.style.opacity = ""; s.words.style.translate = ""; }
        html.classList.remove("is-opening");
      },
    };
  }

  function opening(k) {
    html.classList.add("is-opening");
    html.classList.remove("is-gallery");
    measure();
    scrollTo(0, scrollFor(k));
    measure();
    render();
    loader.focus(k);
    const f = flight(k);
    return { set: f.set, done() { f.clear(); html.classList.add("is-detail"); open = k; dirty = true; } };
  }

  function closing(k) {
    html.classList.remove("is-detail");
    html.classList.add("is-opening");
    gallery.style.opacity = "0";
    if (o.gallery === "ring") { rot = frontRot(k); layoutRing(); }
    const f = flight(k);
    return {
      set: (u) => f.set(1 - u),
      done() { f.clear(); html.classList.add("is-gallery"); open = -1; ringSpin = !recording; scrollTo(0, 0); },
    };
  }

  // runs fn(u) from 0 to 1 over ms; finishes on time even when the tab stops drawing frames (hidden tabs pause them)
  function play(ms, fn) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      let finished = false;
      const finish = () => { if (finished) return; finished = true; fn(1); resolve(); };
      const go = (t) => { if (finished) return; const u = clamp((t - t0) / ms); if (u >= 1) return finish(); fn(u); requestAnimationFrame(go); };
      requestAnimationFrame(go);
      setTimeout(finish, ms + 120);
    });
  }

  async function openSubject(k) {
    if (busy) return;
    busy = true;
    if (o.gallery === "ring") {
      ringSpin = false;
      const r0 = rot, r1 = frontRot(k);
      if (Math.abs(r1 - r0) > 0.01) await play(650, (u) => { rot = r0 + (r1 - r0) * easeInOut(u); layoutRing(); });
    }
    const plan = opening(k);
    await play(o.openMs ?? 1100, plan.set);
    plan.done();
    busy = false;
  }

  async function closeSubject() {
    if (busy || open < 0) return;
    busy = true;
    snapping = null;
    const k = clamp(Math.round(P), 0, pages.length - 1);
    // turn to face the visitor first, then fly home
    const y0 = scrollY, y1 = scrollFor(k);
    if (Math.abs(y1 - y0) > 2 || Math.abs(offset % 360) > 1) {
      const o0 = offset, o1 = Math.round(offset / 360) * 360;
      await play(450, (u) => { const e = easeInOut(u); scrollTo(0, y0 + (y1 - y0) * e); offset = o0 + (o1 - o0) * e; render(); });
      offset = Math.round(offset / 360) * 360;
    }
    const plan = closing(k);
    await play(900, plan.set);
    plan.done();
    busy = false;
  }

  items.forEach((it) => it.addEventListener("click", () => openSubject(Math.max(0, ids.indexOf(it.dataset.subject)))));
  for (const b of $$("[data-index]")) b.addEventListener("click", closeSubject);
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeSubject(); });

  // ---- run ----
  measure();
  layoutRing();
  loader.focus(0);
  await Promise.all(turns.filter(Boolean).map((t) => new Promise((r) => {
    const im = t.images[0];
    if (t.ok(im)) return r();
    im.addEventListener("load", r, { once: true });
    im.addEventListener("error", r, { once: true });
  })));

  let last = performance.now();
  const frame = (t) => {
    const dt = Math.min(64, t - last);
    last = t;
    if (!recording) {
      if (snapping) {
        const u = clamp((t - snapping.t0) / snapping.ms);
        scrollTo(0, snapping.from + (snapping.to - snapping.from) * easeInOut(u));
        if (u >= 1) snapping = null;
        dirty = true;
      }
      tick(dt);
      if (ringSpin && o.gallery === "ring" && html.classList.contains("is-gallery")) { rot += dt * (o.ring?.speed ?? 0.00006); layoutRing(); }
      if (dirty) { dirty = false; render(); }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // ready: resolves once every frame of every subject has loaded (checks and recordings wait on it)
  let all = null;
  const api = { open: openSubject, close: closeSubject, next: () => step(1), prev: () => step(-1), get p() { return P; }, get ready() { return (all ??= loader.all()); }, stages, turns };
  window.turntable = api;

  if (params.has("subject")) {
    const k = clamp(Number(params.get("subject")), 0, pages.length - 1);
    const plan = opening(k);
    plan.set(1);
    plan.done();
  }

  // ---- recording: a fixed script, seekable frame by frame. The gallery, an opening, then page after page: a rest,
  // one snapped turn; at the end it flies back to the gallery, so the clip loops ----
  if (recording) {
    await loader.all();
    const R = { subject: 1, pages: 4, hold: 1.2, open: 1.25, rest: 0.95, snap: S?.ms / 1000 || 1.15, close: 1.0, end: 0.7, ...o.record };
    // a short page: start on a subject that exists and turn only as far as the last page
    R.subject = clamp(R.subject, 0, pages.length - 1);
    R.pages = clamp(R.pages, 0, pages.length - 1 - R.subject);
    const tOpen = R.hold, tPages = tOpen + R.open;
    const tClose = tPages + R.pages * (R.rest + R.snap) + R.rest;
    const ringAt = R.gallery === "ring" || o.gallery === "ring";
    let plan = null, opened = false, back = null, closed = false, ring0 = null;
    const rot0 = rot;
    api.timeline = {
      duration: tClose + R.close + R.end,
      // when things happen, for checks: the opening starts at open, the first page rests from pages, each page is a
      // rest then a snap (cycle), the flight home starts at close
      marks: { open: tOpen, pages: tPages, rest: R.rest, snap: R.snap, cycle: R.rest + R.snap, turns: R.pages, close: tClose, closing: R.close },
      seek(t) {
        if (t < tOpen) {
          if (ringAt) { rot = rot0 + t * 1000 * (o.ring?.speed ?? 0.00006); layoutRing(); }
          return;
        }
        if (!opened) {
          let t1 = tOpen;
          if (ringAt) {
            // the ring brings the subject to the front during the first part of the opening
            ring0 ??= rot;
            const r1 = frontRot(R.subject);
            const u = clamp((t - tOpen) / (R.open * 0.45));
            rot = ring0 + (r1 - ring0) * easeInOut(u);
            layoutRing();
            if (u < 1) return;
            t1 = tOpen + R.open * 0.45;
          }
          plan ??= opening(R.subject);
          const u = clamp((t - t1) / (tPages - t1));
          plan.set(u);
          if (u >= 1) { plan.done(); opened = true; }
          return;
        }
        if (t < tClose) {
          // rest, turn, rest, turn …
          const local = t - tPages, cycle = R.rest + R.snap;
          const i = Math.min(R.pages, Math.floor(local / cycle));
          const u = i >= R.pages ? 0 : clamp((local - i * cycle - R.rest) / R.snap);
          scrollTo(0, scrollFor(R.subject + i + easeInOut(u)));
          render();
          return;
        }
        if (!closed) {
          back ??= closing(R.subject + R.pages);
          const u = clamp((t - tClose) / R.close);
          back.set(u);
          if (u >= 1) { back.done(); closed = true; }
          return;
        }
        if (ringAt) { rot += (1 / 30) * 1000 * (o.ring?.speed ?? 0.00006); layoutRing(); }
      },
    };
  }
  return api;
}
