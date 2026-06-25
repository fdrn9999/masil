export function makeOverlay(root) {
  const overlayEl = root.querySelector('#overlay');
  const toastEl = root.querySelector('#toast');
  return {
    consult({ line, hint }) {
      return new Promise(resolve => {
        overlayEl.classList.remove('hidden');
        overlayEl.innerHTML = `<div class="modal"><h3>도윤에게 상담하기</h3>
          <div class="doyun-line">도윤: &ldquo;${escapeHtml(line)}&rdquo;</div>
          <div class="hint">${escapeHtml(hint)}</div>
          <button class="close">고마워, 알겠어</button></div>`;
        overlayEl.querySelector('.close').onclick = () => {
          overlayEl.classList.add('hidden');
          overlayEl.innerHTML = '';
          resolve();
        };
      });
    },
    callScreen({ name, title, type }) {
      if (name === 'result_card') {
        return new Promise(resolve => {
          const safeTitle = escapeHtml((title != null ? title : '엔딩'));
          const safeLabel = escapeHtml((type && type[0] != null ? type[0] : ''));
          const safeDesc  = escapeHtml((type && type[1] != null ? type[1] : ''));
          overlayEl.classList.remove('hidden');
          overlayEl.innerHTML = `<div class="modal result-card">
            <div class="result-card__label">YOUR ENDING</div>
            <div class="result-card__title">${safeTitle}</div>
            <div class="result-card__type-label">${safeLabel}</div>
            <div class="result-card__desc">${safeDesc}</div>
            <button class="close result-card__close">확인 ♡</button>
          </div>`;
          overlayEl.querySelector('.close').onclick = () => {
            overlayEl.classList.add('hidden');
            overlayEl.innerHTML = '';
            resolve();
          };
        });
      }
      if (name !== 'subway_map') return Promise.resolve();
      return new Promise(resolve => {
        overlayEl.classList.remove('hidden');
        overlayEl.innerHTML = `<div class="modal map-interstitial"><h3>2호선</h3>
          <div>새로운 역이 열렸다.</div><button class="close">이동</button></div>`;
        overlayEl.querySelector('.close').onclick = () => {
          overlayEl.classList.add('hidden');
          overlayEl.innerHTML = '';
          resolve();
        };
      });
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
