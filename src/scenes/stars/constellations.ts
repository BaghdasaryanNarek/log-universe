import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { PC } from '../../content/facts.ts';
import { smoothstep } from '../../core/vec.ts';
import type { Frame, Layer } from '../../gl/types.ts';
import type { StarCatalog } from './catalog.ts';
import { SKY_R } from './stars-layer.ts';

/**
 * Линии созвездий между настоящими 3D-положениями звёзд.
 * С Земли это привычные фигуры; когда камера уходит на парсеки, фигуры искажаются —
 * звёзды созвездия находятся на очень разных расстояниях.
 */
const FIGURES: [string, string][][] = [
  // Большой Ковш
  [['Dubhe', 'Merak'], ['Merak', 'Phecda'], ['Phecda', 'Megrez'], ['Megrez', 'Dubhe'], ['Megrez', 'Alioth'], ['Alioth', 'Mizar'], ['Mizar', 'Alkaid']],
  // Орион
  [['Betelgeuse', 'Bellatrix'], ['Betelgeuse', 'Meissa'], ['Bellatrix', 'Meissa'], ['Bellatrix', 'Mintaka'], ['Mintaka', 'Alnilam'], ['Alnilam', 'Alnitak'], ['Alnitak', 'Betelgeuse'], ['Alnitak', 'Saiph'], ['Mintaka', 'Rigel']],
  // Кассиопея (γ Cas без собственного имени в HYG)
  [['Caph', 'Schedar'], ['Schedar', 'Gam Cas'], ['Gam Cas', 'Ruchbah'], ['Ruchbah', 'Segin']],
];

export class ConstellationLayer implements Layer {
  object: LineSegments2;
  private mat: LineMaterial;
  private pairs: [number, number][] = [];
  private buf: Float32Array;
  private geo: LineSegmentsGeometry;

  constructor(private cat: StarCatalog) {
    const idx = (name: string) => {
      if (name.includes(' ')) { const [b, c] = name.split(' '); return cat.findBayer(b, c); }
      return cat.find(name);
    };
    for (const fig of FIGURES) for (const [a, b] of fig) {
      const ia = idx(a), ib = idx(b);
      if (ia >= 0 && ib >= 0) this.pairs.push([ia, ib]);
    }
    this.buf = new Float32Array(this.pairs.length * 6);
    this.geo = new LineSegmentsGeometry();
    this.geo.setPositions(this.buf);
    this.mat = new LineMaterial({ color: 0xe8b04b, linewidth: 1.2, transparent: true, opacity: 0.4, depthTest: false, depthWrite: false, worldUnits: false });
    this.object = new LineSegments2(this.geo, this.mat);
    this.object.frustumCulled = false;
    this.object.renderOrder = 2;
  }

  update(f: Frame) {
    const op = (0.34 + 0.24 * smoothstep(14.5, 16.5, f.n)) * (1 - smoothstep(18.2, 19.2, f.n));
    this.object.visible = op > 0.002;
    if (!this.object.visible) return;
    this.mat.opacity = op;
    this.mat.linewidth = 1.2 * Math.max(1, f.pxScale * f.dpr);
    this.mat.resolution.set(f.width * f.dpr, f.height * f.dpr);
    const p = this.cat.pos;
    const cx = f.cam[0] / PC, cy = f.cam[1] / PC, cz = f.cam[2] / PC;
    const k = PC / f.d;
    const proj = (i: number, out: number[]) => {
      let x = (p[i * 3] - cx) * k, y = (p[i * 3 + 1] - cy) * k, z = (p[i * 3 + 2] - cz) * k;
      const L = Math.hypot(x, y, z);
      if (L > SKY_R) { const s = SKY_R / L; x *= s; y *= s; z *= s; }
      out[0] = x; out[1] = y; out[2] = z;
    };
    const a = [0, 0, 0], b = [0, 0, 0];
    this.pairs.forEach(([ia, ib], j) => {
      proj(ia, a); proj(ib, b);
      // зазор у звёзд, как на старинных картах
      const gap = 0.09;
      for (let c = 0; c < 3; c++) {
        const d = b[c] - a[c];
        this.buf[j * 6 + c] = a[c] + d * gap;
        this.buf[j * 6 + 3 + c] = b[c] - d * gap;
      }
    });
    const attr = this.geo.attributes.instanceStart as THREE.InterleavedBufferAttribute;
    (attr.data.array as Float32Array).set(this.buf);
    attr.data.needsUpdate = true;
  }

  dispose() { this.geo.dispose(); this.mat.dispose(); }
}
