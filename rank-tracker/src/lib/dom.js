/**
 * dom.js — أدوات DOM مشتركة (Classic script)
 * انتظار عناصر، ضغط آمن، بحث بالنص، فترات نوم عشوائية بطابع بشري.
 */
(function (global) {
  'use strict';

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /** نوم بشري: base ± jitter */
  function humanSleep(base, jitter) {
    const j = jitter || 0;
    const delta = j > 0 ? Math.round((Math.random() * 2 - 1) * j) : 0;
    return sleep(Math.max(0, base + delta));
  }

  function qs(selector, root) {
    try { return (root || document).querySelector(selector); } catch (_) { return null; }
  }

  function qsa(selector, root) {
    try { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); } catch (_) { return []; }
  }

  /** أول عنصر موجود من قائمة محددات */
  function first(selectors, root) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const sel of list) {
      const el = qs(sel, root);
      if (el) { return el; }
    }
    return null;
  }

  function isVisible(el) {
    if (!el) { return false; }
    const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (rect && rect.width === 0 && rect.height === 0) { return false; }
    const style = global.getComputedStyle ? getComputedStyle(el) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) { return false; }
    return true;
  }

  /**
   * انتظار ظهور عنصر أو تحقق شرط.
   * @param {string|string[]|Function} target محدد أو قائمة محددات أو دالة فحص
   * @param {object} opts {timeoutMs, intervalMs, desc}
   * @returns {Promise<Element|true|null>}
   */
  async function waitFor(target, opts) {
    const options = Object.assign({ timeoutMs: 10000, intervalMs: 250, desc: '' }, opts || {});
    const started = Date.now();
    for (;;) {
      let hit = null;
      if (typeof target === 'function') {
        try { hit = target() || null; } catch (_) { hit = null; }
        if (hit === true) { return true; }
      } else {
        hit = first(target);
      }
      if (hit) { return hit; }
      if (Date.now() - started > options.timeoutMs) { return null; }
      await sleep(options.intervalMs);
    }
  }

  /** ضغط عنصر بطريقة أحداث موثوقة (يسقط عند الفشل بدون رمي) */
  function click(el, desc) {
    if (!el) { return false; }
    try {
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    } catch (_) {}
    const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    const x = rect ? rect.left + rect.width / 2 : 1;
    const y = rect ? rect.top + rect.height / 2 : 1;
    const common = { bubbles: true, cancelable: true, view: global, clientX: x, clientY: y, button: 0 };
    try {
      el.dispatchEvent(new MouseEvent('mousedown', common));
      el.dispatchEvent(new MouseEvent('mouseup', common));
      el.dispatchEvent(new MouseEvent('click', common));
      if (typeof el.click === 'function') { el.click(); }
      return true;
    } catch (err) {
      if (global.console) { console.warn('[SRT] click failed', desc || '', err); }
      return false;
    }
  }

  /** البحث عن عنصر يحتوي نصاً مطابقاً (بعد التطبيع) داخل قائمة محددات */
  function byText(selectors, text, root) {
    const needle = String(text || '').trim().toLowerCase();
    if (!needle) { return null; }
    const nodes = qsa(Array.isArray(selectors) ? selectors.join(',') : selectors, root);
    for (const node of nodes) {
      const own = (node.textContent || '').trim().toLowerCase();
      if (own && (own === needle || own.indexOf(needle) !== -1)) { return node; }
    }
    return null;
  }

  function textOf(el) {
    return el && el.textContent ? String(el.textContent).replace(/\s+/g, ' ').trim() : '';
  }

  /** مراقب تغييرات DOM خفيف */
  function observe(root, callback, opts) {
    const target = root || document.body || document.documentElement;
    if (!target || typeof MutationObserver === 'undefined') { return () => {}; }
    const mo = new MutationObserver((records) => {
      try { callback(records); } catch (_) {}
    });
    mo.observe(target, Object.assign({ childList: true, subtree: true, attributes: true }, opts || {}));
    return () => mo.disconnect();
  }

  global.SRT = Object.assign(global.SRT || {}, {
    sleep, humanSleep, qs, qsa, first, isVisible, waitFor, click, byText, textOf, observe
  });
})(globalThis);
