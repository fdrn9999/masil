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

  // ── small builders ───────────────────────────────────────────────────────────
  function _toggle(id, label, on) {           // on/off 스위치
    return `
      <label class="st-toggle" aria-label="${esc(label)}">
        <input class="st-toggle__input" id="${esc(id)}" type="checkbox" ${on ? 'checked' : ''}>
        <span class="st-toggle__track"></span>
        <span class="st-toggle__thumb"></span>
      </label>`;
  }
  function _reset(keys, label) {               // ↺ 항목별 기본값 복원 (data-reset = 콤마구분 키)
    return `<button class="st-reset" data-reset="${esc(keys)}" aria-label="${esc(label)} 기본값으로" title="기본값으로">↺</button>`;
  }

  // ── Build panel HTML ─────────────────────────────────────────────────────────
  function _buildPanel() {
    const s = settings.all();
    // Convert 0..1 → 0..100 for slider display
    const musicPct  = Math.round(s.music      * 100);
    const sfxPct    = Math.round(s.sfx        * 100);
    // brightness 0.6..1.2 → slider 60..120
    const brightVal = Math.round(s.brightness * 100);

    return `
      <div class="st-panel" role="dialog" aria-label="설정">
        <div class="st-panel__header">
          <span class="st-panel__title">설정</span>
          <button class="st-panel__x" aria-label="닫기">&#x2715;</button>
        </div>

        <div class="st-row st-row--vol">
          <label class="st-label" for="st-music">음악</label>
          ${_toggle('st-music-on', '음악 켜기/끄기', s.musicOn)}
          <div class="st-slider-wrap ${s.musicOn ? '' : 'is-off'}">
            <input class="st-slider" id="st-music" type="range" min="0" max="100" value="${esc(String(musicPct))}" ${s.musicOn ? '' : 'disabled'}>
            <span class="st-val">${esc(String(musicPct))}</span>
          </div>
          ${_reset('musicOn,music', '음악')}
        </div>

        <div class="st-row st-row--vol">
          <label class="st-label" for="st-sfx">사운드</label>
          ${_toggle('st-sfx-on', '사운드 켜기/끄기', s.sfxOn)}
          <div class="st-slider-wrap ${s.sfxOn ? '' : 'is-off'}">
            <input class="st-slider" id="st-sfx" type="range" min="0" max="100" value="${esc(String(sfxPct))}" ${s.sfxOn ? '' : 'disabled'}>
            <span class="st-val">${esc(String(sfxPct))}</span>
          </div>
          ${_reset('sfxOn,sfx', '사운드')}
        </div>

        <div class="st-row st-row--vol">
          <label class="st-label" for="st-brightness">밝기</label>
          <div class="st-slider-wrap">
            <input class="st-slider" id="st-brightness" type="range" min="60" max="120" value="${esc(String(brightVal))}">
            <span class="st-val">${esc(String(brightVal))}</span>
          </div>
          ${_reset('brightness', '밝기')}
        </div>

        <div class="st-row st-row--toggle">
          <label class="st-label" for="st-vibration">진동</label>
          ${_toggle('st-vibration', '진동 켜기/끄기', s.vibration)}
          ${_reset('vibration', '진동')}
        </div>

        <div class="st-row st-row--toggle">
          <label class="st-label" for="st-asset-hints">에셋 힌트</label>
          ${_toggle('st-asset-hints', '에셋 힌트 켜기/끄기', s.assetHints)}
          ${_reset('assetHints', '에셋 힌트')}
        </div>

        <div class="st-panel__close-row">
          <button class="st-reset-all" aria-label="모든 설정 기본값으로">기본값으로 초기화</button>
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
      // Preview click SE on release (pointerup covers mouse/touch/pen — single fire)
      sfxSlider.addEventListener('pointerup', () => {
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

    // Music on/off toggle — 슬라이더 레벨은 유지, 효과 볼륨만 0/복원
    const musicOnToggle = panel.querySelector('#st-music-on');
    if (musicOnToggle) {
      musicOnToggle.addEventListener('change', () => {
        settings.set('musicOn', musicOnToggle.checked);
        audio.refreshVolumes();
        render();  // 슬라이더 활성/비활성 반영
      });
    }

    // SFX on/off toggle
    const sfxOnToggle = panel.querySelector('#st-sfx-on');
    if (sfxOnToggle) {
      sfxOnToggle.addEventListener('change', () => {
        const on = sfxOnToggle.checked;
        settings.set('sfxOn', on);
        audio.refreshVolumes();
        if (on) audio.playSfx('se_click');  // 켤 때 들리는지 미리듣기
        render();
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

    // 에셋 힌트 토글 — 배경 이미지 파일명 칩 표시/숨김
    const ahToggle = panel.querySelector('#st-asset-hints');
    if (ahToggle) {
      ahToggle.addEventListener('change', () => {
        settings.set('assetHints', ahToggle.checked);
      });
    }

    // 항목별 ↺ 기본값 복원
    panel.querySelectorAll('.st-reset').forEach(btn => {
      btn.addEventListener('click', () => {
        const keys = (btn.getAttribute('data-reset') || '').split(',').map(k => k.trim()).filter(Boolean);
        keys.forEach(k => settings.reset(k));
        audio.refreshVolumes();
        render();
      });
    });

    // 전체 기본값으로 초기화
    const resetAllBtn = panel.querySelector('.st-reset-all');
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', () => {
        settings.resetAll();
        audio.refreshVolumes();
        render();
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

  // ── render — (re)build panel + rewire; Escape lifecycle stays in open/close ──
  function render() {
    layerEl.innerHTML = `<div class="st-scrim">${_buildPanel()}</div>`;
    _wirePanel();
  }

  // ── open ────────────────────────────────────────────────────────────────────
  function open() {
    layerEl.classList.remove('hidden');
    render();

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
