// end-mask.js — the end's first block: a full-viewport cream sheet with `shop the` /
// `room` cut out of it, so the pinned room (the sofa in its picked colour) shows through the letters and is never
// filled. The holes are SVG <text> in Anybody 900 wdth 150; this layer sizes the sheet to the viewport and fits the
// words: 12.5vw on desktop, two lines left at the margin and vertically centred; on a phone 22vw would run off the
// screen as two lines, so it sets three (`shop` / `the` / `room`). It also fits the footer's giant `ondo` to the width.
//
// Two site-side fixes for the sheet (see the engine notes in the site summary):
//  - the stage's UI (captions, walk bar, colour row, loupe, leaders) would show through the letters, so it fades out
//    (300 ms, clock) as the sheet starts to arrive and back in when it leaves;
//  - the nav (and the recording's scripted cursor) live inside the stage, under the sheet; the nav moves into a fixed
//    top layer above the end so `cart (n)` stays visible and rolls when "add all" is clicked, with a cream band
//    behind it once the sheet passes under it.
const NS = "http://www.w3.org/2000/svg";
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export const endMask = {
  mount(ctx) {
    this.svg = document.querySelector(".knock-svg");
    this.text = this.svg?.querySelector(".knock-text");
    this.rects = this.svg ? [...this.svg.querySelectorAll("rect"), this.svg.querySelector("mask")] : [];
    this.wm = document.querySelector(".wordmark");
    // the fixed top layer
    const top = (this.top = document.createElement("div"));
    top.className = "f-top";
    this.band = document.createElement("div");
    this.band.className = "f-band";
    top.append(this.band);
    const nav = ctx.ui.querySelector(".tour-nav");
    if (nav) top.append(nav);
    // the recording's cursor moves up with it only for the end's beat (inside the stage it paints the same pixels on
    // every replay; in the fixed layer it can differ by a few anti-aliased pixels)
    if (ctx.record) this.cur = ctx.stageEl.querySelector(".tour-cursor");
    document.body.append(top);
    this.ui = new ctx.Fade(ctx.clock, 1);
    this.bandF = new ctx.Fade(ctx.clock, 0);
  },

  layout(ctx) {
    if (!this.svg || !this.text) return;
    const vw = document.documentElement.clientWidth, vh = innerHeight, m = ctx.margin, phone = ctx.phone;
    this.svg.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
    for (const r of this.rects) { r.setAttribute("width", vw); r.setAttribute("height", vh); }
    const lines = phone ? ["shop", "the", "room"] : ["shop the", "room"];
    let fs = (phone ? 0.22 : 0.125) * vw;
    this.text.textContent = "";
    const spans = lines.map((t) => { const s = document.createElementNS(NS, "tspan"); s.textContent = t; s.setAttribute("x", m); this.text.append(s); return s; });
    this.text.style.fontSize = `${fs}px`;
    // never wider than the space between the margins
    const widest = Math.max(...spans.map((s) => s.getComputedTextLength()));
    if (widest > vw - 2 * m) { fs *= (vw - 2 * m) / widest; this.text.style.fontSize = `${fs}px`; }
    // lines .86 em apart; the block from the first line's ascender (≈ .72 em) to the last baseline sits centred
    const lh = fs * 0.86, cap = fs * 0.72;
    const blockH = lh * (lines.length - 1) + cap;
    const y0 = (vh - blockH) / 2;
    spans.forEach((s, i) => s.setAttribute("y", (y0 + cap + i * lh).toFixed(1)));
    // the footer wordmark: as wide as the page between the margins
    if (this.wm) {
      this.wm.style.fontSize = "100px";
      const w = this.wm.getBoundingClientRect().width;
      this.wm.style.fontSize = "";
      if (w > 0) document.documentElement.style.setProperty("--wm-size", `${((100 * (vw - 2 * m)) / w).toFixed(2)}px`);
    }
  },

  step(s, ctx) {
    const vh = ctx.stage.vh;
    // the stage's UI leaves as soon as the sheet's top edge comes into view
    this.ui.to(s.endTop < vh - 2 ? 0 : 1, 300, s.endTop < vh - 2 ? "in" : "out");
    this.bandF.to(s.endTop <= ctx.navBottom ? 1 : 0, 200, "linear");
  },

  update(s, ctx) {
    const u = this.ui.value.toFixed(3), b = this.bandF.value.toFixed(3);
    if (u !== this.u) { this.u = u; document.documentElement.style.setProperty("--f-ui", u); }
    // over the end's colour bar an ink ring would vanish: the recording's cursor turns cream there
    const ci = s.kind === "end" ? "var(--accent-ink)" : "";
    if (this.cur) { const host = s.kind === "end" ? this.top : ctx.stageEl; if (this.cur.parentElement !== host) host.append(this.cur); }
    if (this.cur && ci !== this.ci) { this.ci = ci; this.cur.style.setProperty("--cursor-ink", ci); }
    if (b !== this.b) { this.b = b; this.band.style.opacity = b; this.band.style.visibility = +b <= 0.001 ? "hidden" : "visible"; }
  },

  reset(ctx) { this.ui.snap(1); this.bandF.snap(0); this.u = this.b = this.ci = null; },
};
