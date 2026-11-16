import { FACTS, type FactId } from './facts.ts';

export type FormulaId = 'logprod' | 'tsiolkovsky' | 'kepler' | 'pogson' | 'distmod' | 'fechner' | 'spiral' | 'leavitt';

/**
 * Бит — остановка на пути. p — положение на прокрутке в «делениях»:
 * до 27 это и есть n = log₁₀(d / 1 м); после 27 шкала кончается и идут финальные разделы
 * (карта, линейка, источники) — n остаётся 27.
 */
export interface Beat {
  id: string;
  /** номер сцены для клавиш 1–9 (0 — без своей клавиши) */
  scene: number;
  p: number;
  win: [number, number];
  kind: 'hero' | 'text' | 'sources';
  lines: string[];
  kicker?: string;
  formula?: FormulaId;
  /** индекс строки, перед которой стоит формула (по умолчанию после третьей) */
  formulaAt?: number;
  note?: string;
  tool?: 'compare' | 'kepler' | 'rule' | 'octaves';
  /** вставка поверх сцены, привязанная к визуализации (оси Г–Р, QR) */
  extra?: 'hr' | 'qr';
  /** архивное изображение: миниатюра в текстовой колонке + раскрытие по запросу */
  artifact?: 'napier' | 'var';
  align?: 'left' | 'wide';
}

export const BEATS: Beat[] = [
  { id: 'hero', scene: 1, p: 0, win: [-1, 0.75], kind: 'hero', lines: ['hero.l1', 'hero.l2', 'hero.l3'] },
  {
    id: 'napier', scene: 2, p: 1.6, win: [1.05, 2.3], kind: 'text', kicker: 'napier.kicker',
    lines: ['napier.l1', 'napier.l2', 'napier.l3', 'napier.l4'], formula: 'logprod', formulaAt: 2, artifact: 'napier',
  },
  {
    id: 'orbit', scene: 3, p: 5.65, win: [5.2, 6.25], kind: 'text', kicker: 'orbit.kicker',
    lines: ['orbit.l1', 'orbit.l2', 'orbit.l3', 'orbit.l4'], formula: 'tsiolkovsky', formulaAt: 2,
  },
  {
    id: 'moon', scene: 0, p: 8.9, win: [8.45, 9.4], kind: 'text', kicker: 'moon.kicker',
    lines: ['moon.l1', 'moon.l2', 'moon.l3'],
  },
  {
    id: 'au', scene: 4, p: 11.6, win: [11.2, 12.02], kind: 'text', kicker: 'au.kicker',
    lines: ['au.l1', 'au.l2', 'au.l3'],
  },
  {
    id: 'kepler', scene: 0, p: 12.5, win: [12.02, 12.75], kind: 'text', kicker: 'kepler.kicker',
    lines: ['kepler.l1', 'kepler.l2', 'kepler.l3'], formula: 'kepler', formulaAt: 1,
  },
  {
    id: 'keplerTool', scene: 0, p: 12.95, win: [12.75, 13.4], kind: 'text', kicker: 'keplerTool.kicker',
    lines: ['keplerTool.l1'], tool: 'kepler', align: 'wide',
  },
  {
    id: 'pogson', scene: 5, p: 16.8, win: [16.15, 17.03], kind: 'text', kicker: 'pogson.kicker',
    lines: ['pogson.l1', 'pogson.l2', 'pogson.l3', 'pogson.l4'], formula: 'pogson', note: 'pogson.note',
  },
  {
    id: 'compare', scene: 0, p: 17.25, win: [17.03, 17.5], kind: 'text', kicker: 'compare.kicker',
    lines: ['compare.l1'], tool: 'compare', align: 'wide',
  },
  {
    id: 'hr', scene: 0, p: 17.8, win: [17.5, 18.12], kind: 'text', kicker: 'hr.kicker',
    lines: ['hr.l1', 'hr.l2', 'hr.l3'], formula: 'distmod', formulaAt: 2, note: 'hr.note', extra: 'hr',
  },
  {
    id: 'weber', scene: 0, p: 18.45, win: [18.12, 18.85], kind: 'text', kicker: 'weber.kicker',
    lines: ['weber.l1', 'weber.l2', 'weber.l3'], formula: 'fechner', formulaAt: 2, note: 'weber.note', tool: 'octaves',
  },
  {
    id: 'milkyway', scene: 6, p: 21.3, win: [20.75, 21.62], kind: 'text', kicker: 'mw.kicker',
    lines: ['mw.l1', 'mw.l2', 'mw.l3', 'mw.l4'], formula: 'spiral', formulaAt: 2,
  },
  {
    id: 'andromeda', scene: 7, p: 21.95, win: [21.62, 22.5], kind: 'text', kicker: 'm31.kicker',
    lines: ['m31.l1', 'm31.l2', 'm31.l3', 'm31.l4'], formula: 'leavitt', formulaAt: 2, artifact: 'var',
  },
  {
    id: 'universe', scene: 8, p: 26.8, win: [26.3, 27.25], kind: 'text', kicker: 'uni.kicker',
    lines: ['uni.l1', 'uni.l2', 'uni.l3'],
  },
  {
    id: 'map', scene: 0, p: 27.9, win: [27.6, 28.4], kind: 'text', kicker: 'map.kicker',
    lines: ['map.l1', 'map.l2'], note: 'map.note',
  },
  {
    id: 'rule', scene: 9, p: 28.8, win: [28.4, 29.2], kind: 'text', kicker: 'rule.kicker',
    lines: ['rule.l1', 'rule.l2', 'rule.l3', 'rule.l4'], tool: 'rule', align: 'wide',
  },
  { id: 'sources', scene: 0, p: 29.6, win: [29.2, 31], kind: 'sources', lines: [], extra: 'qr' },
];

/** Конец прокрутки в «делениях»: 27 декад шкалы + финальные разделы. */
export const P_MAX = 30;

/** Маргиналии — подписи на шкале между остановками. */
export interface Marginal { n: number; label: string; fact: FactId }
const at = (id: FactId) => Math.log10(FACTS[id].v);
export const MARGINALIA: Marginal[] = [
  { n: at('everest'), label: 'marg.everest', fact: 'everest' },
  { n: at('earthDiam'), label: 'marg.earth', fact: 'earthDiam' },
  { n: at('neptuneOrbit'), label: 'marg.neptune', fact: 'neptuneOrbit' },
  { n: at('voyager'), label: 'marg.voyager', fact: 'voyager' },
  { n: at('ly'), label: 'marg.ly', fact: 'ly' },
  { n: at('sunGc'), label: 'marg.sunGc', fact: 'sunGc' },
  { n: at('virgo'), label: 'marg.virgo', fact: 'virgo' },
  { n: at('laniakea'), label: 'marg.laniakea', fact: 'laniakea' },
];

export const N_MAX = 27;
