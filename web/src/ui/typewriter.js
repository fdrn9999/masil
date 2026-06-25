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

// Split text into grapheme clusters so emoji-with-modifiers / ZWJ / combining
// marks never reveal as broken fragments. Falls back to code points.
const _seg = (typeof Intl !== 'undefined' && Intl.Segmenter)
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;
function graphemes(s) {
  if (_seg) { const out = []; for (const g of _seg.segment(s)) out.push(g.segment); return out; }
  return [...s];
}

// A tag stack that always emits VALID, properly-nested HTML — even for crossed
// input like {i}{b}x{/i}y{/b} (closes intervening tags, then reopens them).
function makeSink(sink) {
  const stack = [];                          // [{ o, c }] open order
  return {
    text: s => sink.html += escapeHtml(s),
    raw:  s => sink.html += s,
    open: (o, c) => { sink.html += o; stack.push({ o, c }); },
    close: c => {
      let j = -1;
      for (let m = stack.length - 1; m >= 0; m--) if (stack[m].c === c) { j = m; break; }
      if (j < 0) return;
      const above = stack.slice(j + 1);
      for (let m = stack.length - 1; m >= j; m--) sink.html += stack[m].c;   // close target + above
      stack.splice(j);
      for (const it of above) { sink.html += it.o; stack.push(it); }         // reopen intervening
    },
    // current html + closers for whatever is still open (valid partial frame)
    snapshot: () => sink.html + stack.slice().reverse().map(x => x.c).join(''),
    flush: () => { while (stack.length) sink.html += stack.pop().c; return sink.html; },
  };
}

function applyVisual(s, tk) {
  switch (tk.t) {
    case 'br': s.raw('\n'); return true;
    case 'i_open': s.open('<em>', '</em>'); return true;
    case 'i_close': s.close('</em>'); return true;
    case 'b_open': s.open('<strong>', '</strong>'); return true;
    case 'b_close': s.close('</strong>'); return true;
    case 'size_open': s.open(`<span style="font-size:${clampSize(tk.val)}px">`, '</span>'); return true;
    case 'size_close': s.close('</span>'); return true;
  }
  return false;
}

// Build the FULL html for a token list (instant reveal: skip mode / tap-complete).
export function buildFullHtml(tokens) {
  const box = { html: '' }; const s = makeSink(box);
  for (const tk of tokens) {
    if (tk.t === 'text') s.text(tk.s);
    else applyVisual(s, tk);
  }
  return s.flush();
}

export function makeTypewriter(settings) {
  // type(el, text|tokens) → controller. Begins immediately.
  function type(el, text) {
    const tokens = Array.isArray(text) ? text : parseTags(text);

    // Flatten text tokens into per-grapheme ops so timing is uniform & safe.
    const ops = [];
    for (const tk of tokens) {
      if (tk.t === 'text') for (const g of graphemes(tk.s)) ops.push({ t: 'char', c: g });
      else ops.push(tk);
    }

    const box = { html: '' };
    const sink = makeSink(box);
    let k = 0, cps = baseCps(settings), autoAdvance = false;
    let done = false, cancelled = false, timer = null, resolveDone;
    const promise = new Promise(r => { resolveDone = r; });

    const paint = () => { el.innerHTML = sink.snapshot(); };

    function applyImmediate(op) {
      if (op.t === 'cps') { cps = clampCps(op.v); return; }
      if (op.t === 'nw')  { autoAdvance = true; return; }
      applyVisual(sink, op);   // br / i / b / size
    }

    function finalize() {
      el.innerHTML = sink.flush();
      if (timer !== null) { clearTimeout(timer); timer = null; }
      done = true;
      resolveDone({ autoAdvance });
    }

    function step() {
      if (cancelled || done) return;
      while (k < ops.length) {
        const op = ops[k];
        if (op.t === 'char') { sink.text(op.c); k++; paint(); timer = setTimeout(step, 1000 / cps); return; }
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
        if (op.t === 'char') sink.text(op.c);
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
