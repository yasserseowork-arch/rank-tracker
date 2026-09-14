import test from 'node:test';
import assert from 'node:assert/strict';
import { installChromeMock } from './helpers/chrome-mock.mjs';

installChromeMock();

const state = await import('../src/background/core/state.js');
const { QueueEngine } = await import('../src/background/core/queue.js');
const scheduler = await import('../src/background/core/scheduler.js');

test('setConfig: تطهير الأنواع والحدود الآمنة', async () => {
  const cfg = await state.setConfig({ delayMs: 10, num: 500, matchMode: 'weird', verbose: 'yes' });
  assert.ok(cfg.delayMs >= 1000);
  assert.equal(cfg.num, 100);
  assert.equal(cfg.matchMode, 'both');
  assert.equal(cfg.verbose, true);
});

test('addKeywords: حذف المكرر بدون حساسية لحالة الأحرف', async () => {
  await state.clearKeywords();
  await state.addKeywords(['عبايات', 'عبايات ', 'OBAYAT']);
  const list = await state.getKeywords();
  // 'عبايات ' تُقصّ إلى نفس المفتاح، لكن OBAYAT مختلفة نصياً
  assert.equal(list.length, 2);
});

test('start: بدون كلمات → no-keywords', async () => {
  await state.clearKeywords();
  const engine = new QueueEngine();
  const res = await engine.start();
  assert.deepEqual(res, { ok: false, reason: 'no-keywords' });
});

test('start: بدون هدف → no-target', async () => {
  await state.clearKeywords();
  await state.addKeywords(['عبايات']);
  await state.setConfig({ storeDomain: '', storeName: '' });
  const engine = new QueueEngine();
  const res = await engine.start();
  assert.equal(res.reason, 'no-target');
});

test('pause/stop: انتقالات آمنة من الخمول', async () => {
  const engine = new QueueEngine();
  await state.setRun({ status: 'idle' });
  assert.deepEqual(await engine.pause('user'), { ok: false });
  const stop = await engine.stop();
  assert.equal(stop.ok, true);
  const run = await state.getRun();
  assert.equal(run.status, 'idle');
});

test('stop: يعيد الكلمات الجارية إلى بالانتظار', async () => {
  await state.clearKeywords();
  await state.addKeywords(['كلمة']);
  const list = await state.getKeywords();
  await state.updateKeyword(list[0].id, { status: 'running' });
  const engine = new QueueEngine();
  await engine.stop();
  const after = await state.getKeywords();
  assert.equal(after[0].status, 'pending');
});

test('scheduler: cooldown معطّل → null فوراً', async () => {
  const out = await scheduler.cooldownIfNeeded({ cooldownEvery: 0 }, 8, null);
  assert.equal(out, null);
});

test('scheduler: wait قصير يعود بدون alarm', async () => {
  const started = Date.now();
  await scheduler.wait(30, 'test', null);
  assert.ok(Date.now() - started < 2000);
});

test('snapshot: شكل ثابت للحظة البث', async () => {
  const snap = await state.snapshot();
  for (const key of ['version', 'config', 'keywords', 'results', 'run', 'logs', 'stats']) {
    assert.ok(key in snap, 'missing ' + key);
  }
});

test('العدّاد اليومي: زيادة صحيحة', async () => {
  const before = await state.getDailyCount();
  const after = await state.bumpDailyCount();
  assert.equal(after.count, before.count + 1);
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(after.date, today);
});

test('setConfig: تنظيف الدومين من https والمسار', async () => {
  const cfg = await state.setConfig({ storeDomain: 'https://www.Berhatayer.org.sa/path?x=1' });
  assert.equal(cfg.storeDomain, 'berhatayer.org.sa');
});

test('addKeywords: المكرر يرجع للانتظار بدل التجاهل الصامت', async () => {
  await state.clearKeywords();
  const first = await state.addKeywords(['كلمة مكررة']);
  assert.equal(first.added.length, 1);
  await state.updateKeyword(first.added[0].id, { status: 'done' });
  const second = await state.addKeywords(['كلمة مكررة']);
  assert.equal(second.added.length, 0);
  assert.equal(second.reset, 1);
  const list = await state.getKeywords();
  assert.equal(list.length, 1);
  assert.equal(list[0].status, 'pending');
});

test('handleCaptcha: فشل تلقائي بدون إيقاف مؤقت يرجع الحالة «شغال» فوراً (علة البانر العالق)', async () => {
  const engine = new QueueEngine();
  engine.orchestrator.solve = async () => ({ outcome: 'failed', attempts: 1 });
  await state.setRun({ status: 'captcha', captcha: { tabId: 999, attempts: 0 } });
  const r = await engine.handleCaptcha(
    999, { id: 'k1', keyword: 'اختبار' },
    { pauseOnCaptchaFail: true },
    new AbortController().signal,
    false // allowPause = false (الوضع التلقائي)
  );
  assert.equal(r, 'failed');
  const run = await state.getRun();
  assert.equal(run.status, 'running');
  assert.equal(run.captcha, null);
});

test('maybePeriodicClear: بيمسح عند بلوغ كل N كلمة وبيسجل المؤشر عشان ما يكررش', async () => {
  const engine = new QueueEngine();
  await state.clearKeywords();
  await state.setRun({ clearMarker: 0 });
  const kws = [];
  for (let i = 0; i < 10; i++) { kws.push({ id: 'k' + i, keyword: 'كلمة ' + i, status: 'done' }); }
  await state.setKeywords(kws);
  await engine.maybePeriodicClear({ clearEveryN: 10 });
  let run = await state.getRun();
  assert.equal(run.clearMarker, 10);
  // مفيش كلمات جديدة مفحوصة → مش هيمسح تاني
  await engine.maybePeriodicClear({ clearEveryN: 10 });
  run = await state.getRun();
  assert.equal(run.clearMarker, 10);
  // كلمتين كمان → تعدي الـ 10 → مسح تاني
  await state.addKeywords(['كلمة 11', 'كلمة 12']);
  const more = await state.getKeywords();
  const upd = more.filter((k) => k.keyword.indexOf('كلمة 1') === 0);
  for (const k of upd) { await state.updateKeyword(k.id, { status: 'done' }); }
  await engine.maybePeriodicClear({ clearEveryN: 10 });
  run = await state.getRun();
  assert.ok(run.clearMarker >= 10);
});
