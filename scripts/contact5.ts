import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [out, ...files] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 800 } });
const imgs = files.map((f) => `<img src="data:image/png;base64,${readFileSync(f).toString('base64')}">`).join('');
await p.setContent(`<style>body{margin:0;background:#000;display:grid;grid-template-columns:repeat(5,1fr);gap:4px}img{width:100%;display:block}</style>${imgs}`);
await p.screenshot({ path: out, fullPage: true });
await b.close();
