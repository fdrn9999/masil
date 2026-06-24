export function makeOverlay(root) {
  const overlayEl = root.querySelector('#overlay');
  const toastEl = root.querySelector('#toast');
  return {
    consult({ line, hint }) {
      return new Promise(resolve => {
        overlayEl.classList.remove('hidden');
        overlayEl.innerHTML = `<div class="modal"><h3>도윤에게 상담하기</h3>
          <div>도윤: "${escapeHtml(line)}"</div><div class="hint">${escapeHtml(hint)}</div>
          <button class="close">고마워, 알겠어</button></div>`;
        overlayEl.querySelector('.close').onclick = () => {
          overlayEl.classList.add('hidden');
          overlayEl.innerHTML = '';
          resolve();
        };
      });
    },
    callScreen({ name }) {
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
      t.className = 'toast-item' + (kind === 'doyun' ? ' toast-doyun' : '');
      t.textContent = (kind === 'doyun' ? '도윤 📱  ' : '') + text;
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
