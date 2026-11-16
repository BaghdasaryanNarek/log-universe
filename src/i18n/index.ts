import hy from './hy.json';
import ru from './ru.json';
import en from './en.json';
import { fmtFact, type Lang } from './format.ts';
import { FACTS, type FactId } from '../content/facts.ts';

export type { Lang };
type Dict = Record<string, string>;
const DICTS: Record<Lang, Dict> = { hy, ru, en };
export const LANGS: Lang[] = ['hy', 'ru', 'en'];
const STORE_KEY = 'log-cosmos.lang';

function readStored(): Lang | null {
  try {
    const v = localStorage.getItem(STORE_KEY);
    return v === 'hy' || v === 'ru' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

let current: Lang = readStored() ?? 'hy';
const listeners = new Set<(l: Lang) => void>();

export const lang = () => current;

export function t(key: string, params: Record<string, string | number> = {}): string {
  const raw = DICTS[current][key] ?? DICTS.ru[key] ?? key;
  return raw
    .replace(/\{f:([a-zA-Z0-9]+)\}/g, (_, id: string) =>
      id in FACTS ? fmtFact(id as FactId, current, (u) => t(`unit.${u}`)) : `{f:${id}}`)
    .replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** То же, что t(), но числа-факты оборачиваются в <span class="num" data-log>. */
export function tHtml(key: string, params: Record<string, string | number> = {}): string {
  const raw = DICTS[current][key] ?? DICTS.ru[key] ?? key;
  const parts = raw.split(/(\{f:[a-zA-Z0-9]+\})/g);
  return parts
    .map((p) => {
      const m = /^\{f:([a-zA-Z0-9]+)\}$/.exec(p);
      if (m && m[1] in FACTS) {
        const id = m[1] as FactId;
        const f = FACTS[id] as { v: number; unit?: string };
        const txt = fmtFact(id, current, (u) => t(`unit.${u}`));
        const log = f.unit === 'm' ? ` data-log="${Math.log10(f.v).toFixed(2)}"` : '';
        return `<span class="num"${log}>${esc(txt)}</span>`;
      }
      return esc(p).replace(/\{(\w+)\}/g, (mm, k: string) => (k in params ? esc(String(params[k])) : mm));
    })
    .join('');
}

export function setLang(l: Lang): void {
  if (l === current) return;
  current = l;
  try { localStorage.setItem(STORE_KEY, l); } catch { /* приватный режим — не страшно */ }
  applyDocument();
  listeners.forEach((fn) => fn(l));
}

export const onLang = (fn: (l: Lang) => void) => { listeners.add(fn); return () => listeners.delete(fn); };

/** Обновляет <html lang>, <title>, статические узлы с data-i18n*. */
export function applyDocument(root: ParentNode = document): void {
  document.documentElement.lang = current;
  document.title = t('meta.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n!); });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria!)));
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => el.setAttribute('title', t(el.dataset.i18nTitle!)));
}
