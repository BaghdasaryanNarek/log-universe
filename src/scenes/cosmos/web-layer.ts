import * as THREE from 'three';
import { MPC } from '../../content/facts.ts';
import { smoothstep, type V3 } from '../../core/vec.ts';
import { radec } from '../../gl/astro.ts';
import type { Frame, Layer } from '../../gl/types.ts';

/**
 * Космическая паутина — процедурная модель: узлы (скопления), нити между ближайшими узлами,
 * плотные сгустки в узлах. Два масштаба: местная паутина (радиус 150 Мпк) со скоплением Девы
 * в настоящем направлении и на настоящем расстоянии (16,5 Мпк) и глобальная — до горизонта.
 * Модель условная: настоящая карта неба галактик здесь не воспроизводится.
 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function web(count: number, radius: number, nodes: number, seed: number, extra?: { at: V3; n: number; r: number }) {
  const R = rng(seed);
  const gauss = () => { let u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); };
  const inBall = (): V3 => { for (;;) { const p: V3 = [R() * 2 - 1, R() * 2 - 1, R() * 2 - 1]; if (p[0] ** 2 + p[1] ** 2 + p[2] ** 2 < 1) return [p[0] * radius, p[1] * radius, p[2] * radius]; } };
  const N: V3[] = Array.from({ length: nodes }, inBall);
  const edges: [number, number, number][] = [];
  for (let i = 0; i < nodes; i++) {
    const d = N.map((q, j) => [j, (q[0] - N[i][0]) ** 2 + (q[1] - N[i][1]) ** 2 + (q[2] - N[i][2]) ** 2] as [number, number]).sort((a, b) => a[1] - b[1]);
    for (const [j, dd] of d.slice(1, 4)) if (j > i) edges.push([i, j, Math.sqrt(dd)]);
  }
  const cum: number[] = [];
  let acc = 0;
  for (const e of edges) { acc += e[2]; cum.push(acc); }
  const totalLen = acc;
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  const sigma = radius * 0.012;
  const extraN = extra?.n ?? 0;
  for (let k = 0; k < count; k++) {
    let p: V3;
    if (k < extraN && extra) p = [extra.at[0] + gauss() * extra.r, extra.at[1] + gauss() * extra.r, extra.at[2] + gauss() * extra.r * 0.7];
    else if (R() < 0.22) { const q = N[Math.floor(R() * nodes)]; const s = sigma * 1.4; p = [q[0] + gauss() * s, q[1] + gauss() * s, q[2] + gauss() * s]; }
    else {
      // двоичный поиск ребра по накопленной длине — нити заполняются пропорционально длине
      const u = R() * totalLen;
      let lo = 0, hi = cum.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < u) lo = mid + 1; else hi = mid; }
      const e = edges[lo];
      const a = N[e[0]], b = N[e[1]], t = R();
      p = [a[0] + (b[0] - a[0]) * t + gauss() * sigma, a[1] + (b[1] - a[1]) * t + gauss() * sigma, a[2] + (b[2] - a[2]) * t + gauss() * sigma];
    }
    pos.set(p, k * 3);
    const warm = R();
    col.set(warm < 0.6 ? [1.0, 0.86, 0.66] : [0.7, 0.8, 1.0], k * 3);
  }
  return { pos, col };
}

const VERT = /* glsl */ `
attribute vec3 color;
uniform float uOpacity;
uniform float uPx;
varying vec3 vC;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vC = color; vA = uOpacity;
  gl_PointSize = uPx;
  if (mv.z > 0.0) gl_PointSize = 0.0;
}`;
const FRAG = /* glsl */ `
varying vec3 vC; varying float vA;
void main() { vec2 c = gl_PointCoord * 2.0 - 1.0; float d = dot(c, c); if (d > 1.0) discard; float g = exp(-d * 2.5); gl_FragColor = vec4(vC * g * vA, g * vA); }`;

class Cloud {
  points: THREE.Points;
  mat: THREE.ShaderMaterial;
  constructor(data: { pos: Float32Array; col: Float32Array }, public unit: number, public range: [number, number], public gain: number) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(data.col, 3));
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uOpacity: { value: 0 }, uPx: { value: 1.5 } } });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.matrixAutoUpdate = false;
    this.points.renderOrder = 2.4;
  }
  update(f: Frame) {
    const [a, b] = this.range;
    const op = smoothstep(a, a + 0.7, f.n) * (1 - smoothstep(b - 0.6, b, f.n));
    this.points.visible = op > 0.002;
    if (!this.points.visible) return;
    const s = this.unit / f.d;
    this.points.matrix.makeScale(s, s, s).setPosition(-f.cam[0] / f.d, -f.cam[1] / f.d, -f.cam[2] / f.d);
    this.points.matrixWorldNeedsUpdate = true;
    this.mat.uniforms.uOpacity.value = op * this.gain;
    this.mat.uniforms.uPx.value = 2.0 * f.dpr * Math.max(0.8, f.pxScale);
  }
}

const CMB_R = 4.4e26; // м, радиус наблюдаемой Вселенной (сопутствующее расстояние)
const CMB_FRAG = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec3 vP;
uniform float uOpacity;
float h(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
void main() {
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  float t = n3(vP * 6.0) * 0.6 + n3(vP * 15.0) * 0.4;
  vec3 cold = vec3(0.18, 0.35, 0.85), hot = vec3(1.0, 0.55, 0.2);
  vec3 c = mix(cold, hot, smoothstep(0.3, 0.7, t));
  float a = (0.18 + 0.82 * fres) * uOpacity;
  gl_FragColor = vec4(c * a, a);
}`;
const CMB_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main() { vP = position; vN = normalMatrix * normal; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`;

export class CosmosLayer implements Layer {
  object = new THREE.Group();
  private clouds: Cloud[];
  private cmb: THREE.Mesh;
  private cmbMat: THREE.ShaderMaterial;
  readonly virgo: V3;

  constructor(quality = 1) {
    // Дева: RA 12ʰ27ᵐ, Dec +12°43′, 16,5 Мпк
    const vd = radec(186.75, 12.72);
    this.virgo = [vd[0] * 16.5 * MPC, vd[1] * 16.5 * MPC, vd[2] * 16.5 * MPC];
    const local = web(Math.round(70000 * quality), 150, 260, 11, { at: [vd[0] * 16.5, vd[1] * 16.5, vd[2] * 16.5], n: 2500, r: 1.6 });
    const global = web(Math.round(110000 * quality), 14300, 900, 23);
    this.clouds = [new Cloud(local, MPC, [22.9, 25.6], 0.8), new Cloud(global, MPC, [24.7, 28.4], 0.75)];
    for (const c of this.clouds) this.object.add(c.points);
    this.cmbMat = new THREE.ShaderMaterial({ vertexShader: CMB_VERT, fragmentShader: CMB_FRAG, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uOpacity: { value: 0 } } });
    this.cmb = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), this.cmbMat);
    this.cmb.frustumCulled = false;
    this.cmb.renderOrder = 2.3;
    this.object.add(this.cmb);
  }

  /** Выборка точек глобальной паутины в мировых координатах (для финальной карты). */
  sampleWorld(n: number): V3[] {
    const out: V3[] = [];
    for (const c of this.clouds) {
      const pos = c.points.geometry.attributes.position.array as Float32Array;
      const N = pos.length / 3, step = Math.max(1, Math.floor(N / (n / 2)));
      for (let i = 0; i < N; i += step) out.push([pos[i * 3] * c.unit, pos[i * 3 + 1] * c.unit, pos[i * 3 + 2] * c.unit]);
    }
    return out;
  }

  update(f: Frame) {
    for (const c of this.clouds) c.update(f);
    const op = smoothstep(25.9, 26.6, f.n) * (1 - smoothstep(27.6, 28.3, f.p));
    this.cmb.visible = op > 0.002;
    if (this.cmb.visible) {
      const s = CMB_R / f.d;
      this.cmb.position.set(-f.cam[0] / f.d, -f.cam[1] / f.d, -f.cam[2] / f.d);
      this.cmb.scale.setScalar(s);
      this.cmbMat.uniforms.uOpacity.value = op * 0.7;
    }
    // финальная карта: трёхмерный мир гаснет
    const out = 1 - smoothstep(27.2, 27.7, f.p);
    for (const c of this.clouds) c.mat.uniforms.uOpacity.value *= out;
  }

  dispose() { this.object.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); }); }
}
