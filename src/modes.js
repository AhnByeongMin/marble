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
    description: '좌→우 핀볼 코스 — 벽/핀 튕기며 결승까지',
    trackType: 'race',
    cameraMode: 'side-follow',
    // gravity Y 만 — X 추진은 트랙 경사 + 시작 임펄스 + 핀 튕김으로
    gravity: { x: 0, y: -18, z: 0 },
    startImpulse: { x: 10, y: 0.4, z: 0.3 },  // 초기 X+ 강하게
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
