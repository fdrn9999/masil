import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../web/src/state.js';
import { makeSystems } from '../web/src/systems.js';

function mkSys() {
  const s = new GameState();
  s.defineDefaults({
    like: { seoa: 0, jiu: 0, mingyeol: 0 }, sincere: { seoa: 0, jiu: 0, mingyeol: 0 },
    doyun_bond: 0, inventory: {}, item_flags: {}, doyun_used_chapter: false,
    ep4_choice: '',
  });
  const notes = [];
  return { sys: makeSystems(s, { onNotify: n => notes.push(n) }), state: s, notes };
}

test('add_like clamps to 0..100', () => {
  const { sys, state } = mkSys();
  sys.add_like('seoa', 120); assert.equal(state.vars.like.seoa, 100);
  sys.add_like('seoa', -250); assert.equal(state.vars.like.seoa, 0);
});

test('give_item consumes and records recipient', () => {
  const { sys, state } = mkSys();
  sys.get_item('sakura_card');
  assert.equal(sys.give_item('sakura_card', 'seoa'), true);
  assert.equal(sys.has_item('sakura_card'), false);
  assert.equal(sys.was_given('sakura_card'), 'seoa');
});

test('get_item notifies via onNotify', () => {
  const { sys, notes } = mkSys();
  sys.get_item('sakura_card');
  assert.equal(notes[0].text, '아이템 획득: 벚꽃 엽서');
});

test('final_ending: run choice short-circuits', () => {
  const { sys, state } = mkSys();
  state.vars.ep4_choice = 'run';
  assert.deepEqual(sys.final_ending(), ['run', null]);
});

test('decide_ending: two fishtanks => fishtank', () => {
  const { sys, state } = mkSys();
  state.vars.like = { seoa: 80, jiu: 75, mingyeol: 0 };
  state.vars.sincere = { seoa: 10, jiu: 10, mingyeol: 0 };
  assert.deepEqual(sys.decide_ending(), ['fishtank', null]);
});

test('apply_timing seoa now boosts like and returns line', () => {
  const { sys, state } = mkSys();
  const line = sys.apply_timing('seoa', 'now');
  assert.equal(state.vars.like.seoa, 10);
  assert.match(line, /답장 빠르네/);
});

test('bitter_candidate returns hname of heroine with max like+sincere', () => {
  const { sys, state } = mkSys();
  state.vars.like = { seoa: 30, jiu: 60, mingyeol: 20 };
  state.vars.sincere = { seoa: 10, jiu: 5, mingyeol: 50 };
  // jiu: 65, mingyeol: 70 → mingyeol wins
  assert.equal(sys.bitter_candidate(), '민결');
});

test('bitter_candidate returns first on tie (mirrors Python max first-wins)', () => {
  const { sys, state } = mkSys();
  state.vars.like = { seoa: 50, jiu: 50, mingyeol: 0 };
  state.vars.sincere = { seoa: 0, jiu: 0, mingyeol: 0 };
  // seoa and jiu tied at 50; seoa comes first in HEROINES → seoa wins
  assert.equal(sys.bitter_candidate(), '서아');
});

// ── Task 4: record_ending / ending_title / love_type ─────────────────────────

test('record_ending deduplicates: calling twice yields one entry', () => {
  const { sys, state } = mkSys();
  sys.record_ending('doyun');
  sys.record_ending('doyun');
  assert.deepEqual(state.persistent.endings_seen, ['doyun']);
});

test('record_ending accumulates different kinds in order', () => {
  const { sys, state } = mkSys();
  sys.record_ending('run');
  sys.record_ending('doyun');
  sys.record_ending('good');
  assert.deepEqual(state.persistent.endings_seen, ['run', 'doyun', 'good']);
});

test('record_ending initialises endings_seen if missing', () => {
  const { sys, state } = mkSys();
  // persistent starts empty — no endings_seen key
  assert.equal(state.persistent.endings_seen, undefined);
  sys.record_ending('lonely');
  assert.deepEqual(state.persistent.endings_seen, ['lonely']);
});

test('ending_title("doyun") returns verbatim title', () => {
  const { sys } = mkSys();
  assert.equal(sys.ending_title('doyun'), '그날 그 손을 끝까지');
});

test('ending_title("run") returns verbatim title', () => {
  const { sys } = mkSys();
  assert.equal(sys.ending_title('run'), '다시 혼자');
});

test('ending_title unknown kind returns kind itself', () => {
  const { sys } = mkSys();
  assert.equal(sys.ending_title('no_such_ending'), 'no_such_ending');
});

test('love_type "run" => 도망러', () => {
  const { sys, state } = mkSys();
  state.vars.ep4_choice = 'run';
  const [label, desc] = sys.love_type();
  assert.equal(label, '도망러');
  assert.match(desc, /익숙한 거리/);
});

test('love_type "true" + jiu => 슬로우버너', () => {
  const { sys, state } = mkSys();
  // final_ending returns ['true','jiu'] when love choice + sincere.mingyeol<40 but sincere.jiu>=70
  state.vars.sincere = { seoa: 0, jiu: 70, mingyeol: 0 };
  state.vars.like    = { seoa: 0, jiu: 60, mingyeol: 0 };
  const [label, desc] = sys.love_type();
  assert.equal(label, '슬로우버너');
  assert.match(desc, /식지 않는 불/);
});

test('love_type "true" + non-jiu => 진심파', () => {
  const { sys, state } = mkSys();
  // decide_ending → ['true', 'seoa'] when seoa sincere>=70, like>=60
  state.vars.sincere = { seoa: 75, jiu: 0, mingyeol: 0 };
  state.vars.like    = { seoa: 65, jiu: 0, mingyeol: 0 };
  const [label, desc] = sys.love_type();
  assert.equal(label, '진심파');
  assert.match(desc, /끝내 한 사람에게/);
});
