// Test-only hook, installed only with ?test=1. Normal play never needs it.
import { CREATURE_IDS, PROJECT_IDS } from './save.js';

export function installTestHook(game, { models, portraits }) {
  const story = () => game.story;
  window.__ww = {
    ready: true,
    state() {
      const k = game.keeper;
      return {
        keeper: { x: k.x, z: k.z, y: k.root.position.y, speed: k.speed },
        friends: JSON.parse(JSON.stringify(game.progress.friends)),
        completedProjects: [...game.progress.completedProjects],
        selectedFriendId: game.progress.selectedFriendId,
        encounter: { ...story().state }, projects: { ...story().pstate },
        flags: [...game.progress.encounterFlags],
        toyVariants: { ...game.progress.toyVariants },
        customFriends: JSON.parse(JSON.stringify(game.progress.customFriends)),
        finale: { ...game.progress.finale },
        settings: { ...game.progress.settings },
        busy: game.busy, paused: game.paused, modal: !!game.ui.current, titleMode: !!game.titleMode, inCutscene: !!game.inCutscene,
        target: game.selectedTarget ? { id: game.selectedTarget.id, label: game.selectedTarget.label } : null,
        goal: story().goal ? { text: story().goal.text, pos: story().goal.pos } : null,
        saveMode: game.saveMode, saves: game.stats.saves,
        stats: { actions: game.stats.actions, ignoredActions: game.stats.ignoredActions },
        modelSources: Object.fromEntries(Object.entries(models).map(([id, m]) => [id, m.source])),
        visible: Object.fromEntries(CREATURE_IDS.map(id => [id, game.actors[id].root.visible])),
        actorPos: Object.fromEntries(CREATURE_IDS.map(id => [id, { x: game.actors[id].x, z: game.actors[id].z }])),
        gates: { meadow: game.island.gates.meadow.open, dusk: game.island.gates.dusk.open },
        time: game.time, sky: game.island.sky.stage,
      };
    },
    interactables() { return story().interactables().map(i => ({ id: i.id, x: i.x, z: i.z, r: i.r, label: i.label })); },
    path(x, z) { const k = game.keeper; return game.island.nav.path(k.x, k.z, x, z, { maxGoalR: 3 }); },
    /** Reachability on the navgrid with gates set as they would be for a given set of completed projects. */
    reachable(points, completed) {
      const col = game.island.collision, saved = { meadow: col.solids.find(s => s.id === 'gate_meadow').active, dusk: col.solids.find(s => s.id === 'gate_dusk').active, lotus: col.pads.filter(p => p.tag === 'lotus').map(p => p.active) };
      const has = p => completed.includes(p);
      col.setActive('gate_meadow', !has('leaf_slide'));
      col.setActive('gate_dusk', !(has('lotus_steps') && has('pinwheel_canopy')));
      col.setActive('lotus', has('lotus_steps'));
      game.island.nav.rebuild();
      const [sx, , sz] = game.data.world.playerSpawn;
      const out = {};
      for (const [name, p] of Object.entries(points)) out[name] = game.island.nav.reachable(sx, sz, p.x, p.z, p.r ?? 1.5);
      col.setActive('gate_meadow', saved.meadow); col.setActive('gate_dusk', saved.dusk);
      col.pads.filter(p => p.tag === 'lotus').forEach((p, i) => p.active = saved.lotus[i]); col.version++;
      game.island.nav.rebuild();
      return out;
    },
    points() {
      // Authoritative interaction points for reachability checks.
      const s = story(), out = {};
      for (const [id, t] of Object.entries(s.toys)) out['socket:' + id] = { x: t.socket.x, z: t.socket.z, r: 1.6 };
      for (const id of CREATURE_IDS) { const e = s.enc[id]; out['creature:' + id] = { x: e.spot.x, z: e.spot.z, r: 2.4 }; if (e.propPoints) Object.assign(out, e.propPoints()); }
      out['prop:picnic_bell'] = { x: s.finale.bell.x, z: s.finale.bell.z, r: 1.5 };
      return out;
    },
    teleport(x, z) { game.keeper.place(x, z); game.trail.length = 0; game.camera.snapTo(game.keeper.pos); },
    setTimeScale(s) { game.timeScale = s; },
    frameStats() {
      const f = [...game.stats.frames].sort((a, b) => a - b);
      const q = p => f.length ? f[Math.min(f.length - 1, Math.floor(f.length * p))] : 0;
      const info = game.renderer.info.render;
      return { n: f.length, p50: q(0.5), p95: q(0.95), calls: info.calls, triangles: info.triangles };
    },
    resetFrames() { game.stats.frames.length = 0; },
    projectIds: PROJECT_IDS, creatureIds: CREATURE_IDS,
    portraitsOk() { return !!portraits; },
    /** Visible render state of a project's kit groups. */
    projectVisual(id) {
      const p = game.island.projects[id];
      return { finished: p.getObjectByName('finished').visible, unfinished: p.getObjectByName('unfinished').visible, complete: !!p.userData.complete };
    },
    /** Is (x,z) reachable on foot from the Keeper right now (current gates/pads)? */
    reachableNow(x, z, r = 1.5) { const k = game.keeper; return game.island.nav.reachable(k.x, k.z, x, z, r); },
    collisionActive(id) { const c = game.island.collision; const s = [...c.solids, ...c.pads].find(x => x.id === id); return s ? s.active : null; },
    lampLit(el) { return game.island.gates.dusk.lamps[el].lit; },
    finaleElapsed() { return game.story.finale.elapsed ?? null; },
    bubbles() { return [...document.querySelectorAll('.bubble .in')].map(b => b.textContent); },
  };
}
