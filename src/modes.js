// 추첨 모드 — 클래식 + 꼴찌 결정 (레이스는 제거됨)

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
  REVERSE: {
    id: 'reverse',
    label: '꼴찌 결정',
    emoji: '🐢',
    description: '마지막 통과자가 1등',
    trackType: 'vertical',
    cameraMode: 'top-follow',
    gravity: { x: 0, y: -28, z: 0 },
    startImpulse: { x: 3, y: 0.3, z: 0.6 },
    reverseRanking: true,
  },
};

export const MODE_LIST = [MODES.CLASSIC, MODES.REVERSE];

export function getMode(id) {
  return Object.values(MODES).find(m => m.id === id) || MODES.CLASSIC;
}
