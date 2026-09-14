import test from 'node:test';
import assert from 'node:assert/strict';
import { loadClassic } from './helpers/load-classic.mjs';

const sandbox = loadClassic('src/lib/csv.js');
const csv = sandbox.SRT.csv;

test('parse: فواصل واقتباسات وأسطر داخل اقتباس', () => {
  const text = 'keyword,note\n"عبايات, نسائية",مهمة\n"فساتين\nسهرة",عادي';
  const { rows } = csv.parse(text);
  assert.deepEqual([...rows[0]], ['keyword', 'note']);
  assert.deepEqual([...rows[1]], ['عبايات, نسائية', 'مهمة']);
  assert.deepEqual([...rows[2]], ['فساتين\nسهرة', 'عادي']);
});

test('parse: اكتشاف محدد تبويب', () => {
  const { rows, delimiter } = csv.parse('kw\tnote\nword\tx');
  assert.equal(delimiter, '\t');
  assert.deepEqual([...rows[1]], ['word', 'x']);
});

test('parse: BOM واقتباسات مضاعفة', () => {
  const { rows } = csv.parse('\ufeffa,b\n"say ""hi""",2');
  assert.deepEqual([...rows[0]], ['a', 'b']);
  assert.equal(rows[1][0], 'say "hi"');
});

test('extractKeywords: رأس عربي واستخراج العمود', () => {
  const { rows } = csv.parse('الكلمة المفتاحية,ملاحظات\nعبايات,مهم\nفساتين,');
  const out = csv.extractKeywords(rows);
  assert.equal(out.header, true);
  assert.deepEqual([...out.keywords], ['عبايات', 'فساتين']);
});

test('extractKeywords: بدون رأس', () => {
  const out = csv.extractKeywords([['عبايات'], ['فساتين سهرة']]);
  assert.equal(out.header, false);
  assert.deepEqual([...out.keywords], ['عبايات', 'فساتين سهرة']);
});

test('build + withBom: دورة كاملة', () => {
  const rows = [['كلمة', 'ترتيب'], ['عبايات', '3']];
  const built = csv.withBom(csv.build(rows, ','));
  assert.equal(built.charCodeAt(0), 0xfeff);
  const back = csv.parse(built);
  assert.equal(JSON.stringify(back.rows), JSON.stringify(rows));
});

test('toTsv: تنظيف أسطر داخل الخلايا', () => {
  const tsv = csv.toTsv([['a\nb', 'c\td']]);
  assert.equal(tsv, 'a b\tc d');
});
