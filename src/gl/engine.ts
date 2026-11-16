import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** Виньетка в линейном пространстве — края кадра темнее, как в объективе. */
const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, uStrength: { value: 0.42 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float uStrength; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; float v = 1.0 - uStrength * smoothstep(0.25, 0.85, dot(d, d) * 2.2); gl_FragColor = vec4(c.rgb * v, c.a); }',
};
/**
 * Пасхалка «napier»: кадр как гравюра 1614 года. Яркость становится тушью на бумаге:
 * светлое — плотной штриховкой (две сетки под 45° и −45°), звёзды — чёрными точками, как на старых картах.
 */
const EngravingShader = {
  uniforms: { tDiffuse: { value: null }, uMix: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uPaper: { value: new THREE.Color('#e8dfca') }, uInk: { value: new THREE.Color('#1c150d') } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uMix; uniform vec2 uRes; uniform vec3 uPaper; uniform vec3 uInk; varying vec2 vUv;
    float hatch(vec2 p, float a, float sp, float w) { float k = dot(p, vec2(cos(a), sin(a))); return 1.0 - smoothstep(w, w + 0.9, abs(fract(k / sp) - 0.5) * sp); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (uMix <= 0.0) { gl_FragColor = c; return; }
      float l = clamp(dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)) * 2.2, 0.0, 1.0);
      vec2 p = vUv * uRes;
      float ink = smoothstep(0.55, 0.9, l);
      ink = max(ink, hatch(p, 0.785, 5.0, 0.45) * smoothstep(0.04, 0.2, l));
      ink = max(ink, hatch(p, -0.785, 5.0, 0.45) * smoothstep(0.18, 0.4, l));
      ink = max(ink, hatch(p, 0.0, 3.5, 0.4) * smoothstep(0.35, 0.6, l));
      float grain = fract(sin(dot(floor(p), vec2(12.9898, 78.233))) * 43758.5453) * 0.05;
      vec3 paper = uPaper * (0.96 + grain) * (1.0 - 0.12 * smoothstep(0.35, 0.75, length(vUv - 0.5)));
      vec3 g = mix(paper, uInk, ink * 0.92);
      gl_FragColor = vec4(mix(c.rgb, g, uMix), 1.0);
    }`,
};
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
  private bloom: UnrealBloomPass;
  private engraving: ShaderPass;
  /** 0…1 — режим гравюры (пасхалка «napier») */
  engrave = 0;
  private layers: Layer[] = [];
  private basis = new THREE.Matrix4();
  private tmp = new THREE.Vector3();
  tier: Tier = 'high';
  frame!: Frame;
  reduced = false;
  private dprCap = 1.5;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, stencil: false, alpha: false, powerPreference: 'high-performance' });
    // Очистка чёрным, а «чернила» #07080c — отдельным фоновым проходом через шейдер:
    // цвет очистки в цепочке HalfFloat → OutputPass не линеаризуется и давал серое небо (~#343440).
    this.renderer.setClearColor(0x000000, 1);
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: { uInk: { value: new THREE.Color('#07080c') } },
        vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: 'uniform vec3 uInk; void main(){ gl_FragColor = vec4(uInk, 1.0); }',
        depthTest: false, depthWrite: false,
      }),
    );
    bg.frustumCulled = false;
    bg.renderOrder = -10;
    this.scene.add(bg);

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 1e-4, 1e5);
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.55, 0.5);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new ShaderPass(VignetteShader));
    this.engraving = new ShaderPass(EngravingShader);
    this.composer.addPass(this.engraving);
    this.composer.addPass(new OutputPass());
    this.resize();
  }

  add(layer: Layer) { this.layers.push(layer); this.scene.add(layer.object); }

  /** слои с частицами подписываются, чтобы уменьшать число частиц на слабой графике */
  onTier: (t: Tier) => void = () => {};

  setTier(t: Tier) {
    if (t === this.tier) return;
    this.tier = t;
    this.onTier(t);
    this.dprCap = t === 'high' ? 1.5 : t === 'med' ? 1.25 : 0.85;
    this.bloom.enabled = t !== 'low';
    this.composer.renderTarget1.samples = this.composer.renderTarget2.samples = t === 'high' ? 4 : t === 'med' ? 2 : 0;
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = (2 * Math.atan(Math.tan(HFOV / 2) / this.camera.aspect) * 180) / Math.PI;
    this.camera.updateProjectionMatrix();
  }

  /** Обновить все слои по позе камеры и нарисовать кадр. */
  render(n: number, pose: CamPose, time: number, p = n) {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = this.renderer.getPixelRatio();
    this.frame = {
      n, p, d: pose.d, cam: pose.cam, R: pose.R, U: pose.U, V: pose.V, time,
      width: w, height: h, dpr, pxScale: Math.max(0.6, Math.min(w / 1920, h / 1080)), reduced: this.reduced,
    };
    const { R, U, V } = pose;
    this.basis.set(R[0], U[0], -V[0], 0, R[1], U[1], -V[1], 0, R[2], U[2], -V[2], 0, 0, 0, 0, 1);
    this.camera.quaternion.setFromRotationMatrix(this.basis);
    this.camera.position.set(0, 0, 0);
    this.camera.updateMatrixWorld();
    for (const l of this.layers) l.update(this.frame);
    this.engraving.enabled = this.engrave > 0.001;
    this.engraving.uniforms.uMix.value = this.engrave;
    (this.engraving.uniforms.uRes.value as THREE.Vector2).set(w * dpr, h * dpr);
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
