// Playwright-core helpers: system Chromium (no downloads), SwiftShader WebGL,
// console/network capture, and input drivers that use REAL keys and touches.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ARTIFACTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../test-artifacts');
mkdirSync(ARTIFACTS, { recursive: true });

export async function launch() {
  return chromium.launch({
    executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=user-gesture-required'],
  });
}

export const DESKTOP = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
export const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
export const LANDSCAPE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

/** Open the game; collect console errors/warnings, page errors, failed and foreign requests. */
export async function openGame(browser, srv, { device = DESKTOP, query = '?test=1', storage = true, init } = {}) {
  const context = await browser.newContext({ ...device });
  if (!storage) await context.addInitScript(() => {
    const deny = () => { throw new DOMException('denied', 'SecurityError'); };
    Object.defineProperty(window, 'localStorage', { get: deny, configurable: true });
  });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const log = { errors: [], warnings: [], pageErrors: [], failed: [], foreign: [], requests: [] };
  page.on('console', m => {
    const t = m.type(), text = m.text();
    if (t === 'error') log.errors.push(text);
    if (t === 'warning' && !/GPU stall|swiftshader|WebGL|ReadPixels|Automatic fallback|GroupMarker/i.test(text)) log.warnings.push(text);
  });
  page.on('pageerror', e => log.pageErrors.push(String(e)));
  page.on('requestfailed', r => log.failed.push(r.url() + ' ' + (r.failure()?.errorText || '')));
  page.on('response', r => { if (r.status() >= 400) log.failed.push(r.url() + ' ' + r.status()); });
  page.on('request', r => { log.requests.push(r.url()); if (!r.url().startsWith(srv.origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) log.foreign.push(r.url()); });
  await page.goto(srv.url + query);
  await page.waitForFunction(() => !document.querySelector('#title-buttons').hidden && (!location.search.includes('test=1') || window.__ww?.ready), null, { timeout: 60000 });
  return { context, page, log };
}

export async function startPlay(page) {
  await page.evaluate(() => window.__ww.setTimeScale(3)); // fast-forward the opening shot
  await page.click('#btn-play');
  await page.waitForFunction(() => { const s = window.__ww.state(); return !s.titleMode && !s.inCutscene; }, null, { timeout: 120000 });
  await page.evaluate(() => window.__ww.setTimeScale(1));
  await page.waitForTimeout(300);
}

export const st = page => page.evaluate(() => window.__ww.state());

/** Hold keys toward a world target using the navgrid path (real keyboard input). */
export async function walkTo(page, x, z, { tol = 0.6, timeout = 40000 } = {}) {
  const t0 = Date.now();
  let held = new Set();
  const setKeys = async keys => {
    for (const k of held) if (!keys.has(k)) await page.keyboard.up(k);
    for (const k of keys) if (!held.has(k)) await page.keyboard.down(k);
    held = keys;
  };
  try {
    while (Date.now() - t0 < timeout) {
      const s = await st(page);
      const dx = x - s.keeper.x, dz = z - s.keeper.z;
      if (Math.hypot(dx, dz) < tol) { await setKeys(new Set()); return true; }
      const path = await page.evaluate(([x, z]) => window.__ww.path(x, z), [x, z]);
      let tx = x, tz = z;
      if (path && path.length > 1) { const p = path[Math.min(path.length - 1, 3)]; tx = p.x; tz = p.z; }
      const keys = keysToward(tx - s.keeper.x, tz - s.keeper.z);
      await setKeys(keys);
      await page.waitForTimeout(70);
    }
    return false;
  } finally { await setKeys(new Set()); }
}

/** Convert a world direction into WASD (screen-aligned) keys. */
export function keysToward(dx, dz) {
  // Camera offset (10,13,14): screen-right = (14,0,-10)/n, screen-up = (-10,0,-14)/n.
  const n = Math.hypot(14, 10), rx = 14 / n, rz = -10 / n, ux = -10 / n, uz = -14 / n;
  const sx = dx * rx + dz * rz, sy = dx * ux + dz * uz, m = Math.hypot(sx, sy) || 1;
  const keys = new Set();
  if (sx / m > 0.38) keys.add('KeyD'); if (sx / m < -0.38) keys.add('KeyA');
  if (sy / m > 0.38) keys.add('KeyW'); if (sy / m < -0.38) keys.add('KeyS');
  return keys;
}

/** Walk to an interactable by id, then press Space (real key) once it is the selected target. */
export async function actOn(page, id, { timeout = 40000 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const list = await page.evaluate(() => window.__ww.interactables());
    const it = list.find(i => i.id === id);
    if (!it) { await page.waitForTimeout(150); continue; }
    const s = await st(page);
    if (s.target?.id === id && !s.busy) {
      const before = s.stats.actions;
      await page.keyboard.press('Space');
      // Wait until the game has consumed this press (avoids racing the next step).
      await page.waitForFunction(n => window.__ww.state().stats.actions > n, before, { timeout: 10000 });
      await page.waitForTimeout(50);
      return true;
    }
    await walkTo(page, it.x, it.z, { tol: Math.min(0.9, it.r * 0.6), timeout: 20000 });
    await page.waitForTimeout(150);
  }
  throw new Error('could not act on ' + id);
}

export async function waitIdle(page, timeout = 60000) {
  await page.waitForFunction(() => { const s = window.__ww.state(); return !s.busy && !s.modal; }, null, { timeout });
}
export async function waitFor(page, fn, arg, timeout = 60000) { return page.waitForFunction(fn, arg, { timeout }); }
export async function shot(page, name) { await page.screenshot({ path: path.join(ARTIFACTS, name + '.png') }); }
