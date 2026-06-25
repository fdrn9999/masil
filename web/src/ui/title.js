// title.js — pastel title / main-menu screen for 마실
// Usage: makeTitle(root, { hasContinue, onNew, onContinue, onLoad, onSettings }) → { show(), hide() }
// Full-cover layer (#title-layer), z-index above game UI.
// Escape key does nothing on the title (it is the root entry point).

export function makeTitle(root, { hasContinue, onNew, onContinue, onLoad, onSettings }) {
  // ── Create or reuse layer ───────────────────────────────────────────────────
  let layer = root.querySelector('#title-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'title-layer';
    root.appendChild(layer);
  }

  // ── Build inner HTML ────────────────────────────────────────────────────────
  // Safety note: this innerHTML contains ONLY static string literals and one
  // boolean-derived attribute ('disabled' or '').  No user-supplied or
  // external data is interpolated, so there is no XSS surface here.
  const continueDisabled = hasContinue ? '' : 'disabled';
  const continueClass    = hasContinue ? 'title-btn title-btn--continue' : 'title-btn title-btn--continue title-btn--disabled';

  layer.innerHTML = `
    <div class="title-bg">
      <div class="title-panel">
        <div class="title-logo-wrap">
          <img
            src="title-logo.svg"
            alt="오픈챗에서 만나요"
            class="title-logo-img"
            draggable="false"
          >
          <p class="title-subtitle">(가제) · 마실</p>
        </div>

        <nav class="title-nav" aria-label="메인 메뉴">
          <button class="title-btn title-btn--new"      id="title-btn-new">새로하기</button>
          <button class="${continueClass}" id="title-btn-continue" ${continueDisabled}>이어하기</button>
          <button class="title-btn title-btn--load"     id="title-btn-load">불러오기</button>
          <button class="title-btn title-btn--settings" id="title-btn-settings">설정</button>
        </nav>

        <p class="title-version">ver. Milestone-4</p>
      </div>
    </div>
  `;

  // ── Wire buttons ────────────────────────────────────────────────────────────
  layer.querySelector('#title-btn-new').addEventListener('click', () => {
    onNew && onNew();
  });

  const continueBtn = layer.querySelector('#title-btn-continue');
  if (hasContinue) {
    continueBtn.addEventListener('click', () => {
      onContinue && onContinue();
    });
  }

  layer.querySelector('#title-btn-load').addEventListener('click', () => {
    onLoad && onLoad();
  });

  layer.querySelector('#title-btn-settings').addEventListener('click', () => {
    onSettings && onSettings();
  });

  // Escape key intentionally does nothing on the title screen.

  // ── Public API ──────────────────────────────────────────────────────────────
  function show() {
    layer.classList.remove('hidden');
  }

  function hide() {
    layer.classList.add('hidden');
  }

  return { show, hide };
}
