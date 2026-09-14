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

async function boot(reason) {
  tabctl.installListeners();
  await state.migrate();
  createRouter(engine);

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

  // استئناف بعد استيقاظ Worker أثناء تشغيل سابق
  const run = await state.getRun();
  if (run.status === C.STATUS.RUN.RUNNING && !engine.looping) {
    await logger.warn('sw', `استيقاظ Service Worker أثناء تشغيل نشط (${reason}) — استئناف الحلقة`);
    engine.index = run.currentIndex || 0;
    engine.abortController = new AbortController();
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

// تشغيل فوري عند تحميل الـ Worker لأول مرة
boot('cold-start');
