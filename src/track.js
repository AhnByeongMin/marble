// 트랙 — 모드별로 다른 구조 (vertical: 클래식 핀볼 / race: 수평 레이스)

import * as THREE from 'three';

const TRACK_WIDTH = 14;
const TRACK_DEPTH = 1.8;
const TRACK_TOP_Y = 30;
const TRACK_BOTTOM_Y = -32;
const FINISH_Y = -30;

// 레이스 트랙 dims
const RACE_LEN = 60;        // 가로 길이 (X)
const RACE_HEIGHT = 14;     // 세로 높이 (Y) - 트랙 굴곡 폭
const RACE_DEPTH = 1.8;     // 깊이 (Z)
const RACE_START_X = -28;
const RACE_FINISH_X = 28;

// trackType 별 spec 노출 (main.js spawn 위치/카메라 가이드용)
export const TRACK_SPECS = {
  vertical: {
    type: 'vertical',
    width: TRACK_WIDTH, depth: TRACK_DEPTH,
    topY: TRACK_TOP_Y, bottomY: TRACK_BOTTOM_Y, finishY: FINISH_Y,
    spawn: { x: 0, y: TRACK_TOP_Y - 0.4, axis: 'x', spread: 6 },
  },
  race: {
    type: 'race',
    length: RACE_LEN, height: RACE_HEIGHT, depth: RACE_DEPTH,
    startX: RACE_START_X, finishX: RACE_FINISH_X,
    spawn: { x: RACE_START_X + 2, y: 4, axis: 'z', spread: 1.0 },
  },
};

// 기존 코드 호환 (vertical 기본값)
export const TRACK = TRACK_SPECS.vertical;

// 모드별 트랙 빌더 디스패치
export function buildTrack({ scene, world, RAPIER, trackType = 'vertical' }) {
  if (trackType === 'race') return buildRaceTrack({ scene, world, RAPIER });
  return buildVerticalTrack({ scene, world, RAPIER });
}

function buildVerticalTrack({ scene, world, RAPIER }) {
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

  // ── 사이드 데플렉터 — 좌우 대칭 페어 (형평성) ───────────
  // 이전 좌·우 지그재그는 시작 위치 따라 만나는 장애물이 달라 trajectory 비대칭.
  // 같은 y 에 좌·우 페어로 → 트랙 좌우 대칭 → 시작 x 위치 영향 ↓ (2026-06-05 fix).
  const deflectorMat = new THREE.MeshStandardMaterial({
    color: 0x312e81, roughness: 0.5, metalness: 0.5,
    emissive: 0x6366f1, emissiveIntensity: 0.4,
  });
  const deflectorYs = [19, 13, 4, -2, -8];   // 좌우 페어로 각 y 에 배치
  for (const y of deflectorYs) {
    for (const side of [-1, +1]) {
      buildDeflector({
        scene, world, RAPIER, mat: deflectorMat,
        side, y,
        length: 2.6, thickness: 0.35,
        angleRad: 0.5,
        wallX: wallX,
      });
    }
  }

  // ── 핀 격자 — 끼임 방지 위해 모두 stagger, 안쪽 polygon ─────
  // 설계 원칙:
  //   1) pinHeight < TRACK_DEPTH (z 벽에 박히지 않게)
  //   2) 가장 바깥 핀 x 안쪽 (벽 collider 안 침범)
  //   3) 모든 zone offset=true — 두 row 정렬 시 좁은 통로 발생 방지
  //   4) 핀 격자 간격 충분히 (구슬 지름 0.76 × 3 이상)
  const pinRadius = 0.3;
  const pinHeight = TRACK_DEPTH - 0.4;          // 벽 z 안 박힘 (트랙 1.8 → 핀 1.4)
  const pinUsableW = TRACK_WIDTH - 4;           // 벽-핀 간격 1.5 (구슬 통과 여유)
  const pinGeom = new THREE.CylinderGeometry(pinRadius, pinRadius, pinHeight, 14);

  const pinZones = [
    { yMin: 22, yMax: 26, rows: 2, cols: 4, mat: pinMatPurple },
    { yMin: 6,  yMax: 10, rows: 2, cols: 4, mat: pinMatCyan   },
    { yMin: -12, yMax: -10, rows: 1, cols: 4, mat: pinMatPink },
  ];
  for (const zone of pinZones) {
    const stepY = (zone.yMax - zone.yMin) / Math.max(1, zone.rows);
    for (let r = 0; r < zone.rows; r++) {
      const y = zone.yMin + stepY * (r + 0.5);
      // 모든 row stagger — r%2==1 만 좌우로 시프트 (cols 사이의 절반)
      const stagger = (r % 2 === 1) ? (pinUsableW / zone.cols / 2) : 0;
      const cols = zone.cols;
      for (let c = 0; c < cols; c++) {
        const x = -pinUsableW/2 + (pinUsableW / (cols - 1)) * c + stagger;
        if (Math.abs(x) > pinUsableW/2 + 0.1) continue;
        const mesh = new THREE.Mesh(pinGeom, zone.mat);
        mesh.position.set(x, y, 0);
        mesh.rotation.x = Math.PI / 2;
        scene.add(mesh);
        const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, 0));
        world.createCollider(
          RAPIER.ColliderDesc.cylinder(pinHeight/2, pinRadius)
            .setRotation({ x: Math.sin(Math.PI/4), y: 0, z: 0, w: Math.cos(Math.PI/4) })
            .setRestitution(0.55).setFriction(0.2),
          rb
        );
      }
    }
  }

  // ── 게이트 + 풍차 ────────────────────────────────────────
  const gate = createGate({ scene, world, RAPIER, y: TRACK_TOP_Y - 1.5 });
  // 풍차/스피너 속도는 외부에서 setSpeed() 로 동적 조정 (모드 변경 시)
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
  // sensor 폭은 funnel 출구 + 여유 만큼만 — funnel 안 지나는 구슬은 결승 인정 X (프리패스 차단)
  const finishRb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, FINISH_Y, 0));
  const FINISH_SENSOR_HALF_W = 2.5;  // exitWidth(3)/2 + 여유 1
  const finishCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(FINISH_SENSOR_HALF_W, 0.2, TRACK_DEPTH/2)
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
    // 모드 변경 시 풍차/스피너 속도 + 범퍼 반발 동적 적용
    applyMode(mode) {
      windmill.setSpeed(mode.windmillSpeed);
      spinner1.setSpeed(mode.spinnerSpeed);
      spinner2.setSpeed(mode.spinnerSpeed);
    },
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
// 🏁 레이스 트랙 — 수평 좌→우 코스
// 구슬이 X+ 방향으로 굴러 결승선까지. gravity (X+3, Y-10) — X 방향 자연 추진.
// 장애물: 범퍼 / 점프대 / 회전 톱니 / 사선 deflector / 트랙 바닥 굴곡
// ─────────────────────────────────────────────────────────────
function buildRaceTrack({ scene, world, RAPIER }) {
  const L = RACE_LEN, H = RACE_HEIGHT, D = RACE_DEPTH;
  const startX = RACE_START_X, finishX = RACE_FINISH_X;
  const floorY = -6;
  const ceilY = floorY + H;

  // ── 머티리얼 ──────────────────────────────────────────────
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x171a2b, roughness: 0.55, metalness: 0.4,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b, roughness: 0.7, metalness: 0.3,
    emissive: 0x0c4a6e, emissiveIntensity: 0.15,
  });
  const bumperMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e, roughness: 0.25, metalness: 0.6,
    emissive: 0xfb7185, emissiveIntensity: 1.2,
  });
  const jumpPadMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24, roughness: 0.3, metalness: 0.5,
    emissive: 0xf59e0b, emissiveIntensity: 0.9,
  });
  const sawMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4, roughness: 0.3, metalness: 0.7,
    emissive: 0x0891b2, emissiveIntensity: 0.7,
  });
  const finishLineMat = new THREE.MeshBasicMaterial({ color: 0x86efac });

  // ── 바닥 + 천장 + 앞뒤 z 벽 ──────────────────────────────
  // 바닥 — 살짝 굴곡 X+ 방향 약하게 경사 (Y 감소)
  function addFloor(cx, cy, len, h = 0.6) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, h, D), floorMat);
    mesh.position.set(cx, cy, 0);
    scene.add(mesh);
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, 0));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(len/2, h/2, D/2)
        .setRestitution(0.3).setFriction(0.4),
      rb
    );
  }
  // 굴곡 경사 — 5 segment, 미세 sin 패턴
  const seg = 5;
  for (let i = 0; i < seg; i++) {
    const cx = startX - L/2 + (L / seg) * (i + 0.5) + L/2 + startX;  // -28~+28 중심
    // 정확한 위치 계산 — startX 부터 끝까지 등분
    const x = startX + (L / seg) * (i + 0.5);
    const y = floorY - Math.sin(i / seg * Math.PI) * 0.6;  // 가운데 살짝 들어감
    addFloor(x, y, L / seg + 0.5);
  }
  // 천장
  {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(L, 0.5, D + 1), wallMat);
    mesh.position.set(0, ceilY, 0);
    scene.add(mesh);
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, ceilY, 0));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(L/2, 0.25, (D + 1)/2)
        .setRestitution(0.3).setFriction(0.4),
      rb
    );
  }
  // 좌측 출발 벽 (구슬이 X- 방향으로 못 나감)
  {
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(startX - 1, (floorY + ceilY)/2, 0));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.5, H/2, D/2 + 0.5)
        .setRestitution(0.3).setFriction(0.4),
      rb
    );
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, H, D), wallMat);
    mesh.position.set(startX - 1, (floorY + ceilY)/2, 0);
    scene.add(mesh);
  }
  // 앞뒤 z 벽 (mesh 없음, collider 만)
  for (const zSign of [1, -1]) {
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, (floorY + ceilY)/2, zSign * D/2));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(L/2, H/2, 0.1).setRestitution(0.3).setFriction(0.4), rb
    );
  }

  // ── 출발 게이트 (좌측) ───────────────────────────────────
  const gateY = (floorY + ceilY)/2;
  const gate = createRaceGate({ scene, world, RAPIER, x: startX + 1, y: gateY, h: H - 0.4 });

  // ── 장애물 ─────────────────────────────────────────────
  const bumpers = [];
  // 범퍼 — 트랙 가운데 박힌 형태 (Y 가운데, 다양한 X)
  for (const [bx, by] of [[-15, -4], [-5, -2], [5, -4], [15, -2]]) {
    bumpers.push(createBumperRace({ scene, world, RAPIER, x: bx, y: by, mat: bumperMat }));
  }
  // 점프대 — X 진행 도중 위로 튐
  const jumpPad = createJumpPadRace({ scene, world, RAPIER, x: -10, y: floorY + 0.6, mat: jumpPadMat });
  const jumpPad2 = createJumpPadRace({ scene, world, RAPIER, x: 10, y: floorY + 0.6, mat: jumpPadMat });

  // 회전 톱니 — X 진행 방해 (가운데 큰 톱니)
  const saw1 = createSaw({ scene, world, RAPIER, x: -20, y: 1, mat: sawMat, dir: 1 });
  const saw2 = createSaw({ scene, world, RAPIER, x: 0, y: 1, mat: sawMat, dir: -1 });
  const saw3 = createSaw({ scene, world, RAPIER, x: 20, y: 1, mat: sawMat, dir: 1 });

  // ── 결승선 sensor (우측 끝) ───────────────────────────────
  const finishGlow = new THREE.PointLight(0x22c55e, 12, 18);
  finishGlow.position.set(finishX, gateY, 0);
  scene.add(finishGlow);
  for (const dx of [-0.4, 0.4]) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, H - 0.4, D + 0.2),
      finishLineMat
    );
    line.position.set(finishX + dx, gateY, 0);
    scene.add(line);
  }
  const finishRb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(finishX, gateY, 0));
  const finishCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.4, H/2, D/2)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    finishRb
  );

  let pulsePhase = 0;
  const pulseTick = (dt) => {
    pulsePhase += dt * 2.5;
    finishGlow.intensity = 8 + (0.5 + Math.sin(pulsePhase) * 0.5) * 10;
  };

  const bumperHandles = new Set(bumpers.map(b => b.colliderHandle));
  const jumpPadHandles = new Set([jumpPad.colliderHandle, jumpPad2.colliderHandle]);

  return {
    gate,
    finishColliderHandle: finishCollider.handle,
    bumperHandles, jumpPadHandles, bumpers,
    jumpPad,  // collision handler 가 .bump() 호출
    applyMode(mode) {
      saw1.setSpeed(2.0);
      saw2.setSpeed(2.0);
      saw3.setSpeed(2.0);
    },
    tick(dt) {
      gate.tick(dt);
      saw1.tick(dt);
      saw2.tick(dt);
      saw3.tick(dt);
      for (const b of bumpers) b.tick(dt);
      jumpPad.tick(dt);
      jumpPad2.tick(dt);
      pulseTick(dt);
    },
  };
}

// 레이스용 게이트 — X+ 방향으로 슬라이드 (구슬을 X+ 로 풀어줌)
function createRaceGate({ scene, world, RAPIER, x, y, h }) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, h, RACE_DEPTH),
    new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0x9f1239, emissiveIntensity: 0.5 })
  );
  mesh.position.set(x, y, 0);
  scene.add(mesh);
  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, 0)
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.2, h/2, RACE_DEPTH/2)
      .setRestitution(0.2).setFriction(0.5), rb
  );
  let opening = false, slideY = 0;
  const SPEED = 25;
  return {
    open() { if (!opening) { opening = true; collider.setEnabled(false); } },
    reset() {
      opening = false; slideY = 0;
      mesh.visible = true;
      mesh.position.set(x, y, 0);
      rb.setNextKinematicTranslation({ x, y, z: 0 });
      collider.setEnabled(true);
    },
    tick(dt) {
      if (!opening) return;
      // 게이트가 위로 슬라이드 — 천장 위로 사라짐
      slideY = Math.min(20, slideY + SPEED * dt);
      mesh.position.y = y + slideY;
      rb.setNextKinematicTranslation({ x, y: y + slideY, z: 0 });
      if (slideY >= 20) mesh.visible = false;
    },
  };
}

// 레이스용 범퍼 — 클래식 버전 단순화
function createBumperRace({ scene, world, RAPIER, x, y, mat }) {
  const radius = 0.65;
  const group = new THREE.Group();
  group.position.set(x, y, 0);
  scene.add(group);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, RACE_DEPTH * 0.7, 24), mat
  );
  base.rotation.x = Math.PI / 2;
  group.add(base);
  const light = new THREE.PointLight(0xf43f5e, 1.5, 5);
  group.add(light);
  const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, 0));
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cylinder(RACE_DEPTH * 0.35, radius)
      .setRotation({ x: Math.sin(Math.PI/4), y: 0, z: 0, w: Math.cos(Math.PI/4) })
      .setRestitution(0.95).setFriction(0.1)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    rb
  );
  let pulse = 0;
  return {
    colliderHandle: collider.handle, x, y,
    bump() { pulse = 1.0; light.intensity = 6; },
    tick(dt) {
      if (pulse > 0) {
        pulse = Math.max(0, pulse - dt * 4);
        const s = 1.0 + pulse * 0.35;
        group.scale.set(s, s, s);
        light.intensity = 1.5 + pulse * 5;
        mat.emissiveIntensity = 1.2 + pulse * 1.5;
      }
    },
  };
}

// 레이스용 점프대 — 위로 큰 임펄스
function createJumpPadRace({ scene, world, RAPIER, x, y, mat }) {
  const w = 2.4, h = 0.4, d = RACE_DEPTH * 0.85;
  const group = new THREE.Group();
  group.position.set(x, y, 0);
  scene.add(group);
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  group.add(base);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xfef3c7 });
  const line = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.06, d + 0.1), lineMat);
  line.position.y = h/2 + 0.04;
  group.add(line);
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
    bump() { pulse = 1.0; },
    tick(dt) {
      if (pulse > 0) {
        pulse = Math.max(0, pulse - dt * 3);
        group.scale.y = 1 - pulse * 0.5;
        mat.emissiveIntensity = 0.9 + pulse * 1.0;
      }
    },
  };
}

// 톱니바퀴 (큰 회전 디스크) — 가운데 박힌 형태, 구슬 진행 방해
function createSaw({ scene, world, RAPIER, x, y, mat, dir }) {
  const radius = 2.2, thickness = 0.45;
  const group = new THREE.Group();
  group.position.set(x, y, 0);
  scene.add(group);
  // 톱니 모양 — 8개 짧은 막대 spoke
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 / 8) * i;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 1.6, 0.35, thickness),
      mat
    );
    spoke.rotation.z = a;
    group.add(spoke);
  }
  const hub = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x083344, metalness: 0.8 })
  );
  group.add(hub);
  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, 0)
  );
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 / 8) * i;
    const half = a / 2;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(radius * 0.8, 0.18, thickness/2)
        .setRotation({ x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) })
        .setRestitution(0.6).setFriction(0.15),
      rb
    );
  }
  let angularSpeed = 2.0 * dir;
  let angle = 0;
  return {
    setSpeed(s) { angularSpeed = Math.abs(s) * dir; },
    tick(dt) {
      angle += angularSpeed * dt;
      group.rotation.z = angle;
      const half = angle / 2;
      rb.setNextKinematicRotation({ x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) });
    },
  };
}

// ─────────────────────────────────────────────────────────────
// 출발 게이트 (수직 트랙용)
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
  let angularSpeed = reverse ? -0.75 : 0.75;
  let angle = 0;
  return {
    setSpeed(speed) { angularSpeed = (reverse ? -1 : 1) * Math.abs(speed); },
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
// 데플렉터 — 벽 안쪽에 비스듬한 짧은 panel. 구슬을 안쪽으로 튕김.
// side: -1 좌, +1 우. 좌측 panel 은 ↘ 기울기 (위 끝이 벽쪽), 우측 panel 은 ↙.
// ─────────────────────────────────────────────────────────────
function buildDeflector({ scene, world, RAPIER, mat, side, y, length, thickness, angleRad, wallX }) {
  // 회전 후 panel 의 수평 투영 = length * sin(angle). 그 중심 x:
  // panel 위쪽 끝이 벽 안쪽 (wallX - 0.3) 가까이 오도록 중심 x 계산.
  const dx = (length / 2) * Math.sin(angleRad);  // 회전 후 x 반쪽
  const innerWallX = wallX - 0.3;                 // 벽 안쪽 면
  // 위쪽 끝 x = side * (innerWallX - 0.1) 가 되도록 중심 x:
  //   좌측(side=-1) panel: 위쪽 끝 x = center.x + dx (-측 panel은 +rotation)
  //   center.x = -innerWallX - dx + 0.1
  // 단순화: 중심 x 를 벽에서 panel 절반 + 약간 안쪽으로
  const cx = side * (innerWallX - dx - 0.1);
  // rotation z — 좌측 panel: +angleRad (좌상→우하), 우측 panel: -angleRad (우상→좌하)
  // → 모두 안쪽으로 기우는 방향
  const rotZ = -side * angleRad;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(thickness, length, TRACK_DEPTH * 0.85),
    mat
  );
  mesh.position.set(cx, y, 0);
  mesh.rotation.z = rotZ;
  scene.add(mesh);
  // 글로우 라인 (앞쪽 면) — 시각
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x818cf8 });
  const line = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, length - 0.2, 0.06),
    lineMat
  );
  line.position.set(cx - side * (thickness/2 + 0.05), y, TRACK_DEPTH/2 - 0.05);
  line.rotation.z = rotZ;
  scene.add(line);

  // Rapier collider
  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(cx, y, 0)
  );
  const half = rotZ / 2;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(thickness/2, length/2, TRACK_DEPTH * 0.85 / 2)
      .setRotation({ x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) })
      .setRestitution(0.6).setFriction(0.18),
    rb
  );
}

// ─────────────────────────────────────────────────────────────
// 깔때기 (Funnel) — 좌우 비스듬한 벽 두 개로 V자 좁아지는 가이드.
// 결승선 직전 구슬을 좁은 통로로 모음 → 박진감 + 순위 변동.
// ─────────────────────────────────────────────────────────────
function buildFunnel({ scene, world, RAPIER, yTop, yBottom, exitWidth, mat }) {
  // 벽 내부 안쪽 = TRACK_WIDTH/2 - wallThickness/2 - 약간 여유 = 5.5 안쪽으로.
  // funnel 위쪽 끝이 벽 안에 박히면 코너 끼임 발생 — 반드시 벽보다 안쪽에.
  const halfTop = TRACK_WIDTH / 2 - 1.5;     // 위쪽 끝 x = ±5.5
  const halfBot = exitWidth / 2;
  const innerWall = TRACK_WIDTH / 2 - 0.25;  // 벽 안쪽 면 = 5.75
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

  // ── Caps — funnel 위쪽 끝과 트랙 벽 사이의 0.25m 갭 막음 ───
  // 이전: 갭 너무 작아도 빠른 구슬은 Rapier discrete CCD 로 관통 가능 → 프리패스 회귀.
  // 가로 막대로 빠짐없이 차단.
  const capW = innerWall - halfTop + 0.3;       // 갭 폭 + 양쪽 여유
  const capH = 0.5;
  for (const side of [-1, +1]) {
    const cx = side * (halfTop + innerWall) / 2;
    const cy = yTop;
    const capMesh = new THREE.Mesh(new THREE.BoxGeometry(capW, capH, TRACK_DEPTH), funnelMat);
    capMesh.position.set(cx, cy, 0);
    scene.add(capMesh);
    const capRb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, 0));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(capW/2, capH/2, TRACK_DEPTH/2)
        .setRestitution(0.4).setFriction(0.3),
      capRb
    );
  }
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

  let angularSpeed = 2.4 * dir;
  let angle = 0;
  return {
    setSpeed(speed) { angularSpeed = Math.abs(speed) * dir; },
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
