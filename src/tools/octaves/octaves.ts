import { t, lang } from '../../i18n/index.ts';
import { fmtNum } from '../../i18n/format.ts';
import type { AudioEngine } from '../../audio/engine.ts';

/**
 * Вебер — Фехнер на слух. Два ряда тонов: арифметический (+220 Гц) и геометрический (×2).
 * На шкале частот (логарифмической, как и слух) арифметические шаги сжимаются,
 * а октавы стоят на равных расстояниях — так их и слышно.
 */
const LIN = [220, 440, 660, 880];
const GEO = [220, 440, 880, 1760];
const F0 = 200, F1 = 2000;
const x = (f: number) => (Math.log(f / F0) / Math.log(F1 / F0)) * 100;

export class OctavesTool {
  readonly el: HTMLElement;
  constructor(private audio: AudioEngine) {
    this.el = document.createElement('div');
    this.el.className = 'tool oc';
    this.el.setAttribute('role', 'group');
    this.render();
  }

  render() {
    const L = lang();
    const row = (id: string, label: string, note: string, fs: number[]) => `
      <div class="oc-row" data-row="${id}">
        <button type="button" class="oc-play" data-seq="${id}"><span class="oc-tri" aria-hidden="true"></span>${label}</button>
        <div class="oc-axis" aria-hidden="true">${fs.map((f, i) => `<span class="oc-note" data-i="${i}" style="left:${x(f)}%">${fmtNum(f, L, 0, f >= 10000)}</span>`).join('')}</div>
        <p class="oc-note-t">${note}</p>
      </div>`;
    this.el.setAttribute('aria-label', t('weber.tool'));
    this.el.innerHTML = `<div class="tool-head"><h3 class="tool-title">${t('weber.tool')}</h3></div>
      ${row('lin', t('weber.lin'), t('weber.linNote'), LIN)}${row('geo', t('weber.geo'), t('weber.geoNote'), GEO)}`;
    this.el.querySelectorAll<HTMLButtonElement>('.oc-play').forEach((b) => {
      b.addEventListener('click', () => {
        const id = b.dataset.seq!;
        const notes = this.el.querySelectorAll<HTMLElement>(`[data-row="${id}"] .oc-note`);
        b.classList.add('is-playing');
        void this.audio.sequence(id === 'lin' ? LIN : GEO, (i) => {
          notes.forEach((n, j) => n.classList.toggle('is-on', j === i));
          if (i < 0) b.classList.remove('is-playing');
        });
      });
    });
  }
}
