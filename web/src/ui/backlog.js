/**
 * backlog.js — dialogue history overlay (non-blocking, pastel, leak-free Escape).
 *
 * Usage:
 *   const backlog = makeBacklog(root, { playback, characters });
 *   backlog.open();   // shows overlay; Escape or 닫기 closes it
 *
 * characters: { [who]: { color, name, ... } }  (from characters.json)
 */
import { renderTags } from './tags.js';

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

  // resolve a colour for a speaker name by matching characters.json
  function colorForName(name) {
    for (const k in characters) if (characters[k] && characters[k].name === name) return characters[k].color || null;
    return null;
  }

  // who/name → { label, color }. narration(독백)=no label; chat send(mc)=나.
  function displayInfo(who, name) {
    if (who === 'n') return { label: null, color: null };               // 나레이션/독백
    if (name) return { label: name, color: (who && characters[who]?.color) || colorForName(name) };
    if (who === 'mc') return { label: '나', color: null };               // 채팅 보낸 말(플레이어)
    if (who && characters[who]?.name) return { label: characters[who].name, color: characters[who].color || null };
    return { label: null, color: null };                                 // 식별 불가 → 독백 취급
  }

  // ── Build entry HTML for one history item ───────────────────────────────────
  function buildEntry({ who, name, text }) {
    const { label, color } = displayInfo(who, name);
    const nameHtml = label
      ? `<span class="bl-entry__name" ${color ? `style="color:${esc(color)}"` : ''}>${esc(label)}</span>`
      : '';

    return `
      <div class="bl-entry ${label ? '' : 'bl-entry--narration'}">
        ${nameHtml}
        <span class="bl-entry__text">${renderTags(text || '')}</span>
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
