import { FACTS, type FactId } from './facts.ts';

/** Бит — остановка на лог-пути: текст + (опционально) формула и инструмент. */
export interface Beat {
  id: string;
  /** номер сцены для клавиш 1–9 */
  scene: number;
  /** положение на шкале, n = log10(d / 1 м) */
  n: number;
  /** окно, в котором показан текст */
  win: [number, number];
  kind: 'hero' | 'text';
  lines: string[];
  kicker?: string;
  formula?: 'pogson';
  tool?: 'compare';
}

export const BEATS: Beat[] = [
  { id: 'hero', scene: 1, n: 0, win: [-1, 0.85], kind: 'hero', lines: ['hero.l1', 'hero.l2', 'hero.l3'] },
  {
    id: 'pogson', scene: 5, n: 16.8, win: [16.15, 17.03], kind: 'text', kicker: 'pogson.kicker',
    lines: ['pogson.l1', 'pogson.l2', 'pogson.l3', 'pogson.l4'], formula: 'pogson',
  },
  {
    id: 'compare', scene: 0, n: 17.25, win: [17.03, 17.7], kind: 'text', kicker: 'compare.kicker',
    lines: ['compare.l1'], tool: 'compare',
  },
];

/** Маргиналии — подписи на шкале между остановками. */
export interface Marginal { n: number; label: string; fact: FactId }
const at = (id: FactId) => Math.log10(FACTS[id].v);
export const MARGINALIA: Marginal[] = [
  { n: at('everest'), label: 'marg.everest', fact: 'everest' },
  { n: at('karman'), label: 'marg.karman', fact: 'karman' },
  { n: at('earthDiam'), label: 'marg.earth', fact: 'earthDiam' },
  { n: at('moonDist'), label: 'marg.moon', fact: 'moonDist' },
  { n: at('au'), label: 'marg.au', fact: 'au' },
  { n: at('neptuneOrbit'), label: 'marg.neptune', fact: 'neptuneOrbit' },
  { n: at('ly'), label: 'marg.ly', fact: 'ly' },
  { n: at('universeDiam'), label: 'marg.universe', fact: 'universeDiam' },
];

export const N_MIN = 0;
export const N_MAX = 27;
