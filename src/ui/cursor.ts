/**
 * Курсор — перекрестие искателя телескопа. Над интерактивом сжимается в кольцо со шкалой.
 * Через 2,5 с бездействия прячется вместе с системным курсором (режим показа на проекторе).
 */
export class Cursor {
  private el: HTMLElement;
  private x = -100; private y = -100; private tx = -100; private ty = -100;
  private idleTimer = 0;
  readonly enabled: boolean;

  constructor() {
    this.el = document.getElementById('cursor')!;
    this.enabled = matchMedia('(pointer: fine)').matches;
    const root = document.documentElement;
    const wake = () => {
      root.classList.remove('is-idle');
      clearTimeout(this.idleTimer);
      this.idleTimer = window.setTimeout(() => root.classList.add('is-idle'), 2500);
    };
    window.addEventListener('pointermove', (e) => {
      this.tx = e.clientX; this.ty = e.clientY;
      wake();
    }, { passive: true });
    window.addEventListener('pointerdown', wake, { passive: true });
    if (!this.enabled) { this.el.remove(); return; }
    root.classList.add('has-cursor');
    document.addEventListener('pointerover', (e) => {
      const hot = (e.target as Element).closest?.('a, button, [role="button"], input, .is-hot');
      this.el.classList.toggle('is-hot', !!hot);
    });
    document.addEventListener('pointerleave', () => this.el.classList.add('is-out'));
    document.addEventListener('pointerenter', () => this.el.classList.remove('is-out'));
    wake();
  }

  tick() {
    if (!this.enabled) return;
    this.x += (this.tx - this.x) * 0.35;
    this.y += (this.ty - this.y) * 0.35;
    this.el.style.transform = `translate3d(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px, 0)`;
  }

  get pos() { return { x: this.tx, y: this.ty }; }
}
