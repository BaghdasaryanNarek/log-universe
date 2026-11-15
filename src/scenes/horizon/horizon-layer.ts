import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { DEG, smoothstep, sub, type V3 } from '../../core/vec.ts';
import type { Frame, Layer } from '../../gl/types.ts';
import type { ObserverFrame } from '../../gl/astro.ts';

/**
 * Передний план Hero в локальной системе наблюдателя (x — восток, y — север, z — зенит, метры):
 * гравированная гряда холмов на севере и телескоп-рефрактор, направленный на Мицар.
 */
/** Положение телескопа в локальной системе (восток, север), м — относительно азимута взгляда задаётся в main. */
export let TEL_OFFSET: [number, number] = [0.9, 4.2];
export const setTelescopeOffset = (e: number, n: number) => { TEL_OFFSET = [e, n]; };
const BRASS = new THREE.Color('#e8b04b');
const PAPER = new THREE.Color('#f2ebdd');

const RIDGE_FRAG = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uBrass;
uniform float uFade;
varying vec3 vLocal;
varying float vH;
void main() {
  // штриховка гравюры: наклонные линии в экранном пространстве, гуще у подножия
  float k = gl_FragCoord.x * 0.7071 + gl_FragCoord.y * 0.7071;
  float density = 9.0;
  float line = 1.0 - smoothstep(0.35, 1.35, abs(fract(k / density) - 0.5) * density);
  float hatch = line * smoothstep(0.55, 0.0, vH) * 0.13;
  vec3 col = uInk + uBrass * hatch;
  gl_FragColor = vec4(col * uFade + uInk * (1.0 - uFade), uFade);
}`;
const RIDGE_VERT = /* glsl */ `
attribute float hNorm;
varying vec3 vLocal;
varying float vH;
void main() {
  vLocal = position;
  vH = hNorm;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

function ridgeProfile(azDeg: number): { dist: number; h: number } {
  // детерминированный «рельеф» из суммы синусоид; на севере ниже, чтобы не закрывать Ковш
  const a = azDeg * DEG;
  const north = Math.cos(a);
  const base = 70 + 55 * Math.sin(a * 3.1 + 0.7) + 38 * Math.sin(a * 7.3 + 2.1) + 18 * Math.sin(a * 17.9 + 0.3) + 8 * Math.sin(a * 41 + 1.1);
  const massif = 520 * Math.exp(-Math.pow((azDeg - 318) / 16, 2)); // дальний массив на северо-западе
  const h = Math.max(25, base * (0.55 + 0.45 * (1 - north)) + massif);
  const dist = 4200 + 900 * Math.sin(a * 2.3 + 1.3) + (massif > 1 ? 18000 * Math.exp(-Math.pow((azDeg - 318) / 22, 2)) : 0);
  return { dist, h };
}

export class HorizonLayer implements Layer {
  object = new THREE.Group();
  private ridgeMat: THREE.ShaderMaterial;
  private lineMats: LineMaterial[] = [];
  private fillMat: THREE.MeshBasicMaterial;
  private basis = new THREE.Matrix4();

  constructor(private obs: V3, frame: ObserverFrame, tubeAzDeg: number, tubeAltDeg: number) {
    const { east: E, north: N, zenith: Z } = frame;
    this.basis.set(E[0], N[0], Z[0], 0, E[1], N[1], Z[1], 0, E[2], N[2], Z[2], 0, 0, 0, 0, 1);

    // гряда: «юбка» от −60 м до профиля, по азимутам 200°…520° (север ± 160°)
    const steps = 640;
    const pos: number[] = [], hn: number[] = [], idx: number[] = [], rim: number[] = [];
    let prev: [number, number, number] | null = null;
    for (let i = 0; i <= steps; i++) {
      const az = 200 + (320 * i) / steps;
      const { dist, h } = ridgeProfile(az % 360);
      const a = az * DEG;
      const x = Math.sin(a) * dist, y = Math.cos(a) * dist;
      pos.push(x, y, -60, x, y, h);
      hn.push(1.0, 0.0);
      if (i > 0) { const b = (i - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
      const top: [number, number, number] = [x, y, h];
      if (prev) rim.push(...prev, ...top);
      prev = top;
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    rg.setAttribute('hNorm', new THREE.Float32BufferAttribute(hn, 1));
    rg.setIndex(idx);
    this.ridgeMat = new THREE.ShaderMaterial({
      vertexShader: RIDGE_VERT, fragmentShader: RIDGE_FRAG, transparent: true, side: THREE.DoubleSide, depthWrite: true,
      uniforms: { uInk: { value: new THREE.Color('#06070b') }, uBrass: { value: BRASS }, uFade: { value: 1 } },
    });
    const ridge = new THREE.Mesh(rg, this.ridgeMat);
    ridge.renderOrder = 4;
    ridge.frustumCulled = false;
    this.object.add(ridge);
    this.object.add(this.lines(rim, BRASS, 1.4, 0.85, 5));

    // телескоп: треножник, монтировка, труба по направлению на Мицар
    const head: [number, number, number] = [0, 0, 1.02];
    const legs: number[] = [];
    for (let k = 0; k < 3; k++) {
      const a = (k * 120 + 30) * DEG;
      legs.push(...head, Math.cos(a) * 0.48, Math.sin(a) * 0.48, 0);
    }
    // распорка
    const sp = 0.42;
    for (let k = 0; k < 3; k++) {
      const a1 = (k * 120 + 30) * DEG, a2 = ((k + 1) * 120 + 30) * DEG;
      const p1 = [Math.cos(a1) * 0.48 * (1 - sp), Math.sin(a1) * 0.48 * (1 - sp), 1.02 * sp];
      const p2 = [Math.cos(a2) * 0.48 * (1 - sp), Math.sin(a2) * 0.48 * (1 - sp), 1.02 * sp];
      legs.push(...p1, ...p2);
    }
    const az = tubeAzDeg * DEG, alt = tubeAltDeg * DEG;
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(alt), Math.cos(az) * Math.cos(alt), Math.sin(alt));
    const side = new THREE.Vector3(0, 0, 1).cross(dir).normalize();
    const upv = dir.clone().cross(side).normalize();
    const pivot = new THREE.Vector3(...head).addScaledVector(upv, 0.06);
    const rTube = 0.042, Lf = 0.5, Lb = 0.24;
    const tube: number[] = [];
    const ring = (center: THREE.Vector3, r: number) => {
      const seg = 28;
      for (let i = 0; i < seg; i++) {
        const t1 = (i / seg) * Math.PI * 2, t2 = ((i + 1) / seg) * Math.PI * 2;
        const p1 = center.clone().addScaledVector(side, Math.cos(t1) * r).addScaledVector(upv, Math.sin(t1) * r);
        const p2 = center.clone().addScaledVector(side, Math.cos(t2) * r).addScaledVector(upv, Math.sin(t2) * r);
        tube.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      }
    };
    const front = pivot.clone().addScaledVector(dir, Lf), back = pivot.clone().addScaledVector(dir, -Lb);
    for (const s of [-1, 1]) for (const v of [side, upv]) {
      const o = v.clone().multiplyScalar(s * rTube);
      tube.push(...back.clone().add(o).toArray(), ...front.clone().add(o).toArray());
    }
    ring(front, rTube); ring(back, rTube * 0.92);
    ring(pivot.clone().addScaledVector(dir, Lf - 0.09), rTube * 1.12); // бленда
    ring(pivot.clone().addScaledVector(dir, Lf - 0.06), rTube * 1.12);
    // окуляр
    const eye = back.clone().addScaledVector(dir, -0.07);
    tube.push(...back.toArray(), ...eye.toArray());
    ring(eye, 0.016);
    // искатель
    const fb = pivot.clone().addScaledVector(upv, 0.075).addScaledVector(dir, -0.05);
    tube.push(...fb.toArray(), ...fb.clone().addScaledVector(dir, 0.22).toArray());
    tube.push(...head, ...pivot.toArray());

    // телескоп стоит в нескольких метрах впереди-справа от наблюдателя
    const tel = new THREE.Group();
    tel.position.set(TEL_OFFSET[0], TEL_OFFSET[1], 0);
    this.object.add(tel);
    tel.add(this.lines(legs, PAPER, 1.5, 0.5, 6));
    tel.add(this.lines(tube, BRASS, 1.8, 1, 6));
    // заливка трубы — чтобы звёзды не просвечивали сквозь металл
    this.fillMat = new THREE.MeshBasicMaterial({ color: '#07080c', transparent: true });
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(rTube, rTube, Lf + Lb, 20, 1, true), this.fillMat);
    cyl.position.copy(pivot.clone().addScaledVector(dir, (Lf - Lb) / 2));
    cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    cyl.renderOrder = 5;
    tel.add(cyl);
    this.object.matrixAutoUpdate = false;
  }

  private lines(arr: number[], color: THREE.Color, width: number, opacity: number, order: number) {
    const g = new LineSegmentsGeometry();
    g.setPositions(arr);
    const m = new LineMaterial({ color: color.getHex(), linewidth: width, transparent: true, opacity, depthTest: true, worldUnits: false });
    this.lineMats.push(m);
    const l = new LineSegments2(g, m);
    l.renderOrder = order;
    l.frustumCulled = false;
    return l;
  }

  update(f: Frame) {
    const fade = 1 - smoothstep(2.9, 3.8, f.n);
    this.object.visible = fade > 0.001;
    if (!this.object.visible) return;
    const t = sub(this.obs, f.cam);
    const s = 1 / f.d;
    const m = this.object.matrix;
    m.copy(this.basis).multiplyScalar(s);
    m.elements[15] = 1;
    m.setPosition(t[0] * s, t[1] * s, t[2] * s);
    this.object.matrixWorldNeedsUpdate = true;
    this.ridgeMat.uniforms.uFade.value = fade;
    this.fillMat.opacity = fade;
    const lw = f.pxScale * f.dpr;
    for (const lm of this.lineMats) {
      lm.resolution.set(f.width * f.dpr, f.height * f.dpr);
      lm.userData.base ??= lm.linewidth;
      lm.linewidth = (lm.userData.base as number) * Math.max(1, lw);
      lm.userData.op ??= lm.opacity;
      lm.opacity = (lm.userData.op as number) * fade;
    }
  }

  dispose() {
    this.object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | undefined;
      mat?.dispose();
    });
  }
}
