import { gsap } from 'gsap';
import { t, onLang } from '../i18n/index.ts';

/**
 * Две пасхалки.
 * 1. «napier» на клавиатуре — весь кадр превращается в гравюру 1614 года (повтор — обратно).
 * 2. Spira mirabilis — три клика по спирали в логотипе: история надгробия Якоба Бернулли;
 *    логарифмическая спираль «ошибкой резчика» перетекает в архимедову.
 */
export function installEggs(opts: { setEngrave: (v: number) => void; getEngrave: () => number; reduced: boolean }) {
  const root = document.documentElement;
  // ── napier ──
  const word = 'napier';
  let buf = '';
  const card = document.createElement('div');
  card.className = 'egg-card';
  card.setAttribute('role', 'status');
  document.body.appendChild(card);
  const state = { v: 0 };
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    const el = document.activeElement;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
    buf = (buf + e.key.toLowerCase()).slice(-word.length);
    if (buf !== word) return;
    buf = '';
    const on = opts.getEngrave() < 0.5;
    root.classList.toggle('engraving', on);
    state.v = opts.getEngrave();
    gsap.to(state, { v: on ? 1 : 0, duration: opts.reduced ? 0.01 : 1.6, ease: 'power2.inOut', onUpdate: () => opts.setEngrave(state.v) });
    if (on) {
      card.innerHTML = `<span class="egg-card-t">${t('egg.napierTitle')}</span><span class="egg-card-s">${t('egg.napierSub')}</span>`;
      gsap.fromTo(card, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.9, delay: 0.6 });
      gsap.to(card, { autoAlpha: 0, duration: 0.9, delay: 4.2 });
    }
  });

  // ── Spira mirabilis ──
  const mark = document.querySelector<HTMLElement>('.brand-mark');
  const dlg = document.createElement('div');
  dlg.id = 'spira';
  dlg.setAttribute('role', 'dialog');
  dlg.setAttribute('aria-modal', 'true');
  dlg.hidden = true;
  document.body.appendChild(dlg);
  const render = () => {
    dlg.setAttribute('aria-label', t('egg.spiraTitle'));
    dlg.innerHTML = `<div class="spira-card">
      <svg viewBox="-110 -110 220 220" class="spira-svg" aria-hidden="true"><path class="spira-path"/><circle r="2" class="spira-c"/></svg>
      <div class="spira-text"><h2>${t('egg.spiraTitle')}</h2>
        <p class="spira-motto">Eadem mutata resurgo</p>
        <p>${t('egg.spira1')}</p><p>${t('egg.spira2')}</p><p>${t('egg.spira3')}</p>
        <p class="spira-legend"><span class="sl-log">${t('egg.logLabel')}</span><span class="sl-arch">${t('egg.archLabel')}</span></p>
        <button type="button" class="help-close">${t('egg.close')}</button></div></div>`;
    dlg.querySelector('.help-close')!.addEventListener('click', close);
  };
  // r(θ): смесь логарифмической (b = tg 13°) и архимедовой спиралей с одинаковым внешним радиусом
  const b = Math.tan((13 * Math.PI) / 180);
  const TURNS = 3.2, R = 100;
  const pathAt = (k: number, draw: number) => {
    const th1 = TURNS * 2 * Math.PI;
    let d = '';
    const N = 420;
    for (let i = 0; i <= N * draw; i++) {
      const th = (i / N) * th1;
      const rLog = R * Math.exp(b * (th - th1));
      const rArch = (R * th) / th1;
      const r = rLog * (1 - k) + rArch * k;
      d += `${i ? 'L' : 'M'}${(r * Math.cos(th)).toFixed(2)} ${(-r * Math.sin(th)).toFixed(2)}`;
    }
    return d;
  };
  const anim = { draw: 0, k: 0 };
  let tl: gsap.core.Timeline | null = null;
  const open = () => {
    render();
    dlg.hidden = false;
    dlg.querySelector<HTMLButtonElement>('.help-close')!.focus();
    const path = dlg.querySelector<SVGPathElement>('.spira-path')!;
    const upd = () => { path.setAttribute('d', pathAt(anim.k, anim.draw)); dlg.classList.toggle('is-arch', anim.k > 0.5); };
    tl?.kill();
    anim.draw = 0; anim.k = 0;
    tl = gsap.timeline({ onUpdate: upd })
      .to(anim, { draw: 1, duration: opts.reduced ? 0.01 : 3, ease: 'power2.inOut' })
      .to(anim, { k: 1, duration: opts.reduced ? 0.01 : 2.4, ease: 'power3.inOut', delay: 1.4 })
      .to(anim, { k: 0, duration: opts.reduced ? 0.01 : 2.4, ease: 'power3.inOut', delay: 2.4 })
      .repeat(-1).repeatDelay(1.2);
    upd();
  };
  const close = () => { dlg.hidden = true; tl?.kill(); mark?.focus(); };
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !dlg.hidden) close(); });
  onLang(() => { if (!dlg.hidden) { render(); } });
  if (mark) {
    mark.setAttribute('role', 'button');
    mark.tabIndex = 0;
    mark.setAttribute('aria-label', 'Spira mirabilis');
    let clicks = 0, timer = 0;
    const hit = () => {
      clicks++;
      clearTimeout(timer);
      timer = window.setTimeout(() => { clicks = 0; }, 1400);
      gsap.fromTo(mark, { rotate: 0 }, { rotate: 360 * clicks, duration: 0.6, ease: 'power2.out' });
      if (clicks >= 3) { clicks = 0; open(); }
    };
    mark.addEventListener('click', hit);
    mark.addEventListener('keydown', (e) => { if (e.key === 'Enter') hit(); });
  }
  return { isOpen: () => !dlg.hidden };
}
