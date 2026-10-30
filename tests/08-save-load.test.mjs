// Acceptance 8 — Save/load: a reload restores friends, projects, nicknames and My Friend;
// with storage unavailable the game stays playable and offers an export code (never claims a
// save); a corrupt save is handled gracefully; a bad import code shows a message.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './lib/server.mjs';
import { launch, openGame, startPlay, DESKTOP, st, waitIdle } from './lib/browser.mjs';
import { befriend, runProject } from './lib/flows.mjs';
import { SAVE_KEY, makeSave, seed } from './lib/saves.mjs';

test('8. Save/load: reload restores friends, projects, nicknames and My Friend', { timeout: 15 * 60 * 1000 }, async () => {
  const srv = await startServer(); const browser = await launch();
  try {
    const { page, log } = await openGame(browser, srv, { device: DESKTOP });
    await startPlay(page);
    await page.evaluate(() => window.__ww.setTimeScale(2.5));
    await befriend(page, 'tumbletuft', { name: 'Sprout Star' });
    await runProject(page, 'leaf_slide');
    // My Friend: recolour + rename + habit, through the real editor UI.
    await page.click('#btn-pause'); await page.click('.modal >> text=My Friend');
    await page.click('.roster-grid .card >> nth=0');
    await page.click('.swatch[aria-label="Body colour: clay"]'); await page.click('.swatch[aria-label="Trim colour: amber"]');
    await page.fill('.editor .name-input', 'Puffy'); await page.click('.editor .chip-btn >> text=Happy hops');
    await page.click('.modal >> text=Save my friend'); await waitIdle(page);
    const before = await st(page);
    assert.ok(before.saves > 0, 'saved to localStorage');
    await page.reload();
    await page.waitForFunction(() => window.__ww?.ready && !document.querySelector('#title-buttons').hidden);
    assert.equal((await page.textContent('#btn-play')).trim(), 'Continue', 'title offers Continue');
    await startPlay(page);
    const s = await st(page);
    assert.equal(s.friends.tumbletuft.nickname, 'Sprout Star');
    assert.deepEqual(s.completedProjects, ['leaf_slide']);
    assert.equal(s.gates.meadow, true, 'gate state restored');
    assert.equal(s.customFriends[0].baseId, 'tumbletuft');
    assert.equal(s.customFriends[0].nickname, 'Puffy');
    assert.deepEqual(s.customFriends[0].palette, { teal: 'clay', moss: 'amber' });
    assert.equal(s.customFriends[0].quirkId, 'happy_hop');
    assert.equal(s.selectedFriendId, 'tumbletuft');
    assert.ok((await page.getAttribute('#btn-friend', 'aria-label')).includes('Puffy'), 'My Friend name shown');
    assert.deepEqual(await page.evaluate(() => window.__ww.projectVisual('leaf_slide')), { finished: true, unfinished: false, complete: true });
    assert.deepEqual([...log.pageErrors, ...log.errors], []);
  } finally { await browser.close(); await srv.close(); }
});

test('8. Save/load: storage unavailable stays playable, never claims to save, offers export + import', { timeout: 10 * 60 * 1000 }, async () => {
  const srv = await startServer(); const browser = await launch();
  try {
    const { page, log } = await openGame(browser, srv, { device: DESKTOP, storage: false });
    assert.match(await page.textContent('#title-note'), /Saving is off/);
    await startPlay(page);
    await page.evaluate(() => window.__ww.setTimeScale(2.5));
    assert.equal((await st(page)).saveMode, 'off');
    assert.equal(await page.isVisible('#save-chip'), true, 'save chip visible');
    assert.match(await page.textContent('#save-chip'), /Saving is off/);
    await befriend(page, 'tumbletuft', { name: 'Tuft' });
    const s = await st(page);
    assert.equal(s.saves, 0, 'no save claimed');
    assert.equal(await page.locator('.toast', { hasText: 'Saved' }).count(), 0, 'no "Saved" toast shown');
    await page.click('#save-chip .btn');
    const code = await page.inputValue('.modal textarea.code[readonly]');
    assert.match(code, /^LW1-/, 'export code offered');
    // A broken code shows a message, no crash.
    await page.fill('.modal textarea.code:not([readonly])', 'not a real code');
    await page.click('.modal >> text=Load this island');
    assert.match(await page.textContent('.modal .name-hint'), /not a Little Wildworks save/);
    // The real code restores the island (through the URL hash, since storage is off).
    await page.fill('.modal textarea.code:not([readonly])', code);
    await Promise.all([page.waitForNavigation(), page.click('.modal >> text=Load this island')]);
    await page.waitForFunction(() => window.__ww?.ready && !document.querySelector('#title-buttons').hidden);
    await startPlay(page);
    const r = await st(page);
    assert.equal(r.friends.tumbletuft.nickname, 'Tuft', 'imported island restored');
    assert.deepEqual([...log.pageErrors], []);
  } finally { await browser.close(); await srv.close(); }
});

test('8. Save/load: a corrupt save is handled gracefully (fresh island, clear note, no errors)', async () => {
  const srv = await startServer(); const browser = await launch();
  try {
    const init = `try { if (!sessionStorage.getItem('__c')) { localStorage.setItem(${JSON.stringify(SAVE_KEY)}, '{"schemaVersion":1,"friends":'); sessionStorage.setItem('__c','1'); } } catch (e) {}`;
    const { page, log } = await openGame(browser, srv, { device: DESKTOP, init });
    assert.match(await page.textContent('#title-note'), /could not be read/);
    assert.equal((await page.textContent('#btn-play')).trim(), 'Play');
    await startPlay(page);
    const s = await st(page);
    assert.deepEqual(s.friends, {}); assert.deepEqual(s.completedProjects, []);
    await page.keyboard.down('KeyD'); await page.waitForTimeout(600); await page.keyboard.up('KeyD');
    assert.deepEqual([...log.pageErrors, ...log.errors], []);
    // A newer schema is also refused gracefully.
    await page.evaluate(k => localStorage.setItem(k, JSON.stringify({ schemaVersion: 9, friends: {} })), SAVE_KEY);
    await page.reload(); await page.waitForFunction(() => window.__ww?.ready && !document.querySelector('#title-buttons').hidden);
    assert.match(await page.textContent('#title-note'), /could not be read/);
  } finally { await browser.close(); await srv.close(); }
});

test('8. Save/load: a saved position in the pond or behind a closed gate respawns the Keeper at the start', async () => {
  const srv = await startServer(); const browser = await launch();
  try {
    for (const position of [[10, 0, -2], [-2, 0, -10]]) {
      const { page, context, log } = await openGame(browser, srv, { device: DESKTOP, ...seed(makeSave({ friends: ['tumbletuft'], projects: ['leaf_slide'], position })) });
      await startPlay(page);
      const s = await st(page);
      assert.ok(Math.hypot(s.keeper.x + 17, s.keeper.z - 10) < 0.5, `Keeper moved to the spawn from ${position} (now ${s.keeper.x.toFixed(1)}, ${s.keeper.z.toFixed(1)})`);
      assert.deepEqual(s.completedProjects, ['leaf_slide'], 'progress kept');
      assert.deepEqual(log.pageErrors, []);
      await context.close();
    }
  } finally { await browser.close(); await srv.close(); }
});
