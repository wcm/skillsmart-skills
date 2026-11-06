// The art layer and the lift (design-system.md 4.13, level 3: exact artworks on tracked blank canvases).
//
//   inputs    moves.*.panels: { src: "frames/move-1/panels.json" | [one per clip], map: { "<panel id>": "<work id>" } }
//             (tools/panels.py: four corners per canvas per SOURCE frame, `full`, `medians`), frames made with
//             tools/frames.py --key (the canvas a neutral grey light map; mask/NNNN.webp canvas masks), and per work
//             artworks.*.src (a flat image; ≤ 2000 px).
//   drawing   a WebGL pass after the frame (artgl.js): each visible quad gets its work through a homography, its
//             coverage times the canvas mask (a jamb or the bench stays in front), multiplied by the light map (soft,
//             canvas pixels only) normalised by the canvas's median at the stop (`medians`, interpolated across the
//             move; without them, estimated from the stop frames once) and clamped to 0.6–1.2; a quad missing in a
//             frame holds the last good one for up to 6 source frames, then hides. Quads come from the frame the
//             stage drew (ctx.view: fractional while ?record blends), so the art never slides on the wall.
//   labels    theme.hotspot.plate "wall": for up to 3 works (1 on a phone), largest first, each showing ≥ 30 % of
//             its area, a 1 px --ink line runs from its nearer top corner to a label in the left or right edge column
//             (works on the left half go left; labels stack 8 px apart in the order of their works, so lines never
//             cross; they hold still while the lines stretch). Label: number, title, year · medium, size with a
//             hairline bar (1 m = 24 px) and the size in italic. In and out 200 ms. Labels start once the window has
//             grown 50 %. A work is seen after its label has shown 600 ms, or once lifted (ctx.seen). ctx.inView is
//             the largest work on screen.
//   lift      a click inside a quad while the walk is at rest (no scroll for 300 ms), a works-rail click, a beat or
//             ctx.lift(id): the corners fly from the quad to an upright rectangle (max 62svh tall, the work's aspect;
//             phone: the width minus 32 px) over 700 ms (inout), in screen space so it unfolds flat; the light map and
//             the canvas mask fade out on the way; the work's tint fades over the stage to 96 %; from 200 ms the facts
//             rise in at the left (title, year, medium, size with its bar, price or Enquire, previous —— next), a huge
//             year in tintInk half behind the work's right edge, a caption up its left edge. Close (×, Esc, a click on
//             the tint) plays it back onto the current quad in 520 ms; previous / next cross-fade 300 ms (the works
//             at this stop by position, then the rest of the show). Reduced motion: a 250 ms cross-fade.
//   objects   artworks.*.kind "object" with `cutout` and `box` [x, y, w, h] (frame fractions at its stop): a hotspot
//             with `work` opens it, and its lift flies the cut-out from the box.
//
// ctx: lift(id, { force }), unlift(), lifted, inView, seen. Targets "art:<id>" (the quad's centre), "lift:close".
// Events: lift { id } · unlift { id } · art:hover { id }.

import { el, svg, esc, rich, plain, clamp, lerp, ease, polyArea, clipToRect, inQuad, loadImage, warn } from "../util.js";
import { ArtGL } from "../artgl.js";
import { Renderer } from "../stage.js";

const CLOSE = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.2 3.4 12.7 12.6M12.8 3.3 3.3 12.7"/></svg>`;
const HOLD = 6;

export const art = {
  name: "art",

  mount(ctx) {
    const d = (this.d = ctx.data);
    this.works = d.artworks ?? {};
    this.moves = {};
    const jobs = [];
    for (const [mid, m] of Object.entries(d.moves)) {
      if (!m.panels?.src) continue;
      const srcs = Array.isArray(m.panels.src) ? m.panels.src : [m.panels.src];
      const g = ctx.tl.moves[mid];
      const rec = (this.moves[mid] = { map: m.panels.map ?? {}, clips: srcs.map(() => null) });
      srcs.forEach((src, i) => jobs.push(fetch(ctx.base + src).then((r) => (r.ok ? r.json() : null)).then((j) => {
        if (!j) { warn(`moves.${mid}.panels: no panels file at ${src}`); return; }
        rec.clips[i] = j;
        const seq = g?.clips[i]?.seq;
        if (seq?.masks) { seq.wantMasks = true; seq.images.forEach((im, k) => { if (im._loaded) seq._mask(k); }); }
      }).catch(() => warn(`moves.${mid}.panels: couldn't read ${src}`))));
    }
    this.on = Object.keys(this.moves).length > 0 || Object.values(this.works).some((w) => w.kind === "object");
    this.img = {};
    for (const [wid, w] of Object.entries(this.works)) {
      const src = w.kind === "object" ? w.cutout ?? w.src : w.src;
      if (src && this.on) jobs.push(loadImage(ctx.base + src).then(async (im) => { if (im) { try { await im.decode(); } catch { /* */ } this.img[wid] = im; } }));
    }
    this.ready = Promise.all(jobs).then(() => ctx.invalidate());
    if (!this.on) return;
    this.wall = (ctx.data.theme.hotspot.plate ?? "pill") === "wall";
    this.gl = new ArtGL(ctx.stage.gl);
    ctx.stage.addPass({ draw: (info) => this.pass(info, ctx) });
    // wall labels and their lines
    this.labelsEl = el("div", "tour-walllabels");
    ctx.ui.append(this.labelsEl);
    this.lineG = svg("g", { class: "ta-lines" }, ctx.lines);
    this.labels = {};
    for (const [wid, w] of Object.entries(this.works)) {
      if (w.kind === "object") continue;
      const sz = w.size?.map(parseFloat) ?? [];
      const bar = sz[1] > 0 ? Math.max(4, Math.round((sz[1] / 100) * 24)) : 0;
      const e = el("div", "ta-label", `${w.n ? `<span class="ta-n t-label t-num">${esc(w.n)}</span>` : ""}<span class="ta-title">${rich(w.title ?? wid)}</span>`
        + `<span class="ta-meta">${rich([w.year, w.medium].filter(Boolean).join(" · "))}</span>`
        + (w.size?.length ? `<span class="ta-size">${bar ? `<i class="ta-bar" style="width:${bar}px"></i>` : ""}<em class="t-num">${esc(w.size.join(" × "))} cm</em></span>` : ""), { "data-work": wid });
      e.addEventListener("click", () => this.lift(wid, ctx, { force: true }));
      this.labelsEl.append(e);
      this.labels[wid] = { e, line: svg("line", { class: "ta-line" }, this.lineG), sw: new ctx.Switch(ctx.clock, false), y: null, yF: new ctx.Fade(ctx.clock, 0), flip: new ctx.Fade(ctx.clock, 1), side: "left", css: "" };
    }
    // the lift: tint, year, the lift canvas, facts, close
    const L = (this.liftEl = el("div", "tour-lift", null, { role: "dialog", "aria-modal": "true", "aria-label": "Artwork", tabindex: "-1" }));
    this.tint = el("div", "tl-tint");
    this.year = el("div", "tl-year t-num", null, { "aria-hidden": "true" });
    this.side = el("div", "tl-side t-label", null, { "aria-hidden": "true" });
    this.canvas = el("canvas", "tl-canvas", null, { "aria-hidden": "true" });
    this.facts = el("div", "tl-facts", null, { "data-tour-scrolls": "" });
    this.closeBtn = el("button", "tl-close", CLOSE, { type: "button", "aria-label": "Close" });
    L.append(this.tint, this.year, this.canvas, this.side, this.facts, this.closeBtn);
    ctx.modal.append(L);
    this.tint.addEventListener("click", () => this.unlift(ctx));
    this.closeBtn.addEventListener("click", () => this.unlift(ctx));
    addEventListener("keydown", (e) => {
      if (!this.L || this.L.closing) return;
      if (e.key === "Escape") { e.preventDefault(); this.unlift(ctx); }
      if (e.key === "ArrowRight") this.step2(1, ctx);
      if (e.key === "ArrowLeft") this.step2(-1, ctx);
    });
    this.lr = new Renderer(this.canvas, { preserve: ctx.record });
    this.lgl = new ArtGL(this.lr);
    this.L = null; this.Lold = null;
    // pointer: hover and click on the picture
    ctx.canvas.addEventListener("pointermove", (e) => this.hover(e.clientX, e.clientY, ctx));
    ctx.canvas.addEventListener("pointerleave", () => this.hover(-1, -1, ctx));
    ctx.canvas.addEventListener("click", (e) => { const w = this.hit(e.clientX, e.clientY); if (w) this.lift(w, ctx); });
    ctx.lift = (wid, o) => this.lift(wid, ctx, o);
    ctx.unlift = () => this.unlift(ctx);
    ctx.addNeed((state) => this.needs(state, ctx));
    for (const wid of Object.keys(this.works)) ctx.target(`art:${wid}`, () => {
      const q = this.drawn?.find((x) => x.wid === wid);
      if (q) { const c = centroid(q.px); return { x: c[0], y: c[1], verb: ctx.data.theme.cursor?.verbs?.art ?? "Lift", r: 30 }; }
      const t = ctx.targetAt(`hotspot:${this.hotspotOf(wid)}`);
      return t;
    });
    ctx.target("lift:close", () => { if (!this.L) return null; const r = this.closeBtn.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, el: this.closeBtn, r: 20 }; });
    this.normCache = new Map();
  },

  hotspotOf(wid) {
    for (const st of Object.values(this.d?.stops ?? {})) for (const h of st.hotspots ?? []) if (h.work === wid) return h.id;
    return null;
  },

  /** the panels and source frame of a clip, for a (move, clip index) */
  panelsFor(mid, clip) { return this.moves[mid]?.clips[clip] ?? null; },

  /** every work's quad at a source frame of a clip: [{ wid, pid, q: [8 frame fractions], norm, full }] */
  quadsAt(mid, clip, src, seq) {
    const P = this.panelsFor(mid, clip);
    if (!P) return [];
    const map = this.moves[mid].map, [W, H] = P.size ?? [1920, 1080], n = P.count ?? 0;
    const out = [];
    for (const pn of P.panels) {
      const wid = map[String(pn.id)];
      if (!wid || !this.works[wid]) continue;
      const Q = pn.quads;
      let a = Math.floor(src), b = Math.min(n - 1, a + 1), f = src - a;
      let qa = Q[a], qb = Q[b];
      if (!qa && qb && f > 0.5) { qa = qb; f = 0; }
      if (!qa) {
        // hold the last good quad for up to 6 source frames (4.13, lost quad)
        for (let k = 1; k <= HOLD && !qa; k++) qa = Q[a - k] ?? null;
        if (!qa) continue;
        qb = qa; f = 0;
      }
      if (!qb) qb = qa;
      const q = [];
      for (let k = 0; k < 8; k++) q.push(lerp(qa[k], qb[k], f) / (k % 2 ? H : W));
      out.push({ wid, pid: pn.id, q, norm: this.norm(pn, src, n, mid, clip, seq) });
    }
    return out;
  },

  /** the light map's normaliser: the canvas's median at the stop frames, interpolated across the clip (0–1) */
  norm(pn, src, n, mid, clip, seq) {
    const M = pn.medians;
    if (M?.length) {
      const first = M.find((x) => x != null), last = [...M].reverse().find((x) => x != null);
      if (first != null) {
        const m0 = M[0] ?? first, m1 = M[n - 1] ?? last;
        return lerp(m0, m1, clamp(src / Math.max(1, n - 1))) / 255;
      }
    }
    // no medians (an older panels.json): estimate once from the clip's first and last web frames
    const key = `${mid}#${clip}#${pn.id}`;
    let e = this.normCache.get(key);
    if (!e && seq) {
      const est = (wi) => {
        const im = seq.images[wi], qi = pn.quads[seq.map[wi]];
        if (!im?._loaded || !qi) return null;
        const c = (this.est ??= document.createElement("canvas"));
        c.width = 160; c.height = 90;
        const g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(im, 0, 0, 160, 90);
        const data = g.getImageData(0, 0, 160, 90).data;
        const P = this.panelsFor(mid, clip), [W, H] = P.size ?? [1920, 1080];
        const quad = [0, 1, 2, 3].map((k) => [qi[2 * k] / W * 160, qi[2 * k + 1] / H * 90]);
        const cx = quad.reduce((a, p) => a + p[0], 0) / 4, cy = quad.reduce((a, p) => a + p[1], 0) / 4;
        const inner = quad.map(([x, y]) => [cx + (x - cx) * 0.8, cy + (y - cy) * 0.8]);
        const vals = [];
        for (let y = 0; y < 90; y++) for (let x = 0; x < 160; x++) if (inQuad([x + 0.5, y + 0.5], inner)) vals.push((data[(y * 160 + x) * 4] + data[(y * 160 + x) * 4 + 1] + data[(y * 160 + x) * 4 + 2]) / 3);
        if (!vals.length) return null;
        vals.sort((a, b) => a - b);
        return vals[vals.length >> 1] / 255;
      };
      const a = est(0), b = est(seq.count - 1);
      if (a != null || b != null) { e = { a: a ?? b, b: b ?? a }; this.normCache.set(key, e); }
    }
    return e ? lerp(e.a, e.b, clamp(src / Math.max(1, n - 1))) : 0.36;
  },

  /** the logical picture for a state (the wanted frame: in ?record it is what is drawn) */
  logical(s, ctx) {
    if (s.kind === "move" && s.move?.frame) {
      const f = s.move.frame;
      return { move: s.seg.id, clip: f.clip, src: f.src, seq: f.seq };
    }
    if (s.kind === "cut") return null;
    const id = s.kind === "end" ? s.last : s.seg.id;
    const pic = ctx.tl.stopPic(id);
    if (!pic) return null;
    for (const g of Object.values(ctx.tl.moves)) { const i = g.clips.findIndex((c) => c.seq === pic.seq); if (i >= 0) return { move: g.id, clip: i, src: pic.src, seq: pic.seq }; }
    return null;
  },

  /** quads on screen for a picture, with the mapping given */
  onScreen(list, ctx, m) {
    const R = m?.R ?? ctx.map?.R;
    return list.map((w) => {
      const px = [0, 1, 2, 3].map((k) => ctx.stage.toScreen([w.q[2 * k], w.q[2 * k + 1]], m));
      const full = polyArea(px);
      const vis = R ? polyArea(clipToRect(px, R)) : full;
      return { ...w, px, area: vis, share: full > 1 ? vis / full : 0 };
    });
  },

  // ——— the WebGL pass (stage.addPass) ———
  pass(info, ctx) {
    const v = info.stage.view;
    this.drawn = [];
    if (!v || !this.gl.ok) return;
    const list = v.move ? this.quadsAt(v.move, v.clip, v.src, v.seq) : [];
    const shown = this.onScreen(list, ctx, info.map);
    this.drawn = shown;
    // the light map: the drawn pictures of the clip on screen (two while ?record blends)
    const pics = info.pics.filter((p) => p.seq === v.seq);
    const lights = pics.map((p) => ({ img: p.img, w: p.w }));
    const masks = pics.map((p) => (p.seq.masks ? (ctx.record ? (p.seq.masks[p.i]?.ok ? p.seq.masks[p.i].im : null) : p.seq.mask(p.i)) : null));
    const R = info.map.R;
    const fw = v.seq?.size?.[0] ?? 1600, fh = v.seq?.size?.[1] ?? 900;
    for (const w of shown) {
      if (this.L && (this.L.wid === w.wid || this.Lold?.wid === w.wid)) continue;   // it is in the air
      if (w.share <= 0) continue;
      this.gl.draw({ img: this.img[w.wid], corners: w.px, wall: w.q, lights, masks, norm: w.norm, light: 1, maskMix: 1, alpha: 1,
        clip: [R.x, R.y, R.w, R.h], radius: R.r, texel: [1 / fw, 1 / fh] });
    }
    this.lights = { lights, masks, texel: [1 / fw, 1 / fh] };
  },

  /** ?record: the canvas masks of the frames about to be drawn */
  needs(state, ctx) {
    const out = [];
    for (const q of ctx.stage.expand(ctx.stage.picsFor(state))) if (q.seq.wantMasks) out.push(q.seq.ensureMask(q.i));
    return Promise.all(out);
  },

  // ——— logic ———
  layout(ctx) {
    for (const lb of Object.values(this.labels ?? {})) { lb.w = lb.e.offsetWidth; lb.h = lb.e.offsetHeight; lb.y = null; }
    if (this.lr) this.lr.size(ctx.stage.vw, ctx.stage.vh, ctx.stage.dpr);
    this.rect = null;
  },

  step(s, ctx) {
    if (!this.on) return;
    // a lift that has finished closing is back on the wall; a cross-faded one is gone
    if (this.L?.closing && this.L.f.done) {
      this.L = null; this.Lold = null;
      ctx.lifted = null;
      if (this.lockedHere) { this.lockedHere = false; ctx.lockScroll(false); }
      ctx.invalidate();
    }
    if (this.Lold?.f.done) this.Lold = null;
    const lv = this.logical(s, ctx);
    const list = lv ? this.onScreen(this.quadsAt(lv.move, lv.clip, lv.src, lv.seq), ctx) : [];
    this.logicalList = list;
    // the work in view: the largest on screen
    let best = null;
    for (const w of list) if (w.share > 0.3 && (!best || w.area > best.area)) best = w;
    ctx.inView = best?.wid ?? null;
    if (!this.wall) return;
    // wall labels: up to 3 (1 on a phone), ≥ 30 % showing, largest first; they start once the window has grown 50 %
    const win = ctx.data.title.window;
    const started = (!win || s.screens >= 0.5 * (win.grow ?? 0.45)) && !(s.kind === "end" && ctx.data.theme.end.arrive === "sheet" && s.k > 0.04);
    const max = ctx.phone ? 1 : 3;
    const want = started && !this.L ? list.filter((w) => w.share >= 0.3 && this.labels[w.wid]).sort((a, b) => b.area - a.area).slice(0, max) : [];
    const ids = new Set(want.map((w) => w.wid));
    let changed = false;
    // a label holds still while its line stretches, until its work has crossed well into the other half: then it fades
    // out and back in at the other column (300 ms)
    for (const w of want) {
      const lb = this.labels[w.wid];
      if (!lb.sw.on || lb.y == null || ctx.phone) continue;
      const cx = centroid(w.px)[0], vw = ctx.stage.vw;
      if ((lb.side === "right" && cx < vw * 0.35) || (lb.side === "left" && cx > vw * 0.65)) { lb.y = null; lb.side = null; lb.flip.snap(0).to(1, 300, "out"); changed = true; }
    }
    for (const [wid, lb] of Object.entries(this.labels)) {
      const on = ids.has(wid);
      if (on !== lb.sw.on) { lb.sw.set(on); changed = true; ctx.clock.hold(800); }
      if (on && lb.sw.age >= 600 && !ctx.seen.has(wid)) { ctx.seen.add(wid); ctx.invalidate(); }
    }
    if (changed || want.some((w) => this.labels[w.wid].y == null)) this.slots(want, ctx, list);
  },

  /** label places: each column stacks its labels 8 px apart in the order of their works' top corners; a label keeps its
   *  place while it shows (only a newcomer can push the ones below it down) */
  slots(want, ctx, list) {
    const vw = ctx.stage.vw, vh = ctx.stage.vh, top = ctx.phone ? 120 : 200, bottom = vh - (ctx.phone ? 150 : 140);
    if (ctx.phone) {
      // a phone shows one label, low in the left column above the walk bar (the work fills the slice above it)
      for (const w of want) { const lb = this.labels[w.wid]; lb.side = "left"; lb.low = true; const y = vh - 72 - 16 - lb.h; if (lb.y == null) lb.yF.snap(y); lb.y = y; }
      for (const [wid, lb] of Object.entries(this.labels)) if (!want.some((w) => w.wid === wid) && !lb.sw.on) lb.y = null;
      return;
    }
    // a newcomer's column: its work's half, unless a painting sits where its label would go; then the other column, or
    // just below that painting (a label that has shown keeps its column)
    const margin = ctx.margin;
    // a column the mini-map sits in ends above the map
    const mapEl = ctx.phone ? null : ctx.ui.querySelector(".tour-map"), mr = mapEl?.getBoundingClientRect();
    const floorOf = { left: bottom, right: bottom };
    if (mr && mr.width) {
      if (mr.left < vw / 2) floorOf.left = Math.min(bottom, mr.top - 16);
      else floorOf.right = Math.min(bottom, mr.top - 16);
    }
    const boxes = (list ?? want).filter((w) => w.share > 0).map((w) => {
      const xs = w.px.map((p) => p[0]), ys = w.px.map((p) => p[1]);
      return { x: Math.min(...xs) - 12, y: Math.min(...ys) - 12, w: Math.max(...xs) - Math.min(...xs) + 24, h: Math.max(...ys) - Math.min(...ys) + 24 };
    });
    const hits = (r) => boxes.filter((b) => r.x < b.x + b.w && r.x + r.w > b.x && r.y < b.y + b.h && r.y + r.h > b.y);
    for (const w of want) {
      const lb = this.labels[w.wid];
      if (lb.y != null && lb.sw.on && lb.side) continue;
      const prefLeft = centroid(w.px)[0] < vw / 2;
      const opts = [];
      for (const left of [prefLeft, !prefLeft]) {
        const x = left ? margin : vw - margin - lb.w, cy = left ? w.px[0][1] : w.px[1][1], bottom = floorOf[left ? "left" : "right"];
        const y0 = clamp(cy - 10, top, Math.max(top, bottom - lb.h));
        const r = { x, y: y0, w: lb.w, h: lb.h }, over = hits(r);
        opts.push({ left, y: y0, ok: !over.length });
        if (over.length) { const yb = Math.max(...over.map((b) => b.y + b.h)) + 4; if (yb + lb.h <= bottom && !hits({ ...r, y: yb }).length) opts.push({ left, y: yb, ok: true }); }
      }
      const pick = opts.find((o) => o.ok) ?? opts[0];
      lb.side = pick.left ? "left" : "right";
      lb.want = pick.y;
    }
    for (const side of ["left", "right"]) {
      const col = want.filter((w) => this.labels[w.wid].side === side);
      const cy = (w) => this.labels[w.wid].y ?? this.labels[w.wid].want;
      col.sort((a, b) => cy(a) - cy(b));
      let floor = top;
      const bottom = floorOf[side];
      for (const w of col) {
        const lb = this.labels[w.wid];
        const desired = clamp(lb.y ?? lb.want, floor, Math.max(floor, bottom - lb.h));
        if (lb.y == null) lb.yF.snap(desired);
        else if (Math.abs(desired - lb.y) > 0.5) lb.yF.to(desired, 300, "out");
        lb.y = desired;
        floor = desired + lb.h + 8;
      }
    }
    for (const [wid, lb] of Object.entries(this.labels)) if (!want.some((w) => w.wid === wid) && !lb.sw.on) lb.y = null;
  },

  hit(x, y) {
    if (x < 0 || this.L) return null;
    let best = null;
    for (const w of this.drawn ?? []) if (w.share > 0 && inQuad([x, y], w.px) && (!best || w.area > best.area)) best = w;
    return best?.wid ?? null;
  },
  hover(x, y, ctx) {
    const w = this.hit(x, y);
    if (w !== this.hovered) {
      this.hovered = w;
      ctx.canvas.style.cursor = w ? "pointer" : "";
      ctx.canvas.dataset.verb = w ? ctx.data.theme.cursor?.verbs?.art ?? "Lift" : "";
      ctx.emit("art:hover", { id: w });
    }
  },

  // ——— the lift ———
  order(ctx) {
    const here = (this.logicalList ?? this.drawn ?? []).filter((w) => w.share > 0.3).sort((a, b) => centroid(a.px)[0] - centroid(b.px)[0]).map((w) => w.wid);
    const rest = Object.entries(this.works).sort((a, b) => String(a[1].n ?? a[0]).localeCompare(String(b[1].n ?? b[0]))).map(([k]) => k).filter((k) => !here.includes(k));
    return [...here, ...rest];
  },

  /** the upright rectangle a work lands in (desktop: max 62svh tall, centred, the facts at its left; phone: full width) */
  target(wid, ctx) {
    const w = this.works[wid], im = this.img[wid], vw = ctx.stage.vw, vh = ctx.stage.vh;
    const sz = w.size?.map(parseFloat);
    let a = sz && sz[0] > 0 && sz[1] > 0 ? sz[1] / sz[0] : im ? im.naturalWidth / im.naturalHeight : 1;
    if (w.kind === "object" && im) a = im.naturalWidth / im.naturalHeight;
    if (ctx.phone) {
      let ww = vw - 32, hh = ww / a;
      if (hh > vh * 0.46) { hh = vh * 0.46; ww = hh * a; }
      return { x: (vw - ww) / 2, y: 76, w: ww, h: hh };
    }
    let hh = vh * 0.62, ww = hh * a;
    if (ww > vw * 0.48) { ww = vw * 0.48; hh = ww / a; }
    const cx = Math.max(vw / 2, 40 + 300 + 48 + ww / 2);
    return { x: cx - ww / 2, y: (vh - hh) / 2, w: ww, h: hh };
  },

  /** where a work is on the stage right now: its quad (paintings) or its box (objects), screen px; `list` is the drawn
   *  quads (paint) or, by default, the logical ones (step: the wanted frame, which ?record draws) */
  fromOf(wid, ctx, list = this.logicalList ?? this.drawn) {
    const w = this.works[wid];
    if (w.kind === "object" && Array.isArray(w.box)) {
      const here = ctx.state?.stop ?? (ctx.state?.kind === "end" ? ctx.state.last : null);
      if (w.stop && here !== w.stop) return null;
      const [x, y, bw, bh] = w.box;
      return { px: [[x, y], [x + bw, y], [x + bw, y + bh], [x, y + bh]].map((p) => ctx.toScreen(p)), q: null, norm: 1 };
    }
    const q = (list ?? []).find((d) => d.wid === wid && d.share > 0);
    return q ? { px: q.px, q: q.q, norm: q.norm } : null;
  },

  lift(wid, ctx, { force = false } = {}) {
    if (!this.on || !this.works[wid]) return;
    if (!force && !ctx.atRest(300)) return;
    if (this.L?.wid === wid && !this.L.closing) return;
    if (this.L && !this.L.closing) return this.swap(wid, ctx);
    const from = this.fromOf(wid, ctx);
    const fly = Boolean(from) && !ctx.reduced;
    this.L = { wid, from, fly, f: new ctx.Fade(ctx.clock, 0).to(1, fly ? 700 : 250, fly ? "inout" : "linear"), facts: new ctx.Switch(ctx.clock, false), closing: false, t0: ctx.clock.now() };
    this.L.facts.set(true);
    this.Lold = null;
    this.fill(wid, ctx);
    if (!this.lockedHere) { this.lockedHere = true; ctx.lockScroll(true); }
    ctx.lifted = wid;
    ctx.seen.add(wid);
    ctx.emit("lift", { id: wid });
    ctx.invalidate();
    if (!ctx.record) requestAnimationFrame(() => this.closeBtn.focus({ preventScroll: true }));
  },

  /** previous / next: cross-fade 300 ms to the neighbouring work, without landing first */
  swap(wid, ctx) {
    const old = this.L;
    old.f = new ctx.Fade(ctx.clock, 1).to(0, 300, "linear");
    old.fly = false; old.closing = true;
    this.Lold = old;
    this.L = { wid, from: this.fromOf(wid, ctx), fly: false, f: new ctx.Fade(ctx.clock, 0).to(1, 300, "linear"), facts: new ctx.Switch(ctx.clock, false), closing: false, swapped: true };
    this.L.facts.set(true);
    this.fill(wid, ctx);
    ctx.lifted = wid;
    ctx.seen.add(wid);
    ctx.emit("lift", { id: wid });
    ctx.invalidate();
  },
  step2(dir, ctx) {
    if (!this.L) return;
    const o = this.order(ctx), i = o.indexOf(this.L.wid);
    const next = o[(i + dir + o.length) % o.length];
    if (next && next !== this.L.wid) this.swap(next, ctx);
  },

  unlift(ctx) {
    const L = this.L;
    if (!L || L.closing) return;
    L.from = this.fromOf(L.wid, ctx);
    L.fly = Boolean(L.from) && !ctx.reduced;
    L.closing = true;
    L.f.to(0, L.fly ? 520 : 250, L.fly ? "inout" : "linear");
    L.facts.set(false);
    ctx.emit("unlift", { id: L.wid });
    ctx.invalidate();
  },

  /** the facts column and the year for a work */
  fill(wid, ctx) {
    const w = this.works[wid];
    const sz = w.size?.map(parseFloat) ?? [];
    const bar = sz[1] > 0 ? Math.max(4, Math.round((sz[1] / 100) * 24)) : 0;
    const rows = [["Year", w.year], ["Medium", w.medium], ["Size", w.size?.length ? `${bar ? `<i class="ta-bar" style="width:${bar}px"></i>` : ""}<em class="t-num">${esc(w.size.join(" × "))} cm</em>` : null, true]].filter((r) => r[1]);
    const enquire = !w.price || /enquire/i.test(w.price);
    this.facts.innerHTML = `<div class="tl-clip"><h2 class="tl-title tl-ln">${rich(w.title ?? wid)}</h2></div>`
      + rows.map(([k, v, raw]) => `<div class="tl-clip"><div class="tl-row tl-ln"><span class="tl-k t-label">${esc(k)}</span><span class="tl-v">${raw ? v : rich(v)}</span></div></div>`).join("")
      + `<div class="tl-clip"><div class="tl-row tl-ln"><span class="tl-k t-label">${enquire ? "Price" : "Price"}</span>${enquire ? `<a class="tl-enquire" href="#" data-verb="Open">Enquire</a>` : `<span class="tl-v t-num">${rich(w.price)}</span>`}</div></div>`
      + `<div class="tl-clip"><div class="tl-nav tl-ln"><button type="button" class="tl-prev">previous</button><i class="tl-rule"></i><button type="button" class="tl-next">next</button></div></div>`;
    this.facts.querySelector(".tl-prev").addEventListener("click", () => this.step2(-1, ctx));
    this.facts.querySelector(".tl-next").addEventListener("click", () => this.step2(1, ctx));
    this.facts.querySelector(".tl-enquire")?.addEventListener("click", (e) => { e.preventDefault(); this.unlift(ctx); ctx.go(w.enquire ?? "end"); });
    this.factLines = [...this.facts.querySelectorAll(".tl-ln")];
    this.year.innerHTML = esc(w.year ?? "");
    this.side.innerHTML = rich(w.caption ?? w.wall ?? "");
    this.liftEl.style.setProperty("--tint", w.tint ?? "var(--paper)");
    this.liftEl.style.setProperty("--tint-ink", w.tintInk ?? "var(--ink-2)");
    this.liftEl.setAttribute("aria-label", plain(w.title ?? wid));
    this.yearW = null;
  },

  // ——— paint ———
  paint(s, ctx) {
    if (!this.on) return;
    this.paintLabels(s, ctx);
    this.paintLift(s, ctx);
  },

  paintLabels(s, ctx) {
    if (!this.wall) return;
    const vw = ctx.stage.vw, margin = ctx.margin;
    for (const [wid, lb] of Object.entries(this.labels)) {
      const on = lb.sw.on, age = lb.sw.age;
      const a = (on ? ease.out(clamp(age / 200)) : 1 - ease.in(clamp(age / 200))) * lb.flip.value;
      const q = (this.drawn ?? []).find((w) => w.wid === wid);
      let css = "off";
      if (a > 0.001 && (on || age < 200) && lb.yF) {
        const y = lb.yF.value, x = lb.side === "left" ? margin : vw - margin - lb.w;
        css = `${x.toFixed(1)}|${y.toFixed(1)}|${a.toFixed(3)}`;
        if (q) {
          // the nearer top corner (a phone's low label: the nearer bottom corner)
          const c = lb.low && ctx.phone ? q.px[3] : lb.side === "left" ? q.px[0] : q.px[1];
          const ax = lb.side === "left" ? x + lb.w + 8 : x - 8, ay = y + 11;
          lb.line.setAttribute("x1", c[0].toFixed(1)); lb.line.setAttribute("y1", c[1].toFixed(1));
          lb.line.setAttribute("x2", ax.toFixed(1)); lb.line.setAttribute("y2", ay.toFixed(1));
          lb.line.style.opacity = a.toFixed(3);
          lb.line.style.display = "";
        } else lb.line.style.display = "none";
      } else lb.line.style.display = "none";
      if (css === lb.css) continue;
      lb.css = css;
      if (css === "off") { lb.e.style.visibility = "hidden"; lb.e.style.pointerEvents = "none"; continue; }
      const [x, y, al] = css.split("|");
      lb.e.style.visibility = "visible";
      lb.e.style.pointerEvents = +al > 0.5 ? "auto" : "none";
      lb.e.style.opacity = al;
      lb.e.style.transform = `translate(${x}px, ${y}px)`;
      lb.e.dataset.side = lb.side;
    }
  },

  paintLift(s, ctx) {
    const L = this.L;
    if (!L && !this.Lold) {
      if (this.liftShown) { this.liftShown = false; this.liftEl.style.visibility = "hidden"; this.lr.clear(); }
      return;
    }
    this.liftShown = true;
    const el_ = this.liftEl;
    el_.style.visibility = "visible";
    const e = L ? L.f.value : 0;
    // the tint follows the flight (to 96 %); it stays while previous / next cross-fade
    this.tint.style.opacity = (0.96 * (L?.swapped && !L.closing ? 1 : e)).toFixed(3);
    el_.style.pointerEvents = L && !L.closing ? "auto" : "none";
    // the work(s)
    const lr = this.lr;
    if (lr.ok) {
      lr.clear();
      const vw = ctx.stage.vw, vh = ctx.stage.vh;
      const lights = this.lights ?? { lights: [], masks: [], texel: [1 / 1600, 1 / 900] };
      const draw = (X, alphaMul = 1) => {
        if (!X) return;
        const t = this.target(X.wid, ctx), k = X.f.value;
        const rect = [[t.x, t.y], [t.x + t.w, t.y], [t.x + t.w, t.y + t.h], [t.x, t.y + t.h]];
        const from = X.fly ? this.fromOf(X.wid, ctx, this.drawn) ?? X.from : X.from;
        const object = this.works[X.wid].kind === "object";
        let corners = rect, light = 0, maskMix = 0, alpha = k * alphaMul;
        if (X.fly && from) {
          corners = rect.map((p, i) => [lerp(from.px[i][0], p[0], k), lerp(from.px[i][1], p[1], k)]);
          light = object ? 0 : 1 - k; maskMix = object ? 0 : 1 - k; alpha = alphaMul;
        }
        this.lgl.draw({ img: this.img[X.wid], corners, wall: from?.q ?? null, lights: light > 0 ? lights.lights : [], masks: lights.masks, norm: from?.norm ?? 0.36,
          light, maskMix, alpha, clip: [0, 0, vw, vh], radius: 0, soft: 0.3 * (1 - k), texel: lights.texel });
      };
      if (this.Lold) draw(this.Lold);
      draw(L);
    }
    // facts, year, side caption (from 200 ms)
    if (L) {
      const t = this.target(L.wid, ctx);
      const facts = L.facts, age = facts.on ? facts.age : 0;
      const fo = facts.on ? 1 : 1 - ease.in(clamp(facts.age / 200));
      const rise = ctx.rise(56);
      this.factLines.forEach((ln, i) => {
        const k = facts.on ? ease.out(clamp((age - (L.swapped ? 0 : 200) - 80 * i) / 900)) : fo;
        ln.style.opacity = k.toFixed(3);
        ln.style.transform = rise && k < 1 && facts.on ? `translateY(${(rise * (1 - k)).toFixed(1)}px)` : "";
      });
      if (ctx.phone) {
        this.facts.style.transform = `translate(16px, ${(t.y + t.h + 24).toFixed(0)}px)`;
        this.facts.style.width = `${ctx.stage.vw - 32}px`;
      } else {
        this.facts.style.transform = `translate(40px, ${(t.y + 8).toFixed(0)}px)`;
        this.facts.style.width = `${Math.max(240, t.x - 88).toFixed(0)}px`;
      }
      const yk = facts.on ? ease.out(clamp((age - 200) / 900)) : fo;
      if (this.yearW == null) this.yearW = this.year.offsetWidth;
      this.year.style.opacity = yk.toFixed(3);
      this.year.style.transform = `translate(${(t.x + t.w - this.yearW / 2).toFixed(0)}px, ${(t.y + t.h * 0.5).toFixed(0)}px) translateY(-50%)`;
      this.side.style.opacity = yk.toFixed(3);
      this.side.style.transform = `translate(${(t.x - 14).toFixed(0)}px, ${(t.y + t.h).toFixed(0)}px) rotate(-90deg)`;
      this.closeBtn.style.opacity = fo.toFixed(3);
    }
  },

  reset(ctx) {
    if (!this.on) return;
    for (const lb of Object.values(this.labels)) { lb.sw = new ctx.Switch(ctx.clock, false); lb.y = null; lb.css = ""; lb.yF.snap(0); lb.flip.snap(1); }
    if (this.L || this.Lold) { this.L = null; this.Lold = null; this.liftEl.style.visibility = "hidden"; this.liftShown = false; this.lr.clear(); }
    if (this.lockedHere) { this.lockedHere = false; ctx.lockScroll(false); }
    ctx.lifted = null; ctx.inView = null;
  },
};

const centroid = (px) => [px.reduce((a, p) => a + p[0], 0) / px.length, px.reduce((a, p) => a + p[1], 0) / px.length];
