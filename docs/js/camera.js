// Orthographic three-quarter follow camera (world.json: offset [10,13,14],
// vertical span 12 landscape / 16 portrait, soft follow, obstruction fade).
import * as THREE from 'three';

const OFFSET = new THREE.Vector3(10, 13, 14).normalize();

export class FollowCamera {
  constructor({ spanLandscape = 12, spanPortrait = 16 } = {}) {
    this.cam = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 160);
    this.spanL = spanLandscape; this.spanP = spanPortrait;
    this.aspect = 1.6;
    this.focus = new THREE.Vector3(); this.lookAhead = new THREE.Vector3();
    this.zoom = 1; this.zoomTarget = 1; this.punch = 0; this.punchV = 0;
    this.shot = null; this.shotBlend = 0;
    this.reducedMotion = false;
    this.raycaster = new THREE.Raycaster();
    this.fadeState = new Map();
    // Screen-aligned ground axes for input mapping.
    this.right = new THREE.Vector3(OFFSET.z, 0, -OFFSET.x).normalize();
    this.up = new THREE.Vector3(-OFFSET.x, 0, -OFFSET.z).normalize();
  }

  resize(w, h) { this.aspect = w / Math.max(1, h); this.applyProjection(); }

  baseSpan() {
    // Blend between landscape and portrait spans so every phone shape frames ~the same play area.
    const a = this.aspect, u = Math.min(1, Math.max(0, (1.35 - a) / (1.35 - 0.5)));
    return this.spanL + (this.spanP - this.spanL) * u;
  }

  applyProjection() {
    // Cinematic spans are authored for landscape; tall phones get a wider view so the action fits.
    const shotSpan = this.shot?.span ? this.shot.span * Math.min(1.9, Math.max(1, 1.1 / this.aspect)) : null;
    let span = this.baseSpan() * this.zoom * (1 - this.punch);
    if (shotSpan) span = span + (shotSpan - span) * this.shotBlend;
    const half = span / 2;
    this.cam.top = half; this.cam.bottom = -half; this.cam.left = -half * this.aspect; this.cam.right = half * this.aspect;
    this.cam.updateProjectionMatrix();
  }

  snapTo(p) { this.focus.set(p.x, p.y ?? 0, p.z); this.lookAhead.set(0, 0, 0); this.place(); }

  /** Cinematic override: {x, y, z, span}; blend = seconds to ease in. */
  setShot(shot, blendSeconds = 1.2) { this.shot = shot ? { ...shot } : null; this.shotIn = blendSeconds; if (shot) this.shotFrom = this.shotBlend; }
  clearShot() { this.shot = null; }

  /** Gentle zoom-in "breath" on milestones. Off when reduced motion is on. */
  nudge(amount = 0.06) { if (!this.reducedMotion) this.punchV += amount * 9; }

  update(dt, target, vel) {
    // Soft follow with eased look-ahead (separately smoothed so reversals don't whip).
    const la = new THREE.Vector3(vel?.x || 0, 0, vel?.y || 0).multiplyScalar(0.32);
    if (la.length() > 1.4) la.setLength(1.4);
    this.lookAhead.lerp(la, 1 - Math.exp(-dt * 2.2));
    const desired = new THREE.Vector3(target.x, (target.y || 0) * 0.5, target.z).add(this.lookAhead);
    if (this.shot) {
      this.shotBlend = Math.min(1, this.shotBlend + dt / Math.max(0.01, this.shotIn || 1));
      const s = this.shot, k = smooth(this.shotBlend);
      desired.lerp(new THREE.Vector3(s.x, s.y || 0, s.z), k);
    } else this.shotBlend = Math.max(0, this.shotBlend - dt / 1.0);
    const rate = this.shot ? 4 : 5.5;
    const d = desired.clone().sub(this.focus);
    if (!this.shot && d.length() < 0.03) d.set(0, 0, 0); // tiny deadzone: no micro twitch
    this.focus.addScaledVector(d, 1 - Math.exp(-rate * dt));
    // Punch spring.
    this.punchV += (-this.punch * 60 - this.punchV * 11) * dt; this.punch += this.punchV * dt;
    if (this.reducedMotion) { this.punch = 0; this.punchV = 0; }
    this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.exp(-dt * 2));
    this.applyProjection();
    this.place();
  }

  place() {
    this.cam.position.copy(this.focus).addScaledVector(OFFSET, 60);
    this.cam.lookAt(this.focus);
    this.cam.updateMatrixWorld();
  }

  /** Fade occluders (trees, canopy, slide) that stand between camera and the Keeper. */
  updateFades(dt, occluders, points) {
    const hit = new Set();
    for (const p of points) {
      const origin = p.clone().addScaledVector(OFFSET, 60);
      this.raycaster.set(origin, OFFSET.clone().negate());
      this.raycaster.far = 60 - 0.2;
      for (const h of this.raycaster.intersectObjects(occluders, false)) hit.add(h.object);
    }
    for (const o of occluders) {
      const want = hit.has(o) ? 0.28 : 1;
      const m = o.material; const cur = m.opacity;
      if (Math.abs(cur - want) < 0.005 && (want < 1) === m.transparent) continue;
      m.opacity = cur + (want - cur) * (1 - Math.exp(-dt * 8));
      const transparent = m.opacity < 0.995;
      if (m.transparent !== transparent) { m.transparent = transparent; m.depthWrite = !transparent; m.needsUpdate = true; }
      if (!transparent) m.opacity = 1;
    }
  }

  /** Project a world point to CSS pixels in the canvas. */
  toScreen(v, w, h, out = { x: 0, y: 0, visible: true }) {
    const p = v.clone().project(this.cam);
    out.x = (p.x * 0.5 + 0.5) * w; out.y = (-p.y * 0.5 + 0.5) * h; out.visible = p.z > -1 && p.z < 1;
    return out;
  }
}

const smooth = u => u * u * (3 - 2 * u);
