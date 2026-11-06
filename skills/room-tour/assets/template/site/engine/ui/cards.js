// Cards (design-system.md 4.9): the walk waits while one is open.
//
//   shell     desktop a 440 px panel, 40 px from the right, vertically centred, max y 96–800, scrolling inside;
//             a 40 px close chip (×). Phone: a bottom sheet, max 80svh.
//   open      (clock) the scrim fades to --scrim over 300 ms; the card slides in from x + 40 px and fades in over
//             480 ms (out); phone from y + 24 px. Focus moves into it (role="dialog"). The page scroll is held.
//   close     ×, Esc, a click on the scrim: 280 ms (in); the scroll unlocks where it was. `next ↗` cross-fades
//             300 ms to the next card.
//   templates material (code, name, line, bracketed spec rows on hairlines, the status for the hotspot's state, a
//             swatch picture) · facts (name, subtitle, small-caps rows, the price, one button) · product (number, huge
//             name, kind, picture with a ghost numeral behind it, sizes as big numerals with superscript units, named
//             swatches, a stepper joined to the add bar, delivery line, next ↗)
//   swatches  { name, hex, img, packshot, recolour: { src, mask, stop } | null, theme: { "--token": value } | null }:
//             the packshot cross-fades (300 ms); at the recolour's stop (or anywhere when it has none) the stage
//             re-colours inside the mask (stage.setRecolour, 300 ms, inout, 2 px feather; a swatch without one puts
//             the original back) and the page takes the swatch's theme (ctx.setTokens, 600 ms). Elsewhere a swatch
//             only changes the card.
//
// ctx: openCard(id, { from }), closeCard(), pickSwatch(card, name), card (the open card's id).
// Events: card:open { id, from } · card:close { id } · card:next { from, to } · card:add { id, qty } · swatch { card,
// name, swatch, page }. Targets "card:<id>" (its add button, else its close chip), "card:<id>:close",
// "swatch:<card>:<name>". Any element with data-swatch="<card>:<name>" (a site's colour row) is a swatch too.

import { el, esc, rich, plain, clamp } from "../util.js";

const CLOSE = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.2 3.4 12.7 12.6M12.8 3.3 3.3 12.7"/></svg>`;

export const cards = {
  name: "cards",

  mount(ctx) {
    const d = ctx.data;
    this.scrim = el("div", "tour-scrim");
    ctx.modal.append(this.scrim);
    this.scrimF = new ctx.Fade(ctx.clock, 0);
    this.scrim.addEventListener("click", () => this.close(ctx));
    this.built = new Map();
    this.open = null;            // { id, e, f, mode }
    this.leaving = [];
    this.locked = false;
    this.picked = {};            // card → swatch name
    ctx.openCard = (id, o) => this.show(id, ctx, o);
    ctx.closeCard = () => this.close(ctx);
    ctx.pickSwatch = (card, name) => this.swatch(card, name, ctx);
    // ?record paints a frame only once the open card's pictures have decoded (no half-loaded packshot in a film)
    ctx.addNeed(() => Promise.all([...this.built.values()].filter((r) => r === this.open || this.leaving.includes(r))
      .flatMap((r) => [...r.e.querySelectorAll("img")]).map((im) => (im.src && !(im.complete && im.naturalWidth) ? im.decode().catch(() => {}) : null))));
    addEventListener("keydown", (e) => { if (e.key === "Escape" && this.open) { e.preventDefault(); this.close(ctx); } });
    // a site's own swatch buttons (data-swatch="card:name") pick through the same path
    document.addEventListener("click", (e) => {
      const b = e.target.closest?.("[data-swatch]");
      if (b && !b.closest(".tour-card")) { const [c, n] = b.dataset.swatch.split(":"); if (d.cards[c]) this.swatch(c, n, ctx); }
    });
    for (const [cid, c] of Object.entries(d.cards)) {
      ctx.target(`card:${cid}`, () => {
        const e = this.built.get(cid)?.e;
        if (!e || this.open?.id !== cid) return null;
        const t = e.querySelector("[data-action='add']") ?? e.querySelector(".tk-close");
        return centre(t, "Add");
      });
      ctx.target(`card:${cid}:close`, () => (this.open?.id === cid ? centre(this.built.get(cid).e.querySelector(".tk-close"), null) : null));
      for (const sw of c.swatches ?? []) ctx.target(`swatch:${cid}:${sw.name}`, () => {
        const vis = [...document.querySelectorAll(`[data-swatch="${cid}:${sw.name}"]`)].find((b) => b.getClientRects().length && getComputedStyle(b).visibility !== "hidden");
        return vis ? centre(vis, "Pick") : null;
      });
    }
  },

  /** the card's DOM, built once */
  build(id, ctx) {
    if (this.built.has(id)) return this.built.get(id);
    const d = ctx.data, c = d.cards[id];
    if (!c) { console.warn(`[tour] no card "${id}" in tour.json cards`); return null; }
    const brackets = d.theme.label.brackets;
    const lab = (s) => (brackets ? `[${s}]` : s);
    const name = plain(c.name ?? id);
    const e = el("aside", `tour-card tk-${c.type ?? "material"}`, null, { role: "dialog", "aria-modal": "true", "aria-label": name, tabindex: "-1", "data-card": id });
    const close = el("button", "tk-close", CLOSE, { type: "button", "aria-label": "Close" });
    close.addEventListener("click", () => this.close(ctx));
    const body = el("div", "tk-body", null, { "data-tour-scrolls": "" });
    e.append(body, close);
    const img = (src, cls = "") => (src ? `<img class="${cls}" src="${esc(ctx.base + src)}" alt="" decoding="async">` : "");
    let html = "";
    if (c.type === "facts") {
      html = `<h2 class="tk-name">${rich(c.name ?? "")}</h2>${c.sub ? `<p class="tk-sub t-label">${rich(c.sub)}</p>` : ""}
        ${c.line ? `<p class="tk-line">${rich(c.line)}</p>` : ""}
        <dl class="tk-rows tk-facts">${(c.rows ?? []).map(([k, v]) => `<div class="tk-row"><dt class="t-label">${rich(k)}</dt><dd class="t-num">${rich(v)}</dd></div>`).join("")}</dl>
        ${c.price ? `<p class="tk-price t-num">${rich(c.price)}</p>` : ""}
        ${c.button ? `<a class="tk-button" href="#" data-action="go" data-verb="${esc(d.theme.cursor?.verbs?.button ?? "Open")}">${rich(c.button.label)}</a>` : ""}`;
    } else if (c.type === "product") {
      const unit = c.unit ?? "cm";
      html = `<div class="tk-head"><span class="tk-no t-label t-num">${esc(c.no ?? "")}</span>${c.kind ? `<span class="tk-kind t-label">${rich(c.kind)}</span>` : ""}</div>
        <h2 class="tk-name">${rich(c.name ?? "")}</h2>
        <div class="tk-pic">${c.no ? `<span class="tk-ghost t-num" aria-hidden="true">${esc(c.no)}</span>` : ""}${img(c.img, "tk-img tk-img-a")}<img class="tk-img tk-img-b" alt="" decoding="async"></div>
        ${c.line ? `<p class="tk-line">${rich(c.line)}</p>` : ""}
        ${c.sizes?.length ? `<div class="tk-sizes">${c.sizes.map(([v, k]) => `<span class="tk-size"><span class="tk-num t-num">${esc(v)}<sup>${esc(unit)}</sup></span><span class="tk-axis t-label">${esc(k ?? "")}</span></span>`).join("")}</div>` : ""}
        ${c.swatches?.length ? `<div class="tk-swatches" role="radiogroup" aria-label="${esc(c.material ?? "Colour")}">${c.swatches.map((s) => `<button type="button" class="tk-sw" role="radio" aria-checked="false" data-swatch="${esc(id)}:${esc(s.name)}" data-verb="${esc(d.theme.cursor?.verbs?.swatch ?? "Pick")}"><i class="tk-chip" style="${s.hex ? `background:${esc(s.hex)};` : ""}${s.img ? `background-image:url('${esc(ctx.base + s.img)}');` : ""}"></i><span class="tk-swname t-label">${rich(s.name)}</span></button>`).join("")}</div>` : ""}
        <div class="tk-buy"><div class="tk-stepper"><button type="button" class="tk-step" data-step="-1" aria-label="One fewer">−</button><span class="tk-qty t-num" aria-live="polite">1</span><button type="button" class="tk-step" data-step="1" aria-label="One more">+</button></div><button type="button" class="tk-add" data-action="add" data-verb="${esc(d.theme.cursor?.verbs?.add ?? "Add")}"><span class="tk-addl">${rich(c.add ?? "add to cart")}</span>${c.price ? `<span class="tk-addp t-num">${rich(c.price)}</span>` : ""}</button></div>
        ${c.ship ? `<p class="tk-ship t-label">${rich(c.ship)}</p>` : ""}
        ${c.next ? `<button type="button" class="tk-next" data-action="next">${rich(c.nextLabel ?? "next ↗")}</button>` : ""}`;
    } else {
      // material (and the default)
      const status = c.status ? `<div class="tk-row"><dt class="t-label">${esc(lab("Status"))}</dt><dd class="tk-status"></dd></div>` : "";
      html = `${c.swatch ? `<div class="tk-swatch">${img(c.swatch)}</div>` : ""}
        ${c.code ? `<p class="tk-code t-label">${esc(lab(c.code))}</p>` : ""}<h2 class="tk-name">${rich(c.name ?? "")}</h2>
        ${c.line ? `<p class="tk-line">${rich(c.line)}</p>` : ""}
        <dl class="tk-rows">${(c.rows ?? []).map(([k, v]) => `<div class="tk-row"><dt class="t-label">${esc(lab(plain(k)))}</dt><dd>${rich(v)}</dd></div>`).join("")}${status}</dl>`;
    }
    body.innerHTML = html;
    // behaviour
    body.querySelector("[data-action='go']")?.addEventListener("click", (ev) => { ev.preventDefault(); this.close(ctx); ctx.go(c.button?.do ?? "end"); });
    body.querySelector("[data-action='next']")?.addEventListener("click", () => this.show(c.next, ctx, { mode: "next" }));
    const qty = body.querySelector(".tk-qty");
    for (const b of body.querySelectorAll(".tk-step")) b.addEventListener("click", () => { const q = clamp(+qty.textContent + +b.dataset.step, 1, 9); qty.textContent = String(q); });
    body.querySelector("[data-action='add']")?.addEventListener("click", (ev) => {
      const b = ev.currentTarget;
      b.classList.add("is-added");
      ctx.emit("card:add", { id, qty: +(qty?.textContent ?? 1), price: c.price ?? null });
    });
    for (const b of body.querySelectorAll(".tk-sw")) b.addEventListener("click", () => { const [cc, n] = b.dataset.swatch.split(":"); this.swatch(cc, n, ctx); });
    ctx.modal.append(e);
    const rec = { id, e, f: new ctx.Fade(ctx.clock, 0), mode: "open", css: "", picA: body.querySelector(".tk-img-a"), picB: body.querySelector(".tk-img-b"), picF: new ctx.Fade(ctx.clock, 0) };
    // preload the packshots so a swatch swap never flashes
    for (const s of c.swatches ?? []) if (s.packshot) { const im = new Image(); im.src = ctx.base + s.packshot; }
    this.built.set(id, rec);
    if (this.picked[id]) this.markSwatch(id, this.picked[id]);
    return rec;
  },

  show(id, ctx, { from = null, mode = "open" } = {}) {
    const rec = this.build(id, ctx);
    if (!rec) return;
    const prev = this.open;
    if (prev?.id === id) return;
    rec.from = from ?? (prev?.from ?? null);
    rec.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (prev) {
      // next ↗: cross-fade in place (300 ms)
      prev.mode = "x"; prev.f.to(0, 300, "linear");
      this.leaving.push(prev);
      rec.mode = "x"; rec.f.snap(0).to(1, 300, "linear");
      ctx.emit("card:next", { from: prev.id, to: id });
    } else {
      rec.mode = "open";
      rec.f.to(1, ctx.reduced ? 200 : 480, "out");
      this.scrimF.to(1, 300, "linear");
      if (!this.locked) { this.locked = true; ctx.lockScroll(true); }
    }
    // the status line follows the opening hotspot's state (material cards)
    const st = rec.e.querySelector(".tk-status"), c = ctx.data.cards[id];
    if (st && c.status) st.innerHTML = rich(c.status[ctx.hotspotState?.(rec.from) ?? "built"] ?? c.status.built ?? "");
    this.open = rec;
    ctx.card = id;
    ctx.emit("card:open", { id, from: rec.from });
    ctx.invalidate();
    // focus moves into the dialog (after this frame, so the slide isn't disturbed by a scroll-into-view)
    if (!ctx.record) requestAnimationFrame(() => rec.e.querySelector(".tk-close")?.focus({ preventScroll: true }));
  },

  close(ctx) {
    const rec = this.open;
    if (!rec) return;
    rec.mode = "open";
    rec.f.to(0, ctx.reduced ? 150 : 280, "in");
    this.leaving.push(rec);
    this.scrimF.to(0, 280, "linear");
    this.open = null;
    ctx.card = null;
    if (this.locked) { this.locked = false; ctx.lockScroll(false); }
    ctx.emit("card:close", { id: rec.id });
    if (!ctx.record && rec.opener?.isConnected) rec.opener.focus({ preventScroll: true });
    ctx.invalidate();
  },

  markSwatch(card, name) {
    for (const b of document.querySelectorAll(`[data-swatch^="${card}:"]`)) {
      const on = b.dataset.swatch === `${card}:${name}`;
      b.classList.toggle("is-picked", on);
      if (b.getAttribute("role") === "radio") b.setAttribute("aria-checked", String(on));
    }
  },

  swatch(card, name, ctx) {
    const c = ctx.data.cards[card];
    const sw = c?.swatches?.find((s) => s.name === name);
    if (!sw) { console.warn(`[tour] cards.${card} has no swatch "${name}"`); return; }
    this.picked[card] = name;
    this.markSwatch(card, name);
    // the card's picture
    const rec = this.built.get(card);
    if (rec?.picB && sw.packshot) {
      rec.picB.src = ctx.base + sw.packshot;
      rec.picF.snap(0).to(1, 300, "inout");
      rec.swapTo = ctx.base + sw.packshot;
    }
    // the page: only at the swatch's stop (or anywhere when the card has no stop for its colours)
    const stops = (c.swatches ?? []).map((s) => s.recolour?.stop).filter(Boolean);
    const colourStop = sw.recolour?.stop ?? stops[0] ?? null;
    const here = ctx.state?.stop ?? (ctx.state?.kind === "end" ? ctx.state.last : null);
    const page = !colourStop || colourStop === here;
    if (page) {
      if (sw.recolour) ctx.stage.setRecolour({ src: sw.recolour.src, mask: sw.recolour.mask, stop: sw.recolour.stop ?? null, ms: 300, feather: sw.recolour.feather ?? 2 });
      else if (stops.length && ctx.stage.rc) ctx.stage.setRecolour({ opacity: 0, ms: 300, stop: ctx.stage.rc.stop });
      if (sw.theme) ctx.setTokens(sw.theme, 600, "inout");
    }
    ctx.emit("swatch", { card, name, swatch: sw, page });
    ctx.invalidate();
  },

  step(s, ctx) {
    this.leaving = this.leaving.filter((r) => !r.f.done || r.f.value > 0.001);
  },

  paint(s, ctx) {
    const sv = this.scrimF.value;
    const sk = sv.toFixed(3);
    if (sk !== this.sk) {
      this.sk = sk;
      this.scrim.style.opacity = sk;
      this.scrim.style.visibility = sv <= 0.001 ? "hidden" : "visible";
      this.scrim.style.pointerEvents = this.open ? "auto" : "none";
    }
    const phone = ctx.phone;
    for (const rec of this.built.values()) {
      const v = rec.f.value;
      const live = rec === this.open || this.leaving.includes(rec);
      let css = "off";
      if (live && v > 0.001) {
        const slide = rec.mode === "x" || ctx.reduced ? 0 : 1 - v;
        css = `${v.toFixed(3)}|${(slide * (phone ? 24 : 40)).toFixed(2)}|${phone}`;
      }
      if (rec.picB) {
        const pv = rec.picF.value;
        rec.picB.style.opacity = pv.toFixed(3);
        if (pv >= 1 && rec.swapTo && rec.picA) { rec.picA.src = rec.swapTo; rec.swapTo = null; rec.picF.snap(0); rec.picB.style.opacity = "0"; }
      }
      if (css === rec.css) continue;
      rec.css = css;
      if (css === "off") { rec.e.style.visibility = "hidden"; rec.e.style.pointerEvents = "none"; continue; }
      const [o, dx] = css.split("|");
      rec.e.style.visibility = "visible";
      rec.e.style.pointerEvents = rec === this.open ? "auto" : "none";
      rec.e.style.opacity = o;
      rec.e.style.transform = phone ? `translateY(${dx}px)` : `translateX(${dx}px)`;
    }
  },

  reset(ctx) {
    for (const rec of this.built.values()) { rec.f.snap(0); rec.css = ""; rec.picF.snap(0); rec.e.querySelector(".tk-add")?.classList.remove("is-added"); const q = rec.e.querySelector(".tk-qty"); if (q) q.textContent = "1"; }
    this.scrimF.snap(0);
    this.sk = null;
    this.open = null; this.leaving = [];
    if (this.locked) { this.locked = false; ctx.lockScroll(false); }
    ctx.card = null;
    this.picked = {};
    for (const b of document.querySelectorAll("[data-swatch]")) { b.classList.remove("is-picked"); if (b.getAttribute("role") === "radio") b.setAttribute("aria-checked", "false"); }
  },
};

/** the centre of an element as a cursor target */
function centre(e, verb) {
  if (!e) return null;
  const r = e.getBoundingClientRect();
  if (!r.width) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, el: e, verb: verb ?? e.dataset.verb ?? null, r: Math.min(r.width, r.height) / 2 };
}
