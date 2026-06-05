// 3D 수직 트랙 — 핀볼 스타일 다이나믹 코스
// 구간: 출발 게이트 → 범퍼 → 핀 → 풍차 → 점핑패드 → 회전디스크 → 시소 → 핀 → 결승선
// 색 zoning, pulse, 글로우, 다양한 collision 효과로 시각/물리 다이나믹

import * as THREE from 'three';

const TRACK_WIDTH = 14;
const TRACK_DEPTH = 1.8;
const TRACK_TOP_Y = 30;
const TRACK_BOTTOM_Y = -32;
const FINISH_Y = -30;

export const TRACK = {
  width: TRACK_WIDTH,
  depth: TRACK_DEPTH,
  topY: TRACK_TOP_Y,
  bottomY: TRACK_BOTTOM_Y,
  finishY: FINISH_Y,
};

export function buildTrack({ scene, world, RAPIER }) {
  // ── 머티리얼 팔레트 ──────────────────────────────────────
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x171a2b, roughness: 0.55, metalness: 0.4,
  });
  const pinMatPurple = new THREE.MeshStandardMaterial({
    color: 0x8b5cf6, roughness: 0.3, metalness: 0.7,
    emissive: 0x6366f1, emissiveIntensity: 0.9,
  });
  const pinMatCyan = new THREE.MeshStandardMaterial({
    color: 0x06b6d4, roughness: 0.3, metalness: 0.7,
    emissive: 0x0891b2, emissiveIntensity: 0.9,
  });
  const pinMatPink = new THREE.MeshStandardMaterial({
    color: 0xec4899, roughness: 0.3, metalness: 0.7,
    emissive: 0xbe185d, emissiveIntensity: 0.9,
  });
  const bumperMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e, roughness: 0.25, metalness: 0.6,
    emissive: 0xfb7185, emissiveIntensity: 1.2,
  });
  const jumpPadMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24, roughness: 0.3, metalness: 0.5,
    emissive: 0xf59e0b, emissiveIntensity: 0.9,
  });
  const diskMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee, roughness: 0.35, metalness: 0.65,
    emissive: 0x0891b2, emissiveIntensity: 0.6,
  });
  const seesawMat = new THREE.MeshStandardMaterial({
    color: 0x10b981, roughness: 0.4, metalness: 0.5,
    emissive: 0x047857, emissiveIntensity: 0.5,
  });
  const windmillMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24, roughness: 0.4, metalness: 0.5,
    emissive: 0xf59e0b, emissiveIntensity: 0.7,
  });
  const finishLineMat = new THREE.MeshBasicMaterial({ color: 0x86efac });

  // ── 좌우 / 앞뒤 벽 ────────────────────────────────────────
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
      RAPIER.ColliderDesc.cuboid(w/2, h/2, d/2).setRestitution(0.3).setFriction(0.35), rb
    );
  }
  addWall(-wallX, wallThickness, wallH, TRACK_DEPTH + 1);
  addWall( wallX, wallThickness, wallH, TRACK_DEPTH + 1);
  // 앞뒤 z 벽 (mesh 안 그림 — 카메라 시야)
  for (const zSign of [1, -1]) {
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, wallY, zSign * TRACK_DEPTH/2));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(TRACK_WIDTH/2, wallH/2, 0.1).setRestitution(0.3).setFriction(0.35), rb
    );
  }

  // ── 트랙 사이드 글로우 라인 (시각 강조) ─────────────────────
  const sideLineMat = new THREE.MeshBasicMaterial({ color: 0x6366f1 });
  for (const xSign of [-1, 1]) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, wallH - 2, 0.08),
      sideLineMat
    );
    line.position.set(xSign * (wallX - 0.3), wallY, TRACK_DEPTH/2 - 0.05);
    scene.add(line);
  }

  // ── 핀 격자 (3 zone, 색 다르게) ─────────────────────────────
  const pinRadius = 0.32;
  const pinHeight = TRACK_DEPTH;
  const pinGeom = new THREE.CylinderGeometry(pinRadius, pinRadius, pinHeight, 14);

  const pinZones = [
    { yMin: 22, yMax: 27, rows: 2, cols: 5, offset: true,  mat: pinMatPurple },
    { yMin: 5,  yMax: 10, rows: 2, cols: 5, offset: false, mat: pinMatCyan },
    { yMin: -13, yMax: -10, rows: 1, cols: 5, offset: true, mat: pinMatPink }, // 시소 위 1줄
  ];
  for (const zone of pinZones) {
    const stepY = (zone.yMax - zone.yMin) / zone.rows;
    const usableW = TRACK_WIDTH - 2;
    for (let r = 0; r < zone.rows; r++) {
      const y = zone.yMin + stepY * (r + 0.5);
      const stagger = (zone.offset && r % 2 === 1) ? (usableW / zone.cols / 2) : 0;
      for (let c = 0; c < zone.cols; c++) {
        const x = -usableW/2 + (usableW / (zone.cols - 1)) * c + stagger;
        if (Math.abs(x) > TRACK_WIDTH/2 - 0.4) continue;
        const mesh = new THREE.Mesh(pinGeom, zone.mat);
        mesh.position.set(x, y, 0);
        mesh.rotation.x = Math.PI / 2;
        scene.add(mesh);
        const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, 0));
        world.createCollider(
          RAPIER.ColliderDesc.cylinder(pinHeight/2, pinRadius)
            .setRotation({ x: Math.sin(Math.PI/4), y: 0, z: 0, w: Math.cos(Math.PI/4) })
            .setRestitution(0.55).setFriction(0.25),
          rb
        );
      }
    }
  }

  // ── 게이트 + 풍차 ────────────────────────────────────────
  const gate = createGate({ scene, world, RAPIER, y: TRACK_TOP_Y - 1.5 });
  const windmill = createWindmill({ scene, world, RAPIER, y: 17, mat: windmillMat });
  // 풍차 #2 (y=-23) 제거 — funnel 자리 양보. 결승 직전 박진감.

  // ── 깔때기 (Funnel) — 결승선 직전 V자 좁아지는 가이드 ─────
  // 위쪽 폭 TRACK_WIDTH 전체, 아래쪽 폭 3 (출구). 구슬 자기들끼리 부딪치며 순위 변동.
  buildFunnel({ scene, world, RAPIER, yTop: -20, yBottom: -28, exitWidth: 3, mat: wallMat });

  // ── 핀볼 범퍼 — y=14 좌우 ─────────────────────────────────
  const bumpers = [
    createBumper({ scene, world, RAPIER, x: -3.5, y: 14, mat: bumperMat }),
    createBumper({ scene, world, RAPIER, x:  3.5, y: 14, mat: bumperMat }),
    createBumper({ scene, world, RAPIER, x:  0,   y: -4, mat: bumperMat }),
  ];

  // ── 점핑 패드 — y=-7 가운데 ──────────────────────────────────
  const jumpPad = createJumpPad({ scene, world, RAPIER, x: 0, y: 1, mat: jumpPadMat });

  // ── 회전 막대 (스피너) — y=-7 좌우, 반대 방향 ─────────────
  const spinner1 = createSpinner({ scene, world, RAPIER, x: -3.5, y: -7, mat: diskMat, dir: 1 });
  const spinner2 = createSpinner({ scene, world, RAPIER, x:  3.5, y: -7, mat: diskMat, dir: -1 });

  // ── 시소 (좌우 진자) — y=-15 (funnel 보다 위) ────────────
  const seesaw = createSeesaw({ scene, world, RAPIER, y: -16, mat: seesawMat });

  // ── 결승선 (sensor — mesh 없음, 라인만) ──────────────────────
  const finishGlow = new THREE.PointLight(0x22c55e, 12, 20);
  finishGlow.position.set(0, FINISH_Y, 0);
  scene.add(finishGlow);
  for (const dy of [-0.4, 0.4]) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(TRACK_WIDTH - 0.4, 0.12, TRACK_DEPTH + 0.2),
      finishLineMat
    );
    line.position.set(0, FINISH_Y + dy, 0);
    scene.add(line);
  }
  const finishRb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, FINISH_Y, 0));
  const finishCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid((TRACK_WIDTH-1)/2, 0.2, TRACK_DEPTH/2)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    finishRb
  );
  let pulsePhase = 0;
  const pulseTick = (dt) => {
    pulsePhase += dt * 2.5;
    finishGlow.intensity = 8 + (0.5 + Math.sin(pulsePhase) * 0.5) * 10;
  };

  // ── 바닥 ─────────────────────────────────────────────────
  {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(TRACK_WIDTH, 1, TRACK_DEPTH + 2),
      wallMat
    );
    mesh.position.set(0, TRACK_BOTTOM_Y - 0.5, 0);
    scene.add(mesh);
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, TRACK_BOTTOM_Y - 0.5, 0));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(TRACK_WIDTH/2, 0.5, (TRACK_DEPTH + 2)/2)
        .setRestitution(0.1).setFriction(0.85),
      rb
    );
  }

  // ── handle 모음 — 범퍼/점핑패드 collision event 처리용 ─────
  const bumperHandles = new Set(bumpers.map(b => b.colliderHandle));
  const jumpPadHandles = new Set([jumpPad.colliderHandle]);

  return {
    windmill, gate,
    finishColliderHandle: finishCollider.handle,
    bumperHandles, jumpPadHandles, bumpers, jumpPad,
    tick(dt) {
      windmill.tick(dt);
      gate.tick(dt);
      spinner1.tick(dt);
      spinner2.tick(dt);
      seesaw.tick(dt);
      for (const b of bumpers) b.tick(dt);
      jumpPad.tick(dt);
      pulseTick(dt);
    },
  };
}

// ─────────────────────────────────────────────────────────────
// 출발 게이트
// ─────────────────────────────────────────────────────────────
function createGate({ scene, world, RAPIER, y }) {
  const gateGeom = new THREE.BoxGeometry(TRACK_WIDTH - 0.6, 0.4, TRACK_DEPTH);
  const gateMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e, roughness: 0.4, metalness: 0.4,
    emissive: 0x9f1239, emissiveIntensity: 0.5,
  });
  const mesh = new THREE.Mesh(gateGeom, gateMat);
  mesh.position.set(0, y, 0);
  scene.add(mesh);
  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, y, 0)
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cuboid((TRACK_WIDTH - 0.6)/2, 0.2, TRACK_DEPTH/2)
      .setRestitution(0.1).setFriction(0.8),
    rb
  );
  let opening = false, slideX = 0;
  const TARGET = TRACK_WIDTH + 2, SPEED = 20;
  return {
    mesh,
    open() {
      if (opening) return;
      opening = true;
      collider.setEnabled(false);
    },
    reset() {
      opening = false; slideX = 0;
      mesh.visible = true;
      mesh.position.set(0, y, 0);
      rb.setNextKinematicTranslation({ x: 0, y, z: 0 });
      collider.setEnabled(true);
    },
    tick(dt) {
      if (!opening || slideX >= TARGET) return;
      slideX = Math.min(TARGET, slideX + SPEED * dt);
      mesh.position.x = slideX;
      rb.setNextKinematicTranslation({ x: slideX, y, z: 0 });
      if (slideX >= TARGET) mesh.visible = false;
    },
  };
}

// ─────────────────────────────────────────────────────────────
// 회전 풍차 (4 blade)
// ─────────────────────────────────────────────────────────────
function createWindmill({ scene, world, RAPIER, y, mat, reverse = false }) {
  const group = new THREE.Group();
  group.position.y = y;
  scene.add(group);
  const bladeLength = 5.0, bladeThickness = 0.4, bladeDepth = 1.0;
  const bladeGeom = new THREE.BoxGeometry(bladeLength, bladeThickness, bladeDepth);
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(bladeGeom, mat);
    mesh.rotation.z = (Math.PI / 2) * i;
    group.add(mesh);
  }
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, bladeDepth + 0.2, 16),
    new THREE.MeshStandardMaterial({ color: 0x78350f, metalness: 0.7, roughness: 0.3 })
  );
  hub.rotation.x = Math.PI / 2;
  group.add(hub);

  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, y, 0)
  );
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI / 2) * i;
    const cx = (bladeLength / 2) * Math.cos(angle);
    const cy = (bladeLength / 2) * Math.sin(angle);
    const half = angle / 2;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(bladeLength/2, bladeThickness/2, bladeDepth/2)
        .setTranslation(cx, cy, 0)
        .setRotation({ x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) })
        .setRestitution(0.55).setFriction(0.25),
      rb
    );
  }
  const angularSpeed = reverse ? -0.75 : 0.75;
  let angle = 0;
  return {
    tick(dt) {
      angle += angularSpeed * dt;
      group.rotation.z = angle;
      const half = angle / 2;
      rb.setNextKinematicRotation({ x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) });
    },
  };
}

// ─────────────────────────────────────────────────────────────
// 범퍼 (Bumper) — 닿으면 외향 임펄스 + 색 펄스
// ─────────────────────────────────────────────────────────────
function createBumper({ scene, world, RAPIER, x, y, mat }) {
  const radius = 0.7;
  const group = new THREE.Group();
  group.position.set(x, y, 0);
  scene.add(group);
  // 디스크 (실린더)
  const baseGeom = new THREE.CylinderGeometry(radius, radius, TRACK_DEPTH * 0.7, 24);
  const base = new THREE.Mesh(baseGeom, mat);
  base.rotation.x = Math.PI / 2;
  group.add(base);
  // 위 글로우 링
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xfecaca, transparent: true });
  const ringGeom = new THREE.TorusGeometry(radius * 0.92, 0.08, 8, 24);
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.position.z = TRACK_DEPTH * 0.36;
  group.add(ring);
  // PointLight (살짝)
  const light = new THREE.PointLight(0xf43f5e, 1.5, 6);
  group.add(light);

  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, 0)
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cylinder(TRACK_DEPTH * 0.35, radius)
      .setRotation({ x: Math.sin(Math.PI/4), y: 0, z: 0, w: Math.cos(Math.PI/4) })
      .setRestitution(0.95).setFriction(0.1)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    rb
  );

  // 충돌 시 펄스 트리거용 상태
  let pulse = 0;
  return {
    colliderHandle: collider.handle,
    x, y, radius,
    bump() {
      pulse = 1.0;  // 시각 펄스 트리거
      light.intensity = 6;
    },
    tick(dt) {
      // 시각 펄스 감쇠
      if (pulse > 0) {
        pulse = Math.max(0, pulse - dt * 4);
        const s = 1.0 + pulse * 0.35;
        group.scale.set(s, s, s);
        ring.material.opacity = pulse;
        light.intensity = 1.5 + pulse * 5;
        mat.emissiveIntensity = 1.2 + pulse * 1.5;
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────
// 점핑 패드 — 닿으면 위로 임펄스
// ─────────────────────────────────────────────────────────────
function createJumpPad({ scene, world, RAPIER, x, y, mat }) {
  const w = 2.4, h = 0.4, d = TRACK_DEPTH * 0.85;
  const group = new THREE.Group();
  group.position.set(x, y, 0);
  scene.add(group);
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  group.add(base);
  // 점 라인 (시각)
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xfef3c7 });
  const line = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.06, d + 0.1), lineMat);
  line.position.y = h/2 + 0.04;
  group.add(line);
  const light = new THREE.PointLight(0xfbbf24, 1, 5);
  light.position.y = 0.5;
  group.add(light);

  const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, 0));
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(w/2, h/2, d/2)
      .setRestitution(0.2).setFriction(0.3)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    rb
  );

  let pulse = 0;
  return {
    colliderHandle: collider.handle,
    bump() {
      pulse = 1.0;
      light.intensity = 5;
    },
    tick(dt) {
      if (pulse > 0) {
        pulse = Math.max(0, pulse - dt * 3);
        // 압축 → 복원 애니메이션
        const sy = 1.0 - pulse * 0.5;
        group.scale.y = sy;
        light.intensity = 1 + pulse * 4;
        mat.emissiveIntensity = 0.9 + pulse * 1.0;
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────
// 깔때기 (Funnel) — 좌우 비스듬한 벽 두 개로 V자 좁아지는 가이드.
// 결승선 직전 구슬을 좁은 통로로 모음 → 박진감 + 순위 변동.
// ─────────────────────────────────────────────────────────────
function buildFunnel({ scene, world, RAPIER, yTop, yBottom, exitWidth, mat }) {
  const halfTop = (TRACK_WIDTH - 0.6) / 2;   // 위쪽 끝 (벽 안쪽)
  const halfBot = exitWidth / 2;              // 아래쪽 끝 (출구 절반)
  const dy = yTop - yBottom;
  const dx = halfTop - halfBot;
  const length = Math.hypot(dx, dy);          // 사선 길이
  const angle = Math.atan2(dx, dy);           // 수직 대비 각도 — 좌측 벽 기울기 (양수 → 안쪽으로 기울)
  const thickness = 0.4;
  const depth = TRACK_DEPTH;

  // 시각 강조 — 결승 분위기 (살짝 emissive)
  const funnelMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b, roughness: 0.5, metalness: 0.5,
    emissive: 0x10b981, emissiveIntensity: 0.18,
  });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });

  function addSlope(sign) {
    // 중심 좌표 — 위·아래 끝의 중점
    const cx = sign * (halfTop + halfBot) / 2;
    const cy = (yTop + yBottom) / 2;
    const rotZ = sign * (-angle);  // 좌측(sign=-1)은 안쪽으로 기우, 우측(sign=+1)도 마찬가지

    // Three mesh
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, length, depth), funnelMat);
    mesh.position.set(cx, cy, 0);
    mesh.rotation.z = rotZ;
    scene.add(mesh);
    // 시각 강조 — 안쪽 면의 빛나는 라인 (얇은 mesh)
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, length, 0.06),
      edgeMat
    );
    edge.position.set(cx - sign * (thickness/2 + 0.05), cy, depth/2 - 0.05);
    edge.rotation.z = rotZ;
    scene.add(edge);

    // Rapier collider
    const rb = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, 0)
    );
    const half = rotZ / 2;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(thickness/2, length/2, depth/2)
        .setRotation({ x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) })
        .setRestitution(0.55).setFriction(0.18),
      rb
    );
  }
  addSlope(-1);   // 좌측 벽 \
  addSlope(+1);   // 우측 벽 /
}

// ─────────────────────────────────────────────────────────────
// 스피너 — 가는 회전 막대 (풍차의 1개 날개 같음). 구슬 통과 가능, 부딪치면 튕김.
// ─────────────────────────────────────────────────────────────
function createSpinner({ scene, world, RAPIER, x, y, mat, dir }) {
  const length = 2.6, thickness = 0.32, depth = TRACK_DEPTH * 0.7;
  const group = new THREE.Group();
  group.position.set(x, y, 0);
  scene.add(group);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(length, thickness, depth), mat);
  group.add(bar);
  // 중심 hub (작은 sphere)
  const hub = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x0e7490, metalness: 0.7, roughness: 0.3 })
  );
  group.add(hub);

  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, 0)
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(length/2, thickness/2, depth/2)
      .setRestitution(0.55).setFriction(0.15),
    rb
  );

  const angularSpeed = 2.4 * dir;
  let angle = 0;
  return {
    tick(dt) {
      angle += angularSpeed * dt;
      group.rotation.z = angle;
      const half = angle / 2;
      rb.setNextKinematicRotation({ x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) });
    },
  };
}

// ─────────────────────────────────────────────────────────────
// 시소 — 가로 막대가 sin 진자
// ─────────────────────────────────────────────────────────────
function createSeesaw({ scene, world, RAPIER, y, mat }) {
  const len = 8, thickness = 0.4, depth = TRACK_DEPTH * 0.85;
  const group = new THREE.Group();
  group.position.set(0, y, 0);
  scene.add(group);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(len, thickness, depth), mat);
  group.add(bar);
  // 중심 hub
  const hub = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x065f46, metalness: 0.7, roughness: 0.3 })
  );
  group.add(hub);

  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, y, 0)
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(len/2, thickness/2, depth/2)
      .setRestitution(0.5).setFriction(0.3),
    rb
  );

  let phase = 0;
  const speed = 1.6;       // rad/sec
  const amplitude = 0.55;  // 약 ±32도
  return {
    tick(dt) {
      phase += speed * dt;
      const a = Math.sin(phase) * amplitude;
      group.rotation.z = a;
      const half = a / 2;
      rb.setNextKinematicRotation({ x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) });
    },
  };
}
