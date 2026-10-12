// Drag to tilt and roll an object like a ball under the finger: the axis lies in the screen, across the drag. A flick
// flings it. Left alone it either turns slowly on its own axis or, given a home orientation, settles back to it.
// A press that doesn't move is a tap (up() returns true).
import * as THREE from "three";

export class Trackball {
  constructor(object, { own = [0.15, 1, 0.08], spin = 0.11, home = null, settle = 0.8, sensitivity = 0.0065, friction = 1.1 } = {}) {
    Object.assign(this, { object, spin, home, settle, sensitivity, friction });
    this.own = new THREE.Vector3(...own).normalize();
    this.omega = new THREE.Vector3();
    this.axis = new THREE.Vector3();
    this.q = new THREE.Quaternion();
    this.drag = null;
    document.body.style.cursor = "grab";
  }

  get dragging() { return !!this.drag; }

  turn(axis, angle) {
    if (angle) this.object.quaternion.premultiply(this.q.setFromAxisAngle(axis, angle));
  }

  down(e) {
    this.drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
    this.omega.set(0, 0, 0);
    document.body.style.cursor = "grabbing";
  }

  move(e) {
    const d0 = this.drag;
    if (!d0) return;
    const dx = e.clientX - d0.x, dy = e.clientY - d0.y, d = Math.hypot(dx, dy);
    if (!d) return;
    const now = performance.now(), angle = d * this.sensitivity;
    this.axis.set(dy / d, dx / d, 0);
    this.turn(this.axis, angle);
    this.omega.lerp(this.axis.multiplyScalar(angle / (Math.max(8, now - d0.t) / 1000)), 0.6);
    if (this.omega.length() > 9) this.omega.setLength(9);
    Object.assign(d0, { x: e.clientX, y: e.clientY, t: now, moved: d0.moved + d });
  }

  up() {
    const d0 = this.drag;
    if (!d0) return false;
    if (performance.now() - d0.t > 90) this.omega.multiplyScalar(0.15); // held still before letting go: no fling
    this.drag = null;
    document.body.style.cursor = "grab";
    return d0.moved < 6;
  }

  update(dt) {
    if (this.drag) return;
    const w = this.omega.length();
    if (w > 1e-4) this.turn(this.axis.copy(this.omega).divideScalar(w), w * dt);
    this.omega.multiplyScalar(Math.exp(-dt * this.friction));
    if (this.home) this.object.quaternion.slerp(this.home, 1 - Math.exp(-dt * this.settle * (w > 0.5 ? 0.2 : 1)));
    else this.turn(this.own, dt * this.spin);
  }

  dispose() { document.body.style.cursor = ""; }
}
