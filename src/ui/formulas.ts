import katex from 'katex';
import { lang } from '../i18n/index.ts';

/** Десятичный разделитель для TeX: «2{,}5» в hy/ru, «2.5» в en. */
export const texNum = (s: string) => (lang() === 'en' ? s : s.replace('.', '{,}'));

export function tex(src: string, display = true): string {
  return katex.renderToString(src, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' });
}

export const FORMULAS = {
  pogson: () => tex(`m_1 - m_2 = -${texNum('2.5')}\\,\\log_{10}\\dfrac{F_1}{F_2}`),
};
