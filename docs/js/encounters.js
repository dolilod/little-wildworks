// Creature encounters: each has a visible setup, a funny intro loop, one small
// shared success, then the shared acceptance flow. States are explicit:
// unseen → noticed → helping → friend.
import * as THREE from 'three';
import { LINES } from './content.js';
import { mesh, mat, leafGeometry, PAL, halo, iconSprite } from './props.js';
import { backOut, CANCEL } from './story.js';
import { pick } from './game.js';

const SEED_ICON = 'assets/ui/item-seed.svg';

/** Base: positions + an interruptible ambient loop. */
class Encounter {
  constructor(story, id, { spot, home }) {
    this.story = story; this.g = story.g; this.id = id; this.spot = spot; this.home = home;
    this.a = this.g.actors[id]; this.def = this.g.creatureDefs[id];
    this.loopToken = null; this.step = null;
  }
  get state() { return this.story.state[this.id]; }
  set state(s) { this.story.setState(this.id, s); }
  setup() { this.a.place(this.spot.x, this.spot.z, this.spot.h ?? 0.6); this.startLoop(); }
  near(r) { return this.a.distTo(this.g.keeper.x, this.g.keeper.z) < r; }
  startLoop() {
    if (this.loopToken || !this.ambient) return;
    const token = this.loopToken = { cancelled: false };
    const run = async () => {
      while (!token.cancelled) {
        try { await this.ambient(token); } catch (e) { if (e !== CANCEL) console.error(e); }
        if (!token.cancelled) await this.g.wait(0.2);
      }
    };
    run();
  }
  stopLoop() {
    if (this.loopToken) this.loopToken.cancelled = true; this.loopToken = null;
    this.a.stopGoal(); this.a.stopMoves(); this.a.scripted = false; this.a.scriptY = false;
  }
  /** Await something inside an ambient loop; throws CANCEL once interrupted. */
  async step_(token, p) { await p; if (token.cancelled) throw CANCEL; }
  greetOnce(r = 6) {
    const g = this.g;
    if (this.state === 'unseen' && this.near(r) && !g.busy && !g.titleMode && !g.inCutscene) { this.state = 'noticed'; this.onNoticed?.(); }
    // Leash: a not-yet-friend never wanders off from its own little stage.
    const a = this.a;
    if (this.state !== 'friend' && !a.scripted && Math.hypot(a.x - this.spot.x, a.z - this.spot.z) > 7) { a.stopGoal(); a.place(this.spot.x, this.spot.z); }
  }
  goal() { return { text: `Meet the ${this.def.name.toLowerCase()} creature`, icon: `assets/ui/element-${this.def.element}.svg`, pos: { x: this.a.x, z: this.a.z } }; }
  homeBeat(a) { const q = this.g.quirkOf(this.id); a.perform(q.move); if (Math.random() < 0.4) this.g.say(a, pick(LINES[this.id].home)); }
}

// ======================= TUMBLETUFT (first friend) =======================
class Tumbletuft extends Encounter {
  constructor(story) {
    super(story, 'tumbletuft', { spot: { x: -16.4, z: 9.1, h: 1.9 }, home: { x: -10.6, z: 8.5 } });
    const root = this.g.island.root;
    // The flat practice leaf, hinged at its right tip so a seed can tip it into a ramp.
    this.pivot = new THREE.Vector3(-14.1, 0.06, 8.45); this.leafLen = 1.9;
    this.leaf = new THREE.Group(); this.leaf.name = 'practice_leaf'; this.leaf.position.copy(this.pivot);
    const leafMesh = new THREE.Mesh(leafGeometry(0.3), mat('#A9C77E'));
    leafMesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)));
    leafMesh.scale.set(1.15, this.leafLen, 0.75); this.leaf.add(leafMesh);
    const rim = new THREE.Mesh(leafGeometry(0.05), mat('teal')); rim.quaternion.copy(leafMesh.quaternion);
    rim.scale.set(1.3, this.leafLen * 1.07, 0.3); rim.position.set(0.08, -0.03, 0); this.leaf.add(rim);
    const vein = mesh(new THREE.CylinderGeometry(0.018, 0.025, this.leafLen * 0.9, 4), 'teal', { pos: [-this.leafLen * 0.47, 0.06, 0], rot: [0, 0, Math.PI / 2] });
    this.leaf.add(vein);
    root.add(this.leaf);
    // The seed, visibly wedged in the wrong place between two pebbles.
    this.seedHome = new THREE.Vector3(-13.35, 0.17, 9.45); this.seedRamp = new THREE.Vector3(-15.85, 0.17, 8.45);
    this.seed = mesh(new THREE.IcosahedronGeometry(0.18, 0), 'amber', { name: 'wedged_seed', material: mat('amber', { glow: 0.25, unique: true }) });
    this.seed.scale.set(1, 1.25, 1); root.add(this.seed);
    this.seedGlow = halo('amber', 0.9, 0.0); this.seed.add(this.seedGlow);
    this.pebbles = [[-13.2, 9.55], [-13.7, 9.25]].map(([x, z]) => { const p = mesh(new THREE.IcosahedronGeometry(0.16, 0), 'cream', { pos: [x, 0.08, z], scale: [1, 0.6, 0.9] }); root.add(p); return p; });
    this.tilt = 0;
    const done = this.state === 'friend';
    this.seed.position.copy(done ? this.seedRamp : this.seedHome);
    this.setTilt(done ? 1 : 0);
  }
  setTilt(u) { this.tilt = u; this.leaf.rotation.z = -0.31 * u; }
  /** World point on the practice leaf (0 = high far end, 1 = low tip). */
  onLeaf(s, lat = 0) {
    const L = this.leafLen, ang = 0.31 * this.tilt;
    const x = this.pivot.x - Math.cos(ang) * L * (1 - s), y = this.pivot.y + Math.sin(ang) * L * (1 - s) + 0.06;
    return new THREE.Vector3(x, y, this.pivot.z + lat);
  }
  update(dt) {
    if (this.state === 'friend') return;
    this.greetOnce(6.5);
    const glow = this.state === 'noticed' || this.state === 'unseen';
    this.seedGlow.material.opacity += ((glow && this.step !== 'ramp' ? 0.55 + Math.sin(this.g.time * 4) * 0.2 : 0) - this.seedGlow.material.opacity) * 0.1;
    if (glow && this.step !== 'ramp') this.seed.rotation.z = Math.sin(this.g.time * 5) * 0.15; // it wiggles, clearly stuck
  }
  async onNoticed() {
    await this.g.wait(0.2);
    if (this.state !== 'noticed') return;
    this.a.lookTarget = this.g.keeper.pos;
    await this.story.talk('tumbletuft', [LINES.tumbletuft.notice[0], ...LINES.tumbletuft.request]);
    this.a.lookTarget = null;
  }
  async ambient(token) {
    const a = this.a, g = this.g, s = (p) => this.step_(token, p);
    if (this.state === 'friend' || this.state === 'helping') { await s(g.wait(1)); return; }
    // Climb onto the flat leaf, try very hard to slide... and tumble off. On purpose.
    await s(a.walkTo(this.onLeaf(0.12).x, this.pivot.z, { tol: 0.2 }));
    a.face(this.pivot.x + 3, this.pivot.z);
    const loud = this.near(10);
    if (loud) this.say(pick(LINES.tumbletuft.intro.slice(0, 2)));
    await s(a.perform('shiver', { dur: 0.9 }));
    await s(a.perform('shiver', { dur: 0.6 }));
    const from = a.pos.clone();
    a.scripted = true;
    const tumble = a.perform('tumble', { dir: 1 });
    await s(g.tween(1.2, e => { a.root.position.z = from.z + e * 0.8; a.root.position.x = from.x + e * 0.25; }));
    await s(tumble);
    a.scripted = false;
    a.lookTarget = g.keeper.pos;
    if (this.near(10)) this.say(pick(LINES.tumbletuft.intro.slice(2)));
    await s(a.perform('tada'));
    await s(g.wait(1.8 + Math.random()));
    a.lookTarget = null;
    await s(a.walkTo(this.spot.x, this.spot.z, { tol: 0.3 }));
    a.face(this.pivot.x, this.pivot.z);
    await s(g.wait(1.2));
  }
  say(t) { this.story.say('tumbletuft', t); }
  interactables(list) {
    if (this.state === 'friend' || this.g.busy) return;
    if (this.step !== 'ramp') {
      list.push({ id: 'tumbletuft_seed', x: this.seed.position.x, z: this.seed.position.z, r: 1.7, ring: 0.45,
        label: 'Nudge the seed', short: 'Nudge', icon: SEED_ICON, onAction: () => this.help() });
    } else {
      const top = this.onLeaf(0);
      list.push({ id: 'tumbletuft_ramp', x: top.x - 0.3, z: top.z, r: 1.9, ring: 0.6,
        label: 'Take a turn on the ramp', short: 'Slide!', icon: 'assets/ui/control-interact.svg', onAction: () => this.yourTurn() });
    }
  }
  goal() {
    if (this.step === 'ramp') { const t = this.onLeaf(0); return { text: 'Take a turn on the ramp!', icon: 'assets/ui/control-interact.svg', pos: { x: t.x, z: t.z, h: 1.4 } }; }
    if (this.state === 'unseen') return { text: 'Find the little leafy creature', icon: 'assets/ui/element-sprout.svg', pos: { x: this.a.x, z: this.a.z, h: 1.9 } };
    return { text: 'Nudge the seed under the flat leaf', icon: SEED_ICON, pos: { x: this.seed.position.x, z: this.seed.position.z, h: 1.2 } };
  }

  async help() {
    const g = this.g, st = this.story, a = this.a, k = g.keeper;
    await g.run(async () => {
      this.state = 'helping'; this.stopLoop(); a.scripted = true;
      st.hold(true);
      a.lookTarget = this.seed.position;
      // Keeper steps beside the seed and gives it a nudge (anticipation → action → reaction).
      await st.keeperWalk(this.seed.position.x + 0.55, this.seed.position.z + 0.25, [this.seed.position.x, this.seed.position.z]);
      await k.perform('push');
      g.audio.tick();
      const from = this.seed.position.clone(), to = this.seedRamp.clone();
      const pebbleKick = this.pebbles.map(p => p.position.clone());
      g.fx.puff(from.x, 0.1, from.z, { count: 5 });
      await g.tween(1.15, (e, u) => {
        this.seed.position.lerpVectors(from, to, e); this.seed.position.y = 0.17 + Math.abs(Math.sin(u * Math.PI * 3)) * 0.12 * (1 - u);
        this.seed.rotation.x -= 0.25; this.pebbles.forEach((p, i) => p.position.x = pebbleKick[i].x + Math.sin(u * 20) * 0.02 * (1 - u));
      }, { ease: u => 1 - Math.pow(1 - u, 2) });
      // The leaf tips up into a tiny ramp, with a little overshoot.
      g.audio.boing(); g.fx.leafBurst(to.x, 0.3, to.z, { count: 6 });
      await g.tween(0.6, e => this.setTilt(e), { ease: backOut });
      g.camera.nudge(0.04);
      a.perform('happy'); this.say(LINES.tumbletuft.ramp[0]);
      await g.wait(1.4);
      // Tumbletuft takes the first go: climb, wheee, land (no tumble!).
      a.lookTarget = null;
      await a.walkTo(this.onLeaf(0).x - 0.55, this.pivot.z, { tol: 0.15 });
      const top = this.onLeaf(0.02);
      await st.hop(a, top.x, top.z, { y: top.y, height: 0.4 });
      a.face(this.pivot.x + 2, this.pivot.z);
      await g.wait(0.25);
      this.say(LINES.tumbletuft.ramp[1]); g.audio.slideWhee(1.0);
      await this.slideDown(a, 0.75);
      a.perform('tada'); this.say(LINES.tumbletuft.ramp[2]);
      await g.wait(2.2);
      a.lookTarget = k.pos; a.face(k.x, k.z);
      this.say(LINES.tumbletuft.yourTurn[0]); a.perform('happy');
      this.step = 'ramp';
      a.scripted = false;
      st.hold(false);
    });
  }
  async slideDown(actor, dur) {
    const g = this.g; actor.scripted = true; actor.scriptY = true;
    await g.tween(dur, e => { const p = this.onLeaf(e); actor.root.position.copy(p); }, { ease: u => u * u });
    const end = this.onLeaf(1), land = new THREE.Vector3(end.x + 0.9, 0, end.z + 0.1);
    actor.perform('hop', { dur: 0.45 });
    await g.tween(0.42, (e, u) => { actor.root.position.set(end.x + (land.x - end.x) * u, end.y * (1 - u) + Math.sin(u * Math.PI) * 0.3, end.z + (land.z - end.z) * u); });
    actor.ground = 0; actor.scriptY = false; actor.scripted = false;
    g.fx.puff(land.x, 0.05, land.z, { count: 6 });
  }

  async yourTurn() {
    const g = this.g, st = this.story, a = this.a, k = g.keeper;
    await g.run(async () => {
      st.hold(true);
      const top = this.onLeaf(0.02);
      await st.keeperWalk(top.x - 0.65, top.z, [top.x, top.z]);
      await st.hop(k, top.x, top.z, { y: top.y, height: 0.45 });
      k.face(this.pivot.x + 2, this.pivot.z);
      k.perform('sit', { dur: 0.5 });
      await g.wait(0.3);
      g.audio.slideWhee(1.0);
      a.lookTarget = k.pos;
      await this.slideDown(k, 0.8);
      k.scripted = true;
      k.perform('bigHappy');
      a.perform('happy'); this.say(pick(LINES.tumbletuft.cheer));
      await g.wait(1.4);
      this.step = null;
      await st.acceptFriend('tumbletuft');
      st.hold(false);
    });
  }
  setup() { super.setup(); }
  onFriendPlaced() { this.setTilt(1); this.seed.position.copy(this.seedRamp); this.seedGlow.material.opacity = 0; }
  propPoints() { return { 'prop:tumbletuft_seed': { x: this.seedHome.x, z: this.seedHome.z, r: 1.4 }, 'prop:tumbletuft_ramp': { x: this.pivot.x - this.leafLen - 0.3, z: this.pivot.z, r: 1.6 } }; }
  homeBeat(a) {
    const toy = this.story.toys.leaf_slide;
    if (toy.complete && !toy.riding && a.distTo(this.g.keeper.x, this.g.keeper.z) < 15 && Math.random() < 0.6) toy.friendSoloRide(a);
    else { a.perform(Math.random() < 0.5 ? 'tumble' : 'tada'); if (Math.random() < 0.4) this.g.say(a, pick(LINES.tumbletuft.home)); }
  }
}

// ======================= WHIRLI (gust, main) =======================
class Whirli extends Encounter {
  constructor(story) {
    super(story, 'whirli', { spot: { x: -4.7, z: 4.3, h: 1.0 }, home: { x: -3.6, z: 3.0 } });
    const root = this.g.island.root;
    // Practice pinwheel on a stick, its ribbon tangled round and round the blades.
    this.pw = new THREE.Group(); this.pw.name = 'practice_pinwheel'; this.pw.position.set(-3.55, 0, 5.05);
    this.pw.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.25, 5), 'cream', { pos: [0, 0.62, 0] }));
    this.rotor = new THREE.Group(); this.rotor.position.set(0, 1.25, 0.06); this.pw.add(this.rotor);
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(leafGeometry(0.12), mat(i % 2 ? 'teal' : 'clay')); b.scale.set(0.32, 0.42, 0.4); b.rotation.z = i * Math.PI / 2; this.rotor.add(b); }
    this.rotor.add(mesh(new THREE.IcosahedronGeometry(0.06, 0), 'amber', { pos: [0, 0, 0.05] }));
    this.tangle = new THREE.Group(); this.pw.add(this.tangle);
    [[1.2, 0.3], [1.3, -0.4], [1.12, 0.9]].forEach(([y, r]) => this.tangle.add(mesh(new THREE.TorusGeometry(0.2, 0.025, 4, 14), 'clay', { pos: [0, y, 0.05], rot: [0.4 + r, r, 0] })));
    this.tangleTail = mesh(new THREE.BoxGeometry(0.06, 0.55, 0.012), 'clay', { pos: [0.16, 0.92, 0.07], rot: [0, 0, 0.3] }); this.tangle.add(this.tangleTail);
    root.add(this.pw);
    // The single ribbon that DOES move when Whirli puffs.
    this.flag = new THREE.Group(); this.flag.position.set(-3.1, 0, 3.55); root.add(this.flag);
    this.flag.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.9, 5), 'cream', { pos: [0, 0.45, 0] }));
    this.streamer = new THREE.Group(); this.streamer.position.set(0, 0.88, 0); this.streamer.rotation.order = 'YXZ'; this.flag.add(this.streamer);
    this.streamer.add(mesh(new THREE.BoxGeometry(0.07, 0.6, 0.01), 'amber', { pos: [0, -0.3, 0] }));
    this.flutter = 0; this.spin = 0; this.spinV = 0;
    this.step = null; this.pw.visible = this.flag.visible = false;
    const col = this.g.island.collision;
    col.circle('whirli_pinwheel', -3.55, 5.05, 0.14, 'props'); col.circle('whirli_flag', -3.1, 3.55, 0.12, 'props');
  }
  setup() { super.setup(); this.pw.visible = this.flag.visible = true; this.tangle.visible = this.state !== 'friend'; }
  onFriendPlaced() { this.pw.visible = this.flag.visible = true; this.tangle.visible = false; this.spinV = 2; }
  hideProps() { this.pw.visible = this.flag.visible = false; }
  propPoints() { return { 'prop:whirli_pinwheel': { x: this.pw.position.x, z: this.pw.position.z, r: 1.6 } }; }
  update(dt) {
    if (!this.pw.visible) return;
    if (this.state !== 'friend') this.greetOnce(6);
    // Streamer flutter decays; the little pinwheel spins only once untangled.
    this.flutter *= Math.exp(-dt * 1.5);
    const t = this.g.time;
    this.streamer.rotation.y = -0.6; this.streamer.rotation.x = -(0.15 + this.flutter * 1.2 + Math.sin(t * 9) * 0.12 * this.flutter);
    this.spinV *= Math.exp(-dt * 0.6); if (this.tangle.visible) this.spinV = Math.sin(t * 7) * 0.4 * this.flutter;
    this.spin += (this.spinV + (this.tangle.visible ? 0 : 0.6)) * dt; this.rotor.rotation.z = this.spin;
  }
  async onNoticed() {
    await this.g.wait(0.3);
    this.a.lookTarget = this.g.keeper.pos;
    await this.story.talk('whirli', LINES.whirli.request); this.a.lookTarget = null;
  }
  async ambient(token) {
    const a = this.a, g = this.g, s = p => this.step_(token, p);
    if (this.state === 'friend' || this.state === 'helping') { await s(g.wait(1)); return; }
    await s(a.walkTo(this.spot.x, this.spot.z, { tol: 0.25 })); a.face(this.pw.position.x, this.pw.position.z);
    const loud = this.near(10);
    if (loud) this.story.say('whirli', LINES.whirli.intro[0]);
    await s(a.perform('puff'));
    this.flutter = 1; g.fx.swirl(a.x + 0.6, 0.9, a.z + 0.4, { count: 5 }); if (loud) g.audio.gustLoop(0.6);
    await s(g.wait(0.6));
    if (loud) this.story.say('whirli', pick(LINES.whirli.intro.slice(1)));
    a.lookTarget = g.keeper.pos;
    await s(g.wait(2.6 + Math.random()));
    a.lookTarget = null;
    await s(a.perform('wobble'));
    await s(g.wait(1.0));
  }
  interactables(list) {
    if (this.state === 'friend' || this.g.busy) return;
    const p = this.pw.position;
    if (this.step !== 'together') list.push({ id: 'whirli_ribbon', x: p.x, z: p.z, r: 1.7, ring: 0.5, label: 'Untie the tangled ribbon', short: 'Untie', icon: 'assets/ui/item-ribbon.svg', onAction: () => this.untie() });
    else list.push({ id: 'whirli_blow', x: p.x, z: p.z, r: 2.0, ring: 0.6, label: 'Blow on the pinwheel together!', short: 'Blow!', icon: 'assets/ui/element-gust.svg', onAction: () => this.together() });
  }
  goal() {
    const p = this.pw.position;
    if (this.step === 'together') return { text: 'Blow on the pinwheel together!', icon: 'assets/ui/element-gust.svg', pos: { x: p.x, z: p.z, h: 1.9 } };
    if (this.state === 'unseen') return { text: 'Who is puffing so hard by the gate?', icon: 'assets/ui/element-gust.svg', pos: { x: this.a.x, z: this.a.z, h: 1.9 } };
    return { text: "Untie Whirli's tangled pinwheel", icon: 'assets/ui/item-ribbon.svg', pos: { x: p.x, z: p.z, h: 1.9 } };
  }
  async untie() {
    const g = this.g, st = this.story, a = this.a, k = g.keeper;
    await g.run(async () => {
      this.state = 'helping'; this.stopLoop(); a.scripted = true; st.hold(true);
      a.lookTarget = this.pw.position;
      const p = this.pw.position;
      await st.keeperWalk(p.x - 0.6, p.z + 0.45, [p.x, p.z]);
      await k.perform('push'); g.audio.tick();
      // The ribbon unwinds loop by loop and floats over to tie itself on Whirli's knot.
      for (const loop of this.tangle.children.slice(0, 3)) { await g.tween(0.22, e => { loop.scale.setScalar(Math.max(0.01, 1 - e)); loop.rotation.z += 0.3; }); g.audio.tick(); }
      const tail = this.tangleTail, from = tail.getWorldPosition(new THREE.Vector3());
      this.g.island.root.attach(tail);
      const to = a.headWorld();
      await g.tween(0.9, (e, u) => { tail.position.lerpVectors(from, to, e); tail.position.y += Math.sin(u * Math.PI) * 0.8; tail.rotation.z += 0.2; });
      tail.visible = false; this.tangle.visible = false;
      g.fx.sparkle(to.x, to.y, to.z, { count: 10, color: '#D97B60' });
      a.perform('happy'); st.say('whirli', LINES.whirli.untied[0]);
      this.spinV = 3;
      await g.wait(1.6);
      this.step = 'together';
      a.scripted = false; a.lookTarget = k.pos; st.hold(false);
    });
  }
  async together() {
    const g = this.g, st = this.story, a = this.a, k = g.keeper;
    await g.run(async () => {
      st.hold(true); a.scripted = true;
      const p = this.pw.position;
      await st.keeperWalk(p.x - 0.75, p.z + 0.6, [p.x, p.z]);
      await a.walkTo(p.x - 0.35, p.z - 0.85, { tol: 0.2, face: [p.x, p.z] });
      // Anticipation (big breath together) → action (whoosh) → reaction (spin!).
      k.perform('push', { dur: 1.2 }); await a.perform('puff');
      a.perform('blow'); g.audio.gustLoop(1.4); g.audio.cue('gust');
      g.fx.swirl(p.x, 1.1, p.z, { count: 16 }); this.spinV = 22; this.flutter = 1.2;
      st.say('whirli', LINES.whirli.together[0]);
      await g.wait(1.6);
      a.perform('spin');
      await g.wait(0.8);
      await st.acceptFriend('whirli');
      st.hold(false);
    });
  }
  homeBeat(a) {
    const toy = this.story.toys.pinwheel_canopy;
    if (toy.complete && Math.random() < 0.5) { a.perform('blow'); this.g.fx.swirl(a.x, 1, a.z, { count: 6 }); toy.boost(1.5); }
    else super.homeBeat(a);
    this.spinV = Math.max(this.spinV, 4);
  }
}

// ======================= PUDDLELOOP (splash, main) =======================
class Puddleloop extends Encounter {
  constructor(story) {
    super(story, 'puddleloop', { spot: { x: 5.5, z: -1.3, h: -1.2 }, home: { x: 6.3, z: -1.9 } });
    const root = this.g.island.root;
    // Its seed sits in the hole in its own middle (child of the ring body).
    this.seed = mesh(new THREE.IcosahedronGeometry(0.11, 0), 'amber', { material: mat('amber', { glow: 0.3, unique: true }), name: 'puddleloop_seed' });
    this.seed.scale.set(1, 1.3, 1); this.seed.position.set(0, 0.36, -0.04);
    const body = this.a.nodes.get('body'); body.add(this.seed);
    this.seed.userData.rest = { p: this.seed.position.clone(), r: this.seed.rotation.clone(), s: this.seed.scale.clone() };
    // A dry lily pad by the bank for the seed to ride to.
    this.pad = new THREE.Group(); this.pad.position.set(5.75, 0.08, 0.95);
    this.pad.add(mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 9), 'moss'));
    this.pad.add(mesh(new THREE.BoxGeometry(0.62, 0.07, 0.04), 'aqua', { pos: [0.31, 0.01, 0] }));
    this.sprout = new THREE.Group(); this.sprout.position.set(0, 0.04, 0); this.pad.add(this.sprout);
    this.sprout.add(mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.28, 4), 'moss', { pos: [0, 0.14, 0] }));
    const lf = new THREE.Mesh(leafGeometry(0.1), mat('moss')); lf.scale.set(0.16, 0.18, 0.2); lf.position.set(0, 0.26, 0); lf.rotation.z = 0.8; this.sprout.add(lf);
    const lf2 = lf.clone(); lf2.rotation.z = -0.8; this.sprout.add(lf2);
    this.sprout.visible = false;
    root.add(this.pad); this.pad.visible = false;
    this.circleA = 0;
  }
  setup() { super.setup(); this.pad.visible = true; this.seed.visible = true; this.sprout.visible = false; }
  onFriendPlaced() { this.pad.visible = true; this.seed.visible = false; this.sprout.visible = true; }
  hideProps() { this.pad.visible = false; }
  propPoints() { return { 'prop:puddleloop_bank': { x: 4.0, z: -1.0, r: 1.2 } }; }
  update(dt) {
    if (!this.pad.visible) return;
    if (this.state !== 'friend') this.greetOnce(7);
    if (this.seed.visible) { this.seed.rotation.y += dt * 2; }
    this.pad.position.y = 0.08 + Math.sin(this.g.time * 1.4) * 0.015;
  }
  async onNoticed() {
    await this.g.wait(0.3);
    await this.story.talk('puddleloop', LINES.puddleloop.request);
  }
  async ambient(token) {
    const a = this.a, g = this.g, s = p => this.step_(token, p);
    if (this.state === 'friend' || this.state === 'helping') { await s(g.wait(1)); return; }
    // Swim a little loop, peering around for the seed it is sitting on.
    const c = this.spot, r = 0.85;
    for (let i = 0; i < 6; i++) {
      this.circleA += Math.PI / 3;
      await s(a.walkTo(c.x + Math.cos(this.circleA) * r, c.z + Math.sin(this.circleA) * r, { tol: 0.25, speed: 1.6 }));
    }
    if (this.near(10)) this.story.say('puddleloop', pick(LINES.puddleloop.intro));
    await s(a.perform('circle'));
    g.fx.ripple(a.x, a.z, { y: 0.07, size: 1.8 });
    a.lookTarget = g.keeper.pos; await s(g.wait(1.6)); a.lookTarget = null;
  }
  interactables(list) {
    if (this.state === 'friend' || this.g.busy || !this.pad.visible) return;
    list.push({ id: 'puddleloop_seed', x: this.a.x, z: this.a.z, r: 3.0, ring: 0.75, label: 'Point at the seed in its middle', short: 'Point', icon: SEED_ICON, onAction: () => this.help() });
  }
  goal() {
    if (this.state === 'unseen') return { text: 'Something round is going in circles in the pond', icon: 'assets/ui/element-splash.svg', pos: { x: this.a.x, z: this.a.z, h: 1.5 } };
    return { text: 'Help Puddleloop find its seed', icon: SEED_ICON, pos: { x: this.a.x, z: this.a.z, h: 1.5 } };
  }
  async help() {
    const g = this.g, st = this.story, a = this.a, k = g.keeper;
    await g.run(async () => {
      this.state = 'helping'; this.stopLoop(); a.scripted = true; st.hold(true);
      k.face(a.x, a.z); a.face(k.x, k.z);
      await k.perform('wave');
      g.fx.sparkle(a.x, 0.5, a.z, { count: 14 }); g.audio.chime(1);
      a.lookTarget = null; await a.perform('nod', { dur: 1.0 });
      await a.perform('shiver');
      st.say('puddleloop', LINES.puddleloop.found[0]); a.perform('happy');
      await g.wait(2.2);
      st.say('puddleloop', LINES.puddleloop.ferry[0]);
      // Bubble Ferry: float the seed to the dry pad.
      await a.walkTo(this.pad.position.x + 0.55, this.pad.position.z - 0.5, { tol: 0.2, speed: 1.8, face: [this.pad.position.x, this.pad.position.z] });
      const from = this.seed.getWorldPosition(new THREE.Vector3()); this.g.island.root.attach(this.seed);
      const to = this.pad.position.clone().add(new THREE.Vector3(0, 0.18, 0));
      g.audio.cue('splash');
      await g.tween(0.7, (e, u) => { this.seed.position.lerpVectors(from, to, e); this.seed.position.y += Math.sin(u * Math.PI) * 0.6; });
      g.fx.ripple(to.x, to.z, { y: 0.1, size: 2.2 }); g.fx.puff(to.x, 0.15, to.z, { count: 5, color: '#AED8CF' });
      // The seed sprouts on its pad: a little memory of the day it was found.
      this.seed.visible = false; this.sprout.visible = true; this.sprout.scale.setScalar(0.01);
      await g.tween(0.6, e => this.sprout.scale.setScalar(Math.max(0.01, e)), { ease: backOut });
      g.audio.cue('sprout'); a.perform('float');
      await g.wait(0.8);
      await st.acceptFriend('puddleloop');
      st.hold(false);
    });
  }
  homeBeat(a) {
    if (Math.random() < 0.5) { a.perform('float'); this.g.fx.ripple(a.x, a.z, { y: 0.08, size: 1.6 }); }
    else super.homeBeat(a);
  }
}

// ======================= GLINTOT (glimmer, dusk friend) =======================
class Glintot extends Encounter {
  constructor(story) {
    super(story, 'glintot', { spot: { x: -6.3, z: -7.0, h: 0.4 }, home: { x: -5.5, z: -7.7 } });
    const root = this.g.island.root;
    this.lantern = new THREE.Group(); this.lantern.position.set(-7.25, 0, -6.35); root.add(this.lantern);
    this.lantern.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 6), 'cream', { pos: [0, 0.55, 0] }));
    this.lamp = mesh(new THREE.IcosahedronGeometry(1, 0), 'twilight', { pos: [0, 1.25, 0], scale: [0.22, 0.3, 0.22], material: mat('twilight', { unique: true }) });
    this.lantern.add(this.lamp);
    this.lampHalo = halo('amber', 1.6, 0); this.lampHalo.position.set(0, 1.25, 0); this.lantern.add(this.lampHalo);
    this.g.island.addOccluder(this.lantern);
    // The lens on a mushroom stump.
    this.stump = new THREE.Group(); this.stump.position.set(-8.55, 0, -7.95); root.add(this.stump);
    this.stump.add(mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.5, 7), 'cream', { pos: [0, 0.25, 0] }));
    this.stump.add(mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.12, 7), 'clay', { pos: [0, 0.54, 0] }));
    this.lens = new THREE.Group(); this.lens.position.set(-8.55, 0.72, -7.95); root.add(this.lens);
    this.lens.add(mesh(new THREE.TorusGeometry(0.17, 0.035, 5, 14), 'ink'));
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.16, 14), new THREE.MeshStandardMaterial({ color: '#AED8CF', transparent: true, opacity: 0.75, roughness: 0.2, emissive: '#AED8CF', emissiveIntensity: 0.25, side: THREE.DoubleSide }));
    this.lens.add(glass); this.lensGlow = halo('aqua', 0.9, 0.4); this.lens.add(this.lensGlow);
    // The marked cradle beside Glintot.
    this.cradle = new THREE.Group(); this.cradle.position.set(-5.35, 0, -6.05); root.add(this.cradle);
    this.cradle.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.6, 5), 'cream', { pos: [0, 0.3, 0] }));
    this.cradle.add(mesh(new THREE.TorusGeometry(0.2, 0.04, 5, 14), 'amber', { pos: [0, 0.78, 0] }));
    this.cradleMark = halo('amber', 0.8, 0.35); this.cradleMark.position.set(0, 0.78, 0); this.cradle.add(this.cradleMark);
    this.answers = 0;
    for (const o of [this.lantern, this.stump, this.lens, this.cradle]) o.visible = false;
    const col = this.g.island.collision;
    col.circle('glintot_lantern', -7.25, -6.35, 0.16, 'props'); col.circle('glintot_stump', -8.55, -7.95, 0.4, 'props'); col.circle('glintot_cradle', -5.35, -6.05, 0.14, 'props');
  }
  setup() {
    super.setup();
    for (const o of [this.lantern, this.stump, this.lens, this.cradle]) o.visible = true;
  }
  onFriendPlaced() {
    for (const o of [this.lantern, this.stump, this.cradle]) o.visible = true;
    this.lens.visible = true; this.lens.position.set(-5.35, 0.78, -6.05); this.lit = true;
  }
  hideProps() { for (const o of [this.lantern, this.stump, this.lens, this.cradle]) o.visible = false; }
  propPoints() { return { 'prop:glintot_lens': { x: this.stump.position.x, z: this.stump.position.z, r: 1.5 }, 'prop:glintot_cradle': { x: this.cradle.position.x, z: this.cradle.position.z, r: 1.5 } }; }
  update(dt) {
    if (!this.lantern.visible) return;
    if (this.state !== 'friend') this.greetOnce(6.5);
    const t = this.g.time;
    if (this.step !== 'carry' && this.step !== 'placed' && this.step !== 'answer' && this.state !== 'friend') { this.lens.rotation.y = t * 1.2; this.lensGlow.material.opacity = 0.3 + Math.sin(t * 3) * 0.15; }
    if (this.step === 'carry') { const k = this.g.keeper; this.lens.position.set(k.x, k.root.position.y + 1.95 + Math.sin(t * 6) * 0.04, k.z); this.lens.rotation.y = t * 2; }
    const want = this.lit ? 1 : 0; this.litK = (this.litK || 0) + (want - (this.litK || 0)) * (1 - Math.exp(-dt * 3));
    this.lamp.material.color.set(PAL.twilight).lerp(new THREE.Color(PAL.amber), this.litK);
    this.lamp.material.emissive.set(PAL.amber); this.lamp.material.emissiveIntensity = this.litK * 0.6;
    this.lampHalo.material.opacity = this.litK * 0.5;
    this.cradleMark.material.opacity = (this.step === 'carry' ? 0.6 + Math.sin(t * 5) * 0.25 : 0.25);
  }
  async onNoticed() { await this.g.wait(0.3); this.a.lookTarget = this.g.keeper.pos; await this.story.talk('glintot', LINES.glintot.request); this.a.lookTarget = null; }
  async ambient(token) {
    const a = this.a, g = this.g, s = p => this.step_(token, p);
    if (this.state === 'friend' || this.state === 'helping') { await s(g.wait(1)); return; }
    // Polish, polish, polish the dark lantern...
    await s(a.walkTo(this.lantern.position.x + 0.75, this.lantern.position.z - 0.2, { tol: 0.2 }));
    a.face(this.lantern.position.x, this.lantern.position.z);
    if (this.near(10)) this.story.say('glintot', pick(LINES.glintot.intro));
    for (let i = 0; i < 3; i++) { await s(a.perform('shiver', { dur: 0.5 })); await s(g.wait(0.15)); }
    await s(a.perform('reflect'));
    a.lookTarget = g.keeper.pos; await s(g.wait(2.0)); a.lookTarget = null;
  }
  interactables(list) {
    if (this.state === 'friend' || this.g.busy || !this.lantern.visible) return;
    if (!this.step) list.push({ id: 'glintot_lens', x: this.stump.position.x, z: this.stump.position.z, r: 1.6, ring: 0.55, label: 'Pick up the lens', short: 'Pick up', icon: 'assets/ui/item-lens.svg', onAction: () => this.pickLens() });
    else if (this.step === 'carry') list.push({ id: 'glintot_cradle', x: this.cradle.position.x, z: this.cradle.position.z, r: 1.7, ring: 0.5, label: 'Put the lens in the cradle', short: 'Place', icon: 'assets/ui/item-lens.svg', onAction: () => this.placeLens() });
    else if (this.step === 'answer') list.push({ id: 'glintot_answer', x: this.a.x, z: this.a.z, r: 3.0, ring: 0.6, label: `Answer the chime (${this.answers + 1} of 2)`, short: 'Answer', icon: 'assets/ui/element-glimmer.svg', onAction: () => this.answer() });
  }
  goal() {
    if (this.state === 'unseen') return { text: 'Who is polishing a dark lantern on Lantern Rise?', icon: 'assets/ui/element-glimmer.svg', pos: { x: this.a.x, z: this.a.z, h: 1.4 } };
    if (!this.step) return { text: 'Find the lens on the stump', icon: 'assets/ui/item-lens.svg', pos: { x: this.stump.position.x, z: this.stump.position.z, h: 1.6 } };
    if (this.step === 'carry') return { text: 'Put the lens in the glowing cradle', icon: 'assets/ui/item-lens.svg', pos: { x: this.cradle.position.x, z: this.cradle.position.z, h: 1.6 } };
    return { text: 'Answer Glintot\'s chimes (tap twice, no rush)', icon: 'assets/ui/element-glimmer.svg', pos: { x: this.a.x, z: this.a.z, h: 1.4 } };
  }
  async pickLens() {
    const g = this.g, st = this.story;
    await g.run(async () => {
      this.state = 'helping'; this.stopLoop(); st.hold(true);
      await st.keeperWalk(this.stump.position.x + 0.85, this.stump.position.z + 0.45, [this.stump.position.x, this.stump.position.z]);
      await g.keeper.perform('push');
      g.audio.chime(0); this.step = 'carry';
      this.a.lookTarget = g.keeper.pos; this.a.perform('happy');
      st.say('glintot', 'Yes! That one! Bring it here!');
      st.hold(false);
    });
  }
  async placeLens() {
    const g = this.g, st = this.story, a = this.a;
    await g.run(async () => {
      st.hold(true);
      await st.keeperWalk(this.cradle.position.x - 0.5, this.cradle.position.z + 0.55, [this.cradle.position.x, this.cradle.position.z]);
      this.step = 'placed';
      const from = this.lens.position.clone(), to = new THREE.Vector3(this.cradle.position.x, 0.78, this.cradle.position.z);
      g.keeper.perform('push');
      await g.tween(0.5, (e, u) => { this.lens.position.lerpVectors(from, to, e); this.lens.position.y += Math.sin(u * Math.PI) * 0.3; });
      this.lens.rotation.set(0, 0.6, 0);
      g.audio.tick(); g.fx.sparkle(to.x, to.y, to.z, { count: 8, color: '#AED8CF' });
      a.scripted = true;
      await a.walkTo(this.cradle.position.x + 0.15, this.cradle.position.z - 0.85, { tol: 0.2, face: [this.cradle.position.x, this.cradle.position.z] });
      st.say('glintot', LINES.glintot.placed[0]);
      await g.wait(2.2);
      await this.chime();
      this.step = 'answer'; a.scripted = false; a.lookTarget = g.keeper.pos;
      st.hold(false);
    });
  }
  async chime() {
    const g = this.g, a = this.a;
    for (let i = 0; i < 2; i++) { a.perform('glow', { dur: 0.8 }); g.audio.chime(i); await g.wait(0.75); }
    this.story.say('glintot', LINES.glintot.chime[0]);
  }
  async answer() {
    const g = this.g, st = this.story, a = this.a, k = g.keeper;
    await g.run(async () => {
      this.answers++;
      k.face(a.x, a.z); k.perform('wave');
      g.audio.chime(this.answers + 1); g.fx.sparkle(k.x, 1.8, k.z, { count: 6, color: '#E6B85C' });
      a.perform('glow', { dur: 0.7 });
      if (this.answers < 2) { st.say('glintot', 'Ding! One more...'); return; }
      st.hold(true); a.scripted = true;
      // The lens focuses Glintot's own glow: the light was in Glintot all along.
      await g.wait(0.5);
      a.perform('glow', { dur: 2.2 }); g.audio.cue('glimmer');
      g.fx.sparkle(a.x, 0.6, a.z, { count: 26, color: '#E6B85C' }); this.lit = true; g.camera.nudge(0.05);
      st.say('glintot', LINES.glintot.thanks[0]);
      await g.wait(2.6);
      await a.perform('reflect');
      await st.acceptFriend('glintot');
      st.hold(false);
    });
  }
  homeBeat(a) { if (Math.random() < 0.6) a.perform('reflect'); else super.homeBeat(a); }
}

// ======================= FOLDFERN (sprout, optional) =======================
class Foldfern extends Encounter {
  constructor(story) { super(story, 'foldfern', { spot: { x: -15.6, z: 2.5, h: 0.8 }, home: { x: -15.3, z: 3.1 } }); }
  update() { if (this.a.root.visible && this.state !== 'friend') this.greetOnce(5.5); }
  async onNoticed() { await this.g.wait(0.3); await this.story.talk('foldfern', LINES.foldfern.intro); }
  async ambient(token) {
    const a = this.a, g = this.g, s = p => this.step_(token, p);
    if (this.state === 'friend' || this.state === 'helping') { await s(g.wait(1)); return; }
    await s(a.walkTo(this.spot.x, this.spot.z, { tol: 0.3 })); a.face(-12.5, 5);
    a.lookTarget = new THREE.Vector3(-12, 1, 5);           // it watches the slide, longingly
    await s(g.wait(2.2 + Math.random()));
    if (this.near(9) && Math.random() < 0.6) this.story.say('foldfern', pick(['Ahem.', 'A pose, for the slide.', 'The Big Leaf!']));
    await s(a.perform('pose'));
    a.lookTarget = null; await s(g.wait(1.4));
  }
  interactables(list) {
    if (this.state === 'friend' || this.g.busy || !this.a.root.visible) return;
    const rode = this.g.hasFlag('rode:leaf_slide');
    list.push({ id: 'foldfern_invite', x: this.a.x, z: this.a.z, r: 2.2, ring: 0.6, label: rode ? 'Invite Foldfern for a slide turn' : 'Say hello to Foldfern', short: rode ? 'Invite' : 'Hello', icon: 'assets/ui/element-sprout.svg', onAction: () => rode ? this.invite() : this.hello() });
  }
  goal() { return { text: this.g.hasFlag('rode:leaf_slide') ? 'Invite Foldfern to take a slide turn' : 'Ride the slide, then invite Foldfern', icon: 'assets/ui/element-sprout.svg', pos: { x: this.a.x, z: this.a.z, h: 1.9 } }; }
  hello() { this.a.lookTarget = this.g.keeper.pos; this.story.say('foldfern', 'May I have a turn on the slide? After you, of course. Try it first!'); this.a.perform('bow', { depth: 0.3 }); }
  async invite() {
    const g = this.g, st = this.story, a = this.a;
    await g.run(async () => {
      this.state = 'helping'; this.stopLoop(); a.scripted = true; st.hold(true);
      a.face(g.keeper.x, g.keeper.z); st.say('foldfern', LINES.foldfern.invite[0]); a.perform('happy');
      await g.wait(2.4);
      st.shot(-12, 5.2, 10.5, 0.9, 0.8);
      const toy = st.toys.leaf_slide; toy.riding = true;
      // Its favourite pose, mid-slide.
      setTimeout(() => a.perform('pose', { dur: 2.2 }), 1600);
      await toy.rideOne(a, false); toy.riding = false;
      a.scripted = true; a.perform('applaud');
      st.say('foldfern', LINES.foldfern.thanks[0]);
      await g.wait(2.6); st.endShot();
      await st.acceptFriend('foldfern');
      st.hold(false);
    });
  }
  homeBeat(a) {
    const toy = this.story.toys.leaf_slide;
    if (toy.complete && !toy.riding && Math.random() < 0.35 && a.distTo(this.g.keeper.x, this.g.keeper.z) < 15) toy.friendSoloRide(a);
    else a.perform(Math.random() < 0.5 ? 'applaud' : 'pose');
  }
}

// ======================= SILTBELL (splash, optional) =======================
class Siltbell extends Encounter {
  constructor(story) {
    super(story, 'siltbell', { spot: { x: 12.0, z: -4.65, h: -0.6 }, home: { x: 12.25, z: -4.7 } });
    const root = this.g.island.root;
    this.pebble = mesh(new THREE.IcosahedronGeometry(0.15, 0), 'cream', { pos: [12.65, 0.27, -4.2], scale: [1, 0.7, 0.9], name: 'bell_pebble' });
    this.mark = mesh(new THREE.TorusGeometry(0.24, 0.03, 4, 14), 'amber', { pos: [12.65, 0.24, -4.2], rot: [Math.PI / 2, 0, 0], material: mat('amber', { glow: 0.5, unique: true }) });
    root.add(this.pebble, this.mark); this.pebble.visible = this.mark.visible = false;
  }
  setup() { super.setup(); this.pebble.visible = this.mark.visible = this.state !== 'friend'; this.a.ignoreWater = true; }
  onFriendPlaced() { this.pebble.visible = this.mark.visible = false; }
  hideProps() { this.pebble.visible = this.mark.visible = false; }
  propPoints() { return { 'prop:siltbell_pebble': { x: 12.65, z: -4.2, r: 1.4 } }; }
  update() {
    if (!this.a.root.visible || this.state === 'friend') return;
    this.greetOnce(4.5);
    if (this.mark.visible) this.mark.scale.setScalar(1 + Math.sin(this.g.time * 4) * 0.12);
  }
  async onNoticed() { await this.g.wait(0.3); await this.story.talk('siltbell', [LINES.siltbell.intro[1], LINES.siltbell.request[0]]); }
  async ambient(token) {
    const a = this.a, g = this.g, s = p => this.step_(token, p);
    if (this.state === 'friend' || this.state === 'helping') { await s(g.wait(1)); return; }
    a.face(g.keeper.x, g.keeper.z);
    await s(a.perform('ringBell'));
    if (this.near(12)) { g.audio.plunk(true); this.story.say('siltbell', 'Plunk.'); }
    await s(g.wait(2.6 + Math.random() * 1.5));
    await s(a.perform('shake'));
  }
  interactables(list) {
    if (this.state === 'friend' || this.g.busy || !this.a.root.visible) return;
    if (this.step !== 'tap') list.push({ id: 'siltbell_pebble', x: 12.65, z: -4.2, r: 1.5, ring: 0.4, label: 'Lift the pebble from under the bell', short: 'Lift', icon: 'assets/ui/control-interact.svg', onAction: () => this.lift() });
    else list.push({ id: 'siltbell_tap', x: this.a.x, z: this.a.z, r: 1.8, ring: 0.6, label: 'Tap the bell once', short: 'Tap', icon: 'assets/ui/item-bell.svg', onAction: () => this.tap() });
  }
  goal() {
    if (this.step === 'tap') return { text: "Tap Siltbell's bell, just once", icon: 'assets/ui/item-bell.svg', pos: { x: this.a.x, z: this.a.z, h: 1.6 } };
    return { text: 'A tiny plunk on the pond island... hop the side pad!', icon: 'assets/ui/element-splash.svg', pos: { x: this.a.x, z: this.a.z, h: 1.6 } };
  }
  async lift() {
    const g = this.g, st = this.story;
    await g.run(async () => {
      this.state = 'helping'; this.stopLoop(); st.hold(true);
      await st.keeperWalk(12.6, -3.6, [12.65, -4.2]);
      await g.keeper.perform('push');
      this.mark.visible = false;
      const from = this.pebble.position.clone(), to = new THREE.Vector3(14.1, 0.05, -3.4);
      await g.tween(0.7, (e, u) => { this.pebble.position.lerpVectors(from, to, e); this.pebble.position.y += Math.sin(u * Math.PI) * 0.9; });
      this.pebble.visible = false; g.fx.ripple(to.x, to.z, { y: 0.07, size: 1.6 }); g.audio.plip();
      this.a.perform('wobble'); st.say('siltbell', LINES.siltbell.lifted[0]);
      this.step = 'tap'; st.hold(false);
    });
  }
  async tap() {
    const g = this.g, st = this.story, a = this.a;
    await g.run(async () => {
      st.hold(true); a.scripted = true;
      g.keeper.face(a.x, a.z); await g.keeper.perform('push');
      a.perform('ringBell'); g.audio.bell(392, 0.12); g.camera.nudge(0.04);
      g.fx.ripple(a.x, a.z, { y: 0.22, size: 3.4 }); g.fx.ripple(a.x, a.z, { y: 0.22, size: 5.2, life: 1.6 });
      st.say('siltbell', LINES.siltbell.thanks[0]);
      await g.wait(1.1);
      // ...and the echo answers. Siltbell bows to it.
      g.audio.bell(392, 0.04); a.perform('bow');
      await g.wait(1.6); st.say('siltbell', LINES.siltbell.thanks[1]); await g.wait(1.4);
      await st.acceptFriend('siltbell');
      st.hold(false);
    });
  }
  homeBeat(a) { a.perform('bow'); this.g.audio.bell(523.25, 0.02); }
}

// ======================= KITEFIN (gust, optional) =======================
class Kitefin extends Encounter {
  constructor(story) {
    super(story, 'kitefin', { spot: { x: 4.2, z: 5.0, h: -0.8 }, home: { x: 3.7, z: 4.6 } });
    this.g.on('windSwitch', () => this.onSwitch());
  }
  update() { if (this.a.root.visible && this.state !== 'friend') this.greetOnce(5.5); }
  async onNoticed() { await this.g.wait(0.3); this.a.perform('formalBow'); await this.story.talk('kitefin', LINES.kitefin.intro); }
  async ambient(token) {
    const a = this.a, g = this.g, s = p => this.step_(token, p);
    if (this.state === 'friend' || this.state === 'helping') { await s(g.wait(1)); return; }
    await s(a.walkTo(this.spot.x + (Math.random() - 0.5) * 1.2, this.spot.z + (Math.random() - 0.5) * 0.8, { tol: 0.3, speed: 1.4 }));
    a.face(g.keeper.x, g.keeper.z);
    await s(a.perform('formalBow'));
    await s(g.wait(2 + Math.random() * 2));
  }
  interactables(list) {
    if (this.state === 'friend' || this.g.busy || !this.a.root.visible) return;
    if (!this.step) list.push({ id: 'kitefin_challenge', x: this.a.x, z: this.a.z, r: 2.2, ring: 0.6, label: "Accept Kitefin's wind challenge", short: 'Accept', icon: 'assets/ui/element-gust.svg', onAction: () => this.accept() });
    else if (this.step === 'bow') list.push({ id: 'kitefin_bow', x: this.a.x, z: this.a.z, r: 2.4, ring: 0.6, label: 'Bow back to Kitefin', short: 'Bow', icon: 'assets/ui/control-interact.svg', onAction: () => this.bowBack() });
  }
  goal() {
    if (this.step === 'switch') return { text: 'Switch the wind to the other way (the post by the canopy)', icon: 'assets/ui/element-gust.svg', pos: { x: -2.05, z: 4.05, h: 1.8 } };
    if (this.step === 'bow') return { text: 'Your turn: bow back to Kitefin', icon: 'assets/ui/element-gust.svg', pos: { x: this.a.x, z: this.a.z, h: 2.4 } };
    return { text: 'A very polite kite is bowing at the canopy', icon: 'assets/ui/element-gust.svg', pos: { x: this.a.x, z: this.a.z, h: 2.4 } };
  }
  async accept() {
    const g = this.g, st = this.story;
    await g.run(async () => {
      this.state = 'helping'; this.stopLoop(); this.a.lookTarget = g.keeper.pos;
      st.say('kitefin', LINES.kitefin.request[0]); this.a.perform('formalBow');
      this.step = 'switch'; await g.wait(0.6);
    });
  }
  async onSwitch() {
    if (this.step !== 'switch') return;
    const g = this.g, st = this.story, a = this.a;
    this.step = 'showing';
    a.scripted = true;
    st.say('kitefin', LINES.kitefin.showOff[0]);
    // A very elegant loop around the canopy wind.
    const c = { x: a.x, z: a.z };
    await g.tween(2.2, (e, u) => { a.root.position.x = c.x + Math.sin(u * Math.PI * 2) * 1.2; a.root.position.z = c.z - (1 - Math.cos(u * Math.PI * 2)) * 0.9; a.heading = u * Math.PI * 2; });
    await a.perform('formalBow');
    st.say('kitefin', LINES.kitefin.showOff[1]);
    a.scripted = false; this.step = 'bow';
  }
  async bowBack() {
    const g = this.g, st = this.story, a = this.a, k = g.keeper;
    await g.run(async () => {
      st.hold(true); k.face(a.x, a.z);
      await k.perform('bow', { depth: 0.6 });
      a.perform('formalBow'); st.say('kitefin', LINES.kitefin.thanks[0]);
      await g.wait(2.8);
      await st.acceptFriend('kitefin');
      st.hold(false);
    });
  }
  homeBeat(a) { a.perform(Math.random() < 0.6 ? 'formalBow' : 'spin'); }
}

// ======================= HUSHBULB (glimmer, optional) =======================
class Hushbulb extends Encounter {
  constructor(story) {
    super(story, 'hushbulb', { spot: { x: 3.0, z: -13.15, h: 0.2 }, home: { x: 2.3, z: -12.2 } });
    const root = this.g.island.root;
    // A leaf shelter: three big leaves leaning together.
    this.tent = new THREE.Group(); this.tent.position.set(3.0, 0, -13.25); root.add(this.tent);
    [0, 2.1, 4.2].forEach((a, i) => {
      const lf = new THREE.Mesh(leafGeometry(0.25), mat(i === 1 ? 'teal' : 'moss', { side: THREE.DoubleSide }));
      lf.scale.set(1.1, 1.45, 0.8); lf.position.set(Math.sin(a) * 0.55, 0, Math.cos(a) * 0.55); lf.rotation.set(-0.42, a, 0, 'YXZ'); this.tent.add(lf);
    });
    this.peek = halo('amber', 1.3, 0); this.peek.position.set(3.0, 0.55, -12.95); root.add(this.peek);
    this.tent.visible = false; this.answered = false;
    this.g.island.collision.circle('leaf_tent', 3.0, -13.45, 0.5, 'props');
  }
  setup() { super.setup(); this.tent.visible = true; this.a.scripted = this.state !== 'friend'; this.a.petalOpen = 0; }
  onFriendPlaced() { this.tent.visible = true; this.peek.material.opacity = 0; }
  hideProps() { this.tent.visible = false; this.peek.material.opacity = 0; }
  propPoints() { return { 'prop:hushbulb_tent': { x: 3.0, z: -12.3, r: 1.5 } }; }
  update() {
    if (!this.tent.visible || this.state === 'friend') { this.peek.material.opacity = 0; return; }
    this.greetOnce(4);
    this.peek.material.opacity = 0.35 + Math.sin(this.g.time * 1.6) * 0.15; // the glow gives it away
  }
  async ambient(token) {
    const g = this.g, s = p => this.step_(token, p);
    if (this.state === 'friend' || this.state === 'helping') { await s(g.wait(1)); return; }
    this.a.eyesClosed = true;
    await s(g.wait(3 + Math.random() * 2));
    if (this.near(7)) this.story.say('hushbulb', pick(LINES.hushbulb.intro));
    this.a.eyesClosed = false; await s(g.wait(0.6)); this.a.eyesClosed = true;
  }
  interactables(list) {
    if (this.state === 'friend' || this.g.busy || !this.tent.visible) return;
    if (this.step !== 'answer') list.push({ id: 'hushbulb_listen', x: 3.0, z: -12.3, r: 1.8, ring: 0.6, label: 'Listen at the leaf tent', short: 'Listen', icon: 'assets/ui/control-interact.svg', onAction: () => this.listen() });
    else list.push({ id: 'hushbulb_answer', x: 3.0, z: -12.3, r: 2.0, ring: 0.6, label: 'Answer the tiny chime', short: 'Answer', icon: 'assets/ui/element-glimmer.svg', onAction: () => this.answer() });
  }
  goal() {
    if (this.step === 'answer') return { text: 'Answer the tiny chime (no rush)', icon: 'assets/ui/element-glimmer.svg', pos: { x: 3.0, z: -12.3, h: 1.8 } };
    return { text: 'A warm glow is hiding in a leaf tent...', icon: 'assets/ui/element-glimmer.svg', pos: { x: 3.0, z: -12.6, h: 1.8 } };
  }
  async listen() {
    const g = this.g, st = this.story;
    await g.run(async () => {
      this.state = 'helping'; this.stopLoop(); st.hold(true);
      await st.keeperWalk(3.0, -12.1, [3.0, -13.2]);
      g.keeper.perform('sit', { dur: 1.6 });
      st.say('hushbulb', LINES.hushbulb.request[0]);
      await g.wait(2.0);
      g.audio.chime(3); this.a.perform('glow', { dur: 0.8 }); st.say('hushbulb', LINES.hushbulb.chime[0]);
      this.step = 'answer'; st.hold(false);
    });
  }
  async answer() {
    const g = this.g, st = this.story, a = this.a;
    await g.run(async () => {
      st.hold(true);
      g.keeper.perform('wave'); g.audio.chime(2);
      await g.wait(0.8);
      // It peeks out, petals open, says its very small hello... and sneezes.
      a.eyesClosed = false; a.scripted = false;
      await a.walkTo(3.0, -12.55, { tol: 0.2, face: [g.keeper.x, g.keeper.z] });
      a.scripted = true; a.petalOpen = 1;
      st.say('hushbulb', LINES.hushbulb.thanks[0]); await a.perform('glow');
      await g.wait(1.4);
      st.say('hushbulb', LINES.hushbulb.thanks[1]); await a.perform('sneeze');
      await g.wait(0.8);
      await st.acceptFriend('hushbulb');
      st.hold(false);
    });
  }
  homeBeat(a) { a.perform(Math.random() < 0.5 ? 'sneeze' : 'glow'); }
}

export function buildEncounters(story) {
  return {
    tumbletuft: new Tumbletuft(story),
    foldfern: new Foldfern(story),
    puddleloop: new Puddleloop(story),
    siltbell: new Siltbell(story),
    whirli: new Whirli(story),
    kitefin: new Kitefin(story),
    glintot: new Glintot(story),
    hushbulb: new Hushbulb(story),
  };
}

export { Encounter };
void PAL; void iconSprite;
