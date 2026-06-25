import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTags } from '../web/src/ui/tags.js';
import { buildFullHtml } from '../web/src/ui/typewriter.js';

test('buildFullHtml honors size/bold/italic (the "소리지름" case)', () => {
  assert.equal(buildFullHtml(parseTags('{size=44}{b}야!!{/b}{/size}')),
    '<span style="font-size:44px"><strong>야!!</strong></span>');
  assert.equal(buildFullHtml(parseTags('형 {i}진짜{/i} 오랜만')),
    '형 <em>진짜</em> 오랜만');
});

test('buildFullHtml clamps size and strips speed/pause tags', () => {
  assert.equal(buildFullHtml(parseTags('{size=999}크게{/size}')),
    '<span style="font-size:80px">크게</span>');   // clamped to SIZE_MAX
  assert.equal(buildFullHtml(parseTags('{w=2}{cps=70}달려{nw}')), '달려');
});

test('buildFullHtml is balance-safe (auto-closes) and escapes text', () => {
  assert.equal(buildFullHtml(parseTags('{b}안 닫음')), '<strong>안 닫음</strong>');
  assert.equal(buildFullHtml(parseTags('<x> & "y"')), '&lt;x&gt; &amp; &quot;y&quot;');
});

test('buildFullHtml turns {p} into newline', () => {
  assert.equal(buildFullHtml(parseTags('첫줄{p}둘째줄')), '첫줄\n둘째줄');
});

test('buildFullHtml re-balances crossed tags into valid nesting', () => {
  // {i}{b}x{/i}y{/b}  — closing {i} while {b} is still open must not cross
  assert.equal(buildFullHtml(parseTags('{i}{b}x{/i}y{/b}')),
    '<em><strong>x</strong></em><strong>y</strong>');
});
