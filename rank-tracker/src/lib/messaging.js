/**
 * messaging.js — طبقة المراسلة (Classic script)
 * أغلفة آمنة حول chrome.runtime.sendMessage / onMessage / connect
 * مع دعم وعود (Promises) وربط Keep-Alive لمنع موت الـ Service Worker.
 */
(function (global) {
  'use strict';

  function hasChrome() {
    return typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function';
  }

  /** إرسال رسالة والوصول بنتيجة كـ Promise بدون رمي استثناءات */
  function send(type, payload) {
    const body = Object.assign({ type: type, ts: Date.now() }, payload || {});
    return new Promise((resolve) => {
      if (!hasChrome()) { resolve({ __err: 'no-runtime' }); return; }
      try {
        chrome.runtime.sendMessage(body, (response) => {
          const last = chrome.runtime.lastError;
          if (last) { resolve({ __err: last.message || 'runtime-error' }); return; }
          resolve(response === undefined ? {} : response);
        });
      } catch (err) {
        resolve({ __err: String(err && err.message ? err.message : err) });
      }
    });
  }

  /**
   * تسجيل مستمع لنوع رسالة محدد مع دعم المعالجات غير المتزامنة.
   * يُرجع دالة إلغاء التسجيل.
   */
  function on(type, handler) {
    if (!hasChrome()) { return () => {}; }
    const listener = (message, sender, sendResponse) => {
      if (!message || message.type !== type) { return; }
      let settled = false;
      const respond = (value) => {
        if (settled) { return; }
        settled = true;
        try { sendResponse(value === undefined ? { ok: true } : value); } catch (_) { /* القناة مغلقة */ }
      };
      Promise.resolve()
        .then(() => handler(message, sender))
        .then((value) => respond(value))
        .catch((err) => respond({ __err: String(err && err.message ? err.message : err) }));
      return true; // قناة غير متزامنة
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      try { chrome.runtime.onMessage.removeListener(listener); } catch (_) {}
    };
  }

  /** بث رسالة لكل صفحات الإضافة (Side Panel / Options) بدون انتظار رد */
  function broadcast(type, payload) {
    if (!hasChrome()) { return; }
    const body = Object.assign({ type: type, ts: Date.now() }, payload || {});
    try { chrome.runtime.sendMessage(body, () => { void chrome.runtime.lastError; }); } catch (_) {}
  }

  /**
   * فتح Port دائم مع نبضة كل فترة — يبقي الـ Service Worker حياً
   * طوال فترة التشغيل حتى لو لم توجد أحداث أخرى.
   */
  function connectKeepalive(name) {
    if (!hasChrome() || typeof chrome.runtime.connect !== 'function') { return null; }
    let port = null;
    try { port = chrome.runtime.connect({ name: name || 'srt-keepalive' }); } catch (_) { return null; }
    const interval = global.SRT_C ? global.SRT_C.LIMITS.KEEPALIVE_INTERVAL_MS : 15000;
    const timer = setInterval(() => {
      try { port.postMessage({ tick: Date.now() }); } catch (_) { clearInterval(timer); }
    }, interval);
    port.onDisconnect.addListener(() => clearInterval(timer));
    return port;
  }

  /** نبضة دورية عبر sendMessage (لصفحات المحتوى) */
  function startHeartbeat(tag) {
    const interval = global.SRT_C ? global.SRT_C.LIMITS.HEARTBEAT_INTERVAL_MS : 20000;
    return setInterval(() => {
      send(global.SRT_C ? global.SRT_C.MSG.KEEPALIVE : 'srt/keepalive', { tag: tag, href: String(global.location && global.location.href) })
        .then(() => {});
    }, interval);
  }

  global.SRT = Object.assign(global.SRT || {}, {
    msg: { send, on, broadcast, connectKeepalive, startHeartbeat, hasChrome }
  });
})(globalThis);
