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
    this.items = [{ text: '' }]; // 기본 1등 1개 (빈 값, placeholder 만)
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
      const examples = ['예) 치킨 기프티콘', '예) 커피 쿠폰', '예) 5천원 상품권', '예) 음료수', '예) 사탕'];
      row.innerHTML = `
        <span class="prize-rank">${idx + 1}등</span>
        <input type="text" placeholder="${examples[idx % examples.length]}" />
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

// ── 템플릿 — 자주 쓰는 시나리오 미리 정의 ─────────────────────
export const TEMPLATES = [
  { id: 'weekday',  label: '월~금',     emoji: '📅', names: ['월요일', '화요일', '수요일', '목요일', '금요일'] },
  { id: 'weekall',  label: '월~일',     emoji: '🗓️', names: ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'] },
  { id: 'team',     label: 'A~D조',     emoji: '🏷️', names: ['A조', 'B조', 'C조', 'D조'] },
  { id: 'num10',    label: '1~10번',    emoji: '🔢', names: Array.from({length: 10}, (_, i) => `${i+1}번`) },
];

// ── 참가자 입력 UI — textarea + 템플릿 + 칩 리스트 ─────────────
export class ParticipantsUI {
  constructor({ textarea, addName, addCount, addBtn, summary, chipsContainer, templatesContainer }) {
    this.textarea = textarea;
    this.addName = addName;
    this.addCount = addCount;
    this.summary = summary;
    this.chips = chipsContainer;
    this.templates = templatesContainer;
    addBtn.addEventListener('click', () => this.addOne());
    this.textarea.addEventListener('input', () => this.refresh());
    this.renderTemplates();
    this.refresh();
  }

  renderTemplates() {
    if (!this.templates) return;
    this.templates.innerHTML = '';
    for (const t of TEMPLATES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'template-btn';
      btn.innerHTML = `<span class="t-emoji">${t.emoji}</span><span class="t-label">${t.label}</span>`;
      btn.title = t.names.join(', ');
      btn.addEventListener('click', () => this.applyTemplate(t));
      this.templates.appendChild(btn);
    }
  }

  applyTemplate(t) {
    // 중복 방지 — 이미 있는 이름은 추가 안 함
    const current = parseParticipants(this.textarea.value);
    const existing = new Set(current.map(p => p.name));
    const toAdd = t.names.filter(n => !existing.has(n));
    if (toAdd.length === 0) return;
    const prev = this.textarea.value.trim();
    const appended = toAdd.join(', ');
    this.textarea.value = prev ? `${prev}, ${appended}` : appended;
    this.refresh();
  }

  // 단건 추가 — 입력란 + 버튼
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

  // 항목 1개 제거 — 칩의 x 버튼이 호출
  removeEntry(idx) {
    const list = parseParticipants(this.textarea.value);
    list.splice(idx, 1);
    // 재구성 — "이름*N" 형태로 다시
    this.textarea.value = list.map(p => p.count > 1 ? `${p.name}*${p.count}` : p.name).join(', ');
    this.refresh();
  }

  // count 변경 (칩 안 +/− 버튼)
  setEntryCount(idx, delta) {
    const list = parseParticipants(this.textarea.value);
    if (!list[idx]) return;
    list[idx].count = Math.max(1, Math.min(MAX_MARBLES, list[idx].count + delta));
    this.textarea.value = list.map(p => p.count > 1 ? `${p.name}*${p.count}` : p.name).join(', ');
    this.refresh();
  }

  refresh() {
    const parsed = parseParticipants(this.textarea.value);
    const totalRequested = parsed.reduce((s, p) => s + p.count, 0);
    const marbles = expandToMarbles(parsed);
    const overflow = totalRequested > MAX_MARBLES;

    this.summary.innerHTML = `참가자 <strong>${marbles.length}명</strong>` +
      (overflow ? ` <span class="warn">· ${MAX_MARBLES}개 상한 적용</span>` : '');

    // 칩 렌더
    if (this.chips) {
      this.chips.innerHTML = '';
      if (parsed.length === 0) {
        this.chips.classList.add('empty');
      } else {
        this.chips.classList.remove('empty');
        parsed.forEach((p, idx) => {
          const chip = document.createElement('div');
          chip.className = 'chip';
          chip.innerHTML = `
            <span class="chip-name">${escapeHtml(p.name)}</span>
            <button type="button" class="chip-dec" title="-1">−</button>
            <span class="chip-count">×${p.count}</span>
            <button type="button" class="chip-inc" title="+1">+</button>
            <button type="button" class="chip-x" title="제거">×</button>
          `;
          chip.querySelector('.chip-dec').addEventListener('click', () => this.setEntryCount(idx, -1));
          chip.querySelector('.chip-inc').addEventListener('click', () => this.setEntryCount(idx, +1));
          chip.querySelector('.chip-x').addEventListener('click', () => this.removeEntry(idx));
          this.chips.appendChild(chip);
        });
      }
    }
  }

  getMarbles() {
    return expandToMarbles(parseParticipants(this.textarea.value));
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export { MAX_MARBLES };
