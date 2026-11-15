import * as THREE from 'three';
import type { Frame } from './types.ts';

/** Общий вершинный шейдер полноэкранного прохода: даёт мировое направление луча vRay. */
export const FS_VERT = /* glsl */ `
uniform vec3 uR; uniform vec3 uU; uniform vec3 uV;
uniform vec2 uTan;
varying vec3 vRay;
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  vRay = uV + uR * position.x * uTan.x + uU * position.y * uTan.y;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export const NOISE_GLSL = /* glsl */ `
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

export function fullscreenMesh(fragmentShader: string, uniforms: Record<string, THREE.IUniform>, blending: THREE.Blending = THREE.NormalBlending) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const mat = new THREE.ShaderMaterial({
    vertexShader: FS_VERT,
    fragmentShader,
    uniforms: {
      uR: { value: new THREE.Vector3() }, uU: { value: new THREE.Vector3() }, uV: { value: new THREE.Vector3() },
      uTan: { value: new THREE.Vector2(0.5, 0.28) },
      ...uniforms,
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, mat };
}

export function setRayUniforms(mat: THREE.ShaderMaterial, f: Frame) {
  const u = mat.uniforms;
  (u.uR.value as THREE.Vector3).set(f.R[0], f.R[1], f.R[2]);
  (u.uU.value as THREE.Vector3).set(f.U[0], f.U[1], f.U[2]);
  (u.uV.value as THREE.Vector3).set(f.V[0], f.V[1], f.V[2]);
  (u.uTan.value as THREE.Vector2).set(0.5, 0.5 * f.height / f.width);
}
