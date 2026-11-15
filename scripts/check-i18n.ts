/** Все словари содержат одинаковые ключи и одинаковые плейсхолдеры. */
import { readFileSync } from 'node:fs';

const langs = ['hy', 'ru', 'en'];
const dicts = Object.fromEntries(langs.map((l) => [l, JSON.parse(readFileSync(`src/i18n/${l}.json`, 'utf8')) as Record<string, string>]));
const ph = (s: string) => (s.match(/\{[^}]+\}/g) ?? []).sort().join(',');
let errors = 0;
const all = new Set(langs.flatMap((l) => Object.keys(dicts[l])));
for (const k of all) {
  for (const l of langs) {
    if (!(k in dicts[l])) { console.error(`✗ ${l}: нет ключа ${k}`); errors++; }
  }
  const ref = ph(dicts.ru[k] ?? '');
  for (const l of langs) if (k in dicts[l] && ph(dicts[l][k]) !== ref) { console.error(`✗ ${l}.${k}: плейсхолдеры ${ph(dicts[l][k])} ≠ ${ref}`); errors++; }
}
if (errors) process.exit(1);
console.log(`i18n ✓ ${all.size} ключей × ${langs.length} языка`);
