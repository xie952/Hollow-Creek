// Forest floor, a winding gravel approach, stones and deadwood.
import * as THREE from 'three';
import {
  mulberry32, fbm, clamp, smoothstep, lerp, makeTexture, createCanvas,
  makeBox, bnd, cyl, limb, TAU,
} from './lib.js';
import { metered } from './textures.js';

export function pathCenterX(z) {
  const t = clamp((z - 3.4) / 30, 0, 1);
  // The approach curves toward the right-hand viewpoint so it reads as a leading line.
  const bend = smoothstep(8.5, 17.5, z) * 5.8;
  return -0.22 + Math.sin(t * 3.1 + 0.55) * 0.52 + Math.sin(t * 7.2 + 1.2) * 0.13 + bend;
}

function roughHeight(x, z) {
  const n1 = fbm(x * 0.047 + 11.3, z * 0.047 - 6.2, 4, 4) - 0.5;
  const n2 = fbm(x * 0.16 - 3.7, z * 0.16 + 8.1, 3, 11) - 0.5;
  const d = Math.hypot(x * 0.88, z * 0.76);
  const amp = 0.16 + smoothstep(8, 34, d) * 1.5;
  return n1 * amp * 1.15 + n2 * (0.055 + smoothstep(6, 30, d) * 0.23) - 0.03;
}

export function terrainHeight(x, z) {
  let h = roughHeight(x, z);
  // Level the clearing around the cabin so the stone footing beds into the moss.
  const c = Math.hypot(x * 0.8, z * 0.7);
  const clear = 1 - smoothstep(5.6, 9.8, c);
  h = lerp(h, -0.03, clear * 0.82);

  // The path is a shallow, compacted groove.
  if (z > 3.0 && z < 33) {
    const px = pathCenterX(z);
    const pd = Math.abs(x - px);
    const zm = smoothstep(3.0, 5.0, z) * (1 - smoothstep(29.0, 33.0, z));
    const pm = zm * (1 - smoothstep(0.75, 2.3, pd));
    h = lerp(h, roughHeight(px, z) - 0.055, pm * 0.9);
  }
  return h;
}

function makeTerrainGeometry(size = 150, segs = 170) {
  const geo = new THREE.BufferGeometry();
  const count = (segs + 1) * (segs + 1);
  const pos = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const cols = new Float32Array(count * 3);
  const c = new THREE.Color();
  let p = 0, u = 0;
  for (let iz = 0; iz <= segs; iz++) {
    const z = -size / 2 + (iz / segs) * size;
    for (let ix = 0; ix <= segs; ix++) {
      const x = -size / 2 + (ix / segs) * size;
      const y = terrainHeight(x, z);
      pos[p++] = x; pos[p++] = y; pos[p++] = z;
      uvs[u++] = x; uvs[u++] = z;

      const damp = smoothstep(0.42, 0.74, fbm(x * 0.09 + 5, z * 0.09 - 2, 3, 21));
      const dry = smoothstep(0.52, 0.82, fbm(x * 0.14 - 9, z * 0.14 + 8, 3, 7));
      const pd = z > 2 ? Math.abs(x - pathCenterX(z)) : 9;
      const pathEdge = (1 - smoothstep(1.1, 2.6, pd)) * smoothstep(3.0, 6.0, z);
      let r = 0.78 + dry * 0.20 - damp * 0.11;
      let g = 0.78 + damp * 0.16 - dry * 0.12;
      let b = 0.66 - damp * 0.02 + dry * 0.05;
      r = lerp(r, 0.9, pathEdge * 0.3); g = lerp(g, 0.84, pathEdge * 0.3); b = lerp(b, 0.7, pathEdge * 0.3);
      // Push distant floor a touch cooler and darker for depth.
      const far = smoothstep(30, 80, Math.hypot(x, z));
      c.setRGB(r * (1 - far * 0.22), g * (1 - far * 0.2), b * (1 - far * 0.14));
      cols[p - 3] = c.r; cols[p - 2] = c.g; cols[p - 1] = c.b;
    }
  }
  const idx = [];
  for (let iz = 0; iz < segs; iz++) {
    for (let ix = 0; ix < segs; ix++) {
      const a = iz * (segs + 1) + ix;
      const b = a + 1;
      const cc = a + segs + 1;
      const d = cc + 1;
      idx.push(a, cc, b, b, cc, d);
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function buildPath(mats) {
  const group = new THREE.Group();
  group.name = 'path';
  const samples = 76;
  const across = 5;
  const positions = [], uvs = [], indices = [];
  let dist = 0;
  let prevX = pathCenterX(4.6), prevZ = 4.6;
  for (let i = 0; i <= samples; i++) {
    const z = 4.6 + (i / samples) * 28.5;
    const cx = pathCenterX(z);
    dist += Math.hypot(cx - prevX, z - prevZ);
    prevX = cx; prevZ = z;
    const width = 1.34 + 0.24 * Math.sin(z * 0.55 + 1.3) + 0.16 * Math.sin(z * 1.7);
    for (let k = 0; k < across; k++) {
      const t = k / (across - 1);
      const off = (t - 0.5) * width + (k === 0 || k === across - 1 ? (Math.sin(z * 3.7 + k * 2) * 0.09) : 0);
      const x = cx + off;
      const y = terrainHeight(x, z) + 0.018;
      positions.push(x, y, z);
      uvs.push(t * width, dist);
    }
    if (i < samples) {
      for (let k = 0; k < across - 1; k++) {
        const a = i * across + k;
        indices.push(a, a + across, a + 1, a + 1, a + across, a + across + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mats.path);
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

function stoneSlab(mats, rng, x, z, r, h = 0.12) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(r * (0.82 + rng() * 0.3), r, h, 7, 1);
  geo.scale(1, 1, 0.62 + rng() * 0.45);
  const m = new THREE.Mesh(geo, mats.stone);
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  // mossy top patch
  const mg = new THREE.SphereGeometry(r * 0.5, 8, 4);
  mg.scale(1, 0.13, 0.9);
  const moss = new THREE.Mesh(mg, mats.moss);
  moss.position.set((rng() - 0.5) * r * 0.4, h * 0.5 + 0.005, (rng() - 0.5) * r * 0.3);
  moss.receiveShadow = true;
  g.add(moss);
  g.position.set(x, terrainHeight(x, z) + h * 0.5 - 0.03, z);
  g.rotation.y = rng() * TAU;
  return g;
}

function rockGeometry(seed) {
  const rng = mulberry32(seed);
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm(v.x * 2.1 + 4, v.z * 2.1 + v.y * 1.7, 3, seed % 97);
    v.multiplyScalar(0.82 + n * 0.34);
    v.y *= 0.66;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function addRock(mats, parent, rng, x, z, s, seed) {
  const geo = rockGeometry(seed);
  const m = new THREE.Mesh(geo, mats.stone);
  m.scale.set(s * (0.8 + rng() * 0.5), s * (0.55 + rng() * 0.4), s * (0.8 + rng() * 0.5));
  m.rotation.y = rng() * TAU;
  m.position.set(x, terrainHeight(x, z) + s * 0.22, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  if (s > 0.45) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(s * 0.62, 9, 5), mats.moss);
    cap.scale.set(1, 0.14, 1);
    cap.position.set(x + (rng() - 0.5) * s * 0.2, terrainHeight(x, z) + s * 0.52, z + (rng() - 0.5) * s * 0.2);
    cap.receiveShadow = true;
    parent.add(cap);
  }
}

function addLog(mats, parent, ax, ay, az, bx, by, bz, r0, r1, seed) {
  const geo = limb(new THREE.Vector3(ax, ay, az), new THREE.Vector3(bx, by, bz), r0, r1, 9, 0.9);
  const m = new THREE.Mesh(geo, mats.bark);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  // end discs + a few moss cushions along the top
  for (const [p, r, sign] of [[new THREE.Vector3(ax, ay, az), r0, -1], [new THREE.Vector3(bx, by, bz), r1, 1]]) {
    const cg = new THREE.CircleGeometry(r * 1.02, 9);
    const cm = new THREE.Mesh(cg, mats.logEnd);
    cm.position.copy(p);
    if (sign < 0) cm.rotation.y = Math.PI;
    cm.castShadow = false; cm.receiveShadow = true;
    parent.add(cm);
  }
  const dir = new THREE.Vector3(bx - ax, by - ay, bz - az);
  const len = dir.length();
  const rng = mulberry32(seed);
  for (let i = 0; i < 4; i++) {
    const t = 0.18 + i * 0.2;
    const pos = new THREE.Vector3(ax, ay, az).addScaledVector(dir, t);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r0 * (1 - t * 0.4) * (0.5 + rng() * 0.4), 8, 4), mats.moss);
    cap.scale.set(1, 0.1, 0.8);
    cap.position.copy(pos); cap.position.y += r0 * 0.8;
    cap.receiveShadow = true;
    parent.add(cap);
  }
}

export function createTerrain(mats) {
  const group = new THREE.Group();
  group.name = 'terrain';

  const ground = new THREE.Mesh(makeTerrainGeometry(150, 168), mats.ground);
  ground.receiveShadow = true;
  ground.castShadow = false;
  group.add(ground);

  group.add(buildPath(mats));

  const rng = mulberry32(7351);

  // A short run of set stones where the gravel meets the porch steps.
  const stoneZ = [5.0, 5.8, 6.6, 7.5, 9.1, 11.2, 13.4];
  for (let i = 0; i < stoneZ.length; i++) {
    const z = stoneZ[i];
    const x = pathCenterX(z) + (rng() - 0.5) * 0.8;
    group.add(stoneSlab(mats, rng, x, z, i < 3 ? 0.52 + rng() * 0.16 : 0.36 + rng() * 0.15));
  }
  // Edge stones half-buried in the moss.
  for (let i = 0; i < 26; i++) {
    const z = 5 + rng() * 24;
    const side = rng() < 0.5 ? -1 : 1;
    const x = pathCenterX(z) + side * (0.9 + rng() * 0.6);
    addRock(mats, group, rng, x, z, 0.15 + rng() * 0.3, 300 + i);
  }

  // Boulder groups at the clearing's shoulders.
  const boulders = [
    [-8.8, 6.2, 1.1], [-9.7, 4.0, 0.7], [8.9, 7.4, 0.85], [10.1, 2.1, 0.7],
    [-5.6, 11.8, 0.55], [5.2, 13.6, 0.6], [-4.8, -8.2, 0.9], [6.8, -7.0, 0.65],
    [11.5, 9.8, 0.5], [-11.2, 10.6, 0.8],
  ];
  boulders.forEach((b, i) => addRock(mats, group, rng, b[0], b[1], b[2], 120 + i));

  // Fallen trees and mossy stumps.
  addLog(mats, group, -7.8, terrainHeight(-7.8, 10.5) + 0.24, 10.5, -4.6, terrainHeight(-4.6, 12.2) + 0.18, 12.2, 0.28, 0.2, 51);
  addLog(mats, group, 6.4, terrainHeight(6.4, -6.0) + 0.3, -6.0, 9.4, terrainHeight(9.4, -4.8) + 0.16, -4.8, 0.36, 0.2, 52);

  const stumpPositions = [[-5.6, 3.6, 0.42], [7.4, -1.0, 0.34], [-2.0, 15.6, 0.3]];
  for (const [x, z, r] of stumpPositions) {
    const y = terrainHeight(x, z);
    const st = new THREE.Group();
    const trunk = cyl(st, mats.bark, r * 0.88, r * 1.08, 0.62, 0, 0.31, 0, 10, { uvMeters: 0.9 });
    trunk.castShadow = true;
    const top = new THREE.Mesh(new THREE.CircleGeometry(r * 0.89, 10), mats.logEnd);
    top.rotation.x = -Math.PI / 2; top.position.y = 0.622;
    top.receiveShadow = true;
    st.add(top);
    for (let k = 0; k < 4; k++) {
      const a = k * TAU / 4 + rng();
      const root = limb(
        new THREE.Vector3(Math.cos(a) * r * 0.6, 0.1, Math.sin(a) * r * 0.6),
        new THREE.Vector3(Math.cos(a) * r * 2.0, -0.06, Math.sin(a) * r * 2.0),
        0.1, 0.035, 5, 0.9
      );
      const rm = new THREE.Mesh(root, mats.bark);
      rm.castShadow = true; rm.receiveShadow = true;
      st.add(rm);
    }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.65, 8, 4), mats.moss);
    cap.scale.set(1, 0.12, 1); cap.position.y = 0.64; cap.receiveShadow = true;
    st.add(cap);
    st.position.set(x, y, z);
    group.add(st);
  }

  return { group, heightAt: terrainHeight, pathCenterX };
}
