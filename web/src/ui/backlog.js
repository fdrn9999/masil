/**
 * backlog.js — dialogue history overlay (non-blocking, pastel, leak-free Escape).
 *
 * Usage:
 *   const backlog = makeBacklog(root, { playback, characters });
 *   backlog.open();   // shows overlay; Escape or 닫기 closes it
 *
 * characters: { [who]: { color, name, ... } }  (from characters.json)
 */
export function makeBacklog(root, { playback, characters = {} }) {
  let layerEl = null;
  let _escHandler = null;

  // ── HTML escaping ───────────────────────────────────────────────────────────
  function esc(s) {
    return String(s ?? '').replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
    );
  }

  // ── Ensure layer element ────────────────────────────────────────────────────
  function ensureLayer() {
    if (!layerEl) {
      layerEl = document.createElement('div');
      layerEl.id = 'backlog-layer';
      layerEl.className = 'bl-layer hidden';
      root.appendChild(layerEl);
    }
    return layerEl;
  }

  // ── Build entry HTML for one history item ───────────────────────────────────
  function buildEntry({ who, name, text }) {
    const hasName = !!(name || who);
    const charColor = (who && characters[who]?.color) || null;

    const nameHtml = hasName
      ? `<span class="bl-entry__name" ${charColor ? `style="color:${esc(charColor)}"` : ''}>${esc(name || who)}</span>`
      : '';

    return `
      <div class="bl-entry ${hasName ? '' : 'bl-entry--narration'}">
        ${nameHtml}
        <span class="bl-entry__text">${esc(text || '')}</span>
      </div>`;
  }

  // ── Build full overlay HTML ─────────────────────────────────────────────────
  function buildPanel(history) {
    const entries = history.length > 0
      ? history.map(buildEntry).join('')
      : '<div class="bl-empty">아직 대사 기록이 없어요</div>';

    return `
      <div class="bl-scrim">
        <div class="bl-panel" role="dialog" aria-label="백로그">
          <div class="bl-panel__header">
            <span class="bl-panel__title">백로그</span>
            <button class="bl-panel__x" aria-label="닫기">&#x2715;</button>
          </div>
          <div class="bl-scroll" id="bl-scroll">
            ${entries}
          </div>
          <div class="bl-panel__footer">
            <button class="bl-close-btn">닫기</button>
          </div>
        </div>
      </div>`;
  }

  // ── close — remove listeners, hide ─────────────────────────────────────────
  function close() {
    if (_escHandler) {
      document.removeEventListener('keydown', _escHandler);
      _escHandler = null;
    }
    if (layerEl) {
      layerEl.classList.add('hidden');
      layerEl.innerHTML = '';
    }
  }

  // ── open ────────────────────────────────────────────────────────────────────
  function open() {
    const layer = ensureLayer();
    const history = playback.history();  // oldest→newest

    // Inject HTML
    layer.innerHTML = buildPanel(history);
    layer.classList.remove('hidden');

    // Scroll to bottom (newest entry)
    const scrollEl = layer.querySelector('#bl-scroll');
    if (scrollEl) {
      // After paint, scroll to bottom
      requestAnimationFrame(() => { scrollEl.scrollTop = scrollEl.scrollHeight; });
    }

    // Wire close buttons
    const xBtn = layer.querySelector('.bl-panel__x');
    const closeBtn = layer.querySelector('.bl-close-btn');
    const scrim = layer.querySelector('.bl-scrim');

    if (xBtn) xBtn.addEventListener('click', close);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (scrim) {
      scrim.addEventListener('click', e => {
        if (e.target === scrim) close();
      });
    }

    // Escape — remove-before-add for leak-free lifecycle
    if (_escHandler) document.removeEventListener('keydown', _escHandler);
    _escHandler = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', _escHandler);
  }

  return { open };
}
