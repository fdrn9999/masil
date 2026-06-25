import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../web/src/state.js';
import { makeSystems } from '../web/src/systems.js';
import { makeEvaluator } from '../web/src/eval_expr.js';

function setup() {
  const s = new GameState();
  s.defineDefaults({ like: { seoa: 0, jiu: 0, mingyeol: 0 }, sincere: { seoa: 0, jiu: 0, mingyeol: 0 },
    doyun_bond: 0, inventory: {}, item_flags: {}, promise_spring: false });
  const sys = makeSystems(s, {});
  return { ev: makeEvaluator(s, sys), s };
}

test('run executes a system call (V/S prefixed)', () => {
  const { ev, s } = setup();
  ev.run('S.add_like("seoa", 15)');
  assert.equal(s.vars.like.seoa, 15);
});

test('run assigns a var', () => {
  const { ev, s } = setup();
  ev.run('V.promise_spring = true');
  assert.equal(s.vars.promise_spring, true);
});

test('run compound assign on bond', () => {
  const { ev, s } = setup();
  ev.run('V.doyun_bond += 5');
  assert.equal(s.vars.doyun_bond, 5);
});

test('test evaluates condition', () => {
  const { ev, s } = setup();
  s.vars.like.seoa = 80; s.vars.sincere.seoa = 10;
  assert.equal(ev.test('V.like["seoa"] >= 70 && V.sincere["seoa"] < 30'), true);
});

test('test sees system predicate', () => {
  const { ev, s } = setup();
  s.vars.inventory.sakura_card = 1;
  assert.equal(ev.test('S.has_item("sakura_card")'), true);
});
