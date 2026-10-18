// Exploded View engine: one product, three scenes, scrubbed by scroll.
//   1  the photo of it in its first place, the words on the left
//   2  it lifts out of the photo, the place gives way to a lab, it comes apart (clip a) and the labels draw in
//   3  it comes back together while turning (clip b), lands in its second place on the left, the words come in on the right
// A page is index.html (fonts, colours) + page.json (words, parts, lab) + what tools/build.mjs writes next to it:
// layout.json, img/ and frames/. Every picture of the product goes through one transform from stage pixels (the 16:9
// frame the clips, studio frames and exploded view share) to the screen, so photo, cut-outs and clips line up exactly.
//
// window.explode, once the page is up:
//   seek(p)    jump to a point of the scroll (0–1) and draw it at once, without the easing (checks, screenshots)
//   progress   the point being shown
//   ready      a promise that resolves when every frame of both clips has loaded (recorders wait for it)
//   timeline   a copy of T below, so checks can find each moment

import { FrameSeq } from "./frames.js";
import { labs } from "./labs.js";

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (p, [a, b]) => clamp((p - a) / (b - a));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const lines = (s) => esc(s).replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/\n/g, "<br>");

// the timeline, as fractions of the scroll through the stage. Nothing waits: the product starts to move on the first
// scroll, the labels leave as soon as the last one is in, and the scroll ends as the second scene's words arrive.
const T = {
  copy1: [0, 0.06],        // scene 1's words leave
  photo1: [0, 0.015],      // the photo gives way to its empty place with the cut-out on top, before anything moves
  lift: [0.015, 0.185],    // the cut-out flies from the photo to the middle
  labIn: [0.045, 0.185],
  explode: [0.16, 0.435],  // clip a
  head2: [0.185, 0.27],
  chart: [0.285, 0.435],
  labels: [0.395, 0.56],
  out2: [0.56, 0.62],      // labels, header and chart leave
  rebuild: [0.585, 0.86],  // clip b
  land: [0.635, 0.885],    // the middle → the second place
  labOut: [0.71, 0.87],
  photo2: [0.885, 0.935],
  copy3: [0.895, 0.985],
};
const SWAP = 0.012;        // how long one picture of the product takes to hand over to the next

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const json = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); };
const image = (src) => new Promise((ok) => { const im = new Image(); im.decoding = "async"; im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; });

function copyBlock(c, side, heading) {
  const b = el("section", `e-copy e-copy-${side}`);
  b.innerHTML = `
    <p class="e-kicker">${esc(c.kicker)}</p>
    <${heading} class="e-title">${lines(c.title)}</${heading}>
    <p class="e-body">${esc(c.body)}</p>
    <div class="e-actions"><a class="e-btn e-btn-main" href="${esc(c.href ?? "#")}">${esc(c.cta)}</a>${c.ghost ? `<a class="e-btn e-btn-ghost" href="${esc(c.ghostHref ?? "#")}">${esc(c.ghost)}</a>` : ""}</div>
    ${c.meta ? `<ul class="e-meta">${c.meta.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}`;
  return b;
}

function photoLayer(src, cls) {
  const wrap = el("div", `e-photo ${cls}`);
  const back = el("img", "e-photo-back"), front = el("img", "e-photo-front");
  back.src = front.src = src;
  back.alt = front.alt = "";
  wrap.append(back, front);
  return { wrap, front };
}

export async function boot() {
  let page, L;
  try { [page, L] = await Promise.all([json("page.json"), json("layout.json")]); }
  catch (e) {
    // before tools/build.mjs has run there is nothing to show yet
    document.body.append(el("p", "e-missing", `This page's pictures aren't built yet (${esc(e.message)}). Run <code>node build.mjs &lt;id&gt;</code> in <code>tools/</code>.`));
    throw e;
  }
  const [SW, SH] = L.stage;
  const lab = labs[page.lab.style];
  document.body.classList.add(`lab-${page.lab.style}`);
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // —— the page ——
  const nav = el("header", "e-nav", `
    <a class="e-brand" href="#">${esc(page.brand)}</a>
    <nav class="e-links">${page.nav.map((n) => `<a href="#">${esc(n)}</a>`).join("")}</nav>
    <a class="e-btn e-btn-nav" href="#">${esc(page.navCta)}</a>`);
  const scroll = el("main", "e-scroll");
  const stage = el("div", "e-stage");
  const p1 = photoLayer("img/place1.webp", "e-place1"), q1 = photoLayer("img/plate1.webp", "e-plate1");
  const p2 = photoLayer("img/place2.webp", "e-place2"), q2 = photoLayer("img/plate2.webp", "e-plate2");
  p1.front.alt = page.one.alt ?? ""; p2.front.alt = page.three.alt ?? "";
  const labBg = el("div", "e-lab-bg"), labFg = el("div", "e-lab-fg");
  const canvas = el("canvas", "e-canvas");
  canvas.setAttribute("aria-hidden", "true");
  const labelLayer = el("div", "e-labels");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  labelLayer.append(svg);
  const scrim1 = el("div", "e-scrim e-scrim-1"), scrim3 = el("div", "e-scrim e-scrim-3");
  const copy1 = copyBlock(page.one, "left", "h1"), copy3 = copyBlock(page.three, "right", "h2");
  const head2 = el("div", "e-head2", `<p class="e-kicker">${esc(page.two.kicker)}</p><h2 class="e-title2">${lines(page.two.title)}</h2>`);
  const hint = el("div", "e-hint", `<span>${esc(page.one.hint ?? "Scroll to take it apart")}</span><i></i>`);
  const note2 = el("div", "e-note2", esc(page.two.note ?? "Keep scrolling to put it back together"));
  const legend = el("ol", "e-legend");
  stage.append(q1.wrap, q2.wrap, labBg, canvas, p1.wrap, p2.wrap, labFg, labelLayer, scrim1, scrim3, copy1, copy3, head2, hint, note2, legend);
  scroll.append(stage);
  const steps = el("ol", "e-steps", page.steps.map((s, i) => `<li><b>0${i + 1}</b><span>${esc(s)}</span></li>`).join(""));
  document.body.append(nav, scroll, steps);
  if (page.footer) document.body.append(el("footer", "e-foot", `<p>${esc(page.footer)}</p>`));

  // parts: a dot, a leader and a label each; on a phone, numbered dots and a legend
  const NS = "http://www.w3.org/2000/svg";
  const parts = page.parts.map((pt, i) => {
    const line = document.createElementNS(NS, "polyline");
    const dot = document.createElementNS(NS, "circle");
    const num = document.createElementNS(NS, "text");
    line.setAttribute("class", "e-leader"); dot.setAttribute("class", "e-dot"); num.setAttribute("class", "e-num");
    dot.setAttribute("r", 4.5);
    num.textContent = i + 1;
    svg.append(line, dot, num);
    const label = el("div", `e-label e-label-${pt.side}`, `<b class="e-label-n">${String(i + 1).padStart(2, "0")}</b><strong>${esc(pt.name)}</strong><span>${esc(pt.spec)}</span>`);
    labelLayer.append(label);
    legend.append(el("li", null, `<strong>${esc(pt.name)}</strong> ${esc(pt.spec)}`));
    return { ...pt, line, dot, num, label };
  });

  // —— pictures of the product ——
  const [cut1, cut2, cutx] = await Promise.all(["img/cut1.webp", "img/cut2.webp", "img/cutx.webp"].map(image));
  const [A, B] = await Promise.all([FrameSeq.load("frames/a"), FrameSeq.load("frames/b")]);
  // clip a first (it plays first), then clip b
  const loaded = (A ? A.preload() : Promise.resolve()).then(() => B?.preload());

  const ctx = canvas.getContext("2d");
  const labApi = { page, bg: labBg, fg: labFg, stage: L.stage, toScreen: () => [0, 0] };
  const labView = lab(labApi);

  // —— layout: everything that depends on the window ——
  let vw, vh, mobile, dpr, R1, R2, Rc, r1, r2;
  // where a photo goes: covering the window, pushed away from the words (`side` is where the product sits) while the
  // product stays whole; on a phone it shrinks until the product fits across the screen and a blurred copy fills the rest
  function photoRect([pw, ph], box, side) {
    const cover = Math.max(vw / pw, vh / ph);
    const s = Math.min(cover, mobile ? (vw * 0.82) / box[2] : (vw * 0.5) / box[2]);
    const w = pw * s, h = ph * s;
    const cx = (box[0] + box[2] / 2) * s, cy = (box[1] + box[3] / 2) * s;
    let x = side === "right" ? 0 : vw - w, y = (vh - h) / 2;
    if (mobile) { x = vw / 2 - cx; y = vh * 0.62 - cy; }
    else {
      const m = vw * 0.04, left = x + box[0] * s, right = x + (box[0] + box[2]) * s;
      if (right > vw - m) x -= right - (vw - m);
      if (left < m) x += m - left;
    }
    if (w >= vw) x = clamp(x, vw - w, 0);
    if (h >= vh) y = clamp(y, vh - h, 0);
    return { x, y, s, w, h };
  }
  // the stage transform that lays a cut-out (at `st` in the stage) exactly over the product (at `box` in the photo)
  const align = (r, box, st) => { const s = (box[2] * r.s) / st[2]; return { x: r.x + box[0] * r.s - st[0] * s, y: r.y + box[1] * r.s - st[1] * s, s }; };
  function centre() {
    const a = mobile ? page.stage.mobile : page.stage.area;
    const pad = 0.04, b = L.cutx.stage;
    const c = [b[0] - b[2] * pad, b[1] - b[3] * pad, b[2] * (1 + 2 * pad), b[3] * (1 + 2 * pad)];
    const ax = a[0] * vw, ay = a[1] * vh, aw = a[2] * vw, ah = a[3] * vh;
    const s = Math.min(aw / c[2], ah / c[3]);
    return { x: ax + aw / 2 - (c[0] + c[2] / 2) * s, y: ay + ah / 2 - (c[1] + c[3] / 2) * s, s };
  }
  const place = (front, r) => Object.assign(front.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });

  function layout() {
    vw = innerWidth; vh = innerHeight; mobile = vw < 760;
    document.body.classList.toggle("e-mobile", mobile);
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    r1 = photoRect(L.photo, L.cut1.photo, "right"); r2 = photoRect(L.photo, L.cut2.photo, "left");
    place(p1.front, r1); place(q1.front, r1); place(p2.front, r2); place(q2.front, r2);
    R1 = align(r1, L.cut1.photo, L.cut1.stage);
    R2 = align(r2, L.cut2.photo, L.cut2.stage);
    Rc = centre();
    labApi.toScreen = (u, v) => [Rc.x + u * SW * Rc.s, Rc.y + v * SH * Rc.s];
    labApi.vw = vw; labApi.vh = vh; labApi.mobile = mobile; labApi.Rc = Rc;
    placeLabels();
    labView.layout?.();
    last = -1;
  }

  // labels beside the product (columns) or above and below it (rows), spread so they never overlap
  function placeLabels() {
    const b = L.cutx.stage;
    const box = { l: Rc.x + b[0] * Rc.s, t: Rc.y + b[1] * Rc.s, r: Rc.x + (b[0] + b[2]) * Rc.s, b: Rc.y + (b[1] + b[3]) * Rc.s };
    for (const pt of parts) [pt.x, pt.y] = labApi.toScreen(pt.at[0], pt.at[1]);
    for (const pt of parts) pt.dot.setAttribute("r", mobile ? 9 : 4.5);
    if (mobile) {
      for (const pt of parts) {
        pt.dot.setAttribute("cx", pt.x); pt.dot.setAttribute("cy", pt.y);
        pt.num.setAttribute("x", pt.x); pt.num.setAttribute("y", pt.y + 3.5);
        pt.line.setAttribute("points", "");
        pt.len = 0;
      }
      return;
    }
    const gap = 44, rows = page.labels === "rows";
    const groups = rows ? ["top", "bottom"] : ["left", "right"];
    for (const side of groups) {
      const list = parts.filter((p) => p.side === side).sort((a, c) => (rows ? a.x - c.x : a.y - c.y));
      const size = list.map((p) => (rows ? p.label.offsetWidth : p.label.offsetHeight));
      const want = list.map((p) => (rows ? p.x : p.y));
      const min = rows ? 24 : 96, max = rows ? vw - 24 : vh - 64;
      // centre each label on its part, then push apart, then pull back inside the window
      const pos = want.map((w, i) => w - size[i] / 2);
      for (let i = 1; i < pos.length; i++) pos[i] = Math.max(pos[i], pos[i - 1] + size[i - 1] + 14);
      const over = pos.length ? pos[pos.length - 1] + size[size.length - 1] - max : 0;
      if (over > 0) for (let i = pos.length - 1; i >= 0; i--) pos[i] = Math.min(pos[i], i === pos.length - 1 ? pos[i] - over : pos[i + 1] - size[i] - 14);
      if (pos.length && pos[0] < min) { pos[0] = min; for (let i = 1; i < pos.length; i++) pos[i] = Math.max(pos[i], pos[i - 1] + size[i - 1] + 14); }
      list.forEach((pt, i) => {
        const w = pt.label.offsetWidth, h = pt.label.offsetHeight;
        let lx, ly, pts;
        if (rows) {
          lx = pos[i]; ly = side === "top" ? box.t - gap - h : box.b + gap;
          const cx = lx + w / 2, edge = side === "top" ? ly + h + 6 : ly - 6;
          const knee = side === "top" ? edge + 14 : edge - 14;
          pts = [[pt.x, pt.y], [pt.x, knee], [cx, knee], [cx, edge]];
        } else {
          ly = pos[i];
          lx = side === "left" ? box.l - gap - w : box.r + gap;
          const cy = ly + h / 2, edge = side === "left" ? lx + w + 8 : lx - 8;
          const knee = side === "left" ? edge + 18 : edge - 18;
          pts = [[pt.x, pt.y], [knee, pt.y], [knee, cy], [edge, cy]];
        }
        Object.assign(pt.label.style, { left: `${lx}px`, top: `${ly}px` });
        pt.line.setAttribute("points", pts.map((q) => q.join(",")).join(" "));
        const len = pts.slice(1).reduce((s, q, k) => s + Math.hypot(q[0] - pts[k][0], q[1] - pts[k][1]), 0);
        pt.len = len;
        pt.line.style.strokeDasharray = `${len}`;
        pt.dot.setAttribute("cx", pt.x); pt.dot.setAttribute("cy", pt.y);
      });
    }
  }

  // —— each frame ——
  const mixRect = (a, b, t, anchor, lift = 0) => {
    // the product's centre travels in a straight line (with a little rise) while its size changes smoothly
    const s = Math.exp(lerp(Math.log(a.s), Math.log(b.s), t));
    const ax = lerp(a.x + anchor[0] * a.s, b.x + anchor[0] * b.s, t);
    const ay = lerp(a.y + anchor[1] * a.s, b.y + anchor[1] * b.s, t) - Math.sin(Math.PI * t) * lift;
    return { x: ax - anchor[0] * s, y: ay - anchor[1] * s, s };
  };
  const centreOf = (r) => [r[0] + r[2] / 2, r[1] + r[3] / 2];
  function rectAt(p) {
    if (p <= T.lift[0]) return R1;
    if (p < T.lift[1]) return mixRect(R1, Rc, ease(seg(p, T.lift)), centreOf(L.cut1.stage), vh * 0.05);
    if (p <= T.land[0]) return Rc;
    if (p < T.land[1]) return mixRect(Rc, R2, ease(seg(p, T.land)), centreOf(L.cut2.stage), vh * 0.03);
    return R2;
  }

  function drawSubject(p) {
    const R = rectAt(p);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.imageSmoothingQuality = "high";
    const put = (img, r, a = 1) => {
      if (!img || !r || a <= 0) return;
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(img, R.x + r[0] * R.s, R.y + r[1] * R.s, r[2] * R.s, r[3] * R.s);
    };
    const frame = (seq, t) => seq?.get(Math.round(t * (seq.count - 1)));
    const [a0, a1] = T.explode, [b0, b1] = T.rebuild;
    if (p < a0) put(cut1, L.cut1.stage);
    else if (p < a1) {
      // the cut-out hands over to clip a, which starts on the same picture
      const f = A && frame(A, seg(p, T.explode)), k = seg(p, [a0, a0 + SWAP]);
      if (!f || k < 1) put(cut1, L.cut1.stage);
      if (f) put(f, A.crop, k);
      else put(cutx, L.cutx.stage, seg(p, T.explode));
    } else if (p < b0) {
      // held apart: the sharp exploded view, between clip a's last frame and clip b's first
      const k = seg(p, [a1, a1 + SWAP]), kb = seg(p, [b0 - SWAP, b0]);
      if (A && k < 1) put(A.get(A.count - 1), A.crop);
      put(cutx, L.cutx.stage, A ? k : 1);
      if (B && kb > 0) put(B.get(0), B.crop, kb);
    } else if (p < b1) {
      const f = B && frame(B, seg(p, T.rebuild));
      if (f) put(f, B.crop);
      else { put(cutx, L.cutx.stage, 1 - seg(p, T.rebuild)); put(cut2, L.cut2.stage, seg(p, T.rebuild)); }
    } else {
      const k = seg(p, [b1, b1 + SWAP]);
      if (B && k < 1) put(B.get(B.count - 1), B.crop);
      put(cut2, L.cut2.stage, B ? k : 1);
    }
    ctx.globalAlpha = 1;
  }

  let last = -1, shown = 0, target = 0;
  const progress = () => {
    const r = scroll.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, r.height - vh));
  };
  function render(p) {
    drawSubject(p);
    p1.wrap.style.opacity = 1 - seg(p, T.photo1);
    // the first place stays under the lab, softening, until the lab covers it
    const d1 = seg(p, [T.photo1[0], T.labIn[1]]);
    q1.wrap.style.opacity = p < T.labIn[1] + 0.01 ? 1 : 0;
    q1.wrap.style.filter = `blur(${d1 * 10}px) brightness(${1 - d1 * 0.45})`;
    q1.wrap.style.transform = `scale(${1 + d1 * 0.05})`;
    const d2 = 1 - seg(p, [T.labOut[0], T.photo2[0]]);
    q2.wrap.style.opacity = p > T.labOut[0] - 0.01 ? 1 : 0;
    q2.wrap.style.filter = `blur(${d2 * 10}px) brightness(${1 - d2 * 0.45})`;
    q2.wrap.style.transform = `scale(${1 + d2 * 0.05})`;
    p2.wrap.style.opacity = seg(p, T.photo2);
    const labOn = seg(p, T.labIn) * (1 - seg(p, T.labOut));
    labBg.style.opacity = labOn;
    labBg.style.visibility = labOn > 0 ? "visible" : "hidden";

    const c1 = 1 - seg(p, T.copy1);
    copy1.style.opacity = c1; copy1.style.setProperty("--lift", `${-(1 - c1) * 40}px`);
    scrim1.style.opacity = 1 - seg(p, T.photo1);
    hint.style.opacity = 1 - seg(p, [0, 0.03]);
    const c3 = seg(p, T.copy3);
    copy3.style.opacity = c3; copy3.style.setProperty("--lift", `${(1 - c3) * 40}px`);
    copy3.style.pointerEvents = c3 > 0.5 ? "auto" : "none";
    copy1.style.pointerEvents = c1 > 0.5 ? "auto" : "none";
    scrim3.style.opacity = seg(p, T.photo2);
    const h2 = seg(p, T.head2) * (1 - seg(p, T.out2));
    head2.style.opacity = h2; head2.style.transform = `translateY(${(1 - seg(p, T.head2)) * 16}px)`;
    note2.style.opacity = seg(p, [T.labels[1] - 0.04, T.labels[1]]) * (1 - seg(p, T.out2));

    // labels draw in one after another, then all leave together
    const out = 1 - seg(p, T.out2);
    parts.forEach((pt, i) => {
      const n = parts.length, t = seg(p, [lerp(T.labels[0], T.labels[1] - 0.04, i / n), lerp(T.labels[0] + 0.04, T.labels[1], i / n)]);
      pt.line.style.strokeDashoffset = `${(pt.len ?? 0) * (1 - t)}`;
      pt.line.style.opacity = out;
      pt.dot.style.opacity = Math.min(1, t * 3) * out;
      pt.num.style.opacity = Math.min(1, t * 3) * out;
      pt.label.style.opacity = clamp((t - 0.55) / 0.45) * out;
      pt.label.style.transform = `translateY(${(1 - clamp((t - 0.55) / 0.45)) * 8}px)`;
    });
    legend.style.opacity = mobile ? seg(p, T.labels) * out : 0;
    labFg.style.opacity = seg(p, T.chart) * (1 - seg(p, T.out2));
    labView.update?.(p, { explode: seg(p, T.explode), chart: seg(p, T.chart), hold: seg(p, [T.chart[0], T.out2[0]]) });

    // the nav and the step rail follow the scene underneath
    const mid = ([a, b]) => (a + b) / 2;
    const scene = p < mid(T.lift) ? 0 : p < mid(T.land) ? 1 : 2;
    document.body.dataset.scene = scene;
    [...steps.children].forEach((li, i) => li.classList.toggle("on", i === scene));
  }

  // the shown point eases after the scroll (smooth steps between frames); with reduced motion it follows at once
  function tick() {
    target = progress();
    shown = still ? target : shown + (target - shown) * 0.16;
    if (Math.abs(target - shown) < 0.0004) shown = target;
    if (Math.abs(shown - last) > 0.00005) { render(shown); last = shown; }
    requestAnimationFrame(tick);
  }

  addEventListener("resize", layout);
  await document.fonts?.ready;
  layout();
  shown = target = progress();
  render(shown);
  window.explode = {
    seek(p) { scrollTo(0, clamp(p) * (scroll.offsetHeight - vh)); shown = target = clamp(p); render(shown); last = shown; },
    get progress() { return shown; },
    ready: loaded.then(() => true),
    timeline: structuredClone(T),
  };
  document.body.classList.add("e-ready");
  requestAnimationFrame(tick);
  // the labs' own idle motion (a stride, rings, dashes) runs even when nobody scrolls
  if (!still) (function idle(t) { labView.idle?.(t, shown); requestAnimationFrame(idle); })(0);
}
