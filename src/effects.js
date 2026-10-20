// Atmosphere: chimney smoke, ground mist, sunlit dust, fireflies and drifting leaves.
import * as THREE from 'three';
import { mulberry32, makeTexture, TAU } from './lib.js';
import { terrainHeight } from './terrain.js';

function smokePoints(origin, rng) {
  const count = 46;
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const alpha = new Float32Array(count);
  const data = [];
  for (let i = 0; i < count; i++) {
    const age = rng();
    const life = 6.2 + rng() * 3.8;
    const p = makePuff(origin, age, rng);
    data.push({ age, life, p, ph: rng() * TAU, drift: 0.18 + rng() * 0.4 });
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: null },
      uColor: { value: new THREE.Color('#c8c3b8') },
      uScale: { value: 780 },
      uPR: { value: 1 },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      varying float vAlpha;
      uniform float uScale;
      uniform float uPR;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(aSize * uPR * uScale / max(1.0, -mv.z), 1.0, 500.0);
        gl_Position = projectionMatrix * mv;
        vAlpha = aAlpha;
      }`,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        vec4 t = texture2D(uMap, gl_PointCoord);
        if (t.a < 0.004) discard;
        gl_FragColor = vec4(uColor, t.a * vAlpha);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  return { geo, mat, pos, size, alpha, data, count };
}

function makePuff(origin, age, rng) {
  const ph = rng() * TAU;
  const spread = age * 0.85;
  return new THREE.Vector3(
    origin.x + age * 0.85 + Math.sin(ph + age * 2.4) * spread * 0.55,
    origin.y + age * 4.4,
    origin.z + age * 0.55 + Math.cos(ph * 1.3 + age * 1.7) * spread * 0.5,
  );
}

function pointCloud(count, texture, color, { size = 0.04, additive = true, opacity = 0.5 } = {}) {
  const pos = new Float32Array(count * 3);
  const aSize = new Float32Array(count);
  const aAlpha = new Float32Array(count);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(aAlpha, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uColor: { value: color },
      uScale: { value: 850 },
      uPR: { value: 1 },
      uOpacity: { value: opacity },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      varying float vAlpha;
      uniform float uScale;
      uniform float uPR;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(aSize * uPR * uScale / max(1.0, -mv.z), 1.0, 256.0);
        gl_Position = projectionMatrix * mv;
        vAlpha = aAlpha;
      }`,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;
      void main() {
        vec4 t = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(uColor, t.a * vAlpha * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  return { geo, mat, pos, size: aSize, alpha: aAlpha, count };
}

function leafTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 64, 64);
  x.save();
  x.translate(32, 32);
  x.beginPath();
  x.moveTo(0, -28);
  x.bezierCurveTo(22, -16, 25, 10, 0, 28);
  x.bezierCurveTo(-25, 10, -22, -16, 0, -28);
  x.closePath();
  x.fillStyle = '#ded2b6';
  x.fill();
  x.strokeStyle = 'rgba(110,92,60,0.55)';
  x.lineWidth = 1.2;
  x.beginPath();
  x.moveTo(0, -26);
  x.lineTo(0, 26);
  x.stroke();
  x.lineWidth = 0.8;
  for (let i = -3; i <= 3; i++) {
    x.beginPath();
    x.moveTo(0, i * 6);
    x.lineTo(13, i * 6 - 8);
    x.stroke();
    x.beginPath();
    x.moveTo(0, i * 6);
    x.lineTo(-13, i * 6 - 8);
    x.stroke();
  }
  x.restore();
  return makeTexture(c, { clamp: true });
}

export function createEffects(mats, cabin) {
  const group = new THREE.Group();
  group.name = 'atmosphere';
  const rng = mulberry32(9931);
  const smoke = smokePoints(cabin.smokeOrigin, rng);
  smoke.mat.uniforms.uMap.value = mats.smoke;
  group.add(new THREE.Points(smoke.geo, smoke.mat));

  // Ground mist patches.
  const mist = pointCloud(30, mats.softDot, new THREE.Color('#b8c3bd'), { additive: false, opacity: 0.055 });
  const mistData = [];
  for (let i = 0; i < mist.count; i++) {
    const a = rng() * TAU;
    const r = 4 + Math.sqrt(rng()) * 30;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    mist.pos[i * 3] = x;
    mist.pos[i * 3 + 1] = terrainHeight(x, z) + 0.55 + rng() * 1.6;
    mist.pos[i * 3 + 2] = z;
    mist.size[i] = 7 + rng() * 12;
    mist.alpha[i] = 0.035 + rng() * 0.05;
    mistData.push({ ph: rng() * TAU, speed: 0.02 + rng() * 0.05 });
  }
  group.add(new THREE.Points(mist.geo, mist.mat));

  // Dust motes in the low sun.
  const dust = pointCloud(220, mats.softDot, new THREE.Color(1.34, 1.04, 0.64), { additive: true, opacity: 0.32 });
  const dustData = [];
  for (let i = 0; i < dust.count; i++) {
    const x = -13 + rng() * 27;
    const z = -4 + rng() * 22;
    const y = 0.45 + rng() * 6.2;
    dust.pos[i * 3] = x; dust.pos[i * 3 + 1] = y; dust.pos[i * 3 + 2] = z;
    dust.size[i] = 0.009 + rng() * 0.016;
    dust.alpha[i] = 0.35 + rng() * 0.5;
    dustData.push({ ph: rng() * TAU, speed: 0.1 + rng() * 0.25 });
  }
  group.add(new THREE.Points(dust.geo, dust.mat));

  // A few fireflies around the clearing edge.
  const fireflies = pointCloud(28, mats.softDot, new THREE.Color(1.24, 1.36, 0.54), { additive: true, opacity: 0.42 });
  const flyData = [];
  for (let i = 0; i < fireflies.count; i++) {
    const a = rng() * TAU;
    const r = 5 + Math.sqrt(rng()) * 15;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    fireflies.pos[i * 3] = x;
    fireflies.pos[i * 3 + 1] = terrainHeight(x, z) + 0.35 + rng() * 1.5;
    fireflies.pos[i * 3 + 2] = z;
    fireflies.size[i] = 0.022 + rng() * 0.022;
    fireflies.alpha[i] = 0;
    flyData.push({ baseX: x, baseZ: z, ph: rng() * TAU, speed: 0.25 + rng() * 0.5 });
  }
  group.add(new THREE.Points(fireflies.geo, fireflies.mat));

  // Falling leaves.
  const leafGeo = new THREE.PlaneGeometry(0.14, 0.19);
  const leafMat = new THREE.MeshStandardMaterial({
    map: leafTexture(), alphaTest: 0.35, side: THREE.DoubleSide,
    roughness: 1, color: '#c7b391', envMapIntensity: 0.2,
  });
  const leafCount = 18;
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
  leaves.frustumCulled = false;
  leaves.castShadow = false;
  const leafState = [];
  const leafColors = [[0.9, 0.72, 0.46], [0.82, 0.6, 0.38], [0.76, 0.56, 0.34], [0.96, 0.8, 0.56]];
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  for (let i = 0; i < leafCount; i++) {
    const a = rng() * TAU;
    const r = 6.4 + rng() * 8;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r + 4;
    const y = 4.2 + rng() * 5;
    leafState.push({
      x, y, z, fall: 0.18 + rng() * 0.3, ph: rng() * TAU,
      rx: rng() * TAU, ry: rng() * TAU, rz: rng() * TAU,
      spin: 0.5 + rng() * 1.3, scale: 0.45 + rng() * 0.5,
    });
    const c = leafColors[i % leafColors.length];
    tint.setRGB(c[0], c[1], c[2]);
    leaves.setColorAt(i, tint);
  }
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  group.add(leaves);

  let lanternBase = cabin.lanternLight.intensity;

  function update(time, dt) {
    // Chimney smoke.
    for (let i = 0; i < smoke.count; i++) {
      const d = smoke.data[i];
      d.age += dt / d.life;
      if (d.age >= 1) {
        d.age = 0;
        d.life = 6.2 + rng() * 3.8;
        d.ph = rng() * TAU;
        d.p.copy(makePuff(cabin.smokeOrigin, 0, rng));
      }
      const age = d.age;
      const p = d.p;
      p.x += (0.22 + d.drift) * dt;
      p.y += (0.65 - age * 0.3) * dt;
      p.z += Math.sin(time * 0.35 + d.ph) * 0.12 * dt;
      smoke.pos[i * 3] = p.x;
      smoke.pos[i * 3 + 1] = p.y;
      smoke.pos[i * 3 + 2] = p.z;
      smoke.size[i] = 0.35 + age * 2.6;
      smoke.alpha[i] = Math.sin(Math.min(1, age * 1.25) * Math.PI) * 0.32;
    }
    smoke.geo.attributes.position.needsUpdate = true;
    smoke.geo.attributes.aSize.needsUpdate = true;
    smoke.geo.attributes.aAlpha.needsUpdate = true;

    // Mist: barely perceptible lateral drift.
    for (let i = 0; i < mist.count; i++) {
      const d = mistData[i];
      mist.pos[i * 3 + 1] += Math.sin(time * 0.18 + d.ph) * 0.004;
      mist.pos[i * 3] += Math.cos(time * 0.12 + d.ph) * d.speed * dt;
    }
    mist.geo.attributes.position.needsUpdate = true;

    // Dust motes.
    for (let i = 0; i < dust.count; i++) {
      const d = dustData[i];
      dust.pos[i * 3] += Math.sin(time * 0.23 + d.ph) * 0.06 * dt;
      dust.pos[i * 3 + 1] += Math.sin(time * 0.4 + d.ph * 1.8) * 0.035 * dt;
      dust.pos[i * 3 + 2] += Math.cos(time * 0.19 + d.ph) * 0.05 * dt;
      dust.alpha[i] = 0.22 + 0.42 * (0.5 + 0.5 * Math.sin(time * 0.9 + d.ph));
    }
    dust.geo.attributes.position.needsUpdate = true;
    dust.geo.attributes.aAlpha.needsUpdate = true;

    // Fireflies.
    for (let i = 0; i < fireflies.count; i++) {
      const d = flyData[i];
      const blink = Math.sin(time * d.speed + d.ph);
      fireflies.alpha[i] = Math.max(0, blink) ** 5 * 0.9;
      fireflies.pos[i * 3] = d.baseX + Math.sin(time * 0.21 + d.ph) * 0.5;
      fireflies.pos[i * 3 + 2] = d.baseZ + Math.cos(time * 0.17 + d.ph * 1.7) * 0.5;
      fireflies.pos[i * 3 + 1] += Math.sin(time * 0.3 + d.ph) * 0.01;
    }
    fireflies.geo.attributes.position.needsUpdate = true;
    fireflies.geo.attributes.aAlpha.needsUpdate = true;

    // Drifting leaves.
    for (let i = 0; i < leafCount; i++) {
      const l = leafState[i];
      l.y -= l.fall * dt;
      l.x += (0.28 + Math.sin(time * 0.6 + l.ph) * 0.22) * dt;
      l.z += Math.cos(time * 0.37 + l.ph) * 0.24 * dt;
      const ground = terrainHeight(l.x, l.z);
      if (l.y < ground + 0.03) {
        l.y = 6.2 + rng() * 4.2;
        const a = rng() * TAU, r = 6.4 + rng() * 8;
        l.x = Math.cos(a) * r;
        l.z = Math.sin(a) * r + 4;
      }
      l.rx += l.spin * dt;
      l.rz += l.spin * 0.7 * dt;
      dummy.position.set(l.x, l.y, l.z);
      dummy.rotation.set(l.rx, l.ry + Math.sin(time + l.ph) * 0.4, l.rz);
      dummy.scale.setScalar(l.scale);
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
    }
    leaves.instanceMatrix.needsUpdate = true;

    // Candle-like lantern breath.
    cabin.lanternLight.intensity = lanternBase * (0.94 + 0.06 * Math.sin(time * 7.3) * Math.sin(time * 2.1 + 1.2));
  }

  function setPixelRatio(pr) {
    smoke.mat.uniforms.uPR.value = pr;
    mist.mat.uniforms.uPR.value = pr;
    dust.mat.uniforms.uPR.value = pr;
    fireflies.mat.uniforms.uPR.value = pr;
  }

  return { group, update, setPixelRatio };
}
