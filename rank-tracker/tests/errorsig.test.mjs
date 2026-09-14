import test from 'node:test';
import assert from 'node:assert/strict';
import { loadClassic } from './helpers/load-classic.mjs';

const sandbox = loadClassic('src/lib/errorsig.js');
const { detectError } = sandbox.SRT.errorsig;

test('http-error: عنوان خطأ 500/502', () => {
  assert.equal(detectError('Error 502 (Server Error)!!1', ''), 'http-error');
  assert.equal(detectError('خطأ 500 (خطأ في الخادم)', ''), 'http-error');
});

test('network: نصوص انقطاع الاتصال', () => {
  assert.equal(detectError('', "This site can't reach. Please check your connection."), 'network');
  assert.equal(detectError('', 'تحقق من اتصالك بالإنترنت ثم أعد المحاولة'), 'network');
});

test('google-error: صفحة مشكلة الوصول', () => {
  assert.equal(detectError('', 'If you are having trouble accessing Google Search, please retry later.'), 'google-error');
  assert.equal(detectError('', 'إذا كنت تواجه مشكلة في الوصول إلى بحث Google، حاول مرة أخرى'), 'google-error');
});

test('captcha-text: نص حركة المرور غير العادية', () => {
  assert.equal(detectError('', 'Our systems have detected unusual traffic from your computer network.'), 'captcha-text');
  assert.equal(detectError('', 'لقد رصدت أنظمتنا حركة مرور غير عادية من شبكة الكمبيوتر الخاصة بك'), 'captcha-text');
});

test('صفحة طبيعية: null', () => {
  assert.equal(detectError('عبايات نسائية - بحث Google', 'نتائج البحث عن عبايات نسائية…'), null);
});

test('http-error: يشمل 403 و429 (علة تشغيل حقيقية)', () => {
  assert.equal(detectError('Error 403 (Forbidden)!!1', ''), 'http-error');
  assert.equal(detectError('Error 429 (Too Many Requests)', ''), 'http-error');
  assert.equal(detectError('خطأ 403 (محظور)', ''), 'http-error');
});
