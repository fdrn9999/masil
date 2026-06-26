export function makeOverlay(root) {
  const overlayEl = root.querySelector('#overlay');
  const toastEl = root.querySelector('#toast');

  // Mount a modal into #overlay. Resolves when closed via the .close button,
  // a backdrop tap, OR Escape — so the engine await can never hard-lock.
  // Escape listener is removed on close (leak-free).
  function mountModal(html) {
    return new Promise(resolve => {
      overlayEl.classList.remove('hidden');
      overlayEl.innerHTML = html;
      let done = false, escH = null;
      function finish() {
        if (done) return;
        done = true;
        if (escH) document.removeEventListener('keydown', escH);
        overlayEl.removeEventListener('click', onScrim);
        overlayEl.classList.add('hidden');
        overlayEl.innerHTML = '';
        resolve();
      }
      const btn = overlayEl.querySelector('.close');
      if (btn) btn.onclick = finish;
      function onScrim(e) { if (e.target === overlayEl) finish(); }   // backdrop tap
      overlayEl.addEventListener('click', onScrim);
      escH = e => { if (e.key === 'Escape') finish(); };
      document.addEventListener('keydown', escH);
    });
  }

  return {
    consult({ line, hint }) {
      return mountModal(`<div class="modal"><h3>도윤에게 상담하기</h3>
        <div class="doyun-line">도윤: &ldquo;${escapeHtml(line)}&rdquo;</div>
        <div class="hint">${escapeHtml(hint)}</div>
        <button class="close">고마워, 알겠어</button></div>`);
    },
    callScreen({ name, title, type }) {
      if (name === 'result_card') {
        const safeTitle = escapeHtml((title != null ? title : '엔딩'));
        const safeLabel = escapeHtml((type && type[0] != null ? type[0] : ''));
        const safeDesc  = escapeHtml((type && type[1] != null ? type[1] : ''));
        return mountModal(`<div class="modal result-card">
          <div class="result-card__label">YOUR ENDING</div>
          <div class="result-card__title">${safeTitle}</div>
          <div class="result-card__type-label">${safeLabel}</div>
          <div class="result-card__desc">${safeDesc}</div>
          <button class="close result-card__close">확인 ♡</button>
        </div>`);
      }
      if (name === 'episode_card') {
        const t    = escapeHtml(title != null ? title : '');
        const sub  = escapeHtml((type && type[0] != null) ? type[0] : '');
        const save = escapeHtml((type && type[1] != null) ? type[1] : '진행이 저장되었어요');
        return mountModal(`<div class="modal episode-card">
          <div class="episode-card__tag">EPISODE COMPLETE</div>
          <div class="episode-card__title">${t}</div>
          <div class="episode-card__sub">${sub}</div>
          <div class="episode-card__save">✓ ${save}</div>
          <button class="close episode-card__close">계속하기</button>
        </div>`);
      }
      // subway_map is handled by map.js (view_dom delegates before reaching here)
      return Promise.resolve();
    },
    toast({ kind, text }) {
      const t = document.createElement('div');
      if (kind === 'doyun') {
        t.className = 'toast-doyun';
        t.textContent = text;
      } else {
        t.className = 'toast-item';
        t.textContent = text;
      }
      toastEl.appendChild(t);
      setTimeout(() => t.remove(), 3000);
    },
    phoneButton() {
      // Stub — full phone menu is a later milestone.
      // Returns an inert button element; caller may mount it.
      const btn = document.createElement('button');
      btn.textContent = '📱';
      btn.title = '폰 메뉴 (준비 중)';
      btn.disabled = true;
      btn.style.cssText =
        'position:absolute;top:12px;right:12px;z-index:80;font-size:22px;' +
        'background:none;border:none;opacity:0.4;cursor:default;';
      return btn;
    },
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
