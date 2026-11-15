/**
 * Подмножества шрифтов → src/assets/fonts/*.woff2 (вариативные оси сохраняются).
 * Наборы символов заданы диапазонами и дополнительно включают все символы
 * из словарей i18n, поэтому новые строки не превратятся в «квадратики».
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import subsetFont from 'subset-font';

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i)).join('');

const LATIN = range(0x20, 0x7e) + range(0xa0, 0xff) + 'ıŒœˆ˚˜';
const CYR = range(0x400, 0x45f) + 'Ґґ';
const GREEK = range(0x391, 0x3c9);
const PUNCT = range(0x2010, 0x2027) + range(0x2030, 0x203a) + '⁄€№';
const SUPSUB = range(0x2070, 0x209f);
const MATH = '←↑→↓↔−∕∙√∞≈≠≤≥±×÷·′″°ℓ∅∑∂Δ∆';
const ARM = range(0x531, 0x58f) + range(0xfb13, 0xfb17) + '  ';

const dictChars = new Set<string>();
for (const f of readdirSync('src/i18n').filter((f) => f.endsWith('.json'))) {
  for (const ch of readFileSync(`src/i18n/${f}`, 'utf8')) dictChars.add(ch);
}
const DICT = [...dictChars].join('');

const jobs: { src: string; out: string; chars: string }[] = [
  { src: 'ebgaramond__EBGaramond_wght_.ttf', out: 'ebgaramond.woff2', chars: LATIN + CYR + GREEK + PUNCT + SUPSUB + MATH + DICT },
  { src: 'ebgaramond__EBGaramond-Italic_wght_.ttf', out: 'ebgaramond-italic.woff2', chars: LATIN + CYR + GREEK + PUNCT + SUPSUB + MATH + DICT },
  { src: 'notoserifarmenian__NotoSerifArmenian_wdth_wght_.ttf', out: 'noto-serif-armenian.woff2', chars: ARM },
  { src: 'notosansarmenian__NotoSansArmenian_wdth_wght_.ttf', out: 'noto-sans-armenian.woff2', chars: ARM },
  { src: 'ibmplexmono__IBMPlexMono-Regular.ttf', out: 'plexmono-400.woff2', chars: LATIN + CYR + PUNCT + SUPSUB + MATH + DICT },
  { src: 'ibmplexmono__IBMPlexMono-Medium.ttf', out: 'plexmono-500.woff2', chars: LATIN + CYR + PUNCT + SUPSUB + MATH + DICT },
];

mkdirSync('src/assets/fonts', { recursive: true });
for (const j of jobs) {
  const input = readFileSync(`assets-src/fonts/${j.src}`);
  const out = await subsetFont(input, j.chars, { targetFormat: 'woff2' });
  writeFileSync(`src/assets/fonts/${j.out}`, out);
  console.log(`${j.out}: ${(out.length / 1024).toFixed(1)} KB`);
}
