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

export async function open(url, cfg) {
  const tab = await chrome.tabs.create({ url, active: !!(cfg && cfg.foregroundTab) });
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

export async function focus(tabId) {
  try {
    await chrome.tabs.update(tabId, { active: true });
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.windowId) { await chrome.windows.update(tab.windowId, { focused: true }); }
  } catch (_) {}
}
