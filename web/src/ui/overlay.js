export function makeOverlay(root) {
  const overlayEl = root.querySelector('#overlay');
  const toastEl = root.querySelector('#toast');

  // Mount a modal into #overlay. Resolves when closed via the .close button,
  // a backdrop tap, OR Escape — so the engine await can never hard-lock.
  // Escape listener is removed on close (leak-free).
  function mountModal(html, { dismissOnScrim = true } = {}) {
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
      if (btn) { btn.onclick = finish; setTimeout(() => { try { btn.focus(); } catch (e) {} }, 0); }
      function onScrim(e) { if (e.target === overlayEl) finish(); }   // backdrop tap
      // 엔딩/에피소드 카드는 스크림 탭으로 실수 스킵되지 않게(확인 버튼만). Escape는 항상 유지 → 하드락 방지.
      if (dismissOnScrim) overlayEl.addEventListener('click', onScrim);
      escH = e => { if (e.key === 'Escape') finish(); };
      document.addEventListener('keydown', escH);
    });
  }

  return {
    consult({ line, hint }) {
      return mountModal(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="ov-title"><h3 id="ov-title">도윤에게 상담하기</h3>
        <div class="doyun-line">도윤: &ldquo;${escapeHtml(line)}&rdquo;</div>
        <div class="hint">${escapeHtml(hint)}</div>
        <button class="close">고마워, 알겠어</button></div>`);
    },
    callScreen({ name, title, type }) {
      if (name === 'result_card') {
        const safeTitle = escapeHtml((title != null ? title : '엔딩'));
        const safeLabel = escapeHtml((type && type[0] != null ? type[0] : ''));
        const safeDesc  = escapeHtml((type && type[1] != null ? type[1] : ''));
        return mountModal(`<div class="modal result-card" role="dialog" aria-modal="true" aria-label="엔딩 결과">
          <div class="result-card__label">YOUR ENDING</div>
          <div class="result-card__title">${safeTitle}</div>
          <div class="result-card__type-label">${safeLabel}</div>
          <div class="result-card__desc">${safeDesc}</div>
          <button class="close result-card__close">확인 ♡</button>
        </div>`, { dismissOnScrim: false });
      }
      if (name === 'episode_card') {
        const t    = escapeHtml(title != null ? title : '');
        const sub  = escapeHtml((type && type[0] != null) ? type[0] : '');
        const save = escapeHtml((type && type[1] != null) ? type[1] : '진행이 저장되었어요');
        return mountModal(`<div class="modal episode-card" role="dialog" aria-modal="true" aria-label="에피소드 완료">
          <div class="episode-card__tag">EPISODE COMPLETE</div>
          <div class="episode-card__title">${t}</div>
          <div class="episode-card__sub">${sub}</div>
          <div class="episode-card__save">✓ ${save}</div>
          <button class="close episode-card__close">계속하기</button>
        </div>`, { dismissOnScrim: false });
      }
      // subway_map is handled by map.js (view_dom delegates before reaching here)
      return Promise.resolve();
    },
    toast({ kind, text }) {
      while (toastEl.children.length >= 3) toastEl.firstElementChild.remove();   // 무제한 스택 방지
      const t = document.createElement('div');
      t.className = kind === 'doyun' ? 'toast-doyun' : 'toast-item';
      t.textContent = text;
      t.classList.add('toast-enter');
      toastEl.appendChild(t);
      requestAnimationFrame(() => t.classList.remove('toast-enter'));   // 등장 페이드
      setTimeout(() => { t.classList.add('toast-leaving'); setTimeout(() => t.remove(), 260); }, 3000);
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
