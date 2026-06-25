export function makeMenu(root) {
  const choicesEl = root.querySelector('#choices');
  const overlayEl = root.querySelector('#overlay');
  return {
    menu({ prompt, choices }) {
      return new Promise(resolve => {
        choicesEl.classList.remove('hidden');
        choicesEl.innerHTML = prompt
          ? `<div style="color:#fff;margin-bottom:8px;text-align:center">${escapeHtml(prompt)}</div>`
          : '';
        choices.forEach((text, i) => {
          const b = document.createElement('button');
          b.textContent = text;
          b.onclick = () => {
            choicesEl.classList.add('hidden');
            choicesEl.innerHTML = '';
            resolve(i);
          };
          choicesEl.appendChild(b);
        });
      });
    },
    input({ prompt, def, max }) {
      return new Promise(resolve => {
        overlayEl.classList.remove('hidden');
        overlayEl.innerHTML = `<div class="modal"><h3>${escapeHtml(prompt || '')}</h3>
          <div class="input-row"><input id="nick" maxlength="${escapeHtml(String(max || 20))}" value="${escapeHtml(def || '')}">
          <button id="ok">확인</button></div></div>`;
        const inp = overlayEl.querySelector('#nick');
        const done = () => {
          const v = inp.value.trim();
          overlayEl.classList.add('hidden');
          overlayEl.innerHTML = '';
          resolve(v);
        };
        overlayEl.querySelector('#ok').onclick = done;
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(); });
        inp.focus();
      });
    },
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
