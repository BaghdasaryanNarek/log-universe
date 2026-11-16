/**
 * Регистр путей: Windows его не различает, Linux (сборка на Vercel) — различает.
 * Сверяет относительные импорты, url() в CSS и пути к файлам из public/ с точными именами в git.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

// отслеживаемые + новые неигнорируемые файлы (локальная сборка до коммита); на Vercel все файлы уже в git
const tracked = new Set(execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' }).split('\n').filter(Boolean));
const trackedLower = new Map([...tracked].map((f) => [f.toLowerCase(), f]));
const files = [...tracked].filter((f) => /^(src|scripts|tests)\/.*\.(ts|css)$/.test(f) || f === 'index.html' || f === 'vite.config.ts');
let bad = 0, checked = 0;
const check = (from: string, rel: string) => {
  const p = normalize(join(dirname(from), rel)).replace(/\\/g, '/');
  checked++;
  if (tracked.has(p)) return;
  const hit = trackedLower.get(p.toLowerCase());
  if (hit) { console.error(`✗ регистр: ${from} → "${rel}" (в git: ${hit})`); bad++; }
  else if (!/\.(ts|js)$/.test(p) || !tracked.has(p)) { console.error(`✗ нет файла: ${from} → "${rel}"`); bad++; }
};
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) check(f, m[1]);
  for (const m of s.matchAll(/url\(\s*['"]?(\.{1,2}\/[^'")]+)['"]?\s*\)/g)) check(f, m[1]);
}
// файлы из public/, на которые ссылается код
const publicRefs = ['data/stars.bin', 'data/stars.json', 'textures/earth-day.webp', 'textures/earth-night.webp',
  ...['hero', 'napier', 'orbit', 'moon', 'au', 'kepler', 'pogson', 'hr', 'milkyway', 'andromeda', 'universe', 'map'].map((i) => `fallback/${i}.jpg`)];
for (const r of publicRefs) {
  checked++;
  if (!tracked.has(`public/${r}`)) { console.error(`✗ public/${r}: ${trackedLower.has(`public/${r}`.toLowerCase()) ? 'регистр' : 'нет в git'}`); bad++; }
}
if (bad) process.exit(1);
console.log(`case ✓ ${checked} ссылок совпадают с именами файлов в git`);
