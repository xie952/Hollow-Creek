import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

const DofShader = {
  name: 'CabinDofShader',
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1280, 720) },
    uFocus: { value: new THREE.Vector2(0.5, 0.5) },
    uAmount: { value: 3.0 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform vec2 uFocus;
    uniform float uAmount;
    varying vec2 vUv;

    void main() {
      vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
      float dist = length((vUv - uFocus) * aspect);
      float mask = smoothstep(0.10, 0.76, dist);
      float radius = uAmount * (0.12 + mask) / uResolution.y;

      vec4 col = texture2D(tDiffuse, vUv) * 0.34;
      for (int i = 0; i < 12; i++) {
        float fi = float(i);
        float ang = fi * 2.39996323 + 0.8;
        float rr = sqrt((fi + 0.5) / 12.0);
        vec2 offset = vec2(cos(ang), sin(ang)) * rr * radius;
        col += texture2D(tDiffuse, vUv + offset) * 0.055;
      }
      gl_FragColor = col;
    }
  `
};

const GradeShader = {
  name: 'CabinGradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1920, 1080) },
    uTime: { value: 0 },
    uExposure: { value: 1.55 },
    uVignette: { value: 0.32 },
    uGrain: { value: 0.012 },
    uAberration: { value: 0.45 },
    uSaturation: { value: 0.95 },
    uFade: { value: 1.0 }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uExposure;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    uniform float uSaturation;
    uniform float uFade;

    const mat3 ACES_IN = mat3(
      vec3(0.59719, 0.07600, 0.02840),
      vec3(0.35458, 0.90834, 0.13383),
      vec3(0.04823, 0.01566, 0.83777)
    );
    const mat3 ACES_OUT = mat3(
      vec3( 1.60475, -0.10208, -0.00327),
      vec3(-0.53108,  1.10813, -0.07276),
      vec3(-0.07367, -0.00605,  1.07602)
    );

    vec3 acesFilm(vec3 v) {
      v = ACES_IN * v;
      vec3 a = v * (v + 0.0245786) - 0.000090537;
      vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
      v = ACES_OUT * (a / b);
      return clamp(v, 0.0, 1.0);
    }

    vec3 linearToSRGB(vec3 c) {
      c = max(c, 0.0);
      vec3 lo = c * 12.92;
      vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
      return mix(hi, lo, step(c, vec3(0.0031308)));
    }

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec2 ab = d * r2 * uAberration * 0.006;
      vec3 color;
      color.r = texture2D(tDiffuse, vUv + ab).r;
      color.g = texture2D(tDiffuse, vUv).g;
      color.b = texture2D(tDiffuse, vUv - ab).b;

      color *= uExposure;

      // Separate the palette: cool shade, warm sun.
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      float shadowMask = 1.0 - smoothstep(0.0, 0.55, luma);
      float highMask = smoothstep(0.45, 2.2, luma);
      color = mix(color, color * vec3(0.84, 0.96, 1.14), shadowMask * 0.13);
      color = mix(color, color * vec3(1.06, 1.005, 0.94), highMask * 0.055);
      color = mix(color, color * vec3(1.0, 0.985, 0.95), highMask * 0.03);

      color = acesFilm(color);

      // Gentle filmic contrast and lifted blacks, then saturation.
      color = clamp(color, 0.0, 1.0);
      color = pow(color, vec3(1.01));
      color = mix(color, color * color * (3.0 - 2.0 * color), 0.2);
      color = color * 0.975 + vec3(0.012, 0.0115, 0.0125);
      float postLuma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(postLuma), color, uSaturation);

      // A whisper of warm bloom in the highlights.
      color += vec3(1.0, 0.76, 0.46) * smoothstep(0.82, 1.0, postLuma) * 0.018;

      color = linearToSRGB(color);

      // Lens vignette, aspect-corrected.
      vec2 vq = vUv - 0.5;
      vq.x *= uResolution.x / max(uResolution.y, 1.0);
      float vig = smoothstep(0.24, 0.93, length(vq) * 1.12);
      color *= 1.0 - uVignette * vig;

      // Fine monochrome grain, strongest in the midtones.
      vec2 gp = vUv * uResolution + uTime * vec2(37.0, 17.0);
      float grain = hash21(floor(gp)) - 0.5;
      float mid = 1.0 - abs(dot(color, vec3(0.333)) - 0.45) * 1.15;
      color += grain * uGrain * clamp(mid, 0.35, 1.0);

      // Interleaved dithering kills gradient banding in the sky.
      float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      color += (dither - 0.5) / 255.0;

      color *= uFade;
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

export function createPost(renderer, scene, camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(size.x / renderer.getPixelRatio(), size.y / renderer.getPixelRatio());

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // A screen-space focus falloff: the framing target stays crisp while the
  // foreground and outer forest soften. It is stable on every GPU, unlike the
  // depth-packed Bokeh pass, and reads as a shallow cinema lens.
  const dofPass = new ShaderPass(DofShader);
  dofPass.uniforms.uResolution.value.set(size.x, size.y);
  dofPass.enabled = true;
  composer.addPass(dofPass);

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    0.27,
    0.55,
    0.90
  );
  composer.addPass(bloom);

  const grade = new ShaderPass(GradeShader);
  grade.uniforms.uResolution.value.set(size.x, size.y);
  composer.addPass(grade);

  const fxaa = new ShaderPass(FXAAShader);
  fxaa.material.uniforms.resolution.value.set(1 / size.x, 1 / size.y);
  fxaa.renderToScreen = true;
  composer.addPass(fxaa);

  let dofEnabled = true;
  let pixelRatio = renderer.getPixelRatio();

  function setSize(width, height, ratio = pixelRatio) {
    pixelRatio = ratio;
    composer.setPixelRatio(ratio);
    composer.setSize(width, height);
    const w = Math.max(1, Math.round(width * ratio));
    const h = Math.max(1, Math.round(height * ratio));
    grade.uniforms.uResolution.value.set(w, h);
    dofPass.uniforms.uResolution.value.set(w, h);
    fxaa.material.uniforms.resolution.value.set(1 / w, 1 / h);
  }

  function setPixelRatio(ratio) {
    const width = composer._width;
    const height = composer._height;
    setSize(width, height, ratio);
  }

  function setFocusPoint(x, y) {
    dofPass.uniforms.uFocus.value.set(
      THREE.MathUtils.clamp(x, 0.02, 0.98),
      THREE.MathUtils.clamp(y, 0.02, 0.98)
    );
  }

  function setDofEnabled(enabled) {
    dofEnabled = !!enabled;
    dofPass.enabled = dofEnabled;
  }

  function update(time) {
    grade.uniforms.uTime.value = time;
  }

  function setFade(value) {
    grade.uniforms.uFade.value = THREE.MathUtils.clamp(value, 0, 1);
  }

  function setGrain(value) {
    grade.uniforms.uGrain.value = value;
  }

  function dispose() {
    composer.dispose();
    dofPass.dispose();
    bloom.dispose();
    grade.dispose();
    fxaa.dispose();
  }

  return {
    composer,
    renderPass,
    dof: dofPass,
    bloom,
    grade,
    fxaa,
    render: (dt) => composer.render(dt),
    setSize,
    setPixelRatio,
    setFocusPoint,
    setDofEnabled,
    setFade,
    setGrain,
    update,
    dispose
  };
}
