/**
 * sysmenu.js — in-game system control bar (non-blocking, pastel).
 * Provides skip/auto toggles, backlog, save/load/quicksave/quickload, rollback, and title.
 *
 * Usage:
 *   const sysMenu = makeSysMenu(root, { playback, onSave, onLoad, onBacklog,
 *                                       onTitle, onQuickSave, onQuickLoad, onRollback });
 *   sysMenu.mountBar();   // call after game starts
 *   sysMenu.refresh();    // re-read playback.mode and update active states
 */
export function makeSysMenu(root, {
  playback,
  onSave,
  onLoad,
  onBacklog,
  onTitle,
  onQuickSave,
  onQuickLoad,
  onRollback,
}) {
  let barEl = null;

  // ── Build bar HTML ──────────────────────────────────────────────────────────
  function buildBar() {
    const bar = document.createElement('div');
    bar.id = 'sysmenu-bar';
    bar.className = 'sm-bar';
    bar.innerHTML = `
      <button class="sm-btn sm-btn--rollback" id="sm-rollback"   title="이전으로">↩</button>
      <button class="sm-btn sm-btn--skip"     id="sm-skip"       title="스킵">»</button>
      <button class="sm-btn sm-btn--auto"     id="sm-auto"       title="오토">▶</button>
      <button class="sm-btn sm-btn--backlog"  id="sm-backlog"    title="백로그">≡</button>
      <div class="sm-divider"></div>
      <button class="sm-btn sm-btn--qs"       id="sm-quicksave"  title="퀵세이브">QS</button>
      <button class="sm-btn sm-btn--ql"       id="sm-quickload"  title="퀵로드">QL</button>
      <button class="sm-btn sm-btn--save"     id="sm-save"       title="저장">💾</button>
      <button class="sm-btn sm-btn--load"     id="sm-load"       title="불러오기">📂</button>
      <button class="sm-btn sm-btn--title"    id="sm-title"      title="메뉴로">🏠</button>
    `;
    return bar;
  }

  // ── Wire button events ──────────────────────────────────────────────────────
  function wireButtons() {
    if (!barEl) return;

    barEl.querySelector('#sm-rollback').addEventListener('click', () => {
      if (onRollback) onRollback();
    });

    barEl.querySelector('#sm-skip').addEventListener('click', () => {
      playback.toggleSkip();
      refresh();
    });

    barEl.querySelector('#sm-auto').addEventListener('click', () => {
      playback.toggleAuto();
      refresh();
    });

    barEl.querySelector('#sm-backlog').addEventListener('click', () => {
      if (onBacklog) onBacklog();
    });

    barEl.querySelector('#sm-quicksave').addEventListener('click', () => {
      if (onQuickSave) onQuickSave();
    });

    barEl.querySelector('#sm-quickload').addEventListener('click', () => {
      if (onQuickLoad) onQuickLoad();
    });

    barEl.querySelector('#sm-save').addEventListener('click', () => {
      if (onSave) onSave();
    });

    barEl.querySelector('#sm-load').addEventListener('click', () => {
      if (onLoad) onLoad();
    });

    barEl.querySelector('#sm-title').addEventListener('click', () => {
      if (onTitle) onTitle();
    });
  }

  // ── refresh: sync active-state classes from playback.mode ──────────────────
  function refresh() {
    if (!barEl) return;
    const skipBtn = barEl.querySelector('#sm-skip');
    const autoBtn = barEl.querySelector('#sm-auto');
    if (skipBtn) skipBtn.classList.toggle('sm-btn--active', playback.isSkip());
    if (autoBtn) autoBtn.classList.toggle('sm-btn--active', playback.isAuto());
  }

  // ── mountBar: inject into root, above textbox (z-index in CSS) ─────────────
  function mountBar() {
    // Remove old bar if any (idempotent)
    const old = root.querySelector('#sysmenu-bar');
    if (old) old.remove();

    barEl = buildBar();
    root.appendChild(barEl);
    wireButtons();
    refresh();
  }

  return { mountBar, refresh };
}
