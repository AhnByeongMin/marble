// Three.js 씬 / 카메라 / 렌더러 / 빛 — 단순 (그림자 X, MeshStandardMaterial)

import * as THREE from 'three';

export function createScene(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0f);
  scene.fog = new THREE.Fog(0x0a0a0f, 30, 80);

  const camera = new THREE.PerspectiveCamera(
    55, window.innerWidth / window.innerHeight, 0.1, 200
  );
  camera.position.set(0, 0, 18);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // 빛 — 단순
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(8, 20, 6);
  scene.add(dir);
  // 약간의 색 hemi 로 입체감
  const hemi = new THREE.HemisphereLight(0x6366f1, 0x1e293b, 0.4);
  scene.add(hemi);

  // 리사이즈
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer };
}
