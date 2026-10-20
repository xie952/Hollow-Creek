// Dusk sky dome with a low, warm sun; also bakes the image-based lighting probe.
import * as THREE from 'three';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w; // force to the far plane
}
`;

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSunDisk;
uniform vec3 uZenith;
uniform vec3 uHorizonWarm;
uniform vec3 uHorizonCool;
uniform vec3 uGround;
uniform float uTime;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.52;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = rot * p * 2.03 + vec2(17.1, 9.4);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y;
  float sunAlign = dot(dir, uSunDir);
  float warmth = 0.16 + 0.84 * pow(clamp(sunAlign * 0.5 + 0.5, 0.0, 1.0), 3.0);
  vec3 horizon = mix(uHorizonCool, uHorizonWarm, warmth);
  float t = pow(clamp(h, 0.0, 1.0), 0.46);
  vec3 col = mix(horizon, uZenith, t);

  // A below-horizon haze so the terrain edge never shows a hard rim.
  float below = smoothstep(0.03, -0.22, h);
  col = mix(col, uGround, below * 0.78);

  // Broad atmospheric glow, a tighter corona, and the sun disc itself.
  float mu = max(sunAlign, 0.0);
  float glow = pow(mu, 4.0) * 0.22 + pow(mu, 26.0) * 0.7 + pow(mu, 150.0) * 1.7;
  col += uSunColor * glow;
  float disk = smoothstep(0.99955, 0.99986, mu);
  col += uSunDisk * disk * 7.0;

  // Thin, wind-stretched clouds, lit warm nearest the sun.
  vec2 cp = dir.xz / max(h + 0.32, 0.12);
  cp = cp * vec2(0.85, 1.8) + vec2(uTime * 0.004, uTime * 0.0012);
  float cl = fbm(cp * 1.15 + vec2(2.7, 1.2));
  float streak = fbm(cp * vec2(0.6, 3.8) + vec2(8.3, 1.7));
  cl = cl * 0.72 + streak * 0.38;
  float cloudMask = smoothstep(0.43, 0.68, cl) * smoothstep(0.008, 0.07, h) * (1.0 - smoothstep(0.3, 0.72, h));
  vec3 cloudWarm = mix(vec3(0.30, 0.27, 0.28), uSunColor * 1.2, pow(max(sunAlign, 0.0), 2.0) * 0.75);
  vec3 cloudCool = mix(vec3(0.17, 0.19, 0.23), vec3(0.48, 0.41, 0.37), warmth);
  vec3 cloudCol = mix(cloudCool, cloudWarm, cloudMask * 0.55);
  col = mix(col, cloudCol, cloudMask * 0.58);
  col = mix(col, uSunColor * 1.15, cloudMask * pow(max(sunAlign, 0.0), 3.0) * 0.3);

  // Faint warm haze hugging the treeline.
  float hazeBand = exp(-abs(h - 0.045) * 13.0);
  col += uSunColor * hazeBand * warmth * 0.045;

  // Dither to keep the large gradients from banding after grading.
  float dither = (hash21(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
  col += dither;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

export function createSky(renderer) {
  const sunDir = new THREE.Vector3(-0.62, 0.19, -0.76).normalize();
  const uniforms = {
    uSunDir: { value: sunDir.clone() },
    uSunColor: { value: new THREE.Color('#ffb87c') },
    uSunDisk: { value: new THREE.Color('#ffe3b8') },
    uZenith: { value: new THREE.Color('#1d3047') },
    uHorizonWarm: { value: new THREE.Color('#f0b47e') },
    uHorizonCool: { value: new THREE.Color('#82949b') },
    uGround: { value: new THREE.Color('#555348') },
    uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(240, 48, 32), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.name = 'sky';

  // Bake an environment map from the exact same dome, including the warm horizon.
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 24), material);
  envScene.add(envSky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  const envMap = pmrem.fromScene(envScene, 0.02, 0.1, 300).texture;
  envMap.mapping = THREE.CubeReflectionMapping;
  pmrem.dispose();
  envSky.geometry.dispose();

  return {
    mesh,
    material,
    uniforms,
    envMap,
    sunDir,
    update(t, dt) {
      uniforms.uTime.value = t;
    },
  };
}
