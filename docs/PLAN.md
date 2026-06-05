# Marble Roulette 3D — Plan

## 왜

lazygyu의 Marble Roulette (2D) 컨셉을 3D로 업그레이드한 추첨 룰렛.
회사·모임에서 "1~N등 당첨자 뽑기" 용도. 이벤트 진행하면서 화면에 띄워두면
재미 + 신뢰성 둘 다.

## 무엇 (Phase 1 MVP — 1-2일)

웹앱 1개. 정적 사이트, Cloudflare Pages 배포, `marble.haru-hub.com`.

핵심:
1. 입력 패널 — 참가자 (textarea, `이름*N` 또는 `이름`, 쉼표/줄바꿈) + 포상 등수 (가변, 추가/제거 버튼)
2. 3D 수직 트랙 — 핀(장애물) + 회전 풍차 1개 + 결승선
3. 구슬 — 단순 MeshStandardMaterial + 색상 무작위 + 이름 Sprite 라벨
4. 카메라 — 선두 팔로우 (lerp) + 결승선 진입 시 고정 앵글 줌
5. UI — 우측 상단 리더보드 (DOM, 순위 변경 transition)
6. 결과 화면 — 1~N등 "이름 : 당첨내용" 카드

비-목표 (Phase 1):
- 역전 슬로우모션 → Phase 2
- 깔때기·지그재그 → Phase 2
- confetti / 화면 플래시 → Phase 2
- 100개 구슬 → 50개 상한 (사용자 결정)

## 기술 스택

| 영역 | 선택 |
|---|---|
| 빌드 | Vite |
| 언어 | JavaScript (vanilla, no framework) |
| 3D | Three.js (latest) |
| 물리 | @dimforge/rapier3d-compat (WASM) |
| 배포 | Cloudflare Pages |
| 도메인 | marble.haru-hub.com |

이유: Rapier는 100개 동적 강체에서 60fps 안정. cannon-es는 50-60개 한계.
순수 정적이라 Pages 배포 단순. vanilla JS — 작은 앱에 React/Vue 부담 없음.

## 구조

```
marble/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── main.js                 # 진입점, init / loop
    ├── input.js                # 참가자/포상 파싱, UI
    ├── physics.js              # Rapier 초기화, world, step
    ├── scene.js                # Three.js 씬, 카메라, 빛
    ├── track.js                # 트랙 지오메트리 + 핀 + 풍차 + 결승선
    ├── marble.js               # 구슬 spawn + Sprite 라벨
    ├── camera-director.js      # 팔로우 / 결승선 / 결과 상태 머신
    ├── leaderboard.js          # 순위 계산 + DOM 동기화
    ├── result-screen.js        # 결과 카드 렌더
    └── style.css
```

## Phase

| 단계 | 산출 | 검증 |
|---|---|---|
| A. 셋업 | Vite + Three.js + Rapier 부팅, 빈 씬 + 구슬 1개 떨어짐 | 60fps 빈 씬 |
| B. 트랙 | 수직 트랙 + 핀 + 풍차 + 결승선 collider 다 완성 | 구슬이 결승선까지 굴러 |
| C. 입력+spawn | textarea 파싱 → 구슬 N개 spawn + Sprite 라벨 | 50개 OK |
| D. 카메라+리더보드 | 팔로우 + 결승선 줌 + DOM 리더보드 | 끊김 없는 보간 |
| E. 결과 | 1~N등 매핑 → 결과 카드 | 등수별 이름 + 당첨내용 표시 |
| F. 배포 | Cloudflare Pages + DNS | marble.haru-hub.com 접속 |

## 위험

- **Rapier WASM 초기 로드** — 200KB+. Pages CDN 정적 캐시로 충분.
- **모바일 GPU** — 단순 Material + shadow off 로 회피 (사용자 결정).
- **참가자 0명 또는 1명** — edge case. 경고 + start 비활성화.
- **포상 수 > 참가자 수** — 등수 일부 비어있음 처리 (그냥 표시 안 함).
