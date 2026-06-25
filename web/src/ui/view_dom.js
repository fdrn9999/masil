import { GameState } from '../state.js';
import { makeSystems } from '../systems.js';
import { makeEvaluator } from '../eval_expr.js';
import { Engine } from '../engine.js';
import { MASIL, CHAT_AVATARS } from '../theme.js';
import { makeStage } from './stage.js';
import { makeChat } from './chat.js';
import { makeMenu } from './menu.js';
import { makeOverlay } from './overlay.js';
import { makeMap }     from './map.js';
import { makePhone }   from './phone.js';
import { makeSettings }   from '../settings.js';
import { makeAudio }      from '../audio.js';
import { makeSettingsUI } from './settings_ui.js';
import { makeTitle }      from './title.js';
import { makeSaveLoad, requestResume } from './saveload.js';

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
};

async function boot() {
  const root = document.getElementById('game');

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

  // Load data — story.json contains all episodes (ep1→epilogue) in one combined file
  const [script, characters] = await Promise.all([
    fetch('data/story.json').then(r => r.json()),
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

  const stage = makeStage(root, script.backgrounds || {});
  const chat = makeChat(root, { MASIL, CHAT_AVATARS, AVATAR_FILES, audio });
  const menu = makeMenu(root, { audio });

  let isChatOpen = false;

  // view sink — delegates every engine op to the right UI module
  const view = {
    async scene(a) {
      stage.scene(a);
    },
    async say(a) {
      await stage.say(a);
      autosave();
    },
    async chatOpen(a) {
      isChatOpen = true;
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

  // ── playback (history for buildMeta) ─────────────────────────────────────
  // view_dom doesn't instantiate makePlayback itself — the engine/stage push
  // history entries via view.say. We expose a minimal playback shim here so
  // saveload.buildMeta can call playback.history().
  // Real playback module is owned by the calling test suite; here we wrap the
  // stage's internal history if available, otherwise return an empty array.
  const playback = {
    history() {
      // stage.history() is wired in stage.js (Task 1); fall back gracefully.
      return (stage && typeof stage.history === 'function') ? stage.history() : [];
    },
  };

  // ── Save/Load UI ───────────────────────────────────────────────────────────
  const saveLoad = makeSaveLoad(root, { state, engine, playback, audio });

  // ── Mount game buttons (⚙️/📱) only after the game starts, not on the title. ──
  function mountGameButtons() {
    phone.mountButton();
    settingsUI.mountButton();
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
      requestResume(q);
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
    let resumedPos;
    if (slotKey === 'quick') {
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
      await engine.resume(resumedPos);
      state.savePersistent();
    } else {
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
        // Bump play_count only for a new playthrough.
        state.persistent.play_count = (state.persistent.play_count || 0) + 1;
        state.savePersistent();
        title.hide();
        mountGameButtons();
        gameStarted = true;
        await engine.start('episode1_full');
        // Persist endings_seen after the story finishes.
        state.savePersistent();
      },

      onContinue: async () => {
        const pos = state.loadAuto();
        if (pos) {
          title.hide();
          mountGameButtons();
          gameStarted = true;
          await engine.resume(pos);
          // Persist endings_seen after the story finishes.
          state.savePersistent();
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
