import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
/**
 * v1.18.0 — انحدارات: دقة AI (توسيع + فك تحويلات + صيغة 1ai/ai)،
 * كابتشا الأولوية للشخص البرتقالي بمحاولتين، وسكون الكونسول.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
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

/* أوزان v1.19 — استدعاء حي للمطابقين (كلاسيك + موديول) */
import { loadClassic as v119loadClassic } from './helpers/load-classic.mjs';
import { matchResults as v119matchResults, storeNames as v119storeNames } from '../src/background/core/match.js';
const v119classic = v119loadClassic('src/lib/matchlib.js').SRT.match;
void v119loadClassic;


/* ---------------- AI ---------------- */

test('AI: عمود الترتيب بيتكتب 1ai وai بس (من غير مسافة)', () => {
  assert.match(queue, /(?:r\.position|pos) \+ 'ai'/, 'queue.js مفيش فيه صيغة 1ai');
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
  assert.match(bt, /\/429\|sorry_page\/\.test\(String\(e\)\)/, 'مفيش معالجة 429 بهدوء (ومع /sorry/ الجديدة)');
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
  assert.match(st, /export const SCHEMA_VERSION = 5;/, 'مفيش نسخة ميجريشن جديدة');
  assert.match(st, /att > 2\) \{ patchCfg\.captchaMaxAttempts = 2; \}/, 'مفيش إجبار المحاولتين على الإعدادات القديمة');
  assert.match(st, /cn === 10\) \{ patchCfg\.clearEveryN = 8; \}/, 'المسح القديم (10) مش بيتحوّل للـ8');
});

test('اللوحة v1.18.3: عدّاد كلمات حقيقي + اشعار الـ0 اتشال + تبويب تصدير النتائج', () => {
  const html = read('src/sidepanel/side-panel.html');
  const i18n = read('src/lib/i18n-ui.js');
  assert.match(html, /id="kwCount"/, 'مفيش عدّاد فوق جزء الكلمات');
  assert.match(panel, /cntEl\.textContent = String\(done\) \+ '\/' \+ String\(list\.length\)/, 'العدّاد مش دقيق: مفروض متفحص/إجمالي من القائمة نفسها');
  assert.ok(!/alert\(t\('kwAddedOk'\)/.test(panel), 'اشعار الإضافة الغلط لسه راجع');
  assert.match(html, /id="restStrip"/, 'مفيش شريط الاستراحة فوق المنحنى');
  assert.match(panel, /renderRestStrip/, 'الشريط مش بيتحدث مع الـsnapshot');
  assert.match(i18n, /tabBeyondten: '💯 تصدير النتائج'/, 'عنوان التبويب ما اتغيرش');
  assert.match(html, /💯 تصدير النتائج/, 'الـhtml لسه بالعنوان القديم');
});

/* ---------------- v1.18.4 ---------------- */

const urlkit = read('src/background/core/urlkit.js');

test('ضد الدوامة v1.18.4: تبريد إلزامي قبل إعادة الكابتشا — ومفيش لمس لبيانات غير بعد راحة', () => {
  assert.match(queue, /const restSec = 8 \+ captchaClears \* 4;/, 'مفيش تبريد قصير متصاعد قبل الإعادة');
  assert.match(queue, /await sleep\(restSec \* 1000, signal\)/, 'التبريد مش بيتنفذ بsleep قابل للإلغاء');
  // v1.20.2: الترتيب اتلمّ في openFreshTab: فتح الجديد ← قفل القديم ← sweep ← المسح
  const fb = queue.slice(queue.indexOf('async openFreshTab'), queue.indexOf('ضمان تاب واحد'));
  assert.ok(fb.indexOf('tabctl.open') < fb.indexOf('tabctl.close'), 'لازم الجديد يفتح قبل ما القديم يتقفل');
  assert.ok(fb.indexOf('sweepExtraTabs') < fb.indexOf('browsingData.remove'), 'المسح لازم يحصل والتبانين الفائضة اتقفلت قبله');
  // وفرع الكابتشا لسه يبرد الأول قبل أي استشفاء
  const cap = queue.slice(queue.indexOf('const restSec'), queue.indexOf('continue; // نفس الكلمة من الأول في التبويب الجديد'));
  assert.ok(cap.indexOf('await sleep(restSec * 1000, signal)') > -1 && cap.indexOf('openFreshTab') > cap.indexOf('await sleep'), 'المسح بقى بيسبق التبريد');
});

test('تاب واحد مضمون v1.18.4: الأداة بتتبع تبانبها وتكنس الفائض (حتى بعد إعادة التشغيل)', () => {
  assert.match(queue, /this\.ownedTabs = new Set\(\)/, 'مفيش تتبع لتبانين الأداة');
  assert.match(queue, /ownedTabIds/, 'القائمة مش محفوظة في الـrun للنجاة من إعادة تشغيل الـWorker');
  assert.match(queue, /await this\.sweepExtraTabs\(tab\.id\)/, 'مفيش كنس عند الفتح الأول');
  assert.match(queue, /const lastTab = await this\.openFreshTab\(/, 'مسار التاب الأخير مش بيستخدم وصفة الاستشفاء (جديد←قديم←كنس←مسح)');
  // التاب الجديد بعد كابتشا بيتفتح foreground مرة واحدة (الباقي في الخلفية زي ما طلب)
  // 1.20.2: fallback والمحاولة الأخيرة اتحدوا في openFreshTab — بقا فوكس في مكانين بس:
  // الهيلبر نفسه + إعادة فتح التاب في وضع الصبر (مقصود: يمكن الكابتشا محتاجة لمسة إيد)
  assert.equal((queue.match(/Object\.assign\(\{\}, cfg, \{ foregroundTab: true \}\)/g) || []).length, 2, 'الفوكس متوقع في openFreshTab + الصبر بس');
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

/* ---------------- v1.18.5 — النسخ للشيت: ترتيب المستخدم + الشرطة ---------------- */
const i18nUi = read('src/lib/i18n-ui.js');
const io_read = read;
const io_read2 = read;
const html2 = read('src/sidepanel/side-panel.html');

test('v1.18.5: النسخ/التصدير بيترتب زي قائمة الكلمات نفسها (مش العكس) وبشرطة للفلويد', () => {
  assert.match(panel, /function exportEntriesInUserOrder/, 'مفيش مصدر ترتيب موحد للتصدير');
  const ordFn = panel.slice(panel.indexOf('function exportEntriesInUserOrder'), panel.indexOf('function posCellForExport'));
  assert.match(ordFn, /snapshot\.keywords/, 'الترتيب مش بيتبنى على قائمة الكلمات نفسها');
  assert.match(ordFn, /!byKw\.has\(key\)/, 'مفيش dedup لآخر نتيجة لكل كلمة — المكرر هينسخ مرتين');
  assert.match(ordFn, /\.reverse\(\)/, 'لو القائمة اتلمست لازم ترتيب الفحص الأصلي (الأقدم الأول) مش الأحدث الأول');

  const copyStart = panel.indexOf('async function copyTsv');
  const copyFn = panel.slice(copyStart, panel.indexOf('/* ----', copyStart + 10));
  assert.ok(copyFn.length > 100, 'مفيش دالة copyTsv زي ما بنعرفها');
  assert.match(copyFn, /exportEntriesInUserOrder\(\)/, 'النسخ لسه بيطلع بترتيب المخزن المقلوب');
  assert.match(copyFn, /posCellForExport\(e\.result\)/, 'النسخ مش بيستخدم خانات الشرطه الموحده');
  assert.match(copyFn, /t\('copyEmpty'\)/, 'مفيش تنبيه لما ينسخ من غير أي نتيجة');
  assert.match(copyFn, /t\('copyFail'\)/, 'لو النسخ فشل بيقول «اتنسخ» على الفاضي');

  const posFn = panel.slice(panel.indexOf('function posCellForExport'), panel.indexOf('function resultRowsForExport'));
  assert.match(posFn, /if \(!r\) \{ return '—'; \}/, 'كلمة متفحصتش = فراغ بدل الشرطة «—»');
  assert.match(posFn, /Number\.isFinite\(pos\)/, 'بوزيشن متلغبط ممكن ينسخ NaNai بدل الشرطه');
  assert.match(posFn, /return r\.aiFound \? 'ai' : '—';/, 'ملهاش بوزيشن ولقيناها في الـAI — المفروض «ai»');

  const xlsx = panel.slice(panel.indexOf('async function makeXlsx'), panel.indexOf('async function exportCsv'));
  assert.match(xlsx, /const entries = exportEntriesInUserOrder\(\)/, 'شيت XLSX مش بترتيب المستخدم');
  assert.match(xlsx, /entries\.forEach\(\(e\) => \{/, 'XLSX بيفتّ الصفوف من مصدر تاني');
  assert.match(xlsx, /posCellForExport\(e\.result\)/, 'XLSX مش بنفس خانة الشرطه');
  assert.ok(!/t\('notFound'\)/.test(xlsx), 'XLSX لسه بيكتب «مش موجود» بدل «—»');
  const csvFn = panel.slice(panel.indexOf('function resultRowsForExport'), panel.indexOf('async function makeXlsx'));
  assert.match(csvFn, /exportEntriesInUserOrder\(\)/, 'CSV مش بترتيب المستخدم');
  assert.match(csvFn, /r\.checkedAt \? new Date\(r\.checkedAt\)\.toISOString\(\) : ''/, 'تاريخ فارغ اتلغبط بتاريخ دلوقتي');

  // كاتب الشيت في الخلفية — نفس القواعد بالظبط
  assert.match(queue, /if \(!r\) \{ return '—'; \}/, 'كتابة الشيت الخلفية ما بتعكسش الشرطه');
  assert.match(queue, /lines\.some\(\(l\) => l !== '—'\)/, 'مفيش حارس ضد ملء الشيت شرطات من غير أي فحص');
  assert.match(queue, /Number\.isFinite\(pos\)/, 'كتابة الشيت الخلفية ممكن تكتب NaNai');

  // مفاتيح الرسائل الجديدة في اللغتين
  assert.match(i18nUi, /copyEmpty: 'لسه مفيش نتائج — شغّل الفحص الأول\.'/, 'رسالة العربية للنسخ الفاضي ناقصة');
  assert.match(i18nUi, /copyFail: 'النسخ فشل — استخدم زر «شيت بالترتيب» بدل منه\.'/, 'رسالة فشل النسخ ناقصة');
  const enIdx = i18nUi.indexOf('en: {');
  assert.ok(enIdx > 0, 'قاموس English اتلغبط');
  const enBlock = i18nUi.slice(enIdx, enIdx + 4200);
  assert.match(enBlock, /copyEmpty:/, 'copyEmpty ناقص في English');
  assert.match(enBlock, /copyFail:/, 'copyFail ناقص في English');
});

test('v1.18.5 حراسات إضافية: فاضي قبل النسخ + تطبيع الكلمات', () => {
  const xlsx = panel.slice(panel.indexOf('async function makeXlsx'), panel.indexOf('async function exportCsv'));
  assert.match(xlsx, /entries\.some\(\(e\) => e\.result\)[\s\S]{0,80}copyEmpty/, 'شيت XLSX من غير نتائج بينزل فاضي');
  assert.match(panel.slice(panel.indexOf('async function exportCsv'), panel.indexOf('async function copyTsv')), /copyEmpty/, 'CSV فاضي بيتنزّل بصمت');
  assert.match(st, /replace\(\/\\s\+\/g, ' '\)\.trim\(\)\.slice\(0, 180\)/, 'الكلمات ما بتتطبّعش — تبابة/نيولاين/طول زائد بيقعّدوا التاب');
  assert.match(st, /\.replace\(\/\[\\r\\n\\t\]\+\/g, ' '\)/, 'فصل الأسطر الجوا الكلمة نفسها ما بيتلمّش');
});

test('v1.18.6: الباستر مابقاش انتظار أصم — 18 ثانية ثم تسليم الحل الذاتي في نفس التحدي', () => {
  assert.match(cap, /now - S\.busterTs < 18000/, 'مفيش مهلة نفاذة قصيرة للباستر');
  assert.match(cap, /if \(!audioOpen\(\) && !imageOpen\(\)\) \{ return; \}/, 'مفيش قرار مبني على حالة نافذة التحدي');
  const grace = cap.slice(cap.indexOf('now - S.busterTs < 18000'), cap.indexOf('now - S.busterTs < 18000') + 400);
  assert.match(grace, /S\.busterFailed = true;/, 'التسليم بعد المهلة مش بيتعمل');
  assert.ok(!/return; \}\n        if \(S\.busterTs\) \{\n         \/\/ وقتنا عدّى/.test(cap), 'لسه في انتظار 75 ثانية أصم؟');
});

test('v1.18.6: التبريداتShort والهدئات اتقلّصت زي ما طلبت + عنوان «تصدير النتائج»', () => {
  assert.match(queue, /const cool = 8000 \+ Math\.floor\(Math\.random\(\) \* 6000\);/, 'التهدئة بعد الحل لسه طويلة');
  assert.match(queue, /const restSec = 8 \+ captchaClears \* 4;/, 'التبريد قبل الإعادة لسه 90 ثانية');
  assert.match(i18nUi, /resTitle: '📊 تصدير النتائج',/, 'عنوان الجزء لسه «النتائج» في القاموس العربي');
  const html = io_read('src/sidepanel/side-panel.html');
  assert.match(html, /<summary data-i18n="resTitle">📊 تصدير النتائج<\/summary>/, 'عنوان HTML في اللوحة لسه قديم');
});

/* ---------------- v1.18.7 — إشعارات اللوحة + المحرك (المسار 1.18.9: باستر مستقلة + آلة 1.18.6) ---------------- */
test('v1.18.9: باستر المدمجة اتشيلت خالص — manifest وembedded ومفيش أي محتوى باستر في الحزمة', () => {
  const mf = read('manifest.json');
  assert.ok(!/buster\//.test(mf), 'لسه فيه ريفرنس لباستر في manifest');
  assert.ok(!/nativeMessaging/.test(mf), 'إذن nativeMessaging بتاع باستر لسه موجود');
  const em = read('src/background/embedded.js');
  assert.ok(!/buster/.test(em), 'embedded.js لسه بوصل خلفية باستر');
  const files = readdirSync(join(root, 'src'));
  assert.ok(files.includes('asr'), 'مفيش src/asr (المحرك الصوتي ملكنا بعد الآن)');
  const asrFiles = readdirSync(join(root, 'src/asr'));
  assert.ok(asrFiles.includes('index.html') && asrFiles.includes('script.js'), 'وثيقة offscreen ناقصة');
  assert.ok(asrFiles.includes('wasm'), 'ملفات wasm ناقصة');
  assert.ok(!existsSync(join(root, 'buster/manifest.json')), 'باستر لسه موصوفة كإضافة كاملة في الحزمة!');
});

test('v1.18.9: جزء الكابتشا رجع لزي ما كان في 1.18.6 بالظبط — ضغطة الباستا وبس، ومن غير أي بوابة نطاق في التبويب', () => {
  assert.ok(!/srt\/scope|srt\/transcribe|S\.inScope/.test(cap), 'آلة التبويب لسه فيها حرس 1.18.7 — المفروض نسخة 1.18.6 النقية');
  assert.match(cap, /now - S\.busterTs < 18000/, 'مهلة الـ18 ثانية اتلغطت');
  assert.match(cap, /id: 'transcribeAudio'/, 'النسخ مش بيرجع لاسم البروتوكول الأصلي');
  assert.match(cap, /finish\(null\), timeoutMs \|\| 60000\)/, 'تايم اوت النسخ مش رجع لـ60 ثانية');
  assert.match(queue, /message\.id === 'transcribeAudio' && message\.audioUrl/, 'الخلفية ما بتردّش على خدمة النسخ باسمها الأصلي');
  assert.match(queue, /solver\.transcribeAudioUrl/, 'الخلفية ما بتناديش محرك النسخ بتاعنا');
  // حارس الديبراجر لسه مقيّد بتابات الشغل (طلب Debug banner مش لكل الحسابات)
  const coord = queue.slice(queue.indexOf('if (coordMsg &&'), queue.indexOf('if (coordMsg &&') + 900);
  assert.match(coord, /if \(!\(await inScope\(\)\)\) \{ sendResponse\(\{ ok: false, error: 'out-of-scope' \}\); return; \}/,
    'الضغطة الموثوقة (debugger) لسه بتتبعت لأي تبويب — banner هيظهر في حسابات تانية');
  // مفيش pollings غريبة في أول الملف زي 1.18.7
  assert.ok(!/scopePoll/.test(cap), 'لسه في polling النطاق في التبويب');
});

test('v1.18.7: الإشعارات بقت جوه الأداة (مكان شريط الاستراحة) بدل نوتيفيكيشن الجهاز', () => {
  assert.match(queue, /notice: \{ title: title, text: message, ts: Date.now\(\) \}/, 'الإشعار مش بيتخزن في الـrun للوحة');
  assert.ok(!/notifications\.create\('srt-'/.test(queue), 'لسه نوتيفيكيشن نظامي في الـqueue');
  assert.match(panel, /function renderNotice/, 'اللوحة ما بتعرضش الإشعار');
  assert.match(panel, /45000/, 'الإشعار ما بيختفيش لوحده');
  assert.match(panel, /srt\/notice-clear/, 'زرار الإخفاء مش بوصل الخلفية');
  assert.match(io_read2('src/background/core/router.js'), /'srt\/notice-clear'/, 'الراوتر ما بيسمعش مسح الإشعار');
  assert.match(html2, /id="srtNotice"/, 'مفيش بوكس إشعار في الـHTML');
});

test('v1.18.7: شريط الاستراحة التفاعلي — بيظهر بس وقت الاستراحة الفعلية بعدّاد حي', () => {
  assert.match(panel, /run\.breakUntil/, 'الشريط ما بيقراش موعد الاستراحة');
    assert.match(panel, /until - Date\.now\(\)\) : 0;[\s\S]{0,200}strip\.classList\.add\('hidden'\)/, 'الشريط مش بيتخفي لسه مفيش استراحة');
  assert.match(panel, /setInterval\(tick, 500\)/, 'مفيش تحديث حي للعدّاد');
  assert.match(queue, /breakUntil: Date\.now\(\) \+ ms, breakTotalMs: ms/, 'الخلفية ما بتبعتش موعد الاستراحة');
  assert.match(queue, /breakUntil: null, breakTotalMs: null/, 'الاستراحة ما بتتلمّش بعد ما تخلص');
  assert.match(i18nUi, /restNow: '☕ الاستراحة جارية — \{s\} ثانية فاضلة'/, 'رسالة العدّاد الحي ناقصة');
  assert.match(i18nUi, /kwCountTip: 'اتفحص \{d\} من \{t\} كلمات'/, 'تلميح العدّاد الدقيق ناقص');
});

test('v1.18.7: تاب واحد حتى بعد ما الشغل يخلص — الأداة بتقفل تابها وهي الواصل', () => {
  const finish = queue.slice(queue.indexOf("'✅ انتهى فحص كل الكلمات المفتاحية'"), queue.indexOf("'✅ انتهى فحص كل الكلمات المفتاحية'") + 420);
  assert.match(finish, /sweepExtraTabs\(null\)/, 'تاب الشغل لسه قايم بعد الانتهاء');
  assert.match(finish, /workerTabId: null, ownedTabIds: \[\]/, 'حالة التاب مش بتنضف');
});

/* ---------------- v1.18.8 — حارس الصيغة الشامل (علة الفاصلة القاتلة) ---------------- */
test('v1.18.8: أي ملف JS في src/ لازم يعدي node --check — الفاصلة القاتلة متتكررش', () => {
  let failed = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); }
      else if (e.name.endsWith('.js')) {
        try { execFileSync(process.execPath, ['--check', full], { stdio: 'pipe' }); }
        catch (_) { failed.push(path.relative(process.cwd(), full)); }
      }
    }
  };
  walk('src');
  assert.deepEqual(failed, [], 'ملفات فيها SyntaxError: ' + failed.join(', '));
});

test('v1.18.8: القاموس نفسه سليم — لا فواصل مفقودة ولا مزدوجة عند مفاتيح الاستراحة/العدّاد', () => {
  for (const key of ['restNext', 'restNow', 'restNowClear', 'kwCountTip', 'copyEmpty', 'copyFail']) {
    const hits = [...i18nUi.matchAll(new RegExp(key + ':', 'g'))];
    assert.equal(hits.length, 2, key + ' مفروض موجود في ar وen بالظبط');
  }
  assert.ok(!/,\s*,/.test(i18nUi), 'في فاصلة مزدوجة ,, في القاموس');
  // كل سطر قيمة نصية لازم ينتهي بفاصلة (جوه بلوك STR) — استثناء آخر مفتاح قبل }
  assert.ok(!/'\s*\n\s*[A-Za-z]+:/.test(i18nUi), 'في سطر قيمة من غير فاصلة قبل المفتاح الجاي — قاتل الـparse');
});

test('v1.18.8: syntax-check آلي شامل — مفيش قوائم يدوية بتفلت ملفات', () => {
  const sc = read('tools/syntax-check.mjs');
  assert.ok(!/CLASSIC_FILES\s*=\s*\[\s*'src\/lib\/constants/.test(sc), 'لسه قائمة يدوية جزئية');
  assert.match(sc, /ROOT_WALKS/, 'مفيش مسح آلي على src/ كاملة');
  assert.match(sc, /MODULE_PREFIXES/, 'مفيش تصنيف modules تلقائي');
});

/* ---------------- v1.19.0 — الاسم العربي + الإنجليزي، وتسمية «الموقع» ---------------- */

const v119Items = [
  { title: 'Best coffee beans in Riyadh', snippet: 'Order online', url: 'https://mysite.com/x', host: 'mysite.com' },
  { title: 'نتائج تانية مالهاش علاقة', snippet: 'حاجة تانية', url: 'https://other.com', host: 'other.com' },
];

test('v119: الاسم الإنجليزي لوحده بيجيب ظهور في العضوي (كلاسيك = موديول)', () => {
  const cfg = { matchMode: 'name', storeNameEn: 'Best Coffee' };
  const r = v119matchResults(v119Items, cfg);
  assert.equal(r.found, true);
  assert.equal(r.position, 1);
  assert.ok(r.reasons.includes('name'));
  assert.equal(v119matchResults([v119Items[1]], cfg).found, false);
});

test('v119: أي اسم من الاتنين كفاية — والاسم الفاضي/المسافات ما تخليش طابور يلف', () => {
  const both = v119matchResults(v119Items, { matchMode: 'name', storeName: 'قهوة الرياض', storeNameEn: 'Best Coffee' });
  assert.equal(both.found, true); assert.equal(both.position, 1);
  const byAr = v119matchResults(v119Items, { matchMode: 'name', storeName: 'نتائج تانية', storeNameEn: 'مفيش' });
  assert.equal(byAr.found, true); assert.equal(byAr.position, 2);
  const none = v119matchResults(v119Items, { matchMode: 'name', storeName: '   ', storeNameEn: '' });
  assert.equal(none.found, false);
  assert.deepEqual(none.reasons, []);
});

test('v119: الكلاسيك (المحقون في SERP) ماشي مع الموديول حذاء-بحذاء بأي اسم', () => {
  const cfgs = [
    { matchMode: 'name', storeNameEn: 'Best Coffee' },
    { matchMode: 'both', storeName: 'قهوة الرياض', storeNameEn: 'best coffee', storeDomain: 'nope.io' },
    { matchMode: 'name', storeName: 'نتائج تانية' },
    { matchMode: 'domain', storeNameEn: 'Best Coffee' },
  ];
  for (const cfg of cfgs) {
    const a = v119classic.matchItems(v119Items, cfg);
    const b = v119matchResults(v119Items, cfg);
    assert.equal(a.found, b.found, JSON.stringify(cfg));
    assert.equal(a.position, b.position, JSON.stringify(cfg));
  }
});

test('v119: dedupe — الاسم المكرر بالعربي/الإنجليزي بيترشّح مرة واحدة، و storeNames exports', () => {
  const names = v119storeNames({ storeName: 'لمسة', storeNameEn: ' لمسة ' });
  assert.deepEqual(names, ['لمسة']);
  assert.deepEqual(v119storeNames({ storeName: '', storeNameEn: 'X' }), ['X']);
});

test('v119: الحقل مربوط — cfgNameEn ↔ storeNameEn في اللوحة والـ DEFAULTS والـ sanitize', () => {
  const js = read('src/sidepanel/side-panel.js');
  assert.match(js, /\['cfgNameEn',\s*'storeNameEn',\s*'string'\]/);
  const html = read('src/sidepanel/side-panel.html');
  assert.match(html, /id="cfgNameEn"/);
  assert.match(html, /data-i18n="lblNameEn"/);
  const st = read('src/background/core/state.js');
  assert.match(st, /storeNameEn:\s*''/);
  assert.match(st, /\['storeName',\s*'storeNameEn'\]/, 'sanitize بيمشي على الاسميين');
});

test('v119: نصوص «متجر/متجرك» اختفت من الواجهة — ظلت بس في منطق الشريط (regex) والتعليقات', () => {
  const i18n = read('src/lib/i18n-ui.js');
  for (const line of i18n.split('\n')) {
    if (!/متجر/.test(line)) continue;
    assert.ok(/replace\(|\/\(?:/.test(line), 'سطر نَصي لسه فيه متجر: ' + line.trim());
  }
  const html = read('src/sidepanel/side-panel.html');
  assert.ok(!/>[^<>]*متجر[^<>]*</.test(html), 'لسه في متجر جوه نص HTML ظاهر');
  assert.match(i18n, /اسم الموقع بالعربي \(إن وُجد\)/);
  assert.match(i18n, /اسم الموقع بالإنجليزي \(إن وُجد\)/);
  assert.match(i18n, /Site name \(English, if any\)/);
});

test('v119: السيرة الطويلة — حارس no-target وبلاغ الحكم بيشملوا storeNameEn', () => {
  assert.match(queue, /cfg\.storeNameEn/, 'queue.js مش واخد الاسم الإنجليزي في الحسبان');
  assert.match(serp, /D\.match\.storeNames|cfg\.storeNameEn/, 'serp.js لازم يفحص الاتنين');
  assert.match(serp, /storeNameEn/, 'hasTarget في serp لازم يشمل الإنجليزي');
});

test('v119: النسخة الحالية في المواضع الثلاثة والـ CHANGELOG مفتوح بيها', () => {
  const man = JSON.parse(read('manifest.json'));
  assert.equal(man.version, '1.20.2');
  assert.match(read('src/lib/constants.js'), /VERSION = '1\.20\.2'/);
  assert.match(read('src/background/core/bridge.js'), /VERSION:\s*'1\.20\.2'/);
  assert.match(read('CHANGELOG.md'), /^## \[1\.20\.2\]/m);
});

/* ---------------- v1.19.1 — المراكز الغويط (#30+) ما تضيعش ---------------- */

test('v1191: المسح بقى واعي بالتقدّم — قاعدة 20 ثانية تتطبق بس لما العدّاد يقف، وتحت سقف صلب', () => {
  assert.match(serp, /count === lastCount && now - started >= maxWait/, 'قاعدة 20 ثانية لسه بقطع أحوائي');
  assert.match(serp, /scanHardCapMs \|\| 60000/, 'مفيش سقف صلب للتقدّم (scanHardCapMs)');
  assert.ok(!/if \(now - started >= maxWait\) \{ break; \}/.test(serp), 'لسه في القطع الأحوائي القديم');
});

test('v1191: الجلب الخلفي بقى افتراضي وبلا بوابة companion، وسقفه 9 دفعات', () => {
  const st2 = read('src/background/core/state.js');
  assert.match(st2, /selfFetchMore: true/, 'selfFetchMore لسه متقفل افتراضياً');
  assert.match(st2, /selfFetchMaxBatches: 9/, 'الدفعات الخلفية لسه 6 — مش كافية لـ100');
  assert.match(st2, /scanHardCapMs: 60000/, 'مفيش السقف في الـ DEFAULTS');
  assert.match(st2, /batchSettleMs: 6500/, 'ثبات العدّاد لسه 5000 — بيسبق الشبكات البطيئة');
  assert.match(st2, /'scanHardCapMs'/, 'السقف مش في قائمة التطهير الرقمي');
  assert.match(serp, /selfFetchMore !== false && items\.length < expectedNum/, 'بوابة companion لسه بتقطم الجلب الخلفي');
  assert.ok(!/selfFetchMore !== false && !companionSeen/.test(serp), 'لازم الجلب يشتغل حتى لو companion كان شغال ووقف');
});

test('v1191: الطابور يستنى على مقاس السقف الجديد — مش 20+8، ومسار ما بعد الكابتشا 100 ثانية', () => {
  assert.match(read('src/lib/constants.js'), /SERP_AFTER_CAPTCHA_MS: 100000/, 'انتظار ما بعد الكابتشا لسه 60 ثانية — هيسبق المسح الطويل');
  assert.match(queue, /const timeout = cap \+ \(cfg\.selfFetchMore === false \? 40000 : 90000\);/,
    'سباق الانتظار في queue لسه بيقطع المسح الطويل (1.20.0: هامش 90s مع الجلب الخلفي)');
});

test('v1191: ميجريشن v5 — اللي قاعد على القيم القديمة يتنقل للصبر الجديد من غير ما ندهس تعديلاته', () => {
  const st2 = read('src/background/core/state.js');
  assert.match(st2, /if \(version < 5\) \{/, 'مفيش بلوك ميجريشن v5');
  assert.match(st2, /cfg\.batchSettleMs, 10\) === 5000/, 'ما بنقلش ثبات العدّاد القديم (5000→6500)');
  assert.match(st2, /cfg\.selfFetchMaxBatches, 10\) === 6/, 'ما بنقلش الدفعات القديمة (6→9)');
  assert.match(st2, /cfg\.selfFetchMore === false/, 'selfFetchMore القديم مقفول للأبد — لازم يتفعّل');
});

/* ---------------- v1.19.6 — طبقة نص البلوك + شبكة الإنقاذ الأخيرة (من 1.19.2، معزولتين) ---------------- */

test('v1196: نص البلوك كامل بيوصل للمحرك — والاسم اللي «باين قدامك» يتسجل', () => {
  assert.match(serp, /text: blockText\(block \|\| a\)/, 'extractFrom مش بيحمّل item.text');
  // سلوكي: اسم الموقع موجود بس في سطر الاسم المعروض (مش العنوان/الوصف)
  const items = [{ url: 'https://x.com/p', host: 'x.com', title: 'عباية كاشمير سوداء', snippet: 'خامة فاخرة', text: 'لمسة · الرياض · توصيل مجاني' }];
  const cfg = { matchMode: 'name', storeName: 'لمسة' };
  assert.equal(v119classic.matchItems(items, cfg).found, true, 'الكلاسيك مبيفتحش النص المحمّل');
  assert.equal(v119matchResults(items, cfg).found, true, 'الموديول مش بيفتح النص المحمّل');
  // ومن غير الطبقة دي كان هيفشل — التثبيت إن السلوك ده مقصود مش صدفة
  const bare = [{ url: items[0].url, host: 'x.com', title: items[0].title, snippet: items[0].snippet }];
  assert.equal(v119classic.matchItems(bare, cfg).found, false);
});

test('v1196: شبكة الإنقاذ الأخيرة — فحص الشاشة قبل حكم «غير موجود» وبعد الجلب الخلفي كمان', () => {
  assert.match(serp, /const lastHit = immediateFind\(cfg, \{ items: items \}, aiItems\);/, 'حكم النهاية لسه quickFind حصري');
  assert.match(serp, /const lateHit = immediateFind\(cfg, \{ items: items \}, aiItems\);/, 'مفيش إعادة فحص بعد الجلب الخلفي');
  assert.match(serp, /rescued: true/, 'الإنقاذ مش متعلّم في الـ payload');
  // الإنقاذ لازم يجي بعد الـ selfFetch وقبل الـ return النهائي مباشرة
  const lateAt = serp.indexOf('const lateHit');
  const finalReturn = serp.indexOf('early: false, settled: settled');
  const fetchAt = serp.indexOf('selfFetchMore(cfg, items, aiItems)');
  assert.ok(fetchAt < lateAt && lateAt < finalReturn, 'ترتيب الإنقاذ غلط');
});

/* ---------------- v1.19.7 — الدومين أولاً: مفيش تشابه أسماء بيخرب الترتيب ---------------- */

test('v1197: الدومين محطوط في both؟ موقع تاني بنفس الاسم بيتجاهل تمامًا والترتيب من دويمينك انت', () => {
  const items = [
    { url: 'https://rivalsite.com/lamisa', host: 'rivalsite.com', title: 'لمسة - المتجر الأصلي', snippet: 'توصيل', text: 'لمسة · الرياض' },
    { url: 'https://shop.mystore.com.sa/p', host: 'shop.mystore.com.sa', title: 'عباية كاشمير', snippet: '', text: 'لمسة' },
  ];
  const cfg = { matchMode: 'both', storeDomain: 'mystore.com.sa', storeName: 'لمسة', storeNameEn: 'Lamisa Store' };
  const r = v119matchResults(items, cfg);
  assert.equal(r.found, true);
  assert.equal(r.position, 2, 'اتحلت عند منافس بنفس الاسم بدل الدومين — السياسة مش بتطبّق');
  const c = v119classic.matchItems(items, cfg);
  assert.equal(c.position, 2, 'الكلاسيك مش ماشي حذاء-بحذاء مع الموديول');
  // هروب وضع «الاسم بس» لسه متاح للي عايز الاسم صراحة
  assert.equal(v119classic.matchItems(items, { matchMode: 'name', storeName: 'لمسة', storeDomain: 'mystore.com.sa' }).position, 1);
  // وبلا دومين؟ الاسم بيحكم زي الأول
  assert.equal(v119matchResults(items, { matchMode: 'both', storeName: 'لمسة' }).position, 1);
});

test('v1197: كل الطبقات التانية بتطبق نفس السياسة — الشاشة، الخرائط، وحكم الـ AI النصي', () => {
  assert.match(serp, /if \(d && String\(cfg\.matchMode \|\| 'both'\) !== 'name'\) \{ return false; \}/,
    'بوابة bodyHasTarget لسه بتفتح بالاسم لوحده والدامين مضبوط');
  assert.match(serp, /const nameGate = !d \|\| String\(cfg\.matchMode \|\| 'both'\) === 'name';/,
    'positionByText لسه بيعدّي ترتيبات منافسين بنفس الاسم');
  assert.match(read('src/background/core/localcheck.js'), /nameAllowed/, 'كروت الخرائط مش واخدة السياسة');
  // v1.19.9: طبقة الحضور في الـ AI اتفصلت عن سياسة الترتيب — الاسم العربي/الإنجليزي رجع يحكم
  assert.ok(!/const nameAllowed/.test(queue), 'حكم الـ AI بقى أي ضلع من الثلاثة (بلا بوابة nameAllowed)');
});

test('v1197: مسمّى الوضع اتحدّث في اللوحة والمعاجم — «الدومين بالظبط»', () => {
  const i18n = read('src/lib/i18n-ui.js');
  assert.match(i18n, /الدومين بالظبط \(والاسم لو مفيش دومين\)/);
  assert.match(i18n, /Domain exact \(name only if no domain\)/);
  assert.ok(!i18n.includes("'الدومين أو الاسم'"), 'لسه المسمّى القديم بيوعِد بالاسم كمان');
  const html = read('src/sidepanel/side-panel.html');
  assert.match(html, /<option value="both"[^>]*>الدومين بالظبط/);
});

/* ---------------- v1.19.8 — المراكز من 11 لـ100 ما تضيعش بصمت ---------------- */

test('v1198: الجلب الخلفي اتقوّى — إعادة محاولة، num=20، فك تحويلات، وتوقيت ذاتي-التصحيح', () => {
  assert.match(serp, /u\.searchParams\.set\('num', '20'\)/, 'صفحة الجلب الخلفي لسه بلا num=20');
  assert.match(serp, /uu\.searchParams\.get\('q'\) \|\| uu\.searchParams\.get\('url'\)/, 'روابط /url?q= لسه بتسقط النتيجة بدل ما تتفك');
  assert.ok(serp.includes('سكتة ثم فرصة تانية'), 'الدفعة الفاشلة لسه بتتمحو من غير إعادة محاولة');
  assert.match(serp, /start = Math\.ceil\(merged\.length \/ 10\) \* 10; \/\/ تصحيح ذاتي/, 'التوقيت لسه +=10 أعمى');
  assert.match(serp, /selfFetchMaxBatches \|\| 9/, 'الفول-باك لسه 6 دفعات');
  assert.match(serp, /🛰 الجلب الخلفي/, 'مفيش سجل شفافية للتغطية');
  assert.ok(!/if \(!resp\.ok\) \{ break; \}/.test(serp), 'لسه break صامت على خطأ HTTP');
  assert.ok(!/const more = extractFrom\(doc, false\);\s*\n\s*if \(!more\.length\) \{ break; \}/.test(serp), 'لسه break صامت على صفحة فاضية');
});

/* ---------------- v1.19.9 — الحكمين انفصلوا: ترتيب بالدومين، وAI بأي ضلع ---------------- */

test('v1199: حضور AI Overview = دومين أو اسم عربي أو إنجليزي — أي واحدة تكفي', () => {
  assert.match(queue, /matchResults\(serp\.aiItems, Object\.assign\(\{\}, cfg, \{ matchMode: 'domain' \}\)\)/,
    'اقتباسات الـ AI مفروض عليها جولة دومين الأول');
  assert.match(queue, /matchResults\(serp\.aiItems, Object\.assign\(\{\}, cfg, \{ matchMode: 'name' \}\)\)/,
    'مفيش جولة أسماء احتياطية للاقتباسات');
  assert.ok(!/const nameAllowed/.test(queue), 'بوابة nameAllowed لسه مكمّمة حكم الـ AI في queue');
  assert.match(queue, /const nameHit = \[cfg\.storeName, cfg\.storeNameEn\]/,
    'نص الـ AI مفروض يستشير الاسمين دايماً');
  // سياسة الترتيب 1.19.7 في مكانها — مفيش ارتداد
  assert.match(read('src/lib/matchlib.js'), /const nameAllowed = mode === 'name' \|\| \(mode === 'both' && !hasDomain\);/,
    'مكتبة المطابقة فقدت بوابة الدومين للترتيب!');
  assert.match(read('src/background/core/match.js'), /const nameAllowed = mode === 'name' \|\| \(mode === 'both' && !hasDomain\);/,
    'match.js فقد بوابة الدومين للترتيب!');
});

test('v1199: ضربة AI لوحدها ما بقتش توقف المسح — ترتيبات #20+ ما تسقطش', () => {
  assert.match(serp, /if \(h && h\.where === 'organic'\)/, 'الانتظار الأول لسه بيخرج على أي ضربة');
  assert.match(serp, /if \(hit && hit\.where === 'organic'\)/, 'الحلقة العميقة لسه بتخرج على ضربة AI');
  assert.match(serp, /🤖 الموقع باين في AI Overview — كمّل نزول/, 'مفيش سجل «كمّل بحث عن العضوي»');
});

test('v1200: الكابتشا العنيدة — صبر بلا إلغاء وبلا تأجيل لآخر الجولة', () => {
  assert.match(queue, /async waitCaptchaCleared\(tabId, kw, signal\)/, 'مفيش ميثود الصبر waitCaptchaCleared');
  assert.match(queue, /هنستنى تتحل ونعيد نفس الكلمة تاني \(مش ملغاة\)/, 'رسالة الصبر مش موجودة');
  assert.match(queue, /captchaClears = 0; \/\/ الكابتشا اتحلت/, 'بعد الحل مفيش تصفير لميزانية الكلمة');
  assert.match(queue, /continue; \/\/ ونعيد نفس الكلمة تاني هنا، مش آخر الجولة/, 'الصبر مش بيرجّع نفس الكلمة على طول');
  assert.ok(!/return 'deferred';/.test(queue), 'لسه في تأجيل لآخر الجولة — المستخدم رفضه');
  assert.ok(!/الجولة المتأخرة/.test(queue), 'بلوك الجولة المتأخرة لسه موجود');
  assert.match(queue, /'after-patience'/, 'المحاولة الأخيرة بعد الصبر مسجلة بمصدرها');
  // حل يدوي في التاب = نهاية الانتظار (نفس الدرس بتاع waitManualSolve)
  assert.match(queue, /if \(!urlkit\.isSorry\(u\)\) \{ break; \}/, 'صبر ما يراقبش عنوان التاب');
});

test('v1200: حرارة الكابتشا تطوّل الاستراحة الجاية — والـ race ما يقتلش مسح طويل', () => {
  assert.match(queue, /this\.captchaHeat = \(this\.captchaHeat \|\| 0\) \+ 1;/, 'حرارة الكابتشا مش بتتعد');
  assert.match(queue, /if \(this\.captchaHeat >= 2\) \{[\s\S]{0,240}?await sleep\(extra, this\.signal\(\)\);/, 'الاستراحة الإضافية مش بتتطبق');
  assert.match(queue, /const timeout = cap \+ \(cfg\.selfFetchMore === false \? 40000 : 90000\);/, 'هامش الـ race لسه 40 ثانية — بيقتل المسح اللي فيه جلب خلفي');
  assert.match(queue, /this\.captchaHeat = 0; \/\/ 🌡 حرارة الكابتشا \(v1\.20\.0\)/, 'الـ constructor مش مصفّر الحرارة');
});

test('v1200: BeyondTen (إضافة الـ100) — الشاشر التلقائي بيكمل لوحده ومفيش حرق صفحات فاضية', () => {
  const bt = read('beyondten/content/index.js');
  const btFetch = read('beyondten/content/fetch.js');
  assert.match(bt, /function startChaser\(signal\)/, 'مفيش شاشر تلقائي للصفحات الناقصة');
  assert.match(bt, /function remainingTargets\(\)/, 'الحساب الناقص مش متصدر — السكرول باظ');
  assert.match(bt, /startChaser\(signal\);\n    \} else \{/, 'الشاشر مش مربوط بمسار الـ deferred');
  assert.match(bt, /if \(blocks\.length > 0\) window\.BT\.state\.loadedPages\.add\(idxp\);/, 'لسه بتتحرق الصفحة الفاضية للأبد');
  assert.match(bt, /if \(remainingTargets\(\)\.length && !state\.chaser\) startChaser\(signal\);/, 'المسار اليدوي (زرار) مش متغطي بالشاشر');
  assert.match(btFetch, /sorry_page/, 'fetch مش بيكشف صفحة /sorry/ اللي بترجع 200');
  assert.match(btFetch, /delay\(1200\*\(attempt\+1\)/, 'الـ backoff لسه 200 مللي — بيجيب صفعة');
  assert.match(bt, /stopChaser\(\);\n    state\.aborter\?\.abort\(\);/, 'الإلغاء مشط الشاشر — هيفضل لافّت ورا');
});

/* ---------------- v1.20.1 — بصمة الآلة اتصفّت: توقيتات بشرية من أول لسادس ---------------- */

test('v1201: مفيش توقيتات دقيقة متكررة — المهلة قبل الكلمة والجلب الخلفي اتهمّنت', () => {
  const sched = read('src/background/core/scheduler.js');
  assert.match(sched, /const ms = 8500 \+ Math\.floor\(Math\.random\(\) \* 5500\);/,
    'المهلة لسه 10000ms بالمللي كل كلمة — بصمة');
  assert.match(serp, /await D\.humanSleep\(2400, 1600\);/, 'دفعات الجلب الخلفي لسه سريعة عدوِّ');
  assert.ok(!/const ms = 10000;/.test(sched), 'القيمة الثابتة لسه موجودة');
});

test('v1201: المسح الدوري ما بيضربش إعفاءات الكابتشا في الجو الساخن', () => {
  assert.match(queue, /const hot = \(this\.captchaHeat \|\| 0\) >= 2;/, 'مفيش فحص حرارة في المسح الدوري');
  assert.match(queue, /\? \{ cacheStorage: true, history: true \}/, 'المسح الخفيف مش متوفر');
  assert.match(queue, /الكوكيز معفاة/, 'مفيش سجل يوضح إن الكوكيز اترفدت');
});

test('v1201: BeyondTen — مفيش عدو طلبات والسينسور ما بيشتغلش بقايما قديمة', () => {
  const btState = read('beyondten/content/state.js');
  const bt = read('beyondten/content/index.js');
  assert.match(btState, /concurrency: 2,/, 'لسه 6 متزامنة = 429 أكيد');
  assert.match(bt, /await delay\(1800 \+ Math\.random\(\) \* 1800, signal\);/, 'مفيش فاصل بين الدفعات');
  assert.match(bt, /const live = remainingTargets\(\);/, 'السينسور لسه بياخد القائمة القديمة');
});

/* ---------------- v1.20.2 — صفحة الرفض 403: مسح بيانات وتاب جديد، مش ريفرش لميت ---------------- */

test('v1202: errorsig — صفحة «permission to get URL» تتعرف حتى لو العنوان ضاع', () => {
  const esig = v119loadClassic('src/lib/errorsig.js').SRT.errorsig;
  assert.equal(esig.detectError('Error 403 (Forbidden)!!1', "403. That's an error."), 'http-error', '403 بعنوانها مش بتتصنف');
  const body = "403. That's an error. Your client does not have permission to get URL /search?q=test&gl=sa&hl=ar from this server. That's all we know.";
  assert.equal(esig.detectError('Google', body), 'http-error', '403 بدون عنوان مش بتتصنف من النص');
});

test('v1202: engine — newtab/رفض = تبريد → مسح بيانات → تاب جديد → نفس الكلمة، ومن غير تسجيل «غير موجود»', () => {
  assert.match(queue, /} else if \(first\.type === 'newtab'\) \{/, 'فرع newtab لسه بيدور ريفرش زي أي مشكلة');
  assert.match(queue, /🚫 صفحة رفض/, 'مفيش سجل رفض واضح');
  assert.match(queue, /بنمسح البيانات ونعيد في تاب جديد نضيف/, 'رسالة المستخدم مش بتطمن على الكلمة');
  assert.match(queue, /const fresh = await this\.openFreshTab\(kw, cfg, url, tab\.id\);\n\s+if \(!fresh\)/, 'الاستشفاء مش على نفس وصفة الكابتشا');
  assert.match(queue, /this\.captchaHeat = \(this\.captchaHeat \|\| 0\) \+ 1; \/\/ النطاق اتحرق/, 'الرفض ما بيولّعش الحرارة');
  assert.match(queue, /async openFreshTab\(kw, cfg, url, oldTabId\)/, 'مفيش هيلبر استشفاء موحد');
  assert.match(queue, /tab = fresh;\n\s+navigatedViaBox = false;\n\s+continue; \/\/ نفس الكلمة من الأول في التبويب الجديد/, 'الرفض مش بيرجّع نفس الكلمة على طول');
  assert.match(queue, /const lastTab = await this\.openFreshTab\(kw, cfg, url, tab\.id\);/, 'المحاولة الأخيرة لسه بتغير هوا من غير مسح');
  const nb = queue.slice(queue.indexOf("first.type === 'newtab'"), queue.indexOf("first.type === 'serp' && first.payload.total > 0"));
  assert.ok(nb.indexOf('continue') > nb.indexOf('openFreshTab'), 'مسار الرفض مش بيرجّع الكلمة لللفة بعد الاستشفاء');
});


