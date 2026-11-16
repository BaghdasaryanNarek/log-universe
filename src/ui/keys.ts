import { BEATS } from '../content/scenes.ts';

export interface KeyActions {
  current: () => number;
  fly: (n: number) => void;
  toggleFullscreen: () => void;
  cycleLang: () => void;
  toggleSound: () => void;
  toggleBoost: () => void;
  toggleBlack: () => void;
  toggleHelp: (force?: boolean) => void;
  helpOpen: () => boolean;
  toggleDebug: () => void;
  /** лайтбокс архивного изображения */
  imageOpen: () => boolean;
  closeImage: () => void;
  toggleImage: () => void;
  /** игрок набирает «napier» — буква I в этот момент не открывает изображение */
  eggPending: () => boolean;
}

const isTyping = (el: Element | null) =>
  !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);

const NAV = new Set(['ArrowRight', 'PageDown', 'ArrowLeft', 'PageUp', ' ']);

/**
 * Клавиши докладчика. Кликеры шлют PageUp/PageDown (иногда стрелки), кнопка
 * «чёрный экран» — B или «.», кнопка «старт показа» — F5 (у нас это полный экран).
 * Буквы и цифры читаются по event.code — физической клавише, поэтому работают
 * в любой раскладке (HY / RU / EN).
 */
export function installKeys(a: KeyActions) {
  const nextN = (dir: 1 | -1) => {
    const n = a.current();
    const list = BEATS.map((b) => b.p);
    if (dir > 0) return list.find((x) => x > n + 0.05);
    return [...list].reverse().find((x) => x < n - 0.05);
  };

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = document.activeElement;
    if (isTyping(target)) return;
    const k = e.key, c = e.code;

    // Открытое изображение: первое «дальше/назад» только закрывает его — докладчик с кликером не проскочит сцену
    if (a.imageOpen()) {
      if (k === 'Escape' || NAV.has(k) || c === 'KeyI') { e.preventDefault(); a.closeImage(); return; }
      if (c === 'KeyF' || k === 'F5') { e.preventDefault(); a.toggleFullscreen(); }
      return;
    }

    const inTool = !!target?.closest('.tool');
    if (k === 'Escape') {
      if (a.helpOpen()) { a.toggleHelp(false); e.preventDefault(); return; }
      if (inTool) { (target as HTMLElement).blur(); e.preventDefault(); }
      return;
    }
    if (a.helpOpen() && c !== 'KeyH' && c !== 'Slash') return;

    let go: number | undefined;
    switch (k) {
      case 'ArrowRight': case 'PageDown':
        if (inTool && k === 'ArrowRight') return;
        go = nextN(1); break;
      case 'ArrowLeft': case 'PageUp':
        if (inTool && k === 'ArrowLeft') return;
        go = nextN(-1); break;
      case ' ':
        if (target instanceof HTMLButtonElement) return; // пробел на кнопке — её нажатие
        go = nextN(e.shiftKey ? -1 : 1); break;
      case 'Home': go = BEATS[0].p; break;
      case 'End': go = BEATS[BEATS.length - 1].p; break;
      case 'F5': a.toggleFullscreen(); e.preventDefault(); return;
    }
    if (go === undefined) {
      switch (c) {
        case 'KeyF': a.toggleFullscreen(); e.preventDefault(); return;
        case 'KeyL': a.cycleLang(); return;
        case 'KeyM': a.toggleSound(); return;
        case 'KeyK': a.toggleBoost(); return;
        case 'KeyB': case 'Period': case 'NumpadDecimal': a.toggleBlack(); return;
        case 'KeyH': a.toggleHelp(); e.preventDefault(); return;
        case 'Slash': if (e.shiftKey) { a.toggleHelp(); e.preventDefault(); } return;
        case 'KeyI': if (!a.eggPending()) { a.toggleImage(); e.preventDefault(); } return;
        case 'KeyD': if (e.shiftKey) a.toggleDebug(); return;
      }
      const digit = /^(?:Digit|Numpad)([1-9])$/.exec(c);
      if (digit) {
        const b = BEATS.find((x) => x.scene === Number(digit[1]));
        if (b) go = b.p;
      }
    }
    if (go !== undefined) {
      e.preventDefault();
      a.fly(go);
    } else if (NAV.has(k) || k === 'Home' || k === 'End') {
      // край пути — гасим нативную прокрутку, чтобы не было рывка
      e.preventDefault();
    }
  });
}
