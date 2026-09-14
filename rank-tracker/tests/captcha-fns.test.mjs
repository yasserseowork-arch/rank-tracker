/**
 * captcha-fns.test.mjs — اختبار انحدار للعلة الصامتة القاتلة:
 * آلة حل الكابتشا الذاتية كانت تستدعي دوال غير معرّفة (findReloadButton / challengeOpen /
 * audioOpen / imageOpen / reportAttempt) فتموت بصمت من أول tick وتُبقي عدّاد المحاولات
 * عالقاً على صفر. هنا نتأكد أن كل دوال الآلة معرّفة في الملف فعلاً.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.resolve(process.cwd(), 'src/content/captcha.js'), 'utf8');

const REQUIRED_FUNCTIONS = [
  'findReloadButton',
  'challengeOpen',
  'audioOpen',
  'imageOpen',
  'switchToAudio',
  'reportAttempt',
  'findBusterButton',
  'topCoordsOf',
  'clickBuster',
  'scanScope'
];

for (const fn of REQUIRED_FUNCTIONS) {
  test(`captcha.js: الدالة ${fn} معرّفة (علة الآلة الصامتة)`, () => {
    assert.ok(new RegExp('function ' + fn + '\\s*\\(').test(src), `${fn}() غير معرّفة — حل الكابتشا الذاتي سيموت بصمت`);
  });
}

test('captcha.js: عدّاد المحاولات بيتحدث عبر reportAttempt', () => {
  // reportAttempt لازم يزوّد S.attempts ويسجّل وقت آخر ضغطة — بدونهم الآلة ما تعرفش تعيد المحاولة
  assert.ok(/S\.attempts\s*\+=?\s*1/.test(src) || /S\.attempts\s*=?\s*S\.attempts\s*\+\s*1/.test(src), 'S.attempts لا يُزوَّد في reportAttempt');
  assert.ok(/S\.lastClickTs\s*=/.test(src), 'S.lastClickTs لا يُسجَّل');
});
