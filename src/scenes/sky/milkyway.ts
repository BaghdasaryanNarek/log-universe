import * as THREE from 'three';
import { fullscreenMesh, NOISE_GLSL, setRayUniforms } from '../../gl/fullscreen.ts';
import { EQ_TO_GAL } from '../../gl/astro.ts';
import { smoothstep } from '../../core/vec.ts';
import type { Frame, Layer } from '../../gl/types.ts';

/**
 * Полоса Млечного Пути на небе — в настоящей ориентации: луч переводится
 * в галактические координаты (матрица Hipparcos), яркость зависит от широты b
 * и долготы l (к центру Галактики ярче), плюс тёмные пылевые прожилки.
 */
const FRAG = /* glsl */ `
${NOISE_GLSL}
uniform mat3 uEqToGal;
uniform float uI;
uniform vec3 uTint;
varying vec3 vRay;
void main() {
  vec3 g = uEqToGal * normalize(vRay);
  float b = asin(clamp(g.z, -1.0, 1.0));
  float l = atan(g.y, g.x);
  float toCenter = 0.5 + 0.5 * cos(l);
  float width = 0.075 + 0.07 * toCenter;
  float band = exp(-(b * b) / (width * width));
  float bulge = exp(-(b * b * 9.0 + l * l * 1.6)) * 0.9;
  float n1 = fbm(g * 5.0);
  float n2 = fbm(g * 17.0 + 3.1);
  float dust = smoothstep(0.42, 0.72, fbm(g * 8.0 + 7.3)) * exp(-(b * b) / (0.03 * 0.03 + 0.02 * toCenter * 0.02));
  float I = (band * (0.25 + 0.75 * toCenter) * (0.35 + 0.9 * n1 * n2 * 1.6) + bulge * n1) * (1.0 - 0.75 * dust);
  I *= uI;
  gl_FragColor = vec4(uTint * I, I);
}`;

export class MilkyWayLayer implements Layer {
  object: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  constructor() {
    const m = new THREE.Matrix3().set(...EQ_TO_GAL[0], ...EQ_TO_GAL[1], ...EQ_TO_GAL[2]);
    const { mesh, mat } = fullscreenMesh(FRAG, {
      uEqToGal: { value: m },
      uI: { value: 0.1 },
      uTint: { value: new THREE.Color('#d8c7a0') },
    }, THREE.AdditiveBlending);
    this.object = mesh;
    this.mat = mat;
    mesh.renderOrder = 0;
  }
  update(f: Frame) {
    setRayUniforms(this.mat, f);
    // снаружи окрестностей Солнца полоса теряет смысл — в этапе 2 её сменит модель Галактики
    const fade = 1 - smoothstep(17.6, 19.4, f.n);
    this.mat.uniforms.uI.value = 0.085 * fade;
    this.object.visible = fade > 0.001;
  }
  dispose() { this.object.geometry.dispose(); this.mat.dispose(); }
}
