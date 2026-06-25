import { BG_INFO } from '../theme.js';

export function makeStage(root, backgrounds, playback = null) {
  const stage = root.querySelector('#stage');
  const box = root.querySelector('#textbox');
  const nameEl = root.querySelector('#name');
  const lineEl = root.querySelector('#line');

  // Asset-hint chip — shows the expected background image filename + 설명 so you
  // can tell which image each scene needs while playing. If the real image
  // (images/bg/bg_<key>.png) exists it loads; otherwise the solid placeholder
  // stays. Toggle off via 설정 → 에셋 힌트 (adds .hide-asset-hints on #game).
  const hintEl = document.createElement('div');
  hintEl.className = 'bg-hint bg-hint--hidden';
  stage.appendChild(hintEl);

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function renderTags(text) {
    return escapeHtml(text)
      .replace(/\{w=[\d.]+\}/g, '')
      .replace(/\{p\}/g, '\n')
      .replace(/\{i\}/g, '<em>')
      .replace(/\{\/i\}/g, '</em>');
  }

  // Relative-luminance guard: cream textbox (#fff7f0) has luminance ~0.96.
  // If a character colour is too light (luminance > 0.65), it won't be legible
  // on cream, so we override it to --ink (#5a4a55) which has ~4.5:1 contrast.
  function legibleNameColor(hex) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex || '#eef0f6';
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    // sRGB linearise
    const lin = v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.65 ? '#5a4a55' : hex;  // #5a4a55 = var(--ink)
  }

  return {
    scene({ bg }) {
      if (!bg) return;
      if (backgrounds[bg]) stage.style.backgroundColor = backgrounds[bg];
      stage.style.backgroundImage = 'none';   // reset; restored on image load
      const info = BG_INFO[bg];
      const real = !info || info.real !== false;   // black/white flashes → no asset
      if (real && /^\w+$/.test(bg)) {
        const file = 'bg_' + bg;
        const path = 'images/bg/' + file + '.png';
        const img = new Image();
        img.onload = () => { stage.style.backgroundImage = `url("${path}")`; };
        img.onerror = () => {};                 // keep solid placeholder
        img.src = path;
        hintEl.textContent = file + '.png · ' + (info ? info.desc : bg);
        hintEl.classList.remove('bg-hint--hidden');
      } else {
        hintEl.classList.add('bg-hint--hidden'); // 연출(암전/플래시) → 힌트 숨김
      }
    },
    say(a) {
      // Record history before showing
      if (playback) playback.pushHistory({ who: a.who, name: a.name, text: a.text });

      return new Promise(resolve => {
        box.classList.remove('hidden');
        nameEl.textContent = a.name || '';
        nameEl.style.color = legibleNameColor(a.color);
        nameEl.style.display = a.name ? 'block' : 'none';
        lineEl.innerHTML = renderTags(a.text);

        let resolved = false;
        let autoTimer = null;

        function finish(fromClick) {
          if (resolved) return;
          resolved = true;
          if (autoTimer !== null) { clearTimeout(autoTimer); autoTimer = null; }
          box.removeEventListener('click', onAdv);
          document.removeEventListener('keydown', onAdv);
          // If user clicked while in skip/auto, return to normal
          if (fromClick && playback && (playback.isSkip() || playback.isAuto())) {
            playback.setMode('normal');
          }
          resolve();
        }

        const onAdv = (e) => {
          if (e.type === 'keydown' && !['Enter', ' '].includes(e.key)) return;
          finish(true);
        };

        if (playback && playback.isSkip()) {
          // Skip mode: auto-resolve after tiny delay; click cancels skip and resolves
          box.addEventListener('click', onAdv);
          document.addEventListener('keydown', onAdv);
          autoTimer = setTimeout(() => finish(false), 30);
        } else if (playback && playback.isAuto()) {
          // Auto mode: resolve after autoDelay; click resolves immediately and returns to normal
          box.addEventListener('click', onAdv);
          document.addEventListener('keydown', onAdv);
          autoTimer = setTimeout(() => finish(false), playback.autoDelay(a.text));
        } else {
          // Normal mode: wait for click/Enter/Space
          box.addEventListener('click', onAdv);
          document.addEventListener('keydown', onAdv);
        }
      });
    },
    waitAdvance() {
      return new Promise(resolve => {
        const onAdv = (e) => {
          if (e.type === 'keydown' && !['Enter', ' '].includes(e.key)) return;
          stage.removeEventListener('click', onAdv); document.removeEventListener('keydown', onAdv);
          resolve();
        };
        stage.addEventListener('click', onAdv); document.addEventListener('keydown', onAdv);
      });
    },
  };
}
