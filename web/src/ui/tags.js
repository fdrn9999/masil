// tags.js — shared text rendering for dialogue + chat bubbles.
// Escape first, then render the visible tags ({i}→<em>, {p}→newline), then
// STRIP every other Ren'Py control tag ({w=..}, {size=..}, {b}, {cps=..},
// {color=..}, {nw}, {clear} ...) so none of them leak into the screen.
// Brackets ([var], [[) are NOT handled here — they live in engine.interp().

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderTags(text) {
  return escapeHtml(text)
    .replace(/\{i\}/g, '<em>').replace(/\{\/i\}/g, '</em>')
    .replace(/\{p\}/g, '\n')
    // strip all remaining control tags ([^{}]* keeps it local, never greedy across braces)
    .replace(/\{[^{}]*\}/g, '');
}
