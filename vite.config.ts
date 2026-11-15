import { defineConfig } from 'vite';

// base './' — сборка работает и с корня (Vercel), и из подпапки (GitHub Pages),
// и с локального сервера start-offline.ps1.
export default defineConfig({
  base: './',
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
