/**
 * Проверка production без авторизации: каждый файл сайта → 200 и правильный Content-Type,
 * хэшированные /assets/ — immutable-кеш, index.html — без него.
 *   node scripts/check-prod.ts [https://universe-with-log.vercel.app]
 */
import { execSync } from 'node:child_process';

const base = (process.argv[2] ?? 'https://universe-with-log.vercel.app').replace(/\/$/, '');
const TYPES: Record<string, RegExp> = {
  html: /^text\/html/, js: /javascript/, css: /^text\/css/, woff2: /^font\/woff2/, woff: /^font\/woff/, ttf: /^font\/ttf|application\/x-font-ttf|font\/sfnt/,
  json: /^application\/json/, bin: /^application\/octet-stream/, webp: /^image\/webp/, jpg: /^image\/jpeg/, png: /^image\/png/, svg: /^image\/svg/,
};
const urls = new Set<string>(['/']);
const index = await (await fetch(`${base}/`)).text();
for (const m of index.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) urls.add(m[1]);
for (const css of [...urls].filter((u) => u.endsWith('.css'))) {
  const t = await (await fetch(base + css)).text();
  for (const m of t.matchAll(/url\(["']?([^"')]+)["']?\)/g)) if (!m[1].startsWith('data:')) urls.add(new URL(m[1], base + css).pathname);
}
for (const js of [...urls].filter((u) => u.endsWith('.js'))) {
  const t = await (await fetch(base + js)).text();
  for (const m of t.matchAll(/["'`](\/?assets\/[\w.-]+\.(?:woff2?|ttf|png|jpg|webp|svg))["'`]/g)) urls.add(`/${m[1].replace(/^\//, '')}`);
}
// всё из public/ (данные, текстуры, кадры для версии без WebGL)
for (const f of execSync('git ls-files public', { encoding: 'utf8' }).split('\n').filter(Boolean)) urls.add(f.replace(/^public/, ''));

let bad = 0;
const rows: string[] = [];
await Promise.all([...urls].map(async (u) => {
  const r = await fetch(base + u, { redirect: 'manual' });
  const ext = u === '/' ? 'html' : u.split('.').pop()!.toLowerCase();
  const ct = r.headers.get('content-type') ?? '';
  const cc = r.headers.get('cache-control') ?? '';
  const typeOk = TYPES[ext] ? TYPES[ext].test(ct) : true;
  const cacheOk = u.startsWith('/assets/') ? cc.includes('immutable') : !cc.includes('immutable');
  const ok = r.status === 200 && typeOk && cacheOk;
  if (!ok) bad++;
  rows.push(`${ok ? '✓' : '✗'} ${r.status} ${ct.padEnd(32)} ${cacheOk ? '' : `[cache: ${cc}] `}${u}`);
  await r.arrayBuffer().catch(() => {});
}));
rows.sort((a, b) => (a.startsWith('✗') === b.startsWith('✗') ? a.localeCompare(b) : a.startsWith('✗') ? -1 : 1));
console.log(rows.filter((r) => r.startsWith('✗')).join('\n'));
console.log(`${urls.size - bad}/${urls.size} файлов: 200 и верный Content-Type${bad ? ` — ОШИБОК: ${bad}` : ''}`);
if (bad) process.exit(1);
