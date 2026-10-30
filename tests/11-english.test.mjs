// Acceptance 11 — English only: scan visible DOM text on every screen and all content data
// for common Indonesian words. None may appear.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startServer } from './lib/server.mjs';
import { launch, openGame, startPlay, DESKTOP, waitIdle } from './lib/browser.mjs';
import { makeSave, seed } from './lib/saves.mjs';
import * as content from '../docs/js/content.js';

const WORDS = ['dan', 'yang', 'untuk', 'dengan', 'tidak', 'teman', 'mulai', 'bermain', 'simpan', 'keluar', 'suara', 'lanjut', 'kembali',
  'selesai', 'pengaturan', 'halo', 'terima', 'kasih', 'bisa', 'ini', 'itu', 'ayo', 'selamat', 'sahabat', 'kamu', 'aku', 'saya', 'dari',
  'pada', 'adalah', 'akan', 'sudah', 'belum', 'juga', 'jalan', 'lompat', 'bunyi', 'benih', 'daun', 'kolam', 'angin', 'lampu', 'piknik', 'bulan'];
const RX = new RegExp(`\\b(${WORDS.join('|')})\\b`, 'i');

function strings(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach(x => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach(x => strings(x, out));
  return out;
}

test('11. English only: content data has no Indonesian words', () => {
  const all = [...strings(content), ...strings(JSON.parse(readFileSync(new URL('../docs/data/creatures.json', import.meta.url)))),
    ...strings(JSON.parse(readFileSync(new URL('../docs/data/world.json', import.meta.url))))];
  const bad = all.filter(s => RX.test(s));
  assert.deepEqual(bad, []);
  assert.ok(all.length > 200, 'scanned the authored text');
});

test('11. English only: visible text on title, HUD and every menu has no Indonesian words', async () => {
  const srv = await startServer(); const browser = await launch();
  try {
    const save = makeSave({ friends: ['tumbletuft', 'whirli'], projects: ['leaf_slide'], position: [-12.6, 0, 9.4] });
    const { page, log } = await openGame(browser, srv, { device: DESKTOP, ...seed(save) });
    const texts = [];
    const grab = async where => texts.push([where, await page.evaluate(() => document.body.innerText)]);
    assert.equal(await page.getAttribute('html', 'lang'), 'en');
    await grab('title');
    await page.click('#btn-credits'); await page.waitForSelector('.credits'); await grab('credits'); await page.keyboard.press('Escape');
    await startPlay(page); await page.waitForTimeout(800); await grab('hud');
    for (const [btn, wait, name] of [['#btn-roster', '.roster-grid', 'roster'], ['#btn-book', '.book-page', 'book'], ['#btn-pause', '.settings-list', 'pause']]) {
      await page.click(btn); await page.waitForSelector(wait); await grab(name); await page.keyboard.press('Escape'); await waitIdle(page);
    }
    await page.click('#btn-pause'); await page.click('.modal >> text=Save code'); await page.waitForSelector('textarea.code'); await grab('save code'); await page.keyboard.press('Escape');
    await page.click('#btn-pause'); await page.click('.modal >> text=My Friend'); await page.waitForSelector('.roster-grid');
    await page.click('.roster-grid .card >> nth=0'); await page.waitForSelector('.editor'); await grab('editor');
    for (const [where, t] of texts) {
      const m = t.match(RX);
      assert.equal(m, null, `${where}: found "${m?.[0]}" in visible text`);
    }
    assert.deepEqual([...log.failed, ...log.foreign, ...log.pageErrors], [], 'menus (incl. credits concept art) load cleanly');
  } finally { await browser.close(); await srv.close(); }
});
