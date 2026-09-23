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

/* ---------- نافذة الأداة الخاصة ----------
   كل تبويبات الفحص بتتفتح في نافذة واحدة تابعة لبروفايل الإضافة (خلفية، من غير
   سرقة فوكس)، فالـ debug banner وأيّ وميض بيفضلوا معزولين عن نوافذ البروفايلات
   التانية. useToolWindow:false بترجع السلوك القديم (نافذة المستخدم الحالية). */
const TOOLWIN_KEY = 'srt/toolWindow';
let toolWindowId = 0;

async function readPersistedWin() {
  try { const s = await chrome.storage.session.get(TOOLWIN_KEY); return (s && s[TOOLWIN_KEY]) || 0; } catch (_) { return 0; }
}
async function writePersistedWin(id) {
  try {
    if (id) { const o = {}; o[TOOLWIN_KEY] = id; await chrome.storage.session.set(o); }
    else { await chrome.storage.session.remove(TOOLWIN_KEY); }
  } catch (_) {}
}

export async function getToolWindow() {
  if (!toolWindowId) { toolWindowId = await readPersistedWin(); }
  if (toolWindowId) {
    try { await chrome.windows.get(toolWindowId); return toolWindowId; }
    catch (_) { toolWindowId = 0; }
  }
  let w = null;
  try { w = await chrome.windows.create({ url: 'about:blank', focused: false, type: 'normal' }); } catch (_) { w = null; }
  if (!w) { return 0; }
  toolWindowId = w.id;
  await writePersistedWin(toolWindowId);
  return toolWindowId;
}

function isToolTabUrl(u) {
  if (!u || /^about:/i.test(u)) { return true; }
  return /(^|\.)google\.[a-z.]+/i.test(u);
}

/** في آخر الجولة: لو النافذة مضايفة بس على تبويبات الأداة → تقفل؛ لو المستخدم حاطط فيها حاجة تخصه → نقفل الفراغات وخلاص */
export async function closeToolWindowIfEmpty() {
  if (!toolWindowId) { return false; }
  const id = toolWindowId;
  let tabs = [];
  try { tabs = await chrome.tabs.query({ windowId: id }); } catch (_) { return false; }
  const closable = tabs.filter((t) => isToolTabUrl(t.url));
  if (tabs.length && closable.length === tabs.length) {
    try { await chrome.windows.remove(id); toolWindowId = 0; await writePersistedWin(0); return true; } catch (_) {}
  }
  for (const t of closable) {
    if (!t.url || /^about:/i.test(t.url)) { try { await chrome.tabs.remove(t.id); } catch (_) {} }
  }
  return false;
}

export async function open(url, cfg) {
  if (!(cfg && cfg.useToolWindow === false)) {
    const wid = await getToolWindow();
    if (wid) {
      const t = await chrome.tabs.create({ url, windowId: wid, active: !!(cfg && cfg.foregroundTab) });
      await logger.debug('tabs', `فتح تبويب #${t.id} (نافذة الأداة ${wid}): ${url}`);
      return t;
    }
  }
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
