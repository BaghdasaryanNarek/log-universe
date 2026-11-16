import { FACTS, type FactId, type Fmt } from '../content/facts.ts';

export type Lang = 'hy' | 'ru' | 'en';
export const LOCALES: Record<Lang, string> = { hy: 'hy-AM', ru: 'ru-RU', en: 'en-GB' };

/**
 * Не во всех сборках Chromium есть данные ICU для hy. Разделители в армянской норме CLDR
 * те же, что в русской (десятичная запятая, неразрывный пробел между группами),
 * поэтому при отсутствии hy числа форматируем по ru-RU — результат идентичен.
 */
const HY_OK = (() => { try { return Intl.NumberFormat.supportedLocalesOf(['hy-AM']).length > 0 && new Intl.NumberFormat('hy-AM').format(1.5) === '1,5'; } catch { return false; } })();
const numLocale = (l: Lang) => (l === 'hy' && !HY_OK ? 'ru-RU' : LOCALES[l]);
const HY_MONTHS = ['հունվարի', 'փետրվարի', 'մարտի', 'ապրիլի', 'մայիսի', 'հունիսի', 'հուլիսի', 'օգոստոսի', 'սեպտեմբերի', 'հոկտեմբերի', 'նոյեմբերի', 'դեկտեմբերի'];

const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '−': '⁻',
};
export const sup = (n: number | string) => String(n).replace(/[0-9\-−]/g, (c) => SUP[c] ?? c);

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(lang: Lang, min: number, max: number, group = true): Intl.NumberFormat {
  const k = `${lang}|${min}|${max}|${group}`;
  let f = nfCache.get(k);
  if (!f) {
    f = new Intl.NumberFormat(numLocale(lang), { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: group });
    nfCache.set(k, f);
  }
  return f;
}

/** Типографский минус вместо дефиса. */
const minus = (s: string) => s.replace(/^-|(?<=\s)-/g, '−').replace(/-(?=\d)/g, '−');

export function fmtNum(v: number, lang: Lang, digits = 0, group = true): string {
  return minus(nf(lang, digits, digits, group).format(v));
}

/** Научная запись: «4,0·10¹⁶» (hy/ru) или «4.0 × 10¹⁶» (en). */
export function fmtSci(v: number, lang: Lang, digits = 1): string {
  if (v === 0) return '0';
  let e = Math.floor(Math.log10(Math.abs(v)));
  let mant = v / Math.pow(10, e);
  const r = Number(mant.toFixed(digits));
  if (Math.abs(r) >= 10) { e += 1; mant = v / Math.pow(10, e); }
  const pow = `10${sup(e)}`;
  if (digits === 0 && Math.abs(Number(mant.toFixed(0))) === 1) return mant < 0 ? `−${pow}` : pow;
  const m = fmtNum(mant, lang, digits);
  return lang === 'en' ? `${m} × ${pow}` : `${m}·${pow}`;
}

export function fmtByFmt(v: number, fmt: Fmt, lang: Lang): string {
  switch (fmt) {
    case 'sci0': return fmtSci(v, lang, 0);
    case 'sci1': return fmtSci(v, lang, 1);
    case 'sci2': return fmtSci(v, lang, 2);
    case 'fix0': return fmtNum(v, lang, 0);
    case 'fix1': return fmtNum(v, lang, 1);
    case 'fix2': return fmtNum(v, lang, 2);
    case 'fix3': return fmtNum(v, lang, 3);
    // четырёхзначные числа (годы, 8849) не разбиваем на группы — типографское правило
    case 'int': return fmtNum(Math.round(v), lang, 0, Math.abs(v) >= 10000);
    case 'mag': return fmtMag(v, lang);
  }
}

/** Звёздная величина со знаком: «−26,74», «+6,0». */
export function fmtMag(m: number, lang: Lang, digits = 2): string {
  const s = fmtNum(Math.abs(m), lang, digits);
  return (m < 0 ? '−' : m > 0 ? '+' : '') + s;
}

export function fmtFact(id: FactId, lang: Lang, unitLabel: (u: string) => string): string {
  const f = FACTS[id] as { v: number; fmt: Fmt; unit?: string };
  const num = fmtByFmt(f.v, f.fmt, lang);
  return f.unit && f.unit !== 'none' ? `${num} ${unitLabel(f.unit)}` : num;
}

export function fmtDate(d: Date, lang: Lang): string {
  // армянская норма: «15 նոյեմբերի, 2026 թ.» (дата в Ереване, UTC+4)
  if (lang === 'hy') { const y = new Date(d.getTime() + 4 * 3600e3); return `${y.getUTCDate()} ${HY_MONTHS[y.getUTCMonth()]}, ${y.getUTCFullYear()} թ.`; }
  return new Intl.DateTimeFormat(LOCALES[lang], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Yerevan' }).format(d);
}
