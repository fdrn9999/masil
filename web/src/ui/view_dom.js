import { GameState } from '../state.js';
import { makeSystems } from '../systems.js';
import { makeEvaluator } from '../eval_expr.js';
import { Engine } from '../engine.js';
import { MASIL, CHAT_AVATARS, SPRITES, SPRITE_BASE } from '../theme.js';
import { makeStage } from './stage.js';
import { makeSprites } from './sprites.js';
import { makeTypewriter } from './typewriter.js';
import { makeChat } from './chat.js';
import { makeMenu } from './menu.js';
import { makeOverlay } from './overlay.js';
import { makeMap }     from './map.js';
import { makePhone }   from './phone.js';
import { makeSettings }   from '../settings.js';
import { makeAudio }      from '../audio.js';
import { makeSettingsUI } from './settings_ui.js';
import { makeTitle }      from './title.js';
import { makeSaveLoad, requestResume, requestRollback } from './saveload.js';
import { makePlayback }   from '../playback.js';
import { loadStory }      from '../load_story.js';
import { makeSysMenu }    from './sysmenu.js';
import { makeBacklog }    from './backlog.js';

const AVATAR_FILES = {
  '도윤': 'images/avatar/avatar_doyun.png',
  '서아': 'images/avatar/avatar_seoa.png',
  '지우': 'images/avatar/avatar_jiu.png',
  '민결': 'images/avatar/avatar_mingyeol.png',
};

// Supplement defaults not covered by script.defaults.
// story.defaults (from all episodes' `default` declarations) is loaded first,
// so only structural defaults absent from the script need to be listed here.
const SUPPLEMENT_DEFAULTS = {
  like:               { seoa: 0, jiu: 0, mingyeol: 0 },
  sincere:            { seoa: 0, jiu: 0, mingyeol: 0 },
  doyun_bond:         0,
  inventory:          {},
  item_flags:         {},
  doyun_used_chapter: false,
  show_gauges:        false,
  mc_name:            '진호',
  ep4_choice:         '',
  honest_doyun:           false,   // Ep.1 도윤 인터루드 '솔직히' 선택 → wrap 콜백
  noticed_doyun:          false,   // Ep.2 도윤 외로움 짚기 선택 → 다음날 wrap 콜백
  leaned_jiu:             false,   // Ep.3 지우에게 한 발 내딛기 선택 → wrap 도윤 콜백
  // ep2-4 vars (also in story.defaults, but listed here as safety net)
  doyun_secret_seen:      false,
  meet_loc:               '',
  date3_loc:              '',
  mingyeol_truth_known:   false,
  heard_side:             '',
  seoa_result:            '',
  seoa_card_given:        false,
  date_loc:               '',
  promise_spring:         false,
  route_ending:           '',      // 'seoa'/'jiu' — 여성별 루트 엔딩 조기 종료 표식(없으면 Ep.4 진엔딩)
};

async function boot() {
  const root = document.getElementById('game');

  // ── 방어: 치명 오류를 화면 상단에 비차단으로 노출 (무성 멈춤 방지) ──
  function showFatal(msg) {
    let el = document.getElementById('__fatal');
    if (!el) {
      el = document.createElement('div');
      el.id = '__fatal';
      // top + pointer-events:none → 배너가 입력을 막지 않음
      el.style.cssText = 'position:fixed;left:0;right:0;top:0;max-height:48%;overflow:auto;background:rgba(192,57,43,.96);color:#fff;font:12px/1.45 monospace;padding:10px;z-index:999999;white-space:pre-wrap;word-break:break-all;pointer-events:none';
      (document.body || document.documentElement).appendChild(el);
    }
    el.textContent += msg + '\n';
  }
  window.addEventListener('error', e => showFatal('JS오류: ' + e.message + ' @ ' + ((e.filename || '').split('/').pop()) + ':' + e.lineno + ':' + e.colno));
  window.addEventListener('unhandledrejection', e => showFatal('Promise오류: ' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason)));

  // ── Check for a reload-resume flag (set by requestResume / slot load) ──────
  // Must be read BEFORE title is shown so we can skip it and resume directly.
  const _resumeRaw = sessionStorage.getItem('masil.resumeOnLoad');
  const _resumePos = _resumeRaw
    ? (() => { sessionStorage.removeItem('masil.resumeOnLoad'); return JSON.parse(_resumeRaw); })()
    : null;

  // Settings (music/sfx/brightness/vibration) + audio/haptics manager.
  // makeSettings loads saved prefs and applies brightness immediately.
  const settings = makeSettings();
  const audio = makeAudio(settings);

  // Load data — story is split per-episode under data/story/ and concatenated
  // at load time (labels recomputed from actual node order). See load_story.js.
  const [script, characters] = await Promise.all([
    loadStory('data/story'),
    fetch('data/characters.json').then(r => r.json()),
  ]);

  // State: load script defaults first, then supplement missing keys
  const state = new GameState(window.localStorage);
  state.defineDefaults(script.defaults || {});
  state.defineDefaults(SUPPLEMENT_DEFAULTS);

  // Persistent: load saved data. play_count is bumped ONLY on 새로하기 (new game),
  // not on boot — so continuing or loading doesn't inflate the counter.
  state.loadPersistent();

  // Check for an existing autosave (non-destructively) to enable 이어하기.
  const hasContinue = !!state.peekAuto();

  // UI modules — built but game buttons NOT mounted yet (they appear after the title).
  const overlay = makeOverlay(root);
  const map     = makeMap(root, { sys: null, state, audio });   // sys not needed for map
  const sys = makeSystems(state, { onNotify: n => {
    overlay.toast(n);
    if (n && n.kind === 'item') { audio.playSfx('se_item'); audio.vibrate(25); }
  } });
  // Phone + settings button objects are created now but NOT mounted until game starts.
  const phone = makePhone(root, { sys, state });
  const settingsUI = makeSettingsUI(root, { settings, audio });

  // Playback controller (skip/auto mode + dialogue history + rollback snapshots).
  // Passed into stage + chat so they record history (used by save previews / backlog / Task-4 skip-auto).
  const playback = makePlayback();
  const typewriter = makeTypewriter(settings);   // 타이핑(텍스트 스크롤) — settings 속도/즉시표시 반영
  const stage = makeStage(root, script.backgrounds || {}, playback, typewriter);
  const sprites = makeSprites(root, { SPRITES, base: SPRITE_BASE });
  const chat = makeChat(root, { MASIL, CHAT_AVATARS, AVATAR_FILES, audio, playback });
  const menu = makeMenu(root, { audio });

  let isChatOpen = false;
  let _lastSceneBg = null;

  // Small delay helper for skip/auto fast-forward
  const delay = ms => new Promise(r => setTimeout(r, ms));

  // view sink — delegates every engine op to the right UI module
  const view = {
    async scene(a) {
      // 같은 배경 연속 컷은 스프라이트 유지(같은 화자 재페이드 깜빡임 방지). 배경 바뀌면 내림.
      if (a.bg !== _lastSceneBg) sprites.hide();
      _lastSceneBg = a.bg;
      stage.scene(a);
    },
    async sprite(a) {          // story 명시 교체: {img} 직접 / {who,face} 레지스트리 / {hide}
      if (a.hide) sprites.hide();
      else if (a.img) sprites.showImage(a.img);
      else sprites.show(a.who, a.face);
    },
    async say(a) {
      // Push rollback snapshot BEFORE advancing (preserves pre-line state)
      playback.pushSnapshot({ vars: state.vars, pos: engine.position() });
      if (!isChatOpen && !a.nosprite) sprites.show(a.who, a.face);   // 화자 스탠딩(채팅/원격·암전 줄 제외)
      await stage.say(a);
      autosave();
    },
    async chatOpen(a) {
      isChatOpen = true;
      sprites.hide();          // 마실 채팅 화면에선 스탠딩 숨김
      chat.open(a);
    },
    async chatClose() {
      isChatOpen = false;
      chat.close();
    },
    async recv(a) {
      await chat.recv(a);
    },
    async send(a) {
      await chat.send(a);
    },
    async pause() {
      if (playback.isSkip()) { await delay(30); return; }
      if (playback.isAuto()) { await delay(900); return; }
      if (isChatOpen) {
        await chat.waitTap();
      } else {
        await stage.waitAdvance();
      }
    },
    async input(a) {
      return menu.input(a);
    },
    async menu(a) {
      return menu.menu(a);
    },
    async consult(a) {
      await overlay.consult(a);
      autosave();
    },
    async callScreen(a) {
      if (a.name === 'result_card') {
        // Inject computed ending data before showing the result card overlay
        const [kind] = sys.final_ending();
        const titleStr = sys.ending_title(kind);
        const type = sys.love_type();
        await overlay.callScreen({ name: a.name, title: titleStr, type });
        audio.vibrate([0, 40, 30, 40]);   // gentle ending haptic
      } else if (a.name === 'subway_map') {
        // Real 2호선 candy-loop map — replaces overlay interstitial stub
        await map.show();
      } else {
        await overlay.callScreen(a);
      }
    },
    async toast(a) {
      overlay.toast(a);
    },
    async music(a) {
      audio.playMusic(a.file);
    },
    async sound(a) {
      audio.playSfxFile(a.file);
      // dramatic late-night phone call → phone-ring haptic (gated by settings)
      if (a.file && a.file.includes('se_phone')) audio.vibrate([0, 120, 80, 120]);
    },
    async amb(a) {
      audio.playAmb(a.file);
    },
    async stop(a) {
      if (a && a.channel === 'amb') audio.stopAmb();
      else audio.stopMusic();
    },
  };

  const engine = new Engine({ script, characters, state, sys, evaluator: makeEvaluator(state, sys), view });
  const autosave = () => state.saveAuto(engine.position());

  // 진짜 엔딩(engine.start/resume이 최상위 return으로 resolve)에 도달하면 호출 —
  // 마지막 프레임에 갇히지 않게 타이틀로 복귀하고, 자동저장을 비워 '이어하기'가
  // 엔딩으로 재진입하지 않게 한다. endings_seen은 영구라 유지됨.
  function finishToTitle() {
    try { state.savePersistent(); state.clearAuto(); } catch (e) {}
    location.reload();
  }

  // ── Save/Load UI ───────────────────────────────────────────────────────────
  // `playback` (the real makePlayback instance) is already in scope and is fed
  // by stage/chat as the player reads — so buildMeta previews are populated.
  const saveLoad = makeSaveLoad(root, { state, engine, playback, audio });

  // ── Backlog overlay ────────────────────────────────────────────────────────
  const backlog = makeBacklog(root, { playback, characters });

  // ── Rollback handler — '한 줄 뒤로': 현재 줄 스냅샷을 버리고 이전 줄로 되돌린다 ──
  function handleRollback() {
    const cnt = playback.snapshotCount();
    if (cnt >= 2) {
      playback.popSnapshot();                                       // 현재 줄 스냅샷 버림
      const prev = playback.popSnapshot();                          // 이전 줄로
      requestRollback(prev.pos, JSON.parse(JSON.stringify(prev.vars)));
    } else if (cnt === 1) {
      const cur = playback.popSnapshot();                           // 한 줄뿐 → 현재 줄 처음으로
      requestRollback(cur.pos, JSON.parse(JSON.stringify(cur.vars)));
    } else {
      overlay.toast({ text: '더 되돌릴 수 없어요' });
    }
  }

  // resume 시 UI 컨텍스트 재구성 — 엔진은 ip만 복원하고 직전 scene(배경)·chat_open을
  // 재실행하지 않아, 롤백/로드로 스토리·채팅 중간에 들어가면 배경 없고 채팅 닫힌 빈
  // 화면이 된다. resume 직전에 가장 가까운 배경과 채팅 열림/닫힘을 복원해 막는다.
  function reconstructContext(ip) {
    const nodes = script.nodes;
    const end = Math.min(ip, nodes.length);
    let bg = null;
    for (let k = end - 1; k >= 0; k--) { const n = nodes[k]; if (n && n.op === 'scene' && n.bg) { bg = n.bg; break; } }
    let room = null;
    for (let k = end - 1; k >= 0; k--) {
      const n = nodes[k]; if (!n) continue;
      if (n.op === 'chat_open') { room = n.room != null ? engine.interp(n.room) : ''; break; }
      if (n.op === 'chat_close') break;
    }
    if (bg) stage.scene({ bg });
    _lastSceneBg = bg;
    if (room != null) { isChatOpen = true; chat.open({ room }); }
    else { isChatOpen = false; chat.close(); }
    // 스탠딩 스프라이트 복원 — 채팅 닫힌 상태에서만. scene/chat_open 경계 뒤로는 안 넘어감.
    if (room == null) {
      for (let k = end - 1; k >= 0; k--) {
        const n = nodes[k];
        if (!n) continue;
        if (n.op === 'scene' || n.op === 'chat_open') break;   // 경계 뒤는 스프라이트 없음
        if (n.op === 'sprite') {
          if (n.hide) sprites.hide();
          else if (n.img) sprites.showImage(n.img);
          else sprites.show(n.who, n.face);
          break;
        }
        if (n.op === 'say' && !n.nosprite && SPRITES[n.who]) { sprites.show(n.who, n.face); break; }
      }
    }
  }

  // ── System menu bar (skip/auto/backlog/save/load/title) ───────────────────
  const sysMenu = makeSysMenu(root, {
    playback,
    onSave:       () => saveLoad.open('save'),
    onLoad:       () => saveLoad.open('load'),
    onBacklog:    () => backlog.open(),
    onTitle:      () => {
      if (confirm('타이틀 화면으로 돌아가시겠어요?\n(저장되지 않은 진행은 사라집니다)')) {
        sessionStorage.removeItem('masil.resumeOnLoad');
        location.reload();
      }
    },
    onQuickSave:  () => quicksave(),
    onQuickLoad:  () => quickload(),
    onRollback:   () => handleRollback(),
  });

  // ── Mount game buttons (⚙️/📱) only after the game starts, not on the title. ──
  function mountGameButtons() {
    phone.mountButton();
    settingsUI.mountButton();
    sysMenu.mountBar();
  }

  // ── gameStarted flag — gates F5/F9 quicksave/quickload ────────────────────
  let gameStarted = false;

  // ── buildMeta (view_dom scope) — delegates to saveLoad ────────────────────
  const buildMeta = () => saveLoad.buildMeta();

  // ── Quicksave / Quickload ──────────────────────────────────────────────────
  function quicksave() {
    state.saveQuick(engine.position(), buildMeta());
    overlay.toast({ text: '퀵세이브' });
    audio && audio.playSfx && audio.playSfx('se_click');
  }

  function quickload() {
    const q = state.peekQuick();
    if (q) {
      requestResume(q, 'quick');   // slotKey → boot calls loadQuick() to restore vars
    } else {
      overlay.toast({ text: '퀵세이브가 없어요' });
    }
  }

  // ── Global keyboard shortcuts (F5 / F9) — only active after game starts ───
  document.addEventListener('keydown', e => {
    if (!gameStarted) return;
    if (e.key === 'F5') {
      e.preventDefault();
      quicksave();
    } else if (e.key === 'F9') {
      e.preventDefault();
      quickload();
    }
  });

  // ── Resume-on-load path: skip title, restore vars + position, start engine ─
  // requestResume() stores a _slotKey alongside the peek pos so we can call
  // state.loadSlot / state.loadQuick here — those calls restore state.vars.
  if (_resumePos) {
    const slotKey = _resumePos._slotKey;
    const varsSnapshot = _resumePos._vars;  // present for rollback path
    let resumedPos;
    if (varsSnapshot !== undefined) {
      // Rollback path: restore vars from snapshot, use pos directly (no slot load)
      state.vars = JSON.parse(JSON.stringify(varsSnapshot));
      resumedPos = _resumePos;
    } else if (slotKey === 'quick') {
      resumedPos = state.loadQuick();
    } else if (typeof slotKey === 'number') {
      resumedPos = state.loadSlot(slotKey);
    } else {
      // No slot key: use the pos directly (vars stay at last-persisted state)
      resumedPos = _resumePos;
    }

    if (resumedPos) {
      mountGameButtons();
      gameStarted = true;
      // 타이틀을 건너뛰므로 #title-layer가 빈 채로 전화면을 덮어 입력을 막지 않게 숨김
      // (index.html에서 기본 hidden이지만 안전장치).
      const _tl = root.querySelector('#title-layer'); if (_tl) _tl.classList.add('hidden');
      try {
        reconstructContext(resumedPos.ip);    // 배경·채팅 컨텍스트 복원 (빈 화면 방지)
        await engine.resume(resumedPos);
        finishToTitle();
      } catch (err) {
        showFatal('RESUME 실패 (ip=' + resumedPos.ip + ', label=' + resumedPos.label + '): ' + (err && (err.stack || err.message) || err));
      }
    } else {
      showFatal('resumedPos 없음 — loadQuick/loadSlot가 null 반환 (저장이 안 읽힘). slotKey=' + JSON.stringify(slotKey));
      _showTitle();
    }
    return;
  }

  // ── Normal path: show title ────────────────────────────────────────────────
  _showTitle();

  function _showTitle() {
    const title = makeTitle(root, {
      hasContinue,

      onNew: async () => {
        // 이어할 지점이 있을 때만 확인 (onTitle과 일관 — 진행 손실 방지)
        if (hasContinue && !confirm('새로 시작하면 이어할 지점이 사라질 수 있어요. 새로 시작할까요?')) return;
        // Bump play_count only for a new playthrough.
        state.persistent.play_count = (state.persistent.play_count || 0) + 1;
        state.savePersistent();
        title.hide();
        mountGameButtons();
        gameStarted = true;
        await engine.start('episode1_full');
        finishToTitle();   // 엔딩 도달 → 타이틀 복귀(막다른 정지 방지)
      },

      onContinue: async () => {
        const pos = state.loadAuto();
        if (pos) {
          title.hide();
          mountGameButtons();
          gameStarted = true;
          reconstructContext(pos.ip);         // 배경·채팅 컨텍스트 복원
          await engine.resume(pos);
          finishToTitle();
        }
      },

      onLoad: async () => {
        // Open save/load menu in load mode.
        // On the title the engine hasn't started yet, so selection goes through
        // requestResume (reload path) for uniformity — identical to in-game load.
        await saveLoad.open('load');
        // If the player closed without selecting, we just stay on the title.
      },

      onSettings: () => {
        settingsUI.open();
      },
    });

    title.show();
  }

  // returnToTitle: Task 4's in-game "메뉴로" button calls location.reload().
  // This re-runs boot() which shows the title first — the simplest safe v1.
  // (Exported for documentation; wired in Task 4.)
  // export function returnToTitle() { location.reload(); }
}

boot().catch(err => console.error('[boot]', err));
