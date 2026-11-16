// Лист «до/после»: node scripts/ba-sheet.ts <scene> <out>
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [scene, out] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const img = (f: string) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
const cell = (f: string, cap: string) => `<figure><figcaption>${cap}</figcaption><img src="${img(f)}"></figure>`;
let html = '';
for (const s of ['1366x768', '1280x720']) html += cell(`shots/ba/before-${scene}-${s}.png`, `ДО · ${scene} · ${s}`) + cell(`shots/ba/after-${scene}-${s}.png`, `ПОСЛЕ · ${scene} · ${s}`);
await p.setContent(`<style>body{margin:0;background:#111;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px}img{width:100%;display:block}figure{margin:0}figcaption{color:#fc0;font:16px monospace;padding:4px 0}</style>${html}`);
await p.screenshot({ path: out, fullPage: true });
await b.close();
