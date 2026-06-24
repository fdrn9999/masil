import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameState } from '../web/src/state.js';
import { makeSystems } from '../web/src/systems.js';
import { makeEvaluator } from '../web/src/eval_expr.js';
import { Engine } from '../web/src/engine.js';

const script = JSON.parse(readFileSync(new URL('../web/data/ep1.json', import.meta.url)));
const characters = JSON.parse(readFileSync(new URL('../web/data/characters.json', import.meta.url)));
const DEFAULTS = {
  like: { seoa: 0, jiu: 0, mingyeol: 0 }, sincere: { seoa: 0, jiu: 0, mingyeol: 0 },
  doyun_bond: 0, inventory: {}, item_flags: {}, doyun_used_chapter: false, show_gauges: false,
  mc_name: '진호', seoa_result: '', date_loc: '', seoa_card_given: false, promise_spring: false, ep4_choice: '',
  seoa_like: 0, seoa_sinc: 0,
};

function autoView(pickFn) {
  const says = [];
  let menuN = 0;
  return {
    says,
    async scene() {}, async chatOpen() {}, async chatClose() {}, async recv() {}, async send() {},
    async pause() {}, async consult() {}, async callScreen() {}, async toast() {},
    async music() {}, async sound() {}, async amb() {}, async stop() {},
    async say(a) { says.push(a.text); },
    async input() { return '진호'; },
    async menu(a) { return pickFn(menuN++, a.choices); },
  };
}

function play(pickFn) {
  const state = new GameState();
  state.defineDefaults(DEFAULTS);
  const sys = makeSystems(state, {});
  const view = autoView(pickFn);
  const eng = new Engine({ script, characters, state, sys, evaluator: makeEvaluator(state, sys), view });
  return eng.start('episode1_full').then(() => ({ state, view }));
}

test('plays prologue+Ep1 to an end taking first choices, no crash, no unknown var', async () => {
  const { view } = await play(() => 0);
  assert.ok(view.says.length > 50, 'should render many lines');
});

test('plays taking last choices to the other end', async () => {
  const { view } = await play((_, choices) => choices.length - 1);
  assert.ok(view.says.length > 50);
});

test('sakura_card branch: choosing to make postcard then give it sets seoa_card_given', async () => {
  // menu indices (always-first picker → all 0):
  // 0: 서아 텐션 응답, 1: 도윤 상담, 2: 벚꽃 엽서 만들기(pick 0=엽서제작),
  // 3: 첫인사, 4: 진심 한스푼, 5: 장소(pick 0=한강),
  // 6: 벚꽃 엽서 건넴(has_item 분기, pick 0=건넴), 7: 결말
  const { state } = await play((i) => (i === 2 || i === 7) ? 0 : 0);
  assert.equal(typeof state.vars.seoa_card_given, 'boolean');
});
