import { PC } from '../../content/facts.ts';
import type { V3 } from '../../core/vec.ts';

export interface StarName { i: number; name: string; hip: number; con: string; bayer: string }

export interface StarCatalog {
  count: number;
  /** x, y, z в парсеках (экваториальные ICRS), подряд */
  pos: Float32Array;
  absMag: Float32Array;
  ci: Float32Array;
  nameIdx: Int32Array;
  names: StarName[];
  find: (name: string) => number;
  findBayer: (bayer: string, con: string) => number;
  posM: (i: number) => V3;
}

export async function loadCatalog(base: string, onProgress: (p: number) => void): Promise<StarCatalog> {
  const [bin, meta] = await Promise.all([
    fetchWithProgress(`${base}data/stars.bin`, onProgress),
    fetch(`${base}data/stars.json`).then((r) => r.json() as Promise<{ count: number; stride: number; names: StarName[] }>),
  ]);
  const f = new Float32Array(bin);
  const n = meta.count, s = meta.stride;
  const pos = new Float32Array(n * 3), absMag = new Float32Array(n), ci = new Float32Array(n), nameIdx = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = f[i * s]; pos[i * 3 + 1] = f[i * s + 1]; pos[i * 3 + 2] = f[i * s + 2];
    absMag[i] = f[i * s + 3]; ci[i] = f[i * s + 4]; nameIdx[i] = f[i * s + 5];
  }
  const byName = new Map(meta.names.map((x) => [x.name, x.i]));
  const byBayer = new Map(meta.names.map((x) => [`${x.bayer} ${x.con}`, x.i]));
  return {
    count: n, pos, absMag, ci, nameIdx, names: meta.names,
    find: (name) => byName.get(name) ?? -1,
    findBayer: (b, c) => byBayer.get(`${b} ${c}`) ?? -1,
    posM: (i) => [pos[i * 3] * PC, pos[i * 3 + 1] * PC, pos[i * 3 + 2] * PC],
  };
}

async function fetchWithProgress(url: string, onProgress: (p: number) => void): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`fetch ${url}: ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    if (total) onProgress(Math.min(1, got / total));
  }
  onProgress(1);
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out.buffer;
}

/** Цвет звезды из показателя B−V: температура по Ballesteros (2012), затем приближение Хелланда. */
export function bvToRgb(bv: number): [number, number, number] {
  const b = Math.max(-0.4, Math.min(2.0, bv));
  const T = 4600 * (1 / (0.92 * b + 1.7) + 1 / (0.92 * b + 0.62));
  const t = T / 100;
  let r: number, g: number, bl: number;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
  if (t >= 66) bl = 255; else if (t <= 19) bl = 0; else bl = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (x: number) => Math.max(0, Math.min(255, x)) / 255;
  // глаз видит звёзды почти белыми — смешиваем с белым
  const w = 0.42;
  return [c(r) * (1 - w) + w, c(g) * (1 - w) + w, c(bl) * (1 - w) + w];
}
