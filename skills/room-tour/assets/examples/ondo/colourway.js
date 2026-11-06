// colourway.js — the site's moment: "pick a colour" under the sofa's caption at stop 3.
// Its three fabric discs are [data-swatch="p01:<name>"] buttons, so the engine's cards component picks them exactly
// like the dune card's own swatches: the sofa re-colours inside its mask (stage.setRecolour, 300 ms) and the page takes
// the colourway's tokens (ctx.setTokens, 600 ms). This layer adds the rest: it follows the caption in and out, swaps
// the fabric words (caption body, cart tile), remembers the pick (tour.state().colourway) and keeps the ring on it.
import { el } from "../engine/util.js";

const NAMES = ["rust", "oat", "plum"];
export const FABRIC = { rust: "rust corduroy", oat: "oat corduroy", plum: "plum velvet" };
const ANY = /rust corduroy|oat corduroy|plum velvet/;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

function swapWords(root, words) {
  if (!root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) if (ANY.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(ANY, words);
}

export const colourway = {
  mount(ctx) {
    this.pick = "rust";
    const row = (this.row = el("div", "colour-row", null, { role: "radiogroup", "aria-label": "pick a colour" }));
    const clip = el("div", "cr-clip");
    const ln = (this.ln = el("div", "cr-ln"));
    ln.append(el("span", "cr-label t-label", "pick a colour"));
    const list = el("div", "cr-list");
    for (const name of NAMES) {
      const b = el("button", "cr-sw", `<span class="cr-disc" style="background-image:url('${ctx.base}img/fabric/disc-${name}.webp')"></span><span class="cr-name">${name}</span>`,
        { type: "button", role: "radio", "aria-checked": String(name === "rust"), "aria-label": FABRIC[name], "data-swatch": `p01:${name}`, "data-verb": ctx.data.theme.cursor?.verbs?.swatch ?? "Pick" });
      list.append(b);
    }
    ln.append(list);
    clip.append(ln);
    row.append(clip);
    ctx.ui.append(row);
    this.sw = new ctx.Switch(ctx.clock, false);
    this.frozen = 0;
    this.mark("rust");
  },

  layout(ctx) {
    const cap = document.querySelector('.tc[data-stop="sofa"]');
    if (!cap) return;
    this.row.style.left = `${cap.offsetLeft}px`;
    this.row.style.top = `${cap.offsetTop + cap.offsetHeight + (ctx.phone ? 14 : 24)}px`;
  },

  /** the end's dune tile shows the sofa in the picked colourway */
  tile(name, ctx) {
    const im = document.querySelector('.tile[data-id="p01"] img');
    if (!im) return;
    const src = `${ctx.base}img/packshots/${name === "rust" ? "p01" : `p01-${name}`}-tile.webp`;
    if (!im.src.endsWith(src)) im.src = src;
    im.alt = `dune modular sofa in ${FABRIC[name] ?? FABRIC.rust}`;
  },

  mark(name) {
    for (const b of this.row.querySelectorAll(".cr-sw")) {
      const on = b.dataset.swatch === `p01:${name}`;
      b.setAttribute("aria-checked", String(on));
      b.classList.toggle("is-picked", on);
    }
  },

  event(name, p, ctx) {
    if ((name === "caption:in" || name === "caption:out") && p.id === "sofa") {
      const on = name === "caption:in";
      if (on === this.sw.on) return;
      if (!on) this.frozen = this.sw.age;
      this.sw.set(on);
    }
    if (name === "swatch" && p.card === "p01" && p.page) {
      this.pick = p.name;
      this.mark(p.name);
      const words = FABRIC[p.name] ?? FABRIC.rust;
      swapWords(document.querySelector('.tc[data-stop="sofa"] .tc-body'), words);
      for (const e of document.querySelectorAll(".cw-fabric")) e.textContent = words;
      this.tile(p.name, ctx);
      ctx.invalidate();
    }
  },

  update(s, ctx) {
    ctx.extra.colourway = this.pick;
    const on = this.sw.on, rise = ctx.rise(56);
    let co = 1, cy = 0, k;
    if (on) k = ctx.ease.out(clamp((this.sw.age - 160) / 900));
    else {
      k = this.frozen > 0 ? ctx.ease.out(clamp((this.frozen - 160) / 900)) : 0;
      const q = ctx.ease.in(clamp(this.sw.age / 300));
      co = 1 - q; cy = (ctx.reduced ? 0 : -16) * q;
    }
    const vis = co * k > 0.001;
    const key = `${vis}|${co.toFixed(3)}|${cy.toFixed(2)}|${k.toFixed(4)}`;
    if (key === this.key) return;
    this.key = key;
    this.row.style.visibility = vis ? "visible" : "hidden";
    this.row.style.setProperty("--o", co.toFixed(3));
    this.row.style.transform = cy ? `translateY(${cy.toFixed(2)}px)` : "";
    this.row.style.pointerEvents = vis && on && k > 0.5 ? "auto" : "none";
    this.ln.style.opacity = k.toFixed(4);
    this.ln.style.transform = rise && k < 1 ? `translateY(${(rise * (1 - k)).toFixed(2)}px)` : "";
  },

  reset(ctx) {
    this.sw = new ctx.Switch(ctx.clock, false);
    this.frozen = 0;
    this.key = null;
    if (this.pick !== "rust") {
      this.pick = "rust";
      swapWords(document.querySelector('.tc[data-stop="sofa"] .tc-body'), FABRIC.rust);
      for (const e of document.querySelectorAll(".cw-fabric")) e.textContent = FABRIC.rust;
      this.tile("rust", ctx);
    }
    this.mark("rust");
  },
};
