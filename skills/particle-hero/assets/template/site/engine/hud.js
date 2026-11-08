// Trackers over the dust: small brackets locked onto strong points of the picture, each with its number and where it
// sits in space, joined by thin lines. They lose their lock when the picture changes (they wander, read SEEK and
// fade), and lock onto the new picture once it has gathered. Drawn on a 2D canvas over the engine's.

const fmt = (v) => (v < 0 ? "−" : "+") + Math.abs(v).toFixed(2);

export class Hud {
  constructor(canvas, engine, opts = {}) {
    this.c = canvas;
    this.g = canvas.getContext("2d");
    this.n = engine;
    this.o = {
      color: "rgba(240,232,218,0.9)",
      dim: "rgba(240,232,218,0.32)",
      font: "500 9.5px 'JetBrains Mono', ui-monospace, monospace",
      primary: 8,          // trackers with labels
      secondary: 14,       // small marks without
      links: true,
      ruler: null,         // a ruled frame round the picture: { pad } in CSS px, or null
      readout: true,       // the pointer's own little label
      ...opts,
    };
    this.locks = new Map(); // form index -> per-tracker state
    this.seen = -1;
    this.leaving = null;    // { feats, t0 }
    this.n.on((ev, i) => {
      if (ev !== "show") return;
      if (this.seen >= 0 && this.seen !== i) this.leaving = { form: this.n.forms[this.seen], t0: this.n.time };
      this.seen = i;
    });
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = this.c.getBoundingClientRect();
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (W !== this.c.width || H !== this.c.height) { this.c.width = W; this.c.height = H; }
    this.dpr = dpr; this.w = r.width; this.h = r.height;
  }

  draw() {
    this.resize();
    const g = this.g, n = this.n, o = this.o, t = n.time;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    if (!n.B) return;
    if (this.seen < 0) this.seen = n.current;
    this.small = this.w < 760;          // a phone: fewer, smaller labels
    g.font = this.small ? o.font.replace(/[\d.]+px/, "8px") : o.font;
    g.textBaseline = "middle";
    g.lineWidth = 1;

    if (o.ruler) this._ruler(g);

    // the picture being left: trackers wander off their points and fade
    if (this.leaving) {
      const a = 1 - (t - this.leaving.t0) / 0.9;
      if (a <= 0) this.leaving = null;
      else this._trackers(g, this.leaving.form, a, true, t - this.leaving.t0);
    }
    // the current picture: lock on, one by one, once it has gathered
    const p = n.progress;
    const lockIn = Math.max(0, (p - 0.72) / 0.28);
    if (lockIn > 0) this._trackers(g, n.B.form, lockIn, false, 0);
    if (lockIn > 0 && o.callouts) this._callouts(g, n.B.form, lockIn);
    if (o.readout) this._readout(g);
  }

  // labelled leader lines from points on the picture: o.callouts(form) → [{ at: [x, y] (picture space) or k (a
  // tracker), text, sub, dx, dy }] with dx, dy the label's offset in CSS px
  _callouts(g, form, a) {
    const o = this.o, n = this.n;
    const list = o.callouts(form) || [];
    list.forEach((c, k) => {
      const f = typeof c.at === "number" ? form.feats[c.at] : { x: c.at[0], y: c.at[1], z: c.at[2] ?? 0 };
      if (!f) return;
      const s = n.project(f.x, f.y, f.z);
      if (!s) return;
      const v = Math.max(0, Math.min(1, a * 2.2 - k * 0.3));
      if (v <= 0) return;
      const ex = s.x + c.dx, ey = s.y + c.dy, mx = s.x + c.dx * 0.55;
      g.globalAlpha = v;
      g.strokeStyle = o.color;
      g.fillStyle = o.color;
      g.beginPath();
      g.arc(s.x, s.y, 3, 0, Math.PI * 2);
      g.fill();
      // an elbow: out at an angle, then level to the label, drawn as it locks
      const L1 = Math.hypot(mx - s.x, ey - s.y), L2 = Math.abs(ex - mx), L = (L1 + L2) * Math.min(1, v * 1.3);
      g.beginPath();
      g.moveTo(s.x, s.y);
      if (L <= L1) g.lineTo(s.x + (mx - s.x) * (L / L1), s.y + (ey - s.y) * (L / L1));
      else { g.lineTo(mx, ey); g.lineTo(mx + Math.sign(ex - mx) * (L - L1), ey); }
      g.stroke();
      if (v > 0.6) {
        g.globalAlpha = (v - 0.6) / 0.4;
        const right = ex >= mx;
        g.textAlign = right ? "left" : "right";
        g.font = o.calloutFont || o.font;
        g.fillText(c.text, ex + (right ? 8 : -8), ey - 1);
        if (c.sub) { g.font = o.font; g.fillStyle = o.dim; g.fillText(c.sub, ex + (right ? 8 : -8), ey + 15); }
        g.textAlign = "left";
        g.font = o.font;
      }
    });
    g.globalAlpha = 1;
  }

  _trackers(g, form, a, seeking, since) {
    const o = this.o, n = this.n, t = n.time;
    const primary = this.small ? Math.min(o.primary, 4) : o.primary;
    const feats = form.feats.slice(0, primary + o.secondary);
    const pts = feats.map((f, k) => {
      // a tracker's lock wobbles a hair, as if it were measuring
      const j = seeking ? 0.06 * since * since * 6 : 0.004;
      const x = f.x + j * Math.sin(t * 3.1 + k * 1.7), y = f.y + j * Math.cos(t * 2.7 + k * 2.3);
      return { f, k, s: n.project(x, y, f.z), x, y };
    });
    // each one locks a beat after the last
    const on = (k) => Math.max(0, Math.min(1, a * (feats.length + 3) / 3 - k * 0.35));
    if (o.links) {
      g.strokeStyle = o.dim;
      g.beginPath();
      for (let k = 1; k < Math.min(primary, pts.length); k++) {
        const A = pts[k - 1].s, B = pts[k].s;
        if (!A || !B || on(k) <= 0) continue;
        const e = Math.min(1, on(k) * 1.5);
        g.moveTo(A.x, A.y);
        g.lineTo(A.x + (B.x - A.x) * e, A.y + (B.y - A.y) * e);
      }
      // and a couple of long ones across
      for (const [i, j] of [[0, 4], [2, 6], [1, 7]]) {
        const A = pts[i]?.s, B = pts[j]?.s;
        if (A && B && on(j) > 0) { g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); }
      }
      g.globalAlpha = Math.min(1, a * 1.4);
      g.stroke();
      g.globalAlpha = 1;
    }
    for (const p of pts) {
      if (!p.s) continue;
      const v = on(p.k);
      if (v <= 0) continue;
      const prim = p.k < primary;
      g.globalAlpha = v * (seeking ? a : 1);
      g.strokeStyle = o.color;
      g.fillStyle = o.color;
      const X = Math.round(p.s.x) + 0.5, Y = Math.round(p.s.y) + 0.5;
      if (prim) {
        const r = (seeking ? 9 + since * 14 : 6 + 10 * (1 - v)) | 0;
        g.beginPath();
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          g.moveTo(X + sx * r, Y + sy * (r - 3));
          g.lineTo(X + sx * r, Y + sy * r);
          g.lineTo(X + sx * (r - 3), Y + sy * r);
        }
        g.moveTo(X - 2, Y); g.lineTo(X + 2, Y);
        g.moveTo(X, Y - 2); g.lineTo(X, Y + 2);
        g.stroke();
        const label = seeking ? `${String(p.k + 1).padStart(2, "0")} SEEK` : this.small ? `${String(p.k + 1).padStart(2, "0")} ${fmt(p.f.z)}` : `${String(p.k + 1).padStart(2, "0")} ${fmt(p.x)} ${fmt(p.y)} ${fmt(p.f.z)}`;
        g.fillText(label, X + r + 6, Y);
      } else {
        g.fillRect(X - 1, Y - 1, 2, 2);
      }
    }
    g.globalAlpha = 1;
  }

  // a thin frame with tick marks round the picture, and crosses at its corners
  _ruler(g) {
    const n = this.n, o = this.o, c = n.camInfo;
    if (!c) return;
    const f = n.o.frame(this.w, this.h);
    const pad = o.ruler.pad ?? 40;
    // the picture's own box (it fits a -1..1 square by its longer side), eased from one picture's to the next
    const a = n.B.form.aspect;
    const tw = o.ruler.wide ?? Math.min(1, a), th = o.ruler.tall ?? Math.min(1, 1 / a);
    this.box = this.box || { w: tw, h: th };
    this.box.w += (tw - this.box.w) * 0.06; this.box.h += (th - this.box.h) * 0.06;
    const hw = f.s * this.box.w + pad, hh = f.s * this.box.h + pad;
    const x0 = f.cx - hw, x1 = f.cx + hw, y0 = f.cy - hh, y1 = f.cy + hh;
    g.strokeStyle = o.dim;
    g.globalAlpha = 0.55;
    g.beginPath();
    g.moveTo(x0, y0 + 0.5); g.lineTo(x1, y0 + 0.5);
    g.moveTo(x0, y1 + 0.5); g.lineTo(x1, y1 + 0.5);
    g.moveTo(x0 + 0.5, y0); g.lineTo(x0 + 0.5, y1);
    for (let x = x0, k = 0; x <= x1; x += 8, k++) {
      const L = k % 10 === 0 ? 7 : k % 5 === 0 ? 4 : 2;
      g.moveTo(Math.round(x) + 0.5, y0); g.lineTo(Math.round(x) + 0.5, y0 + L);
      g.moveTo(Math.round(x) + 0.5, y1); g.lineTo(Math.round(x) + 0.5, y1 - L);
    }
    for (let y = y0, k = 0; y <= y1; y += 8, k++) {
      const L = k % 10 === 0 ? 7 : k % 5 === 0 ? 4 : 2;
      g.moveTo(x0, Math.round(y) + 0.5); g.lineTo(x0 + L, Math.round(y) + 0.5);
    }
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
      g.moveTo(x - 9, Math.round(y) + 0.5); g.lineTo(x + 9, Math.round(y) + 0.5);
      g.moveTo(Math.round(x) + 0.5, y - 9); g.lineTo(Math.round(x) + 0.5, y + 9);
    }
    g.stroke();
    g.globalAlpha = 0.7;
    g.fillStyle = o.dim;
    if (!this.small) g.fillText(`${n.N.toLocaleString("en-US")} PTS`, x0, y1 + 16);
    const drift = (n.o.wind?.amount ?? 0) * 100;
    if (drift > 0) { g.textAlign = "right"; g.fillText(`DRIFT ${Math.round(drift)}`, x1, y0 - 12); g.textAlign = "left"; }
    g.globalAlpha = 1;
  }

  // where the hand is, in the picture's space
  _readout(g) {
    const n = this.n, p = n.ptr;
    if (!p.inside || p.on < 0.05) return;
    const w = n.unproject(p.x, p.y, 0);
    if (!w) return;
    const X = (p.x * 0.5 + 0.5) * this.w, Y = (0.5 - p.y * 0.5) * this.h;
    g.globalAlpha = p.on * 0.8;
    g.fillStyle = this.o.color;
    g.fillText(`${fmt(w.x)} ${fmt(w.y)}`, X + 14, Y + 14);
    g.globalAlpha = 1;
  }
}
