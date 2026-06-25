import { BG_INFO } from '../theme.js';
import { makeTypewriter } from './typewriter.js';

export function makeStage(root, backgrounds, playback = null, typewriter = null) {
  const game = root;                       // #game (unified advance surface)
  const tw = typewriter || makeTypewriter(null);   // 폴백: 설정 없으면 기본 속도 타이핑
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
  // A keyboard advance has no click target/scrim — block it while a blocking
  // overlay (phone/backlog/save/settings/map) is open so the line behind it
  // doesn't silently advance (+autosave).
  function isModalOpen() {
    return !!root.querySelector(
      '#overlay:not(.hidden), .ph-layer:not(.hidden), #backlog-layer:not(.hidden), ' +
      '.sl-layer:not(.hidden), .st-layer:not(.hidden)');
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

        let resolved = false, timer = null;
        let typed = false, autoNw = false, autoT0 = null;

        // Start the typewriter (honors {w}/{cps}/{size}/{b}/{i}). Skip → reveal at once.
        const ctrl = tw.type(lineEl, a.text);
        if (playback && playback.isSkip()) ctrl.complete();
        ctrl.done.then(res => { typed = true; autoNw = !!(res && res.autoAdvance); autoT0 = null; });

        function cleanup() {
          if (timer !== null) { clearTimeout(timer); timer = null; }
          game.removeEventListener('click', onAdv);
          document.removeEventListener('keydown', onKey);
          hideCue();
          ctrl.cancel();
        }
        function finish(fromUser) {
          if (resolved) return;
          resolved = true;
          cleanup();
          // A deliberate tap during skip/auto stops it (and advances).
          if (fromUser && playback && (playback.isSkip() || playback.isAuto())) {
            playback.setMode('normal');
          }
          resolve();
        }
        // Classic VN: while typing, a tap completes the line ("띡"); once shown, a tap advances.
        function advanceOrComplete() {
          if (!typed) { ctrl.complete(); return; }
          finish(true);
        }
        function onAdv(e) {
          if (isUiClick(e.target)) return;   // taps on UI layers don't advance
          advanceOrComplete();
        }
        function onKey(e) {
          if (!['Enter', ' '].includes(e.key)) return;
          if (isModalOpen()) return;         // 모달 뒤 대사 진행 금지
          e.preventDefault();                // 포커스된 버튼 우발 재활성화 방지
          advanceOrComplete();
        }
        // single ticker: skip-during-typing → complete; then auto/skip/cue while waiting.
        function tick() {
          if (resolved) return;
          if (!typed) {
            if (playback && playback.isSkip()) ctrl.complete();
            timer = setTimeout(tick, 80); return;
          }
          if (autoNw) { hideCue(); finish(false); return; }                 // {nw}
          if (playback && playback.isSkip()) { hideCue(); finish(false); return; }
          if (playback && playback.isAuto()) {
            hideCue();
            if (autoT0 === null) autoT0 = Date.now();
            if (Date.now() - autoT0 >= playback.autoDelay(a.text)) { finish(false); return; }
          } else {
            showCue();   // normal: invite a tap
          }
          timer = setTimeout(tick, 80);
        }

        game.addEventListener('click', onAdv);
        document.addEventListener('keydown', onKey);
        tick();
      });
    },

    // Used by view.pause. Polls mode each tick so 오토/스킵 토글이 대기 중에도 먹는다.
    waitAdvance() {
      return new Promise(resolve => {
        let resolved = false, timer = null, autoT0 = null;
        function cleanup() {
          if (timer !== null) { clearTimeout(timer); timer = null; }
          game.removeEventListener('click', onAdv);
          document.removeEventListener('keydown', onKey);
          hideCue();
        }
        function finish(fromUser) {
          if (resolved) return;
          resolved = true;
          cleanup();
          if (fromUser && playback && (playback.isSkip() || playback.isAuto())) {
            playback.setMode('normal');
          }
          resolve();
        }
        function onAdv(e) { if (isUiClick(e.target)) return; finish(true); }
        function onKey(e) { if (!['Enter', ' '].includes(e.key)) return; if (isModalOpen()) return; e.preventDefault(); finish(true); }
        function tick() {
          if (resolved) return;
          if (playback && playback.isSkip()) { hideCue(); finish(false); return; }
          if (playback && playback.isAuto()) {
            hideCue();
            if (autoT0 === null) autoT0 = Date.now();
            if (Date.now() - autoT0 >= 900) { finish(false); return; }
          } else {
            showCue();
          }
          timer = setTimeout(tick, 80);
        }
        game.addEventListener('click', onAdv);
        document.addEventListener('keydown', onKey);
        tick();
      });
    },
  };
}
