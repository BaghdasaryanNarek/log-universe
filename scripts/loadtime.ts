import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const cpu of [1, 4]) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const t0 = Date.now();
  await p.goto('http://localhost:4174/');
  await p.waitForFunction(() => !document.getElementById('preloader'), null, { timeout: 120000 });
  const prof = await p.evaluate(() => performance.getEntriesByType('measure').map((m) => `${m.name}:${m.duration.toFixed(0)}`).join(' '));
  console.log(`cpu x${cpu}: ready in ${Date.now() - t0} ms ${prof}`);
  await p.close();
}
await b.close();
