import test from 'node:test';
import assert from 'node:assert/strict';
import { loadClassic } from './helpers/load-classic.mjs';
import { matchResults as moduleMatch } from '../src/background/core/match.js';

const sandbox = loadClassic('src/lib/matchlib.js');
const classic = sandbox.SRT.match;

const items = [
  { url: 'https://a.com/x', host: 'a.com', title: 'A', snippet: '' },
  { url: 'https://shop.mystore.com.sa/p', host: 'shop.mystore.com.sa', title: 'متجري', snippet: '' },
  { url: 'https://c.com/x', host: 'c.com', title: 'C', snippet: '' }
];

test('matchlib: يطابق نسخة الـ module في النتائج الأساسية', () => {
  const cfg = { storeDomain: 'mystore.com.sa', matchMode: 'domain' };
  const a = classic.matchItems(items, cfg);
  const b = moduleMatch(items, cfg);
  assert.equal(a.found, b.found);
  assert.equal(a.position, b.position);
});

test('matchlib: تطبيع عربي واحتواء الاسم', () => {
  assert.equal(classic.normalizeArabic('متجرُ لمسةَ'), 'متجر لمسه');
  assert.equal(classic.nameMatches('تشكيلة من متجر لمسة الرياض', 'متجر لمسة'), true);
  assert.equal(classic.nameMatches('تشكيلة من لمسه الرياض', 'متجر لمسة'), true);
});

test('matchlib: غير موجود → found=false', () => {
  const res = classic.matchItems(items, { storeDomain: 'other.sa', storeName: 'غير موجود', matchMode: 'both' });
  assert.equal(res.found, false);
  assert.equal(res.position, null);
});

test('matchlib: مضيفون فرعيون ومتغيرات www', () => {
  assert.equal(classic.hostMatches('www.mystore.com.sa', 'mystore.com.sa'), true);
  assert.equal(classic.hostMatches('m.mystore.com.sa', 'mystore.com.sa'), true);
  assert.equal(classic.hostMatches('mystore.com.sa.evil.io', 'mystore.com.sa'), false);
});

test('matchlib: نفس التسامح المرن مثل الـ module', () => {
  assert.equal(classic.hostMatches('store.berhatyater.org.sa', 'berhatayer.org.sa'), true);
  assert.equal(classic.nameMatches('كيف تكفل يتيماً؟ جمعية البر الخيرية بحائل', 'جمعية البر الخيرية بالبحائط'), true);
  assert.equal(classic.nameMatches('جمعية البر فقط', 'جمعية البر الخيرية بالبحائط'), false);
});
