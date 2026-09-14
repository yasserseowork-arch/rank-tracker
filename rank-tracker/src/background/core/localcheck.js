/**
 * localcheck.js — فحص النتائج المحلية (Google Maps / Local pack)
 * يجلب صفحة tbm=lcl بنفس الجلسة ويبحث عن المتجر داخل بطاقات الأماكن.
 */
import { nameMatches } from './match.js';

export async function localCheck(keyword, cfg) {
  try {
    const u = new URL('https://www.google.com/search');
    u.searchParams.set('q', String(keyword || '').trim());
    u.searchParams.set('tbm', 'lcl');
    u.searchParams.set('hl', cfg.hl || 'ar');
    u.searchParams.set('gl', cfg.gl || 'sa');
    const resp = await fetch(u.toString(), { credentials: 'include' });
    if (!resp.ok) { return null; }
    const html = await resp.text();
    if (/\/sorry\/|unusual traffic|حركة مرور غير عادية/i.test(html)) { return null; }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    let cards = Array.from(doc.querySelectorAll('.VkpGBb, [data-rc="lc"], div[jscontroller][data-vid]'));
    if (!cards.length) { cards = Array.from(doc.querySelectorAll('a[href*="/maps/place/"]')); }
    const domain = String(cfg.storeDomain || '').trim().toLowerCase();
    const label = domain ? domain.split('.')[0] : '';
    for (let i = 0; i < cards.length; i++) {
      const text = cards[i].textContent || '';
      if (cfg.storeName && nameMatches(text, cfg.storeName)) { return { found: true, position: i + 1 }; }
      if (label && label.length >= 5 && text.toLowerCase().includes(label)) { return { found: true, position: i + 1 }; }
    }
    return { found: false, position: null };
  } catch (_) {
    return null;
  }
}
