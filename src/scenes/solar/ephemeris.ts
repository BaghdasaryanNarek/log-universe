import { AU, PLANETS } from '../../content/facts.ts';
import { DEG, type V3 } from '../../core/vec.ts';
import { julianDate } from '../../gl/astro.ts';

const EPS = 23.43928 * DEG;

/** Эклиптика J2000 → экваториальные координаты. */
const eclToEq = (x: number, y: number, z: number): V3 => [x, y * Math.cos(EPS) - z * Math.sin(EPS), y * Math.sin(EPS) + z * Math.cos(EPS)];

function solveKepler(M: number, e: number): number {
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 12; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}

export interface Orbit { a: number; e: number; I: number; L: number; w: number; O: number }

/** Элементы на дату по табл. 1 Standish (JPL). */
export function elementsAt(id: (typeof PLANETS)[number]['id'], date: Date): Orbit {
  const p = PLANETS.find((x) => x.id === id)!;
  const T = (julianDate(date) - 2451545.0) / 36525;
  const [a, e, I, L, w, O] = p.el.map((v, i) => v + p.rate[i] * T);
  return { a, e, I: I * DEG, L: L * DEG, w: w * DEG, O: O * DEG };
}

/** Гелиоцентрическое положение (м, экваториальные) при эксцентрической аномалии E. */
export function posAtE(o: Orbit, E: number): V3 {
  const xp = o.a * (Math.cos(E) - o.e), yp = o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E);
  const w = o.w - o.O; // аргумент перигелия
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(o.O), sO = Math.sin(o.O), cI = Math.cos(o.I), sI = Math.sin(o.I);
  const x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  const y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  const z = sw * sI * xp + cw * sI * yp;
  return eclToEq(x * AU, y * AU, z * AU);
}

export function planetPos(o: Orbit): V3 {
  let M = o.L - o.w;
  M = ((M + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return posAtE(o, solveKepler(M, o.e));
}

export function orbitPoints(o: Orbit, n = 360): V3[] {
  return Array.from({ length: n + 1 }, (_, i) => posAtE(o, (i / n) * 2 * Math.PI));
}
