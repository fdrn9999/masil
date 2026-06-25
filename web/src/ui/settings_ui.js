// settings_ui.js — pastel settings panel (music/sfx/brightness/vibration)
// Usage: makeSettingsUI(root, { settings, audio }).mountButton()
// Non-blocking: own #settings-layer, never touches the engine await chain.

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}

export function makeSettingsUI(root, { settings, audio }) {
  // Create the settings layer (own container, full-cover scrim)
  let layerEl = root.querySelector('#settings-layer');
  if (!layerEl) {
    layerEl = document.createElement('div');
    layerEl.id = 'settings-layer';
    layerEl.className = 'st-layer hidden';
    root.appendChild(layerEl);
  }

  // ── Settings button (⚙️) ────────────────────────────────────────────────────
  const btnEl = document.createElement('button');
  btnEl.className = 'settings-btn';
  btnEl.textContent = '⚙️';  // ⚙️
  btnEl.setAttribute('aria-label', '설정 열기');
  btnEl.onclick = () => open();

  // ── Lifecycle: keydown handler reference for cleanup ────────────────────────
  let _keyHandler = null;

  // ── Build panel HTML ─────────────────────────────────────────────────────────
  function _buildPanel() {
    const s = settings.all();
    // Convert 0..1 → 0..100 for slider display
    const musicPct  = Math.round(s.music      * 100);
    const sfxPct    = Math.round(s.sfx        * 100);
    // brightness 0.6..1.2 → slider 60..120
    const brightVal = Math.round(s.brightness * 100);
    const vibChecked = s.vibration ? 'checked' : '';

    return `
      <div class="st-panel" role="dialog" aria-label="설정">
        <div class="st-panel__header">
          <span class="st-panel__title">설정</span>
          <button class="st-panel__x" aria-label="닫기">&#x2715;</button>
        </div>

        <div class="st-row">
          <label class="st-label" for="st-music">음악</label>
          <div class="st-slider-wrap">
            <input class="st-slider" id="st-music" type="range" min="0" max="100" value="${esc(String(musicPct))}">
            <span class="st-val">${esc(String(musicPct))}</span>
          </div>
        </div>

        <div class="st-row">
          <label class="st-label" for="st-sfx">사운드</label>
          <div class="st-slider-wrap">
            <input class="st-slider" id="st-sfx" type="range" min="0" max="100" value="${esc(String(sfxPct))}">
            <span class="st-val">${esc(String(sfxPct))}</span>
          </div>
        </div>

        <div class="st-row">
          <label class="st-label" for="st-brightness">밝기</label>
          <div class="st-slider-wrap">
            <input class="st-slider" id="st-brightness" type="range" min="60" max="120" value="${esc(String(brightVal))}">
            <span class="st-val">${esc(String(brightVal))}</span>
          </div>
        </div>

        <div class="st-row st-row--toggle">
          <label class="st-label" for="st-vibration">진동</label>
          <label class="st-toggle" aria-label="진동 켜기/끄기">
            <input class="st-toggle__input" id="st-vibration" type="checkbox" ${vibChecked}>
            <span class="st-toggle__track"></span>
            <span class="st-toggle__thumb"></span>
          </label>
        </div>

        <div class="st-panel__close-row">
          <button class="st-close-btn">닫기</button>
        </div>
      </div>`;
  }

  // ── Wire controls after render ───────────────────────────────────────────────
  function _wirePanel() {
    const panel = layerEl.querySelector('.st-panel');
    if (!panel) return;

    // Music slider
    const musicSlider = panel.querySelector('#st-music');
    const musicVal    = panel.querySelector('#st-music + .st-val');
    if (musicSlider) {
      musicSlider.addEventListener('input', () => {
        const v = Number(musicSlider.value) / 100;
        settings.set('music', v);
        audio.refreshVolumes();
        if (musicVal) musicVal.textContent = musicSlider.value;
      });
    }

    // SFX slider
    const sfxSlider = panel.querySelector('#st-sfx');
    const sfxVal    = panel.querySelector('#st-sfx + .st-val');
    if (sfxSlider) {
      sfxSlider.addEventListener('input', () => {
        const v = Number(sfxSlider.value) / 100;
        settings.set('sfx', v);
        audio.refreshVolumes();
        if (sfxVal) sfxVal.textContent = sfxSlider.value;
      });
      // Preview click SE on release (pointerup / touchend)
      sfxSlider.addEventListener('pointerup', () => {
        audio.playSfx('se_click');
      });
      sfxSlider.addEventListener('touchend', () => {
        audio.playSfx('se_click');
      });
    }

    // Brightness slider (60..120 → 0.6..1.2)
    const brightSlider = panel.querySelector('#st-brightness');
    const brightVal    = panel.querySelector('#st-brightness + .st-val');
    if (brightSlider) {
      brightSlider.addEventListener('input', () => {
        const v = Number(brightSlider.value) / 100;
        settings.set('brightness', v);  // applyBrightness called inside set()
        if (brightVal) brightVal.textContent = brightSlider.value;
      });
    }

    // Vibration toggle
    const vibToggle = panel.querySelector('#st-vibration');
    if (vibToggle) {
      vibToggle.addEventListener('change', () => {
        const on = vibToggle.checked;
        settings.set('vibration', on);
        if (on) audio.vibrate(20);  // test buzz when turned ON
      });
    }

    // X close button
    const xBtn = panel.querySelector('.st-panel__x');
    if (xBtn) xBtn.onclick = () => close();

    // 닫기 close button
    const closeBtn = panel.querySelector('.st-close-btn');
    if (closeBtn) closeBtn.onclick = () => close();

    // Scrim click-to-close (click on backdrop but not panel)
    const scrim = layerEl.querySelector('.st-scrim');
    if (scrim) {
      scrim.addEventListener('click', e => {
        if (e.target === scrim) close();
      });
    }
  }

  // ── open ────────────────────────────────────────────────────────────────────
  function open() {
    layerEl.classList.remove('hidden');
    layerEl.innerHTML = `<div class="st-scrim">${_buildPanel()}</div>`;
    _wirePanel();

    // Attach Escape listener — remove on close to prevent leaks
    if (_keyHandler) {
      document.removeEventListener('keydown', _keyHandler);
    }
    _keyHandler = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', _keyHandler);
  }

  // ── close ───────────────────────────────────────────────────────────────────
  function close() {
    if (_keyHandler) {
      document.removeEventListener('keydown', _keyHandler);
      _keyHandler = null;
    }
    layerEl.classList.add('hidden');
    layerEl.innerHTML = '';
  }

  // ── mountButton ─────────────────────────────────────────────────────────────
  function mountButton() {
    root.appendChild(btnEl);
  }

  return { mountButton, open, close };
}
