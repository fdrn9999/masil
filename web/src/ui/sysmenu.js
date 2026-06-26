/**
 * sysmenu.js — in-game system control bar (non-blocking, pastel).
 *
 * 접힘 기본: 평소엔 작은 핸들(☰)만 보이고, 탭하면 전체 툴바가 펼쳐진다.
 * 각 버튼은 아이콘 + 글자라 모양만 봐도 뭔지 알 수 있다.
 * 그룹: [이전·스킵·오토·기록] | [퀵저장·퀵불러·저장·불러오기] | [처음].
 * 한 번 쓰는 동작(이전/저장류/기록/처음)은 실행 후 자동으로 접힌다.
 * 토글(스킵·오토)은 펼친 채로 유지해 상태를 보며 껐다 켤 수 있다.
 *
 * Usage:
 *   const sysMenu = makeSysMenu(root, { playback, onSave, onLoad, onBacklog,
 *                                       onTitle, onQuickSave, onQuickLoad, onRollback });
 *   sysMenu.mountBar();   // 게임 시작 후
 *   sysMenu.refresh();    // playback.mode 다시 읽어 active 상태 갱신
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
  let collapsed = true;   // 기본 접힘 — 평소엔 핸들만

  // ── Build bar HTML ──────────────────────────────────────────────────────────
  function btn(id, cls, title, icon, label) {
    return `<button class="sm-btn ${cls}" id="${id}" title="${title}" aria-label="${title}"
              ><span class="sm-ic">${icon}</span><span class="sm-lb">${label}</span></button>`;
  }
  function buildBar() {
    const bar = document.createElement('div');
    bar.id = 'sysmenu-bar';
    bar.className = 'sm-bar sm-collapsed';
    bar.innerHTML = `
      <div class="sm-full">
        <div class="sm-group">
          ${btn('sm-rollback', 'sm-btn--rollback', '이전으로',          '↩', '이전')}
          ${btn('sm-skip',     'sm-btn--skip',     '읽은 대사 빨리감기', '⏩', '스킵')}
          ${btn('sm-auto',     'sm-btn--auto',     '자동 진행',          '▶', '오토')}
          ${btn('sm-backlog',  'sm-btn--backlog',  '지난 대사 보기',     '💬', '기록')}
        </div>
        <div class="sm-group">
          ${btn('sm-quicksave', 'sm-btn--qs',   '퀵세이브',      '⚡', '퀵저장')}
          ${btn('sm-quickload', 'sm-btn--ql',   '퀵로드',        '↺', '퀵불러')}
          ${btn('sm-save',      'sm-btn--save', '슬롯에 저장',    '💾', '저장')}
          ${btn('sm-load',      'sm-btn--load', '슬롯 불러오기',  '📂', '불러오기')}
        </div>
        <div class="sm-group">
          ${btn('sm-title', 'sm-btn--title', '처음 화면으로', '🏠', '처음')}
        </div>
      </div>
      <button class="sm-toggle" id="sm-toggle" title="메뉴 펼치기 / 접기" aria-label="메뉴 펼치기 / 접기">☰</button>
    `;
    return bar;
  }

  // ── 접기/펼치기 상태 적용 ───────────────────────────────────────────────────
  function applyCollapsed() {
    if (!barEl) return;
    barEl.classList.toggle('sm-collapsed', collapsed);
    const tg = barEl.querySelector('#sm-toggle');
    if (tg) tg.textContent = collapsed ? '☰' : '✕';
  }
  function setCollapsed(v) { collapsed = !!v; applyCollapsed(); }

  // ── Wire button events ──────────────────────────────────────────────────────
  // 한 번 쓰는 동작은 실행 후 접고, 토글(스킵/오토)은 펼친 채 유지.
  function on(id, fn) {
    const el = barEl.querySelector('#' + id);
    if (el) el.addEventListener('click', fn);
  }
  function act(fn) { return () => { setCollapsed(true); if (fn) fn(); }; }

  function wireButtons() {
    if (!barEl) return;
    on('sm-toggle', () => setCollapsed(!collapsed));

    on('sm-rollback',  act(onRollback));
    on('sm-skip',      () => { playback.toggleSkip(); refresh(); });
    on('sm-auto',      () => { playback.toggleAuto(); refresh(); });
    on('sm-backlog',   act(onBacklog));
    on('sm-quicksave', act(onQuickSave));
    on('sm-quickload', act(onQuickLoad));
    on('sm-save',      act(onSave));
    on('sm-load',      act(onLoad));
    on('sm-title',     act(onTitle));
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
    const old = root.querySelector('#sysmenu-bar');
    if (old) old.remove();

    collapsed = true;
    barEl = buildBar();
    root.appendChild(barEl);
    wireButtons();
    applyCollapsed();
    refresh();
    // Re-sync when mode changes anywhere (e.g. a stage tap cancels skip/auto).
    if (playback && playback.onModeChange) playback.onModeChange(refresh);
  }

  return { mountBar, refresh };
}
