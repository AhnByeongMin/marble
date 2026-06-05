// 실시간 순위 — 매 프레임 구슬 y 정렬, finishOrder 우선, DOM 동기화 + transition

export class Leaderboard {
  constructor(listEl) {
    this.el = listEl;
    this.rows = new Map(); // marble.id → <li>
  }

  reset() {
    this.el.innerHTML = '';
    this.rows.clear();
  }

  // marbles 배열 받아 순위 재계산 + DOM 업데이트
  update(marbles) {
    // 정렬 — 결승선 통과한 구슬 먼저 (finishOrder 오름차순), 미완 구슬은 y 작을수록 앞 (낮을수록 결승 가까움)
    const sorted = [...marbles].sort((a, b) => {
      if (a.finished && b.finished) return a.finishOrder - b.finishOrder;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return a.rb.translation().y - b.rb.translation().y;
    });

    // DOM — 기존 li 없으면 생성, 있으면 위치만 갱신 (transform translateY 로 transition)
    sorted.forEach((m, idx) => {
      let li = this.rows.get(m.id);
      if (!li) {
        li = document.createElement('li');
        li.innerHTML = `
          <span class="rank"></span>
          <span class="swatch" style="background:${m.color}; color:${m.color}"></span>
          <span class="name"></span>
        `;
        li.querySelector('.name').textContent = m.name;
        this.rows.set(m.id, li);
        this.el.appendChild(li);
      }
      li.querySelector('.rank').textContent = `${idx + 1}`;
      li.classList.toggle('finished', m.finished);
      // 부드러운 재정렬 — FLIP 없이 그냥 DOM 순서 재배치 (CSS transition 으로 위치 보간은 어렵지만,
      // 일단 단순 ol 순서 변경 + 향후 FLIP 적용 여지)
      const desiredIdx = idx;
      const currentIdx = Array.from(this.el.children).indexOf(li);
      if (currentIdx !== desiredIdx) {
        // 정확한 위치로 이동
        const refNode = this.el.children[desiredIdx] || null;
        this.el.insertBefore(li, refNode);
      }
    });
  }
}
