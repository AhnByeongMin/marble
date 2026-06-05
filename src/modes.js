// 추첨 모드 — 진짜 다른 게임 형태 (트랙/카메라가 모드별로 다름)

export const MODES = {
  CLASSIC: {
    id: 'classic',
    label: '클래식',
    emoji: '🎱',
    description: '위에서 떨어져 결승선까지',
    trackType: 'vertical',
    cameraMode: 'top-follow',
    gravity: { x: 0, y: -28, z: 0 },
    startImpulse: { x: 3, y: 0.3, z: 0.6 },
    reverseRanking: false,
  },
  RACE: {
    id: 'race',
    label: '레이스',
    emoji: '🏁',
    description: '좌→우 가로 코스 — 점프대/장애물 통과',
    trackType: 'race',
    cameraMode: 'side-follow',
    // X+ 방향 지속 가속 — 트랙 경사로 + gravity X 둘 다.
    // gravity Y 도 강하게 (구슬이 바닥에 빨리 안착 → 굴러감)
    gravity: { x: 5, y: -16, z: 0 },
    startImpulse: { x: 6, y: 0.4, z: 0.3 },
    reverseRanking: false,
  },
  REVERSE: {
    id: 'reverse',
    label: '꼴찌 결정',
    emoji: '🐢',
    description: '클래식 트랙 — 마지막 통과자가 1등',
    trackType: 'vertical',
    cameraMode: 'top-follow',
    gravity: { x: 0, y: -28, z: 0 },
    startImpulse: { x: 3, y: 0.3, z: 0.6 },
    reverseRanking: true,
  },
};

export const MODE_LIST = [MODES.CLASSIC, MODES.RACE, MODES.REVERSE];

export function getMode(id) {
  return Object.values(MODES).find(m => m.id === id) || MODES.CLASSIC;
}
