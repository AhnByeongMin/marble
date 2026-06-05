// 결과 카드 — 순위별 이름 + 당첨내용, 1등 강조. confetti (vanilla canvas).

export function showResult({ overlayEl, listEl, marbles, prizes }) {
  const finished = [...marbles].filter(m => m.finished).sort((a, b) => a.finishOrder - b.finishOrder);
  const incomplete = marbles.filter(m => !m.finished);
  const all = [...finished, ...incomplete];

  const cap = Math.max(prizes.length, 5);
  const top = all.slice(0, cap);

  listEl.innerHTML = '';
  top.forEach((m, idx) => {
    const rank = idx + 1;
    const prize = prizes[idx] || '';
    const li = document.createElement('li');
    li.className = `rank-${rank}` + (rank === 1 ? ' winner' : '');
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
    li.innerHTML = `
      <span class="rank-badge">${medal}</span>
      <span class="result-name">
        <span class="swatch" style="background:${m.color};box-shadow:0 0 12px ${m.color}"></span>
        ${escapeHtml(m.name)}
      </span>
      <span class="prize">${prize ? escapeHtml(prize) : '<i>—</i>'}</span>
    `;
    listEl.appendChild(li);
    // stagger 페이드인
    li.style.opacity = '0';
    li.style.transform = 'translateY(20px)';
    setTimeout(() => {
      li.style.transition = 'opacity 0.5s ease-out, transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
      li.style.opacity = '';
      li.style.transform = '';
    }, 80 * idx + 60);
  });

  overlayEl.classList.remove('hidden');
}

export function hideResult(overlayEl) {
  overlayEl.classList.add('hidden');
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Confetti — vanilla canvas, 의존성 없이 ─────────────────────
let confettiCanvas = null;
let confettiCtx = null;
let confettiParticles = [];
let confettiRaf = null;

function ensureConfettiCanvas() {
  if (confettiCanvas) return;
  confettiCanvas = document.createElement('canvas');
  confettiCanvas.style.cssText = `
    position: fixed; inset: 0; pointer-events: none; z-index: 25;
  `;
  document.body.appendChild(confettiCanvas);
  confettiCtx = confettiCanvas.getContext('2d');
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    confettiCanvas.width = window.innerWidth * dpr;
    confettiCanvas.height = window.innerHeight * dpr;
    confettiCanvas.style.width = window.innerWidth + 'px';
    confettiCanvas.style.height = window.innerHeight + 'px';
    confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  window.addEventListener('resize', resize);
  resize();
}

const CONFETTI_COLORS = ['#ef4444','#f59e0b','#eab308','#22c55e','#06b6d4','#6366f1','#8b5cf6','#ec4899','#fbbf24'];

export function fireConfetti() {
  ensureConfettiCanvas();
  const W = window.innerWidth, H = window.innerHeight;
  // 두 곳에서 발사 — 왼쪽 아래, 오른쪽 아래
  const sources = [
    { x: W * 0.15, y: H * 0.95, angleBase: -Math.PI / 3 },     // 좌측 → 우상
    { x: W * 0.85, y: H * 0.95, angleBase: -2 * Math.PI / 3 }, // 우측 → 좌상
  ];
  for (const src of sources) {
    for (let i = 0; i < 80; i++) {
      const angle = src.angleBase + (Math.random() - 0.5) * 0.8;
      const speed = 14 + Math.random() * 10;
      confettiParticles.push({
        x: src.x, y: src.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.4,
        size: 6 + Math.random() * 6,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        life: 0,
        maxLife: 180 + Math.random() * 80,
        shape: Math.random() < 0.5 ? 'rect' : 'circ',
      });
    }
  }
  if (!confettiRaf) confettiLoop();
}

function confettiLoop() {
  const ctx = confettiCtx;
  const W = window.innerWidth, H = window.innerHeight;
  ctx.clearRect(0, 0, W, H);
  for (const p of confettiParticles) {
    p.life++;
    p.vy += 0.35;       // gravity
    p.vx *= 0.995;
    p.x += p.vx * 0.5;
    p.y += p.vy * 0.5;
    p.rot += p.vrot;
    const alpha = Math.max(0, 1 - p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.shape === 'rect') {
      ctx.fillRect(-p.size/2, -p.size/3, p.size, p.size * 0.6);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size/2, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }
  confettiParticles = confettiParticles.filter(p => p.life < p.maxLife && p.y < H + 30);
  if (confettiParticles.length > 0) {
    confettiRaf = requestAnimationFrame(confettiLoop);
  } else {
    ctx.clearRect(0, 0, W, H);
    confettiRaf = null;
  }
}
