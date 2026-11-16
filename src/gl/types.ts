import type { Object3D } from 'three';
import type { V3 } from '../core/vec.ts';

/** Состояние кадра. Мировые координаты — метры, экваториальная система ICRS, начало — Солнце. */
export interface Frame {
  n: number;
  /** положение на прокрутке (после 27 — финальные разделы) */
  p: number;
  /** d = 10^n м: расстояние камеры до фокуса и ширина кадра */
  d: number;
  cam: V3;
  R: V3; U: V3; V: V3;
  time: number;
  width: number; height: number; dpr: number;
  /** масштаб пиксельных размеров относительно 1080p */
  pxScale: number;
  reduced: boolean;
}

export interface Layer {
  object: Object3D;
  update(f: Frame): void;
  dispose(): void;
}

/** Мировая точка → координаты рендера (камера в начале, единица длины = d). */
export const toRender = (w: V3, f: Frame): [number, number, number] =>
  [(w[0] - f.cam[0]) / f.d, (w[1] - f.cam[1]) / f.d, (w[2] - f.cam[2]) / f.d];
