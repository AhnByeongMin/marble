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
    const { buildTrack, TRACK_SPECS: SPECS } = await import('./track.js');
    const { createMarble } = await import('./marble.js');
    const { Leaderboard } = await import('./leaderboard.js');
    const { CameraDirector } = await import('./camera-director.js');
    const { showResult, hideResult, fireConfetti } = await import('./result-screen.js');
    const { ParticipantsUI, PrizesUI } = await import('./input.js');
    const { MODE_LIST, getMode, MODES } = await import('./modes.js');
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
    const chipsEl = document.getElementById('chips');
    const prizeTemplatesEl = document.getElementById('prizeTemplates');
    const participantsUI = new ParticipantsUI({
      textarea: participantsTA, addName, addCount, addBtn, summary,
      chipsContainer: chipsEl,
    });
    const prizesUI = new PrizesUI(prizesContainer, prizeTemplatesEl);
    addPrizeBtn.addEventListener('click', () => prizesUI.add());
    resultClose.addEventListener('click', () => hideResult(resultOverlay));
    // 입력은 사용자가 — placeholder 힌트만. value 미리 채우지 않음.
    participantsUI.refresh();

    // 모바일 패널 토글
    panelToggle?.addEventListener('click', () => panel.classList.toggle('collapsed'));

    // ── 모드 + localStorage (모드만 저장, 입력은 매번 새로) ──
    // 사용자 요청: 기본값 미리 채우지 않음 — placeholder 만.
    const LS_KEY = 'marble.mode';
    function saveMode() {
      try { localStorage.setItem(LS_KEY, currentMode.id); } catch {}
    }
    function loadMode() {
      try { return localStorage.getItem(LS_KEY); } catch { return null; }
    }
    let currentMode = getMode(loadMode()) || MODES.CLASSIC;
    participantsUI.refresh();
    // saveState 별칭 (기존 호출 호환)
    const saveState = saveMode;

    const modesEl = document.getElementById('modes');
    function renderModes() {
      modesEl.innerHTML = '';
      for (const m of MODE_LIST) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mode-btn' + (m.id === currentMode.id ? ' active' : '');
        btn.innerHTML = `<span class="m-emoji">${m.emoji}</span><span class="m-label">${m.label}</span>`;
        btn.title = m.description;
        btn.addEventListener('click', () => {
          if (running) return;
          if (m.id === currentMode.id) return;
          // 트랙/카메라 다르면 reload (안전한 전환)
          currentMode = m;
          saveState();
          location.reload();
        });
        modesEl.appendChild(btn);
      }
    }
    renderModes();
    // 입력 변경 시 자동 저장
    participantsTA.addEventListener('input', saveState);
    // PrizesUI 의 input 도 — render 후 input listener 가 있음. 매번 wrapped 으로 saveState.
    const origPrizesRender = prizesUI.render.bind(prizesUI);
    prizesUI.render = function() {
      origPrizesRender();
      // 각 input 의 input 이벤트에 saveState 추가
      this.container.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', saveState);
      });
    };
    prizesUI.render();   // 이벤트 부착

    // ── Three / Rapier ──────────────────────────────────────────
    showStatus('Three.js 씬 준비…');
    const { scene, camera, renderer, composer } = createScene(canvas);
    STAGE('scene OK');

    showStatus('Rapier 물리엔진 로딩 (WASM)…');
    const { RAPIER, world } = await initPhysics();
    STAGE('physics OK');

    showStatus('트랙 생성…');
    const track = buildTrack({ scene, world, RAPIER, trackType: currentMode.trackType });
    STAGE(`track OK (${currentMode.trackType})`);
    // 모드별 spec
    const spec = SPECS[currentMode.trackType];

    const cameraDirector = new CameraDirector(camera, currentMode.cameraMode);
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
      // 형평성 1 — 순서 셔플
      const shuffled = [...defs];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      shuffled.forEach((def, i) => {
        let x, y, z;
        if (spec.type === 'race') {
          // 레이스 — W자 채널 시작 waypoint(-28, 5) 근처. Z 분산.
          const cols = Math.min(shuffled.length, 4);
          const c = i % cols;
          const r = Math.floor(i / cols);
          const zRange = spec.depth - 0.6;
          x = -27 + r * 0.8 + (Math.random() - 0.5) * 0.3;
          y = 5 + (Math.random() - 0.5) * 1.0;     // channel 가운데 (waypoint y=5 근처)
          z = -zRange/2 + (zRange / Math.max(1, cols - 1)) * c + (Math.random() - 0.5) * 0.2;
        } else {
          // 수직 — 트랙 거의 전체 폭으로 분산. 적은 인원 cluster 방지 핵심.
          const startY = spec.topY - 0.4;
          const usableW = spec.width - 3;             // 트랙 폭의 거의 전부 (11)
          const cols = Math.min(shuffled.length, 10);
          const c = i % cols;
          const r = Math.floor(i / cols);
          // 격자 + 큰 noise (±1.0) — 3명이라도 충분히 떨어진 위치
          x = -usableW / 2 + (usableW / Math.max(1, cols - 1)) * c + (Math.random() - 0.5) * 1.0;
          y = startY + r * 1.2 + (Math.random() - 0.5) * 0.3;
          z = (Math.random() - 0.5) * (spec.depth - 0.6);
        }
        const m = createMarble({ scene, world, RAPIER, def, x, y, z });
        marbles.push(m);
      });
      STAGE(`구슬 ${shuffled.length}개 spawn (${spec.type})`);
    }

    // 모드별 시작 임펄스 — race 는 X+ 방향으로 초기 추진
    function chaosImpulse() {
      const imp = currentMode.startImpulse;
      for (const m of marbles) {
        if (spec.type === 'race') {
          // 레이스 — X+ 방향 추진 + 약간의 좌우/상하 noise
          m.rb.applyImpulse({
            x: imp.x + Math.random() * imp.x * 0.4,
            y: imp.y + Math.random() * imp.y,
            z: (Math.random() - 0.5) * imp.z * 2,
          }, true);
        } else {
          // 수직 — 좌우 분산
          m.rb.applyImpulse({
            x: (Math.random() - 0.5) * imp.x * 2,
            y: imp.y + Math.random() * imp.y,
            z: (Math.random() - 0.5) * imp.z * 2,
          }, true);
        }
        m.rb.applyTorqueImpulse({
          x: (Math.random() - 0.5) * 0.4,
          y: (Math.random() - 0.5) * 0.4,
          z: (Math.random() - 0.5) * 0.4,
        }, true);
      }
    }

    function previewMarbles() {
      const defs = participantsUI.getMarbles();
      if (defs.length === 0) return;
      // preview 시 mode gravity 적용 — 안 그러면 default Rapier gravity
      world.gravity = currentMode.gravity || { x: 0, y: -28, z: 0 };
      spawnMarbles(defs);
      track.gate.reset();
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

    // ── cluster 감지 + 즉시 분리 임펄스 ─────────────────────────
    // 구슬 두 개가 1.0m 안에 있고 둘 다 거의 정지면 cluster — 즉시 양방향 분리.
    // stuck nudge (y 변화) 만으로 못 잡는 cluster 케이스 직격 해결.
    function breakClusters() {
      for (let i = 0; i < marbles.length; i++) {
        const a = marbles[i]; if (a.finished) continue;
        const at = a.rb.translation();
        const av = a.rb.linvel();
        const aSpeed = Math.hypot(av.x, av.y, av.z);
        for (let j = i+1; j < marbles.length; j++) {
          const b = marbles[j]; if (b.finished) continue;
          const bt = b.rb.translation();
          const bv = b.rb.linvel();
          const bSpeed = Math.hypot(bv.x, bv.y, bv.z);
          // 두 구슬 거리
          const dx = at.x - bt.x, dy = at.y - bt.y, dz = at.z - bt.z;
          const d = Math.hypot(dx, dy, dz);
          // cluster 조건: 가깝고 (1.0 이하) 둘 다 거의 정지 (속도 1 이하)
          // 진짜 cluster 만 잡음 — 거리 0.85m 이하 (구슬 지름 0.76 의 살짝 위) + 둘 다 0.8 이하 속도
          // 임펄스 약하게 (force 2.5) — 자연스럽게 분리, 격렬한 튕김 X
          if (d < 0.85 && aSpeed < 0.8 && bSpeed < 0.8) {
            const nx = d > 0.01 ? dx/d : (Math.random()-0.5);
            const ny = d > 0.01 ? dy/d : (Math.random()-0.5);
            const nz = d > 0.01 ? dz/d : 0;
            const FORCE = 2.5;
            a.rb.applyImpulse({ x: nx*FORCE, y: ny*FORCE + 0.5, z: nz*FORCE }, true);
            b.rb.applyImpulse({ x: -nx*FORCE, y: -ny*FORCE + 0.5, z: -nz*FORCE }, true);
          }
        }
      }
    }

    // ── stuck 감지 + nudge ────────────────────────────────────
    let nudgeFrameCount = 0;
    const lastSnapshot = new Map();     // marble.id → [x, y]
    const stuckStreak = new Map();      // marble.id → 연속 stuck 횟수
    function nudgeStuckMarbles() {
      const newSnapshot = new Map();
      for (const m of marbles) {
        if (m.finished) continue;
        const tr = m.rb.translation();
        const x = tr.x, y = tr.y;
        newSnapshot.set(m.id, [x, y]);
        const prev = lastSnapshot.get(m.id);
        if (prev === undefined) continue;
        // 진행 방향: vertical 은 y 감소(아래로), race 는 x 증가(우측으로)
        const progress = spec.type === 'race' ? (x - prev[0]) : (prev[1] - y);
        if (progress < 0.3) {
          // stuck — streak 누적. 텔레포트 없음 (사용자 혼란 원인).
          // impulse 만, streak 따라 점진적으로 강해짐 (1배 → 최대 4배).
          const streak = (stuckStreak.get(m.id) || 0) + 1;
          stuckStreak.set(m.id, streak);
          const factor = Math.min(streak, 4);   // 1, 2, 3, 4, 4, 4...
          m.rb.applyImpulse({
            x: (Math.random() - 0.5) * 3 * factor,
            y: 0.6 * factor,
            z: (Math.random() - 0.5) * 1.2 * factor,
          }, true);
          // 60초 안전망 (main loop) 이 최후 보루 — stuck 영원 안 됨
        } else {
          // 잘 떨어지는 중 — streak 리셋
          stuckStreak.set(m.id, 0);
        }
      }
      lastSnapshot.clear();
      for (const [k, v] of newSnapshot) lastSnapshot.set(k, v);
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

      // 모드별 gravity (race 는 X+ 추진 포함)
      world.gravity = currentMode.gravity || { x: 0, y: -28, z: 0 };
      if (track.applyMode) track.applyMode(currentMode);
      track.gate.open();
      // 형평성 — 게이트 열린 순간 모드별 임펄스
      chaosImpulse();
      running = true;
      runStartTime = performance.now();
      nudgeFrameCount = 0;
      lastSnapshot.clear();
      STAGE('▶ 출발 — 게이트 열림 + 카오스 임펄스');
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
          // stuck nudge + cluster 분리
          nudgeFrameCount++;
          if (nudgeFrameCount % 15 === 0) breakClusters();       // 0.25초 마다 cluster 즉시 분리
          if (nudgeFrameCount % 30 === 0) nudgeStuckMarbles();   // 0.5초 마다 stuck 검사
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
            reverseRanking: currentMode.reverseRanking,
            modeLabel: currentMode.label,
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
