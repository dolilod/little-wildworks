// Acceptance 4 — Each ability/project (leaf_slide, lotus_steps, pinwheel_canopy, lantern_picnic):
// the world state changes (meshes swap, a path/collision opens), the toy is replayable, and
// duplicate action taps during the helper animation are ignored (project/events commit once).
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './lib/server.mjs';
import { launch, openGame, startPlay, DESKTOP, st, actOn, waitIdle, walkTo, shot } from './lib/browser.mjs';
import { makeSave, seed } from './lib/saves.mjs';
import { runProject, waitInteractable } from './lib/flows.mjs';

async function open(browser, srv, save) {
  const o = await openGame(browser, srv, { device: DESKTOP, ...seed(save) });
  await startPlay(o.page);
  await o.page.evaluate(() => window.__ww.setTimeScale(2.5));
  return o;
}
const vis = (page, id) => page.evaluate(pid => window.__ww.projectVisual(pid), id);
const count = (arr, x) => arr.filter(v => v === x).length;

test('4. Project leaf_slide: grows, opens the meadow gate, ride is replayable, spam ignored', async () => {
  const srv = await startServer(); const browser = await launch();
  try {
    const { page } = await open(browser, srv, makeSave({ friends: ['tumbletuft'], position: [-12.5, 0, 9.2] }));
    assert.deepEqual(await vis(page, 'leaf_slide'), { finished: false, unfinished: true, complete: false });
    assert.equal(await page.evaluate(() => window.__ww.reachableNow(-5, 4)), false, 'outside the meadow is closed before the slide');
    const before = await st(page);
    const s = await runProject(page, 'leaf_slide', { spam: 8, shotName: 'project-leaf_slide' });
    assert.deepEqual(await vis(page, 'leaf_slide'), { finished: true, unfinished: false, complete: true });
    assert.equal(count(s.completedProjects, 'leaf_slide'), 1, 'completed once');
    assert.equal(count(s.friends.tumbletuft.events, 'participate:leaf_slide:tumbletuft'), 1, 'participation recorded once');
    assert.ok(s.stats.ignoredActions > before.stats.ignoredActions, 'extra taps while acting were ignored');
    assert.equal(s.gates.meadow, true, 'meadow gate opened');
    assert.equal(await page.evaluate(() => window.__ww.collisionActive('gate_meadow')), false, 'gate collider removed');
    assert.equal(await page.evaluate(() => window.__ww.reachableNow(-5, 4)), true, 'path toward the pond is open');
    // Toy: ride twice (first ride asks who goes first).
    for (let i = 0; i < 2; i++) {
      await waitInteractable(page, 'slide_ride'); await actOn(page, 'slide_ride');
      if (i === 0) { await page.waitForSelector('.choice-grid'); await page.click('.choice-grid .card >> nth=0'); }
      await waitIdle(page, 90000);
    }
    const r = await st(page);
    assert.ok(r.flags.includes('rode:leaf_slide') && r.flags.includes('choice:slide_first:keeper'), 'rides recorded with the first-turn choice');
    assert.equal(count(r.friends.tumbletuft.events, 'play:leaf_slide:tumbletuft'), 1, 'play event unique across replays');
    assert.equal(r.friends.tumbletuft.friendship, 'grown', 'participate + play grew the friendship');
    await actOn(page, 'slide_switch'); await page.waitForTimeout(300);
    assert.equal((await st(page)).toyVariants.leaf_slide, 'bouncy', 'variant switch works');
  } finally { await browser.close(); await srv.close(); }
});

test('4. Project lotus_steps: pads rise and become walkable, tune toy replayable, spam ignored', async () => {
  const srv = await startServer(); const browser = await launch();
  try {
    const { page } = await open(browser, srv, makeSave({ friends: ['tumbletuft', 'puddleloop'], projects: ['leaf_slide'], position: [2.5, 0, -4.5], selected: 'puddleloop' }));
    assert.equal(await page.evaluate(() => window.__ww.collisionActive('lotus_pad_2')), false);
    assert.equal(await page.evaluate(() => window.__ww.reachableNow(10, -2, 0.4)), false, 'pond middle not walkable before');
    const before = await st(page);
    const s = await runProject(page, 'lotus_steps', { spam: 8, shotName: 'project-lotus_steps' });
    assert.deepEqual(await vis(page, 'lotus_steps'), { finished: true, unfinished: false, complete: true });
    assert.ok(s.stats.ignoredActions > before.stats.ignoredActions, 'extra taps ignored');
    assert.equal(count(s.friends.puddleloop.events, 'participate:lotus_steps:puddleloop'), 1);
    assert.equal(await page.evaluate(() => window.__ww.collisionActive('lotus_pad_2')), true, 'pads are walkable');
    assert.equal(await page.evaluate(() => window.__ww.reachableNow(10, -2, 0.4)), true, 'crossing open');
    assert.equal(await page.evaluate(() => window.__ww.lampLit('splash')), true, 'gate splash lamp lit');
    // Toy: hop across three pads → a tune; twice (replayable).
    for (const [x, z] of [[5.4, -4.4], [7.7, -3.2], [10, -2], [12.3, -0.8]]) await walkTo(page, x, z, { tol: 0.5 });
    await page.waitForTimeout(600);
    const t = await st(page);
    assert.ok(t.keeper.y > 0.15, 'Keeper stands on a raised pad');
    assert.ok(t.flags.includes('exp:pond_low'), 'played the three-note low tune');
    await walkTo(page, 7.7, -3.2, { tol: 0.5 }); await walkTo(page, 5.4, -4.4, { tol: 0.5 }); await walkTo(page, 3.4, -5.0, { tol: 0.6 });
    await actOn(page, 'pond_switch'); await page.waitForTimeout(300);
    for (const [x, z] of [[5.4, -4.4], [7.7, -3.2], [10, -2]]) await walkTo(page, x, z, { tol: 0.5 });
    await page.waitForTimeout(600);
    assert.ok((await st(page)).flags.includes('exp:pond_high'), 'replayed with the high chimes');
  } finally { await browser.close(); await srv.close(); }
});

test('4. Project pinwheel_canopy: pinwheel spins, gate lamp wakes, wind arrow toy replayable, spam ignored', async () => {
  const srv = await startServer(); const browser = await launch();
  try {
    const { page } = await open(browser, srv, makeSave({ friends: ['tumbletuft', 'whirli'], projects: ['leaf_slide'], position: [-1.5, 0, 6], selected: 'whirli' }));
    assert.equal(await page.evaluate(() => window.__ww.lampLit('gust')), false);
    const before = await st(page);
    const s = await runProject(page, 'pinwheel_canopy', { spam: 8, shotName: 'project-pinwheel_canopy' });
    assert.deepEqual(await vis(page, 'pinwheel_canopy'), { finished: true, unfinished: false, complete: true });
    assert.ok(s.stats.ignoredActions > before.stats.ignoredActions, 'extra taps ignored');
    assert.equal(count(s.friends.whirli.events, 'participate:pinwheel_canopy:whirli'), 1);
    assert.equal(await page.evaluate(() => window.__ww.lampLit('gust')), true, 'gate gust lamp lit');
    assert.equal(s.gates.dusk, false, 'Lantern Rise still needs the pond');
    for (let i = 0; i < 4 && !(await st(page)).flags.includes('exp:wind_first'); i++) { await actOn(page, 'wind_arrow'); await waitIdle(page); await page.waitForTimeout(200); }
    const t = await st(page);
    assert.ok(t.flags.includes('exp:wind_first'), 'pointed the wind at the first ribbon');
    assert.equal(count(t.friends.whirli.events, 'play:pinwheel_canopy:whirli'), 1);
    await actOn(page, 'wind_switch'); await page.waitForTimeout(300);
    for (let i = 0; i < 4 && !(await st(page)).flags.includes('exp:wind_other'); i++) { await actOn(page, 'wind_arrow'); await waitIdle(page); await page.waitForTimeout(200); }
    assert.ok((await st(page)).flags.includes('exp:wind_other'), 'replayed the other way');
  } finally { await browser.close(); await srv.close(); }
});

test('4. Project lantern_picnic: lamps light, bell becomes ready, remix toy replayable, spam ignored', async () => {
  const srv = await startServer(); const browser = await launch();
  try {
    const { page } = await open(browser, srv, makeSave({ friends: ['tumbletuft', 'whirli', 'puddleloop', 'glintot'], projects: ['leaf_slide', 'lotus_steps', 'pinwheel_canopy'], position: [-2, 0, -6], selected: 'glintot' }));
    assert.equal((await page.evaluate(() => window.__ww.interactables())).some(i => i.id === 'picnic_bell'), false, 'bell not ready yet');
    const before = await st(page);
    const s = await runProject(page, 'lantern_picnic', { spam: 8, shotName: 'project-lantern_picnic' });
    assert.deepEqual(await vis(page, 'lantern_picnic'), { finished: true, unfinished: false, complete: true });
    assert.ok(s.stats.ignoredActions > before.stats.ignoredActions, 'extra taps ignored');
    assert.equal(count(s.friends.glintot.events, 'participate:lantern_picnic:glintot'), 1);
    assert.ok(s.sky >= 4, 'island turned to dusk');
    assert.ok((await page.evaluate(() => window.__ww.interactables())).some(i => i.id === 'picnic_bell'), 'bell ready');
    await actOn(page, 'lamp_remix'); await waitIdle(page); await page.waitForTimeout(300);
    await actOn(page, 'lamp_remix'); await waitIdle(page); await page.waitForTimeout(300);
    const t = await st(page);
    assert.ok(t.flags.includes('exp:lamps_star') && t.flags.includes('exp:lamps_moon'), 'remixed into a star and back to a moon');
    assert.equal(count(t.friends.glintot.events, 'play:lantern_picnic:glintot'), 1);
    await shot(page, 'project-lantern_picnic-star');
  } finally { await browser.close(); await srv.close(); }
});
