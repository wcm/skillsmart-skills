// Hotspots (design-system.md 4.7: level 1, fixed spots at the stops), the stops' drawn lines (the house's dimension line)
// and the fact pill (4.9, the hotel's `+` dots).
//
//   dot      an 8 px core in a 1 px ring 24 px across (hit area 44 px); icon "plus": a 12 px + in a soft ring
//   halo     theme.hotspot.halo "one": one breathing halo (scale 1 → 1.8, .35 → 0, 2.6 s, inout) on one dot: the next
//            beat's target at this stop, else the dot nearest the pointer, else the first dot with a card
//   leader   1 px, bent once: 20 px at 45°, then a 40 px run (theme or per hotspot `leader`)
//   plate    pill (code + name) · tag (name — price) · none (the dot opens a fact pill) · wall (an object's label);
//            state planned (dashed, no fill) or built (solid), cross-fading 300 ms when it turns; plateOn "hover"
//   timing   in when the incoming move passes 0.96 (stop 1: on load; enterAt: a fraction of the outgoing move, or "ui"
//            for the UI group), out when the outgoing move passes 0.04 (the last stop's: when an end sheet starts to
//            arrive; an end card keeps them); at most 4 at once. Clock: dot 240 ms, leader
//            280 ms, plate 320 ms (8 px rise), 120 ms apart; out 200 ms. Hover: ring 24 → 30 px, plate to full ink.
//   carried  a hotspot with `keys` [[t, x, y], …] rides through the outgoing move on those keyframes (move t of the
//            frame on screen) and becomes the next stop's hotspot with the same id; its state turns at `turn`
//            ({ at: t | event id, state }), else at the move event whose id is the hotspot's id, card or label
//   rule     a plate that would cross the nav band, the bottom band, a caption box, the map's corner or the viewport
//            edge flips to the other side of its dot; a dot outside the visible picture hides with its plate
//   click    opens its card (theme.hotspot.opens "card"), its fact pill ("pill"), or lifts its work (`work`)
//
// stops.*.lines: [{ kind: "dim" | "line", from, to, text }] in frame fractions: a 1 px line in .tour-lines (dim: end
// ticks and the text in a break of the line), shown with the stop's hotspots, drawing in over 280 ms.
//
// ctx: openHotspot(id), hoverHotspot(id, on); targets "hotspot:<id>"; events pill:open / pill:close, hotspot:hover.

import { el, svg, esc, rich, plain, clamp, lerp, ease, warn } from "../util.js";

const MAX = 4;
const PLUS = `<svg class="th-plus" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M6 0.75v10.5M0.75 6h10.5"/></svg>`;
const keyAt = (keys, t) => {
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    const [t0, x0, y0] = keys[i - 1], [t1, x1, y1] = keys[i], k = (t - t0) / (t1 - t0 || 1);
    return [lerp(x0, x1, k), lerp(y0, y1, k)];
  }
  const l = keys[keys.length - 1];
  return [l[1], l[2]];
};
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const hotspots = {
  name: "hotspots",

  mount(ctx) {
    const d = ctx.data, th = d.theme.hotspot, tl = ctx.tl, walk = d.walk;
    this.layer = el("div", "tour-hotspots");
    ctx.ui.append(this.layer);
    this.lineG = svg("g", { class: "th-lines" }, ctx.lines);
    const segP = (id, k) => { const g = tl.moves[id] ?? tl.cuts[id]; return g ? lerp(g.p[0], g.p[1], k) : null; };
    const uiP = (0.5 * (d.title.exit.screens ?? 0.3)) / (tl.S || 1);
    // the last stop's spots leave as an end sheet starts to arrive (they'd show through a knockout); an end card keeps them
    const lastOff = d.theme.end.arrive === "sheet" ? lerp(tl.end.p[0], tl.end.p[1], 0.04) : Infinity;
    this.spots = new Map();
    this.lines = [];
    tl.stopIds.forEach((sid) => {
      const i = walk.indexOf(sid), st = d.stops[sid];
      const inc = walk[i - 1], out = walk[i + 1], outMove = out && tl.moves[out] ? out : null;
      const baseOn = i === 0 ? -Infinity : segP(inc, 0.96);
      (st.hotspots ?? []).forEach((h, order) => {
        if (!Array.isArray(h.at)) return;
        const carried = Boolean(h.keys?.length && outMove);
        let on = baseOn;
        if (i === 0 && h.enterAt === "ui") on = uiP;
        else if (typeof h.enterAt === "number" && outMove) on = segP(outMove, clamp(h.enterAt));
        const off = !out ? lastOff : carried ? segP(outMove, 0.96) : segP(out, 0.04);
        const v = { stop: sid, h, order, on, off, carried, move: carried ? outMove : null, turnP: null, turnState: null };
        if (!this.spots.has(h.id)) this.spots.set(h.id, { id: h.id, versions: [] });
        this.spots.get(h.id).versions.push(v);
      });
      (st.lines ?? []).forEach((ln, j) => {
        if (!Array.isArray(ln.from) || !Array.isArray(ln.to)) return;
        this.lines.push({ stop: sid, ln, j, on: baseOn, off: out ? segP(out, 0.04) : lastOff });
      });
    });
    // a carried hotspot's state turns on the way (house: planned → built at the move event that names it)
    for (const sp of this.spots.values()) sp.versions.forEach((v, k) => {
      if (!v.carried) return;
      const next = sp.versions[k + 1];
      const turn = v.h.turn ?? null;
      const wantState = turn?.state ?? (next && next.stop === walk[walk.indexOf(v.stop) + 2] ? next.h.state : null);
      if (!wantState || wantState === (v.h.state ?? "built")) return;
      const g = tl.moves[v.move], evs = g.ref.events ?? [];
      let at = typeof turn?.at === "number" ? turn.at : null;
      if (at == null) {
        const names = [turn?.at, v.h.id, v.h.card, v.h.label && plain(v.h.label).toLowerCase()].filter(Boolean);
        at = evs.find((e) => names.includes(e.id))?.at ?? 0.5;
      }
      v.turnP = lerp(g.p[0], g.p[1], at);
      v.turnState = wantState;
    });
    // DOM: one element per hotspot id
    for (const sp of this.spots.values()) {
      const e = el("div", "th", null, { "data-hotspot": sp.id });
      const btn = el("button", "th-hit", `<span class="th-halo"></span><span class="th-ring"></span><span class="th-core"></span>`, { type: "button" });
      const lead = svg("svg", { class: "th-leader", width: 100, height: 40, viewBox: "0 0 100 40", "aria-hidden": "true" });
      const leadPath = svg("path", { d: "M8.5 31.5 L22.6 17.4 L62.6 17.4", pathLength: 1 }, lead);
      const plate = el("div", "th-plate");
      const pill = el("div", "th-pill t-label", null, { role: "status" });
      e.append(btn, lead, plate, pill);
      this.layer.append(e);
      Object.assign(sp, { e, btn, lead, leadPath, plate, pill, sw: new ctx.Switch(ctx.clock, false), vis: new ctx.Fade(ctx.clock, 1),
        hov: new ctx.Fade(ctx.clock, 0), solid: new ctx.Fade(ctx.clock, 0), pillF: new ctx.Fade(ctx.clock, 0), stagger: 0, v: null, rendered: null, side: null, css: {} });
      btn.addEventListener("click", () => this.activate(sp, ctx));
      btn.addEventListener("pointerenter", () => this.hover(sp, true, ctx));
      btn.addEventListener("pointerleave", () => this.hover(sp, false, ctx));
      btn.addEventListener("focus", () => this.hover(sp, true, ctx));
      btn.addEventListener("blur", () => this.hover(sp, false, ctx));
      ctx.target(`hotspot:${sp.id}`, () => {
        if (!sp.present || !sp.xy) return null;
        return { x: sp.xy[0], y: sp.xy[1], el: btn, verb: btn.dataset.verb, r: 22 };
      });
    }
    for (const L of this.lines) {
      L.g = svg("g", { class: `th-line th-line-${L.ln.kind ?? "line"}` }, this.lineG);
      L.paths = [svg("path", { pathLength: 1 }, L.g), svg("path", { pathLength: 1 }, L.g), svg("path", { class: "th-tick" }, L.g), svg("path", { class: "th-tick" }, L.g)];
      L.text = L.ln.text ? el("span", "th-dimtext t-label t-num", rich(L.ln.text)) : null;
      if (L.text) this.layer.append(L.text);
      L.sw = new ctx.Switch(ctx.clock, false);
    }
    this.pillOpen = null;
    this.haloOn = false;
    ctx.openHotspot = (id) => { const sp = this.spots.get(id); if (sp) this.activate(sp, ctx, true); };
    ctx.hoverHotspot = (id, on) => { const sp = this.spots.get(id); if (sp) this.hover(sp, on, ctx); };
    ctx.hotspotState = (id) => this.spots.get(id)?.state ?? null;
    addEventListener("keydown", (e) => { if (e.key === "Escape" && this.pillOpen) this.closePill(ctx); });
    addEventListener("pointerdown", (e) => { if (this.pillOpen && !e.target.closest?.(".th")) this.closePill(ctx); }, { passive: true });
  },

  activate(sp, ctx, scripted = false) {
    const v = sp.v ?? sp.versions[0], h = v.h, th = ctx.data.theme.hotspot;
    if (!scripted && !sp.present) return;
    if (h.work) { ctx.lift?.(h.work, { force: true, from: `hotspot:${sp.id}` }); return; }
    const plate = h.plate ?? th.plate;
    const opens = plate === "none" ? (th.opens === "card" && h.card ? "card" : "pill") : th.opens;
    if (opens === "card" && h.card) ctx.openCard?.(h.card, { from: sp.id });
    else if (opens === "pill" || (opens === "card" && !h.card && (h.pill || plate === "none"))) {
      if (this.pillOpen === sp.id) this.closePill(ctx);
      else { if (this.pillOpen) this.closePill(ctx); this.pillOpen = sp.id; ctx.emit("pill:open", { id: sp.id }); ctx.invalidate(); }
    }
  },
  closePill(ctx) { const id = this.pillOpen; this.pillOpen = null; if (id) ctx.emit("pill:close", { id }); ctx.invalidate(); },
  hover(sp, on, ctx) {
    if (sp.hovered === on) return;
    sp.hovered = on;
    ctx.emit("hotspot:hover", { id: sp.id, on });
    ctx.invalidate();
  },

  /** the plate's content for a version (re-rendered when the version changes) */
  render(sp, v, ctx) {
    const h = v.h, th = ctx.data.theme.hotspot, d = ctx.data;
    const icon = h.icon ?? th.icon ?? "dot";
    const plate = h.plate ?? th.plate ?? "pill";
    const leader = (h.leader ?? th.leader) && plate !== "none";
    const plateOn = h.plateOn ?? th.plateOn ?? "always";
    sp.e.dataset.icon = icon;
    sp.e.dataset.plate = plate;
    sp.e.dataset.leader = leader ? "1" : "0";
    sp.e.dataset.plateOn = plateOn;
    sp.btn.querySelector(".th-core").innerHTML = icon === "plus" ? PLUS : "";
    const verbs = d.theme.cursor?.verbs ?? {};
    const work = h.work ? d.artworks?.[h.work] : null;
    sp.btn.dataset.verb = work ? verbs.art ?? "Lift" : verbs.hotspot ?? "Open";
    const name = work?.title ?? h.label ?? h.code ?? h.id;
    sp.btn.setAttribute("aria-label", `${sp.btn.dataset.verb} ${plain(name)}`);
    let html = "";
    if (plate === "pill") {
      const code = h.code ? (d.theme.label.brackets ? `[${h.code}]` : h.code) : "";
      html = `${code ? `<span class="th-code t-label">${esc(code)}</span>` : ""}<span class="th-name">${rich(h.label ?? "")}</span>`;
    } else if (plate === "tag") {
      html = `<span class="th-name">${rich(h.label ?? "")}</span>${h.price ? `<span class="th-sep" aria-hidden="true">—</span><span class="th-price t-num">${rich(h.price)}</span>` : ""}`;
    } else if (plate === "wall") {
      const meta = work ? [work.year, work.medium].filter(Boolean).join(" · ") : h.code ?? "";
      html = `${work?.n ? `<span class="th-wn t-label t-num">${esc(work.n)}</span>` : ""}<span class="th-wt">${rich(name)}</span>${meta ? `<span class="th-wm">${rich(meta)}</span>` : ""}`;
    }
    sp.plate.innerHTML = html;
    sp.plate.hidden = !html;
    sp.pill.innerHTML = rich(h.pill ?? h.label ?? "");
    sp.rendered = v;
    sp.measured = false;
  },

  layout(ctx) {
    const vw = ctx.stage.vw, vh = ctx.stage.vh, phone = ctx.phone;
    // forbidden rects for plates (3.2): the nav band, the bottom band, each stop's caption box, the map's corner
    this.bands = [{ x: 0, y: 0, w: vw, h: ctx.navBottom + 8 }, { x: 0, y: vh - (phone ? 60 : 80), w: vw, h: phone ? 60 : 80 }];
    this.capRects = {};
    for (const c of ctx.ui.querySelectorAll(".tc[data-stop]")) {
      const r = c.getBoundingClientRect();
      if (r.width && r.height) this.capRects[c.dataset.stop] = { x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 };
    }
    const mapEl = ctx.ui.querySelector(".tour-map");
    const mr = mapEl && !phone ? mapEl.getBoundingClientRect() : null;
    this.mapRect = mr?.width ? { x: mr.left - 8, y: mr.top - 8, w: mr.width + 16, h: mr.height + 16 } : null;
    for (const sp of this.spots.values()) { sp.measured = false; sp.side = null; }
    for (const L of this.lines) L.tw = L.text ? L.text.offsetWidth : 0;
    // the rule: no dot in its stop's caption box (warned once per layout, on the stop's own mapping)
    if (!this.warned) {
      this.warned = true;
      for (const sp of this.spots.values()) for (const v of sp.versions) {
        const cr = this.capRects[v.stop];
        if (!cr) continue;
        const m = ctx.stage.mappingFor(ctx.stage.rectAt({ screens: ctx.tl.stops[v.stop].s[0] + 0.01, phone }), ctx.data.stops[v.stop].focus);
        const [x, y] = ctx.stage.toScreen(v.h.at, m);
        if (x > cr.x + 8 && x < cr.x + cr.w - 8 && y > cr.y + 8 && y < cr.y + cr.h - 8) warn(`stops.${v.stop}.hotspots "${sp.id}" sits inside the stop's caption box (${phone ? "phone" : "desktop"}); move it (3.2)`);
      }
    }
  },

  step(s, ctx) {
    const p = s.p;
    let rank = 0;
    const present = [];
    for (const sp of this.spots.values()) {
      let v = null;
      for (const x of sp.versions) if (p >= x.on && p < x.off) { v = x; break; }
      sp.v = v ?? sp.v;
      const on = Boolean(v);
      if (on) present.push(sp);
      sp.want = on;
    }
    present.sort((a, b) => a.v.order - b.v.order);
    const keep = new Set(present.slice(0, MAX));
    for (const sp of this.spots.values()) {
      const on = sp.want && keep.has(sp);
      if (on !== sp.sw.on) {
        sp.sw.set(on);
        sp.stagger = on && !ctx.clock.instant ? 120 * rank++ : 0;
        ctx.clock.hold(800);
        if (!on && this.pillOpen === sp.id) this.closePill(ctx);
      }
      sp.present = on;
      if (sp.v) {
        const st = sp.v.turnP != null && p >= sp.v.turnP ? sp.v.turnState : sp.v.h.state ?? "built";
        sp.state = st;
        sp.solid.to(st === "planned" ? 0 : 1, 300, "inout");
      }
      sp.hov.to(sp.hovered || this.forceHover === sp.id ? 1 : 0, 180, "out");
      sp.pillF.to(this.pillOpen === sp.id ? 1 : 0, 220, "out");
    }
    for (const L of this.lines) {
      const on = p >= L.on && p < L.off;
      if (on !== L.sw.on) { L.sw.set(on); ctx.clock.hold(600); }
    }
    // the halo: one dot at a time (4.7)
    const th = ctx.data.theme.hotspot;
    let halo = null;
    if (th.halo === "one" && !ctx.reduced && present.length) {
      const here = s.stop ?? s.last;
      const beat = ctx.data.record.beats.find((b) => b.at === here && /^hotspot:/.test(b.target) && keep.has(this.spots.get(b.target.slice(8))));
      if (beat) halo = beat.target.slice(8);
      else if (ctx.pointer.inside && !ctx.record) {
        let bd = Infinity;
        for (const sp of keep) if (sp.xy) { const dd = Math.hypot(sp.xy[0] - ctx.pointer.x, sp.xy[1] - ctx.pointer.y); if (dd < bd) { bd = dd; halo = sp.id; } }
      } else halo = [...keep].find((sp) => sp.v.h.card)?.id ?? null;
    }
    if ((halo != null) !== this.haloOn) { this.haloOn = halo != null; ctx.keepAlive(this.haloOn); }
    this.halo = halo;
  },

  paint(s, ctx) {
    const stage = ctx.stage, m = stage.map;
    if (!m) return;
    const R = m.R, vw = stage.vw, phone = ctx.phone, margin = ctx.margin;
    const viewT = s.kind === "move" ? ctx.viewT() : null;
    const capRect = this.capRects?.[s.stop ?? s.last] ?? null;
    for (const sp of this.spots.values()) {
      const v = sp.v;
      const age = sp.sw.age - sp.stagger;
      const vis = sp.sw.on || age < 200;
      if (!v || !vis) { if (sp.css.d !== "none") { sp.css.d = "none"; sp.e.style.display = "none"; } sp.xy = null; continue; }
      if (sp.css.d !== "") { sp.css.d = ""; sp.e.style.display = ""; }
      if (sp.rendered !== v && (sp.rendered == null || sp.sw.on)) this.render(sp, v, ctx);
      // where: the stop's spot, or the keyframes through the outgoing move
      let at = v.h.at;
      if (v.carried && s.kind === "move" && s.seg.id === v.move) at = keyAt(v.h.keys, viewT);
      const [x, y] = ctx.toScreen(at);
      sp.xy = [x, y];
      const inside = x >= R.x + 4 && x <= R.x + R.w - 4 && y >= R.y + 4 && y <= R.y + R.h - 4;
      sp.vis.to(inside ? 1 : 0, 200, inside ? "out" : "in");
      if (!sp.measured) {
        sp.pw = sp.plate.hidden ? 0 : sp.plate.offsetWidth; sp.ph = sp.plate.offsetHeight;
        sp.qw = sp.pill.offsetWidth; sp.qh = sp.pill.offsetHeight;
        sp.measured = true;
      }
      // the side (3.2 hotspot rule): keep the current side while it's clear, else flip
      const leader = sp.e.dataset.leader === "1";
      const ox = leader ? 68 : 20, oy = leader ? -22.6 : 0;
      const w = Math.max(sp.pw, sp.pillF.value > 0 ? sp.qw : 0), hh = Math.max(sp.ph, sp.qh);
      const rectFor = (side) => ({ x: side === "right" ? x + ox : x - ox - w, y: y + oy - hh / 2, w, h: hh });
      // what a side costs: off the viewport is worst, then a band, then a caption or the map
      const cost = (r) => (r.x < margin || r.x + r.w > vw - margin ? 4 : 0) + (this.bands.some((b) => hit(r, b)) ? 2 : 0) + ((capRect && hit(r, capRect)) || (this.mapRect && !phone && hit(r, this.mapRect)) ? 1 : 0);
      const pref = v.h.side === "left" ? "left" : v.h.side === "right" ? "right" : x > vw * 0.62 ? "left" : "right";
      let side = sp.side ?? pref;
      if (w) {
        const o = side === "right" ? "left" : "right", c0 = cost(rectFor(side)), c1 = cost(rectFor(o));
        if (c0 > 0 && c1 < c0) side = o;
      }
      sp.side = side;
      // motion (clock): dot 240 ms, leader 280, plate 320 with an 8 px rise, 120 ms apart; leave 200 ms
      const kDot = sp.sw.on ? ease.out(clamp(age / 240)) : 1;
      const kLead = sp.sw.on ? ease.out(clamp((age - 60) / 280)) : 1;
      const kPlate = sp.sw.on ? ease.out(clamp((age - 120) / 320)) : 1;
      const out = sp.sw.on ? 1 : 1 - ease.in(clamp(sp.sw.age / 200));
      const alpha = out * sp.vis.value;
      const hov = sp.hov.value;
      const plateOn = sp.e.dataset.plateOn === "hover" ? hov : 1;
      const isOpen = (v.h.card && ctx.card === v.h.card) || this.pillOpen === sp.id || (v.h.work && ctx.lifted === v.h.work);
      const halo = this.halo === sp.id;
      let haloS = 1, haloO = 0;
      if (halo) { const ph = ease.inout((ctx.clock.now() % 2600) / 2600); haloS = 1 + 0.8 * ph; haloO = 0.35 * (1 - ph); }
      const rise = ctx.reduced ? 0 : 8 * (1 - kPlate);
      const css = [x.toFixed(1), y.toFixed(1), alpha.toFixed(3), kDot.toFixed(3), kLead.toFixed(3), kPlate.toFixed(3), hov.toFixed(3), plateOn.toFixed(3),
        sp.solid.value.toFixed(3), sp.pillF.value.toFixed(3), side, isOpen, halo ? haloS.toFixed(3) + haloO.toFixed(3) : ""].join("|");
      if (css === sp.css.k) continue;
      sp.css.k = css;
      const e = sp.e;
      e.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      e.style.opacity = alpha.toFixed(3);
      e.style.visibility = alpha <= 0.001 ? "hidden" : "visible";
      e.style.pointerEvents = alpha > 0.5 ? "" : "none";
      e.dataset.side = side;
      e.classList.toggle("is-open", Boolean(isOpen));
      e.classList.toggle("is-hover", hov > 0.5);
      e.style.setProperty("--dot-k", kDot.toFixed(3));
      e.style.setProperty("--hov", hov.toFixed(3));
      e.style.setProperty("--solid", sp.solid.value.toFixed(3));
      e.style.setProperty("--halo-s", haloS.toFixed(3));
      e.style.setProperty("--halo-o", haloO.toFixed(3));
      sp.leadPath.style.strokeDashoffset = (1 - kLead).toFixed(4);
      sp.plate.style.opacity = (kPlate * plateOn).toFixed(3);
      sp.plate.style.transform = `translate(${side === "right" ? ox : -ox - sp.pw}px, ${(oy - sp.ph / 2 + rise).toFixed(2)}px)`;
      const pf = sp.pillF.value, slide = ctx.reduced ? 0 : 6 * (1 - pf);
      sp.pill.style.opacity = pf.toFixed(3);
      sp.pill.style.visibility = pf <= 0.001 ? "hidden" : "visible";
      sp.pill.style.transform = `translate(${side === "right" ? 20 - slide : -20 - sp.qw + slide}px, ${(-sp.qh / 2).toFixed(2)}px)`;
    }
    // lines (stops.*.lines): clipped to the visible picture, drawn in over 280 ms, the text in a break
    for (const L of this.lines) {
      const on = L.sw.on, age = L.sw.age;
      const kIn = on ? ease.out(clamp(age / 280)) : 1;
      const a = on ? 1 : 1 - ease.in(clamp(age / 200));
      const show = a > 0.001 && (on || age < 200);
      L.g.style.display = show ? "" : "none";
      if (L.text) L.text.style.display = show ? "" : "none";
      if (!show) continue;
      let p0 = ctx.toScreen(L.ln.from), p1 = ctx.toScreen(L.ln.to);
      // clip to R minus the margin (on a phone only part of the line shows)
      const lo = R.x + margin, hi = R.x + R.w - margin;
      const clipX = (pa, pb) => { if (pa[0] < lo) { const k = (lo - pa[0]) / (pb[0] - pa[0] || 1); return [lo, pa[1] + (pb[1] - pa[1]) * k, true]; } if (pa[0] > hi) { const k = (hi - pa[0]) / (pb[0] - pa[0] || 1); return [hi, pa[1] + (pb[1] - pa[1]) * k, true]; } return [...pa, false]; };
      const c0 = clipX(p0, p1), c1 = clipX(p1, p0);
      p0 = c0; p1 = c1;
      // nothing of it on screen (a phone's slice): hide it; too short for its words: hide the words
      const vis = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      if (vis < 24) { L.g.style.display = "none"; if (L.text) L.text.style.display = "none"; continue; }
      if (L.text) L.text.style.display = vis < L.tw + 40 ? "none" : "";
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      const gap = L.text && L.text.style.display !== "none" ? Math.min(len * 0.8, L.tw + 20) : 0;
      const f = (n) => n.toFixed(1);
      const [A, B, T0, T1] = L.paths;
      A.setAttribute("d", `M${f(mid[0] - (ux * gap) / 2)} ${f(mid[1] - (uy * gap) / 2)} L${f(p0[0])} ${f(p0[1])}`);
      B.setAttribute("d", `M${f(mid[0] + (ux * gap) / 2)} ${f(mid[1] + (uy * gap) / 2)} L${f(p1[0])} ${f(p1[1])}`);
      const tk = (pt, cut) => (L.ln.kind === "dim" && !cut ? `M${f(pt[0] - uy * 6)} ${f(pt[1] + ux * 6)} L${f(pt[0] + uy * 6)} ${f(pt[1] - ux * 6)}` : "");
      T0.setAttribute("d", tk(p0, c0[2])); T1.setAttribute("d", tk(p1, c1[2]));
      for (const pth of [A, B]) pth.style.strokeDashoffset = (1 - kIn).toFixed(4);
      for (const t of [T0, T1]) t.style.opacity = kIn.toFixed(3);
      L.g.style.opacity = a.toFixed(3);
      if (L.text) {
        const ang = Math.atan2(dy, dx) * 180 / Math.PI;
        L.text.style.transform = `translate(${f(mid[0])}px, ${f(mid[1])}px) translate(-50%, -50%)${Math.abs(ang) > 1.5 ? ` rotate(${ang.toFixed(2)}deg)` : ""}`;
        L.text.style.opacity = (a * kIn).toFixed(3);
      }
    }
  },

  reset(ctx) {
    for (const sp of this.spots.values()) {
      sp.sw = new ctx.Switch(ctx.clock, false); sp.stagger = 0; sp.v = null; sp.css = {}; sp.side = null;
      sp.vis.snap(1); sp.hov.snap(0); sp.solid.snap(0); sp.pillF.snap(0); sp.hovered = false;
    }
    for (const L of this.lines) L.sw = new ctx.Switch(ctx.clock, false);
    this.pillOpen = null; this.forceHover = null;
    if (this.haloOn) { this.haloOn = false; ctx.keepAlive(false); }
  },
};
