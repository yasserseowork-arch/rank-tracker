import test from 'node:test';
import assert from 'node:assert/strict';
import { loadClassic } from './helpers/load-classic.mjs';

const sandbox = loadClassic('src/lib/xlsxkit.js');
const { buildXlsx, crc32 } = sandbox.SRT.xlsx;

test('crc32: القيمة القياسية', () => {
  const bytes = new TextEncoder().encode('123456789');
  assert.equal(crc32(bytes), 0xCBF43926);
});

test('buildXlsx: ملف ZIP صالح يبدأ بـ PK ويحتوي الورقة', () => {
  const out = buildXlsx([['كلمة', 'ترتيب'], ['عبايات', 3]], 'الترتيب');
  assert.equal(out.constructor.name, 'Uint8Array');
  assert.equal(out[0], 0x50); // P
  assert.equal(out[1], 0x4B); // K
  const text = new TextDecoder('utf-8', { fatal: false }).decode(out);
  assert.ok(text.includes('xl/worksheets/sheet1.xml'));
  assert.ok(text.includes('sheetData'));
  assert.ok(text.includes('عبايات'));
});
