/**
 * errorsig.js — بصمات صفحات الخطأ لدى جوجل (دوال نقية قابلة للاختبار)
 * تُستخدم من serp.js لتقرير: ريفرش تلقائي؟ إعلان كابتشا؟ استمرار القراءة؟
 */
(function (global) {
  'use strict';

  /**
   * @param {string} title عنوان الصفحة
   * @param {string} bodyText عينة نص الجسم
   * @returns {'http-error'|'network'|'google-error'|'captcha-text'|null}
   */
  function detectError(title, bodyText) {
    const t = String(title || '').toLowerCase();
    const b = String(bodyText || '').toLowerCase();

    if (/error\s*(40[134]|429|50[0-4])/.test(t) || /خطأ\s*(40[134]|429|50[0-4])/.test(t)) {
      return 'http-error';
    }
    if (b.includes("can't reach") || b.includes('cannot reach') || b.includes('connection was reset')
      || b.includes('لم نتمكن من الوصول') || b.includes('لا يمكن الوصول') || b.includes('تحقق من اتصالك')) {
      return 'network';
    }
    if (b.includes('having trouble accessing google search') || b.includes('please retry')
      || b.includes('retry later') || b.includes('try again later')
      || b.includes('حاول مرة أخرى') || b.includes('إذا كنت تواجه مشكلة في الوصول')
      || b.includes('يواجه google مشكلة') || b.includes('seems like there is a problem')) {
      return 'google-error';
    }
    if (b.includes('unusual traffic') || b.includes('حركة مرور غير عادية')
      || b.includes('abnormal traffic') || b.includes('automated queries')) {
      return 'captcha-text';
    }
    return null;
  }

  global.SRT = Object.assign(global.SRT || {}, { errorsig: { detectError } });
})(globalThis);
