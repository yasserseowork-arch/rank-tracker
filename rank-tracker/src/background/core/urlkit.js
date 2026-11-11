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
  // 🌐 v1.21.41 (قرار المستخدم بعد مقارنة الصورتين): التحقق الإيدي بيتم على
  // www.google.com العادي من غير gl/hl — فبقى ده الافتراضي (فاضي = إعداد جوجل
  // نفسه، بالضبط زي بحثك). doctrine 1.21.28 لسه شغالة للي يثبت gl=sa بنفسه:
  // ساعتها الدومين بيتطابق لوحده على google.com.sa، والاختيار اليدوي googleHost
  // بياخد الأولوية فوق كل ده.
  const gl = String(config.gl || '').trim().toLowerCase();
  const hl = String(config.hl || '').trim().toLowerCase();
  const host = config.googleHost || (gl === 'sa' ? 'www.google.com.sa' : 'www.google.com');
  const u = new URL('https://' + host + '/search');
  u.searchParams.set('q', String(keyword || '').trim());
  if (gl) { u.searchParams.set('gl', gl); }
  if (hl) { u.searchParams.set('hl', hl); }
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
