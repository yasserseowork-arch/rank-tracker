/**
 * matchlib.js — نسخة Classic من منطق المطابقة (تُحقن في صفحة SERP)
 * تسمح لـ serp.js بعمل "بحث Ctrl+F" ذكي داخل الصفحة والخروج المبكر
 * أول ما يظهر المتجر، بدون انتظار تحميل كل الدفعات.
 * (المنطق نفسه موجود كـ module في background/core/match.js ومُختبر هناك)
 */
(function (global) {
  'use strict';

  function normalizeArabic(text) {
    let s = String(text == null ? '' : text);
    s = s.replace(/[\u064B-\u0652\u0670\u0640]/g, '');
    s = s.replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627');
    s = s.replace(/\u0649/g, '\u064A');
    s = s.replace(/\u0629/g, '\u0647');
    s = s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
    s = s.toLowerCase();
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  function normalizeHost(host) {
    let h = String(host || '').trim().toLowerCase().replace(/\.$/, '');
    const prefixes = ['www.', 'm.', 'mobile.', 'shop.', 'store.'];
    for (const p of prefixes) {
      if (h.indexOf(p) === 0) { h = h.slice(p.length); break; }
    }
    return h;
  }

  function registrable(host) {
    const clean = normalizeHost(host);
    const parts = clean.split('.');
    if (parts.length <= 2) { return clean; }
    const secondLevel = ['com', 'net', 'org', 'edu', 'gov', 'co', 'sch', 'ac'];
    const cut = secondLevel.indexOf(parts[parts.length - 2]) !== -1 ? 3 : 2;
    return parts.slice(-cut).join('.');
  }

  function hostMatches(urlHost, targetDomain) {
    const target = normalizeHost(targetDomain);
    const host = normalizeHost(urlHost);
    if (!target || !host) { return false; }
    if (!target.includes('.')) {
      const label = registrable(host).split('.')[0] || '';
      return label === target || (label.length >= 6 && editDistance(label, target) <= 2);
    }
    if (host === target || host.endsWith('.' + target)) { return true; }
    if (registrable(host) === registrable(target)) { return true; }
    const a = registrable(host).split('.')[0] || '';
    const b = registrable(target).split('.')[0] || '';
    return a.length >= 6 && b.length >= 6 && editDistance(a, b) <= 2;
  }

  /** مسافة Damerau-Levenshtein محدودة */
  function editDistance(a, b) {
    if (a === b) { return 0; }
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > 2) { return 99; }
    const d = Array.from({ length: la + 1 }, () => new Array(lb + 1).fill(0));
    for (let i = 0; i <= la; i++) { d[i][0] = i; }
    for (let j = 0; j <= lb; j++) { d[0][j] = j; }
    for (let i = 1; i <= la; i++) {
      for (let j = 1; j <= lb; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[la][lb];
  }

  function nameTokenOverlap(haystack, storeName) {
    const nameTokens = normalizeArabic(storeName).split(' ').filter((t) => t.length >= 3);
    if (nameTokens.length < 3) { return 0; }
    const hayTokens = new Set(normalizeArabic(haystack).split(' '));
    let hit = 0;
    for (const t of nameTokens) { if (hayTokens.has(t)) { hit++; } }
    return hit / nameTokens.length;
  }

  function nameMatches(haystack, storeName) {
    const needle = normalizeArabic(storeName);
    if (!needle || needle.length < 2) { return false; }
    const hay = normalizeArabic(haystack);
    if (!hay) { return false; }
    if (hay.indexOf(needle) !== -1) { return true; }
    const relaxed = needle
      .replace(/(?:^|\s)(متجر|محل)(?=\s|$)/g, ' ')
      .replace(/\b(store|shop)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (relaxed.length > 2 && hay.indexOf(relaxed) !== -1) { return true; }
    return nameTokenOverlap(haystack, storeName) >= 0.6;
  }

  /** مطابقة سريعة تستخدمها صفحة SERP للخروج المبكر ورصد AI Overview */
  function matchItems(items, cfg) {
    const config = cfg || {};
    const mode = config.matchMode || 'both';
    const hasDomain = !!String(config.storeDomain || '').trim();
    const hasName = !!String(config.storeName || '').trim();
    const list = Array.isArray(items) ? items : [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (hasDomain && (mode === 'domain' || mode === 'both')) {
        if (hostMatches(item.host || '', config.storeDomain)) { return { found: true, position: i + 1, matched: item }; }
      }
      if (hasName && (mode === 'name' || mode === 'both')) {
        const text = (item.title || '') + ' ' + (item.snippet || '') + ' ' + (item.url || '') + ' ' + (item.text || '');
        if (nameMatches(text, config.storeName)) { return { found: true, position: i + 1, matched: item }; }
      }
    }
    return { found: false, position: null, matched: null };
  }

  global.SRT = Object.assign(global.SRT || {}, {
    match: { normalizeArabic, normalizeHost, hostMatches, nameMatches, matchItems }
  });
})(globalThis);
