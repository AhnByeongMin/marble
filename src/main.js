// Marble Roulette 3D — 진입점. 입력 → 시뮬레이션 → 카메라 → 리더보드 → 결과.

const STAGE = (label) => console.log(`[marble] ${label}`);

// ── 글로벌 에러 핸들러 — 빈 화면 대신 화면에 표시 ──────────────
const statusEl = document.getElementById('status');
const statusTextEl = document.getElementById('statusText');

function showStatus(text, isError = false) {
  statusTextEl.innerHTML = text;
  statusEl.classList.remove('hidden');
  statusEl.querySelector('.status-card').classList.toggle('error', isError);
}
function hideStatus() {
  statusEl.classList.add('hidden');
}
function showError(label, err) {
  console.error(`[marble] ${label}`, err);
  const msg = err?.stack || err?.message || String(err);
  showStatus(`<strong>⚠ ${label}</strong><pre>${escapeHtml(msg)}</pre>`, true);
}
function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

window.addEventListener('error', (e) => showError('런타임 에러', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => showError('Promise 거부', e.reason));

// ── 메인 init ──────────────────────────────────────────────────
(async function main() {
  try {
    STAGE('init 시작');
    showStatus('모듈 로딩…');

    // 동적 import — 단계별 진행 표시
    const { createScene } = await import('./scene.js');
    const { initPhysics } = await import('./physics.js');
    const { buildTrack, TRACK } = await import('./track.js');
    const { createMarble } = await import('./marble.js');
    const { Leaderboard } = await import('./leaderboard.js');
    const { CameraDirector } = await import('./camera-director.js');
    const { showResult, hideResult } = await import('./result-screen.js');
    const { ParticipantsUI, PrizesUI } = await import('./input.js');
    STAGE('모듈 import 완료');

    // ── DOM ─────────────────────────────────────────────────────
    const canvas = document.getElementById('stage');
    const participantsTA = document.getElementById('participants');
    const addName = document.getElementById('addName');
    const addCount = document.getElementById('addCount');
    const addBtn = document.getElementById('addBtn');
    const summary = document.getElementById('participantsSummary');
    const prizesContainer = document.getElementById('prizes');
    const addPrizeBtn = document.getElementById('addPrizeBtn');
    const startBtn = document.getElementById('startBtn');
    const resetBtn = document.getElementById('resetBtn');
    const leaderboardEl = document.getElementById('leaderboard');
    const resultOverlay = document.getElementById('resultScreen');
    const resultList = document.getElementById('resultList');
    const resultClose = document.getElementById('resultClose');

    // ── 입력 UI ─────────────────────────────────────────────────
    const participantsUI = new ParticipantsUI({
      textarea: participantsTA, addName, addCount, addBtn, summary,
    });
    const prizesUI = new PrizesUI(prizesContainer);
    addPrizeBtn.addEventListener('click', () => prizesUI.add());
    resultClose.addEventListener('click', () => hideResult(resultOverlay));
    participantsTA.value = '안병민*3, 홍민지*3, 김부장*4';
    participantsUI.refresh();

    // ── Three / Rapier ──────────────────────────────────────────
    showStatus('Three.js 씬 준비…');
    const { scene, camera, renderer } = createScene(canvas);
    STAGE('scene OK');

    showStatus('Rapier 물리엔진 로딩 (WASM)…');
    const { RAPIER, world } = await initPhysics();
    STAGE('physics OK');

    showStatus('트랙 생성…');
    const track = buildTrack({ scene, world, RAPIER });
    STAGE('track OK');

    const cameraDirector = new CameraDirector(camera);
    const leaderboard = new Leaderboard(leaderboardEl);
    STAGE('director + leaderboard OK');

    // ── 시뮬레이션 상태 ─────────────────────────────────────────
    let marbles = [];
    let running = false;
    let finishCount = 0;
    let eventQueue = new RAPIER.EventQueue(true);

    function clearMarbles() {
      for (const m of marbles) m.dispose();
      marbles = [];
      finishCount = 0;
      leaderboard.reset();
    }

    function spawnMarbles(defs) {
      clearMarbles();
      const startY = TRACK.topY - 1.2;
      const usableW = TRACK.width - 2;
      const cols = Math.min(defs.length, 8);
      defs.forEach((def, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x = -usableW / 2 + (usableW / Math.max(1, cols - 1)) * c + (Math.random() - 0.5) * 0.3;
        const y = startY + r * 1.4 + (Math.random() - 0.5) * 0.2;
        const z = (Math.random() - 0.5) * (TRACK.depth - 0.6);
        const m = createMarble({ scene, world, RAPIER, def, x, y, z });
        marbles.push(m);
      });
      STAGE(`구슬 ${defs.length}개 spawn`);
    }

    function handleCollisionEvents() {
      eventQueue.drainCollisionEvents((h1, h2, started) => {
        if (!started) return;
        const isFinish1 = h1 === track.finishColliderHandle;
        const isFinish2 = h2 === track.finishColliderHandle;
        if (!isFinish1 && !isFinish2) return;
        const otherHandle = isFinish1 ? h2 : h1;
        const m = marbles.find(mm => mm.colliderHandle === otherHandle);
        if (m && !m.finished) {
          m.finished = true;
          m.finishOrder = finishCount++;
          m.finishedAt = performance.now();
          STAGE(`결승 #${m.finishOrder + 1}: ${m.name}`);
        }
      });
    }

    let runStartTime = 0;
    function startRun() {
      const defs = participantsUI.getMarbles();
      if (defs.length === 0) {
        alert('참가자를 1명 이상 입력해주세요.');
        return;
      }
      hideResult(resultOverlay);
      spawnMarbles(defs);
      running = true;
      runStartTime = performance.now();
    }

    startBtn.addEventListener('click', startRun);
    resetBtn.addEventListener('click', () => {
      clearMarbles();
      running = false;
      hideResult(resultOverlay);
    });

    // 자동 시작 — 사용자가 즉시 동작 보도록 (한 번만)
    setTimeout(() => {
      hideStatus();
      STAGE('자동 시작');
      startRun();
    }, 400);

    // ── 메인 루프 ───────────────────────────────────────────────
    let lastT = performance.now();
    let resultShown = false;

    function loop() {
      requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      if (running) {
        world.step(eventQueue);
        handleCollisionEvents();
        track.tick(world.timestep);
        for (const m of marbles) m.sync();
        // 안전망 — 60초 후 결승 못한 구슬 강제 종료 (트랙 어딘가에 끼인 경우)
        const elapsed = (now - runStartTime) / 1000;
        if (elapsed > 60) {
          for (const m of marbles) {
            if (!m.finished) {
              m.finished = true;
              m.finishOrder = finishCount++;
              STAGE(`강제 종료: ${m.name} (안전망)`);
            }
          }
        }
      }

      cameraDirector.update(marbles, dt);

      if (marbles.length > 0) leaderboard.update(marbles);

      if (running && marbles.length > 0 && marbles.every(m => m.finished) && !resultShown) {
        resultShown = true;
        STAGE('전원 결승 통과 → 결과 카드');
        setTimeout(() => {
          showResult({
            overlayEl: resultOverlay, listEl: resultList,
            marbles, prizes: prizesUI.getPrizes(),
          });
          running = false;
        }, 1200);
      }
      if (!running || marbles.length === 0) resultShown = false;

      renderer.render(scene, camera);
    }

    STAGE('루프 시작');
    loop();
  } catch (err) {
    showError('초기화 실패', err);
  }
})();
