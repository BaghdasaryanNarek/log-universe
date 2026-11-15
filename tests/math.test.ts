import { describe, expect, it } from 'vitest';
import { AU, FACTS, LY, MAG_OBJECTS, PC, SUN_ABS_MAG } from '../src/content/facts.ts';
import { fmtSci, fmtNum, fmtMag } from '../src/i18n/format.ts';
import { gmst, julianDate, observerFrame, toAltAz } from '../src/gl/astro.ts';

const mag = (id: string) => MAG_OBJECTS.find((o) => o.id === id)!.m;

describe('Погсон', () => {
  it('пять величин — ровно ×100, шаг ≈ 2,512', () => {
    expect(Math.pow(10, 0.4 * 5)).toBeCloseTo(100, 12);
    expect(FACTS.pogsonStep.v).toBeCloseTo(2.51189, 5);
  });
  it('Солнце ярче полной Луны ≈ в 400 000 раз (текст и инструмент)', () => {
    const ratio = Math.pow(10, 0.4 * (mag('moon') - mag('sun')));
    expect(ratio).toBeGreaterThan(3.9e5);
    expect(ratio).toBeLessThan(4.1e5);
  });
  it('предел глаза → XDF: 25 величин = 10 порядков (ESA: «в 10 млрд раз»)', () => {
    expect(0.4 * (mag('xdf') - mag('eye'))).toBeCloseTo(10, 6);
  });
});

describe('модуль расстояния', () => {
  it('Солнце с 1 а.е. — −26,74ᵐ', () => {
    const m = SUN_ABS_MAG + 5 * Math.log10(AU / PC / 10);
    expect(m).toBeCloseTo(-26.74, 1);
  });
});

describe('масштабы', () => {
  it('Проксима: 4,0·10¹⁶ м и 4,2 св. года', () => {
    expect(FACTS.proxima.v / 1e16).toBeCloseTo(4.0, 1);
    expect(FACTS.proxima.v / LY).toBeCloseTo(4.2465, 2);
  });
  it('световой год, а.е., диаметр Земли, Луна', () => {
    expect(LY).toBeCloseTo(9.4607e15, -11);
    expect(AU).toBe(149597870700);
    expect(Math.log10(FACTS.moonDist.v)).toBeCloseTo(8.585, 3);
  });
  it('ширина кадра = расстоянию: FOV = 2·arctg(1/2) ≈ 53,13°', () => {
    expect((2 * Math.atan(0.5) * 180) / Math.PI).toBeCloseTo(53.13, 2);
  });
});

describe('форматирование', () => {
  it('научная запись по локали', () => {
    expect(fmtSci(4.0175e16, 'ru', 1)).toBe('4,0·10¹⁶');
    expect(fmtSci(4.0175e16, 'en', 1)).toBe('4.0 × 10¹⁶');
    expect(fmtSci(9.96e16, 'ru', 1)).toBe('1,0·10¹⁷');
    expect(fmtSci(1e5, 'ru', 0)).toBe('10⁵');
  });
  it('типографский минус и знак величин', () => {
    expect(fmtMag(-26.74, 'ru')).toBe('−26,74');
    expect(fmtMag(1.98, 'en')).toBe('+1.98');
    expect(fmtNum(-1.5, 'ru', 1)).toBe('−1,5');
  });
});

describe('астрономия', () => {
  it('GMST на J2000.0 = 280,46°', () => {
    expect((gmst(2451545.0) * 180) / Math.PI).toBeCloseTo(280.4606, 3);
  });
  it('Полярная из Еревана — на высоте ≈ широты (40,2°)', () => {
    const f = observerFrame(new Date(Date.UTC(2026, 10, 15, 18)));
    // Полярная: RA 2h31m49s, Dec +89°15′51″
    const ra = ((2 + 31 / 60 + 49 / 3600) * 15 * Math.PI) / 180, dec = ((89 + 15 / 60 + 51 / 3600) * Math.PI) / 180;
    const d: [number, number, number] = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
    expect(Math.abs(toAltAz(f, d).alt - 40.18)).toBeLessThan(0.8);
    expect(julianDate(new Date(Date.UTC(2000, 0, 1, 12)))).toBe(2451545);
  });
});
