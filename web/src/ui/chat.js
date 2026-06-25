export function makeChat(root, { MASIL, CHAT_AVATARS, AVATAR_FILES = {}, audio = null, playback = null }) {
  const wrap = root.querySelector('#chat');
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
    function initial() { el.style.backgroundImage = 'none'; el.style.background = CHAT_AVATARS[name] || MASIL.avatar_bg; el.textContent = (name || '?')[0]; }
    return el;
  }
  function scrollBottom() { log.scrollTop = log.scrollHeight; }

  return {
    open({ room }) {
      wrap.classList.remove('hidden'); minutes = 0;
      wrap.innerHTML = `<div class="topbar"><span style="font-size:28px">‹</span>
        <div><div class="room">${escapeHtml(room)}</div><div class="sub"><span class="dot"></span>온라인</div></div></div>
        <div class="log"></div>`;
      log = wrap.querySelector('.log');
    },
    close() { wrap.classList.add('hidden'); },
    recv({ name, text, avatar }) {
      // Record history
      if (playback) playback.pushHistory({ who: null, name, text });

      return new Promise(resolve => {
        const row = document.createElement('div'); row.className = 'bubble-row left';
        row.appendChild(avatarEl(name, avatar));
        const col = document.createElement('div');
        col.innerHTML = `<div class="sender">${escapeHtml(name || '')}</div>
          <div class="bubble typing"><span></span><span></span><span></span></div>`;
        row.appendChild(col); log.appendChild(row); scrollBottom();
        const delay = (playback && playback.isSkip()) ? 60 : 800;
        setTimeout(() => {
          col.innerHTML = `<div class="sender">${escapeHtml(name || '')}</div>
            <div class="bubble">${escapeHtml(text)}</div><div class="meta">${fmtTime()}</div>`;
          scrollBottom();
          if (audio) { audio.playSfx('se_msg_recv'); audio.vibrate(10); }  // mobile messenger feel
          resolve();
        }, delay);
      });
    },
    send({ text }) {
      // Record history for outgoing messages too
      if (playback) playback.pushHistory({ who: 'mc', name: null, text });

      const row = document.createElement('div'); row.className = 'bubble-row right';
      row.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>
        <div class="meta"><span class="read">읽음</span><br>${fmtTime()}</div>`;
      log.appendChild(row); scrollBottom();
      if (audio) audio.playSfx('se_msg_send');
      return Promise.resolve();
    },
    waitTap() {
      return new Promise(resolve => {
        const onTap = () => { wrap.removeEventListener('click', onTap); resolve(); };
        wrap.addEventListener('click', onTap);
      });
    },
  };
}
function escapeHtml(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
