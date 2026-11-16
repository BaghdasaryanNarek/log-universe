import { gsap } from 'gsap';
import { PLANETS, SMALL_BODIES } from '../../content/facts.ts';
import { t, lang } from '../../i18n/index.ts';
import { fmtNum } from '../../i18n/format.ts';
import { tex, texNum } from '../../ui/formulas.ts';
import type { Sfx } from '../../audio/engine.ts';

/**
 * «Кеплер в лог-масштабе». Оси переходят от линейных к логарифмическим непрерывно,
 * через преобразование Бокса — Кокса f_λ(x) = (x^λ − 1)/λ: при λ = 1 это x − 1 (линейная шкала),
 * при λ → 0 — ln x (логарифмическая). Поэтому превращение кривой T = a^{3/2} в прямую видно на глазах.
 */
const A_MIN = 0.3, A_MAX = 45, T_MIN = 0.15, T_MAX = 320;
const boxcox = (x: number, l: number) => (Math.abs(l) < 1e-4 ? Math.log(x) : (Math.pow(x, l) - 1) / l);
const norm = (x: number, lo: number, hi: number, l: number) => (boxcox(x, l) - boxcox(lo, l)) / (boxcox(hi, l) - boxcox(lo, l));

interface Body { id: string; a: number; T: number; small?: boolean }
const BODIES: Body[] = [
  ...PLANETS.map((p) => ({ id: p.id, a: p.el[0], T: p.T })),
  ...SMALL_BODIES.map((b) => ({ id: b.id, a: b.a, T: b.T, small: true })),
];
const A_TICKS = [0.5, 1, 2, 5, 10, 20, 30, 40];
const T_TICKS = [0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 300];

export class KeplerTool {
  readonly el: HTMLElement;
  private lambda = { v: 1 };
  private logMode = false;
  private yourA = 2.0;
  private svg!: SVGSVGElement;
  private W = 1000;
  private H = 520;
  constructor(private sfx?: Sfx) {
    this.el = document.createElement('div');
    this.el.className = 'tool kt';
    this.el.setAttribute('role', 'group');
    this.render();
  }

  render() {
    this.el.setAttribute('aria-label', t('kepler.toolTitle'));
    this.el.innerHTML = `
      <div class="tool-head"><h3 class="tool-title">${t('kepler.toolTitle')}</h3><p class="tool-hint">${t('kepler.hint')}</p>
        <button type="button" class="kt-toggle" aria-pressed="${this.logMode}">${this.logMode ? t('kepler.toLin') : t('kepler.toLog')}</button></div>
      <div class="kt-plot"><svg viewBox="-70 -20 ${this.W + 150} ${this.H + 80}" role="img" aria-label="${t('kepler.axisA')}; ${t('kepler.axisT')}"></svg></div>
      <div class="kt-out"><div class="kt-read" aria-live="polite"></div><div class="kt-tex"></div><div class="kt-note">${t('kepler.boxcox')}</div></div>`;
    this.svg = this.el.querySelector('svg')!;
    this.el.querySelector('.kt-toggle')!.addEventListener('click', () => this.toggle());
    this.draw();
  }

  toggle() {
    this.logMode = !this.logMode;
    const btn = this.el.querySelector<HTMLButtonElement>('.kt-toggle')!;
    btn.setAttribute('aria-pressed', String(this.logMode));
    btn.textContent = this.logMode ? t('kepler.toLin') : t('kepler.toLog');
    this.sfx?.click();
    gsap.to(this.lambda, { v: this.logMode ? 0 : 1, duration: 1.8, ease: 'power2.inOut', onUpdate: () => this.draw() });
  }

  private X(a: number) { return norm(a, A_MIN, A_MAX, this.lambda.v) * this.W; }
  private Y(T: number) { return this.H - norm(T, T_MIN, T_MAX, this.lambda.v) * this.H; }

  private draw() {
    const L = lang();
    const l = this.lambda.v;
    const parts: string[] = [];
    // сетка и подписи
    for (const a of A_TICKS) {
      const x = this.X(a);
      parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="${this.H}" class="kt-grid"/><text x="${x}" y="${this.H + 30}" class="kt-num" text-anchor="middle">${fmtNum(a, L, a < 1 ? 1 : 0)}</text>`);
    }
    for (const T of T_TICKS) {
      const y = this.Y(T);
      parts.push(`<line x1="0" y1="${y}" x2="${this.W}" y2="${y}" class="kt-grid"/><text x="-12" y="${y + 6}" class="kt-num" text-anchor="end">${fmtNum(T, L, T < 1 ? 1 : 0)}</text>`);
    }
    parts.push(`<rect x="0" y="0" width="${this.W}" height="${this.H}" class="kt-frame"/>`);
    parts.push(`<text x="${this.W}" y="${this.H + 62}" class="kt-axis" text-anchor="end">${t('kepler.axisA')}</text>`);
    parts.push(`<text x="0" y="-6" class="kt-axis">${t('kepler.axisT')}</text>`);
    // кривая T = a^{3/2}: в линейных осях — парабола, в логарифмических — прямая с наклоном 3/2
    let d = '';
    for (let i = 0; i <= 160; i++) {
      const a = A_MIN * Math.pow(A_MAX / A_MIN, i / 160);
      const T = Math.pow(a, 1.5);
      if (T > T_MAX) break;
      d += `${i ? 'L' : 'M'}${this.X(a).toFixed(1)} ${this.Y(T).toFixed(1)} `;
    }
    parts.push(`<path d="${d}" class="kt-law"/>`);
    if (l < 0.15) parts.push(`<text x="${this.X(6)}" y="${this.Y(Math.pow(6, 1.5)) - 18}" class="kt-slope" style="opacity:${(1 - l / 0.15).toFixed(2)}">${t('kepler.slope')}</text>`);
    // тела
    for (const b of BODIES) {
      const x = this.X(b.a), y = this.Y(b.T);
      parts.push(`<g class="kt-body${b.small ? ' is-small' : ''}"><circle cx="${x}" cy="${y}" r="${b.small ? 6 : 8}"/><text x="${x + 13}" y="${y - 10}">${t(`obj.${b.id}`)}</text></g>`);
    }
    // ваша планета
    const ya = this.yourA, yT = Math.pow(ya, 1.5);
    const yx = this.X(ya), yy = this.Y(yT);
    parts.push(`<g class="kt-you" tabindex="0" role="slider" aria-label="${t('kepler.yours')}" aria-valuemin="${A_MIN}" aria-valuemax="${A_MAX}" aria-valuenow="${ya.toFixed(2)}" aria-valuetext="${t('kepler.readout', { a: fmtNum(ya, L, 2), T: fmtNum(yT, L, 2) })}">
      <line x1="${yx}" y1="${yy}" x2="${yx}" y2="${this.H}" class="kt-drop"/><line x1="0" y1="${yy}" x2="${yx}" y2="${yy}" class="kt-drop"/>
      <circle cx="${yx}" cy="${yy}" r="22" class="kt-hit"/><circle cx="${yx}" cy="${yy}" r="10" class="kt-dot"/>
      <text x="${yx + 16}" y="${yy + 30}">${t('kepler.yours')}</text></g>`);
    this.svg.innerHTML = parts.join('');
    this.bindDrag();
    this.el.querySelector('.kt-read')!.textContent = t('kepler.readout', { a: fmtNum(ya, L, 2), T: fmtNum(yT, L, 2) });
    this.el.querySelector('.kt-tex')!.innerHTML = tex(`T = a^{3/2} = ${texNum(ya.toFixed(2))}^{3/2} \\approx ${texNum(yT.toFixed(2))}`, false);
  }

  private bindDrag() {
    const g = this.svg.querySelector<SVGGElement>('.kt-you')!;
    const toA = (clientX: number) => {
      const r = this.svg.getBoundingClientRect();
      const vbX = -70 + ((clientX - r.left) / r.width) * (this.W + 150);
      const u = Math.min(1, Math.max(0, vbX / this.W));
      // обратное к нормированному Бокса — Кокса
      const l = this.lambda.v, lo = boxcox(A_MIN, l), hi = boxcox(A_MAX, l), v = lo + u * (hi - lo);
      return Math.abs(l) < 1e-4 ? Math.exp(v) : Math.pow(v * l + 1, 1 / l);
    };
    g.addEventListener('pointerdown', (e) => {
      g.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => { this.yourA = Math.min(A_MAX, Math.max(A_MIN, toA(ev.clientX))); this.sfx?.tick(this.yourA); this.draw(); };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    g.addEventListener('keydown', (e) => {
      const k = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
      if (!k) return;
      e.preventDefault();
      this.yourA = Math.min(A_MAX, Math.max(A_MIN, this.yourA * Math.pow(10, k * 0.05)));
      this.draw();
      this.svg.querySelector<SVGGElement>('.kt-you')?.focus();
    });
  }
}
