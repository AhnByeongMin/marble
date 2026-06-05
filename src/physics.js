// Rapier WASM 초기화 + world helper

import RAPIER from '@dimforge/rapier3d-compat';

export async function initPhysics() {
  await RAPIER.init();
  // gravity 강하게 — 끼임 줄이고 떨어지는 속도감 ↑
  const gravity = { x: 0, y: -28, z: 0 };
  const world = new RAPIER.World(gravity);
  return { RAPIER, world };
}
