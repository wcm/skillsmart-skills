// Tracked tags (design-system.md 4.8: level 2, labels that follow an object while you walk).
//
//   moves.*.tags: [{ id, text, offset: [dx, dy], track: "tracks/move-2a.json#coping" | [one per clip], keys, from, to }]
//
// A tag is the site's label face on a small plate (--plate at 80 %, --radius-plate), no dot, no line, 12 px right of
// and 12 px above its point plus its own offset; in brackets where the site owns them. The point comes from a tracks
// file (tools/track.py, 8.4: one [x, y, q] or null per SOURCE frame, clip pixels), read at the source frame of the
// picture the stage actually drew (ctx.view: the nearest loaded frame, fractional while ?record blends), so the tag
// stays glued to the frame on screen. A multi-clip move lists one track per clip. Without a track, `keys`
// [[t, x, y], …] (frame fractions, linear in move t). Shown while q ≥ 0.6, hidden under 0.5 or when the point is lost
// (150 ms, linear), outside its from–to window (default 0.08–0.92 of the move) and faded within 3 % of the picture's
// edge. At most 3 on screen.

import { el, rich, clamp, lerp } from "../util.js";

const MAX = 3;

export const tags = {
  name: "tags",

  mount(ctx) {
    const d = ctx.data;
    this.layer = el("div", "tour-tags");
    ctx.ui.append(this.layer);
    this.items = [];
    const files = new Map();
    const want = (url) => {
      if (!files.has(url)) files.set(url, fetch(ctx.base + url).then((r) => (r.ok ? r.json() : null)).catch(() => null));
      return files.get(url);
    };
    const jobs = [];
    for (const [mid, m] of Object.entries(d.moves)) (m.tags ?? []).forEach((t, order) => {
      if (!t?.id) return;
      const e = el("div", "tg t-label", rich(ctx.label(t.text ?? t.id)), { "data-tag": t.id, "aria-hidden": "true" });
      this.layer.append(e);
      const tracks = (Array.isArray(t.track) ? t.track : t.track ? [t.track] : []).map((ref) => {
        const [url, name] = String(ref).split("#");
        return { url, name, data: null };
      });
      const it = { mid, t, order, e, tracks, f: new ctx.Fade(ctx.clock, 0), shown: false, css: "" };
      for (const tr of tracks) jobs.push(want(tr.url).then((j) => {
        if (!j) { console.warn(`[tour] moves.${mid}.tags "${t.id}": no tracks file at ${tr.url}`); return; }
        const pts = j.points?.[tr.name];
        if (!pts) console.warn(`[tour] moves.${mid}.tags "${t.id}": ${tr.url} has no point "${tr.name}"`);
        tr.data = { size: j.size ?? [1920, 1080], pts: pts ?? [] };
      }));
      this.items.push(it);
    });
    this.ready = Promise.all(jobs).then(() => ctx.invalidate());
  },

  /** the tag's point (frame fractions) and quality at the frame on screen (paint), or at the wanted frame (step, so
   *  ?record replays decide the same way: in ?record the wanted frame is the drawn one) */
  pointOf(it, s, ctx, logical = false) {
    const g = ctx.tl.moves[it.mid];
    let v, t;
    if (logical) {
      const f = s.move?.frame;
      v = f ? { move: s.seg.id, clip: f.clip, src: f.src } : null;
      t = s.move?.t ?? 0;
    } else { v = ctx.state?.view ?? ctx.view; t = ctx.viewT(); }
    const from = it.t.from ?? 0.08, to = it.t.to ?? 0.92;
    if (t < from || t > to) return { pt: null, q: 0, t };
    if (it.tracks.length && v && v.move === it.mid) {
      const tr = it.tracks[v.clip] ?? (g.clips.length === 1 ? it.tracks[0] : null);
      if (!tr?.data) return { pt: null, q: 0, t };
      const P = tr.data.pts, a = Math.floor(v.src), b = Math.min(P.length - 1, a + 1), f = v.src - a;
      const A = P[a], B = P[b] ?? A;
      if (!A || !B) return { pt: null, q: 0, t };
      const [W, H] = tr.data.size;
      return { pt: [lerp(A[0], B[0], f) / W, lerp(A[1], B[1], f) / H], q: Math.min(A[2] ?? 1, B[2] ?? 1), t };
    }
    const keys = it.t.keys;
    if (keys?.length) {
      let pt;
      if (t <= keys[0][0]) pt = [keys[0][1], keys[0][2]];
      else {
        pt = [keys[keys.length - 1][1], keys[keys.length - 1][2]];
        for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
          const [t0, x0, y0] = keys[i - 1], [t1, x1, y1] = keys[i], k = (t - t0) / (t1 - t0 || 1);
          pt = [lerp(x0, x1, k), lerp(y0, y1, k)];
          break;
        }
      }
      return { pt, q: 1, t };
    }
    return { pt: null, q: 0, t };
  },

  step(s, ctx) {
    // the shown/hidden switch uses the wanted frame here; paint() re-reads the drawn frame for the position
    let n = 0;
    for (const it of this.items) {
      const active = s.kind === "move" && s.seg.id === it.mid;
      let want = false;
      if (active) {
        const { pt, q } = this.pointOf(it, s, ctx, true);
        // hysteresis: in at q ≥ 0.6, out under 0.5 (4.8)
        want = Boolean(pt) && (it.shown ? q >= 0.5 : q >= 0.6);
        it.pt = pt;
      }
      if (want && n >= MAX) want = false;
      if (want) n++;
      if (want !== it.shown) { it.shown = want; it.f.to(want ? 1 : 0, 150, "linear"); }
    }
  },

  paint(s, ctx) {
    const R = ctx.map?.R;
    if (!R) return;
    for (const it of this.items) {
      const a0 = it.f.value;
      let css = "hidden";
      if (a0 > 0.001 && s.kind === "move" && s.seg.id === it.mid) {
        const { pt } = this.pointOf(it, s, ctx);
        const p = pt ?? it.last;
        if (p) {
          it.last = p;
          const [x, y] = ctx.toScreen(p);
          // fade within 3 % of the picture's edge
          const ex = Math.min(x - R.x, R.x + R.w - x) / R.w, ey = Math.min(y - R.y, R.y + R.h - y) / R.h;
          const edge = clamp(Math.min(ex, ey) / 0.03);
          const a = a0 * edge;
          const [ox, oy] = it.t.offset ?? [0, 0];
          css = `${(x + 12 + ox).toFixed(1)}|${(y - 12 + oy).toFixed(1)}|${a.toFixed(3)}`;
        }
      }
      if (css === it.css) continue;
      it.css = css;
      if (css === "hidden") { it.e.style.visibility = "hidden"; continue; }
      const [x, y, a] = css.split("|");
      it.e.style.visibility = +a <= 0.001 ? "hidden" : "visible";
      it.e.style.opacity = a;
      it.e.style.transform = `translate(${x}px, ${y}px) translateY(-100%)`;
    }
  },

  reset(ctx) { for (const it of this.items) { it.f.snap(0); it.shown = false; it.css = ""; it.last = null; } },
};
