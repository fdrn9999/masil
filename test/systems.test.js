import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../web/src/state.js';
import { makeSystems } from '../web/src/systems.js';
import { MAP, STATIONS, ENDING_LIST } from '../web/src/theme.js';

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
  // makeSystems now initialises endings_seen to [] per d.1 defaults
  // (was undefined before Task 4; test updated to reflect correct new state)
  assert.deepEqual(state.persistent.endings_seen, []);
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

// ── Task 4 NEW: d.1 defaults, d.2 helpers ───────────────────────────────────

function mkSys4() {
  const s = new GameState();
  s.defineDefaults({
    like: { seoa: 0, jiu: 0, mingyeol: 0 }, sincere: { seoa: 0, jiu: 0, mingyeol: 0 },
    doyun_bond: 0, inventory: {}, item_flags: {}, doyun_used_chapter: false,
    ep4_choice: '',
  });
  const sys = makeSystems(s, {});
  // apply d.1 defaults (same logic as makeSystems initialises them)
  return { sys, state: s };
}

// d.1 defaults
test('d.1: times_ran defaults to 0', () => {
  const { state } = mkSys4();
  assert.equal(state.vars.times_ran, 0);
});

test('d.1: promise_spring defaults to false', () => {
  const { state } = mkSys4();
  assert.equal(state.vars.promise_spring, false);
});

test('d.1: endings_seen persistent defaults to []', () => {
  const { state } = mkSys4();
  assert.deepEqual(state.persistent.endings_seen, []);
});

test('d.1: play_count persistent defaults to 0', () => {
  const { state } = mkSys4();
  assert.equal(state.persistent.play_count, 0);
});

// endings_seen_count
test('endings_seen_count() returns 0 when empty', () => {
  const { sys } = mkSys4();
  assert.equal(sys.endings_seen_count(), 0);
});

test('endings_seen_count() counts persistent endings_seen length', () => {
  const { sys, state } = mkSys4();
  state.persistent.endings_seen = ['run', 'doyun', 'good'];
  assert.equal(sys.endings_seen_count(), 3);
});

test('endings_seen_count() returns a number, not a raw gauge', () => {
  const { sys } = mkSys4();
  assert.equal(typeof sys.endings_seen_count(), 'number');
});

// all_endings_seen
test('all_endings_seen() false when none seen', () => {
  const { sys } = mkSys4();
  assert.equal(sys.all_endings_seen(), false);
});

test('all_endings_seen() true when all 7 seen', () => {
  const { sys, state } = mkSys4();
  state.persistent.endings_seen = ['reconcile','doyun','true','good','fishtank','lonely','run'];
  assert.equal(sys.all_endings_seen(), true);
});

test('all_endings_seen() false when only 6 seen', () => {
  const { sys, state } = mkSys4();
  state.persistent.endings_seen = ['reconcile','doyun','true','good','fishtank','lonely'];
  assert.equal(sys.all_endings_seen(), false);
});

// rel_subtitle — doyun branch
test('rel_subtitle("doyun") bond<12 => "오픈챗 게임 친구"', () => {
  const { sys, state } = mkSys4();
  state.vars.doyun_bond = 0;
  assert.equal(sys.rel_subtitle('doyun'), '오픈챗 게임 친구');
});

test('rel_subtitle("doyun") bond=12 => "의지가 되는 동생"', () => {
  const { sys, state } = mkSys4();
  state.vars.doyun_bond = 12;
  assert.equal(sys.rel_subtitle('doyun'), '의지가 되는 동생');
});

test('rel_subtitle("doyun") bond>=25 => "둘도 없는 친구"', () => {
  const { sys, state } = mkSys4();
  state.vars.doyun_bond = 25;
  assert.equal(sys.rel_subtitle('doyun'), '둘도 없는 친구');
});

// rel_subtitle — heroine branches; never a number
test('rel_subtitle("seoa") both zero => "아직 모르는 사이"', () => {
  const { sys } = mkSys4();
  assert.equal(sys.rel_subtitle('seoa'), '아직 모르는 사이');
});

test('rel_subtitle("seoa") like=1 => "이제 막 알게 된"', () => {
  const { sys, state } = mkSys4();
  state.vars.like.seoa = 1;
  assert.equal(sys.rel_subtitle('seoa'), '이제 막 알게 된');
});

test('rel_subtitle("seoa") like=30 => "점점 친해지는"', () => {
  const { sys, state } = mkSys4();
  state.vars.like.seoa = 30;
  assert.equal(sys.rel_subtitle('seoa'), '점점 친해지는');
});

test('rel_subtitle("seoa") like=60, sincere=10 => "잘 보이는 중 (겉도는)"', () => {
  const { sys, state } = mkSys4();
  state.vars.like.seoa = 60; state.vars.sincere.seoa = 10;
  assert.equal(sys.rel_subtitle('seoa'), '잘 보이는 중 (겉도는)');
});

test('rel_subtitle("seoa") sincere=35 => "조금씩 진심이 오가는"', () => {
  const { sys, state } = mkSys4();
  state.vars.sincere.seoa = 35;
  assert.equal(sys.rel_subtitle('seoa'), '조금씩 진심이 오가는');
});

test('rel_subtitle("seoa") sincere=60 => "마음이 닿은 사람"', () => {
  const { sys, state } = mkSys4();
  state.vars.sincere.seoa = 60;
  assert.equal(sys.rel_subtitle('seoa'), '마음이 닿은 사람');
});

test('rel_subtitle never returns a number', () => {
  const { sys, state } = mkSys4();
  state.vars.doyun_bond = 30; state.vars.like.seoa = 80; state.vars.sincere.seoa = 70;
  assert.equal(typeof sys.rel_subtitle('doyun'), 'string');
  assert.equal(typeof sys.rel_subtitle('seoa'), 'string');
  // must not be a numeric string
  assert.ok(isNaN(Number(sys.rel_subtitle('doyun'))));
  assert.ok(isNaN(Number(sys.rel_subtitle('seoa'))));
});

// is_met
test('is_met("seoa") false when like=0 sincere=0', () => {
  const { sys } = mkSys4();
  assert.equal(sys.is_met('seoa'), false);
});

test('is_met("seoa") true when like>0', () => {
  const { sys, state } = mkSys4();
  state.vars.like.seoa = 1;
  assert.equal(sys.is_met('seoa'), true);
});

test('is_met("jiu") true when only sincere>0', () => {
  const { sys, state } = mkSys4();
  state.vars.sincere.jiu = 5;
  assert.equal(sys.is_met('jiu'), true);
});

// kept_promises
test('kept_promises() empty when nothing given', () => {
  const { sys } = mkSys4();
  assert.deepEqual(sys.kept_promises(), []);
});

test('kept_promises() includes sakura_card line when given', () => {
  const { sys, state } = mkSys4();
  state.vars.item_flags['sakura_card_given'] = 'seoa';
  assert.ok(sys.kept_promises().includes('서아에게 벚꽃 엽서를 건넸다'));
});

test('kept_promises() includes warm_can line when given', () => {
  const { sys, state } = mkSys4();
  state.vars.item_flags['warm_can_given'] = 'jiu';
  assert.ok(sys.kept_promises().includes('지우에게 따뜻한 캔커피를 챙겼다'));
});

test('kept_promises() includes hangover line when given', () => {
  const { sys, state } = mkSys4();
  state.vars.item_flags['hangover_given'] = 'doyun';
  assert.ok(sys.kept_promises().includes('도윤에게 숙취해소제를 다시 쥐여줬다'));
});

test('kept_promises() includes promise_spring line when true', () => {
  const { sys, state } = mkSys4();
  state.vars.promise_spring = true;
  assert.ok(sys.kept_promises().includes('봄에 석촌호수에 가자는 약속을 남겼다'));
});

test('kept_promises() returns array of strings, never numbers', () => {
  const { sys, state } = mkSys4();
  state.vars.item_flags['sakura_card_given'] = 'seoa';
  state.vars.promise_spring = true;
  const kp = sys.kept_promises();
  assert.ok(Array.isArray(kp));
  kp.forEach(s => assert.equal(typeof s, 'string'));
});

// heart_vs_like
test('heart_vs_like(): sincere > like => verbatim phrase', () => {
  const { sys, state } = mkSys4();
  state.vars.sincere = { seoa: 50, jiu: 0, mingyeol: 0 };
  state.vars.like    = { seoa: 10, jiu: 0, mingyeol: 0 };
  assert.equal(sys.heart_vs_like(), '진심 > 호감 — 점수보다 마음을 줬다.');
});

test('heart_vs_like(): like >> sincere (2x) => verbatim phrase', () => {
  const { sys, state } = mkSys4();
  state.vars.sincere = { seoa: 5, jiu: 0, mingyeol: 0 };
  state.vars.like    = { seoa: 50, jiu: 0, mingyeol: 0 };
  assert.equal(sys.heart_vs_like(), '호감 ≫ 진심 — 잘 보이는 데 능했다.');
});

test('heart_vs_like(): balanced => verbatim phrase', () => {
  const { sys, state } = mkSys4();
  state.vars.sincere = { seoa: 20, jiu: 0, mingyeol: 0 };
  state.vars.like    = { seoa: 20, jiu: 0, mingyeol: 0 };
  assert.equal(sys.heart_vs_like(), '호감 ≈ 진심 — 그 사이 어딘가.');
});

test('heart_vs_like() never returns a number', () => {
  const { sys } = mkSys4();
  assert.equal(typeof sys.heart_vs_like(), 'string');
  assert.ok(isNaN(Number(sys.heart_vs_like())));
});

// who_remained
test('who_remained(): run => "— (아무도)"', () => {
  const { sys, state } = mkSys4();
  state.vars.ep4_choice = 'run';
  assert.equal(sys.who_remained(), '— (아무도)');
});

test('who_remained(): fishtank => "— (아무도)"', () => {
  const { sys, state } = mkSys4();
  state.vars.like = { seoa: 80, jiu: 75, mingyeol: 0 };
  state.vars.sincere = { seoa: 10, jiu: 10, mingyeol: 0 };
  assert.equal(sys.who_remained(), '— (아무도)');
});

test('who_remained(): doyun ending => "도윤"', () => {
  const { sys, state } = mkSys4();
  state.vars.ep4_choice = 'friend';
  state.vars.doyun_bond = 25;
  assert.equal(sys.who_remained(), '도윤');
});

test('who_remained(): reconcile => "민결, 그리고 도윤"', () => {
  const { sys, state } = mkSys4();
  state.vars.ep4_choice = 'reconcile';
  state.vars.doyun_bond = 25;
  state.vars.sincere = { seoa: 0, jiu: 0, mingyeol: 35 };
  assert.equal(sys.who_remained(), '민결, 그리고 도윤');
});

test('who_remained() never returns a raw number', () => {
  const { sys, state } = mkSys4();
  state.vars.ep4_choice = 'run';
  const result = sys.who_remained();
  assert.equal(typeof result, 'string');
  assert.ok(isNaN(Number(result)));
});

// ── d.3: STATIONS + MAP theme constants ─────────────────────────────────────

test('STATIONS has 8 entries in correct order', () => {
  const keys = STATIONS.map(s => s.key);
  assert.deepEqual(keys, ['hongdae','hapjeong','seongsu','konkuk','jamsil','gangnam','mullae','sinchon']);
});

test('STATIONS each entry has key, name, x, y', () => {
  for (const s of STATIONS) {
    assert.ok(typeof s.key  === 'string', `${s.key} missing key`);
    assert.ok(typeof s.name === 'string', `${s.key} missing name`);
    assert.ok(typeof s.x    === 'number', `${s.key} missing x`);
    assert.ok(typeof s.y    === 'number', `${s.key} missing y`);
  }
});

test('STATIONS jamsil has correct coords (verbatim from screens_map.rpy)', () => {
  const jamsil = STATIONS.find(s => s.key === 'jamsil');
  assert.equal(jamsil.name, '잠실');
  assert.equal(jamsil.x, 0.78);
  assert.equal(jamsil.y, 0.72);
});

test('STATIONS sinchon verbatim coords', () => {
  const s = STATIONS.find(st => st.key === 'sinchon');
  assert.equal(s.name, '신촌');
  assert.equal(s.x, 0.16);
  assert.equal(s.y, 0.42);
});

test('STATIONS gangnam verbatim coords', () => {
  const s = STATIONS.find(st => st.key === 'gangnam');
  assert.equal(s.name, '강남');
  assert.equal(s.x, 0.50);
  assert.equal(s.y, 0.86);
});

test('MAP has all required keys', () => {
  const required = ['bg','line','node_open','node_lock','node_here','name_txt','title_txt'];
  for (const k of required) {
    assert.ok(k in MAP, `MAP missing key: ${k}`);
    assert.equal(typeof MAP[k], 'string');
  }
});

test('MAP verbatim color values (from screens_map.rpy)', () => {
  assert.equal(MAP.bg,        '#f3f1ea');
  assert.equal(MAP.line,      '#2fb574');
  assert.equal(MAP.node_open, '#2fb574');
  assert.equal(MAP.node_lock, '#c2c2c2');
  assert.equal(MAP.node_here, '#e8553d');
  assert.equal(MAP.name_txt,  '#2b2b2b');
  assert.equal(MAP.title_txt, '#2fb574');
});

test('ENDING_LIST has 7 entries matching systems_extra.rpy order', () => {
  assert.equal(ENDING_LIST.length, 7);
  assert.equal(ENDING_LIST[0][0], 'reconcile');
  assert.equal(ENDING_LIST[6][0], 'run');
});
