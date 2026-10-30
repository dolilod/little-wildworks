// Game hub: renderer, loop, time, keeper control, followers, interaction
// selection, progress reducer and saving. Story/encounter logic lives in story.js.
import * as THREE from 'three';
import { buildIsland, zoneAt, poseGate } from './world.js';
import { FollowCamera } from './camera.js';
import { FX } from './fx.js';
import { Actor } from './actors.js';
import { writeSave, storageAvailable, CREATURE_IDS } from './save.js';
import { LINES, DEFAULT_QUIRK, QUIRKS } from './content.js';

const STEP = 1 / 60;

export class Game {
  constructor({ canvas, data, models, textures, audio, input, ui, progress, saveMode, testMode }) {
    Object.assign(this, { canvas, data, models, textures, audio, input, ui, progress, testMode });
    this.saveMode = saveMode; // 'local' | 'off'
    this.time = 0; this.timeScale = 1; this.paused = false; this.started = false;
    this.waiters = []; this.tweens = [];
    this.busy = false; this.lockControl = false; this.stats = { ignoredActions: 0, actions: 0, frames: [], saves: 0 };
    this.events = new Map();
    this.creatureDefs = Object.fromEntries(data.creatures.creatures.map(c => [c.id, c]));
    this.reducedMotion = !!progress.settings.reducedMotion;

    // Renderer.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#D5EBE2', 62, 135);
    this.camera = new FollowCamera(data.world.camera ? { spanLandscape: data.world.camera.verticalSpanLandscape, spanPortrait: data.world.camera.verticalSpanPortrait } : {});
    this.camera.reducedMotion = this.reducedMotion;

    // World.
    this.island = buildIsland({ textures, completed: progress.completedProjects });
    this.scene.add(this.island.root);
    for (const id of progress.completedProjects) this.openGatesFor(id, true);
    this.island.setSkyStage(this.skyStage(), true);
    this.fx = new FX(this.scene, this); this.fx.reduced = this.reducedMotion;

    // Actors.
    this.actors = {};
    for (const id of ['keeper', ...CREATURE_IDS]) {
      const m = models[id];
      const a = new Actor(this, id, m.root, { source: m.source });
      this.actors[id] = a; this.scene.add(a.root);
      a.root.visible = id === 'keeper';
    }
    this.keeper = this.actors.keeper;
    const [px, , pz] = progress.player.position;
    this.keeper.place(px, pz, Math.atan2(1, 0.4));
    // A saved/imported position must be standable and connected to the spawn with the current
    // gates; otherwise start at the spawn (never strand the Keeper in water or behind a gate).
    const [sx, , sz] = data.world.playerSpawn;
    if (this.island.collision.blocked(px, pz, this.keeper.spec.radius) || !this.island.nav.reachable(sx, sz, px, pz, 0.6)) this.keeper.place(sx, sz);
    this.trail = [];
    this.applyFriendVisuals();

    this.camera.snapTo(this.keeper.pos);
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.ro = new ResizeObserver(this.onResize); this.ro.observe(canvas);
    this.resize();
    this.onFootstep = (actor, foot) => this.footstep(actor, foot);
    this.lastPad = null;
    this.zone = zoneAt(px, pz); this.zoneLabelShown = null;
    this.selectedTarget = null;
  }

  // ---------- events ----------
  on(name, fn) { if (!this.events.has(name)) this.events.set(name, new Set()); this.events.get(name).add(fn); return () => this.events.get(name).delete(fn); }
  emit(name, payload) { this.events.get(name)?.forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } }); }

  // ---------- time helpers (game time; pausable and fast-forwardable) ----------
  wait(seconds) { return new Promise(resolve => this.waiters.push({ at: this.time + seconds, resolve })); }
  tween(duration, fn, { ease = u => u } = {}) {
    return new Promise(resolve => this.tweens.push({ t: 0, duration: Math.max(0.0001, duration), fn, ease, resolve }));
  }
  /** Run an exclusive action script; duplicate action presses are ignored while it runs. */
  async run(script, { lock = false } = {}) {
    if (this.busy) return false;
    this.busy = true; if (lock) this.lockControl = true;
    this.emit('busy', true);
    try { await script(); } catch (e) { console.error(e); }
    finally { this.busy = false; if (lock) this.lockControl = false; this.emit('busy', false); }
    return true;
  }

  // ---------- loop ----------
  start() {
    if (this.started) return; this.started = true;
    let last = performance.now();
    const frame = now => {
      this.raf = requestAnimationFrame(frame);
      if (document.hidden) { last = now; return; }
      const rawMs = now - last; last = now;
      const real = Math.min(0.1, rawMs / 1000); // simulation step is clamped; the stat is not
      const fs = this.stats.frames; fs.push(rawMs); if (fs.length > 600) fs.shift();
      if (!this.paused) {
        let dt = real * this.timeScale;
        const steps = Math.min(8, Math.max(1, Math.ceil(dt / STEP)));
        for (let i = 0; i < steps; i++) this.update(dt / steps);
      }
      this.render();
    };
    this.raf = requestAnimationFrame(frame);
  }

  update(dt) {
    this.time += dt;
    // Tweens + waiters.
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i]; tw.t += dt; const u = Math.min(1, tw.t / tw.duration);
      tw.fn(tw.ease(u), u); if (u >= 1) { this.tweens.splice(i, 1); tw.resolve(); }
    }
    for (let i = this.waiters.length - 1; i >= 0; i--) if (this.time >= this.waiters[i].at) { const w = this.waiters.splice(i, 1)[0]; w.resolve(); }

    this.controlKeeper(dt);
    for (const a of Object.values(this.actors)) if (a.root.visible || a.isKeeper) a.update(dt, this.time);
    this.updateFollowers(dt);
    this.separate();
    this.story?.update(dt);
    this.updatePads();
    this.updateInteraction();
    this.island.update(this.time, dt, this.keeper.pos);
    this.fx.update(dt, this.time, this.camera.cam);
    this.updateZone(dt);
    // Ambient life: soft ripples on the pond now and then.
    this.rippleT = (this.rippleT ?? 1) - dt;
    if (this.rippleT <= 0) {
      this.rippleT = 1.2 + Math.random() * 1.8;
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.8;
      this.fx.ripple(10 + Math.cos(a) * 6 * r, -2 + Math.sin(a) * 4.6 * r, { y: 0.07, size: 1.2 + Math.random(), life: 1.6 });
    }
    // Title diorama: the camera drifts slowly over the meadow and the canopy.
    if (this.titleMode && this.camera.shot) {
      const t = this.time * 0.07;
      this.camera.shot.x = -9 + Math.sin(t) * 6; this.camera.shot.z = 5.5 + Math.cos(t * 0.8) * 2.5;
      this.camera.shot.span = this.camera.aspect < 1 ? 26 : 16; // portrait phones see more island
    }
    const k = this.keeper;
    this.camera.update(dt, this.camFocusOverride || { x: k.x, y: k.root.position.y, z: k.z }, this.camFocusOverride ? null : k.vel);
    if (this.input.consume('friend')) this.cycleFriend();
    if (this.input.consume('pause') && !this.inCutscene && !this.titleMode) this.ui.openPause();
    if (this.input.consume('mute')) this.setMuted(!this.progress.settings.muted);
  }

  render() {
    const isl = this.island;
    if (isl.skyColor) { this.scene.background = isl.skyColor; this.scene.fog.color.copy(isl.fogColor); }
    const k = this.keeper;
    // Fade points: the Keeper's feet, chest and head, the follower, the goal and the selected target.
    const ky = k.root.position.y;
    const pts = [new THREE.Vector3(k.x, ky + 0.2, k.z), new THREE.Vector3(k.x, ky + 0.9, k.z), new THREE.Vector3(k.x, ky + 1.45, k.z)];
    const f = this.follower(); if (f?.root.visible) pts.push(new THREE.Vector3(f.x, f.root.position.y + 0.5, f.z));
    const gp = this.story?.goalPos; if (gp && Math.hypot(gp.x - k.x, gp.z - k.z) < 12) pts.push(new THREE.Vector3(gp.x, 0.5, gp.z));
    const t = this.selectedTarget; if (t) pts.push(new THREE.Vector3(t.x, 0.4, t.z));
    // Use the real frame time so the fade is quick even on a slow frame rate.
    const now = performance.now(), fdt = Math.min(0.25, Math.max(0.001, (now - (this.lastRender || now)) / 1000)) || 1 / 60;
    this.lastRender = now;
    this.camera.updateFades(fdt, isl.occluders, pts);
    this.renderer.render(this.scene, this.camera.cam);
    this.ui?.frame?.();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.resize(w, h);
    this.viewW = w; this.viewH = h;
  }

  // ---------- keeper ----------
  controlKeeper(dt) {
    const k = this.keeper;
    if (k.goal || k.scripted) return; // a script is steering
    const mv = this.lockControl ? { x: 0, y: 0 } : this.input.move();
    const r = this.camera.right, u = this.camera.up;
    const wx = r.x * mv.x + u.x * mv.y, wz = r.z * mv.x + u.z * mv.y;
    const m = Math.hypot(mv.x, mv.y);
    k.intentSpeed = k.spec.speed * (m > 0 ? 0.35 + 0.65 * Math.min(1, m) : 1);
    k.moveIntent.set(m > 0 ? wx / Math.hypot(wx, wz) * Math.min(1, m) : 0, m > 0 ? wz / Math.hypot(wx, wz) * Math.min(1, m) : 0);
    if (m > 0.05) this.emit('moved', m);
    // Breadcrumbs for followers.
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(last.x - k.x, last.z - k.z) > 0.3) { this.trail.push({ x: k.x, z: k.z }); if (this.trail.length > 80) this.trail.shift(); }
  }

  footstep(actor, foot) {
    const zone = zoneAt(actor.x, actor.z);
    if (this.island.collision.onPad(actor.x, actor.z) && !this.island.collision.onPad(actor.x, actor.z).id.startsWith('islet')) return;
    this.audio.footstep(zone, foot);
    const side = foot ? 1 : -1, h = actor.root.rotation.y;
    if (actor.speed > 1.2 && Math.random() < 0.75) this.fx.puff(actor.x + Math.cos(h) * 0.12 * side, actor.root.position.y, actor.z - Math.sin(h) * 0.12 * side,
      { count: 2, size: 0.08, speed: 0.4, up: 0.35, color: zone === 'dusk' ? '#b9b0cf' : '#efe6cf' });
  }

  updatePads() {
    const pad = this.island.collision.onPad(this.keeper.x, this.keeper.z);
    const id = pad && pad.id.startsWith('lotus_pad_') ? Number(pad.id.slice(-1)) : pad?.id === 'side_pad' ? 5 : null;
    if (id !== this.lastPad) {
      this.lastPad = id;
      if (id !== null) {
        const high = this.progress.toyVariants.lotus_steps === 'high_song';
        this.audio.padNote(id, high);
        const p = id < 5 ? this.island.lotusPads[id] : null;
        if (p) p.userData.dipV -= 1.2;
        const c = id < 5 ? this.island.padCenters[id] : [this.island.props.sidePad.position.x, this.island.props.sidePad.position.z];
        this.fx.ripple(c[0], c[1], { y: 0.12, size: 3.2 });
        this.emit('pad', id);
      }
    }
  }

  updateZone(dt) {
    const z = zoneAt(this.keeper.x, this.keeper.z);
    if (z !== this.zone) { this.zone = z; this.zoneSince = this.time; }
    // Show the zone title once you have stood in it a moment.
    if (this.started && this.zone !== this.zoneLabelShown && this.time - (this.zoneSince || 0) > 0.6 && !this.inCutscene) {
      this.zoneLabelShown = this.zone; this.ui.zoneBanner(this.island.zoneLabels[this.zone]);
    }
    const w = this.zoneWeights ||= { meadow: 0, pond: 0, dusk: 0, canopy: 0, night: 0 };
    for (const key of ['meadow', 'pond', 'dusk', 'canopy']) w[key] += ((this.zone === key ? 1 : 0) - w[key]) * (1 - Math.exp(-dt * 1.5));
    w.night = this.island.sky.stage >= 5 ? 1 : 0;
    this.audio.update(dt, w);
  }

  // ---------- interaction ----------
  updateInteraction() {
    const k = this.keeper;
    let best = null, bestD = Infinity;
    if (!this.busy && !this.lockControl && !this.titleMode && !this.inCutscene && this.story) {
      for (const it of this.story.interactables()) {
        const d = Math.hypot(k.x - it.x, k.z - it.z);
        if (d <= it.r && d - (it.priority || 0) < bestD) { best = it; bestD = d - (it.priority || 0); }
      }
    }
    if (best?.id !== this.selectedTarget?.id) { this.selectedTarget = best; this.emit('target', best); }
    else this.selectedTarget = best;
    if (best) this.fx.showRing(best.x, best.y ?? this.island.heightAt(best.x, best.z), best.z, best.ring || 0.7);
    else this.fx.hideRing();
    if (this.input.consume('action')) {
      this.stats.actions++;
      if (this.titleMode || this.inCutscene) return;
      if (this.busy) { this.stats.ignoredActions++; return; }
      if (best) { this.audio.ui(); best.onAction(); }
      else this.wave();
    }
  }

  // ---------- friends ----------
  friendIds() { return Object.keys(this.progress.friends); }
  follower() { const id = this.progress.selectedFriendId; return id ? this.actors[id] : null; }
  displayName(id) {
    const c = this.progress.customFriends[0];
    if (c && c.baseId === id && c.nickname) return c.nickname;
    return this.progress.friends[id]?.nickname || this.creatureDefs[id]?.name || id;
  }
  quirkOf(id) {
    const c = this.progress.customFriends[0];
    const q = (c && c.baseId === id && c.quirkId) || this.progress.friends[id]?.quirkId || DEFAULT_QUIRK[id];
    return QUIRKS.find(x => x.id === q) || QUIRKS[0];
  }
  applyFriendVisuals() {
    for (const id of CREATURE_IDS) {
      const a = this.actors[id], f = this.progress.friends[id];
      const c = this.progress.customFriends[0];
      a.applyPalette(c && c.baseId === id ? c.palette : (f?.palette || {}));
      a.setGrown(f?.friendship === 'grown');
    }
  }

  cycleFriend() {
    const ids = this.friendIds();
    if (!ids.length) { this.ui.toast('No friends yet. Go say hello!'); return; }
    if (this.busy) return;
    const cur = ids.indexOf(this.progress.selectedFriendId);
    this.selectFriend(ids[(cur + 1) % ids.length]);
  }
  selectFriend(id) {
    if (!this.progress.friends[id]) return;
    const prev = this.progress.selectedFriendId;
    this.progress.selectedFriendId = id;
    const a = this.actors[id];
    if (prev !== id) {
      // Bring the new friend over with a hop; the previous one heads home.
      if (a.distTo(this.keeper.x, this.keeper.z) > 9) this.teleportNear(a);
      a.perform('happy'); this.say(a, pick(LINES[id].follow));
      this.audio.tick();
      this.save('select');
    }
    this.emit('friends');
  }
  teleportNear(a) {
    const k = this.keeper, back = k.root.rotation.y + Math.PI;
    for (const off of [0, 0.7, -0.7, 1.4, -1.4, Math.PI]) {
      const x = k.x + Math.sin(back + off) * 1.6, z = k.z + Math.cos(back + off) * 1.6;
      if (!this.island.collision.blocked(x, z, a.spec.radius, { water: !(a.spec.swim || a.spec.fly) })) { a.place(x, z, k.root.rotation.y); this.fx.puff(x, 0.1, z, { count: 6 }); return; }
    }
    a.place(k.x + 0.8, k.z + 0.8);
  }

  updateFollowers(dt) {
    const k = this.keeper, sel = this.progress.selectedFriendId;
    for (const id of this.friendIds()) {
      const a = this.actors[id];
      if (!a.root.visible || a.scripted || a.goal) continue;
      if (id === sel) this.follow(a, dt); else this.home(a, dt);
    }
    void k;
  }

  follow(a, dt) {
    const k = this.keeper, d = a.distTo(k.x, k.z);
    if (d > 16) { this.teleportNear(a); return; }
    let target = this.trailPoint(1.9);
    if (a.leadUntil) {
      if (this.time < a.leadUntil && k.speed > 0.6) {
        // Run a little ahead of the Keeper, along where it is heading.
        const vx = k.vel.x / (k.speed || 1), vz = k.vel.y / (k.speed || 1), ax = k.x + vx * 2.6, az = k.z + vz * 2.6;
        if (!this.island.collision.blocked(ax, az, a.spec.radius, { water: !(a.spec.swim || a.spec.fly) })) target = { x: ax, z: az };
      } else {
        a.leadUntil = 0; a.lookTarget = k.pos; a.perform('nod');
        if (!this.ui.anyBubble() && Math.random() < 0.6) this.say(a, LINES[a.id].follow.find(l => /still coming/.test(l)) || pick(LINES[a.id].follow));
      }
    }
    const idle = k.speed < 0.25;
    if (idle && d < 3.2) {
      // Settle beside the Keeper (not on top), on whichever side has room. The spot is
      // chosen once per stop, so the follower never hunts back and forth.
      if (!a._settle || Math.hypot(a._settle.kx - k.x, a._settle.kz - k.z) > 0.3) {
        const h = k.root.rotation.y;
        let spot = null;
        for (const side of [a._side || 1, -(a._side || 1)]) {
          const tx = k.x + Math.cos(h) * 1.3 * side - Math.sin(h) * 0.35, tz = k.z - Math.sin(h) * 1.3 * side - Math.cos(h) * 0.35;
          if (!this.island.collision.blocked(tx, tz, a.spec.radius, { water: !(a.spec.swim || a.spec.fly) })) { spot = { x: tx, z: tz }; a._side = side; break; }
        }
        a._settle = { kx: k.x, kz: k.z, spot: spot || { x: a.x, z: a.z } };
      }
      target = a._settle.spot;
    } else a._settle = null;
    const dx = target.x - a.x, dz = target.z - a.z, dd = Math.hypot(dx, dz);
    const urgency = Math.min(1.35, 0.6 + d / 6);
    const dead = idle ? 0.35 : 0.2; // arrival deadband: stop cleanly instead of jittering
    if (dd > dead) { const s = Math.min(1, (dd - 0.1) / 1.1); a.moveIntent.set(dx / dd * s, dz / dd * s); a.intentSpeed = a.spec.speed * urgency; }
    else a.moveIntent.set(0, 0);
    // Look at the Keeper when stopped; the quirk timer adds personality.
    a.lookTarget = (a.speed < 0.3) ? k.pos : null;
    a.quirkT = (a.quirkT ?? 6) - dt;
    if (a.quirkT <= 0 && !a.isPerforming()) {
      a.quirkT = 7 + Math.random() * 8;
      this.quirk(a);
    }
    a.chatT = (a.chatT ?? 18) - dt;
    if (a.chatT <= 0 && !this.busy && !this.ui.anyBubble()) { a.chatT = 22 + Math.random() * 18; this.say(a, pick(LINES[a.id].follow)); }
  }

  /** Action with nothing nearby: the Keeper waves, and a nearby friend waves back its own way. */
  wave() {
    const k = this.keeper; if (k.isPerforming('wave')) return;
    k.perform('wave'); this.audio.tick();
    const f = this.follower();
    if (f && f.distTo(k.x, k.z) < 5 && !f.scripted) { f.lookTarget = k.pos; setTimeout(() => this.quirk(f), 350); }
    this.emit('nothingHere');
  }

  /** Personality beat for the active follower (Tumbletuft looks back, etc). */
  quirk(a) {
    const q = this.quirkOf(a.id);
    if (q.id === 'look_back') {
      // Tumbletuft-style: scamper a little ahead, then turn round to check you are coming.
      const k = this.keeper;
      if (k.speed > 1 && !a.leadUntil) a.leadUntil = this.time + 2.2;
      else { a.lookTarget = k.pos; a.perform('tada'); }
    }
    else if (q.id === 'ripple_ring') { a.perform('float'); this.fx.ripple(a.x, a.z, { y: a.root.position.y + 0.1, size: 1.6 }); }
    else if (q.id === 'sneeze') a.perform('sneeze');
    else if (q.id === 'ear_spin') { a.perform('spin'); }
    else if (q.id === 'reflection') a.perform('reflect');
    else if (q.id === 'bow_echo') { a.perform('bow'); this.audio.bell(659.25, 0.03); }
    else a.perform(q.move);
  }

  home(a, dt) {
    const spot = this.story?.homeOf(a.id);
    if (!spot) return;
    const d = Math.hypot(spot.x - a.x, spot.z - a.z);
    const far = a.distTo(this.keeper.x, this.keeper.z) > 14;
    if (d > 1.2) {
      if (far && d > 4) { a.place(spot.x, spot.z); return; }
      const s = Math.min(1, d / 1.2); a.moveIntent.set((spot.x - a.x) / d * s, (spot.z - a.z) / d * s); a.intentSpeed = a.spec.speed * 0.7;
    } else {
      a.moveIntent.set(0, 0);
      a.lookTarget = a.distTo(this.keeper.x, this.keeper.z) < 6 ? this.keeper.pos : null;
      a.homeT = (a.homeT ?? 5 + Math.random() * 6) - dt;
      if (a.homeT <= 0 && !far) { a.homeT = 9 + Math.random() * 10; this.story?.homeBeat?.(a); }
    }
  }

  trailPoint(back) {
    const tr = this.trail, k = this.keeper;
    let acc = 0, prev = { x: k.x, z: k.z };
    for (let i = tr.length - 1; i >= 0; i--) {
      const p = tr[i], l = Math.hypot(p.x - prev.x, p.z - prev.z);
      if (acc + l >= back) { const u = (back - acc) / l; return { x: prev.x + (p.x - prev.x) * u, z: prev.z + (p.z - prev.z) * u }; }
      acc += l; prev = p;
    }
    return prev;
  }

  /** Keep creatures from overlapping each other or the Keeper. */
  separate() {
    const list = Object.values(this.actors).filter(a => a.root.visible && !a.scripted && !a.noSeparate);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.spec.radius + b.spec.radius + 0.3;
      if (d < min && d > 1e-4) {
        const push = (min - d) / 2, nx = dx / d, nz = dz / d;
        const aw = a.isKeeper ? 0 : 1, bw = b.isKeeper ? 0 : 1, tot = aw + bw || 1;
        const col = this.island.collision;
        const pa = { x: a.x - nx * push * 2 * aw / tot, z: a.z - nz * push * 2 * aw / tot };
        const pb = { x: b.x + nx * push * 2 * bw / tot, z: b.z + nz * push * 2 * bw / tot };
        if (aw && !col.blocked(pa.x, pa.z, a.spec.radius * 0.5, { water: !(a.spec.swim || a.spec.fly) })) { a.root.position.x = pa.x; a.root.position.z = pa.z; }
        if (bw && !col.blocked(pb.x, pb.z, b.spec.radius * 0.5, { water: !(b.spec.swim || b.spec.fly) })) { b.root.position.x = pb.x; b.root.position.z = pb.z; }
      }
    }
  }

  say(actor, text, opts = {}) {
    if (!text) return;
    this.ui.bubble(actor, text, opts);
    if (!opts.silent) this.audio.voice(actor.id, text);
  }

  // ---------- progress reducer (each change saves) ----------
  befriend(id, nickname) {
    const p = this.progress;
    if (p.friends[id]) return false;
    p.friends[id] = { baseId: id, nickname: nickname || '', friendship: 'friend', events: ['help:' + id], palette: {}, quirkId: DEFAULT_QUIRK[id] };
    if (!p.encounterFlags.includes('help:' + id)) p.encounterFlags.push('help:' + id);
    p.selectedFriendId = id;
    this.save('befriend');
    this.emit('friends'); this.emit('progress');
    return true;
  }
  setNickname(id, name) { const f = this.progress.friends[id]; if (!f) return; f.nickname = name; this.save('nickname'); this.emit('friends'); }
  flag(name) { const f = this.progress.encounterFlags; if (!f.includes(name)) { f.push(name); this.save('flag'); this.emit('progress'); } }
  hasFlag(name) { return this.progress.encounterFlags.includes(name); }
  isDone(projectId) { return this.progress.completedProjects.includes(projectId); }
  completeProject(id) {
    const p = this.progress; if (p.completedProjects.includes(id)) return false;
    p.completedProjects.push(id);
    this.island.setComplete(id, true);
    this.island.nav.ensure();
    this.save('project');
    this.emit('progress');
    return true;
  }
  openGatesFor(projectId, instant = false) {
    const g = this.island.gates, done = this.progress.completedProjects;
    if (projectId === 'leaf_slide' || done.includes('leaf_slide')) { g.meadow.open = true; this.island.collision.setActive('gate_meadow', false); if (instant) { g.meadow.u = 1; } }
    g.dusk.lamps.splash.lit = done.includes('lotus_steps'); g.dusk.lamps.gust.lit = done.includes('pinwheel_canopy');
    if (instant) for (const L of Object.values(g.dusk.lamps)) L.k = L.lit ? 1 : 0;
    if (done.includes('lotus_steps') && done.includes('pinwheel_canopy')) { g.dusk.open = true; this.island.collision.setActive('gate_dusk', false); if (instant) g.dusk.u = 1; }
    if (instant) for (const gate of Object.values(g)) poseGate(gate, gate.u);
  }
  /** Unique per-friend event; returns true when it made the friend grow. */
  addFriendEvent(id, eventId) {
    const f = this.progress.friends[id]; if (!f) return false;
    if (f.events.includes(eventId)) return false;
    f.events.push(eventId);
    let grew = false;
    if (f.friendship !== 'grown' && f.events.some(e => e.startsWith('participate:')) && f.events.some(e => e.startsWith('play:'))) { f.friendship = 'grown'; grew = true; }
    this.save('event'); this.emit('friends');
    return grew;
  }
  skyStage() { if (this.progress.finale.seen) return 5; const n = this.progress.completedProjects.length; return n >= 4 ? 4 : n; }

  setMuted(m) {
    this.progress.settings.muted = m; this.audio.setMuted(m); this.save('settings'); this.emit('settings');
  }
  setReducedMotion(v) {
    this.progress.settings.reducedMotion = v; this.reducedMotion = v; this.camera.reducedMotion = v; this.fx.reduced = v;
    document.documentElement.classList.toggle('reduced-motion', v); this.save('settings'); this.emit('settings');
  }

  save(reason) {
    this.progress.player.position = [round(this.keeper.x), 0, round(this.keeper.z)];
    if (this.saveMode !== 'local') { this.emit('saved', { ok: false, reason }); return false; }
    const ok = writeSave(this.progress);
    if (ok) this.stats.saves++;
    else if (!storageAvailable()) { this.saveMode = 'off'; this.emit('saveMode', 'off'); }
    this.emit('saved', { ok, reason });
    return ok;
  }
}

export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const round = v => Math.round(v * 100) / 100;
