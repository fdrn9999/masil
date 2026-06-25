import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../web/src/state.js';

function memStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), _m: m };
}

test('vars get/set with defaults', () => {
  const s = new GameState();
  s.defineDefaults({ like: { seoa: 0 }, mc_name: '나' });
  assert.equal(s.get('mc_name'), '나');
  s.set('mc_name', '진호');
  assert.equal(s.get('mc_name'), '진호');
});

test('save and load slot round-trips vars + engine position', () => {
  const st = memStorage();
  const s = new GameState(st);
  s.defineDefaults({ doyun_bond: 0 });
  s.set('doyun_bond', 12);
  s.saveSlot(1, { label: 'ep1_date', ip: 7, callStack: [] });
  const s2 = new GameState(st);
  s2.defineDefaults({ doyun_bond: 0 });
  const pos = s2.loadSlot(1);
  assert.equal(s2.get('doyun_bond'), 12);
  assert.deepEqual(pos, { label: 'ep1_date', ip: 7, callStack: [] });
});

test('loadSlot throws on corrupt JSON', () => {
  const st = memStorage();
  st.setItem('masil.save.1', '{bad json');
  const s = new GameState(st);
  assert.throws(() => s.loadSlot(1));
});

test('persistent persists across instances', () => {
  const st = memStorage();
  const a = new GameState(st);
  a.persistent.play_count = 2;
  a.savePersistent();
  const b = new GameState(st);
  b.loadPersistent();
  assert.equal(b.persistent.play_count, 2);
});

// --- meta + peekSlot ---
test('saveSlot with meta: loadSlot returns meta', () => {
  const st = memStorage();
  const s = new GameState(st);
  s.set('x', 42);
  const meta = { label: 'ep2', who: 'd', name: '도윤', text: '안녕', time: '오후 9:00' };
  s.saveSlot(1, { label: 'ep2', ip: 3, callStack: [] }, meta);
  const s2 = new GameState(st);
  const pos = s2.loadSlot(1);
  assert.deepEqual(pos, { label: 'ep2', ip: 3, callStack: [], meta });
});

test('saveSlot backward-compat: no meta still loads, meta undefined', () => {
  const st = memStorage();
  const s = new GameState(st);
  s.set('y', 7);
  s.saveSlot(2, { label: 'ep1', ip: 0, callStack: [] }); // no meta
  const s2 = new GameState(st);
  const pos = s2.loadSlot(2);
  assert.equal(pos.label, 'ep1');
  assert.equal(pos.meta, undefined);
  assert.equal(s2.get('y'), 7);
});

test('peekSlot returns data without mutating this.vars', () => {
  const st = memStorage();
  const s = new GameState(st);
  s.set('z', 100);
  const meta = { label: 'ep3', text: 'test' };
  s.saveSlot(3, { label: 'ep3', ip: 5, callStack: [] }, meta);

  const s2 = new GameState(st);
  s2.set('z', 999); // different from saved value
  const peeked = s2.peekSlot(3);
  assert.equal(peeked.label, 'ep3');
  assert.deepEqual(peeked.meta, meta);
  // vars must NOT have changed
  assert.equal(s2.get('z'), 999, 'peekSlot must not mutate this.vars');
});

test('peekSlot returns null for missing slot', () => {
  const st = memStorage();
  const s = new GameState(st);
  assert.equal(s.peekSlot(99), null);
});

// --- saveQuick / loadQuick ---
test('saveQuick / loadQuick round-trip', () => {
  const st = memStorage();
  const s = new GameState(st);
  s.set('q', 55);
  const meta = { label: 'qep', text: 'quick!' };
  s.saveQuick({ label: 'qep', ip: 2, callStack: [] }, meta);
  const s2 = new GameState(st);
  const pos = s2.loadQuick();
  assert.equal(pos.label, 'qep');
  assert.equal(pos.ip, 2);
  assert.deepEqual(pos.meta, meta);
  assert.equal(s2.get('q'), 55);
});

test('loadQuick returns null when nothing saved', () => {
  const s = new GameState(memStorage());
  assert.equal(s.loadQuick(), null);
});

test('peekQuick does not mutate vars', () => {
  const st = memStorage();
  const s = new GameState(st);
  s.set('v', 1);
  s.saveQuick({ label: 'q2', ip: 0, callStack: [] });
  const s2 = new GameState(st);
  s2.set('v', 888);
  const peeked = s2.peekQuick();
  assert.equal(peeked.label, 'q2');
  assert.equal(s2.get('v'), 888, 'peekQuick must not mutate vars');
});

test('peekAuto does not mutate vars', () => {
  const st = memStorage();
  const s = new GameState(st);
  s.set('a', 3);
  s.saveAuto({ label: 'aut', ip: 1, callStack: [] }, { label: 'aut', text: 'x' });
  const s2 = new GameState(st);
  s2.set('a', 777);
  const peeked = s2.peekAuto();
  assert.equal(peeked.label, 'aut');
  assert.equal(s2.get('a'), 777, 'peekAuto must not mutate vars');
});

test('saveAuto with meta: peekAuto returns meta', () => {
  const st = memStorage();
  const s = new GameState(st);
  const meta = { label: 'aut2', text: 'auto text' };
  s.saveAuto({ label: 'aut2', ip: 9, callStack: [] }, meta);
  const peeked = s.peekAuto();
  assert.deepEqual(peeked.meta, meta);
});
