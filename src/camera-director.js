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
    if (this.cameraMode === 'side-follow') {
      const spec = TRACK_SPECS.race;
      this.target.set(spec.startX, 0, 22);
      this.lookAt.set(spec.startX, 0, 0);
    } else {
      const spec = TRACK_SPECS.vertical;
      this.target.set(0, spec.topY - 4, 22);
      this.lookAt.set(0, spec.topY - 6, 0);
    }
    this.currentLookAt.copy(this.lookAt);
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    this._setInitial();
    this.camera.position.copy(this.target);
    this.camera.lookAt(this.currentLookAt);
  }

  update(marbles, dt) {
    if (this.cameraMode === 'side-follow') return this._updateRace(marbles, dt);
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
      this.target.set(leader.x * 0.25, leader.y + 4, 22);
      this.lookAt.set(leader.x * 0.12, leader.y - 3, 0);
    } else if (this.state === STATE.FINISH) {
      this.target.set(0, spec.finishY + 3, 16);
      this.lookAt.set(0, spec.finishY + 0.5, 0);
    } else {
      this.target.set(0, spec.finishY + 5, 18);
      this.lookAt.set(0, spec.finishY, 0);
    }
    this._applyLerp(dt);
  }

  _updateRace(marbles, dt) {
    const spec = TRACK_SPECS.race;
    // 레이스 — 선두 = X 가장 큰 (결승 가까운)
    const leaders = marbles.filter(m => !m.finished).map(m => ({
      x: m.rb.translation().x, y: m.rb.translation().y, m,
    })).sort((a, b) => b.x - a.x);
    const leader = leaders[0];
    const allFinished = marbles.length > 0 && marbles.every(m => m.finished);
    const nearFinish = leader && leader.x >= spec.finishX - 10;
    if (allFinished) this.state = STATE.RESULT;
    else if (nearFinish) this.state = STATE.FINISH;
    else this.state = STATE.FOLLOW;

    if (this.state === STATE.FOLLOW && leader) {
      // 측면 follow — X 따라가며 살짝 위에서
      this.target.set(leader.x - 4, leader.y + 4, 18);
      this.lookAt.set(leader.x + 2, leader.y - 1, 0);
    } else if (this.state === STATE.FINISH) {
      this.target.set(spec.finishX - 6, 1, 14);
      this.lookAt.set(spec.finishX, 0, 0);
    } else {
      this.target.set(spec.finishX - 4, 2, 16);
      this.lookAt.set(spec.finishX, 0, 0);
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
