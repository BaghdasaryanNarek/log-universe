/**
 * Галактика из частиц по логарифмической спирали r = r₀·e^{bθ}, b = tg(угол закрутки).
 * Координаты — килопарсеки в плоскости диска (x, y) и по нормали (z). Порядок частиц
 * перемешан, поэтому любой префикс — честная случайная выборка (для адаптивного качества).
 */
export interface GalaxySpec {
  count: number;
  arms: number;
  pitchDeg: number;
  /** радиус, где рукав 0 пересекает ось x (θ = 0) */
  r0: number;
  scaleLen: number;
  rMax: number;
  bulgeR: number;
  bar?: { len: number; width: number; angleDeg: number };
  ring?: { r: number; width: number; share: number };
  seed: number;
  /** доли: рукава, гладкий диск, балдж, пыль */
  mix: { arms: number; disk: number; bulge: number; dust: number; hii: number };
  satellites?: { x: number; y: number; z: number; r: number; n: number }[];
}

export interface GalaxyData { pos: Float32Array; color: Float32Array; size: Float32Array; dust: Float32Array; count: number }

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function generateGalaxy(g: GalaxySpec): GalaxyData {
  const R = rng(g.seed);
  const gauss = () => { let u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); };
  const b = Math.tan((g.pitchDeg * Math.PI) / 180);
  const N = g.count;
  const pos = new Float32Array(N * 3), color = new Float32Array(N * 3), size = new Float32Array(N), dust = new Float32Array(N);
  const expR = (L: number, max: number, min = 0) => { let r: number; do { r = -L * Math.log(1 - R() * 0.999); } while (r > max || r < min); return r; };
  const set = (i: number, x: number, y: number, z: number, c: [number, number, number], s: number, d = 0) => {
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    color[i * 3] = c[0]; color[i * 3 + 1] = c[1]; color[i * 3 + 2] = c[2];
    size[i] = s; dust[i] = d;
  };
  const m = g.mix;
  const tot = m.arms + m.disk + m.bulge + m.dust + m.hii;
  let i = 0;
  const satTotal = g.satellites?.reduce((a, s) => a + s.n, 0) ?? 0;
  const main = N - satTotal;
  for (; i < main; i++) {
    const u = R() * tot;
    if (u < m.arms + m.hii + m.dust) {
      // точка на рукаве
      const r = expR(g.scaleLen * 1.35, g.rMax, g.bulgeR * 0.8);
      const k = Math.floor(R() * g.arms);
      const theta = Math.log(r / g.r0) / b - (k * 2 * Math.PI) / g.arms;
      const width = 0.18 + 0.06 * r;
      const isHii = u >= m.arms && u < m.arms + m.hii;
      const isDust = u >= m.arms + m.hii;
      // пыль лежит на внутренней (вогнутой) кромке рукава
      const off = isDust ? -width * 0.55 + gauss() * width * 0.25 : gauss() * width * (isHii ? 0.35 : 1);
      const th = theta + off / r;
      const rr = r + gauss() * 0.15;
      const z = gauss() * (isDust ? 0.05 : 0.12 + 0.01 * r);
      const young: [number, number, number] = [0.72, 0.82, 1.0];
      if (isHii) set(i, rr * Math.cos(th), rr * Math.sin(th), z, [1.0, 0.45, 0.62], 0.16 + R() * 0.12);
      else if (isDust) set(i, rr * Math.cos(th), rr * Math.sin(th), z, [0.03, 0.025, 0.02], 0.28 + R() * 0.2, 1);
      else set(i, rr * Math.cos(th), rr * Math.sin(th), z, young, 0.1 + R() * 0.12);
    } else if (u < m.arms + m.hii + m.dust + m.disk) {
      // гладкий диск (и кольцо, если есть)
      let r: number;
      if (g.ring && R() < g.ring.share) r = g.ring.r + gauss() * g.ring.width;
      else r = expR(g.scaleLen, g.rMax);
      const th = R() * 2 * Math.PI;
      set(i, r * Math.cos(th), r * Math.sin(th), gauss() * 0.25, [0.95, 0.88, 0.76], 0.12 + R() * 0.1);
    } else {
      // балдж / перемычка
      let x: number, y: number, z: number;
      if (g.bar && R() < 0.55) {
        x = gauss() * g.bar.len * 0.45; y = gauss() * g.bar.width * 0.45; z = gauss() * g.bar.width * 0.3;
        const a = (g.bar.angleDeg * Math.PI) / 180;
        [x, y] = [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
      } else { x = gauss() * g.bulgeR * 0.5; y = gauss() * g.bulgeR * 0.5; z = gauss() * g.bulgeR * 0.35; }
      set(i, x, y, z, [1.0, 0.8, 0.55], 0.12 + R() * 0.1);
    }
  }
  for (const s of g.satellites ?? []) {
    for (let j = 0; j < s.n; j++, i++) set(i, s.x + gauss() * s.r, s.y + gauss() * s.r, s.z + gauss() * s.r * 0.8, [1.0, 0.86, 0.66], 0.1);
  }
  // перемешивание (Фишер — Йетс), чтобы префиксы были случайной выборкой
  for (let a = N - 1; a > 0; a--) {
    const c = Math.floor(R() * (a + 1));
    for (let k = 0; k < 3; k++) { const t = pos[a * 3 + k]; pos[a * 3 + k] = pos[c * 3 + k]; pos[c * 3 + k] = t; const q = color[a * 3 + k]; color[a * 3 + k] = color[c * 3 + k]; color[c * 3 + k] = q; }
    const t = size[a]; size[a] = size[c]; size[c] = t;
    const d = dust[a]; dust[a] = dust[c]; dust[c] = d;
  }
  return { pos, color, size, dust, count: N };
}

/** Млечный Путь: 4 рукава, угол закрутки 13° (Vallée 2015), перемычка ≈ 27° к линии Солнце–центр. */
export const MILKY_WAY: Omit<GalaxySpec, 'count'> = {
  arms: 4, pitchDeg: 13, r0: 7.2, scaleLen: 2.9, rMax: 17, bulgeR: 1.6,
  bar: { len: 9, width: 2.2, angleDeg: 27 }, seed: 7,
  mix: { arms: 0.5, disk: 0.24, bulge: 0.14, dust: 0.1, hii: 0.02 },
};

/** Андромеда: 2 рукава, кольцо звездообразования на ≈ 10 кпк, спутники M32 и M110. */
export const ANDROMEDA: Omit<GalaxySpec, 'count'> = {
  arms: 2, pitchDeg: 9, r0: 6, scaleLen: 5.3, rMax: 26, bulgeR: 2.4,
  ring: { r: 10, width: 1.2, share: 0.45 }, seed: 31,
  mix: { arms: 0.36, disk: 0.34, bulge: 0.18, dust: 0.1, hii: 0.02 },
  satellites: [{ x: -0.5, y: -5.2, z: 0, r: 0.35, n: 1200 }, { x: -6.0, y: 5.0, z: 0, r: 0.9, n: 1800 }],
};
