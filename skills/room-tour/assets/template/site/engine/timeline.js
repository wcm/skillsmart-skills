// The walk as scroll segments and as a recording timeline (design-system.md 5.5 and 6).
//
// Scroll: p runs 0–1 over S screens = every segment of the walk + the end (theme.end.screens). The first stop is the
// "title" segment (0 screens by default: the first scroll starts move 1). A move gets 0.3 screens per source second
// (or moves.*.screens), a stop 0.45, a cut 0.9. Inside a move, frames map linearly to scroll; a move's t (0–1) is
// source seconds elapsed ÷ the total source seconds of its clips, and each clip gets screens in proportion.
//
// Recording: the title held record.hold (0.9 s), moves at source seconds ÷ record.speed (1.1) or moves.*.rec, stops
// held record.hold, cuts in cuts.*.rec (1.4 s), beats inserted at their stop (they add time, not scroll), then the end
// (record.end, 4 s).

import { clamp, lerp, ease, warn } from "./util.js";

const ACT = { open: 0.48, lift: 0.7, swatch: 0.3, add: 0.5, hover: 0.18 };
/**
 * How long a beat takes in the recording (6.3): the cursor's arc (0.6 s), a rest (0.25), the click (0.18), the action,
 * the hold; a `then` repeats the reach and action and holds 0.6 s; `close` (open and lift only) moves to × (0.5 s),
 * clicks and plays the close (card 0.28 s, lift 0.52 s). `beat.duration` overrides all of it.
 */
export function beatDuration(b) {
  if (b.duration != null) return b.duration;
  const reach = 0.6 + 0.25 + 0.18;
  let d = reach + (ACT[b.do] ?? 0.4) + (b.hold ?? 1.2);
  if (b.then) d += reach + (ACT[b.then] ?? 0.4) + 0.6;
  if (b.close !== false && (b.do === "open" || b.do === "lift")) d += 0.5 + 0.18 + (b.do === "lift" ? 0.52 : 0.28);
  return d;
}

export class Timeline {
  /**
   * @param d     normalized tour.json
   * @param seqOf (clipPath) → FrameSeq | null, for the set in use (desktop, phone or -rec)
   */
  constructor(d, seqOf) {
    this.d = d;
    const rec = d.record;
    this.fps = rec.fps;
    const segs = (this.segments = []);
    this.stops = {};
    this.moves = {};
    this.cuts = {};
    let s = 0, t = 0;
    const walk = d.walk;
    const beatsAt = (id) => rec.beats.filter((b) => b.at === id).map((b) => ({ ...b, dur: beatDuration(b) }));
    const placeBeats = (seg, list, t0, hold) => {
      let used = 0;
      seg.beats = list.map((b) => {
        const start = t0 + Math.min(b.after ?? 0, hold) + used;
        used += b.dur;
        return { ...b, t: [start, start + b.dur] };
      });
    };

    walk.forEach((id, i) => {
      if (i % 2 === 0) {
        const st = d.stops[id];
        const first = i === 0;
        const screens = st.screens ?? (first ? 0 : 0.45);
        const beats = beatsAt(id), tb = beats.reduce((a, b) => a + b.dur, 0);
        const seg = { id, kind: first ? "title" : "stop", index: i, ref: st, s: [s, s + screens], t: [t, t + rec.hold + tb], hold: rec.hold };
        placeBeats(seg, beats, t, rec.hold);
        segs.push(seg);
        this.stops[id] = seg;
        s += screens; t = seg.t[1];
      } else if (d.moves[id]) {
        const m = d.moves[id];
        const clips = m.clips.map((path) => ({ path, seq: seqOf(path) }));
        let total = 0;
        for (const c of clips) { c.dur = c.seq ? c.seq.duration : 0; total += c.dur; }
        if (!total) { warn(`moves.${id}: none of its clips loaded; it holds its first stop`); total = 5; }
        let acc = 0;
        for (const c of clips) { c.t0 = acc / total; acc += c.dur; c.t1 = acc / total; }
        const screens = m.screens ?? 0.3 * total;
        const recT = m.rec ?? total / rec.speed;
        const seg = { id, kind: "move", index: i, ref: m, s: [s, s + screens], t: [t, t + recT], clips, srcSeconds: total, from: walk[i - 1], to: walk[i + 1] };
        segs.push(seg);
        this.moves[id] = seg;
        s += screens; t += recT;
      } else {
        const c = d.cuts[id];
        const screens = c.screens ?? 0.9, recT = c.rec ?? 1.4;
        const seg = { id, kind: "cut", index: i, ref: c, s: [s, s + screens], t: [t, t + recT], from: walk[i - 1], to: walk[i + 1] };
        segs.push(seg);
        this.cuts[id] = seg;
        s += screens; t += recT;
      }
    });
    this.W = s;                                    // the walk's screens
    const endScreens = d.theme.end.screens ?? 1.2;
    const endBeats = beatsAt("end"), tbe = endBeats.reduce((a, b) => a + b.dur, 0);
    const end = { id: "end", kind: "end", index: walk.length, s: [s, s + endScreens], t: [t, t + rec.end + tbe], hold: rec.end };
    placeBeats(end, endBeats, t, rec.end);
    segs.push(end);
    this.end = end;
    s += endScreens; t = end.t[1];
    this.S = s;                                    // every screen of the tour (p = 1 at its end)
    this.E = endScreens;
    this.P = d.theme.end.pin ?? 0;
    for (const g of segs) g.p = [g.s[0] / (s || 1), g.s[1] / (s || 1)];
    this.duration = t;
    this.frames = Math.ceil(t * this.fps);
    this.beats = segs.flatMap((g) => g.beats ?? []).map((b) => ({ ...b, p: this.segAtTime((b.t[0] + b.t[1]) / 2).p[0] }));
    this.stopIds = walk.filter((_, i) => i % 2 === 0);
  }

  /** the segment at scroll progress p (a 0-screen title segment owns p = 0 exactly) */
  segAt(p) {
    const segs = this.segments;
    for (const g of segs) {
      if (g.p[1] === g.p[0]) { if (p === g.p[0]) return g; continue; }
      if (p >= g.p[0] && p < g.p[1]) return g;
    }
    return p <= 0 ? segs[0] : segs[segs.length - 1];
  }
  segAtTime(t) {
    for (const g of this.segments) if (t < g.t[1]) return g;
    return this.segments[this.segments.length - 1];
  }

  /**
   * p of a place on the walk: a number; a stop id (its arrival); "end"; { move, t }; { cut, k }; { stop, k }; or an
   * artwork-style { stop } / { move, t }.
   */
  pOf(target) {
    if (typeof target === "number") return clamp(target);
    if (typeof target === "string") {
      if (target === "end") return this.end.p[0];
      const g = this.stops[target] ?? this.moves[target] ?? this.cuts[target];
      if (!g) { warn(`no stop, move or cut "${target}"`); return 0; }
      return g.p[0];
    }
    if (target?.move) { const g = this.moves[target.move]; return g ? lerp(g.p[0], g.p[1], clamp(target.t ?? 0)) : 0; }
    if (target?.cut) { const g = this.cuts[target.cut]; return g ? lerp(g.p[0], g.p[1], clamp(target.k ?? 0)) : 0; }
    if (target?.stop) { const g = this.stops[target.stop]; return g ? lerp(g.p[0], g.p[1], clamp(target.k ?? 0)) : 0; }
    return 0;
  }

  /** k (0–1) of p inside a segment */
  kOf(g, p) { return g.p[1] === g.p[0] ? (p >= g.p[1] ? 1 : 0) : clamp((p - g.p[0]) / (g.p[1] - g.p[0])); }

  /** recording time t (s) → { p, seg, beat, k } (scroll progress, the segment, the running beat and its seconds) */
  recAt(t) {
    const g = this.segAtTime(t);
    const span = g.t[1] - g.t[0];
    let k = span > 0 ? clamp((t - g.t[0]) / span) : 1, beat = null;
    if (g.kind === "title" || g.kind === "stop" || g.kind === "end") {
      // the scroll moves through the stop's own screens over its hold, and stands still while a beat plays
      let e = t - g.t[0];
      for (const b of g.beats ?? []) {
        if (t >= b.t[0] && t < b.t[1]) beat = { beat: b, k: t - b.t[0] };
        e -= Math.max(0, Math.min(t, b.t[1]) - b.t[0]);
      }
      k = clamp(e / (g.hold || 1));
      if (g.kind === "end") k = ease.inout(clamp(k / 0.85));
    }
    return { p: lerp(g.p[0], g.p[1], k), seg: g, beat, k };
  }

  /** where a move's clips are at move t: the clip, its fractional source and web frames, and the join to the next clip */
  frameAt(moveId, t) {
    const g = this.moves[moveId];
    if (!g) return null;
    const clips = g.clips;
    let k = clips.findIndex((c) => c.seq && t <= c.t1);
    if (k < 0) k = clips.length - 1;
    const c = clips[k];
    if (!c?.seq) return null;
    const at = (cl, tt, minWeb = 0) => {
      const u = cl.t1 > cl.t0 ? clamp((tt - cl.t0) / (cl.t1 - cl.t0)) : 0;
      const src = u * (cl.seq.src.count - 1);
      return { clip: clips.indexOf(cl), path: cl.path, seq: cl.seq, u, src, web: Math.max(minWeb, cl.seq.webAt(src)) };
    };
    // clip N+1 never shows its first web frame (it repeats clip N's last); the last 2 web frames of N cross-fade
    // with the first 2 of N+1, driven by scroll (3.1)
    const minWeb = k > 0 && clips[k - 1]?.seq ? 1 : 0;
    const here = at(c, t, minWeb);
    const span = (cl, a, b) => ((cl.seq.map[b] - cl.seq.map[a]) / Math.max(1, cl.seq.src.count - 1)) * (cl.t1 - cl.t0);
    for (const [A, B] of [[clips[k - 1], c], [c, clips[k + 1]]]) {
      if (!A?.seq || !B?.seq || A.seq.count < 3 || B.seq.count < 3) continue;
      const b = A.t1, da = span(A, A.seq.count - 2, A.seq.count - 1), db = span(B, 0, 2);
      if (t >= b - da && t <= b + db && da + db > 0) {
        const fa = at(A, Math.min(t, b)), fb = at(B, Math.max(t, b), 1);
        return { ...fa, join: { ...fb, mix: clamp((t - (b - da)) / (da + db)) } };
      }
    }
    return here;
  }

  /** the picture a stop shows (3.1): stops.*.frame, else the incoming move's last frame, else the next move's first */
  stopPic(id) {
    const st = this.d.stops[id], walk = this.d.walk, i = walk.indexOf(id);
    const resolve = (ref) => {
      const [name, which] = ref.split(":");
      let clips = this.moves[name]?.clips;
      if (!clips) for (const g of Object.values(this.moves)) { const c = g.clips.find((x) => x.path === name); if (c) { clips = [c]; break; } }
      if (!clips) return null;
      const c = which === "last" ? [...clips].reverse().find((x) => x.seq) : clips.find((x) => x.seq);
      if (!c) return null;
      return { seq: c.seq, path: c.path, web: which === "last" ? c.seq.count - 1 : 0, src: which === "last" ? c.seq.src.count - 1 : 0 };
    };
    if (st?.frame) { const r = resolve(st.frame); if (r) return r; }
    const before = walk[i - 1], after = walk[i + 1];
    if (before && this.moves[before]) { const r = resolve(`${before}:last`); if (r) return r; }
    if (after && this.moves[after]) { const r = resolve(`${after}:first`); if (r) return r; }
    if (before && this.cuts[before]?.ref?.sheet) { const r = resolve(this.cuts[before].ref.sheet); if (r) return r; }
    return null;
  }

  /** the picture a cut's sheet shows (cuts.*.sheet, else the next stop's picture) */
  sheetPic(cutId) {
    const g = this.cuts[cutId];
    if (!g) return null;
    if (g.ref.sheet) {
      const [name, which] = g.ref.sheet.split(":");
      for (const m of Object.values(this.moves)) {
        const c = m.id === name ? (which === "last" ? m.clips[m.clips.length - 1] : m.clips[0]) : m.clips.find((x) => x.path === name);
        if (c?.seq) return { seq: c.seq, path: c.path, web: which === "last" ? c.seq.count - 1 : 0, src: which === "last" ? c.seq.src.count - 1 : 0 };
      }
    }
    return this.stopPic(g.to);
  }

  /** what window.tour.timeline shows */
  toJSON() {
    const r3 = (x) => Math.round(x * 1000) / 1000;
    return {
      screens: r3(this.S), walk: r3(this.W), end: r3(this.E), pin: this.P,
      duration: r3(this.duration), fps: this.fps, frames: this.frames,
      segments: this.segments.map((g) => ({ id: g.id, kind: g.kind, p: g.p.map(r3), screens: g.s.map(r3), t: g.t.map(r3),
        ...(g.kind === "move" ? { clips: g.clips.map((c) => ({ path: c.path, t: [r3(c.t0), r3(c.t1)], seconds: r3(c.dur) })) } : {}) }))
        .concat(this.beats.map((b) => ({ id: `${b.at}:${b.do}:${b.target}`, kind: "beat", p: [r3(b.p), r3(b.p)], t: b.t.map(r3) })))
        .sort((a, b) => a.t[0] - b.t[0] || (a.kind === "beat") - (b.kind === "beat")),
      beats: this.beats.map((b) => ({ at: b.at, do: b.do, target: b.target, hold: b.hold, then: b.then ?? null, close: b.close !== false, t: b.t.map(r3), p: r3(b.p) })),
    };
  }
}
