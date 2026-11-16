import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { PLANETS } from '../../content/facts.ts';
import { dot, len, norm, smoothstep, sub, type V3 } from '../../core/vec.ts';
import { moonGeo, radec } from '../../gl/astro.ts';
import type { Frame, Layer } from '../../gl/types.ts';
import { elementsAt, orbitPoints, planetPos } from './ephemeris.ts';

/**
 * Солнце, Луна и планеты — «импостеры»: квадрат, повёрнутый к камере, на котором шейдер
 * рисует освещённую сферу (фаза — по настоящему направлению на Солнце), полосы газовых гигантов
 * и кольца Сатурна. Видимый радиус = max(истинный, минимум в пикселях); отношение
 * показанного к истинному — «увеличение», его честно показывает HUD.
 */
const BODY_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uL;        // направление на Солнце в системе камеры
uniform vec3 uPole;     // ось вращения в системе камеры
uniform float uKind;    // 0 — каменная, 1 — газовый гигант, 2 — Сатурн, 3 — Луна, 4 — Солнце
uniform float uRing;    // размер квадрата в радиусах тела
uniform float uOpacity;
uniform float uTime;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main() {
  vec2 q = (vUv * 2.0 - 1.0) * uRing;
  float r = length(q);
  vec3 col = vec3(0.0);
  float a = 0.0;
  if (uKind > 3.5) {
    // Солнце: диск с потемнением к краю + корона
    float mu = sqrt(max(0.0, 1.0 - r * r));
    float limb = 1.0 - 0.6 * (1.0 - mu);
    float gran = 0.92 + 0.08 * n2(q * 22.0 + uTime * 0.3);
    float disk = smoothstep(1.02, 0.97, r);
    float corona = exp(-(r - 1.0) * 2.6) * 0.55 * step(1.0, r) + exp(-(r - 1.0) * 9.0) * 0.6 * step(1.0, r);
    col = vec3(1.0, 0.86, 0.6) * (disk * limb * gran * 2.2) + vec3(1.0, 0.72, 0.38) * corona;
    a = clamp(disk + corona, 0.0, 1.0);
    gl_FragColor = vec4(col * uOpacity, a * uOpacity);
    return;
  }
  float aa = fwidth(r) * 1.5;
  if (r < 1.0 + aa) {
    vec3 n = vec3(q, sqrt(max(0.0, 1.0 - r * r)));
    float diff = max(dot(n, uL), 0.0);
    float lat = asin(clamp(dot(n, uPole), -1.0, 1.0));
    vec3 base = uColor;
    if (uKind > 0.5 && uKind < 2.5) base *= 0.82 + 0.18 * sin(lat * 18.0 + n2(vec2(lat * 9.0, 1.0)) * 3.0);
    if (uKind > 2.5) base *= 0.75 + 0.35 * n2(q * 4.0 + 7.0) * n2(q * 9.0);
    col = base * (0.035 + 1.1 * diff);
    a = smoothstep(1.0 + aa, 1.0 - aa, r);
  }
  if (uKind > 1.5 && uKind < 2.5) {
    // кольца Сатурна: пересечение луча (ортогонально) с плоскостью колец
    float zp = -(q.x * uPole.x + q.y * uPole.y) / max(abs(uPole.z), 0.03) * sign(uPole.z);
    vec3 P = vec3(q, zp);
    float rr = length(P);
    float sphereZ = sqrt(max(0.0, 1.0 - r * r));
    bool hidden = r < 1.0 && zp < sphereZ;
    if (rr > 1.24 && rr < 2.27 && !hidden) {
      float band = 0.55 + 0.45 * sin(rr * 40.0) * sin(rr * 13.0);
      float cass = smoothstep(0.01, 0.0, abs(rr - 1.95) - 0.04);
      float ringA = (0.55 + 0.35 * band) * (1.0 - 0.85 * cass) * smoothstep(1.24, 1.32, rr);
      vec3 rc = vec3(0.86, 0.78, 0.6) * ringA * (0.25 + 0.75 * abs(dot(uPole, uL)));
      col = mix(col, rc, ringA * (1.0 - a * step(zp, sphereZ)));
      a = max(a, ringA * 0.9);
    }
  }
  gl_FragColor = vec4(col * uOpacity, a * uOpacity);
}`;

const BODY_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

interface Body {
  id: string;
  R: number;
  minPx: number;
  pos: () => V3;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  range: [number, number];
  ring: number;
  pole: V3;
}

const POLES: Record<string, V3> = {
  jupiter: radec(268.057, 64.495),
  saturn: radec(40.589, 83.537),
  uranus: radec(257.311, -15.175),
  neptune: radec(299.36, 43.46),
  earth: [0, 0, 1],
};

export class SolarLayer implements Layer {
  object = new THREE.Group();
  readonly bodies: Body[] = [];
  readonly positions: Record<string, V3> = {};
  /** наибольшее увеличение среди видимых тел */
  inflation = 1;
  private orbits = new THREE.Group();
  private orbitMats: { mat: LineMaterial; range: [number, number]; base: number; group: THREE.Group; center: () => V3 }[] = [];
  private tmpQ = new THREE.Quaternion();

  constructor(date: Date, earth: V3) {
    this.object.add(this.orbits);
    const moonAbs: V3 = (() => { const g = moonGeo(date); return [earth[0] + g[0], earth[1] + g[1], earth[2] + g[2]]; })();
    this.positions.moon = moonAbs;
    this.positions.earth = earth;
    this.positions.sun = [0, 0, 0];

    const add = (id: string, R: number, color: string, kind: number, minPx: number, pos: V3, range: [number, number], ring = 1) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: BODY_VERT, fragmentShader: BODY_FRAG, transparent: true, depthTest: false, depthWrite: false,
        blending: kind === 4 ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: {
          uColor: { value: new THREE.Color(color) }, uL: { value: new THREE.Vector3(0, 0, 1) }, uPole: { value: new THREE.Vector3(0, 1, 0) },
          uKind: { value: kind }, uRing: { value: ring }, uOpacity: { value: 1 }, uTime: { value: 0 },
        },
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 3.5;
      this.object.add(mesh);
      this.bodies.push({ id, R, minPx, pos: () => pos, mesh, mat, range, ring, pole: POLES[id] ?? [0, 0, 1] });
    };

    add('sun', 6.957e8, '#ffd9a0', 4, 7, [0, 0, 0], [9.6, 14.6], 7);
    // Луна: минимум 1 px — на этом масштабе размеры честные даже на телефоне (текст сцены это обещает)
    add('moon', 1.7374e6, '#b9b4aa', 3, 1.0, moonAbs, [7.6, 10.6]);
    const minPx: Record<string, number> = { mercury: 2.4, venus: 3.2, earth: 3.2, mars: 2.8, jupiter: 5.5, saturn: 4.6, uranus: 3.6, neptune: 3.6 };
    const kind: Record<string, number> = { jupiter: 1, saturn: 2, uranus: 1, neptune: 1 };
    for (const p of PLANETS) {
      const o = elementsAt(p.id, date);
      // Земля — точно там же, где камера её «видела» (формула для Солнца), а не по элементам
      const pos = p.id === 'earth' ? earth : planetPos(o);
      this.positions[p.id] = pos;
      const inner = ['mercury', 'venus', 'earth', 'mars'].includes(p.id);
      const range: [number, number] = p.id === 'earth' ? [10.4, 13.6] : inner ? [10.6, 13.4] : [11.2, 14.2];
      add(p.id, p.R, p.color, kind[p.id] ?? 0, minPx[p.id], pos, range, p.id === 'saturn' ? 2.35 : 1);
      // орбита — честная, по элементам JPL
      const pts = orbitPoints(o, 400);
      this.addOrbit(pts, () => [0, 0, 0], range, p.id === 'earth' ? 0.75 : 0.42);
    }
    // орбита Луны — по той же формуле, что и её положение, за 27,3 сут
    const mpts: V3[] = [];
    for (let i = 0; i <= 200; i++) mpts.push(moonGeo(new Date(date.getTime() + (i / 200) * 27.32 * 86400e3)));
    this.addOrbit(mpts, () => earth, [7.8, 10.4], 0.55);
  }

  private addOrbit(pts: V3[], center: () => V3, range: [number, number], base: number) {
    // координаты относительно центра в единицах 1e9 м — float32 хватает
    const arr: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) arr.push(...pts[i].map((v) => v / 1e9), ...pts[i + 1].map((v) => v / 1e9));
    const g = new LineSegmentsGeometry();
    g.setPositions(arr);
    const mat = new LineMaterial({ color: 0xe8b04b, linewidth: 1.2, transparent: true, opacity: base, depthTest: false, depthWrite: false, worldUnits: false });
    const line = new LineSegments2(g, mat);
    line.frustumCulled = false;
    line.renderOrder = 3.2;
    const group = new THREE.Group();
    group.matrixAutoUpdate = false;
    group.add(line);
    this.orbits.add(group);
    this.orbitMats.push({ mat, range, base, group, center });
  }

  update(f: Frame) {
    const vis = (r: [number, number]) => smoothstep(r[0], r[0] + 0.45, f.n) * (1 - smoothstep(r[1] - 0.45, r[1], f.n));
    // орбиты
    for (const o of this.orbitMats) {
      const op = vis(o.range) * o.base;
      o.group.visible = op > 0.002;
      if (!o.group.visible) continue;
      o.mat.opacity = op;
      o.mat.linewidth = 1.2 * Math.max(1, f.pxScale * f.dpr);
      o.mat.resolution.set(f.width * f.dpr, f.height * f.dpr);
      const c = o.center();
      const s = 1e9 / f.d;
      o.group.matrix.makeScale(s, s, s).setPosition((c[0] - f.cam[0]) / f.d, (c[1] - f.cam[1]) / f.d, (c[2] - f.cam[2]) / f.d);
      o.group.matrixWorldNeedsUpdate = true;
    }
    // тела
    this.tmpQ.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(...f.R), new THREE.Vector3(...f.U), new THREE.Vector3(-f.V[0], -f.V[1], -f.V[2])));
    let infl = 1;
    for (const b of this.bodies) {
      const op = vis(b.range);
      b.mesh.visible = op > 0.002;
      if (!b.mesh.visible) continue;
      const p = b.pos();
      const rel = sub(p, f.cam);
      const D = len(rel);
      if (dot(rel, f.V) <= 0) { b.mesh.visible = false; continue; }
      // единиц рендера на пиксель на расстоянии D: ширина кадра на дистанции D равна D
      const unitsPerPx = D / f.d / f.width;
      const trueR = b.R / f.d;
      const minR = b.minPx * f.pxScale * unitsPerPx;
      const shownR = Math.max(trueR, minR);
      if (op > 0.5 && b.id !== 'sun') infl = Math.max(infl, shownR / trueR);
      b.mesh.position.set(rel[0] / f.d, rel[1] / f.d, rel[2] / f.d);
      b.mesh.quaternion.copy(this.tmpQ);
      b.mesh.scale.setScalar(shownR * b.ring);
      const u = b.mat.uniforms;
      u.uOpacity.value = op;
      u.uTime.value = f.time;
      const L = norm(sub([0, 0, 0], p));
      (u.uL.value as THREE.Vector3).set(dot(L, f.R), dot(L, f.U), -dot(L, f.V));
      (u.uPole.value as THREE.Vector3).set(dot(b.pole, f.R), dot(b.pole, f.U), -dot(b.pole, f.V));
    }
    this.inflation = infl;
  }

  dispose() {
    this.object.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose();
    });
  }
}
