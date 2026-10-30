// Reusable story flows driven only by real keyboard input (walk with keys, Space to act)
// and real clicks on dialogs. Used by several acceptance tests.
import { actOn, waitIdle, waitFor, shot, st, walkTo } from './browser.mjs';

export const STEPS = {
  tumbletuft: ['tumbletuft_seed', 'tumbletuft_ramp'],
  whirli: ['whirli_ribbon', 'whirli_blow'],
  puddleloop: ['puddleloop_seed'],
  glintot: ['glintot_lens', 'glintot_cradle', 'glintot_answer', 'glintot_answer'],
  foldfern: ['foldfern_invite'],
  siltbell: ['siltbell_pebble', 'siltbell_tap'],
  kitefin: ['kitefin_challenge', 'wind_switch', 'kitefin_bow'],
  hushbulb: ['hushbulb_listen', 'hushbulb_answer'],
};

export async function waitInteractable(page, id, timeout = 60000) {
  await page.waitForFunction(sid => window.__ww.interactables().some(i => i.id === sid), id, { timeout });
}

/** Answer the optional nickname dialog: a custom name, or keep the default. */
export async function nickname(page, name) {
  await page.waitForSelector('.modal .name-input', { timeout: 60000 });
  if (name) { await page.fill('.modal .name-input', name); await page.click('.modal .row .btn.primary'); }
  else await page.click('.modal .row .btn:not(.primary)');
  await waitIdle(page);
}

/** Full befriend flow for one creature. Returns the state right after acceptance. */
export async function befriend(page, id, { name = '', shotName } = {}) {
  const steps = STEPS[id];
  for (let i = 0; i < steps.length; i++) {
    await waitInteractable(page, steps[i]);
    await actOn(page, steps[i]);
    if (i < steps.length - 1) await waitIdle(page);
  }
  await page.waitForFunction(cid => !!window.__ww.state().friends[cid], id, { timeout: 60000 });
  if (shotName) { await page.waitForTimeout(250); await shot(page, shotName); }
  const accepted = await st(page);
  await nickname(page, name);
  return accepted;
}

/** Run a project at its socket with the current follower; optionally spam Space while it acts. */
export async function runProject(page, id, { spam = 0, shotName } = {}) {
  await waitInteractable(page, id + '_socket');
  await actOn(page, id + '_socket');
  for (let i = 0; i < spam; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(90); }
  await page.waitForFunction(pid => window.__ww.state().completedProjects.includes(pid), id, { timeout: 90000 });
  await waitIdle(page, 90000);
  if (shotName) { await page.waitForTimeout(300); await shot(page, shotName); }
  return st(page);
}

/** Select a friend with the real F key until it is the follower. */
export async function selectFriend(page, id) {
  for (let i = 0; i < 10; i++) {
    if ((await st(page)).selectedFriendId === id) return;
    await page.keyboard.press('KeyF'); await page.waitForTimeout(250);
  }
  throw new Error('could not select ' + id);
}

/** Ring the bell, choose a guest by display name, press Go, then either skip or wait. */
export async function moonPicnic(page, guestName, { skipAfter = 2500, shotPrefix } = {}) {
  await actOn(page, 'picnic_bell');
  await page.waitForSelector('.choice-grid', { timeout: 30000 });
  await page.click(`.choice-grid .card:has(.name:text-is("${guestName}"))`);
  await page.waitForSelector('.modal .btn.big', { timeout: 30000 });
  await page.click('.modal .btn.big');
  if (shotPrefix) { await page.waitForTimeout(1500); await shot(page, shotPrefix + '-start'); }
  if (skipAfter !== null) { await page.waitForTimeout(skipAfter); await page.click('.skip-btn'); }
  await page.waitForSelector('.final-card', { timeout: 180000 });
  await page.waitForTimeout(1500); // let the card's pop-in animation finish before reading/screenshotting
  return page.textContent('.final-card');
}

export async function follows(page, id) {
  // Walk somewhere ~5 m away and check the friend came along.
  const s = await st(page);
  const tx = s.keeper.x + (s.keeper.x < 0 ? 3.5 : -3.5), tz = s.keeper.z + (s.keeper.z < 0 ? 2.5 : -2.5);
  await walkTo(page, tx, tz, { tol: 0.8, timeout: 20000 });
  await page.waitForTimeout(1500);
  const after = await st(page);
  const f = after.actorPos[id];
  return { dist: Math.hypot(f.x - after.keeper.x, f.z - after.keeper.z), visible: after.visible[id], selected: after.selectedFriendId };
}

export { waitFor };
