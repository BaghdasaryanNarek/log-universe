/**
 * Единственный источник чисел на сайте.
 * В переводах стоят плейсхолдеры {f:id}; форматирование — по локали (i18n/format.ts).
 * У каждого числа есть ссылка на источник из sources.ts. Проверки — tests/math.test.ts.
 */
export const PC = 3.0856775814913673e16; // м, IAU 2015 B2
export const LY = 9.4607304725808e15; // м, IAU (юлианский год × c)
export const AU = 1.495978707e11; // м, IAU 2012 B2
export const C_LIGHT = 299792458; // м/с, точно
export const KPC = 1e3 * PC;
export const MPC = 1e6 * PC;

export type Fmt = 'sci1' | 'sci2' | 'sci0' | 'fix0' | 'fix1' | 'fix2' | 'fix3' | 'int' | 'mag';
export type Unit = 'm' | 'km' | 'kms' | 'none';

export interface Fact {
  v: number;
  fmt: Fmt;
  unit?: Unit;
  src: string[];
}

// ракетная оценка (Циолковский): идеальная одноступенчатая ракета до низкой орбиты
const DV_LEO = 9.4; // км/с, с учётом гравитационных и аэродинамических потерь (типичная оценка)
const VE_H2O2 = 4.4; // км/с, водород-кислород в вакууме (удельный импульс ≈ 450 с)
const UNI_D = 8.8e26;

export const FACTS = {
  everest: { v: 8848.86, fmt: 'int', unit: 'm', src: ['everest2020'] },
  karman: { v: 1e5, fmt: 'sci0', unit: 'm', src: ['fai-karman'] },
  issAlt: { v: 400, fmt: 'int', unit: 'km', src: ['nasa-iss'] },
  vOrbit: { v: Math.sqrt(3.986004418e14 / (6.371e6 + 4e5)) / 1000, fmt: 'fix1', unit: 'kms', src: ['nssdc-earth'] },
  dvLeo: { v: DV_LEO, fmt: 'fix1', unit: 'kms', src: ['tsiolkovsky1903', 'dv-leo'] },
  ve: { v: VE_H2O2, fmt: 'fix1', unit: 'kms', src: ['dv-leo'] },
  fuelPct: { v: 100 * (1 - Math.exp(-DV_LEO / VE_H2O2)), fmt: 'int', unit: 'none', src: ['tsiolkovsky1903'] },
  earthDiam: { v: 1.2742e7, fmt: 'sci2', unit: 'm', src: ['nssdc-earth'] },
  moonDist: { v: 3.844e8, fmt: 'sci2', unit: 'm', src: ['nssdc-moon'] },
  moonLight: { v: 3.844e8 / C_LIGHT, fmt: 'fix2', unit: 'none', src: ['nssdc-moon'] },
  au: { v: AU, fmt: 'sci2', unit: 'm', src: ['iau2012'] },
  sunLightMin: { v: Math.floor(AU / C_LIGHT / 60), fmt: 'int', unit: 'none', src: ['iau2012'] },
  sunLightSec: { v: Math.round(AU / C_LIGHT - 60 * Math.floor(AU / C_LIGHT / 60)), fmt: 'int', unit: 'none', src: ['iau2012'] },
  neptuneOrbit: { v: 30.07 * AU, fmt: 'sci1', unit: 'm', src: ['nssdc-neptune'] },
  voyager: { v: 171 * AU, fmt: 'sci1', unit: 'm', src: ['jpl-voyager'] },
  ly: { v: LY, fmt: 'sci2', unit: 'm', src: ['iau-units'] },
  proxima: { v: 1.3020 * PC, fmt: 'sci1', unit: 'm', src: ['gaia-dr3', 'simbad'] },
  proximaLy: { v: (1.3020 * PC) / LY, fmt: 'fix1', unit: 'none', src: ['gaia-dr3'] },
  pogsonStep: { v: Math.pow(100, 1 / 5), fmt: 'fix3', unit: 'none', src: ['pogson1856'] },
  pogsonYear: { v: 1856, fmt: 'int', unit: 'none', src: ['pogson1856'] },
  sunGc: { v: 8.2 * KPC, fmt: 'sci1', unit: 'm', src: ['gravity2019'] },
  mwDisk: { v: 1e5 * LY, fmt: 'sci0', unit: 'm', src: ['mw-size'] },
  pitch: { v: 13, fmt: 'int', unit: 'none', src: ['vallee2015'] },
  tanPitch: { v: Math.tan((13 * Math.PI) / 180), fmt: 'fix2', unit: 'none', src: ['vallee2015'] },
  m31: { v: 2.5e6 * LY, fmt: 'sci1', unit: 'm', src: ['m31-distance'] },
  v1Period: { v: 31.4, fmt: 'fix1', unit: 'none', src: ['hst-v1'] },
  virgo: { v: 16.5 * MPC, fmt: 'sci1', unit: 'm', src: ['virgo-mei2007'] },
  laniakea: { v: 160 * MPC, fmt: 'sci1', unit: 'm', src: ['tully2014'] },
  universeDiam: { v: UNI_D, fmt: 'sci1', unit: 'm', src: ['wiki-observable'] },
  /** лет, чтобы пролистать диаметр Вселенной при 1 пикс = 1 м и 1000 пикс/с */
  scrollYears: { v: UNI_D / 1000 / 3.15576e7, fmt: 'sci0', unit: 'none', src: ['wiki-observable'] },
  /** во сколько раз это дольше возраста Вселенной (13,8 млрд лет, Planck 2018) */
  scrollVsAge: { v: UNI_D / 1000 / 3.15576e7 / 13.8e9, fmt: 'sci0', unit: 'none', src: ['planck2018'] },
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

/** Абсолютная величина Солнца M_V (NSSDC Sun Fact Sheet). */
export const SUN_ABS_MAG = 4.83;

/**
 * Кеплеровы элементы планет на J2000 и их скорости за столетие
 * (E. M. Standish, JPL «Approximate Positions of the Planets», табл. 1, 1800–2050).
 * a [а.е.], e, I [°], L [°], ϖ [°], Ω [°]; затем производные за юлианское столетие.
 */
export const PLANETS = [
  { id: 'mercury', R: 2.4397e6, el: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593], rate: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081], color: '#b9aea0', T: 0.2408 },
  { id: 'venus', R: 6.0518e6, el: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255], rate: [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418], color: '#e8d2a6', T: 0.6152 },
  { id: 'earth', R: 6.371e6, el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0], color: '#7fb6e8', T: 1.0 },
  { id: 'mars', R: 3.3895e6, el: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891], rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343], color: '#d4805a', T: 1.8808 },
  { id: 'jupiter', R: 6.9911e7, el: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106], color: '#d9b48a', T: 11.862 },
  { id: 'saturn', R: 5.8232e7, el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], rate: [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794], color: '#e6cf98', T: 29.457 },
  { id: 'uranus', R: 2.5362e7, el: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503], rate: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589], color: '#9fd6dc', T: 84.011 },
  { id: 'neptune', R: 2.4622e7, el: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], rate: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664], color: '#6f93e0', T: 164.79 },
] as const;
