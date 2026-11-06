// Rail (design-system.md 4.5): where am I, where can I go. theme.rail.skin:
//   index   a text list in the nav centre, `01 Shell · 02 Living room · 03 Pool deck`; the current stop at 100 %, the
//           others at 55 %; a 1 px underline under the stop being walked to fills with the move (house 8)
//   strip   under the nav at the right, small thumbnails of the stops (64×40, 28 px apart, stops.*.photo.thumb or
//           stops.*.thumb) numbered beneath; hairlines join thumbs a move connects and fill with it; a cut is a plain
//           gap; the current thumb has a 1 px --signal outline; one line below names it (`label · time`); hovering a
//           thumb shows it larger with theme.rail.pop ({n} {of} {label} {time} {name}) (hotel 2)
//   works   under the nav, centred: the show's works (artworks.*.thumb, 56 px tall, true aspect), numbered, with the
//           count `(07)`; the work in view (ctx.inView, set by the art layer; else the work nearest the walk) is
//           underlined; a click glides to its stop or point, then calls ctx.lift(id) when the art layer has set it
// Clicking a stop glides there (1.2 s, inout; further stops at twice that speed). Phone: index becomes a `Stops` chip
// in the nav (it glides to the next stop; the list sheet is later), strip shows `2 / 4`, works `3 / 7`.

import { el, rich, plain, esc, clamp, pad2, fillPx } from "../util.js";
import { arrivedAt } from "./caption.js";

export const rail = {
  name: "rail",

  mount(ctx) {
    const d = ctx.data, th = d.theme.rail ?? {}, tl = ctx.tl;
    this.d = d;
    this.skin = th.skin ?? "index";
    this.items = [];
    this.links = [];
    if (this.skin === "none") return;
    const group = th.hideOnTitle !== false && d.title.blocks.length > 0;
    const ids = tl.stopIds;
    if (this.skin === "index") {
      const host = ctx.slots.navCenter;
      if (host && host.dataset.kind === "line") console.warn("[tour] theme.rail.skin is \"index\" but nav.center is a line of text; the index goes under the nav");
      const list = (this.el = el("ol", "tour-rail tr-index", null, { "data-case": th.case ?? "sentence", "aria-label": "Stops" }));
      ids.forEach((id, i) => {
        const st = d.stops[id];
        const li = el("li", "tr-item");
        const b = el("button", "tr-stop", `<span class="tr-n t-num">${esc(st.n ?? pad2(i + 1))}</span> <span class="tr-name">${rich(st.name)}</span><i class="tr-under"></i>`, { type: "button" });
        b.addEventListener("click", () => ctx.glide(id));
        li.append(b);
        list.append(li);
        this.items.push({ id, e: b, under: b.querySelector(".tr-under"), uf: new ctx.Fade(ctx.clock, 0) });
      });
      if (host && host.dataset.kind !== "line") host.append(list); else ctx.ui.append(list);
      // phone: the Stops chip
      const chip = (this.chip = el("button", "tn-chip tn-chip-text tr-stops", `<span>Stops</span> <span class="tr-stops-n t-num"></span>`, { type: "button", "aria-label": "Next stop" }));
      chip.addEventListener("click", () => {
        const i = ids.indexOf(this.cur);
        ctx.glide(ids[(i + 1) % ids.length]);
      });
      ctx.slots.navRight?.prepend(chip);
      if (group) { ctx.uiGroup.add(list, 30); ctx.uiGroup.add(chip, 31); }
    } else if (this.skin === "strip") {
      const wrap = (this.el = el("nav", "tour-rail tr-strip", null, { "aria-label": "Hotel photos" }));
      const row = el("div", "tr-row");
      wrap.append(row);
      d.walk.forEach((id, i) => {
        if (i % 2 === 1) {
          const isCut = Boolean(tl.cuts[id]);
          const ln = el("span", isCut ? "tr-gap" : "tr-link", isCut ? null : `<i class="tr-fill"></i>`);
          row.append(ln);
          if (!isCut) this.links.push({ g: tl.moves[id], f: ln.querySelector(".tr-fill") });
          return;
        }
        const st = d.stops[id], ph = st.photo ?? {}, j = ids.indexOf(id);
        const src = ph.thumb ?? st.thumb;
        const b = el("button", "tr-thumb", null, { type: "button", "aria-label": plain(ph.label ?? st.name) });
        b.innerHTML = `<span class="tr-img">${src ? `<img src="${esc(ctx.base + src)}" alt="" width="64" height="40" decoding="async">` : ""}</span><span class="tr-num t-label t-num">${esc(ph.n ?? st.n ?? j + 1)}</span>`;
        if (th.pop) {
          const big = ph.thumbLg ?? src;
          const txt = th.pop.replace(/\{(\w+)\}/g, (m, k) => ({ n: ph.n ?? j + 1, of: ph.of ?? ids.length, label: ph.label ?? st.name, time: ph.time ?? "", name: st.name })[k] ?? m);
          const pop = el("span", "tr-pop", `${big ? `<img src="${esc(ctx.base + big)}" alt="" decoding="async">` : ""}<span class="tr-pop-t t-label">${rich(txt)}</span>`, { "aria-hidden": "true" });
          b.append(pop);
        }
        b.addEventListener("click", () => ctx.glide(id));
        row.append(b);
        this.items.push({ id, e: b, line: [ph.label ?? st.name, ph.time].filter(Boolean).join(" · ") });
      });
      this.lineEl = el("div", "tr-line t-label");
      wrap.append(this.lineEl);
      this.phoneEl = el("div", "tr-phone t-label t-num");
      wrap.append(this.phoneEl);
      ctx.ui.append(wrap);
      if (group) ctx.uiGroup.add(wrap, 30);
    } else if (this.skin === "works") {
      const works = Object.entries(d.artworks ?? {}).sort((a, b) => String(a[1].n ?? a[0]).localeCompare(String(b[1].n ?? b[0])));
      const wrap = (this.el = el("nav", "tour-rail tr-works", null, { "aria-label": "Works" }));
      const row = el("div", "tr-row");
      wrap.append(row);
      this.works = works.map(([wid, w], i) => {
        const h = 56, sz = w.size?.map(parseFloat);
        const width = sz && sz[0] > 0 && sz[1] > 0 ? Math.round((h * sz[1]) / sz[0]) : null;
        const b = el("button", "tr-work", null, { type: "button", "aria-label": plain(`${w.n ?? i + 1} ${w.title}`) });
        b.innerHTML = `<span class="tr-img"${width ? ` style="width:${width}px"` : ""}>${w.thumb ? `<img src="${esc(ctx.base + w.thumb)}" alt="" height="56" decoding="async">` : ""}</span><span class="tr-num t-label t-num">${esc(w.n ?? pad2(i + 1))}</span>`;
        b.addEventListener("click", async () => {
          const to = w.stop ?? (w.at ? { move: w.at.move, t: w.at.t } : null);
          if (to) await ctx.glide(to);
          if (ctx.lift) ctx.lift(wid, { force: true }); else ctx.emit("work:select", { id: wid });
        });
        row.append(b);
        const p = w.stop ? tl.pOf(w.stop) : w.at ? tl.pOf(w.at) : null;
        return { id: wid, e: b, p };
      });
      row.append(el("span", "tr-count t-label t-num", `(${pad2(works.length)})`));
      this.phoneEl = el("div", "tr-phone t-label t-num");
      wrap.append(this.phoneEl);
      ctx.ui.append(wrap);
      if (group) ctx.uiGroup.add(wrap, 30);
    }
  },

  layout() {
    for (const it of this.items) { if (it.under) { it.w = it.e.offsetWidth; it.under._w = null; it.v = null; } }
    for (const l of this.links) { l.w = l.f.parentElement.offsetWidth - 10; l.f._w = null; l.v = null; }
  },

  step(s, ctx) {
    if (this.skin === "none") return;
    this.cur = arrivedAt(ctx.tl, this.d, s.p);
    if (this.skin === "index") {
      const dest = s.seg.kind === "move" || s.seg.kind === "cut" ? s.seg.to : null;
      for (const it of this.items) {
        it.uf.to(it.id === dest ? 1 : 0, 300, "out");
        if (it.id === dest) it.fill = s.k;   // kept while the underline fades out after arriving
      }
    }
    if (this.skin === "works") {
      // the work in view: the art layer's choice, else the work nearest the walk
      let best = ctx.inView, bd = Infinity;
      if (!best) for (const w of this.works) if (w.p != null) { const dd = Math.abs(w.p - s.p); if (dd < bd - 1e-9) { bd = dd; best = w.id; } }
      this.view = best;
    }
  },

  paint(s, ctx) {
    if (this.skin === "none") return;
    const ids = ctx.tl.stopIds, ci = ids.indexOf(this.cur);
    if (this.skin === "index") {
      for (const it of this.items) {
        const on = it.id === this.cur;
        if (on !== it.on) { it.on = on; it.e.classList.toggle("is-current", on); it.e.setAttribute("aria-current", on ? "step" : "false"); }
        const fill = it.fill ?? 0;
        const v = `${clamp(fill).toFixed(4)}|${it.uf.value.toFixed(3)}`;
        if (v !== it.v) { it.v = v; fillPx(it.under, fill, it.w ?? it.e.offsetWidth); it.under.style.opacity = it.uf.value.toFixed(3); }
      }
      const txt = `${ci + 1} / ${ids.length}`;
      if (txt !== this.chipTxt) { this.chipTxt = txt; this.chip.querySelector(".tr-stops-n").textContent = txt; }
    } else if (this.skin === "strip") {
      for (const it of this.items) {
        const on = it.id === this.cur;
        if (on !== it.on) { it.on = on; it.e.classList.toggle("is-current", on); it.e.setAttribute("aria-current", on ? "step" : "false"); }
      }
      for (const l of this.links) {
        const f = clamp((s.p - l.g.p[0]) / Math.max(1e-9, l.g.p[1] - l.g.p[0])).toFixed(4);
        if (f !== l.v) { l.v = f; fillPx(l.f, +f, l.w ?? l.f.parentElement.offsetWidth - 10); }
      }
      const it = this.items[ci];
      if (it && it.line !== this.lineTxt) { this.lineTxt = it.line; this.lineEl.innerHTML = rich(it.line); }
      const pt = `${ci + 1} / ${ids.length}`;
      if (pt !== this.phoneTxt) { this.phoneTxt = pt; this.phoneEl.textContent = pt; }
    } else if (this.skin === "works") {
      for (const w of this.works) {
        const on = w.id === this.view;
        if (on !== w.on) { w.on = on; w.e.classList.toggle("is-view", on); }
        const seen = ctx.seen.has(w.id);
        if (seen !== w.seen) { w.seen = seen; w.e.classList.toggle("is-seen", seen); }
      }
      const vi = this.works.findIndex((w) => w.id === this.view);
      const pt = `${vi + 1} / ${this.works.length}`;
      if (pt !== this.phoneTxt) { this.phoneTxt = pt; this.phoneEl.textContent = pt; }
    }
  },

  reset() {
    for (const it of this.items) { it.on = undefined; it.v = null; it.fill = 0; it.uf?.snap(0); if (it.under) it.under._w = null; }
    for (const l of this.links) { l.v = null; l.f._w = null; }
    for (const w of this.works ?? []) { w.on = undefined; w.seen = undefined; }
    this.chipTxt = this.phoneTxt = this.lineTxt = null;
  },
};
