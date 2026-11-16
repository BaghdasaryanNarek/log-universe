import katex from 'katex';
import { lang } from '../i18n/index.ts';
import type { FormulaId } from '../content/scenes.ts';

/** Десятичный разделитель для TeX: «2{,}5» в hy/ru, «2.5» в en. */
export const texNum = (s: string) => (lang() === 'en' ? s : s.replace('.', '{,}'));

export function tex(src: string, display = true): string {
  return katex.renderToString(src, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' });
}

/** Подпись единиц внутри формулы (пк / pc / պկ) — шрифт подменяется на наш через CSS. */
const pc = () => ({ ru: 'пк', en: 'pc', hy: 'պկ' })[lang()];

export const FORMULAS: Record<FormulaId, () => string> = {
  logprod: () => tex('\\log(a\\cdot b) = \\log a + \\log b'),
  tsiolkovsky: () => tex('\\Delta v = v_e \\ln\\dfrac{m_0}{m_f}'),
  kepler: () => tex('T^2 = a^3 \\;\\Longrightarrow\\; \\log T = \\tfrac{3}{2}\\,\\log a'),
  pogson: () => tex(`m_1 - m_2 = -${texNum('2.5')}\\,\\log_{10}\\dfrac{F_1}{F_2}`),
  distmod: () => tex(`m - M = 5\\,\\log_{10}\\dfrac{d}{10\\ \\text{${pc()}}}`),
  fechner: () => tex('S = k\\,\\ln\\dfrac{I}{I_0}'),
  spiral: () => tex('r = a\\,e^{\\,b\\theta}'),
  leavitt: () => tex(`M = \\alpha\\,\\log_{10} P + \\beta, \\qquad m - M = 5\\,\\log_{10}\\dfrac{d}{10\\ \\text{${pc()}}}`),
};
