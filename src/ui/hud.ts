import { BEATS, MARGINALIA, N_MAX } from '../content/scenes.ts';
import { t, tHtml, lang } from '../i18n/index.ts';
import { fmtNum, fmtSci, fmtFact } from '../i18n/format.ts';

const SVG = 'http://www.w3.org/2000/svg';

/**
 * HUD: вертикальная логарифмическая шкала 0…27 (деления 10ⁿ и промежуточные log₁₀ 2…9),
 * указатель текущего n, отметки остановок (кнопки — перелёт), живое значение log₁₀ d,
 * гигантская цифра 10ⁿ и маргиналии.
 */
export class Hud {
  private ruler: SVGSVGElement;
  private pointer: SVGGElement;
  private logEl: HTMLElement;
  private dEl: HTMLElement;
  private expEl: HTMLElement;
  private margEl: HTMLElement;
  private marks: HTMLButtonElement[] = [];
  private lastLog = '';
  private lastExp = -1;
  private lastMarg = '';
  private h = 1;

  constructor(private root: HTMLElement, private onJump: (n: number) => void) {
    root.innerHTML = `
      <div class="hud-read" aria-live="off">
        <div class="hud-log"><span class="hud-log-k">log<sub>10</sub>&thinsp;d</span><span class="hud-log-v" id="hud-log">0,00</span></div>
        <div class="hud-d">d ≈ <span id="hud-d"></span></div>
        <div class="hud-note" data-i18n="hud.dist"></div>
        <div class="hud-honest"><span class="hud-honest-dot" aria-hidden="true"></span><span data-i18n="hud.honest"></span></div>
      </div>
      <div class="hud-scale">
        <svg class="hud-ruler" aria-hidden="true"></svg>
        <div class="hud-marks"></div>
      </div>
      <div class="hud-marg" id="hud-marg"></div>`;
    this.ruler = root.querySelector('.hud-ruler')!;
    this.logEl = root.querySelector('#hud-log')!;
    this.dEl = root.querySelector('#hud-d')!;
    this.margEl = root.querySelector('#hud-marg')!;
    this.expEl = document.querySelector('#bignum-exp')!;
    this.pointer = document.createElementNS(SVG, 'g');
    this.build();
    window.addEventListener('resize', () => this.build());
  }

  private build() {
    const scale = this.root.querySelector<HTMLElement>('.hud-scale')!;
    const H = scale.clientHeight || window.innerHeight * 0.7;
    this.h = H;
    const W = 46;
    const svg = this.ruler;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', String(W));
    svg.setAttribute('height', String(H));
    svg.innerHTML = '';
    const y = (n: number) => H - (n / N_MAX) * H;
    const line = (x1: number, y1: number, x2: number, y2: number, cls: string) => {
      const l = document.createElementNS(SVG, 'line');
      l.setAttribute('x1', String(x1)); l.setAttribute('y1', String(y1));
      l.setAttribute('x2', String(x2)); l.setAttribute('y2', String(y2));
      l.setAttribute('class', cls);
      svg.appendChild(l);
    };
    line(W - 1, 0, W - 1, H, 'r-spine');
    for (let k = 0; k <= N_MAX; k++) {
      line(W - (k % 3 === 0 ? 16 : 10), y(k), W - 1, y(k), k % 3 === 0 ? 'r-major' : 'r-dec');
      if (k % 3 === 0) {
        const tx = document.createElementNS(SVG, 'text');
        tx.setAttribute('x', String(W - 21)); tx.setAttribute('y', String(y(k) + 4));
        tx.setAttribute('class', 'r-label');
        tx.textContent = String(k);
        svg.appendChild(tx);
      }
      if (k < N_MAX) for (let m = 2; m <= 9; m++) {
        const yy = y(k + Math.log10(m));
        line(W - (m === 5 ? 7 : 4.5), yy, W - 1, yy, 'r-minor');
      }
    }
    // указатель
    this.pointer = document.createElementNS(SVG, 'g');
    this.pointer.setAttribute('class', 'r-pointer');
    this.pointer.innerHTML = `<line x1="0" y1="0" x2="${W}" y2="0"/><path d="M ${W - 1} 0 l -9 -5 v 10 z"/>`;
    svg.appendChild(this.pointer);

    // отметки остановок — настоящие кнопки
    const marks = this.root.querySelector<HTMLElement>('.hud-marks')!;
    marks.innerHTML = '';
    this.marks = BEATS.map((b) => {
      const btn = document.createElement('button');
      btn.className = 'hud-mark';
      btn.type = 'button';
      btn.style.top = `${y(b.n)}px`;
      btn.dataset.n = String(b.n);
      btn.innerHTML = `<span class="hud-mark-dia" aria-hidden="true"></span><span class="hud-mark-t"></span>`;
      btn.addEventListener('click', () => this.onJump(b.n));
      marks.appendChild(btn);
      return btn;
    });
    this.relocalize();
    this.lastLog = '';
  }

  relocalize() {
    this.root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n!); });
    this.marks.forEach((m, i) => {
      const b = BEATS[i];
      m.querySelector('.hud-mark-t')!.textContent = t(`beat.${b.id}`);
      m.setAttribute('aria-label', `${t(`beat.${b.id}`)} — ${t('hud.jump', { n: fmtNum(b.n, lang(), 1) })}`);
    });
    this.lastLog = '';
    this.lastMarg = '';
  }

  update(n: number, activeBeat: string | null) {
    const y = this.h - (n / N_MAX) * this.h;
    this.pointer.setAttribute('transform', `translate(0 ${y.toFixed(2)})`);
    const L = lang();
    const logTxt = fmtNum(n, L, 2);
    if (logTxt !== this.lastLog) {
      this.lastLog = logTxt;
      this.logEl.textContent = logTxt;
      this.dEl.textContent = `${fmtSci(Math.pow(10, n), L, 1)} ${t('unit.m')}`;
    }
    const e = Math.floor(n + 1e-9);
    if (e !== this.lastExp) {
      this.lastExp = e;
      this.expEl.textContent = String(e).replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)]);
      this.expEl.parentElement?.classList.remove('tick');
      void this.expEl.parentElement?.offsetWidth;
      this.expEl.parentElement?.classList.add('tick');
    }
    this.marks.forEach((m) => m.classList.toggle('is-current', m.dataset.n === String(BEATS.find((b) => b.id === activeBeat)?.n)));
    // маргиналия: ближайшая подпись в пределах ±0,42 декады, если нет активного бита
    let html = '';
    if (!activeBeat) {
      const m = MARGINALIA.find((x) => Math.abs(x.n - n) < 0.42);
      if (m) html = `<span class="marg-pre">${t('marg.prefix')}</span><span class="marg-v">${fmtFact(m.fact, L, (u) => t(`unit.${u}`))}</span><span class="marg-l">${tHtml(m.label)}</span>`;
    }
    if (html !== this.lastMarg) {
      this.lastMarg = html;
      this.margEl.classList.toggle('is-on', !!html);
      if (html) this.margEl.innerHTML = html;
    }
    this.margEl.style.transform = `translateY(${(y + this.root.querySelector<HTMLElement>('.hud-scale')!.offsetTop).toFixed(1)}px)`;
  }
}
