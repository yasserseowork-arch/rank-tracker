import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArabic, normalizeHost, registrable, hostMatches, nameMatches, matchResults } from '../src/background/core/match.js';

test('normalizeArabic: تشكيل وتوحيد أحرف', () => {
  assert.equal(normalizeArabic('متجرُ الفساتينِ'), 'متجر الفساتين');
  assert.equal(normalizeArabic('أبها إقامة'), 'ابها اقامه');
  assert.equal(normalizeArabic('عبايات ٢٠٢٤'), 'عبايات 2024');
});

test('normalizeHost: إزالة www و m و shop', () => {
  assert.equal(normalizeHost('WWW.Example.COM.'), 'example.com');
  assert.equal(normalizeHost('m.example.com'), 'example.com');
  assert.equal(normalizeHost('shop.example.sa'), 'example.sa');
});

test('registrable: اشتقاق النطاق الأساسي', () => {
  assert.equal(registrable('sub.example.com.sa'), 'example.com.sa');
  assert.equal(registrable('example.sa'), 'example.sa');
  assert.equal(registrable('blog.example.com'), 'example.com');
});

test('hostMatches: نطاق فرعي ونطاق أساسي', () => {
  assert.equal(hostMatches('shop.mystore.com.sa', 'mystore.com.sa'), true);
  assert.equal(hostMatches('www.mystore.com.sa', 'mystore.com.sa'), true);
  assert.equal(hostMatches('other.com', 'mystore.com.sa'), false);
});

test('nameMatches: تطبيع عربي وتجاهل كلمة متجر', () => {
  assert.equal(nameMatches('فساتين سهرة من متجر لمسة الرياض', 'متجر لمسة'), true);
  assert.equal(nameMatches('فساتين سهرة من لمسه الرياض', 'متجر لمسة'), true);
  assert.equal(nameMatches('متجر آخر تماماً', 'لمسة'), false);
});

test('matchResults: الترتيب الصحيح بين نتائج SERP', () => {
  const items = [
    { url: 'https://a.com/x', host: 'a.com', title: 'A', snippet: '' },
    { url: 'https://b.com/x', host: 'b.com', title: 'B', snippet: '' },
    { url: 'https://shop.mystore.com.sa/p', host: 'shop.mystore.com.sa', title: 'متجري', snippet: '' },
    { url: 'https://c.com/x', host: 'c.com', title: 'C', snippet: '' }
  ];
  const res = matchResults(items, { storeDomain: 'mystore.com.sa', matchMode: 'domain' });
  assert.equal(res.found, true);
  assert.equal(res.position, 3);
  assert.equal(res.scanned, 4);
});

test('matchResults: غير موجود', () => {
  const items = [{ url: 'https://a.com', host: 'a.com', title: 'A', snippet: '' }];
  const res = matchResults(items, { storeDomain: 'mystore.com.sa', storeName: 'متجري', matchMode: 'both' });
  assert.equal(res.found, false);
  assert.equal(res.position, null);
});

test('matchResults: مطابقة بالاسم داخل الوصف', () => {
  const items = [
    { url: 'https://x.com', host: 'x.com', title: 'دليل المتاجر', snippet: 'تشكيلة واسعة من متجر لمسة الرياض' }
  ];
  const res = matchResults(items, { storeName: 'متجر لمسة', matchMode: 'name' });
  assert.equal(res.found, true);
  assert.equal(res.position, 1);
});

test('hostMatches: تسامح مع حرف متلخبط في الدومين', () => {
  assert.equal(hostMatches('store.berhatyater.org.sa', 'berhatayer.org.sa'), true);
  assert.equal(hostMatches('berhatayer.org.sa', 'berhatyater.org.sa'), true);
});

test('hostMatches: لا تسامح مع اختلاف كبير', () => {
  assert.equal(hostMatches('store.othercharity.org.sa', 'berhatayer.org.sa'), false);
});

test('nameMatches: تداخل كلمات يتسامح مع اختلاف المدينة', () => {
  assert.equal(nameMatches('كيف تكفل يتيماً؟ جمعية البر الخيرية بحائل', 'جمعية البر الخيرية بالبحائط'), true);
});

test('nameMatches: تداخل ضعيف لا يطابق', () => {
  assert.equal(nameMatches('جمعية البر فقط', 'جمعية البر الخيرية بالبحائط'), false);
});

test('hostMatches: دومين مكتوب بدون TLD كامل', () => {
  assert.equal(hostMatches('store.berhatayer.org.sa', 'berhatayer'), true);
  assert.equal(hostMatches('unrelated.org.sa', 'berhatayer'), false);
});
