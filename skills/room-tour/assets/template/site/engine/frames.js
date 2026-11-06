// A clip's WebP frame sequence as tools/frames.py writes it: <dir>/0001.webp … + manifest.json
//   { count, fps, pattern: "{n}.webp", pad: 4, size: [w, h], src: { fps, count, size }, map: [source frame of each web frame] }
// Ideas from eclate/site/engine/frames.js: frames load coarse to fine across every clip at once (every 8th frame of each,
// then every 4th, 2nd, the rest), the frame the page wants next jumps the queue, and nearest(i) returns the nearest frame
// that has loaded, so fast scrolling never flashes blank. onframe(i) fires as each arrives (the stage repaints when it is
// nearer the wanted one than the frame on screen). ensure(i) loads and decodes one frame exactly (record mode).
// Keyed sets (frames.py --key) also carry a canvas mask per web frame (manifest `mask`: "mask/{n}.webp"); once
// something asks for masks (seq.wantMasks = true: the art layer), each frame's mask loads right after its frame, and
// mask(i) / ensureMask(i) work like nearest(i) / ensure(i).

import { warn } from "./util.js";

export class FrameSeq {
  /** fetches `<dir>/manifest.json`; null (and a warning) when the set is missing */
  static async load(dir) {
    try {
      const res = await fetch(`${dir}/manifest.json`);
      if (!res.ok) { warn(`no frames at ${dir} (manifest.json: ${res.status})`); return null; }
      return new FrameSeq(dir, await res.json());
    } catch (e) {
      warn(`no frames at ${dir} (${e.message})`);
      return null;
    }
  }

  constructor(dir, m) {
    this.dir = dir;
    this.meta = m;
    this.count = m.count;
    this.size = m.size ?? [1600, 900];
    this.src = m.src ?? { fps: m.fps ?? 12, count: m.count, size: this.size };
    this.map = Array.isArray(m.map) && m.map.length === m.count ? m.map : Array.from({ length: m.count }, (_, i) => i);
    /** the clip's length in source seconds (design-system.md 5.5: src.count / src.fps) */
    this.duration = this.src.count / this.src.fps;
    this.onframe = null;
    this.wanted = null;
    const pad = m.pad ?? 4, pattern = m.pattern ?? "{n}.webp";
    this.maskSrc = typeof m.mask === "string" ? (i) => `${dir}/${m.mask.replace("{n}", String(i + 1).padStart(pad, "0"))}` : null;
    this.masks = this.maskSrc ? new Array(m.count).fill(null) : null;
    this.wantMasks = false;
    this.images = Array.from({ length: m.count }, (_, i) => {
      const im = new Image();
      im.decoding = "async";
      im._src = `${dir}/${pattern.replace("{n}", String(i + 1).padStart(pad, "0"))}`;
      im._i = i;
      return im;
    });
  }

  ok(i) { const im = this.images[i]; return Boolean(im?.complete && im.naturalWidth > 0 && im._loaded); }

  _start(i) {
    const im = this.images[i];
    if (im._asked) return im._promise;
    im._asked = true;
    im._promise = new Promise((done) => {
      im.onload = () => { im._loaded = true; if (this.wantMasks) this._mask(i); this.onframe?.(i); done(im); };
      im.onerror = () => { im._failed = true; done(null); };
    });
    im.src = im._src;
    return im._promise;
  }

  /** the canvas mask of web frame i (loads it once); a promise of the image or null */
  _mask(i) {
    if (!this.masks) return Promise.resolve(null);
    let e = this.masks[i];
    if (!e) {
      const im = new Image();
      im.decoding = "async";
      e = this.masks[i] = { im, ok: false, p: null };
      e.p = new Promise((done) => {
        im.onload = () => { e.ok = true; this.onframe?.(i); done(im); };
        im.onerror = () => { e.failed = true; done(null); };
      });
      im.src = this.maskSrc(i);
    }
    return e.p;
  }
  /** the mask of frame i if it has loaded, else the nearest loaded one within 2 frames, else null (asks for i) */
  mask(i) {
    if (!this.masks) return null;
    i = Math.max(0, Math.min(this.count - 1, Math.round(i)));
    if (!this.masks[i]) this._mask(i);
    for (const j of [i, i - 1, i + 1, i - 2, i + 2]) if (this.masks[j]?.ok) return this.masks[j].im;
    return null;
  }
  /** loads and decodes mask i exactly (record mode) */
  async ensureMask(i) {
    if (!this.masks) return null;
    i = Math.max(0, Math.min(this.count - 1, i));
    const im = await this._mask(i);
    if (im && !im._decoded) { try { await im.decode(); } catch { /* fine */ } im._decoded = true; }
    return im;
  }

  /** the nearest loaded frame to i (asking for i to load next), or -1 */
  nearest(i) {
    i = Math.max(0, Math.min(this.count - 1, Math.round(i)));
    if (this.ok(i)) return i;
    if (!this.images[i]._asked) this.wanted = i;
    for (let d = 1; d < this.count; d++) {
      if (this.ok(i - d)) return i - d;
      if (this.ok(i + d)) return i + d;
    }
    return -1;
  }

  /** loads and decodes frame i exactly (record mode: no stand-ins) */
  async ensure(i) {
    i = Math.max(0, Math.min(this.count - 1, i));
    const im = await this._start(i);
    if (!im) return null;
    if (!im._decoded) { try { await im.decode(); } catch { /* decoded on upload instead */ } im._decoded = true; }
    return im;
  }

  /** the fractional web frame for a fractional source frame (through manifest.map) */
  webAt(src) {
    const m = this.map, n = m.length;
    if (src <= m[0]) return 0;
    if (src >= m[n - 1]) return n - 1;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (m[mid] <= src) lo = mid; else hi = mid; }
    return lo + (src - m[lo]) / (m[hi] - m[lo] || 1);
  }
  /** the source frame of a (fractional) web frame */
  srcAt(web) {
    const i = Math.max(0, Math.min(this.count - 1, web)), a = Math.floor(i), b = Math.min(this.count - 1, a + 1);
    return this.map[a] + (this.map[b] - this.map[a]) * (i - a);
  }

  /** every frame of `seqs`, coarse to fine across all of them; a wanted frame jumps the queue; `lanes` at once */
  static preload(seqs, lanes = 8, first = []) {
    seqs = seqs.filter(Boolean);
    const order = [];
    const add = (s, i) => { if (s && i >= 0 && i < s.count && !s.images[i]._queued) { s.images[i]._queued = true; order.push([s, i]); } };
    for (const [s, i] of first) add(s, i);
    // each clip's first and last frames early: the stops show them
    for (const s of seqs) { add(s, 0); add(s, s.count - 1); }
    for (const step of [8, 4, 2, 1]) for (const s of seqs) for (let i = 0; i < s.count; i += step) add(s, i);
    let next = 0;
    const take = () => {
      for (const s of seqs) if (s.wanted != null) { const i = s.wanted; s.wanted = null; if (!s.images[i]._asked) return [s, i]; }
      while (next < order.length) { const [s, i] = order[next++]; if (!s.images[i]._asked) return [s, i]; }
      return null;
    };
    const lane = async () => {
      for (let job = take(); job; job = take()) {
        const [s, i] = job;
        const im = await s._start(i);
        // decode off the main thread now, so the stage's texture upload doesn't stall a scroll later
        if (im && !im._decoded) im.decode().then(() => { im._decoded = true; }, () => {});
      }
    };
    return Promise.all(Array.from({ length: lanes }, lane));
  }
}
