// The stage: one WebGL canvas shared by every theme, the pointer (tracked on the window so the DOM copy stays
// selectable and the dock clickable), the layout slot each theme centres its light in, and the frame loop.
import * as THREE from "three";

const UI = "a, button, input, .dock, [data-ui]"; // a press on these never reaches the glass

// Point a perspective camera so the world origin lands on the slot (lens shift, not rotation, so the subject is
// seen face on wherever it sits), and return the distance at which a subject of `radius` fills the slot.
export function aim(camera, w, h, slot, radius) {
  camera.aspect = w / h;
  camera.setViewOffset(w, h, w * (0.5 - slot.x), h * (0.5 - slot.y), w, h);
  camera.updateProjectionMatrix();
  const room = slot.size * Math.min(h * Math.min(slot.y, 1 - slot.y), w * Math.min(slot.x, 1 - slot.x));
  return (h * radius) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * room);
}

// The pointer as a ray in world space (for picking what it is near).
const ndc = new THREE.Vector2();
export function pointerRay(camera, p, raycaster = new THREE.Raycaster()) {
  ndc.set(p.sx, p.sy);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray;
}

export class Stage {
  constructor(canvas) {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.theme = null;
    this.t = 0;
    this.last = performance.now();
    // Adaptive resolution: if frames run long for a while, draw fewer pixels (down to 60% of the piece's cap). It only
    // ever steps down within a piece (stepping back up made it oscillate), and every resize waits for the start of the
    // next frame: resizing a WebGL canvas wipes it, and doing that after a frame is drawn shows a blank one.
    this.scale = 1;
    this.ema = 1 / 60;
    this.checkAt = 0;
    this.slow = 0;
    this.pending = false;
    this.motion = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.35 : 1;
    // Pointer. x, y: normalised device coords (−1…1, y up). sx, sy: the same, eased. vx, vy: velocity in NDC per
    // second. presence eases to 1 while the pointer is over the page (or a finger is down) and back to 0 when it leaves.
    this.p = { x: 0, y: 0, sx: 0, sy: 0, vx: 0, vy: 0, px: 0, py: 0, down: false, presence: 0, live: false };

    const at = (e) => {
      const { p } = this;
      const x = (e.clientX / innerWidth) * 2 - 1, y = 1 - (e.clientY / innerHeight) * 2;
      p.x = x; p.y = y; p.px = e.clientX; p.py = e.clientY;
    };
    addEventListener("pointermove", (e) => {
      at(e);
      this.p.live = e.pointerType !== "touch" || this.p.down;
      this.theme?.move?.(e);
    }, { passive: true });
    addEventListener("pointerdown", (e) => {
      if (e.target.closest?.(UI)) return;
      at(e);
      this.p.down = true; this.p.live = true;
      this.theme?.down?.(e);
    });
    const up = () => {
      if (!this.p.down) return;
      this.p.down = false;
      this.theme?.up?.();
    };
    addEventListener("pointerup", (e) => { up(); if (e.pointerType === "touch") this.p.live = false; });
    addEventListener("pointercancel", () => { up(); this.p.live = false; });
    document.documentElement.addEventListener("pointerleave", () => { if (!this.p.down) this.p.live = false; });
    addEventListener("blur", () => { up(); this.p.live = false; });
    addEventListener("resize", () => { this.pending = true; this.scale = 1; this.slow = 0; });
    this.resize();
    r.setAnimationLoop((now) => this.tick(now));
  }

  // Where the light sits: right of the copy on wide screens, below it on tall ones. x, y are fractions of the
  // viewport from the top left; size is the share of the shorter fitting dimension it may fill.
  get slot() {
    const { w, h } = this;
    const wide = w / h > 1.1;
    return wide ? { wide, x: w > 900 ? 0.62 : 0.6, y: 0.5, size: 0.9 } : { wide, x: 0.5, y: 0.62, size: 0.92 };
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.w = w; this.h = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.theme?.maxDpr ?? 2) * this.scale;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.theme?.resize?.(w, h, this.dpr);
  }

  setTheme(theme) {
    this.theme = theme;
    this.scale = 1;
    this.ema = 1 / 60;
    this.slow = 0;
    this.checkAt = performance.now() + 2500;
    this.resize();
  }

  // Step the current piece by hand and draw it (handy when the page is in a background tab and frames are paused).
  advance(seconds = 1, fps = 60) {
    for (let i = 0; i < Math.round(seconds * fps); i++) this.tick(this.last + 1000 / fps);
  }

  tick(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const { p } = this;
    const k = 1 - Math.exp(-dt * 6);
    const ox = p.sx, oy = p.sy;
    p.sx += (p.x - p.sx) * k;
    p.sy += (p.y - p.sy) * k;
    // velocity of the eased pointer, itself eased so it reads as a gesture, not jitter
    const kv = 1 - Math.exp(-dt * 10);
    p.vx += ((p.sx - ox) / Math.max(dt, 1e-3) - p.vx) * kv;
    p.vy += ((p.sy - oy) / Math.max(dt, 1e-3) - p.vy) * kv;
    p.presence += ((p.live ? 1 : 0) - p.presence) * (1 - Math.exp(-dt * 2.5));
    this.t += dt * this.motion;
    if (!this.theme) return;
    // slow for three checks running (~4.5 s): step the resolution down, before this frame is drawn
    if (now > this.checkAt) {
      this.checkAt = now + 1500;
      this.slow = this.ema > 1 / 30 ? this.slow + 1 : 0;
      if (this.slow >= 3 && this.scale > 0.6) { this.scale = Math.max(0.6, this.scale * 0.85); this.slow = 0; this.pending = true; }
    }
    if (this.pending) { this.pending = false; this.resize(); }
    this.theme.update(dt * this.motion, this.t);
    this.ema += (dt - this.ema) * 0.05;
  }
}
