/**
 * Сценарий докладчика на собранной версии: PageDown по остановкам, смена языка на лету,
 * быстрые прыжки цифрами, reduced motion и версия без WebGL. Пишет скриншоты в shots/flow-*.
 *   node scripts/flow.ts [baseUrl]
 */
import { chromium, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:8099/';
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const issues: string[] = [];
const watch = (p: Page, tag: string) => {
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') issues.push(`[${tag}] ${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => issues.push(`[${tag}] pageerror: ${e.message}`));
};
const ready = (p: Page) => p.waitForFunction(() => !document.getElementById('preloader'), null, { timeout: 60000 });
const state = (p: Page) => p.evaluate(() => { const l = (window as any).__lc; return `n=${l.n.toFixed(2)} beat=${l.beat}`; });

// 1. Клавиши докладчика
{
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const p = await ctx.newPage(); watch(p, 'keys');
  await p.goto(`${base}?test`); await ready(p);
  console.log('start', await state(p));
  for (const k of ['PageDown', 'PageDown', 'PageUp', 'Home', '5', 'ArrowRight']) {
    await p.keyboard.press(k); await p.waitForTimeout(5200);
    console.log(k.padEnd(10), await state(p));
  }
  // смена языка на активной остановке
  await p.keyboard.press('l'); await p.waitForTimeout(1600);
  console.log('lang', await p.evaluate(() => document.documentElement.lang), await state(p));
  await p.screenshot({ path: 'shots/flow-lang-switch.png' });
  // быстрые прыжки подряд — не должно быть «полусобранных» состояний
  await p.keyboard.press('1'); await p.waitForTimeout(300); await p.keyboard.press('5'); await p.waitForTimeout(300); await p.keyboard.press('1');
  await p.waitForTimeout(5500);
  console.log('rapid', await state(p), 'visible beats:', await p.evaluate(() => [...document.querySelectorAll('.beat')].filter((b) => getComputedStyle(b).visibility !== 'hidden' && Number(getComputedStyle(b).opacity) > 0.05).map((b) => (b as HTMLElement).dataset.beat).join(',')));
  await p.screenshot({ path: 'shots/flow-rapid.png' });
  await p.keyboard.press('h'); await p.waitForTimeout(500); await p.screenshot({ path: 'shots/flow-help.png' }); await p.keyboard.press('Escape');
  const fps = await p.evaluate(() => (window as any).__lc.fps());
  console.log('fps', fps.toFixed(0));
  await ctx.close();
}
// 2. reduced motion
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); watch(p, 'reduced');
  await p.goto(`${base}?test`); await ready(p);
  await p.keyboard.press('PageDown'); await p.waitForTimeout(2500);
  console.log('reduced', await state(p));
  await p.screenshot({ path: 'shots/flow-reduced.png' });
  await ctx.close();
}
// 3. без WebGL
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage(); watch(p, 'nogl');
  await p.goto(`${base}?nogl`); await ready(p);
  await p.screenshot({ path: 'shots/flow-nogl.png', fullPage: true });
  console.log('nogl ok, height', await p.evaluate(() => document.body.scrollHeight));
  await ctx.close();
}
await browser.close();
console.log(issues.length ? `Console issues:\n${[...new Set(issues)].join('\n')}` : 'Console: clean');
