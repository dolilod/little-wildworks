// Dev: from both branches done → Glintot → lanterns → Moon Picnic (watch or skip).
import { startServer } from '../tests/lib/server.mjs';
import { launch, openGame, startPlay, DESKTOP, MOBILE, shot, st, actOn, waitIdle, waitFor } from '../tests/lib/browser.mjs';
import { makeSave, seed } from '../tests/lib/saves.mjs';

const skip = process.argv.includes('skip');
const srv = await startServer();
const browser = await launch();
const t0 = Date.now(); const lap = m => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', m);
try {
  const save = makeSave({ friends: ['tumbletuft', 'whirli', 'puddleloop'], projects: ['leaf_slide', 'lotus_steps', 'pinwheel_canopy'], position: [-1.2, 0, -3.2], selected: 'whirli', flags: ['choice:slide_first:tumbletuft'] });
  const { page, log } = await openGame(browser, srv, { device: process.argv.includes('mobile') ? MOBILE : DESKTOP, ...seed(save) }); globalThis.__page = page;
  await startPlay(page); lap('started');
  await page.evaluate(() => window.__ww.setTimeScale(2.5));
  await shot(page, 'm4-dusk-arrive');
  await actOn(page, 'glintot_lens'); await waitIdle(page); lap('lens');
  await actOn(page, 'glintot_cradle'); lap('cradle pressed'); await page.waitForTimeout(1500); await shot(page, 'm4-glintot-cradle'); lap('shot'); await waitIdle(page); lap('cradle done');
  await actOn(page, 'glintot_answer'); lap('answer1'); await waitIdle(page);
  await actOn(page, 'glintot_answer'); await page.waitForTimeout(1600); await shot(page, 'm4-glintot-glow');
  await waitFor(page, () => document.querySelector('.name-input')); await page.fill('.name-input', 'Shiny');
  await page.click('text=Use this name'); await waitIdle(page); lap('glintot friend');
  await actOn(page, 'lantern_picnic_socket'); await page.waitForTimeout(1800); await shot(page, 'm4-lanterns-act');
  await waitIdle(page); lap('lanterns'); await page.waitForTimeout(800); await shot(page, 'm4-lanterns-done');
  await actOn(page, 'picnic_bell'); await waitFor(page, () => window.__ww.state().modal); await page.waitForTimeout(400); await shot(page, 'm4-guest-choice');
  await page.click('.choice-grid .card >> nth=2'); // Puddleloop... depends on order
  await waitFor(page, () => document.querySelector('.modal .btn.big')); await shot(page, 'm4-go');
  await page.click('.modal .btn.big'); lap('go');
  if (skip) { await page.waitForTimeout(3000); await page.click('.skip-btn'); }
  else {
    for (const [i, ms] of [[1, 2500], [2, 4500], [3, 4500], [4, 4500], [5, 5000], [6, 5000]]) { await page.waitForTimeout(ms); await shot(page, 'm4-chain-' + i); }
  }
  await waitFor(page, () => document.querySelector('.final-card'), null, 120000); lap('final card');
  await page.waitForTimeout(600); await shot(page, 'm4-final-card');
  console.log(await page.textContent('.final-card'));
  await page.click('text=Keep playing'); await waitIdle(page); await page.waitForTimeout(1500); await shot(page, 'm4-freeplay');
  const s = await st(page);
  console.log(JSON.stringify({ finale: s.finale, goal: s.goal?.text, friends: Object.keys(s.friends), sky: s.sky }));
  console.log('LOG', JSON.stringify({ e: log.errors, w: log.warnings, p: log.pageErrors, f: log.failed }));
} catch (e) { console.error('FAIL', e.message); try { console.error(JSON.stringify(await st(globalThis.__page))); } catch {} }
finally { await browser.close(); await srv.close(); }
