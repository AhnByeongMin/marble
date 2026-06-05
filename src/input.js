// 참가자/포상 입력 UI + 파서 — 50개 상한, "이름*N" 또는 "이름,N" 또는 "이름" 패턴

const MAX_MARBLES = 50;
const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e',
];

// "안병민*3, 홍민지*3\n김부장 5" 같은 textarea 입력을 [{name, count}] 로
export function parseParticipants(raw) {
  if (!raw) return [];
  // 줄바꿈/쉼표 모두 구분자
  const entries = raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  const out = [];
  for (const entry of entries) {
    // "이름*N" / "이름 N" / "이름,N" / "이름:N" 패턴
    const m = entry.match(/^(.+?)\s*[\*xX× :,]\s*(\d+)$/);
    let name, count;
    if (m) {
      name = m[1].trim();
      count = Math.max(1, Math.min(MAX_MARBLES, parseInt(m[2], 10) || 1));
    } else {
      // 숫자 없으면 1개 기본
      name = entry.trim();
      count = 1;
    }
    if (name) out.push({ name, count });
  }
  return out;
}

// 참가자 항목들을 개별 구슬 리스트로 펼침 — 50개 상한
export function expandToMarbles(participants) {
  const marbles = [];
  let colorIdx = 0;
  for (const p of participants) {
    for (let i = 0; i < p.count; i++) {
      if (marbles.length >= MAX_MARBLES) return marbles;
      marbles.push({
        id: marbles.length,
        name: p.name,
        color: PALETTE[colorIdx % PALETTE.length],
      });
      colorIdx++;
    }
  }
  return marbles;
}

// ── 포상 입력 UI — 가변 추가/제거 ──────────────────────────────
export class PrizesUI {
  constructor(container) {
    this.container = container;
    this.items = [{ text: '치킨 기프티콘' }]; // 기본 1등 1개
    this.render();
  }
  add() {
    this.items.push({ text: '' });
    this.render();
  }
  remove(idx) {
    this.items.splice(idx, 1);
    this.render();
  }
  getPrizes() {
    return this.items.map(it => it.text || '');
  }
  render() {
    this.container.innerHTML = '';
    this.items.forEach((it, idx) => {
      const row = document.createElement('div');
      row.className = 'prize-row';
      row.innerHTML = `
        <span class="prize-rank">${idx + 1}등</span>
        <input type="text" placeholder="당첨 내용 (예: 치킨)" />
        <button type="button" class="remove-btn" title="제거">×</button>
      `;
      const input = row.querySelector('input');
      input.value = it.text;
      input.addEventListener('input', e => { it.text = e.target.value; });
      row.querySelector('.remove-btn').addEventListener('click', () => this.remove(idx));
      this.container.appendChild(row);
    });
  }
}

// ── 참가자 입력 UI ────────────────────────────────────────────
export class ParticipantsUI {
  constructor({ textarea, addName, addCount, addBtn, summary }) {
    this.textarea = textarea;
    this.addName = addName;
    this.addCount = addCount;
    this.summary = summary;
    addBtn.addEventListener('click', () => this.addOne());
    this.textarea.addEventListener('input', () => this.refresh());
    this.refresh();
  }
  addOne() {
    const name = this.addName.value.trim();
    const count = Math.max(1, parseInt(this.addCount.value, 10) || 1);
    if (!name) return;
    const prev = this.textarea.value.trim();
    const entry = count > 1 ? `${name}*${count}` : name;
    this.textarea.value = prev ? `${prev}, ${entry}` : entry;
    this.addName.value = '';
    this.addCount.value = '1';
    this.refresh();
  }
  refresh() {
    const list = expandToMarbles(parseParticipants(this.textarea.value));
    const overflow = parseParticipants(this.textarea.value)
      .reduce((s, p) => s + p.count, 0) > MAX_MARBLES;
    this.summary.textContent = `참가자 ${list.length}명` + (overflow ? ` (50개 상한 적용)` : '');
    this.summary.style.color = overflow ? '#fbbf24' : '';
  }
  getMarbles() {
    return expandToMarbles(parseParticipants(this.textarea.value));
  }
}

export { MAX_MARBLES };
