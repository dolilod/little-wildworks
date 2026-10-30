// Acceptance 10 — Layout at 390×844, 1280×800 and 844×390: no HUD overlap, every button
// inside the viewport and the (simulated) safe area, ≥ 48 px targets, text not clipped,
// touch controls only on touch devices.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './lib/server.mjs';
import { launch, openGame, startPlay, DESKTOP, MOBILE, LANDSCAPE, shot } from './lib/browser.mjs';
import { makeSave, seed } from './lib/saves.mjs';

const VIEWS = [
  ['desktop 1280x800', DESKTOP, false, { sat: 0, sar: 0, sab: 0, sal: 0 }],
  ['mobile 390x844', MOBILE, true, { sat: 47, sar: 0, sab: 34, sal: 0 }],
  ['landscape 844x390', LANDSCAPE, true, { sat: 0, sar: 47, sab: 21, sal: 47 }],
];

function overlaps(a, b) { return a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5; }

async function measure(page) {
  return page.evaluate(() => {
    const pick = sel => [...document.querySelectorAll(sel)].filter(e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && !e.closest('[hidden]'); });
    const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const items = [];
    for (const [sel, kind] of [['#goal', 'hud'], ['.hud-btn', 'btn'], ['#prompt', 'hud'], ['#keys-help', 'hud'], ['#btn-action', 'btn'], ['#btn-friend', 'btn'], ['.joy-ghost', 'hud'], ['#save-chip', 'hud']])
      for (const e of pick(sel)) items.push({ sel: sel + (e.id ? '' : ':' + items.length), kind, r: rect(e) });
    const clipped = [];
    for (const e of pick('.goal-text, .prompt-text, .action-label, .keys-help, #save-chip span')) {
      if (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) clipped.push(e.className || e.id);
    }
    return { items, clipped, W: innerWidth, H: innerHeight, touchVisible: pick('#touch').length > 0 && pick('#btn-action').length > 0 };
  });
}

for (const [label, device, touch, safe] of VIEWS) {
  test(`10. Layout ${label}: HUD fits, no overlap, safe areas respected, touch controls only on touch`, async () => {
    const srv = await startServer(); const browser = await launch();
    try {
      // Stand next to the seed so the context prompt / action label is showing too.
      const { page } = await openGame(browser, srv, { device, ...seed(makeSave({ friends: ['tumbletuft'], position: [-12.6, 0, 9.4] })) });
      await startPlay(page);
      // Simulate the notch / home-indicator insets through the CSS variables the layout uses.
      await page.evaluate(s => { for (const [k, v] of Object.entries(s)) document.documentElement.style.setProperty('--' + k, v + 'px'); }, safe);
      await page.waitForTimeout(1200);
      const m = await measure(page);
      assert.equal(m.touchVisible, touch, touch ? 'touch controls shown on a touch device' : 'no touch controls on desktop');
      for (const it of m.items) {
        const r = it.r;
        assert.ok(r.x >= safe.sal - 0.5 && r.y >= safe.sat - 0.5 && r.x + r.w <= m.W - safe.sar + 0.5 && r.y + r.h <= m.H - safe.sab + 0.5, `${it.sel} inside viewport/safe area: ${JSON.stringify(r)}`);
        if (it.kind === 'btn') assert.ok(r.w >= 48 && r.h >= 48, `${it.sel} target ≥ 48 px (${r.w}×${r.h})`);
      }
      for (let i = 0; i < m.items.length; i++) for (let j = i + 1; j < m.items.length; j++) {
        const a = m.items[i], b = m.items[j];
        if (a.sel === '.joy-ghost' || b.sel === '.joy-ghost') continue; // the stick ghost is a hint behind the play area, not a control
        assert.ok(!overlaps(a.r, b.r), `${a.sel} overlaps ${b.sel}`);
      }
      assert.deepEqual(m.clipped, [], 'no clipped text');
      await shot(page, 'layout-' + label.split(' ')[0]);
      // A dialog fits too (pause menu), scrollable if needed, with its first button visible.
      await page.click('#btn-pause'); await page.waitForSelector('.modal');
      const box = await page.locator('.modal').boundingBox();
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= m.W + 0.5 && box.y + box.height <= m.H + 0.5, 'pause dialog inside the viewport');
      assert.ok(await page.locator('.modal .btn.primary').isVisible(), 'primary dialog button visible');
    } finally { await browser.close(); await srv.close(); }
  });
}
