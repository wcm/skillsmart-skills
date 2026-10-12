// The stage: one transparent WebGL canvas over the page's CSS backdrop, a camera that frames whatever the theme
// hangs, pointer tracking on the window (so DOM text and links stay clickable), and the frame loop.
// Physics runs on its own fixed clock: theme.step(h) at a steady 120 Hz, however fast or unevenly the display draws
// (a ProMotion screen mixes 120 and 60 Hz frames); theme.update(dt) then draws the result once per frame.
import * as THREE from "three";

export const STEP = 1 / 120;

const UI = "a, button, input, label, select, textarea, .dock, [data-ui]";

export class Stage {
  constructor(canvas) {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" }));
    this.maxDpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = this.maxDpr;
    this.slow = 0; this.ema = 1 / 60;
    this.acc = 0; // unspent frame time, in physics steps' worth
    this.simT = 0;
    r.setPixelRatio(this.dpr);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.setClearColor(0x000000, 0);
    r.shadowMap.enabled = true;
    this.camera = new THREE.PerspectiveCamera(22, 1, 0.05, 80);
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.theme = null;
    this.t = 0;
    this.last = performance.now();
    this.view = { cx: 0, cy: 0, cz: 0, d: 5 }; // what the camera looks at, from how far
    this.parallax = 0;
    this.lean = { x: 0, y: 0 };
    // pointer in client pixels; `active` is true while a mouse is over the page or a finger is down
    this.p = { x: innerWidth / 2, y: innerHeight / 2, active: false, down: false, touch: matchMedia("(hover: none)").matches, moved: 0 };

    addEventListener("resize", () => this.resize());
    addEventListener("pointermove", (e) => {
      this.p.x = e.clientX; this.p.y = e.clientY; this.p.touch = e.pointerType === "touch";
      this.p.active = !this.p.touch || this.p.down;
      this.p.moved = performance.now();
      this.theme?.onMove?.(e);
    }, { passive: true });
    addEventListener("pointerdown", (e) => {
      if (e.target.closest?.(UI)) return;
      this.p.x = e.clientX; this.p.y = e.clientY; this.p.down = true; this.p.active = true; this.p.touch = e.pointerType === "touch";
      this.theme?.onDown?.(e);
    });
    const up = (e) => {
      if (!this.p.down) return;
      this.p.down = false;
      if (this.p.touch) this.p.active = false;
      this.theme?.onUp?.(e);
    };
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    document.documentElement.addEventListener("pointerleave", () => { if (!this.p.down) this.p.active = false; });
    addEventListener("blur", () => { this.p.active = false; up({}); });
    this.resize();
    r.setAnimationLoop((now) => this.tick(now));
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.theme?.layout?.(w, h);
    this.applyView();
  }

  // Put world point `center` at screen point (sx, sy) (fractions of the viewport) at a scale where the box
  // worldW × worldH fits sh of the viewport's height and sw of its width. Lens shift, not rotation: the object
  // is always seen face on, wherever it sits in the layout.
  frame({ center, worldW, worldH, sx = 0.5, sy = 0.5, sh = 0.8, sw = 0.9, fov, ppm }) {
    const { w, h, camera } = this;
    if (fov) camera.fov = fov;
    ppm ??= Math.min((sh * h) / worldH, (sw * w) / worldW); // pixels per metre at the subject
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    this.view = { cx: center[0], cy: center[1], cz: center[2] ?? 0, d: h / (2 * t * ppm) };
    camera.setViewOffset(w, h, w / 2 - sx * w, h / 2 - sy * h, w, h);
    this.applyView();
    return ppm;
  }

  applyView() {
    const { camera, view, lean } = this;
    const a = lean.x * this.parallax, b = lean.y * this.parallax;
    camera.position.set(view.cx + Math.sin(a) * view.d, view.cy + Math.sin(b) * view.d, view.cz + Math.cos(a) * Math.cos(b) * view.d);
    camera.lookAt(view.cx, view.cy, view.cz);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  rayFrom(clientX, clientY) {
    this.ndc.set((clientX / this.w) * 2 - 1, -(clientY / this.h) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster;
  }

  // where the pointer ray meets the plane z = const (or a plane through `point` facing the camera)
  onPlane(clientX, clientY, z = 0, out = new THREE.Vector3(), point) {
    const ray = this.rayFrom(clientX, clientY).ray;
    if (point) {
      const n = new THREE.Vector3();
      this.camera.getWorldDirection(n);
      const t = n.dot(new THREE.Vector3().subVectors(point, ray.origin)) / n.dot(ray.direction);
      return out.copy(ray.direction).multiplyScalar(t).add(ray.origin);
    }
    const t = (z - ray.origin.z) / ray.direction.z;
    return out.copy(ray.direction).multiplyScalar(t).add(ray.origin);
  }

  toScreen(v) {
    const p = v.clone().project(this.camera);
    return [(p.x * 0.5 + 0.5) * this.w, (-p.y * 0.5 + 0.5) * this.h];
  }

  // keep the frame rate: if frames keep running long, drop the pixel ratio a step (never back up within a theme, so
  // it can't seesaw)
  adapt(raw) {
    if (raw > 0.25) return; // a stall (tab switch, theme load) says nothing about steady speed
    this.ema += (raw - this.ema) * 0.05;
    this.slow = this.ema > 1 / 45 ? this.slow + raw : 0;
    if (this.slow > 1.5 && this.dpr > 1) this.setDpr(Math.max(1, this.dpr - 0.25));
  }

  setDpr(v) {
    this.dpr = v; this.slow = 0;
    this.renderer.setPixelRatio(v);
    this.renderer.setSize(this.w, this.h, false);
  }

  setTheme(theme) {
    this.theme = theme;
    this.parallax = theme?.parallax ?? 0;
    this.acc = 0;
    if (this.dpr !== this.maxDpr) this.setDpr(this.maxDpr);
    if (theme) { theme.layout?.(this.w, this.h); this.applyView(); }
  }

  // run physics forward by whole steps (also used to settle a theme before it's shown, and from the console)
  advance(seconds, draw = true) {
    if (!this.theme) return;
    for (let i = 0, n = Math.round(seconds / STEP); i < n; i++) {
      this.theme.step?.(STEP, (this.simT += STEP));
      if (draw && i % 2) this.theme.update(2 * STEP, (this.t += 2 * STEP));
    }
    if (draw) this.renderer.render(this.theme.scene, this.camera);
  }

  tick(now) {
    const raw = Math.max(0, (now - this.last) / 1000), dt = Math.min(1 / 30, raw);
    this.last = now;
    if (!this.theme) return;
    this.adapt(raw);
    this.t += dt;
    // the camera leans a little toward the pointer (eased), for depth
    const k = 1 - Math.exp(-2.5 * dt);
    const tx = this.p.active ? (this.p.x / this.w - 0.5) * 2 : 0, ty = this.p.active ? -(this.p.y / this.h - 0.5) * 2 : 0;
    this.lean.x += (tx - this.lean.x) * k; this.lean.y += (ty - this.lean.y) * k;
    if (this.parallax) this.applyView();
    this.acc += dt;
    let n = 0;
    while (this.acc >= STEP && n < 4) { this.theme.step?.(STEP, (this.simT += STEP)); this.acc -= STEP; n++; }
    if (n === 4) this.acc = 0; // too far behind: drop the backlog rather than spiral
    this.theme.update(dt, this.t);
    this.renderer.render(this.theme.scene, this.camera);
  }
}
