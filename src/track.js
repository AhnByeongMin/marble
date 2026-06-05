// 트랙 — 모드별로 다른 구조 (vertical: 클래식 핀볼 / race: 수평 레이스)

import * as THREE from 'three';

const TRACK_WIDTH = 14;
const TRACK_DEPTH = 1.8;
const TRACK_TOP_Y = 30;
const TRACK_BOTTOM_Y = -32;
const FINISH_Y = -30;

// 레이스 트랙 dims — 핀볼 채널 (좁고 길게, 위아래 부딪침 자주)
const RACE_LEN = 60;        // 가로 길이 (X)
const RACE_HEIGHT = 8;      // 세로 높이 (Y) — 좁게 (이전 14 → 8)
const RACE_DEPTH = 1.8;
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

  // ── 게이트 + 풍차 (복원) ────────────────────────────────
  const gate = createGate({ scene, world, RAPIER, y: TRACK_TOP_Y - 1.5 });
  const windmill = createWindmill({ scene, world, RAPIER, y: 17, mat: windmillMat });

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
    applyMode(mode) {
      windmill.setSpeed(mode.windmillSpeed || 0.7);
      spinner1.setSpeed(mode.spinnerSpeed || 2.4);
      spinner2.setSpeed(mode.spinnerSpeed || 2.4);
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
// 🏁 레이스 트랙 — W자 지그재그 채널 (위/아래 평행 벽 사이 좁은 길)
// 사용자 그림 기반: 좌상 시작 → 골/봉우리 반복 → 우하 결승. 핀볼 아닌 진짜 코스.
// 구슬이 channel 안에서 굴러 X+ 진행. 코너에서 부딪치며 자연스러운 레이스.
// ─────────────────────────────────────────────────────────────
function buildRaceTrack({ scene, world, RAPIER }) {
  const D = RACE_DEPTH;
  const startX = RACE_START_X, finishX = RACE_FINISH_X;

  // 머티리얼
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x312e81, roughness: 0.5, metalness: 0.5,
    emissive: 0x6366f1, emissiveIntensity: 0.35,
  });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x818cf8 });
  const finishLineMat = new THREE.MeshBasicMaterial({ color: 0x86efac });

  // ── W자 waypoints (X, Y_center) — 좌→우 진행, Y 위아래 흔들림 ──
  // 좌측 위에서 시작 → 봉우리/골 → 우측 아래 결승. 평균 Y 가 점진 아래.
  const waypoints = [
    { x: -28, y:  5 },   // 시작 (좌상)
    { x: -16, y: -2 },   // 골
    { x:  -4, y:  5 },   // 봉우리
    { x:   8, y: -3 },   // 골
    { x:  20, y:  4 },   // 봉우리
    { x:  28, y: -5 },   // 결승 (우하)
  ];
  const channelW = 3.2;   // 위/아래 라인 사이 폭 (구슬 통과)
  const wallThickness = 0.35;
  const wallDepth = D - 0.1;

  // 각 segment 의 위/아래 라인 cuboid 생성
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i], b = waypoints[i + 1];
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy) + 0.3;   // 약간 여유 (코너 겹침)
    const angle = Math.atan2(dy, dx);
    // segment 의 normal (수직 방향) — 위/아래 라인 offset
    const nx = -Math.sin(angle), ny = Math.cos(angle);

    for (const side of [+1, -1]) {
      const wx = cx + nx * (channelW/2) * side;
      const wy = cy + ny * (channelW/2) * side;
      // mesh
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(segLen, wallThickness, wallDepth),
        wallMat
      );
      mesh.position.set(wx, wy, 0);
      mesh.rotation.z = angle;
      scene.add(mesh);
      // 글로우 라인 (안쪽 면)
      const lineLen = segLen - 0.4;
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(lineLen, 0.06, 0.06),
        edgeMat
      );
      line.position.set(
        wx - nx * (wallThickness/2 + 0.04) * side,
        wy - ny * (wallThickness/2 + 0.04) * side,
        wallDepth/2 - 0.05,
      );
      line.rotation.z = angle;
      scene.add(line);
      // Rapier collider
      const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(wx, wy, 0));
      const half = angle / 2;
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(segLen/2, wallThickness/2, wallDepth/2)
          .setRotation({ x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) })
          .setRestitution(0.45).setFriction(0.18),
        rb
      );
    }
  }

  // ── 코너 cap — segment 끝과 끝 사이 갭 메움 ────────────────
  // 각 waypoint 의 위 line 끝점들 + 아래 line 끝점들 사이 작은 cap.
  for (let i = 1; i < waypoints.length - 1; i++) {
    const wp = waypoints[i];
    // 인접 두 segment 의 normal (위/아래 line offset 방향)
    const prevDx = wp.x - waypoints[i-1].x, prevDy = wp.y - waypoints[i-1].y;
    const nextDx = waypoints[i+1].x - wp.x, nextDy = waypoints[i+1].y - wp.y;
    const prevAng = Math.atan2(prevDy, prevDx);
    const nextAng = Math.atan2(nextDy, nextDx);
    for (const side of [+1, -1]) {
      // 각 side 의 두 인접 line 끝점
      const p1x = wp.x + -Math.sin(prevAng) * (channelW/2) * side;
      const p1y = wp.y +  Math.cos(prevAng) * (channelW/2) * side;
      const p2x = wp.x + -Math.sin(nextAng) * (channelW/2) * side;
      const p2y = wp.y +  Math.cos(nextAng) * (channelW/2) * side;
      const cx = (p1x + p2x) / 2, cy = (p1y + p2y) / 2;
      const dx = p2x - p1x, dy = p2y - p1y;
      const capLen = Math.hypot(dx, dy) + 0.3;
      if (capLen < 0.4) continue;   // 너무 짧으면 skip
      const capAng = Math.atan2(dy, dx);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(capLen, wallThickness, wallDepth),
        wallMat
      );
      mesh.position.set(cx, cy, 0);
      mesh.rotation.z = capAng;
      scene.add(mesh);
      const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, 0));
      const half = capAng / 2;
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(capLen/2, wallThickness/2, wallDepth/2)
          .setRotation({ x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) })
          .setRestitution(0.45).setFriction(0.18),
        rb
      );
    }
  }

  // ── 좌측 출발 캡 (channel 좌측 끝 막음) ──────────────────
  {
    const a = waypoints[0];
    const dx0 = waypoints[1].x - a.x, dy0 = waypoints[1].y - a.y;
    const angle = Math.atan2(dy0, dx0);
    const capLen = channelW + 0.5;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, capLen, wallDepth), wallMat
    );
    mesh.position.set(a.x, a.y, 0);
    mesh.rotation.z = angle;
    scene.add(mesh);
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(a.x, a.y, 0));
    const half = angle / 2;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(wallThickness/2, capLen/2, wallDepth/2)
        .setRotation({ x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) })
        .setRestitution(0.3).setFriction(0.3),
      rb
    );
  }

  // ── 앞뒤 z 벽 (mesh 없음, collider 만) ────────────────────
  for (const zSign of [1, -1]) {
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, zSign * D/2));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(40, 16, 0.1).setRestitution(0.3).setFriction(0.4), rb
    );
  }

  // ── 외곽 boundary (Y 위/아래 + X 좌/우) — segment 갭 추락 차단 ──
  // 사용자 발견: W 채널 코너에서 segment 가 매끄럽게 안 닿아 갭 발생.
  // 구슬이 갭으로 빠지면 boundary 가 안전망. mesh 없음 (시각 X), collider 만.
  // 위쪽 boundary y = +12
  {
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 12, 0));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(40, 0.5, D + 1).setRestitution(0.3).setFriction(0.4), rb
    );
  }
  // 아래쪽 boundary y = -12
  {
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -12, 0));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(40, 0.5, D + 1).setRestitution(0.3).setFriction(0.4), rb
    );
  }
  // 우측 boundary (결승 너머 빠짐 방지) — x = finishX + 2.5
  {
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(finishX + 2.5, 0, 0));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.5, 14, D + 1).setRestitution(0.3).setFriction(0.4), rb
    );
  }

  // ── 출발 게이트 (좌측 끝 channel 안에) ──────────────────
  const startW = waypoints[0];
  const dx0 = waypoints[1].x - startW.x, dy0 = waypoints[1].y - startW.y;
  const segAngle0 = Math.atan2(dy0, dx0);
  // 게이트 위치: 출발 waypoint 에서 segment 방향으로 살짝 들어간 위치
  const gateOffset = 1.2;
  const gateX = startW.x + Math.cos(segAngle0) * gateOffset;
  const gateY = startW.y + Math.sin(segAngle0) * gateOffset;
  const gate = createRaceChannelGate({
    scene, world, RAPIER,
    x: gateX, y: gateY, angle: segAngle0,
    width: channelW + 0.3, thickness: 0.35,
  });

  // ── 결승선 sensor (마지막 waypoint) ──────────────────────
  const endW = waypoints[waypoints.length - 1];
  const finishGlow = new THREE.PointLight(0x22c55e, 12, 18);
  finishGlow.position.set(endW.x, endW.y, 0);
  scene.add(finishGlow);
  // 결승선 가로 라인
  for (const dz of [-0.3, 0.3]) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, channelW, D + 0.2),
      finishLineMat
    );
    line.position.set(endW.x - 0.4, endW.y + dz * 0, 0);
    scene.add(line);
  }
  // sensor — channel 폭 만큼만
  const finishRb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(endW.x, endW.y, 0));
  const finishCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.5, channelW/2, D/2)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    finishRb
  );

  let pulsePhase = 0;
  const pulseTick = (dt) => {
    pulsePhase += dt * 2.5;
    finishGlow.intensity = 8 + (0.5 + Math.sin(pulsePhase) * 0.5) * 10;
  };

  return {
    gate,
    finishColliderHandle: finishCollider.handle,
    bumperHandles: new Set(),   // race 는 범퍼 없음
    jumpPadHandles: new Set(),
    bumpers: [],
    jumpPad: { bump() {} },     // collision handler 안전망
    waypoints,
    applyMode(mode) {},
    tick(dt) {
      gate.tick(dt);
      pulseTick(dt);
    },
  };
}

// 채널 게이트 — segment angle 방향으로 회전. 시작 시 segment normal 방향으로 슬라이드.
function createRaceChannelGate({ scene, world, RAPIER, x, y, angle, width, thickness }) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e, emissive: 0x9f1239, emissiveIntensity: 0.5,
  });
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(thickness, width, RACE_DEPTH), mat
  );
  mesh.position.set(x, y, 0);
  mesh.rotation.z = angle;
  scene.add(mesh);
  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, 0)
  );
  const half = angle / 2;
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(thickness/2, width/2, RACE_DEPTH/2)
      .setRotation({ x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) })
      .setRestitution(0.2).setFriction(0.5),
    rb
  );
  let opening = false, slide = 0;
  // 슬라이드 방향 — segment normal 방향 (위쪽)
  const nx = -Math.sin(angle), ny = Math.cos(angle);
  const SPEED = 25;
  return {
    open() { if (!opening) { opening = true; collider.setEnabled(false); } },
    reset() {
      opening = false; slide = 0;
      mesh.visible = true;
      mesh.position.set(x, y, 0);
      rb.setNextKinematicTranslation({ x, y, z: 0 });
      collider.setEnabled(true);
    },
    tick(dt) {
      if (!opening || slide >= 15) return;
      slide = Math.min(15, slide + SPEED * dt);
      mesh.position.x = x + nx * slide;
      mesh.position.y = y + ny * slide;
      rb.setNextKinematicTranslation({ x: x + nx * slide, y: y + ny * slide, z: 0 });
      if (slide >= 15) mesh.visible = false;
    },
  };
}

// 옛 함수 (사용 안 함, 참고용 보존)
function buildRaceTrackOld_REMOVED({ scene, world, RAPIER }) {
  const L = RACE_LEN, H = RACE_HEIGHT, D = RACE_DEPTH;
  const startX = RACE_START_X, finishX = RACE_FINISH_X;
  const floorY = -4;             // 좁은 채널: -4 ~ +4 (높이 8)
  const ceilY = floorY + H;      // = 4
  const midY = (floorY + ceilY) / 2;  // = 0

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

  // ── 평평한 바닥 + 천장 (좁은 채널) ──────────────────────
  // 핀볼 채널처럼 위/아래 벽 사이에 구슬 튕김. X+ 추진은 시작 임펄스 + 핀/범퍼.
  // 살짝 경사 (X+ 방향 약하게 아래) — 추진력 보조.
  const tiltAngle = 0.05;   // ~3°. gravity Y 와 합치면 X 방향 가속 ~ 0.9 m/s²
  function addAngledFloor(cy, h = 0.5) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(L + 1, h, D + 0.4), wallMat);
    mesh.position.set(0, cy, 0);
    mesh.rotation.z = -tiltAngle;
    scene.add(mesh);
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, cy, 0));
    const half = -tiltAngle / 2;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid((L + 1)/2, h/2, (D + 0.4)/2)
        .setRotation({ x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) })
        .setRestitution(0.4).setFriction(0.25),
      rb
    );
  }
  addAngledFloor(floorY);        // 바닥
  // 천장 — 평평
  {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(L + 1, 0.5, D + 0.4), wallMat);
    mesh.position.set(0, ceilY, 0);
    scene.add(mesh);
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, ceilY, 0));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid((L + 1)/2, 0.25, (D + 0.4)/2)
        .setRestitution(0.4).setFriction(0.3),
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

  // ── 핀볼 코스 장애물 — 트랙 안에 핀/범퍼/deflector 풍부 ───
  // 트랙 좁은 (Y 폭 8) 채널 안에 구슬이 위아래/벽 튕기며 X+ 진행.
  // 핀 — 트랙 위/아래 alternating 으로 배치 (지그재그). 구슬이 핀에 부딪쳐 위/아래로 튕김.
  const pinRadius = 0.32;
  const pinHeight = D - 0.4;
  const pinGeom = new THREE.CylinderGeometry(pinRadius, pinRadius, pinHeight, 14);
  const pinMatList = [
    new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.3, metalness: 0.7, emissive: 0x6366f1, emissiveIntensity: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.3, metalness: 0.7, emissive: 0x0891b2, emissiveIntensity: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.3, metalness: 0.7, emissive: 0xbe185d, emissiveIntensity: 0.9 }),
  ];
  // 핀 배치 — X 간격 3.5, Y 는 1.5 또는 -1.5 alternating
  let pinIdx = 0;
  for (let x = startX + 6; x <= finishX - 6; x += 3.5) {
    const yOffset = (pinIdx % 2 === 0) ? 1.8 : -1.8;
    const mat = pinMatList[pinIdx % pinMatList.length];
    const mesh = new THREE.Mesh(pinGeom, mat);
    mesh.position.set(x, yOffset, 0);
    mesh.rotation.x = Math.PI / 2;
    scene.add(mesh);
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, yOffset, 0));
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(pinHeight/2, pinRadius)
        .setRotation({ x: Math.sin(Math.PI/4), y: 0, z: 0, w: Math.cos(Math.PI/4) })
        .setRestitution(0.65).setFriction(0.15),
      rb
    );
    pinIdx++;
  }

  // 범퍼 — 군데군데 트랙 가운데 큰 충돌체. X+ 추진 강화.
  const bumpers = [];
  for (const [bx, by] of [[-18, 0.5], [-8, -0.5], [4, 1], [14, -0.5], [22, 0.8]]) {
    bumpers.push(createBumperRace({ scene, world, RAPIER, x: bx, y: by, mat: bumperMat }));
  }

  // 점프대 — 바닥에 박혀 위로 튐. X+ 방향으로 시각 임팩트.
  const jumpPad  = createJumpPadRace({ scene, world, RAPIER, x: -14, y: floorY + 0.6, mat: jumpPadMat });
  const jumpPad2 = createJumpPadRace({ scene, world, RAPIER, x:  10, y: floorY + 0.6, mat: jumpPadMat });

  // 톱니 — 가운데 큰 회전체. 구슬이 부딪치면 X+ 방향으로 차줌.
  const saw1 = createSaw({ scene, world, RAPIER, x: -22, y: ceilY - 2, mat: sawMat, dir: 1 });
  const saw2 = createSaw({ scene, world, RAPIER, x:  18, y: floorY + 2, mat: sawMat, dir: -1 });

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
      saw1.setSpeed(2.5);
      saw2.setSpeed(2.5);
    },
    tick(dt) {
      gate.tick(dt);
      saw1.tick(dt);
      saw2.tick(dt);
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
