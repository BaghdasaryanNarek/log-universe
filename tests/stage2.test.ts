import { describe, expect, it } from 'vitest';
import { AU, FACTS, PLANETS } from '../src/content/facts.ts';
import { elementsAt, planetPos } from '../src/scenes/solar/ephemeris.ts';
import { earthHelio, moonGeo } from '../src/gl/astro.ts';

const len = (v: number[]) => Math.hypot(v[0], v[1], v[2]);

describe('Циолковский и орбита', () => {
  it('орбитальная скорость на 400 км ≈ 7,7 км/с', () => expect(FACTS.vOrbit.v).toBeCloseTo(7.67, 1));
  it('доля топлива при Δv 9,4 и vₑ 4,4 км/с ≈ 88 %', () => expect(Math.round(FACTS.fuelPct.v)).toBe(88));
  it('удвоить Δv = возвести отношение масс в квадрат', () => {
    const R = 5;
    expect(Math.log(R * R)).toBeCloseTo(2 * Math.log(R), 12);
  });
});

describe('свет и время', () => {
  it('до Луны свет идёт 1,28 с', () => expect(FACTS.moonLight.v).toBeCloseTo(1.282, 3));
  it('от Солнца — 8 мин 19 с', () => { expect(FACTS.sunLightMin.v).toBe(8); expect(FACTS.sunLightSec.v).toBe(19); });
  it('линейная прокрутка: ≈ 2,8·10¹⁶ лет, ≈ 2·10⁶ возрастов Вселенной', () => {
    expect(FACTS.scrollYears.v / 1e16).toBeCloseTo(2.79, 1);
    expect(FACTS.scrollVsAge.v / 1e6).toBeCloseTo(2.0, 1);
  });
});

describe('спираль и Непер', () => {
  it('b = tg 13° ≈ 0,23', () => expect(FACTS.tanPitch.v).toBeCloseTo(0.2309, 4));
  it('логарифм Непера синуса 30° = 10⁷·ln 2', () => {
    const L = Math.round(1e7 * Math.log(1e7 / 5e6));
    expect(L).toBe(6931472);
  });
});

describe('эфемериды (JPL, Standish)', () => {
  const d = new Date(Date.UTC(2026, 10, 15, 18));
  it('Земля в ≈ 1 а.е. от Солнца, совпадает с формулой для Солнца', () => {
    const e = planetPos(elementsAt('earth', d));
    expect(len(e) / AU).toBeGreaterThan(0.983);
    expect(len(e) / AU).toBeLessThan(1.017);
    const e2 = earthHelio(d);
    const cos = (e[0] * e2[0] + e[1] * e2[1] + e[2] * e2[2]) / (len(e) * len(e2));
    expect(Math.acos(Math.min(1, cos)) * (180 / Math.PI)).toBeLessThan(0.1);
  });
  it('Юпитер — между перигелием и афелием', () => {
    const r = len(planetPos(elementsAt('jupiter', d))) / AU;
    expect(r).toBeGreaterThan(4.95);
    expect(r).toBeLessThan(5.46);
  });
  it('третий закон Кеплера для всех планет: T² ≈ a³ (лучше 1 %)', () => {
    for (const p of PLANETS) expect(Math.abs(p.T ** 2 / p.el[0] ** 3 - 1)).toBeLessThan(0.01);
  });
  it('Луна — 356…407 тыс. км от Земли', () => {
    const r = len(moonGeo(d)) / 1000;
    expect(r).toBeGreaterThan(356000);
    expect(r).toBeLessThan(407000);
  });
});
