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

test('AI v1.18.2: كشف متعدد الطبقات + انتظار الترطيب (async) بدون تعليم الكلمات', () => {
  const serp = read('src/content/serp.js');
  const consts = read('src/lib/constants.js');
  // 1) عناوين عربية/إنجليزية متعددة (مش نص واحد قديم)
  assert.match(serp, /نبذة الذكاء الاصطناعي/, 'مفيش عنوان «نبذة الذكاء الاصطناعي»');
  assert.match(serp, /لمحة الذكاء الاصطناعي/, 'مفيش عنوان «لمحة»');
  assert.match(serp, /AI Overview/, 'مفيش عنوان إنجليزي');
  // 2) محددات الكلاسات الحديثة
  assert.match(consts, /\.w34xwb|\.YhCVmd/, 'مفيش محددات بلوكات AI الحديثة في constants');
  // 3) انتظار ظهور البلوك لو لسه بيترسوم، لكن بشرط بوادر — من غير تأخير على الصفحات اللي مفيهاش AI
  assert.match(serp, /async function waitForAiRoot/, 'مفيش انتظار للبلوك');
  assert.match(serp, /function aiHint/, 'مفيش بوابة بوادر (هتعلّش كل كلمة بـ5 ثواني)');
  assert.match(serp, /if \(!immediate && !aiHint\(\)\) \{ return null; \}/, 'البوابة مش بترجع فورًا لو مفيش بوادر');
  // 4) الحرس القديم لسه شغال: جذر بيحتوي العضويات مرفوض
  assert.match(serp, /'#rso, #res, #center_col, #search'/, 'حرس التلوث العضوي اتشال');
  // 5) كاش سلبي عشان الماسح مايلخبطش الأداء
  assert.match(serp, /aiMissTs/, 'مفيش كاش سلبي للماسح');
  // 6) زرار التوسيع بيطابق aria-label وكمان النص
  assert.match(serp, /aria-label/, 'التوسيع بيقرأ النص بس');
});

/* ---------------- v1.18.3 ---------------- */

test('كابتشا v1.18.3: رتم صبر حقيقي — رسم قبل فعل، ونافذة Buster الواسعة، والضغطة البشرية', () => {
  assert.match(cap, /challengeSince/, 'مفيش انتظار رسم لإطار التحدي');
  assert.match(cap, /Date\.now\(\) - S\.challengeSince < 3500/, 'ما فيش 3.5 ثانية settle قبل أي ضغطة');
  assert.match(cap, /75000/, 'نافذة صبر Buster لسه 50 ثانية — محتاجة 75 (النافذة الصغيرة بتكبر على مهل)');
  assert.match(cap, /er\.width < 14 \|\| er\.height < 14/, 'مفيش حرس حجم الزر قبل الضغط');
  assert.match(queue, /'mouseMoved'/, 'الضغطة الحقيقية بتحصل من غير حركة ماوس أولًا — مش بشرية');
  assert.match(orch, /await sleep\(2500, signal\)/, 'المنسّق بيغزر على الصفحة — لازم نفس 2.5 ثانية أولًا');
  assert.match(orch, /waitChallenge\(tabId, 20000\)/, 'بوابة ظهور التحدي لسه 12 ثانية — بطأها');
});

test('كابتشا v1.18.3: حلّ؟ مفيش مسح مستعجل — نتحرى عن النتائج بهدوء الأول', () => {
  assert.match(queue, /collectAfterSolve/, 'مفيش مرحلة تهدئة بعد الحل');
  assert.match(queue, /this\.lastSerp = this\.lastSerp \|\| new Map\(\)/, 'مفيش كاش لآخر تحليل (سباق الفقد)');
  assert.match(queue, /await sleep\(6000, signal\)/, 'مفيش راحة 6 ثواني قبل قراءة آخر تحليل');
  assert.match(queue, /collectAfterSolve\(tab\.id, solveStartedAt, signal\)/, 'مسار الحل الأساسي مش بيستخدم التهدئة');
  assert.match(queue, /collectAfterSolve\(tab\.id, solveStartedAt2, signal\)/, 'مسار التاب الجديد مش بيستخدم التهدئة');
});

test('الإعدادات v1.18.3: المحاولتين إجباريًا + المسح بقى كل 8 مع الاستراحة', () => {
  assert.match(st, /clearEveryN:\s*8,/, 'ديفولت المسح لسه 10');
  assert.match(st, /export const SCHEMA_VERSION = 4;/, 'مفيش نسخة ميجريشن جديدة');
  assert.match(st, /att > 2\) \{ patchCfg\.captchaMaxAttempts = 2; \}/, 'مفيش إجبار المحاولتين على الإعدادات القديمة');
  assert.match(st, /cn === 10\) \{ patchCfg\.clearEveryN = 8; \}/, 'المسح القديم (10) مش بيتحوّل للـ8');
});

test('اللوحة v1.18.3: عدّاد كلمات حقيقي + اشعار الـ0 اتشال + تبويب تصدير النتائج', () => {
  const html = read('src/sidepanel/side-panel.html');
  const i18n = read('src/lib/i18n-ui.js');
  assert.match(html, /id="kwCount"/, 'مفيش عدّاد فوق جزء الكلمات');
  assert.match(panel, /cntEl\.textContent = String\(list\.length\)/, 'العدّاد مش بيتحدث من القائمة نفسها');
  assert.ok(!/alert\(t\('kwAddedOk'\)/.test(panel), 'اشعار الإضافة الغلط لسه راجع');
  assert.match(html, /id="restStrip"/, 'مفيش شريط الاستراحة فوق المنحنى');
  assert.match(panel, /renderRestStrip/, 'الشريط مش بيتحدث مع الـsnapshot');
  assert.match(i18n, /tabBeyondten: '💯 تصدير النتائج'/, 'عنوان التبويب ما اتغيرش');
  assert.match(html, /💯 تصدير النتائج/, 'الـhtml لسه بالعنوان القديم');
});

/* ---------------- v1.18.4 ---------------- */

const urlkit = read('src/background/core/urlkit.js');

test('ضد الدوامة v1.18.4: تبريد إلزامي قبل إعادة الكابتشا — ومفيش لمس لبيانات غير بعد راحة', () => {
  assert.match(queue, /const restSec = 45 \+ captchaClears \* 45;/, 'مفيش تبريد متصاعد قبل الإعادة');
  assert.match(queue, /await sleep\(restSec \* 1000, signal\)/, 'التبريد مش بيتنفذ بsleep قابل للإلغاء');
  // الترتيب الجديد: فتح الجديد ← قفل القديم ← sweep ← المسح
  const fb = queue.slice(queue.indexOf('const restSec'), queue.indexOf('navigatedViaBox = false;\n        continue;'));
  assert.ok(fb.indexOf('nextTab = await tabctl.open') < fb.indexOf('tabctl.close(tab.id)'), 'لازم الجديد يفتح قبل ما القديم يتقفل');
  assert.ok(fb.indexOf('sweepExtraTabs') < fb.indexOf('browsingData.remove'), 'المسح لازم يحصل والتبانين الفائضة اتقفلت قبله');
});

test('تاب واحد مضمون v1.18.4: الأداة بتتبع تبانبها وتكنس الفائض (حتى بعد إعادة التشغيل)', () => {
  assert.match(queue, /this\.ownedTabs = new Set\(\)/, 'مفيش تتبع لتبانين الأداة');
  assert.match(queue, /ownedTabIds/, 'القائمة مش محفوظة في الـrun للنجاة من إعادة تشغيل الـWorker');
  assert.match(queue, /await this\.sweepExtraTabs\(tab\.id\)/, 'مفيش كنس عند الفتح الأول');
  assert.match(queue, /const lastTab = await tabctl.open/, 'مسار التاب الأخير مش بيستخدم ترتيب الجديد←القديم');
  // التاب الجديد بعد كابتشا بيتفتح foreground مرة واحدة (الباقي في الخلفية زي ما طلب)
  assert.equal((queue.match(/Object\.assign\(\{\}, cfg, \{ foregroundTab: true \}\)/g) || []).length, 2, 'الفوكس مرة واحدة مطلوب في fallback + المحاولة الأخيرة بس');
});

test('ضد الكابتشا من المنبع v1.18.4: مفيش num=100 ولا pws=0 في رابط البحث', () => {
  const fn = urlkit.slice(urlkit.indexOf('buildSearchUrl'), urlkit.indexOf('queryOf'));
  assert.ok(!/searchParams\.set\('num'/.test(fn), 'num=100 لسه في الرابط — بصمة بوت');
  assert.ok(!/searchParams\.set\('pws'/.test(fn), 'pws=0 لسه بيتحط في الرابط — بصمة بوت');
  assert.match(fn, /'gl'/, 'gl اتلغط بالغلط');
  assert.match(fn, /'hl'/, 'hl اتلغط بالغلط');
  // serp.js لازم يفضل يتوقع 100 بدون البارامتر (degradation check)
  assert.match(serp, /parseInt\(D\.url\.query\('num'\), 10\) \|\| 100/, 'expectedNum وقع لو البارامتر اتشال');
});

test('تسليم الباستر→الحل الذاتي v1.18.4: المحاولة التانية مش مهدرة، ولا دوامة صامتة', () => {
  assert.match(cap, /S\.busterFailed = true;/, 'مفيش تسليم للحل الذاتي بعد فشل الباستر');
  assert.match(cap, /if \(!S\.busterFailed && \(findBusterButton/, 'الآلة هتفضل تدوس على اللي فشل');
  const timeoutBranch = cap.slice(cap.indexOf('if (S.busterTs) {'), cap.indexOf('if (S.busterTs) {') + 700);
  assert.ok(!/newChallenge\(\)/.test(timeoutBranch.slice(0, timeoutBranch.indexOf('}'))), 'التسليم للذاتي بيهدر التحدي القديم بريلود — المفروض يكمل فيه');
  assert.match(cap, /reportAttempt\('no-audio'\)/, 'مفيش تصعيد لو نافذة الصوت فتحتش خالص');
  assert.match(cap, /reportAttempt\('transition'\)/, 'الدوامة الصامتة في الحالات الانتقالية ماشية من غير عد محاولات');
  assert.match(orch, /Math\.max\(cfg\.captchaGapMs \|\| 0, 8000\)/, 'الفصل بين الجولات لسه سريع');
});

test('الوقفة الأخيرة v1.18.4: خطأ الحلقة = اشعار + تعافي تلقائي من الواتش دوج', () => {
  assert.match(queue, /الأداة وقفت/, 'مفيش اشعار وقفة');
  assert.match(queue, /indexOf\('error:'\) === 0/, 'الواتش دوج مش بيلتقط حالات الخطأ');
  assert.match(queue, /pauseReason: null\s*\}/, 'الاستئناف بعد الخطأ ما بيمسحش سبب الإيقاف');
});
