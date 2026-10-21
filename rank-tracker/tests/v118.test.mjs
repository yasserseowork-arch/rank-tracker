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
const cons = read('src/lib/constants.js');

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
  assert.match(serp, /const aiF = await finalizeAi\(ai, 1200\);/, // v1.21.15: بدري = ميزانية قصيرة
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
  assert.match(queue, /await sleep\(3500, signal\); \/\/ v1\.20\.5/, 'مفيش تهدئة قبل قراءة آخر تحليل (1.20.5: 6←3.5ث)');
  assert.match(queue, /collectAfterSolve\(tab\.id, solveStartedAt, signal, cfg\)/, 'مسار الحل الأساسي مش بيستخدم التهدئة');
  assert.match(queue, /collectAfterSolve\(tab\.id, solveStartedAt2, signal, cfg\)/, 'مسار التاب الجديد مش بيستخدم التهدئة');
});

test('الإعدادات v1.18.3: المحاولتين إجباريًا + المسح بقى كل 8 مع الاستراحة', () => {
  assert.match(st, /clearEveryN:\s*8,/, 'ديفولت المسح لسه 10');
  assert.match(st, /export const SCHEMA_VERSION = 6;/, 'مفيش نسخة ميجريشن جديدة');
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
  assert.match(i18n, /tabBeyondten: 'تصدير النتائج'/, 'عنوان التبويب مش على مقاس 1.21.11');
  assert.match(html, /data-i18n="tabBeyondten">تصدير النتائج</, 'الـhtml لسه بعنوان قديم/مإيموجي');
});

/* ---------------- v1.18.4 ---------------- */

const urlkit = read('src/background/core/urlkit.js');

test('ضد الدوامة v1.18.4: تبريد إلزامي قبل إعادة الكابتشا — ومفيش لمس لبيانات غير بعد راحة', () => {
  assert.match(queue, /const restSec = 8 \+ captchaClears \* 4;/, 'مفيش تبريد قصير متصاعد قبل الإعادة');
  assert.match(queue, /await sleep\(restSec \* 1000, signal\)/, 'التبريد مش بيتنفذ بsleep قابل للإلغاء');
  // v1.20.2: الترتيب اتلمّ في openFreshTab: فتح الجديد ← قفل القديم ← sweep ← المسح
  const fb = queue.slice(queue.indexOf('async openFreshTab'), queue.indexOf('ضمان تاب واحد'));
  assert.ok(fb.indexOf('tabctl.open') < fb.indexOf('tabctl.close'), 'لازم الجديد يفتح قبل ما القديم يتقفل');
  assert.ok(fb.indexOf('browsingData.remove') < fb.indexOf('tabctl.open'), 'v1.21.15: المسح بقى أول حاجة قبل ما أي تاب يتفتح (تسخين على نضافة)');
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
  assert.match(i18nUi, /resTitle: 'تصدير النتائج',/, 'عنوان الجزء مش على مقاس 1.21.11 في القاموس العربي');
  const html = io_read('src/sidepanel/side-panel.html');
  assert.match(html, /<summary data-i18n="resTitle">تصدير النتائج<\/summary>/, 'عنوان HTML في اللوحة لسه قديم');
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
  assert.equal(man.version, '1.21.15');
  assert.match(read('src/lib/constants.js'), /VERSION = '1\.21\.15'/);
  assert.match(read('src/background/core/bridge.js'), /VERSION:\s*'1\.21\.15'/);
  assert.match(read('CHANGELOG.md'), /^## \[1\.21\.15\]/m);
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
const cons = read('src/lib/constants.js');
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
  assert.match(sched, /: 5500 \+ Math\.floor\(Math\.random\(\) \* 3500\);/,
    'المهلة لسه قيمة ثابتة كل كلمة — بصمة');
  assert.match(serp, /await D\.humanSleep\(900, 450\);/, 'فاصل الجلب الخلفي مش على مقاس 1.21.9');
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
const cons = read('src/lib/constants.js');
  assert.match(btState, /concurrency: 2,/, 'لسه 6 متزامنة = 429 أكيد');
  assert.match(bt, /await delay\(1200 \+ Math\.random\(\) \* 1200, signal\);/, 'مفيش فاصل بين الدفعات');
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

/* ---------------- v1.20.5 — مفيش قفل لكروم + تسريع آمن ---------------- */

test('v1205: كنس التابات مابيقدرش يقفل كروم — كل قفل عدّى على الحماية', () => {
  assert.match(queue, /try \{ await tabctl\.close\(stale\); \} catch \(_\) \{\}/, 'الكنس لسه بيقفل بـchrome.tabs.remove العاري');
  assert.ok(!/chrome\.tabs\.remove/.test(queue), 'لسه في remove عاري في queue — آخر تاب = قفل نافذة = قفل كروم');
  assert.match(read('src/background/core/tabctl.js'), /win && win\.tabs && win\.tabs\.length <= 1/, 'حماية آخر تاب مش في tabctl');
});

test('v1205: التسريع الآمن متقفل بالأرقام — والافتراضي القديم بيتهاجر لـ30 ثانية', () => {
  const sched = read('src/background/core/scheduler.js');
  assert.match(sched, /: 5500 \+ Math\.floor\(Math\.random\(\) \* 3500\);/, 'المهلة قبل الكلمة مش على مقاس 1.20.5');
  assert.match(sched, /const cold = !!\(context && context\.cold\);/, 'الفصل بين الوضعين مش في الـscheduler؟');
  assert.match(serp, /await D\.humanSleep\(900, 450\);/, 'فاصل الدفعات اتسارع تحت الحد الآمن؟');
  assert.match(st, /cooldownMs: 30000,/, 'الافتراضي الجديد مش 30 ثانية');
  assert.match(st, /if \(parseInt\(cfg\.cooldownMs, 10\) === 45000\) \{ patchCfg\.cooldownMs = 30000; \}/, 'مفيش ميجريشن من الـ45000 القديم');
  assert.match(queue, /const extra = 8000 \+ Math\.floor\(Math\.random\(\) \* 6000\);/, 'تبريد الحرارة لسه 12–21 ثانية');
  assert.match(read('beyondten/content/index.js'), /\}, 4000\); \/\/ v1\.2\.2/, 'الشاشر لسه كل 5 ثواني');
});

/* ---------------- v1.20.4 — الإنقاذ مبينبش لكلام المنسّق، ينبح للصفحة ---------------- */

test('v1204: صفحة سيرب سليمة بعد «فشل» المنسق = تسجيل فوري، لا ريفرش ولا مسح بيانات', () => {
  // نداء الإنقاذ برا بلوك solved — قبل التصعيد مباشرة
  const idxRescue = queue.indexOf("const rescue = await this.softRescueAfterCaptcha");
  const idxEscal = queue.indexOf("if (captchaClears >= maxClears)");
  assert.ok(idxRescue > -1 && idxEscal > -1 && idxRescue < idxEscal, 'الإنقاذ لسه مش قبل التصعيد');
  // الميثود بتتحقق من الـ URL مش من رايات المحلول
  const m = queue.slice(queue.indexOf('async softRescueAfterCaptcha'), queue.indexOf('ضمان تاب واحد'));
  assert.match(m, /urlkit\.isSorry\(urlNow\)/, 'مفيش فحص URL في الإنقاذ');
  assert.ok(m.indexOf('browsingData') === -1, 'الإنقاذ بيلمس داتا — ده الجحيم اللي كان بيضرب الـ100 extension');
  assert.ok(m.indexOf('tabctl.open') === -1, 'الإنقاذ بيفتح تاب جديد — كان لازم يبقى نفس التاب');
  assert.match(m, /for \(let i = 0; i < 5; i\+\+\)/, 'مفيش استنانة أخيرة للمسح الشغال قبل الريستارت');
  // الشارة حتى في الفشل:
  assert.match(queue, /الصف يطلع من شارة «CAPTCHA» حتى مع الفشل/, 'شارة الكابتشا بتفضل بعد فشل الحل والسيرب طالع');
});

/* ---------------- v1.20.3 — الكابتشا اتحلت والنتيجة موجودة؟ مفيش دوامة ريفرش ---------------- */

test('v1203: التحليل المتأخر بعد الحل ليه مهلة كامل المسح + إنقاذ ليّن بدون لمس داتا', () => {
  assert.match(queue, /const grace = C\.LIMITS\.SERP_AFTER_CAPTCHA_MS \+ \(cfg && cfg\.selfFetchMore === false \? 0 : 90000\);/,
    'collectAfterSolve لسه بياخد 100 ثانية بس — هيفوت مسح بطيء');
  assert.match(queue, /async collectAfterSolve\(tabId, sinceTs, signal, cfg\)/, 'الـ cfg مش داخلة على نافذة ما بعد الحل');
  assert.ok(!/collectAfterSolve\(tab\.id, solveStartedAt, signal\)[,)]/.test(queue), 'لسه في نداء collectAfterSolve من غير cfg');
  assert.match(queue, /captcha-solved-late/, 'مفيش سجل من الكاش للتأخير البسيط');
  assert.match(queue, /captcha-solved-reload/, 'مفيش فرصة reload ليّنة قبل التصعيد');
  assert.match(queue, /🩹 إنقاذ بعد الحل/, 'المستخدم مش بيتبشر إن النتيجة اتأنقذت');
  assert.match(queue, /softRescueAfterCaptcha\(tab\.id, kw, cfg, signal, solveStartedAt\)/, 'الإنقاذ لسه محبوس جوه solved فقط');
  // الإنقاذ الليّن نفسه ما بيمسحش داتا (v1.20.4: بقا ميثود مستقلة)
  const soft = queue.slice(queue.indexOf('async softRescueAfterCaptcha'), queue.indexOf('ضمان تاب واحد'));
  assert.ok(soft.indexOf('browsingData') === -1, 'مسار الإنقاذ الليّن بيلمس browsingData — ده بالظبه اللي كان بيضرب الـ100 extension');
  assert.ok(soft.indexOf('tabctl.reload') > -1, 'مفيش ريفرش ليّن لنفس التاب');
  // الشارة: أول ما الحل يتم الصف يطلع من CAPTCHA
  assert.match(queue, /الصف يتحرر من شارة الكابتشا فور الحل/, 'شارة الكابتشا بتفضل على الكلمة بعد الحل');
});




/* ---------------- v1.21.0 — الطقم المرافق كامل: مانيفستات، أمان بصمة، وخفة حركة ---------------- */

test('v1210: الطقم كامل — مانيفستات للإضافات المرافقة الثلاثة وقواعد أمان معقولة', () => {
  for (const dir of ['beyondten', 'gsloc', 'serpcounter']) {
    const man = JSON.parse(read(dir + '/manifest.json'));
    assert.equal(man.manifest_version, 3, dir + ' مش MV3');
    assert.ok(man.name && man.version && man.description, dir + ' مانيفست ناقص بيانات');
    if (dir !== 'gsloc') {
      const cs = man.content_scripts[0];
      assert.match(cs.matches[0], /google\.\*\/search/, dir + ' بيحقن بره صفحات البحث');
    }
  }
  const btMan = JSON.parse(read('beyondten/manifest.json'));
  const js = btMan.content_scripts[0].js;
  assert.ok(js.indexOf('content/index.js') > js.indexOf('content/state.js'), 'ترتيب حقن state مكسور');
  assert.ok(js.indexOf('content/renderer.js') < js.indexOf('content/index.js'), 'الريندرر لازم يسبق index');
  assert.ok(!JSON.parse(read('serpcounter/manifest.json')).permissions.includes('tabs'), 'serpcounter بتطلب tabs وهي DOM-only');
});

test('v1210: gsloc — الهيدر على صفحات البحث بس، والمستمع مرة واحدة، والقواعد بتعايش الـUpdate', () => {
  const bg = read('gsloc/js/background.js');
  assert.match(bg, /"urlFilter": "google\.com\/search"/, 'الفلترة لسه على كل google.com');
  assert.ok(!/"image"/.test(bg) && !/"xmlhttprequest"/.test(bg) && !/"ping"/.test(bg), 'resourceTypes لسه بتغطي صور/xhr/ping — بصمة');
  assert.equal((bg.match(/chrome\.contextMenus\.onClicked\.addListener/g) || []).length, 1, 'مستمع الكليك بيتسجل أكتر من مرة');
  assert.match(bg, /chrome\.runtime\.onInstalled\.addListener/, 'مفيش إعادة تطبيق قواعد بعد update/ريستارت');
  assert.match(bg, /knownPlaces\.length = 0;/, 'دمج knownPlaces لسه بيسيب شوائب');
  assert.ok(!/console\.log\(details\)/.test(bg), 'لوجات حذف الكوكيز لسه صابحة الكونسول');
});

test('v1210: serpcounter — ديباونس، تعقيم لون، هوست أمتن، وكونسول صامت', () => {
  const cs = read('serpcounter/content.js');
  assert.match(cs, /function scheduleRerender\(\)/, 'مفيش تجميع لإعادة الترقيم');
  assert.match(cs, /\}, 400\);/, 'الديباونس مش 400ms');
  assert.match(cs, /\/\^#\[0-9a-fA-F\]\{3,8\}\$\//, 'لون innerHTML مش معقّم');
  assert.match(cs, /closest\('\.g, \.tF2Cxc, \.MjjYud'\)/, 'سلسلة الآباء المقادة لسه موجودة');
  assert.ok(!/console\.log/.test(cs), 'لسه في لوجات كونسول');
  assert.ok(!/addEventListener\("scrollend"/.test(cs), 'scrollend لسه مسمّر — المسح الآلي بيفوّته');
  assert.match(cs, /addEventListener\("scroll", scheduleRerender, \{ passive: true \}\)/, 'السكرول مش passive/مجمّع');
  for (const f of ['serpcounter/styles.css', 'gsloc/css/styles.css']) {
    assert.ok(!/fonts\.googleapis|bootstrapcdn/.test(read(f)), f + ' لسه بيسحب من CDN');
  }
});

/* ---------------- v1.21.1 — المكررات مواطنون من الدرجة الأولى: صف لكل سطر ---------------- */

test('v1211: الاستيراد ما بيرميش سطر — المكرر صف مستقل بنفس المكانة', () => {
  assert.ok(!/reset \+= 1;/.test(st), 'لسه في إعادة تدوير للصف الموجود بدل إضافة المكرر');
  assert.match(st, /المكررات مالهاش حذف ولا دمج/, 'نوايا الحذف مش موثقة في الكود');
  assert.match(st, /return \{ added: added, reset: 0 \};/, 'الشكل القديم لسه بيرجّع reset');
  // النسخ بيمشي على صفوف المستخدم واحد واحد — متأكد من قفل سابق، وده مسمار التكرار
  assert.match(panel, /function exportEntriesInUserOrder/, 'مفيش بناء تصدير بترتيب المستخدم');
  const fn = panel.slice(panel.indexOf('function exportEntriesInUserOrder'), panel.indexOf('async function copyTsv'));
  assert.ok(fn.length > 0 && !/new Set\(/.test(fn), 'في Set دامج جوه بناء النسخ — المكررات هتتبلع');
});

test('v1211: المكرر في نفس الرن — نسخة ذكية من غير ضريبة ثانية على جوجل', () => {
  assert.match(queue, /duplicate-row/, 'مفيش مسار نسخ للمكرر');
  assert.match(queue, /k\.status === C\.STATUS\.KW\.DONE && k\.lastCheckedAt && k\.lastCheckedAt >= run0\.startedAt/,
    'النسخ مش مشروط بس بصف ناجح من نفس الرن');
  assert.match(queue, /♻️ \"\$\{kw\.keyword\}\" — متطابقة مع صف/, 'مفيش سجل للمكرر المنسوخ');
  assert.ok(queue.indexOf('run0.startedAt') < queue.indexOf('maybePeriodicClear(cfg)'), 'النسخ بيحصل بعد الشغل التقيل — يلزم يسبقه');
  assert.match(queue, /await state\.addResult\(Object\.assign\(\{\}, srcRow/, 'صف التصدير مابياخدش النسخة — تبوظ في تصدير النتائج');
  // من غير عدّاد يومي ومن غير ريندرز إضافية: الطلب ما اتعملش أصلًا
  const seg = queue.slice(queue.indexOf('const run0 = await state.getRun();'), queue.indexOf('// مسح دوري ذكي'));
  assert.ok(seg.indexOf('bumpDailyCount') === -1, 'المكرر المنسوخ بيحسب على السقف اليومي وهو مابعملش طلب');
  assert.ok(seg.indexOf('return \'done\';') > -1, 'المسار مش بيرجعل اللفة بـ done');
});

/* ---------------- v1.21.2 — لا تاب جديد على سلام + التحدي البايّت ليه ريلود ---- */

test('v1212: بعد التبريد — نظرة على الصفحة نفسها قبل المسح والتاب الجديد', () => {
  const gap = queue.slice(queue.indexOf('await sleep(restSec * 1000, signal);'), queue.indexOf('const nextTab = await this.openFreshTab'));
  assert.ok(gap.length > 50, 'مفيش فجوة تبريد→تاب جديد؟');
  assert.match(gap, /softRescueAfterCaptcha\(tab\.id, kw, cfg, signal, solveStartedAt\)/,
    'الصفحة ماتتبعتش بعد التبريد قبل ما نضرب المسح — ده بيولد تاب جديد على SERP سليم');
  assert.match(gap, /-cooldown-calm'\);/, 'مسار الهدوء مش متوثق في الـvia؟');
  assert.match(gap, /return this\.recordResult\(kw, calm\.payload, cfg,/, 'الصفحة السليمة مالهاش تسجيل مباشر من جوه الفجوة');
  assert.ok(!/recordExhausted/.test(gap), 'إعادة الفحص ما ينفعش تتحول استسلام');
  assert.ok(!/openFreshTab/.test(gap), 'تاب جديد قبل إعادة الفحص = القفل اتكسر');
});

test('v1212: «challenge expired» — ريلود لطيف لنفس التاب، والصبر يفضل سايب للكلمة حقها', () => {
  assert.match(queue, /check the checkbox again/, 'كاشف رسالة الإنجليزية ناقص');
  assert.match(queue, /انتهت صلاحي|انتهت فترة/, 'كاشف الرسالة العربية ناقص');
  assert.match(queue, /chrome\.scripting\.executeScript/, 'المسبار لازم قراءة نقية من الـSW (مفيش مساس بمحرك الحل)');
  const wcc = queue.slice(queue.indexOf('async waitCaptchaCleared'), queue.indexOf('async tabChallengeLooksStale'));
  assert.match(wcc, /Date\.now\(\) - lastStale > 90000/, 'مفيش معدل بحد أقصى للريلود (90 ث) — reload loop بصمة');
  assert.match(wcc, /waited > 20 &&/, 'ريلود قبل ما Buster/المستخدم ياخدوا فرصتهم؟');
  assert.match(wcc, /tabctl\.reload\(tabId\)/, 'الريلود يلزمه لنفس التاب');
  assert.ok(!/openFreshTab/.test(wcc) && !/recordExhausted/.test(wcc), 'الصبر اتحول هروب — ممنوع (1.20.0)');
  // المحرك المتجمد سايب مكانه
  const cap = read('src/content/captcha.js');
  assert.ok(!/tabChallengeLooksStale|challenge \(has \)?expired/.test(cap), 'captcha.js اتلمس — ممنوع');
});

/* ---------------- v1.21.3 — نبضة 30 ثانية، شفاء الشارات، وسرعة يدوي في البرد ---------- */

const sched = read('src/background/core/scheduler.js');
const swf = read('src/background/sw.js');

test('v1213: watchdog بنبض 30 ثانية + شفاء الصفوف المعلقة في مسارَي الاستئناف', () => {
  assert.match(queue, /chrome\.alarms\.create\('srt-watch', \{ delayInMinutes: 0\.5 \}\)/,
    'ساعة الحراسة لسه رجاعة كل دقيقتين — نافذة «النوم الغامض» 4 أضعاف المطلوب');
  assert.match(queue, /async healStaleBadges\(\)/, 'مفيش دواء للشارات الميتة (running/captcha بلا صاحب)');
  assert.match(queue, /status === C\.STATUS\.KW\.RUNNING \|\| k\.status === C\.STATUS\.KW\.CAPTCHA/,
    'الشفاء مالوش في الحالتين الاتنين؟');
  assert.match(queue, /await this\.healStaleBadges\(\);\n      this\.loop\(\);/, 'watchdog مابيشفيش قبل الاستئناف');
  const boots = (swf.match(/await engine\.healStaleBadges\(\); \/\/ v1\.21\.3/g) || []).length;
  assert.equal(boots, 2, 'مسار استئناف تاني في sw.js نسياناه — الاستيقاظ من النوم الاتنين لازم يعالجوا');
});

test('v1213: ⚡ وضع بارد بإيقاع يدوي — وبأول كابتشا رجوع كامل للإيقاع الآمن', () => {
  assert.match(sched, /const cold = !!\(context && context\.cold\);/, 'الفصل بين الوضعين مش في الـscheduler؟');
  assert.match(sched, /cold\s*\n?\s*\?\s*700 \+ Math\.floor\(Math\.random\(\) \* 900\)/, 'فاصل الوضع البارد مش على مقاس 1.21.9');
  assert.match(sched, /5500 \+ Math\.floor\(Math\.random\(\) \* 3500\)/, 'الإيقاع الآمن الدافي اتبوظ — ده ممنوع');
  assert.match(queue, /cold: \(this\.captchaHeat \|\| 0\) === 0/, 'النداء مابيحكيش حالة الحرارة');
  // الحرارة بتبرد كلمة بكلمة (قفل سابق لسه شغال) → الوضع البارد بيرجع لوحده بعد العاصفة
  assert.match(queue, /this\.captchaHeat -= 1;/, 'التبريد التلقائي للحرارة اتشال');
  assert.match(queue, /if \(this\.captchaHeat >= 2\)/, 'تبريد الاستراحة الإضافي اتلمس — ممنوع');
  // داخل المنطقة المتجمدة: مفيش أي تسريع لمسار الكابتشا
  assert.match(queue, /const cool = 8000 \+ Math\.floor\(Math\.random\(\) \* 6000\);/, 'تهدئة ما بعد الحل اتبوظت — ممنوع');
  assert.ok(!/cold/.test(queue.slice(queue.indexOf('async collectAfterSolve'), queue.indexOf('async softRescueAfterCaptcha'))), 'وضع بارد تسرّب لمسار الحل');
});

/* ---------------- v1.21.4 — الحرارة العالقة على 1 كانت بتلغي الوضع البارد ---------- */

test('v1214: heat==1 بتطفّى بكلمة نضيفة (كانت أبدية) — والبارد بقى سرعة يدوي حقيقية', () => {
  assert.match(queue, /else if \(this\.captchaHeat === 1\) \{/, 'لسه الحرارة على 1 مش بتنزل — الوضع البارد مستحيل ييجي');
  assert.match(queue, /this\.captchaHeat = 0;/, 'التصفير مش مسجل نفسه');
  assert.match(sched, /: 5500 \+ Math\.floor\(Math\.random\(\) \* 3500\);/, 'الإيقاع الدافي اتبوظ — ممنوع');
  assert.match(sched, /cold\s*\n?\s*\?\s*700 \+ Math\.floor\(Math\.random\(\) \* 900\)/, 'البارد مش على 0.7–1.6 (v1.21.9)');
});

test('v1214: نزول المسح الطويل اتخفّف — من غير لمس توقيتات الكابتشا المقدسة', () => {
  assert.match(serp, /cfg\.rescanMs \|\| 800/, 'ريسكان مش على 800 (v1.21.9)');
  assert.match(serp, /cfg\.settleMs \|\| 1100/, 'سجل التثبيت لسه 1800');
  // المتجمد: تهدئة ما بعد الحل، 3.5 ثانية ما بعد السولف، فاصل الدفعات، وستل-الدفعة الطويل
  assert.match(queue, /const cool = 8000 \+ Math\.floor\(Math\.random\(\) \* 6000\);/, 'تهدئة بعد الحل اتلمست — ممنوع');
  assert.match(queue, /await sleep\(3500, signal\); \/\/ v1\.20\.5/, 'راحة ما بعد السولف اتلمست — ممنوع');
  assert.match(serp, /await D\.humanSleep\(900, 450\);/, 'فاصل الدفعات موحد على مقاس 1.21.9 مش أكتر');
  assert.match(serp, /cfg\.batchSettleMs \|\| 5000/, 'ستل الدفعات اتلمس — ممنوع');
});

/* ---------------- v1.21.5 — أول شاشة كاملة قبل الحكم + المسح الدوري تحت المجهر ---- */

test('v1215: اللقطة الأولى الناقصة مابتنهيش — 8 بلوكات أو 4 ثواني polling خفيف', () => {
  assert.match(serp, /if \(h && h\.where === 'organic'\) \{ early = \{ items: snap\.items, ai: ai, hit: h \}; return true; \}/,
    'خروج فوري عند أول لقطة عضوية — لازم يفضل أسرع مسار');
  assert.match(serp, /if \(snap\.items\.length >= 8\) \{ return true; \}/, 'سقف جاهزية أول شاشة ناقص');
  assert.match(serp, /return firstPolls >= 16;/, 'سقف الـ4 ثواني (16×250ms) ناقص — polling من غير سقف يعلّق');
  assert.match(serp, /let firstPolls = 0;/, 'العدادش متعرفش');
  // الدفعات الجاية مش بتتلغى للمتاجر الغايبة — لسه تغطية #20-#100 كاملة
  assert.match(serp, /cfg\.selfFetchMore !== false && items\.length < expectedNum/, 'تغطية الدفعات اتقطعت — ممنوع (1.19.8)');
});

test('v1215: المسح الدوري — قبل البدء وكل N كلمات — آليات مقفولة', () => {
  assert.match(st, /clearBeforeRun: true,/, 'مسح ما قبل البدء اتطفي من الافتراضي');
  assert.match(queue, /processed - marker >= everyN/, 'عدّاد الـN اتبوظ — المسح الدوري بيتعمل بكل كلمة أو لأبد');
  assert.match(queue, /if \(!everyN\) \{ return; \}/, 'التعطيل بـ0 مش متعامل معاه');
  assert.match(queue, /run\.clearMarker \|\| 0/, 'الماركر اللي بيمنع تكرار المسح لنفس العدد اتشال');
  // قيمة المستخدم 10 بقى ليها احترام: الميجريشن واحدة بس (v<4) وماراجعةش تاني
  const mig = st.slice(st.indexOf('if (version < 4)'), st.indexOf('if (version < 6)'));
  assert.match(mig, /cn === 10\) \{ patchCfg\.clearEveryN = 8; \}/, 'ميجريشن 10→8 اتشالت من مكانها');
});

/* ---------------- v1.21.6 — الموقع = السعودية كلها… ومفيش تحديد الرياض ------------- */

const emb = read('src/background/embedded.js');
const gsl = read('gsloc/js/background.js');

test('v1216: ديفولت الأدوات المدمجة بقى قطري عام — نقطة مركز المملكة وقطر 1000كم', () => {
  assert.match(emb, /location: 'Saudi Arabia',\n\s+name: 'Saudi Arabia',/, 'الديفولت لسه مسمّى مدينة');
  assert.match(emb, /latitude: 24\.0,\n\s+longitude: 45\.0,/, 'نقطة المركز الجغرافي ما اتظبطتش');
  assert.match(emb, /radius: 1000000,/, 'قطر البلد (1000كم) ناقص من الديفولت');
  assert.match(emb, /placeId: 'KSA-COUNTRY',/, 'الـplaceId لسه بتاع الرياض');
  // هجرة ديفولت الرياض القديم — بشرط إنه لسه ديفولتنا (مو اختيار Places ولا وضع معطّل)
  assert.match(emb, /s\.name === 'Riyadh' && s\.location === 'Riyadh, Saudi Arabia' && s\.enabled !== false/, 'مفيش ترقية للديفولت الرياض القديم');
  // اختيار المستخدم من Places محترم: الشرط التاني بس في الـif&&!s، ماعدا ديفولتنا ما بنكتبش فوق حد
  assert.match(emb, /if \(!s\) \{ chrome\.storage\.sync\.set\(\{ settings: saudiDefaults \}\); return; \}/, 'زرع أول تشغيل اتبوظ');
});

test('v1216: x-geo بيقرأ القطر من الإعدادات — 65كم الافتراضي التاريخي لمدين Places لسه هو الاحتياطي', () => {
  assert.match(gsl, /var rad = parseInt\(settings\.radius, 10\) \|\| 65000;/, 'القطر ثابت على 65000 تاني — المدينة هتفضل متحددة');
  assert.match(gsl, /radius: '\+rad\+'\\nlatlng/, 'القالب مابيكملش القطر المتغير');
  assert.ok(!/radius: 65000[^;]/.test(gsl), 'في قالب تاني لسه متجمد على 65000');
});

/* -------- v1.21.7 — needsReview + مسار مراجعة أوتوماتيك + preflight/تقرير + ريندر diff -------- */

test('v1217: الاستنفاد بقى «⚠️ محتاج مراجعة» وجولتَي استشفاء بمسح+تاب جديد قبله', () => {
  const rex = queue.slice(queue.indexOf('async recordExhausted'), queue.indexOf('async reviewPass'));
  assert.match(rex, /updateKeyword\(kw\.id, \{ needsReview: true \}\)/, 'الراية مش بتتعلّم عند الاستنفاد');
  assert.match(rex, /const out = await this\.recordResult/, 'التسجيل نفسه اتبوظ');
  // الراية مش بتتعلّم في غير الاستنفاد: الشطف الوحيد التاني هو التطفي عند إعادة الفحص
  const flags = (queue.match(/needsReview: true/g) || []).length;
  assert.equal(flags, 1, 'needsReview: بتتعلّم أكتر من مرة — المفهوم اتلطش');
  assert.match(queue, /for \(let pass = 0; pass < 2; pass\+\+\)/, 'مفيش جولتَي استشفاء على نفس الكلمة');
  assert.match(queue, /15000 \+ Math\.floor\(Math\.random\(\) \* 8000\)/, 'التبريد الطويل قبل الجولة التانية ناقص');
  assert.match(queue, /'new-tab-2' : 'new-tab'/, 'الجولة التانية بتسجل بنفس via الأولى؟');
  // الصبر الأبدي ما اتلمسش: الاستشوفاء داخله waitCaptchaCleared زي الأول
  const rec = queue.slice(queue.indexOf('for (let pass = 0; pass < 2'), queue.indexOf('محتاج مراجعة» وهتتعاد'));
  assert.match(rec, /waitCaptchaCleared\(tab\.id, kw, signal\)/, 'جولة الاستشفاء فصلت الصبر على الكابتشا — ممنوع');
  assert.match(rec, /after-patience/, 'سجل الصبر التاف بعد الاستشفاء اتشال');
});

test('v1217: مسار المراجعة الأوتوماتيك في آخر الرن + زر يدوي + تقرير وإحصاءات', () => {
  const tail = queue.slice(queue.indexOf('const exhausted = this.index'), queue.indexOf('✅ انتهى فحص كل الكلمات'));
  assert.match(tail, /await this\.reviewPass\(\);/, 'مفيش مراجعة أوتوماتيك قبل الحكم بـIDLE');
  assert.match(tail, /if \(runB\.status !== C\.STATUS\.RUN\.RUNNING\) \{ return; \}/, 'حارس الإيقاف أثناء المراجعة ناقص');
  assert.match(tail, /await this\.recordRunReport\(runB\);/, 'التقرير ماتسجلش');
  assert.match(queue, /async reviewPass\(manual\)/, 'دالة المراجعة مش موجودة');
  assert.match(queue, /async manualReview\(\)/, 'الزر اليدوي وراه مفيش حركة');
  assert.match(queue, /reason: 'running'/, 'الحماية من التعارض مع رن شغال اتشالت');
  assert.match(st, /RUN_STATS: 'srt\.runStats',/, 'مفتاح الإحصاءات مش في state');
  assert.match(st, /if \(list\.length > 20\)/, 'سقف الـ20 رن — التخزين بينفجر');
  assert.match(queue, /expectedNum: serp\.expectedNum \|\| 0/, 'صف النتيجة مابيحفظش التغطية');
});

test('v1217: بريفلايت وتقدير وقت + ريندر diff خفيف للوحة', () => {
  assert.match(cons, /PREFLIGHT: 'srt\/preflight'/, 'رسالة البريفلايت مش مسجلة');
  assert.match(cons, /QUEUE_REVIEW: 'srt\/queue\/review'/, 'رسالة المراجعة مش مسجلة');
  assert.match(queue, /async preflight\(\)/, 'الدالة مش موجودة');
  assert.match(queue, /const recent = stats\.slice\(-5\)/, 'التقدير مش بمتوسط آخر 5 رنات');
  assert.match(panel, /let lastRenderSig = '';/, 'البصمة مش معرّفة');
  assert.match(panel, /if \(sig === lastRenderSig\) \{ return; \}/, 'الحارس مش راجع');
  assert.ok(!/loadPreflight|etaHint|preflightWarn|runReport/.test(panel), 'شرايط الواجهة لسه عايشة — المستخدم قرر حذفها في 1.21.9');
  const pnlHtml = read('src/sidepanel/side-panel.html');
  assert.ok(!/btnReview/.test(pnlHtml), 'زر المراجعة رجع للـHTML — المستخدم شاله في 1.21.11');
  assert.ok(!/fonts\.googleapis/.test(pnlHtml), 'لينك خط خارجي رجع — CSP بيرميه');
});

/* -------- v1.21.8 — التحدي البايّت العنيد: نفس وصفة البلوك (مسح + تاب جديد بنفس الكلمة) -------- */

test('v1218: expired بعد ريلودين = تسليم للخطة الاحتياطية، بسقف رحيم للرن', () => {
  const wcc = queue.slice(queue.indexOf('async waitCaptchaCleared'), queue.indexOf('async tabChallengeLooksStale'));
  assert.match(wcc, /let staleReloads = 0;/, 'عداد الريلودات مش موجود');
  assert.match(wcc, /if \(staleReloads >= 2\) \{/, 'الريلود للأبد من غير تصعيد؟');
  assert.match(wcc, /return 'stale';/, 'ما بيسلّمش للإشارة الجديدة');
  assert.ok(!/recordExhausted/.test(wcc) && !/openFreshTab/.test(wcc), 'الصبر بقى بيهرب أو بيفتح تابات من جوه نفسه — التسليم للنداء مش له');
  const idx = queue.indexOf("if (cleared === 'stale') {");
  assert.ok(idx > -1, 'نداء الصبر مابيتعاملش مع stale');
  const seg = queue.slice(idx, queue.indexOf("if (cleared === 'tab-closed')"));
  assert.match(seg, /staleWipesThisRun \|\| 0\) >= 6/, 'سقف المسحات في الرن اتنسي');
  assert.match(seg, /openFreshTab\(kw, cfg, url, tab\.id\)/, 'مفيش مسح+تاب جديد بنفس الكلمة');
  assert.match(seg, /captchaClears = 0; \//, 'الميزانية الكاملة مالترجعتش للكلمة بعد الجلسة النضيفة');
  assert.ok(!/recordExhausted/.test(seg), 'stale بتسجل استسلام — ممنوع');
  // استشفاء الجولتين: stale بيرمي للجولة اللي بعدها
  assert.match(queue, /else if \(clearedL === 'stale'\) \{\n\s+break;/);
  // الثوابت: مفيش windows.create ومفيش توقيتات جديدة لمسار الحل نفسه
  assert.ok(!/chrome\.windows\.create/.test(queue), 'نافذة جديدة — ممنوع');
  assert.match(queue, /await sleep\(4000, signal\);\n        \}/, 'نوم الصبر الأساسي اتبوظ');
});

/* -------- v1.21.9 — قفزة واحدة بدل السكرول، Cairo محلي، زر الضبط، سرعة آمنة -------- */

test('v1219: مفيش سكرول متقطع قدام المستخدم — قفزة واحدة وربّتة كل 3 دورات', () => {
  assert.ok(!/window\.scrollBy/.test(serp), 'scrollBy رجع — المنظر ده المستخدم منعه بنصه');
  assert.match(serp, /let diveStarted = false;/, 'راية القفزة الأولى مش موجودة');
  assert.match(serp, /let diveNudges = 0;/, 'عداد الربّتة مش موجود');
  assert.match(serp, /diveNudges % 5 === 0/, 'الربّتة مش كل 5 دورات (1.21.15) — أد إيه هتدوش؟');
  assert.ok((serp.match(/window\.scrollTo\(\{ top: document\.body\.scrollHeight/g) || []).length === 2, 'مفروض قفزتان بالظبط: أولى للآخر + ربّتة شرطية');
  assert.match(serp, /relock\(\);\n\n    \/\/ 3\) حكم/, 'مفيش relock قبل حكم عدم الوجود — المستخدم هيتلسع بمنظر تحت');
  assert.match(serp, /cfg\.rescanMs \|\| 800/, 'ريسكان مش على 800');
});

test('v1219: الواجهة اتنظفت — مكان الشرايط زرار إعادة ضبط، والمراجعة سايبها زي ما هي', () => {
  const pnlHtml = read('src/sidepanel/side-panel.html');
  assert.ok(!/etaHint|preflightWarn|runReport|eta-hint/.test(pnlHtml), 'شريط من التلاتة رجع للـHTML');
  assert.match(pnlHtml, /id="btnReset"/, 'زر إعادة الضبط مش في الـHTML');
  assert.ok(!/btnReview/.test(pnlHtml), 'زر المراجعة لسه في الواجهة — قرار 1.21.11');
  assert.match(panel, /\$\('btnReset'\)/, 'الزر مش موصول بالـlistener');
  assert.match(panel, /C\.MSG\.CONFIG_RESET/, 'الزر مابيبعتش الرسالة');
  assert.match(panel, /confirm\(/, 'ضبط المصنع من غير تأكيد؟ مجزرة');
  assert.match(cons, /CONFIG_RESET: 'srt\/config\/reset'/, 'الرسالة مش مسجلة في الثوابت');
  const brd = read('src/background/core/bridge.js');
  assert.match(brd, /CONFIG_RESET: 'srt\/config\/reset'/, 'مرآة الـbridge مفقودة');
  const rtr = read('src/background/core/router.js');
  assert.match(rtr, /case C\.MSG\.CONFIG_RESET/, 'مفيش handler في الراوتر');
  assert.match(st, /export async function resetConfig\(\)/, 'state مافيهاش دالة الضبط');
  assert.match(st, /local\.set\(K\.CONFIG, Object\.assign\(\{\}, DEFAULT_CONFIG\)\)/, 'الضبط ما بيكتبش نسخة من المصنع');
});

test('v1219: Cairo جوه الإضافة — ملفات حية، @font-face، وصفر لينكات خارجية', () => {
  const css = read('src/sidepanel/side-panel.css');
  assert.ok((css.match(/@font-face/g) || []).length === 3, 'مفروض 3 نطاقات unicode: عربي + لاتيني + ممتد');
  assert.ok(!/url\(https?:|@import/.test(css), 'مصدر خط خارجي رجع للـCSS');
  const fontsDir = join(root, 'src/sidepanel/fonts');
  const files = readdirSync(fontsDir).filter((f) => f.endsWith('.woff2'));
  assert.equal(files.length, 3, 'عدد ملفات الخط مش 3');
  for (const f of files) {
    assert.ok(fs.statSync(join(fontsDir, f)).size > 15000, 'ملف خط مهزوز: ' + f);
  }
  const pnlHtml2 = read('src/sidepanel/side-panel.html');
  assert.ok(!/fonts\.(googleapis|gstatic)|rel="preconnect"/.test(pnlHtml2), 'لينك خارجي رجع للوحة');
});

test('v1219: السرعة الجديدة مطبقة — والممنوعات Sacred زي صخورها', () => {
  const sch = read('src/background/core/scheduler.js');
  assert.match(sch, /\?\s*700 \+ Math\.floor\(Math\.random\(\) \* 900\)/, 'البارد 0.7–1.6 مش مطبق');
  assert.match(sch, /5500 \+ Math\.floor\(Math\.random\(\) \* 3500\)/, 'دفء الكابتشا اتلمس — ممنوع');
  assert.match(serp, /await D\.humanSleep\(900, 450\);/, 'فاصل الدفعات 0.9–1.8 مش مطبق');
  assert.match(serp, /await D\.humanSleep\(600, 250\);/, 'توسيع AI مش على مقاس 1.21.9');
  assert.match(queue, /await sleep\(4000 \+ Math\.floor\(Math\.random\(\) \* 4000\), signal\);/, 'فاصل المراجعة 4–8 مش مطبق');
  assert.match(serp, /cfg\.settleMs \|\| 1100/, 'سجل التثبيت اتلمس — لأ');
});

/* -------- v1.21.10 — وداعًا سرقة التركيز: البروفايل التاني بيتكتب؟ سيبه فوق -------- */

test('v12110: رفع النافذة اتشال من التركيز الآلي — التنشيط جوه نافذة البروفايل بس', () => {
  const tc = read('src/background/core/tabctl.js');
  assert.ok(!/windows\.update/.test(tc), 'رجع يرفع النافذة فوق شغل المستخدم — ممنوع من 1.21.10');
  assert.match(tc, /chrome\.tabs\.update\(tabId, \{ active: true \}\);/, 'تنشيط التاب اتشال معه — جوجل هيختنق والتايمينج هتتبطأ');
  // قفزة المستخدم اليدوية من اللوحة لازم تفضل رافعة النافذة — هو اللي طالبها
  const pnl = read('src/sidepanel/side-panel.js');
  assert.match(pnl, /chrome\.windows\.update\(tab\.windowId, \{ focused: true \}\)/, 'قفزة المستخدم اليدوية اتبوظت');
  // مسار الصبر/الكابتشا مابيحاولش يرفع النافذة من حتة تانية
  assert.ok(!/windows\.update/.test(queue), 'queue.js بيلف على الحظر من باب تاني');
});

/* -------- v1.21.11 — وداعًا زر المراجعة، تنضيف الطابع، والهوية على البوب‌أب -------- */

test('v12111: مفيش زرار مراجعة — المسح الآلي في المكنة بس، وإعادة الضبط سطر كامل تحت الأزرار', () => {
  const pnlHtml11 = read('src/sidepanel/side-panel.html');
  assert.ok(!/btnReview/.test(panel), 'listener الزرار رجع من غير صاحبه');
  const cs = pnlHtml11.indexOf('<section class="controls">');
  const ce = pnlHtml11.indexOf('</section>', cs);
  assert.ok(cs > -1 && ce > cs, 'مش لاقين قسم الأزرار');
  const ctl = pnlHtml11.slice(cs, ce);
  assert.ok(ctl.indexOf('id="btnReset"') > ctl.indexOf('id="btnStop"'), 'إعادة الضبط مش آخر سطر تحت أزرار التشغيل');
  assert.ok(ctl.indexOf('id="btnReset"') > -1 && /btn-reset/.test(ctl), 'الزر مش لابس كلاس السطر الكامل');
  const css11 = read('src/sidepanel/side-panel.css');
  assert.match(css11, /\.btn-reset \{ grid-column: 1 \/ -1;/, 'قاعدة السطر الكامل في النص مش موجودة');
  assert.ok(!/tools-row/.test(pnlHtml11), 'div الشدة القديم رجع');
  // المسار الآلي والسجلات لسه أحياء
  assert.match(queue, /async reviewPass\(manual\)/, 'المراجعة الأوتوماتيك اتشالت مع الزرار — لا');
});

test('v12111: صفر إيموجي زينة في الواجهة والقاموس، والإنجليزي مترجم كامل وزر اللغة AR', () => {
  const pnlHtml11 = read('src/sidepanel/side-panel.html');
  assert.ok(!/\uD83D\uDCAF|\uD83C\uDFAF|\uD83D\uDD11|\uD83D\uDD04|\uD83D\uDD01|⚠️|\uD83D\uDCCA|\uD83D\uDDA5|▶|⏸|⏩|⏹|\uD83D\uDCC4|\uD83D\uDDD1|⬇|\uD83D\uDCCB|\uD83D\uDCDD|☢|\uD83C\uDF0D|⟳|＋/.test(pnlHtml11), 'إيموجي رجع للواجهة');
  const i18n11 = read('src/lib/i18n-ui.js');
  assert.ok(!/⚠️|\uD83D\uDCAF|\uD83C\uDFAF|▶|☢|⟳|\uD83D\uDD11|\uD83D\uDCCA|\uD83D\uDDA5|\uD83D\uDCDD|\uD83D\uDDD1|⏱|\uD83D\uDCC4/.test(i18n11), 'القاموس لسه لابس قبعة الحفلة');
  const enAt = i18n11.indexOf('en: {');
  const enBlock = i18n11.slice(enAt, i18n11.indexOf('}\n  };', enAt));
  assert.ok(enBlock.length > 2000, 'كتلة الإنجليزية مقصوصة؟');
  assert.ok(!/[\u0600-\u06FF]/.test(enBlock), 'حروف عربية لسه في القاموس الإنجليزي');
  assert.match(i18n11, /langBtn: 'AR'/, 'زر اللغة في الوضع الإنجليزي مش AR');
  assert.match(i18n11, /langBtn: 'EN'/, 'زر اللغة في الوضع العربي مش EN');
  assert.match(i18n11, /btnResetCfg: '/, 'مفتاح الزرار مش في العربي');
  assert.match(i18n11, /btnResetCfg: 'Reset',/, 'مفتاح الزرار مش متجدد في الإنجليزي');
  assert.match(panel, /confirm\(t\('confirmConfigReset'\)\)/, 'تأكيد إعادة الضبط مش بيستخدم المفتاح المترجم');
});

test('v12111: الأفياتار فوق البوب‌أب ويطير بقوس لمكانه في الهيدر — والهوية على الكرت', () => {
  const pnlHtml11 = read('src/sidepanel/side-panel.html');
  assert.match(pnlHtml11, /id="modalAvatar" class="modal-avatar"/, 'صورة الأفياتار مش فوق البوب‌أب');
  assert.match(pnlHtml11, /data-i18n="warnText">[^<]{20,140}</, 'نص التنبيه مش مختصر (20-140 حرف)');
  assert.ok(fs.existsSync(join(root, 'src/sidepanel/avatar.jpg')), 'ملف الصورة مش في باكدج');
  assert.match(panel, /warn-fly/, 'الفلاي كلون مش بيتعمل');
  assert.match(panel, /prefers-reduced-motion/, 'خيار تقليل الحركة مش محترمى');
  assert.match(panel, /querySelector\('\.brand-avatar'\)/, 'هدف الهيدر مش محدد');
  assert.match(panel, /slot\.style\.visibility = ''/, 'الهبوط مابيرجّعش الأفياتار الأصلي');
  assert.match(panel, /setTimeout\(\(\) => \{ try \{ if \(document\.body\.contains\(clone\)\)/, 'حرس الـcleanup لو الحركة اتقطعت مش موجود');
  const css11 = read('src/sidepanel/side-panel.css');
  assert.match(css11, /\.modal-avatar \{/, 'ستايل الأفياتار الكبير مش موجود');
  assert.match(css11, /\.modal-card \{[\s\S]*?--gold-soft/, 'كرت البوب‌أب لسه مالابسش الهوية');
  assert.ok(!/#b91c1c|#43140a|#fecaca/.test(css11), 'لون التحذير الأحمر القديم رجع');
});

/* -------- v1.21.12 — النسخ للشيت للمفحوص بس + ترميم مستمع البث -------- */

test('v12112: نسخ للشيت بياخد اللي له نتيجة فعلًا — وعداد سطور في الرسالة', () => {
  const fn = panel.slice(panel.indexOf('async function copyTsv'));
  const fnBody = fn.slice(0, fn.indexOf('\n}', 200) + 2);
  assert.match(fnBody, /exportEntriesInUserOrder\(\)\.filter\(\(e\) => e\.result\)/, 'الفيلتر مش موجود — النسخ لسه بيلف كل القائمة');
  assert.ok(!/hasData/.test(fnBody), 'hasData القديم لسه بياكد على الفراغات');
  assert.match(fnBody, /t\('copyEmpty'\)/, 'رسالة الفاضي اتشالت');
  assert.ok((panel.match(/t\('copyDone'\)\.replace\('\{n\}', String\(entries\.length\)\)/g) || []).length === 2, 'عداد السطور مش في المسارين (clipboard + fallback)');
  const i18 = read('src/lib/i18n-ui.js');
  assert.match(i18, /copyDone: 'اتنسخ \{n\} سطر/, 'العداد مش في العربي');
  assert.match(i18, /copyDone: 'Copied \{n\} rows/, 'العداد مش في الإنجليزي');
  assert.match(i18, /thLocal: 'Local',/, 'عنوان «محلي» لسه عربي متقسّر في الإنجليزي');
  assert.ok(!/'محلي', 'URL'/.test(panel), 'عنوان الشيت hardcoded تاني');
  // XLSX والـCSV والتصدير الكامل فضلوا بكل الصفوف المحاذاة — الفيلتر للنسخة اليدوية بس
  const xlsxAt = panel.indexOf('function resultRowsForExport');
  assert.ok(xlsxAt === -1 || !/\.filter\(\(e\) => e\.result\)/.test(panel.slice(0, panel.indexOf('async function copyTsv'))), 'الفيلتر تسرّل لدوال التصدير التانية');
});

test('v12112: مستمع البث سليم — LOG بيوصل appendLog جوه فرع لوحيده', () => {
  assert.match(panel, /\n    \} else if \(message\.type === C\.MSG\.LOG\) \{/, 'سطر else-if لسه مدفون في تعليق — السجل الحي بيموت');
  assert.ok(!/كفاية[^\n]*\} else if/.test(panel), 'التعليق بيلتهم السطر تاني');
  const at = panel.indexOf('} else if (message.type === C.MSG.LOG)');
  assert.ok(at > -1 && panel.slice(at, at + 90).indexOf('appendLog') > -1, 'appendLog مش في فرع LOG');
});

/* -------- v1.21.13 — تصفير شامل، توسيط العمود، وحركة خفيفة زيادة -------- */

test('v12113: التصفير الكامل — إعدادات وكلمات ونتائج في رسالة واحدة من الراوتر', () => {
  const at = rt13().indexOf('case C.MSG.CONFIG_RESET');
  assert.ok(at > -1, 'الحالة نفسها مش في الراوتر');
  const seg = rt13().slice(at, at + 900);
  assert.match(seg, /await state\.resetConfig\(\);/, 'الإعدادات مالرجعتش');
  assert.match(seg, /await state\.clearKeywords\(\);/, 'الكلمات ماتبتمسحش — طلب المستخدم');
  assert.match(seg, /await state\.clearResults\(\);/, 'النتائج ماتبتمسحش');
  assert.match(seg, /engine\.broadcast\(\);[\s\S]*?return \{ ok: true \};/, 'البث بعد التصفير مفقود — اللوحة هتفضل عالقة');
  assert.ok(!/chrome\.windows/.test(seg), 'ولا حاجة غريبة اتسربت للمسار');
  assert.match(seg, /reason: 'running'/, 'حرس الرن الشغال ناقص — تصفير في النص = سباق بيانات');
  assert.match(panel, /res\.reason === 'running'\) \{ alert\(t\('resetBusy'\)\)/, 'اللوحة ما بتتعاملش مع الرفض');
  const i18b = read('src/lib/i18n-ui.js');
  assert.match(i18b, /resetBusy: 'في رن شغال/, 'رسالة الانشغال ناقصة في العربي');
  assert.match(i18b, /resetBusy: 'A run is in progress/, 'رسالة الانشغال ناقصة في الإنجليزي');
  const i18 = read('src/lib/i18n-ui.js');
  assert.match(i18, /btnResetCfg: 'إعادة ضبط',/, 'التسمية العربية مش على قرار 1.21.15');
  assert.match(i18, /btnResetCfg: 'Reset',/, 'التسمية الإنجليزية مش على قرار 1.21.15');
  assert.match(i18, /مش هيرجع|التصفير نهائي/, 'تحذير النهائيّة مش في العربي');
  assert.match(i18, /cannot be undone/, 'تحذير النهائيّة مش في الإنجليزي');
  const pnlHtml = read('src/sidepanel/side-panel.html');
  assert.match(pnlHtml, /data-i18n="btnResetCfg">إعادة ضبط<\/button>/, 'الزر في الـHTML لسه بالنص الطويل');
});

function rt13() { return read('src/background/core/router.js'); }

test('v12113: العمود في المنتصف بالظبط + الأنيميشن الخفيف بحرس reduced-motion', () => {
  const css = read('src/sidepanel/side-panel.css');
  const bAt = css.indexOf('\nbody {');
  const bodyRule = css.slice(bAt, css.indexOf('}', bAt));
  assert.match(bodyRule, /max-width: 780px;/, 'سقف العرض مش محطوط — المحتوى هيمشي شمال في البروفايل العريض');
  assert.match(bodyRule, /margin-inline: auto;/, 'التوسيط مش موجود');
  assert.match(css, /@keyframes pop-in \{/, 'pop-in مش معرّف');
  assert.match(css, /\.modal-card \{ animation: pop-in/, 'الكارت ما بيركبش الحركة');
  assert.match(css, /\.tab-pane:not\(\.hidden\) \{ animation: pane-in \.2s ease-out; \}/, 'تبديل التبويبات من غير fade');
  assert.match(css, /\.btn:not\(:disabled\):active \{ transform: scale\(\.965\); \}/, 'ضغط الأزرار محسوسش');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none/, 'حرس تقليل الحركة مش مغطي الجديد');
  // الأنيميشن CSS-only: مفيش ولا سطر JS جديد بيحرك فريمات
  assert.ok(!/requestAnimationFrame/.test(panel), 'rAF اتسرب للوحة — ممنوع');
});

/* -------- v1.21.14 — اسم الملف: tracking-الاسم-اليوم -------- */

test('v12114: تنزيل الملف بيبان باسم tracking + اسم الموقع بالإنجليزي + تاريخ يوم-شهر-سنة', () => {
  const at = panel.indexOf('function exportFileName');
  assert.ok(at > -1, 'مفيش مساعد تسمية');
  const fn = panel.slice(at, panel.indexOf('\n}', at) + 2);
  assert.match(fn, /'tracking'/, "مفيش بادئة 'tracking'");
  assert.match(fn, /storeNameEn \|\| cfg\.storeDomain/, 'مفيش ترجيع للدومين لو الاسم الإنجليزي فاضي');
  assert.match(fn, /slice\(0, 40\)/, 'الاسم الطويل مبيتقصش');
  assert.match(fn, /p2\(d\.getDate\(\)\) \+ '-' \+ p2\(d\.getMonth\(\) \+ 1\) \+ '-' \+ d\.getFullYear\(\)/, 'التاريخ مش يوم-شهر-سنة بمحليه');
  assert.match(fn, /\.replace\(\/\\s\+\/g, '-'\)/, 'المسافات ماتتحولتش لشرطة');
  assert.ok(panel.indexOf("a.download = exportFileName('xlsx')") > panel.indexOf('async function makeXlsx'), 'مسار الـXLSX لسه بالاسم القديم');
  assert.ok(panel.indexOf("a.download = exportFileName('csv')") > panel.indexOf('async function exportCsv'), 'مسار الـCSV لسه بالاسم القديم');
  assert.ok(!/srt-ranks-|srt-results-/.test(panel), 'الأسماء القديمة لسه عايشة في حتة');
  assert.match(panel, /maybeAutoXlsx[\s\S]{0,420}makeXlsx\(true\)/, 'التلقائي آخر الرن مش بيمر على نفس الدالة — لازم نفس التسمية');
});

/* -------- v1.21.15 — حرية الحركة، «لقيت؟ امشي»، وأقل 403 -------- */

test('v12115: القفل اتلغى — لمس المستخدم بيلغي أي سكرول آلي في الكلمة دي', () => {
  assert.ok(!/scrollLocked/.test(serp), 'scrollLocked رجع — خناق الماوس ممنوع');
  assert.ok(!/setInterval\(\(\) => \{ if \(scrollLocked\)/.test(serp), 'الـsnap النصفي رجع');
  assert.match(serp, /window\.addEventListener\('wheel', claimScroll, \{ passive: true \}\)/, 'مفيش تنصت للعجلة');
  assert.match(serp, /touchstart/, 'لمس الشاشات المغيش — لازم كمان يتحرر');
  assert.match(serp, /if \(!userOwns\) \{/, 'دورة السكرول مش متأمنة بلمسة المستخدم');
  // الـno-op alias عشان نداءات قديمة ما تتكسرش
  assert.match(serp, /function relock\(\) \{ if \(userOwns\) \{ return; \} \}/, 'relock مش على مقاس الحرية الجديدة');
  assert.ok(!/lockScroll\(\); \}/.test(serp), 'قفل إجباري تاني تسرّل');
});

test('v12115: المسار البدري بيطير على طول — ميزانية AI قصيرة عند اللقية', () => {
  assert.match(serp, /async function finalizeAi\(aiSnap, budgetMs\)/, 'الميزانية ما اتمررتش للدالة');
  assert.match(serp, /waitForAiRoot\(budgetMs \|\| 5000\)/, 'الدالة مابتستخدميش الميزانية — والـ5000 للـfull لسه الأساس');
  assert.match(serp, /finalizeAi\(early\.ai, 1200\)/, 'خروج أول شاشة لسه بمستنى الـ5 ثانية');
  assert.match(serp, /const aiF = await finalizeAi\(ai, 1200\);/, 'خروج النزول لسه بمستنى الـ5 ثانية');
  // حكم عدم الوجود الكامل ما اتقصّرش
  const judgeAt = serp.indexOf('// 3) حكم عدم الوجود');
  assert.match(serp.slice(judgeAt, judgeAt + 700), /await finalizeAi\(\{ items: \[\], text: '' \}\);/, 'ميزانية حكم النهاية اتقصّرت بالغلط — دقة AI محتاجاها');
});

test('v12115: التسخين قبل البحث — بعد كل مسح وفي أول رن بارد (403 أقل)', () => {
  const at = queue.indexOf('async openFreshTab');
  const fn = queue.slice(at, at + 1800);
  assert.match(fn, /browsingData\.remove[\s\S]*?tabctl\.open\('https:\/\/www\.google\.com\/'/, 'الترتيب مش: مسح ← رئيسية جوجل ← بحث');
  assert.match(fn, /waitForComplete\(nextTab\.id, 15000\)/, 'مفيش انتظار تحميل الرئيسية');
  assert.match(fn, /sleep\(1000 \+ Math\.floor\(Math\.random\(\) \* 800\)\)/, 'مفيش وقفة آدمية بين التسخين والبحث');
  assert.match(fn, /tabctl\.navigate\(nextTab\.id, url\)/, 'البحث بالكلمة ما اتعملش بعد التسخين');
  const coldAt = queue.indexOf('const coldStart = !!cfg.clearBeforeRun');
  assert.ok(coldAt > -1, 'أول تاب في الرن البارد مش بيتسخن');
  assert.match(queue.slice(coldAt, coldAt + 700), /navigate\(tab\.id, url\)/, 'التسخين البارد مابيكملش للبحث');
  // التوقيع الجاف للـ403 بقى مغطى
  const es = read('src/lib/errorsig.js');
  assert.match(es, /403\. that's an error/, 'توقيع 403 الجاف ناقص');
  assert.match(es, /429\. that's an error/, 'توقيع 429 الجاف ناقص');
});

test('v12115: الزرار «إعادة ضبط» — نفس السلوك الشامل بلا تغيير', () => {
  const at = rt13b().indexOf('case C.MSG.CONFIG_RESET');
  const seg = rt13b().slice(at, at + 900);
  assert.match(seg, /resetConfig[\s\S]*clearKeywords[\s\S]*clearResults/, 'ترتيب التصفير الشامل اتبوظ');
  assert.match(seg, /reason: 'running'/, 'حرس الرن الشغال اتشال — لأ');
});
function rt13b() { return read('src/background/core/router.js'); }
