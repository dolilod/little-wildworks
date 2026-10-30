// The four playground projects. Each: a helper action that changes the world
// permanently (act), a reveal of the path it opens, then a replayable toy with
// two settings and two small play experiments.
import * as THREE from 'three';
import { LINES, VARIANT_TEXT } from './content.js';
import { mesh, mat, leafGeometry, PAL, iconSprite, halo } from './props.js';
import { backOut, ICON } from './story.js';
import { pick } from './game.js';

class Toy {
  constructor(story, id) {
    this.story = story; this.g = story.g; this.id = id;
    this.def = this.g.data.world.projects.find(p => p.id === id);
    this.group = this.g.island.projects[id];
    this.g.island.root.updateMatrixWorld(true);
    const s = this.group.userData.sockets[0].position;
    this.socket = this.group.localToWorld(new THREE.Vector3(...s));
    this.element = this.def.element;
    // Floating element icon over the socket while the project is ready.
    this.icon = iconSprite(ICON[this.element], 0.8); this.icon.position.set(this.socket.x, 1.5, this.socket.z); this.icon.visible = false;
    this.g.scene.add(this.icon);
  }
  get state() { return this.story.pstate[this.id]; }
  get complete() { return this.g.isDone(this.id); }
  get variant() { return this.g.progress.toyVariants[this.id] || this.def.toyVariants[0]; }
  setVariant(v) { this.g.progress.toyVariants[this.id] = v; this.g.save('variant'); }
  update() {
    const show = this.state === 'ready' && !this.g.busy && this.g.friendIds().length > 0;
    this.icon.visible = show;
    if (show) this.icon.position.y = 1.5 + Math.sin(this.g.time * 3) * 0.12;
  }
  socketInteractable(list, label, short) {
    if (this.state !== 'ready') return;
    list.push({ id: this.id + '_socket', x: this.socket.x, z: this.socket.z, r: 1.9, ring: 0.9, label, short, icon: ICON[this.element], onAction: () => this.story.runProject(this.id) });
  }
  /** At a finished project, a not-yet-participating friend of this element can help again. */
  replayInteractable(list, label) {
    if (!this.complete) return;
    const f = this.g.follower(); if (!f || this.g.creatureDefs[f.id].element !== this.element) return;
    const ev = `participate:${this.id}:${f.id}`;
    if (this.g.progress.friends[f.id].events.includes(ev)) return;
    list.push({ id: this.id + '_replay', x: this.socket.x, z: this.socket.z, r: 1.6, ring: 0.8, priority: 0.3, label: `${label} with ${this.g.displayName(f.id)}`, short: 'Help', icon: ICON[this.element], onAction: () => this.story.replayProject(this.id, f) });
  }
  projectGoal(textNeedFriend, textGo) {
    const g = this.g, f = g.follower();
    const ok = f && g.creatureDefs[f.id].element === this.element;
    return { text: ok ? textGo : textNeedFriend, icon: ICON[this.element], pos: { x: this.socket.x, z: this.socket.z, h: 1.6 } };
  }
  switchProp(x, z, rot = 0) {
    // A little painted toggle post: Action flips between the toy's two settings.
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
    g.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.0, 6), 'cream', { pos: [0, 0.5, 0] }));
    const board = new THREE.Group(); board.position.set(0, 1.05, 0); g.add(board);
    board.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 8), 'clay', { rot: [Math.PI / 2, 0, 0] }));
    const a = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 8), 'cream', { rot: [Math.PI / 2, 0, 0], pos: [0, 0, 0.01] }); board.add(a);
    this.g.island.root.add(g); g.visible = false;
    this.g.island.collision.circle(this.id + '_switch', x, z, 0.14, 'props');
    return { group: g, board };
  }
}

// ============================ LEAF SLIDE ============================
class LeafSlide extends Toy {
  constructor(story) {
    super(story, 'leaf_slide');
    const root = this.g.island.root;
    this.top = new THREE.Vector3(-14.25, 2.36, 5);
    this.path = [new THREE.Vector3(-14.25, 2.36, 5), new THREE.Vector3(-12.5, 1.95, 5), new THREE.Vector3(-9.45, 0.36, 5)];
    this.start = new THREE.Vector3(-14.85, 0, 6.95);
    // Leaf staircase up to the top (built with the slide).
    this.stairs = new THREE.Group(); this.stairs.name = 'slide_stairs';
    this.steps = [[-14.85, 0.62, 6.45], [-14.62, 1.25, 6.0], [-14.42, 1.86, 5.58]].map(([x, y, z], i) => {
      const s = new THREE.Group(); s.position.set(x, y, z);
      s.add(mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.1, 8), i % 2 ? 'teal' : 'moss'));
      s.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, y, 5), 'cream', { pos: [0, -y / 2, 0] }));
      this.stairs.add(s); return s;
    });
    root.add(this.stairs);
    // Two landing rings (play experiments: left / right).
    this.rings = [[-8.2, 3.95, 'left'], [-8.2, 6.05, 'right']].map(([x, z, side]) => {
      const r = mesh(new THREE.TorusGeometry(0.62, 0.11, 5, 18), side === 'left' ? 'moss' : 'teal', { pos: [x, 0.06, z], rot: [Math.PI / 2, 0, 0], material: mat(side === 'left' ? '#8fae78' : 'teal', { unique: true }) });
      r.userData.side = side; root.add(r); return r;
    });
    this.sw = this.switchProp(-10.05, 7.55, -0.3);
    this.swIcon = { gentle: this.leafSign(), bouncy: this.springSign() };
    this.sw.board.add(this.swIcon.gentle, this.swIcon.bouncy);
    this.lat = 0; this.riding = false;
    this.applyComplete(this.complete);
  }
  leafSign() { const m = new THREE.Mesh(leafGeometry(0.1), mat('moss')); m.scale.set(0.3, 0.38, 0.3); m.position.set(0, -0.17, 0.08); return m; }
  springSign() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.TorusGeometry(0.11, 0.025, 4, 12), 'amber', { pos: [0, -0.12 + i * 0.08, 0.1], rot: [Math.PI / 2.4, 0, 0] }));
    return g;
  }
  applyComplete(on) {
    this.stairs.visible = on; this.rings.forEach(r => r.visible = on); this.sw.group.visible = on;
    this.swIcon.gentle.visible = this.variant === 'gentle'; this.swIcon.bouncy.visible = this.variant === 'bouncy';
  }
  interactables(list) {
    if (this.g.busy || this.riding) return;
    this.socketInteractable(list, 'Grow a slide!', 'Grow');
    if (!this.complete) return;
    list.push({ id: 'slide_ride', x: this.start.x, z: this.start.z, r: 1.6, ring: 0.7, label: 'Ride the leaf slide!', short: 'Ride!', icon: 'assets/ui/control-interact.svg', onAction: () => this.ride() });
    list.push({ id: 'slide_switch', x: -10.05, z: 7.55, r: 1.25, ring: 0.5, label: this.variant === 'gentle' ? 'Make the slide bouncy!' : 'Make the slide gentle', short: this.variant === 'gentle' ? 'Bouncy' : 'Gentle', icon: 'assets/ui/control-interact.svg', onAction: () => this.toggle() });
    this.replayInteractable(list, 'Grow more leaves');
  }
  goal() {
    const tt = this.g.progress.friends.tumbletuft ? this.g.displayName('tumbletuft') : 'Tumbletuft';
    return this.projectGoal(`Bring ${tt} to the flat garden bed (press Friend)`, 'Grow a big slide in the garden bed');
  }
  rideGoal() { return { text: 'Ride the leaf slide!', icon: 'assets/ui/control-interact.svg', pos: { x: this.start.x, z: this.start.z, h: 1.8 } }; }

  async act(helper) {
    const g = this.g, st = this.story, grp = this.group;
    const bed = new THREE.Vector3(-12, 0, 6.55);
    st.shot(-12.2, 5.4, 9.5, 1.0, 0.8);
    await helper.walkTo(bed.x, bed.z, { tol: 0.2 }); helper.face(-12, 5);
    st.sayLine(helper.id, 'project');
    // Anticipation dip, three stomps, then the buds burst.
    await helper.perform('stomp');
    g.audio.cue('sprout');
    const buds = grp.getObjectByName('unfinished');
    for (let i = 0; i < 3; i++) { const b = buds.getObjectByName('sleeping_bud_' + i); g.fx.leafBurst(-13.6 + i * 1.6, 0.3, 5, { count: 6 }); b && (b.scale.multiplyScalar(1.3)); }
    await g.tween(0.25, e => buds.scale.setScalar(Math.max(0.01, 1 - e)));
    buds.visible = false; buds.scale.setScalar(1);
    const fin = grp.getObjectByName('finished'); fin.visible = true;
    const parts = ['grown_stem', 'leaf_slide_surface', 'leaf_rail_high_0', 'leaf_rail_high_1', 'leaf_rail_low_0', 'leaf_rail_low_1', 'welcome_leaf'].map(n => fin.getObjectByName(n)).filter(Boolean);
    const rest = parts.map(p => ({ s: p.scale.clone(), y: p.position.y }));
    parts.forEach(p => p.scale.setScalar(0.001));
    const stem = parts[0];
    await g.tween(0.65, e => { stem.scale.set(1, Math.max(0.001, e), 1); stem.position.y = rest[0].y * e; }, { ease: backOut });
    g.fx.leafBurst(-14, 2.2, 5, { count: 10 }); g.audio.cue('sprout');
    await g.tween(0.8, e => parts[1].scale.setScalar(Math.max(0.001, e)), { ease: backOut });
    g.camera.nudge(0.06); g.fx.leafBurst(-12, 1.6, 5, { count: 16 });
    await g.tween(0.45, e => { for (let i = 2; i < 6; i++) parts[i].scale.copy(rest[i].s).multiplyScalar(Math.max(0.001, e)); }, { ease: backOut });
    await g.tween(0.4, e => parts[6].scale.copy(rest[6].s).multiplyScalar(Math.max(0.001, e)), { ease: backOut });
    parts.forEach((p, i) => { p.scale.copy(rest[i].s); p.position.y = rest[i].y; });
    this.applyComplete(true);
    this.steps.forEach(s => { s.scale.setScalar(0.01); });
    for (const s of this.steps) { await g.tween(0.18, e => s.scale.setScalar(Math.max(0.01, e)), { ease: backOut }); g.audio.tick(); }
    helper.perform('happy'); g.keeper.perform('bigHappy');
  }
  async reveal() {
    // Show the path it opened: the sleepy meadow gate leaf yawns open.
    const g = this.g, st = this.story;
    st.shot(-7.2, 5, 9, 1.1); await g.wait(0.9);
    g.openGatesFor('leaf_slide'); g.fx.leafBurst(-6.9, 0.8, 5, { count: 14 }); g.audio.whoosh();
    g.ui.toast('The meadow gate is open!', { icon: 'assets/ui/element-sprout.svg' });
    await g.wait(1.6); st.endShot(); await g.wait(0.4);
  }
  async replay(helper) {
    const g = this.g;
    await helper.walkTo(-12, 6.55, { tol: 0.25 }); helper.face(-12, 5);
    await helper.perform(helper.id === 'foldfern' ? 'applaud' : 'stomp');
    g.audio.cue('sprout'); g.fx.leafBurst(-12, 1.7, 5, { count: 18 }); g.camera.nudge(0.03);
    this.story.say(helper.id, 'More leaves! Even more slide-y!');
    await g.wait(0.6);
  }

  toggle() {
    const v = this.variant === 'gentle' ? 'bouncy' : 'gentle';
    this.setVariant(v); this.applyComplete(true);
    this.sw.board.rotation.z = 0; this.g.tween(0.5, e => this.sw.board.rotation.z = e * Math.PI * 2, { ease: backOut });
    v === 'bouncy' ? this.g.audio.boing() : this.g.audio.tick();
    this.g.ui.toast(`Slide: ${VARIANT_TEXT[v]}!`, { icon: 'assets/ui/control-interact.svg' });
  }

  /** Keeper ride (+ friend), with bounded steering and two landing rings. */
  async ride() {
    const g = this.g, st = this.story, k = g.keeper, f = g.follower();
    await g.run(async () => {
      this.riding = true; st.hold(true);
      let friendFirst = false;
      if (f && !g.progress.encounterFlags.some(x => x.startsWith('choice:slide_first:'))) {
        const who = await g.ui.choose('Who goes first?', 'The slide is ready. Somebody has to be first!',
          [{ value: 'keeper', label: 'Me first!', img: g.ui.portraits.get(k) }, { value: f.id, label: `${g.displayName(f.id)} first!`, img: g.ui.portraits.get(f, { version: g.portraitVersion[f.id] || 0 }) }]);
        g.flag('choice:slide_first:' + who);
        friendFirst = who !== 'keeper';
        if (friendFirst) { st.say(f.id, f.id === 'tumbletuft' ? 'Me? ME? Best day ever!' : 'Oh! Thank you!'); }
        else if (f.id === 'tumbletuft') st.say('tumbletuft', 'Okay. You first. I am being VERY patient.');
      } else if (f) friendFirst = Math.random() < 0.4;
      const riders = f ? (friendFirst ? [f, k] : [k, f]) : [k];
      st.shot(-12, 5.2, 10.5, 0.9, 0.8);
      for (const r of riders) { await this.rideOne(r, r === k); await g.wait(0.2); }
      st.endShot();
      g.flag('rode:leaf_slide');
      if (f) {
        st.sayLine(f.id, 'toy');
        await st.friendEvent(f.id, `play:leaf_slide:${f.id}`);
      }
      this.riding = false; st.hold(false);
    });
  }

  async rideOne(actor, steer) {
    const g = this.g, st = this.story, bouncy = this.variant === 'bouncy';
    actor.scripted = false;
    await actor.walkTo(this.start.x, this.start.z, { tol: 0.25, speed: actor.spec.speed });
    actor.scripted = true;
    for (const s of this.steps) await st.hop(actor, s.position.x, s.position.z, { y: s.position.y + 0.06, height: 0.35, dur: 0.32 });
    await st.hop(actor, this.top.x, this.top.z, { y: this.top.y, height: 0.3, dur: 0.32 });
    actor.face(this.top.x + 5, this.top.z);
    actor.perform('sit', { dur: 0.35 });
    if (steer && !g.hasFlag('exp:slide_both')) g.ui.toast(g.input.lastDevice === 'touch' ? 'Move your thumb to steer into a ring!' : 'Steer with the arrow keys to land in a ring!', { icon: 'assets/ui/control-interact.svg', dur: 2600 });
    await g.wait(0.3);
    if (!actor.isKeeper) st.say(actor.id, pick(LINES[actor.id].toy || ['Wheee!']));
    g.audio.slideWhee(bouncy ? 1.3 : 1.6);
    actor.scriptY = true;
    let lat = steer ? 0 : (Math.random() < 0.5 ? -0.42 : 0.42);
    const dur = bouncy ? 1.35 : 1.6;
    const [a, b, c] = this.path, l1 = a.distanceTo(b), l2 = b.distanceTo(c), L = l1 + l2;
    let lastDt = g.time;
    await g.tween(dur, (e) => {
      const dt = g.time - lastDt; lastDt = g.time;
      if (steer) {
        const mv = g.input.move(), wz = g.camera.right.z * mv.x + g.camera.up.z * mv.y;
        lat = Math.max(-0.55, Math.min(0.55, lat + wz * 1.9 * dt));
      }
      const d = e * L, p = d < l1 ? a.clone().lerp(b, d / l1) : b.clone().lerp(c, (d - l1) / l2);
      const bump = bouncy ? Math.abs(Math.sin(e * Math.PI * 5)) * 0.22 : 0;
      actor.root.position.set(p.x, p.y + bump, p.z + lat);
      if (Math.random() < 0.3) g.fx.puff(p.x, p.y, p.z + lat, { count: 1, size: 0.07, color: '#cfe0b8', up: 0.2, speed: 0.3 });
    }, { ease: u => u * u * (1.6 - 0.6 * u) });
    // Launch off the end into a landing ring.
    const end = actor.root.position.clone();
    const land = new THREE.Vector3(-8.2, 0, 5 + lat * 1.9);
    actor.perform('hop', { dur: bouncy ? 0.75 : 0.55 });
    if (bouncy) g.audio.boing();
    await g.tween(bouncy ? 0.7 : 0.5, (e, u) => actor.root.position.set(end.x + (land.x - end.x) * u, end.y * (1 - u) + Math.sin(u * Math.PI) * (bouncy ? 1.3 : 0.6), end.z + (land.z - end.z) * u));
    actor.ground = 0; actor.scriptY = false;
    g.fx.puff(land.x, 0.05, land.z, { count: 7 }); g.fx.leafBurst(land.x, 0.2, land.z, { count: 5 });
    const ring = this.rings.find(r => Math.hypot(r.position.x - land.x, r.position.z - land.z) < 0.75);
    if (ring) {
      const side = ring.userData.side;
      ring.material.emissive.set(PAL.amber); this.g.tween(0.9, e => ring.material.emissiveIntensity = (1 - e) * 0.8);
      g.audio.chime(side === 'left' ? 0 : 2);
      g.ui.floater(actor, side === 'left' ? 'Left ring!' : 'Right ring!');
      if (steer) {
        g.flag('exp:slide_' + side);
        if (g.hasFlag('exp:slide_left') && g.hasFlag('exp:slide_right') && !g.hasFlag('exp:slide_both')) { g.flag('exp:slide_both'); g.ui.toast('You landed in both rings!', { icon: 'assets/ui/item-seed.svg' }); }
      }
    } else if (steer && !g.hasFlag('exp:slide_hint')) {
      g.flag('exp:slide_hint'); g.ui.toast('Tip: steer while you slide to land in a ring!', { icon: 'assets/ui/control-interact.svg', dur: 3200 });
    }
    actor.perform('happy');
    actor.scripted = !actor.isKeeper ? false : true;
    // Step out of the landing zone so the next rider has room.
    if (!actor.isKeeper) { await actor.walkTo(-8.9, 7.3, { tol: 0.3 }); }
    else { actor.scripted = false; await actor.walkTo(-9.6, 6.8, { tol: 0.3 }); actor.scripted = true; }
  }

  /** At home, a friend rides by itself now and then (it built this). */
  async friendSoloRide(a) {
    if (this.riding || this.g.busy) return;
    this.riding = true; a.scripted = true;
    try { await this.rideOne(a, false); } finally { this.riding = false; a.scripted = false; }
  }
}

// ============================ PINWHEEL CANOPY ============================
const POSTS = [[-2.7, -1], [2.7, -1], [2.7, 3], [-2.7, 3]]; // world; index 0 wears the clay "first ribbon"
class PinwheelCanopy extends Toy {
  constructor(story) {
    super(story, 'pinwheel_canopy');
    const root = this.g.island.root;
    this.still = this.group.getObjectByName('still_pinwheel'); this.spinning = this.group.getObjectByName('spinning_pinwheel');
    this.angle = 0; this.boostT = 0; this.spinNow = 0;
    // Ribbons on the four canopy posts: limp until the wind arrives.
    this.ribbons = POSTS.map(([x, z], i) => {
      const g = new THREE.Group(); g.position.set(x, 2.5, z); g.rotation.order = 'YXZ'; root.add(g);
      const color = ['clay', 'teal', 'amber', 'cream'][i];
      g.add(mesh(new THREE.BoxGeometry(0.12, 1.0, 0.015), color, { pos: [0, -0.5, 0] }));
      g.add(mesh(new THREE.BoxGeometry(0.1, 0.35, 0.016), color, { pos: [0.04, -1.1, 0], rot: [0, 0, 0.25] }));
      return { g, flutter: 0 };
    });
    // Wind arrow (weathervane) in the middle of the canopy floor.
    this.vane = new THREE.Group(); this.vane.position.set(0, 0, 1); root.add(this.vane);
    this.vane.add(mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.1, 6), 'cream', { pos: [0, 0.55, 0] }));
    this.arrow = new THREE.Group(); this.arrow.position.set(0, 1.18, 0); this.vane.add(this.arrow);
    this.arrow.add(mesh(new THREE.BoxGeometry(0.09, 0.09, 0.9), 'amber', { pos: [0, 0, 0.05] }));
    this.arrow.add(mesh(new THREE.ConeGeometry(0.2, 0.36, 4), 'clay', { pos: [0, 0, 0.62], rot: [Math.PI / 2, 0, 0] }));
    const tail = new THREE.Mesh(leafGeometry(0.06), mat('teal')); tail.scale.set(0.42, 0.42, 0.4); tail.position.set(0, 0, -0.32); tail.rotation.x = -Math.PI / 2; this.arrow.add(tail);
    this.vane.visible = false;
    this.dir = 1; this.arrowAngle = this.dirAngle(this.dir);
    this.sw = this.switchProp(-2.05, 4.05, 0.3);
    this.swArrow = new THREE.Group(); this.sw.board.add(this.swArrow);
    this.swArrow.add(mesh(new THREE.TorusGeometry(0.15, 0.03, 4, 12, Math.PI * 1.5), 'teal', { pos: [0, 0, 0.08] }));
    this.swArrow.add(mesh(new THREE.ConeGeometry(0.06, 0.12, 4), 'teal', { pos: [0.15, -0.05, 0.08], rot: [0, 0, Math.PI] }));
    this.g.island.collision.circle('wind_vane', 0, 1, 0.18, 'scenery');
    this.applyComplete(this.complete);
  }
  dirAngle(i) { const [x, z] = POSTS[i]; return Math.atan2(x - 0, z - 1); }
  applyComplete(on) {
    this.vane.visible = on; this.sw.group.visible = on;
    this.swArrow.scale.x = this.variant === 'clockwise' ? 1 : -1;
  }
  boost(s) { this.boostT = Math.max(this.boostT, s); }
  update(dt) {
    super.update();
    const g = this.g, done = this.complete || this.spinUp;
    const base = done ? (this.variant === 'clockwise' ? -1 : 1) * 1.1 : 0;
    this.boostT = Math.max(0, this.boostT - dt);
    const target = base * (1 + (this.boostT > 0 ? 3 : 0));
    this.spinNow += (target - this.spinNow) * (1 - Math.exp(-dt * 2));
    this.angle += this.spinNow * dt;
    if (this.spinning) this.spinning.rotation.z = this.angle;
    if (this.still) this.still.rotation.z = this.angle;
    // Arrow eases (with a little overshoot) toward its direction.
    const want = this.dirAngle(this.dir);
    let d = want - this.arrowAngle; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    this.arrowV = (this.arrowV || 0) + (d * 60 - (this.arrowV || 0) * 9) * dt; this.arrowAngle += this.arrowV * dt;
    this.arrow.rotation.y = this.arrowAngle;
    // Ribbons stream along the wind; the one the arrow points at flutters hardest.
    const t = g.time, wind = done ? 0.55 + Math.min(1, Math.abs(this.spinNow) / 2) * 0.4 : 0.05;
    this.ribbons.forEach((r, i) => {
      r.flutter *= Math.exp(-dt * 0.8);
      const hit = done && i === this.dir ? 0.35 : 0;
      r.g.rotation.y = this.arrowAngle;
      r.g.rotation.x = -(wind + hit + r.flutter) * 0.9 - Math.sin(t * (6 + i) + i) * 0.12 * (wind + r.flutter);
    });
  }
  interactables(list) {
    if (this.g.busy) return;
    this.socketInteractable(list, 'Blow the big pinwheel!', 'Blow');
    if (!this.complete) return;
    list.push({ id: 'wind_arrow', x: 0, z: 1, r: 1.7, ring: 0.6, label: 'Turn the wind arrow', short: 'Turn', icon: 'assets/ui/element-gust.svg', onAction: () => this.turnArrow() });
    list.push({ id: 'wind_switch', x: -2.05, z: 4.05, r: 1.2, ring: 0.5, label: this.variant === 'clockwise' ? 'Make the wind go the other way' : 'Make the wind go back again', short: 'Switch', icon: 'assets/ui/control-interact.svg', onAction: () => this.toggle() });
    this.replayInteractable(list, 'Blow the pinwheel');
  }
  goal() {
    const name = this.g.progress.friends.whirli ? this.g.displayName('whirli') : 'a Gust friend';
    return this.projectGoal(`Bring ${name} to the big still pinwheel (press Friend)`, 'Blow the big canopy pinwheel');
  }
  async act(helper) {
    const g = this.g, st = this.story;
    st.shot(0, 2.6, 11, 1.0, 1.2);
    await helper.walkTo(0.25, 4.45, { tol: 0.2, face: [0, 3.3] });
    st.sayLine(helper.id, 'project');
    await helper.perform('puff');
    helper.perform('blow'); g.audio.gustLoop(1.8); g.audio.cue('gust');
    for (let i = 0; i < 3; i++) { g.fx.swirl(0, 1.4 + i * 0.6, 3.6, { count: 8 }); await g.wait(0.25); }
    this.spinUp = true; this.boost(2.5);
    this.ribbons.forEach(r => r.flutter = 1.2);
    await g.wait(1.0);
    this.applyComplete(true); g.camera.nudge(0.06);
    this.vane.scale.setScalar(0.01); await g.tween(0.5, e => this.vane.scale.setScalar(Math.max(0.01, e)), { ease: backOut });
    g.keeper.perform('bigHappy'); helper.perform('spin');
    await g.wait(0.6);
  }
  async reveal() { await this.story.lightGateLamp('gust'); }
  async replay(helper) {
    const g = this.g;
    await helper.walkTo(0.25, 4.45, { tol: 0.3, face: [0, 3.3] });
    await helper.perform('puff'); helper.perform('blow'); g.audio.gustLoop(1.2);
    g.fx.swirl(0, 2, 3.6, { count: 14 }); this.boost(3); this.ribbons.forEach(r => r.flutter = 1);
    this.story.say(helper.id, 'Whoooosh! My turn!');
    await g.wait(1.0);
  }
  toggle() {
    const v = this.variant === 'clockwise' ? 'counterclockwise' : 'clockwise';
    this.setVariant(v); this.applyComplete(true); this.boost(1.2);
    this.g.audio.gustLoop(0.7); this.g.ui.toast(`Wind: ${VARIANT_TEXT[v]}!`, { icon: 'assets/ui/element-gust.svg' });
    this.g.emit('windSwitch', v);
  }
  async turnArrow() {
    const g = this.g, f = g.follower();
    this.dir = (this.dir + (this.variant === 'clockwise' ? 1 : 3)) % 4;
    g.audio.tick(); g.audio.gustLoop(0.9); this.boost(1.4);
    g.fx.swirl(POSTS[this.dir][0] * 0.6, 1.8, 1 + (POSTS[this.dir][1] - 1) * 0.6, { count: 10 });
    this.ribbons[this.dir].flutter = 1.4;
    g.keeper.perform('push');
    if (f && f.distTo(g.keeper.x, g.keeper.z) < 7) { f.lookTarget = new THREE.Vector3(POSTS[this.dir][0], 0, POSTS[this.dir][1]); f.perform(g.creatureDefs[f.id].element === 'gust' ? 'spin' : 'happy'); }
    if (this.dir === 0) {
      g.ui.floater(g.keeper, 'The first ribbon!');
      g.audio.chime(2);
      const exp = this.variant === 'clockwise' ? 'exp:wind_first' : 'exp:wind_other';
      if (!g.hasFlag(exp)) { g.flag(exp); g.ui.toast(exp === 'exp:wind_first' ? 'Whoosh! You pointed the wind at the first ribbon!' : 'The other way works too!', { icon: 'assets/ui/element-gust.svg' }); }
      if (f) { this.story.sayLine(f.id, 'toy'); await this.story.friendEvent(f.id, `play:pinwheel_canopy:${f.id}`); }
    }
  }
}

// ============================ LOTUS STEPS ============================
class LotusSteps extends Toy {
  constructor(story) {
    super(story, 'lotus_steps');
    const root = this.g.island.root;
    this.pads = this.g.island.lotusPads;
    // A chime shell on the bank switches between low and high notes.
    this.shell = new THREE.Group(); this.shell.position.set(2.45, 0, -2.85); root.add(this.shell);
    const cone = mesh(new THREE.ConeGeometry(0.32, 0.75, 7), 'cream', { pos: [0, 0.32, 0], rot: [0, 0, -1.15] }); this.shell.add(cone);
    for (let i = 0; i < 3; i++) this.shell.add(mesh(new THREE.TorusGeometry(0.22 - i * 0.06, 0.03, 4, 12), 'clay', { pos: [0.12 + i * 0.13, 0.36 - i * 0.03, 0], rot: [0, Math.PI / 2, 0] }));
    this.noteDots = [0, 1].map(i => { const m = mesh(new THREE.IcosahedronGeometry(0.07, 0), 'amber', { pos: [-0.25, 0.75 + i * 0.18, 0] }); this.shell.add(m); return m; });
    this.shell.visible = false;
    this.g.island.collision.circle('chime_shell', 2.45, -2.85, 0.3, 'scenery');
    this.seq = [];
    this.g.on('pad', i => this.onPad(i));
    this.applyComplete(this.complete);
  }
  applyComplete(on) { this.shell.visible = on; this.noteDots[1].visible = this.variant === 'high_song'; }
  interactables(list) {
    if (this.g.busy) return;
    this.socketInteractable(list, 'Float the lotus pads up!', 'Float');
    if (!this.complete) return;
    list.push({ id: 'pond_switch', x: 2.45, z: -2.85, r: 1.25, ring: 0.5, label: this.variant === 'low_song' ? 'Make the pads sing high notes' : 'Make the pads sing low notes', short: this.variant === 'low_song' ? 'High' : 'Low', icon: 'assets/ui/element-splash.svg', onAction: () => this.toggle() });
    this.replayInteractable(list, 'Float the pads');
  }
  goal() {
    const name = this.g.progress.friends.puddleloop ? this.g.displayName('puddleloop') : 'a Splash friend';
    return this.projectGoal(`Bring ${name} to the pond's edge (press Friend)`, 'Float the lotus pads up');
  }
  async act(helper) {
    const g = this.g, st = this.story;
    st.shot(8.2, -2.4, 11.5, 1.0);
    await helper.walkTo(4.35, -4.55, { tol: 0.25, face: [6.5, -3.4] });
    st.sayLine(helper.id, 'project');
    await helper.perform('float');
    g.audio.cue('splash');
    const fin = this.group.getObjectByName('finished'); fin.visible = true;
    const unf = this.group.getObjectByName('unfinished');
    this.pads.forEach(p => { p.scale.setScalar(0.2); p.userData.dip = -0.25; });
    for (let i = 0; i < 5; i++) {
      const [x, z] = g.island.padCenters[i];
      g.fx.ripple(x, z, { y: 0.07, size: 2.6 }); g.fx.puff(x, 0.1, z, { count: 4, color: '#AED8CF', up: 1.2 });
      g.audio.padNote(i, this.variant === 'high_song');
      const p = this.pads[i];
      g.tween(0.45, e => { p.scale.setScalar(0.2 + 0.8 * e); p.userData.dip = -0.25 * (1 - e); }, { ease: backOut });
      const m = unf.getObjectByName('submerged_marker_' + i); if (m) m.visible = false;
      await g.wait(0.32);
    }
    const sp = g.island.props.sidePad; sp.visible = true; sp.scale.setScalar(0.2);
    g.fx.ripple(sp.position.x, sp.position.z, { y: 0.07, size: 2 }); g.audio.padNote(5);
    await g.tween(0.45, e => sp.scale.setScalar(0.2 + 0.8 * e), { ease: backOut });
    this.applyComplete(true);
    g.keeper.perform('bigHappy'); helper.perform('happy'); g.camera.nudge(0.05);
    await g.wait(0.5);
  }
  async reveal() { await this.story.lightGateLamp('splash'); }
  async replay(helper) {
    const g = this.g;
    await helper.walkTo(4.35, -4.55, { tol: 0.3, face: [6.5, -3.4] });
    await helper.perform('float');
    for (let i = 0; i < 5; i++) { const [x, z] = g.island.padCenters[i]; g.fx.ripple(x, z, { y: 0.12, size: 2.4 }); this.pads[i].userData.dipV -= 1; g.audio.padNote(i, this.variant === 'high_song'); await g.wait(0.2); }
    this.story.say(helper.id, helper.id === 'siltbell' ? 'Bong, bong, bong! The pads ring!' : 'Bloop! Extra floaty!');
    await g.wait(0.6);
  }
  toggle() {
    const v = this.variant === 'low_song' ? 'high_song' : 'low_song';
    this.setVariant(v); this.applyComplete(true);
    this.g.audio.padNote(2, v === 'high_song'); this.g.ui.toast(`Pads: ${VARIANT_TEXT[v]}!`, { icon: 'assets/ui/element-splash.svg' });
  }
  /** Three different pads in a row (no timer pressure, ~6 s) plays a little tune. */
  async onPad(i) {
    if (!this.complete || i > 4) return;
    const now = this.g.time;
    this.seq = this.seq.filter(s => now - s.t < 6 && s.i !== i); this.seq.push({ i, t: now });
    if (this.seq.length < 3) return;
    this.seq = [];
    const g = this.g, high = this.variant === 'high_song', f = g.follower();
    setTimeout(() => [0, 2, 4].forEach((n, k) => setTimeout(() => g.audio.padNote(n, high), k * 140)), 250);
    g.ui.floater(g.keeper, high ? 'A high tune!' : 'A low tune!');
    const exp = high ? 'exp:pond_high' : 'exp:pond_low';
    if (!g.hasFlag(exp)) { g.flag(exp); g.ui.toast(high ? 'You played the tune with the high chimes!' : 'You played a three-note tune!', { icon: 'assets/ui/element-splash.svg' }); }
    if (f && f.distTo(g.keeper.x, g.keeper.z) < 8) { f.perform('happy'); this.story.sayLine(f.id, 'toy'); await this.story.friendEvent(f.id, `play:lotus_steps:${f.id}`); }
  }
}

// ============================ PICNIC LANTERNS ============================
const LANTERNS = [[-2.6, -1.8], [2.6, -1.8], [-2.6, 1.8], [2.6, 1.8]]; // local to the picnic group at (-2, -10)
class LanternPicnic extends Toy {
  constructor(story) {
    super(story, 'lantern_picnic');
    const root = this.g.island.root;
    this.center = new THREE.Vector3(-2, 0, -10);
    this.halos = LANTERNS.map(([x, z]) => { const h = halo('amber', 2.2, 0); h.position.set(x - 2, 1.9, z - 10); root.add(h); return h; });
    this.lit = LANTERNS.map(() => this.complete);
    // Floating glow beads above the picnic that the child can remix: moon or star.
    this.beads = Array.from({ length: 7 }, () => {
      const b = new THREE.Group(); root.add(b);
      b.add(mesh(new THREE.IcosahedronGeometry(0.13, 0), 'amber', { material: mat('amber', { glow: 0.9 }) }));
      const h = halo('amber', 0.9, 0.55); b.add(h); b.visible = false; return b;
    });
    this.beadPos = this.beads.map(() => new THREE.Vector3());
    this.applyComplete(this.complete);
  }
  shape(kind) {
    const c = this.center, y = 3.3, pts = [];
    if (kind === 'moon') for (let i = 0; i < 7; i++) { const a = -1.1 + i * (2.2 / 6); pts.push(new THREE.Vector3(c.x + Math.sin(a) * 1.1 - 0.25 * Math.cos(a * 1.4), y + Math.cos(a) * 1.1, c.z + 0.6)); }
    else for (let i = 0; i < 7; i++) { if (i === 6) { pts.push(new THREE.Vector3(c.x, y, c.z + 0.6)); continue; } const a = i * Math.PI * 2 / 5 - Math.PI / 2, r = 1.15; pts.push(new THREE.Vector3(c.x + Math.cos(a) * r, y - Math.sin(a) * r, c.z + 0.6)); }
    return pts;
  }
  applyComplete(on) {
    this.halos.forEach((h, i) => h.material.opacity = on && this.lit[i] ? 0.55 : 0);
    const pts = this.shape(this.variant);
    this.beads.forEach((b, i) => { b.visible = on; b.position.copy(pts[i]); this.beadPos[i].copy(pts[i]); });
  }
  update(dt) {
    super.update();
    if (!this.complete) return;
    const t = this.g.time;
    this.halos.forEach((h, i) => { if (this.lit[i]) h.material.opacity = 0.5 + Math.sin(t * 1.3 + i) * 0.08; });
    this.beads.forEach((b, i) => { b.position.lerp(this.beadPos[i], 1 - Math.exp(-dt * 3)); b.position.y += Math.sin(t * 2 + i) * 0.002; });
  }
  interactables(list) {
    if (this.g.busy) return;
    this.socketInteractable(list, 'Light the picnic lamps!', 'Light');
    if (!this.complete) return;
    const f = this.g.follower(), canReplay = f && this.g.creatureDefs[f.id].element === 'glimmer' && !this.g.progress.friends[f.id].events.includes(`participate:lantern_picnic:${f.id}`);
    if (canReplay) this.replayInteractable(list, 'Light the lamps');
    else list.push({ id: 'lamp_remix', x: this.socket.x, z: this.socket.z, r: 1.6, ring: 0.8, label: this.variant === 'moon' ? 'Remix the lamps into a star' : 'Make the lamps a moon again', short: 'Remix', icon: 'assets/ui/element-glimmer.svg', onAction: () => this.remix() });
  }
  goal() {
    const name = this.g.progress.friends.glintot ? this.g.displayName('glintot') : 'a Glimmer friend';
    return this.projectGoal(`Bring ${name} to the dark picnic (press Friend)`, 'Light the picnic lamps');
  }
  async act(helper) {
    const g = this.g, st = this.story, grp = this.group;
    st.shot(-2, -9.6, 11, 1.0, 0.8);
    await helper.walkTo(this.socket.x, this.socket.z + 0.2, { tol: 0.25, face: [-2, -10] });
    st.sayLine(helper.id, 'project');
    const fin = grp.getObjectByName('finished'), unf = grp.getObjectByName('unfinished');
    fin.visible = true;
    const cake = [fin.getObjectByName('shared_seed_cake'), fin.getObjectByName('cake_seed')];
    LANTERNS.forEach((_, i) => { fin.getObjectByName('lit_seed_' + i).visible = false; });
    cake.forEach(c => c.visible = false);
    for (let i = 0; i < 4; i++) {
      const [lx, lz] = LANTERNS[i], to = new THREE.Vector3(lx - 2, 1.9, lz - 10);
      helper.perform('glow', { dur: 0.6 });
      const from = helper.headWorld();
      for (let k = 0; k < 5; k++) g.fx.sparkle(from.x + (to.x - from.x) * k / 5, from.y + (to.y - from.y) * k / 5 + Math.sin(k / 5 * Math.PI), from.z + (to.z - from.z) * k / 5, { count: 2, size: 0.3, up: 0.2, speed: 0.2 });
      await g.wait(0.35);
      unf.getObjectByName('unlit_seed_' + i).visible = false; fin.getObjectByName('lit_seed_' + i).visible = true;
      this.lit[i] = true; this.halos[i].material.opacity = 0.6; g.audio.chime(i); g.fx.sparkle(to.x, to.y, to.z, { count: 10 });
      await g.wait(0.3);
    }
    g.audio.cue('glimmer');
    cake.forEach(c => { c.visible = true; c.scale.multiplyScalar(0.01); });
    const cs = [new THREE.Vector3(0.62, 0.24, 0.62), new THREE.Vector3(0.15, 0.2, 0.15)];
    await g.tween(0.6, e => cake.forEach((c, i) => c.scale.copy(cs[i]).multiplyScalar(Math.max(0.01, e))), { ease: backOut });
    g.fx.sparkle(-2, 0.8, -10, { count: 20 });
    this.applyComplete(true);
    this.beads.forEach(b => b.position.set(-2, 0.5, -10));
    g.keeper.perform('bigHappy'); helper.perform('happy');
    await g.wait(0.6);
  }
  async reveal() {
    const g = this.g, bell = this.story.finale.bell;
    this.story.shot(bell.x - 1, bell.z, 9, 1.0);
    await g.wait(1.0); g.audio.bell(659.25, 0.05); g.fx.sparkle(bell.x, 2, bell.z, { count: 16 });
    await g.wait(1.0); this.story.endShot();
  }
  async replay(helper) {
    const g = this.g;
    await helper.walkTo(this.socket.x, this.socket.z + 0.2, { tol: 0.3, face: [-2, -10] });
    for (let i = 0; i < 4; i++) { helper.perform('glow', { dur: 0.5 }); const [lx, lz] = LANTERNS[i]; g.fx.sparkle(lx - 2, 1.9, lz - 10, { count: 8 }); g.audio.chime(i); await g.wait(0.3); }
    this.story.say(helper.id, helper.id === 'hushbulb' ? 'ah... ah... SHINE!' : 'Brighter! Even brighter!');
    await g.wait(0.5);
  }
  async remix() {
    const g = this.g, f = g.follower();
    const v = this.variant === 'moon' ? 'star' : 'moon';
    this.setVariant(v);
    const pts = this.shape(v); this.beadPos.forEach((p, i) => p.copy(pts[i]));
    g.audio.cue('glimmer'); g.fx.sparkle(-2, 3.3, -9.4, { count: 14 });
    if (f && g.creatureDefs[f.id].element === 'glimmer') f.perform('glow');
    g.ui.toast(v === 'star' ? 'The lamps make a star!' : 'The lamps make a moon!', { icon: 'assets/ui/element-glimmer.svg' });
    const exp = v === 'star' ? 'exp:lamps_star' : 'exp:lamps_moon';
    if (!g.hasFlag(exp)) g.flag(exp);
    if (f && f.distTo(g.keeper.x, g.keeper.z) < 9) { f.perform('happy'); this.story.sayLine(f.id, 'toy'); await this.story.friendEvent(f.id, `play:lantern_picnic:${f.id}`); }
  }
}

export function buildToys(story) {
  return {
    leaf_slide: new LeafSlide(story),
    lotus_steps: new LotusSteps(story),
    pinwheel_canopy: new PinwheelCanopy(story),
    lantern_picnic: new LanternPicnic(story),
  };
}
export { Toy };
void halo;
