// typewriter.js — VN-style progressive text reveal (텍스트 스크롤).
//
// Honors inline tags as live effects while typing:
//   {w=N}  → pause N seconds at that point (생동감; 210곳 이미 작성됨)
//   {cps=N}→ chars/sec for the following run (구간 속도; "소리지름"은 빠르게)
//   {size=N}{/size} · {b}{/b} · {i}{/i} → 글자 커지고·볼드·기울임 하며 떠오름
//   {p}/{clear} → 줄바꿈,  {nw} → 다 뜨면 자동 진행
//
// Player can tap to instantly complete the current line ("띡"). The controller
// exposes complete()/cancel() and a `done` promise resolving { autoAdvance }.

import { parseTags, escapeHtml } from './tags.js';

const SIZE_MIN = 10, SIZE_MAX = 80;
const CPS_MIN = 4, CPS_MAX = 240;
const clampSize = n => Math.max(SIZE_MIN, Math.min(SIZE_MAX, n || 0));
const clampCps  = n => Math.max(CPS_MIN, Math.min(CPS_MAX, n || 0));

// settings.textSpeed (0..100) → base chars/sec (slow→fast). textInstant → no anim.
function baseCps(settings) {
  const sp = settings ? Number(settings.get('textSpeed')) : 55;
  return clampCps(12 + (isFinite(sp) ? sp : 55) / 100 * 96);   // ~12 … ~108 cps
}
function isInstant(settings) {
  return !!(settings && settings.get('textInstant'));
}

// Build the FULL html for a token list (instant reveal: skip mode / tap-complete).
export function buildFullHtml(tokens) {
  let html = ''; const stack = [];
  const openT  = (o, c) => { html += o; stack.push(c); };
  const closeT = c => { const k = stack.lastIndexOf(c); if (k >= 0) { html += c; stack.splice(k, 1); } };
  for (const tk of tokens) {
    switch (tk.t) {
      case 'text': html += escapeHtml(tk.s); break;
      case 'br': html += '\n'; break;
      case 'i_open': openT('<em>', '</em>'); break;
      case 'i_close': closeT('</em>'); break;
      case 'b_open': openT('<strong>', '</strong>'); break;
      case 'b_close': closeT('</strong>'); break;
      case 'size_open': openT(`<span style="font-size:${clampSize(tk.val)}px">`, '</span>'); break;
      case 'size_close': closeT('</span>'); break;
      // cps/wait/nw → no visual contribution
    }
  }
  while (stack.length) html += stack.pop();
  return html;
}

export function makeTypewriter(settings) {
  // type(el, text|tokens) → controller. Begins immediately.
  function type(el, text) {
    const tokens = Array.isArray(text) ? text : parseTags(text);

    // Flatten text tokens into per-char ops so timing is uniform.
    const ops = [];
    for (const tk of tokens) {
      if (tk.t === 'text') for (const c of tk.s) ops.push({ t: 'char', c });
      else ops.push(tk);
    }

    let committed = '';
    const stack = [];                       // close-tags currently open (open order)
    let k = 0, cps = baseCps(settings), autoAdvance = false;
    let done = false, cancelled = false, timer = null, resolveDone;
    const promise = new Promise(r => { resolveDone = r; });

    const paint = () => { el.innerHTML = committed + stack.slice().reverse().join(''); };
    const openTag  = (o, c) => { committed += o; stack.push(c); };
    const closeTag = c => { const j = stack.lastIndexOf(c); if (j >= 0) { committed += c; stack.splice(j, 1); } };

    function applyImmediate(op) {
      switch (op.t) {
        case 'br': committed += '\n'; break;
        case 'i_open': openTag('<em>', '</em>'); break;
        case 'i_close': closeTag('</em>'); break;
        case 'b_open': openTag('<strong>', '</strong>'); break;
        case 'b_close': closeTag('</strong>'); break;
        case 'size_open': openTag(`<span style="font-size:${clampSize(op.val)}px">`, '</span>'); break;
        case 'size_close': closeTag('</span>'); break;
        case 'cps': cps = clampCps(op.v); break;
        case 'nw': autoAdvance = true; break;
      }
    }

    function finalize() {
      while (stack.length) committed += stack.pop();
      el.innerHTML = committed;
      if (timer !== null) { clearTimeout(timer); timer = null; }
      done = true;
      resolveDone({ autoAdvance });
    }

    function step() {
      if (cancelled || done) return;
      while (k < ops.length) {
        const op = ops[k];
        if (op.t === 'char') { committed += escapeHtml(op.c); k++; paint(); timer = setTimeout(step, 1000 / cps); return; }
        if (op.t === 'wait') { k++; paint(); timer = setTimeout(step, op.ms); return; }
        applyImmediate(op); k++;
      }
      finalize();
    }

    function complete() {
      if (done || cancelled) return;
      if (timer !== null) { clearTimeout(timer); timer = null; }
      while (k < ops.length) {                 // commit everything, skip waits
        const op = ops[k];
        if (op.t === 'char') committed += escapeHtml(op.c);
        else if (op.t !== 'wait') applyImmediate(op);
        k++;
      }
      finalize();
    }

    function cancel() {
      if (done) return;
      cancelled = true;
      if (timer !== null) { clearTimeout(timer); timer = null; }
    }

    if (isInstant(settings)) complete();
    else step();

    return { done: promise, complete, cancel, isDone: () => done };
  }

  return { type };
}
