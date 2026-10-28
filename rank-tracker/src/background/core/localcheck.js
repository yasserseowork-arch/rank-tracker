/**
 * localcheck.js — فحص النتائج المحلية (Google Maps / Local pack)
 * يجلب صفحة tbm=lcl بنفس الجلسة ويبحث عن الموقع داخل بطاقات الأماكن.
 * v1.21.35 (تصفير عيوب): كان بيفتّح DOMParser جوّه الـService Worker — النافذة دي
 * مفيهاش DOMParser أصلًا، فكان كل فحص بيموت في الـcatch بيرجع null في صمت (ميزة ميتة
 * من يومها رغم إن مفتاح mapsCheck متفعّل افتراضيًا). بقى ماسح نصوص نظيف من غير أي DOM:
 * بطاقة مكان = كل ظهور لـ/maps/place/ — الاسم نفسه محشور في الـslug بتاع الرابط،
 * ونلمة النص اللي بعده. والدومين محاذي لعقيدة 1.21.28: gl=sa بيبحث على .com.sa.
 */
import { nameMatches } from './match.js';

function stripTags(s) {
  return String(s)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (m, d) => { try { return String.fromCharCode(Number(d)); } catch (_) { return ' '; } })
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ');
}

export function scanPlaceCards(html, maxCards) {
  const out = [];
  const s = String(html || '');
  const re = /\/maps\/place\//g;
  const cap = maxCards || 60;
  let lastKey = '';
  let hops = 0;
  let m = re.exec(s);
  while (m !== null && out.length < cap && hops++ < 400) {
    const hrefEnd = s.indexOf('"', m.index);
    if (hrefEnd < 0) { break; }
    let slug = s.slice(m.index, hrefEnd);
    try { slug = decodeURIComponent(slug.split('/maps/place/')[1] || ''); } catch (_) { slug = slug.replace(/%/g, ' '); }
    const key = slug.slice(0, 72);
    const bodyStart = s.indexOf('>', hrefEnd) + 1;
    const next = s.indexOf('/maps/place/', hrefEnd + 20);
    const body = s.slice(bodyStart, next > bodyStart + 120 ? next : bodyStart + 2400);
    if (key !== lastKey) { out.push((key.replace(/[\/+@]/g, ' ') + ' ' + stripTags(body)).slice(0, 2600)); lastKey = key; }
    re.lastIndex = hrefEnd;
    m = re.exec(s);
  }
  return out;
}

export async function localCheck(keyword, cfg) {
  try {
    const c = cfg || {};
    const gl = String(c.gl || 'sa').toLowerCase();
    // 🌍 محاذاة الدومين (عقيدة 1.21.28): السعودية على .com.sa — الباك المحلي بيختلف بين الدومينات
    const host = (gl === 'sa') ? (c.googleHost || 'www.google.com.sa') : (c.googleHost || 'www.google.com');
    const u = new URL('https://' + host + '/search');
    u.searchParams.set('q', String(keyword || '').trim());
    u.searchParams.set('tbm', 'lcl');
    u.searchParams.set('hl', c.hl || 'ar');
    u.searchParams.set('gl', gl);
    const resp = await fetch(u.toString(), { credentials: 'include' });
    if (!resp.ok) { return null; }
    const html = await resp.text();
    if (/\/sorry\/|unusual traffic|حركة مرور غير عادية/i.test(html)) { return null; }
    const cards = scanPlaceCards(html);
    const domain = String(c.storeDomain || '').trim().toLowerCase();
    const label = domain ? domain.split('.')[0] : '';
    // الدومين أولاً (1.19.7): مضبوط؟ كروت الخرائط بتحكم بالدومين بس زي الطبقات التانية
    const nameAllowed = String(c.matchMode || 'both') === 'name' || (String(c.matchMode || 'both') === 'both' && !domain);
    for (let i = 0; i < cards.length; i++) {
      const text = cards[i];
      if (nameAllowed) { for (const nm of [c.storeName, c.storeNameEn].filter((x) => x && String(x).trim())) {
        if (nameMatches(text, nm)) { return { found: true, position: i + 1 }; }
      } }
      if (label && label.length >= 5 && text.toLowerCase().includes(label)) { return { found: true, position: i + 1 }; }
    }
    return { found: false, position: null };
  } catch (_) {
    return null;
  }
}
