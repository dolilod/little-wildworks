// Acceptance 1 — Load: title → start with 0 console errors/warnings, 0 page errors,
// 0 failed requests, 0 non-same-origin requests, all 9 GLBs loaded as GLB (not fallback),
// at 1280×800 desktop and 390×844 mobile (DPR 3, touch). Also: no test hook without ?test=1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { startServer } from './lib/server.mjs';
import { launch, openGame, startPlay, DESKTOP, MOBILE, shot, st, ARTIFACTS } from './lib/browser.mjs';

const MODELS = ['keeper', 'tumbletuft', 'foldfern', 'puddleloop', 'siltbell', 'whirli', 'kitefin', 'glintot', 'hushbulb'];

for (const [label, device, tag] of [['desktop 1280x800', DESKTOP, 'desktop'], ['mobile 390x844 DPR3 touch', MOBILE, 'mobile']]) {
  test(`1. Load: title -> start is clean and loads all 9 GLBs (${label})`, async () => {
    const srv = await startServer(); const browser = await launch();
    try {
      const { page, log } = await openGame(browser, srv, { device });
      assert.equal(await page.isVisible('.title-logo'), true, 'title logo visible');
      assert.equal(await page.isVisible('#btn-play'), true, 'Play button visible');
      await page.waitForTimeout(1200);
      await shot(page, tag === 'desktop' ? 'title' : 'title-mobile');
      await startPlay(page);
      await page.waitForTimeout(1500);
      await shot(page, tag + '-play');
      const s = await st(page);
      for (const id of MODELS) assert.equal(s.modelSources[id], 'glb', `${id} loaded from its GLB`);
      assert.equal(await page.isVisible('#hud'), true, 'HUD shown after start');
      assert.deepEqual(log.pageErrors, [], 'no page errors');
      assert.deepEqual(log.errors, [], 'no console errors');
      assert.deepEqual(log.warnings, [], 'no console warnings');
      assert.deepEqual(log.failed, [], 'no failed requests');
      assert.deepEqual(log.foreign, [], 'no non-same-origin requests');
      for (const u of log.requests) assert.ok(u.startsWith(srv.url) || u.startsWith('data:') || u.startsWith('blob:'), 'request stays under /little-wildworks/: ' + u);
      if (tag === 'desktop') {
        await page.evaluate(() => window.__ww.resetFrames());
        await page.keyboard.down('KeyD'); await page.waitForTimeout(2500); await page.keyboard.up('KeyD');
        await page.waitForTimeout(1500);
        const perf = await page.evaluate(() => window.__ww.frameStats());
        writeFileSync(path.join(ARTIFACTS, 'perf-desktop.json'), JSON.stringify(perf, null, 2));
      }
    } finally { await browser.close(); await srv.close(); }
  });
}

test('1. Load: normal page (no ?test=1) has no test hook and starts cleanly', async () => {
  const srv = await startServer(); const browser = await launch();
  try {
    const { page, log } = await openGame(browser, srv, { device: DESKTOP, query: '' });
    assert.equal(await page.evaluate(() => typeof window.__ww), 'undefined', 'test hook absent');
    await page.click('#btn-play');
    await page.waitForSelector('#hud:not([hidden])', { timeout: 30000 });
    await page.waitForTimeout(800);
    assert.deepEqual([...log.pageErrors, ...log.errors, ...log.failed, ...log.foreign], []);
  } finally { await browser.close(); await srv.close(); }
});
