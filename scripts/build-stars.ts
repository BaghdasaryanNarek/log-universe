/**
 * HYG v4.4 (CC BY-SA 4.0, astronexus) → public/data/stars.bin + stars.json
 *
 * Отбор: все звёзды ярче 7,0ᵐ (небо невооружённого глаза с запасом)
 * плюс все звёзды ближе 25 пк (окрестности Солнца для 3D-сцены).
 * Формат stars.bin (v2): сначала Float32 × 3 на звезду — x, y, z (пк, экваториальные ICRS);
 * затем Int16 × 3 на звезду — M·1000 (абсолютная величина V), (B−V)·1000 (−9000 = нет данных),
 * индекс имени (−1 если нет). Точность 0,001ᵐ с запасом; файл на четверть легче.
 * Звезда 0 — Солнце.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const SRC = 'assets-src/hyg/hyg_v44.csv.gz';
const MAG_LIMIT = 7.0;
const NEAR_PC = 25;

// Видимые величины V из SIMBAD для звёзд, которые упоминаются в текстах и в
// инструменте «Сравни яркость». HYG хранит Hipparcos-значения, отличающиеся
// на сотые; для согласованности с текстом берём SIMBAD и пересчитываем M.
const V_OVERRIDE: Record<string, number> = {
  Sirius: -1.46,
  Vega: 0.03,
  Polaris: 1.98,
  'Proxima Centauri': 11.13,
  Canopus: -0.74,
  Betelgeuse: 0.42,
  Rigel: 0.13,
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const text = gunzipSync(readFileSync(SRC)).toString('utf8');
const lines = text.split(/\r?\n/).filter(Boolean);
const header = parseCsvLine(lines[0]);
const col = (name: string) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`no column ${name}`);
  return i;
};
const C = {
  id: col('id'), hip: col('hip'), proper: col('proper'), dist: col('dist'),
  mag: col('mag'), absmag: col('absmag'), ci: col('ci'),
  x: col('x'), y: col('y'), z: col('z'), bayer: col('bayer'), con: col('con'),
};

interface Star { x: number; y: number; z: number; M: number; ci: number; name: string; hip: number; mag: number; dist: number; bayer: string; con: string }
const stars: Star[] = [];

for (let i = 1; i < lines.length; i++) {
  const f = parseCsvLine(lines[i]);
  const dist = Number(f[C.dist]);
  const mag = Number(f[C.mag]);
  const isSun = f[C.id] === '0';
  if (!isSun) {
    if (!(dist > 0) || dist >= 100000) continue; // неизвестное расстояние
    if (!(mag <= MAG_LIMIT || dist <= NEAR_PC)) continue;
  }
  const name = f[C.proper] || '';
  let m = mag;
  let M = Number(f[C.absmag]);
  if (name in V_OVERRIDE) {
    m = V_OVERRIDE[name];
    M = m - 5 * Math.log10(dist / 10);
  }
  const ciRaw = f[C.ci];
  stars.push({
    x: Number(f[C.x]), y: Number(f[C.y]), z: Number(f[C.z]),
    M, ci: ciRaw === '' ? -9 : Number(ciRaw), name, hip: Number(f[C.hip]) || 0,
    mag: m, dist: isSun ? 0 : dist, bayer: f[C.bayer] || '', con: f[C.con] || '',
  });
}

// Солнце первым, остальные — от ярких к тусклым (удобно для пикинга)
stars.sort((a, b) => (a.dist === 0 ? -1 : b.dist === 0 ? 1 : a.mag - b.mag));

const names: { i: number; name: string; hip: number; con: string; bayer: string }[] = [];
const pos = new Float32Array(stars.length * 3);
const q = new Int16Array(stars.length * 3);
stars.forEach((s, i) => {
  let ni = -1;
  if (s.name || (s.bayer && s.mag < 4.5)) { ni = names.length; names.push({ i, name: s.name, hip: s.hip, con: s.con, bayer: s.bayer }); }
  pos.set([s.x, s.y, s.z], i * 3);
  q.set([Math.round(s.M * 1000), Math.round(s.ci * 1000), ni], i * 3);
});

mkdirSync('public/data', { recursive: true });
const bytes = Buffer.concat([Buffer.from(pos.buffer), Buffer.from(q.buffer)]);
writeFileSync('public/data/stars.bin', bytes);
writeFileSync('public/data/stars.json', JSON.stringify({
  source: 'HYG v4.4, astronexus.com — CC BY-SA 4.0. Derived subset, same license.',
  count: stars.length, format: 2, names,
}));
console.log(`stars: ${stars.length}, named: ${names.length}, bytes: ${bytes.length}`);
