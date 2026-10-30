// Juice: pooled particles (instanced), ripples, target ring, goal beacon and
// sparkle trail. Everything is cheap: a handful of draw calls total.
import * as THREE from 'three';
import { PAL, leafGeometry, radialTexture, halo } from './props.js';

class Pool {
  constructor(scene, geo, material, cap, { billboard = false } = {}) {
    this.mesh = new THREE.InstancedMesh(geo, material, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 6;
    this.mesh.setColorAt(0, new THREE.Color('#fff'));
    this.items = []; this.cap = cap; this.billboard = billboard;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.s = new THREE.Vector3(); this.c = new THREE.Color();
    scene.add(this.mesh);
    for (let i = 0; i < cap; i++) this.mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
    this.mesh.count = cap;
  }
  spawn(p) { if (this.items.length >= this.cap) this.items.shift(); this.items.push(p); }
  update(dt, cam) {
    const { items, mesh, m, q, e, s, c } = this;
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i]; p.age += dt;
      if (p.age >= p.life) { items.splice(i, 1); continue; }
      p.vy -= (p.g ?? 0) * dt; const drag = Math.exp(-(p.drag ?? 1.5) * dt);
      p.vx *= drag; p.vy *= drag; p.vz *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.floor !== undefined && p.y < p.floor) { p.y = p.floor; p.vy = 0; p.vx *= 0.8; p.vz *= 0.8; }
      p.rx = (p.rx || 0) + (p.sx || 0) * dt; p.ry = (p.ry || 0) + (p.sy || 0) * dt;
    }
    for (let i = 0; i < this.cap; i++) {
      const p = items[i];
      if (!p) { m.makeScale(0, 0, 0); mesh.setMatrixAt(i, m); continue; }
      const u = p.age / p.life;
      const sc = p.size * (p.grow ? (0.4 + u * 0.9) : 1) * (u < 0.15 ? u / 0.15 : 1) * (1 - Math.pow(Math.max(0, (u - (p.fadeAt ?? 0.6)) / (1 - (p.fadeAt ?? 0.6))), 1.3));
      if (this.billboard && cam) q.copy(cam.quaternion); else { e.set(p.rx, p.ry, 0); q.setFromEuler(e); }
      s.set(sc * (p.flat ? 1 : 1), sc * (p.flat ? 1 : 1), sc);
      m.compose(new THREE.Vector3(p.x, p.y, p.z), q, s); mesh.setMatrixAt(i, m);
      c.set(p.color); if (p.fadeColor) c.multiplyScalar(1 - Math.max(0, (u - 0.4) / 0.6)); mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}

export class FX {
  constructor(scene, game) {
    this.scene = scene; this.game = game; this.reduced = false;
    const puffGeo = new THREE.IcosahedronGeometry(1, 0);
    this.puffs = new Pool(scene, puffGeo, new THREE.MeshStandardMaterial({ color: '#fff', roughness: 1, flatShading: true }), 60);
    const lg = leafGeometry(0.1); lg.translate(0, -0.5, 0);
    this.leaves = new Pool(scene, lg, new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.9, flatShading: true, side: THREE.DoubleSide }), 70);
    const sparkMat = new THREE.MeshBasicMaterial({ map: radialTexture('star'), color: '#fff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.sparks = new Pool(scene, new THREE.PlaneGeometry(1, 1), sparkMat, 90, { billboard: true });
    const ringMat = new THREE.MeshBasicMaterial({ map: radialTexture('ring'), color: '#fff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.ripples = new Pool(scene, new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), ringMat, 30);

    // Selected-target ring (immediate feedback for the context action).
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: PAL.amber, transparent: true, opacity: 0.9, depthWrite: false }));
    this.ring.renderOrder = 4; this.ring.visible = false; scene.add(this.ring);
    this.ringDots = new THREE.Group(); this.ring.add(this.ringDots);
    for (let i = 0; i < 4; i++) {
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.07, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: PAL.cream, depthWrite: false, transparent: true }));
      d.position.set(Math.cos(i * Math.PI / 2) * 0.62, 0.002, Math.sin(i * Math.PI / 2) * 0.62); this.ringDots.add(d);
    }
    // Goal beacon: a bobbing amber diamond with a glow, visible from far away.
    this.beacon = new THREE.Group(); this.beacon.visible = false; scene.add(this.beacon);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: PAL.amber, emissive: PAL.amber, emissiveIntensity: 0.7, flatShading: true }));
    gem.scale.y = 1.5; this.beacon.add(gem); this.beaconGem = gem;
    const bh = halo('amber', 1.3, 0.5); this.beacon.add(bh);
    // Sparkle trail toward the current goal.
    const trailMat = new THREE.MeshBasicMaterial({ map: radialTexture('soft'), color: PAL.amber, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.trail = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), trailMat, 26); this.trail.frustumCulled = false; this.trail.renderOrder = 5;
    scene.add(this.trail); this.trailPath = null; this.trailT = 0;
    this.tmp = new THREE.Matrix4();
    // Dusk glow motes (ambient, persistent).
    const motes = [], R = mulberry(5);
    for (let i = 0; i < 70; i++) motes.push(-14 + R() * 24, 0.4 + R() * 2.2, -16 + R() * 10.5);
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(motes, 3));
    this.motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: PAL.amber, size: 0.2, map: radialTexture('soft'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
    this.motes.userData.base = motes.slice(); scene.add(this.motes);
  }

  n(count) { return this.reduced ? Math.ceil(count / 2) : count; }

  puff(x, y, z, { count = 4, color = PAL.cream, size = 0.12, speed = 0.9, up = 0.6 } = {}) {
    for (let i = 0; i < this.n(count); i++) {
      const a = Math.random() * Math.PI * 2;
      this.puffs.spawn({ x, y: y + 0.05, z, vx: Math.cos(a) * speed * (0.4 + Math.random() * 0.6), vy: up * (0.6 + Math.random() * 0.6), vz: Math.sin(a) * speed * (0.4 + Math.random() * 0.6),
        g: 0.6, drag: 4, size: size * (0.7 + Math.random() * 0.6), life: 0.5 + Math.random() * 0.3, age: 0, color, grow: true, fadeAt: 0.35, sx: 2, sy: 3 });
    }
  }
  leafBurst(x, y, z, { count = 10, colors = [PAL.moss, PAL.teal, '#8fae78'], speed = 2.6, size = 0.22 } = {}) {
    for (let i = 0; i < this.n(count); i++) {
      const a = Math.random() * Math.PI * 2;
      this.leaves.spawn({ x, y, z, vx: Math.cos(a) * speed * Math.random(), vy: 2 + Math.random() * 2.4, vz: Math.sin(a) * speed * Math.random(),
        g: 4.5, drag: 1.6, size: size * (0.6 + Math.random() * 0.8), life: 1.6 + Math.random() * 0.9, age: 0, color: colors[i % colors.length],
        rx: Math.random() * 6, ry: Math.random() * 6, sx: (Math.random() - 0.5) * 9, sy: (Math.random() - 0.5) * 9, floor: 0.04, fadeAt: 0.75 });
    }
  }
  sparkle(x, y, z, { count = 12, color = PAL.amber, speed = 1.6, size = 0.32, up = 1.4, life = 1.0 } = {}) {
    for (let i = 0; i < this.n(count); i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random();
      this.sparks.spawn({ x, y, z, vx: Math.cos(a) * speed * r, vy: up * (0.4 + Math.random()), vz: Math.sin(a) * speed * r,
        g: 0.8, drag: 2.2, size: size * (0.5 + Math.random() * 0.8), life: life * (0.7 + Math.random() * 0.6), age: 0, color, fadeColor: true, fadeAt: 0.5 });
    }
  }
  ripple(x, z, { y = 0.08, color = PAL.cream, size = 2.2, life = 1.1 } = {}) {
    this.ripples.spawn({ x, y, z, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, size, life, age: 0, color, fadeColor: true, grow: true, fadeAt: 0.2 });
  }
  swirl(x, y, z, { count = 14, color = PAL.cream } = {}) {
    for (let i = 0; i < this.n(count); i++) {
      const a = (i / count) * Math.PI * 2;
      this.sparks.spawn({ x: x + Math.cos(a) * 0.5, y: y + i * 0.05, z: z + Math.sin(a) * 0.5, vx: -Math.sin(a) * 2.6, vy: 0.8, vz: Math.cos(a) * 2.6,
        g: 0, drag: 0.8, size: 0.22, life: 1.1, age: 0, color, fadeColor: true });
    }
  }
  sneezeDots(actor) {
    const h = actor.headWorld(); const f = actor.root.rotation.y;
    for (let i = 0; i < 3; i++) {
      const a = f + (i - 1) * 0.5;
      this.sparks.spawn({ x: h.x + Math.sin(f) * 0.3, y: h.y - 0.4, z: h.z + Math.cos(f) * 0.3, vx: Math.sin(a) * 1.4, vy: 1.2 + i * 0.2, vz: Math.cos(a) * 1.4,
        g: -0.15, drag: 1.4, size: 0.42, life: 2.4, age: 0, color: PAL.amber, fadeColor: true, fadeAt: 0.7 });
    }
  }

  showRing(x, y, z, radius = 0.7, color = PAL.amber) {
    this.ring.visible = true; this.ring.position.set(x, y + 0.05, z);
    this.ringRadius = radius; this.ring.material.color.set(color);
  }
  hideRing() { this.ring.visible = false; }

  setBeacon(p) {
    if (!p) { this.beacon.visible = false; return; }
    this.beacon.visible = true; this.beacon.position.set(p.x, (p.y || 0) + (p.h || 2.2), p.z);
  }
  setTrail(path) { this.trailPath = path; }

  update(dt, t, cam) {
    this.puffs.update(dt); this.leaves.update(dt); this.sparks.update(dt, cam); this.ripples.update(dt);
    if (this.ring.visible) {
      const s = this.ringRadius / 0.62 * (1 + Math.sin(t * 5) * 0.05);
      this.ring.scale.set(s, 1, s); this.ringDots.rotation.y = t * 1.2;
      this.ring.material.opacity = 0.75 + Math.sin(t * 5) * 0.15;
    }
    if (this.beacon.visible) { this.beaconGem.rotation.y = t * 2; this.beaconGem.position.y = Math.sin(t * 3) * 0.12; }
    // Trail: motes flowing along the first metres of the path to the goal.
    const path = this.trailPath; const mesh = this.trail;
    this.trailT = (this.trailT + dt * 1.6) % 1;
    for (let i = 0; i < mesh.count; i++) {
      if (!path || path.length < 2) { this.tmp.makeScale(0, 0, 0); mesh.setMatrixAt(i, this.tmp); continue; }
      const d = (i + this.trailT) * 0.75 + 0.9; // metres along the path
      const p = alongPath(path, d);
      if (!p) { this.tmp.makeScale(0, 0, 0); mesh.setMatrixAt(i, this.tmp); continue; }
      const fadeIn = Math.min(1, (d - 0.9) / 1.2), fadeOut = Math.max(0, 1 - (d - 0.9) / (mesh.count * 0.75));
      const sc = 0.32 * fadeIn * (0.4 + fadeOut * 0.8) * (0.85 + Math.sin(t * 6 + i) * 0.15);
      this.tmp.compose(new THREE.Vector3(p.x, 0.25 + Math.sin(t * 3 + i * 0.7) * 0.06, p.z), cam.quaternion, new THREE.Vector3(sc, sc, sc));
      mesh.setMatrixAt(i, this.tmp);
    }
    mesh.instanceMatrix.needsUpdate = true;
    // Motes drift.
    const pos = this.motes.geometry.attributes.position, base = this.motes.userData.base;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, base[i * 3] + Math.sin(t * 0.4 + i) * 0.4, base[i * 3 + 1] + Math.sin(t * 0.7 + i * 1.3) * 0.3, base[i * 3 + 2] + Math.cos(t * 0.35 + i) * 0.4);
    }
    pos.needsUpdate = true;
  }
}

function alongPath(path, dist) {
  let acc = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], l = Math.hypot(b.x - a.x, b.z - a.z);
    if (acc + l >= dist) { const u = (dist - acc) / l; return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u }; }
    acc += l;
  }
  return null;
}
function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
