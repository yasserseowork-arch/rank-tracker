import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const panelJs = fs.readFileSync(path.resolve(process.cwd(), 'src/sidepanel/side-panel.js'), 'utf8');
const panelHtml = fs.readFileSync(path.resolve(process.cwd(), 'src/sidepanel/side-panel.html'), 'utf8');

const start = panelJs.indexOf('const CONFIG_FIELDS');
const end = panelJs.indexOf('];', start);
assert.ok(start !== -1 && end !== -1, 'CONFIG_FIELDS block not found');
const block = panelJs.slice(start, end);

test('CONFIG_FIELDS: لا يوجد سطر منسي بدون فاصلة (علة v1.8.0)', () => {
  assert.ok(!/\]\s*\n\s*\[/.test(block), 'missing comma between CONFIG_FIELDS rows');
});

test('CONFIG_FIELDS: كل المعرفات موجودة فعلاً في HTML اللوحة', () => {
  const ids = Array.from(block.matchAll(/\['([A-Za-z0-9_]+)'/g)).map((m) => m[1]);
  assert.ok(ids.length >= 3, 'unexpectedly few fields');
  for (const id of ids) {
    assert.ok(panelHtml.includes(`id="${id}"`), `missing element #${id} in side-panel.html`);
  }
});

test('serp.js: قارئ الروابط المشفرة /goto?url= موجود (علة 1.9.2)', () => {
  const serp = fs.readFileSync(path.resolve(process.cwd(), 'src/content/serp.js'), 'utf8');
  assert.ok(serp.includes('citeInfo'), 'citeInfo helper missing');
  assert.ok(serp.includes("querySelector('cite')"), 'cite reading missing');
  assert.ok(!serp.includes("b.querySelector('a[href^=\"http\"]')"), 'old http-only anchor selector still present');
});
