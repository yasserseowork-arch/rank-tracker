/**
 * url.js — أدوات الروابط (Classic script)
 * بناء رابط بحث جوجل مع استهداف جغرافي (gl/hl) وقراءة معاملات الصفحة.
 */
(function (global) {
  'use strict';

  function parse(url) {
    try { return new URL(url); } catch (_) { return null; }
  }

  function query(name, url) {
    const u = parse(url || global.location.href);
    if (!u) { return ''; }
    try { return u.searchParams.get(name) || ''; } catch (_) { return ''; }
  }

  function hostOf(url) {
    const u = parse(url);
    return u ? u.hostname.toLowerCase() : '';
  }

  /** تنظيف المضيف: بدون www وبدون نقطة نهائية */
  function normalizeHost(host) {
    let h = String(host || '').trim().toLowerCase();
    h = h.replace(/\.$/, '');
    if (h.indexOf('www.') === 0) { h = h.slice(4); }
    return h;
  }

  function isSearch(url) {
    const u = parse(url);
    if (!u) { return false; }
    return /(^|\/)search$/.test(u.pathname) || u.pathname.indexOf('/search') === 0;
  }

  function isSorry(url) {
    return String(url || '').indexOf('/sorry/') !== -1;
  }

  function isRecaptchaFrame(url) {
    return String(url || '').indexOf('/recaptcha/') !== -1;
  }

  /**
   * بناء رابط SERP كامل.
   * num=100 لعرض حتى 100 نتيجة في صفحة واحدة، وpws=0 لتعطيل التخصيص الشخصي.
   */
  function buildSearchUrl(keyword, cfg) {
    const config = cfg || {};
    const u = new URL('https://www.google.com/search');
    u.searchParams.set('q', String(keyword || '').trim());
    if (config.gl) { u.searchParams.set('gl', config.gl); }
    if (config.hl) { u.searchParams.set('hl', config.hl); }
    u.searchParams.set('num', String(config.num || 100));
    u.searchParams.set('pws', '0');
    u.searchParams.set('ie', 'utf-8');
    return u.toString();
  }

  /** استخراج معرف شيت جوجل من أي صيغة رابط */
  function sheetId(url) {
    const m = String(url || '').match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : '';
  }

  function sheetGid(url) {
    const m = String(url || '').match(/[?#&]gid=(\d+)/);
    return m ? m[1] : '';
  }

  /** رابط تصدير CSV بدون API رسمي (يعمل للشيتات العامة/المشاركة برابط) */
  function sheetCsvUrl(url) {
    const id = sheetId(url);
    if (!id) { return ''; }
    const gid = sheetGid(url);
    return 'https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=out:csv' + (gid ? '&gid=' + gid : '');
  }

  global.SRT = Object.assign(global.SRT || {}, {
    url: { parse, query, hostOf, normalizeHost, isSearch, isSorry, isRecaptchaFrame, buildSearchUrl, sheetId, sheetGid, sheetCsvUrl }
  });
})(globalThis);
