import { GameState } from '../state.js';
import { makeSystems } from '../systems.js';
import { makeEvaluator } from '../eval_expr.js';
import { Engine } from '../engine.js';
import { MASIL, CHAT_AVATARS } from '../theme.js';
import { makeStage } from './stage.js';
import { makeChat } from './chat.js';
import { makeMenu } from './menu.js';
import { makeOverlay } from './overlay.js';

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

// Safe audio: try/catch so missing assets never throw
function safePlay(file, loop) {
  if (!file) return;
  try {
    const a = new Audio(file);
    a.loop = !!loop;
    a.play().catch(() => {});
  } catch (_e) {}
}

async function boot() {
  const root = document.getElementById('game');

  // Load data — story.json contains all episodes (ep1→epilogue) in one combined file
  const [script, characters] = await Promise.all([
    fetch('data/story.json').then(r => r.json()),
    fetch('data/characters.json').then(r => r.json()),
  ]);

  // State: load script defaults first, then supplement missing keys
  const state = new GameState(window.localStorage);
  state.defineDefaults(script.defaults || {});
  state.defineDefaults(SUPPLEMENT_DEFAULTS);

  // Persistent: load then bump play_count
  state.loadPersistent();
  state.persistent.play_count = (state.persistent.play_count || 0) + 1;
  state.savePersistent();

  // UI modules
  const overlay = makeOverlay(root);
  const sys = makeSystems(state, { onNotify: n => overlay.toast(n) });
  const stage = makeStage(root, script.backgrounds || {});
  const chat = makeChat(root, { MASIL, CHAT_AVATARS, AVATAR_FILES });
  const menu = makeMenu(root);

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
        const title = sys.ending_title(kind);
        const type = sys.love_type();
        await overlay.callScreen({ name: a.name, title, type });
      } else {
        await overlay.callScreen(a);
      }
    },
    async toast(a) {
      overlay.toast(a);
    },
    async music(a) {
      safePlay(a.file, true);
    },
    async sound(a) {
      safePlay(a.file, false);
    },
    async amb(a) {
      safePlay(a.file, true);
    },
    async stop() {
      // no-op: Web Audio teardown deferred to a later milestone
    },
  };

  const engine = new Engine({ script, characters, state, sys, evaluator: makeEvaluator(state, sys), view });
  const autosave = () => state.saveAuto(engine.position());

  await engine.start('episode1_full');
  // Persist endings_seen after the story finishes.
  // record_ending() mutates persistent.endings_seen during the epilogue,
  // so saving here captures the newly unlocked ending across sessions.
  state.savePersistent();
}

boot().catch(err => console.error('[boot]', err));
