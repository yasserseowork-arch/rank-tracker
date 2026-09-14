/**
 * consent.js — تجاوز صفحة الموافقة (consent.google.com) تلقائياً
 * يظهر أحياناً حسب الدولة/الشبكة؛ نضغط "قبول الكل" لنكمل رحلة البحث.
 */
(function () {
  'use strict';
  const C = globalThis.SRT_C;
  const D = globalThis.SRT;
  if (!C || !D) { return; }
  if (location.hostname.indexOf('consent.google.com') === -1) { return; }

  async function tryAccept() {
    let btn = D.first(C.SEL.consent);
    if (!btn) {
      for (const text of C.SEL.consentTexts) {
        btn = D.byText('button, [role="button"]', text);
        if (btn) { break; }
      }
    }
    if (btn) {
      D.click(btn, 'consent-accept');
      return true;
    }
    return false;
  }

  (async function () {
    for (let i = 0; i < 6; i++) {
      const ok = await tryAccept();
      if (ok) { break; }
      await D.sleep(800);
    }
  })();
})();
