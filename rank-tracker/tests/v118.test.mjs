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

test('v119: النسخة 1.19.0 في المواضع الثلاثة والـ CHANGELOG مفتوح بيها', () => {
  const man = JSON.parse(read('manifest.json'));
  assert.equal(man.version, '1.19.0');
  assert.match(read('src/lib/constants.js'), /VERSION = '1\.19\.0'/);
  assert.match(read('src/background/core/bridge.js'), /VERSION:\s*'1\.19\.0'/);
  assert.match(read('CHANGELOG.md'), /^## \[1\.19\.0\]/m);
});
