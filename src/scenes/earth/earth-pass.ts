import * as THREE from 'three';
import { fullscreenMesh, setRayUniforms } from '../../gl/fullscreen.ts';
import { EARTH_R } from '../../gl/astro.ts';
import { len, mul, norm, smoothstep, sub, type V3 } from '../../core/vec.ts';
import type { Frame, Layer } from '../../gl/types.ts';

/**
 * Земля как аналитическая сфера в полноэкранном проходе.
 * Попадание луча проверяется по углу (cos ρ считается на CPU в float64),
 * поэтому горизон верен и у самой земли (h = 1 м), и из космоса.
 * Поверх — латунная градусная сетка, как на армиллярной сфере.
 */
const FRAG = /* glsl */ `
uniform vec3 uDirC;
uniform float uCosRho;
uniform vec3 uC;
uniform float uC2;
uniform float uRad;
uniform mat3 uEqToEcef;
uniform float uGrat;
uniform float uAtmW;
uniform float uAtmI;
uniform vec3 uAtmCol;
uniform vec3 uInk;
uniform vec3 uBrass;
uniform float uSpace;
uniform sampler2D tDay;
uniform sampler2D tNight;
uniform vec3 uSunDir;
uniform float uTex;
varying vec3 vRay;
float gridLine(float x, float step) {
  float g = abs(fract(x / step + 0.5) - 0.5) * step;
  float w = fwidth(x) * 1.2;
  return 1.0 - smoothstep(0.0, w, g);
}
void main() {
  vec3 ray = normalize(vRay);
  float cosA = dot(ray, uDirC);
  float rho = acos(clamp(uCosRho, -1.0, 1.0));
  float ang = acos(clamp(cosA, -1.0, 1.0));
  bool hit = cosA > uCosRho;
  vec3 col = vec3(0.0);
  float a = 0.0;
  if (hit) {
    col = uInk; a = 1.0;
    if (uGrat > 0.001) {
      float b = dot(ray, uC);
      float t = b - sqrt(max(b * b - uC2, 0.0));
      vec3 p = (ray * t - uC) / uRad;
      vec3 e = uEqToEcef * normalize(p);
      float lat = degrees(asin(clamp(e.z, -1.0, 1.0)));
      float lon = degrees(atan(e.y, e.x));
      float mu = clamp(dot(normalize(p), -ray), 0.0, 1.0);
      float g = max(gridLine(lat, 15.0), gridLine(lon, 15.0) * step(abs(lat), 75.0));
      float eq = gridLine(lat, 180.0);
      if (uTex > 0.001) {
        vec2 uv = vec2(lon / 360.0 + 0.5, lat / 180.0 + 0.5);
        float sunC = dot(normalize(p), uSunDir);
        float day = smoothstep(-0.08, 0.18, sunC);
        vec3 albedo = texture2D(tDay, uv).rgb;
        vec3 lights = texture2D(tNight, uv).rgb;
        vec3 lit = albedo * (0.06 + 1.05 * max(sunC, 0.0));
        vec3 night = pow(lights, vec3(1.25)) * vec3(1.2, 0.92, 0.55) * 1.8 + vec3(0.006, 0.009, 0.018);
        vec3 surf = mix(night, lit, day) * (0.55 + 0.45 * mu);
        col = mix(col, surf, uTex);
      }
      col += uBrass * (g * 0.32 + eq * 0.25) * uGrat * (0.25 + 0.75 * mu) * (1.0 - 0.6 * uTex);
    }
  }
  float x = ang - rho;
  // из космоса тонкий ореол заходит и на диск; с земли свечение только над горизонтом
  float glow = hit ? exp(x / (uAtmW * 0.35)) * 0.55 * uSpace : exp(-x / uAtmW);
  col += uAtmCol * glow * uAtmI;
  a = max(a, clamp(glow * uAtmI, 0.0, 1.0));
  gl_FragColor = vec4(col, a);
}`;

export class EarthPass implements Layer {
  object: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private ecef = new THREE.Matrix3();
  constructor(private center: V3, gmst: number, tex: { day: THREE.Texture; night: THREE.Texture }) {
    const { mesh, mat } = fullscreenMesh(FRAG, {
      uDirC: { value: new THREE.Vector3() },
      uCosRho: { value: 0 },
      uC: { value: new THREE.Vector3() },
      uC2: { value: 0 },
      uRad: { value: 1 },
      uEqToEcef: { value: this.ecef },
      uGrat: { value: 0 },
      uAtmW: { value: 0.1 },
      uAtmI: { value: 0.5 },
      uAtmCol: { value: new THREE.Color('#5a3d22') },
      uInk: { value: new THREE.Color('#050609') },
      uBrass: { value: new THREE.Color('#e8b04b') },
      uSpace: { value: 0 },
      tDay: { value: tex.day },
      tNight: { value: tex.night },
      uSunDir: { value: new THREE.Vector3() },
      uTex: { value: 0 },
    });
    this.object = mesh;
    this.mat = mat;
    mesh.renderOrder = 3;
    // ECEF: поворот экваториальных координат на −GMST вокруг оси мира
    const c = Math.cos(gmst), s = Math.sin(gmst);
    this.ecef.set(c, s, 0, -s, c, 0, 0, 0, 1);
  }
  update(f: Frame) {
    setRayUniforms(this.mat, f);
    const u = this.mat.uniforms;
    const toC = sub(this.center, f.cam);
    const D = len(toC);
    const dir = norm(toC);
    (u.uDirC.value as THREE.Vector3).set(dir[0], dir[1], dir[2]);
    // cos ρ = sqrt(1 − (R/D)²) = sqrt((D−R)(D+R))/D — без потери точности у поверхности
    u.uCosRho.value = Math.sqrt(Math.max(0, (D - EARTH_R) * (D + EARTH_R))) / D;
    const C = mul(toC, 1 / f.d);
    (u.uC.value as THREE.Vector3).set(C[0], C[1], C[2]);
    u.uC2.value = ((D - EARTH_R) * (D + EARTH_R)) / (f.d * f.d);
    u.uRad.value = EARTH_R / f.d;
    u.uGrat.value = smoothstep(6.2, 7.2, f.n);
    u.uTex.value = smoothstep(4.4, 5.4, f.n);
    const sd = norm(mul(this.center, -1));
    (u.uSunDir.value as THREE.Vector3).set(sd[0], sd[1], sd[2]);
    const H = 6e4;
    const inside = D < EARTH_R + H;
    const rho = Math.asin(Math.min(1, EARTH_R / D));
    const wSpace = inside ? 0.09 : Math.max(0.0015, Math.asin(Math.min(1, (EARTH_R + H) / D)) - rho);
    const kSpace = smoothstep(4.3, 5.6, f.n);
    u.uSpace.value = kSpace;
    u.uAtmW.value = 0.07 * (1 - kSpace) + wSpace * kSpace;
    u.uAtmI.value = 0.3 * (1 - kSpace) + 0.35 * kSpace;
    (u.uAtmCol.value as THREE.Color).setRGB(0.35 - 0.2 * kSpace, 0.24 - 0.02 * kSpace, 0.13 + 0.32 * kSpace, THREE.SRGBColorSpace);
    this.object.visible = f.n < 11.8;
  }
  dispose() { this.object.geometry.dispose(); this.mat.dispose(); }
}
