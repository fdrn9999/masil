// phone.js — 📱 폰 버튼 + 폰 메뉴 + 친구목록 / 추억함 / 갤러리 서브화면
// Usage: const phone = makePhone(root, { sys, state }); phone.mountButton();
// Non-blocking: lives in its own #phone-layer, never touches the engine await chain.

import { HEROINES, ITEMS, CHAT_AVATARS, ENDING_LIST } from '../theme.js';

// ── HTML-escape helper (same discipline as map.js/overlay.js) ──────────────
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}

// ── Avatar color for a character key ──────────────────────────────────────
// CHAT_AVATARS keys are Korean display names; we need lookup by key (id).
const KEY_TO_DISPLAY = { doyun: '도윤', seoa: '서아', jiu: '지우', mingyeol: '민결' };

function avatarColor(key) {
  const disp = KEY_TO_DISPLAY[key];
  return (disp && CHAT_AVATARS[disp]) || '#9aa0b3';
}

function avatarInitial(disp) {
  if (!disp || disp === '???') return '?';
  return disp[0];
}

// ── Build a 54×54 colored-initial avatar HTML ─────────────────────────────
function buildAvatar(disp, key, sz = 54) {
  const isSecret = disp === '???';
  const color    = isSecret ? '#9aa0b3' : avatarColor(key);
  const initial  = isSecret ? '?' : avatarInitial(disp);
  const fz       = Math.round(sz * 0.45);
  return `<div class="ph-avatar" style="width:${sz}px;height:${sz}px;background:${esc(color)};font-size:${fz}px;">${esc(initial)}</div>`;
}

// ── 친구목록 render ────────────────────────────────────────────────────────
function renderFriends(sys, state) {
  const v = state.vars;

  // Doyun row (always pinned)
  function friendRow(disp, key, top = false) {
    const isSecret = disp === '???';
    const subtitle = isSecret
      ? '…누군지 아직 모르는 이름'
      : esc(sys.rel_subtitle(key));
    const badge = top
      ? `<span class="ph-friend__badge">고정</span>`
      : '';
    return `
      <div class="ph-friend-row">
        ${buildAvatar(disp, key)}
        <div class="ph-friend-info">
          <div class="ph-friend-name-row">
            <span class="ph-friend-name">${esc(disp)}</span>
            ${badge}
          </div>
          <div class="ph-friend-subtitle">${subtitle}</div>
        </div>
      </div>`;
  }

  const heroineOrder = ['seoa', 'jiu', 'mingyeol'];
  let anyMet = false;
  let heroineRows = '';
  for (const k of heroineOrder) {
    if (sys.is_met(k)) {
      anyMet = true;
      heroineRows += friendRow(sys.hname(k), k);  // friendRow escapes internally
    }
  }

  // Easter-egg: doyun secret seen but mingyeol identity not yet revealed
  const showSecret =
    !sys.is_met('mingyeol') &&
    v.doyun_secret_seen &&
    !v.mingyeol_truth_known;
  if (showSecret) {
    heroineRows += friendRow('???', null);
  }

  const emptyState = !anyMet
    ? `<div class="ph-empty">아직 도윤 말곤 친구가 없다.</div>`
    : '';

  return `
    <div class="ph-panel ph-panel--light">
      <div class="ph-panel__title">마실 — 친구</div>
      ${friendRow('도윤', 'doyun', true)}
      <div class="ph-divider"></div>
      ${heroineRows}
      ${emptyState}
      <div class="ph-panel__close-row">
        <button class="ph-close-btn" data-action="close">닫기</button>
      </div>
    </div>`;
}

// ── 추억함 render ──────────────────────────────────────────────────────────
function renderMemory(sys, state) {
  const v = state.vars;
  const inventory  = v.inventory  || {};
  const item_flags = v.item_flags || {};

  const hasHeld  = Object.keys(inventory).length > 0;
  const flagKeys = Object.keys(item_flags).filter(k => k.endsWith('_given'));
  const hasFlags = flagKeys.length > 0;

  function memRow(icon, name, desc, tag) {
    return `
      <div class="ph-mem-row">
        <div class="ph-mem-icon">${esc(icon)}</div>
        <div class="ph-mem-body">
          <div class="ph-mem-nameline">
            <span class="ph-mem-name">${esc(name)}</span>
            <span class="ph-mem-tag">${esc(tag)}</span>
          </div>
          <div class="ph-mem-desc">${esc(desc)}</div>
        </div>
      </div>`;
  }

  let rows = '';

  // Section A: held items (no count)
  for (const iid of Object.keys(inventory)) {
    const it = ITEMS[iid] || { name: iid, icon: '❔', desc: '' };
    rows += memRow(it.icon, it.name, it.desc, '간직 중');
  }

  // Section B: given/used flags
  for (const key of flagKeys) {
    const iid = key.slice(0, -6); // strip "_given"
    const it  = ITEMS[iid] || { name: iid, icon: '❔', desc: '' };
    const v2  = item_flags[key];
    let towho = '';
    if (typeof v2 === 'string') {
      if (v2 in HEROINES) {
        towho = sys.hname(v2);
      } else if (v2 === 'doyun') {
        towho = '도윤';
      }
    }
    const tag = towho ? `→ ${towho} 에게` : '건넴';
    // towho is a display name from hname(); esc() is applied inside memRow on `tag`
    rows += memRow(it.icon, it.name, it.desc, tag);
  }

  const emptyState = (!hasHeld && !hasFlags)
    ? `<div class="ph-empty ph-empty--light">아직 담긴 추억이 없다.</div>`
    : '';

  return `
    <div class="ph-panel ph-panel--dark">
      <div class="ph-panel__title ph-panel__title--light">추억함</div>
      ${emptyState}
      ${rows}
      <div class="ph-panel__close-row">
        <button class="ph-close-btn" data-action="close">닫기</button>
      </div>
    </div>`;
}

// ── 갤러리 render ──────────────────────────────────────────────────────────
function renderGallery(sys, state) {
  const seen = state.persistent.endings_seen || [];
  const total = ENDING_LIST.length;
  const seenCount = seen.length;
  const allSeen = sys.all_endings_seen();

  let endingRows = '';
  for (const [key, title] of ENDING_LIST) {
    const isSeen = seen.includes(key);
    const bullet = isSeen ? '●' : '○';
    const bulletColor = isSeen ? '#2fb574' : '#555555';
    const label  = isSeen ? esc(title) : '??? — 아직 보지 못한 결말';
    const labelColor = isSeen ? '#ffffff' : '#666666';
    endingRows += `
      <div class="ph-gallery-row">
        <span class="ph-gallery-bullet" style="color:${bulletColor};">${bullet}</span>
        <span class="ph-gallery-label" style="color:${labelColor};">${label}</span>
      </div>`;
  }

  let footer = '';
  if (allSeen) {
    footer = `
      <div class="ph-gallery-footer">
        <div class="ph-gallery-all-star">★ 모든 결말을 본 당신에게</div>
        <div class="ph-gallery-doyun">도윤: "형, 끝까지 다 봐줬네. …고마워. 진짜로."</div>
      </div>`;
  } else {
    footer = `<div class="ph-gallery-cg">CG는 아트 추가 후 여기에 채워집니다.</div>`;
  }

  return `
    <div class="ph-panel ph-panel--gallery">
      <div class="ph-panel__title ph-panel__title--light">갤러리 — 엔딩 수집</div>
      <div class="ph-gallery-sub">${seenCount} / ${total} 발견</div>
      <div class="ph-gallery-list">
        ${endingRows}
      </div>
      ${footer}
      <div class="ph-panel__close-row">
        <button class="ph-close-btn" data-action="close">닫기</button>
      </div>
    </div>`;
}

// ── Phone menu render ──────────────────────────────────────────────────────
function renderMenu() {
  return `
    <div class="ph-menu-card">
      <div class="ph-menu-title">마실</div>
      <button class="ph-menu-entry" data-screen="masil_friends">👥 친구 목록</button>
      <button class="ph-menu-entry" data-screen="memory_box">🗃 추억함</button>
      <button class="ph-menu-entry" data-screen="gallery">🖼 갤러리</button>
      <button class="ph-menu-entry ph-menu-entry--close" data-action="close">닫기</button>
    </div>`;
}

// ── makePhone ──────────────────────────────────────────────────────────────
export function makePhone(root, { sys, state }) {
  // Create the phone layer (own container, never #overlay)
  let layerEl = root.querySelector('#phone-layer');
  if (!layerEl) {
    layerEl = document.createElement('div');
    layerEl.id = 'phone-layer';
    layerEl.className = 'ph-layer hidden';
    root.appendChild(layerEl);
  }

  // Create the phone button
  const btnEl = document.createElement('button');
  btnEl.className = 'phone-btn';
  btnEl.textContent = '📱';
  btnEl.setAttribute('aria-label', '폰 메뉴 열기');
  btnEl.onclick = () => open();

  // Sub-screen registry
  const registry = {
    masil_friends: renderFriends,
    memory_box:    renderMemory,
    gallery:       renderGallery,
  };

  function showMenu() {
    layerEl.classList.remove('hidden');
    // No data-action="close" on the scrim div — scrim-click-to-close is
    // handled by the e.target===scrim listener in wireActions (avoids
    // double close()). The 닫기 button keeps data-action="close".
    layerEl.innerHTML = `<div class="ph-scrim">${renderMenu()}</div>`;
    wireActions(layerEl, null);
  }

  function showScreen(id) {
    const renderFn = registry[id];
    if (!renderFn) { showMenu(); return; }
    layerEl.classList.remove('hidden');
    layerEl.innerHTML = `<div class="ph-scrim">${renderFn(sys, state)}</div>`;
    wireActions(layerEl, id);
  }

  function wireActions(el, currentScreenId) {
    // ── keydown lifecycle (root-cause fix) ──────────────────────────────
    // Each render replaces innerHTML and re-runs wireActions. Without
    // removing the prior handler first, listeners stack on `document`: a
    // stale (e.g. menu) Escape handler fires alongside the current one,
    // flicker-closing the phone, and listeners leak for the page lifetime.
    // Remove the previous handler before attaching exactly one new handler.
    if (el._keyHandler) {
      document.removeEventListener('keydown', el._keyHandler);
      el._keyHandler = null;
    }

    // Scrim click-to-close (only on the scrim itself, not the card).
    // The scrim div has NO data-action="close", so this is the single
    // close path for a scrim click (no double close()).
    const scrim = el.querySelector('.ph-scrim');
    if (scrim) {
      scrim.addEventListener('click', e => {
        if (e.target === scrim) close();
      });
    }

    // Navigate: sub-screen → back to menu; menu → close.
    function goBack() {
      if (currentScreenId) showMenu();
      else close();
    }

    // close buttons (닫기)
    el.querySelectorAll('[data-action="close"]').forEach(btn => {
      btn.onclick = goBack;
    });

    // menu entries
    el.querySelectorAll('[data-screen]').forEach(btn => {
      btn.onclick = () => showScreen(btn.getAttribute('data-screen'));
    });

    // Escape: same behavior as 닫기 — sub-screen → menu, menu → close.
    // Re-rendering (showMenu/close) removes this handler at the top of the
    // next wireActions / in close(); we don't remove it here to keep one
    // consistent ownership point.
    const onKey = e => { if (e.key === 'Escape') goBack(); };
    document.addEventListener('keydown', onKey);
    el._keyHandler = onKey;  // exactly one live handler at any time
  }

  function open() {
    showMenu();
  }

  function close() {
    if (layerEl._keyHandler) {
      document.removeEventListener('keydown', layerEl._keyHandler);
      layerEl._keyHandler = null;
    }
    layerEl.classList.add('hidden');
    layerEl.innerHTML = '';
  }

  function mountButton() {
    root.appendChild(btnEl);
  }

  // Allow external registration of additional sub-screens
  function register(id, fn) {
    registry[id] = fn;
  }

  return { mountButton, open, close, register, button: () => btnEl };
}
