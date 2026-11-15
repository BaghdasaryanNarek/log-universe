import { gsap } from 'gsap';
import { MAG_OBJECTS, type MagObject } from '../../content/facts.ts';
import { t, lang } from '../../i18n/index.ts';
import { fmtMag, fmtNum } from '../../i18n/format.ts';
import { tex, texNum } from '../../ui/formulas.ts';

const M_MIN = -28, M_MAX = 32;
const x = (m: number) => ((m - M_MIN) / (M_MAX - M_MIN)) * 100; // проценты ширины
const SVG = 'http://www.w3.org/2000/svg';

/**
 * «Сравни яркость». Две совмещённые шкалы, как на логарифмической линейке:
 * сверху — звёздные величины m, снизу — порядки отношения потоков.
 * Нижняя шкала сдвигается так, что её ноль стоит под более ярким объектом;
 * под тусклым читается log₁₀(F_A/F_B) = 0,4·Δm.
 */
export class CompareTool {
  readonly el: HTMLElement;
  private sel: string[] = ['sun', 'moon'];
  private flux!: SVGGElement;
  private bracket!: HTMLElement;
  private out!: HTMLElement;
  private orders!: HTMLElement;
  private legend!: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'tool tc';
    this.el.setAttribute('role', 'group');
    this.render();
  }

  render() {
    this.el.setAttribute('aria-label', t('tool.compare.title'));
    this.el.innerHTML = `
      <div class="tool-head"><h3 class="tool-title">${t('tool.compare.title')}</h3><p class="tool-hint">${t('tool.compare.hint')}</p></div>
      <div class="tc-scale">
        <div class="tc-marks"></div>
        <div class="tc-axis" aria-hidden="true">
          <svg class="tc-svg" viewBox="0 0 1000 96" preserveAspectRatio="none"><g class="tc-axis-m"></g></svg>
          <div class="tc-nums"></div>
        </div>
        <div class="tc-flux" aria-hidden="true">
          <svg class="tc-svg tc-svg-f" viewBox="-1000 0 3000 96" preserveAspectRatio="none"><g class="tc-flux-g"></g></svg>
          <div class="tc-nums tc-nums-f"></div>
        </div>
        <div class="tc-bracket" aria-hidden="true"><span class="tc-br-m"></span><span class="tc-br-f"></span></div>
        <div class="tc-names" aria-hidden="true"><span>${t('tool.compare.scaleM')}</span><span>${t('tool.compare.scaleF')}</span></div>
      </div>
      <div class="tc-out">
        <div class="tc-legend"></div>
        <div class="tc-tex" aria-live="polite"></div>
        <div class="tc-orders"></div>
      </div>`;
    const axis = this.el.querySelector<SVGGElement>('.tc-axis-m')!;
    this.flux = this.el.querySelector<SVGGElement>('.tc-flux')!;
    this.bracket = this.el.querySelector('.tc-bracket')!;
    this.out = this.el.querySelector('.tc-tex')!;
    this.orders = this.el.querySelector('.tc-orders')!;
    this.legend = this.el.querySelector('.tc-legend')!;
    const L = lang();
    // верхняя шкала: m
    const add = (g: SVGGElement, tag: string, attrs: Record<string, string | number>, text?: string) => {
      const e = document.createElementNS(SVG, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
      if (text) e.textContent = text;
      g.appendChild(e);
      return e;
    };
    add(axis, 'line', { x1: 0, y1: 30, x2: 1000, y2: 30, class: 'tc-spine' });
    for (let m = M_MIN; m <= M_MAX; m++) {
      const X = x(m) * 10;
      const major = m % 5 === 0;
      add(axis, 'line', { x1: X, y1: 30, x2: X, y2: major ? 16 : 23, class: major ? 'tc-tk tc-tk-M' : 'tc-tk' });
      if (major) add(axis, 'text', { x: X, y: 11, class: 'tc-num' }, fmtMag(m, L, 0).replace('+0', '0'));
    }
    // нижняя шкала: десятичные порядки потока, шаг 2,5ᵐ
    add(this.flux, 'line', { x1: -1000, y1: 62, x2: 2000, y2: 62, class: 'tc-spine tc-spine-f' });
    for (let k = -24; k <= 24; k++) {
      const X = ((k * 2.5) / (M_MAX - M_MIN)) * 1000;
      add(this.flux, 'line', { x1: X, y1: 62, x2: X, y2: 74, class: 'tc-tk tc-tk-f' });
      for (let j = 2; j <= 9; j++) {
        const xx = (((k + Math.log10(j)) * 2.5) / (M_MAX - M_MIN)) * 1000;
        add(this.flux, 'line', { x1: xx, y1: 62, x2: xx, y2: 66.5, class: 'tc-tk tc-tk-fm' });
      }
      if (k % 2 === 0) add(this.flux, 'text', { x: X, y: 90, class: 'tc-num tc-num-f' }, k < 0 ? `−${-k}` : String(k));
    }
    // объекты
    const marks = this.el.querySelector<HTMLElement>('.tc-marks')!;
    const rowsEnd: number[] = [];
    [...MAG_OBJECTS].sort((a, b) => a.m - b.m).forEach((o) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tc-mark';
      btn.dataset.id = o.id;
      const label = t(`obj.${o.id}`);
      btn.innerHTML = `<span class="tc-mark-name">${label}</span><span class="tc-mark-m">${o.approx ? '≈ ' : ''}${fmtMag(o.m, L, o.approx ? 0 : 2)}</span>`;
      btn.setAttribute('aria-label', `${label}, m = ${o.approx ? '≈ ' : ''}${fmtMag(o.m, L, o.approx ? 0 : 2)}`);
      const px = x(o.m);
      // раскладка подписей по рядам без наложений (ширина подписи ~ 9 % шкалы)
      let row = 0;
      while (rowsEnd[row] !== undefined && rowsEnd[row] > px - 9.5) row++;
      rowsEnd[row] = px;
      btn.style.left = `${px}%`;
      btn.style.setProperty('--row', String(row));
      btn.addEventListener('click', () => this.pick(o.id));
      marks.appendChild(btn);
    });
    this.update(false);
  }

  private pick(id: string) {
    if (this.sel.includes(id)) return;
    this.sel = [this.sel[1], id];
    this.update(true);
  }

  private update(animate: boolean) {
    const objs = this.sel.map((id) => MAG_OBJECTS.find((o) => o.id === id)!) as [MagObject, MagObject];
    const [A, B] = objs[0].m <= objs[1].m ? objs : [objs[1], objs[0]];
    const dm = B.m - A.m;
    const k = 0.4 * dm;
    const L = lang();
    this.el.querySelectorAll<HTMLButtonElement>('.tc-mark').forEach((b) => {
      const id = b.dataset.id!;
      b.setAttribute('aria-pressed', String(this.sel.includes(id)));
      b.classList.toggle('is-a', id === A.id);
      b.classList.toggle('is-b', id === B.id);
    });
    // нижняя шкала едет: её ноль — под ярким объектом A
    const shift = x(A.m) * 10;
    if (animate) gsap.to(this.flux, { attr: { transform: `translate(${shift} 0)` }, duration: 0.9, ease: 'expo.out' });
    else this.flux.setAttribute('transform', `translate(${shift} 0)`);
    const set = { left: `${x(A.m)}%`, width: `${x(B.m) - x(A.m)}%` };
    if (animate) gsap.to(this.bracket, { ...set, duration: 0.9, ease: 'expo.out' }); else gsap.set(this.bracket, set);
    this.bracket.querySelector('.tc-br-m')!.textContent = `Δm = ${fmtNum(dm, L, 2)}`;
    this.bracket.querySelector('.tc-br-f')!.textContent = fmtNum(k, L, 2);

    const approx = A.approx || B.approx;
    const ratio = Math.pow(10, k);
    let ratioTex: string;
    if (ratio < 1000) ratioTex = texNum(fmtNum(ratio, 'en', ratio < 10 ? 2 : 0, false));
    else {
      const e = Math.floor(k);
      const mant = Math.pow(10, k - e);
      ratioTex = `${texNum(mant.toFixed(1))}\\cdot 10^{${e}}`;
    }
    const n2 = (v: number) => texNum(v.toFixed(2));
    this.out.innerHTML = tex(
      `\\dfrac{F_{\\mathrm{A}}}{F_{\\mathrm{B}}} = 10^{${texNum('0.4')}\\,\\Delta m} = 10^{${texNum('0.4')}\\cdot ${n2(dm)}} = 10^{${n2(k)}} \\approx ${ratioTex}`,
      true,
    );
    this.legend.innerHTML =
      `<span class="lg lg-a"><b>A</b> ${t(`obj.${A.id}`)} · m = ${A.approx ? '≈ ' : ''}${fmtMag(A.m, L, A.approx ? 0 : 2)}</span>` +
      `<span class="lg lg-b"><b>B</b> ${t(`obj.${B.id}`)} · m = ${B.approx ? '≈ ' : ''}${fmtMag(B.m, L, B.approx ? 0 : 2)}</span>`;
    this.orders.textContent = `${approx ? '' : ''}${t('tool.compare.orders', { k: fmtNum(k, L, 1) })}`;
  }
}
