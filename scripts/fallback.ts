/**
 * Кадры для версии без WebGL: каждая остановка без интерфейса → public/fallback/<id>.jpg (960×540).
 * Нужен запущенный dev-сервер: node scripts/fallback.ts [url]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const ids: [string, number][] = [
  ['hero', 0], ['napier', 1.6], ['orbit', 5.65], ['moon', 8.9], ['au', 11.6], ['kepler', 12.5], ['pogson', 16.8],
  ['hr', 17.8], ['milkyway', 21.3], ['andromeda', 21.95], ['universe', 26.8], ['map', 27.9],
];
mkdirSync('public/fallback', { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
await p.addInitScript(() => { try { localStorage.setItem('log-cosmos.lang', 'ru'); } catch { /* */ } });
await p.goto(url);
await p.waitForFunction(() => !document.getElementById('preloader'), null, { timeout: 60000 });
await p.addStyleTag({ content: '.topbar,.hud,#beats,.beat-ind,.hint,.bignum,#labels,#cursor,.sky-caption{visibility:hidden!important}' });
for (const [id, n] of ids) {
  await p.evaluate((nn) => (window as any).__lc.fly(nn), n);
  await p.waitForTimeout(4500);
  await p.screenshot({ path: `public/fallback/${id}.jpg`, type: 'jpeg', quality: 72 });
  console.log(id);
}
await b.close();
