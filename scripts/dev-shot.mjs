// Dev helper: load the game, optionally play, and save screenshots to test-artifacts/dev-*.png.
// Usage: node scripts/dev-shot.mjs [mobile] [play] [walk]
import { startServer } from '../tests/lib/server.mjs';
import { launch, openGame, startPlay, DESKTOP, MOBILE, shot, st } from '../tests/lib/browser.mjs';

const args = new Set(process.argv.slice(2));
const srv = await startServer();
const browser = await launch();
try {
  const { page, log } = await openGame(browser, srv, { device: args.has('mobile') ? MOBILE : DESKTOP });
  await page.waitForTimeout(1500);
  await shot(page, 'dev-title');
  if (args.has('play')) {
    await startPlay(page);
    await page.waitForTimeout(1200);
    await shot(page, 'dev-play');
    if (args.has('walk')) {
      await page.keyboard.down('KeyD'); await page.waitForTimeout(1200); await page.keyboard.up('KeyD');
      await page.waitForTimeout(600); await shot(page, 'dev-walk');
    }
    console.log(JSON.stringify(await st(page), null, 0).slice(0, 1500));
    console.log(JSON.stringify(await page.evaluate(() => window.__ww.frameStats())));
  }
  console.log('LOG', JSON.stringify(log, null, 1).slice(0, 3000));
} finally { await browser.close(); await srv.close(); }
