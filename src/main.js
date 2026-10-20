// Hollow Creek — a small cabin in the last light of an autumn forest.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMaterials, setWindTime } from './materials.js';
import { createSky } from './sky.js';
import { createTerrain } from './terrain.js';
import { createForest } from './forest.js';
import { createCabin } from './cabin.js';
import { createEffects } from './effects.js';
import { createPost } from './post.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const RENDER_MODE = params.get('render') === '1' || params.get('render') === 'true';
const HIGH_QUALITY = params.get('quality') === 'high';
const LOW_QUALITY = params.get('quality') === 'low' || params.get('quality') === 'balanced';
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const START_TIME = Math.max(0, Number(params.get('t') || 0) || 0);

const SHOTS = [
  { id: 'wide', label: '林间全景', pos: [9.9, 2.9, 20.6], target: [-3.2, 2.05, 0.6], fov: 41 },
  { id: 'porch', label: '门廊', pos: [6.8, 2.25, 10.5], target: [0.2, 2.2, 3.0], fov: 37 },
  { id: 'low', label: '低机位', pos: [4.5, 1.05, 14.6], target: [0.2, 2.55, 0.7], fov: 40 },
  { id: 'detail', label: '檐下', pos: [1.0, 1.55, 9.8], target: [0.7, 2.28, 3.0], fov: 34 },
];

const loader = $('loader');
const loadBar = $('load-bar');
const loadPct = $('load-pct');
const loadStage = $('load-stage');
const canvas = $('stage');
const ui = $('ui');

let renderer, scene, camera, controls, post, sky, effects;
let materials, cabin;
let elapsed = START_TIME;
let last = performance.now();
let dpr = 1;
let dprCap = 1.65;
let fade = RENDER_MODE ? 1 : 0;
let ready = false;
let raf = 0;
let currentShot = 0;
let travel = null;
let tourActive = false;
let tourIndex = 0;
let tourHold = 0;
let perfTime = 0;
let perfFrames = 0;
let perfMode = 0;
let fpsValue = 0;
const focusTmp = new THREE.Vector3();

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);

function setLoad(pct, label) {
  if (!loader) return;
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  if (loadBar) loadBar.style.transform = 'scaleX(' + (p / 100).toFixed(3) + ')';
  if (loadPct) loadPct.textContent = p + '%';
  if (loadStage && label) loadStage.textContent = label;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

function fail(err) {
  console.error(err);
  window.__error = String(err && err.stack || err);
  if (loader) {
    loader.classList.add('failed');
    const stage = $('load-stage');
    if (stage) stage.textContent = '林间起了雾，场景未能加载';
    const meta = $('load-pct');
    if (meta) meta.textContent = 'ERROR';
    const sub = loader.querySelector('.load-sub');
    if (sub) sub.textContent = String(err && err.message || err);
  }
  const errBox = $('error');
  if (errBox) {
    errBox.hidden = false;
    errBox.textContent = '无法启动 3D 场景：' + String(err && err.message || err);
  }
}

function buildUI() {
  const nav = $('shot-nav');
  if (nav) {
    SHOTS.forEach((shot, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'shot-btn';
      b.dataset.shot = shot.id;
      b.innerHTML = '<span class="idx">0' + (i + 1) + '</span><span>' + shot.label + '</span>';
      b.addEventListener('click', () => selectShot(i));
      nav.appendChild(b);
    });
  }
  $('tour-btn')?.addEventListener('click', () => (tourActive ? stopTour() : startTour()));
  $('reset-btn')?.addEventListener('click', resetView);
  $('full-btn')?.addEventListener('click', toggleFullscreen);
  $('hide-btn')?.addEventListener('click', () => setHudHidden(true));
  $('return-btn')?.addEventListener('click', () => setHudHidden(false));

  canvas?.addEventListener('dblclick', () => {
    stopTour();
    selectShot(0);
  });
  const interrupt = () => {
    if (tourActive) stopTour();
    else if (travel) cancelTravel();
  };
  canvas?.addEventListener('pointerdown', interrupt);
  canvas?.addEventListener('wheel', interrupt, { passive: true });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);
  updateShotUI();
}

function updateShotUI() {
  document.querySelectorAll('.shot-btn').forEach((b, i) => {
    b.classList.toggle('active', !tourActive && i === currentShot);
  });
  const tourBtn = $('tour-btn');
  if (tourBtn) {
    tourBtn.classList.toggle('active', tourActive);
    const label = tourBtn.querySelector('span:last-child');
    if (label) label.textContent = tourActive ? '停止运镜' : '电影运镜';
  }
}

function setHudHidden(hidden) {
  document.body.classList.toggle('hide-ui', hidden);
}

function onKeyDown(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target && e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  const k = e.key.toLowerCase();
  if (k >= '1' && k <= '4') {
    selectShot(Number(k) - 1);
  } else if (k === 't') {
    tourActive ? stopTour() : startTour();
  } else if (k === 'h') {
    setHudHidden(!document.body.classList.contains('hide-ui'));
  } else if (k === 'f') {
    toggleFullscreen();
  } else if (k === 'r') {
    resetView();
  } else if (k === 'escape') {
    stopTour();
    setHudHidden(false);
  }
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (err) {
    console.warn('Fullscreen unavailable', err);
  }
}

function applyShot(shot) {
  camera.position.set(shot.pos[0], shot.pos[1], shot.pos[2]);
  controls.target.set(shot.target[0], shot.target[1], shot.target[2]);
  camera.fov = shot.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(controls.target);
  controls.update();
}

function beginTravel(shot, duration = 2.4, ease = easeInOutCubic, fromTour = false) {
  const toPos = new THREE.Vector3(shot.pos[0], shot.pos[1], shot.pos[2]);
  const toTarget = new THREE.Vector3(shot.target[0], shot.target[1], shot.target[2]);
  travel = {
    fromPos: camera.position.clone(),
    fromTarget: controls.target.clone(),
    fromFov: camera.fov,
    toPos, toTarget,
    toFov: shot.fov,
    t: 0,
    duration: Math.max(0.01, duration),
    ease,
    fromTour,
  };
  controls.enabled = false;
}

function updateTravel(dt) {
  if (!travel) return;
  travel.t += dt;
  const k = Math.min(1, travel.t / travel.duration);
  const e = travel.ease(k);
  camera.position.lerpVectors(travel.fromPos, travel.toPos, e);
  controls.target.lerpVectors(travel.fromTarget, travel.toTarget, e);
  camera.fov = THREE.MathUtils.lerp(travel.fromFov, travel.toFov, e);
  camera.updateProjectionMatrix();
  camera.lookAt(controls.target);
  if (k >= 1) {
    const wasTour = travel.fromTour;
    travel = null;
    if (wasTour) {
      tourHold = 6.2;
    } else {
      controls.enabled = true;
      controls.update();
    }
  }
}

function cancelTravel() {
  if (!travel) return;
  travel = null;
  controls.enabled = true;
}

function selectShot(index, instant = false) {
  const shot = SHOTS[index];
  if (!shot) return;
  if (tourActive) stopTour();
  cancelTravel();
  currentShot = index;
  if (instant || REDUCED_MOTION) {
    applyShot(shot);
    controls.enabled = true;
  } else {
    beginTravel(shot, 2.6, easeInOutCubic, false);
  }
  updateShotUI();
}

function startTour() {
  if (tourActive) return;
  cancelTravel();
  tourActive = true;
  tourIndex = 0;
  tourHold = 0;
  controls.enabled = false;
  beginTravel(SHOTS[0], 3.4, easeInOutCubic, true);
  updateShotUI();
}

function stopTour() {
  if (!tourActive && !travel) return;
  tourActive = false;
  travel = null;
  controls.enabled = true;
  controls.update();
  updateShotUI();
}

function resetView() {
  stopTour();
  cancelTravel();
  selectShot(0);
}

function driftCamera(dt) {
  const up = new THREE.Vector3(0, 1, 0);
  const offset = camera.position.clone().sub(controls.target);
  offset.applyAxisAngle(up, 0.0045 * dt);
  camera.position.copy(controls.target).add(offset);
  camera.lookAt(controls.target);
}

function applyPixelRatio(value) {
  dpr = Math.max(0.8, Math.min(2, value));
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  post?.setSize(window.innerWidth, window.innerHeight, dpr);
  effects?.setPixelRatio(dpr);
}

function onResize() {
  if (!renderer || !camera) return;
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
  applyPixelRatio(dpr);
}

function monitorPerformance(dt) {
  if (RENDER_MODE || HIGH_QUALITY || REDUCED_MOTION) return;
  perfTime += dt;
  perfFrames++;
  if (perfTime < 2.5) return;
  const fps = perfFrames / perfTime;
  fpsValue = fps;
  perfTime = 0;
  perfFrames = 0;

  if (fps < 42) {
    if (dpr > 1.001) {
      applyPixelRatio(Math.max(1, dpr - 0.25));
    } else if (perfMode === 0) {
      perfMode = 1;
      post.setDofEnabled(false);
      console.info('[Hollow Creek] Depth of field disabled to keep motion smooth.');
    } else if (perfMode === 1 && fps < 34) {
      perfMode = 2;
      post.bloom.strength *= 0.7;
      post.setGrain(0.009);
      console.info('[Hollow Creek] Bloom softened for performance.');
    }
  }
}

function renderFrame(dt = 0.016) {
  if (!camera || !scene) return;
  sky.update(elapsed, dt);
  setWindTime(elapsed);
  effects.update(elapsed, dt);
  post.update(elapsed);
  if (!travel) {
    if (tourActive) {
      tourHold -= dt;
      if (tourHold <= 0) {
        tourIndex = (tourIndex + 1) % SHOTS.length;
        beginTravel(SHOTS[tourIndex], 3.0, easeInOutCubic, true);
      } else {
        driftCamera(dt);
      }
    } else {
      controls.update();
    }
  }
  const focusNDC = controls.target.clone().project(camera);
  post.setFocusPoint(focusNDC.x * 0.5 + 0.5, focusNDC.y * 0.5 + 0.5);
  if (fade < 1 && !RENDER_MODE) {
    fade = Math.min(1, fade + dt / 2.2);
    post.setFade(fade);
  }
  post.render(dt);
}

function animate(now) {
  raf = requestAnimationFrame(animate);
  const dt = Math.min(0.05, Math.max(0.0, (now - last) / 1000));
  last = now;
  elapsed += dt;
  updateTravel(dt);
  renderFrame(dt);
  monitorPerformance(dt);
}

async function boot() {
  if (RENDER_MODE) document.body.classList.add('render-mode');
  if (HIGH_QUALITY) dprCap = 1.9;
  if (LOW_QUALITY) dprCap = 1.25;
  if (REDUCED_MOTION) dprCap = 1.25;
  dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  if (RENDER_MODE || LOW_QUALITY) dpr = Math.min(dpr, 1);

  setLoad(4, '测量林地的坡度');
  await nextFrame();

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0a0d0b, 1);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x6f6a5a, LOW_QUALITY ? 0.0102 : 0.0118);

  camera = new THREE.PerspectiveCamera(44, window.innerWidth / Math.max(1, window.innerHeight), 0.08, 300);
  camera.position.set(12.4, 4.25, 25.2);
  controls = new OrbitControls(camera, canvas);
  controls.target.set(-3.2, 2.05, 0.6);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.72;
  controls.panSpeed = 0.6;
  controls.enablePan = false;
  controls.minDistance = 4.5;
  controls.maxDistance = 28;
  controls.minPolarAngle = 0.16;
  controls.maxPolarAngle = 1.63;
  controls.update();

  setLoad(12, '铺开低垂的暮色');
  await nextFrame();

  sky = createSky(renderer);
  scene.add(sky.mesh);
  scene.environment = sky.envMap;
  scene.environmentIntensity = 1.45;

  setLoad(24, '打磨被雨水洗过的木料');
  await nextFrame();

  materials = createMaterials();

  // Low autumn sun from the front-right: the porch catches the light,
  // while the forest behind falls into cool blue shade.
  const sun = new THREE.DirectionalLight(0xffbe86, 4.2);
  sun.position.copy(sky.sunDir).multiplyScalar(48);
  sun.target.position.set(0, 1.8, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(LOW_QUALITY ? 1024 : 2048, LOW_QUALITY ? 1024 : 2048);
  sun.shadow.camera.left = -23;
  sun.shadow.camera.right = 23;
  sun.shadow.camera.top = 23;
  sun.shadow.camera.bottom = -23;
  sun.shadow.camera.near = 18;
  sun.shadow.camera.far = 96;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.045;
  scene.add(sun, sun.target);

  const skyFill = new THREE.HemisphereLight(0xa9bfd0, 0x6d5a45, 2.0);
  scene.add(skyFill);

  const coolFill = new THREE.DirectionalLight(0xb8cfdf, 0.55);
  coolFill.position.set(-11, 9, 15);
  coolFill.target.position.set(0, 1.6, 0);
  scene.add(coolFill, coolFill.target);

  const bounce = new THREE.DirectionalLight(0xffd9bb, 0.42);
  bounce.position.set(7, 6.5, 13);
  bounce.target.position.set(0, 1.9, 0);
  scene.add(bounce, bounce.target);

  // A soft key spot gives the clearing a pool of late sun and models the facade.
  const keySpot = new THREE.SpotLight(0xffd7b4, 245, 42, 0.4, 1.0, 1.32);
  keySpot.position.set(-8.5, 8.2, 15.5);
  keySpot.target.position.set(0.2, 1.7, 1.4);
  scene.add(keySpot, keySpot.target);

  // Soft frontal fill keeps the shaded facade readable without flattening the warm light.
  const rimLight = new THREE.DirectionalLight(0xffc98f, 1.15);
  rimLight.position.set(-13, 9.5, -15);
  rimLight.target.position.set(0, 2.2, 0);
  scene.add(rimLight, rimLight.target);

  const facadeFill = new THREE.DirectionalLight(0xcfdbe6, 1.0);
  facadeFill.position.set(5, 4.5, 15);
  facadeFill.target.position.set(0, 2, 0);
  scene.add(facadeFill, facadeFill.target);

  // Sky bounce off the clearing: the facade sits in the sunset's shadow, so it
  // needs cool indirect light to keep the timber readable against the windows.
  const frontFill = new THREE.DirectionalLight(0xc3d3dd, 1.6);
  frontFill.position.set(9, 3.6, 18);
  frontFill.target.position.set(0, 1.8, 1.4);
  scene.add(frontFill, frontFill.target);

  scene.add(new THREE.AmbientLight(0x9cafb8, 0.5));

  setLoad(36, '让苔藓和蕨类漫过小路');
  await nextFrame();

  const terrain = createTerrain(materials);
  scene.add(terrain.group);

  setLoad(55, '种下云杉、白桦与落叶松');
  await nextFrame();

  const forest = createForest(materials, new THREE.Vector3(9.9, 2.9, 20.6));
  scene.add(forest.group);

  setLoad(72, '点亮门廊上的旧提灯');
  await nextFrame();

  cabin = createCabin(materials);
  scene.add(cabin.group);

  setLoad(84, '升起第一缕炊烟');
  await nextFrame();

  effects = createEffects(materials, cabin);
  effects.setPixelRatio(dpr);
  scene.add(effects.group);

  setLoad(92, '调校镜头与光');
  await nextFrame();

  post = createPost(renderer, scene, camera);
  post.setSize(window.innerWidth, window.innerHeight, dpr);
  post.setDofEnabled(!LOW_QUALITY);
  if (RENDER_MODE) post.setFade(1);

  buildUI();
  bindDebugApi();
  updateShotUI();

  camera.position.set(12.4, 4.25, 25.2);
  controls.target.set(-3.2, 2.05, 0.6);
  camera.fov = 41;
  camera.updateProjectionMatrix();
  camera.lookAt(controls.target);

  setLoad(97, '尘埃落定');
  await nextFrame();

  // Compile once before the curtain lifts, then freeze the static shadow map.
  renderer.compile(scene, camera);
  renderFrame(0.016);
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = false;

  if (RENDER_MODE || REDUCED_MOTION) {
    applyShot(SHOTS[0]);
    controls.enabled = false;
    if (RENDER_MODE) setHudHidden(true);
    fade = 1;
    post.setFade(1);
  } else {
    fade = 0;
    post.setFade(0);
    controls.enabled = false;
    beginTravel(SHOTS[0], 5.6, easeOutQuint, false);
    requestAnimationFrame(() => document.body.classList.add('is-ready'));
  }

  setLoad(100, '黄昏正好');
  await nextFrame();

  window.__ready = true;
  ready = true;
  last = performance.now();
  raf = requestAnimationFrame(animate);

  if (loader) {
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 1400);
  }
}

function bindDebugApi() {
  window.__THREE = THREE;
  window.__scene = { get camera() { return camera; }, get scene() { return scene; }, get renderer() { return renderer; }, get post() { return post; }, get controls() { return controls; } };
  window.__seek = (t) => {
    elapsed = Math.max(0, Number(t) || 0);
    sky.update(elapsed, 0.016);
    setWindTime(elapsed);
    effects.update(elapsed, 0.016);
    post.update(elapsed);
    const focusNDC = controls.target.clone().project(camera);
    post.setFocusPoint(focusNDC.x * 0.5 + 0.5, focusNDC.y * 0.5 + 0.5);
    post.render(0.016);
  };
  window.__applyCamera = (px, py, pz, tx, ty, tz, fov = 38) => {
    stopTour(); cancelTravel();
    camera.position.set(px, py, pz);
    controls.target.set(tx, ty, tz);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.lookAt(controls.target);
    controls.enabled = true;
    controls.update();
    const focusNDC = controls.target.clone().project(camera);
    post.setFocusPoint(focusNDC.x * 0.5 + 0.5, focusNDC.y * 0.5 + 0.5);
  };
  window.__preset = (nameOrIndex, instant = true) => {
    const i = typeof nameOrIndex === 'number' ? nameOrIndex : SHOTS.findIndex((s) => s.id === nameOrIndex);
    if (i >= 0) selectShot(i, instant);
  };
  window.__hideUI = (hidden = true) => setHudHidden(hidden);
  window.__fade = (v = 1) => { fade = Math.min(1, Math.max(0, v)); post.setFade(fade); };
  window.__tour = (on = true) => (on ? startTour() : stopTour());
  window.__renderNow = () => renderFrame(0.016);
  window.__post = post;
  window.__quality = (level) => {
    if (level === 'high') { post.setDofEnabled(true); post.grade.uniforms.uGrain.value = 0.014; }
    if (level === 'low') { post.setDofEnabled(false); }
  };
  window.__state = () => ({
    ready, fps: fpsValue, dpr, travel: !!travel, tourActive,
    camera: camera.position.toArray(),
    target: controls.target.toArray(),
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
  });
}

boot().catch(fail);
