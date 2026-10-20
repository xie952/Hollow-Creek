// Shared PBR materials. Textures are generated once and tiled in metres.
import * as THREE from 'three';
import { metered } from './textures.js';
import * as TX from './textures.js';

export const windTime = { value: 0 };
export function setWindTime(t) { windTime.value = t; }

function addWind(mat, sway = 1, stiffness = 1) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windTime;
    shader.uniforms.uWindSway = { value: sway };
    shader.uniforms.uWindStiff = { value: stiffness };
    shader.vertexShader = 'uniform float uWindTime;\nuniform float uWindSway;\nuniform float uWindStiff;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 windOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 windOrigin = vec3(0.0);
      #endif
      float windWeight = pow(clamp(transformed.y * uWindStiff, 0.0, 1.0), 1.35);
      float gust = sin(uWindTime * 0.72 + windOrigin.x * 0.21 + windOrigin.z * 0.17 + transformed.x * 0.35)
                 + 0.42 * sin(uWindTime * 1.63 + windOrigin.z * 0.38 + transformed.y * 0.6);
      transformed.x += gust * uWindSway * 0.085 * windWeight;
      transformed.z += gust * uWindSway * 0.035 * windWeight;
      transformed.y -= abs(gust) * uWindSway * 0.006 * windWeight;`
    );
  };
  mat.customProgramCacheKey = () => 'wind-' + sway.toFixed(2) + '-' + stiffness.toFixed(2);
  return mat;
}

const std = (opts) => new THREE.MeshStandardMaterial(opts);

export function createMaterials() {
  const sidingTX = TX.woodSiding();
  const timberTX = TX.timber();
  const roofTX = TX.roofShingle();
  const stoneTX = TX.fieldStone();
  const floorTX = TX.forestFloor();
  const pathTX = TX.gravelPath();
  const barkTX = TX.bark();
  const birchTX = TX.birchBark();
  const endTX = TX.logEnd();

  const siding = std({
    map: metered(sidingTX.map, 2.4),
    normalMap: metered(sidingTX.normalMap, 2.4),
    roughnessMap: metered(sidingTX.roughnessMap, 2.4),
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 1.0,
    color: '#c4b39d',
    envMapIntensity: 0.42,
  });

  const timber = std({
    map: metered(timberTX.map, 1.3),
    normalMap: metered(timberTX.normalMap, 1.3),
    normalScale: new THREE.Vector2(1, 1),
    roughness: 0.93,
    color: '#b6a28b',
    envMapIntensity: 0.38,
  });

  const darkTimber = std({
    map: metered(timberTX.map, 1.1),
    normalMap: metered(timberTX.normalMap, 1.1),
    normalScale: new THREE.Vector2(1, 1),
    roughness: 0.96,
    color: '#75634e',
    envMapIntensity: 0.3,
  });

  const planks = std({
    map: metered(timberTX.map, 2.0),
    normalMap: metered(timberTX.normalMap, 2.0),
    roughness: 0.9,
    color: '#b7a088',
    envMapIntensity: 0.32,
  });

  const roof = std({
    map: metered(roofTX.map, 2.8),
    normalMap: metered(roofTX.normalMap, 2.8),
    roughnessMap: metered(roofTX.roughnessMap, 2.8),
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughness: 1.0,
    color: '#cbbAA0',
    envMapIntensity: 0.36,
  });

  const stone = std({
    map: metered(stoneTX.map, 2.0),
    normalMap: metered(stoneTX.normalMap, 2.0),
    roughnessMap: metered(stoneTX.roughnessMap, 2.0),
    normalScale: new THREE.Vector2(1.1, 1.1),
    color: '#c0b7a3',
    roughness: 1.0,
    envMapIntensity: 0.3,
  });

  const ground = std({
    map: metered(floorTX.map, 3.4),
    normalMap: metered(floorTX.normalMap, 3.4),
    roughnessMap: metered(floorTX.roughnessMap, 3.4),
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughness: 1.0,
    color: '#f4f2e6',
    vertexColors: true,
    envMapIntensity: 0.3,
  });

  const path = std({
    map: metered(pathTX.map, 1.9),
    normalMap: metered(pathTX.normalMap, 1.9),
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughness: 1.0,
    color: '#9b876d',
    envMapIntensity: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const bark = std({
    map: metered(barkTX.map, 0.85),
    normalMap: metered(barkTX.normalMap, 0.85),
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughness: 1.0,
    color: '#b8a58c',
    envMapIntensity: 0.3,
  });

  const birch = std({
    map: metered(birchTX.map, 1.25),
    normalMap: metered(birchTX.normalMap, 1.25),
    roughness: 0.88,
    color: '#dfd9c9',
    envMapIntensity: 0.35,
  });

  const logEnd = std({
    map: TX.logEnd().map,
    normalMap: TX.logEnd().normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 0.86,
    color: '#cbb28d',
  });

  const iron = std({ color: '#262621', roughness: 0.56, metalness: 0.72, envMapIntensity: 0.8 });
  const brass = std({ color: '#9d7d48', roughness: 0.38, metalness: 0.82, envMapIntensity: 1.0 });
  const rope = std({ color: '#8c785a', roughness: 1 });
  const interior = std({ color: '#1c1611', roughness: 1 });

  const windowMat = (variant = 0) => new THREE.MeshBasicMaterial({
    map: TX.windowGlow(variant),
    color: '#edbd8b',
    toneMapped: false,
    fog: true,
  });

  // Distant fir wall: lit only by fog, so it reads as a soft silhouette rather than flat cones.
  const firFar = new THREE.MeshBasicMaterial({
    map: TX.firSilhouette(),
    color: '#414b44',
    alphaTest: 0.08,
    side: THREE.DoubleSide,
    fog: true,
  });

  const glassDark = new THREE.MeshPhysicalMaterial({
    color: '#273234', roughness: 0.12, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08,
    envMapIntensity: 1.25,
  });

  const pine = addWind(std({
    map: TX.pineSpray(),
    alphaTest: 0.12,
    side: THREE.DoubleSide,
    roughness: 1.0,
    metalness: 0.0,
    color: '#dbe4d4',
    envMapIntensity: 0.5,
    emissive: '#202a18',
    emissiveIntensity: 0.3,
  }), 1.0, 0.085);
  pine.shadowSide = THREE.DoubleSide;

  const larch = addWind(std({
    map: TX.larchSpray(),
    alphaTest: 0.14,
    side: THREE.DoubleSide,
    roughness: 1.0,
    color: '#f0ddb0',
    envMapIntensity: 0.5,
    emissive: '#332713',
    emissiveIntensity: 0.38,
  }), 1.1, 0.085);
  larch.shadowSide = THREE.DoubleSide;

  const leafGreen = addWind(std({
    map: TX.leafSpray(false),
    alphaTest: 0.24,
    side: THREE.DoubleSide,
    roughness: 1.0,
    color: '#a6b59d',
    envMapIntensity: 0.24,
    emissive: '#141d10',
    emissiveIntensity: 0.24,
  }), 1.15, 0.055);
  leafGreen.shadowSide = THREE.DoubleSide;

  const leafGold = addWind(std({
    map: TX.leafSpray(true),
    alphaTest: 0.24,
    side: THREE.DoubleSide,
    roughness: 1.0,
    color: '#e6d3a4',
    envMapIntensity: 0.42,
    emissive: '#2a200e',
    emissiveIntensity: 0.3,
  }), 1.2, 0.055);
  leafGold.shadowSide = THREE.DoubleSide;

  const fern = addWind(std({
    map: TX.fernFrond(),
    alphaTest: 0.24,
    side: THREE.DoubleSide,
    roughness: 1.0,
    color: '#9baa90',
    envMapIntensity: 0.14,
    emissive: '#0d150c',
    emissiveIntensity: 0.15,
  }), 0.55, 0.75);
  fern.shadowSide = THREE.DoubleSide;

  const grass = addWind(std({
    map: TX.grassTuft(false),
    alphaTest: 0.22,
    side: THREE.DoubleSide,
    roughness: 1.0,
    color: '#aeb6a0',
    envMapIntensity: 0.2,
  }), 0.45, 0.8);

  const grassWarm = addWind(std({
    map: TX.grassTuft(true),
    alphaTest: 0.22,
    side: THREE.DoubleSide,
    roughness: 1.0,
    color: '#b0a688',
    envMapIntensity: 0.2,
  }), 0.5, 0.8);

  const flowers = std({
    map: TX.wildflower(false), alphaTest: 0.34, side: THREE.DoubleSide,
    roughness: 1, color: '#e2dfd2', envMapIntensity: 0.2,
  });
  const flowersWarm = std({
    map: TX.wildflower(true), alphaTest: 0.34, side: THREE.DoubleSide,
    roughness: 1, color: '#eadcae', envMapIntensity: 0.2,
  });

  const moss = std({
    map: metered(TX.mossCarpet().map, 0.85),
    normalMap: metered(TX.mossCarpet().normalMap, 0.85),
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughness: 1,
    color: '#a7b591',
    envMapIntensity: 0.24,
  });

  const leafLitter = std({
    map: TX.leafSpray(true), alphaTest: 0.4, side: THREE.DoubleSide,
    roughness: 1, color: '#b99c5e', envMapIntensity: 0.15,
  });

  return {
    siding, timber, darkTimber, planks, roof, stone, ground, path, bark, birch, logEnd,
    iron, brass, rope, interior, windowMat, glassDark,
    pine, larch, leafGreen, leafGold, fern, grass, grassWarm, flowers, flowersWarm,
    moss, leafLitter, firFar,
    textures: { floor: floorTX, path: pathTX, stone: stoneTX, roof: roofTX, bark: barkTX, moss: TX.mossCarpet() },
    contactShadowMap: TX.contactShadow(),
    softDot: TX.softDot(),
    smoke: TX.smokePuff(),
  };
}
