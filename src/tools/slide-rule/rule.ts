import { gsap } from 'gsap';
import { t, lang } from '../../i18n/index.ts';
import { fmtNum } from '../../i18n/format.ts';
import { tex, texNum } from '../../ui/formulas.ts';
import type { Sfx } from '../../audio/engine.ts';

/**
 * Логарифмическая линейка, которая действительно считает.
 * Положение числа v на шкалах C и D: x = L·log₁₀ v (одна декада 1…10 на всю длину);
 * на шкале A две декады (1…100) — поэтому A и D связаны квадратом: под A = a² стоит D = a.
 * Сдвиг движка C на log a и отсчёт log b складываются: на D читается log a + log b = log(a·b).
 */
const L = 1000;
const lg = Math.log10;

function ticks(maxDecades: number, len: number): { x: number; h: number; label?: string }[] {
  const out: { x: number; h: number; label?: string }[] = [];
  const unit = len / maxDecades;
  for (let dec = 0; dec < maxDecades; dec++) {
    const p = Math.pow(10, dec);
    const add = (v: number, h: number, label?: string) => out.push({ x: unit * (lg(v) + dec), h, label });
    for (let v = 1; v < 10 - 1e-9; v += 0.01) {
      const r = Math.round(v * 100) / 100;
      const isInt = Math.abs(r - Math.round(r)) < 1e-6;
      const half = Math.abs(r * 2 - Math.round(r * 2)) < 1e-6;
      const tenth = Math.abs(r * 10 - Math.round(r * 10)) < 1e-6;
      const fine = maxDecades === 1 ? (r < 2 ? Math.abs(r * 20 - Math.round(r * 20)) < 1e-6 : r < 5 ? tenth : Math.abs(r * 5 - Math.round(r * 5)) < 1e-6) : (r < 2 ? tenth : r < 5 ? Math.abs(r * 5 - Math.round(r * 5)) < 1e-6 : half);
      if (isInt) add(r, 1, String(Math.round(r * p)));
      else if (half && r < 5 && maxDecades === 1) add(r, 0.62, r === 1.5 ? '1.5' : undefined);
      else if (tenth && r < 2 && maxDecades === 1) add(r, 0.5);
      else if (fine) add(r, 0.32);
    }
  }
  out.push({ x: len, h: 1, label: String(Math.pow(10, maxDecades)) });
  return out;
}

export class SlideRule {
  readonly el: HTMLElement;
  /** сдвиг движка C в декадах (−1…1) и положение бегунка (0…1) */
  private st = { s: 0, c: 0.301 };
  private svg!: SVGSVGElement;
  private slideG!: SVGGElement;
  private cursorG!: SVGGElement;
  private step = '';
  constructor(private sfx?: Sfx) {
    this.el = document.createElement('div');
    this.el.className = 'tool sr';
    this.el.setAttribute('role', 'group');
    this.render();
  }

  render() {
    this.el.setAttribute('aria-label', t('rule.title'));
    const scaleSvg = (tk: { x: number; h: number; label?: string }[], y: number, dir: 1 | -1, cls: string) =>
      tk.map((k) => {
        const y2 = y + dir * k.h * 22;
        const lab = k.label ? `<text x="${k.x}" y="${y + dir * 36 + (dir > 0 ? 6 : 0)}" class="sr-lab">${k.label.replace('.', lang() === 'en' ? '.' : ',')}</text>` : '';
        return `<line x1="${k.x}" y1="${y}" x2="${k.x}" y2="${y2}" class="${cls}"/>${lab}`;
      }).join('');
    const one = ticks(1, L), two = ticks(2, L);
    const cScale = (off: number) => `<g transform="translate(${off} 0)">${scaleSvg(one, 112, -1, 'sr-tk')}</g>`;
    this.el.innerHTML = `
      <div class="tool-head"><h3 class="tool-title">${t('rule.title')}</h3><p class="tool-hint">${t('rule.hint')}</p>
        <div class="sr-btns"><button type="button" data-demo="23">${t('rule.demo23')}</button><button type="button" data-demo="mars">${t('rule.demoMars')}</button><button type="button" data-demo="reset">${t('rule.reset')}</button></div></div>
      <div class="sr-body">
        <svg viewBox="-40 -6 ${L + 80} 206" class="sr-svg">
          <defs><clipPath id="sr-clip"><rect x="0" y="52" width="${L}" height="62"/></clipPath></defs>
          <rect x="-30" y="0" width="${L + 60}" height="48" class="sr-stator"/>
          <rect x="-30" y="118" width="${L + 60}" height="78" class="sr-stator"/>
          <text x="-20" y="30" class="sr-name">A</text><text x="-20" y="88" class="sr-name">C</text><text x="-20" y="146" class="sr-name">D</text>
          ${scaleSvg(two, 48, -1, 'sr-tk')}
          ${scaleSvg(one, 118, 1, 'sr-tk')}
          <g clip-path="url(#sr-clip)"><g class="sr-slide" tabindex="0" role="slider" aria-label="${t('rule.slide')}">
            <rect x="${-L * 2}" y="52" width="${L * 5}" height="62" class="sr-slide-bg"/>
            ${cScale(-L)}${cScale(0)}${cScale(L)}
          </g></g>
          <g class="sr-cursor" tabindex="0" role="slider" aria-label="${t('rule.cursor')}">
            <rect x="-26" y="-6" width="52" height="208" rx="4" class="sr-glass"/>
            <line x1="0" y1="-6" x2="0" y2="202" class="sr-hair"/>
          </g>
        </svg>
      </div>
      <div class="sr-out"><div class="sr-read" aria-live="polite"></div><div class="sr-tex"></div><div class="sr-step" aria-live="polite"></div></div>`;
    this.svg = this.el.querySelector('svg')!;
    this.slideG = this.el.querySelector('.sr-slide')!;
    this.cursorG = this.el.querySelector('.sr-cursor')!;
    this.bind();
    this.update();
  }

  private bind() {
    const toUnits = (dx: number) => (dx / this.svg.getBoundingClientRect().width) * (L + 80) / L;
    const drag = (g: SVGGElement, key: 's' | 'c', lo: number, hi: number) => {
      g.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        g.setPointerCapture(e.pointerId);
        let last = e.clientX;
        const move = (ev: PointerEvent) => {
          this.st[key] = Math.min(hi, Math.max(lo, this.st[key] + toUnits(ev.clientX - last)));
          last = ev.clientX;
          this.step = '';
          this.sfx?.tick(Math.pow(10, this.st.c));
          this.update();
        };
        const up = () => { g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); };
        g.addEventListener('pointermove', move);
        g.addEventListener('pointerup', up);
      });
      g.addEventListener('keydown', (e) => {
        const k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!k) return;
        e.preventDefault();
        this.st[key] = Math.min(hi, Math.max(lo, this.st[key] + k * (e.shiftKey ? 0.02 : 0.002)));
        this.step = '';
        this.update();
      });
    };
    drag(this.slideG, 's', -1, 1);
    drag(this.cursorG, 'c', 0, 1);
    this.el.querySelectorAll<HTMLButtonElement>('[data-demo]').forEach((b) => b.addEventListener('click', () => this.demo(b.dataset.demo!)));
  }

  private to(s: number, c: number, dur = 1.4) {
    return gsap.to(this.st, { s, c, duration: dur, ease: 'power3.inOut', onUpdate: () => this.update() });
  }

  demo(id: string) {
    gsap.killTweensOf(this.st);
    this.sfx?.click();
    if (id === 'reset') { this.step = ''; this.to(0, lg(2)); return; }
    if (id === '23') { this.step = ''; this.to(lg(2), lg(6)); return; }
    // период Марса: T = a·√a, a = 1,524 а.е.
    const a = 1.524;
    const tl = gsap.timeline();
    tl.call(() => { this.step = t('rule.mars1'); this.update(); });
    tl.to(this.st, { s: 0, c: lg(a) / 2, duration: 1.4, ease: 'power3.inOut', onUpdate: () => this.update() });
    tl.to({}, { duration: 1.6 });
    tl.call(() => { this.step = t('rule.mars2'); this.update(); });
    tl.to(this.st, { s: lg(a) / 2, duration: 1.2, ease: 'power3.inOut', onUpdate: () => this.update() });
    tl.to(this.st, { c: lg(a) / 2 + lg(a), duration: 1.2, ease: 'power3.inOut', onUpdate: () => this.update() });
    tl.to({}, { duration: 1.0 });
    tl.call(() => { this.step = t('rule.mars3'); this.update(); });
  }

  private update() {
    const { s, c } = this.st;
    this.slideG.setAttribute('transform', `translate(${s * L} 0)`);
    this.cursorG.setAttribute('transform', `translate(${c * L} 0)`);
    this.slideG.setAttribute('aria-valuenow', s.toFixed(3));
    this.cursorG.setAttribute('aria-valuenow', c.toFixed(3));
    const Lg = lang();
    // какая копия шкалы C стоит под бегунком
    let off = s;
    if (c - off < 0) off -= 1;
    if (c - off > 1) off += 1;
    const d = Math.pow(10, c);
    const b = Math.pow(10, c - off);
    const aRaw = Math.pow(10, off); // число на D под «1» движка (может быть < 1 — правый индекс)
    const a = aRaw < 1 ? aRaw * 10 : aRaw;
    const prod = a * b;
    const A = Math.pow(10, 2 * c);
    const f = (v: number) => fmtNum(v, Lg, v >= 10 ? 2 : 3);
    this.el.querySelector('.sr-read')!.textContent = `A ${f(A)} · C ${f(b)} · D ${f(d)}`;
    this.el.querySelector('.sr-tex')!.innerHTML = tex(
      `\\log ${texNum(a.toFixed(3))} + \\log ${texNum(b.toFixed(3))} = ${texNum(lg(a).toFixed(3))} + ${texNum(lg(b).toFixed(3))} = ${texNum(lg(prod).toFixed(3))} = \\log ${texNum(prod.toFixed(prod >= 10 ? 2 : 3))}`,
      false,
    );
    this.el.querySelector('.sr-step')!.textContent = this.step;
  }
}
