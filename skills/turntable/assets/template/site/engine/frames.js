// One subject's turn: a ring of WebP frames (frames/<id>/manifest.json from tools/frames.mjs). The last frame sits next
// to the first, so "nearest loaded frame" wraps round. get() never returns nothing once any frame has loaded, so a fast
// scroll shows a coarse turn instead of a blank, and the frame it wanted jumps the loading queue.
export class Turn {
  static async load(dir) {
    const res = await fetch(`${dir}/manifest.json`).catch(() => null);
    if (!res?.ok) return null;
    return new Turn(dir, await res.json());
  }

  constructor(dir, m) {
    this.meta = m;
    this.count = m.count;
    this.wanted = null;
    this.onframe = null;
    const name = (n) => `${dir}/` + m.pattern.replace("{n}", String(n).padStart(m.pad, "0"));
    this.images = Array.from({ length: m.count }, (_, i) => { const im = new Image(); im.decoding = "async"; im._src = name(i + 1); return im; });
  }

  ok(im) { return im?.complete && im.naturalWidth > 0; }

  nearest(i) {
    const n = this.count;
    i = ((i % n) + n) % n;
    if (!this.ok(this.images[i]) && !this.images[i]._asked) this.wanted = i;
    for (let d = 0; d <= n / 2; d++) {
      const a = (i - d + n) % n, b = (i + d) % n;
      if (this.ok(this.images[a])) return a;
      if (this.ok(this.images[b])) return b;
    }
    return -1;
  }

  get(i) { const k = this.nearest(i); return k < 0 ? null : this.images[k]; }
}

// Loads every turn coarse to fine: the subject in focus first (every 12th frame, so it turns at once), then its
// neighbours, then finer steps for all. focus(k) re-orders what's still waiting. Six load at once.
export class Loader {
  constructor(turns, lanes = 6) {
    this.turns = turns;
    this.lanes = lanes;
    this.focusAt = 0;
    this.order = [];
    this.next = 0;
    this.running = 0;
  }

  focus(k) {
    this.focusAt = k;
    const list = [];
    const byDistance = this.turns.map((t, i) => [t, i]).filter(([t]) => t).sort((a, b) => Math.abs(a[1] - k) - Math.abs(b[1] - k));
    for (const step of [12, 6, 3, 1]) for (const [t, i] of byDistance) {
      // the focus subject gets a step ahead of the others
      const s = i === k ? Math.max(1, step >> 1) : step;
      for (let f = 0; f < t.count; f += s) if (!t.images[f]._asked) list.push([t, f]);
    }
    this.order = list;
    this.next = 0;
    this.pump();
  }

  take() {
    for (const t of this.turns) if (t?.wanted != null) { const f = t.wanted; t.wanted = null; if (!t.images[f]._asked) return [t, f]; }
    while (this.next < this.order.length) { const job = this.order[this.next++]; if (!job[0].images[job[1]]._asked) return job; }
    return null;
  }

  pump() {
    while (this.running < this.lanes) {
      const job = this.take();
      if (!job) return;
      const [t, f] = job, im = t.images[f];
      im._asked = true;
      this.running++;
      const done = () => { this.running--; t.onframe?.(f); this.pump(); };
      im.onload = done;
      im.onerror = done;
      im.src = im._src;
    }
  }

  // resolves when every frame of every turn has loaded (for recordings)
  all() {
    return Promise.all(this.turns.filter(Boolean).flatMap((t) => t.images.map((im) => new Promise((r) => {
      if (t.ok(im)) return r();
      im.addEventListener("load", r, { once: true });
      im.addEventListener("error", r, { once: true });
      if (!im._asked) { im._asked = true; im.src = im._src; }
    }))));
  }
}
