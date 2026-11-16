/**
 * Скриншоты: все отметки × языки × разрешения + журнал консоли.
 * Использование: сначала `pnpm dev` (или preview), затем
 *   node scripts/shots.ts [url] [--n=0,3,16.8] [--lang=hy,ru,en] [--size=1920x1080,1280x720] [--headed]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const url = args.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/';
const ns = opt('n', '0,16.8').split(',').map(Number);
const langs = opt('lang', 'hy,ru,en').split(',');
const sizes = opt('size', '1920x1080,1280x720').split(',').map((s) => s.split('x').map(Number) as [number, number]);
const headed = args.includes('--headed');
mkdirSync('shots', { recursive: true });

const browser = await chromium.launch({
  headless: !headed,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const issues: string[] = [];
for (const [w, h] of sizes) {
  for (const lang of langs) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await ctx.addInitScript((l) => { try { localStorage.setItem('log-cosmos.lang', l); } catch { /* */ } }, lang);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') issues.push(`[${lang} ${w}] ${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => issues.push(`[${lang} ${w}] pageerror: ${e.message}`));
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => !document.getElementById('preloader'), null, { timeout: 60000 });
    for (const n of ns) {
      await page.evaluate((nn) => (window as unknown as { __lc: { fly(n: number): Promise<void> } }).__lc.fly(nn), n);
      await page.waitForTimeout(4600);
      await page.screenshot({ path: `shots/${w}x${h}-${lang}-n${n}.png` });
    }
    const fps = await page.evaluate(() => (window as unknown as { __lc: { fps(): number; tier(): string } }).__lc.fps().toFixed(0) + ' ' + (window as unknown as { __lc: { tier(): string } }).__lc.tier());
    console.log(`${w}x${h} ${lang}: ok, fps≈${fps}`);
    await ctx.close();
  }
}
await browser.close();
console.log(issues.length ? `Console issues:\n${[...new Set(issues)].join('\n')}` : 'Console: clean');
