// The end sheet (design-system.md 4.12): how the walk hands over to the site's ask.
//
//   theme.end.arrive  "sheet": the end section (site HTML) slides up over the still-pinned stage (the scroll height and
//                     the sheet's negative margin are set by tour.js, 2) · "card": the end section moves into the stage
//                     as a panel (440 px, 40 px from the right, its bottom 100 px from the viewport's; phone: a bottom
//                     sheet, max 72svh) and opens at the last stop: when the incoming move passes `theme.end.at`
//                     (default 0.92), fading in and rising 24 px over 600 ms (out). A layer that draws its own opening
//                     (the hotel's booking line growing into the card) sets ctx.endCard.manual = true and reads
//                     ctx.endCard.sw (a Switch: on, age).
//   theme.end.frame   "dim": a dark layer (--scrim) over the picture, as strong as the share of the viewport the sheet
//                     covers · "keep": the picture stays clear (only the card is frosted: --card-blur) · "mask": no
//                     dimming (the site's first end block cuts its headline out of the sheet, a layer)
//   theme.end.pin     extra screens the stage stays pinned under the sheet (tour.js)
//
// ctx.endCard = { el, sw, manual, open } for arrive "card". Events: end:open / end:close (the card).

import { el, clamp, lerp, ease } from "../util.js";

export const end = {
  name: "end",

  mount(ctx) {
    const d = ctx.data, E = d.theme.end;
    this.frame = E.frame ?? "dim";
    if (this.frame === "dim") {
      this.dim = el("div", "tour-dim", null, { "aria-hidden": "true" });
      ctx.lines.after(this.dim);
    }
    this.card = null;
    if (E.arrive === "card" && ctx.end) {
      const e = ctx.end;
      e.classList.add("tour-end-card");
      e.setAttribute("data-tour-scrolls", "");
      ctx.ui.append(e);
      const sw = new ctx.Switch(ctx.clock, false);
      this.card = ctx.endCard = { el: e, sw, manual: false, open: false };
      const walk = d.walk, last = walk[walk.length - 1], inc = ctx.tl.moves[walk[walk.length - 2]] ?? ctx.tl.cuts[walk[walk.length - 2]];
      this.cardOn = inc ? lerp(inc.p[0], inc.p[1], E.at ?? 0.92) : ctx.tl.stops[last]?.p[0] ?? 1;
    }
  },

  step(s, ctx) {
    if (this.card) {
      const on = s.p >= this.cardOn;
      if (on !== this.card.sw.on) { this.card.sw.set(on); this.card.open = on; ctx.clock.hold(900); ctx.emit(on ? "end:open" : "end:close", {}); }
    }
  },

  paint(s, ctx) {
    if (this.dim) {
      // how much of the viewport the sheet covers (its top travels up from the bottom edge)
      const vh = ctx.stage.vh || innerHeight;
      const k = clamp((vh - s.endTop) / vh);
      const v = k.toFixed(3);
      if (v !== this.dv) { this.dv = v; this.dim.style.opacity = v; this.dim.style.visibility = k <= 0.001 ? "hidden" : "visible"; }
    }
    if (this.card && !this.card.manual) {
      const sw = this.card.sw, ms = ctx.reduced ? 250 : 600;
      const k = sw.on ? ease.out(clamp(sw.age / ms)) : 1 - ease.in(clamp(sw.age / 280));
      const v = (sw.on || sw.age < 280 ? k : 0).toFixed(3);
      if (v !== this.cv) {
        this.cv = v;
        const e = this.card.el;
        e.style.setProperty("--o", v);
        e.style.visibility = +v <= 0.001 ? "hidden" : "visible";
        e.style.pointerEvents = +v > 0.5 ? "auto" : "none";
        e.style.transform = ctx.reduced || +v >= 1 ? "" : `translateY(${((1 - +v) * 24).toFixed(2)}px)`;
      }
    }
  },

  reset(ctx) {
    this.dv = null; this.cv = null;
    if (this.card) { this.card.sw = ctx.endCard.sw = new ctx.Switch(ctx.clock, false); this.card.open = false; }
  },
};
