import type { V3 } from '../core/vec.ts';
import { smoothstep } from '../core/vec.ts';
import type { Engine } from '../gl/engine.ts';

export interface LabelDef {
  key: string;
  text: () => string;
  sub?: () => string;
  target: V3;
  /** окно n, в котором подпись видна */
  range: [number, number];
  /** смещение текста от точки, px при 1080p */
  off: [number, number];
  /** пульсирующая точка (цефеида) */
  pulse?: boolean;
}

/**
 * Подписи-выноски, как на гравюре: точка → тонкая латунная линия → текст.
 * DOM поверх canvas — текст настоящий, выделяется и переводится.
 */
export class Labels {
  private items: { def: LabelDef; el: HTMLElement; txt: HTMLElement; sub: HTMLElement | null; lead: HTMLElement; last: string }[] = [];
  constructor(private root: HTMLElement, private engine: Engine) {}

  set(defs: LabelDef[]) {
    this.root.innerHTML = '';
    this.items = defs.map((def) => {
      const el = document.createElement('div');
      el.className = def.pulse ? 'label is-pulse' : 'label';
      el.innerHTML = `<span class="label-lead"></span><span class="label-dot"></span><span class="label-box"><span class="label-t"></span>${def.sub ? '<span class="label-s"></span>' : ''}</span>`;
      this.root.appendChild(el);
      return { def, el, txt: el.querySelector('.label-t')!, sub: el.querySelector('.label-s'), lead: el.querySelector('.label-lead')!, last: '' };
    });
    this.relocalize();
  }

  relocalize() { for (const it of this.items) { it.txt.textContent = it.def.text(); it.last = ''; } }

  update(n: number, scale: number) {
    // подпись не должна оказываться под текстом, инструментом или вставкой активной остановки,
    // а также в полосе шапки и в зоне HUD справа
    const occs = [...document.querySelectorAll<HTMLElement>('.beat.is-active .beat-inner, .beat.is-active .beat-extra')].map((e) => e.getBoundingClientRect());
    const W = innerWidth, H = innerHeight;
    for (const it of this.items) {
      const [a, b] = it.def.range;
      const op = smoothstep(a, a + 0.35, n) * (1 - smoothstep(b - 0.35, b, n));
      if (op <= 0.001) { if (it.el.style.opacity !== '0') it.el.style.opacity = '0'; continue; }
      const p = this.engine.project(it.def.target);
      if (!p || p.x < -50 || p.y < -50 || p.x > W + 50 || p.y > H + 50) { it.el.style.opacity = '0'; continue; }
      const dx = it.def.off[0] * scale, dy = it.def.off[1] * scale;
      const bw = it.el.querySelector<HTMLElement>('.label-box')!.offsetWidth;
      const tx = p.x + dx;
      const x0 = Math.min(p.x, dx < 0 ? tx - bw : tx), x1 = Math.max(p.x, dx < 0 ? tx : tx + bw);
      const y0 = Math.min(p.y, p.y + dy) - 22, y1 = Math.max(p.y, p.y + dy) + 22;
      const hit = occs.some((o) => x1 > o.left - 12 && x0 < o.right + 12 && y1 > o.top - 12 && y0 < o.bottom + 12);
      const zone = y0 < H * 0.1 || (x1 > W * 0.86 && y0 < H * 0.42) || x1 > W - 70;
      if (hit || zone) { it.el.style.opacity = '0'; continue; }
      it.el.style.opacity = op.toFixed(3);
      it.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      const box = it.el.querySelector<HTMLElement>('.label-box')!;
      box.style.transform = `translate(${dx}px, ${dy}px) translate(${dx < 0 ? '-100%' : '0'}, -50%)`;
      const len = Math.hypot(dx, dy) - 6;
      it.lead.style.width = `${Math.max(0, len)}px`;
      it.lead.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      if (it.sub && it.def.sub) {
        const s = it.def.sub();
        if (s !== it.last) { it.last = s; it.sub.textContent = s; }
      }
    }
  }
}
