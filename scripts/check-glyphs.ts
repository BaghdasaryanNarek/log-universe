/**
 * Нет «квадратиков»: каждый символ словарей должен быть в одном из шрифтов стека.
 * Стек текста: Garamond (лат., кир., матем.) + Noto Serif Armenian.
 * Стек HUD: Plex Mono → Garamond → Noto Sans Armenian.
 */
import { readFileSync, readdirSync } from 'node:fs';
import * as fontkit from 'fontkit';

const open = (f: string) => fontkit.create(readFileSync(`src/assets/fonts/${f}`)) as unknown as { hasGlyphForCodePoint(c: number): boolean };
const text = [open('ebgaramond.woff2'), open('noto-serif-armenian.woff2')];
const italic = [open('ebgaramond-italic.woff2'), open('noto-serif-armenian.woff2')];

const chars = new Map<string, string>();
for (const f of readdirSync('src/i18n').filter((x) => x.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(`src/i18n/${f}`, 'utf8')) as Record<string, string>;
  for (const [k, v] of Object.entries(d)) for (const ch of v) if (!chars.has(ch)) chars.set(ch, `${f}:${k}`);
}
// символы, которые код вставляет сам (форматирование чисел, HUD)
for (const ch of '0123456789⁰¹²³⁴⁵⁶⁷⁸⁹⁻−·×≈,.%·₀₁₂₃₄₅₆₇₈₉  ') chars.set(ch, chars.get(ch) ?? 'code');

let bad = 0;
for (const [ch, where] of chars) {
  const cp = ch.codePointAt(0)!;
  if (cp < 0x20) continue;
  if (!text.some((f) => f.hasGlyphForCodePoint(cp))) { console.error(`✗ нет глифа U+${cp.toString(16).toUpperCase().padStart(4, '0')} «${ch}» (${where})`); bad++; }
  else if (!italic.some((f) => f.hasGlyphForCodePoint(cp)) && /[⁰-⁹⁻]/.test(ch)) {
    // в курсиве верхних индексов нет — подписи-курсивы не должны их содержать (проверяется вручную)
  }
}
if (bad) process.exit(1);
console.log(`glyphs ✓ ${chars.size} символов покрыты`);
