// 카메라 상태 머신 — FOLLOW (선두 따라감) / FINISH (결승선 고정 줌) / RESULT (멈춤)
// lerp 보간 + delta-시간 보정: alpha = 1 - pow(1 - α60, dt * 60)

import * as THREE from 'three';
import { TRACK } from './track.js';

const STATE = { FOLLOW: 'follow', FINISH: 'finish', RESULT: 'result' };

export class CameraDirector {
  constructor(camera) {
    this.camera = camera;
    this.state = STATE.FOLLOW;
    this.target = new THREE.Vector3(0, TRACK.topY - 4, 18);
    this.lookAt = new THREE.Vector3(0, TRACK.topY - 4, 0);
    // 즉시 적용
    camera.position.copy(this.target);
    camera.lookAt(this.lookAt);
    this._tmpLook = new THREE.Vector3();
  }

  // marbles 배열 + 결승선 진입 여부 받아 카메라 목표 갱신
  update(marbles, dt, opts = {}) {
    // 선두 구슬 (가장 낮은 y, finished 제외 우선)
    const leaders = marbles
      .filter(m => !m.finished)
      .map(m => ({ y: m.rb.translation().y, x: m.rb.translation().x, m }))
      .sort((a, b) => a.y - b.y);

    const leader = leaders[0];
    const allFinished = marbles.length > 0 && marbles.every(m => m.finished);

    if (allFinished) {
      this.state = STATE.RESULT;
    } else if (leader && leader.y <= TRACK.finishY + 8) {
      // 결승선 8m 이내 — FINISH 앵글
      this.state = STATE.FINISH;
    } else {
      this.state = STATE.FOLLOW;
    }

    // 상태별 목표 카메라 위치
    if (this.state === STATE.FOLLOW && leader) {
      this.target.set(leader.x * 0.3, leader.y + 6, 16);
      this.lookAt.set(0, leader.y, 0);
    } else if (this.state === STATE.FINISH) {
      this.target.set(0, TRACK.finishY + 3, 14);
      this.lookAt.set(0, TRACK.finishY, 0);
    } else if (this.state === STATE.RESULT) {
      // 결과 — 결승선에 머무르며 약간 위
      this.target.set(0, TRACK.finishY + 5, 12);
      this.lookAt.set(0, TRACK.finishY, 0);
    }

    // delta 보정 lerp — 60fps 기준 0.12
    const alpha60 = 0.12;
    const alpha = 1 - Math.pow(1 - alpha60, dt * 60);
    this.camera.position.lerp(this.target, alpha);
    // lookAt 도 보간 — 현재 lookAt 으로부터 목표 lookAt 으로
    this._tmpLook.copy(this.lookAt);
    this.camera.lookAt(this._tmpLook);
  }
}

export { STATE as CAMERA_STATE };
