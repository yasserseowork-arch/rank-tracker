/**
 * v1.21.40 — تثبيت إصلاحات الجولة العميقة (تدقيق كامل)
 * الاختبارات هنا بتحمي السلوك اللي اتصلح، مش النص — أي كسر مستقبلي يقع فورًا.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadClassic } from './helpers/load-classic.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const csv = loadClassic('src/lib/csv.js').SRT.csv;

test('v12140: تحصين حقن الصيغ في CSV وTSV — الكلمة المفتاحية مش صيغة حيّة', () => {
  const evil = '=HYPERLINK("http://evil.example","اضغط")';
  const out = csv.build([['keyword', 'rank'], [evil, '4']], ',');
  assert.ok(out.includes("'=HYPERLINK"), 'خلية CSV بتبدأ بـ = لسه صيغة حيّة');
  assert.ok(!/(^|\r\n)=HYPERLINK/.test(out), 'الفورمولا عدّت في أول الخلية');
  const tsv = csv.toTsv([['+cmd|calc', '@SUM(1)', '-2', 'عادي']]);
  const cells = tsv.split('\t');
  assert.equal(cells[0], "'+cmd|calc");
  assert.equal(cells[1], "'@SUM(1)");
  assert.equal(cells[2], "'-2");
  assert.equal(cells[3], 'عادي');
});

test('v12140: router بيرد على رسائل التبويبات — الحارس الميت اتصلح', () => {
  const rt = read('src/background/core/router.js');
  // allowedForContent لازم تتنفّذ قبل البوابة، مش بعدها
  // الحارس بيسمح للمحتوى بالقراءة بس، وبيقفل الباقي — بغض النظر عن بوابة صفحات الإضافة
  assert.match(rt, /const allowedForContent = \[C\.MSG\.GET_CONFIG, C\.MSG\.PING\];/,
    'مفيش قايمة رسائل مسموحة للمحتوى');
  assert.match(rt, /if \(!isExtensionPage && !allowedForContent\.includes\(type\)\) \{ return; \}/,
    'الحارس مش قبل بوابة صفحات الإضافة — رسائل التبويبات هتترمي');
  // وكل أنواع الرن/الإعدادات/الكلمات ممنوعة على المحتوى ضمنيًا (مش في القايمة)
  for (const forbidden of ['QUEUE_START', 'QUEUE_STOP', 'SET_CONFIG', 'KEYWORDS_CLEAR', 'CONFIG_RESET']) {
    assert.ok(!new RegExp('allowedForContent = \\[[^\\]]*' + forbidden).test(rt),
      forbidden + ' مفتوحة للمحتوى — تصعيد صلاحيات');
  }
  assert.ok(rt.indexOf('allowedForContent') < rt.indexOf('const handled'),
    'الحارس بيتنفّذ بعد ما الرسالة تكون اتقبلت');
  // قراءة الإعدادات لازم تكون مسموحة فعلًا (العلة الأم)
  assert.ok(rt.includes('case C.MSG.GET_CONFIG:'), 'GET_CONFIG مش متخدم');
});

test('v12140: مسح بيانات التصفح محصور في جوجل — ومع مفتاح رجوع للسلوك القديم', () => {
  const q = read('src/background/core/queue.js');
  assert.match(q, /async googleWipe\(opts\)/, 'مفيش مسح محصور');
  assert.match(q, /clearScopeGoogle !== false/, 'مفتاح الرجوع للسلوك القديم مش موصول');
  const st = read('src/background/core/state.js');
  assert.match(st, /clearScopeGoogle: true/, 'المفتاح مش في الافتراضيات');
  assert.match(st, /'clearScopeGoogle'/, 'المفتاح مش في تطهير البولينز');
  // المسح القديم على كل المواقع ما يفضلش في مسارات التشغيل
  assert.equal((q.match(/\{ since: 0 \}, \{ cacheStorage: true, history: true, cookies: true \}/g) || []).length, 1,
    'لسه فيه مسح شامل غير محصور بـclearScopeGoogle');
  assert.match(q, /origins/, 'المسح مش مربوط بنطاقات جوجل');
});

test('v12140: الشيت — تاب الشيت المطابق بالـID مش أي شيت مفتوح', () => {
  const q = read('src/background/core/queue.js');
  assert.match(q, /spreadsheets\\\/\(\?:u\\\/\\d\+\\\/\)\?d\\\/\(\[a-zA-Z0-9-_\]\+\)/, 'مفيش استخراج ID للشيت');
  assert.match(q, /return sheetId \? u\.indexOf\(sheetId\) !== -1 : false;/, 'المطابقة لسه بأي تاب شيت');
  assert.match(q, /cfg\.sheetWriteBack === true/, 'مفتاح الكتابة التلقائية لسه مش مقروء');
});

test('v12140: تسريب مستمعي الإلغاء اتقفل — once لوحدها مش كفاية', () => {
  const files = ['src/background/core/queue.js', 'src/background/core/scheduler.js', 'src/background/core/captcha-orchestrator.js'];
  for (const f of files) {
    const s = read(f);
    if (!s.includes("addEventListener('abort'")) { continue; }
    assert.match(s, /removeEventListener\('abort'/, f + ': مستمع الإلغاء بيتضاف ومش بيتشال — تسريب');
  }
  // مفيش addEventListener('abort', ...) مجهول متبقي في الملفات التلاتة
  for (const f of files) {
    const s = read(f);
    assert.ok(!/addEventListener\('abort', \(\) =>/.test(s), f + ': لسه مستمع مجهول — مش هيتشال');
  }
});

test('v12140: السقف اليومي بيتحسب بالتوقيت المحلي مش UTC', () => {
  const st = read('src/background/core/state.js');
  const at = st.indexOf('export async function getDailyCount');
  const fn = st.slice(at, at + 400);
  assert.ok(!fn.includes('toISOString'), 'لسه UTC — السقف بيرجع نص الليل بدل آخر اليوم');
  assert.match(fn, /getFullYear\(\)/, 'مفيش تاريخ محلي');
});

test('v12140: «بحث مفيش» مش «مش موجودة» — التصدير بيكتب شرطة', () => {
  const q = read('src/background/core/queue.js');
  assert.match(q, /inconclusive: \(via === 'retries-exhausted'\)/, 'الصف مش متعلّم بإنه بلا حكم');
  assert.match(q, /if \(r\.inconclusive\) \{ return '—'; \}/, 'تصدير queue لسه بيكتب حكم');
  const p = read('src/sidepanel/side-panel.js');
  assert.match(p, /if \(r\.inconclusive\) \{ return '—'; \}/, 'تصدير اللوحة لسه بيكتب «no»');
  assert.match(p, /r\.inconclusive \? 'unknown'/, 'عمود الحكم في اللوحة مش متصل');
});

test('v12140: مانيفستات الأدوات الصحابية — كل الأنماط قانونية وبتغطي مصر', () => {
  const legal = /^https:\/\/(\*\.|www\.)?google\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})\/search\*$/;
  for (const dir of ['beyondten', 'serpcounter']) {
    const man = JSON.parse(read(dir + '/manifest.json'));
    const ms = man.content_scripts[0].matches;
    for (const m of ms) {
      assert.match(m, legal, dir + ': نمط غير قانوني ' + m);
    }
    assert.ok(ms.some((m) => m.includes('google.com.eg')), dir + ': مصر مش مغطاة');
  }
  const main = JSON.parse(read('manifest.json'));
  assert.ok(!main.permissions.includes('webRequest'), 'webRequest لسه مطلوبة وسبها مش متعلقة');
  assert.ok(main.permissions.includes('history'), 'صلاحية history ناقصة — التاريخ مش هيتنضف');
  assert.ok(!(main.host_permissions || []).includes('<all_urls>'), 'الصلاحية الشاملة لسه موجودة');
});

test('v12140: التسخين الصوتي مش بيشتغل كل استيقاظ للـworker', () => {
  const sw = read('src/background/sw.js');
  assert.ok(!/^import\('\.\/core\/solver\.js'\)/m.test(sw), 'التسخين لسه على مستوى الموديول');
  assert.match(sw, /async function maybePrewarm\(\)/, 'مفيش بوابة للتسخين');
  assert.match(sw, /now - lastOk < 24 \* 60 \* 60 \* 1000/, 'التسخين مش محدود باليوم');
});

test('v12140: صفحة الإعدادات بتبعت الحقل اللي اتغيّر بس', () => {
  const o = read('src/options/options.js');
  const at = o.indexOf("el.addEventListener('change'");
  const seg = o.slice(at, at + 1200);
  assert.ok(!/for \(const \[fid, key, kind\] of FIELDS\)\s*\{\s*const fel/.test(seg), 'لسه بيبعت كل الحقول');
  assert.ok(seg.includes('patch[key]'), 'الحقل المتغيّر مش هو اللي بيتبعت');
  assert.match(seg, /if \(!Number\.isFinite\(n\)\)/, 'رقم فاضي بيتحول صفر');
});
