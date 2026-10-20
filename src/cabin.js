// A weathered timber cabin with a covered porch, stone chimney and lived-in props.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  bnd, makeBox, makePlane, planeAt, cyl, boxUV, transformGeometry, limb, TAU,
} from './lib.js';
import { terrainHeight } from './terrain.js';

const W = 3.6;          // half width
const D = 2.8;          // half depth
const FLOOR = 0.72;     // porch and interior floor
const WALL_TOP = 3.38;
const RIDGE = 5.32;
const EAVE_Z = 3.6;
const ROOF_RUN = 3.6;
const ROOF_RISE = RIDGE - 3.28;

function beamBetween(parent, mat, a, b, width, depth, opts = {}) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(vb, va);
  const len = dir.length();
  const geo = boxUV(new THREE.BoxGeometry(width, len, depth), width, len, depth);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.position.copy(va).add(vb).multiplyScalar(0.5);
  mesh.castShadow = opts.cast !== false;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function glowSprite(tex, color, size) {
  const mat = new THREE.SpriteMaterial({
    map: tex, color, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(size, size, 1);
  return sp;
}

function makeLantern(mats, x, y, z) {
  const g = new THREE.Group();
  const iron = mats.iron;
  const bx = 0.018;
  const glassMat = new THREE.MeshBasicMaterial({
    color: '#ffd09a', transparent: true, opacity: 0.5, toneMapped: false,
    side: THREE.DoubleSide, depthWrite: false,
  });
  // Wall plate and bracket.
  bnd(g, iron, x - 0.05, x + 0.05, y - 0.09, y + 0.1, z - 0.03, z + 0.03);
  cyl(g, iron, 0.012, 0.012, 0.34, x, y + 0.09, z + 0.16, 6, { rx: Math.PI / 2, cast: false });
  cyl(g, iron, 0.008, 0.008, 0.14, x, y - 0.02, z + 0.32, 5, { cast: false });
  // Lantern cap, base and corner posts.
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.1, 4), iron);
  top.position.set(x, y - 0.15, z + 0.32);
  top.rotation.y = Math.PI / 4;
  top.castShadow = true;
  g.add(top);
  bnd(g, iron, x - 0.1, x + 0.1, y - 0.42, y - 0.39, z + 0.22, z + 0.42);
  for (const dx of [-0.085, 0.085]) {
    for (const dz of [-0.085, 0.085]) {
      bnd(g, iron, x + dx - bx, x + dx + bx, y - 0.39, y - 0.16, z + 0.32 + dz - bx, z + 0.32 + dz + bx, { cast: false });
    }
  }
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.21, 0.15), glassMat);
  glass.position.set(x, y - 0.28, z + 0.32);
  g.add(glass);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 7, 5), new THREE.MeshBasicMaterial({ color: '#fff1c7', toneMapped: false }));
  flame.position.set(x, y - 0.33, z + 0.32);
  g.add(flame);
  const glow = glowSprite(mats.softDot, 0xffb066, 1.25);
  glow.position.set(x, y - 0.28, z + 0.34);
  g.add(glow);
  return g;
}

export function createCabin(mats) {
  const group = new THREE.Group();
  group.name = 'cabin';
  const rng = (() => { let a = 4747; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();

  // ------------------------------------------------------------------ foundation
  bnd(group, mats.stone, -3.72, 3.72, -0.1, FLOOR, -D - 0.14, D + 0.12);
  // Individual weathered foundation stones give the base a laid, uneven edge.
  for (let side = 0; side < 2; side++) {
    const z = side === 0 ? D + 0.12 : -D - 0.14;
    let x = -3.66;
    while (x < 3.55) {
      const w = 0.32 + rng() * 0.32;
      const h = 0.18 + rng() * 0.12;
      const yy = -0.05 + rng() * 0.1;
      const m = makeBox(w, h, 0.1, mats.stone);
      m.position.set(x + w / 2, yy + h / 2, z + (side === 0 ? 0.03 : -0.03));
      m.rotation.y = (rng() - 0.5) * 0.04;
      group.add(m);
      x += w + 0.018;
    }
  }
  for (let side = 0; side < 2; side++) {
    const x = side === 0 ? 3.67 : -3.67;
    for (let i = 0; i < 9; i++) {
      const z = -2.65 + i * 0.62 + (rng() - 0.5) * 0.12;
      const h = 0.32 + rng() * 0.3;
      const d = 0.4 + rng() * 0.22;
      const m = makeBox(0.11, h, d, mats.stone);
      m.position.set(x + (side === 0 ? 0.03 : -0.03), -0.02 + h / 2, z);
      group.add(m);
    }
  }

  // ------------------------------------------------------------------ walls
  bnd(group, mats.siding, -W, W, FLOOR, WALL_TOP, 2.62, D + 0.02);   // front
  bnd(group, mats.siding, -W, W, FLOOR, WALL_TOP, -D - 0.02, -2.62); // back
  bnd(group, mats.siding, -W - 0.02, -3.42, FLOOR, WALL_TOP, -2.62, 2.62);
  bnd(group, mats.siding, 3.42, W + 0.02, FLOOR, WALL_TOP, -2.62, 2.62);
  // Top plate.
  bnd(group, mats.darkTimber, -3.78, 3.78, WALL_TOP, WALL_TOP + 0.16, 2.68, 2.86);
  bnd(group, mats.darkTimber, -3.78, 3.78, WALL_TOP, WALL_TOP + 0.16, -2.86, -2.68);
  // Corner boards.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const m = makeBox(0.16, WALL_TOP - FLOOR + 0.16, 0.16, mats.darkTimber);
      m.position.set(sx * (W + 0.02), (FLOOR + WALL_TOP) / 2, sz * (D + 0.02));
      group.add(m);
    }
  }
  // Belt rail across the weathered siding.
  bnd(group, mats.darkTimber, -3.63, 3.63, 1.32, 1.42, D + 0.015, D + 0.07, { cast: false });
  bnd(group, mats.darkTimber, 3.615, 3.67, 1.32, 1.42, -2.62, 2.62, { cast: false });

  // Gable ends. ShapeGeometry keeps world-metre UVs for the siding.
  const shape = new THREE.Shape();
  shape.moveTo(-D, WALL_TOP + 0.08);
  shape.lineTo(D, WALL_TOP + 0.08);
  shape.lineTo(0, RIDGE);
  shape.closePath();
  const gableGeo = new THREE.ShapeGeometry(shape);
  const sidingDouble = mats.siding.clone();
  sidingDouble.side = THREE.DoubleSide;
  const rightGable = new THREE.Mesh(gableGeo, sidingDouble);
  rightGable.rotation.y = Math.PI / 2;
  rightGable.position.x = 3.615;
  rightGable.castShadow = rightGable.receiveShadow = true;
  group.add(rightGable);
  const leftGable = new THREE.Mesh(gableGeo.clone(), sidingDouble);
  leftGable.rotation.y = -Math.PI / 2;
  leftGable.position.x = -3.615;
  leftGable.castShadow = leftGable.receiveShadow = true;
  group.add(leftGable);

  // Gable trim and tie beam.
  for (const sx of [-1, 1]) {
    bnd(group, mats.darkTimber, sx * 3.6 - 0.05, sx * 3.6 + 0.05, WALL_TOP, WALL_TOP + 0.14, -D - 0.04, D + 0.04);
    bnd(group, mats.darkTimber, sx * 3.62 - 0.035, sx * 3.62 + 0.035, WALL_TOP + 0.02, RIDGE - 0.12, -0.055, 0.055, { cast: false });
  }

  // ------------------------------------------------------------------ roof
  const angle = Math.atan2(ROOF_RISE, ROOF_RUN);
  const slopeLen = Math.hypot(ROOF_RUN, ROOF_RISE) + 0.16;
  for (const side of [-1, 1]) {
    const slab = makeBox(8.85, 0.17, slopeLen, mats.roof);
    slab.position.set(0, (RIDGE + 3.25) / 2 + 0.04, side * ROOF_RUN / 2);
    slab.rotation.x = side * angle;
    group.add(slab);
    // Rafter tails visible under the eaves.
    for (let i = -4; i <= 4; i++) {
      const x = i * 0.95;
      beamBetween(group, mats.darkTimber,
        [x, 3.26, side * 2.62],
        [x, 3.35, side * 3.94], 0.075, 0.13, { cast: true });
    }
  }
  // Ridge cap and fascia boards.
  bnd(group, mats.darkTimber, -4.46, 4.46, RIDGE + 0.03, RIDGE + 0.2, -0.16, 0.16);
  for (const side of [-1, 1]) {
    bnd(group, mats.darkTimber, -4.46, 4.46, 3.24, 3.42, side * 3.6 - 0.05, side * 3.6 + 0.05, { cast: false });
    // Barge boards on the visible right gable.
  }
  for (const side of [-1, 1]) {
    beamBetween(group, mats.darkTimber, [4.41, 3.38, side * 3.62], [4.41, RIDGE + 0.03, 0], 0.07, 0.18);
    beamBetween(group, mats.darkTimber, [-4.41, 3.38, side * 3.62], [-4.41, RIDGE + 0.03, 0], 0.07, 0.18);
  }

  // ------------------------------------------------------------------ porch
  // Deck boards.
  const deckZ0 = 2.84, deckZ1 = 5.18;
  const boardW = 0.185;
  const nBoards = 13;
  for (let i = 0; i < nBoards; i++) {
    const b = makeBox(6.68, 0.075, boardW - 0.012, mats.planks);
    const z = deckZ0 + boardW / 2 + i * boardW;
    if (z > deckZ1) break;
    b.position.set(0, FLOOR - 0.04 + (rng() - 0.5) * 0.006, z);
    group.add(b);
  }
  bnd(group, mats.darkTimber, -3.42, 3.42, FLOOR - 0.14, FLOOR - 0.02, 5.16, 5.24);
  // Porch skirt hides the dark under-deck.
  bnd(group, mats.darkTimber, -3.4, -1.22, -0.06, FLOOR - 0.07, 5.15, 5.22, { cast: false });
  bnd(group, mats.darkTimber, 1.22, 3.4, -0.06, FLOOR - 0.07, 5.15, 5.22, { cast: false });
  bnd(group, mats.darkTimber, 3.34, 3.4, -0.06, FLOOR - 0.07, 2.84, 5.16, { cast: false });
  bnd(group, mats.darkTimber, -3.4, -3.34, -0.06, FLOOR - 0.07, 2.84, 5.16, { cast: false });

  // Stone piers under the porch.
  for (const x of [-2.9, 2.9]) {
    for (const z of [3.1, 4.9]) {
      const pier = makeBox(0.4, FLOOR + 0.1, 0.4, mats.stone);
      pier.position.set(x, (FLOOR + 0.1) / 2 - 0.1, z);
      group.add(pier);
    }
  }

  // Posts, beams and braces.
  const postZ = 5.02;
  for (const x of [-3.02, -1.38, 1.38, 3.02]) {
    bnd(group, mats.stone, x - 0.15, x + 0.15, FLOOR - 0.02, FLOOR + 0.16, postZ - 0.15, postZ + 0.15);
    bnd(group, mats.timber, x - 0.085, x + 0.085, FLOOR + 0.14, 2.64, postZ - 0.085, postZ + 0.085);
    beamBetween(group, mats.timber, [x, 2.3, postZ], [x + (x > 0 ? 0.42 : -0.42), 2.62, postZ], 0.075, 0.1);
    beamBetween(group, mats.timber, [x, 2.3, postZ], [x + (x > 0 ? 0.36 : -0.36), 2.62, postZ + 0.32], 0.065, 0.09);
  }
  bnd(group, mats.timber, -3.16, 3.16, 2.56, 2.75, postZ - 0.11, postZ + 0.11);
  bnd(group, mats.darkTimber, -3.34, 3.34, 3.1, 3.24, 2.78, 2.88);

  // Shed roof over the porch.
  const pRun = 2.72, pRise = 0.5;
  const pAngle = Math.atan2(pRise, pRun);
  const pSlope = Math.hypot(pRun, pRise) + 0.12;
  const porchRoof = makeBox(7.05, 0.12, pSlope, mats.roof);
  porchRoof.position.set(0, 3.14 - pRise / 2 + 0.02, 2.8 + pRun / 2);
  porchRoof.rotation.x = pAngle;
  group.add(porchRoof);
  // Rafters and fascia.
  for (let i = -3; i <= 3; i++) {
    const x = i * 0.92;
    beamBetween(group, mats.darkTimber,
      [x, 3.02, 2.8], [x, 2.56, 5.46], 0.075, 0.13);
  }
  bnd(group, mats.darkTimber, -3.56, 3.56, 2.52, 2.66, 5.42, 5.5, { cast: false });
  // Diagonal fly rafters at the porch corners.
  beamBetween(group, mats.darkTimber, [3.5, 2.62, 5.42], [3.5, 3.14, 2.82], 0.07, 0.12);
  beamBetween(group, mats.darkTimber, [-3.5, 2.62, 5.42], [-3.5, 3.14, 2.82], 0.07, 0.12);

  // Front railing, split around the steps.
  const railGeos = [];
  const addBoxGeo = (w, h, d, x, y, z) => {
    const g = boxUV(new THREE.BoxGeometry(w, h, d), w, h, d);
    g.translate(x, y, z);
    railGeos.push(g);
  };
  for (const [x0, x1] of [[-3.02, -1.18], [1.18, 3.02]]) {
    addBoxGeo(x1 - x0, 0.08, 0.09, (x0 + x1) / 2, 1.64, postZ);
    addBoxGeo(x1 - x0, 0.065, 0.075, (x0 + x1) / 2, 0.91, postZ);
    const count = Math.floor((x1 - x0) / 0.19);
    for (let i = 1; i < count; i++) {
      const x = x0 + (i / count) * (x1 - x0);
      addBoxGeo(0.032, 0.68, 0.035, x, 1.27, postZ);
    }
  }
  // Side rail on the left, less cluttered than the right.
  addBoxGeo(0.09, 0.08, 2.06, -3.3, 1.64, 4.03);
  for (let i = 0; i < 9; i++) addBoxGeo(0.032, 0.68, 0.033, -3.3, 1.27, 3.08 + i * 0.23);
  const rail = new THREE.Mesh(mergeGeometries(railGeos, false), mats.timber);
  rail.castShadow = rail.receiveShadow = true;
  group.add(rail);
  for (const g of railGeos) g.dispose();

  // Steps.
  const stepMat = mats.stone;
  for (let i = 0; i < 3; i++) {
    const top = 0.55 - i * 0.2;
    const z0 = 5.2 + i * 0.42;
    const block = makeBox(2.35, top + 0.14, 0.46, stepMat);
    block.position.set(0, (top - 0.14) / 2, z0 + 0.23);
    group.add(block);
    bnd(group, stepMat, -1.36, -1.16, -0.1, top, z0, z0 + 0.42);
    bnd(group, stepMat, 1.16, 1.36, -0.1, top, z0, z0 + 0.42);
  }
  bnd(group, mats.stone, -1.45, 1.45, -0.12, 0.02, 6.42, 6.66, { cast: false });
  // Worn doormat.
  bnd(group, mats.rope, -0.52, 0.52, FLOOR + 0.002, FLOOR + 0.026, 2.98, 3.44, { cast: false });

  // ------------------------------------------------------------------ door
  const doorZ = 2.86;
  bnd(group, mats.darkTimber, -0.68, 0.68, FLOOR - 0.02, 2.96, doorZ - 0.02, doorZ + 0.08);
  const door = makeBox(1.02, 2.06, 0.09, mats.darkTimber);
  door.position.set(0, FLOOR + 1.03, doorZ + 0.1);
  group.add(door);
  for (let i = 0; i < 4; i++) {
    const p = makeBox(0.235, 2.02, 0.035, mats.planks);
    p.position.set(-0.38 + i * 0.253, FLOOR + 1.03, doorZ + 0.16);
    group.add(p);
  }
  // Door glazing.
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), mats.windowMat(1));
  doorGlass.position.set(0, FLOOR + 1.68, doorZ + 0.185);
  group.add(doorGlass);
  for (const dx of [-0.25, 0.25]) bnd(group, mats.darkTimber, dx - 0.022, dx + 0.022, FLOOR + 1.43, FLOOR + 1.93, doorZ + 0.18, doorZ + 0.21, { cast: false });
  bnd(group, mats.darkTimber, -0.27, 0.27, FLOOR + 1.43, FLOOR + 1.475, doorZ + 0.18, doorZ + 0.21, { cast: false });
  bnd(group, mats.darkTimber, -0.27, 0.27, FLOOR + 1.885, FLOOR + 1.93, doorZ + 0.18, doorZ + 0.21, { cast: false });
  // Iron strap hinges and handle.
  for (const y of [FLOOR + 0.48, FLOOR + 1.92]) {
    bnd(group, mats.iron, -0.5, -0.06, y - 0.035, y + 0.035, doorZ + 0.185, doorZ + 0.205, { cast: false });
  }
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), mats.brass);
  knob.position.set(0.36, FLOOR + 1.05, doorZ + 0.22);
  knob.castShadow = true;
  group.add(knob);
  // Dried wreath.
  const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 6, 16),
    new THREE.MeshStandardMaterial({ color: '#4a5536', roughness: 1 }));
  wreath.position.set(0, FLOOR + 1.52, doorZ + 0.225);
  group.add(wreath);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const berry = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4),
      new THREE.MeshStandardMaterial({ color: '#9d4b32', roughness: 0.8 }));
    berry.position.set(Math.cos(a) * 0.2, FLOOR + 1.52 + Math.sin(a) * 0.2, doorZ + 0.255);
    group.add(berry);
  }

  // ------------------------------------------------------------------ windows
  function frontWindow(x, y, w, h, variant, shutters = true) {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats.windowMat(variant));
    glass.position.set(x, y, 2.835);
    group.add(glass);
    const zf = 2.86;
    bnd(group, mats.darkTimber, x - w / 2 - 0.09, x + w / 2 + 0.09, y + h / 2, y + h / 2 + 0.08, zf, zf + 0.06);
    bnd(group, mats.darkTimber, x - w / 2 - 0.09, x + w / 2 + 0.09, y - h / 2 - 0.08, y - h / 2, zf, zf + 0.06);
    bnd(group, mats.darkTimber, x - w / 2 - 0.08, x - w / 2, y - h / 2, y + h / 2, zf, zf + 0.06);
    bnd(group, mats.darkTimber, x + w / 2, x + w / 2 + 0.08, y - h / 2, y + h / 2, zf, zf + 0.06);
    bnd(group, mats.darkTimber, x - 0.022, x + 0.022, y - h / 2, y + h / 2, zf + 0.005, zf + 0.035, { cast: false });
    bnd(group, mats.darkTimber, x - w / 2, x + w / 2, y - 0.022, y + 0.022, zf + 0.005, zf + 0.035, { cast: false });
    bnd(group, mats.timber, x - w / 2 - 0.14, x + w / 2 + 0.14, y - h / 2 - 0.13, y - h / 2 - 0.02, 2.83, 2.99);
    if (shutters) {
      for (const side of [-1, 1]) {
        const sx = x + side * (w / 2 + 0.24);
        for (let i = 0; i < 4; i++) {
          bnd(group, mats.darkTimber, sx - 0.16, sx + 0.16, y - h / 2 + i * (h / 4) + 0.008, y - h / 2 + (i + 1) * (h / 4) - 0.008, 2.86, 2.9, { cast: false });
        }
        bnd(group, mats.iron, sx - 0.2, sx + 0.1, y + h / 2 - 0.18, y + h / 2 - 0.145, 2.9, 2.92, { cast: false });
      }
    }
  }
  frontWindow(-1.95, 2.08, 0.94, 1.04, 0, true);
  frontWindow(1.95, 2.08, 0.94, 1.04, 1, true);

  // Side window on the visible right wall.
  const sideZ = 0.65, sideY = 2.1;
  const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.0), mats.windowMat(2));
  sideGlass.rotation.y = Math.PI / 2;
  sideGlass.position.set(3.635, sideY, sideZ);
  group.add(sideGlass);
  const xf = 3.66;
  bnd(group, mats.darkTimber, xf, xf + 0.06, sideY + 0.5, sideY + 0.59, sideZ - 0.55, sideZ + 0.55);
  bnd(group, mats.darkTimber, xf, xf + 0.06, sideY - 0.59, sideY - 0.5, sideZ - 0.55, sideZ + 0.55);
  bnd(group, mats.darkTimber, xf, xf + 0.06, sideY - 0.5, sideY + 0.5, sideZ - 0.55, sideZ - 0.47);
  bnd(group, mats.darkTimber, xf, xf + 0.06, sideY - 0.5, sideY + 0.5, sideZ + 0.47, sideZ + 0.55);
  bnd(group, mats.darkTimber, xf + 0.045, xf + 0.075, sideY - 0.5, sideY + 0.5, sideZ - 0.022, sideZ + 0.022, { cast: false });
  bnd(group, mats.darkTimber, xf + 0.045, xf + 0.075, sideY - 0.022, sideY + 0.022, sideZ - 0.5, sideZ + 0.5, { cast: false });
  bnd(group, mats.timber, xf - 0.02, xf + 0.17, sideY - 0.63, sideY - 0.5, sideZ - 0.61, sideZ + 0.61);

  // Gable loft window, right side.
  const loftY = 4.18, loftZ = 0;
  const loftGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.72), mats.windowMat(2));
  loftGlass.rotation.y = Math.PI / 2;
  loftGlass.position.set(3.635, loftY, loftZ);
  group.add(loftGlass);
  bnd(group, mats.darkTimber, 3.66, 3.71, loftY - 0.42, loftY + 0.42, loftZ - 0.34, loftZ - 0.28);
  bnd(group, mats.darkTimber, 3.66, 3.71, loftY - 0.42, loftY + 0.42, loftZ + 0.28, loftZ + 0.34);
  bnd(group, mats.darkTimber, 3.66, 3.71, loftY + 0.34, loftY + 0.42, loftZ - 0.34, loftZ + 0.34);
  bnd(group, mats.darkTimber, 3.66, 3.71, loftY - 0.42, loftY - 0.34, loftZ - 0.34, loftZ + 0.34);
  // Simple loft scaffold board below the window.
  bnd(group, mats.planks, 3.66, 3.93, loftY - 0.53, loftY - 0.46, loftZ - 0.45, loftZ + 0.45, { cast: false });

  // ------------------------------------------------------------------ flower box
  bnd(group, mats.planks, 1.41, 2.49, 1.36, 1.54, 2.9, 3.14);
  bnd(group, mats.interior, 1.45, 2.45, 1.52, 1.56, 2.94, 3.1, { cast: false });
  const flowerColors = ['#e6d7b4', '#d9c06f', '#c8875c', '#e9e0cf'];
  const stemMat = new THREE.MeshStandardMaterial({ color: '#53643c', roughness: 1 });
  for (let i = 0; i < 13; i++) {
    const fx = 1.47 + rng() * 0.94, fz = 2.96 + rng() * 0.12;
    const h = 0.11 + rng() * 0.16;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, h, 4), stemMat);
    stem.position.set(fx, 1.55 + h / 2, fz);
    group.add(stem);
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.026 + rng() * 0.018, 6, 4),
      new THREE.MeshStandardMaterial({ color: flowerColors[i % flowerColors.length], roughness: 0.8 }));
    bloom.position.set(fx, 1.56 + h, fz);
    group.add(bloom);
  }

  // ------------------------------------------------------------------ chimney
  const chX = 2.3, chZ = -1.2;
  bnd(group, mats.stone, chX - 0.46, chX + 0.46, -0.08, 6.14, chZ - 0.4, chZ + 0.4);
  bnd(group, mats.stone, chX - 0.58, chX + 0.58, 6.14, 6.28, chZ - 0.52, chZ + 0.52);
  bnd(group, mats.iron, chX - 0.2, chX + 0.2, 6.28, 6.5, chZ - 0.18, chZ + 0.18);
  // A few proud stones for silhouette.
  for (let i = 0; i < 9; i++) {
    const y = 0.4 + i * 0.65;
    const m = makeBox(0.12, 0.2, 0.2, mats.stone);
    m.position.set(chX + 0.46, y, chZ - 0.25 + (i % 3) * 0.25);
    group.add(m);
  }

  // ------------------------------------------------------------------ lantern
  group.add(makeLantern(mats, 0.82, 2.48, 2.9));
  const lanternLight = new THREE.PointLight('#ffc07d', 32, 9.5, 1.9);
  lanternLight.position.set(0.82, 2.22, 3.28);
  group.add(lanternLight);
  const windowLight = new THREE.PointLight('#ffc58e', 6.0, 6.2, 1.9);
  windowLight.position.set(-2.2, 1.9, 3.2);
  group.add(windowLight);
  const rightWindowLight = new THREE.PointLight('#ffc58e', 4.0, 5.2, 1.9);
  rightWindowLight.position.set(3.9, 2.1, 0.65);
  group.add(rightWindowLight);

  // ------------------------------------------------------------------ bench
  const bench = new THREE.Group();
  bench.position.set(2.05, FLOOR, 3.84);
  for (let i = 0; i < 3; i++) {
    const b = makeBox(1.4, 0.055, 0.14, mats.planks);
    b.position.set(0, 0.45, i * 0.155 - 0.14);
    bench.add(b);
  }
  for (const sx of [-0.55, 0.55]) {
    bnd(bench, mats.darkTimber, sx - 0.035, sx + 0.035, 0.0, 0.46, -0.25, 0.26);
    bnd(bench, mats.darkTimber, sx - 0.035, sx + 0.035, 0.44, 0.95, 0.18, 0.24);
  }
  for (let i = 0; i < 2; i++) {
    const back = makeBox(1.4, 0.16, 0.045, mats.planks);
    back.position.set(0, 0.66 + i * 0.19, 0.21);
    back.rotation.x = -0.08;
    bench.add(back);
  }
  bnd(bench, mats.darkTimber, -0.68, 0.68, 0.9, 0.98, 0.18, 0.24);
  group.add(bench);

  // Crate and bucket on the porch.
  bnd(group, mats.planks, -1.0, -0.54, FLOOR + 0.02, FLOOR + 0.48, 3.42, 3.86);
  bnd(group, mats.darkTimber, -1.02, -0.52, FLOOR + 0.2, FLOOR + 0.24, 3.4, 3.44, { cast: false });
  const bucket = new THREE.Group();
  bucket.position.set(-2.55, FLOOR, 4.35);
  cyl(bucket, mats.darkTimber, 0.2, 0.16, 0.3, 0, 0.15, 0, 12, { uvMeters: 0.8 });
  for (const y of [0.08, 0.26]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(y > 0.2 ? 0.192 : 0.168, 0.012, 4, 14), mats.iron);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    bucket.add(ring);
  }
  group.add(bucket);

  // Hanging herb bundles under the porch beam.
  const herbMat = new THREE.MeshStandardMaterial({ color: '#7c6c45', roughness: 1 });
  for (const hx of [-1.55, 2.0]) {
    const bundle = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.004, 0.42, 4), herbMat);
      stem.position.set((i - 2) * 0.02, -0.21, (i % 2 - 0.5) * 0.02);
      stem.rotation.z = (i - 2) * 0.04;
      bundle.add(stem);
    }
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 4, 8), mats.rope);
    tie.rotation.x = Math.PI / 2;
    bundle.add(tie);
    bundle.position.set(hx, 2.56, 4.88);
    group.add(bundle);
  }

  // ------------------------------------------------------------------ woodpile + axe
  const logGeos = [], endGeos = [];
  const logR = 0.086;
  for (let row = 0; row < 6; row++) {
    const count = 8 - (row > 4 ? 2 : 0);
    for (let i = 0; i < count; i++) {
      const z = -0.65 + i * 0.205 + (row % 2) * 0.095 + (rng() - 0.5) * 0.03;
      const y = 0.12 + row * 0.165 + (rng() - 0.5) * 0.02;
      const len = 0.5 + rng() * 0.13;
      logGeos.push(limb(new THREE.Vector3(3.87, y, z), new THREE.Vector3(3.87 + len, y, z), logR, logR * (0.88 + rng() * 0.16), 8, 0.55));
      const end = new THREE.CircleGeometry(logR * 0.98, 10);
      end.rotateY(Math.PI / 2);
      end.translate(3.87 + len + 0.004, y, z);
      endGeos.push(end);
    }
  }
  const logs = new THREE.Mesh(mergeGeometries(logGeos, false), mats.bark);
  logs.castShadow = logs.receiveShadow = true;
  group.add(logs);
  const logEnds = new THREE.Mesh(mergeGeometries(endGeos, false), mats.logEnd);
  logEnds.castShadow = true;
  group.add(logEnds);
  for (const g of [...logGeos, ...endGeos]) g.dispose();

  // Chopping block and axe.
  const blockY = 0.36;
  cyl(group, mats.bark, 0.31, 0.34, 0.62, 4.25, 0.25, 2.4, 12, { uvMeters: 0.7 });
  const blockTop = new THREE.Mesh(new THREE.CircleGeometry(0.31, 14), mats.logEnd);
  blockTop.rotation.x = -Math.PI / 2;
  blockTop.position.set(4.25, 0.56, 2.4);
  blockTop.receiveShadow = true;
  group.add(blockTop);
  const axeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.72, 7), mats.timber);
  axeHandle.position.set(4.14, 0.83, 2.34);
  axeHandle.rotation.z = -0.38;
  group.add(axeHandle);
  const axeHead = makeBox(0.05, 0.12, 0.24, mats.iron);
  axeHead.position.set(4.27, 1.12, 2.34);
  axeHead.rotation.z = -0.38;
  group.add(axeHead);

  // ------------------------------------------------------------------ rain barrel
  const barrel = new THREE.Group();
  barrel.position.set(-3.22, 0, 5.75);
  cyl(barrel, mats.planks, 0.31, 0.34, 0.82, 0, 0.3, 0, 14, { uvMeters: 0.9 });
  for (const y of [0.03, 0.28, 0.57]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(y === 0.28 ? 0.342 : 0.32, 0.016, 4, 18), mats.iron);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    barrel.add(ring);
  }
  const lid = new THREE.Mesh(new THREE.CircleGeometry(0.3, 14), mats.darkTimber);
  lid.rotation.x = -Math.PI / 2;
  lid.position.y = 0.715;
  barrel.add(lid);
  const spigot = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 6), mats.brass);
  spigot.rotation.z = Math.PI / 2;
  spigot.position.set(0.34, 0.32, 0);
  barrel.add(spigot);
  group.add(barrel);

  // ------------------------------------------------------------------ ground shadow / ambient trim
  const smokeOrigin = new THREE.Vector3(chX, 6.55, chZ);
  return { group, smokeOrigin, lanternLight, windowLight, rightWindowLight };
}
