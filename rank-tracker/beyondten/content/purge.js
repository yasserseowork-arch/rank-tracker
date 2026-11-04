
// content/purge.js (pure mode hides side features only; keeps native results)
// Developed by Ayub Ansary - SEO Specialist (https://ayubansary.com)
// Helping businesses grow beyond limitations
window.BT = window.BT || {};
(function(){
  function purgeNonOrganic(){
    const sel = [
      "#rhs",                              // right rail
      "#topstuff",                         // top features
      ".commercial-unit-desktop-top",      // ads (top)
      ".commercial-unit-desktop-rhs",      // ads (right)
      "g-section-with-header",             // news/videos packs
      "div[data-attrid]",                  // knowledge/AI blocks
      "[role='complementary']"             // extra side regions
    ];
    sel.forEach(q => document.querySelectorAll(q).forEach(el => { el.style.display = "none"; }));
  }
  function watchForRegrowth(){
    const obs = new MutationObserver(() => purgeNonOrganic());
    obs.observe(document.body, {childList:true, subtree:true});
    return obs;
  }
  window.BT.purge = { purgeNonOrganic, watchForRegrowth };
})();
