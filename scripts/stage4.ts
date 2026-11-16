/** Проверки этапа 4: слабая графика (?tier=low), режим проектора (K), версия без WebGL, подсказка на числе. */
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5173/';
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const issues: string[] = [];
const page = async (q: string, w = 1280, h = 720) => {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.addInitScript(() => { try { localStorage.setItem('log-cosmos.lang', 'ru'); } catch { /* */ } });
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') issues.push(`${q} ${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => issues.push(`${q} pageerror: ${e.message}`));
  await p.goto(url + q);
  await p.waitForFunction(() => !document.getElementById('preloader'), null, { timeout: 60000 });
  return p;
};
const fly = (p: any, n: number) => p.evaluate((nn: number) => (window as any).__lc.fly(nn), n);

let p = await page('?test&tier=low');
await fly(p, 21.3); await p.waitForTimeout(4500);
console.log('low tier:', await p.evaluate(() => (window as any).__lc.tier()), 'fps', (await p.evaluate(() => (window as any).__lc.fps())).toFixed(0));
await p.screenshot({ path: 'shots/s4-low.png' });
await p.close();

p = await page('?test');
await fly(p, 16.8); await p.waitForTimeout(4500);
await p.keyboard.press('k'); await p.waitForTimeout(800);
await p.hover('.num[data-log]'); await p.waitForTimeout(500);
await p.screenshot({ path: 'shots/s4-boost-numtip.png' });
await p.close();

p = await page('?nogl');
await p.waitForTimeout(800);
await p.screenshot({ path: 'shots/s4-nogl.png', fullPage: true });
console.log('fallback imgs:', await p.evaluate(() => document.querySelectorAll('.fallback-img').length));
await p.close();
await b.close();
console.log(issues.length ? issues.join('\n') : 'Console: clean');
