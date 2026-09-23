/**
 * match.js — منطق مطابقة الموقع (دومين/اسم عربي/اسم إنجليزي) داخل نتائج SERP (دوال نقية)
 *
 * أنماط المطابقة:
 *  - domain: مطابقة المضيف (مع تجاهل www واشتقاق النطاق الأصلي)
 *  - name:   مطابقة اسم الموقع (عربي أو إنجليزي) داخل العنوان/الوصف بعد التطبيع
 *  - both:   أيٌّ منهما
 */

/** تطبيع عربي: إزالة التشكيل والتطريز وتوحيد الألف والياء والتاء المربوطة */
export function normalizeArabic(text) {
  let s = String(text == null ? '' : text);
  s = s.replace(/[\u064B-\u0652\u0670\u0640]/g, '');   // تشكيل وتطريز
  s = s.replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627'); // آ أ إ ٱ → ا
  s = s.replace(/\u0649/g, '\u064A');                    // ى → ي
  s = s.replace(/\u0629/g, '\u0647');                    // ة → ه
  s = s.replace(/\u0660-\u0669/g, (m) => m);             // placeholder no-op
  s = s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)); // أرقام هندية → عربية
  s = s.toLowerCase();
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function normalizeHost(host) {
  let h = String(host || '').trim().toLowerCase().replace(/\.$/, '');
  if (h.indexOf('www.') === 0) { h = h.slice(4); }
  if (h.indexOf('m.') === 0) { h = h.slice(2); }
  if (h.indexOf('mobile.') === 0) { h = h.slice(7); }
  if (h.indexOf('shop.') === 0) { h = h.slice(5); }
  if (h.indexOf('store.') === 0) { h = h.slice(6); }
  return h;
}

/** استخراج النطاق القابل للتسجيل تقريبياً (آخر جزأين) */
export function registrable(host) {
  const clean = normalizeHost(host);
  const parts = clean.split('.');
  if (parts.length <= 2) { return clean; }
  const secondLevel = new Set(['com', 'net', 'org', 'edu', 'gov', 'co', 'sch', 'ac']);
  const cut = secondLevel.has(parts[parts.length - 2]) ? 3 : 2;
  return parts.slice(-cut).join('.');
}

/** مسافة Damerau-Levenshtein محدودة (للتسامح مع حرف متلخبط في الدومين) */
export function editDistance(a, b) {
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

/** الجزء الثاني من النطاق (label الرئيسي) */
export function domainLabel(host) {
  return registrable(host).split('.')[0] || '';
}

export function hostMatches(urlHost, targetDomain) {
  const target = normalizeHost(targetDomain);
  if (!target) { return false; }
  const host = normalizeHost(urlHost);
  if (!host) { return false; }
  // المستخدم يكتب الدومين بدون https وأحياناً بدون TLD كامل: نتسامح
  if (!target.includes('.')) {
    const label = domainLabel(host);
    return label === target || (label.length >= 6 && editDistance(label, target) <= 2);
  }
  if (host === target) { return true; }
  if (host.endsWith('.' + target)) { return true; }
  if (registrable(host) === registrable(target)) { return true; }
  // تسامح مع لخبطة حرف/حرفين في الدومين المكتوب بالإعدادات
  const a = domainLabel(host);
  const b = domainLabel(target);
  if (a.length >= 6 && b.length >= 6 && editDistance(a, b) <= 2) { return true; }
  return false;
}

/** تداخل كلمات الاسم (يتسامح مع اختلاف كلمة مدينة/فرع) */
export function nameTokenOverlap(haystack, storeName) {
  const nameTokens = normalizeArabic(storeName).split(' ').filter((t) => t.length >= 3);
  if (nameTokens.length < 3) { return 0; }
  const hayTokens = new Set(normalizeArabic(haystack).split(' '));
  let hit = 0;
  for (const t of nameTokens) { if (hayTokens.has(t)) { hit++; } }
  return hit / nameTokens.length;
}

export function nameMatches(haystack, storeName) {
  const needle = normalizeArabic(storeName);
  if (!needle || needle.length < 2) { return false; }
  const hay = normalizeArabic(haystack);
  if (!hay) { return false; }
  if (hay.includes(needle)) { return true; }
  // مطابقة مرنة: حذف كلمات "متجر/محل/store/shop" المستقلة من الاسم عند المقارنة
  // (لا نستخدم \b مع العربية لأن محركات JS تعاملها كحدود غير كلمات)
  const relaxed = needle
    .replace(/(?:^|\s)(متجر|محل)(?=\s|$)/g, ' ')
    .replace(/\b(store|shop)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (relaxed && relaxed.length > 2 && hay.includes(relaxed)) { return true; }
  // تداخل ≥ 60% من كلمات الاسم (يتسامح مع اختلاف مدينة/فرع)
  if (nameTokenOverlap(haystack, storeName) >= 0.6) { return true; }
  return false;
}

/**
 * مطابقة قائمة نتائج SERP ضد إعدادات الموقع.
 * @param {Array<{url:string,host:string,title:string,snippet:string}>} items
 * @param {object} cfg {storeDomain, storeName, matchMode}
 * @returns {{found:boolean, position:number|null, matched:object|null, scanned:number, reasons:Array}}
 */
export function storeNames(cfg) {
  const c = cfg || {};
  return [c.storeName, c.storeNameEn]
    .map((s) => String(s == null ? '' : s).trim())
    .filter(Boolean)
    .filter((s, i, arr) => arr.indexOf(s) === i);
}

export function matchResults(items, cfg) {
  const config = cfg || {};
  const mode = config.matchMode || 'both';
  const hasDomain = !!String(config.storeDomain || '').trim();
  const names = storeNames(config);
  // سياسة 1.19.7 — الدومين أولاً: الدومين مضبوط؟ الحكم بالدومين بس في both/named-mix،
  // والاسم يفضل احتياطي لوضع name أو لما الدومين مش محدد (علاج sites بنفس الاسم)
  const nameAllowed = mode === 'name' || (mode === 'both' && !hasDomain);
  const list = Array.isArray(items) ? items : [];

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const reasons = [];
    let hit = false;
    if (hasDomain && (mode === 'domain' || mode === 'both')) {
      if (hostMatches(item.host || '', config.storeDomain)) { hit = true; reasons.push('domain'); }
    }
    if (!hit && nameAllowed && names.length) {
      const text = (item.title || '') + ' ' + (item.snippet || '') + ' ' + (item.url || '') + ' ' + (item.text || '');
      for (const nm of names) {
        if (nameMatches(text, nm)) { hit = true; reasons.push('name'); break; }
      }
    }
    if (hit) {
      return { found: true, position: i + 1, matched: item, scanned: list.length, reasons };
    }
  }
  return { found: false, position: null, matched: null, scanned: list.length, reasons: [] };
}
