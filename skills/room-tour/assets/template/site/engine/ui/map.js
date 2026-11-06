// Mini-map (design-system.md 4.10): a site-drawn SVG in the corner box (200×140, 40 px from the side; `br` and `bl` 100 px
// from the bottom, `tr` and `tl` 96 px from the top; a site may set a larger box in its CSS). Hidden on phones.
//
//   theme.map: { svg, corner: "tr" | "br" | "bl" | "tl", frame: "title-block" | "crop", cone, from: <move id> | "ui", label }
//   stops.*.map: { stop: <#stops [data-stop]>, room: <#rooms [data-room]>, heading: degrees (0 = up, clockwise) }
//
// The SVG carries `#route` (one path along the walk; a cut is a jump between subpaths), `#stops [data-stop]` (small
// circles) and `#rooms [data-room]` (room shapes). The engine adds the walked part of the route (solid, the rest
// dashed), the you-are-here marker moving along the route with the walk (getPointAtLength, scroll): a 14 px dot in
// --map-here (red) with a pale ring, and two thin rings rippling out of it (2.6 s, a CSS animation live; driven by the
// clock in ?record so a frame's pixels never depend on when it was drawn; still with reduced motion), a 40° view cone
// turned to the heading (eased between the stops' headings) with `cone: true`, and the current room's fill
// (cross-fading 300 ms, clock). It arrives with the UI group (`from: "ui"`) or when its move starts (300 ms), and fades
// as the end sheet's top passes it. Clicking a room glides to the last stop in it; clicking a stop circle glides there.

import { el, svg, esc, clamp, lerp, ease } from "../util.js";

const HERE = 7, RIPPLE = 2.6;   // the marker's radius in screen px; one ripple, in seconds

export const map = {
  name: "map",

  mount(ctx) {
    const d = ctx.data, M = d.theme.map;
    this.on = Boolean(M?.svg);
    if (!this.on) return;
    const box = (this.box = el("div", "tour-map", null, { "data-corner": M.corner ?? "br", "data-frame": M.frame ?? "crop", "aria-label": "Map" }));
    this.svgHost = el("div", "tm-svg");
    box.append(this.svgHost);
    if (M.frame === "crop" || !M.frame) {
      const marks = svg("svg", { class: "tm-crop", "aria-hidden": "true" }, box);
      this.cropMarks = marks;
    }
    if (M.label) box.append(el("div", "tm-label t-label", esc(M.label)));
    ctx.ui.append(box);
    this.fromUI = (M.from ?? "ui") === "ui";
    if (this.fromUI) ctx.uiGroup.add(box, 40);
    this.fade = new ctx.Fade(ctx.clock, 0);
    this.endF = new ctx.Fade(ctx.clock, 1);
    this.rooms = new Map();
    this.ready = fetch(ctx.base + M.svg).then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.status)))).then((txt) => this.build(txt, ctx))
      .catch((e) => { console.warn(`[tour] theme.map.svg: couldn't load ${M.svg} (${e.message})`); this.on = false; box.remove(); });
  },

  build(txt, ctx) {
    const doc = new DOMParser().parseFromString(txt, "image/svg+xml");
    const src = doc.querySelector("svg");
    if (!src) throw new Error("no <svg>");
    for (const bad of src.querySelectorAll("script, foreignObject")) bad.remove();
    const s = (this.svgEl = document.importNode(src, true));
    s.removeAttribute("width"); s.removeAttribute("height");
    s.setAttribute("class", "tm-plan");
    s.setAttribute("preserveAspectRatio", "xMidYMid meet");
    this.svgHost.append(s);
    const route = (this.route = s.querySelector("#route"));
    if (!route?.getTotalLength) { console.warn("[tour] theme.map.svg has no #route path"); return; }
    route.classList.add("tm-route");
    this.total = route.getTotalLength();
    const walked = (this.walked = route.cloneNode());
    walked.removeAttribute("id");
    walked.setAttribute("class", "tm-walked");
    route.after(walked);
    const top = svg("g", { class: "tm-top" }, s);
    this.cone = svg("path", { class: "tm-cone" }, top);
    this.ripples = [0, 1].map((i) => svg("circle", { class: "tm-ripple", r: 3, style: `--i: ${i}` }, top));
    this.dot = svg("circle", { class: "tm-dot", r: 3 }, top);
    if (!ctx.data.theme.map.cone) this.cone.style.display = "none";
    // the stops' places along the route (the nearest point to each stop circle)
    const d = ctx.data;
    const near = (x, y) => {
      let best = 0, bd = Infinity;
      const N = 400;
      for (let i = 0; i <= N; i++) { const L = (this.total * i) / N, p = route.getPointAtLength(L), dd = (p.x - x) ** 2 + (p.y - y) ** 2; if (dd < bd) { bd = dd; best = L; } }
      for (let step = this.total / N; step > 0.05; step /= 2) for (const L of [best - step, best + step]) {
        if (L < 0 || L > this.total) continue;
        const p = route.getPointAtLength(L), dd = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (dd < bd) { bd = dd; best = L; }
      }
      return best;
    };
    this.L = {};
    const ids = ctx.tl.stopIds;
    ids.forEach((id, i) => {
      const m = d.stops[id].map;
      const c = m?.stop ? s.querySelector(`#stops [data-stop="${CSS.escape(m.stop)}"]`) : null;
      if (c) {
        const b = c.getBBox();
        this.L[id] = near(b.x + b.width / 2, b.y + b.height / 2);
        c.classList.add("tm-stop");
        c.addEventListener("click", () => ctx.glide(id));
      }
    });
    // stops without a circle sit evenly between their neighbours
    ids.forEach((id, i) => {
      if (this.L[id] != null) return;
      const prev = ids.slice(0, i).reverse().find((x) => this.L[x] != null), next = ids.slice(i + 1).find((x) => this.L[x] != null);
      this.L[id] = prev == null ? (next == null ? (this.total * i) / Math.max(1, ids.length - 1) : 0) : next == null ? this.total : (this.L[prev] + this.L[next]) / 2;
    });
    for (const r of s.querySelectorAll("#rooms [data-room]")) {
      const id = r.dataset.room;
      r.classList.add("tm-room");
      const last = [...ids].reverse().find((x) => d.stops[x].map?.room === id);
      if (last) r.addEventListener("click", () => ctx.glide(last));
      else r.style.pointerEvents = "none";
      this.rooms.set(id, { e: r, f: new ctx.Fade(ctx.clock, 0) });
    }
    this.layout(ctx);
    ctx.invalidate();
  },

  layout(ctx) {
    this.boxBottom = null;
    if (!this.on || !this.svgEl) return;
    const vb = this.svgEl.viewBox.baseVal, w = this.svgHost.clientWidth || 200, h = this.svgHost.clientHeight || 118;
    this.scale = vb && vb.width ? Math.min(w / vb.width, h / vb.height) : 1;
    for (const c of [this.dot, ...this.ripples]) c.setAttribute("r", (HERE / this.scale).toFixed(3));
    if (this.cropMarks) {
      const W = this.box.clientWidth, H = this.box.clientHeight, a = 8;
      this.cropMarks.setAttribute("viewBox", `0 0 ${W} ${H}`);
      this.cropMarks.innerHTML = `<path d="M0.5 ${a}V0.5H${a} M${W - a} 0.5H${W - 0.5}V${a} M${W - 0.5} ${H - a}V${H - 0.5}H${W - a} M${a} ${H - 0.5}H0.5V${H - a}"/>`;
    }
  },

  /** the route length, heading and room at a state */
  where(s, ctx) {
    const d = ctx.data, st = (id) => d.stops[id]?.map ?? {};
    const seg = s.seg;
    const hOf = (id) => st(id).heading ?? 0;
    if (seg.kind === "move") {
      const t = s.move.t, e = ease.inout(t);
      let h0 = hOf(seg.from), h1 = hOf(seg.to), dh = ((h1 - h0 + 540) % 360) - 180;
      return { L: lerp(this.L[seg.from], this.L[seg.to], t), heading: h0 + dh * e, room: t < 0.5 ? st(seg.from).room : st(seg.to).room };
    }
    if (seg.kind === "cut") { const id = s.cut.k < 0.55 ? seg.from : seg.to; return { L: this.L[id], heading: hOf(id), room: st(id).room }; }
    const id = seg.kind === "end" ? s.last : seg.id;
    return { L: this.L[id], heading: hOf(id), room: st(id).room };
  },

  step(s, ctx) {
    if (!this.on || !this.route) return;
    if (!this.fromUI) {
      const g = ctx.tl.moves[ctx.data.theme.map.from];
      this.fade.to(!g || s.p >= g.p[0] ? 1 : 0, 300, "linear");
    }
    // the end sheet passes the map: it fades as the sheet's top reaches the box's bottom
    const bottom = this.boxBottom ?? 0;
    this.endF.to(s.endTop < bottom ? 0 : 1, 300, "linear");
    const w = (this.w = this.where(s, ctx));
    for (const [id, r] of this.rooms) r.f.to(id === w.room ? 1 : 0, 300, "linear");
  },

  paint(s, ctx) {
    if (!this.on || !this.route) return;
    if (this.boxBottom == null) { const r = this.box.getBoundingClientRect(); this.boxBottom = r.bottom; }
    const o = (this.fromUI ? 1 : this.fade.value) * this.endF.value;
    this.box.style.setProperty("--o", o.toFixed(3));
    if (!this.fromUI) this.box.style.visibility = o <= 0.001 ? "hidden" : "visible";
    const { L, heading } = this.w ?? this.where(s, ctx);
    const k = `${L.toFixed(2)}|${heading.toFixed(1)}`;
    if (k !== this.k) {
      this.k = k;
      this.walked.style.strokeDasharray = `${L.toFixed(2)} ${(this.total + 1).toFixed(2)}`;
      const p = this.route.getPointAtLength(clamp(L, 0, this.total));
      for (const c of [this.dot, ...this.ripples]) { c.setAttribute("cx", p.x.toFixed(2)); c.setAttribute("cy", p.y.toFixed(2)); }
      const r = 24 / (this.scale || 1), a = ((heading - 90) * Math.PI) / 180, half = (20 * Math.PI) / 180;
      const x1 = p.x + r * Math.cos(a - half), y1 = p.y + r * Math.sin(a - half), x2 = p.x + r * Math.cos(a + half), y2 = p.y + r * Math.sin(a + half);
      this.cone.setAttribute("d", `M${p.x.toFixed(2)} ${p.y.toFixed(2)} L${x1.toFixed(2)} ${y1.toFixed(2)} A${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`);
    }
    let changed = k !== this.kPainted;
    this.kPainted = k;
    // ?record: the ripple follows the recording's clock, so the same frame number draws the same rings
    if (ctx.record && !ctx.reduced) {
      const t = ctx.clock.seconds() / RIPPLE;
      this.ripples.forEach((c, i) => {
        const f = (t + i / this.ripples.length) % 1, e = 1 - (1 - f) ** 2.4;
        c.style.transform = `scale(${(1 + 2.8 * e).toFixed(4)})`;
        c.style.opacity = (0.9 * (1 - f)).toFixed(4);
      });
      changed = true;
    }
    for (const r of this.rooms.values()) { const v = r.f.value.toFixed(3); if (v !== r.v) { r.v = v; changed = true; r.e.style.setProperty("--f", v); r.e.classList.toggle("is-current", +v > 0.5); } }
    // ?record: a change repaints the whole box (a partial repaint anti-aliases the shared room edges differently
    // depending on what was painted before, which would break the same-pixels rule); the outline is transparent
    if (ctx.record && changed) { this.flip = !this.flip; this.box.style.outlineOffset = this.flip ? "1px" : "0px"; }
  },

  reset(ctx) {
    if (!this.on) return;
    this.fade.snap(0); this.endF.snap(1); this.k = null; this.kPainted = null;
    for (const r of this.rooms.values()) { r.f.snap(0); r.v = null; }
  },
};
