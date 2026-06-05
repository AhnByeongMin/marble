// 실시간 순위 — FLIP 기법으로 부드러운 순위 변경 애니메이션
// finishOrder 우선, 미완성은 y 작을수록 앞 (낮을수록 결승 가까움)

export class Leaderboard {
  constructor(listEl) {
    this.el = listEl;
    this.rows = new Map();             // marble.id → <li>
    this.prevTop = new Map();          // marble.id → 이전 top 좌표 (FLIP)
    this.lastUpdate = 0;
  }

  reset() {
    this.el.innerHTML = '';
    this.rows.clear();
    this.prevTop.clear();
  }

  update(marbles) {
    // 정렬
    const sorted = [...marbles].sort((a, b) => {
      if (a.finished && b.finished) return a.finishOrder - b.finishOrder;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return a.rb.translation().y - b.rb.translation().y;
    });

    // 매 프레임 update 는 비싸므로 ~6 fps (167ms) 로 제한
    const now = performance.now();
    if (now - this.lastUpdate < 150) return;
    this.lastUpdate = now;

    // FIRST — 기존 위치 기록
    for (const li of this.rows.values()) {
      this.prevTop.set(li.dataset.mid, li.getBoundingClientRect().top);
    }

    // 새 li 생성 + DOM 재배치
    sorted.forEach((m, idx) => {
      let li = this.rows.get(m.id);
      if (!li) {
        li = document.createElement('li');
        li.dataset.mid = m.id;
        li.innerHTML = `
          <span class="rank"></span>
          <span class="swatch" style="background:${m.color};box-shadow:0 0 8px ${m.color}"></span>
          <span class="name"></span>
          <span class="medal"></span>
        `;
        li.querySelector('.name').textContent = m.name;
        this.rows.set(m.id, li);
        this.el.appendChild(li);
        this.prevTop.set(String(m.id), li.getBoundingClientRect().top);
      }
      const rankEl = li.querySelector('.rank');
      const medalEl = li.querySelector('.medal');
      rankEl.textContent = `${idx + 1}`;
      // 메달 — 1/2/3등 + 결승 표시
      if (m.finished) {
        if (idx === 0) medalEl.textContent = '🥇';
        else if (idx === 1) medalEl.textContent = '🥈';
        else if (idx === 2) medalEl.textContent = '🥉';
        else medalEl.textContent = '✓';
      } else medalEl.textContent = '';

      li.classList.toggle('finished', m.finished);
      li.classList.toggle('first', idx === 0 && m.finished);

      const desiredIdx = idx;
      const currentIdx = Array.from(this.el.children).indexOf(li);
      if (currentIdx !== desiredIdx) {
        const refNode = this.el.children[desiredIdx] || null;
        this.el.insertBefore(li, refNode);
      }
    });

    // LAST — 새 위치 측정 + INVERT (transform translate) → PLAY (transition)
    for (const li of this.rows.values()) {
      const newTop = li.getBoundingClientRect().top;
      const prev = this.prevTop.get(li.dataset.mid);
      if (prev !== undefined && Math.abs(newTop - prev) > 0.5) {
        const delta = prev - newTop;
        // 즉시 이전 위치로 이동 (transition 없이)
        li.style.transition = 'none';
        li.style.transform = `translateY(${delta}px)`;
        // 다음 프레임에 transform 해제 → 부드럽게 새 위치로
        requestAnimationFrame(() => {
          li.style.transition = 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)';
          li.style.transform = '';
        });
      }
    }
  }
}
