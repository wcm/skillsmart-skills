// Walk bar (design-system.md 4.6): the bottom band, one row with three slots. Left a counter (`02 / 03` + the stop name,
// or the stop's `bar` text), centre the ruler, right the site's meta line or a layer's slot (ctx.slots.walkbarRight).
//   theme.walkbar.layout   center-ruler (ruler 480 px centred) | left-ruler (counter + ruler at x 40–520, the right slot
//                          x 560–1400) | no-ruler (the right slot x 840–1400)
//   theme.walkbar.counter  name (default: number + name) | number | none
//   theme.walkbar.meta     a line for the right slot; {seen} {works} {n} {of} {stop} are filled live
//   theme.ruler.style      ticks (sliding under a fixed needle; works: true adds a tall tick per work that turns --signal
//                          once seen) | profile (a still ridge: ruler.profile heights 0–1 or null, ruler.summits = the
//                          stops' indices; a --signal marker climbs it; labels above the summits) | segments (one 2 px
//                          bar per move, numbered at the stops) | none
// The counter switches stop with the caption (the incoming move's 0.88), crossing over in 300 ms on the clock.

import { el, rich, plain, esc, clamp, lerp, ease, pad2, fillPx, snap } from "../util.js";
import { arrivedAt } from "./caption.js";

export const walkbar = {
  name: "walkbar",

  mount(ctx) {
    const d = ctx.data, th = d.theme, wb = th.walkbar ?? {}, ru = th.ruler ?? {};
    this.d = d;
    this.layoutName = wb.layout ?? "center-ruler";
    this.style = this.layoutName === "no-ruler" ? "none" : ru.style ?? "none";
    this.counterMode = wb.counter ?? "name";
    const bar = (this.el = el("div", "tour-walkbar", null, { "data-layout": this.layoutName, "data-ruler": this.style }));
    const left = (this.left = el("div", "tw-left"));
    const count = (this.count = el("div", "tw-count", null, { "aria-live": "polite" }));
    this.cur = el("span", "tw-cur");
    this.old = el("span", "tw-old", null, { "aria-hidden": "true" });
    count.append(this.old, this.cur);
    if (this.counterMode !== "none") left.append(count);
    const ruler = (this.ruler = el("div", "tw-ruler", null, { "data-style": this.style, "aria-hidden": "true" }));
    const right = (this.right = el("div", "tw-right"));
    if (this.layoutName === "left-ruler") { left.append(ruler); bar.append(left, right); }
    else if (this.layoutName === "no-ruler") bar.append(left, right);
    else bar.append(left, ruler, right);
    if (this.style === "none") ruler.hidden = true;
    ctx.ui.append(bar);
    ctx.slots.walkbar = bar; ctx.slots.walkbarLeft = left; ctx.slots.walkbarRight = right; ctx.slots.ruler = ruler;
    // the right slot: the meta line (layers mount into ctx.slots.walkbarRight themselves)
    const works = Object.keys(d.artworks ?? {}).length;
    this.meta = wb.meta ?? (wb.right === "meta" && ru.works && works ? "{seen} / {works} seen" : null);
    if (this.meta && wb.right !== "layer") { this.metaEl = el("div", "tw-meta t-label"); right.append(this.metaEl); }
    if (wb.hideOnTitle !== false && d.title.blocks.length) ctx.uiGroup.add(bar, 20);
    this.swap = new ctx.Fade(ctx.clock, 1);
    this.stopId = null;
    this.ticks = [];
    this.buildRuler(ctx);
  },

  /** the counter's text for a stop */
  counterHtml(ctx, id) {
    const d = this.d, st = d.stops[id], ids = ctx.tl.stopIds, i = ids.indexOf(id);
    if (st.bar) return `<span class="tw-name">${rich(st.bar)}</span>`;
    const n = st.n ?? pad2(i + 1), of = String(n).length > 1 ? pad2(ids.length) : String(ids.length);
    const num = `<span class="tw-n t-num">${esc(n)} / ${esc(of)}</span>`;
    return this.counterMode === "number" ? num : `${num}<span class="tw-name">${rich(st.name)}</span>`;
  },

  buildRuler(ctx) {
    const r = this.ruler, d = this.d, tl = ctx.tl, ru = d.theme.ruler ?? {};
    r.textContent = "";
    this.ticks = [];
    const W = tl.W || 1;
    const pw = (p) => clamp((p * tl.S) / W);
    this.pw = pw;
    this.stopPw = tl.stopIds.map((id) => pw(tl.stops[id].p[0]));
    if (this.style === "ticks") {
      const track = el("div", "tw-track"), strip = (this.strip = el("div", "tw-strip"));
      track.append(strip);
      r.append(track, el("div", "tw-needle"));
      const count = Math.max(2, ru.count ?? 40);
      const add = (x, cls, extra) => { const e = el("i", `tw-tick ${cls}`); strip.append(e); const t = { x, e, ...extra }; this.ticks.push(t); return t; };
      const stops = new Set(this.stopPw.map((x) => x.toFixed(4)));
      for (let i = 0; i < count; i++) { const x = i / (count - 1); if (!stops.has(x.toFixed(4))) add(x, ""); }
      this.stopPw.forEach((x) => add(x, "is-stop"));
      if (ru.works) for (const [wid, w] of Object.entries(d.artworks ?? {})) {
        const p = w.stop ? tl.pOf(w.stop) : w.at ? tl.pOf(w.at) : null;
        if (p != null) add(pw(p), "is-work", { work: wid });
      }
      this.nTicks = count;
    } else if (this.style === "profile") {
      const prof = ru.profile ?? [];
      const summits = ru.summits ?? [];
      const ridge = el("div", "tw-ridge");
      r.append(ridge);
      this.prof = prof;
      this.summits = summits;
      prof.forEach((h, i) => {
        if (h == null) return;
        const e = el("i", "tw-tick tw-ptick");
        e.style.setProperty("--h", String(clamp(h)));
        ridge.append(e);
        this.ticks.push({ i, h, e, x: 0 });
      });
      this.labels = tl.stopIds.map((id, j) => {
        const st = d.stops[id];
        const e = el("span", "tw-plabel t-label", rich(st.photo?.label ?? st.name));
        ridge.append(e);
        return { id, j, e };
      });
      this.marker = el("i", "tw-marker");
      ridge.append(this.marker);
      if (summits.length !== tl.stopIds.length) console.warn(`[tour] tour.json: theme.ruler.summits has ${summits.length} entries for ${tl.stopIds.length} stops`);
    } else if (this.style === "segments") {
      const row = el("div", "tw-segs");
      r.append(row);
      this.nums = [];
      this.segs = [];
      d.walk.forEach((id, i) => {
        if (i % 2 === 0) {
          const st = d.stops[id], j = i / 2;
          const n = el("span", "tw-snum t-num", esc(st.n ?? pad2(j + 1)));
          row.append(n);
          this.nums.push({ id, e: n });
        } else {
          const g = tl.moves[id] ?? tl.cuts[id];
          const s = el("span", `tw-seg${tl.cuts[id] ? " is-cut" : ""}`);
          const f = el("i", "tw-fill");
          s.append(f);
          row.append(s);
          this.segs.push({ g, e: s, f });
        }
      });
    }
  },

  layout(ctx) {
    this.rw = this.ruler.clientWidth || (ctx.phone ? 160 : 480);
    if (this.style === "ticks") {
      this.spacing = Math.max(4, (this.rw * 1.5) / this.nTicks);
      this.len = this.spacing * (this.nTicks - 1);
      for (const t of this.ticks) t.e.style.left = `${(t.x * this.len).toFixed(2)}px`;
    } else if (this.style === "profile") {
      const n = this.prof.length, u = this.rw / Math.max(1, n - 1), S = this.summits;
      const sx = S.map((idx, j) => {
        const a = S[0] * u, b = S[S.length - 1] * u, p0 = this.stopPw[0], p1 = this.stopPw[this.stopPw.length - 1];
        return lerp(a, b, (this.stopPw[j] - p0) / Math.max(1e-6, p1 - p0));
      });
      this.sx = sx;
      const xOf = (i) => {
        if (!S.length) return i * u;
        if (i <= S[0]) return sx[0] + (i - S[0]) * u;
        if (i >= S[S.length - 1]) return sx[S.length - 1] + (i - S[S.length - 1]) * u;
        for (let j = 1; j < S.length; j++) if (i <= S[j]) return lerp(sx[j - 1], sx[j], (i - S[j - 1]) / Math.max(1, S[j] - S[j - 1]));
        return i * u;
      };
      this.xOf = xOf;
      for (const t of this.ticks) { t.x = xOf(t.i); t.e.style.left = `${t.x.toFixed(2)}px`; }
      for (const l of this.labels) if (sx[l.j] != null) l.e.style.left = `${sx[l.j].toFixed(2)}px`;
    }
    for (const g of this.segs ?? []) { g.w = g.e.offsetWidth; g.fk = null; g.f._w = null; }
    this.k = null;
  },

  step(s, ctx) {
    const id = arrivedAt(ctx.tl, this.d, s.p);
    if (id !== this.stopId) {
      const first = this.stopId == null;
      this.prevHtml = this.stopId ? this.counterHtml(ctx, this.stopId) : "";
      this.stopId = id;
      this.html = this.counterHtml(ctx, id);
      if (first || ctx.clock.instant) this.swap.snap(1); else this.swap.snap(0).to(1, 300, "out");
      this.dirtyText = true;
    }
  },

  /** the marker's x on the profile ruler at p */
  markerX(s, ctx) {
    const tl = ctx.tl, seg = s.seg, ids = tl.stopIds;
    if (!this.sx?.length) return 0;
    const xAt = (id) => this.sx[ids.indexOf(id)] ?? 0;
    if (seg.kind === "cut") return s.cut.k < 0.55 ? xAt(seg.from) : xAt(seg.to);
    if (seg.kind === "move") return lerp(xAt(seg.from), xAt(seg.to), s.move.t);
    if (seg.kind === "end") return xAt(s.last);
    return xAt(seg.id);
  },

  paint(s, ctx) {
    if (this.dirtyText) {
      this.dirtyText = false;
      this.cur.innerHTML = this.html;
      this.old.innerHTML = this.prevHtml ?? "";
    }
    const v = this.swap.value, rise = ctx.reduced ? 0 : 8;
    const sk = v.toFixed(3);
    if (sk !== this.sk) {
      this.sk = sk;
      this.cur.style.opacity = sk;
      this.cur.style.transform = v < 1 && rise ? `translateY(${((1 - v) * rise).toFixed(2)}px)` : "";
      this.old.style.opacity = (1 - v).toFixed(3);
      this.old.style.transform = rise ? `translateY(${(-v * rise).toFixed(2)}px)` : "";
      this.old.style.visibility = v >= 1 ? "hidden" : "";
    }
    const pw = this.pw(s.p);
    if (this.style === "ticks") {
      const x = pw * this.len;
      const k = x.toFixed(2);
      if (k !== this.k) { this.k = k; this.strip.style.transform = `translateX(${(-snap(x)).toFixed(2)}px)`; }
      for (const t of this.ticks) {
        const passed = t.x <= pw + 1e-6;
        if (passed !== t.passed) { t.passed = passed; t.e.classList.toggle("is-passed", passed); }
        if (t.work) { const seen = ctx.seen.has(t.work); if (seen !== t.seen) { t.seen = seen; t.e.classList.toggle("is-seen", seen); } }
      }
    } else if (this.style === "profile") {
      const mx = this.markerX(s, ctx);
      const k = mx.toFixed(2);
      if (k !== this.k) {
        this.k = k;
        // the ridge height under the marker (between the neighbouring ticks)
        let h = 0, a = null, b = null;
        for (const t of this.ticks) { if (t.x <= mx + 0.01) a = t; else { b = t; break; } }
        if (a && b) h = lerp(a.h, b.h, (mx - a.x) / Math.max(1e-6, b.x - a.x)); else h = (a ?? b)?.h ?? 0;
        this.marker.style.transform = `translateX(${snap(mx).toFixed(2)}px)`;
        this.marker.style.setProperty("--h", h.toFixed(3));
        for (const t of this.ticks) { const passed = t.x <= mx + 0.01; if (passed !== t.passed) { t.passed = passed; t.e.classList.toggle("is-passed", passed); } }
      }
      for (const l of this.labels) { const on = l.id === this.stopId; if (on !== l.on) { l.on = on; l.e.classList.toggle("is-current", on); } }
    } else if (this.style === "segments") {
      for (const g of this.segs) {
        const f = clamp((s.p - g.g.p[0]) / Math.max(1e-9, g.g.p[1] - g.g.p[0]));
        const fk = f.toFixed(4);
        if (fk !== g.fk) { g.fk = fk; fillPx(g.f, f, g.w ?? g.e.offsetWidth); }
      }
      for (const n of this.nums) { const on = n.id === this.stopId; if (on !== n.on) { n.on = on; n.e.classList.toggle("is-current", on); } }
    }
    if (this.metaEl) {
      const works = Object.keys(this.d.artworks ?? {}).length, ids = ctx.tl.stopIds;
      const txt = this.meta.replace(/\{(\w+)\}/g, (m, k) => ({
        seen: String(ctx.seen.size), works: String(works), n: String(ids.indexOf(this.stopId) + 1), of: String(ids.length),
        stop: plain(this.d.stops[this.stopId]?.name ?? ""),
      })[k] ?? m);
      if (txt !== this.metaTxt) { this.metaTxt = txt; this.metaEl.innerHTML = rich(txt); }
    }
  },

  reset() {
    this.stopId = null; this.k = null; this.sk = null; this.metaTxt = null;
    for (const t of this.ticks) { t.passed = undefined; t.seen = undefined; }
    for (const g of this.segs ?? []) { g.fk = null; g.f._w = null; }
  },
};
