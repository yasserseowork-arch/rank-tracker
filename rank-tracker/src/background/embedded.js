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

const TOOLS = [
  { id: 'srt-tool-serp', title: '🔢 SERP Counter — الإعدادات', url: 'serpcounter/popup.html' },
  { id: 'srt-tool-bt', title: '💯 Show 100 Results — الإعدادات', url: 'beyondten/popup/popup.html' },
  { id: 'srt-tool-gs', title: '📍 gs Location Changer — تغيير الموقع', url: 'gsloc/popup.html' }
];

try {
  // أيقونة الإضافة الموحدة: نثبّتها على لوجو SEO Kw Tracker عند كل تشغيل —
  // حتى لو أي أداة مدمجة أو حالة قديمة حاولت تغييرها بتبقى أيقونتنا هي اللي ظاهرة دايماً
  chrome.action.setIcon({
    path: { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' }
  }, () => void chrome.runtime.lastError);

  // gs location changer: الوضع الداكن (بهوية اللوحة) كافتراضي أول تشغيل — والمستخدم يقدر يرجّعه فاتح من زراره
  chrome.storage.sync.get('theme', (r) => {
    if (!r || !r.theme) { chrome.storage.sync.set({ theme: 'dark' }); }
  });

  // gs location changer: ديفولت الموقع = السعودية كلها — بلد بس من غير تحديد مدينة
  // (gl=SA، hl=ar) مفعّل تلقائياً. يُزرع أول تشغيل فقط، ولو المستخدم غيّر الموقع بعدها
  // لا يُستبدل اختياره أبداً — وديفولت الرياض مدينة-بُعيد يُرقّى تلقائياً للنسخة القطرية
  chrome.storage.sync.get('settings', (r) => {
    const s = r && r.settings;
    const saudiDefaults = {
      // مركز المملكة الجغرافي (نقطة عامة في عرض الجزيرة — مش نقطة مدينة) + قطر
      // ~1000كم يغطي الرقعة: إشارة x-geo بقت «السعودية كلها» بدل «رياض سيتي سنتر 65كم»
      latitude: 24.0,
      longitude: 45.0,
      location: 'Saudi Arabia',
      name: 'Saudi Arabia',
      placeId: 'KSA-COUNTRY',
      radius: 1000000,
      enabled: true,
      hl: 'ar',
      gl: 'SA',
      regions: 'Saudi Arabia - Arabic',
      timestamp: 0
    };
    // لا يوجد إعداد إطلاقاً → ازرع السعودية مفعّلة
    if (!s) { chrome.storage.sync.set({ settings: saudiDefaults }); return; }
    // نسخة قديمة من الديفولت الأمريكي اللي كنا بنزرعه → حدّثها للسعودية مفعّلة
    if (s.name === 'Google Building 40' && s.gl === 'US') {
      chrome.storage.sync.set({ settings: saudiDefaults });
      return;
    }
    // v1.21.6: ديفولت الرياض القديم (زرعته إديتنا، مش اختيار من Places) → رقٍّ للقطري.
    // أي حاجة تانية — اختيار مستخدم من البحث أو مدينة كتبها بنفسه أو وضع معطّل — بتتساب زي ما هي
    if (s.name === 'Riyadh' && s.location === 'Riyadh, Saudi Arabia' && s.enabled !== false) {
      chrome.storage.sync.set({ settings: Object.assign({}, s, saudiDefaults) });
    }
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
