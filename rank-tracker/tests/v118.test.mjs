/**
 * v1.18.0 — انحدارات: دقة AI (توسيع + فك تحويلات + صيغة 1ai/ai)،
 * كابتشا الأولوية للشخص البرتقالي بمحاولتين، وسكون الكونسول.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const queue = read('src/background/core/queue.js');
const serp = read('src/content/serp.js');
const cap = read('src/content/captcha.js');
const orch = read('src/background/core/captcha-orchestrator.js');
const panel = read('src/sidepanel/side-panel.js');
const sw = read('src/background/sw.js');
const st = read('src/background/core/state.js');
const bt = read('beyondten/content/index.js');

/* ---------------- AI ---------------- */

test('AI: عمود الترتيب بيتكتب 1ai وai بس (من غير مسافة)', () => {
  assert.match(queue, /r\.position \+ 'ai'/, 'queue.js مفيش فيه صيغة 1ai');
  assert.ok(!/position \+ ' AI'/.test(queue), 'queue.js لسه بيكتب « AI» القديمة');
  assert.match(panel, /row\.position \+ 'ai'/, 'اللوحة مفيهاش صيغة 1ai');
  assert.ok(!/\+ ' AI'/.test(panel), 'اللوحة لسه بتكتب « AI» القديمة');
});

test('AI: التوسيع بيتم حتى في مسار الخروج المبكر', () => {
  assert.match(serp, /async function finalizeAi/, 'مفيش finalizeAi');
  const earlyAt = serp.indexOf('if (early) {');
  assert.ok(earlyAt > -1, 'مفيش بلوك الخروج المبكر؟');
  assert.match(serp.slice(earlyAt, earlyAt + 500), /await finalizeAi/,
    'الخروج المبكر بيرجع من غير ما يوسّع AI — ده سبب ضياع العَلم');
  assert.match(serp, /const aiF = await finalizeAi\(ai\);/,
    'مسار النزول مبيوسّعش AI قبل الرجوع');
});

test('AI: روابط تحويلات جوجل بتفك ومصادر الـdialog بتلمّ', () => {
  assert.match(serp, /function unwrapRedirect/, 'مفيش فك تحويلات /url?q=');
  assert.match(serp, /jsdialog/, 'مفيش لمّ لقائمة المصادر (dialog)');
  // لازم التوسيع يفتح مرتين (عرض المزيد → عرض الكل) — موجود من v1.16 لكن نؤمّنه
  assert.match(serp, /round < 2/, 'التوسيع مش بيدوس مرتين');
});

/* ---------------- كابتشا ---------------- */

test('كابتشا: حد المحاولات بقى 2 في كل الطبقات', () => {
  assert.match(st, /captchaMaxAttempts:\s*2,/, 'DEFAULT_CONFIG لسه 4');
  assert.match(orch, /cfg\.captchaMaxAttempts \|\| 2/, 'المنسّق لسه بيفترض 4');
  assert.match(cap, /captchaMaxAttempts \|\| 2/, 'الآلة لسه بيفترض 4');
});

test('كابتشا: الشخص البرتقالي أولاً والحل الذاتي احتياطي بس', () => {
  const step = cap.slice(cap.indexOf('async function step'), cap.indexOf('setInterval(() => { step()'));
  const busterAt = step.indexOf("reportAttempt('orange-man')");
  const audioAt = step.indexOf('solveAudioOnce()');
  assert.ok(busterAt > -1, 'step() مفيهوش ضغطة الشخص البرتقالي');
  assert.ok(audioAt > -1, 'خط الحل الذاتي اتلغى بالكل (لازم يفضل احتياطي)');
  assert.ok(busterAt < audioAt, 'الحل الذاتي شغال قبل الشخص البرتقالي — المفروض بالعكس!');
  assert.match(step, /S\.attempts >= max/, 'مفيش إعلان فشل بعد استنفاد المحاولتين');
});

test('كابتشا: ما بيقفش على حاجة — الخطة الاحتياطية دايمًا شغالة', () => {
  assert.match(queue, /allowPause = false/, 'handleCaptcha لسه بيوقف افتراضياً');
  assert.match(queue, /الكابتشا استهلكت محاولاتها[\s\S]{0,140}مسح بيانات/,
    'رسالة الفشل ما بتوضحش إن الخطة الاحتياطية اتنفذّت');
});

/* ---------------- هدوء الكونسول ---------------- */

test('ما فيش console.error في مسارات الكابتشا الاحتياطية', () => {
  assert.ok(!/logger\.error\('captcha'/.test(queue), 'queue.js لسه بيكتب كابوتشا كـ error');
  assert.ok(!/logger\.error\(/.test(orch), 'المنسّق لسه بيكتب error');
});

test('اللوحة: router بيتسجل على مستوى الموديول (ولا سباق keepalive)', () => {
  const top = sw.slice(0, sw.indexOf('async function boot'));
  assert.match(top, /createRouter\(engine\);/, 'createRouter مش في الـ module scope');
  const bootBody = sw.slice(sw.indexOf('async function boot'), sw.indexOf('chrome.runtime.onInstalled'));
  assert.ok(!/createRouter\(engine\);/.test(bootBody),
    'createRouter لسه جووه boot بعد await — اللوحة هتلاقي مفيش مستقبل رسائل');
});

test('BeyondTen: 429 بيرجع بهدوء من غير console.warn', () => {
  assert.match(bt, /\/429\/\.test\(String\(e\)\)/, 'مفيش معالجة 429');
  assert.ok(!/console\.warn\("BeyondTen: Fetch error"/.test(bt), 'لسه بيغسل الكونسول بتحذيرات');
  assert.ok(!/throw new Error\("consent_wall"\)/.test(bt.slice(bt.indexOf('async function fetchBatch'))),
    'رمي استثناء جوه forEach من غير try = unhandled rejection');
});

test('الفوتر: ثابت وظاهر في التابات الثلاثة (بره paneMain)', () => {
  const html = read('src/sidepanel/side-panel.html');
  const css = read('src/sidepanel/side-panel.css');
  const footerAt = html.indexOf('<footer class="app-footer">');
  const mainClose = html.indexOf('<!-- /paneMain -->');
  assert.ok(footerAt > -1, 'مفيش فوتر في اللوحة');
  assert.ok(mainClose > -1 && footerAt > mainClose,
    'الفوتر جوه paneMain — هيخفى مع تبويبات الموقع/النتائج');
  assert.equal((html.match(/<footer class="app-footer">/g) || []).length, 1, 'الفوتر مكرر');
  assert.match(css, /\.app-footer\s*\{[^}]*position:\s*sticky/, 'الفوتر مش مثبّت (sticky)');
  assert.match(css, /\.app-footer\s*\{[^}]*bottom:\s*0/, 'الفوتر مش لازق في آخر الشاشة');
  // اللايقونات الخاصة بأصحاب الأدوات المدمجة ماينفعش ترجع — الفوتر بتاع صاحب الإضافة بس
  assert.ok(!/buster-logo|serp-logo/.test(html), 'ظهر لوجو أداة تانية في اللوحة');
});
