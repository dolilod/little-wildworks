// Dev: play the Tumbletuft slice with real inputs and screenshot each beat.
import { startServer } from '../tests/lib/server.mjs';
import { launch, openGame, startPlay, DESKTOP, MOBILE, shot, st, actOn, waitIdle, waitFor } from '../tests/lib/browser.mjs';

const mobile = process.argv.includes('mobile');
const srv = await startServer();
const browser = await launch();
const t0 = Date.now();
const lap = m => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', m);
try {
  const { page, log } = await openGame(browser, srv, { device: mobile ? MOBILE : DESKTOP });
  await startPlay(page); lap('started');
  await page.evaluate(() => window.__ww.setTimeScale(2));
  await actOn(page, 'tumbletuft_seed'); lap('nudged');
  await page.waitForTimeout(400); await shot(page, 'slice-1-nudge');
  await waitFor(page, () => window.__ww.interactables().some(i => i.id === 'tumbletuft_ramp'));
  await shot(page, 'slice-2-ramp'); lap('ramp ready');
  await actOn(page, 'tumbletuft_ramp'); lap('riding ramp');
  await waitFor(page, () => window.__ww.state().modal);
  await page.waitForTimeout(500); await shot(page, 'slice-3-nickname');
  await page.fill('.name-input', 'Captain Leaf');
  await page.click('text=Use this name');
  await waitIdle(page); lap('friend');
  await page.waitForTimeout(800); await shot(page, 'slice-4-friend');
  await actOn(page, 'leaf_slide_socket'); lap('growing');
  await page.waitForTimeout(1500); await shot(page, 'slice-5-growing');
  await waitIdle(page); lap('slide done');
  await shot(page, 'slice-6-done');
  await actOn(page, 'slide_ride'); lap('ride');
  await waitFor(page, () => window.__ww.state().modal);
  await shot(page, 'slice-7-who-first');
  await page.click('.choice-grid .card >> nth=1');
  await page.waitForTimeout(2500); await shot(page, 'slice-8-riding');
  await waitIdle(page); lap('ride done');
  await page.waitForTimeout(500); await shot(page, 'slice-9-after');
  console.log(JSON.stringify(await st(page)).slice(0, 1200));
  console.log('LOG', JSON.stringify({ e: log.errors, w: log.warnings, p: log.pageErrors, f: log.failed }));
} catch (e) { console.error('FAIL', e); }
finally { await browser.close(); await srv.close(); }
