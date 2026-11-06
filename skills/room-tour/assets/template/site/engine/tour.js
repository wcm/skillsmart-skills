// Room Tour engine: boot(), the scroll and the smoothing, the engine clock, events, record mode and window.tour.
// One engine, four presets (design-system.md 7): a site is index.html + style.css (tokens) + tour.json; the engine builds
// the rest. See engine/README.md for the contract.
//
//   import { boot } from "../engine/tour.js";
//   const tour = await boot({ data: "tour.json", layers: [legend] });
//
// Each animation frame: the scroll (or, in ?record, the recording timeline) gives a target p; the shown p eases toward
// it (5.2); step() works out the state, fires events and moves every clock animation's target; paint() draws the
// stage and writes the DOM. step() never draws, so record mode can replay it to reach any frame deterministically.

import { clamp, lerp, ease, el, dev, warn, parseColour, mixColour, pad2 } from "./util.js";
import { Clock, Fade, Switch } from "./clock.js";
import { validate, normalize } from "./schema.js";
import { FrameSeq } from "./frames.js";
import { Timeline } from "./timeline.js";
import { Stage } from "./stage.js";
import { frame } from "./ui/frame.js";
import { nav } from "./ui/nav.js";
import { title } from "./ui/title.js";
import { caption } from "./ui/caption.js";
import { walkbar } from "./ui/walkbar.js";
import { rail } from "./ui/rail.js";
import { hotspots } from "./ui/hotspots.js";
import { tags } from "./ui/tags.js";
import { map } from "./ui/map.js";
import { cut } from "./ui/cut.js";
import { end } from "./ui/end.js";
import { art } from "./ui/art.js";
import { cards } from "./ui/cards.js";
import { cursor } from "./ui/cursor.js";

/**
 * The engine's own components, in mount order (later ones paint on top within .tour-ui); each is { name, mount,
 * layout, step, paint, event, reset, beat, ready } like a site layer (README: "Extension points").
 *   steps 1–4  frame, nav, title, caption, walkbar, rail
 *   step 5     hotspots (+ the stops' dimension lines and the fact pill), tags (tracked), cards
 *   step 6     map
 *   step 7     cut (the cut's words), end (the end sheet's dim layer, the end card)
 *   step 8     art (artworks on tracked canvases, wall labels, seen, the lift)
 *   step 9     cursor (the calm cursor and the recording's beats)
 */
export const CORE = [frame, nav, title, caption, walkbar, rail, map, hotspots, tags, cut, end, art, cards, cursor];

const NAV_BOTTOM = { desktop: 76, phone: 56 };

export async function boot(opts = {}) {
  const { data = "tour.json", layers = [], core = CORE } = opts;
  const q = new URLSearchParams(location.search);
  const record = q.has("record");
  // ?rec: the full-rate recording frames (blended) on the live, scrolled page, for screen recorders that drive the
  // real scroll on a fake clock; ?record drives the walk from its own timeline instead
  const rec = record || q.has("rec");
  const clean = q.has("clean");
  const reduced = q.has("reduce") || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const base = typeof data === "string" && data.includes("/") ? data.slice(0, data.lastIndexOf("/") + 1) : "";

  // ——— tour.json ———
  let raw = {};
  try {
    raw = typeof data === "string" ? await (await fetch(data)).json() : structuredClone(data);
  } catch (e) {
    warn(`couldn't read ${typeof data === "string" ? data : "the tour data"} (${e.message}); nothing to walk`);
  }
  const problems = validate(raw ?? {});
  const d = normalize(raw);
  // the component CSS: a site links engine/tour.css in its <head>; if it didn't, it is added here
  if (![...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => /(^|\/)tour\.css(\?|$)/.test(l.getAttribute("href") ?? ""))) {
    const link = el("link", null, null, { rel: "stylesheet", href: new URL("./tour.css", import.meta.url).href });
    const loaded = new Promise((r) => { link.onload = link.onerror = r; });
    document.head.append(link);
    await Promise.race([loaded, new Promise((r) => setTimeout(r, 3000))]);
  }
  if (record && q.get("fps")) d.record.fps = Math.max(1, +q.get("fps") || 30);
  const body = document.body;
  body.classList.add("tour");
  if (d.site) body.dataset.site ??= d.site;
  body.dataset.material = d.theme.material;
  body.dataset.frame = d.theme.frame.kind;
  body.classList.toggle("tour-record", record);
  body.classList.toggle("tour-reduced", reduced);
  body.classList.toggle("tour-clean", clean);
  if (d.meta.title && !document.title) document.title = d.meta.title;
  // --label-case is one token for two CSS properties (text-transform, font-variant-caps)
  const labelCase = getComputedStyle(document.documentElement).getPropertyValue("--label-case").trim() || "uppercase";
  body.dataset.labelCase = labelCase;
  if (!getComputedStyle(document.documentElement).getPropertyValue("--grain").trim()) document.documentElement.style.setProperty("--grain", String(d.theme.grain ?? 0));

  // ——— the page skeleton (design-system.md 2); a site may write it itself ———
  let scrollEl = document.querySelector("main.tour-scroll");
  if (!scrollEl) { scrollEl = el("main", "tour-scroll"); body.prepend(scrollEl); }
  const part = (cls, tag = "div", parent) => {
    let e = (parent ?? scrollEl).querySelector(`:scope > .${cls}`);
    if (!e) { e = tag === "svg" ? document.createElementNS("http://www.w3.org/2000/svg", "svg") : el(tag, cls); e.setAttribute("class", cls); (parent ?? scrollEl).append(e); }
    return e;
  };
  const stageEl = part("tour-stage");
  const canvas = part("tour-canvas", "canvas", stageEl);
  const wash = part("tour-wash", "div", stageEl);
  const titleEl = part("tour-title", "div", stageEl);
  const occCanvas = part("tour-occluder", "canvas", stageEl);
  const lines = part("tour-lines", "svg", stageEl);
  const frameEl = part("tour-frame", "svg", stageEl);
  const ui = part("tour-ui", "div", stageEl);
  const modal = part("tour-modal", "div", stageEl);
  canvas.setAttribute("aria-hidden", "true");
  occCanvas.setAttribute("aria-hidden", "true");
  lines.setAttribute("aria-hidden", "true");
  frameEl.setAttribute("aria-hidden", "true");
  const probe = el("div", "tour-probe");
  body.append(probe);
  const endEl = document.getElementById(d.end.id) ?? document.querySelector("section.tour-end");
  body.classList.add("tour-loading");

  // ——— frames ———
  const vw0 = innerWidth;
  const phoneSet = !rec && vw0 <= 900;
  const suffix = rec ? d.record.frames : phoneSet ? "-phone" : "";
  const paths = [...new Set(Object.values(d.moves).flatMap((m) => m.clips))];
  const seqMap = new Map();
  await Promise.all(paths.map(async (p) => {
    let s = await FrameSeq.load(base + p + suffix);
    if (!s && suffix) { warn(`${p}${suffix} is missing; using ${p}`); s = await FrameSeq.load(base + p); }
    seqMap.set(p, s);
  }));
  const tl = new Timeline(d, (p) => seqMap.get(p));
  const seqs = [...seqMap.values()].filter(Boolean);

  // ——— engine state ———
  const clock = new Clock({ record });
  const stage = new Stage({ canvas, occCanvas, tl, d, clock, record, blend: rec, reduced, base });
  if (rec) {
    // the occluder masks follow the published 1600 px set's numbering
    const c0 = d.moves[d.walk[1]]?.clips?.[0];
    if (c0 && d.title.occluder) stage.pubSeq = await FrameSeq.load(base + c0);
  }
  const bus = new Map();
  const uiGroup = [];
  const tokenRuns = [];
  const hideFade = new Fade(clock, clean ? 0 : 1);
  let hidden = clean;
  let phone = innerWidth < 768;
  let screenPx = innerHeight;
  let endTopDoc = Infinity;
  let shown = 0, target = 0, pPrev = null, state = null, dirty = true, keepAlive = 0, glide = null, lastN = -1, scrollX = 0;
  let uiOn = false;
  let lockN = 0, lockY = 0, lastMoveT = -1e9;
  const targets = new Map();
  const needs = [];

  const ctx = {
    data: d, theme: d.theme, tl, clock, stage, Fade, Switch, ease, base,
    record, reduced, clean,
    get phone() { return phone; },
    get hidden() { return hidden; },
    get state() { return state; },
    root: body, scroll: scrollEl, stageEl, canvas, wash, title: titleEl, lines, frameEl, ui, modal, end: endEl,
    slots: {},
    seen: new Set(), card: null, lifted: null, inView: null, extra: {},
    get margin() { return phone ? 16 : 40; },
    get navBottom() { return phone ? NAV_BOTTOM.phone : NAV_BOTTOM.desktop; },
    toScreen: (pt) => stage.toScreen(pt),
    fromScreen: (pt) => stage.fromScreen(pt),
    get map() { return stage.map; },
    /** what the stage drew this frame: { move, clip, path, web, src, pics, map } (stage.viewOf) */
    get view() { return stage.view ?? null; },
    /** the 56 px text rise (32 on phone, none with reduced motion) */
    rise: (n = 56) => (reduced ? 0 : phone ? Math.round((n * 32) / 56) : n),
    /** small-label text, in brackets where the site owns them (1.1) */
    label: (s) => (d.theme.label.brackets ? `[ ${s} ]` : s),
    on(name, fn) { if (!bus.has(name)) bus.set(name, new Set()); bus.get(name).add(fn); return () => bus.get(name).delete(fn); },
    emit,
    invalidate() { dirty = true; stage.invalidate(); },
    keepAlive(on) { keepAlive = Math.max(0, keepAlive + (on ? 1 : -1)); },
    uiGroup: {
      /** joins the UI group (4.3): hidden on the cover, in with the title's exit (300 ms, 60 ms apart) */
      add(e, order = uiGroup.length) { uiGroup.push({ e, order, f: new Fade(clock, 0) }); uiGroup.sort((a, b) => a.order - b.order); e.dataset.uiGroup = ""; e.style.setProperty("--g", "0"); },
      get on() { return uiOn; },
    },
    glide: (to, o) => startGlide(to, o),
    go: (action) => go(action),
    setTokens,
    token: (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    setHidden,
    /** step 5–9 hooks, set by those components: openCard(id) / closeCard() (cards), lift(id) / unlift() (art),
     *  openHotspot(id) (hotspots), pickSwatch(card, name) (cards) */
    openCard: null, closeCard: null, lift: null, unlift: null, openHotspot: null, pickSwatch: null,
    /** the walk waits (a card, a lift): the page scroll is held where it is; counted, so nest freely */
    lockScroll(on) {
      if (on) { if (!lockN++) { lockY = scrollY; glide?.done(); glide = null; body.classList.add("tour-locked"); } }
      else if (lockN > 0 && !--lockN) body.classList.remove("tour-locked");
    },
    get locked() { return lockN > 0; },
    /** true when the walk hasn't moved for `ms` (a lift needs 300 ms at rest; always true in ?record) */
    atRest: (ms = 300) => record || clock.now() - lastMoveT >= ms,
    /** beat and cursor targets: target("hotspot:m02", () => ({ x, y, el, verb })) → unregister */
    target(name, fn) { targets.set(name, fn); return () => targets.delete(name); },
    targetAt(name) { const f = targets.get(name); return f ? f() : null; },
    /** ?record waits for these before each paint (art images, masks): addNeed((state) => promise) */
    addNeed(fn) { needs.push(fn); },
    /** the move t (5.5) of the picture the stage drew (tags and keyframes follow the frame on screen, not the wanted one) */
    viewT() {
      const v = stage.view, s = state;
      if (!s || s.kind !== "move") return s?.move?.t ?? 0;
      const g = tl.moves[s.seg.id];
      const c = v && v.move === g.id ? g.clips[v.clip] : null;
      if (!c?.seq) return s.move.t;
      return c.t0 + (v.src / Math.max(1, c.seq.src.count - 1)) * (c.t1 - c.t0);
    },
    /** the pointer over the stage (the cursor and the halo read it): { x, y, inside, touch } */
    pointer: { x: -1, y: -1, inside: false, touch: false },
    /** where the end section's top is, px from the viewport top */
    endTop: () => endTopDoc - scrollY,
    pOf: (t) => tl.pOf(t),
  };

  function emit(name, payload = {}) {
    for (const fn of bus.get(name) ?? []) fn(payload, ctx);
    for (const c of core) c.event?.(name, payload, ctx);
    for (const l of layers) l.event?.(name, payload, ctx);
  }

  function setHidden(h) {
    hidden = Boolean(h);
    hideFade.to(hidden ? 0 : 1, 300, "out");
    body.classList.toggle("tour-hidden", hidden);
    emit("hide", { hidden });
    dirty = true;
  }

  /** cross-fades tokens on :root (colours over `ms`; other values switch at once), e.g. a colourway */
  const tokenOrig = new Map();
  function setTokens(map, ms = 600, easeName = "inout") {
    const cs = getComputedStyle(document.documentElement);
    for (const k of Object.keys(map)) if (!tokenOrig.has(k)) tokenOrig.set(k, document.documentElement.style.getPropertyValue(k));
    const run = { f: new Fade(clock, 0).to(1, ms, easeName), pairs: [] };
    for (const [k, v] of Object.entries(map)) {
      const a = parseColour(cs.getPropertyValue(k)), b = parseColour(v);
      if (a && b && ms > 0) run.pairs.push([k, a, b, v]);
      else document.documentElement.style.setProperty(k, v);
    }
    for (const r of tokenRuns) r.pairs = r.pairs.filter(([k]) => !map[k]);
    tokenRuns.push(run);
    dirty = true;
    return run;
  }

  // ——— navigation ———
  function yOfP(p) { return p * tl.S * screenPx; }
  function targetY(to) {
    if (typeof to === "string" && to.startsWith("#")) {
      const t = document.querySelector(to);
      return t ? Math.max(yOfP(1), t.getBoundingClientRect().top + scrollY - (phone ? 72 : 96)) : yOfP(1);
    }
    if (to === "end") return yOfP(1);
    if (typeof to === "string" && to.startsWith("end#")) return targetY(to.slice(3));
    return yOfP(tl.pOf(to));
  }
  function startGlide(to, { ms } = {}) {
    if (record) { warn("glide() does nothing in ?record (the timeline drives the scroll)"); return Promise.resolve(); }
    const y1 = targetY(to), y0 = scrollY;
    if (Math.abs(y1 - y0) < 1) return Promise.resolve();
    if (reduced) { scrollTo(0, y1); return Promise.resolve(); }
    let dur = ms;
    if (!dur) {
      const stops = tl.stopIds.length;
      const adj = (tl.W / Math.max(1, stops - 1)) * screenPx;
      const dist = Math.abs(y1 - y0);
      dur = dist <= adj * 1.35 ? 1200 : Math.max(1200, (600 * dist) / adj);
    }
    return new Promise((done) => { glide?.done(); glide = { y0, y1, t0: clock.now(), ms: dur, done }; dirty = true; });
  }
  function go(action) {
    if (!action) return;
    if (action === "hide") return setHidden(!hidden);
    if (action.startsWith("card:")) return ctx.openCard?.(action.slice(5));
    if (action.startsWith("lift:")) return ctx.lift?.(action.slice(5), { force: true });
    if (action.startsWith("stop:")) return startGlide(action.slice(5));
    if (action === "end" || action.startsWith("end#")) return startGlide(action);
    if (action.startsWith("#")) return startGlide(action);
    warn(`unknown action "${action}"`);
  }
  for (const ev of ["wheel", "touchstart", "keydown"]) addEventListener(ev, (e) => {
    if (record) { if (ev !== "keydown") e.preventDefault?.(); return; }
    if (glide && !(ev === "keydown" && e.key === "h")) { glide.done(); glide = null; }
  }, { passive: !record });
  addEventListener("keydown", (e) => {
    if ((e.key === "h" || e.key === "H") && !e.metaKey && !e.ctrlKey && !e.altKey && !/input|textarea|select/i.test(e.target?.tagName ?? "") && !e.target?.isContentEditable && !lockN) setHidden(!hidden);
  });
  // the scroll lock (cards, lifts): the wheel and touch scroll only inside a scrolling panel; keys that scroll do nothing
  const inPanel = (t) => t?.closest?.("[data-tour-scrolls]");
  addEventListener("wheel", (e) => { if (lockN && !inPanel(e.target)) e.preventDefault(); }, { passive: false });
  addEventListener("touchmove", (e) => { if (lockN && !inPanel(e.target)) e.preventDefault(); }, { passive: false });
  addEventListener("keydown", (e) => {
    if (lockN && [" ", "PageDown", "PageUp", "End", "Home", "ArrowDown", "ArrowUp"].includes(e.key) && !inPanel(e.target) && !/input|textarea|select/i.test(e.target?.tagName ?? "")) e.preventDefault();
  });
  addEventListener("scroll", () => { if (lockN && !record && Math.abs(scrollY - lockY) > 0.5) scrollTo(0, lockY); }, { passive: true });
  const ptr = (e) => {
    const P = ctx.pointer;
    P.x = e.clientX; P.y = e.clientY; P.touch = e.pointerType === "touch";
    const r = stageEl.getBoundingClientRect();
    P.inside = e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom;
    dirty = true;
  };
  addEventListener("pointermove", ptr, { passive: true });
  addEventListener("pointerdown", ptr, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { ctx.pointer.inside = false; dirty = true; });

  // ——— state ———
  function compute(p) {
    const seg = tl.segAt(p);
    const k = tl.kOf(seg, p);
    const screens = p * tl.S;
    let last = tl.stopIds[0];
    for (const id of tl.stopIds) if (tl.stops[id].p[0] <= p + 1e-9) last = id;
    const li = tl.stopIds.indexOf(last);
    const exitScreens = d.title.exit.screens ?? 0.3;
    const s = {
      p, pPrev: pPrev ?? p, dir: pPrev == null ? 0 : Math.sign(p - pPrev), screens, seg, k, kind: seg.kind,
      t: clock.seconds(), now: clock.now(), phone, reduced, record, hidden,
      stop: seg.kind === "title" || seg.kind === "stop" ? seg.id : null,
      last, next: tl.stopIds[li + 1] ?? null, index: li, stops: tl.stopIds.length,
      move: null, cut: null, end: seg.kind === "end" ? k : null,
      title: { exit: d.title.blocks.length ? clamp(screens / exitScreens) : 1 },
      scrollY: record ? yOfP(p) + scrollX : scrollY,
      endTop: endTopDoc - (record ? yOfP(p) + scrollX : scrollY),
      card: ctx.card, lifted: ctx.lifted, seen: ctx.seen, inView: ctx.inView,
      ui: uiOn,
    };
    if (seg.kind === "move") {
      const f = tl.frameAt(seg.id, k);
      s.move = { id: seg.id, t: k, frame: f, clip: f?.clip ?? 0, path: f?.path, web: f?.web ?? 0, src: f?.src ?? 0, seq: f?.seq ?? null };
    }
    if (seg.kind === "cut") s.cut = { id: seg.id, k, from: seg.from, to: seg.to, sheetTop: null };
    return s;
  }

  function crossings(a, b) {
    if (a == null || a === b) return;
    const sa = tl.segAt(a), sb = tl.segAt(b), dir = Math.sign(b - a);
    if (sa !== sb) {
      emit("segment:leave", { id: sa.id, kind: sa.kind, dir });
      if (sa.kind === "stop" || sa.kind === "title") emit("stop:leave", { id: sa.id, dir });
      if (sa.kind === "move") emit("move:end", { id: sa.id, dir });
      emit("segment:enter", { id: sb.id, kind: sb.kind, dir });
      if (sb.kind === "stop" || sb.kind === "title") emit("stop:enter", { id: sb.id, dir });
      if (sb.kind === "move") emit("move:start", { id: sb.id, dir });
    }
    for (const g of Object.values(tl.moves)) for (const ev of g.ref.events ?? []) {
      const pe = lerp(g.p[0], g.p[1], ev.at);
      if ((a < pe && b >= pe) || (b < pe && a >= pe)) emit("move:event", { move: g.id, at: ev.at, name: ev.name, id: ev.id ?? null, dir });
    }
  }

  function step(p) {
    const prev = pPrev;
    state = compute(p);
    if (prev == null) {
      emit("segment:enter", { id: state.seg.id, kind: state.seg.kind, dir: 0 });
      if (state.stop) emit("stop:enter", { id: state.stop, dir: 0 });
    } else crossings(prev, p);
    // the UI group arrives when the title's exit passes 50 % (4.3)
    const on = state.title.exit >= 0.5;
    if (on !== uiOn) { uiOn = on; emit(on ? "ui:in" : "ui:out", {}); }
    state.ui = uiOn;
    uiGroup.forEach((g, i) => g.f.to(uiOn ? 1 : 0, 300, "out", uiOn ? 60 * i : 0));
    stage.step(state);
    for (const c of core) c.step?.(state, ctx);
    for (const l of layers) l.step?.(state, ctx);
    pPrev = p;
  }

  let linesClip = "";
  function paint() {
    stage.render(state);
    state.view = stage.view ?? null;
    // leaders and labels in .tour-lines stay inside R (the gallery's window, the inset frame) like the pictures
    const R = stage.map?.R;
    const lc = R && (R.x > 0.5 || R.y > 0.5 || R.w < stage.vw - 0.5 || R.h < stage.vh - 0.5)
      ? `inset(${R.y.toFixed(1)}px ${(stage.vw - R.x - R.w).toFixed(1)}px ${(stage.vh - R.y - R.h).toFixed(1)}px ${R.x.toFixed(1)}px round ${R.r.toFixed(1)}px)` : "";
    if (lc !== linesClip) { linesClip = lc; lines.style.clipPath = lc; }
    for (const g of uiGroup) {
      const v = g.f.value;
      g.e.style.setProperty("--g", v.toFixed(3));
      g.e.style.visibility = v <= 0.001 ? "hidden" : "";
    }
    document.documentElement.style.setProperty("--tour-ui-k", hideFade.value.toFixed(3));
    for (const r of tokenRuns) { const v = r.f.value; for (const [k, a, b] of r.pairs) document.documentElement.style.setProperty(k, mixColour(a, b, v)); }
    for (let i = tokenRuns.length - 1; i >= 0; i--) if (tokenRuns[i].f.done) {
      for (const [k, , , v] of tokenRuns[i].pairs) document.documentElement.style.setProperty(k, v);
      tokenRuns.splice(i, 1);
    }
    for (const c of core) c.paint?.(state, ctx);
    for (const l of layers) l.update?.(state, ctx);
    // after everything has written the DOM (the cursor reads its targets' places here, layers' buttons included)
    for (const c of core) c.post?.(state, ctx);
    for (const l of layers) l.post?.(state, ctx);
    dirty = false;
  }

  function reset() {
    clock.reset();
    pPrev = null; uiOn = false; state = null;
    for (const g of uiGroup) g.f.snap(0);
    stage.join.from = null; stage.join.k.snap(1); stage.still.snap(0); stage.cutFade.snap(0); stage.pics = null; stage.lastKey = ""; stage.picSince = 0;
    if (stage.rc) { stage.rc.fade.snap(0); stage.rc.here.snap(0); }
    stage.invalidate();
    ctx.seen.clear(); ctx.card = null; ctx.lifted = null;
    // tokens a swatch or a layer changed go back to the site's own (a replay starts from the cover's colours)
    tokenRuns.length = 0;
    for (const [k, v] of tokenOrig) { if (v) document.documentElement.style.setProperty(k, v); else document.documentElement.style.removeProperty(k); }
    if (stage.rc) stage.rc.prev = null;
    lockN = 0; body.classList.remove("tour-locked");
    for (const c of core) c.reset?.(ctx);
    for (const l of layers) l.reset?.(ctx);
  }

  // ——— layout ———
  function layout() {
    phone = innerWidth < 768;
    body.classList.toggle("tour-phone", phone);
    screenPx = probe.getBoundingClientRect().height || innerHeight;
    const P = tl.P;
    scrollEl.style.height = `calc(${+(tl.S + P + 1).toFixed(4)} * 100svh)`;
    if (endEl && d.theme.end.arrive === "sheet") {
      // the sheet covers the pinned stage until it unpins, so whatever follows it (the footer) never slides under the stage
      Object.assign(endEl.style, { marginTop: `calc(${-(tl.E + P).toFixed(4)} * 100svh)`, minHeight: `calc(${(tl.E + P).toFixed(4)} * 100svh)`, position: "relative", zIndex: "2" });
    }
    // the end card lives in the stage (arrive "card"): the page's end is then whatever follows the scroll section
    const after = (d.theme.end.arrive === "card" ? null : endEl) ?? scrollEl.nextElementSibling;
    endTopDoc = after ? after.getBoundingClientRect().top + scrollY : Infinity;
    const dpr = record ? 1 : Math.min(2, devicePixelRatio || 1);
    stage.layout(stageEl.clientWidth || innerWidth, stageEl.clientHeight || innerHeight, dpr);
    if (state) { state = compute(state.p); stage.step(state); }
    for (const c of core) c.layout?.(ctx);
    for (const l of layers) l.layout?.(ctx);
    dirty = true;
  }

  // ——— mount ———
  for (const c of core) c.mount?.(ctx);
  for (const l of layers) l.mount?.(ctx);
  addEventListener("resize", () => { layout(); if (state) { step(state.p); paint(); } });

  // fonts and the cover frame, then the first screen at once (no entrance animation on load, 4.3)
  const cover = tl.stopPic(d.walk[0]);
  const coverReady = cover ? cover.seq.ensure(cover.web) : Promise.resolve();
  const fonts = document.fonts?.ready ?? Promise.resolve();
  const extras = stage.loadExtras(phoneSet);
  const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
  await Promise.race([Promise.all([fonts, coverReady]), timeout(record ? 30000 : 4000)]);
  layout();
  // the coarse-to-fine preload of every clip (the wanted frame jumps the queue)
  const loading = FrameSeq.preload(seqs, 8, cover ? [[cover.seq, cover.web]] : []);
  for (const s of seqs) s.onframe = () => { dirty = true; stage.invalidate(); };

  const pFromScroll = () => clamp(scrollY / Math.max(1, tl.S * screenPx));
  shown = target = record ? 0 : pFromScroll();
  if (record) scrollTo(0, 0);
  clock.instant = true;      // the first screen is finished, never animated in
  step(shown);
  for (const g of uiGroup) g.f.settle();
  clock.instant = false;
  paint();
  body.classList.remove("tour-loading");
  body.classList.add("tour-ready");

  // ——— the loop (normal mode) ———
  let lastTick = performance.now();
  function loop() {
    clock.tick();
    const now = performance.now(), dt = Math.min(100, now - lastTick);
    lastTick = now;
    if (glide) {
      const k = clamp((clock.now() - glide.t0) / glide.ms);
      scrollTo(0, lerp(glide.y0, glide.y1, ease.inout(k)));
      if (k >= 1) { glide.done(); glide = null; }
    }
    target = pFromScroll();
    const before = shown;
    if (reduced) shown = target;
    else {
      shown += (target - shown) * (1 - Math.exp(-dt / 120));
      if (Math.abs(target - shown) < 1e-5) shown = target;
    }
    const moved = shown !== before || pPrev == null;
    if (moved) lastMoveT = clock.now();
    if (moved || clock.busy || dirty || keepAlive || tokenRuns.length || glide) {
      step(shown);
      paint();
    }
    requestAnimationFrame(loop);
  }
  if (!record) requestAnimationFrame(loop);

  // ——— record mode (6) ———
  const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
  function endScroll(p, seg, k) {
    // the recording's end may scroll on past p = 1 to record.endTo (a selector or extra screens), eased
    const to = d.record.endTo;
    if (seg.kind !== "end" || to == null) return 0;
    let extra = 0;
    if (typeof to === "number") extra = to * screenPx;
    else { const t = document.querySelector(to); if (t) extra = Math.max(0, t.getBoundingClientRect().bottom + scrollY - innerHeight + 40 - yOfP(1)); }
    return extra * k;
  }
  function stepAt(n) {
    clock.set((n / d.record.fps) * 1000);
    const r = tl.recAt(n / d.record.fps);
    scrollX = endScroll(r.p, r.seg, r.k);
    ctx.beat = r.beat;
    step(r.p);
    for (const c of core) c.beat?.(r.beat, ctx);
    for (const l of layers) l.beat?.(r.beat, ctx);
  }
  async function frameN(n) {
    if (!record) { warn("tour.frame(n) works only with ?record"); return; }
    n = Math.max(0, Math.floor(n));
    if (n === 0 || n !== lastN + 1) {
      // replay from the cover (finished at once, as on load) up to n: the same n always gives the same state
      reset();
      clock.instant = true;
      stepAt(0);
      for (const g of uiGroup) g.f.settle();
      clock.instant = false;
      for (let k = 1; k <= n; k++) stepAt(k);
    } else stepAt(n);
    lastN = n;
    scrollTo(0, Math.round(yOfP(state.p) + scrollX));
    await stage.needs(state);
    await Promise.all(needs.map((f) => f(state)));
    stage.invalidate();
    paint();
    await raf();
    await raf();
  }

  const layerReady = [...core, ...layers].map((l) => l.ready).filter(Boolean);
  const ready = Promise.all([loading, extras, fonts, ...layerReady]).then(() => true);
  ready.then(() => { dirty = true; });

  const api = {
    ready,
    timeline: tl.toJSON(),
    duration: tl.duration,
    fps: d.record.fps,
    frames: tl.frames,
    problems,
    seek(p) {
      p = clamp(p);
      glide?.done(); glide = null;
      scrollX = 0;
      scrollTo(0, Math.round(yOfP(p)));
      shown = target = p;
      clock.instant = true;
      step(p);
      for (const g of uiGroup) g.f.settle();
      clock.instant = false;
      stage.invalidate();
      paint();
      return raf();
    },
    frame: frameN,
    state() {
      const s = state;
      return {
        p: s.p, t: s.t, segment: s.seg.id, kind: s.kind, stop: s.stop, last: s.last, next: s.next,
        move: s.move ? { id: s.move.id, t: s.move.t, clip: s.move.clip, web: s.move.web, src: s.move.src } : null,
        cut: s.cut ? { id: s.cut.id, k: s.cut.k } : null, end: s.end, title: s.title.exit, ui: s.ui, hidden,
        card: ctx.card, lifted: ctx.lifted, seen: [...ctx.seen], ...ctx.extra,
      };
    },
    clock: { now: () => clock.now(), step: (dt) => { if (record) { clock.step(dt); step(state.p); stage.invalidate(); paint(); } } },
    stats: () => ({ ...stage.stats, shown: stage.stats.shown.size, asked: stage.stats.asked.size, ms: undefined, paintMs: summary(stage.stats.ms) }),
    resetStats() { Object.assign(stage.stats, { paints: 0, wanted: 0, exact: 0, off: 0, shown: new Set(), asked: new Set(), ms: [] }); },
    ctx,
    glide: (to) => startGlide(to),
    setHidden,
  };
  window.tour = api;
  return api;
}

function summary(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return { n: s.length, median: +s[s.length >> 1].toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), max: +s[s.length - 1].toFixed(2) };
}

export { pad2, dev };
