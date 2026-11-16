import { AU } from '../content/facts.ts';
import { DEG, cross, norm, type V3 } from '../core/vec.ts';

/** Ереван: широта и долгота (восточная). */
export const YEREVAN = { lat: 40.1811, lon: 44.5136, utcOffsetH: 4 };
export const EARTH_R = 6.371e6; // м, средний радиус (NSSDC)

export const julianDate = (d: Date) => d.getTime() / 86400000 + 2440587.5;

/** Гринвичское среднее звёздное время, рад (IAU 1982, точность ~0,1 с). */
export function gmst(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const deg = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000;
  return (((deg % 360) + 360) % 360) * DEG;
}

/** Сегодня в Ереване в 22:00 местного времени. */
export function heroDate(now = new Date()): Date {
  const local = new Date(now.getTime() + YEREVAN.utcOffsetH * 3600e3);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 22 - YEREVAN.utcOffsetH, 0, 0));
}

export interface ObserverFrame { zenith: V3; north: V3; east: V3; lst: number }

/** Локальный базис наблюдателя в экваториальных координатах (ICRS ≈ J2000). */
export function observerFrame(date: Date, lat = YEREVAN.lat, lonEast = YEREVAN.lon): ObserverFrame {
  const lst = gmst(julianDate(date)) + lonEast * DEG;
  const phi = lat * DEG;
  const zenith: V3 = [Math.cos(phi) * Math.cos(lst), Math.cos(phi) * Math.sin(lst), Math.sin(phi)];
  const east = norm(cross([0, 0, 1], zenith));
  const north = cross(zenith, east);
  return { zenith, north, east, lst };
}

/** Направление по азимуту (от севера к востоку) и высоте в базисе наблюдателя. */
export function altAzDir(f: ObserverFrame, azDeg: number, altDeg: number): V3 {
  const a = azDeg * DEG, h = altDeg * DEG;
  const c = Math.cos(h);
  return norm([
    f.north[0] * c * Math.cos(a) + f.east[0] * c * Math.sin(a) + f.zenith[0] * Math.sin(h),
    f.north[1] * c * Math.cos(a) + f.east[1] * c * Math.sin(a) + f.zenith[1] * Math.sin(h),
    f.north[2] * c * Math.cos(a) + f.east[2] * c * Math.sin(a) + f.zenith[2] * Math.sin(h),
  ]);
}

export function toAltAz(f: ObserverFrame, d: V3): { az: number; alt: number } {
  const z = d[0] * f.zenith[0] + d[1] * f.zenith[1] + d[2] * f.zenith[2];
  const n = d[0] * f.north[0] + d[1] * f.north[1] + d[2] * f.north[2];
  const e = d[0] * f.east[0] + d[1] * f.east[1] + d[2] * f.east[2];
  return { alt: Math.asin(Math.max(-1, Math.min(1, z))) / DEG, az: ((Math.atan2(e, n) / DEG) + 360) % 360 };
}

/** Гелиоцентрическое положение Земли, м (экваториальные координаты; формулы низкой точности, ~0,01°). */
export function earthHelio(date: Date): V3 {
  const n = julianDate(date) - 2451545.0;
  const L = (280.46 + 0.9856474 * n) * DEG;
  const g = (357.528 + 0.9856003 * n) * DEG;
  // долгота эпохи даты → J2000 (каталог звёзд и элементы JPL — в J2000): общая прецессия 1,397°/век
  const lam = L + (1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG - 1.397 * DEG * (n / 36525);
  const R = (1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g)) * AU;
  const eps = 23.4393 * DEG; // J2000
  // геоцентрическое Солнце → гелиоцентрическая Земля = минус
  return [-R * Math.cos(lam), -R * Math.cos(eps) * Math.sin(lam), -R * Math.sin(eps) * Math.sin(lam)];
}

/** Экваториальные (ICRS) → галактические, матрица Hipparcos (ESA 1997). Строки — оси галактики. */
export const EQ_TO_GAL: [V3, V3, V3] = [
  [-0.0548755604, -0.873437090, -0.4838350155],
  [0.4941094279, -0.4448296300, 0.7469822445],
  [-0.8676661490, -0.1980763734, 0.4559837762],
];


/** Геоцентрическое положение Луны, м (экваториальные; формулы низкой точности, ~0,3°, ~1000 км). */
export function moonGeo(date: Date): V3 {
  const d = julianDate(date) - 2451545.0;
  const Lp = (218.316 + 13.176396 * d) * DEG;
  const Mp = (134.963 + 13.064993 * d) * DEG;
  const F = (93.272 + 13.22935 * d) * DEG;
  const lam = Lp + 6.289 * DEG * Math.sin(Mp);
  const bet = 5.128 * DEG * Math.sin(F);
  const r = (385001 - 20905 * Math.cos(Mp)) * 1000;
  const eps = 23.4393 * DEG;
  const x = r * Math.cos(bet) * Math.cos(lam);
  const y = r * Math.cos(bet) * Math.sin(lam);
  const z = r * Math.sin(bet);
  return [x, y * Math.cos(eps) - z * Math.sin(eps), y * Math.sin(eps) + z * Math.cos(eps)];
}

/** Единичный вектор по прямому восхождению и склонению (градусы). */
export const radec = (raDeg: number, decDeg: number): V3 => {
  const a = raDeg * DEG, b = decDeg * DEG;
  return [Math.cos(b) * Math.cos(a), Math.cos(b) * Math.sin(a), Math.sin(b)];
};