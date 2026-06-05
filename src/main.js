// Marble Roulette 3D — 진입점. 입력 → preview → 카운트다운 → 시뮬 → 카메라/슬로우모션 → 결과.

const STAGE = (label) => console.log(`[marble] ${label}`);

// ── 글로벌 에러 핸들러 ─────────────────────────────────────────
const statusEl = document.getElementById('status');
const statusTextEl = document.getElementById('statusText');
function showStatus(text, isError = false) {
  statusTextEl.innerHTML = text;
  statusEl.classList.remove('hidden');
  statusEl.querySelector('.status-card').classList.toggle('error', isError);
}
function hideStatus() { statusEl.classList.add('hidden'); }
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

(async function main() {
  try {
    STAGE('init 시작');
    showStatus('모듈 로딩…');

    const { createScene } = await import('./scene.js');
    const { initPhysics } = await import('./physics.js');
    const { buildTrack, TRACK } = await import('./track.js');
    const { createMarble } = await import('./marble.js');
    const { Leaderboard } = await import('./leaderboard.js');
    const { CameraDirector } = await import('./camera-director.js');
    const { showResult, hideResult, fireConfetti } = await import('./result-screen.js');
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
    const countdownEl = document.getElementById('countdown');
    const flashEl = document.getElementById('flash');
    const panelToggle = document.getElementById('panelToggle');
    const panel = document.getElementById('panel');

    // ── 입력 UI ─────────────────────────────────────────────────
    const participantsUI = new ParticipantsUI({
      textarea: participantsTA, addName, addCount, addBtn, summary,
    });
    const prizesUI = new PrizesUI(prizesContainer);
    addPrizeBtn.addEventListener('click', () => prizesUI.add());
    resultClose.addEventListener('click', () => hideResult(resultOverlay));
    // 입력은 사용자가 — placeholder 힌트만. value 미리 채우지 않음.
    participantsUI.refresh();

    // 모바일 패널 토글
    panelToggle?.addEventListener('click', () => panel.classList.toggle('collapsed'));

    // ── Three / Rapier ──────────────────────────────────────────
    showStatus('Three.js 씬 준비…');
    const { scene, camera, renderer, composer } = createScene(canvas);
    STAGE('scene OK');

    showStatus('Rapier 물리엔진 로딩 (WASM)…');
    const { RAPIER, world } = await initPhysics();
    STAGE('physics OK');

    showStatus('트랙 생성…');
    const track = buildTrack({ scene, world, RAPIER });
    STAGE('track OK');

    const cameraDirector = new CameraDirector(camera);
    const leaderboard = new Leaderboard(leaderboardEl);

    // ── 시뮬 상태 ───────────────────────────────────────────────
    let marbles = [];
    let running = false;
    let finishCount = 0;
    let eventQueue = new RAPIER.EventQueue(true);
    let runStartTime = 0;
    let lastFinisherTime = 0;
    let firstFinisherCelebrated = false;
    let lastFinisherCelebrated = false;
    let timeScale = 1.0;         // 슬로우모션
    let timeScaleTarget = 1.0;
    let slowmoUntil = 0;

    function clearMarbles() {
      for (const m of marbles) m.dispose();
      marbles = [];
      finishCount = 0;
      firstFinisherCelebrated = false;
      lastFinisherCelebrated = false;
      timeScale = 1.0;
      timeScaleTarget = 1.0;
      leaderboard.reset();
    }

    function spawnMarbles(defs) {
      clearMarbles();
      const startY = TRACK.topY - 0.4;
      const usableW = TRACK.width - 2.5;
      const cols = Math.min(defs.length, 8);
      defs.forEach((def, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x = -usableW / 2 + (usableW / Math.max(1, cols - 1)) * c + (Math.random() - 0.5) * 0.3;
        const y = startY + r * 1.2 + (Math.random() - 0.5) * 0.15;
        const z = (Math.random() - 0.5) * (TRACK.depth - 0.6);
        const m = createMarble({ scene, world, RAPIER, def, x, y, z });
        marbles.push(m);
      });
      STAGE(`구슬 ${defs.length}개 spawn`);
    }

    function previewMarbles() {
      const defs = participantsUI.getMarbles();
      if (defs.length === 0) return;
      spawnMarbles(defs);
      track.gate.reset();
      // 안착시킴 — 30 step 돌려 게이트 위에서 정착
      for (let i = 0; i < 30; i++) {
        world.step(eventQueue);
        track.tick(world.timestep);
      }
      for (const m of marbles) m.sync();
      eventQueue.drainCollisionEvents(() => {});
    }

    // 결승선 + 범퍼 + 점핑패드 collision events
    function handleCollisionEvents() {
      eventQueue.drainCollisionEvents((h1, h2, started) => {
        if (!started) return;
        // 결승선
        const isFinish = h1 === track.finishColliderHandle || h2 === track.finishColliderHandle;
        if (isFinish) {
          const otherHandle = h1 === track.finishColliderHandle ? h2 : h1;
          const m = marbles.find(mm => mm.colliderHandle === otherHandle);
          if (m && !m.finished) {
            m.finished = true;
            m.finishOrder = finishCount++;
            m.finishedAt = performance.now();
            STAGE(`결승 #${m.finishOrder + 1}: ${m.name}`);
            lastFinisherTime = m.finishedAt;
            if (!firstFinisherCelebrated) {
              firstFinisherCelebrated = true;
              triggerSlowmo(800);
              triggerFlash();
            }
            if (marbles.every(mm => mm.finished) && !lastFinisherCelebrated) {
              lastFinisherCelebrated = true;
              triggerFlash(0.7, 400);
            }
          }
          return;
        }
        // 범퍼 — 닿은 구슬에 외향 임펄스 + 펄스 시각
        for (const handle of [h1, h2]) {
          if (track.bumperHandles.has(handle)) {
            const bumper = track.bumpers.find(b => b.colliderHandle === handle);
            const otherHandle = (h1 === handle) ? h2 : h1;
            const m = marbles.find(mm => mm.colliderHandle === otherHandle);
            if (bumper && m && !m.finished) {
              const t = m.rb.translation();
              const dx = t.x - bumper.x;
              const dy = t.y - bumper.y;
              const len = Math.max(0.5, Math.hypot(dx, dy));
              const force = 10;
              m.rb.applyImpulse({
                x: (dx / len) * force,
                y: (dy / len) * force * 0.7 + 1.5,  // 살짝 위로 bias
                z: (Math.random() - 0.5) * 0.5,
              }, true);
              bumper.bump();
            }
            return;
          }
        }
        // 점핑 패드 — 닿은 구슬 위로 큰 임펄스
        for (const handle of [h1, h2]) {
          if (track.jumpPadHandles.has(handle)) {
            const otherHandle = (h1 === handle) ? h2 : h1;
            const m = marbles.find(mm => mm.colliderHandle === otherHandle);
            if (m && !m.finished) {
              m.rb.applyImpulse({
                x: (Math.random() - 0.5) * 3,
                y: 9,
                z: (Math.random() - 0.5) * 1.5,
              }, true);
              track.jumpPad.bump();
            }
            return;
          }
        }
      });
    }

    // 슬로우모션 / 플래시 트리거
    function triggerSlowmo(durationMs = 600) {
      timeScaleTarget = 0.25;
      slowmoUntil = performance.now() + durationMs;
    }
    function triggerFlash(intensity = 0.4, durationMs = 250) {
      flashEl.style.transition = 'none';
      flashEl.style.opacity = String(intensity);
      // double rAF 로 css transition 안전하게
      requestAnimationFrame(() => requestAnimationFrame(() => {
        flashEl.style.transition = `opacity ${durationMs}ms ease-out`;
        flashEl.style.opacity = '0';
      }));
    }

    // ── stuck 감지 + nudge (점진적 강화: impulse → 큰 impulse → 텔레포트) ─
    // 매 30프레임 (~0.5초) 마다 결승 안 한 구슬 y 변화 측정.
    let nudgeFrameCount = 0;
    const lastYSnapshot = new Map();    // marble.id → y
    const stuckStreak = new Map();      // marble.id → 연속 stuck 횟수
    function nudgeStuckMarbles() {
      const newSnapshot = new Map();
      for (const m of marbles) {
        if (m.finished) continue;
        const y = m.rb.translation().y;
        newSnapshot.set(m.id, y);
        const prev = lastYSnapshot.get(m.id);
        if (prev === undefined) continue;
        const dy = prev - y;  // 0.5초 동안 떨어진 양 (양수가 정상)
        if (dy < 0.3) {
          // stuck — streak ++
          const streak = (stuckStreak.get(m.id) || 0) + 1;
          stuckStreak.set(m.id, streak);
          if (streak >= 3) {
            // 3회 누적 stuck — 텔레포트 위로 + 강한 impulse 리셋
            const newY = Math.min(y + 4, TRACK.topY - 2);
            m.rb.setTranslation({
              x: (Math.random() - 0.5) * (TRACK.width - 3),
              y: newY,
              z: (Math.random() - 0.5) * (TRACK.depth - 0.5),
            }, true);
            m.rb.setLinvel({ x: (Math.random()-0.5)*3, y: -2, z: (Math.random()-0.5)*1.5 }, true);
            m.rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
            stuckStreak.set(m.id, 0);
            STAGE(`텔레포트: ${m.name} (3회 stuck)`);
          } else {
            // 1-2회 stuck — random impulse 강하게
            m.rb.applyImpulse({
              x: (Math.random() - 0.5) * 8,
              y: 1.8 + Math.random() * 1.2,
              z: (Math.random() - 0.5) * 3,
            }, true);
            m.rb.applyTorqueImpulse({
              x: (Math.random() - 0.5) * 0.6,
              y: (Math.random() - 0.5) * 0.6,
              z: (Math.random() - 0.5) * 0.6,
            }, true);
          }
        } else {
          // 잘 떨어지는 중 — streak 리셋
          stuckStreak.set(m.id, 0);
        }
      }
      lastYSnapshot.clear();
      for (const [k, v] of newSnapshot) lastYSnapshot.set(k, v);
    }

    // ── 카운트다운 ──────────────────────────────────────────────
    async function countdown() {
      const steps = ['3', '2', '1', '출발!'];
      for (const s of steps) {
        countdownEl.textContent = s;
        countdownEl.classList.remove('hidden');
        countdownEl.classList.remove('pop');
        // double rAF — pop class 재트리거
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        countdownEl.classList.add('pop');
        await new Promise(r => setTimeout(r, 700));
      }
      countdownEl.classList.add('hidden');
    }

    // ── 시작 / 리셋 ─────────────────────────────────────────────
    async function startRun() {
      if (marbles.length === 0) {
        const defs = participantsUI.getMarbles();
        if (defs.length === 0) { alert('참가자를 1명 이상 입력해주세요.'); return; }
        spawnMarbles(defs);
        track.gate.reset();
      }
      hideResult(resultOverlay);
      startBtn.disabled = true;
      resetBtn.disabled = true;
      // 모바일 패널 자동 닫기 — 화면 잘 보이게
      panel.classList.add('collapsed');

      await countdown();

      track.gate.open();
      running = true;
      runStartTime = performance.now();
      nudgeFrameCount = 0;
      lastYSnapshot.clear();
      STAGE('▶ 출발 — 게이트 열림');
      startBtn.disabled = false;
      resetBtn.disabled = false;
    }

    startBtn.addEventListener('click', startRun);
    resetBtn.addEventListener('click', () => {
      clearMarbles();
      running = false;
      track.gate.reset();
      hideResult(resultOverlay);
      previewMarbles();
    });

    let previewTimer = null;
    participantsTA.addEventListener('input', () => {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => { if (!running) previewMarbles(); }, 300);
    });

    // ── 메인 루프 ───────────────────────────────────────────────
    let lastT = performance.now();
    let resultShown = false;

    function loop() {
      requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      // 슬로우모션 timeScale 보간
      if (now > slowmoUntil) timeScaleTarget = 1.0;
      timeScale += (timeScaleTarget - timeScale) * Math.min(1, dt * 6);

      if (running) {
        // 슬로우모션은 step 횟수 줄임 (간단 구현 — substeps 조절 안 함)
        // timeScale > 0.5 이면 매 frame step, 0.5 이하면 절반만 step
        const shouldStep = (timeScale >= 0.5) || (Math.random() < timeScale * 2);
        if (shouldStep) {
          world.step(eventQueue);
          handleCollisionEvents();
          track.tick(world.timestep);
          for (const m of marbles) m.sync();
          // stuck nudge — 90 step 마다
          if (++nudgeFrameCount % 90 === 0) nudgeStuckMarbles();
        }
        // 안전망 — 60초 후 끼인 구슬 강제 종료
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
          fireConfetti();
          running = false;
        }, 1400);
      }
      if (!running || marbles.length === 0) resultShown = false;

      if (composer) composer.render();
      else renderer.render(scene, camera);
    }

    STAGE('루프 시작');
    hideStatus();
    previewMarbles();
    loop();
  } catch (err) {
    showError('초기화 실패', err);
  }
})();
