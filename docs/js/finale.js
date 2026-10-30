// The Moon Picnic: choose a guest of honour, ring the bell, press Go, and
// watch every finished project contribute to a short, skippable chain reaction.
// Every friend arrives on a short fixed route; Tumbletuft tries to go first
// again, then gives the best seat away. Then free play continues.
import * as THREE from 'three';
import { mesh, mat, leafGeometry, halo, PAL } from './props.js';
import { backOut } from './story.js';

const CENTER = new THREE.Vector3(-2, 0, -10);
// Seat 6 sits on the far side of the ring (away from the fixed camera), so the guest
// faces the camera. The Keeper and Tumbletuft sit on either side of it.
const BEST = 6;
const KEEPER_SEAT = 7, TUFT_SEAT = 5;
const MOON = new THREE.Vector3(-6.2, 4.7, -10.2); // above-left on screen, clear of every seat

export function buildFinale(story) { return new Finale(story); }

class Finale {
  constructor(story) {
    this.story = story; this.g = story.g;
    const root = this.g.island.root, g = this.g;
    this.bell = { x: 3.6, z: -9.0 };
    // Bell frame (painted wood) with the picnic bell.
    this.bellGroup = new THREE.Group(); this.bellGroup.position.set(this.bell.x, 0, this.bell.z); root.add(this.bellGroup);
    [-0.45, 0.45].forEach(x => this.bellGroup.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.9, 6), 'cream', { pos: [x, 0.95, 0] })));
    this.bellGroup.add(mesh(new THREE.BoxGeometry(1.1, 0.1, 0.12), 'clay', { pos: [0, 1.9, 0] }));
    this.swing = new THREE.Group(); this.swing.position.set(0, 1.85, 0); this.bellGroup.add(this.swing);
    this.swing.add(mesh(new THREE.CylinderGeometry(0.12, 0.34, 0.5, 9), 'amber', { pos: [0, -0.3, 0], material: mat('amber', { glow: 0.15, unique: true }) }));
    this.swing.add(mesh(new THREE.TorusGeometry(0.33, 0.04, 5, 14), 'clay', { pos: [0, -0.54, 0], rot: [Math.PI / 2, 0, 0] }));
    this.swing.add(mesh(new THREE.IcosahedronGeometry(0.07, 0), 'ink', { pos: [0, -0.6, 0] }));
    this.bellGlow = halo('amber', 1.4, 0); this.bellGlow.position.set(0, 1.55, 0); this.bellGroup.add(this.bellGlow);
    g.island.addOccluder(this.bellGroup);
    g.island.collision.circle('bell_l', this.bell.x - 0.45, this.bell.z, 0.12, 'props');
    g.island.collision.circle('bell_r', this.bell.x + 0.45, this.bell.z, 0.12, 'props');
    // Seats: the kit's nine floor sockets (8 friends + Keeper), in world space.
    const picnic = g.island.projects.lantern_picnic; picnic.updateMatrixWorld(true);
    this.seats = picnic.userData.seatingSockets.map(p => picnic.localToWorld(new THREE.Vector3(...p)));
    this.cushion = mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.12, 10), 'amber', { pos: [this.seats[BEST].x, 0.07, this.seats[BEST].z] }); root.add(this.cushion);
    this.cushion.add(mesh(new THREE.TorusGeometry(0.22, 0.05, 4, 12, Math.PI * 1.3), 'cream', { pos: [0, 0.08, 0], rot: [-Math.PI / 2, 0, 0.6] }));
    // Moon lamp overhead and the leaf picnic blanket (shown by the finale).
    this.moon = new THREE.Group(); this.moon.position.copy(MOON); root.add(this.moon);
    const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.24, 8, 20, Math.PI * 1.25), new THREE.MeshStandardMaterial({ color: PAL.cream, emissive: '#FFE7B0', emissiveIntensity: 0.9, flatShading: true }));
    crescent.rotation.z = Math.PI * 0.6; this.moon.add(crescent);
    this.moonHalo = halo('#FFE7B0', 4.5, 0.6); this.moon.add(this.moonHalo); this.moon.visible = !!g.progress.finale.seen;
    this.blanket = new THREE.Mesh(leafGeometry(0.06), mat('#A9C77E')); this.blanket.rotation.x = -Math.PI / 2; this.blanket.scale.set(3.4, 4.2, 0.4);
    this.blanket.position.set(CENTER.x, 0.17, CENTER.z + 2.1); root.add(this.blanket); this.blanket.visible = !!g.progress.finale.seen;
    this.flyLeaf = new THREE.Mesh(leafGeometry(0.2), mat('#A9C77E', { side: THREE.DoubleSide })); this.flyLeaf.scale.set(0.9, 1.3, 0.8); this.flyLeaf.visible = false; root.add(this.flyLeaf);
    this.floatLamp = new THREE.Group(); root.add(this.floatLamp); this.floatLamp.visible = false;
    this.floatLamp.add(mesh(new THREE.IcosahedronGeometry(0.2, 0), 'amber', { material: mat('amber', { glow: 0.8 }) })); this.floatLamp.add(halo('amber', 1.2, 0.6));
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 5, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#FFE7B0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    // The glow beam rises from the picnic to the moon lamp.
    this.beam.position.set((CENTER.x + MOON.x) / 2, MOON.y / 2, (CENTER.z + MOON.z) / 2);
    this.beam.scale.y = Math.hypot(MOON.x - CENTER.x, MOON.y, MOON.z - CENTER.z) / 5;
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(MOON.x - CENTER.x, MOON.y, MOON.z - CENTER.z).normalize());
    root.add(this.beam);
    this.running = false;
  }

  goal() { return { text: 'Ring the picnic bell!', icon: 'assets/ui/item-bell.svg', pos: { x: this.bell.x, z: this.bell.z, h: 2.6 } }; }
  ready() { return this.g.isDone('lantern_picnic'); }
  update(dt) {
    const t = this.g.time;
    this.bellGlow.material.opacity = this.ready() && !this.running ? 0.35 + Math.sin(t * 3) * 0.15 : 0;
    if (!this.running) this.swing.rotation.z *= Math.exp(-dt * 3);
    if (this.moon.visible) this.moon.position.y = MOON.y + Math.sin(t * 0.8) * 0.08;
  }
  interactables(list) {
    if (this.g.busy || this.running || !this.g.island.gates.dusk.open) return;
    if (this.ready()) list.push({ id: 'picnic_bell', x: this.bell.x, z: this.bell.z, r: 1.7, ring: 0.7, label: this.g.progress.finale.seen ? 'Ring the bell again!' : 'Ring the picnic bell!', short: 'Ring!', icon: 'assets/ui/item-bell.svg', onAction: () => this.start() });
    else list.push({ id: 'picnic_bell_early', x: this.bell.x, z: this.bell.z, r: 1.5, ring: 0.6, label: 'Ring the bell', short: 'Ring', icon: 'assets/ui/item-bell.svg', onAction: () => this.early() });
  }
  early() {
    this.ring(1); this.g.ui.toast('Ding! The picnic lamps are still dark. Light them first!', { icon: 'assets/ui/element-glimmer.svg', dur: 3000 });
  }
  ring(times = 3) {
    const g = this.g; g.keeper.perform('push');
    for (let i = 0; i < times; i++) setTimeout(() => { g.audio.bell(523.25 * (i === 2 ? 1.5 : 1)); this.swingV = 1; }, i * 420);
    g.tween(0.42 * times + 0.6, (e, u) => this.swing.rotation.z = Math.sin(u * Math.PI * 2 * times) * 0.45 * (1 - u));
  }

  // ------------------------------------------------------------
  async start() {
    const g = this.g, st = this.story, ui = g.ui;
    await g.run(async () => {
      const friends = g.friendIds();
      const guest = await ui.choose('Who is the guest of honour?', 'The guest of honour gets the very best seat at the Moon Picnic.',
        friends.map(id => ({ value: id, label: g.displayName(id), img: ui.portraits.get(g.actors[id], { version: g.portraitVersion[id] || 0 }) })), { dismissible: true });
      if (!guest) return;
      st.hold(true);
      await st.keeperWalk(this.bell.x - 0.2, this.bell.z + 0.9, [this.bell.x, this.bell.z]);
      this.ring(3);
      st.say(guest, 'Me? The guest of honour? Really?');
      await g.wait(1.6);
      const go = await ui.modal((card, close) => {
        ui.head(card, 'Ready for the Moon Picnic?');
        card.append(Object.assign(document.createElement('p'), { textContent: 'Every toy you built will help. Press Go!' }));
        const row = document.createElement('div'); row.className = 'row';
        row.append(ui.button('Not yet', { onClick: () => close(false) }), ui.button('Go!', { primary: true, cls: 'big', onClick: () => close(true) }));
        card.append(row);
      }, { dismissible: false, soft: true, label: 'Start the Moon Picnic' });
      if (!go) { st.hold(false); return; }
      await this.play(guest);
    });
  }

  /** The chain reaction (≤ 45 s). Skippable at any moment. */
  async play(guest) {
    const g = this.g, st = this.story, ui = g.ui;
    this.running = true; this.skipped = false; this.guest = guest;
    g.inCutscene = true; document.body.classList.add('cinema');
    g.ui.clearBubbles();
    const cap = document.createElement('div'); cap.className = 'cinema-caption';
    const skip = ui.button('Skip', { cls: 'skip-btn' }); skip.setAttribute('aria-label', 'Skip the Moon Picnic show');
    const app = document.getElementById('app'); app.append(cap, skip);
    this.skipResolve = null;
    const skipped = new Promise(r => { this.skipResolve = r; });
    const doSkip = () => { if (!this.skipped) { this.skipped = true; this.skipResolve(); } };
    skip.addEventListener('click', doSkip);
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); doSkip(); } };
    document.addEventListener('keydown', onKey);
    const caption = text => { cap.textContent = text; cap.classList.remove('pop'); void cap.offsetWidth; cap.classList.add('pop'); };
    const beat = s => Promise.race([g.wait(s), skipped]);
    g.audio.startMusic('picnic');
    const friends = g.friendIds();
    this.t0 = g.time;
    try {
      // 1) Leaf slide: a big leaf zooms down and flies off.
      caption('The leaf slide sends a picnic blanket!');
      st.shot(-11.5, 5, 10, 0.8, 1);
      const L = this.flyLeaf; L.visible = true; L.position.set(-14.2, 2.4, 5);
      if (!this.skipped) await Promise.race([g.tween(1.3, e => { L.position.set(-14.2 + 4.8 * e, 2.4 - 2.1 * e, 5); L.rotation.set(-Math.PI / 2, 0, -0.4); }, { ease: u => u * u }), skipped]);
      g.audio.slideWhee(1.0);
      const tt = g.actors.tumbletuft; if (tt.root.visible && !this.skipped) { st.say('tumbletuft', 'That is MY slide! Go, leaf, go!'); tt.perform('happy'); }
      if (!this.skipped) await Promise.race([g.tween(1.4, (e, u) => { L.position.set(-9.4 + 6 * e, 0.3 + Math.sin(u * Math.PI) * 3.5, 5 - 4 * e); L.rotation.z += 0.1; }), skipped]);
      // 2) Pond: a ripple carries a lantern across the pads.
      caption('A ripple carries a lantern across the pond!');
      st.shot(9.5, -1.6, 11, 0.9);
      const F = this.floatLamp; F.visible = true; L.visible = false;
      const pads = g.island.padCenters;
      for (let i = 0; i < pads.length && !this.skipped; i++) {
        const [x, z] = pads[i]; F.position.set(x, 0.55, z); g.fx.ripple(x, z, { y: 0.12, size: 2.8 });
        g.island.lotusPads[i].userData.dipV -= 1; g.audio.padNote(i, g.progress.toyVariants.lotus_steps === 'high_song');
        await beat(0.45);
      }
      if (!this.skipped) await Promise.race([g.tween(1.0, (e) => F.position.set(14.6 - 9 * e, 0.55 + e * 3, 0.4 + 1.5 * e)), skipped]);
      // 3) Canopy: the wind turns and blows everything toward Lantern Rise.
      caption('The canopy wind blows it all to Lantern Rise!');
      st.shot(0, 1.6, 11, 0.9, 1.4);
      st.toys.pinwheel_canopy.boost(6); g.audio.gustLoop(2.2); g.audio.cue('gust');
      for (let i = 0; i < 3 && !this.skipped; i++) { g.fx.swirl(0, 1.5 + i * 0.5, 1 - i * 1.2, { count: 12 }); await beat(0.5); }
      L.visible = true; L.scale.set(0.9, 1.3, 0.8);
      if (!this.skipped) await Promise.race([g.tween(1.5, e => { L.position.set(-0.5 - 1.5 * e, 3.2 - 1.8 * e, 1 - 9 * e); F.position.set(1 - 3 * e, 4 - 0.5 * e, 2 - 12 * e); L.rotation.z += 0.12; }), skipped]);
      // 4) Picnic: the leaf unfurls into the picnic surface; a glow lights the moon lamp.
      caption('A tiny glow lights the moon lamp!');
      st.shot(CENTER.x, CENTER.z + 0.5, 12, 0.9, 1.8);
      L.visible = false; this.blanket.visible = true; this.blanket.scale.set(0.1, 0.1, 0.4);
      g.fx.leafBurst(CENTER.x, 0.6, CENTER.z + 1.5, { count: 14 });
      if (!this.skipped) await Promise.race([g.tween(0.8, e => this.blanket.scale.set(3.4 * e + 0.1, 4.2 * e + 0.1, 0.4), { ease: backOut }), skipped]);
      const glim = friends.find(id => g.creatureDefs[id].element === 'glimmer') || 'glintot';
      if (g.actors[glim]?.root.visible && !this.skipped) { g.actors[glim].perform('glow', { dur: 2 }); st.say(glim, 'Shine!'); }
      this.beam.material.opacity = 0;
      if (!this.skipped) await Promise.race([g.tween(1.2, (e, u) => { this.beam.material.opacity = Math.sin(u * Math.PI) * 0.5; F.position.set(CENTER.x + (MOON.x - CENTER.x) * e, 1.5 + (MOON.y - 1.5) * e, CENTER.z + (MOON.z - CENTER.z) * e); }), skipped]);
      F.visible = false; this.moon.visible = true; this.moon.scale.setScalar(0.01);
      g.audio.cue('glimmer'); g.island.setSkyStage(5);
      if (!this.skipped) await Promise.race([g.tween(0.7, e => this.moon.scale.setScalar(Math.max(0.01, e)), { ease: backOut }), skipped]);
      g.camera.nudge(0.05);
      // 5) Everyone arrives on short fixed routes. Tumbletuft tries to go first again...
      caption('Everyone is coming to the Moon Picnic!');
      st.shot(CENTER.x, CENTER.z, 13.5, 1.0, 0.6);
      if (!this.skipped) await this.arrive(guest, beat, caption);
      // 6) Pull back over the island the child changed.
      if (!this.skipped) {
        caption('Look at the island you changed together.');
        g.camera.setShot({ x: 0, y: 0, z: -1, span: 40 }, g.reducedMotion ? 0.01 : 4.5);
        await beat(5);
      }
    } finally {
      this.settle(guest);
      cap.remove(); skip.remove(); document.removeEventListener('keydown', onKey);
    }
    // Final card, then free play.
    g.progress.finale.seen = true; g.progress.finale.guestOfHonourId = guest; g.flag('finale:seen');
    g.save('finale');
    this.elapsed = g.time - this.t0;
    await this.finalCard(guest);
    document.body.classList.remove('cinema'); g.inCutscene = false;
    st.endShot(); g.camera.snapTo(g.keeper.pos);
    g.audio.stopMusic(2);
    this.release();
    this.running = false;
    this.story.hold(false);
    g.emit('finale');
  }

  /** Place everyone in the final arrangement (also the skip target). */
  settle(guest) {
    const g = this.g, friends = g.friendIds();
    g.ui.clearBubbles();
    this.flyLeaf.visible = false; this.floatLamp.visible = false; this.beam.material.opacity = 0;
    this.blanket.visible = true; this.blanket.scale.set(3.4, 4.2, 0.4);
    this.moon.visible = true; this.moon.scale.setScalar(1);
    g.island.setSkyStage(5, this.skipped);
    const seat = this.seatPlan(guest);
    for (const id of friends) {
      const a = g.actors[id], s = this.seats[seat[id]];
      a.stopGoal(); a.scripted = true; a.root.visible = true; a.place(s.x, s.z); a.face(CENTER.x, CENTER.z); a.sitting = true;
    }
    const k = g.keeper, ks = this.seats[KEEPER_SEAT]; k.stopGoal(); k.scripted = true; k.place(ks.x, ks.z); k.face(CENTER.x, CENTER.z);
    g.camera.setShot({ x: 0, y: 0, z: -1, span: 40 }, this.skipped ? 0.01 : 1);
  }
  seatPlan(guest) {
    const g = this.g, friends = g.friendIds(), plan = {};
    plan[guest] = BEST;
    if (guest !== 'tumbletuft' && friends.includes('tumbletuft')) plan.tumbletuft = TUFT_SEAT;
    const free = [4, 3, 8, 0, 2, 1, 5].filter(i => !Object.values(plan).includes(i) && i !== KEEPER_SEAT && i !== BEST);
    for (const id of friends) if (plan[id] === undefined) plan[id] = free.shift();
    return plan;
  }

  async arrive(guest, beat, caption) {
    const g = this.g, st = this.story, friends = g.friendIds(), plan = this.seatPlan(guest);
    const col = g.island.collision;
    // Keeper takes a seat first.
    const k = g.keeper, ks = this.seats[KEEPER_SEAT];
    k.place(ks.x + 0.5, ks.z + 1.4); k.scripted = false; k.walkTo(ks.x, ks.z, { tol: 0.2, face: [CENTER.x, CENTER.z] }).then(() => { k.scripted = true; });
    const startOf = i => {
      const s = this.seats[i], dx = s.x - CENTER.x, dz = s.z - CENTER.z, d = Math.hypot(dx, dz);
      for (const r of [6.4, 5.8, 5.2]) { const x = CENTER.x + dx / d * r, z = CENTER.z + dz / d * r; if (!col.blocked(x, z, 0.4)) return { x, z }; }
      return { x: s.x + dx / d * 0.8, z: s.z + dz / d * 0.8 };
    };
    // Tumbletuft dashes for the best seat (as always), tumbles in, then gives it away.
    const tuft = friends.includes('tumbletuft') ? g.actors.tumbletuft : null;
    const others = friends.filter(id => id !== 'tumbletuft');
    if (tuft) {
      const bs = this.seats[BEST], s0 = startOf(TUFT_SEAT);
      tuft.root.visible = true; tuft.place(s0.x, s0.z); tuft.scripted = true; tuft.sitting = false;
      st.say('tumbletuft', 'Me first! Me first! The best seat!');
      await Promise.race([tuft.walkTo(bs.x, bs.z, { tol: 0.25, run: true }), beat(3)]);
      tuft.perform('tumble'); await beat(1.5);
      st.say('tumbletuft', '...I meant to do that.'); tuft.perform('tada'); await beat(1.6);
    }
    // Everyone else arrives on short radial routes, a few at a time.
    const walks = [];
    others.forEach((id, n) => {
      const a = g.actors[id], target = this.seats[plan[id] === BEST && tuft && guest !== 'tumbletuft' ? BEST : plan[id]];
      const s0 = startOf(plan[id]);
      walks.push((async () => {
        await beat(n * 0.35);
        a.stopGoal(); a.root.visible = true; a.scripted = true; a.sitting = false; a.place(s0.x, s0.z);
        g.fx.puff(s0.x, 0.1, s0.z, { count: 4 }); g.audio.voice(id, 'hello friends');
        if (id === guest && tuft) await Promise.race([a.walkTo(target.x + 0.9, target.z + 0.9, { tol: 0.3 }), beat(3)]);
        else await Promise.race([a.walkTo(target.x, target.z, { tol: 0.25, face: [CENTER.x, CENTER.z] }), beat(3)]);
        a.sitting = id !== guest || !tuft;
      })());
    });
    await Promise.all(walks);
    if (tuft) {
      const firstChoice = g.progress.encounterFlags.find(f => f.startsWith('choice:slide_first:'));
      const name = g.displayName(guest);
      if (guest === 'tumbletuft') {
        st.say('tumbletuft', 'Wait... the guest of honour is ME? I get to stay? Best. Day. EVER.');
        tuft.perform('bigHappy'); await beat(2.6);
      } else {
        const line = firstChoice === 'choice:slide_first:tumbletuft'
          ? `You let me go first on the slide. So this time... ${name} goes first!`
          : `You went first on the slide, so I go first now! ...No. ${name} gets the best seat.`;
        tuft.face(g.actors[guest].x, g.actors[guest].z); st.say('tumbletuft', line); await beat(3.2);
        tuft.perform('bow'); await beat(0.9);
        const ts = this.seats[TUFT_SEAT];
        await Promise.race([tuft.walkTo(ts.x, ts.z, { tol: 0.25, face: [CENTER.x, CENTER.z] }), beat(2)]);
        const ga = g.actors[guest], bs = this.seats[BEST];
        await Promise.race([st.hop(ga, bs.x, bs.z, { height: 0.8, dur: 0.7 }), beat(1)]);
        ga.face(CENTER.x, CENTER.z); ga.sitting = true; ga.perform('happy'); st.say(guest, 'Thank you!');
        g.fx.sparkle(bs.x, 1, bs.z, { count: 18 }); g.audio.befriend(); await beat(1.6);
      }
      tuft.sitting = true;
    }
    caption(`${g.displayName(guest)} gets the best seat!`);
    await beat(1.6);
  }

  release() {
    const g = this.g;
    for (const id of g.friendIds()) { const a = g.actors[id]; a.sitting = false; a.scripted = false; }
    g.keeper.scripted = false;
  }

  finalCard(guest) {
    const g = this.g, ui = g.ui, friends = g.friendIds();
    const names = friends.map(id => g.displayName(id));
    const list = names.length > 1 ? names.slice(0, -1).join(', ') + ', ' + names[names.length - 1] : names[0];
    const custom = g.progress.customFriends[0];
    return ui.modal((card, close) => {
      card.classList.add('final-card');
      const h = document.createElement('h2'); h.textContent = 'The first Moon Picnic'; card.append(h);
      const faces = document.createElement('div'); faces.className = 'faces';
      for (const id of friends) {
        const im = document.createElement('img'); im.className = 'portrait' + (id === guest ? ' guest-face' : '');
        im.alt = g.displayName(id); im.src = ui.portraits.get(g.actors[id], { version: g.portraitVersion[id] || 0 }); faces.append(im);
      }
      card.append(faces);
      const line = document.createElement('p'); line.className = 'final-line';
      line.textContent = `The first Moon Picnic, made with ${list} and you.`; card.append(line);
      const gl = document.createElement('p'); gl.className = 'guest'; gl.textContent = `Guest of honour: ${g.displayName(guest)}`; card.append(gl);
      if (custom) { const c = document.createElement('p'); c.className = 'guest'; c.textContent = `Your own friend ${custom.nickname || g.displayName(custom.baseId)} came too!`; card.append(c); }
      const row = document.createElement('div'); row.className = 'row';
      row.append(ui.button('Keep playing', { primary: true, onClick: () => close(true) }));
      card.append(row);
    }, { dismissible: false, label: 'The first Moon Picnic' });
  }
}
