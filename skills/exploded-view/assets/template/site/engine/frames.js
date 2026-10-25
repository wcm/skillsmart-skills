// A numbered WebP sequence described by manifest.json (from tools/build.mjs). get() returns the nearest frame that has
// loaded, so fast scrolling never flashes blank, and asks for the frame it wanted to come next.
export class FrameSeq {
  static async load(dir) {
    const res = await fetch(`${dir}/manifest.json`);
    if (!res.ok) return null;
    return new FrameSeq(dir, await res.json());
  }

  constructor(dir, m) {
    this.meta = m;
    this.count = m.count;
    this.crop = m.crop;   // where every frame sits in the stage, in stage pixels
    this.onframe = null;  // called with a frame's index as it arrives (the page repaints if it's nearer the one shown)
    this.wanted = null;   // a frame get() wanted and didn't have: the next one to load
    const name = (n) => `${dir}/` + m.pattern.replace("{n}", String(n).padStart(m.pad, "0"));
    this.images = Array.from({ length: m.count }, (_, i) => { const im = new Image(); im.decoding = "async"; im._src = name(i + 1); return im; });
    const first = this.images[0];
    this.first = new Promise((r) => { first.onload = () => { r(); this.onframe?.(0); }; first.onerror = r; });
    first._asked = true;
    first.src = first._src;
  }

  // Loads every frame of the given sequences, coarse to fine across all of them: every 8th frame of each, then every
  // 4th, every 2nd, the rest. So both clips play, roughly, moments after the page opens, and fill in after (one clip
  // after the other left the second without frames for a long while on a slow connection). A frame the page has just
  // asked for jumps the queue. Eight load at once.
  static preload(seqs, lanes = 8) {
    seqs = seqs.filter(Boolean);
    const order = [];
    for (const step of [8, 4, 2, 1]) for (const s of seqs) for (let i = 0; i < s.count; i += step) {
      if (!s.images[i]._queued) { s.images[i]._queued = true; order.push([s, i]); }
    }
    let next = 0;
    const take = () => {
      for (const s of seqs) if (s.wanted != null) { const i = s.wanted; s.wanted = null; if (!s.images[i]._asked) return [s, i]; }
      while (next < order.length) { const [s, i] = order[next++]; if (!s.images[i]._asked) return [s, i]; }
      return null;
    };
    const lane = () => new Promise((done) => {
      const go = () => {
        const job = take();
        if (!job) return done();
        const [s, i] = job, im = s.images[i];
        im._asked = true;
        im.onload = () => { s.onframe?.(i); go(); };
        im.onerror = go;
        im.src = im._src;
      };
      go();
    });
    return Promise.all(Array.from({ length: lanes }, lane));
  }

  // this sequence on its own
  preload() { return (this.all ??= FrameSeq.preload([this])); }

  ok(im) { return im?.complete && im.naturalWidth > 0; }

  // the index of the nearest frame to i that has loaded, or -1
  nearest(i) {
    i = Math.max(0, Math.min(this.count - 1, i));
    if (!this.ok(this.images[i]) && !this.images[i]._asked) this.wanted = i;
    for (let d = 0; d < this.count; d++) {
      if (this.ok(this.images[i - d])) return i - d;
      if (this.ok(this.images[i + d])) return i + d;
    }
    return -1;
  }

  get(i) { return this.images[this.nearest(i)] ?? null; }
}
