export function makeStage(root, backgrounds) {
  const stage = root.querySelector('#stage');
  const box = root.querySelector('#textbox');
  const nameEl = root.querySelector('#name');
  const lineEl = root.querySelector('#line');

  function renderTags(text) {
    return text
      .replace(/\{w=[\d.]+\}/g, '').replace(/\{p\}/g, '\n')
      .replace(/\{i\}/g, '<em>').replace(/\{\/i\}/g, '</em>');
  }
  return {
    scene({ bg }) { if (bg && backgrounds[bg]) stage.style.backgroundColor = backgrounds[bg]; },
    say({ name, color, text }) {
      return new Promise(resolve => {
        box.classList.remove('hidden');
        nameEl.textContent = name || '';
        nameEl.style.color = color || '#eef0f6';
        nameEl.style.display = name ? 'block' : 'none';
        lineEl.innerHTML = renderTags(text);
        const onAdv = (e) => {
          if (e.type === 'keydown' && !['Enter', ' '].includes(e.key)) return;
          box.removeEventListener('click', onAdv); document.removeEventListener('keydown', onAdv);
          resolve();
        };
        box.addEventListener('click', onAdv); document.addEventListener('keydown', onAdv);
      });
    },
  };
}
