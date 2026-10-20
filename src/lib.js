// Shared deterministic noise, canvas and geometry helpers.
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y, seed = 0) {
  let h = x * 374761393 + y * 668265263 + seed * 2147483647;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

const tSmooth = (t) => t * t * (3 - 2 * t);

export function valueNoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = tSmooth(xf), v = tSmooth(yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export function fbm(x, y, octaves = 4, seed = 0, lacunarity = 2, gain = 0.5) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 17);
    norm += amp;
    amp *= gain; freq *= lacunarity;
  }
  return sum / norm;
}

export function tileNoise(x, y, period, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = tSmooth(xf), v = tSmooth(yf);
  const w = (n) => ((n % period) + period) % period;
  const a = hash2(w(xi), w(yi), seed), b = hash2(w(xi + 1), w(yi), seed);
  const c = hash2(w(xi), w(yi + 1), seed), d = hash2(w(xi + 1), w(yi + 1), seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export function tileFbm(x, y, period = 8, octaves = 4, seed = 0) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * tileNoise(x * freq, y * freq, period * freq, seed + i * 31);
    norm += amp;
    amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}

export function createCanvas(size = 512, height = size) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }) };
}

let MAX_ANISO = 4;
export function setMaxAnisotropy(v) { MAX_ANISO = Math.min(8, v || 4); }

export function makeTexture(canvas, opts = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.anisotropy = MAX_ANISO;
  tex.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  tex.needsUpdate = true;
  return tex;
}

// Sobel normal map from the luminance of a procedural color map.
// Optional size downsamples the source first, which keeps normals soft and boot fast.
export function normalFromCanvas(canvas, strength = 2.4, size = 0) {
  let srcCanvas = canvas;
  if (size && (canvas.width !== size || canvas.height !== size)) {
    srcCanvas = document.createElement('canvas');
    srcCanvas.width = size; srcCanvas.height = size;
    srcCanvas.getContext('2d').drawImage(canvas, 0, 0, size, size);
  }
  const w = srcCanvas.width, h = srcCanvas.height;
  const src = srcCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(w, h);
  const lum = (x, y) => {
    const ix = ((y + h) % h) * w + ((x + w) % w);
    return (src[ix * 4] * 0.2126 + src[ix * 4 + 1] * 0.7152 + src[ix * 4 + 2] * 0.0722) / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (lum(x + 1, y - 1) + 2 * lum(x + 1, y) + lum(x + 1, y + 1))
               - (lum(x - 1, y - 1) + 2 * lum(x - 1, y) + lum(x - 1, y + 1));
      const dy = (lum(x - 1, y + 1) + 2 * lum(x, y + 1) + lum(x + 1, y + 1))
               - (lum(x - 1, y - 1) + 2 * lum(x, y - 1) + lum(x + 1, y - 1));
      const nx = -dx * strength * 0.5, ny = -dy * strength * 0.5, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const o = (y * w + x) * 4;
      img.data[o] = (nx / len * 0.5 + 0.5) * 255;
      img.data[o + 1] = (ny / len * 0.5 + 0.5) * 255;
      img.data[o + 2] = (nz / len * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return makeTexture(out, { srgb: false });
}

export function roughFromCanvas(canvas, lo = 0.55, hi = 0.95, invert = false) {
  const w = canvas.width, h = canvas.height;
  const src = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = (src[i * 4] * 0.2126 + src[i * 4 + 1] * 0.7152 + src[i * 4 + 2] * 0.0722) / 255;
    const k = lerp(lo, hi, invert ? 1 - v : v);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = k * 255;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return makeTexture(out, { srgb: false });
}

// ------------------------------------------------------------------ geometry
export function boxUV(geo, w, h, d) {
  const uv = geo.attributes.uv;
  const spans = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = spans[f];
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, uv.getX(idx) * su, uv.getY(idx) * sv);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

export function planeUV(geo, w, h) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  uv.needsUpdate = true;
  return geo;
}

export function makeBox(w, h, d, mat) {
  const geo = boxUV(new THREE.BoxGeometry(w, h, d), w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

export function bnd(parent, mat, x0, x1, y0, y1, z0, z1, opts = {}) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  const m = makeBox(w, h, d, mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  if (opts.ry) m.rotation.y = opts.ry;
  if (opts.rz) m.rotation.z = opts.rz;
  if (opts.rx) m.rotation.x = opts.rx;
  if (opts.cast === false) m.castShadow = false;
  if (opts.receive === false) m.receiveShadow = false;
  if (opts.name) m.name = opts.name;
  parent.add(m);
  return m;
}

export function makePlane(w, h, mat) {
  const geo = planeUV(new THREE.PlaneGeometry(w, h), w, h);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = false; m.receiveShadow = true;
  return m;
}

export function planeAt(parent, mat, w, h, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = makePlane(w, h, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}

export function cyl(parent, mat, rt, rb, h, x, y, z, seg = 16, opts = {}) {
  const geo = new THREE.CylinderGeometry(rt, rb, h, seg, opts.heightSeg || 1, !!opts.open);
  if (opts.uvMeters) {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * Math.PI * 2 * Math.max(rt, rb) / opts.uvMeters, uv.getY(i) * h / opts.uvMeters);
    }
    uv.needsUpdate = true;
  }
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = opts.cast !== false;
  m.receiveShadow = opts.receive !== false;
  if (opts.rx) m.rotation.x = opts.rx;
  if (opts.rz) m.rotation.z = opts.rz;
  if (opts.ry) m.rotation.y = opts.ry;
  parent.add(m);
  return m;
}

export function transformGeometry(geo, { position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
  m.compose(new THREE.Vector3(...position), q, new THREE.Vector3(...scale));
  geo.applyMatrix4(m);
  return geo;
}

// A tapered cylinder between two points, useful for branches and limbs.
export function limb(a, b, r0, r1, radialSegments = 6, uvMeters = 1) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(r0, r1, len, radialSegments, 1, false);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * Math.max(r0, r1) / uvMeters, uv.getY(i) * len / uvMeters);
  uv.needsUpdate = true;
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  geo.applyQuaternion(q);
  geo.translate(mid.x, mid.y, mid.z);
  return geo;
}

export function cardGeometry(w, h, rotY = 0, rotX = 0) {
  const geo = new THREE.PlaneGeometry(w, h);
  transformGeometry(geo, { rotation: [rotX, rotY, 0] });
  return geo;
}

export function randomPointInCircle(rng, radius) {
  const a = rng() * TAU;
  const r = Math.sqrt(rng()) * radius;
  return [Math.cos(a) * r, Math.sin(a) * r];
}

export function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) if (m && m.dispose && !m.userData?.shared) m.dispose();
  });
}
