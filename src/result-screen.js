// 결과 화면 — 순위 + 이름 + 당첨내용 매핑

export function showResult({ overlayEl, listEl, marbles, prizes }) {
  // finishOrder 기준 정렬 (결승선 통과 순서)
  const finished = [...marbles]
    .filter(m => m.finished)
    .sort((a, b) => a.finishOrder - b.finishOrder);
  // 결승 못한 구슬은 finishOrder=Infinity 처리해서 뒤에
  const incomplete = marbles.filter(m => !m.finished);

  const all = [...finished, ...incomplete];

  // 상위 N등만 (prizes 길이 만큼). prizes 없으면 5위까지 기본.
  const cap = Math.max(prizes.length, 5);
  const top = all.slice(0, cap);

  listEl.innerHTML = '';
  top.forEach((m, idx) => {
    const rank = idx + 1;
    const prize = prizes[idx] || '';
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="rank">${rank}등</span>
      <span class="name">${escapeHtml(m.name)}</span>
      <span class="prize">${prize ? escapeHtml(prize) : ''}</span>
    `;
    listEl.appendChild(li);
  });

  overlayEl.classList.remove('hidden');
}

export function hideResult(overlayEl) {
  overlayEl.classList.add('hidden');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
