// 카메라 상태 머신 — FOLLOW (선두 따라감) / FINISH (결승선 줌인) / RESULT
// delta-시간 보정 lerp + 결승 임박 시 자연스러운 줌인 + 부드러운 lookAt

import * as THREE from 'three';
import { TRACK } from './track.js';

const STATE = { FOLLOW: 'follow', FINISH: 'finish', RESULT: 'result' };

export class CameraDirector {
  constructor(camera) {
    this.camera = camera;
    this.state = STATE.FOLLOW;
    this.target = new THREE.Vector3(0, TRACK.topY - 2, 18);
    this.lookAt = new THREE.Vector3(0, TRACK.topY - 4, 0);
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
    // 결승 임박 — 1등 y 가 finish + 10m 이내
    const nearFinish = leader && leader.y <= TRACK.finishY + 10;

    if (allFinished) this.state = STATE.RESULT;
    else if (nearFinish) this.state = STATE.FINISH;
    else this.state = STATE.FOLLOW;

    if (this.state === STATE.FOLLOW && leader) {
      // 선두 따라감 + 약간 위쪽 (보기 좋게)
      this.target.set(leader.x * 0.4, leader.y + 5, 14);
      this.lookAt.set(leader.x * 0.2, leader.y - 2, 0);
    } else if (this.state === STATE.FINISH) {
      // 결승선 정면 줌인
      this.target.set(0, TRACK.finishY + 2, 10);
      this.lookAt.set(0, TRACK.finishY + 0.5, 0);
    } else if (this.state === STATE.RESULT) {
      this.target.set(0, TRACK.finishY + 4, 12);
      this.lookAt.set(0, TRACK.finishY, 0);
    }

    // 부드러운 lerp — 결승 줌인이 더 빠름, 일반 팔로우는 차분히
    const alpha60 = this.state === STATE.FINISH ? 0.08 : 0.10;
    const alpha = 1 - Math.pow(1 - alpha60, dt * 60);
    this.camera.position.lerp(this.target, alpha);

    // lookAt 도 부드럽게
    this.currentLookAt.lerp(this.lookAt, alpha);
    this.camera.lookAt(this.currentLookAt);
  }
}

export { STATE as CAMERA_STATE };
