// The calm cursor and the recording's beats (design-system.md 4.14 and 6.3).
//
//   live      theme.cursor.on: a fluid outline, 1 px, --cursor-ink (--on-photo) at 70 %, about 26 px across, trailing the
//             visitor's own cursor (which always stays visible) with a 0.2 lerp per frame. It is a soft, slightly uneven
//             loop that stretches along its motion, its trailing side lagging, and wobbles a little as it travels; at
//             rest it settles. Over a hotspot, a swatch, an add button or a canvas (anything with data-verb, or the art
//             layer's quads) it grows in 180 ms and shows a verb beside it in the label face (theme.cursor.verbs: Open,
//             Add, Lift, Pick). Hidden on touch and with reduced motion.
//   beats     ?record (record.beats): scripted clicks, because nobody can click in a video. For each beat the cursor
//             fades in near its target, moves to it along a slight arc (0.6 s, inout), rests 0.25 s, clicks (the ring
//             pulses .9 → 1, 180 ms), performs the action and holds; `then` reaches the follow-up target (an open card's
//             add button) and acts again; `close` (default true for open and lift) moves to the × (0.5 s), clicks and
//             closes. Beats add time, not scroll (timeline.js times them).
//             target  hotspot:<id> · card:<id> · art:<id> · swatch:<card>:<name> · el:<css selector>
//             do      open · lift · swatch · add · hover
//   Every action fires when the recording's clock crosses its moment, so a replay from the cover reaches the same state:
//   the same frame number always gives the same pixels.

import { el, svg, clamp, lerp, ease } from "../util.js";

const REACH = 0.6, REST = 0.25, CLICK = 0.18, CLOSE = 0.5;
const ACT = { open: 0.48, lift: 0.7, swatch: 0.3, add: 0.5, hover: 0.18 };
const R = 13;   // the outline's radius at rest, px

/** the fluid outline around (0, 0): a soft, slightly uneven loop of radius r that stretches along (vx, vy), the lag
 *  between it and the pointer in px, with its trailing side drawn out; phase turns the wobble as it travels */
function fluid(r, vx, vy, phase) {
  const N = 12, sp = Math.hypot(vx, vy), k = Math.min(sp / 36, 0.6), dx = sp ? vx / sp : 1, dy = sp ? vy / sp : 0;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wob = 1 + 0.055 * Math.sin(3 * a + phase) + 0.035 * Math.sin(5 * a - phase * 1.6 + 1.3) + 0.025 * Math.sin(2 * a + 0.7);
    const x = Math.cos(a) * r * wob, y = Math.sin(a) * r * wob;
    const along = x * dx + y * dy, across = -x * dy + y * dx;
    const al = along * (along >= 0 ? 1 + k * 0.35 : 1 + k * 1.25), ac = across * (1 - k * 0.3);
    pts.push([al * dx - ac * dy, al * dy + ac * dx]);
  }
  const f = (v) => v.toFixed(2);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i + N - 1) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + "Z";
}

export const cursor = {
  name: "cursor",

  mount(ctx) {
    const d = ctx.data, C = d.theme.cursor ?? {};
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    this.live = Boolean(C.on) && !ctx.reduced && !ctx.record && fine;
    this.scripted = ctx.record && (d.record.beats?.length ?? 0) > 0;
    this.verbs = { hotspot: "Open", art: "Lift", add: "Add", swatch: "Pick", ...(C.verbs ?? {}) };
    if (!this.live && !this.scripted) return;
    const e = (this.e = el("div", "tour-cursor", null, { "aria-hidden": "true" }));
    const s = svg("svg", { class: "tcur-svg", viewBox: "-30 -30 60 60", width: 60, height: 60 }, e);
    this.g = svg("g", { class: "tcur-g" }, s);
    this.ring = svg("path", { class: "tcur-ring", d: fluid(R, 0, 0, 0) }, this.g);
    this.verb = el("span", "tcur-verb t-label");
    e.append(this.verb);
    ctx.stageEl.append(e);
    if (this.live) ctx.root.classList.add("tour-cursor-on");
    this.pos = null;
    this.phase = 0;
    this.grow = new ctx.Fade(ctx.clock, 0);
    this.fired = new Set();
    this.now = null;          // the beat running now ({ beat, k }); not `this.beat`, which is the hook
  },

  // ——— beats (record mode): logic, called every recording step after step() ———
  beat(b, ctx) {
    if (!this.scripted) return;
    this.now = b;
    if (!b) return;
    const B = b.beat, k = b.k, idx = `${B.at}|${B.do}|${B.target}|${B.t[0].toFixed(3)}`;
    const plan = this.plan(B);
    for (const [name, at, fn] of plan.actions) {
      const key = `${idx}:${name}`;
      if (k >= at && !this.fired.has(key)) { this.fired.add(key); fn(ctx); }
    }
  },

  /** a beat's moments: [name, seconds into the beat, action] and the cursor's path keys */
  plan(B) {
    const t0 = REACH + REST, a1 = t0 + CLICK, act = ACT[B.do] ?? 0.4, hold = B.hold ?? 1.2;
    const actions = [], [kind, ...rest] = B.target.split(":"), id = rest.join(":");
    actions.push(["do", a1, (ctx) => this.act(B.do, kind, id, ctx)]);
    let t = a1 + act + hold, thenAt = null;
    if (B.then) {
      thenAt = t;
      actions.push(["then", t + REACH + REST + CLICK, (ctx) => this.act(B.then, kind, id, ctx, true)]);
      t += REACH + REST + CLICK + (ACT[B.then] ?? 0.4) + 0.6;
    }
    let closeAt = null;
    if (B.close !== false && (B.do === "open" || B.do === "lift")) {
      closeAt = t;
      actions.push(["close", t + CLOSE + CLICK, (ctx) => this.close(B.do, kind, id, ctx)]);
      t += CLOSE + CLICK + (B.do === "lift" ? 0.52 : 0.28);
    }
    if (B.do === "hover") actions.push(["unhover", Math.max(a1 + 0.2, (B.duration ?? t) - 0.05), (ctx) => this.hover(kind, id, false, ctx)]);
    return { actions, a1, thenAt, closeAt, end: B.duration ?? t };
  },

  act(what, kind, id, ctx, isThen = false) {
    const click = (e) => { if (e) e.click(); return Boolean(e); };
    if (what === "hover") return this.hover(kind, id, true, ctx);
    if (what === "open") {
      if (kind === "hotspot") return ctx.openHotspot?.(id);
      if (kind === "card") return ctx.openCard?.(id);
      if (kind === "art") return ctx.lift?.(id, { force: true });
      if (kind === "el") return click(document.querySelector(id));
    }
    if (what === "lift") return kind === "art" ? ctx.lift?.(id, { force: true }) : kind === "hotspot" ? ctx.openHotspot?.(id) : null;
    if (what === "swatch") {
      const [card, name] = kind === "swatch" ? id.split(":") : [null, null];
      const t = ctx.targetAt(`swatch:${card}:${name}`);
      if (!click(t?.el) && card) ctx.pickSwatch?.(card, name);
      return;
    }
    if (what === "add") {
      if (kind === "el") return click(document.querySelector(id));
      const cardId = kind === "card" ? id : ctx.card;
      const t = cardId ? ctx.targetAt(`card:${cardId}`) : null;
      return click(t?.el?.matches?.("[data-action='add']") ? t.el : null);
    }
  },
  hover(kind, id, on, ctx) {
    if (kind === "hotspot") ctx.hoverHotspot?.(id, on);
    this.hovering = on ? `${kind}:${id}` : null;
    ctx.emit(kind === "art" ? "art:hover" : "hotspot:hover", { id: on ? id : null, on, scripted: true });
  },
  close(what, kind, id, ctx) {
    if (what === "lift" || ctx.lifted) return ctx.unlift?.();
    if (ctx.card) return ctx.closeCard?.();
    if (kind === "hotspot") ctx.openHotspot?.(id);   // a fact pill closes the way it opened
  },

  /** the target's point on screen now (paint time) */
  where(kind, id, ctx, phase) {
    if (phase === "close") {
      if (ctx.lifted) return ctx.targetAt("lift:close");
      if (ctx.card) return ctx.targetAt(`card:${ctx.card}:close`);
    }
    if (phase === "then") {
      if (ctx.card) return ctx.targetAt(`card:${ctx.card}`);
    }
    if (kind === "el") { const e = document.querySelector(id); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, el: e, verb: this.verbs.add }; }
    return ctx.targetAt(`${kind}:${id}`);
  },

  /** where the scripted cursor is k seconds into beat B, and how it looks */
  scriptAt(B, k, ctx) {
    let x, y, alpha = 0, grow = 0, verb = "", pulse = 1;
    const plan = this.plan(B);
    const [kind, ...rest] = B.target.split(":"), id = rest.join(":");
    const T = this.where(kind, id, ctx, "do") ?? { x: ctx.stage.vw * 0.6, y: ctx.stage.vh * 0.6 };
    const vw = ctx.stage.vw, vh = ctx.stage.vh;
    const P0 = { x: clamp(T.x + 150, 40, vw - 40), y: clamp(T.y + 110, 40, vh - 40) };
    const arc = (A, Z, e) => {
      const dx = Z.x - A.x, dy = Z.y - A.y, n = Math.hypot(dx, dy) || 1, bend = Math.sin(Math.PI * e) * 0.12 * n;
      return [lerp(A.x, Z.x, e) + (-dy / n) * bend, lerp(A.y, Z.y, e) + (dx / n) * bend];
    };
    let at = [T.x, T.y], cur = T;
    if (k < REACH) at = arc(P0, T, ease.inout(k / REACH));
    verb = this.verbs[{ hotspot: "hotspot", art: "art", swatch: "swatch", card: "add", el: "add" }[kind]] ?? "";
    if (T.verb) verb = T.verb;
    grow = clamp((k - REACH * 0.85) / 0.18);
    const pulseAt = (tc) => (k >= tc && k < tc + CLICK ? 0.9 + 0.1 * ease.out((k - tc) / CLICK) : 1);
    pulse = pulseAt(REACH + REST);
    if (plan.thenAt != null && k >= plan.thenAt) {
      const T2 = this.where(kind, id, ctx, "then") ?? T;
      const kk = k - plan.thenAt;
      at = kk < REACH ? arc(T, T2, ease.inout(kk / REACH)) : [T2.x, T2.y];
      cur = T2;
      verb = T2.verb ?? this.verbs.add;
      pulse = pulseAt(plan.thenAt + REACH + REST);
    }
    if (plan.closeAt != null && k >= plan.closeAt) {
      const from = { x: at[0], y: at[1] };
      const T3 = this.where(kind, id, ctx, "close") ?? from;
      const kk = k - plan.closeAt;
      at = kk < CLOSE ? arc(from, T3, ease.inout(kk / CLOSE)) : [T3.x, T3.y];
      cur = T3;
      verb = "";
      grow = clamp(1 - kk / 0.18);
      pulse = pulseAt(plan.closeAt + CLOSE);
    }
    [x, y] = at;
    alpha = Math.min(clamp(k / 0.2), clamp((plan.end - k) / 0.3));
    if (!cur) grow = 0;
    return { x, y, alpha, grow, verb, pulse };
  },

  // drawn after every component and layer has painted, so DOM targets (a layer's swatch row) are where they are now
  post(s, ctx) {
    if (!this.e) return;
    let x, y, alpha = 0, grow = 0, verb = "", pulse = 1, vx = 0, vy = 0, phase = 0, left = false;
    if (this.scripted) {
      const b = this.now;
      if (b) {
        ({ x, y, alpha, grow, verb, pulse } = this.scriptAt(b.beat, b.k, ctx));
        // the stretch comes from where the cursor was a fifth of a second ago, so a replay draws the same shape
        const was = this.scriptAt(b.beat, Math.max(0, b.k - 0.2), ctx);
        vx = (x - was.x) * 0.5; vy = (y - was.y) * 0.5;
        phase = b.k * 2.4;
        left = b.beat.target.startsWith("hotspot:");
      }
    } else {
      const P = ctx.pointer;
      if (P.inside && !P.touch) {
        const dt = Math.min(64, ctx.clock.dt || 16.7);
        const f = 1 - Math.pow(0.8, dt / 16.7);
        if (!this.pos) this.pos = [P.x, P.y];
        const ox = this.pos[0], oy = this.pos[1];
        this.pos[0] += (P.x - this.pos[0]) * f;
        this.pos[1] += (P.y - this.pos[1]) * f;
        if (Math.hypot(P.x - this.pos[0], P.y - this.pos[1]) > 0.3) ctx.clock.hold(40);
        [x, y] = this.pos;
        vx = P.x - x; vy = P.y - y;                                   // the lag is the stretch
        this.phase += Math.hypot(x - ox, y - oy) * 0.09;              // it wobbles only while it travels
        phase = this.phase;
        alpha = 1;
        const under = document.elementFromPoint(P.x, P.y);
        const overArt = under === ctx.canvas && Boolean(ctx.canvas.dataset.verb);
        const v = under?.closest?.("[data-verb]")?.dataset.verb || (overArt ? ctx.canvas.dataset.verb : "");
        verb = v || "";
        left = Boolean(under?.closest?.(".th"));
        // the visitor's own cursor stays; over a work on the canvas it turns to the pointer hand like any link
        const want = overArt ? "pointer" : "";
        if (ctx.canvas.style.cursor !== want) ctx.canvas.style.cursor = want;
        this.grow.to(verb ? 1 : 0, 180, "out");
        grow = this.grow.value;
      } else this.pos = null;
    }
    const key = alpha <= 0.001 ? "off" : `${x.toFixed(1)}|${y.toFixed(1)}|${alpha.toFixed(3)}|${grow.toFixed(3)}|${pulse.toFixed(3)}|${verb}|${vx.toFixed(1)}|${vy.toFixed(1)}|${phase.toFixed(2)}|${left}`;
    if (key === this.key) return;
    this.key = key;
    if (key === "off") { this.e.style.visibility = "hidden"; return; }
    this.e.style.visibility = "visible";
    this.e.style.opacity = alpha.toFixed(3);
    this.e.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    const sc = (1 + 0.8 * grow) * pulse;
    this.g.setAttribute("transform", `scale(${sc.toFixed(4)})`);
    const d = fluid(R, vx / sc, vy / sc, phase);
    if (d !== this.d) { this.d = d; this.ring.setAttribute("d", d); }
    if (this.verb.textContent !== verb) this.verb.textContent = verb;
    this.verb.style.opacity = (verb ? grow : 0).toFixed(3);
    // beside the outline; on the left over a hotspot, whose plate opens to the right
    const off = R + 6 + 0.8 * R * grow * pulse;
    this.verb.style.transform = left ? `translate(calc(-100% - ${off.toFixed(1)}px), -50%)` : `translate(${off.toFixed(1)}px, -50%)`;
  },

  reset(ctx) {
    if (!this.e) return;
    this.fired.clear(); this.now = null; this.key = null; this.d = null; this.hovering = null; this.grow.snap(0);
  },
};
