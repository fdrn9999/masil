import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTags, escapeHtml } from '../web/src/ui/tags.js';

test('strips {size=..} and other control tags', () => {
  assert.equal(renderTags('{size=50}Ep.1{/size}'), 'Ep.1');
  assert.equal(renderTags('{w=3}바로 박히면 안 됨'), '바로 박히면 안 됨');
  assert.equal(renderTags('{w=0.4}{cps=20}안녕{nw}'), '안녕');
});

test('renders {i} → <em> and {p} → newline, strip runs after', () => {
  assert.equal(renderTags('{w=0.4}안녕{p}다음{i}강조{/i}'), '안녕\n다음<em>강조</em>');
});

test('escapes HTML but leaves brackets ([var], [[) untouched', () => {
  assert.equal(renderTags('값은 [name]'), '값은 [name]');
  assert.equal(renderTags('<b>x</b> & "q"'), '&lt;b&gt;x&lt;/b&gt; &amp; &quot;q&quot;');
  assert.equal(renderTags('[[리터럴'), '[[리터럴');
});

test('escapeHtml covers &<>" and null-safe', () => {
  assert.equal(escapeHtml('a&b<c>"d"'), 'a&amp;b&lt;c&gt;&quot;d&quot;');
  assert.equal(escapeHtml(null), '');
});
