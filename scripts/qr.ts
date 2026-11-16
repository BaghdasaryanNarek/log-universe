/**
 * qr.png (1024×1024) в корень репозитория — для слайдов — и проверка декодированием.
 *   node scripts/qr.ts [https://адрес]   (по умолчанию — SITE_HOST, VERCEL_PROJECT_PRODUCTION_URL или universe-with-log.vercel.app)
 */
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';

const url = process.argv[2] ?? `https://${process.env.SITE_HOST || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'universe-with-log.vercel.app'}`;
await QRCode.toFile('qr.png', url, { type: 'png', width: 1024, margin: 4, errorCorrectionLevel: 'Q', color: { dark: '#000000ff', light: '#ffffffff' } });
const png = PNG.sync.read(readFileSync('qr.png'));
const res = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
if (!res || res.data !== url) { console.error(`✗ qr.png декодируется как «${res?.data}», ожидалось «${url}»`); process.exit(1); }
console.log(`qr.png ✓ ${png.width}×${png.height}, декодируется ровно в ${res.data}`);
