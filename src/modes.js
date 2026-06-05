// 추첨 모드 — 같은 트랙 + 파라미터/결과 처리 변형 (Phase 1)
// 레이스 모드 (수평 트랙) 는 Phase 2 별도.

export const MODES = {
  CLASSIC: {
    id: 'classic',
    label: '클래식',
    emoji: '🎱',
    description: '기본 — 위에서 떨어져 결승선까지',
    gravityY: -28,
    startImpulse: { x: 3, y: 0.3, z: 0.6 },
    windmillSpeed: 0.7,
    spinnerSpeed: 2.4,
    bumperRestitution: 0.95,
    marbleRestitution: 0.5,
    marbleFriction: 0.15,
    reverseRanking: false,
  },
  SPEEDRUN: {
    id: 'speedrun',
    label: '스피드런',
    emoji: '⚡',
    description: 'gravity 강화 + 풍차/스피너 빠름 — 빠른 결승',
    gravityY: -45,
    startImpulse: { x: 3, y: 0.3, z: 0.6 },
    windmillSpeed: 1.4,
    spinnerSpeed: 4.0,
    bumperRestitution: 0.95,
    marbleRestitution: 0.5,
    marbleFriction: 0.15,
    reverseRanking: false,
  },
  CHAOS: {
    id: 'chaos',
    label: '카오스',
    emoji: '💥',
    description: '시작부터 폭발 + 강한 반발 — 격렬한 추첨',
    gravityY: -30,
    // 시작 임펄스 줄임 — 이전 (x±10, y+3) 은 구슬이 트랙 밖으로 튕김 (CCD 한계 넘음)
    startImpulse: { x: 5, y: 1.2, z: 1.2 },
    windmillSpeed: 1.2,
    spinnerSpeed: 4.0,
    bumperRestitution: 0.95,    // 1 미만 유지 (에너지 증폭 X)
    marbleRestitution: 0.7,
    marbleFriction: 0.1,
    reverseRanking: false,
  },
  REVERSE: {
    id: 'reverse',
    label: '꼴찌 결정',
    emoji: '🐢',
    description: '꼴찌가 1등 — 마지막에 도착한 사람이 우승',
    gravityY: -28,
    startImpulse: { x: 3, y: 0.3, z: 0.6 },
    windmillSpeed: 0.7,
    spinnerSpeed: 2.4,
    bumperRestitution: 0.95,
    marbleRestitution: 0.5,
    marbleFriction: 0.15,
    reverseRanking: true,
  },
};

export const MODE_LIST = [MODES.CLASSIC, MODES.SPEEDRUN, MODES.CHAOS, MODES.REVERSE];

export function getMode(id) {
  return Object.values(MODES).find(m => m.id === id) || MODES.CLASSIC;
}
