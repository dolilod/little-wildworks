// Acceptance 2 — Movement: keyboard moves the Keeper; the touch joystick moves the Keeper;
// blur, visibilitychange and pointercancel all stop motion (no stuck movement).
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './lib/server.mjs';
import { launch, openGame, startPlay, DESKTOP, MOBILE, st } from './lib/browser.mjs';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** Hold a real key until the Keeper has moved `min` metres (frame-rate independent). */
async function holdUntilMoved(page, key, min = 1, timeout = 15000) {
  const p0 = (await st(page)).keeper, t0 = Date.now();
  await page.keyboard.down(key);
  let p = p0;
  while (Date.now() - t0 < timeout) { await page.waitForTimeout(150); p = (await st(page)).keeper; if (dist(p0, p) > min) break; }
  await page.keyboard.up(key);
  return dist(p0, p);
}

test('2. Movement: keyboard (WASD + arrows) moves the Keeper and blur/visibilitychange stop it', async () => {
  const srv = await startServer(); const browser = await launch();
  try {
    const { page } = await openGame(browser, srv, { device: DESKTOP });
    await startPlay(page);
    const d1 = await holdUntilMoved(page, 'KeyD', 1.0);
    assert.ok(d1 > 1.0, `D moved the Keeper (${d1.toFixed(2)} m)`);
    const d2 = await holdUntilMoved(page, 'ArrowUp', 0.8);
    assert.ok(d2 > 0.8, `ArrowUp moved the Keeper (${d2.toFixed(2)} m)`);
    await page.waitForTimeout(500);
    // Blur while a key is held: motion must stop even though no keyup arrives.
    await page.keyboard.down('KeyS'); await page.waitForTimeout(500);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForTimeout(600);
    const a = (await st(page)).keeper; await page.waitForTimeout(800); const b = (await st(page)).keeper;
    assert.ok(dist(a, b) < 0.05 && b.speed < 0.05, 'blur cleared held movement');
    await page.keyboard.up('KeyS');
    // visibilitychange (tab hidden) while held: motion must stop.
    await page.keyboard.down('KeyA'); await page.waitForTimeout(500);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(600);
    const c = (await st(page)).keeper; await page.waitForTimeout(800); const d = (await st(page)).keeper;
    assert.ok(dist(c, d) < 0.05 && d.speed < 0.05, 'visibilitychange cleared held movement');
    await page.keyboard.up('KeyA');
  } finally { await browser.close(); await srv.close(); }
});

test('2. Movement: touch joystick moves the Keeper and pointercancel/touchend stop it', async () => {
  const srv = await startServer(); const browser = await launch();
  try {
    const { page, context } = await openGame(browser, srv, { device: MOBILE });
    await startPlay(page);
    assert.equal(await page.isVisible('#joy-zone'), true, 'joystick zone visible on touch device');
    const cdp = await context.newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y, id: 1 }] });
    const p0 = (await st(page)).keeper;
    await touch('touchStart', 100, 700);
    for (let i = 1; i <= 5; i++) { await touch('touchMove', 100 + i * 10, 700 - i * 8); await page.waitForTimeout(30); }
    let p1 = p0; for (let t = 0; t < 60 && dist(p0, p1) <= 0.8; t++) { await page.waitForTimeout(200); p1 = (await st(page)).keeper; }
    assert.ok(dist(p0, p1) > 0.8, `joystick moved the Keeper (${dist(p0, p1).toFixed(2)} m)`);
    await touch('touchEnd');
    await page.waitForTimeout(600);
    const a = (await st(page)).keeper; await page.waitForTimeout(700); const b = (await st(page)).keeper;
    assert.ok(dist(a, b) < 0.05, 'releasing the stick stops the Keeper');
    // pointercancel (e.g. a system gesture) must also release the stick.
    await touch('touchStart', 100, 700);
    for (let i = 1; i <= 5; i++) { await touch('touchMove', 100 - i * 10, 700 - i * 9); await page.waitForTimeout(30); }
    let moving = (await st(page)).keeper; for (let t = 0; t < 40 && moving.speed <= 0.5; t++) { await page.waitForTimeout(150); moving = (await st(page)).keeper; }
    assert.ok(moving.speed > 0.5, 'moving again before cancel');
    await touch('touchCancel');
    await page.waitForTimeout(600);
    const c = (await st(page)).keeper; await page.waitForTimeout(700); const d = (await st(page)).keeper;
    assert.ok(dist(c, d) < 0.05 && d.speed < 0.05, 'pointercancel stopped motion');
    // Two fingers: the Action button works while the stick is held (multi-touch).
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 100, y: 700, id: 1 }] });
    const btn = await page.locator('#btn-action').boundingBox();
    const before = (await st(page)).stats.actions;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 100, y: 700, id: 1 }, { x: btn.x + btn.width / 2, y: btn.y + btn.height / 2, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: 100, y: 700, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(500);
    assert.ok((await st(page)).stats.actions > before, 'Action button pressed during a second touch');
  } finally { await browser.close(); await srv.close(); }
});
