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
    concurrency: 6,
    chaser: null,   // v1.2.0: auto-finish timer — doesn't wait for a human scroll
    fetching: false
  };
  window.BT.state = state;
})();