// Rapier WASM 초기화 + world helper

import RAPIER from '@dimforge/rapier3d-compat';

export async function initPhysics() {
  await RAPIER.init();
  const gravity = { x: 0, y: -20, z: 0 };
  const world = new RAPIER.World(gravity);
  // timestep / iterations 은 Rapier 기본값 사용 (1/60, default solver).
  return { RAPIER, world };
}
