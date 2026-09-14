/**
 * embedded.js — تشغيل الأدوات المدمجة داخل الإضافة الموحدة
 * يستورد سكربتات الخلفية الخاصة بالأدوات المدمجة (كلها متوافقة مع module worker)
 * وينشئ قائمة سياقية (كليك يمين على أيقونة الإضافة) لفتح واجهاتها.
 *
 * الأدوات المدمجة: Buster / SERP Counter / Show 100 (BeyondTen) / gs location changer
 */
import '../../gsloc/js/background.js';
import '../../beyondten/background.js';
import '../../serpcounter/background.js';
import '../../buster/src/background/script.js';

const TOOLS = [
  { id: 'srt-tool-buster', title: '🧩 Buster — خيارات حل الكابتشا', url: 'buster/src/options/index.html' },
  { id: 'srt-tool-serp', title: '🔢 SERP Counter — الإعدادات', url: 'serpcounter/popup.html' },
  { id: 'srt-tool-bt', title: '💯 Show 100 Results — الإعدادات', url: 'beyondten/popup/popup.html' },
  { id: 'srt-tool-gs', title: '📍 gs Location Changer — تغيير الموقع', url: 'gsloc/popup.html' }
];

try {
  // gs location changer: فرض الوضع الداكن (بهوية اللوحة) كافتراضي أول تشغيل — والمستخدم يقدر يرجّعه فاتح من زراره
  chrome.storage.sync.get('theme', (r) => {
    if (!r || !r.theme) { chrome.storage.sync.set({ theme: 'dark' }); }
  });

  chrome.contextMenus.create({ id: 'srt-tools', title: '🔧 الأدوات المدمجة', contexts: ['action'] },
    () => void chrome.runtime.lastError);
  for (const t of TOOLS) {
    chrome.contextMenus.create({ id: t.id, parentId: 'srt-tools', title: t.title, contexts: ['action'] },
      () => void chrome.runtime.lastError);
  }
  chrome.contextMenus.onClicked.addListener((info) => {
    const tool = TOOLS.find((x) => x.id === info.menuItemId);
    if (tool) { chrome.tabs.create({ url: chrome.runtime.getURL(tool.url) }); }
  });
} catch (_) { /* contextMenus غير متاحة — الأدوات تظل تعمل بخلفياتها تلقائياً */ }
