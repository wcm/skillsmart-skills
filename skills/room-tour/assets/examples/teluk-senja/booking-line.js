// Teluk Senja's booking line: a site layer on the shared engine.
//
// From the cut's 0.55 a ruled sentence rises into the walk bar's right slot: "Villa 12 · Karang — 2 guests — Fri 12 →
// Mon 15 Mar — Check availability →", between two hairlines. At move 2's 0.92 the engine switches the end card on
// (theme.end.at); this layer draws that opening itself (ctx.endCard.manual): the two hairlines part and the line grows
// up into the frosted card over the calm side of the terrace's view, while the line's words cross-fade into the card's rows.
// In the card, "Check out" cycles 2–5 nights and "Guests" 1–2 adults; the total rolls digit by digit (500 ms).
// Every timed thing runs on the engine clock (Fade / Switch), so ?record replays give the same pixels.

const IN = new Date(Date.UTC(2027, 2, 12)); // Fri 12 Mar 2027
const RATE = 780;
const NIGHTS = [2, 3, 4, 5];
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const sgd = (n) => n.toLocaleString("en-US");
const outDate = (n) => new Date(IN.getTime() + n * 864e5);
const dayStr = (d) => `${DAY[d.getUTCDay()]} ${d.getUTCDate()} Mar`;

/** A text that rolls to its new value: each changed character slides up and out as the new one slides in (right to
 *  left, 30 ms apart), then the element goes back to plain text. Timed by a Fade on the engine clock. */
class Roll {
  constructor(el, Fade, clock) {
    this.el = el; this.text = el.textContent; this.f = new Fade(clock, 1); this.cols = null;
  }
  set(text) {
    if (text === this.text) return;
    const a = this.text, b = text, n = Math.max(a.length, b.length);
    const A = a.padStart(n, " "), B = b.padStart(n, " ");
    this.el.textContent = "";
    this.cols = [];
    for (let i = 0; i < n; i++) {
      const same = A[i] === B[i];
      const c = document.createElement("span");
      c.className = same ? "rl-c" : "rl-c rl-roll";
      if (same) c.textContent = B[i];
      else c.innerHTML = `<i class="rl-o">${A[i] === " " ? "&nbsp;" : A[i]}</i><i class="rl-n">${B[i] === " " ? "" : B[i]}</i>`;
      this.el.append(c);
      if (!same) this.cols.push({ c, o: c.firstChild, nn: c.lastChild, d: (n - 1 - i) * 30 });
    }
    this.text = b;
    this.span = 420 + (this.cols.length ? this.cols[0].d : 0);
    this.f.snap(0).to(1, this.span, "linear");
  }
  paint() {
    if (!this.cols) return;
    const ms = this.f.value * this.span;
    for (const k of this.cols) {
      const t = clamp((ms - k.d) / 420), e = 1 - Math.pow(1 - t, 3);
      k.o.style.transform = `translateY(${(-e * 100).toFixed(2)}%)`;
      k.o.style.opacity = (1 - e).toFixed(3);
      k.nn.style.transform = `translateY(${((1 - e) * 100).toFixed(2)}%)`;
      k.nn.style.opacity = e.toFixed(3);
    }
    if (this.f.value >= 1) { this.el.textContent = this.text; this.cols = null; }
  }
  snap(text) { this.text = text; this.cols = null; this.el.textContent = text; this.f.snap(1); }
}

export const bookingLine = {
  name: "booking-line",

  mount(ctx) {
    this.ctx = ctx;
    this.nights = 3; this.guests = 2;
    // the line in the walk bar's right slot
    const slot = ctx.slots.walkbarRight;
    const wrap = (this.wrap = document.createElement("div"));
    wrap.className = "bl";
    wrap.innerHTML = `<div class="bl-clip"><div class="bl-line t-label t-num">
        <span class="bl-room">Villa 12 · Karang</span><span class="bl-dash">—</span>
        <span class="bl-guests">2 guests</span><span class="bl-dash">—</span>
        <span class="bl-dates">Fri 12 → Mon 15 Mar</span><span class="bl-dash">—</span>
        <button type="button" class="bl-go" data-verb="Book">Check availability →</button>
      </div></div>`;
    slot.append(wrap);
    this.line = wrap.querySelector(".bl-line");
    this.lineGuests = wrap.querySelector(".bl-guests");
    this.lineDates = wrap.querySelector(".bl-dates");
    wrap.querySelector(".bl-go").addEventListener("click", () => ctx.go("end"));
    this.rise = new ctx.Fade(ctx.clock, 0);

    // the card: the engine has moved section#end into the stage; a frosted "morph" sheet grows from the line into it
    const card = ctx.endCard?.el ?? document.getElementById("end");
    this.card = card;
    this.morph = document.createElement("div");
    this.morph.className = "bl-morph";
    this.morph.setAttribute("aria-hidden", "true");
    card?.before(this.morph);
    this.inner = card?.querySelector(".bk");
    // rows that cycle, the total that rolls, the demo note
    const q = (s) => card?.querySelector(s);
    this.rOut = new Roll(q("[data-out]"), ctx.Fade, ctx.clock);
    this.rGuests = new Roll(q("[data-guests]"), ctx.Fade, ctx.clock);
    this.rNights = new Roll(q("[data-nights]"), ctx.Fade, ctx.clock);
    this.rTotal = new Roll(q("[data-total]"), ctx.Fade, ctx.clock);
    this.rolls = [this.rOut, this.rGuests, this.rNights, this.rTotal];
    q("[data-row='out']")?.addEventListener("click", () => { this.nights = NIGHTS[(NIGHTS.indexOf(this.nights) + 1) % NIGHTS.length]; this.apply(); });
    q("[data-row='guests']")?.addEventListener("click", () => { this.guests = this.guests === 2 ? 1 : 2; this.apply(); });
    this.note = q(".bk-note");
    this.noteF = new ctx.Fade(ctx.clock, 0);
    q("#book")?.addEventListener("click", (ev) => { ev.preventDefault(); this.note.hidden = false; this.noteF.to(1, 300, "out"); ctx.invalidate(); });
  },

  /** the card's values from nights and guests (rows roll; the line follows) */
  apply(snap = false) {
    const ctx = this.ctx, n = this.nights, g = this.guests, out = outDate(n);
    const vals = [
      [this.rOut, `${dayStr(out)} 2027`],
      [this.rGuests, g === 1 ? "1 adult" : `${g} adults`],
      [this.rNights, `${n} nights`],
      [this.rTotal, sgd(n * RATE)],
    ];
    for (const [r, v] of vals) snap ? r.snap(v) : r.set(v);
    this.lineGuests.textContent = g === 1 ? "1 guest" : `${g} guests`;
    this.lineDates.textContent = `Fri 12 → ${dayStr(out)}`;
    ctx.invalidate();
  },

  layout(ctx) {
    this.phone = ctx.phone;
    if (ctx.endCard) ctx.endCard.manual = !ctx.phone && !ctx.reduced;
    this.card?.classList.toggle("bl-manual", Boolean(ctx.endCard?.manual));
    this.measure();
    this.mk = null; this.lv = null;
  },

  /** the line's and the card's rects (viewport px), read with no transforms in play */
  measure() {
    if (!this.card) return;
    const t = this.line.style.transform, ct = this.card.style.transform;
    this.line.style.transform = ""; this.card.style.transform = "";
    const L = this.line.getBoundingClientRect(), C = this.card.getBoundingClientRect();
    this.line.style.transform = t; this.card.style.transform = ct;
    // the line's rect with its hairlines (CSS pads them 10 px above and below the words)
    this.L = { x: L.left, y: L.top, w: L.width, h: L.height };
    this.C = { x: C.left, y: C.top, w: C.width, h: C.height };
  },

  step(s, ctx) {
    const cut = ctx.tl.cuts["cut-1"];
    const from = cut ? cut.p[0] + (cut.p[1] - cut.p[0]) * 0.55 : 0;
    const want = s.p >= from && !s.phone ? 1 : 0;
    if (want !== this.rise.target) this.rise.to(want, want ? 700 : 300, want ? "out" : "in");
  },

  update(s, ctx) {
    for (const r of this.rolls) r.paint();
    if (this.note && !this.note.hidden) this.note.style.opacity = this.noteF.value.toFixed(3);

    // the card's opening: 0 → 1 over 600 ms (out), back over 280 ms (in)
    const sw = ctx.endCard?.sw;
    let k = 0;
    if (sw) k = sw.on ? ctx.ease.out(clamp(sw.age / 600)) : (sw.age < 280 ? 1 - ctx.ease.in(clamp(sw.age / 280)) : 0);
    if (sw && !sw.on && sw.age >= 280) k = 0;

    // the line: rises out of its clip box; gives way to the card as it grows
    const r = this.rise.value * (1 - clamp(k / 0.35));
    const lv = r.toFixed(3);
    if (lv !== this.lv) {
      this.lv = lv;
      this.line.style.transform = r >= 1 ? "" : `translateY(${((1 - this.rise.value) * 110).toFixed(2)}%)`;
      this.wrap.style.opacity = lv;
      this.wrap.style.visibility = r <= 0.001 ? "hidden" : "visible";
      this.wrap.style.pointerEvents = r > 0.5 ? "auto" : "none";
    }

    if (!ctx.endCard?.manual) { if (this.mk !== "off") { this.mk = "off"; this.morph.style.visibility = "hidden"; } return; }
    const mk = k.toFixed(4);
    if (mk === this.mk) return;
    this.mk = mk;
    const card = this.card, m = this.morph;
    if (k <= 0.0001) {
      m.style.visibility = "hidden";
      card.style.visibility = "hidden"; card.style.pointerEvents = "none"; card.style.clipPath = ""; card.classList.remove("is-open");
      return;
    }
    if (!this.C || !this.C.w) this.measure();
    const L = this.L, C = this.C;
    if (k >= 1) {
      // fully grown: the card carries its own frosted background (it can change height, e.g. the demo note)
      m.style.visibility = "hidden";
      card.classList.add("is-open");
      card.style.visibility = "visible"; card.style.pointerEvents = "auto"; card.style.clipPath = "";
      if (this.inner) this.inner.style.opacity = "";
      return;
    }
    card.classList.remove("is-open");
    // the sheet between the two hairlines: from the line's rect to the card's
    const x = lerp(L.x, C.x, k), y = lerp(L.y, C.y, k), w = lerp(L.w, C.w, k), h = lerp(L.h, C.h, k);
    m.style.visibility = "visible";
    m.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
    m.style.width = `${w.toFixed(2)}px`;
    m.style.height = `${h.toFixed(2)}px`;
    m.style.setProperty("--bg", clamp(k / 0.5).toFixed(3));
    m.style.setProperty("--hl", (1 - clamp((k - 0.5) / 0.5)).toFixed(3));
    m.style.borderRadius = `${(4 * k).toFixed(2)}px`;
    // the card's words arrive as the sheet nears its size
    card.style.visibility = "visible";
    card.style.pointerEvents = k > 0.6 ? "auto" : "none";
    // and only inside the sheet, so they never show past its edges while it grows
    const ins = [y - C.y, C.x + C.w - (x + w), C.y + C.h - (y + h), x - C.x].map((v) => Math.max(0, v).toFixed(2) + "px");
    card.style.clipPath = `inset(${ins.join(" ")})`;
    if (this.inner) this.inner.style.opacity = clamp((k - 0.3) / 0.6).toFixed(3);
  },

  reset(ctx) {
    this.nights = 3; this.guests = 2;
    this.rise.snap(0);
    this.apply(true);
    if (this.note) { this.note.hidden = true; this.noteF.snap(0); }
    this.mk = null; this.lv = null;
  },
};
