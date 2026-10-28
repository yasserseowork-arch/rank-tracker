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
  const gl = String(config.gl || 'sa').toLowerCase();
  // 🌍 v1.21.28 (طلب المستخدم: «حاسس إنه بيستهدف منطقة تانية»): بحث بـgl=sa على
  // www.google.com بيدي سيرب «دولي بالمقاطعة» — قريب من سيرب google.com.sa بس مش هو:
  // البلوك المحلي والترتيب بيتفارقوا، فالتحقق اليدوي للمستخدم بيبان مختلف. نطابق الدومين
  // مع المنطقة — بس في حدود اللي السكربتات محقونة فيه فعلًا (com.sa و .sa)؛ أي منطقة
  // تانية تفضل على google.com عشان الحقن ما يقعش. cfg.googleHost override يدوي للأذكياء.
  const host = (gl === 'sa') ? (config.googleHost || 'www.google.com.sa') : (config.googleHost || 'www.google.com');
  const u = new URL('https://' + host + '/search');
  u.searchParams.set('q', String(keyword || '').trim());
  u.searchParams.set('gl', gl);
  u.searchParams.set('hl', config.hl || 'ar');
  // 🚫 v1.21.33 (طلب المستخدم: «مليش دعوه إنك بتعمل كده num=100»): مفيش num=100 ولا
  // pws=0 في الرابط — دول بصمة بوت بتستدعي الكابتشا عند جوجل. التوسيع لـ100 بياوله
  // «Show 100 Results» المدمج (beyondten/content) — وكل حاجة بحركة طبيعية.
  u.searchParams.set('ie', 'utf-8');
  return u.toString();
}

export function queryOf(url, name) {
  const u = parse(url);
  if (!u) { return ''; }
  try { return u.searchParams.get(name) || ''; } catch (_) { return ''; }
}
