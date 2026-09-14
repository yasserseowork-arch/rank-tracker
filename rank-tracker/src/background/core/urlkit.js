/**
 * urlkit.js — أدوات روابط داخل الـ Service Worker (نسخة modules نقية)
 */

export function parse(url) {
  try { return new URL(url); } catch (_) { return null; }
}

export function isSorry(url) {
  return String(url || '').indexOf('/sorry/') !== -1;
}

export function isSearch(url) {
  const u = parse(url);
  if (!u) { return false; }
  return u.pathname === '/search' || u.pathname.indexOf('/search') === 0;
}

export function buildSearchUrl(keyword, cfg) {
  const config = cfg || {};
  const u = new URL('https://www.google.com/search');
  u.searchParams.set('q', String(keyword || '').trim());
  u.searchParams.set('gl', config.gl || 'sa');
  u.searchParams.set('hl', config.hl || 'ar');
  u.searchParams.set('num', String(config.num || 100));
  u.searchParams.set('pws', '0');
  u.searchParams.set('ie', 'utf-8');
  return u.toString();
}

export function queryOf(url, name) {
  const u = parse(url);
  if (!u) { return ''; }
  try { return u.searchParams.get(name) || ''; } catch (_) { return ''; }
}
