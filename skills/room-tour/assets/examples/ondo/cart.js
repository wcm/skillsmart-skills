// cart.js — the cart: `cart (0)` in the nav's layer slot (the cover's one CTA; above zero
// the count sits in an ink circle with DM Mono digits that roll over 500 ms), the add bars in the product cards
// (`added ✓` for 1.2 s, then back), the material label under each card's swatches, and the end's tiles and
// `add all to cart` bar. Clicking the cart glides to the end (nav `do: "end#cart"`). Everything timed is on the clock.
import { el } from "../engine/util.js";

const IDS = ["p01", "p02", "p03", "p04", "p05", "p06"];
// the card's material line: `<material> — <colourway>` (direction 5)
const MAT = {
  p01: { rust: "rust corduroy", oat: "oat corduroy", plum: "plum velvet" },
  p02: { chrome: "chrome", brass: "brass", "cream enamel": "cream enamel" },
  p03: { cognac: "cognac", oxblood: "oxblood", cream: "cream" },
  p04: { travertine: "travertine", "rosso levanto": "rosso levanto", "nero marquina": "nero marquina" },
  p05: { burgundy: "burgundy", rust: "rust", cream: "cream" },
  p06: { burgundy: "burgundy", rust: "rust", chrome: "chrome" },
};
const MATWORD = { p01: "upholstery", p02: "finish", p03: "leather", p04: "stone", p05: "wool", p06: "lacquer" };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export const cart = {
  mount(ctx) {
    this.qty = {};
    this.adds = {};          // card id → clock ms of its last add (the `added ✓` window)
    this.picked = {};        // card id → swatch name (the card's own pick)
    this.all = false;
    this.shown = 0; this.from = 0; this.to = 0;
    this.roll = new ctx.Fade(ctx.clock, 1);
    const slot = ctx.slots.layers?.cart;
    if (slot) {
      this.btn = el("button", "cart-btn", `<span class="cart-word">cart</span><span class="cart-paren">(<span class="t-num cart-n">0</span>)</span><span class="cart-circle" aria-hidden="true"><span class="cart-d cart-old"></span><span class="cart-d cart-new">0</span></span>`,
        { type: "button", "aria-label": "cart, 0 pieces" });
      slot.append(this.btn);
      this.nEl = this.btn.querySelector(".cart-n");
      this.oldEl = this.btn.querySelector(".cart-old");
      this.newEl = this.btn.querySelector(".cart-new");
    }
    for (const b of document.querySelectorAll(".tile-add")) {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = b.dataset.add;
        if (this.qty[id]) delete this.qty[id]; else this.qty[id] = 1;
        this.all = false;
        this.bump(ctx);
      });
    }
    // ?record waits for the end's pictures (tiles, the footer) so a frame never shows one half-decoded
    ctx.addNeed?.((st) => (st.kind === "end" ? Promise.all([...document.querySelectorAll(".tour-end img")].map((im) => (!im.getAttribute("src") ? null : im.complete ? im.decode?.().catch(() => {}) : new Promise((r) => { im.addEventListener("load", r, { once: true }); im.addEventListener("error", r, { once: true }); }).then(() => im.decode?.().catch(() => {}))))) : null));
    this.bar = document.getElementById("add-all");
    this.note = document.getElementById("cart-note");
    this.barHTML = this.bar?.innerHTML ?? "";
    this.bar?.addEventListener("click", () => {
      for (const id of IDS) this.qty[id] = Math.max(this.qty[id] ?? 0, 1);
      this.all = true;
      this.bump(ctx);
    });
  },

  count() { return IDS.reduce((a, id) => a + (this.qty[id] ?? 0), 0); },

  bump(ctx) {
    const n = this.count();
    if (n === this.to) { ctx.invalidate(); return; }
    this.from = this.to; this.to = n;
    this.roll.snap(0).to(1, 500, "out");
    ctx.invalidate();
  },

  /** the card's material label, added under its swatches the first time it opens */
  matLine(id) {
    const card = document.querySelector(`.tour-card[data-card="${id}"]`);
    if (!card) return;
    let m = card.querySelector(".tk-mat");
    if (!m) {
      const sw = card.querySelector(".tk-swatches");
      if (!sw) return;
      m = el("p", "tk-mat t-label");
      sw.before(m);
      // the swatch radios show their names; the label names the material and the pick
      const sub = el("p", "tk-sub t-label", card.querySelector(".tk-kind")?.textContent ?? "");
      card.querySelector(".tk-name")?.after(sub);
    }
    const names = Object.keys(MAT[id] ?? {});
    const pick = this.picked[id] ?? names[0];
    const txt = `${MATWORD[id]} — ${MAT[id]?.[pick] ?? pick}`;
    if (m.textContent !== txt) m.textContent = txt;
    for (const b of card.querySelectorAll(".tk-sw")) {
      const on = b.dataset.swatch === `${id}:${pick}`;
      b.classList.toggle("is-picked", on);
      b.setAttribute("aria-checked", String(on));
    }
  },

  /** the card's picture follows its pick when it opens (the engine swaps it only on a swatch click) */
  packshot(id, ctx) {
    const sw = ctx.data.cards[id]?.swatches?.find((x) => x.name === this.picked[id]);
    const im = document.querySelector(`.tour-card[data-card="${id}"] .tk-img-a`);
    if (sw?.packshot && im && !im.src.endsWith(sw.packshot)) im.src = ctx.base + sw.packshot;
  },

  event(name, p, ctx) {
    if (name === "card:open") {
      // the dune card opens in the room's current colourway
      if (p.id === "p01" && !this.picked.p01) this.picked.p01 = ctx.extra.colourway ?? "rust";
      this.matLine(p.id);
      this.packshot(p.id, ctx);
    }
    if (name === "card:next") { this.matLine(p.to); this.packshot(p.to, ctx); }
    if (name === "swatch") { this.picked[p.card] = p.name; this.matLine(p.card); }
    if (name === "card:add") {
      this.qty[p.id] = (this.qty[p.id] ?? 0) + (p.qty ?? 1);
      this.adds[p.id] = ctx.clock.now();
      ctx.clock.hold?.(1300);
      this.bump(ctx);
    }
  },

  update(s, ctx) {
    const n = this.to;
    ctx.extra.cart = n;
    if (this.btn) {
      const r = this.roll.value;
      const has = n > 0 || (this.from > 0 && r < 1);
      this.btn.classList.toggle("has-items", has);
      if (this.nEl.textContent !== String(n)) this.nEl.textContent = String(n);
      this.btn.setAttribute("aria-label", `cart, ${n} ${n === 1 ? "piece" : "pieces"}`);
      const o = String(this.from), w = String(n);
      if (this.oldEl.textContent !== o) this.oldEl.textContent = o;
      if (this.newEl.textContent !== w) this.newEl.textContent = w;
      const up = ctx.reduced ? (r > 0.5 ? 1 : 0) : r;
      this.oldEl.style.transform = `translateY(${(-100 * up).toFixed(1)}%)`;
      this.newEl.style.transform = `translateY(${(100 * (1 - up)).toFixed(1)}%)`;
      this.oldEl.style.visibility = up >= 1 ? "hidden" : "";
    }
    // tiles
    for (const b of document.querySelectorAll(".tile-add")) {
      const on = Boolean(this.qty[b.dataset.add]);
      if (b.classList.contains("is-added") !== on) {
        b.classList.toggle("is-added", on);
        const nm = b.closest(".tile")?.querySelector(".tile-name")?.textContent ?? "";
        b.setAttribute("aria-label", on ? `${nm} is in your cart` : `add ${nm} to cart`);
      }
    }
    // the bar
    if (this.bar) {
      const want = this.all ? "all" : "base";
      if (this.barState !== want) {
        this.barState = want;
        this.bar.classList.toggle("is-added", this.all);
        this.bar.innerHTML = this.all ? `<span class="bar-l">all 6 in your cart ✓</span>` : this.barHTML;
        if (this.note) this.note.hidden = !this.all;
      }
    }
    // card add bars: `added ✓` for 1.2 s
    const now = ctx.clock.now();
    for (const id of IDS) {
      const card = document.querySelector(`.tour-card[data-card="${id}"]`);
      if (!card) continue;
      const add = card.querySelector(".tk-add");
      if (!add) continue;
      const on = this.adds[id] != null && now - this.adds[id] < 1200;
      if (add.dataset.st !== String(on)) {
        add.dataset.st = String(on);
        add.classList.toggle("is-added", on);
        const l = add.querySelector(".tk-addl"), pr = add.querySelector(".tk-addp");
        if (l) l.textContent = on ? "added ✓" : "add to cart —";
        if (pr) pr.style.display = on ? "none" : "";
      }
    }
  },

  reset(ctx) {
    this.qty = {}; this.adds = {}; this.picked = {}; this.all = false;
    this.from = 0; this.to = 0; this.roll.snap(1);
    this.barState = null;
    for (const c of document.querySelectorAll(".tour-card .tk-add")) c.dataset.st = "";
    for (const id of IDS) if (document.querySelector(`.tour-card[data-card="${id}"] .tk-mat`)) this.matLine(id);
  },
};
