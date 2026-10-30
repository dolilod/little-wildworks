// Versioned local save (SaveV1 from the build brief). Writes happen only after
// stable events. Every read is validated; nothing here ever throws into play.
import { QUIRKS } from './content.js';

export const SAVE_KEY = 'little-wildworks/save/v1';
export const CREATURE_IDS = ['tumbletuft', 'foldfern', 'puddleloop', 'siltbell', 'whirli', 'kitefin', 'glintot', 'hushbulb'];
export const PROJECT_IDS = ['leaf_slide', 'lotus_steps', 'pinwheel_canopy', 'lantern_picnic'];
export const PREREQS = { leaf_slide: [], lotus_steps: ['leaf_slide'], pinwheel_canopy: ['leaf_slide'], lantern_picnic: ['lotus_steps', 'pinwheel_canopy'] };
export const VARIANTS = { leaf_slide: ['gentle', 'bouncy'], lotus_steps: ['low_song', 'high_song'], pinwheel_canopy: ['clockwise', 'counterclockwise'], lantern_picnic: ['moon', 'star'] };
export const PALETTE_KEYS = ['ink', 'cream', 'clay', 'amber', 'moss', 'teal', 'aqua', 'twilight'];
const QUIRK_IDS = QUIRKS.map(q => q.id);
const MAX_IMPORT = 20000;

export function defaultProgress() {
  return {
    schemaVersion: 1,
    player: { position: [-17, 0, 10], displayName: 'Keeper' },
    friends: {}, completedProjects: [], encounterFlags: [], toyVariants: {},
    selectedFriendId: null, customFriends: [],
    finale: { seen: false, guestOfHonourId: null },
    settings: { muted: false, reducedMotion: false, language: 'en' },
  };
}

// A few words that should never become a pet's name. Kept short and mild.
const BLOCKED = ['poop', 'stupid', 'idiot', 'dumb', 'hate', 'kill', 'butt', 'fart', 'ugly', 'shut up', 'damn', 'hell', 'crap', 'sex'];

/** Clean a nickname: letters/digits/space/'-. only, ≤16 chars. Returns '' when unusable. */
export function sanitizeName(raw) {
  let s = String(raw ?? '').normalize('NFKC').replace(/[^A-Za-z0-9 '\-.]/g, '').replace(/\s+/g, ' ').trim();
  s = s.slice(0, 16).trim();
  if (!/[A-Za-z]/.test(s)) return '';
  const low = s.toLowerCase();
  if (BLOCKED.some(w => low.includes(w))) return '';
  return s;
}

export function storageAvailable() {
  try {
    const k = '__lw_probe__'; window.localStorage.setItem(k, '1');
    const ok = window.localStorage.getItem(k) === '1'; window.localStorage.removeItem(k); return ok;
  } catch { return false; }
}

/** Returns {status: 'none'|'ok'|'corrupt'|'unavailable', data, raw, reason}. */
export function loadSave() {
  if (!storageAvailable()) return { status: 'unavailable', data: null };
  let raw = null;
  try { raw = window.localStorage.getItem(SAVE_KEY); } catch { return { status: 'unavailable', data: null }; }
  if (raw == null) return { status: 'none', data: null };
  try { return { status: 'ok', data: validateSave(JSON.parse(raw)), raw }; }
  catch (e) { return { status: 'corrupt', data: null, raw, reason: e.message }; }
}

export function writeSave(progress) {
  try {
    const data = validateSave(JSON.parse(JSON.stringify(progress)));
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch { return false; }
}
export function clearSave() { try { window.localStorage.removeItem(SAVE_KEY); return true; } catch { return false; } }

export function exportCode(progress) {
  const json = JSON.stringify(validateSave(JSON.parse(JSON.stringify(progress))));
  return 'LW1-' + btoa(unescape(encodeURIComponent(json)));
}
export function importCode(code) {
  const s = String(code || '').trim();
  if (s.length > MAX_IMPORT) throw new Error('That code is too long.');
  let json;
  if (s.startsWith('LW1-')) { try { json = decodeURIComponent(escape(atob(s.slice(4)))); } catch { throw new Error('That code is not a Little Wildworks save.'); } }
  else if (s.startsWith('{')) json = s;
  else throw new Error('That code is not a Little Wildworks save.');
  let obj; try { obj = JSON.parse(json); } catch { throw new Error('That code is damaged.'); }
  return validateSave(obj);
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const fin = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const EVENT_RE = /^(help:[a-z]+|participate:[a-z_]+:[a-z]+|play:[a-z_]+:[a-z]+)$/;
const FLAG_RE = /^[a-z_]+:[a-z_:]+$/;

function validFriend(id, f) {
  if (!isObj(f)) throw new Error('bad friend ' + id);
  const nickname = sanitizeName(f.nickname) || null;
  const events = Array.isArray(f.events) ? [...new Set(f.events.filter(e => typeof e === 'string' && EVENT_RE.test(e)))].slice(0, 64) : [];
  const palette = {};
  if (isObj(f.palette)) for (const [k, v] of Object.entries(f.palette)) if (PALETTE_KEYS.includes(k) && PALETTE_KEYS.includes(v)) palette[k] = v;
  return {
    baseId: CREATURE_IDS.includes(f.baseId) ? f.baseId : id,
    nickname: nickname || '',
    friendship: f.friendship === 'grown' ? 'grown' : 'friend',
    events, palette,
    quirkId: QUIRK_IDS.includes(f.quirkId) ? f.quirkId : '',
  };
}

/** Throws on structurally invalid data; normalizes and filters the rest. */
export function validateSave(obj) {
  if (!isObj(obj)) throw new Error('Save is not an object.');
  if (obj.schemaVersion !== 1) throw new Error(obj.schemaVersion > 1 ? 'Save is from a newer version.' : 'Unknown save version.');
  const out = defaultProgress();
  const pos = obj.player?.position;
  if (Array.isArray(pos) && pos.length === 3 && fin(pos[0], -24, 24) && fin(pos[1], -2, 6) && fin(pos[2], -20, 20)) out.player.position = [pos[0], 0, pos[2]];
  else if (pos !== undefined) throw new Error('Player position is invalid.');
  if (typeof obj.player?.displayName === 'string') out.player.displayName = sanitizeName(obj.player.displayName) || 'Keeper';
  if (!isObj(obj.friends)) throw new Error('Friends missing.');
  for (const [id, f] of Object.entries(obj.friends)) {
    if (!CREATURE_IDS.includes(id)) continue;
    out.friends[id] = validFriend(id, f);
    out.friends[id].baseId = id;
  }
  // Projects: known IDs, and only when their prerequisites are also complete.
  const done = new Set((Array.isArray(obj.completedProjects) ? obj.completedProjects : []).filter(p => PROJECT_IDS.includes(p)));
  for (const p of PROJECT_IDS) if (done.has(p) && PREREQS[p].every(q => done.has(q))) out.completedProjects.push(p);
  out.encounterFlags = [...new Set((Array.isArray(obj.encounterFlags) ? obj.encounterFlags : []).filter(f => typeof f === 'string' && f.length < 64 && FLAG_RE.test(f)))].slice(0, 64);
  // Every friend must have been met; keep flags consistent.
  for (const id of Object.keys(out.friends)) if (!out.encounterFlags.includes('help:' + id)) out.encounterFlags.push('help:' + id);
  if (isObj(obj.toyVariants)) for (const [p, v] of Object.entries(obj.toyVariants)) if (VARIANTS[p]?.includes(v)) out.toyVariants[p] = v;
  out.selectedFriendId = out.friends[obj.selectedFriendId] ? obj.selectedFriendId : null;
  if (Array.isArray(obj.customFriends)) {
    const c = obj.customFriends[0];
    if (c && isObj(c) && CREATURE_IDS.includes(c.baseId)) {
      const cf = validFriend(c.baseId, c); cf.baseId = c.baseId;
      if (out.friends[cf.baseId]) out.customFriends = [cf];
    }
  }
  if (isObj(obj.finale)) {
    out.finale.seen = obj.finale.seen === true && out.completedProjects.length === 4;
    out.finale.guestOfHonourId = out.friends[obj.finale.guestOfHonourId] ? obj.finale.guestOfHonourId : null;
  }
  if (isObj(obj.settings)) {
    out.settings.muted = obj.settings.muted === true;
    out.settings.reducedMotion = obj.settings.reducedMotion === true;
  }
  return out;
}
