/** Склейка скриншотов в контактный лист: node scripts/contact.ts out.png a.png b.png … */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const [out, ...files] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const imgs = files.map((f) => `<figure><img src="data:image/png;base64,${readFileSync(f).toString('base64')}"><figcaption>${f.split(/[\\/]/).pop()}</figcaption></figure>`).join('');
await p.setContent(`<style>body{margin:0;background:#000;display:grid;grid-template-columns:1fr 1fr;gap:4px}img{width:100%;display:block}figure{margin:0}figcaption{color:#fc0;font:12px monospace}</style>${imgs}`);
await p.screenshot({ path: out, fullPage: true });
await b.close();
