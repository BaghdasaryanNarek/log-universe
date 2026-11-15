/**
 * Единственный источник чисел на сайте.
 * В переводах стоят плейсхолдеры {f:id}; форматирование — по локали (i18n/format.ts).
 * У каждого числа есть ссылка на источник из sources.ts.
 */
export const PC = 3.0856775814913673e16; // м, IAU 2015 B2
export const LY = 9.4607304725808e15; // м, IAU (юлианский год × c)
export const AU = 1.495978707e11; // м, IAU 2012 B2

export type Fmt = 'sci1' | 'sci2' | 'sci0' | 'fix0' | 'fix1' | 'fix2' | 'fix3' | 'int' | 'mag';
export type Unit = 'm' | 'km' | 'none';

export interface Fact {
  v: number;
  fmt: Fmt;
  unit?: Unit;
  src: string[];
}

export const FACTS = {
  everest: { v: 8848.86, fmt: 'int', unit: 'm', src: ['everest2020'] },
  karman: { v: 1e5, fmt: 'sci0', unit: 'm', src: ['fai-karman'] },
  earthDiam: { v: 1.2742e7, fmt: 'sci2', unit: 'm', src: ['nssdc-earth'] },
  moonDist: { v: 3.844e8, fmt: 'sci2', unit: 'm', src: ['nssdc-moon'] },
  au: { v: AU, fmt: 'sci2', unit: 'm', src: ['iau2012'] },
  neptuneOrbit: { v: 30.07 * AU, fmt: 'sci1', unit: 'm', src: ['nssdc-neptune'] },
  ly: { v: LY, fmt: 'sci2', unit: 'm', src: ['iau-units'] },
  proxima: { v: 1.3020 * PC, fmt: 'sci1', unit: 'm', src: ['gaia-dr3', 'simbad'] },
  proximaLy: { v: (1.3020 * PC) / LY, fmt: 'fix1', unit: 'none', src: ['gaia-dr3'] },
  pogsonStep: { v: Math.pow(100, 1 / 5), fmt: 'fix3', unit: 'none', src: ['pogson1856'] },
  pogsonYear: { v: 1856, fmt: 'int', unit: 'none', src: ['pogson1856'] },
  universeDiam: { v: 8.8e26, fmt: 'sci1', unit: 'm', src: ['wiki-observable'] },
} as const satisfies Record<string, Fact>;

export type FactId = keyof typeof FACTS;

/** Видимые звёздные величины V для инструмента «Сравни яркость». */
export interface MagObject { id: string; m: number; src: string[]; approx?: boolean }
export const MAG_OBJECTS: MagObject[] = [
  { id: 'sun', m: -26.74, src: ['nssdc-sun'] },
  { id: 'moon', m: -12.74, src: ['nssdc-moon'] },
  { id: 'venus', m: -4.8, src: ['nssdc-venus'] },
  { id: 'sirius', m: -1.46, src: ['simbad'] },
  { id: 'vega', m: 0.03, src: ['simbad'] },
  { id: 'polaris', m: 1.98, src: ['simbad'] },
  { id: 'eye', m: 6.0, src: ['naked-eye'], approx: true },
  { id: 'proxima', m: 11.13, src: ['simbad'] },
  { id: 'xdf', m: 31, src: ['esa-xdf'], approx: true },
];

/** Абсолютная величина Солнца M_V (IAU 2015 B3 / NSSDC). */
export const SUN_ABS_MAG = 4.83;
