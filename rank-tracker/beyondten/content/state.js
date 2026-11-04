// content/state.js
// Developed by Ayub Ansary - SEO Specialist (https://ayubansary.com)
// Helping businesses grow beyond limitations
window.BT = window.BT || {};
(function(){
  const state = {
    seen: new Set(),
    loadedPages: new Set(),
    aborter: null,
    settings: { target: 100, enabled: true, autoLoad: true, pureMode: false },
    lastHref: location.href,
    concurrency: 2, // v1.2.1: 6 دفعات متزامنة = بصمة بوت تجيب 429 — اتنين بهدوء
    chaser: null,   // v1.2.0: مؤقت الإنهاء التلقائي — مش مستني سكرول بشري
    fetching: false
  };
  window.BT.state = state;
})();