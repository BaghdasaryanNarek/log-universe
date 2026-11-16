import * as THREE from 'three';
import { AU } from '../../content/facts.ts';
import { DEG, smoothstep } from '../../core/vec.ts';
import type { Frame, Layer } from '../../gl/types.ts';

/**
 * Пояс Койпера (≈ 30–50 а.е., тонкий диск у эклиптики) и облако Оорта
 * (оценочно 2 000–100 000 а.е., сферическая оболочка; радиус распределён равномерно по логарифму).
 * Облако Оорта напрямую не наблюдалось — это модель по орбитам долгопериодических комет.
 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const EPS = 23.43928 * DEG;
const eclToEq = (x: number, y: number, z: number): [number, number, number] => [x, y * Math.cos(EPS) - z * Math.sin(EPS), y * Math.sin(EPS) + z * Math.cos(EPS)];

const VERT = /* glsl */ `
uniform float uOpacity; uniform float uPx;
varying float vA;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; vA = uOpacity; gl_PointSize = mv.z > 0.0 ? 0.0 : uPx; }`;
const FRAG = /* glsl */ `
uniform vec3 uColor; varying float vA;
void main() { vec2 c = gl_PointCoord * 2.0 - 1.0; float d = dot(c, c); if (d > 1.0) discard; float g = exp(-d * 2.5); gl_FragColor = vec4(uColor * g * vA, g * vA); }`;

class Cloud {
  points: THREE.Points;
  mat: THREE.ShaderMaterial;
  constructor(pos: Float32Array, color: string, public range: [number, number], public gain: number, public unit: number) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 0 }, uPx: { value: 1.5 }, uColor: { value: new THREE.Color(color) } },
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.matrixAutoUpdate = false;
    this.points.renderOrder = 2.2;
  }
  update(f: Frame) {
    const [a, b] = this.range;
    const op = smoothstep(a, a + 0.6, f.n) * (1 - smoothstep(b - 0.6, b, f.n));
    this.points.visible = op > 0.002;
    if (!this.points.visible) return;
    const s = this.unit / f.d;
    this.points.matrix.makeScale(s, s, s).setPosition(-f.cam[0] / f.d, -f.cam[1] / f.d, -f.cam[2] / f.d);
    this.points.matrixWorldNeedsUpdate = true;
    this.mat.uniforms.uOpacity.value = op * this.gain;
    this.mat.uniforms.uPx.value = 1.6 * f.dpr * Math.max(0.8, f.pxScale);
  }
}

export class BeltsLayer implements Layer {
  object = new THREE.Group();
  private clouds: Cloud[];
  constructor() {
    const R = rng(5);
    const gauss = () => { let u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); };
    // единица — а.е.
    const kn = 7000, kp = new Float32Array(kn * 3);
    for (let i = 0; i < kn; i++) {
      const r = 30 + R() * 20 + (R() < 0.15 ? R() * 25 : 0); // классический пояс + рассеянный диск
      const th = R() * 2 * Math.PI;
      kp.set(eclToEq(r * Math.cos(th), r * Math.sin(th), gauss() * r * 0.08), i * 3);
    }
    const on = 22000, op = new Float32Array(on * 3);
    for (let i = 0; i < on; i++) {
      const r = 2000 * Math.pow(50, R()); // 2 000 … 100 000 а.е., равномерно по log r
      const u = R() * 2 - 1, th = R() * 2 * Math.PI, s = Math.sqrt(1 - u * u);
      // внутреннее облако (Хиллса) сплюснуто к эклиптике
      const flat = r < 20000 ? 0.45 : 1;
      op.set(eclToEq(r * s * Math.cos(th), r * s * Math.sin(th), r * u * flat), i * 3);
    }
    this.clouds = [new Cloud(kp, '#c9d6e8', [12.3, 14.0], 0.55, AU), new Cloud(op, '#b8cfee', [13.9, 16.6], 0.95, AU)];
    for (const c of this.clouds) this.object.add(c.points);
  }
  update(f: Frame) { for (const c of this.clouds) c.update(f); }
  dispose() { for (const c of this.clouds) { c.points.geometry.dispose(); c.mat.dispose(); } }
}
