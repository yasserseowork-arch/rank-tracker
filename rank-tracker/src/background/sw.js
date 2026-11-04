/**
 * sw.js — Service Worker (MV3)
 * نقطة الدخول: تهيئة التخزين، ربط الموجّه، فتح اللوحة الجانبية،
 * معالجة الـ Alarms، والاستئناف التلقائي بعد استيقاظ الـ Worker.
 */
import { C } from './core/bridge.js';
import * as state from './core/state.js';
import * as logger from './core/logger.js';
import * as tabctl from './core/tabctl.js';
import * as scheduler from './core/scheduler.js';
import { QueueEngine } from './core/queue.js';
import { createRouter } from './core/router.js';
import './embedded.js'; // الأدوات المدمجة: Buster + SERP Counter + Show 100 + gs location changer

const engine = new QueueEngine();

// الموجّه يتسجل فوراً على مستوى الموديول — اللوحة الجانبية بتفتح keepalive port
// أول ثانية بتفتح فيها، والتسجيل المتأخر (جوه boot ورا await) كان بيجيب
// "Could not establish connection. Receiving end does not exist" في الكونسول.
createRouter(engine);

async function boot(reason) {
  tabctl.installListeners();
  await state.migrate();

  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (_) {}

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (scheduler.resolveAlarm(alarm.name)) { return; }
    if (alarm.name === 'srt-watch') { engine.watchdogTick(); return; }
    logger.debug('sw', 'alarm: ' + alarm.name);
  });

  chrome.notifications.onClicked.addListener(async () => {
    try {
      const win = await chrome.windows.getLastFocused();
      if (win && win.id) { await chrome.sidePanel.open({ windowId: win.id }); }
    } catch (_) {}
  });

  // استئناف تلقائي بعد استيقاظ Worker — التشغيل لازم يكمل لوحده دايماً (100% أوتوماتيك)
  const run = await state.getRun();
  if ((run.status === C.STATUS.RUN.RUNNING || run.status === C.STATUS.RUN.CAPTCHA) && !engine.looping) {
    await logger.warn('sw', `استيقاظ Service Worker أثناء تشغيل نشط (${reason}) — استئناف الحلقة`);
    await state.setRun({ status: C.STATUS.RUN.RUNNING, captcha: null });
    engine.index = run.currentIndex || 0;
    engine.abortController = new AbortController();
    await engine.healStaleBadges(); // v1.21.3: بلا صفوف معلقانة بشارة ميتة
    engine.loop();
  } else if (run.status === C.STATUS.RUN.PAUSED && run.pauseReason === 'captcha-failed') {
    // إيقاف مؤقت بسبب كابتشا: الاستئناف التلقائي بيشغّل الخطة الاحتياطية لوحدها
    await logger.warn('sw', `استئناف تلقائي بعد إيقاف كابتشا (${reason}) — الخطة الاحتياطية هتتولى`);
    await state.setRun({ status: C.STATUS.RUN.RUNNING, pauseReason: null, captcha: null });
    engine.index = run.currentIndex || 0;
    engine.abortController = new AbortController();
    await engine.healStaleBadges(); // v1.21.3: بلا صفوف معلقانة بشارة ميتة
    engine.loop();
  }
  await logger.info('sw', `Service Worker جاهز (${reason}) — الإصدار ${C.VERSION}`);
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await boot('onInstalled:' + (details.reason || '?'));
  if (details.reason === 'install') {
    await state.setConfig({});
    await logger.info('sw', 'تثبيت جديد: تم تهيئة الإعدادات الافتراضية (gl=sa, hl=ar, num=100, delay=4s)');
  }
});

chrome.runtime.onStartup.addListener(() => boot('onStartup'));

// 🔥 سخّن محرك النسخ الصوتي (Whisper) — لكن مش في كل استيقاظ!
// v1.21.40: 🔴 كان import + prewarm على مستوى الموديول — يعني كل مرة الـService Worker
// يقوم من النوم (وهو بيقوم باستمرار: كل تبويب/رسالة/ألارم) بيفتح وثيقة offscreen
// ويطلب نسخ WAV صامت بمهلة 30 دقيقة. والنتيجة إن موديل 40 ميجا **بيتنزّل ويمسح**
// (closeDoc في الآخر) كل ما كروم يفتح — مش «مرة واحدة وبس» زي ما المكتوب. كمان
// وثيقة offscreen شغالة بتمنع الـWorker من النوم. دلوقتي التسخين بيحصل مرة واحدة
// في اليوم بالكتير (تُختم في storage.local)، وأول فشل بيدي إشارة للنوم شوية.
const PREWARM_KEY = 'srt.prewarmAt';
const PREWARM_RETRY_KEY = 'srt.prewarmFailAt';
async function maybePrewarm() {
  try {
    const now = Date.now();
    const got = await chrome.storage.local.get([PREWARM_KEY, PREWARM_RETRY_KEY]);
    const lastOk = (got && got[PREWARM_KEY]) || 0;
    const lastFail = (got && got[PREWARM_RETRY_KEY]) || 0;
    // نجح في آخر 24 ساعة أو فشل في آخر ساعة؟ مفيش داعي
    if (now - lastOk < 24 * 60 * 60 * 1000) { return; }
    if (now - lastFail < 60 * 60 * 1000) { return; }
    const m = await import('./core/solver.js');
    const res = await m.prewarm();
    await chrome.storage.local.set({ [res && res.ok === false ? PREWARM_RETRY_KEY : PREWARM_KEY]: Date.now() });
  } catch (_) {
    try { await chrome.storage.local.set({ [PREWARM_RETRY_KEY]: Date.now() }); } catch (__) {}
  }
}
setTimeout(() => { maybePrewarm().catch(() => {}); }, 1500);

// تشغيل فوري عند تحميل الـ Worker لأول مرة
boot('cold-start');
