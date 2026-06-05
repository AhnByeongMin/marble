# Marble Roulette — Phase 1 MVP Checklist

## A. 셋업
- [ ] `npm create vite@latest . -- --template vanilla` (현재 디렉토리)
- [ ] `npm i three @dimforge/rapier3d-compat`
- [ ] `vite.config.js` — base path, `optimizeDeps.exclude: ['@dimforge/rapier3d-compat']` (WASM)
- [ ] `index.html` — canvas, viewport meta (모바일 세로)
- [ ] `src/main.js` — Three 씬 + Rapier world 부팅, 빈 바닥에 구슬 1개 떨어짐

## B. 트랙 + 기믹
- [ ] `src/track.js` — 수직 트랙 (좌우 벽 + 바닥 결승선)
- [ ] 핀 8x10 정도 격자 (정적 cylinder collider)
- [ ] 회전 풍차 — KinematicPositionBased + 매 프레임 회전 적용
- [ ] 결승선 (sensor) — 통과 시 구슬 id 콜백

## C. 입력 + spawn
- [ ] `src/input.js` — textarea 파서: `이름*N` 또는 `이름`, 쉼표/줄바꿈 split
- [ ] 50개 상한 검증, 초과 시 경고
- [ ] 포상 가변 리스트 — `+ 등수 추가` / `× 제거` 버튼, 등수번호 + 텍스트 입력
- [ ] `src/marble.js` — 이름·색상 → Three Mesh + Sprite 라벨 + Rapier RigidBody
- [ ] 시작 버튼 — 입력 검증 후 spawn + 시뮬레이션 시작

## D. 카메라 + 리더보드
- [ ] `src/camera-director.js` — 상태머신: FOLLOW / FINISH / RESULT
- [ ] FOLLOW — 1등 위치의 위쪽으로 카메라 lerp
- [ ] FINISH — 1등 y가 임계값 도달 시 결승선 고정 앵글
- [ ] `src/leaderboard.js` — 매 프레임 구슬 y 정렬 (y 작을수록 앞), DOM 동기화 + transition

## E. 결과
- [ ] 결승선 통과 순서대로 finishOrder[] 기록
- [ ] 모든 구슬 통과 또는 N등까지 통과 시 결과 화면 트리거
- [ ] `src/result-screen.js` — 1~N등 카드: "{등수}등 — {이름} : {당첨내용}"
- [ ] 리셋 버튼

## F. 배포
- [ ] `npm run build` 통과
- [ ] Cloudflare Pages 프로젝트 연결 (gh repo)
- [ ] DNS — marble.haru-hub.com CNAME → pages.dev
- [ ] 모바일 + 데스크탑 둘 다 60fps 확인

## 마무리
- [ ] README — 데모 GIF + 사용법
- [ ] commit 의미 단위 (셋업 / 트랙 / 입력 / 카메라 / 결과 / 배포)
