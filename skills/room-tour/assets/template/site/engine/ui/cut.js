// The cut's words (design-system.md 4.11, scroll version). The picture side of the cut (the next stop's picture rising as
// a sheet, the old frame drifting up 10 % and darkening to .6, the 200 ms cross-fade with reduced motion) is drawn by
// the stage; this draws what rides on it:
//
//   0.00–0.60  a 1 px --line-photo hairline along the sheet's top edge; the cut's `line` 12 px above it in the label
//              face and its `note` under it in the text face, riding up with the edge (they fade out as the edge
//              nears the nav band)
//   0.55–1.00  the next stop's name rises line by line (0.08 screens apart) in that stop's caption style: the cut's
//              `title` lines (e.g. ["ROOM 12", "*Grat*"]) become the next stop's caption heading (caption.js draws
//              them, scroll-driven, so the words that rose in the cut stay as the heading)
//
// cuts.*: { line, note, title }. Reduced motion: the words fade in place, no rise and no riding.

import { el, rich, clamp, ease } from "../util.js";

export const cut = {
  name: "cut",

  mount(ctx) {
    this.items = [];
    for (const [id, c] of Object.entries(ctx.data.cuts ?? {})) {
      if (!c.line && !c.note) continue;
      const wrap = el("div", "tour-cut", null, { "data-cut": id, "aria-hidden": "true" });
      const rule = el("div", "tcut-rule");
      const line = c.line ? el("div", "tcut-line t-label", rich(c.line)) : null;
      const note = c.note ? el("div", "tcut-note", rich(c.note)) : null;
      wrap.append(rule);
      if (line) wrap.append(line);
      if (note) wrap.append(note);
      ctx.ui.append(wrap);
      this.items.push({ id, wrap, rule, line, note, css: "" });
    }
  },

  paint(s, ctx) {
    const R = ctx.map?.R;
    for (const it of this.items) {
      let css = "off";
      if (s.kind === "cut" && s.cut.id === it.id && R) {
        const k = s.cut.k;
        if (ctx.reduced) {
          const a = clamp(1 - Math.abs(k - 0.4) / 0.3);
          css = `r|${a.toFixed(3)}`;
        } else {
          const top = s.cut.sheetTop ?? R.y + R.h * (1 - ease.inout(clamp(k / 0.6)));
          // in over the first 8 %, out as the edge nears the nav band
          const a = clamp(k / 0.08) * clamp((top - ctx.navBottom - 40) / 120);
          css = `${top.toFixed(1)}|${a.toFixed(3)}|${R.x.toFixed(1)}|${R.w.toFixed(1)}`;
        }
      }
      if (css === it.css) continue;
      it.css = css;
      if (css === "off") { it.wrap.style.visibility = "hidden"; continue; }
      const parts = css.split("|");
      if (parts[0] === "r") {
        it.wrap.style.visibility = +parts[1] > 0.001 ? "visible" : "hidden";
        it.wrap.style.setProperty("--o", parts[1]);
        it.wrap.style.transform = `translateY(${Math.round(R.y + R.h * 0.62)}px)`;
        it.rule.style.opacity = "0";
        continue;
      }
      const [top, a, x, w] = parts.map(Number);
      it.wrap.style.visibility = a > 0.001 ? "visible" : "hidden";
      it.wrap.style.setProperty("--o", String(a));
      it.wrap.style.transform = `translateY(${top.toFixed(1)}px)`;
      it.rule.style.left = `${x}px`;
      it.rule.style.width = `${Math.round(w)}px`;
      it.rule.style.opacity = "";
    }
  },

  reset() { for (const it of this.items) it.css = ""; },
};
