import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTags, escapeHtml, parseTags } from '../web/src/ui/tags.js';

test('strips {size=..} and other control tags', () => {
  assert.equal(renderTags('{size=50}Ep.1{/size}'), 'Ep.1');
  assert.equal(renderTags('{w=3}바로 박히면 안 됨'), '바로 박히면 안 됨');
  assert.equal(renderTags('{w=0.4}{cps=20}안녕{nw}'), '안녕');
  assert.equal(renderTags('{b}굵게{/b} 보통'), '굵게 보통');   // b stripped in simple render
});

test('renders {i} → <em> and {p} → newline, strip runs after', () => {
  assert.equal(renderTags('{w=0.4}안녕{p}다음{i}강조{/i}'), '안녕\n다음<em>강조</em>');
});

test('escapes HTML but leaves brackets ([var], [[) untouched', () => {
  assert.equal(renderTags('값은 [name]'), '값은 [name]');
  assert.equal(renderTags('<b>x</b> & "q"'), '&lt;b&gt;x&lt;/b&gt; &amp; &quot;q&quot;');
  assert.equal(renderTags('[[리터럴'), '[[리터럴');
});

test('balance-safe: dangling {i} is auto-closed (no bleed)', () => {
  assert.equal(renderTags('{i}강조만'), '<em>강조만</em>');
  assert.equal(renderTags('{i}a{i}b'), '<em>a<em>b</em></em>');
});

test('{{ → literal brace', () => {
  assert.equal(renderTags('{{리터럴'), '{리터럴');
});

test('escapeHtml covers &<>" and null-safe', () => {
  assert.equal(escapeHtml('a&b<c>"d"'), 'a&amp;b&lt;c&gt;&quot;d&quot;');
  assert.equal(escapeHtml(null), '');
});

test('parseTags tokenizes control tags', () => {
  assert.deepEqual(parseTags('{w=2}안녕{nw}'),
    [{ t: 'wait', ms: 2000 }, { t: 'text', s: '안녕' }, { t: 'nw' }]);
  assert.deepEqual(parseTags('{size=44}야{/size}'),
    [{ t: 'size_open', val: 44 }, { t: 'text', s: '야' }, { t: 'size_close' }]);
  assert.deepEqual(parseTags('{cps=70}빨리'),
    [{ t: 'cps', v: 70 }, { t: 'text', s: '빨리' }]);
  assert.deepEqual(parseTags('줄1{p}줄2'),
    [{ t: 'text', s: '줄1' }, { t: 'br' }, { t: 'text', s: '줄2' }]);
});
