// A numbered WebP sequence described by manifest.json (from tools/build.mjs). The first frame loads first, then the
// rest; get() returns the nearest frame that has decoded, so fast scrolling never flashes blank.
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
    const name = (n) => `${dir}/` + m.pattern.replace("{n}", String(n).padStart(m.pad, "0"));
    this.images = Array.from({ length: m.count }, (_, i) => { const im = new Image(); im.decoding = "async"; im._src = name(i + 1); return im; });
    this.first = new Promise((r) => { this.images[0].onload = r; this.images[0].onerror = r; });
    this.images[0].src = this.images[0]._src;
    this.started = false;
  }

  // every fourth frame first, then the rest, so a quick scroll early on still looks like motion
  preload() {
    if (this.started) return this.all;
    this.started = true;
    const order = [];
    for (let step of [4, 1]) for (let i = 1; i < this.count; i += step) if (!order.includes(i)) order.push(i);
    let next = 0;
    const lane = () => new Promise((done) => {
      const go = () => {
        if (next >= order.length) return done();
        const im = this.images[order[next++]];
        im.onload = im.onerror = go;
        im.src = im._src;
      };
      go();
    });
    this.all = Promise.all([lane(), lane(), lane(), lane()]);
    return this.all;
  }

  ok(im) { return im?.complete && im.naturalWidth > 0; }

  get(i) {
    i = Math.max(0, Math.min(this.count - 1, i));
    for (let d = 0; d < this.count; d++) {
      if (this.ok(this.images[i - d])) return this.images[i - d];
      if (this.ok(this.images[i + d])) return this.images[i + d];
    }
    return null;
  }
}
