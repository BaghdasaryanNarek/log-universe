import * as THREE from 'three';
import { KPC } from '../../content/facts.ts';
import { smoothstep, type V3 } from '../../core/vec.ts';
import type { Frame, Layer } from '../../gl/types.ts';
import { generateGalaxy, type GalaxySpec } from './generate.ts';

/**
 * Галактика как облако частиц. Размер частицы задан в килопарсеках и пересчитывается в пиксели
 * по перспективе; если частица меньше пикселя, её яркость уменьшается пропорционально площади,
 * чтобы суммарный свет галактики не зависел от масштаба.
 */
const VERT = /* glsl */ `
attribute vec3 color;
attribute float size;
attribute float dust;
uniform float uPxPerUnit;
uniform float uScale;
uniform float uOpacity;
uniform float uDust;
uniform float uFrame;
varying vec3 vColor;
varying float vA;
varying float vDust;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float px = size * uScale * uPxPerUnit / max(-mv.z, 1e-6);
  float a = 1.0;
  if (px < 1.2) { a = max(px * px / 1.44, 0.0); px = 1.2; }
  // крупные (близкие) облака: свет сохраняем, размер ограничиваем — иначе пролёт сквозь диск засвечивает кадр
  if (px > 7.0) { a *= (7.0 / px) * (7.0 / px); px = 7.0 + (px - 7.0) * 0.15; }
  px = min(px, 14.0);
  // частицы вплотную к камере гаснут (камера пролетает сквозь диск)
  a *= smoothstep(0.01, 0.06, -mv.z / uFrame);
  vDust = dust;
  vColor = color;
  vA = a * uOpacity * (dust > 0.5 ? uDust : 1.0);
  gl_PointSize = px;
  if (mv.z > 0.0 || vA < 0.002) { gl_PointSize = 0.0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }
}`;
const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vA;
varying float vDust;
uniform float uGain;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0) discard;
  float g = exp(-d * 3.0);
  if (vDust > 0.5) { gl_FragColor = vec4(vColor, g * vA * 0.55); return; }
  gl_FragColor = vec4(vColor * g * vA * uGain, g * vA);
}`;

export interface GalaxyPlacement {
  center: V3; // м, мировые
  e1: V3; e2: V3; e3: V3; // оси диска в мировых координатах
  range: [number, number];
  gain: number;
}

export class GalaxyLayer implements Layer {
  object = new THREE.Group();
  private stars: THREE.Points;
  private dust: THREE.Points;
  private mats: THREE.ShaderMaterial[] = [];
  private basis = new THREE.Matrix4();
  readonly count: number;

  constructor(spec: GalaxySpec, private place: GalaxyPlacement) {
    const g = generateGalaxy(spec);
    this.count = g.count;
    // звёзды и пыль — разные объекты: пыль рисуется после, обычным смешиванием, и затемняет
    const split = (wantDust: boolean) => {
      const idx: number[] = [];
      for (let i = 0; i < g.count; i++) if ((g.dust[i] > 0.5) === wantDust) idx.push(i);
      const P = new Float32Array(idx.length * 3), C = new Float32Array(idx.length * 3), S = new Float32Array(idx.length), D = new Float32Array(idx.length);
      idx.forEach((s, j) => { P.set(g.pos.subarray(s * 3, s * 3 + 3), j * 3); C.set(g.color.subarray(s * 3, s * 3 + 3), j * 3); S[j] = g.size[s]; D[j] = g.dust[s]; });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
      geo.setAttribute('size', new THREE.BufferAttribute(S, 1));
      geo.setAttribute('dust', new THREE.BufferAttribute(D, 1));
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false,
        blending: wantDust ? THREE.NormalBlending : THREE.AdditiveBlending,
        uniforms: { uPxPerUnit: { value: 1 }, uScale: { value: 1 }, uOpacity: { value: 1 }, uDust: { value: 1 }, uGain: { value: place.gain }, uFrame: { value: 1 } },
      });
      this.mats.push(mat);
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      pts.renderOrder = wantDust ? 2.6 : 2.5;
      return pts;
    };
    this.stars = split(false);
    this.dust = split(true);
    this.object.add(this.stars, this.dust);
    this.object.matrixAutoUpdate = false;
    const { e1, e2, e3 } = place;
    this.basis.set(e1[0], e2[0], e3[0], 0, e1[1], e2[1], e3[1], 0, e1[2], e2[2], e3[2], 0, 0, 0, 0, 1);
  }

  /** Доля частиц для адаптивного качества. */
  setQuality(frac: number) {
    for (const p of [this.stars, this.dust]) p.geometry.setDrawRange(0, Math.floor(p.geometry.attributes.position.count * frac));
  }

  /** Мировые координаты точки диска (кпк) — для подписей. */
  worldOf(x: number, y: number, z = 0): V3 {
    const { center: c, e1, e2, e3 } = this.place;
    return [c[0] + (e1[0] * x + e2[0] * y + e3[0] * z) * KPC, c[1] + (e1[1] * x + e2[1] * y + e3[1] * z) * KPC, c[2] + (e1[2] * x + e2[2] * y + e3[2] * z) * KPC];
  }

  /** Случайная выборка частиц в мировых координатах (для финальной карты). */
  sampleWorld(n: number): V3[] {
    const pos = this.stars.geometry.attributes.position.array as Float32Array;
    const N = pos.length / 3, step = Math.max(1, Math.floor(N / n));
    const out: V3[] = [];
    for (let i = 0; i < N && out.length < n; i += step) out.push(this.worldOf(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
    return out;
  }

  update(f: Frame) {
    const [a, b] = this.place.range;
    const op = smoothstep(a, a + 0.8, f.n) * (1 - smoothstep(b - 0.6, b, f.n));
    this.object.visible = op > 0.002;
    if (!this.object.visible) return;
    const s = KPC / f.d;
    const c = this.place.center;
    const m = this.object.matrix;
    m.copy(this.basis).multiplyScalar(s);
    m.elements[15] = 1;
    m.setPosition((c[0] - f.cam[0]) / f.d, (c[1] - f.cam[1]) / f.d, (c[2] - f.cam[2]) / f.d);
    this.object.matrixWorldNeedsUpdate = true;
    const vfov = 2 * Math.atan((0.5 * f.height) / f.width);
    const pxPerUnit = (f.height * f.dpr) / (2 * Math.tan(vfov / 2));
    for (const mat of this.mats) {
      mat.uniforms.uPxPerUnit.value = pxPerUnit;
      // размер частицы в кпк → единицы объекта: масштаб уже в матрице, поэтому здесь 1
      mat.uniforms.uScale.value = s;
      mat.uniforms.uOpacity.value = op;
      // глубина в единицах рендера; кадр шириной d соответствует 1
      mat.uniforms.uFrame.value = 1;
    }
  }

  dispose() { for (const p of [this.stars, this.dust]) { p.geometry.dispose(); (p.material as THREE.Material).dispose(); } }
}
