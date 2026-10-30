// Story: explicit encounter states (unseen → noticed → helping → friend) and
// project states (locked → ready → acting → complete), goals, homes and the
// shared friendship / project / growth flows. Creature-specific scenes live in
// encounters.js; project toys in toys.js; the finale in finale.js.
import * as THREE from 'three';
import { LINES, PROJECT_TEXT, ELEMENT_TEXT } from './content.js';
import { CREATURE_IDS, PROJECT_IDS, PREREQS } from './save.js';
import { buildEncounters } from './encounters.js';
import { buildToys } from './toys.js';
import { buildFinale } from './finale.js';
import { pick } from './game.js';

export const CANCEL = Symbol('cancel');
const ICON = { sprout: 'assets/ui/element-sprout.svg', splash: 'assets/ui/element-splash.svg', gust: 'assets/ui/element-gust.svg', glimmer: 'assets/ui/element-glimmer.svg' };
export { ICON };

export function createStory(game) { return new Story(game); }

export class Story {
  constructor(game) {
    this.g = game;
    this.state = {};       // creatureId -> encounter state
    this.pstate = {};      // projectId  -> project state
    this.goalPos = null; this.goal = null;
    this.branch = null;
    const done = id => game.progress.friends[id];
    for (const id of CREATURE_IDS) this.state[id] = done(id) ? 'friend' : 'unseen';
    this.enc = buildEncounters(this);
    this.toys = buildToys(this);
    this.finale = buildFinale(this);
    this.refreshProjects();
    for (const id of CREATURE_IDS) this.placeCreature(id);
    this.trailTimer = 0;
    game.on('progress', () => { this.refreshProjects(); this.refreshAvailability(); });
  }

  // ---------- state helpers ----------
  available(id) {
    const enc = this.g.data.world.encounters.find(e => e.creatureId === id);
    return enc.availableAfter.every(p => this.g.isDone(p));
  }
  refreshProjects() {
    for (const p of PROJECT_IDS) {
      if (this.pstate[p] === 'acting') continue;
      this.pstate[p] = this.g.isDone(p) ? 'complete' : PREREQS[p].every(q => this.g.isDone(q)) ? 'ready' : 'locked';
    }
  }
  refreshAvailability() {
    for (const id of CREATURE_IDS) {
      const a = this.g.actors[id];
      if (!a.root.visible && (this.state[id] === 'friend' || this.available(id))) this.placeCreature(id, true);
    }
  }
  setState(id, s) { if (this.state[id] !== s) { this.state[id] = s; this.g.emit('encounter', { id, state: s }); } }

  placeCreature(id, appear = false) {
    const a = this.g.actors[id], e = this.enc[id];
    if (this.state[id] === 'friend') {
      a.root.visible = true;
      const sel = this.g.progress.selectedFriendId === id;
      if (sel) this.g.teleportNear(a);
      else { const h = this.homeOf(id); a.place(h.x, h.z); }
      e.onFriendPlaced?.();
    } else if (this.available(id)) {
      a.root.visible = true; e.setup();
      if (appear) { this.g.fx.sparkle(a.x, 0.6, a.z, { count: 14 }); }
    } else { a.root.visible = false; e.hideProps?.(); }
  }

  homeOf(id) { return this.enc[id].home; }
  homeBeat(a) { this.enc[a.id].homeBeat?.(a); }

  // ---------- script helpers ----------
  say(id, text, opts) {
    // During the picnic show only friends speak; ambient chatter from others waits.
    if (this.g.inCutscene && this.state[id] !== 'friend') return;
    this.g.say(this.g.actors[id], text, opts);
  }
  sayLine(id, key) { const l = LINES[id][key]; if (l) this.say(id, Array.isArray(l) ? pick(l) : l); }
  /** Say lines one after another with reading time between them. */
  async talk(id, lines, gap = 0.25) {
    for (const line of lines) {
      this.say(id, line);
      await this.g.wait(Math.max(1.5, 0.9 + line.split(/\s+/).length * 0.3) + gap);
    }
  }
  shot(x, z, span = 9, blend = 1.1, y = 0) { this.g.camera.setShot({ x, y, z, span }, this.g.reducedMotion ? 0.01 : blend); }
  endShot() { this.g.camera.clearShot(); }
  async hop(actor, x, z, { y = null, height = 0.6, dur = 0.55 } = {}) {
    const g = this.g, sx = actor.x, sz = actor.z, sy = actor.root.position.y;
    const ey = y ?? g.island.heightAt(x, z);
    actor.scripted = true; actor.scriptY = true; actor.face(x, z);
    actor.perform('hop', { dur });
    await g.tween(dur, (e, u) => {
      actor.root.position.set(sx + (x - sx) * u, sy + (ey - sy) * u + Math.sin(u * Math.PI) * height, sz + (z - sz) * u);
    });
    actor.ground = ey; actor.scriptY = false;
  }
  /** Lock the Keeper for a cutscene beat. */
  hold(on) { const k = this.g.keeper; k.scripted = on; this.g.lockControl = on; if (on) { k.moveIntent.set(0, 0); k.vel.set(0, 0); } }
  async keeperWalk(x, z, face) {
    const k = this.g.keeper; k.scripted = false;
    const ok = await k.walkTo(x, z, { speed: k.spec.speed * 0.85, tol: 0.2, face });
    k.scripted = true; return ok;
  }

  // ---------- shared flows ----------
  /** Friendship acceptance: bump, jingle, +friend, memory stamp, optional nickname, follow. */
  async acceptFriend(id) {
    const g = this.g, a = g.actors[id], k = g.keeper, def = g.creatureDefs[id];
    a.scripted = true; a.lookTarget = k.pos; k.lookTarget = a.pos;
    const ang = Math.atan2(a.x - k.x, a.z - k.z), d = a.distTo(k.x, k.z);
    if (d > 1.3) await a.walkTo(k.x + Math.sin(ang) * 1.05, k.z + Math.cos(ang) * 1.05, { speed: a.spec.speed, tol: 0.15 });
    a.face(k.x, k.z); k.face(a.x, a.z);
    await g.wait(0.15);
    a.perform('bump'); await g.wait(0.42);
    k.perform('bigHappy'); a.perform('happy');
    g.audio.befriend(); g.camera.nudge(0.07);
    g.fx.sparkle(a.x, 1.0, a.z, { count: 24 }); g.fx.leafBurst(a.x, 0.6, a.z, { count: 8, colors: ['#E6B85C', '#7C986A', '#F6EEDC'] });
    g.ui.floater(a, '+ New friend!', { icon: ICON[def.element] });
    this.setState(id, 'friend');
    g.befriend(id, '');
    await g.wait(0.9);
    g.ui.flyToBook(a);
    await g.wait(1.1);
    const name = await g.ui.nickname(id);
    a.perform('happy'); this.sayLine(id, 'thanks');
    if (name) { g.setNickname(id, name); g.ui.floater(a, name + '!'); } // floats above the thanks bubble
    g.ui.toast(`Memory: "${def.memoryLine}"`, { icon: 'assets/ui/item-memory.svg', dur: 3600 });
    k.lookTarget = null; a.lookTarget = null; a.scripted = false;
    g.emit('friends');
  }

  async celebrateGrowth(id) {
    const g = this.g, a = g.actors[id];
    a.setGrown(true);
    const seed = a.seed; if (seed) { const s0 = seed.scale.clone(); await g.tween(0.5, e => seed.scale.copy(s0).multiplyScalar(Math.max(0.01, e)), { ease: backOut }); }
    g.audio.grow(); g.fx.sparkle(a.x, 1.1, a.z, { count: 20, color: '#E6B85C' }); g.camera.nudge(0.05);
    const moves = { tumbletuft: 'bow', foldfern: 'pose', puddleloop: 'happy', siltbell: 'bow', whirli: 'spin', kitefin: 'formalBow', glintot: 'glow', hushbulb: 'glow' };
    a.perform(moves[id] || 'happy'); this.sayLine(id, 'growth');
    if (id === 'whirli') setTimeout(() => a.perform('wobble'), 900);
    g.ui.toast(`${g.displayName(id)} grew an amber friendship seed!`, { icon: 'assets/ui/item-seed.svg', dur: 3200 });
    this.g.portraitVersion[id] = (this.g.portraitVersion[id] || 0) + 1; g.emit('friends');
  }
  /** Record a unique per-friend event; celebrate if it grew. */
  async friendEvent(id, ev) { if (this.g.addFriendEvent(id, ev)) await this.celebrateGrowth(id); }

  /** Pond and pinwheel each wake one lamp on the Lantern Rise gate; both open it. */
  async lightGateLamp(el) {
    const g = this.g, gate = g.island.gates.dusk, L = gate.lamps[el];
    const gx = gate.group.position.x, gz = gate.group.position.z;
    this.shot(gx, gz + 0.8, 9, 1.1, 1.0);
    await g.wait(1.1);
    g.openGatesFor(null);
    const lw = L.lamp.getWorldPosition(new THREE.Vector3());
    g.audio.chime(el === 'gust' ? 2 : 1); g.fx.sparkle(lw.x, lw.y, lw.z, { count: 14, color: el === 'gust' ? '#AED8CF' : '#5AA9A0' });
    await g.wait(1.0);
    if (gate.open) {
      g.fx.leafBurst(gx, 1, gz, { count: 16, colors: ['#77708F', '#5f5a78', '#E6B85C'] }); g.audio.whoosh(); g.camera.nudge(0.05);
      g.ui.toast('Lantern Rise is open!', { icon: 'assets/ui/element-glimmer.svg', dur: 3000 });
      await g.wait(1.6);
    } else {
      g.ui.toast(el === 'gust' ? "The gate's wind lamp woke up! Its water lamp is still asleep." : "The gate's water lamp woke up! Its wind lamp is still asleep.", { icon: ICON[el], dur: 3600 });
      await g.wait(1.2);
    }
    this.endShot(); await g.wait(0.3);
  }

  /** Element check at a project socket. Returns the helper actor or null (with a gentle hint). */
  helperFor(projectId) {
    const g = this.g, el = g.data.world.projects.find(p => p.id === projectId).element;
    const f = g.follower();
    if (f && g.creatureDefs[f.id].element === el) return f;
    // Gentle hint: the follower shakes its head; the bubble shows the needed element icon.
    const friendsWith = g.friendIds().filter(id => g.creatureDefs[id].element === el);
    const need = `This needs a ${ELEMENT_TEXT[el]} friend.`;
    if (f) { f.perform('shake'); g.say(f, pick(LINES[f.id].wrong)); }
    g.ui.toast(friendsWith.length ? `${need} Press Friend to bring ${g.displayName(friendsWith[0])}.` : need, { icon: ICON[el], dur: 3200 });
    return null;
  }

  /** Shared project handler: validate, act once, commit once. */
  async runProject(projectId) {
    const g = this.g;
    if (this.pstate[projectId] !== 'ready') return;
    const helper = this.helperFor(projectId); if (!helper) return;
    await g.run(async () => {
      this.pstate[projectId] = 'acting';
      this.hold(true); helper.scripted = true;
      try {
        await this.toys[projectId].act(helper);
        g.completeProject(projectId);
        this.pstate[projectId] = 'complete';
        g.audio.fanfare(); g.camera.nudge(0.08);
        g.ui.toast(`New toy: ${PROJECT_TEXT[projectId].name}!`, { icon: ICON[g.data.world.projects.find(p => p.id === projectId).element], dur: 3000 });
        g.island.setSkyStage(g.skyStage());
        await this.toys[projectId].reveal?.();
        this.sayLine(helper.id, 'projectDone');
        await this.friendEvent(helper.id, `participate:${projectId}:${helper.id}`);
      } finally {
        if (this.pstate[projectId] === 'acting') this.pstate[projectId] = g.isDone(projectId) ? 'complete' : 'ready';
        helper.scripted = false; this.hold(false); this.endShot();
      }
    });
  }
  /** A new friend helps again at a finished project (participation without resetting progress). */
  async replayProject(projectId, helper) {
    const g = this.g;
    await g.run(async () => {
      this.hold(true); helper.scripted = true;
      try { await this.toys[projectId].replay(helper); await this.friendEvent(helper.id, `participate:${projectId}:${helper.id}`); }
      finally { helper.scripted = false; this.hold(false); this.endShot(); }
    });
  }

  // ---------- opening ----------
  async begin({ fresh }) {
    const g = this.g;
    g.inCutscene = true;
    g.ui.showHud(false);
    if (fresh && !g.hasFlag('seen:intro')) {
      // Establishing shot: the folded crown canopy, then the little Keeper.
      document.body.classList.add('cinema');
      const cap = document.createElement('div'); cap.className = 'cinema-caption pop'; cap.textContent = 'Tonight is the first Moon Picnic!';
      document.getElementById('app').append(cap);
      g.camera.zoomTarget = 1.25; this.shot(0, 1, 15, 0.01, 1.5);
      await g.wait(2.6);
      cap.textContent = 'But first... who is that, in the meadow?';
      this.shot(-15.5, 8.6, 10, 1.6);
      await g.wait(2.4);
      cap.remove(); document.body.classList.remove('cinema');
      this.endShot(); g.camera.zoomTarget = 1;
      g.flag('seen:intro');
    } else {
      this.endShot(); g.camera.snapTo(g.keeper.pos);
      if (!fresh) g.ui.toast('Welcome back to the island!', { icon: 'assets/ui/item-seed.svg' });
    }
    g.inCutscene = false;
    g.ui.showHud(true);
    g.ui.setTarget(g.selectedTarget);
    this.updateGoal(true);
    g.emit('started');
  }

  // ---------- per-frame ----------
  update(dt) {
    const g = this.g;
    for (const id of CREATURE_IDS) this.enc[id].update?.(dt);
    for (const p of PROJECT_IDS) this.toys[p].update?.(dt);
    this.finale.update?.(dt);
    this.trailTimer -= dt;
    if (this.trailTimer <= 0) { this.trailTimer = 0.35; this.updateGoal(); }
  }

  interactables() {
    const list = [];
    for (const id of CREATURE_IDS) { const e = this.enc[id]; if (this.g.actors[id].root.visible || e.alwaysInteract) e.interactables?.(list); }
    for (const p of PROJECT_IDS) this.toys[p].interactables?.(list);
    this.finale.interactables?.(list);
    return list;
  }

  // ---------- goals: chip text, beacon, sparkle trail ----------
  computeGoal() {
    const g = this.g, S = this.state, done = p => g.isDone(p), w = g.data.world;
    const enc = this.enc, toys = this.toys;
    if (S.tumbletuft !== 'friend') return enc.tumbletuft.goal();
    if (!done('leaf_slide')) return toys.leaf_slide.goal();
    if (!g.hasFlag('rode:leaf_slide')) return toys.leaf_slide.rideGoal();
    if (!(done('lotus_steps') && done('pinwheel_canopy'))) {
      const branches = { wind: { c: 'whirli', p: 'pinwheel_canopy' }, pond: { c: 'puddleloop', p: 'lotus_steps' } };
      const open = Object.entries(branches).filter(([, b]) => !done(b.p));
      if (!this.branch || done(branches[this.branch].p)) {
        // Continue a started branch; else pick the closer one and stick with it.
        const started = open.find(([, b]) => S[b.c] === 'friend' || S[b.c] === 'helping');
        if (started) this.branch = started[0];
        else {
          const k = g.keeper; let best = null, bd = Infinity;
          for (const [name, b] of open) { const a = g.actors[b.c], d = a.distTo(k.x, k.z); if (d < bd) { bd = d; best = name; } }
          this.branch = best;
        }
      }
      const b = branches[this.branch];
      if (S[b.c] !== 'friend') return enc[b.c].goal();
      return toys[b.p].goal();
    }
    if (S.glintot !== 'friend') return enc.glintot.goal();
    if (!done('lantern_picnic')) return toys.lantern_picnic.goal();
    if (!g.progress.finale.seen) return this.finale.goal();
    // Free play: suggest an optional friend still to meet (never required).
    for (const id of ['foldfern', 'siltbell', 'kitefin', 'hushbulb']) if (S[id] !== 'friend' && this.available(id)) return { ...enc[id].goal(), optional: true };
    void w;
    return { text: 'Free play! Ring the bell again any time.', icon: 'assets/ui/item-bell.svg', pos: null };
  }

  updateGoal(force = false) {
    const g = this.g; if (g.titleMode || g.inCutscene) { g.fx.setBeacon(null); g.fx.setTrail(null); return; }
    const goal = this.computeGoal();
    this.goal = goal; g.ui.setGoal(goal);
    const p = goal.pos; this.goalPos = p || null;
    const k = g.keeper, far = p && Math.hypot(p.x - k.x, p.z - k.z) > 3.2;
    g.fx.setBeacon(p && !g.busy ? { x: p.x, y: p.y || 0, z: p.z, h: p.h || 2.0 } : null);
    if (p && far && !g.busy) {
      const path = g.island.nav.path(k.x, k.z, p.x, p.z, { maxGoalR: 3 });
      g.fx.setTrail(path);
    } else g.fx.setTrail(null);
    void force;
  }
}

export const backOut = u => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
export const easeInOut = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
