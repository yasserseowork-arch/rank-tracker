/**
 * tabctl.js — التحكم في تبويب الفحص (فتح/متابعة/إغلاق)
 * يوفّر مراقبين: اكتمال التحميل، وتغيّر الرابط (لكشف حل الكابتشا).
 */
import { C } from './bridge.js';
import * as logger from './logger.js';

const urlWatchers = new Map();   // tabId -> Set<(url)=>void>
const removeWatchers = new Map(); // tabId -> Set<()=>void>

let listenersInstalled = false;

export function installListeners() {
  if (listenersInstalled) { return; }
  listenersInstalled = true;

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo && changeInfo.url) {
      const set = urlWatchers.get(tabId);
      if (set) { for (const fn of Array.from(set)) { try { fn(changeInfo.url); } catch (_) {} } }
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    const set = removeWatchers.get(tabId);
    if (set) { for (const fn of Array.from(set)) { try { fn(); } catch (_) {} } }
    urlWatchers.delete(tabId);
    removeWatchers.delete(tabId);
  });
}

export function onUrlChange(tabId, fn) {
  if (!urlWatchers.has(tabId)) { urlWatchers.set(tabId, new Set()); }
  urlWatchers.get(tabId).add(fn);
  return () => urlWatchers.get(tabId)?.delete(fn);
}

export function onRemoved(tabId, fn) {
  if (!removeWatchers.has(tabId)) { removeWatchers.set(tabId, new Set()); }
  removeWatchers.get(tabId).add(fn);
  return () => removeWatchers.get(tabId)?.delete(fn);
}

/* ---------- «على نفس التاب» (طلب v1.19.4) ----------
   مفيش نافذة جديدة ولا تاب فضاي: لو في نافذة الأدَاة تاب نشيط على صفحة ويب،
   بنفتح فيه (tabs.update). اللوحة بتسجّل نافذتها في srt/panelWindow عند التشغيل.
   noAdopt:true (زي كتابة الشيت) = تاب جديد دايمًا. مفيش أي chrome.windows.create
   ولا windows.update — صفر شد فوكس بطبيعة الحال. */
export async function panelWindow() {
  try { const s = await chrome.storage.session.get('srt/panelWindow'); return (s && s['srt/panelWindow']) || 0; } catch (_) { return 0; }
}

export async function open(url, cfg) {
  const wid = await panelWindow();
  if (!(cfg && cfg.noAdopt) && wid) {
    let active = null;
    try { const r = await chrome.tabs.query({ windowId: wid, active: true }); active = r && r[0]; } catch (_) { active = null; }
    if (active && active.id && /^https?:/i.test(active.url || '')) {
      try {
        await chrome.tabs.update(active.id, { url, active: true });
        await logger.debug('tabs', `فتحت في نفس التاب #${active.id}: ${url}`);
        return active;
      } catch (_) { /* التاب مات للتو — هنفتح واحد جديد */ }
    }
  }
  const opts = { url, active: true };
  if (wid && !(cfg && cfg.noAdopt === 'anywhere')) { opts.windowId = wid; }
  const tab = await chrome.tabs.create(opts);
  await logger.debug('tabs', `فتح تبويب #${tab.id}: ${url}`);
  return tab;
}

export async function getUrl(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab ? tab.url || '' : '';
  } catch (_) {
    return '';
  }
}

export async function waitForComplete(tabId, timeoutMs) {
  const limit = timeoutMs || C.LIMITS.TAB_LOAD_TIMEOUT_MS;
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok, reason) => {
      if (done) { return; }
      done = true;
      clearTimeout(timer);
      try { chrome.tabs.onUpdated.removeListener(listener); } catch (_) {}
      resolve({ ok, reason });
    };
    const timer = setTimeout(() => finish(false, 'timeout'), limit);
    const listener = (id, changeInfo, tab) => {
      if (id !== tabId) { return; }
      if (changeInfo.status === 'complete') { finish(true, 'complete'); return; }
      if (tab && tab.url && /\/sorry\//.test(tab.url)) { finish(true, 'sorry'); }
    };
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab && tab.status === 'complete') { finish(true, 'already-complete'); }
    }).catch(() => {});
    onRemoved(tabId, () => finish(false, 'removed'));
  });
}

export async function close(tabId) {
  if (!tabId) { return; }
  try {
    // حماية: لا نُغلق آخر تبويب في النافذة أبداً (حتى لا يُغلق كروم نفسه)
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.windowId) {
      const win = await chrome.windows.get(tab.windowId, { populate: true });
      if (win && win.tabs && win.tabs.length <= 1) {
        await chrome.tabs.update(tabId, { url: 'about:blank' });
        return;
      }
    }
    await chrome.tabs.remove(tabId);
  } catch (_) {}
  urlWatchers.delete(tabId);
  removeWatchers.delete(tabId);
}

/** تحديث رابط تبويب قائم (تنقّل داخل نفس التبويب) */
export async function navigate(tabId, url) {
  await chrome.tabs.update(tabId, { url });
  return true;
}

/** إعادة تحميل تبويب (لصفحات الخطأ) */
export async function reload(tabId) {
  try { await chrome.tabs.reload(tabId, {}); return true; } catch (_) { return false; }
}

/** هل التبويب حي؟ */
export async function isAlive(tabId) {
  if (!tabId) { return false; }
  try { const tab = await chrome.tabs.get(tabId); return !!tab; } catch (_) { return false; }
}

/* ملاحظة v1.19.4: دالة focus() اتشالت مع مصدرها — مفيش أي لمس لفوكس النوافذ في الأداة كلها */
