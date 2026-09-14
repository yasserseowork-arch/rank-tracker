import test from 'node:test';
import assert from 'node:assert/strict';
import { loadClassic } from './helpers/load-classic.mjs';

const sandbox = loadClassic('src/lib/url.js');
const u = sandbox.SRT.url;

test('buildSearchUrl: معاملات الاستهداف كاملة', () => {
  const url = u.buildSearchUrl('عبايات نسائية', { gl: 'sa', hl: 'ar', num: 100 });
  const parsed = new URL(url);
  assert.equal(parsed.hostname, 'www.google.com');
  assert.equal(parsed.pathname, '/search');
  assert.equal(parsed.searchParams.get('q'), 'عبايات نسائية');
  assert.equal(parsed.searchParams.get('gl'), 'sa');
  assert.equal(parsed.searchParams.get('hl'), 'ar');
  assert.equal(parsed.searchParams.get('num'), '100');
  assert.equal(parsed.searchParams.get('pws'), '0');
});

test('isSorry و isSearch', () => {
  assert.equal(u.isSorry('https://www.google.com/sorry/index?continue=x'), true);
  assert.equal(u.isSorry('https://www.google.com/search?q=x'), false);
  assert.equal(u.isSearch('https://www.google.com/search?q=x'), true);
});

test('sheetCsvUrl: استخراج id و gid', () => {
  const src = 'https://docs.google.com/spreadsheets/d/1AbC-d_E/edit#gid=123456';
  const out = u.sheetCsvUrl(src);
  assert.ok(out.includes('/d/1AbC-d_E/gviz/tq?tqx=out:csv'));
  assert.ok(out.includes('gid=123456'));
  assert.equal(u.sheetCsvUrl('https://example.com'), '');
});

test('normalizeHost', () => {
  assert.equal(u.normalizeHost('www.MyStore.SA.'), 'mystore.sa');
});
