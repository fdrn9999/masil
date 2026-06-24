import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameState } from '../web/src/state.js';
import { makeSystems } from '../web/src/systems.js';
import { makeEvaluator } from '../web/src/eval_expr.js';
import { Engine } from '../web/src/engine.js';

const script = JSON.parse(readFileSync(new URL('./fixtures/sample.json', import.meta.url)));
const characters = { n: { name: null, color: null }, mc: { name: '나', color: '#fff' } };

function recordingView(menuChoice = 0) {
  const log = [];
  return {
    log,
    async scene(a) { log.push(['scene', a]); },
    async say(a) { log.push(['say', a.text]); },
    async menu(a) { log.push(['menu', a.choices.length]); return menuChoice; },
    async pause() { log.push(['pause']); },
    async input(a) { log.push(['input']); return '진호'; },
    async chatOpen() {}, async chatClose() {}, async recv() {}, async send() {},
    async consult() {}, async callScreen() {}, async toast() {},
    async music() {}, async sound() {}, async amb() {}, async stop() {},
  };
}

function makeEngine(view) {
  const state = new GameState();
  state.defineDefaults({ like: { seoa: 0 }, sincere: { seoa: 0 }, mc_name: '진호',
    inventory: {}, item_flags: {}, doyun_bond: 0 });
  const sys = makeSystems(state, {});
  return new Engine({ script, characters, state, sys, evaluator: makeEvaluator(state, sys), view });
}

test('interpolates [mc_name] in say', async () => {
  const view = recordingView(1); // choose B
  await makeEngine(view).start('start');
  assert.equal(view.log[0][1] || view.log.find(e => e[0] === 'say')[1], '안녕 진호.');
});

test('menu choice B then if-branch true (like incremented earlier)', async () => {
  const view = recordingView(1);
  await makeEngine(view).start('start');
  const says = view.log.filter(e => e[0] === 'say').map(e => e[1]);
  assert.deepEqual(says, ['안녕 진호.', 'B 골랐다', '호감 높음']);
});

test('menu choice A jumps to branch_a and never reaches unreachable say', async () => {
  const view = recordingView(0);
  await makeEngine(view).start('start');
  const says = view.log.filter(e => e[0] === 'say').map(e => e[1]);
  assert.deepEqual(says, ['안녕 진호.', 'A 분기']);
});
