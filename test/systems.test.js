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
