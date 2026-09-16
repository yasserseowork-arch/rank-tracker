/**
 * state.js — طبقة التخزين والهجرة (Schema versioning)
 * chrome.storage.local  : الإعدادات + الكلمات + النتائج (دائمة)
 * chrome.storage.session: حالة التشغيل + السجلات (تُفقد عند إغلاق المتصفح عمداً)
 */
import { C } from './bridge.js';

export const SCHEMA_VERSION = 4;

export const K = {
  CONFIG: 'srt.config',
  KEYWORDS: 'srt.keywords',
  RESULTS: 'srt.results',
  RUN: 'srt.run',
  LOGS: 'srt.logs',
  SCHEMA: 'srt.schemaVersion'
};

/** الإعدادات الافتراضية — المصدر الوحيد للحقيقة */
export const DEFAULT_CONFIG = {
  // الهوية المستهدفة
  storeDomain: '',
  storeName: '',
  matchMode: 'both',            // domain | name | both
  // استهداف جغرافي ولغة SERP
  gl: '',   // المنطقة اختيارية تماماً — سيبتها فاضية = إعداد جوجل الافتراضي
  hl: '',   // اللغة اختيارية — سيبتها فاضية = لغة متصفحك
  num: 100,
  // الإيقاع البشري
  delayMs: 4000,                // مهلة إلزامية قبل كل كلمة (طلب المستخدم: 4 ثوانٍ)
  jitterMs: 1500,
  cooldownEvery: 8,             // كل N كلمات خذ استراحة طويلة
  cooldownMs: 45000,
  cooldownJitterMs: 20000,
  // الكابتشا
  captchaMaxAttempts: 2,
  captchaAttemptTimeoutMs: 35000,
  captchaGapMs: 2500,
  captchaRefreshRetries: 2,   // ريفرش صفحة الكابتشا ومحاولات جديدة عند الفشل
  pauseOnCaptchaFail: true,
  autoResumeOnManualSolve: true,
  // قراءة SERP
  settleMs: 1800,
  scrollStepMs: 320,
  maxWaitResultsMs: 20000,      // قاعدة الـ20 ثانية: بعدها الكلمة تُعتبر غير موجودة
  batchSettleMs: 5000,          // ثبات العدّاد هذه المدة = الأداة المساعدة خلّصت
  rescanMs: 1800,               // فترة المسح الدوري (مثل Ctrl+F متكرر)
  selfFetchMore: false,         // جلب خلفي اختياري (متقدم) — الافتراضي الاعتماد على التمرير
  selfFetchMaxBatches: 6,       // أقصى دفعات خلفية (كل دفعة 10 نتائج)
  maxChecksPerDay: 150,         // سقف يومي احتراماً لقواعد جوجل (0 = بدون سقف)
  errorReloadMax: 2,            // ريفرش تلقائي لصفحات الخطأ (عدد المرات)
  keywordRetries: 5,            // أي مشكلة؟ ريفرش + نفس الكلمة — عدد مرات إعادة المحاولة
  captchaClearRetries: 3,       // كابتشا؟ مسح بيانات المتصفح + تاب جديد — عدد المرات لكل كلمة
  // دورة العمل الكاملة (مثل السيناريو اليدوي)
  clearBeforeRun: true,         // مسح بيانات التصفح (كل الوقت) قبل بدء الجولة
  clearEveryN: 8,               // مسح دوري متزامن مع الاستراحة: كل 8 كلمات (0 = معطّل) — بصمة أقل وكابتشا أقل
  sheetUrl: '',                 // رابط شيت جوجل للمزامنة والكتابة
  sheetWriteBack: false,        // كتابة عمود الترتيب في الشيت عند انتهاء الجولة
  sheetStartCell: 'B1',         // خلية بداية لصق عمود الترتيب
  mapsCheck: true,              // فحص النتائج المحلية (خرائط) لكل كلمة — مثل السيناريو
  autoXlsx: true,               // تنزيل شيت Excel بالترتيب تلقائياً عند انتهاء الجولة
  // التبويبات
  foregroundTab: true,
  reuseTab: true,               // تبويب واحد دائم + تغيير الكلمة من صندوق البحث
  // متفرقات
  verbose: true,
  maxHistoryPerKeyword: 40
};

const local = {
  async get(key, fallback) {
    try {
      const obj = await chrome.storage.local.get(key);
      return obj && obj[key] !== undefined ? obj[key] : fallback;
    } catch (_) {
      return fallback;
    }
  },
  async set(key, value) {
    try { await chrome.storage.local.set({ [key]: value }); } catch (_) {}
  },
  async remove(key) {
    try { await chrome.storage.local.remove(key); } catch (_) {}
  }
};

const session = {
  async get(key, fallback) {
    try {
      if (!chrome.storage.session) { return fallback; }
      const obj = await chrome.storage.session.get(key);
      return obj && obj[key] !== undefined ? obj[key] : fallback;
    } catch (_) {
      return fallback;
    }
  },
  async set(key, value) {
    try { if (chrome.storage.session) { await chrome.storage.session.set({ [key]: value }); } } catch (_) {}
  }
};

/* ----------------------------- الإعدادات ----------------------------- */

export async function getConfig() {
  const stored = await local.get(K.CONFIG, {});
  return Object.assign({}, DEFAULT_CONFIG, stored || {});
}

export async function setConfig(patch) {
  const current = await getConfig();
  const next = Object.assign({}, current, patch || {});
  // تطهير الأنواع
  const numeric = ['num', 'delayMs', 'jitterMs', 'cooldownEvery', 'cooldownMs', 'cooldownJitterMs',
    'captchaMaxAttempts', 'captchaAttemptTimeoutMs', 'captchaGapMs', 'captchaRefreshRetries', 'keywordRetries', 'captchaClearRetries', 'settleMs', 'scrollStepMs',
    'maxWaitResultsMs', 'maxHistoryPerKeyword', 'maxChecksPerDay', 'errorReloadMax',
    'batchSettleMs', 'rescanMs', 'selfFetchMaxBatches', 'clearEveryN'];
  for (const key of numeric) {
    const n = parseInt(next[key], 10);
    if (!Number.isNaN(n)) { next[key] = n; }
  }
  const booleans = ['pauseOnCaptchaFail', 'autoResumeOnManualSolve', 'foregroundTab', 'reuseTab', 'verbose', 'selfFetchMore', 'clearBeforeRun', 'sheetWriteBack', 'mapsCheck', 'autoXlsx'];
  for (const key of booleans) { next[key] = !!next[key]; }
  if (!['domain', 'name', 'both'].includes(next.matchMode)) { next.matchMode = 'both'; }
  // تنظيف الدومين: المستخدم يكتبه بدون https وأحياناً بمسار أو www
  if (typeof next.storeDomain === 'string') {
    next.storeDomain = next.storeDomain.trim()
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
      .replace(/[\/?#].*$/, '')
      .replace(/^www\./i, '')
      .toLowerCase();
  }
  next.delayMs = Math.max(1000, next.delayMs);
  next.num = Math.min(100, Math.max(10, next.num));
  await local.set(K.CONFIG, next);
  return next;
}

/* --------------------------- الكلمات المفتاحية --------------------------- */

export function makeKeywordId(keyword) {
  return 'kw_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export async function getKeywords() {
  const list = await local.get(K.KEYWORDS, []);
  return Array.isArray(list) ? list : [];
}

export async function setKeywords(list) {
  await local.set(K.KEYWORDS, Array.isArray(list) ? list : []);
}

export async function updateKeyword(id, patch) {
  const list = await getKeywords();
  const idx = list.findIndex((k) => k.id === id);
  if (idx === -1) { return null; }
  list[idx] = Object.assign({}, list[idx], patch || {});
  await setKeywords(list);
  return list[idx];
}

export async function addKeywords(keywords, note) {
  const list = await getKeywords();
  const added = [];
  let reset = 0;
  for (const raw of keywords || []) {
    const kw = String(raw || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
    if (!kw) { continue; }
    const key = kw.toLowerCase();
    const idx = list.findIndex((k) => String(k.keyword || '').trim().toLowerCase() === key);
    if (idx >= 0) {
      // موجودة من قبل؟ رجّعها لطابور الانتظار بدل تجاهلها الصامت
      list[idx] = Object.assign({}, list[idx], { status: C.STATUS.KW.PENDING });
      reset += 1;
      continue;
    }
    const item = {
      id: makeKeywordId(kw),
      keyword: kw,
      note: note || '',
      status: C.STATUS.KW.PENDING,
      lastPosition: null,
      lastFound: null,
      lastCheckedAt: null,
      history: []
    };
    list.push(item);
    added.push(item);
  }
  await setKeywords(list);
  return { added: added, reset: reset };
}

export async function removeKeyword(id) {
  const list = await getKeywords();
  await setKeywords(list.filter((k) => k.id !== id));
}

export async function clearKeywords() {
  await setKeywords([]);
}

/* -------------------------------- النتائج -------------------------------- */

export async function getResults() {
  const list = await local.get(K.RESULTS, []);
  return Array.isArray(list) ? list : [];
}

export async function addResult(row) {
  const list = await getResults();
  list.unshift(row);
  const cfg = await getConfig();
  const cap = Math.min(C.LIMITS.MAX_RESULTS_STORED, 2000);
  if (list.length > cap) { list.length = cap; }
  await local.set(K.RESULTS, list);
  void cfg;
  return row;
}

export async function clearResults() {
  await local.set(K.RESULTS, []);
}

/* ------------------------------ حالة التشغيل ------------------------------ */

export const DEFAULT_RUN = {
  status: C.STATUS.RUN.IDLE,
  currentIndex: 0,
  startedAt: null,
  finishedAt: null,
  pauseReason: null,
  captcha: null,           // {tabId, attempts, lastError, since}
  checked: 0,
  found: 0,
  captchaSolves: 0,
  failures: 0
};

export async function getRun() {
  const run = await session.get(K.RUN, null);
  return Object.assign({}, DEFAULT_RUN, run || {});
}

export async function setRun(patch) {
  const run = await getRun();
  const next = Object.assign({}, run, patch || {});
  await session.set(K.RUN, next);
  return next;
}

/* --------------------------------- السجلات --------------------------------- */

export async function getLogs() {
  return session.get(K.LOGS, []);
}

export async function pushLog(entry) {
  const logs = await getLogs();
  logs.push(entry);
  if (logs.length > C.LIMITS.MAX_LOGS) { logs.splice(0, logs.length - C.LIMITS.MAX_LOGS); }
  await session.set(K.LOGS, logs);
  return entry;
}

export async function clearLogs() {
  await session.set(K.LOGS, []);
}

/* --------------------------------- الهجرة --------------------------------- */

/** عدّاد الفحوصات اليومي (سقف احتراماً لقواعد جوجل) */
export async function getDailyCount() {
  const today = new Date().toISOString().slice(0, 10);
  const stored = await local.get('srt.dailyCount', { date: today, count: 0 });
  if (stored.date !== today) { return { date: today, count: 0 }; }
  return stored;
}

export async function bumpDailyCount() {
  const current = await getDailyCount();
  const next = { date: current.date, count: current.count + 1 };
  await local.set('srt.dailyCount', next);
  return next;
}

export async function migrate() {
  const version = await local.get(K.SCHEMA, 0);
  if (version >= SCHEMA_VERSION) { return version; }
  if (version < 2) {
    // توحيد شكل الكلمات القديمة إن وجدت
    const list = await getKeywords();
    const fixed = list.map((k) => Object.assign({
      id: k.id || makeKeywordId(k.keyword || String(Math.random())),
      keyword: String(k.keyword || k.kw || ''),
      note: k.note || '',
      status: k.status || C.STATUS.KW.PENDING,
      lastPosition: k.lastPosition ?? null,
      lastFound: k.lastFound ?? null,
      lastCheckedAt: k.lastCheckedAt ?? null,
      history: Array.isArray(k.history) ? k.history : []
    }));
    await setKeywords(fixed);
  }
  if (version < 4) {
    // عادات جديدة: الكابتشا محاولتين بس، والمسح الدوري بقى متزامن مع الاستراحة (كل 8)
    const cfg = await getConfig();
    const patchCfg = {};
    const att = parseInt(cfg.captchaMaxAttempts, 10);
    if (!Number.isFinite(att) || att > 2) { patchCfg.captchaMaxAttempts = 2; }
    const cn = parseInt(cfg.clearEveryN, 10);
    if (!Number.isFinite(cn) || cn === 10) { patchCfg.clearEveryN = 8; }
    if (Object.keys(patchCfg).length) { await setConfig(patchCfg); }
  }
  await local.set(K.SCHEMA, SCHEMA_VERSION);
  return SCHEMA_VERSION;
}

/* ------------------------------- نسخة شاملة ------------------------------- */

export async function snapshot() {
  const [config, keywords, results, run, logs] = await Promise.all([
    getConfig(), getKeywords(), getResults(), getRun(), getLogs()
  ]);
  return {
    version: C.VERSION,
    config,
    keywords,
    results: results.slice(0, 300),
    run,
    logs: logs.slice(-150),
    stats: computeStats(results, keywords)
  };
}

function computeStats(results, keywords) {
  const checked = results.length;
  const foundRows = results.filter((r) => r.found);
  const positions = foundRows.map((r) => r.position).filter((p) => typeof p === 'number');
  const avg = positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : null;
  return {
    checked,
    found: foundRows.length,
    notFound: checked - foundRows.length,
    avgPosition: avg === null ? null : Math.round(avg * 10) / 10,
    best: positions.length ? Math.min(...positions) : null,
    pending: keywords.filter((k) => k.status === C.STATUS.KW.PENDING).length,
    done: keywords.filter((k) => k.status === C.STATUS.KW.DONE).length,
    total: keywords.length
  };
}
