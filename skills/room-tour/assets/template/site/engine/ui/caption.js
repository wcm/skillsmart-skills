// Stop caption (design-system.md 4.4): a heading, an optional body, a label line (the house's FIG. line), a row of facts
// (the hotel's four) and a price block, in one of four placements:
//   bottom-left   the caption zone (x 40–620, bottom edge y 800; phone full width above the bottom band)
//   top-left      under the nav (furniture)
//   center        upper third, centred (the gallery's wall text)
//   split         heading, body and facts bottom-left; the price block bottom-right (the hotel's room)
// Reveal (clock, 900 ms, out): each line rises 56 px (32 phone, 0 with reduced motion) out of its own clip box and fades
// in, 80 ms apart; with `rule`, a hairline under the heading draws first (400 ms) and the heading rises off it; the
// label line arrives last. The reveal fires when the incoming move (or cut) passes 0.88 (stops.*.caption.at), the exit
// (300 ms, in: fade and −16 px) when the outgoing move passes 0.05. The last stop's caption stays through the end.
// After a cut with `title` (4.11), those lines are the stop's heading and rise with the scroll from the cut's 0.55,
// 0.08 screens apart, so the words that rose in the cut stay; the rest of the caption arrives on the clock as usual.

import { el, rich, plain, clamp, lerp, ease, pad2, fillPx } from "../util.js";

/** p where a stop's caption arrives (the incoming segment at caption.at, default 0.88) and leaves (outgoing at 0.05) */
export function captionWindow(tl, d, id) {
  const walk = d.walk, i = walk.indexOf(id), st = d.stops[id];
  const segOf = (sid) => tl.moves[sid] ?? tl.cuts[sid];
  const inc = i > 0 ? segOf(walk[i - 1]) : null, out = segOf(walk[i + 1]);
  const at = st?.caption?.at ?? 0.88;
  return {
    on: inc ? lerp(inc.p[0], inc.p[1], at) : -1,
    off: out ? lerp(out.p[0], out.p[1], 0.05) : Infinity,
  };
}

/** the stop whose arrival trigger the walk has passed at p (counters and rails switch with the caption) */
export function arrivedAt(tl, d, p) {
  let cur = tl.stopIds[0];
  for (const id of tl.stopIds) if (captionWindow(tl, d, id).on <= p + 1e-9) cur = id;
  return cur;
}

export const caption = {
  name: "caption",

  mount(ctx) {
    const d = ctx.data, th = d.theme.caption, tl = ctx.tl;
    this.items = [];
    const wrap = (this.wrap = el("div", "tour-captions"));
    ctx.ui.append(wrap);
    tl.stopIds.forEach((id, idx) => {
      const st = d.stops[id];
      const wi = d.walk.indexOf(id), cutIn = tl.cuts[d.walk[wi - 1]];
      const cutTitle = cutIn?.ref?.title?.length ? cutIn.ref.title.map(String) : null;
      const c = cutTitle ? { ...(st.caption ?? {}), heading: cutTitle.join("\n") } : st.caption;
      if (!c || !(c.heading || c.body || c.label || c.row || c.price)) return;
      const place = c.place ?? th.place ?? "bottom-left";
      const rule = c.rule ?? th.rule ?? false;
      const box = el("section", `tc tc-${place}`, null, { "data-stop": id, "data-case": th.case ?? "sentence", "aria-label": plain(c.heading ?? st.name) });
      const main = el("div", "tc-main"), side = place === "split" ? el("div", "tc-side") : null;
      box.append(main);
      if (side) box.append(side);
      const lines = [];
      const line = (parent, cls, html, kind = "line") => {
        const clip = el("div", `tc-clip ${cls}-clip`);
        const ln = el("div", `tc-ln ${cls}`, html);
        clip.append(ln);
        parent.append(clip);
        lines.push({ e: ln, kind });
        return ln;
      };
      let ruleEl = null;
      if (c.heading) {
        const parts = String(c.heading).split("\n");
        const head = el("div", "tc-head");
        main.append(head);
        parts.forEach((h) => line(head, "tc-heading", rich(h), cutTitle ? "cut" : "line"));
        if (rule) { ruleEl = el("div", "tc-rule"); head.append(ruleEl); }
      }
      if (c.body) line(main, "tc-body", rich(c.body));
      if (c.row?.length) {
        const html = c.row.map((f) => {
          const [k, v] = Array.isArray(f) ? f : typeof f === "object" ? [f.label, f.value] : [null, f];
          return `<div class="tc-fact">${k ? `<span class="tc-fact-k t-label">${rich(k)}</span>` : ""}<span class="tc-fact-v t-num">${rich(v)}</span></div>`;
        }).join("");
        line(main, "tc-row", html);
      }
      if (c.price) {
        const host = side ?? main;
        const pr = typeof c.price === "string" ? { amount: c.price } : c.price;
        const pb = el("div", "tc-price");
        host.append(pb);
        if (pr.pre) line(pb, "tc-price-pre t-label", rich(pr.pre));
        if (pr.amount) line(pb, "tc-price-main", `<span class="tc-amount t-num">${rich(pr.amount)}</span>${pr.unit ? ` <span class="tc-unit">${rich(pr.unit)}</span>` : ""}`);
        if (pr.note) line(pb, "tc-price-note t-label", rich(pr.note));
        if (pr.link) {
          const a = line(pb, "tc-price-link", `<a class="tc-link" href="#">${rich(pr.link.label)}</a>`);
          a.querySelector("a").addEventListener("click", (e) => { e.preventDefault(); ctx.go(pr.link.do); });
        }
      }
      if (c.label) line(main, "tc-label t-label", rich(ctx.label(c.label)), "label");
      // the label line arrives last
      lines.sort((a, b) => (a.kind === "label") - (b.kind === "label"));
      wrap.append(box);
      this.items.push({ id, idx, box, lines, rule: ruleEl, sw: new ctx.Switch(ctx.clock, false), frozen: 0, win: null, css: {}, cut: cutTitle ? cutIn : null });
    });
  },

  layout(ctx) {
    for (const it of this.items) {
      it.win = captionWindow(ctx.tl, ctx.data, it.id);
      if (it.rule) { it.ruleW = it.rule.parentElement.clientWidth; it.rule._w = null; }
    }
  },

  step(s, ctx) {
    for (const it of this.items) {
      const w = it.win ?? captionWindow(ctx.tl, ctx.data, it.id);
      const on = s.p >= w.on && s.p < w.off;
      if (on !== it.sw.on) {
        // the exit plays from wherever the entrance had got to
        if (!on) it.frozen = ctx.clock.instant ? 1e9 : it.sw.age;
        it.sw.set(on);
        ctx.clock.hold(1800);
        ctx.emit(on ? "caption:in" : "caption:out", { id: it.id });
      }
    }
  },

  paint(s, ctx) {
    const rise = ctx.rise(56);
    for (const it of this.items) {
      const on = it.sw.on, age = on ? it.sw.age : it.frozen;
      const ruleMs = it.rule && !it.cut ? 400 : 0;
      // a cut's title lines rise with the scroll (0.55 of the cut on, 0.08 screens apart, each over 0.3 screens)
      let cutK = null;
      if (it.cut) {
        const g = it.cut, into = (s.p - g.p[0]) * ctx.tl.S, span = g.s[1] - g.s[0];
        cutK = (i) => (s.p >= g.p[1] ? 1 : ease.out(clamp((into - 0.55 * span - 0.08 * i) / 0.3)));
      }
      const back = Boolean(it.cut) && !on && (it.win ? s.p < it.win.off : true);
      // container: the exit (fade, −16 px); scrolling back into a cut only takes the clock lines away
      let co = 1, cy = 0, lineOut = 1;
      if (!on && !back) { const k = ease.in(clamp(it.sw.age / 300)); co = 1 - k; cy = (ctx.reduced ? 0 : -16) * k; }
      if (back) lineOut = 1 - ease.in(clamp(it.sw.age / 300));
      const vis = co > 0.001 && (on || it.frozen > 0 || (cutK && cutK(0) > 0));
      const key = `${vis}|${co.toFixed(3)}|${cy.toFixed(2)}`;
      if (key !== it.ck) {
        it.ck = key;
        it.box.style.visibility = vis ? "" : "hidden";
        it.box.style.opacity = co.toFixed(3);
        it.box.style.transform = cy ? `translateY(${cy.toFixed(2)}px)` : "";
      }
      if (!vis) continue;
      // --in: the box's arrival (0 → 1 over 300 ms), for a site that puts the caption on a panel of its own
      const inK = on && !it.cut ? ease.out(clamp(age / 300)).toFixed(3) : "1";
      if (inK !== it.inK) { it.inK = inK; it.box.style.setProperty("--in", inK); }
      if (it.rule) {
        const r = cutK ? cutK(0) : ease.out(clamp(age / 400));
        fillPx(it.rule, r, it.ruleW ?? it.rule.parentElement.clientWidth);
      }
      let j = 0, ci = 0;
      it.lines.forEach((ln) => {
        const k = ln.kind === "cut" ? cutK(ci++) : ease.out(clamp((age - ruleMs - 80 * j++) / 900)) * (it.frozen > 0 || on ? lineOut : 0);
        const v = `${k.toFixed(4)}`;
        if (v === ln.v) return;
        ln.v = v;
        ln.e.style.opacity = k.toFixed(4);
        ln.e.style.transform = rise && k < 1 ? `translateY(${(rise * (1 - k)).toFixed(2)}px)` : "";
      });
    }
  },

  reset() {
    for (const it of this.items) { it.sw = new it.sw.constructor(it.sw.clock, false); it.frozen = 0; it.ck = null; it.inK = null; for (const l of it.lines) l.v = null; if (it.rule) it.rule._w = null; }
  },
};

export { pad2 };
