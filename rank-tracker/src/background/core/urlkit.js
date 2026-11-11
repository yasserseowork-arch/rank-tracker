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
  // 🪞 v1.21.47 — «قاعدة الـA/B» (سكرينشوتات المستخدم #20/#21 لنفس الكلمة، إيدي
  // مقابل الأداة): البحث الإيدي بيطلع من غير gl ولا hl خالص — أي تثبيت صريح
  // لـsa/ar (زي ما عملنا في .44) بيقَلِب الفهرس لنتايج مختلفة. القاعدة بقت:
  // طلب الأداة = طلب المستخدم بايت-ببايت؛ المنطقة واللغة بيجوا من نفس المتصفح:
  // IP + كوكيز + هيدرز GsLoc (اللي اتصلّح في .43 وبقت شغالة) — زي تاب الإيدي
  // بالظبط. شهادة «1.20.0 كانت مظبوطة» صحيحة بس هي من قبل إصلاح GsLoc، والدومين
  // الثابت .com فضل منها. اللي عايز يثبّت gl/hl أو .sa بنفسه: الإعدادات صراحةً.
  const gl = String(config.gl || '').trim().toLowerCase();
  const hl = String(config.hl || '').trim().toLowerCase();
  const host = config.googleHost || 'www.google.com';
  const u = new URL('https://' + host + '/search');
  u.searchParams.set('q', String(keyword || '').trim());
  if (gl) { u.searchParams.set('gl', gl); }
  if (hl) { u.searchParams.set('hl', hl); }
  // 🚫 v1.21.33 (طلب المستخدم: «مليش دعوه إنك بتعمل كده num=100»): مفيش num=100 ولا
  // pws=0 في الرابط — دول بصمة بوت بتستدعي الكابتشا عند جوجل. التوسيع لـ100 بياوله
  // «Show 100 Results» المدمج (beyondten/content) — وكل حاجة بحركة طبيعية.
  // 🪞 1.21.47: حتى ie=utf-8 اتشال — مش موجود في لينك الإيدي، والحرفية مطلوبة
  return u.toString();
}

export function queryOf(url, name) {
  const u = parse(url);
  if (!u) { return ''; }
  try { return u.searchParams.get(name) || ''; } catch (_) { return ''; }
}
