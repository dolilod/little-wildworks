// Boot: WebGL2 check, asset loading, title diorama, Play gesture (unlocks sound).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildCreature, buildPlayer } from './kit/creature-factory.js';
import { Game } from './game.js';
import { UIManager } from './ui.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { Portraits } from './portraits.js';
import { loadSave, defaultProgress, storageAvailable, clearSave, importCode, writeSave, exportCode, CREATURE_IDS } from './save.js';
import { createStory } from './story.js';
import { UI } from './content.js';

const params = new URLSearchParams(location.search);
const testMode = params.get('test') === '1';
const $ = s => document.querySelector(s);

function hasWebGL2() {
  try { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch { return false; }
}
function fail(text) {
  $('#title').hidden = true; $('#fail').hidden = false; $('#fail-text').textContent = text;
}
async function fetchJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error('Could not load ' + url); return r.json(); }

async function boot() {
  if (!hasWebGL2()) { fail(UI.noWebGL); return; }
  const bar = $('.loading-bar span');
  let loaded = 0; const total = 3 + 3 + 9;
  const tick = () => { loaded++; bar.style.width = Math.round(loaded / total * 100) + '%'; };

  const [creatures, world, palette] = await Promise.all(['data/creatures.json', 'data/world.json', 'data/palette.json'].map(u => fetchJSON(u).then(d => { tick(); return d; })));
  const texLoader = new THREE.TextureLoader();
  const [meadow, pond, dusk] = await Promise.all(['meadow', 'pond', 'dusk'].map(z => texLoader.loadAsync(`assets/textures/${z}-tile.png`).then(t => { tick(); return t; })));
  const gltf = new GLTFLoader();
  const models = {};
  await Promise.all(['keeper', ...CREATURE_IDS].map(async id => {
    try {
      // Plain fetch + parse (FileLoader's streamed progress reader is reported as aborted by Chromium).
      const res = await fetch(`assets/models/${id}.glb`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const g = await gltf.parseAsync(await res.arrayBuffer(), 'assets/models/');
      const root = g.scene.getObjectByName(id);
      if (!root) throw new Error('missing named root ' + id);
      root.removeFromParent();
      models[id] = { root, source: 'glb' };
    } catch (e) {
      console.warn('GLB failed, using factory model for', id, e);
      models[id] = { root: id === 'keeper' ? buildPlayer(THREE) : buildCreature(THREE, id), source: 'factory' };
    }
    tick();
  }));

  // Save: import-by-URL hash (used when storage is off), then local storage.
  let saveInfo = loadSave(), progress = null, note = '';
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get('import')) {
    try { progress = importCode(hash.get('import')); note = 'Island loaded from your save code.'; }
    catch (e) { note = 'That save code could not be read: ' + e.message; }
    history.replaceState(null, '', location.pathname + location.search);
  }
  if (!progress && saveInfo.status === 'ok') progress = saveInfo.data;
  if (saveInfo.status === 'corrupt') note = 'Your saved island could not be read, so a fresh island is ready. (Your old save is kept until you play.)';
  if (saveInfo.status === 'unavailable') note = UI.saveOff;
  const hasSave = !!progress;
  progress ||= defaultProgress();
  const saveMode = storageAvailable() ? 'local' : 'off';

  const input = new Input({ joyZone: $('#joy-zone'), joyBase: $('#joy-base'), joyKnob: $('#joy-knob'), actionBtn: $('#btn-action'), friendBtn: $('#btn-friend') });
  const audio = new GameAudio({ muted: progress.settings.muted });
  const ui = new UIManager();
  const game = new Game({ canvas: $('#scene'), data: { creatures, world, palette }, models, textures: { meadow, pond, dusk }, audio, input, ui, progress, saveMode, testMode });
  game.saveInfo = saveInfo;
  game.portraitVersion = {};
  game.exportCode = () => exportCode(game.progress);
  game.importCode = code => {
    try {
      const data = importCode(code);
      if (game.saveMode === 'local' && writeSave(data)) { location.reload(); return { ok: true }; }
      location.hash = 'import=' + encodeURIComponent(exportCode(data)); location.reload(); return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  };
  game.newGame = () => { clearSave(); location.hash = ''; location.reload(); };
  const portraits = new Portraits(game.renderer);
  ui.attach(game, portraits);
  game.story = createStory(game);
  if (progress.settings.reducedMotion) document.documentElement.classList.add('reduced-motion');
  game.titleMode = true;
  game.camera.setShot({ x: -9, y: 0.5, z: 6.5, span: 16 }, 0.01);
  game.start();

  // Touch controls only on touch-capable devices (or after a first real touch).
  const coarse = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches);
  ui.setTouchMode(coarse);
  input.onDevice = d => ui.setTouchMode(d === 'touch');

  // Title screen.
  $('#loading').hidden = true; $('#title-buttons').hidden = false;
  const play = $('#btn-play'), ng = $('#btn-newgame');
  play.textContent = hasSave ? UI.continue : UI.play;
  ng.hidden = !hasSave;
  $('#title-note').textContent = note;
  play.focus({ preventScroll: true });
  const start = async (e) => {
    play.disabled = true; ng.disabled = true;
    audio.unlock(e).then(ok => { if (ok) { audio.cue('meet'); } });
    if (saveInfo.status === 'corrupt' && game.saveMode === 'local') game.save('reset');
    $('#title').classList.add('leaving');
    setTimeout(() => { $('#title').hidden = true; }, 700);
    game.titleMode = false;
    await game.story.begin({ fresh: !hasSave });
  };
  play.addEventListener('click', start);
  ng.addEventListener('click', async () => {
    const ok = await ui.confirm('Start a new island?', 'This clears your friends and toys on this device.', 'Yes, start over', 'No');
    if (ok) game.newGame();
  });
  $('#btn-credits').addEventListener('click', () => ui.openCredits());

  // Sound pauses when hidden; the next real gesture resumes it.
  document.addEventListener('visibilitychange', () => { if (document.hidden) audio.suspend().catch(() => {}); });
  const resume = e => { if (audio.everUnlocked && !audio.ready && !document.hidden) audio.unlock(e); };
  // iOS Safari only treats some events as audio-unlocking gestures; listen to all of them.
  for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(type, resume, true);

  if (testMode) (await import('./testhook.js')).installTestHook(game, { models, portraits });
  window.dispatchEvent(new CustomEvent('wildworks-ready'));
}

boot().catch(e => { console.error(e); fail('Something went wrong while waking up the island. Please reload the page.'); });
