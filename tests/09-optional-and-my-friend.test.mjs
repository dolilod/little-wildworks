// Acceptance 9 — Optional friends (Foldfern, Kitefin, Siltbell, Hushbulb) and the My Friend
// editor appear in the roster, in the world and in the ending.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './lib/server.mjs';
import { launch, openGame, startPlay, DESKTOP, st, waitIdle, shot } from './lib/browser.mjs';
import { makeSave, seed } from './lib/saves.mjs';
import { befriend, moonPicnic } from './lib/flows.mjs';

test('9. Optional friends + My Friend editor appear in roster, world and ending', { timeout: 20 * 60 * 1000 }, async () => {
  const srv = await startServer(); const browser = await launch();
  try {
    const save = makeSave({ friends: ['tumbletuft', 'whirli', 'puddleloop', 'glintot'], projects: ['leaf_slide', 'lotus_steps', 'pinwheel_canopy', 'lantern_picnic'], position: [-10, 0, 3], selected: 'tumbletuft', finaleSeen: true });
    const { page, log } = await openGame(browser, srv, { device: DESKTOP, ...seed(save) });
    await startPlay(page);
    await page.evaluate(() => window.__ww.setTimeScale(2.5));
    for (const [id, name] of [['foldfern', ''], ['kitefin', 'Sir Kite'], ['siltbell', ''], ['hushbulb', 'Glowy']]) {
      console.log('# befriending', id, new Date().toISOString());
      await befriend(page, id, { name, shotName: 'befriend-' + id });
      const s = await st(page);
      assert.equal(s.encounter[id], 'friend'); assert.equal(s.visible[id], true, `${id} is in the world`);
      assert.equal(s.friends[id].nickname, name);
    }
    // Roster: all eight friend cards, no silhouettes left.
    await page.click('#btn-roster'); await page.waitForSelector('.roster-grid');
    assert.equal(await page.locator('.roster-grid .card').count(), 8);
    assert.equal(await page.locator('.roster-grid .card.unknown').count(), 0);
    for (const n of ['Sir Kite', 'Glowy', 'Foldfern', 'Siltbell']) assert.ok(await page.locator('.roster-grid .card .name', { hasText: n }).count() > 0, `roster lists ${n}`);
    await page.waitForTimeout(400); await shot(page, 'roster');
    await page.click('.modal .row >> text=Memory book'); await page.waitForSelector('.book-page');
    assert.equal(await page.locator('.book-page.empty').count(), 0, 'every memory filled');
    assert.ok(await page.locator('.book-page .line', { hasText: 'You heard my very small hello.' }).count() > 0, 'Hushbulb memory line');
    await page.waitForTimeout(300); await shot(page, 'memory-book');
    await page.keyboard.press('Escape'); await waitIdle(page);
    // My Friend editor on Whirli.
    await page.click('#btn-roster'); await page.click('.modal .row >> text=My Friend');
    await page.click('.roster-grid .card:has(.name:text-is("Whirli"))');
    await page.click('.swatch[aria-label="Body colour: twilight"]'); await page.click('.swatch[aria-label="Trim colour: clay"]');
    await page.fill('.editor .name-input', 'Puffy Pal'); await page.click('.editor .chip-btn >> text=Very formal bow');
    await page.waitForTimeout(400); await shot(page, 'editor');
    await page.click('.modal >> text=Save my friend'); await waitIdle(page);
    let s = await st(page);
    assert.deepEqual(s.customFriends[0], { baseId: 'whirli', nickname: 'Puffy Pal', friendship: s.friends.whirli.friendship, events: s.friends.whirli.events, palette: { cream: 'twilight', teal: 'clay' }, quirkId: 'formal_bow' });
    assert.equal(s.selectedFriendId, 'whirli'); assert.equal(s.visible.whirli, true, 'My Friend is in the world');
    await page.click('#btn-roster'); await page.waitForSelector('.roster-grid');
    assert.ok(await page.locator('.roster-grid .card', { hasText: 'My Friend (made by you)' }).locator('.name', { hasText: 'Puffy Pal' }).count() > 0, 'roster shows My Friend');
    await page.keyboard.press('Escape'); await waitIdle(page);
    // Ending: all eight, including the custom name.
    const card = await moonPicnic(page, 'Glowy', { skipAfter: 2000 });
    assert.match(card, /made with Tumbletuft, Puffy Pal, Puddleloop, Glintot, Foldfern, Sir Kite, Siltbell, Glowy and you\./);
    assert.match(card, /Your own friend Puffy Pal came too!/);
    await page.click('.final-card .btn.primary'); await waitIdle(page);
    s = await st(page);
    assert.equal(Object.keys(s.friends).length, 8);
    assert.deepEqual([...log.pageErrors, ...log.errors, ...log.failed], []);
  } finally { await browser.close(); await srv.close(); }
});
