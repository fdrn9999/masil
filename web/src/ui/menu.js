export function makeMenu(root, { audio = null } = {}) {
  const choicesEl = root.querySelector('#choices');
  const overlayEl = root.querySelector('#overlay');
  return {
    menu({ prompt, choices }) {
      return new Promise(resolve => {
        choicesEl.classList.remove('hidden');
        choicesEl.classList.add('is-arming');            // 320ms 잠금 동안 흐리게(CSS)
        choicesEl.setAttribute('role', 'group');
        choicesEl.setAttribute('aria-label', prompt || '선택지');
        choicesEl.innerHTML = prompt
          ? `<div class="choice-prompt" style="color:var(--ink);font-family:var(--font-display);font-size:clamp(15px,2.4vw,20px);margin-bottom:14px;text-align:center;background:rgba(255,255,255,.75);padding:8px 18px;border-radius:999px;box-shadow:0 4px 12px -6px rgba(180,140,160,.4)">${escapeHtml(prompt)}</div>`
          : '';
        // 입력잠금: 등장 직후 ~320ms 동안 탭 무시 → 직전 대사 진행하려던 연타가
        // 막 뜬 선택지를 무심코 자동 선택하는 걸 막는다 (전형적 VN 처리).
        let armed = false;
        setTimeout(() => { armed = true; choicesEl.classList.remove('is-arming'); }, 320);
        choices.forEach((text, i) => {
          const b = document.createElement('button');
          b.textContent = text;
          b.onclick = () => {
            if (!armed) return;          // carry-over 탭 차단
            if (audio) audio.playSfx('se_click');
            choicesEl.classList.add('hidden');
            choicesEl.classList.remove('is-arming');
            choicesEl.removeAttribute('role');
            choicesEl.removeAttribute('aria-label');
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
        overlayEl.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="nick-title"><h3 id="nick-title">${escapeHtml(prompt || '')}</h3>
          <div class="input-row"><input id="nick" maxlength="${escapeHtml(String(max || 20))}" value="${escapeHtml(def || '')}" aria-labelledby="nick-title" enterkeyhint="done" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
          <button id="ok">확인</button></div></div>`;
        const inp = overlayEl.querySelector('#nick');
        const okBtn = overlayEl.querySelector('#ok');
        // 빈/공백 닉네임이 게임 전체에 baking 되지 않게 가드 + OK 비활성/invalid 동기화
        const sync = () => { okBtn.disabled = !inp.value.trim(); inp.classList.remove('invalid'); };
        const done = () => {
          const v = inp.value.trim();
          if (!v) { inp.classList.add('invalid'); inp.focus(); return; }
          overlayEl.classList.add('hidden');
          overlayEl.innerHTML = '';
          resolve(v);
        };
        inp.addEventListener('input', sync);
        sync();
        okBtn.onclick = done;
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(); });
        inp.focus();
      });
    },
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
