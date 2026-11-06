// Title block and the first screen (design-system.md 4.3): the blocks, the fit test, the picture gradients, the occluder's
// opacity, both exits (drift and the nav flight) and the nav-band check. The window is the stage's R (stage.js).
//
//   blocks     title.blocks[]: each has its own box (viewport fractions, or frame fractions with "space": "frame",
//              mapped through toScreen every paint so it stays locked to the picture), align, valign, size, class,
//              an optional kicker, and an exit. "hidden": { "phone": true } drops a block on one device.
//   fit test   frame-space boxes are mapped at the cover and clipped to the margins (40 px, phone 16 px). If any
//              block's measured text is wider than its clipped box, every block that has a `stack` box uses it
//              (viewport fractions; blocks sharing one stack box stack in order, as lines of one column).
//   gradients  title.gradients[] on .tour-wash: edge, color, opacity [edge, far], extent (fraction of the viewport),
//              start (edge opacity on the cover, default opacity[0]) and rest (edge opacity for the walk, default
//              opacity[0]); they follow the title's exit from start to rest. Values may be { desktop, phone }; a
//              gradient with "device": "phone" | "desktop" shows on one only.
//   exit       title.exit.mode "drift": each block moves by its exit { dx, dy } (px or vw/vh) and fades out over
//              title.exit.screens; "nav": blocks with "slot": "nav-center" fly onto their span of the nav's centre line
//              (the same string in the same face: the engine copies the block's face onto the span), the joining
//              dash fades in 150 ms after both land; blocks without a slot drift.

import { el, rich, plain, dev, len, clamp, lerp, ease, warn, parseColour } from "../util.js";

const sameBox = (a, b) => Array.isArray(a) && Array.isArray(b) && a.every((x, i) => Math.abs(x - b[i]) < 1e-6);

export const title = {
  name: "title",

  mount(ctx) {
    const d = ctx.data, T = d.title;
    this.ctx = ctx;
    this.root = ctx.title;
    this.mode = T.exit?.mode ?? "drift";
    this.stacked = false;
    this.warned = new Set();
    this.blocks = T.blocks.map((b, i) => {
      const tag = b.tag ?? (i === 0 ? "h1" : "div");
      const e = el(tag, `tt-block ${b.class ?? ""}`.trim(), null, { "data-id": b.id });
      const kicker = b.kicker ? el("div", "tt-kicker t-label", rich(b.kicker)) : null;
      const lines = el("div", "tt-lines");
      const texts = b.lines.map((ln) => {
        const row = el("span", "tt-line");
        const t = el("span", "tt-text", rich(ln));
        row.append(t);
        lines.append(row);
        return t;
      });
      if (kicker) e.append(kicker);
      e.append(lines);
      this.root.append(e);
      return { b, e, kicker, lines, texts, box: null, rel: null, flight: null, css: {} };
    });
    // the nav flight's target spans (gallery): split the nav's centre line into one span per block and the dash
    this.flyers = [];
    if (this.mode === "nav") {
      const line = ctx.slots.navCenter;
      const slotted = this.blocks.filter((k) => k.b.slot === "nav-center").sort((a, b) => (a.b.part ?? 0) - (b.b.part ?? 0));
      const text = line?.dataset.kind === "line" ? line.textContent : "";
      let at = 0, ok = Boolean(text) && slotted.length > 0;
      const parts = [];
      for (const k of slotted) {
        const s = plain(k.b.lines.join(" "));
        const i = text.toLowerCase().indexOf(s.toLowerCase(), at);   // the block's face sets the case (text-transform)
        if (i < 0) { ok = false; warn(`title.blocks.${k.b.id}: "${s}" isn't in the nav's centre line "${text}"; it drifts instead`); break; }
        parts.push([i, i + s.length, k]);
        at = i + s.length;
      }
      if (ok) {
        line.textContent = "";
        let pos = 0;
        const dashes = [];
        for (const [a, b, k] of parts) {
          if (a > pos) { const g = el("span", "tn-dash", null); g.textContent = text.slice(pos, a); line.append(g); dashes.push(g); }
          const s = el("span", "tn-part", null, { "data-part": String(k.b.part ?? 0) });
          s.textContent = plain(k.b.lines.join(" "));
          line.append(s);
          k.flight = { span: s };
          this.flyers.push(k);
          pos = b;
        }
        if (pos < text.length) { const g = el("span", "tn-dash", null); g.textContent = text.slice(pos); line.append(g); dashes.push(g); }
        this.dashes = dashes;
        this.dash = new ctx.Fade(ctx.clock, 0);
        line.classList.add("tn-flight");
      }
    }
    // the picture gradients
    this.washes = (T.gradients ?? []).map((g) => {
      const e = el("div", `tw-wash tw-wash-${g.edge}`);
      ctx.wash.append(e);
      return { g, e };
    });
  },

  /** where a block's box is: [x, y, w, h] px, its space and whether it is stacked */
  boxOf(k, phone, map) {
    const ctx = this.ctx, vw = ctx.stage.vw, vh = ctx.stage.vh, b = k.b;
    if (this.stacked && b.stack) {
      const s = dev(b.stack, phone);
      if (s) return { x: s[0] * vw, y: s[1] * vh, w: s[2] * vw, h: s[3] * vh, space: "viewport", stack: s };
    }
    const box = dev(b.box, phone);
    if (!box) return null;
    if ((dev(b.space, phone) ?? "viewport") === "frame" && map) {
      const [x0, y0] = ctx.stage.toScreen([box[0], box[1]], map), [x1, y1] = ctx.stage.toScreen([box[0] + box[2], box[1] + box[3]], map);
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, space: "frame" };
    }
    return { x: box[0] * vw, y: box[1] * vh, w: box[2] * vw, h: box[3] * vh, space: "viewport" };
  },

  layout(ctx) {
    const phone = ctx.phone, stage = ctx.stage, vw = stage.vw, vh = stage.vh, m = ctx.margin;
    // the cover's mapping (the fit test is about the first screen)
    const cover = stage.mappingFor(stage.rectAt({ screens: 0, phone }), ctx.data.stops[ctx.data.walk[0]]?.focus ?? [0.5, 0.5]);
    const setSize = (k, stacked) => {
      const z = k.b.size;
      const v = z ? (stacked && z.stack ? z.stack : dev(z, phone)) : null;
      k.e.style.fontSize = v ? (z.max && z.min ? `clamp(${z.min}, ${v}, ${z.max})` : z.max ? `min(${v}, ${z.max})` : z.min ? `max(${v}, ${z.min})` : v) : "";
    };
    for (const k of this.blocks) {
      // { phone: true } hides on phone only (dev() would fall back to the other device's value)
      const h = k.b.hidden, hid = Boolean(h && typeof h === "object" ? h[phone ? "phone" : "desktop"] : h);
      k.hidden = hid;
      k.e.style.display = hid ? "none" : "";
      k.e.style.transform = "";
      k.e.style.opacity = "";
      k.e.style.visibility = "";
      k.tf = null; k.op = null;
      setSize(k, false);
      const ka = dev(k.b.kickerAt, phone) ?? "above";
      k.e.dataset.kicker = ka;
    }
    // the fit test (4.3): frame-space boxes, mapped at the cover and clipped to the margins
    this.stacked = false;
    for (const k of this.blocks) {
      if (k.hidden || (dev(k.b.space, phone) ?? "viewport") !== "frame") continue;
      const bx = this.boxOf(k, phone, cover);
      if (!bx) continue;
      const room = Math.max(0, Math.min(bx.x + bx.w, vw - m) - Math.max(bx.x, m));
      const need = Math.max(0, ...k.texts.map((t) => t.getBoundingClientRect().width));
      k.fit = { room: Math.round(room), need: Math.round(need) };
      if (need > room + 0.5) this.stacked = true;
    }
    if (this.stacked && !this.blocks.some((k) => k.b.stack)) {
      if (!this.warned.has("nostack")) { this.warned.add("nostack"); warn("a frame-space title block doesn't fit its box and no block has a `stack` box"); }
      this.stacked = false;
    }
    ctx.root.classList.toggle("tour-title-stacked", this.stacked);
    for (const k of this.blocks) {
      const st = this.stacked && Boolean(k.b.stack);
      k.e.classList.toggle("is-stacked", st);
      if (st) setSize(k, true);
    }
    // place everything once at the cover to measure: stack groups, the flight's text rects, the nav-band check
    this.place(cover, phone, true);
    for (const k of this.blocks) {
      if (k.hidden) continue;
      const r = k.e.getBoundingClientRect();
      // text wider than its box, or past the margins, would run off the page: say so (sizes are vw with a px max)
      const need = Math.max(0, ...k.texts.map((t) => t.getBoundingClientRect().width));
      const room = Math.min(k.box?.w ?? vw, vw - 2 * m);
      if (need > room + 1 && !this.warned.has(`wide:${k.b.id}:${phone}`)) {
        this.warned.add(`wide:${k.b.id}:${phone}`);
        warn(`title block "${k.b.id}" is wider than its box on ${phone ? "phone" : "desktop"} (${Math.round(need)} px in ${Math.round(room)} px): lower its size`);
      }
      const top = k.css.top ?? r.top;
      if (top < ctx.navBottom - 0.5 && !this.warned.has(`nav:${k.b.id}:${phone}`)) {
        this.warned.add(`nav:${k.b.id}:${phone}`);
        warn(`title block "${k.b.id}" crosses the nav band on ${phone ? "phone" : "desktop"} (top ${Math.round(top)} px < ${ctx.navBottom} px)`);
      }
      // the text's rect relative to the block (FLIP origin)
      const rects = k.texts.map((t) => t.getBoundingClientRect());
      const x0 = Math.min(...rects.map((q) => q.left)), y0 = Math.min(...rects.map((q) => q.top));
      const x1 = Math.max(...rects.map((q) => q.right)), y1 = Math.max(...rects.map((q) => q.bottom));
      k.rel = { x: x0 - r.left, y: y0 - r.top, w: x1 - x0, h: y1 - y0 };
    }
    // the flight targets take the block's face (same string, same face, so the landing is exact)
    for (const k of this.flyers) {
      const span = k.flight.span, cs = getComputedStyle(k.texts[0]);
      const fs = parseFloat(cs.fontSize) || 16;
      Object.assign(span.style, {
        fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, fontStretch: cs.fontStretch, fontStyle: cs.fontStyle,
        fontVariationSettings: cs.fontVariationSettings, textTransform: cs.textTransform, fontFeatureSettings: cs.fontFeatureSettings,
        letterSpacing: cs.letterSpacing === "normal" ? "normal" : `${(parseFloat(cs.letterSpacing) / fs).toFixed(4)}em`,
      });
    }
    if (this.dashes?.length && this.flyers.length) {
      const cs = getComputedStyle(this.flyers[0].texts[0]);
      for (const g of this.dashes) Object.assign(g.style, { fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, fontStretch: cs.fontStretch, fontVariationSettings: cs.fontVariationSettings });
    }
    for (const k of this.flyers) {
      const r = k.flight.span.getBoundingClientRect();
      k.flight.to = { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    for (const w of this.washes) this.layoutWash(w, phone);
    this.lastMap = null;
  },

  layoutWash(w, phone) {
    const g = w.g;
    w.off = (g.device && g.device !== (phone ? "phone" : "desktop"));
    w.e.style.display = w.off ? "none" : "";
    if (w.off) return;
    const op = dev(g.opacity, phone) ?? [0.3, 0], ext = dev(g.extent, phone) ?? 0.3;
    const c = parseColour(g.color) ?? [0, 0, 0, 1];
    const rgba = (a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${+(a * c[3]).toFixed(4)})`;
    const dir = { top: "to bottom", bottom: "to top", left: "to right", right: "to left" }[g.edge] ?? "to bottom";
    const edge0 = op[0], far = op[1] ?? 0;
    const peak = Math.max(edge0, far, 1e-6);
    // the gradient is drawn at its full range; its opacity scales it between start and rest
    w.peak = peak;
    w.start = (dev(g.start, phone) ?? edge0) / Math.max(edge0, 1e-6);
    w.rest = (dev(g.rest, phone) ?? edge0) / Math.max(edge0, 1e-6);
    // a soft three-stop falloff (eased), so the band has no visible edge
    w.e.style.background = `linear-gradient(${dir}, ${rgba(edge0)} 0%, ${rgba(lerp(edge0, far, 0.5))} 45%, ${rgba(far)} 100%)`;
    const size = `${(ext * 100).toFixed(2)}%`;
    Object.assign(w.e.style, { top: "", bottom: "", left: "", right: "", width: "", height: "" });
    if (g.edge === "top" || g.edge === "bottom") Object.assign(w.e.style, { [g.edge]: "0", left: "0", right: "0", height: size });
    else Object.assign(w.e.style, { [g.edge]: "0", top: "0", bottom: "0", width: size });
  },

  /** sets every block's box (px); `measure` lays stack groups out from their measured heights */
  place(map, phone, measure = false) {
    const groups = new Map();
    for (const k of this.blocks) {
      if (k.hidden) continue;
      const bx = this.boxOf(k, phone, map);
      if (!bx) continue;
      k.box = bx;
      // a stacked block reads as one column: left-aligned unless it says otherwise (stackAlign)
      const align = bx.stack ? k.b.stackAlign ?? "left" : dev(k.b.align, phone) ?? "left", valign = dev(k.b.valign, phone) ?? (bx.stack ? "top" : "bottom");
      k.e.dataset.align = align;
      k.e.dataset.valign = valign;
      if (bx.stack) {
        const key = bx.stack.join(",");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(k);
        this.css(k, { left: bx.x, top: bx.y, width: bx.w, height: null });
      } else this.css(k, { left: bx.x, top: bx.y, width: bx.w, height: bx.h });
    }
    // a stack box holds its blocks one under the other, in order
    for (const list of groups.values()) {
      if (measure || !list[0].stackH) for (const k of list) k.stackH = k.e.offsetHeight;
      let y = list[0].box.y;
      for (const k of list) { this.css(k, { top: y }); y += k.stackH; }
    }
  },

  css(k, o) {
    for (const [p, v] of Object.entries(o)) {
      const s = v == null ? "" : `${Math.round(v * 100) / 100}px`;
      if (k.css[p] !== v) { k.css[p] = v; k.e.style[p] = s; }
    }
  },

  step(s, ctx) {
    const e = s.title.exit;
    // the occluder follows the exit (1 → 0), so it is gone before its masks run out
    ctx.stage.occAlpha = ctx.data.title.occluder ? 1 - e : 0;
    if (this.dash) this.dash.to(e >= 1 ? 1 : 0, 150, "linear");
  },

  paint(s, ctx) {
    const phone = ctx.phone, e = s.title.exit, map = ctx.stage.map;
    if (!this.blocks.length && !this.washes.length) return;
    // frame-space boxes follow the picture while the mapping changes (focus easing, the window)
    const mk = map ? `${map.ox.toFixed(2)},${map.oy.toFixed(2)},${map.dw.toFixed(2)}` : "";
    if (mk !== this.lastMap && e < 1) { this.lastMap = mk; this.place(map, phone); }
    const vw = ctx.stage.vw, vh = ctx.stage.vh;
    for (const k of this.blocks) {
      if (k.hidden) continue;
      const fly = this.flyers.includes(k) && k.rel && k.flight.to;
      let tf = "", op = 1;
      if (fly) {
        // FLIP: the text's rect flies to its span, scaling as a transform; at e = 1 the span takes over
        const q = ease.inout(e), to = k.flight.to, r = k.rel, b = k.box;
        const sc = lerp(1, to.w / Math.max(1, r.w), q);
        const tx = lerp(0, to.x - (b.x + r.x), q), ty = lerp(0, to.y - (b.y + r.y), q);
        k.e.style.transformOrigin = `${r.x}px ${r.y}px`;
        tf = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${sc.toFixed(5)})`;
        op = e >= 1 ? 0 : 1;
        k.flight.span.style.visibility = e >= 1 ? "visible" : "hidden";
      } else {
        const x = k.b.exit ?? {};
        const dx = len(x.dx ?? 0, vw, vh), dy = len(x.dy ?? (x.dx != null ? 0 : -56), vw, vh);
        tf = e > 0 ? `translate(${(dx * e).toFixed(2)}px, ${(dy * e).toFixed(2)}px)` : "";
        op = 1 - e;
      }
      if (tf !== k.tf) { k.tf = tf; k.e.style.transform = tf; }
      const o = op.toFixed(3);
      if (o !== k.op) { k.op = o; k.e.style.opacity = o; k.e.style.visibility = op <= 0.001 ? "hidden" : ""; }
    }
    if (this.dashes) { const v = this.dash.value.toFixed(3); for (const g of this.dashes) g.style.opacity = v; }
    for (const w of this.washes) {
      if (w.off) continue;
      const v = clamp(lerp(w.start, w.rest, e), 0, 4).toFixed(3);
      if (v !== w.v) { w.v = v; w.e.style.opacity = v; }
    }
  },

  reset() {
    for (const k of this.blocks) { k.tf = null; k.op = null; }
    for (const w of this.washes) w.v = null;
    this.dash?.snap(0);
    this.lastMap = null;
  },
};
