import { add, cross, DEG, dot, lerp, lerp3, mul, norm, slerp, smoother, sub, type V3 } from '../core/vec.ts';
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
  eye: V3;
  mizarDir: V3;
  alphaCen: V3;
  earth: V3;
  moon: V3;
  gc: V3;
  ngp: V3;
  m31: V3;
}

const ECL_N: V3 = [0, -Math.sin(23.4393 * DEG), Math.cos(23.4393 * DEG)];
/** часть вектора v, перпендикулярная единичному w */
const perp = (v: V3, w: V3): V3 => norm(sub(v, mul(w, dot(v, w))));

export function createRig(i: RigInput) {
  const { frame, eye, mizarDir, alphaCen, earth, moon, gc, ngp, m31 } = i;
  const sun: V3 = [0, 0, 0];
  const sunDir = norm(sub(sun, earth));
  const mz = toAltAz(frame, mizarDir);
  const az = mz.az - 9;
  const heroAlt = Math.min(24, Math.max(7, mz.alt * 0.6 + 4));

  // 1. у земли и подъём
  const vHero = altAzDir(frame, az, heroAlt);
  const vLevel = altAzDir(frame, az, 3);
  const vOrbit = altAzDir(frame, az, -16);
  const upOrbit = altAzDir(frame, az, 74);

  // 2. Земля целиком: камера над Ереваном, сдвинута к дневной стороне — виден терминатор
  const cEarth = norm(add(add(mul(frame.zenith, 0.62), mul(sunDir, 0.62)), mul(ECL_N, 0.25)));
  const vEarth = mul(cEarth, -1);
  const upEarth = perp(ECL_N, vEarth);

  // 3. Земля и Луна: смотрим поперёк линии Земля–Луна, с освещённой стороны
  const em = norm(sub(moon, earth));
  const cMoon = norm(add(add(mul(perp(sunDir, em), 0.45), mul(perp(ECL_N, em), 0.6)), mul(em, -0.62)));
  const vMoon = mul(cMoon, -1);
  const upMoon = perp(ECL_N, vMoon);

  // 4. Солнечная система: над плоскостью эклиптики под 55°
  const inPlane = perp(sub(earth, sun), ECL_N);
  const cSol = norm(add(mul(ECL_N, Math.cos(35 * DEG)), mul(inPlane, -Math.sin(35 * DEG))));
  const vSol = mul(cSol, -1);
  const upSol = perp(ECL_N, vSol);

  // 5. окрестности Солнца: почти на α Центавра, Солнце и α Cen рядом в кадре
  const A = norm(alphaCen);
  let Q = norm(cross(A, [0, 0, 1]));
  const beta = 26 * DEG;
  const pick = (q: V3) => norm(add(mul(A, Math.cos(beta)), mul(q, Math.sin(beta))));
  let vPog = pick(Q);
  {
    const up = perp([0, 0, 1], vPog);
    const R = norm(cross(vPog, up));
    if (dot(sub(alphaCen, sun), R) < 0) { Q = mul(Q, -1); vPog = pick(Q); }
  }
  const upPog = perp([0, 0, 1], vPog);

  // 6. Галактика: сверху от северного полюса Галактики под 38°, Солнце — внизу кадра
  const toSun = perp(sub(sun, gc), ngp);
  const cMw = norm(add(mul(ngp, Math.cos(38 * DEG)), mul(toSun, Math.sin(38 * DEG))));
  const vMw = mul(cMw, -1);
  const upMw = perp(mul(toSun, -1), vMw);

  // 7. Млечный Путь и Андромеда — смотрим поперёк линии между ними
  const sep = norm(sub(m31, gc));
  const mid = lerp3(gc, m31, 0.5);
  const cLg = norm(add(add(mul(perp(ngp, sep), 0.55), mul(norm(cross(sep, ngp)), 0.45)), mul(sep, -0.7)));
  const vLg = mul(cLg, -1);
  const upLg = perp(ngp, vLg);
  const vWeb = norm(add(vLg, mul(sep, 0.35)));

  const keys: Key[] = [
    { n: 0, focus: eye, V: vHero, up: frame.zenith, sx: 0.17, sy: -0.16 },
    { n: 3, focus: eye, V: vLevel, up: frame.zenith, sx: 0.12, sy: -0.2 },
    { n: 5.65, focus: eye, V: vOrbit, up: upOrbit, sx: 0.14, sy: 0.08 },
    { n: 7.4, focus: earth, V: vEarth, up: upEarth, sx: 0.16, sy: 0 },
    { n: 8.9, focus: lerp3(earth, moon, 0.5), V: vMoon, up: upMoon, sx: 0.22, sy: 0.02 },
    { n: 10.3, focus: lerp3(earth, moon, 0.5), V: vMoon, up: upMoon, sx: 0.22, sy: 0.02 },
    { n: 11.6, focus: sun, V: vSol, up: upSol, sx: 0.16, sy: 0.02 },
    { n: 12.5, focus: sun, V: vSol, up: upSol, sx: 0.2, sy: 0.02 },
    { n: 14.2, focus: sun, V: vPog, up: upPog, sx: 0.07, sy: 0.04 },
    { n: 18.6, focus: sun, V: vPog, up: upPog, sx: 0.07, sy: 0.04 },
    { n: 21.3, focus: gc, V: vMw, up: upMw, sx: 0.2, sy: 0.02 },
    // M31 крупно — так, как её видно с Земли (наклон диска 77°)
    { n: 21.95, focus: m31, V: norm(m31), up: perp(ngp, norm(m31)), sx: 0.2, sy: 0.01 },
    { n: 23.2, focus: mid, V: vLg, up: upLg, sx: 0.18, sy: -0.02 },
    { n: 27, focus: mid, V: vWeb, up: upLg, sx: 0.12, sy: 0 },
  ];

  /** aspect = ширина/высота. В портрете фокус — по центру и в верхней половине (текст внизу). */
  return function pose(n: number, aspect = 16 / 9): CamPose {
    let k = 0;
    while (k < keys.length - 2 && n > keys[k + 1].n) k++;
    const a = keys[k], b = keys[k + 1];
    const t = smoother((n - a.n) / (b.n - a.n));
    const V = slerp(a.V, b.V, t);
    const upRaw = slerp(a.up, b.up, t);
    const R = norm(cross(V, upRaw));
    const U = cross(R, V);
    const focus = lerp3(a.focus, b.focus, t);
    let sx = lerp(a.sx, b.sx, t), sy = lerp(a.sy, b.sy, t);
    if (aspect < 1) { sx = 0; sy += 0.22 / aspect; }
    const d = Math.pow(10, n);
    const cam = sub(sub(focus, mul(V, d)), mul(add(mul(R, sx), mul(U, sy)), d));
    return { cam, V, U, R, focus, d };
  };
}
