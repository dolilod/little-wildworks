// Acceptance 6 — Reachability (navgrid BFS from the spawn): every required creature and its
// friendship prop are reachable before the project they unlock; route gates really gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './lib/server.mjs';
import { launch, openGame, DESKTOP } from './lib/browser.mjs';

test('6. Reachability: required creatures + friendship props reachable before their projects; gates block the rest', async () => {
  const srv = await startServer(); const browser = await launch();
  try {
    const { page } = await openGame(browser, srv, { device: DESKTOP });
    const P = await page.evaluate(() => window.__ww.points());
    const reach = (names, completed) => page.evaluate(([pts, done]) => window.__ww.reachable(pts, done), [Object.fromEntries(names.map(n => [n, P[n]])), completed]);
    const expectAll = (res, want, stage) => { for (const [k, v] of Object.entries(res)) assert.equal(v, want, `${stage}: ${k} should be ${want ? 'reachable' : 'blocked'}`); };

    // Stage 0 (new game): Tumbletuft, its seed and ramp, and the slide socket.
    expectAll(await reach(['creature:tumbletuft', 'prop:tumbletuft_seed', 'prop:tumbletuft_ramp', 'socket:leaf_slide'], []), true, 'start');
    expectAll(await reach(['creature:whirli', 'socket:pinwheel_canopy', 'socket:lotus_steps', 'creature:glintot'], []), false, 'start (meadow gate closed)');

    // After the slide: both branch friends + their props + both sockets.
    const s1 = ['leaf_slide'];
    expectAll(await reach(['creature:whirli', 'prop:whirli_pinwheel', 'socket:pinwheel_canopy', 'prop:puddleloop_bank', 'socket:lotus_steps', 'creature:foldfern', 'creature:kitefin'], s1), true, 'after slide');
    expectAll(await reach(['creature:glintot', 'prop:glintot_lens', 'prop:glintot_cradle', 'socket:lantern_picnic', 'prop:picnic_bell'], s1), false, 'after slide (Lantern Rise closed)');
    expectAll(await reach(['prop:siltbell_pebble'], s1), false, 'after slide (no pads yet)');

    // One branch only: still closed (either order).
    expectAll(await reach(['creature:glintot', 'prop:glintot_lens'], ['leaf_slide', 'lotus_steps']), false, 'pond only');
    expectAll(await reach(['creature:glintot', 'prop:glintot_lens'], ['leaf_slide', 'pinwheel_canopy']), false, 'wind only');
    expectAll(await reach(['prop:siltbell_pebble'], ['leaf_slide', 'lotus_steps']), true, 'pond done: side pad reaches Siltbell');

    // Both branches: the dusk friend, its lens + cradle, the lantern socket and the bell.
    const s2 = ['leaf_slide', 'lotus_steps', 'pinwheel_canopy'];
    expectAll(await reach(['creature:glintot', 'prop:glintot_lens', 'prop:glintot_cradle', 'socket:lantern_picnic', 'prop:picnic_bell', 'prop:hushbulb_tent'], s2), true, 'both branches');
  } finally { await browser.close(); await srv.close(); }
});
