# Marble Roulette — Context Notes

> 진행하며 발견한 결정 / 함정 누적. 다음 세션이 처음부터 다시 도출하지 않도록.

## 2026-06-05 — 시작

### 사용자 결정
- 물리엔진: **Rapier (WASM)** — 100개도 안전, 다만 사용자는 50개 상한으로 결정
- 시작 범위: **Phase 1 MVP 먼저** (트랙 1 + 핀 + 풍차 1 + 팔로우 캠 + 리더보드 + 결승)
- 시각: **단순** (MeshStandardMaterial + 색상). 그림자 / PBR / bloom 미적용
- 구슬 상한: **50개**
- 참가자 입력: **단순 규칙** (`이름*N` 또는 `이름`, 쉼표/줄바꿈)
- 포상: **개수 가변** (추가/제거 버튼)

### 추가 요청
- 포상 결과 화면: `1등 — 안병민 : 치킨` 식 카드 형태
- 능동적 추가: textarea 안에 한 번에 + (선택) 단일 추가 입력란

### 함정 (앞으로 만날 가능성)
- **Rapier WASM 초기화는 async** — `await RAPIER.init()` 또는 `import init from '@dimforge/rapier3d-compat'`. main.js entry 비동기로.
- **vite.config 의 WASM 처리** — `optimizeDeps.exclude: ['@dimforge/rapier3d-compat']` 필수, 안 그러면 빌드 깨짐.
- **Sprite 라벨의 텍스처 누수** — 구슬 dispose 시 sprite.material.map.dispose() 명시.
- **Three.js + Rapier 좌표 동기화** — 매 프레임 `mesh.position.copy(rigidBody.translation())` + rotation 도. 누락하면 mesh 안 움직임.
- **결승선 sensor** — `setSensor(true)` 로 collider 가 통과 가능 + collision event 만. forward velocity 영향 X.
- **카메라 lerp 의 alpha** — 60fps 기준 0.1~0.15. delta 보정 안 하면 프레임 드롭 시 느려짐. `1 - Math.pow(1 - α, dt * 60)` 패턴.

### 인프라
- GitHub repo: `AhnByeongMin/marble` (방금 clone, 빈 상태)
- 도메인: marble.haru-hub.com (사용자 등록 완료, CF DNS 추가 예정)
- 배포: Cloudflare Pages (정적). cashpulse·haru-invite·haru-lease 와 동일 패턴.
- 인프라 정본: [/home/haruhome/cashpulse/docs/INFRA.md](../../cashpulse/docs/INFRA.md)

### 핵심 파일
- 진입점: `src/main.js`
- 입력 파싱: `src/input.js`
- 트랙: `src/track.js`
- 카메라 director: `src/camera-director.js`
