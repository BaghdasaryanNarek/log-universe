/** Скриншоты для README (docs/*.jpg): node scripts/docs-shots.ts [url] */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const url = process.argv[2] ?? 'http://localhost:5173/';
mkdirSync('docs', { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.addInitScript(() => { try { localStorage.setItem('log-cosmos.lang', 'en'); } catch { /* */ } });
await p.goto(`${url}?test`);
await p.waitForFunction(() => !document.getElementById('preloader'), null, { timeout: 90000 });
const fly = (n: number) => p.evaluate((nn) => (window as any).__lc.fly(nn), n);
await p.mouse.move(5, 1075);
for (const [name, n] of [['hero', 0], ['hr-diagram', 17.8], ['milky-way', 21.3], ['log-map', 27.9]] as const) {
  await fly(n);
  await p.waitForTimeout(5200);
  await p.screenshot({ path: `docs/${name}.jpg`, type: 'jpeg', quality: 80 });
  console.log(name);
}
await b.close();
