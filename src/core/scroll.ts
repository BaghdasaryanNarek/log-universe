import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { N_MAX } from '../content/scenes.ts';
import { clamp } from './vec.ts';

gsap.registerPlugin(ScrollTrigger);

/**
 * Прокрутка — логарифмическая линейка: n = log₁₀(d / 1 м) линейно зависит от scrollY.
 * Одно деление (×10) = DECADE_VH высот экрана.
 */
export const DECADE_VH = 1.0;

/** Кинематографичная кривая: плавный разгон и долгое торможение (квартика). */
export const cinematic = (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);

export class LogScroll {
  readonly lenis: Lenis;
  n = 0;
  flying = false;
  private flightEnd: (() => void) | null = null;
  private spacer: HTMLElement;

  constructor(spacer: HTMLElement, private reduced: boolean) {
    this.spacer = spacer;
    this.layout();
    this.lenis = new Lenis({ lerp: reduced ? 1 : 0.085, wheelMultiplier: 0.9, smoothWheel: !reduced });
    this.lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => this.lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.create({
      trigger: spacer,
      start: 'top top',
      end: () => `+=${this.journeyPx()}`,
      onUpdate: (self) => { this.n = clamp(self.progress * N_MAX, 0, N_MAX); },
    });
    window.addEventListener('resize', () => this.onResize());
  }

  decadePx() { return window.innerHeight * DECADE_VH; }
  journeyPx() { return this.decadePx() * N_MAX; }
  scrollFor(n: number) { return clamp(n, 0, N_MAX) * this.decadePx(); }

  private layout() {
    this.spacer.style.height = `${this.journeyPx() + window.innerHeight}px`;
  }

  private onResize() {
    const n = this.n;
    this.layout();
    ScrollTrigger.refresh();
    this.lenis.scrollTo(this.scrollFor(n), { immediate: true, force: true });
  }

  /** Перелёт к отметке n. Длительность растёт с числом пройденных порядков. */
  flyTo(n: number, onDone?: () => void): void {
    const dn = Math.abs(n - this.n);
    this.flightEnd?.();
    this.flying = true;
    const done = () => { this.flying = false; this.flightEnd = null; onDone?.(); };
    this.flightEnd = () => { this.flying = false; };
    if (this.reduced || dn < 1e-3) {
      this.lenis.scrollTo(this.scrollFor(n), { immediate: true, force: true, lock: true });
      this.n = n;
      requestAnimationFrame(done);
      return;
    }
    const duration = clamp(1.15 + 0.17 * dn, 1.15, 4.6);
    this.lenis.scrollTo(this.scrollFor(n), { duration, easing: cinematic, lock: true, force: true, onComplete: done });
  }

  get velocity() { return Math.abs(this.lenis.velocity); }
}
