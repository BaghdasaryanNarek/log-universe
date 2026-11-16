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
}

const isTyping = (el: Element | null) =>
  !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);

/**
 * Клавиши докладчика. Кликеры шлют PageUp/PageDown (иногда стрелки), кнопка
 * «чёрный экран» — B или «.», кнопка «старт показа» — F5 (у нас это полный экран).
 * Буквенные клавиши не пересекаются с n, a, p, i, e, r — пасхалка «napier».
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
    const inTool = !!target?.closest('.tool');
    const k = e.key;

    if (k === 'Escape') {
      if (a.helpOpen()) { a.toggleHelp(false); e.preventDefault(); return; }
      if (inTool) { (target as HTMLElement).blur(); e.preventDefault(); }
      return;
    }
    if (a.helpOpen() && k !== 'h' && k !== 'H' && k !== '?') return;

    let go: number | undefined;
    switch (k) {
      case 'ArrowRight': case 'PageDown':
        if (inTool && k === 'ArrowRight') return;
        go = nextN(1); break;
      case 'ArrowLeft': case 'PageUp':
        if (inTool && k === 'ArrowLeft') return;
        go = nextN(-1); break;
      case ' ':
        if (target instanceof HTMLButtonElement) return;
        go = nextN(e.shiftKey ? -1 : 1); break;
      case 'Home': go = BEATS[0].p; break;
      case 'End': go = BEATS[BEATS.length - 1].p; break;
      case 'f': case 'F': case 'F5': a.toggleFullscreen(); e.preventDefault(); return;
      case 'l': case 'L': a.cycleLang(); return;
      case 'm': case 'M': a.toggleSound(); return;
      case 'k': case 'K': a.toggleBoost(); return;
      case 'b': case 'B': case '.': a.toggleBlack(); return;
      case 'h': case 'H': case '?': a.toggleHelp(); e.preventDefault(); return;
      case 'D': if (e.shiftKey) a.toggleDebug(); return;
      default:
        if (/^[1-9]$/.test(k)) {
          const b = BEATS.find((x) => x.scene === Number(k));
          if (b) go = b.p;
        }
    }
    if (go !== undefined) {
      e.preventDefault();
      a.fly(go);
    } else if (['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(k)) {
      // край пути — гасим нативную прокрутку, чтобы не было рывка
      e.preventDefault();
    }
  });
}
