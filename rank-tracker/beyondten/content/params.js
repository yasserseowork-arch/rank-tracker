
// content/params.js
// Developed by Ayub Ansary - SEO Specialist (https://ayubansary.com)
// Helping businesses grow beyond limitations
window.BT = window.BT || {};

(function () {
  const KEEP = new Set(["q", "tbm", "tbs", "udm", "hl", "gl", "safe", "pws", "lr", "cr"]);
  function getContext() {
    try {
      const url = new URL(location.href);
      if (!/(^|\.)google\.[a-z.]+$/i.test(url.hostname) || !url.pathname.startsWith("/search")) return null;
      const raw = new URLSearchParams(url.search);
      const base = new URLSearchParams();
      for (const [k, v] of raw.entries()) if (KEEP.has(k)) base.set(k, v);

      return { url, raw, params: base };
    } catch (e) { return null; }
  }

  function startOffset() {
    const sp = new URLSearchParams(location.search);
    const start = Number(sp.get("start") || "0");
    return isNaN(start) ? 0 : start;
  }
  function currentPageIndex() {
    const sp = new URLSearchParams(location.search);
    const start = Number(sp.get("start") || "0");
    const size = 10;
    return Math.floor(start / size);
  }
  function makePageURL(ctx, pageIndex) {
    const p = new URLSearchParams(ctx.params);
    p.set("start", String(pageIndex * 10));
    return `${ctx.url.origin}/search?${p.toString()}`;
  }
  window.BT.params = { getContext, currentPageIndex, startOffset, makePageURL };
})();
