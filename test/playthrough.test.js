import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameState } from '../web/src/state.js';
import { makeSystems } from '../web/src/systems.js';
import { makeEvaluator } from '../web/src/eval_expr.js';
import { Engine } from '../web/src/engine.js';
import { assembleStory } from '../web/src/load_story.js';

// Story is split per-episode under data/story/ — assemble it exactly like the
// browser loader (concatenate node arrays in order, recompute labels).
const _storyBase = new URL('../web/data/story/', import.meta.url);
const _meta = JSON.parse(readFileSync(new URL('meta.json', _storyBase)));
const _epNodes = _meta.episodes.map(f => JSON.parse(readFileSync(new URL(f, _storyBase))).nodes);
const script = assembleStory(_meta, _epNodes);
const characters = JSON.parse(readFileSync(new URL('../web/data/characters.json', import.meta.url)));

// Structural defaults not present in script.defaults
const SUPPLEMENT_DEFAULTS = {
  like: { seoa: 0, jiu: 0, mingyeol: 0 }, sincere: { seoa: 0, jiu: 0, mingyeol: 0 },
  doyun_bond: 0, inventory: {}, item_flags: {}, doyun_used_chapter: false, show_gauges: false,
  mc_name: '진호', seoa_result: '', date_loc: '', seoa_card_given: false, promise_spring: false,
  ep4_choice: '', doyun_secret_seen: false, meet_loc: '', date3_loc: '',
  mingyeol_truth_known: false, heard_side: '', route_ending: '',
};

// 4-way ending menu identified by its exact prompt text.
// Using text-matching is robust against branch-dependent menu count shifts.
const EP4_ENDING_PROMPT = '── Ep.4 — 그리고 이 이야기의 답을 정하는 선택 ──';

// Choice text fragments for each ending path (substrings for robustness)
const EP4_CHOICE_TEXT = {
  reconcile: '도윤과 함께',         // choice 0
  love:      '민결을 선택한다',      // choice 1
  friend:    '도윤과의 의리를 지킨다', // choice 2
  run:       '도망친다',            // choice 3
};

function autoView(pickFn) {
  const says = [];
  let menuN = 0;
  const callScreenCalls = [];
  return {
    says,
    callScreenCalls,
    async scene() {}, async chatOpen() {}, async chatClose() {}, async recv() {}, async send() {},
    async pause() {}, async consult() {}, async toast() {},
    async music() {}, async sound() {}, async amb() {}, async stop() {},
    async say(a) { says.push(a.text); },
    async input() { return '진호'; },
    async menu(a) { return pickFn(menuN++, a); },
    async callScreen(a) { callScreenCalls.push(a.name); },
  };
}

/**
 * Run the full story (episode1_full → epilogue → result_card).
 * @param {function} pickFn  (menuIndex, menuAction) → choiceIndex
 * @param {object}   preVars  vars to force-set before the engine starts (for gauge seeding)
 */
function play(pickFn, preVars = {}) {
  const state = new GameState();
  state.defineDefaults(script.defaults || {});
  state.defineDefaults(SUPPLEMENT_DEFAULTS);
  // Force-seed vars (e.g. gauges for ending tests); must come after defineDefaults
  Object.assign(state.vars, preVars);
  const sys = makeSystems(state, {});
  const view = autoView(pickFn);
  const eng = new Engine({ script, characters, state, sys, evaluator: makeEvaluator(state, sys), view });
  return eng.start('episode1_full').then(() => ({ state, view, sys }));
}

/**
 * Build a picker that matches the ep4 ending menu by prompt text and selects
 * the choice whose text includes `targetText`. Falls back to `fallback` for all
 * other menus.
 */
// 여성별 루트 엔딩 게이트(서아 '천천히' / 지우 '그 다음으로')를 피해 Ep.4까지 진행시키는 폴백.
// Ep.1: choice 0 = 빠른 수락(계속). Ep.3: '회피(친구)' 선택해야 Ep.4로 계속.
function continuePicker(_n, a) {
  if (a.prompt === '── Ep.3의 결말을 가르는 선택 ──') {
    const idx = a.choices.findIndex(c => c.includes('회피') || c.includes('친구가 편'));
    if (idx >= 0) return idx;
  }
  return 0;
}
function makeEndingPicker(targetChoiceText, fallback = continuePicker) {
  return (_n, a) => {
    if (a.prompt === EP4_ENDING_PROMPT) {
      const idx = a.choices.findIndex(c => c.includes(targetChoiceText));
      if (idx >= 0) return idx;
    }
    return fallback(_n, a);
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke tests: full story, no crash, result_card shown
// ────────────────────────────────────────────────────────────────────────────

test('full story all-first-choices: no crash, reaches result_card', async () => {
  const { view } = await play(() => 0);
  assert.ok(view.says.length > 100, `expected >100 say nodes, got ${view.says.length}`);
  assert.ok(
    view.callScreenCalls.includes('result_card'),
    'expected result_card to be called'
  );
});

test('full story all-last-choices: no crash, reaches result_card', async () => {
  const { view } = await play((_n, a) => a.choices.length - 1);
  assert.ok(view.says.length > 100);
  assert.ok(view.callScreenCalls.includes('result_card'));
});

// ────────────────────────────────────────────────────────────────────────────
// Ep1 branch: sakura_card
// ────────────────────────────────────────────────────────────────────────────

test('sakura_card branch: choosing to make postcard then give it sets seoa_card_given', async () => {
  // All-first-choices → gets the postcard item (menu with '엽서를 만들어') + gives it
  const { state } = await play(() => 0);
  assert.equal(state.vars.seoa_card_given, true);
});

// ────────────────────────────────────────────────────────────────────────────
// Endings tests — robust text-match picker for the 4-way ending menu
// ────────────────────────────────────────────────────────────────────────────

// (a) ep4_choice='run' → final_ending()[0] === 'run'
test('ending run: 도망 choice → final_ending returns run, endings_seen includes run', async () => {
  const picker = makeEndingPicker(EP4_CHOICE_TEXT.run);
  const { state, sys } = await play(picker);
  assert.equal(state.vars.ep4_choice, 'run');
  const [kind] = sys.final_ending();
  assert.equal(kind, 'run');
  // record_ending ran in epilogue — verify persistent capture
  assert.ok(
    (state.persistent.endings_seen || []).includes('run'),
    `expected endings_seen to include 'run', got: ${JSON.stringify(state.persistent.endings_seen)}`
  );
});

// (route-seoa) Ep.1 '천천히'(choice 1) → 조기 종료, 루트 엔딩 seoa
test('route ending seoa: Ep.1 천천히 선택 → 조기 종료 + final_ending seoa', async () => {
  const picker = (_n, a) => (a.prompt === '── 이 대답이 Ep.1의 결말을 가른다. ──' ? 1 : 0);
  const { state, sys } = await play(picker);
  assert.equal(state.vars.route_ending, 'seoa');
  assert.equal(sys.final_ending()[0], 'seoa');
  assert.ok((state.persistent.endings_seen || []).includes('seoa'));
  assert.equal(state.vars.ep4_choice, '', 'Ep.4에 진입하지 않아야(조기 종료)');
});

// (route-jiu) Ep.1 빠른수락(계속) + Ep.3 '그 다음으로'(choice 0) → 루트 엔딩 jiu
test('route ending jiu: Ep.3 그 다음으로 선택 → 조기 종료 + final_ending jiu', async () => {
  const { state, sys } = await play(() => 0);   // Ep.1 choice0=fast(계속), Ep.3 choice0=true(지우 루트)
  assert.equal(state.vars.route_ending, 'jiu');
  assert.equal(sys.final_ending()[0], 'jiu');
  assert.ok((state.persistent.endings_seen || []).includes('jiu'));
  assert.equal(state.vars.ep4_choice, '');
});

// (b) ep4_choice='friend' + doyun_bond≥25 → final_ending()[0] === 'doyun'
test('ending doyun: 도윤의리 choice + doyun_bond=30 → final_ending returns doyun, endings_seen includes doyun', async () => {
  const picker = makeEndingPicker(EP4_CHOICE_TEXT.friend);
  // Pre-seed doyun_bond to satisfy the ≥25 threshold
  const { state, sys } = await play(picker, { doyun_bond: 30 });
  assert.equal(state.vars.ep4_choice, 'friend');
  const [kind] = sys.final_ending();
  assert.equal(kind, 'doyun');
  assert.ok(
    (state.persistent.endings_seen || []).includes('doyun'),
    `expected endings_seen to include 'doyun', got: ${JSON.stringify(state.persistent.endings_seen)}`
  );
});

// (c) reconcile ending: 화해 choice + story naturally builds doyun_bond≥25 + seeding sinc.mingyeol=40
//     → final_ending returns ['reconcile', 'mingyeol']
test('ending reconcile: 화해 choice + sinc.mingyeol seeded ≥35 → final_ending returns reconcile', async () => {
  const picker = makeEndingPicker(EP4_CHOICE_TEXT.reconcile);
  // Story naturally builds doyun_bond≥25; seed sinc.mingyeol to satisfy ≥35 condition
  const { state, sys } = await play(picker, {
    sincere: { seoa: 0, jiu: 0, mingyeol: 40 },
  });
  assert.equal(state.vars.ep4_choice, 'reconcile');
  const [kind] = sys.final_ending();
  assert.equal(kind, 'reconcile');
  assert.ok(
    (state.persistent.endings_seen || []).includes('reconcile'),
    `expected endings_seen to include 'reconcile', got: ${JSON.stringify(state.persistent.endings_seen)}`
  );
});

// (d) ep4_choice='love' + sinc.mingyeol≥40 → final_ending()[0] === 'true', who === 'mingyeol'
test('ending true(mingyeol): 민결선택 + sinc.mingyeol=50 → final_ending returns true+mingyeol', async () => {
  const picker = makeEndingPicker(EP4_CHOICE_TEXT.love);
  const { state, sys } = await play(picker, {
    sincere: { seoa: 0, jiu: 0, mingyeol: 50 },
  });
  assert.equal(state.vars.ep4_choice, 'love');
  const [kind, who] = sys.final_ending();
  assert.equal(kind, 'true');
  assert.equal(who, 'mingyeol');
  assert.ok(
    (state.persistent.endings_seen || []).includes('true'),
    `expected endings_seen to include 'true', got: ${JSON.stringify(state.persistent.endings_seen)}`
  );
});
