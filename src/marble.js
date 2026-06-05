// 구슬 — Three Sphere + Sprite(Canvas 텍스처) 이름 라벨 + Rapier RigidBody

import * as THREE from 'three';

const RADIUS = 0.38;
const SHARED_GEOM = new THREE.SphereGeometry(RADIUS, 20, 16);

// 이름 → CanvasTexture (Sprite 라벨)
function makeNameTexture(name, color) {
  const padding = 16;
  const fontSize = 36;
  const canvas = document.createElement('canvas');
  // 측정용 ctx
  const ctx0 = canvas.getContext('2d');
  ctx0.font = `700 ${fontSize}px -apple-system, "Noto Sans KR", sans-serif`;
  const textWidth = ctx0.measureText(name).width;
  canvas.width = Math.ceil(textWidth + padding * 2);
  canvas.height = fontSize + padding;
  const ctx = canvas.getContext('2d');
  // 배경 (둥근 사각형, 색상 박스)
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 0, 0, canvas.width, canvas.height, 8);
  ctx.fill();
  // 색 점
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(padding - 4, canvas.height / 2, 6, 0, Math.PI * 2);
  ctx.fill();
  // 텍스트
  ctx.fillStyle = 'white';
  ctx.font = `700 ${fontSize}px -apple-system, "Noto Sans KR", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(name, padding + 10, canvas.height / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return { tex, w: canvas.width, h: canvas.height };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createMarble({ scene, world, RAPIER, def, x, y, z }) {
  const color = new THREE.Color(def.color);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.3,
    metalness: 0.5,
    emissive: color.clone().multiplyScalar(0.15),
  });
  const mesh = new THREE.Mesh(SHARED_GEOM, mat);
  mesh.position.set(x, y, z);
  scene.add(mesh);

  // 이름 라벨 sprite
  const { tex, w, h } = makeNameTexture(def.name, def.color);
  const spriteMat = new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false, depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  // sprite 의 world unit 크기 — canvas px / 50
  const scale = 0.025;
  sprite.scale.set(w * scale, h * scale, 1);
  sprite.position.set(x, y + RADIUS + 0.5, z);
  scene.add(sprite);

  // Rapier rigid body — damping 약하게 (끼임 후 회복 빨라야), restitution 적당, friction 낮음
  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .setLinvel((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.2)
      .setLinearDamping(0.0)
      .setAngularDamping(0.05)
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.ball(RADIUS)
      .setRestitution(0.5)
      .setFriction(0.15)
      .setDensity(1.5)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    rb
  );

  return {
    id: def.id,
    name: def.name,
    color: def.color,
    mesh,
    sprite,
    rb,
    colliderHandle: collider.handle,
    finished: false,
    finishedAt: null,
    finishOrder: null, // 결승선 통과 순위 (0부터)
    // 매 프레임 mesh/sprite 위치 동기화 (+ finished 구슬은 살짝 옅게)
    sync() {
      const t = rb.translation();
      mesh.position.set(t.x, t.y, t.z);
      const r = rb.rotation();
      mesh.quaternion.set(r.x, r.y, r.z, r.w);
      sprite.position.set(t.x, t.y + RADIUS + 0.55, t.z);
      // finished 후 emissive ↓ + sprite alpha ↓ — 결승선 근처에서 시각 혼란 줄임
      if (this.finished && !this._fadedOut) {
        mat.emissiveIntensity = 0.05;
        mat.opacity = 0.35;
        mat.transparent = true;
        spriteMat.opacity = 0.3;
        this._fadedOut = true;
      }
    },
    dispose() {
      scene.remove(mesh);
      scene.remove(sprite);
      mat.dispose();
      spriteMat.dispose();
      tex.dispose();
      world.removeRigidBody(rb);
    },
  };
}

export { RADIUS as MARBLE_RADIUS };
