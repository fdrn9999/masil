// tags.js — shared text parsing/rendering for dialogue + chat bubbles + backlog.
//
// parseTags()   → token stream (used by the typewriter to animate, and by the
//                 simple renderers below). Handles Ren'Py-style control tags.
// renderTags()  → instant, "stripped" HTML for backlog/skip: keeps {i}→<em>,
//                 {p}→newline; STRIPS {size}/{b}/{cps}/{w}/{nw}/… ; balance-safe
//                 (auto-closes a dangling {i}).
// escapeHtml()  → HTML-escape, null-safe.
//
// Brackets ([var], [[) are NOT handled here — they live in engine.interp().

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Tokenize text into a flat list of {t, …} tokens.
//   text(s) · br · i_open/i_close · b_open/b_close · size_open(val)/size_close
//   · cps(v) · wait(ms) · nw   ({{ → literal '{', unknown {…} → dropped)
export function parseTags(text) {
  const src = String(text ?? '');
  const tokens = [];
  let buf = '', i = 0;
  const flush = () => { if (buf) { tokens.push({ t: 'text', s: buf }); buf = ''; } };

  while (i < src.length) {
    const ch = src[i];
    if (ch === '{') {
      if (src[i + 1] === '{') { buf += '{'; i += 2; continue; }   // {{ → literal {
      const end = src.indexOf('}', i + 1);
      if (end === -1) { buf += src.slice(i); break; }             // stray { … no close
      const tag = src.slice(i + 1, end).trim();
      i = end + 1;
      flush();
      if (tag === 'i') tokens.push({ t: 'i_open' });
      else if (tag === '/i') tokens.push({ t: 'i_close' });
      else if (tag === 'b') tokens.push({ t: 'b_open' });
      else if (tag === '/b') tokens.push({ t: 'b_close' });
      else if (tag === '/size') tokens.push({ t: 'size_close' });
      else if (/^size\s*=/.test(tag)) tokens.push({ t: 'size_open', val: parseInt(tag.split('=')[1], 10) || null });
      else if (/^cps\s*=/.test(tag)) tokens.push({ t: 'cps', v: parseFloat(tag.split('=')[1]) || 0 });
      else if (/^w\s*=/.test(tag)) tokens.push({ t: 'wait', ms: Math.max(0, Math.round((parseFloat(tag.split('=')[1]) || 0) * 1000)) });
      else if (tag === 'w') tokens.push({ t: 'wait', ms: 0 });
      else if (tag === 'nw') tokens.push({ t: 'nw' });
      else if (tag === 'p' || tag === 'clear') tokens.push({ t: 'br' });
      // unknown control tag → dropped
    } else {
      buf += ch; i++;
    }
  }
  flush();
  return tokens;
}

// Instant stripped render (backlog / skip-reveal text-only path).
// Keeps emphasis ({i}) and paragraph breaks ({p}); drops sizing/speed tags.
export function renderTags(text) {
  let html = '', emDepth = 0;
  for (const tk of parseTags(text)) {
    if (tk.t === 'text') html += escapeHtml(tk.s);
    else if (tk.t === 'br') html += '\n';
    else if (tk.t === 'i_open') { html += '<em>'; emDepth++; }
    else if (tk.t === 'i_close') { if (emDepth > 0) { html += '</em>'; emDepth--; } }
    // size/b/cps/wait/nw → stripped
  }
  while (emDepth-- > 0) html += '</em>';   // balance-safe: close any dangling {i}
  return html;
}
