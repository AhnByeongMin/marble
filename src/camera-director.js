// 카메라 — 모드별 cameraMode 따라 동작
//   'top-follow' (vertical) — 선두 y 따라 위에서 내려다보기
//   'side-follow' (race) — 선두 x 따라 측면에서 보기

import * as THREE from 'three';
import { TRACK_SPECS } from './track.js';

const STATE = { FOLLOW: 'follow', FINISH: 'finish', RESULT: 'result' };

export class CameraDirector {
  constructor(camera, cameraMode = 'top-follow') {
    this.camera = camera;
    this.cameraMode = cameraMode;
    this.state = STATE.FOLLOW;
    this.target = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3();
    this._setInitial();
    camera.position.copy(this.target);
    camera.lookAt(this.currentLookAt);
  }

  _setInitial() {
    const spec = TRACK_SPECS.vertical;
    this.target.set(0, spec.topY - 4, 28);
    this.lookAt.set(0, spec.topY - 6, 0);
    this.currentLookAt.copy(this.lookAt);
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    this._setInitial();
    this.camera.position.copy(this.target);
    this.camera.lookAt(this.currentLookAt);
  }

  update(marbles, dt) {
    return this._updateVertical(marbles, dt);
  }

  _updateVertical(marbles, dt) {
    const spec = TRACK_SPECS.vertical;
    const leaders = marbles.filter(m => !m.finished).map(m => ({
      y: m.rb.translation().y, x: m.rb.translation().x, m,
    })).sort((a, b) => a.y - b.y);
    const leader = leaders[0];
    const allFinished = marbles.length > 0 && marbles.every(m => m.finished);
    const nearFinish = leader && leader.y <= spec.finishY + 9;
    if (allFinished) this.state = STATE.RESULT;
    else if (nearFinish) this.state = STATE.FINISH;
    else this.state = STATE.FOLLOW;

    if (this.state === STATE.FOLLOW && leader) {
      // 카메라 z 거리 ↑ (22 → 28) — 트랙 위쪽 풍차 등 시야에 들어오게.
      // y offset +4 → +6 (선두 위쪽 풍차/장애물 보임).
      // lookAt y -3 → -1 (좀 더 위쪽 향함).
      this.target.set(leader.x * 0.2, leader.y + 6, 28);
      this.lookAt.set(leader.x * 0.1, leader.y - 1, 0);
    } else if (this.state === STATE.FINISH) {
      this.target.set(0, spec.finishY + 3, 18);
      this.lookAt.set(0, spec.finishY + 0.5, 0);
    } else {
      this.target.set(0, spec.finishY + 5, 20);
      this.lookAt.set(0, spec.finishY, 0);
    }
    this._applyLerp(dt);
  }

  _applyLerp(dt) {
    const alpha60 = this.state === STATE.FINISH ? 0.07 : 0.06;
    const alpha = 1 - Math.pow(1 - alpha60, dt * 60);
    this.camera.position.lerp(this.target, alpha);
    this.currentLookAt.lerp(this.lookAt, alpha);
    this.camera.lookAt(this.currentLookAt);
  }
}

export { STATE as CAMERA_STATE };
