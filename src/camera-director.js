// 카메라 상태 머신 — FOLLOW (선두 따라감) / FINISH (결승선 줌) / RESULT
// 트랙 시야 넓게 + 부드러운 lerp. delta-시간 보정.

import * as THREE from 'three';
import { TRACK } from './track.js';

const STATE = { FOLLOW: 'follow', FINISH: 'finish', RESULT: 'result' };

// 카메라 거리 — 트랙 폭(14) 의 fov 55 환산 + 시각 여유. 약간 위에서 내려다보는 각도.
const FOLLOW_Z = 22;
const FINISH_Z = 16;
const RESULT_Z = 18;

export class CameraDirector {
  constructor(camera) {
    this.camera = camera;
    this.state = STATE.FOLLOW;
    this.target = new THREE.Vector3(0, TRACK.topY - 4, FOLLOW_Z);
    this.lookAt = new THREE.Vector3(0, TRACK.topY - 6, 0);
    this.currentLookAt = new THREE.Vector3().copy(this.lookAt);
    camera.position.copy(this.target);
    camera.lookAt(this.currentLookAt);
  }

  update(marbles, dt) {
    const leaders = marbles.filter(m => !m.finished).map(m => ({
      y: m.rb.translation().y, x: m.rb.translation().x, m
    })).sort((a, b) => a.y - b.y);

    const leader = leaders[0];
    const allFinished = marbles.length > 0 && marbles.every(m => m.finished);
    const nearFinish = leader && leader.y <= TRACK.finishY + 9;

    if (allFinished) this.state = STATE.RESULT;
    else if (nearFinish) this.state = STATE.FINISH;
    else this.state = STATE.FOLLOW;

    if (this.state === STATE.FOLLOW && leader) {
      // 선두 따라감 — leader.x 영향 적게 (트랙 폭이 보이도록 가운데 위주),
      // y 는 leader 보다 약간 위에서 내려다보기
      this.target.set(leader.x * 0.25, leader.y + 4, FOLLOW_Z);
      this.lookAt.set(leader.x * 0.12, leader.y - 3, 0);
    } else if (this.state === STATE.FINISH) {
      // 결승선 정면 — 좀 더 후방에서
      this.target.set(0, TRACK.finishY + 3, FINISH_Z);
      this.lookAt.set(0, TRACK.finishY + 0.5, 0);
    } else if (this.state === STATE.RESULT) {
      this.target.set(0, TRACK.finishY + 5, RESULT_Z);
      this.lookAt.set(0, TRACK.finishY, 0);
    }

    // lerp 부드럽게 — FOLLOW 0.06, FINISH 약간 빠르게
    const alpha60 = this.state === STATE.FINISH ? 0.07 : 0.06;
    const alpha = 1 - Math.pow(1 - alpha60, dt * 60);
    this.camera.position.lerp(this.target, alpha);
    this.currentLookAt.lerp(this.lookAt, alpha);
    this.camera.lookAt(this.currentLookAt);
  }
}

export { STATE as CAMERA_STATE };
