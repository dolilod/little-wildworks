// Acceptance 7 — Win path: the full critical path from a new game to the Moon Picnic with real
// inputs; guest-of-honour choice; Skip works; the final card shows the chosen names; free play
// resumes; the bell replays the celebration (watched in full, ≤ 45 s of game time).
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { startServer } from './lib/server.mjs';
import { launch, openGame, startPlay, DESKTOP, st, actOn, waitIdle, shot, ARTIFACTS } from './lib/browser.mjs';
import { befriend, runProject, moonPicnic, waitInteractable } from './lib/flows.mjs';

test('7. Win path: new game → four friends → four toys → Moon Picnic → free play → bell replay', { timeout: 30 * 60 * 1000 }, async () => {
  const srv = await startServer(); const browser = await launch();
  try {
    const { page, log } = await openGame(browser, srv, { device: DESKTOP });
    await startPlay(page);
    await page.evaluate(() => window.__ww.setTimeScale(3));
    await befriend(page, 'tumbletuft', { name: 'Captain Leaf' });
    await runProject(page, 'leaf_slide');
    await waitInteractable(page, 'slide_ride'); await actOn(page, 'slide_ride');
    await page.waitForSelector('.choice-grid'); await page.click('.choice-grid .card >> nth=1'); // Captain Leaf goes first
    await waitIdle(page, 90000);
    await befriend(page, 'whirli');
    await runProject(page, 'pinwheel_canopy');
    await befriend(page, 'puddleloop', { name: 'Loopy' });
    await runProject(page, 'lotus_steps');
    await befriend(page, 'glintot');
    await runProject(page, 'lantern_picnic');
    let s = await st(page);
    assert.deepEqual([...s.completedProjects].sort(), ['lantern_picnic', 'leaf_slide', 'lotus_steps', 'pinwheel_canopy']);
    assert.equal(Object.keys(s.friends).length, 4, 'critical path needs no optional friends');
    // First picnic: Whirli is the guest of honour; skip partway through.
    const card = await moonPicnic(page, 'Whirli', { skipAfter: 3500 });
    await shot(page, 'final-card');
    assert.match(card, /The first Moon Picnic, made with Captain Leaf, Whirli, Loopy, Glintot and you\./);
    assert.match(card, /Guest of honour: Whirli/);
    s = await st(page);
    assert.deepEqual(s.finale, { seen: true, guestOfHonourId: 'whirli' });
    await page.click('.final-card .btn.primary');
    await waitIdle(page);
    s = await st(page);
    assert.equal(s.inCutscene, false); assert.equal(await page.isVisible('#hud'), true, 'HUD back for free play');
    const k0 = s.keeper; await page.keyboard.down('KeyS'); await page.waitForTimeout(800); await page.keyboard.up('KeyS'); await page.waitForTimeout(300);
    const k1 = (await st(page)).keeper;
    assert.ok(Math.hypot(k1.x - k0.x, k1.z - k0.z) > 0.5, 'free play: the Keeper walks again');
    // Bell replay, watched in full, with a different guest.
    await page.evaluate(() => window.__ww.setTimeScale(2));
    await actOn(page, 'picnic_bell');
    await page.waitForSelector('.choice-grid'); await page.click('.choice-grid .card:has(.name:text-is("Captain Leaf"))');
    await page.waitForSelector('.modal .btn.big'); await page.click('.modal .btn.big');
    await page.waitForFunction(() => /best seat|coming/.test(document.querySelector('.cinema-caption')?.textContent || ''), null, { timeout: 120000 });
    await page.waitForTimeout(1200); await shot(page, 'picnic');
    await page.waitForSelector('.final-card', { timeout: 180000 });
    const card2 = await page.textContent('.final-card');
    assert.match(card2, /Guest of honour: Captain Leaf/);
    const elapsed = await page.evaluate(() => window.__ww.finaleElapsed());
    assert.ok(elapsed > 15 && elapsed <= 45, `chain reaction lasted ${elapsed?.toFixed(1)} s of game time (≤ 45)`);
    const perf = await page.evaluate(() => window.__ww.frameStats());
    writeFileSync(path.join(ARTIFACTS, 'perf-finale.json'), JSON.stringify({ ...perf, finaleSeconds: elapsed }, null, 2));
    await page.click('.final-card .btn.primary'); await waitIdle(page);
    assert.deepEqual([...log.pageErrors, ...log.errors, ...log.failed], []);
  } finally { await browser.close(); await srv.close(); }
});
