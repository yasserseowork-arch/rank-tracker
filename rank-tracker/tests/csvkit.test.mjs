import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRows, extractKeywords, sheetCsvUrl } from '../src/background/core/csvkit.js';

test('csvkit(SW): استخراج عمود الكلمات بترتيب الشيت', () => {
  const rows = parseRows('الكلمة,ملاحظات\nجمعية أصدقاء السكر,مهم\nجمعية السكر والضغط,');
  assert.deepEqual(extractKeywords(rows), ['جمعية أصدقاء السكر', 'جمعية السكر والضغط']);
});

test('csvkit(SW): رابط gviz مع gid', () => {
  const u = sheetCsvUrl('https://docs.google.com/spreadsheets/d/1XyZ/edit#gid=42');
  assert.ok(u.includes('/d/1XyZ/gviz/tq?tqx=out:csv') && u.includes('gid=42'));
});
