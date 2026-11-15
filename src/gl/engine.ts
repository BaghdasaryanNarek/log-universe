import * as THREE from 'three';
import { BloomEffect, EffectComposer, EffectPass, NoiseEffect, RenderPass, VignetteEffect, BlendFunction } from 'postprocessing';
import type { V3 } from '../core/vec.ts';
import { dot, sub } from '../core/vec.ts';
import { HFOV, type CamPose } from './rig.ts';
import type { Frame, Layer } from './types.ts';

export type Tier = 'high' | 'med' | 'low';

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private bloom: BloomEffect;
  private layers: Layer[] = [];
  private basis = new THREE.Matrix4();
  private tmp = new THREE.Vector3();
  tier: Tier = 'high';
  frame!: Frame;
  reduced = false;
  private dprCap = 1.5;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, stencil: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor('#07080c', 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 1e-4, 1e5);
    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new BloomEffect({ luminanceThreshold: 0.42, luminanceSmoothing: 0.25, intensity: 0.85, mipmapBlur: true, radius: 0.62 });
    const vignette = new VignetteEffect({ offset: 0.3, darkness: 0.5 });
    const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
    noise.blendMode.opacity.value = 0.18;
    this.composer.addPass(new EffectPass(this.camera, this.bloom, vignette, noise));
    this.resize();
  }

  add(layer: Layer) { this.layers.push(layer); this.scene.add(layer.object); }

  setTier(t: Tier) {
    if (t === this.tier) return;
    this.tier = t;
    this.dprCap = t === 'high' ? 1.5 : t === 'med' ? 1.25 : 0.85;
    this.bloom.intensity = t === 'low' ? 0 : 0.85;
    this.composer.multisampling = t === 'high' ? 4 : t === 'med' ? 2 : 0;
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = (2 * Math.atan(Math.tan(HFOV / 2) / this.camera.aspect) * 180) / Math.PI;
    this.camera.updateProjectionMatrix();
  }

  /** Обновить все слои по позе камеры и нарисовать кадр. */
  render(n: number, pose: CamPose, time: number) {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = this.renderer.getPixelRatio();
    this.frame = {
      n, d: pose.d, cam: pose.cam, R: pose.R, U: pose.U, V: pose.V, time,
      width: w, height: h, dpr, pxScale: Math.max(0.6, Math.min(w / 1920, h / 1080)), reduced: this.reduced,
    };
    const { R, U, V } = pose;
    this.basis.set(R[0], U[0], -V[0], 0, R[1], U[1], -V[1], 0, R[2], U[2], -V[2], 0, 0, 0, 0, 1);
    this.camera.quaternion.setFromRotationMatrix(this.basis);
    this.camera.position.set(0, 0, 0);
    this.camera.updateMatrixWorld();
    for (const l of this.layers) l.update(this.frame);
    this.composer.render();
  }

  /** Мировая точка → экранные координаты (css px) или null, если позади камеры. */
  project(w: V3): { x: number; y: number } | null {
    const f = this.frame;
    if (!f) return null;
    const rel = sub(w, f.cam);
    if (dot(rel, f.V) <= 0) return null;
    this.tmp.set(rel[0] / f.d, rel[1] / f.d, rel[2] / f.d);
    // очень далёкие точки — по направлению (как звёзды на небесной сфере)
    const L = this.tmp.length();
    if (L > 1e4) this.tmp.multiplyScalar(1e4 / L);
    this.tmp.project(this.camera);
    return { x: (this.tmp.x * 0.5 + 0.5) * f.width, y: (-this.tmp.y * 0.5 + 0.5) * f.height };
  }

  async warmup() {
    await this.renderer.compileAsync(this.scene, this.camera);
  }

  dispose() {
    for (const l of this.layers) l.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}

/** Адаптивное качество: EMA времени кадра с гистерезисом. */
export class QualityGovernor {
  private ema = 16.7;
  private lowFor = 0;
  private highFor = 0;
  constructor(private engine: Engine) {}
  tick(dtMs: number) {
    if (dtMs > 250) return; // вкладка просыпалась
    this.ema = this.ema * 0.95 + dtMs * 0.05;
    const e = this.engine;
    if (this.ema > 21) { this.lowFor += dtMs; this.highFor = 0; } else if (this.ema < 14) { this.highFor += dtMs; this.lowFor = 0; } else { this.lowFor = this.highFor = 0; }
    if (this.lowFor > 1500) { e.setTier(e.tier === 'high' ? 'med' : 'low'); this.lowFor = 0; this.ema = 16.7; }
    if (this.highFor > 8000 && e.tier !== 'high') { e.setTier(e.tier === 'low' ? 'med' : 'high'); this.highFor = 0; }
  }
  get fps() { return 1000 / this.ema; }
}
