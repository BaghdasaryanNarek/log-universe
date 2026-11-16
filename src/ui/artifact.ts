import { gsap } from 'gsap';
import { t } from '../i18n/index.ts';

/**
 * Архивное изображение сцены: аккуратная миниатюра в текстовой колонке и раскрытие
 * по запросу (лайтбокс). 3D-сцена справа — «окно в космос» — остаётся свободной,
 * пока зритель сам не попросит изображение.
 */
export type ArtifactId = 'napier' | 'var';

export interface ArtifactDef {
  /** подпись миниатюры в одну строку: год и название */
  caption: () => string;
  /** подпись под раскрытым изображением */
  note: () => string;
  /** содержимое изображения (HTML/SVG); миниатюра — его уменьшенная копия */
  body: () => string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const ICON = '<svg class="artifact-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9"/></svg>';

export class Artifacts {
  private box: HTMLElement;
  private content: HTMLElement;
  private cap: HTMLElement;
  private closeBtn: HTMLButtonElement;
  private openId: ArtifactId | null = null;

  constructor(private defs: Record<ArtifactId, ArtifactDef>, private reduced: boolean) {
    this.box = document.createElement('div');
    this.box.id = 'lightbox';
    this.box.setAttribute('role', 'dialog');
    this.box.setAttribute('aria-modal', 'true');
    this.box.setAttribute('aria-labelledby', 'lb-cap');
    this.box.hidden = true;
    this.box.innerHTML = `<div class="lb-backdrop"></div>
      <figure class="lb-figure">
        <button type="button" class="lb-close"><span aria-hidden="true">×</span></button>
        <div class="lb-content"></div>
        <figcaption id="lb-cap" class="lb-cap"></figcaption>
      </figure>`;
    document.body.appendChild(this.box);
    this.content = this.box.querySelector('.lb-content')!;
    this.cap = this.box.querySelector('.lb-cap')!;
    this.closeBtn = this.box.querySelector('.lb-close')!;
    this.closeBtn.addEventListener('click', () => this.close());
    this.box.querySelector('.lb-backdrop')!.addEventListener('click', () => this.close());
    // фокус не выходит из окна
    this.box.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); this.closeBtn.focus(); } });
    // колесо мыши тоже закрывает
    window.addEventListener('wheel', () => { if (this.openId) this.close(); }, { passive: true });
    // клики по миниатюрам (делегирование: миниатюры пересоздаются при смене языка)
    document.addEventListener('click', (e) => {
      const btn = (e.target as Element).closest?.<HTMLElement>('.artifact[data-artifact]');
      if (btn) this.open(btn.dataset.artifact as ArtifactId);
    });
  }

  /** Разметка миниатюры для текстовой колонки. */
  thumb(id: ArtifactId): string {
    const d = this.defs[id];
    const cap = d.caption();
    return `<button type="button" class="artifact artifact--${id}" data-artifact="${id}" aria-haspopup="dialog" aria-label="${esc(t('artifact.open', { name: cap }))}">
      <span class="artifact-mini" aria-hidden="true"><span class="artifact-mini-in">${d.body()}</span></span>
      <span class="artifact-cap" aria-hidden="true"><span>${esc(cap)}</span>${ICON}</span>
    </button>`;
  }

  get isOpen() { return this.openId !== null; }

  open(id: ArtifactId) {
    const d = this.defs[id];
    this.openId = id;
    this.content.className = `lb-content lb-content--${id}`;
    this.content.innerHTML = d.body();
    this.cap.innerHTML = `<b>${esc(d.caption())}</b><span>${esc(d.note())}</span>`;
    this.closeBtn.setAttribute('aria-label', t('artifact.close'));
    this.box.hidden = false;
    document.documentElement.classList.add('lb-open');
    gsap.killTweensOf(this.box);
    // только opacity: visibility:hidden не дал бы перевести фокус на кнопку ×
    gsap.fromTo(this.box, { opacity: 0 }, { opacity: 1, duration: this.reduced ? 0.2 : 0.3, ease: 'power1.out' });
    if (!this.reduced) gsap.fromTo(this.box.querySelector('.lb-figure'), { y: 10 }, { y: 0, duration: 0.35, ease: 'power2.out' });
    this.closeBtn.focus();
  }

  close() {
    if (!this.openId) return;
    const id = this.openId;
    this.openId = null;
    document.documentElement.classList.remove('lb-open');
    gsap.killTweensOf(this.box);
    gsap.to(this.box, { opacity: 0, duration: 0.2, ease: 'power1.in', onComplete: () => { if (!this.openId) { this.box.hidden = true; this.content.innerHTML = ''; } } });
    // фокус возвращается на миниатюру, с которой открывали
    document.querySelector<HTMLElement>(`.beat.is-active .artifact[data-artifact="${id}"]`)?.focus({ preventScroll: true });
  }

  /** Клавиша I: открыть изображение текущей сцены или закрыть открытое. */
  toggleFor(id: ArtifactId | undefined) {
    if (this.openId) { this.close(); return; }
    if (id) this.open(id);
  }
}
