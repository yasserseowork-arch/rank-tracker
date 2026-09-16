/**
 * i18n-ui.js — تعريب كامل والعربية هي اللغة الأساسية (Classic script)
 * قاموس مدمج لا يعتمد على لغة متصفح المستخدم (عكس chrome.i18n).
 * اللغة تُحفظ في chrome.storage.local تحت مفتاح srt.lang (افتراضي: ar).
 */
(function (global) {
  'use strict';

  const STR = {
    ar: {
      appName: 'SEO Kw Tracker', panelTitle: 'لوحة تتبع الترتيب',
      statusIdle: 'خامل', statusRunning: 'شغال…', statusPaused: 'واقف مؤقتاً', statusCaptcha: 'بيحل كابتشا',
      btnStart: '▶ ابدأ الفحص', btnPause: '⏸ إيقاف مؤقت', btnResume: '⏩ كمّل', btnStop: '⏹ إيقاف', btnShowTab: 'اعرض التبويب',
      captchaLiveTitle: 'في كابتشا دلوقتي…',
      captchaLiveText: 'بندوس على الشخص البرتقالي (Buster) وبيحل لوحده؛ لو فشل بنجدد التحدي ⟳ وندوس تاني.',
      captchaFailedTitle: 'الكابتشا فشلت تتحل لوحدها',
      captchaFailedText: 'حلها بإيدك في التبويب وهنكمّل لوحدنا، أو دوس «كمّل» عشان نعدي الكلمة دي.',
      captchaAttemptsLabel: 'المحاولات:',
      statChecked: 'كلمات اتفحصت', statFound: 'ظهور المتجر', statAvg: 'متوسط الترتيب', statCaptcha: 'كابتشا اتحلت',
      chartTitle: 'منحنى الترتيب', chartEmpty: 'لسه مفيش بيانات — ابدأ الفحص وشوف المنحنى.',
      targetTitle: '🎯 بيانات متجرك', lblDomain: 'دومين المتجر', lblName: 'اسم المتجر', lblMatch: 'طريقة المطابقة',
      matchBoth: 'الدومين أو الاسم', matchDomain: 'الدومين بس', matchName: 'الاسم بس',
      rhythmTitle: '⏱ المهلة قبل كل كلمة', lblDelay: 'مهلة قبل كل كلمة (ملي ثانية)', rhythmHint: 'باقي إعدادات السرعة والكابتشا في الإعدادات المتقدمة.',
      kwTitle: '🔑 الكلمات المفتاحية', kwPlaceholder: 'حط الكلمات هنا — كل كلمة في سطر',
      btnAddKw: '＋ ضيف الكلمات', btnImportCsv: '📄 استيراد CSV', btnClearKw: '🗑 امسح الكل',
      thKeyword: 'الكلمة', thStatus: 'الحالة', thPosition: 'الترتيب', thUrl: 'الرابط', thTime: 'الوقت',
      resTitle: '📊 تصدير النتائج', btnMakeXlsx: '📊 شيت بالترتيب (XLSX)', btnExportCsv: '⬇ CSV', btnCopyTsv: '📋 انسخ للشيت', btnClearRes: '🗑 امسح',
      logTitle: '🖥 السجل', btnClearLogs: 'امسح السجل',
      footerNote: '© 2026 SEO Kw Tracker. كل الحقوق محفوظة.',
      footerCopy: '© 2026 SEO Kw Tracker. كل الحقوق محفوظة.',
      kwEmpty: 'لسه مفيش كلمات — حط كلماتك فوق.', resEmpty: 'لسه مفيش نتائج.', notFound: 'مش موجود',
      kwPending: 'مستنية', kwRunning: 'بيتفحص', kwDone: 'خلصت', kwCaptcha: 'كابتشا', kwFailed: 'فشلت', kwSkipped: 'اتعدت',
      btnRemove: 'شيل', confirmClearKw: 'تمسح كل الكلمات المفتاحية؟', confirmClearRes: 'تمسح كل النتائج؟',
      copyDone: 'اتنسخ — الصقه في عمود الشيت.',
      copyEmpty: 'لسه مفيش نتائج — شغّل الفحص الأول.',
      copyFail: 'النسخ فشل — استخدم زر «شيت بالترتيب» بدل منه.',
      errNoTarget: 'اكتب دومين المتجر أو اسمه الأول.', errNoKeywords: 'ضيف كلمات مفتاحية الأول.',
      errDailyCap: 'وصلت للحد اليومي بتاع الفحوصات.',
      sheetCardTitle: '📄 الشيت', lblSheetUrl: 'رابط الشيت (اختياري — عشان نكتب فيه)',
      btnWriteSheet: '📝 اكتب النتائج في الشيت دلوقتي', lblAutoXlsx: 'نزّل شيت Excel لوحده آخر الجولة',
      sheetWriteHint: 'لو فيه رابط محطوط: الترتيب بيتكتب في عمود B لوحده آخر الجولة.',
      makeXlsxOk: '✔ اتجهز شيت Excel بالترتيب واتحمّل', sheetWriteOk: '✔ اتكتب الترتيب في الشيت',
      sheetWriteFail: 'الكتابة فشلت — استخدم «انسخ للشيت»',
      kwAddedOk: '✔ اتضافت {n} كلمة وجاهزة للفحص', kwAddFail: '✖ الإضافة فشلت', kwNone: 'حط كلمات الأول',
      restNext: '☕ الاستراحة والمسح الجايين بعد {n} كلمات',
      restNow: '☕ الاستراحة جارية — {s} ثانية فاضلة',
      restNowClear: ' · 🧹 ومسح البيانات بعدها',
      kwCountTip: 'اتفحص {d} من {t} كلمات',
      optionsTitle: 'الإعدادات المتقدمة', optionsSubtitle: 'حاجات زيادة ونسخة احتياطية',
      optReadTitle: 'قراية نتائج جوجل', lblSettle: 'وقت ثبات النتائج (ملي ثانية)', lblScrollStep: 'خطوة النزول (ملي ثانية)',
      lblMaxWait: 'أقصى وقت نستنى فيه الكلمة (ملي ثانية) — بعده بنعتبرها مش موجودة', lblCapGap: 'المهلة بين محاولات الكابتشا (ملي ثانية)',
      lblBatchSettle: 'ثبات الدفعات = التحميل خلص (ملي ثانية)', lblRescan: 'مدة إعادة المسح (ملي ثانية)',
      lblDailyCap: 'أقصى عدد فحوصات في اليوم (0 = مفيش حد)', lblVerbose: 'سجلات مفصلة',
      lblClearEveryN: 'امسح بيانات التصفح تلقائياً كل N كلمة (0 = إيقاف)',
      advTargetTitle: '🌍 الاستهداف', lblGl: 'منطقة جوجل (gl)', lblHl: 'لغة النتائج (hl)', lblNum: 'عدد النتائج (حتى 100)',
      advRhythmTitle: '⏱ السرعة والكابتشا', lblJitter: 'عشوائية بشرية ± (ملي ثانية)',
      lblCooldownEvery: 'راحة كل N كلمة', lblCooldownMs: 'مدة الراحة (ملي ثانية)',
      lblCapAttempts: 'أقصى محاولات حل', lblCapTimeout: 'مهلة المحاولة الواحدة (ملي ثانية)',
      lblForeground: 'التبويب قدامي أثناء الفحص', lblReuseTab: 'تاب واحد ثابت + الكتابة من صندوق البحث',
      lblPauseCap: 'قف عند فشل الكابتشا', lblAutoResume: 'كمّل لوحده بعد الحل اليدوي',
      lblClearBeforeRun: 'امسح بيانات التصفح قبل كل جولة', lblMapsCheck: 'افحص النتائج المحلية (خرائط)',
      optBackupTitle: 'نسخة احتياطية', optBackupHint: 'صدّر كل بياناتك ملف JSON أو استرجعها منه.',
      btnExportJson: '⬇ تصدير JSON', btnImportJson: '⬆ استيراد JSON', btnResetAll: '☢ تصفير كل حاجة',
      optAboutTitle: 'عن الإضافة', aboutVersion: 'الإصدار',
      aboutLi1: 'كل حاجة شغالة جوه متصفحك — من غير سيرفر ولا API خارجي.',
      aboutLi2: 'استهدف أي منطقة أو لغة من إعدادات جوجل (gl/hl) من غير VPN.',
      aboutLi3: 'الكابتشا بيتحل لوحده أو بمساعدة Buster اللي معاك.',
      importDone: 'الاستيراد تم بنجاح.', importFail: 'الاستيراد فشل', confirmReset: 'تمسح كل البيانات نهائياً؟',
      langBtn: 'EN',
      warnTitle: '⚠️ تحذير مهم',
      warnText: 'خد بالك: الإضافة دي بتمسح كل بيانات المتصفح (الكوكيز والتاريخ والكاش) قبل كل جولة فحص. استخدمها في بروفايل جيست جديد من غير تسجيل دخول — عشان حساباتك وبياناتك تفضل آمنة.',
      btnWarnOk: 'تمام، فهمت',
      tabMain: '🏠 الرئيسية', tabGsloc: '📍 الموقع', tabBeyondten: '💯 تصدير النتائج',
      paneGslocDesc: 'اختار المدينة واللغة (gl/hl) — الديفولت: السعودية',
      paneBeyondtenDesc: 'اختار عدد النتائج في الصفحة (10 / 20 / 50 / 100)'
    },
    en: {
      appName: 'SEO Kw Tracker', panelTitle: 'Rank Tracking Panel',
      statusIdle: 'Idle', statusRunning: 'Checking…', statusPaused: 'Paused', statusCaptcha: 'Solving captcha',
      btnStart: '▶ Start', btnPause: '⏸ Pause', btnResume: 'Resume', btnStop: '⏹ Stop', btnShowTab: 'Show tab',
      captchaLiveTitle: 'Captcha being solved…',
      captchaLiveText: 'We press the orange Buster person and let it solve; on failure we press ⟳ new challenge then the person again.',
      captchaFailedTitle: 'Automatic captcha solving failed',
      captchaFailedText: 'Solve it manually (auto-resume) or press Resume to skip this keyword.',
      captchaAttemptsLabel: 'Attempts:',
      statChecked: 'Checked', statFound: 'Store found', statAvg: 'Avg position', statCaptcha: 'Captchas solved',
      chartTitle: 'Position trend', chartEmpty: 'No data yet — start a run to see the trend.',
      targetTitle: '🎯 Your store data', lblDomain: 'Store domain', lblName: 'Store name', lblMatch: 'Match mode',
      matchBoth: 'Domain or name', matchDomain: 'Domain only', matchName: 'Name only',
      rhythmTitle: '⏱ Delay per keyword', lblDelay: 'Delay before each keyword (ms)', rhythmHint: 'More rhythm & captcha settings live in Advanced settings.',
      kwTitle: ' Keywords', kwPlaceholder: 'Paste keywords here — one per line',
      btnAddKw: '＋ Add keywords', btnImportCsv: '📄 Import CSV', btnClearKw: '🗑 Clear all',
      thKeyword: 'Keyword', thStatus: 'Status', thPosition: 'Position', thUrl: 'URL', thTime: 'Time',
      resTitle: '📊 Export Results', btnMakeXlsx: '📊 Ranks sheet (XLSX)', btnExportCsv: '⬇ CSV', btnCopyTsv: '📋 Copy for sheet', btnClearRes: '🗑 Clear',
      logTitle: '🖥 Live log', btnClearLogs: 'Clear log',
      footerNote: '© 2026 SEO Kw Tracker. All rights reserved.',
      footerCopy: '© 2026 SEO Kw Tracker. All rights reserved.',
      kwEmpty: 'No keywords yet — paste above.', resEmpty: 'No results yet.', notFound: 'Not found',
      kwPending: 'Pending', kwRunning: 'Checking', kwDone: 'Done', kwCaptcha: 'Captcha', kwFailed: 'Failed', kwSkipped: 'Skipped',
      btnRemove: 'Remove', confirmClearKw: 'Clear all keywords?', confirmClearRes: 'Clear all results?',
      copyDone: 'Copied — paste into the matching sheet column.',
      copyEmpty: 'No results yet — run a check first.',
      copyFail: 'Copy failed — use the XLSX export button instead.',
      errNoTarget: 'Set the store domain or name first.', errNoKeywords: 'Add keywords first.',
      errDailyCap: 'Daily check cap reached.',
      sheetCardTitle: '📄 Sheet', lblSheetUrl: 'Sheet URL (optional, to write into)',
      btnWriteSheet: '📝 Write results to sheet now', lblAutoXlsx: 'Auto-download Excel ranks sheet on finish',
      sheetWriteHint: 'With a URL set: positions are written into column B automatically at run end.',
      makeXlsxOk: '✔ Excel ranks sheet created & downloaded', sheetWriteOk: '✔ Positions written to sheet',
      sheetWriteFail: 'Write failed — use copy-for-sheet',
      kwAddedOk: '✔ {n} keyword(s) added/queued', kwAddFail: '✖ Failed to add keywords', kwNone: 'Paste keywords first',
      restNext: '☕ Next rest & data-clear in {n} keywords'
      restNow: '☕ Break in progress — {s}s left',
      restNowClear: ' · 🧹 then data clear',
      kwCountTip: 'Checked {d} of {t} keywords',,
      optionsTitle: 'Advanced settings', optionsSubtitle: 'Extra settings & backup',
      optReadTitle: 'SERP reading', lblSettle: 'Results settle time (ms)', lblScrollStep: 'Scroll step (ms)',
      lblMaxWait: 'Max wait per keyword (ms) — then counted as not found', lblCapGap: 'Captcha attempt gap (ms)',
      lblBatchSettle: 'Batch settle = loading finished (ms)', lblRescan: 'Periodic rescan interval (ms)',
      lblDailyCap: 'Daily check cap (0 = unlimited)', lblVerbose: 'Verbose logs',
      lblClearEveryN: 'Auto-clear browsing data every N keywords (0 = off)',
      advTargetTitle: '🌍 Targeting', lblGl: 'Google region (gl)', lblHl: 'Results language (hl)', lblNum: 'Results count (up to 100)',
      advRhythmTitle: '⏱ Human rhythm & captcha', lblJitter: 'Human jitter ± (ms)',
      lblCooldownEvery: 'Long break every N keywords', lblCooldownMs: 'Break duration (ms)',
      lblCapAttempts: 'Max solver attempts', lblCapTimeout: 'Per-attempt timeout (ms)',
      lblForeground: 'Foreground tab while checking', lblReuseTab: 'One permanent tab + type in search box',
      lblPauseCap: 'Pause when captcha fails', lblAutoResume: 'Auto-resume after manual solve',
      lblClearBeforeRun: 'Clear browsing data before each run', lblMapsCheck: 'Check local/map results',
      optBackupTitle: 'Backup', optBackupHint: 'Export everything as JSON or restore from it.',
      btnExportJson: '⬇ Export JSON', btnImportJson: '⬆ Import JSON', btnResetAll: '☢ Full reset',
      optAboutTitle: 'About', aboutVersion: 'Version',
      aboutLi1: 'Everything runs locally in your browser — no server, no external API.',
      aboutLi2: 'Target any region or language via Google parameters (gl/hl), no VPN needed.',
      aboutLi3: 'Captcha solved natively or with your installed Buster.',
      importDone: 'Imported successfully.', importFail: 'Import failed', confirmReset: 'Wipe all data permanently?',
      langBtn: 'ع',
      warnTitle: '⚠️ Important warning',
      warnText: 'This extension deletes ALL browser data (cookies, history and cache) before every checking run. Please use it in a new Guest account without signing in, to keep your accounts and data safe.',
      btnWarnOk: 'I understand',
      tabMain: '🏠 Home', tabGsloc: '📍 Location', tabBeyondten: '💯 Export Results',
      paneGslocDesc: 'Pick a city and language (gl/hl) for Google results — default: Saudi Arabia',
      paneBeyondtenDesc: 'Choose results per page (10 / 20 / 50 / 100)'
    }
  };

  let current = 'ar';

  function t(key) {
    const dict = STR[current] || STR.ar;
    return dict[key] || STR.ar[key] || key;
  }

  function apply(doc) {
    const d = doc || document;
    d.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    d.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      el.placeholder = t(el.getAttribute('data-i18n-ph'));
    });
    const html = d.documentElement;
    if (html) {
      html.lang = current;
      html.dir = current === 'ar' ? 'rtl' : 'ltr';
    }
    const btn = d.getElementById('btnLang');
    if (btn) { btn.textContent = t('langBtn'); }
  }

  function setLang(lang, doc) {
    current = STR[lang] ? lang : 'ar';
    try { if (global.chrome && chrome.storage && chrome.storage.local) { chrome.storage.local.set({ 'srt.lang': current }); } } catch (_) {}
    apply(doc);
    return current;
  }

  function init(doc, cb) {
    try {
      chrome.storage.local.get('srt.lang', (r) => {
        current = (r && r['srt.lang'] && STR[r['srt.lang']]) ? r['srt.lang'] : 'ar';
        apply(doc);
        if (cb) { cb(current); }
      });
    } catch (_) { apply(doc); if (cb) { cb(current); } }
  }

  global.SRT_I18N = { STR: STR, t: t, apply: apply, setLang: setLang, init: init, get lang() { return current; } };
})(globalThis);
