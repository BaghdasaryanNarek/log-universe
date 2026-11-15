import * as THREE from 'three';
import { PC } from '../../content/facts.ts';
import { smoothstep } from '../../core/vec.ts';
import type { Frame, Layer } from '../../gl/types.ts';
import { bvToRgb, type StarCatalog } from './catalog.ts';

export const SKY_R = 5e4;

/**
 * Каждая звезда в каждом кадре:
 *  1) расстояние от камеры d (пк) → видимая величина m = M + 5·log₁₀(d / 10 пк)  (модуль расстояния);
 *  2) поток по Погсону: F/F_lim = 10^(−0,4·(m − m_lim)), т.е. S = m_lim − m = 2,5·log₁₀(F/F_lim);
 *  3) на экран — S (логарифм потока), как ощущает глаз по Веберу–Фехнеру.
 */
const VERT = /* glsl */ `
attribute float absMag;
attribute vec3 color;
attribute float sid;
uniform vec3 uCamPc;
uniform float uPcToUnit;
uniform float uSkyR;
uniform float uMagLim;
uniform float uPx;
uniform float uHideSun;
uniform float uTwinkle;
uniform float uTime;
uniform float uFade;
uniform float uHover;
varying vec3 vColor;
varying float vI;
varying float vR;
varying float vHover;
void main() {
  vec3 rel = position - uCamPc;
  float dpc = max(length(rel), 1e-12);
  float m = absMag + 5.0 * log2(dpc) * 0.30102999566 - 5.0;
  float S = uMagLim - m;
  vec3 p = rel * uPcToUnit;
  float L = length(p);
  if (L > uSkyR) p *= uSkyR / L;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  bool hide = S <= 0.0 || (sid < 0.5 && uHideSun > 0.5);
  if (hide) { gl_PointSize = 0.0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float tw = 1.0 + uTwinkle * 0.28 * sin(uTime * (2.3 + fract(sid * 0.6180339) * 4.1) + sid * 1.7);
  vI = clamp(S / 3.2, 0.0, 1.0) * tw * uFade;
  float r = 0.75 + 0.36 * max(S - 2.2, 0.0);
  vR = min(r, 26.0);
  vHover = abs(sid - uHover) < 0.5 ? 1.0 : 0.0;
  vColor = color;
  gl_PointSize = (vR * 2.0 + 7.0 + vHover * 18.0) * uPx;
}`;

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vI;
varying float vR;
varying float vHover;
uniform float uPx;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float half_ = (vR + 3.5 + vHover * 9.0);
  float d = length(c) * half_;
  float core = exp(-d * d / (vR * vR * 0.55 + 0.35));
  float halo = exp(-d / (vR * 0.9 + 1.4)) * 0.22;
  float a = (core + halo) * vI;
  // кольцо наведения — латунная окружность
  float ring = vHover * smoothstep(1.4, 0.0, abs(d - (vR + 7.0))) * 0.9;
  vec3 col = vColor * a + vec3(0.91, 0.69, 0.29) * ring;
  gl_FragColor = vec4(col, max(a, ring));
}`;

export class StarsLayer implements Layer {
  object: THREE.Points;
  private mat: THREE.ShaderMaterial;
  constructor(private cat: StarCatalog) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(cat.pos, 3));
    g.setAttribute('absMag', new THREE.BufferAttribute(cat.absMag, 1));
    const col = new Float32Array(cat.count * 3);
    const sid = new Float32Array(cat.count);
    const c = new THREE.Color();
    for (let i = 0; i < cat.count; i++) {
      const [r, gg, b] = bvToRgb(cat.ci[i]);
      c.setRGB(r, gg, b, THREE.SRGBColorSpace);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      sid[i] = i;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('sid', new THREE.BufferAttribute(sid, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uCamPc: { value: new THREE.Vector3() },
        uPcToUnit: { value: 1 },
        uSkyR: { value: SKY_R },
        uMagLim: { value: 6.5 },
        uPx: { value: 1 },
        uHideSun: { value: 1 },
        uTwinkle: { value: 1 },
        uTime: { value: 0 },
        uFade: { value: 1 },
        uHover: { value: -10 },
      },
    });
    this.object = new THREE.Points(g, this.mat);
    this.object.frustumCulled = false;
    this.object.renderOrder = 1;
  }

  setHover(i: number) { this.mat.uniforms.uHover.value = i; }

  update(f: Frame) {
    const u = this.mat.uniforms;
    (u.uCamPc.value as THREE.Vector3).set(f.cam[0] / PC, f.cam[1] / PC, f.cam[2] / PC);
    u.uPcToUnit.value = PC / f.d;
    u.uPx.value = f.pxScale * f.dpr;
    u.uTime.value = f.time;
    // мерцание — только сквозь атмосферу
    u.uTwinkle.value = f.reduced ? 0 : 1 - smoothstep(3.5, 5, f.n);
    // Солнце рисует отдельный слой вблизи; как звезда — только издалека
    u.uHideSun.value = f.n < 12.5 ? 1 : 0;
    // на земле глаз адаптирован к ночному небу; в космосе без засветки предел чуть глубже
    u.uMagLim.value = 6.5 + 0.5 * smoothstep(4, 6, f.n);
  }

  /** Видимая величина звезды i из точки камеры (для подписей и подсказок). */
  apparentMag(i: number, camPc: [number, number, number]): number {
    const p = this.cat.pos;
    const dx = p[i * 3] - camPc[0], dy = p[i * 3 + 1] - camPc[1], dz = p[i * 3 + 2] - camPc[2];
    const dpc = Math.max(Math.hypot(dx, dy, dz), 1e-12);
    return this.cat.absMag[i] + 5 * Math.log10(dpc) - 5;
  }

  get magLimit(): number { return this.mat.uniforms.uMagLim.value as number; }

  dispose() {
    this.object.geometry.dispose();
    this.mat.dispose();
  }
}
