// Three.js 씬 / 카메라 / 렌더러 — 단순 셰이딩 + 가벼운 bloom (선택적, 모바일은 자동 끔)

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 720;

export function createScene(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060c);
  scene.fog = new THREE.Fog(0x05060c, 28, 70);

  const camera = new THREE.PerspectiveCamera(
    55, window.innerWidth / window.innerHeight, 0.1, 200
  );
  camera.position.set(0, 28, 18);
  camera.lookAt(0, 28, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_MOBILE, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // ── 조명 ─────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffffff, 0.42));

  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(8, 30, 10);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8b5cf6, 0.35);
  fill.position.set(-10, 0, 8);
  scene.add(fill);

  const hemi = new THREE.HemisphereLight(0x6366f1, 0x1e293b, 0.35);
  scene.add(hemi);

  // ── 가벼운 bloom (데스크탑만) ───────────────────────────────
  let composer = null;
  if (!IS_MOBILE) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.55, // strength
      0.6,  // radius
      0.85, // threshold — 밝은 emissive 만 빛남
    );
    composer.addPass(bloom);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, composer };
}
