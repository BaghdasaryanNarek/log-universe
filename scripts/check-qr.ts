/**
 * Проверка QR на отрисованной странице: снимок элемента → jsQR → должен получиться ровно production-адрес.
 * Заодно меряет, какую долю высоты экрана занимает код.  node scripts/check-qr.ts [url] [expected]
 */
import { chromium } from 'playwright';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const expected = process.argv[3] ?? 'https://universe-with-log.vercel.app';
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
let ok = true;
for (const [w, h, mobile] of [[1920, 1080, false], [1280, 720, false], [390, 844, true]] as const) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
  const p = await ctx.newPage();
  await p.goto(`${url}${url.includes('?') ? '&' : '?'}test#b-sources`);
  await p.waitForFunction(() => !document.getElementById('preloader'), null, { timeout: 90000 });
  await p.waitForTimeout(6000);
  const el = await p.$('.beat.is-active .qr-code');
  if (!el) { console.error(`✗ ${w}×${h}: QR не на экране`); ok = false; await ctx.close(); continue; }
  const box = (await el.boundingBox())!;
  const png = PNG.sync.read(await el.screenshot());
  const r = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  const share = (box.height / h) * 100;
  const good = r?.data === expected;
  ok &&= good;
  console.log(`${good ? '✓' : '✗'} ${w}×${h}: «${r?.data}», высота ${box.height.toFixed(0)} px = ${share.toFixed(0)} % экрана`);
  await p.screenshot({ path: `shots/qr-${w}x${h}.png` });
  await ctx.close();
}
await b.close();
if (!ok) process.exit(1);
