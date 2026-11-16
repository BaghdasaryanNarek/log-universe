/**
 * Скриншоты «до/после»: node scripts/ba-shots.ts <url> <prefix> [lang]
 * Сцены #b-napier, #b-andromeda, #b-hr при 1366×768 и 1280×720.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const [url, prefix, lang = 'ru'] = process.argv.slice(2);
mkdirSync('shots/ba', { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const issues: string[] = [];
for (const [w, h] of [[1366, 768], [1280, 720]] as const) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript((l) => { try { localStorage.setItem('log-cosmos.lang', l); } catch { /* */ } }, lang);
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') issues.push(`${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => issues.push(`pageerror: ${e.message}`));
  await p.goto(`${url}${url.includes('?') ? '&' : '?'}test`);
  await p.waitForFunction(() => !document.getElementById('preloader'), null, { timeout: 90000 });
  await p.mouse.move(2, h - 2);
  for (const [id, n] of [['napier', 1.6], ['andromeda', 21.95], ['hr', 17.8]] as const) {
    await p.evaluate((nn) => (window as any).__lc.fly(nn), n);
    await p.waitForTimeout(5000);
    await p.screenshot({ path: `shots/ba/${prefix}-${id}-${w}x${h}.png` });
  }
  await ctx.close();
}
await b.close();
console.log(issues.length ? issues.join('\n') : 'Console: clean');
