import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePlayback } from '../web/src/playback.js';

// --- mode ---
test('default mode is normal', () => {
  const pb = makePlayback();
  assert.equal(pb.mode, 'normal');
  assert.equal(pb.isSkip(), false);
  assert.equal(pb.isAuto(), false);
});

test('setMode changes mode', () => {
  const pb = makePlayback();
  pb.setMode('skip');
  assert.equal(pb.mode, 'skip');
  assert.equal(pb.isSkip(), true);
  assert.equal(pb.isAuto(), false);
  pb.setMode('auto');
  assert.equal(pb.mode, 'auto');
  assert.equal(pb.isAuto(), true);
  assert.equal(pb.isSkip(), false);
  pb.setMode('normal');
  assert.equal(pb.mode, 'normal');
});

test('toggleSkip: normal -> skip -> normal', () => {
  const pb = makePlayback();
  pb.toggleSkip();
  assert.equal(pb.mode, 'skip');
  pb.toggleSkip();
  assert.equal(pb.mode, 'normal');
});

test('toggleAuto: normal -> auto -> normal', () => {
  const pb = makePlayback();
  pb.toggleAuto();
  assert.equal(pb.mode, 'auto');
  pb.toggleAuto();
  assert.equal(pb.mode, 'normal');
});

test('toggleSkip while in auto => skip', () => {
  const pb = makePlayback();
  pb.setMode('auto');
  pb.toggleSkip();
  assert.equal(pb.mode, 'skip');
});

test('toggleAuto while in skip => auto', () => {
  const pb = makePlayback();
  pb.setMode('skip');
  pb.toggleAuto();
  assert.equal(pb.mode, 'auto');
});

// --- autoDelay ---
test('autoDelay returns a number', () => {
  const pb = makePlayback();
  const d = pb.autoDelay('hello');
  assert.ok(typeof d === 'number' && d > 0);
});

test('autoDelay grows with text length', () => {
  const pb = makePlayback();
  const short = pb.autoDelay('hi');
  const long = pb.autoDelay('이것은 굉장히 긴 텍스트입니다 정말 아주 많이 길어요'.repeat(5));
  assert.ok(long > short, `long(${long}) should be > short(${short})`);
});

test('autoDelay is capped at 6000ms', () => {
  const pb = makePlayback();
  assert.ok(pb.autoDelay('x'.repeat(10000)) <= 6000);
});

test('autoDelay handles null/undefined text', () => {
  const pb = makePlayback();
  assert.ok(pb.autoDelay(null) > 0);
  assert.ok(pb.autoDelay(undefined) > 0);
});

// --- history ---
test('history starts empty', () => {
  const pb = makePlayback();
  assert.deepEqual(pb.history(), []);
});

test('pushHistory stores entries', () => {
  const pb = makePlayback();
  pb.pushHistory({ who: 'd', name: '도윤', text: '안녕 형!' });
  const h = pb.history();
  assert.equal(h.length, 1);
  assert.deepEqual(h[0], { who: 'd', name: '도윤', text: '안녕 형!' });
});

test('history() returns a copy (mutation does not affect internal state)', () => {
  const pb = makePlayback();
  pb.pushHistory({ who: 'n', name: null, text: 'test' });
  const h1 = pb.history();
  h1.push({ who: 'x', name: 'x', text: 'x' });
  assert.equal(pb.history().length, 1);
});

test('pushHistory caps at 200', () => {
  const pb = makePlayback({ historyLimit: 200 });
  for (let i = 0; i < 210; i++) {
    pb.pushHistory({ who: 'n', name: null, text: `line ${i}` });
  }
  const h = pb.history();
  assert.equal(h.length, 200);
  // oldest entries should have been dropped; last item should be line 209
  assert.equal(h[h.length - 1].text, 'line 209');
});

test('clearHistory empties history', () => {
  const pb = makePlayback();
  pb.pushHistory({ who: 'n', name: null, text: 'hi' });
  pb.clearHistory();
  assert.deepEqual(pb.history(), []);
});

// --- rollback snapshots ---
test('canRollback false when empty', () => {
  const pb = makePlayback();
  assert.equal(pb.canRollback(), false);
});

test('popSnapshot returns null when empty', () => {
  const pb = makePlayback();
  assert.equal(pb.popSnapshot(), null);
});

test('pushSnapshot / popSnapshot LIFO', () => {
  const pb = makePlayback();
  const snap1 = { vars: { x: 1 }, pos: { label: 'ep1', ip: 0, callStack: [] } };
  const snap2 = { vars: { x: 2 }, pos: { label: 'ep1', ip: 5, callStack: [] } };
  pb.pushSnapshot(snap1);
  pb.pushSnapshot(snap2);
  assert.equal(pb.canRollback(), true);
  const got2 = pb.popSnapshot();
  assert.deepEqual(got2.vars, { x: 2 });
  const got1 = pb.popSnapshot();
  assert.deepEqual(got1.vars, { x: 1 });
  assert.equal(pb.canRollback(), false);
  assert.equal(pb.popSnapshot(), null);
});

test('pushSnapshot deep-clones vars (mutation after push does not corrupt snapshot)', () => {
  const pb = makePlayback();
  const vars = { count: 0, nested: { a: 1 } };
  pb.pushSnapshot({ vars, pos: { label: 'x', ip: 0, callStack: [] } });
  // mutate original
  vars.count = 99;
  vars.nested.a = 99;
  const snap = pb.popSnapshot();
  assert.equal(snap.vars.count, 0, 'snapshot vars.count should be original 0');
  assert.equal(snap.vars.nested.a, 1, 'snapshot nested.a should be original 1');
});

test('pushSnapshot caps at 60', () => {
  const pb = makePlayback({ snapshotLimit: 60 });
  for (let i = 0; i < 65; i++) {
    pb.pushSnapshot({ vars: { i }, pos: { label: 'x', ip: i, callStack: [] } });
  }
  // Stack should have 60; popping should give us latest (i=64)
  const top = pb.popSnapshot();
  assert.equal(top.vars.i, 64);
  // After removing one more... count from 60-1=59 items in stack
  let count = 1; // already popped one
  while (pb.canRollback()) { pb.popSnapshot(); count++; }
  assert.equal(count, 60);
});
