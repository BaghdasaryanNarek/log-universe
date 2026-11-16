import { dot, smoothstep, type V3 } from '../core/vec.ts';
import { t, lang } from '../i18n/index.ts';
import { sup } from '../i18n/format.ts';
import type { Frame } from '../gl/types.ts';

export interface MapPoint { log: number; dir: V3; kind: 'star' | 'planet' | 'gal' | 'web' | 'moon' | 'sun' }
export interface MapLabel { log: number; dir: V3; key: string }

const COLORS: Record<MapPoint['kind'], string> = {
  moon: '#d9d1c1', sun: '#ffd27a', planet: '#e8b04b', star: '#f2ebdd', gal: '#b8ccff', web: '#ffd9a8',
};

/**
 * Финал: логарифмическая карта всего пути (идея Готта и Юрича, 2005).
 * Радиус ∝ log₁₀(расстояние в метрах): каждое кольцо — ×10, от вас (центр) до горизонта (27).
 * Направления настоящие — проекция на плоскость кадра.
 */
export class LogMap {
  private ctx: CanvasRenderingContext2D;
  private lastKey = '';
  constructor(private canvas: HTMLCanvasElement, private points: MapPoint[], private labels: MapLabel[]) {
    this.ctx = canvas.getContext('2d')!;
    window.addEventListener('resize', () => { this.lastKey = ''; });
  }

  invalidate() { this.lastKey = ''; }

  draw(f: Frame) {
    const tIn = smoothstep(27.15, 27.85, f.p);
    const out = 1 - smoothstep(28.3, 28.55, f.p);
    const a = tIn * out;
    const key = `${a.toFixed(3)}|${tIn.toFixed(3)}|${lang()}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = innerWidth, H = innerHeight;
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const g = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    c.style.opacity = String(a);
    c.style.visibility = a > 0.001 ? 'visible' : 'hidden';
    if (a <= 0.001) return;

    const portrait = W < H;
    const cx = portrait ? W * 0.47 : W * 0.68, cy = portrait ? H * 0.3 : H * 0.52;
    const Rmax = portrait ? Math.min(W * 0.42, H * 0.24) : Math.min(W * 0.26, H * 0.41);
    const reach = tIn * 27; // кольца раскрываются изнутри наружу
    const rad = (log: number) => (Math.max(0, log) / 27) * Rmax;
    g.fillStyle = 'rgba(7,8,12,0.9)';
    g.fillRect(0, 0, W, H);
    // кольца
    for (let k = 1; k <= 27; k++) {
      const vis = Math.min(1, Math.max(0, reach - k + 1));
      if (vis <= 0) break;
      g.beginPath();
      g.arc(cx, cy, rad(k), 0, Math.PI * 2);
      g.strokeStyle = k % 3 === 0 ? `rgba(232,176,75,${0.55 * vis})` : `rgba(242,235,221,${0.14 * vis})`;
      g.lineWidth = k % 3 === 0 ? 1.4 : 1;
      g.stroke();
      if (k % 3 === 0) {
        g.fillStyle = `rgba(232,176,75,${0.9 * vis})`;
        g.font = `${Math.round(12 * Math.max(0.8, H / 1080) * 1.1)}px "Plex Mono 1614", monospace`;
        g.textAlign = 'center';
        g.fillText(`10${sup(k)}`, cx, cy - rad(k) - 5);
      }
    }
    // точки
    const proj = (dir: V3, log: number): [number, number] => {
      const x = dot(dir, f.R), y = dot(dir, f.U);
      const l = Math.hypot(x, y) || 1;
      return [cx + (x / l) * rad(log), cy - (y / l) * rad(log)];
    };
    for (const p of this.points) {
      if (p.log > reach) continue;
      const [x, y] = proj(p.dir, p.log);
      g.fillStyle = COLORS[p.kind];
      g.globalAlpha = p.kind === 'web' ? 0.45 : p.kind === 'star' ? 0.6 : 0.9;
      const s = p.kind === 'planet' || p.kind === 'sun' || p.kind === 'moon' ? 4 : 1.4;
      g.fillRect(x - s / 2, y - s / 2, s, s);
    }
    g.globalAlpha = 1;
    // горизон: реликтовое излучение
    if (reach > 26.6) {
      g.beginPath();
      g.arc(cx, cy, rad(Math.log10(4.4e26)), 0, Math.PI * 2);
      g.strokeStyle = 'rgba(255,140,80,0.8)';
      g.lineWidth = 2.2;
      g.stroke();
    }
    // «вы» в центре
    g.fillStyle = '#ff6a3d';
    g.beginPath(); g.arc(cx, cy, 3.5, 0, Math.PI * 2); g.fill();
    const fs = Math.round(15 * Math.max(0.8, H / 1080));
    g.font = `italic ${fs}px "Garamond 1614", serif`;
    g.textAlign = 'left';
    g.fillStyle = '#f2ebdd';
    g.fillText(t('map.you'), cx + 8, cy - 6);
    for (const l of this.labels) {
      if (l.log > reach) continue;
      const [x, y] = proj(l.dir, l.log);
      g.strokeStyle = 'rgba(232,176,75,0.8)';
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18, y - 14); g.stroke();
      g.fillStyle = '#f2ebdd';
      g.fillText(t(l.key), x + 21, y - 16);
    }
  }
}
