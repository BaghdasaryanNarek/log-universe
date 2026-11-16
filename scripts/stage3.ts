/** Скриншоты инструментов и пасхалок в действии: node scripts/stage3.ts [url] [lang] [WxH] */
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5173/';
const lang = process.argv[3] ?? 'ru';
const [w, h] = (process.argv[4] ?? '1920x1080').split('x').map(Number);
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: w, height: h } });
await ctx.addInitScript((l) => { try { localStorage.setItem('log-cosmos.lang', l); } catch { /* */ } }, lang);
const p = await ctx.newPage();
const issues: string[] = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') issues.push(`${m.type()}: ${m.text()}`); });
p.on('pageerror', (e) => issues.push(`pageerror: ${e.message}`));
await p.goto(url);
await p.waitForFunction(() => !document.getElementById('preloader'), null, { timeout: 60000 });
const fly = (n: number) => p.evaluate((nn) => (window as any).__lc.fly(nn), n);
const tag = `${w}x${h}-${lang}`;

await fly(12.95); await p.waitForTimeout(3500);
await p.screenshot({ path: `shots/s3-${tag}-kepler-lin.png` });
await p.click('.kt-toggle'); await p.waitForTimeout(2300);
const dot = await p.$('.kt-you .kt-dot'); const bb = await dot!.boundingBox();
await p.mouse.move(bb!.x + 10, bb!.y + 10); await p.mouse.down(); await p.mouse.move(bb!.x + 160, bb!.y, { steps: 8 }); await p.mouse.up();
await p.waitForTimeout(400);
await p.screenshot({ path: `shots/s3-${tag}-kepler-log.png` });

await fly(18.45); await p.waitForTimeout(3500);
await p.click('.oc-play[data-seq="geo"]'); await p.waitForTimeout(700);
await p.screenshot({ path: `shots/s3-${tag}-weber.png` });

await fly(28.8); await p.waitForTimeout(3500);
await p.screenshot({ path: `shots/s3-${tag}-rule.png` });
await p.click('[data-demo="mars"]'); await p.waitForTimeout(8500);
await p.screenshot({ path: `shots/s3-${tag}-rule-mars.png` });

await fly(21.3); await p.waitForTimeout(4200);
await p.keyboard.press('Escape');
await p.mouse.click(5, 5);
await p.keyboard.type('napier'); await p.waitForTimeout(2600);
await p.screenshot({ path: `shots/s3-${tag}-napier.png` });
await p.keyboard.type('napier'); await p.waitForTimeout(1800);

for (let i = 0; i < 3; i++) { await p.click('.brand-mark'); await p.waitForTimeout(150); }
await p.waitForTimeout(4600);
await p.screenshot({ path: `shots/s3-${tag}-spira.png` });
await p.keyboard.press('Escape');
await p.keyboard.press('m'); await p.waitForTimeout(500);
console.log('sound pressed:', await p.$eval('#sound', (e) => e.getAttribute('aria-pressed')));
await b.close();
console.log(issues.length ? issues.join('\n') : 'Console: clean');
