import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { BEATS, type Beat } from '../content/scenes.ts';
import { t, tHtml, lang } from '../i18n/index.ts';
import { fmtNum } from '../i18n/format.ts';
import { FORMULAS } from './formulas.ts';

gsap.registerPlugin(SplitText);

export interface BeatHooks {
  /** вставить инструмент в слот бита */
  mountTool?: (beat: Beat, slot: HTMLElement) => void;
  heroExtra?: () => string;
  /** дополнительный блок рядом с текстом (таблица Непера, пластинка «VAR!», оси Г–Р) */
  extra?: (id: NonNullable<Beat['extra']>) => string;
  sources?: () => string;
  /** статичный кадр сцены (версия без WebGL) */
  figure?: (b: Beat) => string;
}

/**
 * Текст бита: строки проявляются слева направо за тонкой латунной линией «резца»,
 * заголовок — пословно из маски. Содержимое собирается из словаря при каждом показе,
 * поэтому смена языка просто перерисовывает активный бит.
 */
class BeatView {
  private splits: SplitText[] = [];
  private tl: gsap.core.Timeline | null = null;
  shown = false;
  constructor(readonly beat: Beat, readonly el: HTMLElement, private hooks: BeatHooks, private reduced: boolean) {}

  render() {
    this.revert();
    const b = this.beat;
    const parts: string[] = [];
    if (b.kind === 'hero') {
      parts.push(`<h1 class="hero-title">${tHtml('hero.title')}</h1>`);
      parts.push(`<p class="hero-sub">${tHtml('hero.sub')}</p>`);
      parts.push('<div class="hero-lines">');
      for (const k of b.lines) parts.push(`<p class="line">${tHtml(k)}</p>`);
      parts.push('</div>');
    } else if (b.kind === 'sources') {
      parts.push(this.hooks.sources ? this.hooks.sources() : '');
    } else {
      const nTxt = fmtNum(Math.min(b.p, 27), lang(), 1);
      const logTxt = b.p > 27 ? t('hud.end') : `log₁₀ d = ${nTxt}`;
      parts.push(`<p class="kicker"><span class="kicker-log">${logTxt}</span><span class="kicker-sep" aria-hidden="true"></span><span>${tHtml(b.kicker!)}</span></p>`);
      parts.push(`<h2 class="sr-only">${tHtml(b.kicker!)}</h2>`);
      const at = b.formulaAt ?? 3;
      b.lines.forEach((k, i) => {
        if (b.formula && i === at) parts.push(`<div class="formula" role="math">${FORMULAS[b.formula]()}</div>`);
        parts.push(`<p class="line">${tHtml(k)}</p>`);
      });
      if (b.formula && at >= b.lines.length) parts.push(`<div class="formula" role="math">${FORMULAS[b.formula]()}</div>`);
      if (b.note) parts.push(`<p class="note">${tHtml(b.note)}</p>`);
      if (b.tool) parts.push('<div class="tool-slot"></div>');
    }    let extra = b.kind === 'hero' && this.hooks.heroExtra ? `<p class="sky-caption">${this.hooks.heroExtra()}</p>` : '';
    if (b.extra && this.hooks.extra) extra += this.hooks.extra(b.extra);
    if (this.hooks.figure) parts.unshift(this.hooks.figure(b));
    this.el.innerHTML = `<div class="beat-inner${b.align === 'wide' ? ' is-wide' : ''}">${parts.join('')}</div>${extra}`;
    const slot = this.el.querySelector<HTMLElement>('.tool-slot');
    if (slot && this.hooks.mountTool) this.hooks.mountTool(b, slot);
  }

  private revert() {
    this.tl?.kill();
    this.tl = null;
    this.splits.forEach((s) => s.revert());
    this.splits = [];
  }

  show(fast = false) {
    this.render();
    this.shown = true;
    this.el.classList.add('is-active');
    this.el.removeAttribute('aria-hidden');
    gsap.killTweensOf(this.el);
    gsap.set(this.el, { autoAlpha: 1, y: 0 });
    if (this.reduced) {
      gsap.fromTo(this.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ease: 'power1.out' });
      return;
    }
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    const title = this.el.querySelector<HTMLElement>('.hero-title');
    if (title) {
      const s = SplitText.create(title, { type: 'words', mask: 'words', wordsClass: 'w' });
      this.splits.push(s);
      tl.from(s.words, { yPercent: 115, duration: fast ? 0.6 : 1.25, ease: 'expo.out', stagger: 0.07 });
    }
    const lineEls: HTMLElement[] = [];
    this.el.querySelectorAll<HTMLElement>('.kicker, .hero-sub, .line, .note, .sky-caption, .src-intro').forEach((p) => {
      const s = SplitText.create(p, { type: 'lines', linesClass: 'ln' });
      this.splits.push(s);
      lineEls.push(...(s.lines as HTMLElement[]));
    });
    tl.fromTo(lineEls, { '--p': 0, opacity: 0.25 }, { '--p': 1, opacity: 1, duration: fast ? 0.45 : 0.95, ease: 'power2.inOut', stagger: fast ? 0.05 : 0.11 }, title ? 0.35 : 0);
    const formula = this.el.querySelector<HTMLElement>('.formula');
    if (formula) tl.fromTo(formula, { '--p': 0, opacity: 0 }, { '--p': 1, opacity: 1, duration: 1.1, ease: 'power2.inOut' }, fast ? 0.15 : 0.55);
    const side = this.el.querySelector<HTMLElement>('.beat-extra');
    if (side) tl.fromTo(side, { autoAlpha: 0, x: 24 }, { autoAlpha: 1, x: 0, duration: 1.1, ease: 'expo.out' }, fast ? 0.1 : 0.45);
    const src = this.el.querySelectorAll<HTMLElement>('.src-group');
    if (src.length) tl.fromTo(src, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08 }, 0.2);
    const tool = this.el.querySelector<HTMLElement>('.tool-slot');
    if (tool) tl.fromTo(tool, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.8 }, fast ? 0.2 : 0.9);
    this.tl = tl;
  }

  hide(fast = false) {
    if (!this.shown) return;
    this.shown = false;
    this.tl?.kill();
    this.el.setAttribute('aria-hidden', 'true');
    gsap.to(this.el, {
      autoAlpha: 0, y: this.reduced ? 0 : -10, duration: fast ? 0.18 : 0.45, ease: 'power2.in',
      onComplete: () => { this.el.classList.remove('is-active'); this.revert(); },
    });
  }
}

export class BeatsController {
  private views: BeatView[];
  private active: BeatView | null = null;
  constructor(root: HTMLElement, hooks: BeatHooks, private reduced: boolean) {
    this.views = BEATS.map((b) => {
      const el = document.createElement('section');
      el.className = `beat beat--${b.kind}`;
      el.id = `b-${b.id}`;
      el.dataset.beat = b.id;
      el.setAttribute('aria-hidden', 'true');
      root.appendChild(el);
      return new BeatView(b, el, hooks, reduced);
    });
  }

  get current(): Beat | null { return this.active?.beat ?? null; }

  update(n: number, flying: boolean, velocity: number) {
    if (flying) {
      if (this.active) { this.active.hide(true); this.active = null; }
      return;
    }
    const cand = this.views.find((v) => n >= v.beat.win[0] && n <= v.beat.win[1]) ?? null; // n здесь — положение p
    if (cand !== this.active && this.active) { this.active.hide(); this.active = null; }
    if (cand && !this.active && velocity < (this.reduced ? 1e9 : 14)) {
      cand.show();
      this.active = cand;
    }
  }

  relocalize() {
    if (this.active) this.active.show(true);
  }

  /** Статичная версия (без WebGL): все биты видны в потоке документа. */
  renderStatic() {
    for (const v of this.views) {
      v.render();
      v.el.classList.add('is-active');
      v.el.removeAttribute('aria-hidden');
      gsap.set(v.el, { autoAlpha: 1 });
    }
  }
}

export const beatTitle = (b: Beat) => t(`beat.${b.id}`);
