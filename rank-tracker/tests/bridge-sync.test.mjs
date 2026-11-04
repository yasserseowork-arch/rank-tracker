/**
 * bridge-sync.test.mjs — منع علة الثوابت القديمة (stale C) نهائياً.
 *
 * الـ Service Worker بيحمّل bridge.js مش constants.js — وأي مفتاح MSG ناقص
 * في جدول bridge بيبقى undefined في الخلفية: الشروط بتفشل بصمت والمسارات
 * بتتحول لميتة (زي ما حصل مع CAPTCHA_COORD_CLICK اللي كانت ضغطة الإحداثيات
 * ميتة في الخلفية لأن المفتاح مكانش موجود في bridge).
 *
 * هنا بنتأكد إن جدول MSG في bridge.js مطابق 100% لجدول constants.js.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

/** استخراج مفاتيح جدول MSG من constants.js */
function constantsMsgKeys() {
  const src = read('src/lib/constants.js');
  const block = src.slice(src.indexOf('const MSG = {'), src.indexOf('};', src.indexOf('const MSG = {')));
  const keys = [];
  for (const m of block.matchAll(/^\s*([A-Z_][A-Z0-9_]*):\s*'/gm)) { keys.push(m[1]); }
  return keys;
}

/** استخراج مفاتيح جدول MSG من fallback في bridge.js */
function bridgeMsgKeys() {
  const src = read('src/background/core/bridge.js');
  const block = src.slice(src.indexOf('MSG: {'), src.indexOf('};', src.indexOf('MSG: {')));
  const keys = [];
  for (const m of block.matchAll(/^\s*([A-Z_][A-Z0-9_]*):\s*'/gm)) { keys.push(m[1]); }
  return keys;
}

test('bridge.js: جدول MSG مطابق لجدول constants.js (مفيش مفاتيح ناقصة في الخلفية)', () => {
  const fromConstants = constantsMsgKeys();
  const fromBridge = bridgeMsgKeys();
  assert.ok(fromConstants.length > 30, 'جدول constants.js فاضي — فحص معطوب');
  for (const key of fromConstants) {
    assert.ok(fromBridge.includes(key), `المفتاح ${key} موجود في constants.js لكنه ناقص من bridge.js — الخلفية هتشوفه undefined والمسار هيموت بصمت`);
  }
});

test('bridge.js: نسخة الفولباك مش قديمة', () => {
  const src = read('src/background/core/bridge.js');
  const manifest = JSON.parse(read('manifest.json'));
  assert.ok(src.includes(`VERSION: '${manifest.version}'`), 'VERSION في bridge.js لازم تطابق نسخة manifest');
});

test('bridge.js: مفاتيح الكابتشا الحرجة موجودة (ضغطة الإحداثيات والتحقق)', () => {
  const keys = bridgeMsgKeys();
  assert.ok(keys.includes('CAPTCHA_COORD_CLICK'), 'CAPTCHA_COORD_CLICK ناقص من bridge.js — ضغطة الإحداثيات ميتة في الخلفية');
  assert.ok(keys.includes('CAPTCHA_VERIFY_CLICK'), 'CAPTCHA_VERIFY_CLICK ناقص من bridge.js');
  assert.ok(keys.includes('CAPTCHA_BUSTER_SEEN'), 'CAPTCHA_BUSTER_SEEN ناقص من bridge.js');
});
