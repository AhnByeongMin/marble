// 3D 수직 트랙 — 좌우 벽, 핀(원기둥), 회전 풍차, 결승선(sensor)
// 좌표: y 아래로 감소 (위쪽 = 출발점, 아래쪽 = 결승). x 좌우, z 깊이는 좁게.

import * as THREE from 'three';

const TRACK_WIDTH = 12;       // x 폭
const TRACK_DEPTH = 1.6;      // z 깊이 (구슬이 z 축 쏠리는 거 방지)
const TRACK_TOP_Y = 30;       // 출발점
const TRACK_BOTTOM_Y = -30;   // 결승선 y
const FINISH_Y = -28;         // sensor

export const TRACK = {
  width: TRACK_WIDTH,
  depth: TRACK_DEPTH,
  topY: TRACK_TOP_Y,
  bottomY: TRACK_BOTTOM_Y,
  finishY: FINISH_Y,
};

// 트랙 구조 빌드 — Three meshes + Rapier colliders 동시에
export function buildTrack({ scene, world, RAPIER }) {
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b, roughness: 0.6, metalness: 0.2,
  });
  const pinMat = new THREE.MeshStandardMaterial({
    color: 0x6366f1, roughness: 0.4, metalness: 0.6,
    emissive: 0x312e81, emissiveIntensity: 0.3,
  });
  const windmillMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, roughness: 0.5, metalness: 0.3,
    emissive: 0x78350f, emissiveIntensity: 0.2,
  });
  const finishMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e, roughness: 0.3, metalness: 0.5,
    emissive: 0x14532d, emissiveIntensity: 0.6, transparent: true, opacity: 0.4,
  });

  // ── 좌우 벽 ────────────────────────────────────────────
  const wallH = TRACK_TOP_Y - TRACK_BOTTOM_Y;
  const wallY = (TRACK_TOP_Y + TRACK_BOTTOM_Y) / 2;
  const wallX = TRACK_WIDTH / 2;
  const wallThickness = 0.5;

  function addWall(x, w, h, d, y = wallY) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    mesh.position.set(x, y, 0);
    scene.add(mesh);
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, 0));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(w/2, h/2, d/2).setRestitution(0.3).setFriction(0.4), rb
    );
  }
  // 좌우 벽 (x = ±6) — mesh + collider
  addWall(-wallX, wallThickness, wallH, TRACK_DEPTH + 1);
  addWall( wallX, wallThickness, wallH, TRACK_DEPTH + 1);
  // 앞뒤 z 벽은 카메라 시야 차단이라 mesh 안 그림, collider 만.
  // 뒷벽 (z = +TRACK_DEPTH/2)
  {
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, wallY, TRACK_DEPTH/2));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(TRACK_WIDTH/2, wallH/2, 0.1).setRestitution(0.3).setFriction(0.4), rb
    );
  }
  // 앞벽 (z = -0.8) — collider만, mesh 안 그림 (카메라 시야)
  {
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, wallY, -TRACK_DEPTH/2));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(TRACK_WIDTH/2, wallH/2, 0.1).setRestitution(0.3).setFriction(0.4), rb
    );
  }

  // ── 핀(원기둥) — 격자 ────────────────────────────────
  const pinRadius = 0.25;
  const pinHeight = TRACK_DEPTH;
  const pinGeom = new THREE.CylinderGeometry(pinRadius, pinRadius, pinHeight, 12);
  // 풍차 영역(y ≈ 0) + 결승 직전 영역은 비워둠. cols 좀 적게 — 구슬이 끼이지 않게.
  const pinZones = [
    { yMin: 20, yMax: 27, rows: 3, cols: 5, offset: true },
    { yMin: 8, yMax: 15, rows: 3, cols: 5, offset: false },
    { yMin: -8, yMax: -3, rows: 2, cols: 5, offset: true },
    { yMin: -22, yMax: -14, rows: 3, cols: 5, offset: false },
  ];
  for (const zone of pinZones) {
    const stepY = (zone.yMax - zone.yMin) / zone.rows;
    const usableW = TRACK_WIDTH - 2;
    for (let r = 0; r < zone.rows; r++) {
      const y = zone.yMin + stepY * (r + 0.5);
      const stagger = (zone.offset && r % 2 === 1) ? (usableW / zone.cols / 2) : 0;
      for (let c = 0; c < zone.cols; c++) {
        const x = -usableW/2 + (usableW / (zone.cols - 1)) * c + stagger;
        if (Math.abs(x) > TRACK_WIDTH/2 - 0.3) continue;
        // mesh — Z 축 회전해서 가로로 누움
        const mesh = new THREE.Mesh(pinGeom, pinMat);
        mesh.position.set(x, y, 0);
        mesh.rotation.x = Math.PI / 2;
        scene.add(mesh);
        // collider
        const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, 0));
        world.createCollider(
          RAPIER.ColliderDesc.cylinder(pinHeight/2, pinRadius)
            .setRotation({ x: Math.sin(Math.PI/4), y: 0, z: 0, w: Math.cos(Math.PI/4) })
            .setRestitution(0.5).setFriction(0.3),
          rb
        );
      }
    }
  }

  // ── 출발 게이트 (트랙 최상단) ────────────────────────
  // 시작 전엔 구슬을 떠받침. start() 호출 시 옆으로 슬라이드 + collider 비활성.
  const gate = createGate({ scene, world, RAPIER, y: TRACK_TOP_Y - 1.5 });

  // ── 회전 풍차 (y ≈ 0) ────────────────────────────────
  const windmill = createWindmill({ scene, world, RAPIER, y: 0, mat: windmillMat });

  // ── 결승선 (sensor) ──────────────────────────────────
  const finishGeom = new THREE.BoxGeometry(TRACK_WIDTH - 1, 0.3, TRACK_DEPTH);
  const finishMesh = new THREE.Mesh(finishGeom, finishMat);
  finishMesh.position.set(0, FINISH_Y, 0);
  scene.add(finishMesh);
  // 결승선 발광 효과
  const finishGlow = new THREE.PointLight(0x22c55e, 2, 8);
  finishGlow.position.set(0, FINISH_Y, 0);
  scene.add(finishGlow);
  // sensor — 통과 시 이벤트
  const finishRb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, FINISH_Y, 0));
  const finishCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid((TRACK_WIDTH-1)/2, 0.15, TRACK_DEPTH/2)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    finishRb
  );

  // ── 바닥 (결승선 아래) — 구슬 멈춤 ────────────────────
  {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH, 1, TRACK_DEPTH + 2), wallMat);
    mesh.position.set(0, TRACK_BOTTOM_Y - 0.5, 0);
    scene.add(mesh);
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, TRACK_BOTTOM_Y - 0.5, 0));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(TRACK_WIDTH/2, 0.5, (TRACK_DEPTH + 2)/2)
        .setRestitution(0.1).setFriction(0.8),
      rb
    );
  }

  return {
    windmill,
    gate,
    finishColliderHandle: finishCollider.handle,
    // 매 프레임 tick 호출용
    tick(dt) {
      windmill.tick(dt);
      gate.tick(dt);
    },
  };
}

// 출발 게이트 — 시작 전 구슬을 떠받침. open() 시 옆으로 슬라이드 + 비활성.
function createGate({ scene, world, RAPIER, y }) {
  const gateGeom = new THREE.BoxGeometry(TRACK_WIDTH - 0.6, 0.4, TRACK_DEPTH);
  const gateMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e, roughness: 0.4, metalness: 0.4,
    emissive: 0x9f1239, emissiveIntensity: 0.4,
  });
  const mesh = new THREE.Mesh(gateGeom, gateMat);
  mesh.position.set(0, y, 0);
  scene.add(mesh);

  // KinematicPositionBased — 이동 가능. 처음엔 트랙 정중앙.
  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, y, 0)
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cuboid((TRACK_WIDTH - 0.6)/2, 0.2, TRACK_DEPTH/2)
      .setRestitution(0.1).setFriction(0.8),
    rb
  );

  let opening = false;
  let slideX = 0;
  const TARGET_SLIDE = TRACK_WIDTH + 2;  // 트랙 옆으로 완전히 빠짐
  const SLIDE_SPEED = 18;                // m/sec

  return {
    mesh,
    open() {
      if (opening) return;
      opening = true;
      collider.setEnabled(false);  // 즉시 충돌 비활성
    },
    reset() {
      opening = false;
      slideX = 0;
      mesh.visible = true;
      mesh.position.set(0, y, 0);
      rb.setNextKinematicTranslation({ x: 0, y, z: 0 });
      collider.setEnabled(true);
    },
    tick(dt) {
      if (!opening) return;
      if (slideX >= TARGET_SLIDE) return;
      slideX = Math.min(TARGET_SLIDE, slideX + SLIDE_SPEED * dt);
      mesh.position.x = slideX;
      rb.setNextKinematicTranslation({ x: slideX, y, z: 0 });
      // 끝까지 슬라이드되면 mesh 숨김
      if (slideX >= TARGET_SLIDE) mesh.visible = false;
    },
  };
}

// 회전 풍차 — KinematicPositionBased + Y 축 회전
function createWindmill({ scene, world, RAPIER, y, mat }) {
  const group = new THREE.Group();
  group.position.y = y;
  scene.add(group);

  const bladeLength = 5.2;
  const bladeThickness = 0.4;
  const bladeDepth = 1.2;
  const bladeGeom = new THREE.BoxGeometry(bladeLength, bladeThickness, bladeDepth);
  // 4개 날개 (90도 간격)
  const bladeMeshes = [];
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(bladeGeom, mat);
    mesh.rotation.z = (Math.PI / 2) * i;
    group.add(mesh);
    bladeMeshes.push(mesh);
  }
  // 중심 hub
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, bladeDepth + 0.2, 16),
    new THREE.MeshStandardMaterial({ color: 0x78350f, metalness: 0.7, roughness: 0.3 })
  );
  hub.rotation.x = Math.PI / 2;
  group.add(hub);

  // Rapier — 한 KinematicPositionBased rigid body, 4 cuboid collider
  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, y, 0)
  );
  // 각 날개를 cuboid collider 로 — 회전은 rigid body 통째로
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI / 2) * i;
    const cx = (bladeLength / 2) * Math.cos(angle);
    const cy = (bladeLength / 2) * Math.sin(angle);
    // 회전 quaternion (Z 축 회전)
    const half = angle / 2;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(bladeLength/2, bladeThickness/2, bladeDepth/2)
        .setTranslation(cx, cy, 0)
        .setRotation({ x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) })
        .setRestitution(0.5).setFriction(0.3),
      rb
    );
  }

  const angularSpeed = 0.5; // rad/sec — 너무 빠르면 구슬을 위로 차내서 통과 불가
  let angle = 0;

  return {
    tick(dt) {
      angle += angularSpeed * dt;
      // Three group 회전
      group.rotation.z = angle;
      // Rapier — kinematic position + rotation. setNextKinematicRotation.
      const half = angle / 2;
      rb.setNextKinematicRotation({ x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) });
    },
  };
}
