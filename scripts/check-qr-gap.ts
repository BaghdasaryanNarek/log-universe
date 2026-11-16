// QR на финальном экране: зазор с HUD и нижней подписью сцены на всех разрешениях
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5173/';
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
let bad = 0;
for (const [w, h] of [[1366, 768], [1280, 720], [1920, 1080]] as const) {
  for (const lang of ['hy', 'ru', 'en']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript((l) => localStorage.setItem('log-cosmos.lang', l), lang);
    const p = await ctx.newPage();
    await p.goto(`${url}?test#b-sources`);
    await p.waitForFunction(() => !document.getElementById('preloader'), null, { timeout: 90000 });
    await p.waitForTimeout(6000);
    const r = await p.evaluate(() => {
      const q = document.querySelector('.beat.is-active .qr-card')!.getBoundingClientRect();
      const code = document.querySelector('.beat.is-active .qr-code')!.getBoundingClientRect();
      const hud = document.querySelector('.hud-read')!.getBoundingClientRect();
      const ind = document.querySelector('.beat-ind')!.getBoundingClientRect();
      const overlapX = q.left < hud.right && hud.left < q.right;
      return { gapTop: overlapX ? q.top - hud.bottom : 999, gapBottom: ind.top - q.bottom, share: code.height / innerHeight };
    });
    const ok = r.gapTop >= 16 && r.gapBottom >= 8 && r.share >= 0.29;
    if (!ok) bad++;
    console.log(`${ok ? '✓' : '✗'} ${w}×${h} ${lang}: зазор с HUD ${r.gapTop.toFixed(0)} px, до низа ${r.gapBottom.toFixed(0)} px, QR ${(r.share * 100).toFixed(0)} % высоты`);
    if (lang === 'ru') await p.screenshot({ path: `shots/ba/qr-${w}x${h}.png` });
    await ctx.close();
  }
}
await b.close();
if (bad) process.exit(1);
