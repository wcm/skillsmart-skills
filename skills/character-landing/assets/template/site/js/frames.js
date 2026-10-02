// A numbered WebP sequence described by manifest.json. First frame loads first so there's always a poster.
export class FrameSeq {
  static async load(dir) {
    const res = await fetch(`${dir}/manifest.json`);
    if (!res.ok) return null;
    return new FrameSeq(dir, await res.json());
  }

  constructor(dir, m) {
    this.meta = m;
    this.count = m.count;
    this.fps = m.fps;
    const name = n => `${dir}/` + m.pattern.replace("{n}", String(n).padStart(m.pad, "0"));
    this.images = Array.from({ length: m.count }, (_, i) => { const im = new Image(); im.decoding = "async"; im._src = name(i + 1); return im; });
    this.first = new Promise(r => { this.images[0].onload = r; this.images[0].onerror = r; });
    this.images[0].src = this.images[0]._src;
    this.started = false;
  }

  // Kick off the rest; resolves when everything has settled.
  preload() {
    if (!this.started) {
      this.started = true;
      this.all = Promise.all(this.images.slice(1).map(im => new Promise(r => { im.onload = im.onerror = r; im.src = im._src; })));
    }
    return this.all;
  }

  ok(im) { return im?.complete && im.naturalWidth > 0; }

  // Nearest decoded frame, so fast scrolling never flashes blank.
  get(i) {
    i = Math.max(0, Math.min(this.count - 1, i));
    for (let d = 0; d < this.count; d++) {
      if (this.ok(this.images[i - d])) return { i: i - d, im: this.images[i - d] };
      if (this.ok(this.images[i + d])) return { i: i + d, im: this.images[i + d] };
    }
    return null;
  }
}
