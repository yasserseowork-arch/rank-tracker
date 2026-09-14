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
      statusIdle: 'خامل', statusRunning: 'جارٍ الفحص…', statusPaused: 'متوقف مؤقتاً', statusCaptcha: 'كابتشا قيد الحل',
      btnStart: '▶ بدء الفحص', btnPause: '⏸ إيقاف مؤقت', btnResume: '⏩ استئناف', btnStop: '⏹ إيقاف', btnShowTab: 'عرض التبويب',
      captchaLiveTitle: 'كابتشا قيد الحل…',
      captchaLiveText: 'بندوس على الشخص البرتقالي (Buster) وهو بيحل؛ لو فشل بندوس ⟳ تحدي جديد والشخص تاني.',
      captchaFailedTitle: 'فشل حل الكابتشا تلقائياً',
      captchaFailedText: 'حلها يدوياً في التبويب وهيستأنف لوحده، أو دوس استئناف لتخطي الكلمة.',
      captchaAttemptsLabel: 'المحاولات:',
      statChecked: 'كلمات فُحصت', statFound: 'ظهور المتجر', statAvg: 'متوسط الترتيب', statCaptcha: 'كابتشا محلولة',
      chartTitle: 'منحنى الترتيب عبر الفحوصات', chartEmpty: 'لا توجد بيانات بعد — ابدأ الفحص لرؤية المنحنى.',
      targetTitle: '🎯 بيانات متجرك', lblDomain: 'دومين المتجر', lblName: 'اسم المتجر', lblMatch: 'نمط المطابقة',
      matchBoth: 'الدومين أو الاسم', matchDomain: 'الدومين فقط', matchName: 'الاسم فقط',
      rhythmTitle: '⏱ المهلة قبل كل كلمة', lblDelay: 'مهلة قبل كل كلمة (ملي ثانية)', rhythmHint: 'باقي إعدادات الإيقاع والكابتشا في الإعدادات المتقدمة.',
      kwTitle: '🔑 الكلمات المفتاحية', kwPlaceholder: 'الصق الكلمات هنا — سطر لكل كلمة',
      btnAddKw: '＋ إضافة الكلمات', btnImportCsv: '📄 استيراد CSV', btnClearKw: '🗑 مسح الكل',
      thKeyword: 'الكلمة', thStatus: 'الحالة', thPosition: 'الترتيب', thUrl: 'الرابط', thTime: 'الوقت',
      resTitle: '📊 تصدير النتائج', btnMakeXlsx: '📊 شيت بالترتيب (XLSX)', btnExportCsv: '⬇ CSV', btnCopyTsv: '📋 نسخ للشيت', btnClearRes: '🗑 مسح',
      logTitle: '🖥 السجل الحي', btnClearLogs: 'مسح السجل',
      footerNote: '© 2026 SEO Kw Tracker. جميع الحقوق محفوظة.',
      footerCopy: '© 2026 SEO Kw Tracker. جميع الحقوق محفوظة.',
      kwEmpty: 'لا توجد كلمات بعد — الصق كلماتك أعلاه.', resEmpty: 'لا نتائج بعد.', notFound: 'غير موجود',
      kwPending: 'بالانتظار', kwRunning: 'جارٍ الفحص', kwDone: 'تم', kwCaptcha: 'كابتشا', kwFailed: 'فشل', kwSkipped: 'تخطٍ',
      btnRemove: 'حذف', confirmClearKw: 'مسح كل الكلمات المفتاحية؟', confirmClearRes: 'مسح كل النتائج؟',
      copyDone: 'تم النسخ — الصقه في عمود الشيت المقابل.',
      errNoTarget: 'حدّد دومين المتجر أو اسمه أولاً.', errNoKeywords: 'أضف كلمات مفتاحية أولاً.',
      errDailyCap: 'بلغت السقف اليومي للفحوصات.',
      sheetCardTitle: '📄 الشيت', lblSheetUrl: 'رابط الشيت (اختياري للكتابة فيه)',
      btnWriteSheet: '📝 اكتب النتائج في الشيت الآن', lblAutoXlsx: 'تنزيل شيت Excel تلقائياً آخر الجولة',
      sheetWriteHint: 'لو الرابط موجود: الترتيب بيتكتب في عمود B تلقائياً آخر الجولة.',
      makeXlsxOk: '✔ اتعمل شيت Excel بالترتيب واتحمّل', sheetWriteOk: '✔ اتكتب الترتيب في الشيت',
      sheetWriteFail: 'تعذرت الكتابة — استخدم زر نسخ للشيت',
      kwAddedOk: '✔ اتضافت/اتجهزت {n} كلمة للفحص', kwAddFail: '✖ فشل إضافة الكلمات', kwNone: 'الصق الكلمات الأول',
      optionsTitle: 'الإعدادات المتقدمة', optionsSubtitle: 'إعدادات إضافية ونسخ احتياطي',
      optReadTitle: 'قراءة SERP', lblSettle: 'زمن استقرار النتائج (ملي ثانية)', lblScrollStep: 'خطوة التمرير (ملي ثانية)',
      lblMaxWait: 'أقصى انتظار للكلمة (ملي ثانية) — بعدها تُعتبر غير موجودة', lblCapGap: 'فاصل محاولات الكابتشا (ملي ثانية)',
      lblBatchSettle: 'ثبات الدفعات = انتهاء التحميل (ملي ثانية)', lblRescan: 'فترة المسح الدوري (ملي ثانية)',
      lblDailyCap: 'سقف الفحوصات اليومي (0 = بدون)', lblVerbose: 'سجلات تفصيلية',
      advTargetTitle: ' الاستهداف', lblGl: 'منطقة جوجل (gl)', lblHl: 'لغة النتائج (hl)', lblNum: 'عدد النتائج (حتى 100)',
      advRhythmTitle: '⏱ الإيقاع البشري والكابتشا', lblJitter: 'تذبذب بشري ± (ملي ثانية)',
      lblCooldownEvery: 'استراحة بعد كل N كلمة', lblCooldownMs: 'مدة الاستراحة (ملي ثانية)',
      lblCapAttempts: 'محاولات الحل القصوى', lblCapTimeout: 'مهلة المحاولة الواحدة (ملي ثانية)',
      lblForeground: 'تبويب أمامي أثناء الفحص', lblReuseTab: 'تبويب واحد دائم + الكلمة من صندوق البحث',
      lblPauseCap: 'إيقاف مؤقت عند فشل الكابتشا', lblAutoResume: 'استئناف تلقائي بعد الحل اليدوي',
      lblClearBeforeRun: 'مسح بيانات التصفح قبل كل جولة', lblMapsCheck: 'فحص النتائج المحلية (خرائط)',
      optBackupTitle: 'نسخ احتياطي', optBackupHint: 'صدّر كل بياناتك كملف JSON أو استعدها منه.',
      btnExportJson: '⬇ تصدير JSON', btnImportJson: '⬆ استيراد JSON', btnResetAll: '☢ تصفير كامل',
      optAboutTitle: 'عن الإضافة', aboutVersion: 'الإصدار',
      aboutLi1: 'كل شيء محلي داخل متصفحك — بدون أي خادم أو API خارجي.',
      aboutLi2: 'استهداف أي منطقة أو لغة عبر معاملات جوجل (gl/hl) بدون VPN.',
      aboutLi3: 'حل الكابتشا ذاتياً أو بالتعاون مع Buster المثبتة لديك.',
      importDone: 'تم الاستيراد بنجاح.', importFail: 'فشل الاستيراد', confirmReset: 'تصفير كل البيانات نهائياً؟',
      langBtn: 'EN',
      warnTitle: '⚠️ تحذير مهم',
      warnText: 'الإضافة دي بتمسح بيانات المتصفح كاملة (كوكيز، تاريخ، وكاش) قبل كل جولة فحص. فرجاء استخدامها في حساب جيست جديد بدون تسجيل الدخول عشان تحمي حساباتك وبياناتك.',
      btnWarnOk: 'فهمت'
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
      resTitle: '📊 Export results', btnMakeXlsx: '📊 Ranks sheet (XLSX)', btnExportCsv: '⬇ CSV', btnCopyTsv: '📋 Copy for sheet', btnClearRes: '🗑 Clear',
      logTitle: '🖥 Live log', btnClearLogs: 'Clear log',
      footerNote: '© 2026 SEO Kw Tracker. All rights reserved.',
      footerCopy: '© 2026 SEO Kw Tracker. All rights reserved.',
      kwEmpty: 'No keywords yet — paste above.', resEmpty: 'No results yet.', notFound: 'Not found',
      kwPending: 'Pending', kwRunning: 'Checking', kwDone: 'Done', kwCaptcha: 'Captcha', kwFailed: 'Failed', kwSkipped: 'Skipped',
      btnRemove: 'Remove', confirmClearKw: 'Clear all keywords?', confirmClearRes: 'Clear all results?',
      copyDone: 'Copied — paste into the matching sheet column.',
      errNoTarget: 'Set the store domain or name first.', errNoKeywords: 'Add keywords first.',
      errDailyCap: 'Daily check cap reached.',
      sheetCardTitle: '📄 Sheet', lblSheetUrl: 'Sheet URL (optional, to write into)',
      btnWriteSheet: '📝 Write results to sheet now', lblAutoXlsx: 'Auto-download Excel ranks sheet on finish',
      sheetWriteHint: 'With a URL set: positions are written into column B automatically at run end.',
      makeXlsxOk: '✔ Excel ranks sheet created & downloaded', sheetWriteOk: '✔ Positions written to sheet',
      sheetWriteFail: 'Write failed — use copy-for-sheet',
      kwAddedOk: '✔ {n} keyword(s) added/queued', kwAddFail: '✖ Failed to add keywords', kwNone: 'Paste keywords first',
      optionsTitle: 'Advanced settings', optionsSubtitle: 'Extra settings & backup',
      optReadTitle: 'SERP reading', lblSettle: 'Results settle time (ms)', lblScrollStep: 'Scroll step (ms)',
      lblMaxWait: 'Max wait per keyword (ms) — then counted as not found', lblCapGap: 'Captcha attempt gap (ms)',
      lblBatchSettle: 'Batch settle = loading finished (ms)', lblRescan: 'Periodic rescan interval (ms)',
      lblDailyCap: 'Daily check cap (0 = unlimited)', lblVerbose: 'Verbose logs',
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
      btnWarnOk: 'I understand'
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
