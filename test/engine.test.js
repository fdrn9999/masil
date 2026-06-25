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

test('interp: [[ yields literal [ without interpolating the bracketed word, plus real var', () => {
  const engine = makeEngine(recordingView(0));
  assert.equal(engine.interp('값은 [[ESC] 그리고 [mc_name]'), '값은 [ESC] 그리고 진호');
});

// recv name interpolation: name:"[mc_name]" must be resolved via interp at runtime
test('recv: name with [mc_name] interpolated', async () => {
  const recvLog = [];
  const view = recordingView(0);
  view.recv = async (a) => { recvLog.push(a); };
  const inlineScript = {
    labels: { recv_test: 0 },
    nodes: [
      { op: 'label', name: 'recv_test' },
      { op: 'recv', name: '[mc_name]', text: '안녕' },
      { op: 'return' },
    ]
  };
  const state = new GameState();
  state.defineDefaults({ like: { seoa: 0 }, sincere: { seoa: 0 }, mc_name: '진호',
    inventory: {}, item_flags: {}, doyun_bond: 0 });
  const sys = makeSystems(state, {});
  const engine = new Engine({ script: inlineScript, characters, state, sys,
    evaluator: makeEvaluator(state, sys), view });
  await engine.start('recv_test');
  assert.equal(recvLog.length, 1, 'recv should have been called once');
  assert.equal(recvLog[0].name, '진호', `recv name should be interpolated to 진호, got: ${recvLog[0].name}`);
  assert.equal(recvLog[0].text, '안녕');
});

// FIX I-1 regression: menu nested inside if-then body must propagate jump upward correctly.
// Before fix, the resolved number from _gotoLabel was returned through _execList but then
// the outer if handler also called _gotoLabel on an already-resolved number — swallowing it.
test('FIX I-1: menu nested inside if-then propagates jump to label, does not continue past menu', async () => {
  // Script: if(true) { menu -> choice A jumps to "done" }; say "UNREACHABLE"; label done; say "LANDED"
  const inlineScript = {
    labels: { nested_test: 0, done: 6 },
    nodes: [
      { op: 'label', name: 'nested_test' },           // 0
      { op: 'if', cond: 'true',                       // 1
        then: [
          { op: 'menu', prompt: '고를래?', choices: [  // in then-list
            { text: 'A', body: [ { op: 'jump', label: 'done' } ] }
          ]}
        ],
        else: [] },
      { op: 'say', who: 'n', text: 'UNREACHABLE' },   // 2  (must NOT be reached)
      { op: 'say', who: 'n', text: 'UNREACHABLE2' },  // 3
      { op: 'return' },                                // 4
      { op: 'say', who: 'n', text: 'UNREACHABLE3' },  // 5
      { op: 'label', name: 'done' },                  // 6
      { op: 'say', who: 'n', text: 'LANDED' },        // 7
      { op: 'return' },                                // 8
    ]
  };
  const state = new GameState();
  state.defineDefaults({ like: { seoa: 0 }, sincere: { seoa: 0 }, mc_name: '진호',
    inventory: {}, item_flags: {}, doyun_bond: 0 });
  const sys = makeSystems(state, {});
  const view = recordingView(0); // pick first (only) choice
  const engine = new Engine({ script: inlineScript, characters, state, sys,
    evaluator: makeEvaluator(state, sys), view });
  await engine.start('nested_test');
  const says = view.log.filter(e => e[0] === 'say').map(e => e[1]);
  // must reach 'LANDED' and must NOT include any 'UNREACHABLE*' text
  assert.ok(says.includes('LANDED'), `Expected LANDED in says: ${JSON.stringify(says)}`);
  assert.ok(!says.some(s => s.startsWith('UNREACHABLE')),
    `Should not reach UNREACHABLE nodes, got: ${JSON.stringify(says)}`);
});
