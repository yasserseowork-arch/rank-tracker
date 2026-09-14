import test from 'node:test';
import assert from 'node:assert/strict';
import { matchResults, hostMatches } from '../src/background/core/match.js';

test('الترتيب الرسمي بييجي من رقم Serp Counter المحقون', () => {
  const items = [
    { url: 'https://a.com', host: 'a.com', title: 'A', snippet: '', counterPos: 12 },
    { url: 'https://shop.mystore.sa/x', host: 'shop.mystore.sa', title: 'متجري', snippet: '', counterPos: 14 }
  ];
  const res = matchResults(items, { storeDomain: 'mystore.sa', matchMode: 'domain' });
  assert.equal(res.found, true);
  // المحرك بيستبدل الفهرس برقم العداد في recordResult — هنا نتأكد الوصول للقيمة
  assert.equal(res.matched.counterPos, 14);
});

test('fuzzy: دومين قصير بحرف ناقص بيتطابق (atherion/aetherion)', () => {
  assert.equal(hostMatches('aetherion.com.sa', 'atherion.com.sa'), true);
  assert.equal(hostMatches('aetherion.com.sa', 'athrion.com.sa'), true);
});

test('المطابقة بتشمل نص البلوك الكامل (سطر اسم الموقع)', () => {
  const items = [
    { url: 'https://x.sa', host: 'x.sa', title: 'فستان دانتيل بني ناعم بكسرات', snippet: '', text: 'فساتين البر https://aetherion.com.sa فستان دانتيل بني ناعم بكسرات بأفضل سعر' }
  ];
  const res = matchResults(items, { storeName: 'فساتين البر', matchMode: 'name' });
  assert.equal(res.found, true);
  assert.equal(res.position, 1);
});
