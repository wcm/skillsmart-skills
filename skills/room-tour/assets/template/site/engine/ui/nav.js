// Nav bar (4.2) and Hide UI (4.1). Left the brand, centre the rail slot or a text line (the gallery's flight target),
// right: chips, links, layer slots and one primary CTA. On the cover only the brand (unless the title is the brand)
// and the `primary` item show; the other items join the UI group. The brand of a site whose title is its name fades in
// (300 ms) once the title has left. Over the end sheet the nav cross-fades to --nav-ink-sheet (200 ms) as the sheet's
// top passes the nav band.
//
// Slots it opens for others: ctx.slots.navLeft, navCenter (the rail's index skin, or the text line), navRight,
// ctx.slots.layers[name] (a { "layer": name } item, e.g. the furniture cart).

import { el, esc, rich, plain } from "../util.js";

const EYE = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path class="tn-eye-open" d="M2.5 12c2.4-4.2 5.6-6.3 9.5-6.3s7.1 2.1 9.5 6.3c-2.4 4.2-5.6 6.3-9.5 6.3S4.9 16.2 2.5 12Z"/><circle class="tn-eye-open" cx="12" cy="12" r="2.8"/><path class="tn-eye-shut" d="M3 12.5c2.5 2.6 5.5 3.9 9 3.9s6.5-1.3 9-3.9M7 15.4 5.6 17.6M12 16.4v2.5M17 15.4l1.4 2.2"/></svg>`;
const norm = (s) => plain(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export const nav = {
  name: "nav",
  mount(ctx) {
    const d = ctx.data, n = d.nav;
    const head = (this.el = el("header", "tour-nav"));
    const left = el("div", "tn-left"), center = el("div", "tn-center"), right = el("div", "tn-right");
    head.append(left, center, right);
    ctx.ui.append(head);
    ctx.slots.navLeft = left; ctx.slots.navCenter = center; ctx.slots.navRight = right; ctx.slots.layers = {};
    // the brand
    const name = d.brand?.wordmark ?? d.brand?.name ?? "";
    const blocks = d.title.blocks.filter((b) => !b.slot);
    // the title is the brand when one block, or a run of neighbouring blocks, spells it (ABEND + HORN = Abendhorn)
    const texts = blocks.map((b) => norm(b.lines.join(""))), want = norm(name);
    let titleIsBrand = false;
    for (let i = 0; i < texts.length && want; i++) { let acc = ""; for (let j = i; j < texts.length; j++) { acc += texts[j]; if (acc === want) titleIsBrand = true; } }
    this.brandOnCover = d.brand?.cover ?? !titleIsBrand;
    if (n.left && name) {
      this.brand = el("a", "tn-brand", rich(name), { href: "#", "aria-label": plain(name) });
      this.brand.addEventListener("click", (e) => { e.preventDefault(); ctx.glide(0); });
      left.append(this.brand);
      this.brandFade = new ctx.Fade(ctx.clock, this.brandOnCover || !d.title.blocks.length ? 1 : 0);
    }
    // the centre: the rail's slot, or a line of text (the title flies into it)
    if (n.center && n.center !== "rail" && n.center !== "none") {
      center.classList.add("tn-line");
      center.innerHTML = esc(n.center);
    }
    center.dataset.kind = n.center === "rail" ? "rail" : n.center && n.center !== "none" ? "line" : "none";
    // the right: chips, links, layers, the one CTA
    const hasTitle = d.title.blocks.length > 0;
    (n.right ?? []).forEach((it, i) => {
      let e;
      if (it.chip === "hide") {
        e = this.hide = el("button", "tn-chip tn-hide", EYE, { type: "button", "aria-label": "Hide UI", "aria-pressed": "false", title: "Hide UI (H)" });
        e.addEventListener("click", () => ctx.setHidden(!ctx.hidden));
      } else if (it.chip != null) {
        e = el("button", "tn-chip tn-chip-text", esc(it.chip), { type: "button" });
        e.addEventListener("click", () => ctx.go(it.do));
      } else if (it.button != null) {
        e = el("a", "tn-button", rich(it.button), { href: it.do?.startsWith("end#") ? it.do.slice(3) : "#" });
        e.addEventListener("click", (ev) => { ev.preventDefault(); ctx.go(it.do ?? "end"); });
      } else if (it.link != null) {
        e = el("a", "tn-link", rich(it.link), { href: it.do?.startsWith("end#") ? it.do.slice(3) : "#" });
        e.addEventListener("click", (ev) => { ev.preventDefault(); ctx.go(it.do ?? "end"); });
      } else if (it.layer) {
        e = el("span", "tn-layer", null, { "data-layer": it.layer });
        ctx.slots.layers[it.layer] = e;
        if (it.do) e.addEventListener("click", () => ctx.go(it.do));
      } else return;
      if (it.primary) e.classList.add("tn-primary");
      right.append(e);
      if (!it.primary && hasTitle) ctx.uiGroup.add(e, 100 + i);
    });
    this.navK = new ctx.Fade(ctx.clock, 0);
  },
  step(s, ctx) {
    if (this.brandFade && !this.brandOnCover) this.brandFade.to(s.title.exit >= 1 ? 1 : 0, 300, "out");
    this.navK.to(s.endTop <= ctx.navBottom ? 1 : 0, 200, "linear");
  },
  paint(s, ctx) {
    this.el.style.setProperty("--nav-k", this.navK.value.toFixed(3));
    if (this.brand) {
      const v = this.brandFade.value;
      this.brand.style.setProperty("--o", v.toFixed(3));
      this.brand.style.visibility = v <= 0.001 ? "hidden" : "";
    }
    if (this.hide) this.hide.setAttribute("aria-pressed", String(ctx.hidden));
  },
  reset() { this.navK.snap(0); if (this.brandFade && !this.brandOnCover) this.brandFade.snap(0); },
};
