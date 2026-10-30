// Dev: optional friends (Foldfern, Siltbell, Kitefin, Hushbulb), roster/book, My Friend editor, bell replay.
import { startServer } from '../tests/lib/server.mjs';
import { launch, openGame, startPlay, DESKTOP, shot, st, actOn, waitIdle, waitFor } from '../tests/lib/browser.mjs';
import { makeSave, seed } from '../tests/lib/saves.mjs';

const srv = await startServer();
const browser = await launch();
const t0 = Date.now(); const lap = m => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', m);
async function keepName(page) { await waitFor(page, () => document.querySelector('.name-input')); await page.click('.modal .row .btn:not(.primary)'); await waitIdle(page); }
let page;
try {
  const save = makeSave({ friends: ['tumbletuft', 'whirli', 'puddleloop', 'glintot'], projects: ['leaf_slide', 'lotus_steps', 'pinwheel_canopy', 'lantern_picnic'], position: [-10, 0, 3], selected: 'tumbletuft', finaleSeen: true });
  const o = await openGame(browser, srv, { device: DESKTOP, ...seed(save) }); page = o.page;
  await startPlay(page); lap('started');
  await page.evaluate(() => window.__ww.setTimeScale(2.5));
  await actOn(page, 'foldfern_invite'); await page.waitForTimeout(2500); await shot(page, 'm5-foldfern'); await keepName(page); lap('foldfern');
  await actOn(page, 'kitefin_challenge'); await waitIdle(page);
  await actOn(page, 'wind_switch'); await waitFor(page, () => window.__ww.interactables().some(i => i.id === 'kitefin_bow'));
  await actOn(page, 'kitefin_bow'); await page.waitForTimeout(1200); await shot(page, 'm5-kitefin'); await keepName(page); lap('kitefin');
  await actOn(page, 'siltbell_pebble'); await waitIdle(page);
  await actOn(page, 'siltbell_tap'); await page.waitForTimeout(1200); await shot(page, 'm5-siltbell'); await keepName(page); lap('siltbell');
  await actOn(page, 'hushbulb_listen'); await waitIdle(page);
  await actOn(page, 'hushbulb_answer'); await page.waitForTimeout(2500); await shot(page, 'm5-hushbulb'); await keepName(page); lap('hushbulb');
  // Roster + memory book.
  await page.click('#btn-roster'); await page.waitForTimeout(600); await shot(page, 'm5-roster');
  await page.click('.modal .row >> text=Memory book'); await page.waitForTimeout(600); await shot(page, 'm5-book');
  await page.keyboard.press('Escape'); await waitIdle(page);
  // My Friend editor.
  await page.click('#btn-pause'); await page.click('.modal >> text=My Friend');
  await page.click('.roster-grid .card >> nth=1'); await page.waitForTimeout(500);
  await page.click('.swatch[aria-label="Body colour: clay"]'); await page.click('.swatch[aria-label="Trim colour: amber"]');
  await page.fill('.editor .name-input', 'Puffy Pal'); await page.click('.editor .chip-btn >> text=Happy hops');
  await page.waitForTimeout(400); await shot(page, 'm5-editor');
  await page.click('.modal >> text=Save my friend'); await waitIdle(page); await page.waitForTimeout(800); await shot(page, 'm5-myfriend-world');
  const s = await st(page);
  console.log(JSON.stringify({ friends: Object.keys(s.friends), custom: s.customFriends, sel: s.selectedFriendId }));
  // Bell replay with skip; final card mentions the custom friend.
  await actOn(page, 'picnic_bell'); await waitFor(page, () => document.querySelector('.choice-grid')); await page.click('.choice-grid .card >> nth=0');
  await waitFor(page, () => document.querySelector('.modal .btn.big')); await page.click('.modal .btn.big');
  await page.waitForTimeout(2500); await page.click('.skip-btn'); await waitFor(page, () => document.querySelector('.final-card'));
  await page.waitForTimeout(500); await shot(page, 'm5-final-all');
  console.log(await page.textContent('.final-card'));
  console.log('LOG', JSON.stringify({ e: o.log.errors, w: o.log.warnings, p: o.log.pageErrors, f: o.log.failed }));
} catch (e) { console.error('FAIL', e.message); try { const s = await st(page); console.error(JSON.stringify({ enc: s.encounter, target: s.target, busy: s.busy, modal: s.modal, goal: s.goal, k: s.keeper })); } catch {} }
finally { await browser.close(); await srv.close(); }
