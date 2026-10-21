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

test('v1.21.17 صرامة الملكية: حرف ناقص = دومين تاني — مفيش نسب غلط', () => {
  // الغلط الإملائي في الإعدادات يصلّحه المستخدم؛ نسب متجر شبيه لموقعنا ممنوع
  assert.equal(hostMatches('aetherion.com.sa', 'atherion.com.sa'), false);
  assert.equal(hostMatches('atherion.com.sa', 'aetherion.com.sa'), false);
  // أما سوبدومين ملكنا الحقيقي فمقبول طبعًا
  assert.equal(hostMatches('www.atherion.com.sa', 'atherion.com.sa'), true);
  assert.equal(hostMatches('shop.atherion.com.sa', 'atherion.com.sa'), true);
});

test('المطابقة بتشمل نص البلوك الكامل (سطر اسم الموقع)', () => {
  const items = [
    { url: 'https://x.sa', host: 'x.sa', title: 'فستان دانتيل بني ناعم بكسرات', snippet: '', text: 'فساتين البر https://aetherion.com.sa فستان دانتيل بني ناعم بكسرات بأفضل سعر' }
  ];
  const res = matchResults(items, { storeName: 'فساتين البر', matchMode: 'name' });
  assert.equal(res.found, true);
  assert.equal(res.position, 1);
});
