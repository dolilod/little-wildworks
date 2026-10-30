// Dev: from a saved slice, befriend Whirli + Puddleloop, finish wind + pond, befriend Glintot.
import { startServer } from '../tests/lib/server.mjs';
import { launch, openGame, startPlay, DESKTOP, shot, st, actOn, waitIdle, waitFor } from '../tests/lib/browser.mjs';
import { makeSave, seed } from '../tests/lib/saves.mjs';

const order = process.argv.includes('pondfirst') ? ['pond', 'wind'] : ['wind', 'pond'];
const srv = await startServer();
const browser = await launch();
const t0 = Date.now(); const lap = m => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', m);
async function keepName(page) { await waitFor(page, () => window.__ww.state().modal); await page.click('text=Keep'); await waitIdle(page); }
try {
  const save = makeSave({ friends: ['tumbletuft'], projects: ['leaf_slide'], position: [-8.5, 0, 5] });
  const { page, log } = await openGame(browser, srv, { device: DESKTOP, ...seed(save) });
  await startPlay(page); lap('started');
  await page.evaluate(() => window.__ww.setTimeScale(2.5));
  for (const b of order) {
    if (b === 'wind') {
      await actOn(page, 'whirli_ribbon'); lap('untied'); await page.waitForTimeout(300); await shot(page, 'm3-whirli-untie');
      await waitIdle(page); await actOn(page, 'whirli_blow'); await page.waitForTimeout(1200); await shot(page, 'm3-whirli-blow');
      await keepName(page); lap('whirli friend');
      await actOn(page, 'pinwheel_canopy_socket'); await page.waitForTimeout(2500); await shot(page, 'm3-pinwheel-act');
      await waitIdle(page); lap('pinwheel done'); await shot(page, 'm3-pinwheel-done');
      await actOn(page, 'wind_arrow'); await waitIdle(page); await actOn(page, 'wind_arrow'); await waitIdle(page);
      await page.waitForTimeout(500); await shot(page, 'm3-wind-toy');
    } else {
      await actOn(page, 'puddleloop_seed'); await page.waitForTimeout(3000); await shot(page, 'm3-puddleloop-help');
      await keepName(page); lap('puddleloop friend');
      await actOn(page, 'lotus_steps_socket'); await page.waitForTimeout(2200); await shot(page, 'm3-lotus-act');
      await waitIdle(page); lap('lotus done'); await shot(page, 'm3-lotus-done');
    }
  }
  console.log(JSON.stringify((await st(page)).gates), (await st(page)).goal?.text);
  await actOn(page, 'glintot_lens'); lap('lens'); await waitIdle(page);
  await actOn(page, 'glintot_cradle'); await page.waitForTimeout(1500); await shot(page, 'm3-glintot-cradle'); await waitIdle(page);
  await actOn(page, 'glintot_answer'); await waitIdle(page);
  await actOn(page, 'glintot_answer'); await page.waitForTimeout(1800); await shot(page, 'm3-glintot-glow');
  await keepName(page); lap('glintot friend');
  await shot(page, 'm3-end');
  const s = await st(page);
  console.log(JSON.stringify({ friends: Object.keys(s.friends), projects: s.completedProjects, goal: s.goal?.text, enc: s.encounter }));
  console.log('LOG', JSON.stringify({ e: log.errors, w: log.warnings, p: log.pageErrors, f: log.failed }));
} catch (e) { console.error('FAIL', e.message); }
finally { await browser.close(); await srv.close(); }
