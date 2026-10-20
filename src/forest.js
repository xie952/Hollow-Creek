// Procedural spruce, fir, birch and larch forest with understory, all instanced.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  mulberry32, fbm, clamp, smoothstep, lerp, TAU, limb,
} from './lib.js';
import { terrainHeight, pathCenterX } from './terrain.js';
import { forestBackdrop } from './textures.js';

// ---------------------------------------------------------------- card helpers
function sprayCard(len, h, tilt, angle, droop, y, x = 0, z = 0) {
  const geo = new THREE.PlaneGeometry(len, h, 1, 1);
  geo.translate(len / 2, 0, 0);
  geo.rotateZ(-droop);
  geo.rotateX(-Math.PI / 2 + tilt);
  geo.rotateY(angle);
  geo.translate(x, y, z);
  return geo;
}

function uprightCard(w, h, rotY = 0, rotX = 0, rotZ = 0, x = 0, y = 0, z = 0) {
  const geo = new THREE.PlaneGeometry(w, h, 1, 1);
  geo.rotateZ(rotZ);
  geo.rotateX(rotX);
  geo.rotateY(rotY);
  geo.translate(x, y, z);
  return geo;
}

function crossedTuft(w, h, count, spread = 0.05) {
  const geos = [];
  for (let i = 0; i < count; i++) {
    geos.push(uprightCard(w, h, (i / count) * Math.PI + 0.18 * i, 0, 0, (i % 2 ? 1 : -1) * spread, h / 2, 0));
  }
  return mergeGeometries(geos, false);
}

// ---------------------------------------------------------------- conifers
function buildConifer(seed, opts) {
  const rng = mulberry32(seed);
  const { H, spread, layers, tiltMax = 0.8 } = opts;
  const trunkGeos = [];
  const foliageGeos = [];

  // Slight trunk lean gives old trees character.
  const leanX = (rng() - 0.5) * 0.16;
  const leanZ = (rng() - 0.5) * 0.16;
  trunkGeos.push(limb(new THREE.Vector3(0, -0.35, 0), new THREE.Vector3(leanX, H * 0.52, leanZ), 0.32, 0.15, 7, 0.9));
  trunkGeos.push(limb(new THREE.Vector3(leanX, H * 0.5, leanZ), new THREE.Vector3(leanX * 2.1, H * 0.99, leanZ * 2.1), 0.15, 0.018, 6, 0.9));

  // Root flare.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + rng() * 0.5;
    trunkGeos.push(limb(
      new THREE.Vector3(0, 0.14, 0),
      new THREE.Vector3(Math.cos(a) * (0.55 + rng() * 0.5), -0.16, Math.sin(a) * (0.55 + rng() * 0.5)),
      0.12, 0.035, 5, 0.9
    ));
  }

  const startY = 1.05;
  for (let l = 0; l < layers; l++) {
    const t = l / (layers - 1);
    const y = startY + (H * 0.94 - startY) * Math.pow(t, 0.96);
    const radius = Math.max(0.28, spread * Math.pow(1 - t, 1.28) * (0.82 + rng() * 0.28));
    const count = Math.max(4, Math.round(lerp(7, 4, t) + (rng() < 0.3 ? 1 : 0)));
    const offset = rng() * TAU;
    for (let b = 0; b < count; b++) {
      const a = offset + (b / count) * TAU + (rng() - 0.5) * 0.32;
      const len = radius * (0.78 + rng() * 0.4);
      const droop = 0.16 + rng() * 0.24 + t * 0.18;
      // No bare branch cylinders: at distance they read as antennae, and the
      // needle cards alone carry a cleaner, fuller silhouette.
      const ch = Math.max(0.5, radius * 0.82 + 0.22);
      const tilt = (rng() - 0.5) * tiltMax;
      foliageGeos.push(sprayCard(len * 1.38, ch, tilt, -a, droop, y, 0, 0));
      foliageGeos.push(sprayCard(len * 1.2, ch * 0.94, tilt + (rng() < 0.5 ? -0.7 : 0.7), -a + 0.16, droop * 0.8, y - 0.12, 0, 0));
      foliageGeos.push(sprayCard(len * 1.06, ch * 1.15, tilt + 1.15, -a + 0.34, droop * 0.5, y - 0.2, 0, 0));
      // Cross-facing boughs read from every camera angle instead of vanishing edge-on.
      foliageGeos.push(sprayCard(len * 1.02, ch * 0.72, tilt + 0.62, -a + Math.PI / 2, droop * 0.7, y - 0.06, 0, 0));
      foliageGeos.push(sprayCard(len * 0.94, ch * 0.68, tilt - 0.5, -a - Math.PI / 2, droop * 0.6, y + 0.04, 0, 0));
    }
  }

  // Leader tuft.
  for (let i = 0; i < 3; i++) {
    const a = rng() * TAU;
    foliageGeos.push(sprayCard(0.9 + rng() * 0.6, 0.7, (rng() - 0.5) * 0.7, a, 0.2, H * 0.93, 0, 0));
  }

  const trunk = mergeGeometries(trunkGeos, false);
  const foliage = mergeGeometries(foliageGeos, false);
  for (const g of [...trunkGeos, ...foliageGeos]) g.dispose();
  trunk.computeVertexNormals();
  foliage.computeVertexNormals();
  return { trunk, foliage };
}

function buildBirch(seed, H) {
  const rng = mulberry32(seed);
  const trunkGeos = [];
  const foliageGeos = [];
  // Two gently bent trunk sections.
  const bend = (rng() - 0.5) * 0.7;
  trunkGeos.push(limb(new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(bend * 0.25, H * 0.55, bend), 0.18, 0.11, 8, 1.25));
  trunkGeos.push(limb(new THREE.Vector3(bend * 0.25, H * 0.53, bend), new THREE.Vector3(bend * 0.55, H * 0.97, bend * 0.4), 0.11, 0.025, 6, 1.25));

  const branchAngles = 12;
  for (let i = 0; i < branchAngles; i++) {
    const y = H * (0.4 + (i / branchAngles) * 0.5);
    const a = rng() * TAU + i * 2.1;
    const reach = (0.45 + rng() * 1.0) * (1 - i / (branchAngles * 1.5));
    const tip = new THREE.Vector3(Math.cos(a) * reach + bend * 0.4, y + 0.5 + rng() * 0.9, Math.sin(a) * reach);
    // Full clusters along each bough: a sparse crown reads as a bare pole.
    for (let k = 0; k < 4; k++) {
      const t = 0.24 + k * 0.22 + rng() * 0.1;
      const cx = lerp(bend * 0.3, tip.x, t), cy = lerp(y, tip.y, t), cz = lerp(bend * 0.6, tip.z, t);
      const card = new THREE.PlaneGeometry(0.85 + rng() * 0.7, 0.8 + rng() * 0.62);
      card.rotateX((rng() - 0.5) * 1.0);
      card.rotateY(rng() * TAU);
      card.rotateZ((rng() - 0.5) * 0.7);
      card.translate(cx, cy, cz);
      foliageGeos.push(card);
    }
  }
  // Crown fill.
  for (let i = 0; i < 30; i++) {
    const a = rng() * TAU, rr = Math.sqrt(rng()) * H * 0.2;
    const card = new THREE.PlaneGeometry(0.9 + rng() * 0.75, 0.85 + rng() * 0.65);
    card.rotateX((rng() - 0.5) * 1.1);
    card.rotateY(rng() * TAU);
    card.rotateZ((rng() - 0.5) * 0.9);
    card.translate(Math.cos(a) * rr + bend * 0.4, H * (0.56 + rng() * 0.4), Math.sin(a) * rr);
    foliageGeos.push(card);
  }

  const trunk = mergeGeometries(trunkGeos, false);
  const foliage = mergeGeometries(foliageGeos, false);
  for (const g of [...trunkGeos, ...foliageGeos]) g.dispose();
  return { trunk, foliage };
}

// ---------------------------------------------------------------- placement
function treeExcluded(x, z, cameraPos) {
  if (Math.abs(x) < 6.9 && z > -4.8 && z < 7.0) return true; // cabin + porch
  if (z > 2.8 && z < 34 && Math.abs(x - pathCenterX(z)) < 3.6) return true; // path corridor
  if (Math.hypot(x - cameraPos.x, z - cameraPos.z) < 10.4) return true;

  // Keep the hero sightline from the viewpoint to the porch clear of trunks.
  const ax = cameraPos.x, az = cameraPos.z;
  const bx = -3.2, bz = 0.6;
  const vx = bx - ax, vz = bz - az;
  const t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1);
  if (t < 0.97 && Math.hypot(x - (ax + vx * t), z - (az + vz * t)) < 4.3) return true;
  return false;
}

function instanced(geo, mat, items, { shadows = true, name = '' } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  mesh.name = name;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const tint = new THREE.Color();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    p.set(it.x, it.y, it.z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot);
    const sx = it.sx ?? it.s, sy = it.sy ?? it.s, sz = it.sz ?? it.s;
    s.set(sx, sy, sz);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    const c = it.color;
    tint.setRGB(c ? c[0] : 1, c ? c[1] : 1, c ? c[2] : 1);
    mesh.setColorAt(i, tint);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  mesh.frustumCulled = false;
  return mesh;
}

function backgroundFirGeometry() {
  // Three crossed silhouette cards read as feathered firs at distance,
  // while staying far cheaper than a full branch-by-branch tree.
  const planes = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(4.4, 10.4);
    g.translate(0, 5.2, 0);
    g.rotateY((i / 3) * Math.PI);
    planes.push(g);
  }
  const merged = mergeGeometries(planes, false);
  for (const g of planes) g.dispose();
  return merged;
}

export function createForest(mats, cameraPos) {
  const group = new THREE.Group();
  group.name = 'forest';
  const rng = mulberry32(20261020);

  const coniferVariants = [
    buildConifer(11, { H: 13.0, spread: 2.65, layers: 13 }),
    buildConifer(29, { H: 16.5, spread: 2.25, layers: 15, tiltMax: 0.7 }),
    buildConifer(43, { H: 10.5, spread: 2.85, layers: 11 }),
  ];
  const birches = [buildBirch(7, 9.4), buildBirch(19, 11.2)];
  const larches = [
    buildConifer(61, { H: 13.5, spread: 2.1, layers: 11, tiltMax: 1.0 }),
    buildConifer(73, { H: 10.8, spread: 1.95, layers: 9, tiltMax: 1.0 }),
  ];
  // Young firs fill the mid-story, so the wood reads as a forest rather than bare poles.
  const saplings = [
    buildConifer(101, { H: 4.3, spread: 1.15, layers: 8, tiltMax: 0.9 }),
    buildConifer(107, { H: 6.2, spread: 1.55, layers: 10, tiltMax: 0.9 }),
  ];

  const coniferBuckets = [[], [], []];
  const birchBuckets = [[], []];
  const larchBuckets = [[], []];
  const saplingBuckets = [[], []];

  function addTree(type, x, z, s, rot, variant = 0) {
    const y = terrainHeight(x, z) - 0.03;
    const it = { x, y, z, s, rot };
    if (type === 'birch') birchBuckets[variant].push(it);
    else if (type === 'larch') larchBuckets[variant].push(it);
    else coniferBuckets[variant].push(it);
  }

  // Hero silhouettes keep the frame composed even before the random fill.
  addTree('spruce', -11.2, 2.0, 1.18, 0.4, 0);
  addTree('spruce', -13.8, 9.2, 1.05, 1.7, 1);
  addTree('spruce', -8.6, -7.8, 1.25, 2.1, 1);
  addTree('spruce', 7.8, -8.6, 1.12, 0.3, 2);
  addTree('spruce', 14.8, 5.0, 0.92, 1.1, 0);
  addTree('spruce', -17.2, 18.8, 1.08, 2.9, 2);
  addTree('spruce', 19.6, 21.2, 0.92, 0.2, 0);
  addTree('spruce', -9.4, 19.4, 1.02, 1.2, 2);
  addTree('birch', -6.9, -2.8, 0.98, 0.8, 0);
  addTree('birch', -8.1, -5.6, 1.1, 2.2, 1);
  addTree('birch', 5.6, -5.9, 0.92, 0.5, 0);
  addTree('birch', 12.8, 9.0, 0.8, 2.4, 1);
  addTree('larch', 10.6, -10.2, 1.06, 1.4, 0);
  addTree('larch', -14.6, -1.8, 0.9, 2.7, 1);
  addTree('larch', 3.4, -11.5, 1.0, 0.6, 0);

  let attempts = 0;
  const near = [];
  while (coniferBuckets.flat().length + birchBuckets.flat().length + larchBuckets.flat().length < 108 && attempts < 1600) {
    attempts++;
    const a = rng() * TAU;
    const r = 6.7 + Math.pow(rng(), 0.7) * 21;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (treeExcluded(x, z, cameraPos)) continue;
    // Trees behind the cabin sit 30-45 m from the lens even at 22 m from the
    // origin: their cards break up into bare trunks, so the 3D forest stops
    // near the viewpoint and the silhouette wall carries the distance.
    if (Math.hypot(x - cameraPos.x, z - cameraPos.z) > 27) continue;
    const typeRoll = rng();
    let type;
    if (typeRoll < 0.18 && r < 26) type = 'birch';
    else if (typeRoll < 0.26 && r < 30) type = 'larch';
    else type = 'spruce';
    const s = 0.62 + rng() * 0.68;
    if (type === 'spruce') addTree(type, x, z, s, rng() * TAU, rng() < 0.4 ? 0 : rng() < 0.5 ? 1 : 2);
    else if (type === 'birch') addTree(type, x, z, s, rng() * TAU, rng() < 0.5 ? 0 : 1);
    else addTree(type, x, z, s, rng() * TAU, rng() < 0.5 ? 0 : 1);
  }

  // Mid-story saplings: close enough to give the clearing a lower canopy.
  for (let i = 0; i < 44; i++) {
    const a = rng() * TAU;
    const r = 9.2 + Math.pow(rng(), 0.8) * 16;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (treeExcluded(x, z, cameraPos)) continue;
    if (Math.hypot(x - cameraPos.x, z - cameraPos.z) > 24) continue;
    saplingBuckets[i % 2].push({
      x, y: terrainHeight(x, z) - 0.02, z, rot: rng() * TAU,
      s: 0.72 + rng() * 0.65,
      color: [0.62 + rng() * 0.12, 0.68 + rng() * 0.1, 0.52 + rng() * 0.1],
    });
  }

  function addPair(species, buckets, variant, foliageMat, { far = false } = {}) {
    const geo = species[variant];
    const trunks = [], foliage = [];
    for (const it of buckets[variant]) {
      const tint = far ? 0.62 : 0.9;
      const warm = species === coniferVariants ? 0.92 : species === larches ? 1.05 : 1.0;
      const color = [tint * warm * (0.92 + rng() * 0.15), tint * (0.94 + rng() * 0.12), tint * (0.85 + rng() * 0.15)];
      trunks.push({ ...it, color: [color[0] * 0.75, color[1] * 0.72, color[2] * 0.68] });
      foliage.push({ ...it, color });
    }
    if (trunks.length) {
      const tm = instanced(geo.trunk, mats.bark, trunks, { shadows: !far, name: 'tree-trunks' });
      const fm = instanced(geo.foliage, foliageMat, foliage, { shadows: !far, name: 'tree-canopy' });
      group.add(tm, fm);
    }
  }

  coniferVariants.forEach((_, i) => addPair(coniferVariants, coniferBuckets, i, mats.pine));
  birches.forEach((_, i) => addPair(birches, birchBuckets, i, i === 0 ? mats.leafGreen : mats.leafGold));
  larches.forEach((_, i) => addPair(larches, larchBuckets, i, mats.larch));
  saplings.forEach((_, i) => addPair(saplings, saplingBuckets, i, mats.pine));

  // Far distance: one painted silhouette panorama instead of a picket line of
  // billboard cones. The 3D trees own everything inside ~27 m; this wall holds
  // the horizon together when the camera orbits.
  const backdrop = new THREE.Mesh(
    new THREE.CylinderGeometry(44, 44, 44, 96, 1, true),
    new THREE.MeshBasicMaterial({
      map: forestBackdrop(),
      transparent: true,
      alphaTest: 0.02,
      side: THREE.BackSide,
      depthWrite: false,
      fog: true,
    })
  );
  backdrop.position.y = 17;
  backdrop.name = 'forest-backdrop';
  group.add(backdrop);

  // ------------------------------------------------------------ understory
  const underRng = mulberry32(87123);
  const grassItems = [];
  const fernItems = [];
  const flowerItems = [];
  const flowerWarmItems = [];
  const bushItems = [];
  const mossItems = [];

  const allowed = (x, z) => {
    if (Math.abs(x) < 5.2 && z > -4.3 && z < 6.7) return false;
    if (z > 3.5 && z < 30 && Math.abs(x - pathCenterX(z)) < 1.12) return false;
    if (z > 3.5 && z < 29 && Math.abs(x - pathCenterX(z)) < 1.5 && underRng() < 0.7) return false;
    return true;
  };
  const clump = (radius, min = 6, max = 30) => {
    const a = underRng() * TAU;
    const r = min + Math.pow(underRng(), 0.65) * (max - min);
    return [Math.cos(a) * r, Math.sin(a) * r];
  };

  for (let i = 0; i < 3300; i++) {
    const [x, z] = clump(1, 4.2, 32);
    if (!allowed(x, z)) continue;
    const y = terrainHeight(x, z);
    const warm = underRng() < 0.34;
    grassItems.push({
      x, y: y + 0.005, z, rot: underRng() * TAU,
      sx: 0.7 + underRng() * 0.9, sy: 0.55 + underRng() * 0.8, sz: 0.7 + underRng() * 0.9,
      color: warm ? [0.74, 0.7, 0.5] : [0.52 + underRng() * 0.22, 0.6 + underRng() * 0.2, 0.4 + underRng() * 0.18],
      warm,
    });
  }
  const warmGrass = grassItems.filter(g => g.warm);
  const coolGrass = grassItems.filter(g => !g.warm);

  for (let i = 0; i < 520; i++) {
    const [x, z] = clump(1, 4.8, 22);
    if (!allowed(x, z)) continue;
    const y = terrainHeight(x, z);
    fernItems.push({
      x, y, z, rot: underRng() * TAU, s: 0.55 + underRng() * 0.65,
      color: [0.49 + underRng() * 0.17, 0.57 + underRng() * 0.18, 0.37 + underRng() * 0.14],
    });
  }
  for (let i = 0; i < 220; i++) {
    const [x, z] = clump(1, 5.4, 26);
    if (!allowed(x, z)) continue;
    const y = terrainHeight(x, z);
    const it = {
      x, y: y + 0.01, z, rot: underRng() * TAU,
      sx: 1, sy: 0.8 + underRng() * 0.7, sz: 1,
      color: [0.8 + underRng() * 0.18, 0.78 + underRng() * 0.16, 0.64 + underRng() * 0.2],
    };
    (underRng() < 0.5 ? flowerItems : flowerWarmItems).push(it);
  }
  for (let i = 0; i < 90; i++) {
    const [x, z] = clump(1, 5.5, 26);
    if (!allowed(x, z)) continue;
    const y = terrainHeight(x, z);
    const gold = underRng() < 0.2;
    bushItems.push({
      x, y, z, rot: underRng() * TAU, s: 0.5 + underRng() * 0.8,
      color: gold ? [0.74, 0.63, 0.4] : [0.43 + underRng() * 0.15, 0.5 + underRng() * 0.15, 0.36 + underRng() * 0.12],
      gold,
    });
  }
  for (let i = 0; i < 64; i++) {
    const [x, z] = clump(1, 4.6, 24);
    if (!allowed(x, z)) continue;
    if (z > 3.5 && z < 30 && Math.abs(x - pathCenterX(z)) < 2.9) continue;
    const y = terrainHeight(x, z);
    mossItems.push({
      x, y: y + 0.004, z, rot: underRng() * TAU,
      sx: 0.28 + underRng() * 0.72, sy: 0.22 + underRng() * 0.16, sz: 0.28 + underRng() * 0.66,
      color: [0.55 + underRng() * 0.18, 0.65 + underRng() * 0.2, 0.42 + underRng() * 0.15],
    });
  }
  // Hand-placed accents near the porch, where the camera will read them.
  for (const [x, z, s] of [[-4.9, 5.4, 0.85], [4.6, 5.0, 0.8], [-5.3, 2.8, 0.95], [5.4, 3.0, 0.85]]) {
    fernItems.push({ x, y: terrainHeight(x, z), z, rot: underRng() * TAU, s, color: [0.62, 0.72, 0.42] });
  }

  const grassGeo = crossedTuft(0.5, 0.62, 3, 0.04);
  const coolGrassMesh = instanced(grassGeo, mats.grass, coolGrass, { shadows: false, name: 'grass-cool' });
  const warmGrassMesh = instanced(grassGeo, mats.grassWarm, warmGrass, { shadows: false, name: 'grass-warm' });
  group.add(coolGrassMesh, warmGrassMesh);

  const fernGeos = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.2;
    const card = new THREE.PlaneGeometry(0.8, 1.0);
    card.translate(0, 0.48, 0);
    card.rotateX(-0.2 - (i % 2) * 0.12);
    card.rotateY(a);
    card.translate(Math.cos(a) * 0.07, 0, Math.sin(a) * 0.07);
    fernGeos.push(card);
  }
  const fernGeo = mergeGeometries(fernGeos, false);
  for (const g of fernGeos) g.dispose();
  group.add(instanced(fernGeo, mats.fern, fernItems, { shadows: false, name: 'ferns' }));

  const flowerGeo = crossedTuft(0.32, 0.44, 2, 0.02);
  group.add(instanced(flowerGeo, mats.flowers, flowerItems, { shadows: false, name: 'flowers' }));
  group.add(instanced(flowerGeo, mats.flowersWarm, flowerWarmItems, { shadows: false, name: 'flowers-warm' }));

  // Leafy shrubs, assembled from a handful of tilted broadleaf cards.
  const bushGeos = [];
  const bushRng = mulberry32(221);
  for (let i = 0; i < 5; i++) {
    const card = new THREE.PlaneGeometry(1.45, 1.15);
    card.rotateX((bushRng() - 0.5) * 1.2);
    card.rotateY(bushRng() * TAU);
    card.rotateZ((bushRng() - 0.5) * 0.8);
    card.translate((bushRng() - 0.5) * 0.6, 0.42 + bushRng() * 0.3, (bushRng() - 0.5) * 0.6);
    bushGeos.push(card);
  }
  const bushGeo = mergeGeometries(bushGeos, false);
  for (const g of bushGeos) g.dispose();
  const goldBushes = bushItems.filter(b => b.gold);
  const greenBushes = bushItems.filter(b => !b.gold);
  group.add(instanced(bushGeo, mats.leafGold, goldBushes, { shadows: false, name: 'bushes-gold' }));
  group.add(instanced(bushGeo, mats.leafGreen, greenBushes, { shadows: false, name: 'bushes' }));

  // Moss cushions.
  const mossGeo = new THREE.SphereGeometry(1, 9, 5);
  mossGeo.scale(1, 0.18, 1);
  group.add(instanced(mossGeo, mats.moss, mossItems, { shadows: false, name: 'moss' }));

  // Fallen leaves mantle the clearing floor and drift against the path edges.
  const litterRng = mulberry32(4471);
  const litterItems = [];
  for (let i = 0; i < 230; i++) {
    const a = litterRng() * TAU;
    const r = 4.2 + Math.pow(litterRng(), 0.62) * 24;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!allowed(x, z)) continue;
    const s = 0.52 + litterRng() * 1.25;
    litterItems.push({
      x, y: terrainHeight(x, z) + 0.016, z,
      s, sx: s * (0.75 + litterRng() * 0.6), sz: s * (0.9 + litterRng() * 0.7),
      rot: litterRng() * TAU,
      color: [
        0.78 + litterRng() * 0.18,
        0.66 + litterRng() * 0.16,
        0.44 + litterRng() * 0.16,
      ],
    });
  }
  // Extra drift directly on the path: the gravel alone reads as a pale ribbon.
  for (let i = 0; i < 86; i++) {
    const z = 4.8 + litterRng() * 19.5;
    const x = pathCenterX(z) + (litterRng() - 0.5) * 2.3;
    const s = 0.16 + litterRng() * 0.34;
    litterItems.push({
      x, y: terrainHeight(x, z) + 0.014, z,
      s, sx: s * (0.7 + litterRng() * 0.7), sz: s * (0.9 + litterRng() * 0.8),
      rot: litterRng() * TAU,
      color: [0.72 + litterRng() * 0.2, 0.55 + litterRng() * 0.17, 0.34 + litterRng() * 0.14],
    });
  }
  const litterGeo = new THREE.PlaneGeometry(1, 1);
  litterGeo.rotateX(-Math.PI / 2);
  group.add(instanced(litterGeo, mats.leafLitter, litterItems, { shadows: false, name: 'leaf-litter' }));


  // Mushrooms in the shade of the logs.
  const capMat = new THREE.MeshStandardMaterial({ color: '#a76a43', roughness: 0.8, envMapIntensity: 0.3 });
  const stemMat = new THREE.MeshStandardMaterial({ color: '#c9b99b', roughness: 0.9 });
  const shroomRng = mulberry32(551);
  for (let i = 0; i < 7; i++) {
    const z = 9 + shroomRng() * 3;
    const x = -8 + shroomRng() * 4;
    const y = terrainHeight(x, z);
    for (let k = 0; k < 3; k++) {
      const px = x + (shroomRng() - 0.5) * 0.7, pz = z + (shroomRng() - 0.5) * 0.7;
      const h = 0.055 + shroomRng() * 0.09;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.18, h * 0.26, h, 5), stemMat);
      stem.position.set(px, y + h / 2, pz);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(h * 0.55, 8, 4, 0, TAU, 0, Math.PI / 2), capMat);
      cap.scale.y = 0.6;
      cap.position.set(px, y + h, pz);
      stem.castShadow = cap.castShadow = true;
      group.add(stem, cap);
    }
  }

  return { group };
}
