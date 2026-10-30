// Acceptance 3 — Befriend flow for EVERY critical-path creature, driven by real keys:
// intro plays, the friendship action completes, acceptance + nickname (custom and default),
// and the new friend appears as the follower and follows the Keeper.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './lib/server.mjs';
import { launch, openGame, startPlay, DESKTOP, st, walkTo } from './lib/browser.mjs';
import { makeSave, seed } from './lib/saves.mjs';
import { befriend, follows, STEPS, waitInteractable } from './lib/flows.mjs';
import { LINES } from '../docs/js/content.js';

const CASES = [
  { id: 'tumbletuft', name: 'Captain Leaf', save: null },
  { id: 'whirli', name: '', save: makeSave({ friends: ['tumbletuft'], projects: ['leaf_slide'], position: [-8.6, 0, 5] }) },
  { id: 'puddleloop', name: 'Loopy', save: makeSave({ friends: ['tumbletuft'], projects: ['leaf_slide'], position: [0, 0, -1.5] }) },
  { id: 'glintot', name: '', save: makeSave({ friends: ['tumbletuft', 'whirli', 'puddleloop'], projects: ['leaf_slide', 'lotus_steps', 'pinwheel_canopy'], position: [-1.2, 0, -3.4], selected: 'whirli' }) },
];

const allLines = id => Object.values(LINES[id]).flat();

for (const c of CASES) {
  test(`3. Befriend ${c.id} with real inputs (${c.name ? 'custom nickname' : 'default name'})`, async () => {
    const srv = await startServer(); const browser = await launch();
    try {
      const { page, log } = await openGame(browser, srv, { device: DESKTOP, ...(c.save ? seed(c.save) : {}) });
      await startPlay(page);
      await page.evaluate(() => window.__ww.setTimeScale(2.5));
      // Intro: approach the creature; it notices the Keeper and speaks its own lines.
      await waitInteractable(page, STEPS[c.id][0]);
      const target = (await page.evaluate(() => window.__ww.interactables())).find(i => i.id === STEPS[c.id][0]);
      await walkTo(page, target.x, target.z, { tol: 2.5 });
      await page.waitForFunction(id => window.__ww.state().encounter[id] !== 'unseen', c.id, { timeout: 20000 });
      const heard = new Set();
      for (let i = 0; i < 12 && ![...heard].some(t => allLines(c.id).includes(t)); i++) { (await page.evaluate(() => window.__ww.bubbles())).forEach(t => heard.add(t)); await page.waitForTimeout(300); }
      assert.ok([...heard].some(t => allLines(c.id).includes(t)), `${c.id} spoke an intro/request line (heard: ${[...heard].join(' | ')})`);
      // Friendship action + acceptance.
      const accepted = await befriend(page, c.id, { name: c.name, shotName: 'befriend-' + c.id });
      assert.equal(accepted.encounter[c.id], 'friend', 'encounter reached friend state');
      assert.ok(accepted.flags.includes('help:' + c.id), 'friendship event recorded');
      const s = await st(page);
      assert.equal(s.friends[c.id].nickname, c.name, 'nickname stored (empty = default name)');
      assert.equal(s.selectedFriendId, c.id, 'new friend is the follower');
      const label = await page.getAttribute('#btn-friend', 'aria-label');
      assert.ok(label.includes(c.name || accepted.friends[c.id].baseId.replace(/^./, m => m.toUpperCase())), 'friend button names the follower: ' + label);
      const f = await follows(page, c.id);
      assert.ok(f.visible && f.dist < 4, `${c.id} follows the Keeper (distance ${f.dist.toFixed(2)} m)`);
      assert.deepEqual([...log.pageErrors, ...log.errors], []);
    } finally { await browser.close(); await srv.close(); }
  });
}
