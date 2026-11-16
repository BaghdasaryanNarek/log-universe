import { defineConfig, type Plugin } from 'vite';
import QRCode from 'qrcode';

/**
 * Адрес сайта для QR-кода. На Vercel при сборке задана VERCEL_PROJECT_PRODUCTION_URL
 * (production-домен проекта, без https://); локально — запасное значение.
 */
export const SITE_HOST = process.env.VERCEL_PROJECT_PRODUCTION_URL || 'log-universe.vercel.app';
export const SITE_URL = `https://${SITE_HOST}`;

/** QR-код генерируется при сборке в SVG (чёткий на проекторе): коррекция Q, тихая зона 4 модуля. */
function qrPlugin(): Plugin {
  const id = 'virtual:qr';
  return {
    name: 'log-universe-qr',
    resolveId: (s) => (s === id ? `\0${id}` : undefined),
    async load(s) {
      if (s !== `\0${id}`) return;
      const svg = await QRCode.toString(SITE_URL, {
        type: 'svg', errorCorrectionLevel: 'Q', margin: 4,
        color: { dark: '#14100aff', light: '#efe7d4ff' },
      });
      return `export const SITE_URL = ${JSON.stringify(SITE_URL)};\nexport const QR_SVG = ${JSON.stringify(svg)};\n`;
    },
  };
}

// base '/' — сайт живёт в корне домена (Vercel) и локального сервера start-offline.ps1.
export default defineConfig({
  base: '/',
  plugins: [qrPlugin()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173 },
  test: {
    include: ['tests/**/*.test.ts'],
  },
} as never);
