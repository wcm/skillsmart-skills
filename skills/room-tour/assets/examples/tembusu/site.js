// Tembusu's site layers. Each runs its timed motion on the engine clock, so ?record replays.
//   legend    the material legend in the walk bar's right slot: a 6 px bar that grows one segment per material as
//             the walk passes it (teak at the door, terrazzo, limestone, rattan, Sukabumi outside); labels rise above, shares roll
//   plan      the end sheet's plan: img/plan.svg inlined, its strokes drawn over 900 ms when it comes into view
//   cardNext  "Next material ↗" at the foot of each material card (the engine's material template has no next link)
//   notes     the end sheet's two asks show a small inline note (it's a demo)

const MATS = [
  { id: "teak", name: "Teak", a: 25, b: 22 },
  { id: "terrazzo", name: "Terrazzo", a: 36, b: 31 },
  { id: "limestone", name: "Limestone", a: 30, b: 26 },
  { id: "rattan", name: "Rattan", a: 9, b: 8 },
  { id: "sukabumi", name: "Sukabumi", a: 0, b: 13 },
];

export const legend = {
  mount(ctx) {
    const slot = ctx.slots.walkbarRight;
    slot.setAttribute("data-phone", "");
    this.el = document.createElement("div");
    this.el.className = "lg";
    this.el.setAttribute("aria-label", "Materials, share of the living room's surfaces");
    this.el.innerHTML = `<div class="lg-labels">${MATS.map((m) => `<span class="lg-lab t-label" data-m="${m.id}"><span class="lg-name">${m.name}</span> <span class="lg-pc t-num"></span></span>`).join("")}</div>
      <div class="lg-bar"><span class="lg-track"></span>${MATS.map((m) => `<span class="lg-seg" data-m="${m.id}"></span>`).join("")}</div>`;
    slot.append(this.el);
    this.labs = MATS.map((m) => this.el.querySelector(`.lg-lab[data-m="${m.id}"]`));
    this.pcs = this.labs.map((l) => l.querySelector(".lg-pc"));
    this.segs = MATS.map((m) => this.el.querySelector(`.lg-seg[data-m="${m.id}"]`));
    this.share = MATS.map(() => new ctx.Fade(ctx.clock, 0));   // share of the bar, 0–1
    this.rise = MATS.map(() => new ctx.Fade(ctx.clock, 0));    // label in
    this.on = MATS.map(() => false);
    this.newest = -1;
    this.cache = "";
  },
  layout(ctx) {
    this.w = this.el.querySelector(".lg-bar").clientWidth;
    this.lw = this.labs.map((l) => l.getBoundingClientRect().width);
    this.cache = "";
  },
  /** which materials have arrived at this state */
  arrived(s, ctx) {
    const segs = ctx.tl.segments, idx = segs.indexOf(s.seg);
    const on = MATS.map(() => false);
    for (const [mid, mv] of Object.entries(ctx.data.moves)) {
      const mi = segs.findIndex((g) => g.kind === "move" && g.id === mid);
      for (const ev of mv.events ?? []) {
        if (ev.name !== "material") continue;
        const i = MATS.findIndex((m) => m.id === ev.id);
        if (i < 0) continue;
        on[i] = idx > mi || (idx === mi && (s.move?.t ?? 0) >= ev.at);
      }
    }
    return on;
  },
  step(s, ctx) {
    const on = this.arrived(s, ctx);
    if (on.join() === this.on.join()) return;
    const five = on[4];
    on.forEach((v, i) => {
      if (v && !this.on[i]) this.newest = i;
      const target = v ? (five ? MATS[i].b : MATS[i].a) / 100 : 0;
      this.share[i].to(target, 500, "out");
      this.rise[i].to(v ? 1 : 0, v ? 420 : 200, v ? "out" : "linear", v && !this.on[i] ? 120 : 0);
    });
    if (!on[this.newest]) this.newest = on.lastIndexOf(true);
    this.on = on;
  },
  update(s, ctx) {
    const W = this.w || 0, phone = ctx.phone;
    const sh = this.share.map((f) => f.value), ri = this.rise.map((f) => f.value);
    const key = sh.map((v) => v.toFixed(4)).join() + ri.map((v) => v.toFixed(3)).join() + W + this.newest;
    if (key === this.cache) return;
    this.cache = key;
    // segments: whole pixels, laid end to end with a 2 px gap
    let x = 0;
    const lefts = [];
    MATS.forEach((m, i) => {
      const w = Math.round(sh[i] * W);
      lefts.push(x);
      const seg = this.segs[i];
      seg.style.transform = `translateX(${x}px)`;
      seg.style.width = `${Math.max(0, w - (w > 3 ? 2 : 0))}px`;
      seg.classList.toggle("is-new", i === this.newest);
      x += w;
    });
    // labels: start at their segment; one that would touch the label before it moves up a row; the last one
    // that is on right-aligns at the bar's end
    MATS.forEach((m, i) => { const t = `${Math.round(sh[i] * 100)}%`; if (this.pcs[i].textContent !== t) this.pcs[i].textContent = t; });
    const lastOn = this.on.lastIndexOf(true);
    this.lw = this.labs.map((l) => l.offsetWidth);   // measured here too: the labels' widths only change with their text
    let prevEnd = [-1e9, -1e9];
    MATS.forEach((m, i) => {
      const lab = this.labs[i], r = ri[i];
      const lw = this.lw?.[i] ?? 0;
      let lx = lefts[i];
      if (i === lastOn && this.on[i]) lx = Math.min(lx, W - lw);
      if (phone) lx = W - lw;                          // a phone shows only the newest label, at the bar's end
      let row = lx < prevEnd[0] + 12 ? 1 : 0;
      if (row === 1 && lx < prevEnd[1] + 12) row = 0;
      if (r > 0.001) prevEnd[row] = lx + lw;
      const show = phone ? i === this.newest : true;
      lab.style.opacity = show ? r.toFixed(3) : "0";
      lab.style.transform = `translate(${Math.round(lx)}px, ${Math.round(-row * 19 + (1 - r) * 8)}px)`;
    });
  },
  reset(ctx) {
    this.share.forEach((f) => f.snap(0));
    this.rise.forEach((f) => f.snap(0));
    this.on = MATS.map(() => false);
    this.newest = -1;
    this.cache = "";
  },
};

export const plan = {
  mount(ctx) {
    this.host = document.querySelector("#plan-host");
    this.draw = new ctx.Fade(ctx.clock, 0);
    this.cache = -1;
    this.ready = fetch(ctx.base + "img/plan.svg").then((r) => r.text()).then((t) => {
      this.host.innerHTML = t.replace(/<\?xml[^>]*>/, "");
      this.svg = this.host.querySelector("svg");
    }).catch(() => {});
  },
  layout(ctx) {
    // the plan's top relative to the end section's top (the end section moves with the scroll)
    const end = ctx.end ?? document.getElementById("end");
    if (!end || !this.host) return;
    this.dy = this.host.getBoundingClientRect().top - end.getBoundingClientRect().top;
    this.vh = innerHeight;
  },
  step(s, ctx) {
    if (!isFinite(s.endTop) || this.dy == null) return;
    const top = s.endTop + this.dy;
    if (top < this.vh * 0.82 && this.draw.value === 0 && !this.started) { this.started = true; this.draw.to(1, 900, "inout"); }
    if (top > this.vh * 1.05 && this.started) { this.started = false; this.draw.snap(0); }
  },
  update(s, ctx) {
    if (!this.svg) return;
    const k = Math.round(this.draw.value * 1000) / 1000;
    if (k === this.cache) return;
    this.cache = k;
    this.svg.style.setProperty("--draw", k);
  },
  reset() { this.started = false; this.draw.snap(0); this.cache = -1; },
};

const NEXT = { m01: "m02", m02: "m03", m03: "m04", m04: "m05", m05: "m01" };
export const cardNext = {
  event(name, p, ctx) {
    if (name !== "card:open" || !NEXT[p.id]) return;
    const body = document.querySelector(`.tour-card[data-card="${p.id}"] .tk-body`);
    if (!body || body.querySelector(".tk-next")) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tk-next";
    b.textContent = "Next material ↗";
    b.addEventListener("click", () => ctx.openCard(NEXT[p.id]));
    body.append(b);
  },
};

export const notes = {
  mount(ctx) {
    for (const a of document.querySelectorAll("[data-demo-note]")) {
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        const n = document.getElementById(a.dataset.demoNote);
        if (n) n.hidden = false;
      });
    }
  },
};

// the nav over the walk: bone on the cover, green-black once the title leaves (pale walls, sky); the rail in the
// middle stays bone while it sits on the teak ceiling (through the door, the living room, the first half of move 2)
const INK = "#12291F", BONE = "#F6F3EC";
export const inks = {
  mount() { this.key = "bone/bone"; },
  step(s, ctx) {
    const segs = ctx.tl.segments, idx = segs.indexOf(s.seg), t = s.move?.t ?? 0;
    const m1 = segs.findIndex((g) => g.kind === "move" && g.id === "move-1"), m2 = segs.findIndex((g) => g.kind === "move" && g.id === "move-2");
    const nav = idx > m1 || (idx === m1 && t >= 0.07);
    const railBone = !nav || (idx === m1 && t >= 0.3) || (idx > m1 && idx < m2) || (idx === m2 && t < 0.46);
    // a phone's slice has the teak ceiling behind the whole nav, so there the nav follows the rail
    const navInk = ctx.phone ? !railBone : nav;
    const key = `${navInk ? "ink" : "bone"}/${railBone ? "bone" : "ink"}`;
    if (key === this.key) return;
    this.key = key;
    ctx.setTokens({ "--nav-ink-photo": navInk ? INK : BONE, "--rail-ink": railBone ? BONE : INK }, 500);
  },
  reset() { this.key = "bone/bone"; },
};
