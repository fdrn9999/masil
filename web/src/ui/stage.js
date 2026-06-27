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
  function isUiClick(t, overChat) {
    // 채팅 중 나레이션(say)일 땐 채팅 탭으로도 진행되게 #chat 을 차단 목록에서 뺀다.
    const base = '#choices, #overlay, #toast, #title-layer, #sysmenu-bar, ' +
      '#backlog-layer, .ph-layer, .st-layer, .sl-layer, .phone-btn, .settings-btn';
    const sel = overChat ? base : ('#chat, ' + base);
    return !!(t && t.closest && t.closest(sel));
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

  // 배경 크로스페이드/플래시용 오버레이 레이어 (현재 배경 위·스프라이트 아래)
  const nextBg = document.createElement('div');
  nextBg.id = 'stage-next';
  stage.appendChild(nextBg);

  // device dir: 세로(모바일)=mobile, 가로(PC)=pc
  function deviceDir() {
    return (typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(orientation: portrait)').matches) ? 'mobile' : 'pc';
  }

  let _curBg = null;
  let _curDir = null;
  let _shownOnce = false;   // 첫 장면은 트랜지션 없이 즉시
  let _commitId = 0;        // 진행 중 크로스페이드 commit 경합 방지

  function imgPath(bg) { _curDir = deviceDir(); return 'images/bg/' + _curDir + '/bg_' + bg + '.png'; }
  function loadInto(el, path) {
    const img = new Image();
    img.onload = () => { el.style.backgroundImage = `url("${path}")`; };
    img.onerror = () => {};                       // safe-play: 에셋 없으면 단색 유지
    img.src = path;
  }
  // with 값 → {kind:'cut'|'cross'|'flash', dur, color}
  function parseTrans(w) {
    if (!w) return { kind: 'cut' };
    const s = String(w).toLowerCase();
    if (s.indexOf('flash') === 0) return { kind: 'flash', dur: 280, color: s.indexOf('white') >= 0 ? '#ffffff' : '#000000' };
    const m = s.match(/dissolve\(([\d.]+)\)/);
    if (m) return { kind: 'cross', dur: Math.round((parseFloat(m[1]) || 0.4) * 1000) };
    const map = { fade: 400, dissolve: 500, slowfade: 800, longdissolve: 1000 };
    return { kind: 'cross', dur: map[s] || 400 };
  }

  function applyBg(bg, withTrans) {
    const info = BG_INFO[bg];
    const real = !info || info.real !== false;    // black/white 연출 → 에셋 없음
    const color = backgrounds[bg] || '#15161d';
    const path = (real && /^\w+$/.test(bg)) ? imgPath(bg) : null;
    if (path) { hintEl.textContent = path + ' · ' + (info ? info.desc : bg); hintEl.classList.remove('bg-hint--hidden'); }
    else hintEl.classList.add('bg-hint--hidden');

    const t = parseTrans(withTrans);
    if (t.kind === 'cut' || !_shownOnce) {            // 첫 장면 또는 with 없음 → 즉시
      _commitId++;
      stage.style.backgroundColor = color;
      stage.style.backgroundImage = 'none';
      if (path) loadInto(stage, path);
      nextBg.style.transition = 'none'; nextBg.style.opacity = '0';
      _shownOnce = true;
      return;
    }
    if (t.kind === 'flash') {                          // 흰/검 플래시 → 새 배경 노출
      _commitId++;
      stage.style.backgroundColor = color; stage.style.backgroundImage = 'none';
      if (path) loadInto(stage, path);
      nextBg.style.transition = 'none';
      nextBg.style.backgroundColor = t.color; nextBg.style.backgroundImage = 'none';
      nextBg.style.opacity = '1';
      requestAnimationFrame(() => { nextBg.style.transition = 'opacity ' + t.dur + 'ms ease'; nextBg.style.opacity = '0'; });
      return;
    }
    // 크로스페이드: next 레이어에 새 배경을 깔고 fade-in → 끝나면 base로 commit
    nextBg.style.transition = 'none';
    nextBg.style.backgroundColor = color; nextBg.style.backgroundImage = 'none';
    if (path) loadInto(nextBg, path);
    nextBg.style.opacity = '0';
    requestAnimationFrame(() => { nextBg.style.transition = 'opacity ' + t.dur + 'ms ease'; nextBg.style.opacity = '1'; });
    const my = ++_commitId;
    setTimeout(() => {
      if (my !== _commitId) return;                    // 더 최신 전환이 왔으면 무시
      stage.style.backgroundColor = nextBg.style.backgroundColor;
      stage.style.backgroundImage = nextBg.style.backgroundImage;
      nextBg.style.transition = 'none'; nextBg.style.opacity = '0';
    }, t.dur + 40);
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
    scene(a) {
      if (!a || !a.bg) return;
      _curBg = a.bg;
      applyBg(a.bg, a.with);   // with: slowfade/dissolve/Dissolve(n)/flash_* → 크로스페이드/플래시
    },

    say(a) {
      if (playback) playback.pushHistory({ who: a.who, name: a.name, text: a.text });

      return new Promise(resolve => {
        box.classList.remove('hidden');
        // 채팅이 열린 상태의 say(나레이션)는 채팅 뒤에 숨지 않게 위로 띄우고,
        // 채팅 탭으로도 진행되게 한다. (say 끝나면 다시 숨겨 채팅을 깨끗이)
        const overChat = !!root.querySelector('#chat:not(.hidden)');
        if (overChat) game.classList.add('say-over-chat');
        nameEl.textContent = a.name || '';
        nameEl.style.color = legibleNameColor(a.color);
        nameEl.style.display = a.name ? 'block' : 'none';
        box.classList.toggle('narration', !a.name);   // 나레이션은 기울임+톤으로 대사와 구분(CSS)
        game.classList.toggle('is-narration', !a.name);  // 나레이션 줄엔 직전 화자 스프라이트 디밍(발화중 오인 방지)

        let resolved = false, timer = null;
        let typed = false, autoNw = false, autoT0 = null;

        // Start the typewriter (honors {w}/{cps}/{size}/{b}/{i}). Skip → reveal at once.
        const ctrl = tw.type(lineEl, a.text);
        if (playback && playback.isSkip()) ctrl.complete();
        ctrl.done.then(res => {
          typed = true; autoNw = !!(res && res.autoAdvance); autoT0 = null;
          if (timer !== null) { clearTimeout(timer); timer = null; }
          tick();   // 타이핑 자연 완료 즉시 ▼/오토 판정(80ms 폴링 지연 제거)
        });

        function cleanup() {
          if (timer !== null) { clearTimeout(timer); timer = null; }
          game.removeEventListener('click', onAdv);
          document.removeEventListener('keydown', onKey);
          hideCue();
          ctrl.cancel();
          if (overChat) { game.classList.remove('say-over-chat'); box.classList.add('hidden'); }
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
          if (!typed) { ctrl.complete(); showCue(); return; }   // 완성 즉시 ▼ 표시(피드백 lag 제거)
          finish(true);
        }
        function onAdv(e) {
          if (isUiClick(e.target, overChat)) return;   // taps on UI layers don't advance
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
