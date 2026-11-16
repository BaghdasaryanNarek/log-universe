/**
 * NASA (public domain) → public/textures/*.webp, 2048×1024. Уменьшение и сжатие — в Chromium (canvas).
 * Источники: Wikimedia Commons «Whole world - land and oceans 12000.jpg» (NASA GSFC)
 * и «The earth at night.jpg» (NASA Earth Observatory).
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('public/textures', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [src, out, q] of [['day.jpg', 'earth-day.webp', 0.86], ['night.jpg', 'earth-night.webp', 0.8]] as const) {
  const b64 = readFileSync(`assets-src/nasa/${src}`).toString('base64');
  const data = await page.evaluate(async ({ b64, q }) => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 1024;
    const g = c.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, 2048, 1024);
    return c.toDataURL('image/webp', q).split(',')[1];
  }, { b64, q });
  writeFileSync(`public/textures/${out}`, Buffer.from(data, 'base64'));
  console.log(out, Math.round(Buffer.from(data, 'base64').length / 1024), 'KB');
}
await browser.close();
