/**
 * router.js — موجّه رسائل الـ Service Worker (واجهة اللوحة والخيارات)
 */
import { C } from './bridge.js';
import * as state from './state.js';
import * as logger from './logger.js';
import * as scheduler from './scheduler.js';

export function createRouter(engine) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== 'string') { return; }
    const isExtensionPage = !sender.tab; // رسائل اللوحة/الخيارات بلا تبويب
    if (!isExtensionPage) { return; }    // رسائل التبويبات يعالجها ناقل الطابور

    const type = message.type;
    // رسائل محتوى التبويبات يعالجها ناقل الطابور، عدا قراءة الإعدادات فهي للجميع
    const allowedForContent = [C.MSG.GET_CONFIG, C.MSG.PING];
    if (!isExtensionPage && !allowedForContent.includes(type)) { return; }

    const handled = [
      C.MSG.PING, C.MSG.GET_CONFIG, C.MSG.SET_CONFIG, C.MSG.GET_STATE,
      C.MSG.QUEUE_START, C.MSG.QUEUE_PAUSE, C.MSG.QUEUE_RESUME, C.MSG.QUEUE_STOP,
      C.MSG.KEYWORDS_SET, C.MSG.KEYWORDS_ADD, C.MSG.KEYWORDS_REMOVE, C.MSG.KEYWORDS_CLEAR,
      C.MSG.RESULTS_CLEAR, C.MSG.SHEETS_WRITE_NOW
    ];
    if (!handled.includes(type)) { return; }

    (async () => {
      try {
        switch (type) {
          case C.MSG.PING:
            return { ok: true, version: C.VERSION, run: await state.getRun() };

          case C.MSG.GET_CONFIG:
            return { ok: true, config: await state.getConfig() };

          case C.MSG.SET_CONFIG: {
            const config = await state.setConfig(message.patch || {});
            await logger.info('config', 'تحديث الإعدادات: ' + Object.keys(message.patch || {}).join(', '));
            engine.broadcast();
            return { ok: true, config };
          }

          case C.MSG.GET_STATE:
            return Object.assign({ ok: true }, await state.snapshot());

          case C.MSG.QUEUE_START:
            return engine.start();

          case C.MSG.QUEUE_PAUSE:
            return engine.pause(message.reason || 'user');

          case C.MSG.QUEUE_RESUME:
            return engine.resume();

          case C.MSG.QUEUE_STOP:
            return engine.stop();

          case C.MSG.KEYWORDS_SET: {
            await state.setKeywords(message.keywords || []);
            engine.broadcast();
            return { ok: true };
          }

          case C.MSG.KEYWORDS_ADD: {
            const r = await state.addKeywords(message.keywords || [], message.note || '');
            engine.broadcast();
            return { ok: true, added: r.added.length, reset: r.reset };
          }

          case C.MSG.KEYWORDS_REMOVE: {
            await state.removeKeyword(message.id);
            engine.broadcast();
            return { ok: true };
          }

          case C.MSG.KEYWORDS_CLEAR: {
            await state.clearKeywords();
            engine.broadcast();
            return { ok: true };
          }

          case C.MSG.RESULTS_CLEAR: {
            await state.clearResults();
            engine.broadcast();
            return { ok: true };
          }

          case C.MSG.SHEETS_WRITE_NOW: {
            return engine.writeResultsToSheet();
          }

          default:
            return { ok: false };
        }
      } catch (err) {
        await logger.error('router', `${type} failed: ${err && err.stack ? err.stack : err}`);
        return { ok: false, error: String(err && err.message ? err.message : err) };
      }
    })().then(sendResponse);

    return true; // رد غير متزامن
  });

  // منافذ Keep-Alive من اللوحة الجانبية
  chrome.runtime.onConnect.addListener((port) => {
    if (!port.name || port.name.indexOf('srt-') !== 0) { return; }
    scheduler.registerKeepaliveClient(+1);
    port.onDisconnect.addListener(() => scheduler.registerKeepaliveClient(-1));
    port.onMessage.addListener(() => {});
  });
}
