// loupe.js — stop 3: a 200 px circle above and right of the dune dot showing the chosen
// fabric macro, drifting 0.5 px/s so it never looks printed, with its caption under it. It arrives with the stop's
// hotspots (move 2 at 0.96) and leaves with them; a pick cross-fades its macro (300 ms). Clock only.
import { el } from "../engine/util.js";

const AT = [0.52, 0.645];                         // the dune dot at stop 3 (measured on move-2's last frame)
const CAP = { rust: "rust corduroy, 8 wale", oat: "oat corduroy, 8 wale", plum: "plum velvet" };

export const loupe = {
  mount(ctx) {
    const root = (this.el = el("div", "loupe", null, { "aria-hidden": "true" }));
    const ring = el("div", "lp-ring");
    this.a = el("div", "lp-pic");
    this.b = el("div", "lp-pic");
    ring.append(this.a, this.b);
    this.cap = el("span", "lp-cap t-label", CAP.rust);
    root.append(ring, this.cap);
    ctx.ui.append(root);
    this.url = (n) => `url('${ctx.base}img/fabric/macro-${n}.webp')`;
    this.b.style.opacity = "0";
    this.cur = "rust";
    this.next = null;
    this.f = new ctx.Fade(ctx.clock, 0);
    this.x = new ctx.Fade(ctx.clock, 0);
    // the fabrics load after the first paint (warm(), called by the page once boot() resolves); ?record waits for them
    this.loaded = null;
    ctx.addNeed?.(() => (this.on ? this.warm(ctx) : null));
  },

  warm(ctx) {
    if (!this.loaded) {
      this.loaded = Promise.all(["rust", "oat", "plum"].map((n) => new Promise((r) => {
        const im = new Image();
        im.onload = im.onerror = () => (im.decode ? im.decode().catch(() => {}).then(r) : r());
        im.src = `${ctx.base}img/fabric/macro-${n}.webp`;
      })));
      this.a.style.backgroundImage = this.url(this.cur ?? "rust");
    }
    return this.loaded;
  },

  step(s, ctx) {
    const on = s.stop === "sofa" || (s.move?.id === "move-2" && s.move.t >= 0.96);
    if (on !== this.on) {
      this.on = on;
      this.f.to(on ? 1 : 0, on ? 320 : 200, on ? "out" : "in", on ? 240 : 0);
      ctx.keepAlive?.(on);
    }
    // the cross-fade lands: the new macro becomes the base picture
    if (this.next && this.x.value >= 1) { this.cur = this.next; this.next = null; this.swapped = true; this.x.snap(0); }
  },

  event(name, p, ctx) {
    if (name === "swatch" && p.card === "p01" && p.page) {
      if (p.name === (this.next ?? this.cur)) return;
      if (this.next) { this.cur = this.next; this.swapped = true; }
      this.next = p.name;
      this.x.snap(0).to(1, 300, "inout");
      this.cap.textContent = CAP[p.name] ?? CAP.rust;
      ctx.invalidate();
    }
  },

  update(s, ctx) {
    const v = this.f.value;
    if (v <= 0.001) { if (this.vis !== false) { this.vis = false; this.el.style.visibility = "hidden"; } return; }
    if (this.vis !== true) { this.vis = true; this.el.style.visibility = "visible"; }
    const w = ctx.phone ? 128 : 200, off = ctx.phone ? 96 : 150;
    const [dx, dy] = ctx.toScreen(AT);
    const vw = ctx.stage.vw, m = ctx.margin;
    const cx = Math.min(vw - m - w / 2, dx + off), cy = Math.max(ctx.navBottom + 24 + w / 2, dy - off);
    const rise = ctx.reduced ? 0 : 8 * (1 - v);
    this.el.style.transform = `translate(${(cx - w / 2).toFixed(1)}px, ${(cy - w / 2 + rise).toFixed(1)}px)`;
    this.el.style.setProperty("--o", v.toFixed(3));
    if (this.swapped) { this.swapped = false; this.a.style.backgroundImage = this.url(this.cur); }
    if (this.next) { const u = this.url(this.next); if (this.bUrl !== u) { this.bUrl = u; this.b.style.backgroundImage = u; } }
    this.b.style.opacity = this.next ? this.x.value.toFixed(3) : "0";
    // the slow drift: 0.5 px a second along the wales, on the engine clock (record-exact)
    const d = ((s.now ?? ctx.clock.now()) / 1000) * 0.5;
    const pos = `${(-d).toFixed(2)}px ${(-d * 0.35).toFixed(2)}px`;
    this.a.style.backgroundPosition = pos;
    this.b.style.backgroundPosition = pos;
  },

  reset(ctx) {
    if (this.on) ctx.keepAlive?.(false);
    this.f.snap(0); this.x.snap(0); this.on = false; this.vis = null;
    this.cur = "rust"; this.next = null; this.swapped = false; this.bUrl = null;
    if (this.loaded) this.a.style.backgroundImage = this.url("rust");
    this.b.style.opacity = "0";
    this.cap.textContent = CAP.rust;
  },
};
