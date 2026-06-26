// saveload.js — pastel save/load slot grid (6 slots + quick slot)
// Usage: makeSaveLoad(root, { state, engine, playback, audio }) → { open(mode) }
// mode ∈ 'save'|'load'. Returns a Promise that resolves when the panel closes.
// Non-blocking: never touches the engine await chain.
// LOAD path: always uses requestResume (sessionStorage flag + reload) — safe, no engine re-entry.

// ── Helpers ────────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}

// Friendly chapter names for known labels
const LABEL_NAMES = {
  episode1_full: '프롤로그 / Ep.1',
  episode2_full: 'Ep.2',
  episode3_full: 'Ep.3',
  episode4_full: 'Ep.4',
  epilogue:      '에필로그',
};

function labelName(label) {
  if (!label) return '';
  for (const [key, name] of Object.entries(LABEL_NAMES)) {
    if (label.startsWith(key)) return name;
  }
  return label;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Reload-resume: safe load from anywhere (avoids engine re-entry).
// pos is a peek result {label,ip,callStack,meta}; slotKey is 'quick' or a number (1-6).
// The slotKey is stored so boot() can call state.loadSlot(n) / state.loadQuick()
// to restore vars (peek does NOT restore vars; only _load does).
export function requestResume(pos, slotKey, varsSnapshot) {
  const payload = Object.assign({}, pos, slotKey !== undefined ? { _slotKey: slotKey } : {});
  if (varsSnapshot !== undefined) payload._vars = varsSnapshot;
  sessionStorage.setItem('masil.resumeOnLoad', JSON.stringify(payload));
  location.reload();
}

// Rollback: reload-resume carrying a vars snapshot (no slot key needed).
// boot() detects _vars and restores state.vars before resuming.
export function requestRollback(pos, vars) {
  requestResume(pos, undefined, vars);
}

// ── makeSaveLoad ───────────────────────────────────────────────────────────────
export function makeSaveLoad(root, { state, engine, playback, audio }) {
  // Own layer for the panel
  let layerEl = root.querySelector('#saveload-layer');
  if (!layerEl) {
    layerEl = document.createElement('div');
    layerEl.id = 'saveload-layer';
    layerEl.className = 'sl-layer hidden';
    root.appendChild(layerEl);
  }

  let _keyHandler = null;
  let _resolve = null;
  let _mode = 'save';
  let _armed = null, _armTimer = null;   // 채워진 슬롯 덮어쓰기 확인(tap-to-confirm) armed 키

  function clearArm() {
    if (_armTimer) { clearTimeout(_armTimer); _armTimer = null; }
    _armed = null;
    const c = layerEl.querySelector('.sl-card--confirm');
    if (c) c.classList.remove('sl-card--confirm');
  }

  // ── buildMeta: exported so view_dom can reuse ──────────────────────────────
  function buildMeta() {
    const pos = engine.position();
    const hist = playback.history();
    const last = hist.length > 0 ? hist[hist.length - 1] : null;
    return {
      label: pos.label,
      name:  last ? (last.name || last.who || '') : '',
      text:  last ? (last.text || '') : '',
      mc_name: (state.vars && state.vars.mc_name) ? state.vars.mc_name : '',
      time:  Date.now(),
    };
  }

  // ── Render a single slot card ──────────────────────────────────────────────
  function renderSlotCard(peek, index, isQuick) {
    const slotLabel = isQuick ? '퀵' : String(index);
    const isEmpty = !peek;

    if (isEmpty) {
      return `
        <div class="sl-card sl-card--empty" data-slot="${isQuick ? 'quick' : index}" data-filled="0">
          <div class="sl-card__slot-num">${esc(slotLabel)}</div>
          <div class="sl-card__empty">${_mode === 'save' ? '+ 여기에 저장' : '비어있음'}</div>
        </div>`;
    }

    const meta = peek.meta || {};
    const chapter = esc(labelName(meta.label || peek.label));
    const nameStr = esc(meta.name || '');
    const snippet = esc((meta.text || '').slice(0, 36) + ((meta.text || '').length > 36 ? '…' : ''));
    const mcName  = esc(meta.mc_name || '');
    const timeStr = esc(formatTime(meta.time));

    return `
      <div class="sl-card sl-card--filled" data-slot="${isQuick ? 'quick' : index}" data-filled="1">
        <div class="sl-card__slot-num">${esc(slotLabel)}</div>
        <div class="sl-card__chapter">${chapter}</div>
        ${nameStr ? `<div class="sl-card__name">${nameStr}</div>` : ''}
        ${snippet  ? `<div class="sl-card__snippet">"${snippet}"</div>` : ''}
        <div class="sl-card__footer">
          ${mcName ? `<span class="sl-card__mc">${mcName}</span>` : ''}
          <span class="sl-card__time">${timeStr}</span>
        </div>
      </div>`;
  }

  // ── Build full panel HTML ──────────────────────────────────────────────────
  function buildPanel() {
    const title = _mode === 'save' ? '저장하기' : '불러오기';
    const quickPeek = state.peekQuick();

    let cards = '';
    // Quick slot first
    cards += `<div class="sl-quick-wrap">${renderSlotCard(quickPeek, 0, true)}</div>`;

    // 6 numbered slots
    cards += '<div class="sl-grid">';
    for (let i = 1; i <= 6; i++) {
      cards += renderSlotCard(state.peekSlot(i), i, false);
    }
    cards += '</div>';

    return `
      <div class="sl-scrim">
        <div class="sl-panel" role="dialog" aria-label="${esc(title)}">
          <div class="sl-panel__header">
            <span class="sl-panel__title">${esc(title)}</span>
            <button class="sl-panel__x" aria-label="닫기">&#x2715;</button>
          </div>
          ${cards}
          <div class="sl-panel__close-row">
            <button class="sl-close-btn">닫기</button>
          </div>
        </div>
      </div>`;
  }

  // ── Re-render a single card in-place (after save) ─────────────────────────
  function rerenderCard(slotKey, isQuick) {
    const peek = isQuick ? state.peekQuick() : state.peekSlot(slotKey);
    const oldCard = layerEl.querySelector(`[data-slot="${isQuick ? 'quick' : slotKey}"]`);
    if (!oldCard) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = renderSlotCard(peek, slotKey, isQuick);
    const newCard = tmp.firstElementChild;
    // transfer click handler
    newCard.addEventListener('click', () => handleSlotClick(slotKey, isQuick, newCard));
    oldCard.replaceWith(newCard);
  }

  // ── Handle slot click ──────────────────────────────────────────────────────
  function handleSlotClick(slotKey, isQuick, cardEl) {
    const isFilled = cardEl.dataset.filled === '1';

    if (_mode === 'save') {
      const armKey = isQuick ? 'quick' : slotKey;
      // 채워진 슬롯 덮어쓰기는 되돌릴 수 없으므로 1탭 확인. 빈 슬롯은 즉시 저장.
      if (isFilled && _armed !== armKey) {
        clearArm();
        _armed = armKey;
        cardEl.classList.add('sl-card--confirm');
        overlay_toast('다시 탭하면 덮어써요');
        _armTimer = setTimeout(() => {
          if (_armed === armKey) { _armed = null; cardEl.classList.remove('sl-card--confirm'); }
        }, 2500);
        return;
      }
      clearArm();
      const pos = engine.position();
      const meta = buildMeta();
      if (isQuick) {
        state.saveQuick(pos, meta);
        audio && audio.playSfx && audio.playSfx('se_click');
        overlay_toast('저장했어요 (퀵)');
        rerenderCard(slotKey, true);
      } else {
        state.saveSlot(slotKey, pos, meta);
        audio && audio.playSfx && audio.playSfx('se_click');
        overlay_toast('저장했어요');
        rerenderCard(slotKey, false);
      }
    } else {
      // Load mode — only filled slots
      if (!isFilled) return;
      const peek = isQuick ? state.peekQuick() : state.peekSlot(slotKey);
      if (!peek) return;
      close();
      // Pass slotKey so boot() can restore vars via state.loadSlot / state.loadQuick
      requestResume(peek, isQuick ? 'quick' : slotKey);
    }
  }

  // ── Wire panel after inject ────────────────────────────────────────────────
  function wirePanel() {
    const panel = layerEl.querySelector('.sl-panel');
    if (!panel) return;

    // Close buttons
    const xBtn = panel.querySelector('.sl-panel__x');
    if (xBtn) xBtn.onclick = () => close();
    const closeBtn = panel.querySelector('.sl-close-btn');
    if (closeBtn) closeBtn.onclick = () => close();

    // Scrim click-to-close
    const scrim = layerEl.querySelector('.sl-scrim');
    if (scrim) {
      scrim.addEventListener('click', e => {
        if (e.target === scrim) close();
      });
    }

    // Slot cards
    panel.querySelectorAll('.sl-card').forEach(card => {
      const rawSlot = card.dataset.slot;
      const isQuick = rawSlot === 'quick';
      const slotKey = isQuick ? 'quick' : Number(rawSlot);
      card.addEventListener('click', () => handleSlotClick(slotKey, isQuick, card));
    });
  }

  // ── Toast helper (uses overlay toast if in DOM) ────────────────────────────
  function overlay_toast(text) {
    // Look for toast el injected by view_dom
    const toastEl = document.getElementById('toast');
    if (!toastEl) return;
    while (toastEl.children.length >= 3) toastEl.firstElementChild.remove();   // 스택 도배 방지
    const t = document.createElement('div');
    t.className = 'toast-item';
    t.textContent = text;
    t.classList.add('toast-enter');                                  // 엔진 토스트와 동일 페이드
    toastEl.appendChild(t);
    requestAnimationFrame(() => t.classList.remove('toast-enter'));
    setTimeout(() => { t.classList.add('toast-leaving'); setTimeout(() => t.remove(), 260); }, 3000);
  }

  // ── open ──────────────────────────────────────────────────────────────────
  function open(mode) {
    _mode = mode || 'save';
    return new Promise(resolve => {
      _resolve = resolve;
      layerEl.classList.remove('hidden');
      layerEl.classList.toggle('sl-mode-save', _mode === 'save');   // 저장 모드 빈 슬롯 활성화(CSS)
      layerEl.innerHTML = buildPanel();
      wirePanel();

      if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
      _keyHandler = e => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', _keyHandler);
    });
  }

  // ── close ─────────────────────────────────────────────────────────────────
  function close() {
    clearArm();
    if (_keyHandler) {
      document.removeEventListener('keydown', _keyHandler);
      _keyHandler = null;
    }
    layerEl.classList.add('hidden');
    layerEl.innerHTML = '';
    const r = _resolve;
    _resolve = null;
    if (r) r();
  }

  return { open, close, buildMeta };
}
