import { BG_INFO } from '../theme.js';
import { renderTags } from './tags.js';

export function makeStage(root, backgrounds, playback = null) {
  const game = root;                       // #game (unified advance surface)
  const stage = root.querySelector('#stage');
  const box = root.querySelector('#textbox');
  const nameEl = root.querySelector('#name');
  const lineEl = root.querySelector('#line');
  const cueEl = root.querySelector('#advance-cue');   // blinking "tap to continue"

  function showCue() { if (cueEl) cueEl.classList.remove('hidden'); }
  function hideCue() { if (cueEl) cueEl.classList.add('hidden'); }

  // A click on any interactive layer must NOT advance the line beneath it.
  function isUiClick(t) {
    return !!(t && t.closest && t.closest(
      '#choices, #overlay, #chat, #toast, #title-layer, #sysmenu-bar, ' +
      '#backlog-layer, .ph-layer, .st-layer, .sl-layer, .phone-btn, .settings-btn'));
  }

  // Asset-hint chip — shows the expected background image PATH + 설명 (PC/mobile split).
  const hintEl = document.createElement('div');
  hintEl.className = 'bg-hint bg-hint--hidden';
  stage.appendChild(hintEl);

  // device dir: 세로(모바일)=mobile, 가로(PC)=pc
  function deviceDir() {
    return (typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(orientation: portrait)').matches) ? 'mobile' : 'pc';
  }

  let _curBg = null;
  let _curDir = null;

  function applyBg(bg) {
    if (backgrounds[bg]) stage.style.backgroundColor = backgrounds[bg];
    stage.style.backgroundImage = 'none';
    const info = BG_INFO[bg];
    const real = !info || info.real !== false;   // black/white flashes → no asset
    if (real && /^\w+$/.test(bg)) {
      const dir = deviceDir();
      _curDir = dir;
      const path = 'images/bg/' + dir + '/bg_' + bg + '.png';
      const img = new Image();
      img.onload = () => { stage.style.backgroundImage = `url("${path}")`; };
      img.onerror = () => {};                     // keep solid placeholder
      img.src = path;
      hintEl.textContent = path + ' · ' + (info ? info.desc : bg);
      hintEl.classList.remove('bg-hint--hidden');
    } else {
      hintEl.classList.add('bg-hint--hidden');    // 연출(암전/플래시)
    }
  }

  // PC↔모바일 회전 시 현재 배경을 해당 기기용 이미지로 다시 로드
  if (typeof window !== 'undefined') {
    const reapply = () => { if (_curBg && deviceDir() !== _curDir) applyBg(_curBg); };
    window.addEventListener('orientationchange', reapply);
    window.addEventListener('resize', reapply);
  }

  // Relative-luminance guard: cream textbox — light character colours → --ink.
  function legibleNameColor(hex) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex || '#eef0f6';
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const lin = v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.65 ? '#5a4a55' : hex;
  }

  return {
    scene({ bg }) {
      if (!bg) return;
      _curBg = bg;
      applyBg(bg);
    },

    say(a) {
      if (playback) playback.pushHistory({ who: a.who, name: a.name, text: a.text });

      return new Promise(resolve => {
        box.classList.remove('hidden');
        nameEl.textContent = a.name || '';
        nameEl.style.color = legibleNameColor(a.color);
        nameEl.style.display = a.name ? 'block' : 'none';
        lineEl.innerHTML = renderTags(a.text);

        let resolved = false;
        let timer = null;
        const startedAt = Date.now();

        function cleanup() {
          if (timer !== null) { clearTimeout(timer); timer = null; }
          game.removeEventListener('click', onAdv);
          document.removeEventListener('keydown', onKey);
          hideCue();
        }
        function finish(fromClick) {
          if (resolved) return;
          resolved = true;
          cleanup();
          // A deliberate click during skip/auto stops it (and advances).
          if (fromClick && playback && (playback.isSkip() || playback.isAuto())) {
            playback.setMode('normal');
          }
          resolve();
        }
        function onAdv(e) {
          if (isUiClick(e.target)) return;   // taps on UI layers don't advance
          finish(true);
        }
        function onKey(e) {
          if (!['Enter', ' '].includes(e.key)) return;
          finish(true);
        }
        // tick re-reads playback mode each cycle → toggling 오토/스킵 mid-line takes effect.
        function tick() {
          if (resolved) return;
          if (playback && playback.isSkip()) { hideCue(); finish(false); return; }
          if (playback && playback.isAuto()) {
            hideCue();
            if (Date.now() - startedAt >= playback.autoDelay(a.text)) { finish(false); return; }
          } else {
            showCue();   // normal: invite a tap
          }
          timer = setTimeout(tick, 80);
        }

        game.addEventListener('click', onAdv);
        document.addEventListener('keydown', onKey);
        tick();   // skip finishes immediately; normal shows cue; auto counts down
      });
    },

    // Used by view.pause in NORMAL mode (skip/auto fast-forward handled in view_dom).
    waitAdvance() {
      return new Promise(resolve => {
        showCue();
        function done() {
          game.removeEventListener('click', onAdv);
          document.removeEventListener('keydown', onKey);
          hideCue();
          resolve();
        }
        function onAdv(e) { if (isUiClick(e.target)) return; done(); }
        function onKey(e) { if (!['Enter', ' '].includes(e.key)) return; done(); }
        game.addEventListener('click', onAdv);
        document.addEventListener('keydown', onKey);
      });
    },
  };
}
