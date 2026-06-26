import { renderTags, escapeHtml } from './tags.js';

export function makeChat(root, { MASIL, CHAT_AVATARS, AVATAR_FILES = {}, audio = null, playback = null }) {
  const wrap = root.querySelector('#chat');
  const cueEl = root.querySelector('#advance-cue');
  let log, minutes = 0;

  function fmtTime() {
    const t = 21 * 60 + 10 + minutes; minutes += 1;
    const h = Math.floor(t / 60) % 24, m = t % 60;
    const ampm = h < 12 ? '오전' : '오후'; const h12 = (h % 12) || 12;
    return `${ampm} ${h12}:${String(m).padStart(2, '0')}`;
  }
  function avatarEl(name, avatar) {
    const el = document.createElement('div'); el.className = 'avatar';
    const file = avatar || AVATAR_FILES[name];
    if (file) { const img = new Image(); img.onerror = () => initial(); img.src = file;
      if (/^[\w./-]+$/.test(file)) {          // relative asset path only — no quotes/parens/newlines/scheme
        el.style.setProperty('background-image', 'url(' + JSON.stringify(file) + ')');
      } }
    else initial();
    function initial() { el.style.backgroundImage = 'none'; el.style.background = CHAT_AVATARS[name] || MASIL.avatar_bg; el.textContent = [...(name || '?')][0]; }
    return el;
  }
  function scrollBottom(smooth) {
    if (!log) return;
    if (smooth && log.scrollTo) log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
    else log.scrollTop = log.scrollHeight;
  }

  return {
    open({ room }) {
      wrap.classList.remove('hidden'); minutes = 0;
      wrap.innerHTML = `<div class="topbar"><span aria-hidden="true" style="font-size:28px;opacity:.35;pointer-events:none">‹</span>
        <div><div class="room">${escapeHtml(room)}</div><div class="sub"><span class="dot"></span>온라인</div></div></div>
        <div class="log" tabindex="0" role="log" aria-live="polite"></div>`;
      log = wrap.querySelector('.log');
    },
    close() { wrap.classList.add('hidden'); },
    recv({ name, text, avatar }) {
      // Record history
      if (playback) playback.pushHistory({ who: null, name, text });

      return new Promise(resolve => {
        const fast = !!(playback && playback.isSkip());
        const row = document.createElement('div'); row.className = 'bubble-row left';
        row.appendChild(avatarEl(name, avatar));
        const col = document.createElement('div');
        col.innerHTML = `<div class="sender">${escapeHtml(name || '')}</div>
          <div class="bubble typing"><span></span><span></span><span></span></div>`;
        row.appendChild(col); log.appendChild(row); scrollBottom();
        // 길이 비례 타이핑 호흡(짧은 'ㅇㅇ'과 긴 고백이 다른 박자). 스킵 땐 60ms.
        const ch = (text || '').length;
        const delay = fast ? 60 : Math.min(1500, Math.max(450, 350 + ch * 28));
        setTimeout(() => {
          col.innerHTML = `<div class="sender">${escapeHtml(name || '')}</div>
            <div class="bubble">${renderTags(text)}</div><div class="meta"><span class="time">${fmtTime()}</span></div>`;
          scrollBottom(!fast);
          if (audio && !fast) { audio.playSfx('se_msg_recv'); audio.vibrate(10); }  // 스킵 중 사운드/진동 스팸 방지
          resolve();
        }, delay);
      });
    },
    send({ text }) {
      // Record history for outgoing messages too
      if (playback) playback.pushHistory({ who: 'mc', name: null, text });

      const fast = !!(playback && playback.isSkip());
      const row = document.createElement('div'); row.className = 'bubble-row right';
      row.innerHTML = `<div class="bubble">${renderTags(text)}</div>
        <div class="meta"><span class="read">읽음</span><span class="time">${fmtTime()}</span></div>`;
      log.appendChild(row); scrollBottom(!fast);
      if (audio && !fast) audio.playSfx('se_msg_send');
      return Promise.resolve();
    },
    waitTap() {
      return new Promise(resolve => {
        let resolved = false, timer = null, autoT0 = null;
        const show = () => { if (cueEl) cueEl.classList.remove('hidden'); };
        const hide = () => { if (cueEl) cueEl.classList.add('hidden'); };
        function cleanup() {
          if (timer !== null) { clearTimeout(timer); timer = null; }
          wrap.removeEventListener('click', onTap);
          document.removeEventListener('keydown', onKey);
          hide();
        }
        function finish() { if (resolved) return; resolved = true; cleanup(); resolve(); }
        // 채팅 내 버튼/링크/입력/백버튼 탭은 진행시키지 않음 (여백·말풍선 탭만 진행)
        function onTap(e) {
          if (e && e.target && e.target.closest && e.target.closest('.topbar, button, a, input, textarea')) return;
          finish();
        }
        function onKey(e) {
          if (!['Enter', ' '].includes(e.key)) return;
          if (root.querySelector('#overlay:not(.hidden), .ph-layer:not(.hidden), #backlog-layer:not(.hidden), .sl-layer:not(.hidden), .st-layer:not(.hidden)')) return;
          e.preventDefault();
          finish();
        }
        // poll mode so 오토/스킵 토글이 채팅 대기 중에도 진행시킨다 (say와 동일)
        function tick() {
          if (resolved) return;
          if (playback && playback.isSkip()) { hide(); finish(); return; }
          if (playback && playback.isAuto()) {
            hide();
            if (autoT0 === null) autoT0 = Date.now();
            if (Date.now() - autoT0 >= 700) { finish(); return; }
          } else {
            show();   // tap-to-continue cue during chat
          }
          timer = setTimeout(tick, 80);
        }
        wrap.addEventListener('click', onTap);
        document.addEventListener('keydown', onKey);
        tick();
      });
    },
  };
}
