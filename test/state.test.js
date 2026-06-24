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
