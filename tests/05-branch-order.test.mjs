// Acceptance 5 — Branch order: pond-then-wind AND wind-then-pond both reach the dusk friend.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './lib/server.mjs';
import { launch, openGame, startPlay, DESKTOP, st, walkTo } from './lib/browser.mjs';
import { makeSave, seed } from './lib/saves.mjs';
import { befriend, runProject } from './lib/flows.mjs';

const BRANCH = {
  pond: async page => { await befriend(page, 'puddleloop'); await runProject(page, 'lotus_steps'); },
  wind: async page => { await befriend(page, 'whirli'); await runProject(page, 'pinwheel_canopy'); },
};

for (const order of [['pond', 'wind'], ['wind', 'pond']]) {
  test(`5. Branch order: ${order.join(' then ')} reaches Glintot on Lantern Rise`, async () => {
    const srv = await startServer(); const browser = await launch();
    try {
      const { page, log } = await openGame(browser, srv, { device: DESKTOP, ...seed(makeSave({ friends: ['tumbletuft'], projects: ['leaf_slide'], position: [-6, 0, 3.5] })) });
      await startPlay(page);
      await page.evaluate(() => window.__ww.setTimeScale(2.5));
      await BRANCH[order[0]](page);
      let s = await st(page);
      assert.equal(s.gates.dusk, false, 'Lantern Rise still closed after one branch');
      assert.equal(s.visible.glintot, false, 'dusk friend not yet out');
      await BRANCH[order[1]](page);
      s = await st(page);
      assert.equal(s.gates.dusk, true, 'Lantern Rise gate open');
      assert.equal(s.visible.glintot, true, 'Glintot appeared');
      assert.match(s.goal.text, /Lantern Rise|lantern/i, 'goal points to the dusk friend');
      assert.ok(await walkTo(page, -6.3, -5.8, { tol: 1.4, timeout: 40000 }), 'walked through the gate to Glintot with real keys');
      await page.waitForFunction(() => window.__ww.state().encounter.glintot !== 'unseen', null, { timeout: 15000 });
      assert.deepEqual([...log.pageErrors, ...log.errors], []);
    } finally { await browser.close(); await srv.close(); }
  });
}
