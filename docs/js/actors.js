// Living actors: the Keeper and the eight creatures. Navigation transform is
// `root`; all visual motion happens on the GLB's inner `body` node tree, so
// collision never moves with a hop or a wobble.
import * as THREE from 'three';
import { blobShadow, halo, PAL } from './props.js';

export const SPECIES = Object.freeze({
  keeper:     { speed: 3.5, radius: 0.34, head: 1.55, shadow: 0.9 },
  tumbletuft: { speed: 3.6, radius: 0.48, head: 1.3, shadow: 1.15, gait: 'trot', primary: 'teal', secondary: 'moss' },
  foldfern:   { speed: 3.1, radius: 0.42, head: 1.35, shadow: 0.95, gait: 'waddle', primary: 'cream', secondary: 'moss' },
  puddleloop: { speed: 3.3, radius: 0.5, head: 0.95, shadow: 1.2, gait: 'paddle', swim: true, primary: 'aqua', secondary: 'teal' },
  siltbell:   { speed: 3.0, radius: 0.42, head: 1.1, shadow: 0.95, gait: 'waddle', primary: 'clay', secondary: 'aqua' },
  whirli:     { speed: 3.3, radius: 0.44, head: 1.3, shadow: 0.9, gait: 'hop', primary: 'cream', secondary: 'teal' },
  kitefin:    { speed: 3.7, radius: 0.46, head: 1.95, shadow: 0.9, gait: 'hover', hover: 0.5, fly: true, primary: 'amber', secondary: 'teal' },
  glintot:    { speed: 3.4, radius: 0.42, head: 0.85, shadow: 1.0, gait: 'scuttle', primary: 'amber', secondary: 'cream' },
  hushbulb:   { speed: 3.0, radius: 0.42, head: 1.2, shadow: 0.9, gait: 'bounce', primary: 'twilight', secondary: 'teal' },
});

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = u => u * u * (3 - 2 * u);
const wrapAngle = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const bump = (u, a, b) => (u <= a || u >= b) ? 0 : Math.sin(((u - a) / (b - a)) * Math.PI);

export class Actor {
  constructor(game, id, model, { palette = null, source = 'glb' } = {}) {
    this.game = game; this.id = id; this.spec = SPECIES[id]; this.source = source;
    this.isKeeper = id === 'keeper';
    this.root = new THREE.Group(); this.root.name = 'actor_' + id;
    this.model = model; this.root.add(model);
    model.position.set(0, 0, 0);
    this.body = model.getObjectByName('body');
    this.restY = model.userData.restY ?? this.body.position.y;
    this.nodes = new Map();
    model.traverse(n => {
      if (n !== model) { this.nodes.set(n.name, n); n.userData.rest = { p: n.position.clone(), r: n.rotation.clone(), s: n.scale.clone() }; }
      if (n.isMesh) {
        // Each actor owns its materials so fades/recolours/glows stay local.
        n.material = n.material.clone(); n.material.userData.key = (n.material.name || '').split('_')[0];
        n.material.userData.baseColor = n.material.color.clone();
        n.material.userData.baseEmissive = n.material.emissiveIntensity;
      }
    });
    this.touched = new Set();
    this.shadow = blobShadow(this.spec.shadow); this.root.add(this.shadow);
    this.heading = 0; this.headingVel = 0; this.vel = new THREE.Vector2(); this.speed = 0; this.moveIntent = new THREE.Vector2();
    this.lookTarget = null; this.lookYaw = 0; this.phase = Math.random() * 10; this.stepPhase = 0;
    this.moves = []; this.goal = null; this.ground = 0; this.hidden = false;
    this.sitting = false; this.blinkAt = 2 + Math.random() * 3; this.blinkT = -1;
    this.emotion = 'idle';
    this.grown = false; this.seed = null;
    if (palette) this.applyPalette(palette);
    if (this.isKeeper) this.rigKeeper();
  }

  get x() { return this.root.position.x; } get z() { return this.root.position.z; }
  get pos() { return this.root.position; }
  place(x, z, heading) { this.root.position.set(x, this.game.island.heightAt(x, z), z); if (heading !== undefined) this.heading = heading; this.root.rotation.y = this.heading; this.ground = this.root.position.y; this.vel.set(0, 0); this.speed = 0; }
  n(name) { const node = this.nodes.get(name); if (node) this.touched.add(node); return node; }
  headWorld(out = new THREE.Vector3()) { return out.set(this.x, this.root.position.y + this.spec.head + (this.spec.hover || 0), this.z); }
  distTo(x, z) { return Math.hypot(this.x - x, this.z - z); }
  face(x, z) { this.heading = Math.atan2(x - this.x, z - this.z); }

  applyPalette(palette) {
    this.model.traverse(n => {
      if (!n.isMesh) return;
      const key = n.material.userData.key, to = palette[key];
      n.material.color.copy(to ? new THREE.Color(PAL[to] || to) : n.material.userData.baseColor);
      if (n.material.emissiveIntensity > 0 && to) n.material.emissive.copy(n.material.color);
    });
  }

  /** Add the amber friendship seed ornament (growth milestone). */
  setGrown(on) {
    this.grown = on;
    if (on && !this.seed) {
      const orn = this.nodes.get('ornament') || this.body;
      const h = this.model.userData.nominalHeight || 1;
      const seed = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: PAL.amber, emissive: PAL.amber, emissiveIntensity: 0.45, flatShading: true, roughness: 0.6 }));
      seed.name = 'friendship_seed'; seed.scale.set(0.075, 0.095, 0.06);
      const spot = SEED_SPOT[this.id] || [0, h * 0.65, 0.38]; seed.position.fromArray(spot);
      seed.userData.rest = { p: seed.position.clone(), r: seed.rotation.clone(), s: seed.scale.clone() };
      const glow = halo('amber', 0.45, 0.5); seed.add(glow); glow.scale.setScalar(6);
      orn.add(seed); this.seed = seed; this.nodes.set('friendship_seed', seed);
    }
    if (this.seed) this.seed.visible = on;
  }

  /** One-shot performance layered over locomotion. Resolves when finished. */
  perform(name, opts = {}) {
    const fn = MOVES[name]; if (!fn) return Promise.resolve();
    const dur = opts.dur ?? fn.dur ?? 1;
    return new Promise(resolve => {
      // Replace same-named move instead of stacking.
      this.moves = this.moves.filter(m => { if (m.name === name) { m.resolve(); return false; } return true; });
      this.moves.push({ name, fn, t: 0, dur, opts, resolve });
    });
  }
  stopMoves() { this.moves.forEach(m => m.resolve()); this.moves = []; }
  isPerforming(name) { return this.moves.some(m => !name || m.name === name); }

  /** Scripted straight-line walk with collision. */
  walkTo(x, z, { speed = this.spec.speed * 0.8, tol = 0.25, face = null, run = false } = {}) {
    if (this.goal) this.goal.resolve(false);
    const sp = run ? this.spec.speed * 1.25 : speed, dist = Math.hypot(x - this.x, z - this.z);
    // A scripted walk can never hang: it gives up when blocked or after a generous time limit.
    return new Promise(resolve => { this.goal = { x, z, speed: sp, tol, face, resolve, left: 2 + dist / sp * 2.5, stuck: 0, lx: this.x, lz: this.z }; });
  }
  stopGoal() { if (this.goal) { this.goal.resolve(false); this.goal = null; } }

  // ---------- per-frame ----------
  update(dt, t) {
    if (this.goal) {
      const g = this.goal, dx = g.x - this.x, dz = g.z - this.z, d = Math.hypot(dx, dz);
      g.left -= dt;
      const moved = Math.hypot(this.x - g.lx, this.z - g.lz); g.lx = this.x; g.lz = this.z;
      g.stuck = moved < 0.25 * dt ? g.stuck + dt : 0;
      const giveUp = g.left <= 0 || (g.stuck > 0.8 && d < 1.5);
      if (d < g.tol || giveUp) { this.goal = null; this.moveIntent.set(0, 0); if (g.face) this.face(g.face[0], g.face[1]); g.resolve(d < g.tol); }
      else { const s = Math.min(1, d / 0.7); this.moveIntent.set(dx / d * s, dz / d * s); this.intentSpeed = g.speed; }
    }
    this.integrate(dt);
    this.animate(dt, t);
  }

  integrate(dt) {
    const want = this.moveIntent, maxSpeed = this.intentSpeed || this.spec.speed;
    const tx = want.x * maxSpeed, tz = want.y * maxSpeed;
    const accel = 1 - Math.exp(-dt * (want.lengthSq() > 0.001 ? 12 : 16));
    this.vel.x += (tx - this.vel.x) * accel; this.vel.y += (tz - this.vel.y) * accel;
    this.speed = this.vel.length();
    if (this.speed > 0.02) {
      const p = { x: this.x, z: this.z };
      const col = this.game.island.collision;
      col.move(p, this.vel.x * dt, this.vel.y * dt, this.spec.radius, { water: !(this.spec.swim || this.spec.fly || this.ignoreWater) });
      this.root.position.x = p.x; this.root.position.z = p.z;
      if (want.lengthSq() > 0.01) this.heading = Math.atan2(this.vel.x, this.vel.y);
    }
    const gy = this.game.island.heightAt(this.x, this.z);
    const swimDip = this.spec.swim && this.game.island.collision.inWater(this.x, this.z, 0.4) ? -0.12 : 0;
    this.ground += (gy + swimDip - this.ground) * (1 - Math.exp(-dt * 14));
    if (!this.scriptY) this.root.position.y = this.ground;
    // Smooth heading with a little angular velocity so turns can lean.
    const cur = this.root.rotation.y, diff = wrapAngle(this.heading - cur);
    const turn = diff * (1 - Math.exp(-dt * 10));
    this.headingVel = turn / Math.max(dt, 1e-4);
    this.root.rotation.y = cur + turn;
  }

  resetPose() {
    for (const node of this.touched) { const r = node.userData.rest; if (!r) continue; node.position.copy(r.p); node.rotation.copy(r.r); node.scale.copy(r.s); }
    this.touched.clear();
    const b = this.body; b.position.set(0, this.restY, 0); b.rotation.set(0, 0, 0); b.scale.set(1, 1, 1); this.touched.add(b);
    b.userData.rest = b.userData.rest || { p: new THREE.Vector3(0, this.restY, 0), r: new THREE.Euler(), s: new THREE.Vector3(1, 1, 1) };
  }

  animate(dt, t) {
    this.resetPose();
    const b = this.body, sp = this.speed, moving = sp > 0.25, tt = t + this.phase;
    const pose = { y: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 };
    // Idle breathing and personality sway.
    pose.sy += Math.sin(tt * 2.4) * 0.018; pose.sx -= Math.sin(tt * 2.4) * 0.009; pose.sz -= Math.sin(tt * 2.4) * 0.009;
    pose.rz += Math.sin(tt * 1.3) * 0.02;
    if (this.spec.hover) pose.y += this.spec.hover + Math.sin(tt * 2.1) * 0.08;
    // Gait.
    if (this.isKeeper) this.keeperGait(pose, dt, sp);
    else if (moving) GAITS[this.spec.gait]?.(this, pose, dt, sp, tt);
    else this.stepPhase = 0;
    // Lean into turns (clamped; never extreme).
    pose.rz += clamp(-this.headingVel * 0.035 * Math.min(1, sp / 2), -0.16, 0.16);
    if (this.sitting) { pose.sy *= 0.9; pose.y -= 0.03; }
    // Look toward a target (head/face turn + small body yaw).
    let lookYaw = 0;
    if (this.lookTarget) {
      const lt = this.lookTarget, ang = Math.atan2(lt.x - this.x, lt.z - this.z);
      lookYaw = clamp(wrapAngle(ang - this.root.rotation.y), -1.1, 1.1);
    }
    this.lookYaw += (lookYaw - this.lookYaw) * (1 - Math.exp(-dt * 6));
    pose.ry += this.lookYaw * 0.45;
    const face = this.n('face'); if (face) face.rotation.y += this.lookYaw * 0.5;
    // Species flourish (ears, leaves, fins) always alive.
    FLOURISH[this.id]?.(this, tt, sp, dt);
    // One-shot moves.
    for (let i = this.moves.length - 1; i >= 0; i--) {
      const m = this.moves[i]; m.t += dt; const u = Math.min(1, m.t / m.dur);
      m.fn(this, u, pose, m.opts, tt);
      if (u >= 1) { this.moves.splice(i, 1); m.resolve(); }
    }
    // Blink.
    this.blink(dt, tt);
    b.position.y = this.restY + pose.y; b.rotation.set(pose.rx, pose.ry, pose.rz); b.scale.set(pose.sx, pose.sy, pose.sz);
    // Friendship seed shimmer.
    if (this.seed?.visible) { this.touched.add(this.seed); this.seed.rotation.y = tt * 1.5; this.seed.position.y = this.seed.userData.rest.p.y + Math.sin(tt * 3) * 0.02; }
    // Contact shadow shrinks while airborne.
    const air = Math.max(0, pose.y - (this.spec.hover || 0));
    const sh = this.spec.shadow * (1 - Math.min(0.5, air * 0.8)) * (this.spec.hover ? 0.75 : 1);
    this.shadow.scale.set(sh, 1, sh * 0.85); this.shadow.position.y = 0.03 - (this.root.position.y - this.ground);
  }

  blink(dt, tt) {
    this.blinkAt -= dt;
    if (this.blinkAt <= 0) { this.blinkT = 0; this.blinkAt = 2.2 + Math.random() * 3.4; }
    let k = 1;
    if (this.blinkT >= 0) { this.blinkT += dt; k = 1 - bump(this.blinkT / 0.16, 0, 1) * 0.88; if (this.blinkT > 0.16) this.blinkT = -1; }
    if (this.eyesClosed) k = 0.14;
    if (k === 1) return;
    for (const name of ['eye_left', 'eye_right']) { const e = this.n(name); if (e) e.scale.y = e.userData.rest.s.y * k; }
  }

  // ---------- Keeper ----------
  rigKeeper() {
    const body = this.body;
    const hip = (side, x) => {
      const g = new THREE.Group(); g.name = 'hip_' + side; g.position.set(x, 0.41, 0); body.add(g);
      for (const part of ['leg_' + side, 'boot_' + side]) {
        const m = this.nodes.get(part); if (!m) continue;
        g.attach(m); m.userData.rest = { p: m.position.clone(), r: m.rotation.clone(), s: m.scale.clone() };
      }
      g.userData.rest = { p: g.position.clone(), r: g.rotation.clone(), s: g.scale.clone() };
      this.nodes.set(g.name, g); return g;
    };
    hip('left', -0.12); hip('right', 0.12);
  }
  keeperGait(pose, dt, sp) {
    const moving = sp > 0.2;
    const k = Math.min(1, sp / this.spec.speed);
    const prev = this.stepPhase;
    this.stepPhase += dt * (moving ? 2.2 + sp * 1.9 : 0);
    const ph = this.stepPhase;
    if (!moving) { this.stepPhase = 0; }
    const swing = Math.sin(ph) * 0.7 * k;
    const hl = this.n('hip_left'), hr = this.n('hip_right');
    if (hl) hl.rotation.x = swing; if (hr) hr.rotation.x = -swing;
    for (const [name, s] of [['hand_left', -1], ['hand_right', 1]]) {
      const h = this.n(name); if (!h) continue;
      h.position.z += Math.sin(ph) * 0.13 * k * s; h.position.y += Math.abs(Math.sin(ph)) * 0.025 * k;
    }
    pose.y += Math.abs(Math.sin(ph)) * 0.06 * k;
    pose.rx += 0.09 * k; // lean forward into the walk
    pose.sy += Math.abs(Math.cos(ph)) * 0.02 * k;
    const cape = this.n('rain_cape'); if (cape) { cape.rotation.x -= 0.12 * k + Math.sin(ph * 2) * 0.03 * k; cape.scale.x *= 1 + 0.04 * k; }
    const hair = this.n('hair'); if (hair) hair.position.y += Math.abs(Math.cos(ph)) * 0.012 * k;
    const sat = this.n('satchel'); if (sat) sat.rotation.x = Math.sin(ph) * 0.18 * k;
    // Footfall events (dust puffs + footsteps).
    if (moving && Math.floor(prev / Math.PI) !== Math.floor(ph / Math.PI)) this.game.onFootstep?.(this, Math.floor(ph / Math.PI) % 2);
  }
}

// Where the amber friendship seed sits on each body (in ornament space).
const SEED_SPOT = {
  tumbletuft: [0, 1.02, -0.02], foldfern: [0, 1.28, 0.02], puddleloop: [0, 0.8, 0.36], siltbell: [0, 1.0, 0],
  whirli: [0, 1.1, 0.05], kitefin: [0, 1.25, 0.05], glintot: [0, 0.78, 0.1], hushbulb: [0, 1.12, 0.05],
};

// ---------- Gaits: personality in motion ----------
const GAITS = {
  trot(a, p, dt, sp) { // Tumbletuft: eager little bounding hops, leaves flapping
    a.stepPhase += dt * (5 + sp * 2.2);
    const h = Math.abs(Math.sin(a.stepPhase));
    p.y += h * 0.11; p.sy += (h - 0.5) * 0.08; p.sx -= (h - 0.5) * 0.04; p.rx += 0.12 - h * 0.1;
    ['foot_0', 'foot_3'].forEach(n => { const f = a.n(n); if (f) f.position.z += Math.sin(a.stepPhase) * 0.07; });
    ['foot_1', 'foot_2'].forEach(n => { const f = a.n(n); if (f) f.position.z -= Math.sin(a.stepPhase) * 0.07; });
  },
  waddle(a, p, dt, sp) { // Foldfern / Siltbell: side-to-side rock
    a.stepPhase += dt * (4.5 + sp * 1.8);
    p.rz += Math.sin(a.stepPhase) * 0.13; p.y += Math.abs(Math.sin(a.stepPhase)) * 0.05; p.rx += 0.05;
    ['foot_0', 'foot_2'].forEach(n => { const f = a.n(n); if (f) f.position.y += Math.max(0, Math.sin(a.stepPhase)) * 0.05; });
    ['foot_1', 'foot_3'].forEach(n => { const f = a.n(n); if (f) f.position.y += Math.max(0, -Math.sin(a.stepPhase)) * 0.05; });
  },
  paddle(a, p, dt, sp) { // Puddleloop: smooth glide, flippers row
    a.stepPhase += dt * (6 + sp);
    p.y += Math.sin(a.stepPhase * 0.5) * 0.03; p.rx += 0.06;
    for (let i = 0; i < 4; i++) { const f = a.n('foot_' + i); if (f) f.rotation.y = Math.sin(a.stepPhase + (i % 2) * Math.PI) * 0.6; }
  },
  hop(a, p, dt, sp) { // Whirli: springy two-footed hops
    a.stepPhase += dt * (4.2 + sp * 1.4);
    const h = Math.abs(Math.sin(a.stepPhase));
    p.y += h * 0.16; p.sy += (h - 0.45) * 0.12; p.sx -= (h - 0.45) * 0.06;
  },
  hover(a, p, dt, sp) { // Kitefin: glides and banks, tail streams
    a.stepPhase += dt * 3;
    p.rx += 0.18 * Math.min(1, sp / 2); p.y += Math.sin(a.stepPhase) * 0.05;
  },
  scuttle(a, p, dt, sp) { // Glintot: busy six-legged ripple
    a.stepPhase += dt * (11 + sp * 3);
    p.y += Math.abs(Math.sin(a.stepPhase * 2)) * 0.025; p.rz += Math.sin(a.stepPhase) * 0.04;
    for (let i = 0; i < 6; i++) { const f = a.n('foot_' + i); if (f) f.position.y += Math.max(0, Math.sin(a.stepPhase + i * 1.05)) * 0.05; }
  },
  bounce(a, p, dt, sp) { // Hushbulb: soft cautious bobs, petals flutter
    a.stepPhase += dt * (5 + sp);
    const h = Math.abs(Math.sin(a.stepPhase));
    p.y += h * 0.07; p.sy += (h - 0.5) * 0.06;
  },
};

// ---------- Always-on flourishes (named-node wiggles) ----------
const FLOURISH = {
  tumbletuft(a, t, sp) {
    const w = 0.08 + Math.min(0.25, sp * 0.06);
    const L = a.n('leaf_left'), M = a.n('leaf_middle'), R = a.n('leaf_right');
    if (L) L.rotation.z += Math.sin(t * 3.1) * w; if (R) R.rotation.z -= Math.sin(t * 3.1 + 0.6) * w;
    if (M) M.rotation.x += Math.sin(t * 2.3) * w * 0.6;
    const tail = a.n('tail'), ts = a.n('tail_seed');
    const wag = Math.sin(t * (sp > 0.3 ? 14 : 4)) * (sp > 0.3 ? 0.35 : 0.15);
    if (tail) tail.rotation.y += wag; if (ts) ts.position.x += wag * 0.12;
  },
  foldfern(a, t) {
    const c = a.n('crown'); if (c) c.rotation.z += Math.sin(t * 2) * 0.12;
    ['cape_left', 'cape_right'].forEach((n, i) => { const m = a.n(n); if (m) m.rotation.z += Math.sin(t * 1.6 + i) * 0.04 * (i ? -1 : 1); });
  },
  puddleloop(a, t) {
    const h = a.n('head'); if (h) h.position.y += Math.sin(t * 2.2) * 0.015;
    const bb = a.n('bubble_back'); if (bb) { bb.position.y += Math.sin(t * 3) * 0.03; bb.scale.multiplyScalar(1 + Math.sin(t * 3) * 0.08); }
  },
  siltbell(a, t) {
    const c = a.n('handle_crest'); if (c) c.rotation.z += Math.sin(t * 2.6) * 0.1;
  },
  whirli(a, t, sp) {
    // Rotor ribbons idle-twirl; spin hard while moving or blowing.
    const spin = a.rotorSpin = (a.rotorSpin || 0) + (0.6 + sp * 2.5 + (a.rotorBoost || 0)) * 0.016;
    const o = a.n('ornament'); if (o) o.rotation.y += spin;
    a.rotorBoost = Math.max(0, (a.rotorBoost || 0) * 0.97);
  },
  kitefin(a, t) {
    for (const [n, k] of [['fin_left_edge', 1], ['fin_right_edge', -1], ['fin_left_inset', 1], ['fin_right_inset', -1]]) {
      const m = a.n(n); if (m) m.rotation.y += Math.sin(t * 5 + k) * 0.12 * k;
    }
    const tail = a.n('tail'); if (tail) tail.rotation.y += Math.sin(t * 4) * 0.3;
    const ts = a.n('tail_seed'); if (ts) ts.position.x += Math.sin(t * 4 - 0.6) * 0.05;
  },
  glintot(a, t) {
    const glow = 0.35 + Math.sin(t * 2) * 0.12 + (a.glowBoost || 0);
    for (const n of ['ridge_seed_0', 'ridge_seed_1', 'ridge_seed_2', 'glow_window_-1', 'glow_window_1']) {
      const m = a.nodes.get(n); if (m?.material) m.material.emissiveIntensity = glow;
    }
    a.glowBoost = Math.max(0, (a.glowBoost || 0) - 0.01);
  },
  hushbulb(a, t) {
    const open = (a.petalOpen || 0);
    const L = a.n('petal_left'), R = a.n('petal_right');
    if (L) L.rotation.z -= 0.05 + open * 0.45 + Math.sin(t * 1.8) * 0.03;
    if (R) R.rotation.z += 0.05 + open * 0.45 + Math.sin(t * 1.8) * 0.03;
    const il = a.nodes.get('inner_light'); if (il?.material) il.material.emissiveIntensity = 0.25 + open * 0.5 + Math.sin(t * 2.5) * 0.06 + (a.glowBoost || 0);
    a.glowBoost = Math.max(0, (a.glowBoost || 0) - 0.01);
  },
};

// ---------- One-shot moves ----------
// Each: (actor, u in 0..1, pose, opts, t). Durations are defaults.
export const MOVES = {
  hop: Object.assign((a, u, p) => {
    if (u < 0.2) { const k = bump(u, 0, 0.4); p.sy -= k * 0.16; p.sx += k * 0.08; p.sz += k * 0.08; }
    else if (u < 0.8) { const k = (u - 0.2) / 0.6; p.y += Math.sin(k * Math.PI) * 0.45; p.sy += 0.1 * (1 - k); p.sx -= 0.05 * (1 - k); }
    else { const k = bump(u, 0.8, 1); p.sy -= k * 0.14; p.sx += k * 0.08; p.sz += k * 0.08; }
  }, { dur: 0.6 }),
  happy: Object.assign((a, u, p) => {
    const k = (u * 2) % 1;
    if (k < 0.18) { p.sy -= bump(k, 0, 0.36) * 0.15; p.sx += bump(k, 0, 0.36) * 0.07; }
    else if (k < 0.85) { p.y += Math.sin(((k - 0.18) / 0.67) * Math.PI) * 0.35; p.sy += 0.07; }
    else { p.sy -= bump(k, 0.85, 1) * 0.12; }
    p.ry += Math.sin(u * TAU) * 0.25;
  }, { dur: 1.2 }),
  bigHappy: Object.assign((a, u, p) => {
    const k = (u * 3) % 1;
    p.y += Math.sin(k * Math.PI) * 0.5; p.sy += Math.sin(k * Math.PI) * 0.1 - bump(k, 0.85, 1) * 0.15;
    p.ry += u * TAU;
    if (a.isKeeper) { for (const n of ['hand_left', 'hand_right']) { const h = a.n(n); if (h) h.position.y += 0.42 * bump(u, 0, 1); } }
  }, { dur: 1.6 }),
  tumble: Object.assign((a, u, p, o) => {
    // Lean, wobble, topple sideways, roll right over, sit up. (Totally on purpose.)
    const dir = o.dir || 1;
    if (u < 0.25) { p.rz += dir * Math.sin(u / 0.25 * Math.PI * 3) * 0.12; p.rx -= 0.1; }
    else if (u < 0.75) { const k = smooth((u - 0.25) / 0.5); p.rz += dir * k * TAU; p.y += Math.sin(k * Math.PI) * 0.35; p.sy -= Math.sin(k * Math.PI) * 0.08; }
    else { const k = bump(u, 0.75, 1); p.sy -= k * 0.18; p.sx += k * 0.1; }
  }, { dur: 1.5 }),
  tada: Object.assign((a, u, p) => {
    // The "I meant to do that" pose: chin up, chest out, tiny bounce.
    const k = bump(u, 0, 1);
    p.rx -= k * 0.25; p.sy += k * 0.08; p.y += bump(u, 0.1, 0.4) * 0.08;
    const L = a.n('leaf_left'), R = a.n('leaf_right');
    if (L) L.rotation.z += k * 0.6; if (R) R.rotation.z -= k * 0.6;
  }, { dur: 1.3 }),
  bow: Object.assign((a, u, p, o) => {
    const k = bump(u, 0, 1), depth = o.depth || 0.55;
    p.rx += smooth(k) * depth; p.y -= k * 0.04;
  }, { dur: 1.1 }),
  formalBow: Object.assign((a, u, p) => {
    // Kitefin: rise, a flourish of fins, a deep bow mid-air, back up.
    p.y += bump(u, 0, 0.35) * 0.4;
    p.rz += Math.sin(u * TAU * 2) * 0.12 * bump(u, 0, 0.4);
    p.rx += smooth(bump(u, 0.35, 0.9)) * 0.95;
    for (const n of ['fin_top_edge', 'fin_top_inset']) { const m = a.n(n); if (m) m.rotation.x += bump(u, 0.35, 0.9) * 0.6; }
  }, { dur: 1.8 }),
  shake: Object.assign((a, u, p) => { p.ry += Math.sin(u * TAU * 3) * 0.35 * (1 - u); }, { dur: 0.8 }),
  nod: Object.assign((a, u, p) => { p.rx += Math.sin(u * TAU * 2) * 0.18 * (1 - u); }, { dur: 0.7 }),
  bump: Object.assign((a, u, p) => {
    // Friendly bump: lean back (anticipation), boop forward, wobble.
    if (u < 0.35) p.rx -= bump(u, 0, 0.7) * 0.25;
    else if (u < 0.55) { const k = bump(u, 0.35, 0.75); p.rx += k * 0.45; p.sy -= k * 0.08; }
    else p.rz += Math.sin((u - 0.55) * 30) * 0.1 * (1 - u);
  }, { dur: 0.9 }),
  stomp: Object.assign((a, u, p) => {
    // Sprout action: anticipation dip, three stomps, big stretch.
    const k = u * 3.2;
    if (k < 3) { const s = k % 1; p.y += Math.sin(s * Math.PI) * 0.18; p.sy += s < 0.85 ? 0.05 : -0.2 * bump(s, 0.85, 1); }
    else { p.sy += bump(u, 0.94, 1) * 0.15; }
  }, { dur: 1.8 }),
  puff: Object.assign((a, u, p) => {
    // Whirli: an ENORMOUS breath, then a tiny puff.
    if (u < 0.6) { const k = smooth(u / 0.6); p.sx += k * 0.28; p.sz += k * 0.28; p.sy += k * 0.12; p.rx -= k * 0.15; }
    else { const k = bump(u, 0.6, 1); p.sx += (1 - (u - 0.6) / 0.4) * 0.28 * (1 - k); p.rx += k * 0.3; p.sy -= k * 0.06; a.rotorBoost = 6; }
  }, { dur: 1.6 }),
  blow: Object.assign((a, u, p) => {
    p.sx += bump(u, 0, 0.35) * 0.2; p.sz += bump(u, 0, 0.35) * 0.2;
    p.rx += bump(u, 0.35, 1) * 0.35; a.rotorBoost = 10;
  }, { dur: 1.3 }),
  applaud: Object.assign((a, u, p) => {
    // Foldfern: one leaf, then another, then ALL the leaves.
    const steps = [['cape_left', 0.0, 0.5, 1], ['cape_right', 0.2, 0.7, -1], ['cape_back_left', 0.4, 0.9, 1], ['cape_back_right', 0.55, 1, -1]];
    for (const [n, s, e, d] of steps) { const m = a.n(n); if (m) m.rotation.z += d * bump(u, s, e) * 0.9; }
    p.y += bump(u, 0.6, 1) * 0.1;
  }, { dur: 1.8 }),
  pose: Object.assign((a, u, p) => {
    // Foldfern's favourite pose: The Big Leaf.
    const k = smooth(bump(u, 0, 1) > 0.5 ? 1 : bump(u, 0, 1) * 2);
    for (const [n, d] of [['cape_left', 1], ['cape_right', -1], ['cape_back_left', 1], ['cape_back_right', -1]]) { const m = a.n(n); if (m) m.rotation.z += d * k * 0.95; }
    p.rz += k * 0.18; p.y += k * 0.06;
  }, { dur: 2.0 }),
  ringBell: Object.assign((a, u, p) => { p.rz += Math.sin(u * TAU * 4) * 0.22 * (1 - u); }, { dur: 1.2 }),
  sneeze: Object.assign((a, u, p) => {
    // Hushbulb: ah... ah... ACHOO.
    if (u < 0.6) { p.rx -= bump(u, 0, 0.3) * 0.15 + bump(u, 0.28, 0.6) * 0.22; p.sy += u * 0.1; }
    else { const k = bump(u, 0.6, 0.85); p.rx += k * 0.4; p.sy -= k * 0.12; if (u > 0.6 && !a._sneezed) { a._sneezed = true; a.game.fx?.sneezeDots(a); } }
    if (u >= 1) a._sneezed = false;
  }, { dur: 1.6 }),
  glow: Object.assign((a, u) => { a.glowBoost = Math.sin(u * Math.PI) * 1.1; if (a.id === 'hushbulb') a.petalOpen = Math.max(a.petalOpen || 0, Math.sin(u * Math.PI)); }, { dur: 1.4 }),
  reflect: Object.assign((a, u, p) => {
    // Glintot checks its reflection: turn, pause, admire, glint.
    p.ry += smooth(bump(u, 0, 1)) * 0.9; p.rx -= bump(u, 0.3, 0.7) * 0.12; a.glowBoost = bump(u, 0.45, 0.65) * 0.9;
  }, { dur: 1.6 }),
  circle: Object.assign((a, u, p) => { p.ry += u * TAU; }, { dur: 1.4 }),
  spin: Object.assign((a, u, p) => { p.ry += smooth(u) * TAU; p.y += bump(u, 0, 1) * 0.12; a.rotorBoost = 8; }, { dur: 1.0 }),
  wobble: Object.assign((a, u, p) => { p.rz += Math.sin(u * TAU * 3) * 0.18 * (1 - u); }, { dur: 0.9 }),
  float: Object.assign((a, u, p) => { p.y += Math.sin(u * Math.PI) * 0.25; p.rz += Math.sin(u * TAU * 2) * 0.08; }, { dur: 1.6 }),
  shiver: Object.assign((a, u, p) => { p.sx += Math.sin(u * 80) * 0.02; p.rz += Math.sin(u * 70) * 0.03; }, { dur: 0.6 }),
  push: Object.assign((a, u, p) => {
    // Keeper nudges something: crouch, push forward, recover.
    p.rx += bump(u, 0.15, 0.7) * 0.32; p.y -= bump(u, 0, 0.5) * 0.05;
    for (const n of ['hand_left', 'hand_right']) { const h = a.n(n); if (h) h.position.z += bump(u, 0.2, 0.75) * 0.2; }
  }, { dur: 0.75 }),
  wave: Object.assign((a, u) => { const h = a.n('hand_right'); if (h) { h.position.y += 0.5 * bump(u, 0, 1); h.position.x += Math.sin(u * TAU * 3) * 0.06; } }, { dur: 1.1 }),
  sit: Object.assign((a, u, p) => { p.sy -= smooth(Math.min(1, u * 3)) * 0.12; p.y -= 0.04 * Math.min(1, u * 3); }, { dur: 99 }),
};
