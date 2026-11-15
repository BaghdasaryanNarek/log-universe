import { add, cross, DEG, lerp, lerp3, mul, norm, slerp, smoother, sub, dot, type V3 } from '../core/vec.ts';
import { altAzDir, toAltAz, type ObserverFrame } from './astro.ts';

/**
 * Камера — чистая функция от n. Ключи задают направление взгляда V, «верх» up,
 * фокус (якорь в мировых координатах) и положение фокуса на экране (sx, sy)
 * в долях ширины кадра. Расстояние камеры до фокуса всегда d = 10^n м,
 * а горизонтальный FOV = 2·arctg(1/2) ≈ 53,13°, поэтому ширина кадра на дистанции фокуса тоже равна d.
 */
export const HFOV = 2 * Math.atan(0.5);

interface Key { n: number; focus: V3; V: V3; up: V3; sx: number; sy: number }

export interface CamPose { cam: V3; V: V3; U: V3; R: V3; focus: V3; d: number }

export interface RigInput {
  frame: ObserverFrame;
  telescope: V3;
  mizarDir: V3;
  alphaCen: V3;
}

export function createRig({ frame, telescope, mizarDir, alphaCen }: RigInput) {
  const sun: V3 = [0, 0, 0];
  const mz = toAltAz(frame, mizarDir);
  const az = mz.az - 9;
  const heroAlt = Math.min(24, Math.max(7, mz.alt * 0.6 + 4));
  const vHero = altAzDir(frame, az, heroAlt);
  const vLevel = altAzDir(frame, az, 3);
  const vDown = altAzDir(frame, az, -52);
  const upDown = altAzDir(frame, az, 38);

  // Вид на окрестности Солнца: смотрим почти на α Центавра, чтобы Солнце и α Cen
  // оказались в кадре рядом (угол β от направления на α Cen).
  const A = norm(alphaCen);
  let Q = norm(cross(A, [0, 0, 1]));
  const beta = 26 * DEG;
  const pick = (q: V3) => norm(add(mul(A, Math.cos(beta)), mul(q, Math.sin(beta))));
  let vPog = pick(Q);
  {
    // α Cen должна быть правее Солнца: левая половина кадра занята текстом
    const up = norm(sub([0, 0, 1], mul(vPog, dot([0, 0, 1], vPog))));
    const R = norm(cross(vPog, up));
    if (dot(sub(alphaCen, sun), R) < 0) { Q = mul(Q, -1); vPog = pick(Q); }
  }
  const upPog = norm(sub([0, 0, 1], mul(vPog, dot([0, 0, 1], vPog))));

  const keys: Key[] = [
    { n: 0, focus: telescope, V: vHero, up: frame.zenith, sx: 0.17, sy: -0.16 },
    { n: 3, focus: telescope, V: vLevel, up: frame.zenith, sx: 0.12, sy: -0.2 },
    { n: 7.5, focus: telescope, V: vDown, up: upDown, sx: 0.1, sy: 0 },
    { n: 10.4, focus: telescope, V: vDown, up: upDown, sx: 0.1, sy: 0 },
    { n: 13.4, focus: sun, V: vPog, up: upPog, sx: 0.07, sy: 0.04 },
    { n: 27, focus: sun, V: vPog, up: upPog, sx: 0.07, sy: 0.04 },
  ];

  return function pose(n: number): CamPose {
    let i = 0;
    while (i < keys.length - 2 && n > keys[i + 1].n) i++;
    const a = keys[i], b = keys[i + 1];
    const t = smoother((n - a.n) / (b.n - a.n));
    const V = slerp(a.V, b.V, t);
    const upRaw = slerp(a.up, b.up, t);
    const R = norm(cross(V, upRaw));
    const U = cross(R, V);
    const focus = lerp3(a.focus, b.focus, t);
    const sx = lerp(a.sx, b.sx, t), sy = lerp(a.sy, b.sy, t);
    const d = Math.pow(10, n);
    const cam = sub(sub(focus, mul(V, d)), mul(add(mul(R, sx), mul(U, sy)), d));
    return { cam, V, U, R, focus, d };
  };
}
